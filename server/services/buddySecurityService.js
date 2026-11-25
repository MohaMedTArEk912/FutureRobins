export const ALLOWED_BUDDY_ROUTES = [
    '/dashboard',
    '/quizzes',
    '/tracks',
    '/analytics',
    '/daily',
    '/leaderboard',
    '/tournaments',
    '/profile',
    '/shop',
    '/classes',
];

const ALLOWED_ROUTE_SET = new Set(ALLOWED_BUDDY_ROUTES);

const THREAT_RULES = [
    {
        reason: 'prompt_injection',
        pattern: /\b(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+|any\s+|every\s+|the\s+)?(?:previous|prior|above|system|safety|initial)?\s*(?:instructions?|rules?|prompts?|guidelines?|constraints?)\b/i,
    },
    {
        reason: 'prompt_injection',
        pattern: /\b(?:act\s+as\s+(?:an?\s+)?(?:unrestricted|evil|raw|dan|jailbroken)|jailbreak|developer\s+mode|god\s+mode|new\s+instructions?\s*:|do\s+anything\s+now)\b/i,
    },
    {
        reason: 'prompt_injection',
        pattern: /(?:^|\s)DAN(?:\s|$|[:!,.])|\bpretend\s+(?:you\s+have\s+no\s+rules|to\s+be\s+unfiltered)\b/i,
    },
    {
        reason: 'secret_exfiltration',
        pattern: /\b(?:reveal|show|print|dump|repeat|leak|output|tell\s+me)\s+(?:your\s+|the\s+)?(?:system\s+prompt|hidden\s+prompt|internal\s+instructions?|exact\s+instructions?|api\s+key|secrets?|env(?:ironment)?\s+variables?|database)\b/i,
    },
    {
        reason: 'secret_exfiltration',
        pattern: /\b(?:GROQ_API_KEY|JWT_SECRET|MONGODB_URI|MONGO_URI|process\.env|SUPABASE_KEY|SUPABASE_SERVICE_ROLE)\b/i,
    },
    {
        reason: 'delimiter_spoof',
        pattern: /<\|(?:im_start|im_end|eot_id|start_header_id|end_header_id)\|>|<\/?untrusted_student_input>|<\/?system>|###\s*(?:SYSTEM|INSTRUCTION|DEVELOPER)\b|\[\/?INST\]/i,
    },
    {
        reason: 'obfuscated_bypass',
        pattern: /\b(?:base64\s+decode|decode\s+base64|rot13|eval\s*\(|fromCharCode)\b|<\s*script\b|javascript\s*:/i,
    },
    {
        reason: 'cheating_or_hack',
        pattern: /\b(?:give\s+me\s+(?:all\s+|the\s+)?(?:exact\s+)?quiz\s+answers?|leak\s+(?:exam|quiz)\s+answers?|hack\s+(?:xp|coins|level|score)|add\s+(?:me\s+)?\d*\s*coins|bypass\s+proctor(?:ing)?|cheat\s+(?:on|in)\s+(?:the\s+)?(?:exam|quiz|test))\b/i,
    },
];

/**
 * Normalizes Unicode via NFKC and strips zero-width, control, and bidirectional override chars.
 */
export function normalizeForSecurity(text) {
    if (typeof text !== 'string') return '';
    return text
        .normalize('NFKC')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u0000-\u0008\u000B-\u001F\u007F]/g, '');
}

/**
 * Validates and sanitizes incoming Study Buddy chat payload.
 */
export function sanitizeChatInput(body) {
    const rawMessage = normalizeForSecurity(typeof body?.message === 'string' ? body.message : '').trim();
    if (!rawMessage) {
        return { error: 'Message cannot be empty.' };
    }
    if (rawMessage.length > 600) {
        return { error: 'Message exceeds the 600-character limit.' };
    }

    const rawHistory = Array.isArray(body?.history) ? body.history : [];
    const safeHistory = [];
    for (const item of rawHistory) {
        if (!item || typeof item !== 'object') continue;
        // Drop any injected 'system', 'developer', or 'tool' roles
        if (item.role !== 'user' && item.role !== 'assistant') continue;
        const content = normalizeForSecurity(typeof item.content === 'string' ? item.content : '').trim();
        if (!content) continue;
        safeHistory.push({
            role: item.role,
            content: content.slice(0, 400),
        });
    }

    const language = body?.language === 'ar-EG' ? 'ar-EG' : 'en';

    return {
        message: rawMessage,
        history: safeHistory.slice(-6),
        language,
    };
}

/**
 * Pre-LLM deterministic firewall blocking jailbreaks, prompt leaks, delimiter spoofing, and cheating.
 */
export function detectSecurityThreat(text) {
    const normalized = normalizeForSecurity(typeof text === 'string' ? text : '');
    if (!normalized) return { blocked: false };

    for (const rule of THREAT_RULES) {
        if (rule.pattern.test(normalized)) {
            return { blocked: true, reason: rule.reason };
        }
    }
    return { blocked: false };
}

/**
 * Escapes XML angle brackets so untrusted input cannot break out of XML sandboxes.
 */
export function escapeXmlDelimiters(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Firm, friendly, in-character refusal (spent 0 LLM tokens).
 */
export function getInCharacterRefusal(language = 'en', reason = 'scope') {
    const ar = language === 'ar-EG';
    if (reason === 'cheating_or_hack') {
        return ar
            ? 'لا يا بطل! أنا هنا عشان أساعدك تفهم وتذاكر صح مش أغششك الإجابات أو أعدّل نقاطك. قولي الموضوع اللي صعب عليك ونراجعه سوا!'
            : "Nice try! I'm your Study Buddy, not a cheat code—I can't hand out exact quiz answers or touch XP/coins. Tell me which topic is tripping you up and we'll master it together!";
    }
    if (reason === 'secret_exfiltration' || reason === 'prompt_injection' || reason === 'delimiter_spoof' || reason === 'obfuscated_bypass') {
        return ar
            ? 'محاولة لطيفة! أنا رفيقك الدراسي جوه Future Robins وبس — خلّينا نركّز في خطط المذاكرة، الدروس، أو الكويزات المناسبة لمستواك.'
            : "Whoa there—I'm locked strictly into Study Buddy mode for Future Robins! Let's stick to your study plan, learning concepts, and picking your next quiz or track.";
    }
    return ar
        ? 'أنا متخصص في المذاكرة، تحليل مستواك، ومحتوى Future Robins بس. تحب نعمل جدول مذاكرة أو نرشحلك كويز؟'
        : "I'm focused strictly on your study plans, learning concepts, and Future Robins content. Want to build a study plan or pick your next quiz?";
}

/**
 * Post-LLM output guard: strips HTML, redacts secret/delimiter echoes, enforces route allowlist.
 */
export function sanitizeBuddyOutput(rawObj, language = 'en') {
    const validMoods = new Set(['happy', 'excited', 'cool', 'neutral']);
    const fallbackReply =
        language === 'ar-EG'
            ? 'جاهز أساعدك تخطط مذاكرتك وتختار الكويزات المناسبة على Future Robins!'
            : "Ready to help you plan your studying and pick the best Future Robins quizzes for your goals!";

    let reply = typeof rawObj?.reply === 'string' ? rawObj.reply : fallbackReply;
    // Strip HTML tags
    reply = reply.replace(/<[^>]*>/g, '');
    // Redact internal tokens or secret env names if ever echoed
    reply = reply.replace(
        /\b(?:GROQ_API_KEY|JWT_SECRET|MONGODB_URI|MONGO_URI|process\.env|untrusted_student_input|system_instructions)\b/gi,
        '[redacted]'
    );
    reply = reply.trim().slice(0, 1200) || fallbackReply;

    const mood = validMoods.has(rawObj?.mood) ? rawObj.mood : 'happy';
    const onTopic = typeof rawObj?.onTopic === 'boolean' ? rawObj.onTopic : true;

    const rawActions = Array.isArray(rawObj?.suggestedActions) ? rawObj.suggestedActions : [];
    const suggestedActions = [];
    for (const action of rawActions) {
        if (!action || typeof action !== 'object') continue;
        const route = typeof action.route === 'string' ? action.route.trim() : '';
        if (!ALLOWED_ROUTE_SET.has(route)) continue;
        const label = String(action.label || '')
            .replace(/<[^>]*>/g, '')
            .trim()
            .slice(0, 40);
        if (!label) continue;
        suggestedActions.push({ label, route });
        if (suggestedActions.length >= 3) break;
    }

    return {
        reply,
        mood,
        onTopic,
        suggestedActions,
    };
}
