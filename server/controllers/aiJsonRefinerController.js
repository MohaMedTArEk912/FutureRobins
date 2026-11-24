import Groq from 'groq-sdk';
import fs from 'fs';
import { createRequire } from 'module';
import { scheduleNormal } from '../utils/aiLimiter.js';
import { smartTruncate } from '../utils/tokenOptimizer.js';
import {
  normalizeSlide,
  VALID_THEMES,
  VALID_LAYOUTS
} from '../utils/motionSlideParser.js';
import { sanitizeQuestions } from './quizController.js';

const require = createRequire(import.meta.url);

let extractorInstance = null;

const getExtractorInstance = async () => {
  if (!extractorInstance) {
    const { getTextExtractor } = await import('office-text-extractor');
    extractorInstance = getTextExtractor();
  }
  return extractorInstance;
};

const getGroqClient = () => {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) return null;
  try {
    return new Groq({ apiKey: key });
  } catch (err) {
    console.warn('[AI JSON Refiner] Failed to initialize Groq client:', err.message);
    return null;
  }
};

const GROQ_REFINER_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-20b'
];

const VALID_QUIZ_ICONS = new Set([
  'Code', 'BookOpen', 'Brain', 'Target', 'Trophy', 'Lightbulb',
  'Award', 'Rocket', 'Monitor', 'FlaskConical', 'Zap', 'Wrench'
]);

const VALID_CONTENT_TYPES = new Set([
  'quiz',
  'question-pool',
  'presentation',
  'roadmap',
  'badges',
  'compiler-questions',
  'tournament'
]);

const extractUploadedFileText = async (fileObj) => {
  if (!fileObj || !fileObj.path) return '';
  const filePath = fileObj.path;
  const lowerName = (fileObj.originalname || '').toLowerCase();
  const mime = (fileObj.mimetype || '').toLowerCase();
  try {
    if (!fs.existsSync(filePath)) return '';
    if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
      const dataBuffer = fs.readFileSync(filePath);
      if (typeof DOMMatrix === 'undefined') {
        global.DOMMatrix = class DOMMatrix {
          constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
          setMatrixValue() {}
          multiply() { return this; }
          translate() { return this; }
          scale() { return this; }
          rotate() { return this; }
          toString() { return 'matrix(1, 0, 0, 1, 0, 0)'; }
        };
      }
      const pdfParseLib = require('pdf-parse');
      const PDFParseEntity = pdfParseLib.PDFParse || pdfParseLib;
      try {
        const instance = new PDFParseEntity(dataBuffer);
        const result = typeof instance?.then === 'function' ? await instance : await instance.getText();
        return result?.text || '';
      } catch {
        const instanceV2 = new PDFParseEntity({ data: dataBuffer });
        return (await instanceV2.getText())?.text || '';
      }
    }

    if (mime.includes('presentation') || lowerName.endsWith('.pptx')) {
      const extractor = await getExtractorInstance();
      const extracted = await Promise.race([
        extractor.extractText({ input: filePath, type: 'file' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PPTX extraction timeout')), 30000))
      ]);
      return extracted || '';
    }

    return fs.readFileSync(filePath, 'utf8');
  } finally {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore cleanup error */ }
    }
  }
};

const stripAiPromptMetadata = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripAiPromptMetadata);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '_aiPrompt') continue;
      out[k] = stripAiPromptMetadata(v);
    }
    return out;
  }
  return value;
};

const tryParseLooseJson = (rawInput) => {
  if (rawInput && typeof rawInput === 'object') return rawInput;
  let text = String(rawInput || '').trim();
  if (!text) throw new Error('JSON content is empty');

  // Strip BOM & markdown code fences
  text = text.replace(/^\uFEFF/, '');
  const fenceMatch = text.match(/^```(?:json|JSON)?\s*\r?\n([\s\S]*?)\r?\n```$/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(text);
  } catch (firstErr) {
    // Attempt forgiving cleanup for trailing commas
    const noTrailingCommas = text.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(noTrailingCommas);
    } catch {
      throw new Error(`Invalid JSON syntax: ${firstErr.message}`);
    }
  }
};

const detectContentType = (data, requestedType = 'auto') => {
  if (requestedType && requestedType !== 'auto' && VALID_CONTENT_TYPES.has(requestedType)) {
    return requestedType;
  }

  if (Array.isArray(data)) {
    const first = data.find(item => item && typeof item === 'object') || {};
    if ('badgeId' in first || 'unlockCriteria' in first || 'rarity' in first) return 'badges';
    if ('referenceCode' in first && ('language' in first || 'description' in first)) return 'compiler-questions';
    if ('modules' in first || 'trackId' in first) return 'roadmap';
    if ('slides' in first) return 'presentation';
    if ('quizMode' in first || 'customQuiz' in first || 'startsAt' in first) return 'tournament';
    if (first.isQuestionPool || first.quizType === 'pool') return 'question-pool';
    if ('questions' in first || 'timeLimit' in first) return 'quiz';
    return 'quiz';
  }

  if (!data || typeof data !== 'object') return 'quiz';

  if (Array.isArray(data.slides)) return 'presentation';
  if (Array.isArray(data.modules) || 'trackId' in data) return 'roadmap';
  if (Array.isArray(data.badges) || 'badgeId' in data || 'unlockCriteria' in data) return 'badges';
  if ('quizMode' in data || 'customQuiz' in data || ('startsAt' in data && 'endsAt' in data)) return 'tournament';
  if ('referenceCode' in data && ('language' in data || 'description' in data)) return 'compiler-questions';

  if (Array.isArray(data.quizzes)) {
    const hasPool = data.quizzes.some(q => q && (q.isQuestionPool || q.quizType === 'pool'));
    return hasPool ? 'question-pool' : 'quiz';
  }

  if (Array.isArray(data.questions)) {
    const firstQ = data.questions.find(q => q && typeof q === 'object');
    if (firstQ && 'referenceCode' in firstQ && !('question' in firstQ) && !('compilerConfig' in firstQ)) {
      return 'compiler-questions';
    }
    if (data.isQuestionPool || data.quizType === 'pool' || 'poolSize' in data) {
      return 'question-pool';
    }
    return 'quiz';
  }

  return 'quiz';
};

const hasRawMarkdown = (text) => {
  if (typeof text !== 'string') return false;
  return /\*\*[^*]+\*\*|^#{1,6}\s+|```|`[^`]+`|\*[^*\n]{2,}\*/m.test(text);
};

const checkQuizArrayIssues = (quizzes, type, issues) => {
  quizzes.forEach((quiz, qzIdx) => {
    if (!quiz || typeof quiz !== 'object') return;
    const prefix = quizzes.length > 1 ? `quizzes[${qzIdx}]` : 'root';

    if ('coinReward' in quiz && !('coinsReward' in quiz)) {
      issues.push({ severity: 'warning', path: `${prefix}.coinReward`, message: 'Uses legacy "coinReward"; canonical platform field is "coinsReward".' });
    }
    if (quiz.difficulty && !['Beginner', 'Intermediate', 'Advanced'].includes(quiz.difficulty)) {
      issues.push({ severity: 'warning', path: `${prefix}.difficulty`, message: `Non-standard difficulty "${quiz.difficulty}"; expected Beginner, Intermediate, or Advanced.` });
    }
    if (quiz.icon && !VALID_QUIZ_ICONS.has(quiz.icon)) {
      issues.push({ severity: 'tip', path: `${prefix}.icon`, message: `Icon "${quiz.icon}" is not in the 12 supported QuizIconKey icons; fallback applies.` });
    }
    if (type === 'question-pool' && !quiz.isQuestionPool && quiz.quizType !== 'pool') {
      issues.push({ severity: 'warning', path: `${prefix}.isQuestionPool`, message: 'Pool JSON should set "isQuestionPool": true and "quizType": "pool".' });
    }

    const qs = Array.isArray(quiz.questions) ? quiz.questions : [];
    if (qs.length === 0) {
      issues.push({ severity: 'error', path: `${prefix}.questions`, message: 'No questions found in quiz.' });
    }
    qs.forEach((q, idx) => {
      if (!q || typeof q !== 'object') return;
      const qp = `${prefix}.questions[${idx}]`;
      if (typeof q.id !== 'number') {
        issues.push({ severity: 'warning', path: `${qp}.id`, message: 'Question id should be a unique numeric integer (1, 2, 3...).' });
      }
      const qText = q.question || q.text || '';
      if (!String(qText).trim()) {
        issues.push({ severity: 'error', path: `${qp}.question`, message: 'Question text is empty.' });
      }
      if (hasRawMarkdown(qText) || hasRawMarkdown(q.explanation || '') || (Array.isArray(q.options) && q.options.some(hasRawMarkdown))) {
        issues.push({ severity: 'warning', path: qp, message: 'Contains raw Markdown (**bold**, `backticks`, ###); MathRenderer only renders plain text + $LaTeX$.' });
      }
      if (!q.explanation || String(q.explanation).trim().length < 15) {
        issues.push({ severity: 'tip', path: `${qp}.explanation`, message: 'Missing or very short explanation after submission.' });
      }
      if ((q.type === 'compiler' || q.compilerConfig) && !q.isCompiler) {
        issues.push({ severity: 'error', path: `${qp}.isCompiler`, message: 'Compiler question is missing "isCompiler: true" (required by QuizTaking to mount Monaco Editor).' });
      }
      if ((q.type === 'compiler' || q.isCompiler) && !q.compilerConfig?.referenceCode) {
        issues.push({ severity: 'error', path: `${qp}.compilerConfig.referenceCode`, message: 'Compiler question requires "compilerConfig.referenceCode" for grading & QuizEditorModal.' });
      }
      if (q.type === 'ordering' && Array.isArray(q.orderingItems) && q.orderingItems.some(item => String(item).length > 65)) {
        issues.push({ severity: 'tip', path: `${qp}.orderingItems`, message: 'One or more ordering items exceed 65 chars and may truncate on compact cards.' });
      }
    });
  });
};

const auditExistingJson = (data, detectedType) => {
  const issues = [];
  if (!data || typeof data !== 'object') {
    issues.push({ severity: 'error', path: 'root', message: 'Parsed JSON is not a valid object or array.' });
    return issues;
  }

  if (detectedType === 'quiz' || detectedType === 'question-pool') {
    const quizzes = Array.isArray(data)
      ? data
      : Array.isArray(data.quizzes)
        ? data.quizzes
        : [data];
    checkQuizArrayIssues(quizzes, detectedType, issues);
  } else if (detectedType === 'presentation') {
    const slides = Array.isArray(data.slides) ? data.slides : [];
    if (!data.title) {
      issues.push({ severity: 'error', path: 'title', message: 'Presentation title is missing.' });
    }
    if (data.theme && !VALID_THEMES.has(data.theme)) {
      issues.push({ severity: 'warning', path: 'theme', message: `Unsupported theme "${data.theme}". Use dark-tech, bento, editorial, or neon.` });
    }
    if (slides.length === 0) {
      issues.push({ severity: 'error', path: 'slides', message: 'Presentation contains no slides.' });
    }
    let checkupCount = 0;
    let wireframeCount = 0;
    slides.forEach((s, i) => {
      if (!s || typeof s !== 'object') return;
      const sp = `slides[${i}]`;
      if (s.layout === 'checkup') {
        checkupCount++;
        if (!s.checkupQuestion?.question || !Array.isArray(s.checkupQuestion?.options) || s.checkupQuestion.options.length < 2) {
          issues.push({ severity: 'error', path: `${sp}.checkupQuestion`, message: 'Checkup slide is missing valid question/options.' });
        }
      }
      if (s.layout === 'wireframe' || s.visualBlock) wireframeCount++;
      if (s.layout && !VALID_LAYOUTS.has(String(s.layout).toLowerCase())) {
        issues.push({ severity: 'warning', path: `${sp}.layout`, message: `Unknown layout "${s.layout}".` });
      }
      if (hasRawMarkdown(s.title) || hasRawMarkdown(s.body) || hasRawMarkdown(s.callout) || (Array.isArray(s.bullets) && s.bullets.some(hasRawMarkdown))) {
        issues.push({ severity: 'warning', path: sp, message: 'Raw Markdown (**bold**, `code`) detected in slide text; PresentationModePlayer renders plain text only.' });
      }
      if (!s.speakerNotes) {
        issues.push({ severity: 'tip', path: `${sp}.speakerNotes`, message: 'Missing teacher speakerNotes.' });
      }
    });
    if (slides.length >= 4 && checkupCount === 0) {
      issues.push({ severity: 'tip', path: 'slides', message: 'No interactive checkup poll slide included.' });
    }
    if (slides.length >= 4 && wireframeCount === 0) {
      issues.push({ severity: 'tip', path: 'slides', message: 'Consider adding at least 1 clickable visualBlock (wireframe/split-cards/footer-anatomy) slide.' });
    }
  } else if (detectedType === 'compiler-questions') {
    const items = Array.isArray(data) ? data : Array.isArray(data.questions) ? data.questions : [data];
    items.forEach((q, idx) => {
      if (!q || typeof q !== 'object') return;
      const qp = items.length > 1 ? `[${idx}]` : 'root';
      if (!q.referenceCode || !String(q.referenceCode).trim()) {
        issues.push({ severity: 'error', path: `${qp}.referenceCode`, message: 'Missing referenceCode solution.' });
      }
      if (hasRawMarkdown(q.description)) {
        issues.push({ severity: 'warning', path: `${qp}.description`, message: 'DailyChallenge renders description as plain text (whitespace-pre-wrap); remove Markdown backticks/asterisks.' });
      }
      if (!Array.isArray(q.hints) || q.hints.length === 0) {
        issues.push({ severity: 'tip', path: `${qp}.hints`, message: 'No progressive hints defined.' });
      }
    });
  } else if (detectedType === 'roadmap') {
    const modules = Array.isArray(data.modules) ? data.modules : [];
    if (!data.trackId) {
      issues.push({ severity: 'warning', path: 'trackId', message: 'Roadmap trackId slug is missing.' });
    }
    if (modules.length === 0) {
      issues.push({ severity: 'error', path: 'modules', message: 'Roadmap has no modules.' });
    }
    modules.forEach((m, idx) => {
      if (!m || typeof m !== 'object') return;
      if (!m.moduleId) issues.push({ severity: 'error', path: `modules[${idx}].moduleId`, message: 'Missing moduleId.' });
      if (!m.coordinates || typeof m.coordinates.x !== 'number' || typeof m.coordinates.y !== 'number') {
        issues.push({ severity: 'warning', path: `modules[${idx}].coordinates`, message: 'Missing numeric DAG canvas coordinates { x, y }.' });
      }
    });
  } else if (detectedType === 'badges') {
    const list = Array.isArray(data) ? data : Array.isArray(data.badges) ? data.badges : [data];
    list.forEach((b, idx) => {
      if (!b || typeof b !== 'object') return;
      const bp = list.length > 1 ? `[${idx}]` : 'root';
      if (!b.badgeId) issues.push({ severity: 'error', path: `${bp}.badgeId`, message: 'Missing unique badgeId.' });
      if (!b.unlockCriteria?.type) issues.push({ severity: 'warning', path: `${bp}.unlockCriteria`, message: 'Missing unlockCriteria rule.' });
    });
  } else if (detectedType === 'tournament') {
    if (!data.name) issues.push({ severity: 'error', path: 'name', message: 'Tournament name is missing.' });
    if (data.quizMode === 'custom') {
      const qs = data.customQuiz?.questions || [];
      if (qs.length === 0) {
        issues.push({ severity: 'error', path: 'customQuiz.questions', message: 'Custom tournament has no questions.' });
      }
      qs.forEach((q, idx) => {
        if (q && !q.text && !q.question) {
          issues.push({ severity: 'error', path: `customQuiz.questions[${idx}].text`, message: 'Tournament question requires "text" (not only "question").' });
        }
      });
    }
  }

  return issues.slice(0, 30);
};

const getSchemaContractPrompt = (type) => {
  switch (type) {
    case 'question-pool':
    case 'quiz':
      return `SCHEMA CONTRACT (${type === 'question-pool' ? 'QUESTION POOL' : 'QUIZ'}):
- Supported root format: single quiz object { id?, title, description, category, subjectId?, difficulty: 'Beginner'|'Intermediate'|'Advanced', timeLimit, coinsReward, xpReward, icon: 'Code'|'BookOpen'|'Brain'|'Target'|'Trophy'|'Lightbulb'|'Award'|'Rocket'|'Monitor'|'FlaskConical'|'Zap'|'Wrench', quizType: ${type === 'question-pool' ? "'pool'" : "'session'|'homework'|'exam'"}, isQuestionPool: ${type === 'question-pool'}, poolSize?, shuffleQuestions: true, isVisible: true, reviewMode?: boolean, questions: [...] } — OR wrapper { quizzes: [...] } if input used it. Keep the EXACT root shape (object vs wrapper vs array) of the input!
- Each question MUST have:
  - numeric integer "id" (1, 2, 3...)
  - "type": 'multiple-choice' | 'code-output' | 'text' | 'ordering' | 'matching' | 'compiler'
  - "question": string (plain text or KaTeX $...$ ONLY; NEVER Markdown **bold**, ###, or \`backticks\`)
  - "points": number (10-25), "part": string ('A'|'B'|'C'), "explanation": concise, insightful teaching explanation, "shuffleOptions": true
  - Type-specific required fields:
    - multiple-choice / code-output: "options": string[4], "correctAnswer": 0-based number; include "codeSnippet" for code-output
    - text: "correctAnswer": string | string[] (primary + short accepted aliases)
    - ordering: "orderingItems": string[] (concise <= 65 chars each in CORRECT order)
    - matching: "matchingPairs": [{ left: string, right: string }] (4-5 distinct pairs, <= 55 chars each)
    - compiler: MUST have BOTH "type": "compiler" AND "isCompiler": true, AND "compilerConfig": { language: 'python'|'javascript'|'java'|'cpp'|'typescript', initialCode: string, referenceCode: string }.
- Always use "coinsReward" (not legacy "coinReward"). Omit "_aiPrompt".`;

    case 'presentation':
      return `SCHEMA CONTRACT (MOTION PRESENTATION):
- Root object: { title, description, theme: 'dark-tech'|'bento'|'editorial'|'neon', sourceFormat: 'json', slides: MotionSlide[] }. Preserve presentationId/trackId/moduleId/clanId if present.
- MotionSlide fields: { id: string, order: number (0-based), layout: 'hero'|'bullets'|'split'|'code'|'comparison'|'timeline'|'wireframe'|'live-preview'|'checkup'|'homework'|'summary', motion: 'fade-up'|'slide-left'|'zoom-in'|'stagger'|'pop'|'flip', title (<= 8 words), subtitle, body (<= 2 sentences), bullets (3-5 crisp strings <= 14 words), codeSnippet?: { language, code }, visualBlock?: PageStructureBlock|SplitCardsBlock|FooterAnatomyBlock, callout, speakerNotes, durationSeconds: number, checkupQuestion?: { question, options[4], correctAnswer: 0..3, explanation, points } }.
- CRITICAL UI RULE: PresentationModePlayer renders PLAIN TEXT only — strip ALL Markdown (**bold**, *italic*, ###, \`backticks\`). Put code only in codeSnippet.code or visualBlock.sections[].code.
- visualBlock valid kinds: 'page-structure' (sections: [{ id, label, tag?, description, highlight?, code? }]), 'split-cards' (leftCard: { tag?, title, body }, rightCards: [{ title, subtitle?, badge? }]), 'footer-anatomy' (topNav: { brand, links }, columns: [{ title, items }]).
- Ensure layout='checkup' slides have complete 4-option checkupQuestion + explanation. Omit "_aiPrompt".`;

    case 'roadmap':
      return `SCHEMA CONTRACT (LEARNING ROADMAP / SKILLTRACK):
- Root object: { trackId, title, description, subjectId?, category, difficulty: 'Beginner'|'Intermediate'|'Advanced', isVisible: true, icon, color, modules: [...] }. Preserve _id if present.
- Each module: { moduleId, title, description, type: 'core'|'optional'|'achievement'|'project'|'quiz'|'milestone'|'exam', xpReward, coinsReward, estimatedMinutes, prerequisites: string[] (acyclic moduleIds), coordinates: { x, y } (clean well-spaced DAG), status: 'available' for level-0 roots and 'locked' for dependent modules, content?: { overview, objectives[], keyTerms[], resources[], subModules[] } }. Omit "_aiPrompt".`;

    case 'badges':
      return `SCHEMA CONTRACT (ACHIEVEMENT BADGES):
- Keep root shape (array, { badges: [...] }, or single object).
- Each badge: { badgeId: string, name: string, title: string, description: string, category: 'milestones'|'perfection'|'streaks'|'speed'|'xp'|'skills'|'social'|'arena'|'other', rarity: 'common'|'rare'|'epic'|'legendary'|'mythic', icon: string, color: string, unlockCriteria: { type: 'xp'|'streak'|'quizzes_completed'|'perfect_scores'|'track_completed'|'speed'|'custom', threshold?: number, description?: string }, rewards?: { xp?: number, coins?: number, powerUps?: Array<{ type: 'hint'|'time_freeze'|'skip'|'double_xp', quantity: number }> } }. Omit "_aiPrompt".`;

    case 'compiler-questions':
      return `SCHEMA CONTRACT (DAILY CODE COMPILER CHALLENGE):
- Keep root shape (single object, array, or { questions: [...] }).
- Each compiler question: { title: string, description: string (PLAIN TEXT ONLY — NO Markdown **bold**, NO \`backticks\`, NO $LaTeX$! DailyChallenge renders whitespace-pre-wrap plain text), referenceCode: string (clean, working solution), language: 'python'|'javascript'|'java'|'cpp'|'typescript', difficulty: 'easy'|'medium'|'hard', category: string, hints: string[] (2-4 progressive spoiler-free hints), rewardCoins: number, rewardXP: number, isActive: boolean }. Omit "_aiPrompt".`;

    case 'tournament':
      return `SCHEMA CONTRACT (TOURNAMENT):
- Root object: { name, description, startsAt (ISO string), endsAt (ISO string), durationMinutes, status: 'upcoming'|'active'|'completed', quizMode: 'existing'|'custom', customQuiz?: { title, description, questions: [...] }, rewardCoins: number, rewardXp: number, maxParticipants?: number }.
- Note: customQuiz questions should set BOTH "text" and "question" cleanly, plain text / $LaTeX$ only (NO raw Markdown), and matching/ordering formats matching Quiz Schema. Omit "_aiPrompt".`;

    default:
      return 'Preserve valid JSON schema, fix structural defects, eliminate raw Markdown in plain-text UI fields, and enrich explanations.';
  }
};

const normalizeRefinedOutput = (refined, original, detectedType) => {
  const clean = stripAiPromptMetadata(refined);
  if (!clean || typeof clean !== 'object') return clean;

  if (detectedType === 'quiz' || detectedType === 'question-pool') {
    const normalizeSingleQuiz = (qz) => {
      if (!qz || typeof qz !== 'object') return qz;
      const out = { ...qz };
      if ('coinReward' in out && !('coinsReward' in out)) {
        out.coinsReward = out.coinReward;
        delete out.coinReward;
      }
      out.shuffleQuestions = true;
      if (detectedType === 'question-pool') {
        out.isQuestionPool = true;
        if (!out.quizType) out.quizType = 'pool';
      }
      if (Array.isArray(out.questions)) {
        out.questions = sanitizeQuestions(out.questions, out.id || 'refined');
      }
      return out;
    };

    if (Array.isArray(clean)) return clean.map(normalizeSingleQuiz);
    if (Array.isArray(clean.quizzes)) return { ...clean, quizzes: clean.quizzes.map(normalizeSingleQuiz) };
    return normalizeSingleQuiz(clean);
  }

  if (detectedType === 'presentation' && Array.isArray(clean.slides)) {
    const safeTheme = VALID_THEMES.has(clean.theme) ? clean.theme : (VALID_THEMES.has(original?.theme) ? original.theme : 'dark-tech');
    return {
      ...clean,
      theme: safeTheme,
      sourceFormat: 'json',
      slides: clean.slides.map((s, idx) => normalizeSlide(s, idx))
    };
  }

  return clean;
};

export const refineExistingJson = async (req, res) => {
  try {
    let {
      jsonContent,
      contentType = 'auto',
      keepInstructions = '',
      preserveFlags = {},
      upgradeGoals = '',
      sourceContext = ''
    } = req.body || {};

    let extractedFileText = '';
    if (req.file) {
      extractedFileText = await extractUploadedFileText(req.file);
    }

    if (typeof preserveFlags === 'string') {
      try {
        preserveFlags = JSON.parse(preserveFlags);
      } catch {
        preserveFlags = {};
      }
    }

    const parsedOriginal = tryParseLooseJson(jsonContent);
    const detectedType = detectContentType(parsedOriginal, contentType);
    const originalNormalized = stripAiPromptMetadata(parsedOriginal);
    const auditIssues = auditExistingJson(originalNormalized, detectedType);

    const groq = getGroqClient();
    if (!groq) {
      return res.status(500).json({
        success: false,
        message: 'GROQ_API_KEY is missing on the server.'
      });
    }

    const flags = {
      keepIds: preserveFlags.keepIds !== false,
      keepCorrectAnswers: preserveFlags.keepCorrectAnswers !== false,
      keepLanguage: preserveFlags.keepLanguage !== false,
      keepItemCount: Boolean(preserveFlags.keepItemCount),
      fixSchemaAndMarkdown: preserveFlags.fixSchemaAndMarkdown !== false,
      upgradeFeatures: preserveFlags.upgradeFeatures !== false,
      deepenExplanations: preserveFlags.deepenExplanations !== false
    };

    const combinedContext = [sourceContext, extractedFileText]
      .filter(s => typeof s === 'string' && s.trim())
      .join('\n\n---\n\n');
    const truncatedContext = combinedContext ? smartTruncate(combinedContext, 10000) : '';
    const originalSerialized = smartTruncate(JSON.stringify(originalNormalized, null, 2), 14000);

    const nonNegotiableRules = [
      flags.keepIds
        ? '1. PRESERVE ALL IDENTIFIERS: Keep exact original id / _id / moduleId / badgeId / presentationId / trackId values intact wherever items correspond to original entries.'
        : '1. Identifiers may be normalized to clean platform formats where broken.',
      flags.keepCorrectAnswers
        ? '2. PRESERVE CORRECT ANSWERS: NEVER alter which answer is correct on existing questions/checkups unless an index is physically out of bounds.'
        : '2. Fix clearly erroneous answer keys if wrong and explain why in improvements.',
      flags.keepLanguage
        ? '3. PRESERVE LANGUAGE & VOICE: Keep the exact language (English vs Egyptian/Standard Arabic vs bilingual) of the original items.'
        : '3. Standardize language quality while preserving meaning.',
      flags.keepItemCount
        ? '4. PRESERVE EXACT ITEM COUNT: Do NOT add or remove questions/slides/modules/badges; keep the exact count and upgrade items in place.'
        : '4. You may add missing high-value items (e.g. a missing checkup slide or diverse question type) if genuinely helpful.',
      flags.fixSchemaAndMarkdown
        ? '5. FIX SCHEMA & UI RENDERING DEFECTS: Eliminate raw Markdown (**bold**, ### headings, `backticks`) in plain-text/MathRenderer fields, fix coinReward->coinsReward, numeric question IDs, compiler isCompiler+referenceCode, and invalid enum values.'
        : '',
      flags.upgradeFeatures
        ? '6. UPGRADE PLATFORM FEATURES: Enrich under-used platform capabilities (e.g. compiler/code-output/ordering/matching variety where natural, wireframe visualBlock/speakerNotes/checkup slides on presentations, progressive hints on compiler questions, clear coordinates/content on roadmaps).'
        : '',
      flags.deepenExplanations
        ? '7. DEEPEN PEDAGOGY & CLARITY: Sharpen question phrasing, make distractors realistic (no joke options), and write crystal-clear teaching explanations/callouts.'
        : '',
      keepInstructions && keepInstructions.trim()
        ? `8. USER'S EXPLICIT "MUST REMAIN UNTOUCHED" CONSTRAINT (HIGHEST PRIORITY): ${keepInstructions.trim()}`
        : ''
    ].filter(Boolean).join('\n');

    const prompt = `You are a Principal Curriculum Engineer, Platform Schema Auditor, and Strict JSON Refiner for "Future Robins".
Your job is to carefully audit an existing "${detectedType}" JSON document, fix all schema/UI bugs, upgrade its educational depth & platform features, AND strictly obey every user constraint on what MUST remain unchanged.

### PRE-DETECTED SCHEMA & UI ISSUES
${auditIssues.length > 0 ? auditIssues.map((iss, i) => `${i + 1}. [${iss.severity.toUpperCase()}] ${iss.path}: ${iss.message}`).join('\n') : 'None automatically flagged — still check thoroughly for clarity, UI formatting, distractors, explanations, and rich platform features.'}

### ${getSchemaContractPrompt(detectedType)}

### NON-NEGOTIABLE PRESERVATION & UPGRADE RULES
${nonNegotiableRules}

${upgradeGoals && upgradeGoals.trim() ? `### EXTRA USER UPGRADE GOALS\n${upgradeGoals.trim()}\n` : ''}
${truncatedContext ? `### REFERENCE SLIDES / SUBJECT MATERIAL (Align & enrich content from this source of truth)\n"""\n${truncatedContext}\n"""\n` : ''}
### ORIGINAL EXISTING JSON TO AUDIT & UPGRADE
\`\`\`json
${originalSerialized}
\`\`\`

### REQUIRED RESPONSE FORMAT (RETURN ONLY STRICT JSON)
{
  "summary": "Concise 1-2 sentence overview of what was repaired and upgraded while honoring what remained locked.",
  "improvements": [
    "Specific concrete fix or upgrade #1",
    "Specific concrete fix or upgrade #2"
  ],
  "refined": <THE COMPLETE UPGRADED JSON MATCHING THE EXACT INPUT ROOT SHAPE (${Array.isArray(originalNormalized) ? 'JSON Array [...]' : 'JSON Object {...}'}), WITH NO _aiPrompt KEY>
}`;

    const aiResponse = await scheduleNormal(`JsonRefine-${Date.now()}`, async () => {
      let lastError = null;
      for (const modelName of GROQ_REFINER_MODELS) {
        try {
          console.log(`[AI JSON Refiner] Attempting model ${modelName} (${detectedType})`);
          const completion = await groq.chat.completions.create({
            model: modelName,
            messages: [
              {
                role: 'system',
                content: 'You output strictly valid JSON matching the requested response envelope. Never include markdown outside strings and never include raw ** or `backticks` in plain-text UI fields.'
              },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.25,
            max_tokens: 8000
          });
          const rawText = completion?.choices?.[0]?.message?.content || '';
          if (!rawText) throw new Error('Empty model response');
          return { rawText, modelName };
        } catch (err) {
          const msg = (err?.message || String(err)).split('\n')[0];
          console.warn(`[AI JSON Refiner] Model ${modelName} failed: ${msg}`);
          if (msg.includes('429')) err.status = 429;
          lastError = err;
          if (msg.includes('429')) throw err;
        }
      }
      throw lastError || new Error('All AI models failed');
    });

    const aiPayload = tryParseLooseJson(aiResponse.rawText);
    const rawRefined = aiPayload?.refined !== undefined ? aiPayload.refined : aiPayload;
    const refined = normalizeRefinedOutput(rawRefined, originalNormalized, detectedType);

    return res.json({
      success: true,
      model: aiResponse.modelName,
      detectedType,
      originalNormalized,
      refined,
      auditIssues,
      summary: typeof aiPayload?.summary === 'string' && aiPayload.summary.trim()
        ? aiPayload.summary.trim()
        : `Audited and upgraded ${detectedType} JSON (${auditIssues.length} issue${auditIssues.length === 1 ? '' : 's'} checked).`,
      improvements: Array.isArray(aiPayload?.improvements)
        ? aiPayload.improvements.map(String).filter(Boolean).slice(0, 12)
        : []
    });
  } catch (error) {
    console.error('[AI JSON Refiner] Error:', error);
    const isSyntax = String(error?.message || '').includes('Invalid JSON') || String(error?.message || '').includes('empty');
    return res.status(isSyntax ? 400 : 500).json({
      success: false,
      message: error?.message || 'Failed to refine JSON with AI'
    });
  }
};
