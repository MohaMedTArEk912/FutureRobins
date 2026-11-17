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
  title: 'Sample Interactive Session Presentation',
  description: 'Template deck demonstrating Hero, Bullets, Wireframe visualBlock, Code Lab, and Live Check-Up Question slides.',
  theme: 'bento',
  slides: [
    {
      layout: 'hero',
      motion: 'zoom-in',
      title: 'Lesson Title Goes Here',
      subtitle: 'Session 01 • Course Name',
      body: 'Introduce what students will build or master during this live session.',
      bullets: ['Core Concept 1', 'Hands-On Demo', 'Live Check-Up Quiz'],
      callout: 'Interactive Board: Click sections, draw annotations, and answer Check-Up questions live!',
      speakerNotes: 'Welcome students and outline the 3 learning objectives for today.',
      durationSeconds: 45
    },
    {
      layout: 'wireframe',
      motion: 'fade-up',
      title: 'Interactive Blueprint Breakdown',
      subtitle: 'Click each section to inspect it live',
      body: 'Use the visualBlock sections array to build clickable concept diagrams.',
      visualBlock: {
        kind: 'page-structure',
        sections: [
          {
            id: 'sec_1',
            label: '1. Header & Navigation',
            tag: '<header>',
            description: 'Contains the brand mark and primary navigation links.',
            highlight: true,
            code: '<header class="site-header">\n  <nav>Logo + Links</nav>\n</header>'
          },
          {
            id: 'sec_2',
            label: '2. Main Content Section',
            tag: '<main>',
            description: 'Core interactive workspace or lesson content block.'
          }
        ]
      },
      bullets: ['Break problems into reusable visual sections.', 'Click each block on the board to highlight it for students.'],
      speakerNotes: 'Click block 1 and explain why semantic structure matters.',
      durationSeconds: 75
    },
    {
      layout: 'code',
      motion: 'slide-left',
      title: 'Code Walkthrough Example',
      subtitle: 'Readable pattern with clean structure',
      body: 'Pair concise takeaways with a syntax-formatted code snippet.',
      bullets: ['Keep examples focused on one concept per slide.', 'Discuss common pitfalls while annotating with the pen tool.'],
      codeSnippet: {
        language: 'html',
        code: '<section class="card">\n  <h2>Clean Structure</h2>\n  <p>Reusable, accessible markup.</p>\n</section>'
      },
      callout: 'Pro Tip: Use the pen tool to circle key lines during explanation!',
      speakerNotes: 'Walk line-by-line through the markup.',
      durationSeconds: 60
    },
    {
      layout: 'checkup',
      motion: 'pop',
      title: 'Quick Knowledge Check-Up',
      subtitle: 'Live Student Poll',
      checkupQuestion: {
        question: 'Which HTML landmark should wrap the primary page content?',
        options: ['<footer>', '<main>', '<span>', '<meta>'],
        correctAnswer: 1,
        explanation: '<main> represents the dominant, unique content of the document body.',
        points: 10
      },
      speakerNotes: 'Give students 20 seconds to vote before clicking Reveal Answer.',
      durationSeconds: 45
    },
    {
      layout: 'summary',
      motion: 'fade-up',
      title: 'Session Wrap-Up',
      subtitle: 'Key Takeaways & Next Steps',
      bullets: [
        'Structure concepts clearly before writing code.',
        'Review speaker notes & check-up explanations.',
        'Complete the unlocked session quiz homework.'
      ],
      speakerNotes: 'Summarize today’s session and click Finish Session to unlock student homework.',
      durationSeconds: 40
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
