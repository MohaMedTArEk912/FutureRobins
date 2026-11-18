import type { Quiz, SkillModule, SkillTrack } from '../types';

export type TrackAssessmentKind = 'quiz' | 'homework' | 'exam';

export interface ModuleMatchMeta {
    moduleId: string;
    title: string;
    order: number;
    type: SkillModule['type'];
}

export interface TrackQuizItem {
    quiz: Quiz;
    sessionLabel?: string;
    meta?: ModuleMatchMeta;
    kind: TrackAssessmentKind;
}

export interface TrackGroupedQuizzes {
    sessions: {
        module: SkillModule;
        order: number;
        items: { quiz: Quiz; kind: TrackAssessmentKind }[];
    }[];
    exams: TrackQuizItem[];
    quizzes: TrackQuizItem[];
    homework: TrackQuizItem[];
    totalCount: number;
    matchedIds: Set<string>;
}

export function collectModuleQuizIds(mod: SkillModule): Set<string> {
    const ids = new Set<string>();
    if (mod.quizId) ids.add(String(mod.quizId));
    (mod.quizIds || []).forEach(id => {
        if (id) ids.add(String(id));
    });
    (mod.subModules || []).forEach(sub => {
        if (sub.quizId) ids.add(String(sub.quizId));
    });
    return ids;
}

export function classifyQuizKind(quiz: Quiz, moduleMeta?: ModuleMatchMeta): TrackAssessmentKind {
    const text = `${quiz.title || ''} ${quiz.description || ''}`;
    if (/homework|\bhw\b|assignment|take[- ]?home/i.test(text)) {
        return 'homework';
    }
    if (
        quiz.quizType === 'exam'
        || /\bexam\b|comprehensive|midterm|final\s+test|capstone/i.test(text)
    ) {
        return 'exam';
    }
    // Keep explicit quizzes and in-class assessments as Session Quizzes even if their parent module is typed 'exam'/'milestone'
    if (quiz.quizType === 'quiz' || /\bin[- ]?class\b/i.test(text)) {
        return 'quiz';
    }
    if (moduleMeta?.type === 'exam' || moduleMeta?.type === 'milestone') {
        return 'exam';
    }
    return 'quiz';
}

export function groupQuizzesForTrack(
    selectedTrack: SkillTrack | null,
    quizzes: Quiz[],
    searchQuery = ''
): TrackGroupedQuizzes {
    const empty: TrackGroupedQuizzes = {
        sessions: [],
        exams: [],
        quizzes: [],
        homework: [],
        totalCount: 0,
        matchedIds: new Set()
    };

    if (!selectedTrack) return empty;

    const modules = selectedTrack.modules || [];
    const moduleByQuizId = new Map<string, ModuleMatchMeta>();
    const moduleById = new Map<string, ModuleMatchMeta>();

    modules.forEach((mod, idx) => {
        const meta: ModuleMatchMeta = {
            moduleId: mod.moduleId,
            title: mod.title,
            order: idx + 1,
            type: mod.type
        };
        moduleById.set(mod.moduleId, meta);
        collectModuleQuizIds(mod).forEach(qid => {
            if (!moduleByQuizId.has(qid)) moduleByQuizId.set(qid, meta);
        });
    });

    const trackTitleLower = (selectedTrack.title || '').toLowerCase();
    const trackCatLower = (selectedTrack.category || '').toLowerCase();
    const qSearch = searchQuery.trim().toLowerCase();

    const matchedQuizzes: { quiz: Quiz; meta?: ModuleMatchMeta; kind: TrackAssessmentKind }[] = [];
    const matchedIds = new Set<string>();

    quizzes.forEach(q => {
        const qid = String(q.id || q._id || '');
        const altQid = q._id ? String(q._id) : '';
        const linkedMeta: ModuleMatchMeta | undefined =
            (qid ? moduleByQuizId.get(qid) : undefined)
            || (altQid ? moduleByQuizId.get(altQid) : undefined)
            || (q.linkedModuleId ? moduleById.get(q.linkedModuleId) : undefined)
            || (q.moduleId ? moduleById.get(q.moduleId) : undefined);

        const catLower = (q.category || '').trim().toLowerCase();
        const matchesTrack = Boolean(
            linkedMeta
            || q.linkedTrackId === selectedTrack.trackId
            || (selectedTrack.subjectId && q.subjectId === selectedTrack.subjectId)
            || (trackCatLower && catLower && catLower === trackCatLower)
            || (catLower && catLower.length > 2 && trackTitleLower.includes(catLower))
        );

        if (!matchesTrack) return;
        if (qid) matchedIds.add(qid);
        if (altQid) matchedIds.add(altQid);

        let resolvedMeta = linkedMeta;
        if (!resolvedMeta && q.title) {
            const modMatch = q.title.match(/\b(?:module|session)\s*(\d+)\b/i);
            if (modMatch) {
                const num = Number(modMatch[1]);
                const targetMod = modules[num - 1];
                if (targetMod) {
                    resolvedMeta = {
                        moduleId: targetMod.moduleId,
                        title: targetMod.title,
                        order: num,
                        type: targetMod.type
                    };
                }
            }
        }

        if (qSearch) {
            const haystack = `${q.title || ''} ${q.description || ''} ${resolvedMeta?.title || ''}`.toLowerCase();
            if (!haystack.includes(qSearch)) return;
        }

        const kind = classifyQuizKind(q, resolvedMeta);
        matchedQuizzes.push({ quiz: q, meta: resolvedMeta, kind });
    });

    const sessionBuckets = new Map<string, { quiz: Quiz; kind: TrackAssessmentKind }[]>();
    matchedQuizzes.forEach(item => {
        if (item.meta) {
            const existing = sessionBuckets.get(item.meta.moduleId) || [];
            existing.push({ quiz: item.quiz, kind: item.kind });
            sessionBuckets.set(item.meta.moduleId, existing);
        }
    });

    const sessions = modules
        .map((mod, idx) => ({
            module: mod,
            order: idx + 1,
            items: sessionBuckets.get(mod.moduleId) || []
        }))
        .filter(s => !qSearch || s.items.length > 0 || (s.module.title || '').toLowerCase().includes(qSearch));

    const toItem = (m: { quiz: Quiz; meta?: ModuleMatchMeta; kind: TrackAssessmentKind }): TrackQuizItem => ({
        quiz: m.quiz,
        meta: m.meta,
        kind: m.kind,
        sessionLabel: m.meta ? `Session ${m.meta.order}: ${m.meta.title}` : undefined
    });

    const exams = matchedQuizzes.filter(m => m.kind === 'exam').map(toItem);
    const regularQuizzes = matchedQuizzes.filter(m => m.kind === 'quiz').map(toItem);
    const homework = matchedQuizzes.filter(m => m.kind === 'homework').map(toItem);

    return {
        sessions,
        exams,
        quizzes: regularQuizzes,
        homework,
        totalCount: matchedQuizzes.length,
        matchedIds
    };
}
