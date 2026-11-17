import crypto from 'crypto';

export const VALID_LAYOUTS = new Set(['hero', 'bullets', 'split', 'code', 'comparison', 'timeline', 'checkup', 'summary', 'wireframe', 'live-preview', 'homework']);
export const VALID_MOTIONS = new Set(['fade-up', 'slide-left', 'zoom-in', 'stagger', 'pop', 'flip']);
export const VALID_THEMES = new Set(['dark-tech', 'bento', 'editorial', 'neon']);

const decodeXmlEntities = (str = '') => {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
};

const escapeXml = (str = '') => {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const extractTagContent = (xml, tagName) => {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? decodeXmlEntities(match[1]) : '';
};

const extractAllTagBlocks = (xml, tagName) => {
  const regex = new RegExp(`<${tagName}(?:\\s([^>]*))?>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const results = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push({
      attrs: parseAttributes(match[1] || ''),
      inner: match[2] || ''
    });
  }
  return results;
};

const parseAttributes = (attrString = '') => {
  const attrs = {};
  const attrRegex = /([a-zA-Z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = attrRegex.exec(attrString)) !== null) {
    attrs[match[1]] = decodeXmlEntities(match[2] ?? match[3] ?? '');
  }
  return attrs;
};

/**
 * Normalizes a raw slide object into a validated MotionSlide structure.
 */
export const normalizeSlide = (slide = {}, index = 0) => {
  const rawLayout = String(slide.layout || (slide.checkupQuestion ? 'checkup' : 'bullets')).toLowerCase();
  const layout = VALID_LAYOUTS.has(rawLayout) ? rawLayout : 'bullets';

  const rawMotion = String(slide.motion || (layout === 'checkup' ? 'pop' : layout === 'hero' ? 'zoom-in' : 'fade-up')).toLowerCase();
  const motion = VALID_MOTIONS.has(rawMotion) ? rawMotion : 'fade-up';

  const bullets = Array.isArray(slide.bullets)
    ? slide.bullets.map(b => String(b).trim()).filter(Boolean)
    : typeof slide.bullets === 'string'
      ? slide.bullets.split(/\r?\n/).map(s => s.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
      : [];

  let checkupQuestion;
  const rawCheckup = slide.checkupQuestion || slide.checkup;
  if (rawCheckup && (rawCheckup.question || (Array.isArray(rawCheckup.options) && rawCheckup.options.length > 0))) {
    const options = Array.isArray(rawCheckup.options)
      ? rawCheckup.options.map(o => String(o).trim()).filter(Boolean)
      : [];
    const correctAnswer = Number.isInteger(Number(rawCheckup.correctAnswer))
      ? Math.max(0, Math.min(Number(rawCheckup.correctAnswer), Math.max(0, options.length - 1)))
      : 0;
    checkupQuestion = {
      question: String(rawCheckup.question || slide.title || 'Check-Up Question').trim(),
      options: options.length >= 2 ? options : ['True', 'False'],
      correctAnswer,
      explanation: String(rawCheckup.explanation || '').trim(),
      points: Number(rawCheckup.points) > 0 ? Number(rawCheckup.points) : 10
    };
  }

  let codeSnippet;
  if (slide.codeSnippet && (slide.codeSnippet.code || typeof slide.codeSnippet === 'string')) {
    if (typeof slide.codeSnippet === 'string') {
      codeSnippet = { language: 'javascript', code: slide.codeSnippet };
    } else {
      codeSnippet = {
        language: String(slide.codeSnippet.language || 'javascript').trim(),
        code: String(slide.codeSnippet.code || '')
      };
    }
  } else if (slide.code) {
    codeSnippet = {
      language: String(slide.language || 'javascript').trim(),
      code: String(slide.code)
    };
  }

  return {
    id: String(slide.id || `slide_${index + 1}_${crypto.randomBytes(3).toString('hex')}`),
    order: Number.isFinite(Number(slide.order)) ? Number(slide.order) : index,
    layout: checkupQuestion && layout !== 'checkup' ? 'checkup' : layout,
    motion,
    title: String(slide.title || `Slide ${index + 1}`).trim(),
    subtitle: String(slide.subtitle || '').trim(),
    body: String(slide.body || '').trim(),
    bullets,
    ...(codeSnippet ? { codeSnippet } : {}),
    ...(slide.visualBlock && typeof slide.visualBlock === 'object' ? { visualBlock: slide.visualBlock } : {}),
    callout: String(slide.callout || '').trim(),
    speakerNotes: String(slide.speakerNotes || '').trim(),
    durationSeconds: Number(slide.durationSeconds) > 0 ? Number(slide.durationSeconds) : 45,
    ...(checkupQuestion ? { checkupQuestion } : {})
  };
};

/**
 * Parses either a JSON string/object or XML string into a normalized presentation object.
 */
export const parsePresentationPayload = (rawInput, fallbackTitle = 'Session Presentation') => {
  if (!rawInput) {
    throw new Error('Empty presentation input');
  }

  // Case 1: Object directly
  if (typeof rawInput === 'object' && !Array.isArray(rawInput)) {
    const slides = Array.isArray(rawInput.slides) ? rawInput.slides : [];
    const theme = VALID_THEMES.has(rawInput.theme) ? rawInput.theme : 'dark-tech';
    return {
      title: String(rawInput.title || fallbackTitle).trim(),
      description: String(rawInput.description || '').trim(),
      theme,
      slides: slides.map((s, idx) => normalizeSlide(s, idx))
    };
  }

  // Case 2: Array of slides directly
  if (Array.isArray(rawInput)) {
    return {
      title: fallbackTitle,
      description: '',
      theme: 'dark-tech',
      slides: rawInput.map((s, idx) => normalizeSlide(s, idx))
    };
  }

  const trimmed = String(rawInput).trim();

  // Case 3: JSON string
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    return parsePresentationPayload(parsed, fallbackTitle);
  }

  // Case 4: XML string
  if (trimmed.startsWith('<')) {
    return parseMotionSlidesXml(trimmed, fallbackTitle);
  }

  throw new Error('Unsupported format. Provide valid JSON or XML.');
};

export const parseMotionSlidesXml = (xmlString, fallbackTitle = 'Session Presentation') => {
  const presMatch = xmlString.match(/<presentation(?:\s([^>]*))?>([\s\S]*?)<\/presentation>/i);
  const presAttrs = presMatch ? parseAttributes(presMatch[1] || '') : {};
  const presBody = presMatch ? presMatch[2] : xmlString;

  const title = presAttrs.title || extractTagContent(presBody, 'title') || fallbackTitle;
  const description = presAttrs.description || extractTagContent(presBody, 'description') || '';
  const theme = VALID_THEMES.has(presAttrs.theme) ? presAttrs.theme : 'dark-tech';

  const slideBlocks = extractAllTagBlocks(presBody, 'slide');
  if (slideBlocks.length === 0) {
    throw new Error('No <slide> elements found in XML');
  }

  const slides = slideBlocks.map((block, index) => {
    const { attrs, inner } = block;
    const bulletsBlock = extractAllTagBlocks(inner, 'bullets')[0];
    const items = bulletsBlock
      ? extractAllTagBlocks(bulletsBlock.inner, 'item').map(i => decodeXmlEntities(i.inner))
      : extractAllTagBlocks(inner, 'bullet').map(i => decodeXmlEntities(i.inner));

    const codeBlock = extractAllTagBlocks(inner, 'code')[0];
    const visualBlockTag = extractAllTagBlocks(inner, 'visualBlock')[0];
    const checkupBlock = extractAllTagBlocks(inner, 'checkup')[0];

    let visualBlock;
    if (visualBlockTag) {
      try {
        const decodedVb = decodeXmlEntities(visualBlockTag.inner).trim();
        if (decodedVb.startsWith('{')) {
          visualBlock = JSON.parse(decodedVb);
        }
      } catch {
        // Ignore malformed visualBlock XML payload
      }
    }

    let checkupQuestion;
    if (checkupBlock) {
      const qText = extractTagContent(checkupBlock.inner, 'question');
      const optionBlocks = extractAllTagBlocks(checkupBlock.inner, 'option');
      const options = optionBlocks.map(o => decodeXmlEntities(o.inner)).filter(Boolean);
      let correctAnswer = 0;
      const correctIdx = optionBlocks.findIndex(o => String(o.attrs.correct).toLowerCase() === 'true');
      if (correctIdx !== -1) {
        correctAnswer = correctIdx;
      } else if (checkupBlock.attrs.correctAnswer !== undefined) {
        correctAnswer = Number(checkupBlock.attrs.correctAnswer) || 0;
      }
      const explanation = extractTagContent(checkupBlock.inner, 'explanation');
      const points = Number(checkupBlock.attrs.points) || 10;
      checkupQuestion = { question: qText, options, correctAnswer, explanation, points };
    }

    return normalizeSlide({
      id: attrs.id || undefined,
      order: index,
      layout: attrs.layout || (checkupQuestion ? 'checkup' : 'bullets'),
      motion: attrs.motion || 'fade-up',
      title: extractTagContent(inner, 'title') || attrs.title || `Slide ${index + 1}`,
      subtitle: extractTagContent(inner, 'subtitle') || attrs.subtitle || '',
      body: extractTagContent(inner, 'body'),
      bullets: items,
      codeSnippet: codeBlock ? {
        language: codeBlock.attrs.language || 'javascript',
        code: decodeXmlEntities(codeBlock.inner)
      } : undefined,
      visualBlock,
      callout: extractTagContent(inner, 'callout'),
      speakerNotes: extractTagContent(inner, 'notes') || extractTagContent(inner, 'speakerNotes'),
      durationSeconds: Number(attrs.durationSeconds || attrs.duration) || 45,
      checkupQuestion
    }, index);
  });

  return { title, description, theme, slides };
};

export const serializePresentationToXml = (presentation) => {
  const title = escapeXml(presentation.title || 'Session Presentation');
  const theme = escapeXml(presentation.theme || 'dark-tech');
  const description = escapeXml(presentation.description || '');
  const slides = Array.isArray(presentation.slides) ? presentation.slides : [];

  const slidesXml = slides.map((s, idx) => {
    const lines = [
      `  <slide id="${escapeXml(s.id || `slide_${idx + 1}`)}" layout="${escapeXml(s.layout || 'bullets')}" motion="${escapeXml(s.motion || 'fade-up')}" duration="${Number(s.durationSeconds) || 45}">`,
      `    <title>${escapeXml(s.title || '')}</title>`
    ];
    if (s.subtitle) lines.push(`    <subtitle>${escapeXml(s.subtitle)}</subtitle>`);
    if (s.body) lines.push(`    <body>${escapeXml(s.body)}</body>`);
    if (Array.isArray(s.bullets) && s.bullets.length > 0) {
      lines.push('    <bullets>');
      for (const b of s.bullets) {
        lines.push(`      <item>${escapeXml(b)}</item>`);
      }
      lines.push('    </bullets>');
    }
    if (s.codeSnippet?.code) {
      lines.push(`    <code language="${escapeXml(s.codeSnippet.language || 'javascript')}"><![CDATA[${s.codeSnippet.code}]]></code>`);
    }
    if (s.visualBlock && typeof s.visualBlock === 'object') {
      lines.push(`    <visualBlock><![CDATA[${JSON.stringify(s.visualBlock)}]]></visualBlock>`);
    }
    if (s.callout) lines.push(`    <callout>${escapeXml(s.callout)}</callout>`);
    if (s.speakerNotes) lines.push(`    <notes>${escapeXml(s.speakerNotes)}</notes>`);
    if (s.checkupQuestion) {
      const cq = s.checkupQuestion;
      lines.push(`    <checkup points="${Number(cq.points) || 10}">`);
      lines.push(`      <question>${escapeXml(cq.question)}</question>`);
      lines.push('      <options>');
      (cq.options || []).forEach((opt, oIdx) => {
        const isCorrect = oIdx === Number(cq.correctAnswer);
        lines.push(`        <option${isCorrect ? ' correct="true"' : ''}>${escapeXml(opt)}</option>`);
      });
      lines.push('      </options>');
      if (cq.explanation) {
        lines.push(`      <explanation>${escapeXml(cq.explanation)}</explanation>`);
      }
      lines.push('    </checkup>');
    }
    lines.push('  </slide>');
    return lines.join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<presentation title="${title}" theme="${theme}" description="${description}">`,
    slidesXml,
    '</presentation>'
  ].join('\n');
};

/**
 * Deterministic fallback converter: splits extracted slide text into structured Motion Slides
 * and inserts a Check-Up question slide when AI is unavailable.
 */
export const buildFallbackMotionSlides = (rawText = '', title = 'Session Presentation', includeCheckup = true) => {
  const cleaned = String(rawText || '').replace(/\r\n/g, '\n').trim();
  const rawChunks = cleaned
    .split(/\n{2,}|(?=^#{1,3}\s)|(?=^Slide\s+\d+)/gim)
    .map(c => c.trim())
    .filter(c => c.length > 8);

  const motions = ['fade-up', 'slide-left', 'stagger', 'zoom-in', 'pop'];
  const slides = [];

  slides.push(normalizeSlide({
    layout: 'hero',
    motion: 'zoom-in',
    title,
    subtitle: 'Interactive Motion Session Deck',
    body: rawChunks[0]?.slice(0, 200) || 'Follow along with today’s key concepts and check-up questions.',
    callout: 'Tip: Use Space or Arrow keys to advance slides.'
  }, 0));

  const contentChunks = rawChunks.slice(0, 8);
  contentChunks.forEach((chunk, idx) => {
    const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
    const heading = (lines[0] || `Concept ${idx + 1}`).replace(/^#+\s*/, '').slice(0, 90);
    const rest = lines.slice(1);
    const bullets = rest
      .map(l => l.replace(/^[-*•\d.)]+\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 5);

    slides.push(normalizeSlide({
      layout: bullets.length > 0 ? 'bullets' : 'split',
      motion: motions[idx % motions.length],
      title: heading,
      subtitle: `Part ${idx + 1}`,
      body: bullets.length === 0 ? chunk.slice(0, 320) : '',
      bullets: bullets.length > 0 ? bullets : [chunk.slice(0, 140)],
      callout: idx === contentChunks.length - 1 ? 'Review this concept before the check-up!' : ''
    }, slides.length));

    if (includeCheckup && (idx === Math.floor(contentChunks.length / 2) || idx === contentChunks.length - 1)) {
      slides.push(normalizeSlide({
        layout: 'checkup',
        motion: 'pop',
        title: `Check-Up: ${heading}`,
        subtitle: 'Quick Classroom Pulse Check',
        checkupQuestion: {
          question: `Which statement best summarizes "${heading}"?`,
          options: [
            bullets[0] || `Core concept covered in ${heading}`,
            'It is unrelated to this session track',
            'It should be skipped during practice',
            'None of the above'
          ],
          correctAnswer: 0,
          explanation: `Review "${heading}": ${bullets[0] || chunk.slice(0, 120)}`,
          points: 10
        }
      }, slides.length));
    }
  });

  slides.push(normalizeSlide({
    layout: 'summary',
    motion: 'fade-up',
    title: 'Session Wrap-Up & Homework',
    subtitle: 'Great work today!',
    bullets: [
      'Review the key takeaways from today’s motion deck',
      'Complete the linked session homework quiz',
      'Ask questions in Class Chat if anything is unclear'
    ],
    callout: 'Complete your homework before the next session!'
  }, slides.length));

  return {
    title,
    description: `Motion slides generated from ${title}`,
    theme: 'dark-tech',
    slides
  };
};
