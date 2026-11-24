import crypto from 'crypto';
import { createRequire } from 'module';
import Groq from 'groq-sdk';
import { Presentation } from '../models/Presentation.js';
import { Subject } from '../models/Subject.js';
import { User } from '../models/User.js';
import { smartTruncate } from '../utils/tokenOptimizer.js';
import {
  normalizeSlide,
  parsePresentationPayload,
  serializePresentationToXml,
  buildFallbackMotionSlides,
  VALID_THEMES
} from '../utils/motionSlideParser.js';
import { isTeacherUser } from '../middleware/authMiddleware.js';

const require = createRequire(import.meta.url);

const getGroqClient = () => {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) return null;
  return new Groq({ apiKey: key });
};

const extractTextFromUploadedBuffer = async (file) => {
  if (!file || !file.buffer) throw new Error('Uploaded file buffer is empty');
  const name = (file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
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
      const instance = new PDFParseEntity(file.buffer);
      if (typeof instance?.then === 'function') {
        const res = await instance;
        return res?.text || '';
      }
      if (typeof instance?.getText === 'function') {
        const res = await instance.getText();
        return res?.text || '';
      }
      const instanceV2 = new PDFParseEntity({ data: file.buffer });
      return (await instanceV2.getText())?.text || '';
    } catch {
      const instanceV2 = new PDFParseEntity({ data: file.buffer });
      return (await instanceV2.getText())?.text || '';
    }
  }

  if (mime.includes('presentation') || name.endsWith('.pptx')) {
    const { getTextExtractor } = await import('office-text-extractor');
    const extractor = getTextExtractor();
    const extracted = await extractor.extractText({ input: file.buffer, type: 'buffer' });
    return extracted || '';
  }

  return file.buffer.toString('utf8');
};

export const SAMPLE_PRESENTATION_JSON = {
  _aiPrompt: {
    version: '2.0',
    targetPlatform: 'Future Robins — Interactive Teaching Board',
    templateType: 'motion-presentation',
    howToUse: [
      '1. Attach or paste your lecture slides (PDF/PPTX), markdown notes, code examples, or target topic along with this JSON.',
      '2. Instruct the AI: "Follow _aiPrompt strictly to transform my material into an interactive Motion Presentation JSON deck."',
      '3. Upload the returned JSON (without _aiPrompt) in Presentations -> Upload Slide File & Save or Visual Board -> Upload JSON.'
    ],
    prompt:
      "You are an expert Curriculum Architect, Visual Teaching Board Designer, and strict JSON compiler for Future Robins. Transform the attached slides, PDF, notes, or topic into an engaging, visually scannable interactive Motion Presentation deck in strict JSON format.\n\nPEDAGOGICAL & SLIDE PACING RULES:\n- Ground every slide strictly in the attached material's real concepts, code snippets, workflows, comparisons, and pitfalls.\n- Target 7-12 focused slides (1 clear idea per slide, never walls of text):\n  1) Open with a 'hero' slide introducing the session scope and 3 concrete outcomes.\n  2) Include at least 1-2 interactive 'wireframe' slides using visualBlock ('page-structure', 'split-cards', or 'footer-anatomy') adapted to the lesson domain (architecture pipelines, UI layouts, system comparisons, or 3-column breakdowns) so teachers can click sections live.\n  3) Include 'code' slides pairing a clean 'codeSnippet' alongside 2-4 crisp bullet takeaways.\n  4) Place a live 'checkup' poll slide every 3-4 teaching slides to test understanding before moving on, with 4 balanced options, 0-based 'correctAnswer', and a sharp 'explanation'.\n  5) End with a 'summary' or 'homework' wrap-up slide reinforcing key takeaways.\n- Add actionable 'speakerNotes' on every slide guiding what the teacher should emphasize or click.\n\nCRITICAL UI & TEXT RENDERING RULES (PresentationModePlayer):\n- All text fields ('title', 'subtitle', 'body', 'bullets', 'callout', 'speakerNotes', 'checkupQuestion.*') render as plain UI text—NEVER use raw Markdown (**bold**, *italic*, ### headings, ```code blocks```, or `inline backticks`).\n- Put all source code strictly inside 'codeSnippet.code' or 'visualBlock.sections[].code' using escaped \\n newlines.\n- Keep slide titles concise (<= 8 words), body <= 2 sentences, bullets 3-5 items max (<= 14 words per bullet), and callouts 1 crisp takeaway sentence so cards look clean on both Neo-Bento and Noir Dark boards without clipping.\n\nSTRICT JSON OUTPUT:\n- Return ONLY valid raw JSON matching the presentation contract below. Omit '_aiPrompt' in your final output.",
    strictJsonContract: {
      rootObject: {
        title: 'string (required presentation deck title)',
        description: 'string (concise 1-2 sentence session summary)',
        theme: "enum: 'dark-tech' | 'bento' | 'editorial' | 'neon'",
        sourceFormat: "'json'",
        slides: 'MotionSlide[] (ordered slides; omit _aiPrompt)'
      },
      MotionSlide: {
        id: "string (unique snake_case ID, e.g. 'slide_1_intro')",
        order: 'number (0-based integer index: 0, 1, 2, ...)',
        layout: "enum: 'hero' | 'bullets' | 'split' | 'code' | 'comparison' | 'timeline' | 'wireframe' | 'live-preview' | 'checkup' | 'homework' | 'summary'",
        motion: "enum: 'fade-up' | 'slide-left' | 'zoom-in' | 'stagger' | 'pop' | 'flip'",
        title: 'string (required, plain text <= 8 words)',
        subtitle: 'string (optional module/phase badge line)',
        body: 'string (optional 1-2 short framing sentences)',
        bullets: 'string[] (optional 3-5 crisp takeaways; <= 14 words each)',
        codeSnippet: '{ language: string, code: string } (optional; displays dark syntax card alongside bullets)',
        visualBlock: 'PageStructureBlock | SplitCardsBlock | FooterAnatomyBlock (optional clickable board widget)',
        callout: 'string (optional key takeaway or pro tip banner)',
        speakerNotes: 'string (teacher guidance & live interaction prompts)',
        durationSeconds: 'number (suggested teaching seconds, e.g. 45-90)',
        checkupQuestion: "{ question: string, options: string[4], correctAnswer: number, explanation: string, points: number } (required when layout === 'checkup')"
      },
      visualBlockSchemas: {
        pageStructure: "{ kind: 'page-structure', sections: [{ id: string, label: string, tag?: string, description: string, highlight?: boolean, code?: string }] }",
        splitCards: "{ kind: 'split-cards', leftCard: { tag?: string, title: string, body: string }, rightCards: [{ title: string, subtitle?: string, badge?: string }] }",
        footerAnatomy: "{ kind: 'footer-anatomy', topNav: { brand: string, links: string[] }, columns: [{ title: string, items: string[] }] }"
      }
    }
  },
  title: 'Interactive Web Architecture & Semantics',
  description: 'Complete Teaching Board template showcasing Hero, all 3 clickable Blueprint visualBlocks, Code Lab, Side-by-Side Comparison, Live Check-Up Polls, and Homework Wrap-Up slides.',
  theme: 'bento',
  sourceFormat: 'json',
  slides: [
    {
      id: 'sample_slide_1',
      order: 0,
      layout: 'hero',
      motion: 'zoom-in',
      title: 'Modern Page Architecture & Layout Systems',
      subtitle: 'Session 01 • Interactive Teaching Board',
      body: 'Scan real interfaces into reusable structural boxes, combine Flexbox with CSS Grid, and verify accessibility interactively.',
      bullets: ['Semantic Page Blueprint', '50/50 Grid vs Flex Stacks', 'Live Check-Up Polls'],
      callout: 'Teaching Board: Click visual blueprint cards to highlight elements live for your students.',
      speakerNotes: 'Welcome students and outline the 3 core learning milestones for today.',
      durationSeconds: 45
    },
    {
      id: 'sample_slide_2',
      order: 1,
      layout: 'wireframe',
      motion: 'fade-up',
      title: '1. Semantic Document Blueprint',
      subtitle: 'Click each section to inspect its HTML landmark',
      body: 'Before writing CSS, break the interface into semantic regions. Click any block on the left to inspect its markup on the right:',
      visualBlock: {
        kind: 'page-structure',
        sections: [
          {
            id: 'sec_header',
            label: 'Header & Primary Navigation',
            tag: '<header>',
            description: 'Houses brand identity and top-level navigation links for fast site orientation.',
            code: '<header class="site-header">\n  <a class="brand" href="/">QuizLab</a>\n  <nav aria-label="Primary">Links...</nav>\n</header>'
          },
          {
            id: 'sec_main',
            label: 'Main Interactive Workspace',
            tag: '<main>',
            description: 'Wraps the dominant unique content of the page so screen readers jump directly here.',
            highlight: true,
            code: '<main id="content">\n  <section class="features">...</section>\n</main>'
          },
          {
            id: 'sec_footer',
            label: 'Structured Info Footer',
            tag: '<footer>',
            description: 'Contains secondary navigation, contact info, campus links, and copyright metadata.',
            code: '<footer class="site-footer">\n  <div class="cols-3">...</div>\n</footer>'
          }
        ]
      },
      callout: 'One <main> landmark per page keeps keyboard navigation predictable and screen-reader friendly.',
      speakerNotes: 'Click Header -> Main -> Footer slowly while students trace the DOM outline.',
      durationSeconds: 75
    },
    {
      id: 'sample_slide_3',
      order: 2,
      layout: 'wireframe',
      motion: 'slide-left',
      title: '2. Asymmetric Bento Split Pattern',
      subtitle: 'Combining 2-column CSS Grid with Flex stacks',
      body: 'Pair CSS Grid for macro two-half alignment with vertical Flexbox when one half contains stacked feature cards:',
      visualBlock: {
        kind: 'split-cards',
        leftCard: {
          tag: 'Left Column (50%)',
          title: 'Primary Narrative Card',
          body: 'Anchored headline, short supporting summary, and primary CTA filling full track height.'
        },
        rightCards: [
          { title: 'Upper Stacked Card', subtitle: 'Summary metric + action icon', badge: 'Flex: 1' },
          { title: 'Lower Stacked Card', subtitle: 'Interactive visual preview tile', badge: 'Flex: 1' }
        ]
      },
      codeSnippet: {
        language: 'css',
        code: '.bento-split {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 20px;\n}\n.right-stack {\n  display: flex;\n  flex-direction: column;\n  gap: 20px;\n}'
      },
      callout: 'Rule of thumb: Use CSS Grid for 2D tracks and Flexbox when stacking items in one axis.',
      speakerNotes: 'Ask students which axis CSS Grid controls vs Flexbox on the right column.',
      durationSeconds: 75
    },
    {
      id: 'sample_slide_4',
      order: 3,
      layout: 'checkup',
      motion: 'pop',
      title: 'Check-Up #1: Semantic Landmarks',
      subtitle: 'Live Student Pulse Poll',
      checkupQuestion: {
        question: 'Which HTML landmark element should wrap the unique dominant content of a web page?',
        options: ['<div class="wrapper">', '<main>', '<footer>', '<meta>'],
        correctAnswer: 1,
        explanation: 'Using <main> exposes an explicit ARIA landmark so assistive technologies can skip repeated navigation headers cleanly.',
        points: 10
      },
      speakerNotes: 'Give students 20 seconds to vote live before clicking Reveal Answer.',
      durationSeconds: 45
    },
    {
      id: 'sample_slide_5',
      order: 4,
      layout: 'code',
      motion: 'slide-left',
      title: '3. Clean Component Card Pattern',
      subtitle: 'Accessible & responsive markup',
      body: 'Keep component HTML shallow, semantic, and decoupled from presentation overrides:',
      bullets: [
        'Use heading levels sequentially without skipping h1 to h4.',
        'Prefer semantic buttons for actions instead of clickable div elements.',
        'Use gap utility rules instead of uneven margins between sibling cards.',
        'Keep hover and focus states crisp across light and dark themes.'
      ],
      codeSnippet: {
        language: 'html',
        code: '<article class="feature-card">\n  <span class="tag">Core Pattern</span>\n  <h2>Accessible Cards</h2>\n  <p>Semantic headings preserve focus flow.</p>\n  <button type="button">Inspect Spec</button>\n</article>'
      },
      callout: 'Pro Tip: Switch to Pen Mode in the toolbar to circle button type attributes live.',
      speakerNotes: 'Highlight why button elements automatically handle Enter/Space keyboard activation.',
      durationSeconds: 65
    },
    {
      id: 'sample_slide_6',
      order: 5,
      layout: 'wireframe',
      motion: 'fade-up',
      title: '4. Multi-Column Footer Breakdown',
      subtitle: 'Top strip + 3 balanced directory columns',
      body: 'A scalable footer splits navigation echo at the top from grouped informational columns below:',
      visualBlock: {
        kind: 'footer-anatomy',
        topNav: {
          brand: 'QuizLab Studio',
          links: ['Tracks', 'Quizzes', 'Arena', 'Docs']
        },
        columns: [
          { title: 'Curriculum', items: ['Web Foundations', 'Algorithms & DS', 'System Design'] },
          { title: 'Community', items: ['Classrooms', 'Tournaments', 'Leaderboard'] },
          { title: 'Support', items: ['help@quizlab.dev', 'Shortcuts Guide', 'Status Page'] }
        ]
      },
      callout: 'Collapse 3 columns into a single clean stack below 640px for effortless mobile scrolling.',
      speakerNotes: 'Inspect each footer column live and trace responsive grid wrapping.',
      durationSeconds: 65
    },
    {
      id: 'sample_slide_7',
      order: 6,
      layout: 'comparison',
      motion: 'stagger',
      title: '5. Flexbox vs CSS Grid Decision Matrix',
      subtitle: 'Choosing the right tool cleanly',
      body: 'Avoid forcing one layout engine everywhere—match layout capabilities to card alignment needs:',
      bullets: [
        'Flexbox excels along a single row or column where content dictates item width.',
        'CSS Grid enforces predictable 2D row and column tracks across breakpoints.',
        'Nested combinations (Grid shell + Flex cards) handle 95% of UI dashboards.',
        'Test narrow viewports (375px) early so cards never overflow horizontally.'
      ],
      callout: 'Never nest unnecessary wrapper divs when gap and grid-template-columns solve alignment directly.',
      speakerNotes: 'Run a quick thumbs-up reaction check to verify everyone understands Grid vs Flex.',
      durationSeconds: 60
    },
    {
      id: 'sample_slide_8',
      order: 7,
      layout: 'homework',
      motion: 'fade-up',
      title: 'Session Wrap-Up & Practice Lab',
      subtitle: 'Next Steps & Unlocked Homework',
      body: 'Apply today’s semantic blueprint rules to complete the assigned layout challenge and session assessment:',
      bullets: [
        'Audit your project HTML to ensure clear header, main, and footer landmarks.',
        'Implement a 2-column Grid split that stacks cleanly on mobile viewports.',
        'Complete the unlocked Session Homework Quiz before next class.'
      ],
      callout: 'Instructors: Click Finish Session & Unlock Homework below once review is complete.',
      speakerNotes: 'Summarize takeaways, answer final questions, and unlock session homework.',
      durationSeconds: 45
    }
  ]
};

export const getSamplePresentationJson = (_req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sample-presentation.json"');
  res.json(SAMPLE_PRESENTATION_JSON);
};

export const getPresentations = async (req, res) => {
  try {
    const { trackId, moduleId, clanId, limit } = req.query;
    const andConditions = [];
    if (trackId) andConditions.push({ trackId: String(trackId) });
    if (moduleId) {
      andConditions.push({
        $or: [{ moduleId: String(moduleId) }, { moduleIds: String(moduleId) }]
      });
    }
    if (clanId) {
      andConditions.push({
        $or: [{ clanId: String(clanId) }, { clanId: null }, { clanId: '' }]
      });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};
    const maxItems = Math.max(1, Math.min(250, Number(limit) || 150));

    const items = await Presentation.find(filter)
      .sort({ updatedAt: -1 })
      .limit(maxItems)
      .lean();

    if (!items.length) return res.json([]);

    const creatorIds = [...new Set(items.map(i => i.createdBy).filter(Boolean))];
    const creators = creatorIds.length
      ? await User.find({ userId: { $in: creatorIds } }).select('userId name role').lean()
      : [];
    const creatorMap = new Map(creators.map(u => [u.userId, u]));

    const enriched = items.map(item => {
      const creator = creatorMap.get(item.createdBy);
      const moduleIds = Array.isArray(item.moduleIds) && item.moduleIds.length > 0
        ? item.moduleIds
        : (item.moduleId ? [item.moduleId] : []);
      return {
        ...item,
        moduleIds,
        creatorName: creator?.name || item.createdBy || 'Instructor',
        creatorRole: creator?.role || 'teacher'
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching presentations', error: error.message });
  }
};

export const getPresentationById = async (req, res) => {
  try {
    const { presentationId } = req.params;
    const doc = await Presentation.findOne({ presentationId }).lean();
    if (!doc) return res.status(404).json({ message: 'Presentation not found' });

    res.json({
      ...doc,
      xml: serializePresentationToXml(doc)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching presentation', error: error.message });
  }
};

export const savePresentation = async (req, res) => {
  try {
    if (!isTeacherUser(req.user)) {
      return res.status(403).json({ message: 'Only teachers or admins can create or edit presentations' });
    }

    const {
      presentationId,
      title,
      description = '',
      trackId = null,
      moduleId = null,
      moduleIds = [],
      clanId = null,
      theme = 'dark-tech',
      sourceFormat = 'manual',
      rawJson = '',
      slides = []
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Presentation title is required' });
    }

    const normalizedSlides = (Array.isArray(slides) ? slides : []).map((s, idx) => normalizeSlide(s, idx));
    const safeTheme = VALID_THEMES.has(theme) ? theme : 'dark-tech';
    const cleanTitle = String(title).trim();
    const cleanDescription = String(description || '').trim();
    const persistedRawJson = typeof rawJson === 'string' && rawJson.trim()
      ? rawJson.trim()
      : JSON.stringify({
          title: cleanTitle,
          description: cleanDescription,
          theme: safeTheme,
          slides: normalizedSlides
        }, null, 2);
    const combinedModules = [...new Set([
      ...(Array.isArray(moduleIds) ? moduleIds.filter(Boolean).map(String) : []),
      ...(moduleId ? [String(moduleId)] : [])
    ])];
    const primaryModuleId = moduleId ? String(moduleId) : (combinedModules[0] || null);

    if (presentationId) {
      const existing = await Presentation.findOne({ presentationId });
      if (existing) {
        if (existing.createdBy !== req.user.userId && req.user.role !== 'admin' && req.user.isAdmin !== true) {
          return res.status(403).json({ message: 'No permission to edit this presentation' });
        }
        existing.title = cleanTitle;
        existing.description = cleanDescription;
        existing.trackId = trackId !== undefined ? (trackId || null) : existing.trackId;
        if (moduleId !== undefined || Array.isArray(req.body?.moduleIds)) {
          existing.moduleId = primaryModuleId;
          existing.moduleIds = combinedModules;
        }
        existing.clanId = clanId !== undefined ? clanId : existing.clanId;
        existing.theme = safeTheme;
        existing.sourceFormat = sourceFormat || existing.sourceFormat;
        existing.rawJson = persistedRawJson;
        existing.slides = normalizedSlides;
        existing.markModified('slides');
        await existing.save();

        return res.json({
          ...existing.toObject(),
          xml: serializePresentationToXml(existing)
        });
      }
    }

    const newPres = new Presentation({
      presentationId: presentationId || crypto.randomUUID(),
      title: cleanTitle,
      description: cleanDescription,
      trackId: trackId || null,
      moduleId: primaryModuleId,
      moduleIds: combinedModules,
      clanId: clanId || null,
      createdBy: req.user.userId,
      sourceFormat,
      theme: safeTheme,
      rawJson: persistedRawJson,
      slides: normalizedSlides
    });

    await newPres.save();
    res.status(201).json({
      ...newPres.toObject(),
      xml: serializePresentationToXml(newPres)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error saving presentation', error: error.message });
  }
};

export const deletePresentation = async (req, res) => {
  try {
    if (!isTeacherUser(req.user)) {
      return res.status(403).json({ message: 'Only teachers or admins can delete presentations' });
    }
    const { presentationId } = req.params;
    const existing = await Presentation.findOne({ presentationId });
    if (!existing) return res.status(404).json({ message: 'Presentation not found' });

    if (existing.createdBy !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'No permission to delete this presentation' });
    }

    await existing.deleteOne();
    res.json({ message: 'Presentation deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting presentation', error: error.message });
  }
};

export const assignPresentationToModules = async (req, res) => {
  try {
    if (!isTeacherUser(req.user)) {
      return res.status(403).json({ message: 'Only teachers or admins can assign presentations' });
    }
    const { presentationId } = req.params;
    const { trackId, moduleId, moduleIds, clanId } = req.body || {};

    const existing = await Presentation.findOne({ presentationId });
    if (!existing) return res.status(404).json({ message: 'Presentation not found' });

    if (existing.createdBy !== req.user.userId && req.user.role !== 'admin' && req.user.isAdmin !== true) {
      return res.status(403).json({ message: 'No permission to assign this presentation' });
    }

    if (trackId !== undefined) {
      existing.trackId = trackId || null;
    }

    if (Array.isArray(moduleIds) || moduleId !== undefined) {
      const combined = [...new Set([
        ...(Array.isArray(moduleIds) ? moduleIds.filter(Boolean).map(String) : []),
        ...(moduleId ? [String(moduleId)] : [])
      ])];
      existing.moduleId = moduleId ? String(moduleId) : (combined[0] || null);
      existing.moduleIds = combined;
    }

    if (clanId !== undefined) {
      existing.clanId = clanId || null;
    }

    await existing.save();
    res.json(existing);
  } catch (error) {
    res.status(500).json({ message: 'Error assigning presentation', error: error.message });
  }
};

/**
 * Converts uploaded slide files (PDF/PPTX/TXT/MD/JSON/XML), raw text, JSON, XML,
 * or an existing Subject material into structured Motion Slides (JSON + XML) with Check-Up questions.
 */
export const convertSlidesToMotion = async (req, res) => {
  try {
    if (!isTeacherUser(req.user)) {
      return res.status(403).json({ message: 'Only teachers or admins can convert slides' });
    }

    const {
      title = 'Session Presentation',
      rawText = '',
      rawPayload = '',
      subjectId = '',
      materialId = '',
      theme = 'dark-tech',
      slideCount = 7,
      checkupCount = 2
    } = req.body || {};

    let inputContent = '';
    let detectedFormat = 'ai_slides';
    const file = req.file;

    if (file) {
      const lowerName = (file.originalname || '').toLowerCase();
      if (lowerName.endsWith('.json')) {
        detectedFormat = 'json';
        inputContent = file.buffer.toString('utf8');
      } else if (lowerName.endsWith('.xml')) {
        detectedFormat = 'xml';
        inputContent = file.buffer.toString('utf8');
      } else {
        inputContent = await extractTextFromUploadedBuffer(file);
      }
    } else if (rawPayload && String(rawPayload).trim()) {
      const trimmed = String(rawPayload).trim();
      detectedFormat = trimmed.startsWith('<') ? 'xml' : 'json';
      inputContent = trimmed;
    } else if (subjectId && materialId) {
      const subject = await Subject.findById(subjectId).lean();
      if (!subject) return res.status(404).json({ message: 'Subject not found' });
      const mat = (subject.materials || []).find(m => String(m._id) === String(materialId));
      if (!mat) return res.status(404).json({ message: 'Material not found' });
      inputContent = mat.rawContent || mat.summary || mat.title || '';
    } else {
      inputContent = String(rawText || '').trim();
    }

    if (!inputContent || !inputContent.trim()) {
      return res.status(400).json({ message: 'Please provide slides file, text content, JSON, or XML to convert' });
    }

    // Direct JSON / XML structured import
    if (detectedFormat === 'json' || detectedFormat === 'xml') {
      try {
        const parsed = parsePresentationPayload(inputContent, title);
        return res.json({
          success: true,
          sourceFormat: detectedFormat,
          usedAi: false,
          presentation: parsed,
          xml: serializePresentationToXml(parsed)
        });
      } catch (parseErr) {
        return res.status(400).json({ message: `Invalid ${detectedFormat.toUpperCase()} slide data: ${parseErr.message}` });
      }
    }

    // AI Conversion from Slide Text -> Motion Slide JSON (+ Check-Up Questions)
    const groq = getGroqClient();
    const targetSlides = Math.max(4, Math.min(15, Number(slideCount) || 7));
    const targetCheckups = Math.max(1, Math.min(5, Number(checkupCount) || 2));

    if (groq) {
      try {
        const prompt = `You are an instructional designer converting lecture slides into an interactive Motion Slide presentation JSON with embedded Check-Up Questions.

INPUT SLIDE CONTENT:
"""
${smartTruncate(inputContent, 14000)}
"""

REQUIREMENTS:
- Presentation Title: "${String(title).replace(/"/g, '\\"')}"
- Theme: "${VALID_THEMES.has(theme) ? theme : 'dark-tech'}"
- Create ~${targetSlides} slides total, INCLUDING ${targetCheckups} interactive "checkup" slides placed naturally after major concepts.
- Return STRICT JSON ONLY matching this exact schema:
{
  "title": "string",
  "description": "short summary",
  "theme": "${VALID_THEMES.has(theme) ? theme : 'dark-tech'}",
  "slides": [
    {
      "layout": "hero | bullets | split | code | comparison | timeline | wireframe | live-preview | checkup | homework | summary",
      "motion": "fade-up | slide-left | zoom-in | stagger | pop | flip",
      "title": "string",
      "subtitle": "short tagline",
      "body": "concise explanatory paragraph if needed",
      "bullets": ["concise bullet 1", "concise bullet 2"],
      "codeSnippet": { "language": "python", "code": "optional code example" },
      "visualBlock": { "type": "page-structure | split-cards | footer-anatomy | custom", "sections": ["optional section tags"] },
      "callout": "optional key takeaway or tip",
      "speakerNotes": "what the teacher should say while presenting",
      "durationSeconds": 45,
      "checkupQuestion": {
        "question": "ONLY on layout=checkup slides: clear check-up question",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": 0,
        "explanation": "why the answer is correct"
      }
    }
  ]
}
Keep bullets punchy (max 14 words each, 3-5 per slide). Start with a "hero" slide and end with a "summary" slide.`;

        const completion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          temperature: 0.4
        });

        const rawJson = completion.choices[0]?.message?.content;
        if (rawJson) {
          const parsedAi = parsePresentationPayload(rawJson, title);
          if (parsedAi.slides.length > 0) {
            return res.json({
              success: true,
              sourceFormat: 'ai_slides',
              usedAi: true,
              presentation: parsedAi,
              xml: serializePresentationToXml(parsedAi)
            });
          }
        }
      } catch (aiErr) {
        console.warn('⚠️ [Presentations] AI conversion fallback triggered:', aiErr.message);
      }
    }

    // Deterministic smart fallback if AI is unavailable or fails
    const fallback = buildFallbackMotionSlides(inputContent, title, targetCheckups > 0);
    fallback.theme = VALID_THEMES.has(theme) ? theme : 'dark-tech';

    res.json({
      success: true,
      sourceFormat: 'ai_slides',
      usedAi: false,
      presentation: fallback,
      xml: serializePresentationToXml(fallback)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error converting slides to motion deck', error: error.message });
  }
};

export const exportPresentation = async (req, res) => {
  try {
    const { presentationId } = req.params;
    const format = String(req.query.format || 'json').toLowerCase();

    const doc = await Presentation.findOne({ presentationId }).lean();
    if (!doc) return res.status(404).json({ message: 'Presentation not found' });

    if (format === 'xml') {
      const xml = serializePresentationToXml(doc);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.presentationId}.xml"`);
      return res.send(xml);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.presentationId}.json"`);
    res.json({
      title: doc.title,
      description: doc.description,
      theme: doc.theme,
      slides: doc.slides
    });
  } catch (error) {
    res.status(500).json({ message: 'Error exporting presentation', error: error.message });
  }
};
