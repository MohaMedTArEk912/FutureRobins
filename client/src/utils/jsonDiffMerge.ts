export type JsonStudioContentType =
    | 'quiz'
    | 'question-pool'
    | 'presentation'
    | 'roadmap'
    | 'badges'
    | 'compiler-questions'
    | 'tournament';

export interface FieldDiff {
    key: string;
    oldVal: unknown;
    newVal: unknown;
    status: 'same' | 'modified' | 'added' | 'removed';
}

export interface ItemDiffEntry {
    key: string;
    index: number;
    title: string;
    subtitle?: string;
    status: 'modified' | 'added' | 'removed' | 'unchanged';
    changedFields: string[];
    oldItem: Record<string, unknown> | null;
    newItem: Record<string, unknown> | null;
}

export interface StructuredDiffModel {
    itemLabel: string;
    metadataDiff: FieldDiff[];
    oldMetadata: Record<string, unknown>;
    newMetadata: Record<string, unknown>;
    items: ItemDiffEntry[];
}

export interface MergeDecisions {
    metadataChoice: 'old' | 'new';
    itemChoices: Record<string, 'old' | 'new' | 'drop'>;
}

export interface LineDiffRow {
    leftNum: number | null;
    rightNum: number | null;
    leftText: string;
    rightText: string;
    type: 'same' | 'removed' | 'added' | 'changed';
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
    Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const stableEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
};

export const stripAiPromptKey = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripAiPromptKey);
    if (isRecord(value)) {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            if (k === '_aiPrompt') continue;
            clean[k] = stripAiPromptKey(v);
        }
        return clean;
    }
    return value;
};

export const detectJsonContentType = (data: unknown): JsonStudioContentType => {
    if (Array.isArray(data)) {
        const first = data.find(isRecord) || {};
        if ('badgeId' in first || 'unlockCriteria' in first || 'rarity' in first) return 'badges';
        if ('referenceCode' in first && ('language' in first || 'description' in first)) return 'compiler-questions';
        if ('modules' in first || 'trackId' in first) return 'roadmap';
        if ('slides' in first) return 'presentation';
        if ('quizMode' in first || 'customQuiz' in first) return 'tournament';
        if (first.isQuestionPool || first.quizType === 'pool') return 'question-pool';
        return 'quiz';
    }
    if (!isRecord(data)) return 'quiz';
    if (Array.isArray(data.slides)) return 'presentation';
    if (Array.isArray(data.modules) || 'trackId' in data) return 'roadmap';
    if (Array.isArray(data.badges) || 'badgeId' in data || 'unlockCriteria' in data) return 'badges';
    if ('quizMode' in data || 'customQuiz' in data || ('startsAt' in data && 'endsAt' in data)) return 'tournament';
    if ('referenceCode' in data && ('language' in data || 'description' in data)) return 'compiler-questions';
    if (Array.isArray(data.quizzes)) {
        return data.quizzes.some((q) => isRecord(q) && (q.isQuestionPool || q.quizType === 'pool'))
            ? 'question-pool'
            : 'quiz';
    }
    if (Array.isArray(data.questions)) {
        const firstQ = data.questions.find(isRecord);
        if (firstQ && 'referenceCode' in firstQ && !('question' in firstQ) && !('compilerConfig' in firstQ)) {
            return 'compiler-questions';
        }
        if (data.isQuestionPool || data.quizType === 'pool' || 'poolSize' in data) return 'question-pool';
    }
    return 'quiz';
};

type UnwrappedShape = {
    wrapperKind: 'object' | 'quizzes' | 'badges' | 'questions' | 'array';
    record: Record<string, unknown>;
    extraWrapperFields?: Record<string, unknown>;
};

const unwrapForDiff = (rawData: unknown, type: JsonStudioContentType): UnwrappedShape => {
    const data = stripAiPromptKey(rawData);
    if (Array.isArray(data)) {
        if (type === 'quiz' || type === 'question-pool') {
            const first = isRecord(data[0]) ? data[0] : {};
            return { wrapperKind: 'array', record: first };
        }
        return { wrapperKind: 'array', record: { items: data } };
    }
    if (!isRecord(data)) {
        return { wrapperKind: 'object', record: {} };
    }
    if ((type === 'quiz' || type === 'question-pool') && Array.isArray(data.quizzes)) {
        const first = isRecord(data.quizzes[0]) ? data.quizzes[0] : {};
        return { wrapperKind: 'quizzes', record: first, extraWrapperFields: { ...data } };
    }
    if (type === 'badges' && Array.isArray(data.badges)) {
        return { wrapperKind: 'badges', record: { items: data.badges }, extraWrapperFields: { ...data } };
    }
    if (type === 'badges' && ('badgeId' in data || 'name' in data)) {
        return { wrapperKind: 'object', record: { items: [data] } };
    }
    if (type === 'compiler-questions' && Array.isArray(data.questions)) {
        return { wrapperKind: 'questions', record: { items: data.questions }, extraWrapperFields: { ...data } };
    }
    if (type === 'compiler-questions' && !Array.isArray(data.items)) {
        return { wrapperKind: 'object', record: { items: [data] } };
    }
    return { wrapperKind: 'object', record: data };
};

const getCollectionKey = (type: JsonStudioContentType): { field: string; label: string; nestedCustomQuiz?: boolean } => {
    switch (type) {
        case 'presentation':
            return { field: 'slides', label: 'Slide' };
        case 'roadmap':
            return { field: 'modules', label: 'Module' };
        case 'badges':
            return { field: 'items', label: 'Badge' };
        case 'compiler-questions':
            return { field: 'items', label: 'Challenge' };
        case 'tournament':
            return { field: 'questions', label: 'Tournament Question', nestedCustomQuiz: true };
        case 'question-pool':
        case 'quiz':
        default:
            return { field: 'questions', label: 'Question' };
    }
};

const getItemsList = (rec: Record<string, unknown>, type: JsonStudioContentType): Record<string, unknown>[] => {
    const info = getCollectionKey(type);
    if (info.nestedCustomQuiz) {
        const cq = isRecord(rec.customQuiz) ? rec.customQuiz : {};
        return Array.isArray(cq.questions) ? cq.questions.filter(isRecord) : [];
    }
    const arr = rec[info.field];
    return Array.isArray(arr) ? arr.filter(isRecord) : [];
};

const getMetadataObject = (rec: Record<string, unknown>, type: JsonStudioContentType): Record<string, unknown> => {
    const info = getCollectionKey(type);
    const meta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
        if (k === info.field) continue;
        if (info.nestedCustomQuiz && k === 'customQuiz' && isRecord(v)) {
            const { questions: _omit, ...cqMeta } = v;
            void _omit;
            meta.customQuiz = cqMeta;
            continue;
        }
        meta[k] = v;
    }
    return meta;
};

const getItemStableId = (item: Record<string, unknown>, fallbackIndex: number): string => {
    const candidate = item.id ?? item.moduleId ?? item.badgeId ?? item._id;
    if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
        return `id:${String(candidate)}`;
    }
    return `idx:${fallbackIndex}`;
};

const describeItem = (item: Record<string, unknown>, type: JsonStudioContentType, index: number): { title: string; subtitle?: string } => {
    switch (type) {
        case 'presentation':
            return {
                title: String(item.title || `Slide ${index + 1}`),
                subtitle: `${String(item.layout || 'bullets').toUpperCase()} · ${String(item.motion || 'fade-up')}`
            };
        case 'roadmap':
            return {
                title: String(item.title || item.moduleId || `Module ${index + 1}`),
                subtitle: `${String(item.type || 'core').toUpperCase()} · ${Number(item.xpReward || 0)} XP`
            };
        case 'badges':
            return {
                title: String(item.title || item.name || item.badgeId || `Badge ${index + 1}`),
                subtitle: `${String(item.rarity || 'common').toUpperCase()} · ${String(item.category || 'milestones')}`
            };
        case 'compiler-questions':
            return {
                title: String(item.title || `Challenge ${index + 1}`),
                subtitle: `${String(item.language || 'javascript').toUpperCase()} · ${String(item.difficulty || 'medium')}`
            };
        case 'tournament':
        case 'question-pool':
        case 'quiz':
        default: {
            const rawText = String(item.question || item.text || `Question ${index + 1}`);
            const qType = item.isCompiler ? 'coding' : String(item.type || 'multiple-choice');
            return {
                title: rawText.length > 90 ? `${rawText.slice(0, 87)}...` : rawText,
                subtitle: `${qType.toUpperCase()} · ${Number(item.points || 10)} pts`
            };
        }
    }
};

export const extractStructuredDiff = (
    oldData: unknown,
    newData: unknown,
    type: JsonStudioContentType
): StructuredDiffModel => {
    const oldUnwrapped = unwrapForDiff(oldData, type);
    const newUnwrapped = unwrapForDiff(newData, type);
    const info = getCollectionKey(type);

    const oldMeta = getMetadataObject(oldUnwrapped.record, type);
    const newMeta = getMetadataObject(newUnwrapped.record, type);
    const allMetaKeys = Array.from(new Set([...Object.keys(oldMeta), ...Object.keys(newMeta)]));

    const metadataDiff: FieldDiff[] = allMetaKeys.map((key) => {
        const hasOld = key in oldMeta;
        const hasNew = key in newMeta;
        const status: FieldDiff['status'] =
            !hasOld ? 'added' : !hasNew ? 'removed' : stableEqual(oldMeta[key], newMeta[key]) ? 'same' : 'modified';
        return {
            key,
            oldVal: oldMeta[key],
            newVal: newMeta[key],
            status
        };
    });

    const oldItems = getItemsList(oldUnwrapped.record, type);
    const newItems = getItemsList(newUnwrapped.record, type);

    const oldMap = new Map<string, { item: Record<string, unknown>; index: number }>();
    oldItems.forEach((item, idx) => {
        oldMap.set(getItemStableId(item, idx), { item, index: idx });
    });

    const matchedOldKeys = new Set<string>();
    const items: ItemDiffEntry[] = [];

    newItems.forEach((newItem, newIdx) => {
        const keyById = getItemStableId(newItem, newIdx);
        let matched = oldMap.get(keyById);

        // Fallback positional match if IDs were normalized and this index hasn't been claimed yet
        if (!matched && newIdx < oldItems.length) {
            const posCandidateKey = getItemStableId(oldItems[newIdx], newIdx);
            if (!matchedOldKeys.has(posCandidateKey) && !newItems.some((ni, niIdx) => niIdx !== newIdx && getItemStableId(ni, niIdx) === posCandidateKey)) {
                matched = { item: oldItems[newIdx], index: newIdx };
                matchedOldKeys.add(posCandidateKey);
            }
        } else if (matched) {
            matchedOldKeys.add(keyById);
        }

        const oldItem = matched ? matched.item : null;
        const entryKey = matched ? getItemStableId(matched.item, matched.index) : `new:${newIdx}:${keyById}`;

        let status: ItemDiffEntry['status'] = 'added';
        const changedFields: string[] = [];

        if (oldItem) {
            const keys = Array.from(new Set([...Object.keys(oldItem), ...Object.keys(newItem)]));
            for (const k of keys) {
                if (!stableEqual(oldItem[k], newItem[k])) {
                    changedFields.push(k);
                }
            }
            status = changedFields.length > 0 ? 'modified' : 'unchanged';
        }

        const desc = describeItem(newItem, type, newIdx);
        items.push({
            key: entryKey,
            index: newIdx,
            title: desc.title,
            subtitle: desc.subtitle,
            status,
            changedFields,
            oldItem,
            newItem
        });
    });

    oldItems.forEach((oldItem, oldIdx) => {
        const key = getItemStableId(oldItem, oldIdx);
        if (!matchedOldKeys.has(key)) {
            const desc = describeItem(oldItem, type, oldIdx);
            items.push({
                key: `removed:${key}`,
                index: items.length,
                title: desc.title,
                subtitle: desc.subtitle,
                status: 'removed',
                changedFields: Object.keys(oldItem),
                oldItem,
                newItem: null
            });
        }
    });

    return {
        itemLabel: info.label,
        metadataDiff,
        oldMetadata: oldMeta,
        newMetadata: newMeta,
        items
    };
};

export const buildMergedJson = (
    oldData: unknown,
    newData: unknown,
    type: JsonStudioContentType,
    decisions: MergeDecisions
): unknown => {
    const cleanOld = stripAiPromptKey(oldData);
    const cleanNew = stripAiPromptKey(newData);
    const diff = extractStructuredDiff(cleanOld, cleanNew, type);
    const info = getCollectionKey(type);

    const chosenMeta = decisions.metadataChoice === 'old' ? diff.oldMetadata : diff.newMetadata;
    const mergedItems: Record<string, unknown>[] = [];

    for (const item of diff.items) {
        const choice = decisions.itemChoices[item.key] || (item.status === 'removed' ? 'drop' : 'new');
        if (choice === 'drop') continue;
        if (choice === 'old' && item.oldItem) {
            mergedItems.push(item.oldItem);
        } else if (choice === 'new' && item.newItem) {
            mergedItems.push(item.newItem);
        } else if (item.newItem) {
            mergedItems.push(item.newItem);
        } else if (item.oldItem) {
            mergedItems.push(item.oldItem);
        }
    }

    const baseRecord: Record<string, unknown> = { ...chosenMeta };
    if (info.nestedCustomQuiz) {
        const existingCustomQuiz = isRecord(chosenMeta.customQuiz) ? chosenMeta.customQuiz : {};
        baseRecord.customQuiz = {
            ...existingCustomQuiz,
            questions: mergedItems
        };
    } else {
        baseRecord[info.field] = mergedItems;
    }

    // Rewrap to preserve input wrapper format cleanly
    const template = cleanNew ?? cleanOld;
    if (Array.isArray(template)) {
        if (type === 'quiz' || type === 'question-pool') {
            return [baseRecord];
        }
        return mergedItems;
    }

    if (isRecord(template)) {
        if ((type === 'quiz' || type === 'question-pool') && Array.isArray(template.quizzes)) {
            return { quizzes: [baseRecord, ...template.quizzes.slice(1)] };
        }
        if (type === 'badges') {
            if (Array.isArray(template.badges)) return { badges: mergedItems };
            if ('badgeId' in template || 'name' in template) return mergedItems[0] || {};
        }
        if (type === 'compiler-questions') {
            if (Array.isArray(template.questions)) return { questions: mergedItems };
            if (!Array.isArray(template.items)) return mergedItems[0] || {};
        }
    }

    return baseRecord;
};

export const computeSideBySideLineDiff = (oldText: string, newText: string): LineDiffRow[] => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const m = oldLines.length;
    const n = newLines.length;

    // Fast positional diff for very huge JSON files (> 1800 lines each)
    if (m * n > 2_000_000) {
        const maxLen = Math.max(m, n);
        const rows: LineDiffRow[] = [];
        for (let i = 0; i < maxLen; i++) {
            const l = i < m ? oldLines[i] : '';
            const r = i < n ? newLines[i] : '';
            const type: LineDiffRow['type'] =
                i >= m ? 'added' : i >= n ? 'removed' : l === r ? 'same' : 'changed';
            rows.push({
                leftNum: i < m ? i + 1 : null,
                rightNum: i < n ? i + 1 : null,
                leftText: l,
                rightText: r,
                type
            });
        }
        return rows;
    }

    // LCS DP table
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            if (oldLines[i] === newLines[j]) {
                dp[i][j] = 1 + dp[i + 1][j + 1];
            } else {
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    const rows: LineDiffRow[] = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
        if (oldLines[i] === newLines[j]) {
            rows.push({
                leftNum: i + 1,
                rightNum: j + 1,
                leftText: oldLines[i],
                rightText: newLines[j],
                type: 'same'
            });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            rows.push({
                leftNum: i + 1,
                rightNum: null,
                leftText: oldLines[i],
                rightText: '',
                type: 'removed'
            });
            i++;
        } else {
            rows.push({
                leftNum: null,
                rightNum: j + 1,
                leftText: '',
                rightText: newLines[j],
                type: 'added'
            });
            j++;
        }
    }

    while (i < m) {
        rows.push({ leftNum: i + 1, rightNum: null, leftText: oldLines[i], rightText: '', type: 'removed' });
        i++;
    }
    while (j < n) {
        rows.push({ leftNum: null, rightNum: j + 1, leftText: '', rightText: newLines[j], type: 'added' });
        j++;
    }

    // Pair adjacent removed + added rows into clean side-by-side 'changed' rows when lengths match cleanly
    const paired: LineDiffRow[] = [];
    let idx = 0;
    while (idx < rows.length) {
        if (rows[idx].type === 'removed') {
            const removedBlock: LineDiffRow[] = [];
            while (idx < rows.length && rows[idx].type === 'removed') {
                removedBlock.push(rows[idx]);
                idx++;
            }
            const addedBlock: LineDiffRow[] = [];
            while (idx < rows.length && rows[idx].type === 'added') {
                addedBlock.push(rows[idx]);
                idx++;
            }
            const maxBlock = Math.max(removedBlock.length, addedBlock.length);
            for (let k = 0; k < maxBlock; k++) {
                const rem = removedBlock[k];
                const add = addedBlock[k];
                if (rem && add) {
                    paired.push({
                        leftNum: rem.leftNum,
                        rightNum: add.rightNum,
                        leftText: rem.leftText,
                        rightText: add.rightText,
                        type: 'changed'
                    });
                } else if (rem) {
                    paired.push(rem);
                } else if (add) {
                    paired.push(add);
                }
            }
        } else {
            paired.push(rows[idx]);
            idx++;
        }
    }

    return paired;
};
