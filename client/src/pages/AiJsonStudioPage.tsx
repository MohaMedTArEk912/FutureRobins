import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Sparkles,
    Upload,
    Copy,
    Check,
    Download,
    Save,
    Database,
    FileText,
    ShieldCheck,
    Palette,
    AlertTriangle,
    AlertCircle,
    Lightbulb,
    Code2,
    Columns2,
    Braces,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Lock,
    Paperclip,
    X,
    Wand2
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { api } from '../lib/api';
import { navigateBackSafely } from '../lib/navigation';
import { AmbientBackground } from '../components/AmbientBackground';
import { MathRenderer } from '../components/common/MathRenderer';
import type {
    Quiz,
    MotionPresentation,
    SkillTrack,
    BadgeNode,
    Tournament
} from '../types';
import {
    detectJsonContentType,
    extractStructuredDiff,
    buildMergedJson,
    computeSideBySideLineDiff,
    stripAiPromptKey,
    type JsonStudioContentType,
    type ItemDiffEntry,
    type MergeDecisions
} from '../utils/jsonDiffMerge';

interface DbRecordOption {
    id: string;
    label: string;
    sublabel?: string;
    payload: unknown;
}

interface PreserveFlagsState {
    keepIds: boolean;
    keepCorrectAnswers: boolean;
    keepLanguage: boolean;
    keepItemCount: boolean;
    fixSchemaAndMarkdown: boolean;
    upgradeFeatures: boolean;
    deepenExplanations: boolean;
}

const CONTENT_TYPES: Array<{ id: JsonStudioContentType; label: string; arLabel: string; samplePath: string }> = [
    { id: 'quiz', label: 'Quiz', arLabel: 'كويز', samplePath: '/samples/quiz-import-sample.json' },
    { id: 'question-pool', label: 'Question Pool', arLabel: 'بنك أسئلة', samplePath: '/samples/question-pool-sample.json' },
    { id: 'presentation', label: 'Presentation', arLabel: 'عرض شرائح', samplePath: '' },
    { id: 'roadmap', label: 'Roadmap', arLabel: 'خريطة مسار', samplePath: '/samples/roadmap-sample.json' },
    { id: 'badges', label: 'Badges', arLabel: 'شارات', samplePath: '/samples/badge-sample.json' },
    { id: 'compiler-questions', label: 'Compiler', arLabel: 'تحديات كود', samplePath: '/samples/compiler-questions-sample.json' },
    { id: 'tournament', label: 'Tournament', arLabel: 'بطولة', samplePath: '/samples/tournament-sample.json' }
];

const isRecord = (v: unknown): v is Record<string, unknown> =>
    Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const parseJsonSafe = (raw: string): { ok: true; data: unknown } | { ok: false; error: string } => {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: false, error: 'Empty JSON' };
    try {
        return { ok: true, data: JSON.parse(trimmed) };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON syntax' };
    }
};

const AiJsonStudioPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isBento, theme, openThemeModal } = useTheme();
    const { tx } = useLanguage();
    const { currentUser, isAdmin } = useAuth();
    const { showNotification } = useNotification();

    const initialTypeParam = searchParams.get('type') as JsonStudioContentType | null;
    const validTypeParam = initialTypeParam && CONTENT_TYPES.some(t => t.id === initialTypeParam)
        ? initialTypeParam
        : 'quiz';

    const [contentType, setContentType] = useState<JsonStudioContentType>(validTypeParam);
    const [sourceTab, setSourceTab] = useState<'db' | 'upload' | 'paste'>('db');

    // DB Picker state
    const [dbOptions, setDbOptions] = useState<DbRecordOption[]>([]);
    const [loadingDb, setLoadingDb] = useState(false);
    const [dbSearch, setDbSearch] = useState('');
    const [selectedDbId, setSelectedDbId] = useState<string>('');
    const [loadedDbMeta, setLoadedDbMeta] = useState<{ id: string; label: string; type: JsonStudioContentType } | null>(null);

    // Source JSON Editor state
    const [rawJsonText, setRawJsonText] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // "What Must Remain" & Upgrade Configuration
    const [preserveFlags, setPreserveFlags] = useState<PreserveFlagsState>({
        keepIds: true,
        keepCorrectAnswers: true,
        keepLanguage: true,
        keepItemCount: false,
        fixSchemaAndMarkdown: true,
        upgradeFeatures: true,
        deepenExplanations: true
    });
    const [keepInstructions, setKeepInstructions] = useState('');
    const [upgradeGoals, setUpgradeGoals] = useState('');
    const [showContextDrawer, setShowContextDrawer] = useState(false);
    const [sourceContext, setSourceContext] = useState('');
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const contextFileRef = useRef<HTMLInputElement>(null);

    // AI Execution & Comparison State
    const [isRefining, setIsRefining] = useState(false);
    const [isSavingToDb, setIsSavingToDb] = useState(false);
    const [copiedMerged, setCopiedMerged] = useState(false);
    const [configCollapsed, setConfigCollapsed] = useState(false);
    const [resultView, setResultView] = useState<'visual' | 'code' | 'merged'>('visual');
    const [itemFilter, setItemFilter] = useState<'all' | 'changed'>('all');
    const [showAuditList, setShowAuditList] = useState(false);

    const [refineResult, setRefineResult] = useState<{
        model: string;
        detectedType: JsonStudioContentType;
        originalNormalized: unknown;
        refined: unknown;
        auditIssues: Array<{ severity: 'error' | 'warning' | 'tip'; path: string; message: string }>;
        summary: string;
        improvements: string[];
    } | null>(null);

    const [mergeDecisions, setMergeDecisions] = useState<MergeDecisions>({
        metadataChoice: 'new',
        itemChoices: {}
    });

    // Load DB records whenever contentType changes
    const loadDbRecords = useCallback(async (targetType: JsonStudioContentType) => {
        if (!currentUser?.userId) return;
        setLoadingDb(true);
        try {
            let options: DbRecordOption[] = [];
            if (targetType === 'quiz' || targetType === 'question-pool') {
                const allQuizzes = await api.getQuizzes(undefined, true);
                const list = Array.isArray(allQuizzes) ? allQuizzes : [];
                options = list
                    .filter((q: Quiz) => {
                        const isPool = Boolean(q.isQuestionPool || q.quizType === 'pool');
                        return targetType === 'question-pool' ? isPool : !isPool;
                    })
                    .map((q: Quiz) => ({
                        id: String(q.id || q._id || q.title),
                        label: q.title,
                        sublabel: `${q.category || 'General'} · ${(q.questions || []).length} Qs`,
                        payload: q
                    }));
            } else if (targetType === 'presentation') {
                const decks = await api.getPresentations({}, currentUser.userId);
                options = (Array.isArray(decks) ? decks : []).map((d: MotionPresentation) => ({
                    id: String(d.presentationId || d.title),
                    label: d.title,
                    sublabel: `${(d.slides || []).length} slides · ${d.theme || 'dark-tech'}`,
                    payload: d
                }));
            } else if (targetType === 'roadmap') {
                const tracks = await api.getSkillTracks(undefined, true);
                options = (Array.isArray(tracks) ? tracks : []).map((t: SkillTrack) => ({
                    id: String(t.trackId || t.title),
                    label: t.title,
                    sublabel: `${(t.modules || []).length} modules · ${t.category || ''}`,
                    payload: t
                }));
            } else if (targetType === 'badges') {
                const badges = await api.getBadgeNodes();
                const list = Array.isArray(badges) ? badges : [];
                options = list.map((b: BadgeNode) => ({
                    id: String(b.badgeId || b.name),
                    label: b.title || b.name,
                    sublabel: `${b.rarity} · ${b.category}`,
                    payload: b
                }));
            } else if (targetType === 'compiler-questions') {
                if (isAdmin) {
                    const cqs = await api.getCompilerQuestionsAdmin(currentUser.userId);
                    const list = Array.isArray(cqs) ? cqs : [];
                    options = list.map((c: Record<string, unknown>) => ({
                        id: String(c._id || c.id || c.title),
                        label: String(c.title || 'Challenge'),
                        sublabel: `${String(c.language || 'javascript')} · ${String(c.difficulty || 'medium')}`,
                        payload: c
                    }));
                }
            } else if (targetType === 'tournament') {
                const tournaments = await api.getTournaments(currentUser.userId);
                options = (Array.isArray(tournaments) ? tournaments : []).map((t: Tournament) => ({
                    id: String(t.tournamentId || t.name),
                    label: t.name,
                    sublabel: `${t.status} · ${t.quizMode}`,
                    payload: t
                }));
            }
            setDbOptions(options);

            // Auto-select from ?id=... if matching
            const urlId = searchParams.get('id');
            if (urlId) {
                const found = options.find(o => o.id === urlId);
                if (found) {
                    setSelectedDbId(found.id);
                    const cleanPayload = stripAiPromptKey(found.payload);
                    setRawJsonText(JSON.stringify(cleanPayload, null, 2));
                    setLoadedDbMeta({ id: found.id, label: found.label, type: targetType });
                }
            }
        } catch (err) {
            console.warn('[AI JSON Studio] Failed to load DB records:', err);
            setDbOptions([]);
        } finally {
            setLoadingDb(false);
        }
    }, [currentUser?.userId, isAdmin, searchParams]);

    useEffect(() => {
        void loadDbRecords(contentType);
    }, [contentType, loadDbRecords]);

    const handleSelectType = (nextType: JsonStudioContentType) => {
        setContentType(nextType);
        setSelectedDbId('');
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('type', nextType);
            next.delete('id');
            return next;
        }, { replace: true });
    };

    const handleLoadSelectedDb = (idToLoad: string) => {
        setSelectedDbId(idToLoad);
        const found = dbOptions.find(o => o.id === idToLoad);
        if (!found) return;
        const cleanPayload = stripAiPromptKey(found.payload);
        setRawJsonText(JSON.stringify(cleanPayload, null, 2));
        setLoadedDbMeta({ id: found.id, label: found.label, type: contentType });
        showNotification('info', tx(`Loaded "${found.label}" into Studio.`, `تم تحميل "${found.label}" في الاستوديو.`));
    };

    const handleUploadJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            setRawJsonText(text);
            setLoadedDbMeta(null);
            setSelectedDbId('');
            const parsed = parseJsonSafe(text);
            if (parsed.ok) {
                const guessed = detectJsonContentType(parsed.data);
                setContentType(guessed);
            }
            showNotification('success', tx(`Loaded file: ${file.name}`, `تم قراءة الملف: ${file.name}`));
        } catch {
            showNotification('error', tx('Failed to read JSON file', 'فشل قراءة ملف JSON'));
        }
        e.target.value = '';
    };

    const handleLoadSample = async () => {
        const meta = CONTENT_TYPES.find(c => c.id === contentType);
        if (!meta?.samplePath) {
            const { SAMPLE_FULL_PRESENTATION } = await import('../constants/samplePresentationJson');
            const cleanSample = stripAiPromptKey(SAMPLE_FULL_PRESENTATION);
            setRawJsonText(JSON.stringify(cleanSample, null, 2));
            setLoadedDbMeta(null);
            return;
        }
        try {
            const res = await fetch(meta.samplePath);
            if (!res.ok) throw new Error('Failed to fetch sample');
            const data = await res.json();
            setRawJsonText(JSON.stringify(stripAiPromptKey(data), null, 2));
            setLoadedDbMeta(null);
        } catch {
            showNotification('error', tx('Could not load sample template', 'تعذر تحميل النموذج'));
        }
    };

    const parsedEditor = useMemo(() => parseJsonSafe(rawJsonText), [rawJsonText]);

    const handleFormatEditor = () => {
        if (!parsedEditor.ok) {
            showNotification('warning', tx('Fix JSON syntax errors before formatting.', 'صلح أخطاء JSON الأول قبل التنسيق.'));
            return;
        }
        setRawJsonText(JSON.stringify(parsedEditor.data, null, 2));
    };

    // Run AI Refiner
    const handleAnalyzeAndUpgrade = async () => {
        if (!rawJsonText.trim()) {
            showNotification('warning', tx('Please load, upload, or paste a JSON first.', 'اختار أو ارفع أو الصق ملف JSON الأول.'));
            return;
        }
        if (!parsedEditor.ok) {
            showNotification('error', tx(`Invalid JSON: ${parsedEditor.error}`, `خطأ في صيغة JSON: ${parsedEditor.error}`));
            return;
        }

        setIsRefining(true);
        try {
            const response = await api.refineJsonWithAi(
                {
                    jsonContent: rawJsonText,
                    contentType,
                    keepInstructions,
                    preserveFlags: preserveFlags as unknown as Record<string, boolean>,
                    upgradeGoals,
                    sourceContext,
                    sourceFile
                },
                currentUser?.userId
            );

            const detected = (response.detectedType as JsonStudioContentType) || contentType;
            const diff = extractStructuredDiff(response.originalNormalized, response.refined, detected);
            const initialChoices: Record<string, 'old' | 'new' | 'drop'> = {};
            diff.items.forEach(item => {
                initialChoices[item.key] = item.status === 'removed' ? 'drop' : 'new';
            });

            setRefineResult({
                model: response.model,
                detectedType: detected,
                originalNormalized: response.originalNormalized,
                refined: response.refined,
                auditIssues: response.auditIssues || [],
                summary: response.summary,
                improvements: response.improvements || []
            });
            setMergeDecisions({
                metadataChoice: 'new',
                itemChoices: initialChoices
            });
            setConfigCollapsed(true);
            setResultView('visual');
            showNotification('success', tx('AI audit & upgrade complete! Review the split comparison below.', 'تم التحليل والتطوير بالذكاء الاصطناعي! قارن بين القديم والجديد تحت.'));
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : tx('AI refinement failed', 'فشلت عملية التحسين بالذكاء الاصطناعي'));
        } finally {
            setIsRefining(false);
        }
    };

    // Structured Diff Model for active result
    const diffModel = useMemo(() => {
        if (!refineResult) return null;
        return extractStructuredDiff(
            refineResult.originalNormalized,
            refineResult.refined,
            refineResult.detectedType
        );
    }, [refineResult]);

    // Final Merged JSON computed live from user's Keep Old / Use New choices
    const mergedJson = useMemo(() => {
        if (!refineResult) return null;
        return buildMergedJson(
            refineResult.originalNormalized,
            refineResult.refined,
            refineResult.detectedType,
            mergeDecisions
        );
    }, [refineResult, mergeDecisions]);

    const mergedPrettyText = useMemo(() => {
        return mergedJson ? JSON.stringify(mergedJson, null, 2) : '';
    }, [mergedJson]);

    const oldPrettyText = useMemo(() => {
        return refineResult ? JSON.stringify(refineResult.originalNormalized, null, 2) : '';
    }, [refineResult]);

    const newPrettyText = useMemo(() => {
        return refineResult ? JSON.stringify(refineResult.refined, null, 2) : '';
    }, [refineResult]);

    const lineDiffRows = useMemo(() => {
        if (resultView !== 'code' || !refineResult) return [];
        return computeSideBySideLineDiff(oldPrettyText, newPrettyText);
    }, [resultView, refineResult, oldPrettyText, newPrettyText]);

    const decisionStats = useMemo(() => {
        if (!diffModel) return { total: 0, newCount: 0, oldCount: 0, droppedCount: 0, addedCount: 0 };
        let newCount = 0;
        let oldCount = 0;
        let droppedCount = 0;
        let addedCount = 0;
        for (const item of diffModel.items) {
            const c = mergeDecisions.itemChoices[item.key] || (item.status === 'removed' ? 'drop' : 'new');
            if (c === 'drop') droppedCount++;
            else if (c === 'old') oldCount++;
            else {
                newCount++;
                if (item.status === 'added') addedCount++;
            }
        }
        return { total: diffModel.items.length, newCount, oldCount, droppedCount, addedCount };
    }, [diffModel, mergeDecisions]);

    const handleBulkDecision = (target: 'new' | 'old') => {
        if (!diffModel) return;
        const nextChoices: Record<string, 'old' | 'new' | 'drop'> = {};
        diffModel.items.forEach(item => {
            if (target === 'new') {
                nextChoices[item.key] = item.status === 'removed' ? 'drop' : 'new';
            } else {
                nextChoices[item.key] = item.oldItem ? 'old' : 'drop';
            }
        });
        setMergeDecisions({
            metadataChoice: target,
            itemChoices: nextChoices
        });
    };

    const handleCopyMerged = async () => {
        if (!mergedPrettyText) return;
        try {
            await navigator.clipboard.writeText(mergedPrettyText);
            setCopiedMerged(true);
            showNotification('success', tx('Merged JSON copied to clipboard!', 'تم نسخ JSON النهائي!'));
            setTimeout(() => setCopiedMerged(false), 2000);
        } catch {
            showNotification('error', tx('Clipboard permission denied', 'تعذر النسخ للحافظة'));
        }
    };

    const handleDownloadMerged = () => {
        if (!mergedPrettyText || !refineResult) return;
        const blob = new Blob([mergedPrettyText], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `upgraded-${refineResult.detectedType}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const handleRefineAgain = () => {
        if (!mergedPrettyText) return;
        setRawJsonText(mergedPrettyText);
        setRefineResult(null);
        setConfigCollapsed(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const canDirectSaveToDb = Boolean(
        refineResult &&
        currentUser?.userId &&
        (isAdmin || refineResult.detectedType === 'presentation')
    );

    const handleSaveToPlatform = async () => {
        if (!mergedJson || !refineResult || !currentUser?.userId) return;
        const t = refineResult.detectedType;
        if (!isAdmin && t !== 'presentation') {
            showNotification('warning', tx('Admin permission required to overwrite this entity type. Copy or Download the JSON instead.', 'الحفظ المباشر للنوع ده متاح للأدمن فقط — تقدر تنسخ أو تحمل الملف.'));
            return;
        }

        setIsSavingToDb(true);
        try {
            const payload = stripAiPromptKey(mergedJson);

            if (t === 'quiz' || t === 'question-pool') {
                const quizObj = Array.isArray(payload)
                    ? payload[0]
                    : isRecord(payload) && Array.isArray(payload.quizzes)
                        ? payload.quizzes[0]
                        : payload;
                if (!isRecord(quizObj)) throw new Error('Invalid quiz payload');

                const targetId = loadedDbMeta?.type === t && loadedDbMeta.id
                    ? loadedDbMeta.id
                    : String(quizObj.id || '');
                if (targetId && loadedDbMeta?.type === t) {
                    await api.updateQuiz(targetId, quizObj as Partial<Quiz>, currentUser.userId);
                } else {
                    await api.importQuizzes({ quizzes: [quizObj] }, currentUser.userId);
                }
            } else if (t === 'presentation') {
                if (!isRecord(payload)) throw new Error('Invalid presentation payload');
                const presData = {
                    ...payload,
                    ...(loadedDbMeta?.type === 'presentation' && loadedDbMeta.id ? { presentationId: loadedDbMeta.id } : {})
                } as MotionPresentation;
                await api.savePresentation(presData, currentUser.userId);
            } else if (t === 'roadmap') {
                if (!isRecord(payload)) throw new Error('Invalid roadmap payload');
                const track = payload as unknown as SkillTrack;
                const targetId = loadedDbMeta?.type === 'roadmap' ? loadedDbMeta.id : track.trackId;
                if (loadedDbMeta?.type === 'roadmap' && targetId) {
                    await api.updateSkillTrack(targetId, track, currentUser.userId);
                } else {
                    await api.createSkillTrack(track, currentUser.userId);
                }
            } else if (t === 'badges') {
                const list = Array.isArray(payload)
                    ? payload
                    : isRecord(payload) && Array.isArray(payload.badges)
                        ? payload.badges
                        : [payload];
                for (const item of list) {
                    if (!isRecord(item)) continue;
                    const badge = item as unknown as Partial<BadgeNode>;
                    const bid = badge.badgeId || (loadedDbMeta?.type === 'badges' ? loadedDbMeta.id : '');
                    if (bid && loadedDbMeta?.type === 'badges') {
                        await api.updateBadgeNode(bid, badge, currentUser.userId);
                    } else {
                        await api.createBadgeNode(badge, currentUser.userId);
                    }
                }
            } else if (t === 'compiler-questions') {
                const list = Array.isArray(payload)
                    ? payload
                    : isRecord(payload) && Array.isArray(payload.questions)
                        ? payload.questions
                        : [payload];
                for (const item of list) {
                    if (!isRecord(item)) continue;
                    const cqPayload = {
                        title: String(item.title || 'Challenge'),
                        description: String(item.description || ''),
                        referenceCode: String(item.referenceCode || ''),
                        language: typeof item.language === 'string' ? item.language : 'python',
                        difficulty: typeof item.difficulty === 'string' ? item.difficulty : 'medium',
                        category: typeof item.category === 'string' ? item.category : 'Algorithms',
                        hints: Array.isArray(item.hints) ? item.hints.map(String) : [],
                        rewardCoins: typeof item.rewardCoins === 'number' ? item.rewardCoins : undefined,
                        rewardXP: typeof item.rewardXP === 'number' ? item.rewardXP : undefined
                    };
                    const targetId = loadedDbMeta?.type === 'compiler-questions' ? loadedDbMeta.id : String(item._id || item.id || '');
                    if (targetId && loadedDbMeta?.type === 'compiler-questions') {
                        await api.updateCompilerQuestion(targetId, cqPayload, currentUser.userId);
                    } else {
                        await api.createCompilerQuestion(cqPayload, currentUser.userId);
                    }
                }
            } else if (t === 'tournament') {
                if (!isRecord(payload)) throw new Error('Invalid tournament payload');
                const tour = payload as unknown as Partial<Tournament>;
                if (loadedDbMeta?.type === 'tournament' && loadedDbMeta.id) {
                    await api.updateTournament(loadedDbMeta.id, tour, currentUser.userId);
                } else {
                    await api.createTournament(tour, currentUser.userId);
                }
            }

            showNotification('success', tx('Saved upgraded JSON directly to platform!', 'تم حفظ النسخة المطورة مباشرة على المنصة!'));
            await loadDbRecords(t);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : tx('Failed to save to platform', 'فشل الحفظ على المنصة'));
        } finally {
            setIsSavingToDb(false);
        }
    };

    const filteredDbOptions = useMemo(() => {
        const q = dbSearch.trim().toLowerCase();
        if (!q) return dbOptions;
        return dbOptions.filter(o => o.label.toLowerCase().includes(q) || (o.sublabel || '').toLowerCase().includes(q));
    }, [dbOptions, dbSearch]);

    const visibleItems = useMemo(() => {
        if (!diffModel) return [];
        if (itemFilter === 'changed') {
            return diffModel.items.filter(item => item.status !== 'unchanged');
        }
        return diffModel.items;
    }, [diffModel, itemFilter]);

    // Theme Tokens (Noir Studio Dark vs Neo-Brutalist Bento — zero purple, zero gradients)
    const cardCls = isBento
        ? 'bg-white text-black border-2 border-black shadow-[4px_4px_0px_#000] rounded-2xl'
        : 'bg-[#141210] text-[#f5f3ec] border border-[#2e2924] rounded-2xl';
    const subCardCls = isBento
        ? 'bg-[#faf8f2] text-black border-2 border-black rounded-xl'
        : 'bg-[#1a1714] text-[#f5f3ec] border border-[#2e2924] rounded-xl';
    const inputCls = isBento
        ? 'bg-white text-black border-2 border-black rounded-xl focus:outline-none focus:bg-[#fef9c3]'
        : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] rounded-xl focus:outline-none focus:border-[#bef264] placeholder:text-[#78716c]';

    const renderItemCardBody = (itemData: Record<string, unknown> | null, type: JsonStudioContentType, side: 'old' | 'new') => {
        if (!itemData) {
            return (
                <div className={`p-4 rounded-xl border border-dashed text-xs font-bold italic text-center ${
                    isBento ? 'border-black/30 text-black/50 bg-[#faf8f2]' : 'border-[#2e2924] text-[#78716c] bg-[#0e0d0b]'
                }`}>
                    {side === 'old'
                        ? tx('Not present in original JSON (New addition)', 'غير موجود في النسخة القديمة (إضافة جديدة)')
                        : tx('Removed in AI upgrade', 'تم حذفه في النسخة الجديدة')}
                </div>
            );
        }

        if (type === 'presentation') {
            const bullets = Array.isArray(itemData.bullets) ? itemData.bullets : [];
            const codeObj = isRecord(itemData.codeSnippet) ? itemData.codeSnippet : null;
            const checkup = isRecord(itemData.checkupQuestion) ? itemData.checkupQuestion : null;
            return (
                <div className="space-y-2.5 text-xs">
                    <div className="flex flex-wrap gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] ${
                            isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-[#111c22] text-[#bae6fd] border border-[#bae6fd]/35'
                        }`}>
                            {String(itemData.layout || 'bullets')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                            isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/35'
                        }`}>
                            {String(itemData.motion || 'fade-up')}
                        </span>
                        {Boolean(itemData.visualBlock) && (
                            <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] ${
                                isBento ? 'bg-[#dcfce7] text-black border border-black' : 'bg-[#192211] text-[#bef264] border border-[#bef264]/35'
                            }`}>
                                Interactive visualBlock
                            </span>
                        )}
                    </div>
                    <div className="text-sm font-black leading-snug">{String(itemData.title || '')}</div>
                    {Boolean(itemData.subtitle) && <div className="text-[11px] font-bold opacity-75">{String(itemData.subtitle)}</div>}
                    {Boolean(itemData.body) && <p className="leading-relaxed opacity-90">{String(itemData.body)}</p>}
                    {bullets.length > 0 && (
                        <ul className="space-y-1 ps-4 list-disc">
                            {bullets.map((b, i) => (
                                <li key={i} className="font-medium leading-snug">{String(b)}</li>
                            ))}
                        </ul>
                    )}
                    {codeObj && Boolean(codeObj.code) && (
                        <pre className={`p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto ${
                            isBento ? 'bg-black text-[#bef264]' : 'bg-[#0a0908] border border-[#2e2924] text-[#bef264]'
                        }`}>
                            <code>{String(codeObj.code)}</code>
                        </pre>
                    )}
                    {checkup && (
                        <div className={`p-2.5 rounded-lg space-y-1 ${
                            isBento ? 'bg-[#fef9c3] border border-black' : 'bg-[#111c22] border border-[#bae6fd]/30'
                        }`}>
                            <div className="font-black text-[11px]">Check-Up: {String(checkup.question || '')}</div>
                            {Array.isArray(checkup.options) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                                    {checkup.options.map((opt, oi) => (
                                        <div key={oi} className={oi === checkup.correctAnswer ? 'font-black underline' : 'opacity-80'}>
                                            {String.fromCharCode(65 + oi)}. {String(opt)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {Boolean(itemData.callout) && (
                        <div className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                            isBento ? 'bg-[#dcfce7] border border-black' : 'bg-[#192211] text-[#bef264] border border-[#bef264]/30'
                        }`}>
                            Callout: {String(itemData.callout)}
                        </div>
                    )}
                    {Boolean(itemData.speakerNotes) && (
                        <div className="text-[11px] opacity-70 italic">Speaker notes: {String(itemData.speakerNotes)}</div>
                    )}
                </div>
            );
        }

        if (type === 'roadmap') {
            return (
                <div className="space-y-2 text-xs">
                    <div className="flex flex-wrap gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] ${
                            isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-[#111c22] text-[#bae6fd] border border-[#bae6fd]/35'
                        }`}>
                            {String(itemData.type || 'core')}
                        </span>
                        <span className="font-bold opacity-80">ID: {String(itemData.moduleId || '')}</span>
                        <span className="font-bold opacity-80">{Number(itemData.xpReward || 0)} XP · {Number(itemData.coinsReward || 0)} Coins</span>
                    </div>
                    <div className="text-sm font-black">{String(itemData.title || '')}</div>
                    {Boolean(itemData.description) && <p className="opacity-85 leading-relaxed">{String(itemData.description)}</p>}
                    {Array.isArray(itemData.prerequisites) && itemData.prerequisites.length > 0 && (
                        <div className="text-[11px] opacity-75">Prereqs: {itemData.prerequisites.map(String).join(', ')}</div>
                    )}
                </div>
            );
        }

        if (type === 'badges') {
            return (
                <div className="space-y-2 text-xs">
                    <div className="flex flex-wrap gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] ${
                            isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/35'
                        }`}>
                            {String(itemData.rarity || 'common')}
                        </span>
                        <span className="font-bold opacity-75">{String(itemData.category || '')}</span>
                        <span className="font-mono text-[11px] opacity-70">{String(itemData.badgeId || '')}</span>
                    </div>
                    <div className="text-sm font-black">{String(itemData.title || itemData.name || '')}</div>
                    {Boolean(itemData.description) && <p className="opacity-85 leading-relaxed">{String(itemData.description)}</p>}
                </div>
            );
        }

        if (type === 'compiler-questions') {
            const hints = Array.isArray(itemData.hints) ? itemData.hints : [];
            return (
                <div className="space-y-2 text-xs">
                    <div className="flex flex-wrap gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] ${
                            isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-[#111c22] text-[#bae6fd] border border-[#bae6fd]/35'
                        }`}>
                            {String(itemData.language || 'javascript')}
                        </span>
                        <span className="font-bold uppercase text-[10px] opacity-80">{String(itemData.difficulty || 'medium')}</span>
                    </div>
                    <div className="text-sm font-black">{String(itemData.title || '')}</div>
                    {Boolean(itemData.description) && (
                        <pre className="whitespace-pre-wrap font-sans text-xs opacity-90 leading-relaxed">{String(itemData.description)}</pre>
                    )}
                    {Boolean(itemData.referenceCode) && (
                        <pre className={`p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto ${
                            isBento ? 'bg-black text-[#bef264]' : 'bg-[#0a0908] border border-[#2e2924] text-[#bef264]'
                        }`}>
                            <code>{String(itemData.referenceCode)}</code>
                        </pre>
                    )}
                    {hints.length > 0 && (
                        <div className="text-[11px] opacity-80">Hints ({hints.length}): {hints.map(String).join(' · ')}</div>
                    )}
                </div>
            );
        }

        // Quiz / Question Pool / Tournament Questions
        const qText = String(itemData.question || itemData.text || '');
        const options = Array.isArray(itemData.options) ? itemData.options : [];
        const ordering = Array.isArray(itemData.orderingItems) ? itemData.orderingItems : [];
        const matching = Array.isArray(itemData.matchingPairs) ? itemData.matchingPairs : [];
        const compilerCfg = isRecord(itemData.compilerConfig) ? itemData.compilerConfig : null;
        return (
            <div className="space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] ${
                        isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-[#111c22] text-[#bae6fd] border border-[#bae6fd]/35'
                    }`}>
                        {itemData.isCompiler ? 'compiler' : String(itemData.type || 'multiple-choice')}
                    </span>
                    <span className="font-bold opacity-75">ID: {String(itemData.id ?? 'auto')} · {Number(itemData.points || 10)} pts</span>
                    {Boolean(itemData.isCompiler) && (
                        <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] ${
                            isBento ? 'bg-[#dcfce7] text-black border border-black' : 'bg-[#192211] text-[#bef264] border border-[#bef264]/35'
                        }`}>
                            Monaco Editor
                        </span>
                    )}
                </div>

                <div className="text-sm font-extrabold leading-snug">
                    <MathRenderer text={qText} />
                </div>

                {Boolean(itemData.codeSnippet) && (
                    <pre className={`p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto ${
                        isBento ? 'bg-black text-[#bef264]' : 'bg-[#0a0908] border border-[#2e2924] text-[#bef264]'
                    }`}>
                        <code>{String(itemData.codeSnippet)}</code>
                    </pre>
                )}

                {options.length > 0 && (
                    <div className="space-y-1">
                        {options.map((opt, oi) => {
                            const isCorrect = itemData.correctAnswer === oi || String(itemData.correctAnswer) === String(opt);
                            return (
                                <div
                                    key={oi}
                                    className={`px-2.5 py-1.5 rounded-lg flex items-center gap-2 ${
                                        isCorrect
                                            ? isBento
                                                ? 'bg-[#dcfce7] border border-black font-black'
                                                : 'bg-[#192211] border border-[#bef264]/50 text-[#bef264] font-bold'
                                            : isBento
                                                ? 'bg-white border border-black/20'
                                                : 'bg-[#0e0d0b] border border-[#2e2924]'
                                    }`}
                                >
                                    <span className="font-black text-[10px] shrink-0">{String.fromCharCode(65 + oi)}.</span>
                                    <MathRenderer text={String(opt)} className="flex-1 text-xs" />
                                </div>
                            );
                        })}
                    </div>
                )}

                {itemData.type === 'text' && itemData.correctAnswer !== undefined && (
                    <div className={`px-2.5 py-1.5 rounded-lg font-bold ${
                        isBento ? 'bg-[#dcfce7] border border-black' : 'bg-[#192211] border border-[#bef264]/45 text-[#bef264]'
                    }`}>
                        Accepted: {Array.isArray(itemData.correctAnswer) ? itemData.correctAnswer.map(String).join(' | ') : String(itemData.correctAnswer)}
                    </div>
                )}

                {ordering.length > 0 && (
                    <ol className="ps-4 list-decimal space-y-1 font-medium">
                        {ordering.map((it, idx) => <li key={idx}>{String(it)}</li>)}
                    </ol>
                )}

                {matching.length > 0 && (
                    <div className="grid grid-cols-1 gap-1">
                        {matching.map((p, idx) => isRecord(p) && (
                            <div key={idx} className={`px-2 py-1 rounded flex justify-between gap-2 ${isBento ? 'bg-white border border-black/20' : 'bg-[#0e0d0b] border border-[#2e2924]'}`}>
                                <span className="font-bold">{String(p.left || '')}</span>
                                <span className="opacity-60">→</span>
                                <span>{String(p.right || '')}</span>
                            </div>
                        ))}
                    </div>
                )}

                {compilerCfg && Boolean(compilerCfg.referenceCode) && (
                    <pre className={`p-2 rounded-lg font-mono text-[11px] overflow-x-auto ${
                        isBento ? 'bg-black text-[#bef264]' : 'bg-[#0a0908] border border-[#2e2924] text-[#bef264]'
                    }`}>
                        <code>{String(compilerCfg.referenceCode)}</code>
                    </pre>
                )}

                {Boolean(itemData.explanation) && (
                    <div className={`p-2 rounded-lg text-[11px] leading-relaxed ${
                        isBento ? 'bg-[#fef9c3] border border-black/30' : 'bg-[#0e0d0b] border border-[#2e2924] text-[#d6d0c7]'
                    }`}>
                        <span className="font-black uppercase text-[10px] me-1 opacity-75">Explanation:</span>
                        <MathRenderer text={String(itemData.explanation)} className="inline" />
                    </div>
                )}
            </div>
        );
    };

    const toggleItemDecision = (item: ItemDiffEntry, choice: 'old' | 'new' | 'drop') => {
        setMergeDecisions(prev => ({
            ...prev,
            itemChoices: {
                ...prev.itemChoices,
                [item.key]: choice
            }
        }));
    };

    return (
        <div className={`min-h-screen flex flex-col font-sans relative transition-colors ${
            isBento ? 'bg-[#f5f3ec] text-black' : 'bg-[#0a0908] text-[#f5f3ec]'
        }`}>
            <AmbientBackground />

            {/* Sticky Top Header */}
            <header className={`sticky top-0 z-40 px-3 sm:px-6 py-3 ${
                isBento
                    ? 'bg-white border-b-[2.5px] border-black'
                    : 'bg-[#141210]/95 backdrop-blur-md border-b border-[#2e2924]'
            }`}>
                <div className="max-w-[1600px] mx-auto flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <button
                                type="button"
                                onClick={() => navigateBackSafely(navigate, isAdmin ? '/admin' : '/')}
                                className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047]'
                                        : 'bg-[#1c1917] text-[#f5f3ec] border border-[#2e2924] hover:border-[#bef264]'
                                }`}
                                aria-label={tx('Go back', 'رجوع')}
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    isBento
                                        ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#192211] text-[#bef264] border border-[#bef264]/45'
                                }`}>
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-sm sm:text-lg font-black tracking-tight truncate">
                                        {tx('AI JSON Refiner Studio', 'استوديو تحسين JSON بالذكاء الاصطناعي')}
                                    </h1>
                                    <p className={`text-[11px] truncate hidden sm:block ${isBento ? 'text-black/65 font-semibold' : 'text-[#a8a29e]'}`}>
                                        {tx('Audit schemas, preserve what must remain, and compare Old vs. New side-by-side', 'راجع وصلّح وطوّر ملفات JSON مع الحفاظ على طلباتك ومقارنة القديم بالجديد')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={openThemeModal}
                                className={`h-9 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 text-xs font-black cursor-pointer transition-all whitespace-nowrap ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#bae6fd]'
                                        : 'bg-[#1c1917] text-[#f5f3ec] border border-[#2e2924] hover:border-[#bef264]'
                                }`}
                                title={tx('Switch Platform Theme', 'تغيير ثيم المنصة')}
                            >
                                <Palette className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                <span className="hidden sm:inline">{theme === 'bento' ? tx('Bento', 'بينتو') : tx('Noir', 'نوار')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Content Type Selector Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                        {CONTENT_TYPES.map(ct => {
                            const active = contentType === ct.id;
                            return (
                                <button
                                    key={ct.id}
                                    type="button"
                                    onClick={() => handleSelectType(ct.id)}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                                        active
                                            ? isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#bef264] text-[#0a0908]'
                                            : isBento
                                                ? 'bg-[#faf8f2] text-black/75 border border-black/30 hover:bg-[#fef9c3]'
                                                : 'bg-[#1a1714] text-[#a8a29e] border border-[#2e2924] hover:text-[#f5f3ec]'
                                    }`}
                                >
                                    {tx(ct.label, ct.arLabel)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            <main className="flex-1 relative z-10 w-full max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 space-y-5">
                {/* Stage 1 Collapse Toggle when results are open */}
                {refineResult && (
                    <div className={`p-3 flex flex-wrap items-center justify-between gap-2 ${cardCls}`}>
                        <div className="flex items-center gap-2 min-w-0">
                            <Lock className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                            <span className="text-xs font-black uppercase tracking-wider truncate">
                                {loadedDbMeta ? `${loadedDbMeta.label} (${refineResult.detectedType})` : tx(`Source Input & Guardrails (${refineResult.detectedType})`, `إعدادات المصدر والقواعد (${refineResult.detectedType})`)}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setConfigCollapsed(c => !c)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                                isBento
                                    ? 'bg-[#faf8f2] text-black border-2 border-black hover:bg-[#fef9c3]'
                                    : 'bg-[#1c1917] text-[#f5f3ec] border border-[#2e2924] hover:border-[#bef264]'
                            }`}
                        >
                            <span>{configCollapsed ? tx('Edit Input / Constraints', 'تعديل المدخلات والشروط') : tx('Hide Setup', 'إخفاء الإعدادات')}</span>
                            {configCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                )}

                {/* STAGE 1: Source Loader + What Must Remain Controls */}
                {!configCollapsed && (
                    <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
                        {/* Left Column: Existing JSON Input */}
                        <div className={`lg:col-span-6 p-4 sm:p-5 flex flex-col gap-3.5 ${cardCls}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Database className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} />
                                    <h2 className="text-sm font-black uppercase tracking-wider">
                                        {tx('1. Existing JSON Source', '1. ملف JSON الحالي')}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => void handleLoadSample()}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                                            isBento
                                                ? 'bg-[#bae6fd] text-black border border-black hover:bg-[#7dd3fc]'
                                                : 'bg-[#111c22] text-[#bae6fd] border border-[#bae6fd]/35 hover:border-[#bae6fd]'
                                        }`}
                                    >
                                        {tx('Load Sample', 'تحميل نموذج')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleFormatEditor}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                                            isBento
                                                ? 'bg-white text-black border border-black hover:bg-[#fef9c3]'
                                                : 'bg-[#1a1714] text-[#f5f3ec] border border-[#2e2924]'
                                        }`}
                                    >
                                        {tx('Format', 'تنسيق')}
                                    </button>
                                </div>
                            </div>

                            {/* Source Mode Switch */}
                            <div className="grid grid-cols-3 gap-1.5">
                                {([
                                    { id: 'db' as const, label: tx('Platform DB', 'من المنصة'), icon: Database },
                                    { id: 'upload' as const, label: tx('Upload .json', 'رفع ملف'), icon: Upload },
                                    { id: 'paste' as const, label: tx('Paste Raw', 'لصق مباشر'), icon: Braces }
                                ]).map(m => {
                                    const Icon = m.icon;
                                    const active = sourceTab === m.id;
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => {
                                                setSourceTab(m.id);
                                                if (m.id === 'upload') fileInputRef.current?.click();
                                            }}
                                            className={`py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                                active
                                                    ? isBento
                                                        ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : 'bg-[#bef264] text-[#0a0908]'
                                                    : isBento
                                                        ? 'bg-[#faf8f2] text-black border border-black/30 hover:bg-white'
                                                        : 'bg-[#1a1714] text-[#a8a29e] border border-[#2e2924] hover:text-[#f5f3ec]'
                                            }`}
                                        >
                                            <Icon className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">{m.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,application/json"
                                className="hidden"
                                onChange={(e) => void handleUploadJsonFile(e)}
                            />

                            {/* DB Selector Panel */}
                            {sourceTab === 'db' && (
                                <div className={`p-3 space-y-2 ${subCardCls}`}>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={dbSearch}
                                            onChange={(e) => setDbSearch(e.target.value)}
                                            placeholder={tx(`Search saved ${contentType} records...`, 'ابحث في المحفوظ على المنصة...')}
                                            className={`flex-1 px-3 py-1.5 text-xs font-medium ${inputCls}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void loadDbRecords(contentType)}
                                            className={`p-1.5 rounded-lg cursor-pointer ${
                                                isBento ? 'border border-black bg-white' : 'border border-[#2e2924] bg-[#141210]'
                                            }`}
                                            title={tx('Refresh records', 'تحديث القائمة')}
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${loadingDb ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>

                                    {!isAdmin && contentType === 'compiler-questions' ? (
                                        <p className="text-[11px] font-bold text-amber-500">
                                            {tx('Admin access required to browse compiler bank from DB. You can still upload or paste JSON.', 'تحتاج صلاحية أدمن لتحميل بنك التحديات، أو الصق JSON مباشرة.')}
                                        </p>
                                    ) : (
                                        <select
                                            value={selectedDbId}
                                            onChange={(e) => handleLoadSelectedDb(e.target.value)}
                                            className={`w-full px-3 py-2 text-xs font-bold cursor-pointer ${inputCls}`}
                                        >
                                            <option value="">
                                                {loadingDb
                                                    ? tx('Loading platform records...', 'جاري التحميل...')
                                                    : filteredDbOptions.length === 0
                                                        ? tx('No records found for this type', 'لا توجد عناصر لهذا النوع')
                                                        : tx(`-- Choose a ${contentType} (${filteredDbOptions.length}) --`, `-- اختر عنصر (${filteredDbOptions.length}) --`)}
                                            </option>
                                            {filteredDbOptions.map(opt => (
                                                <option key={opt.id} value={opt.id}>
                                                    {opt.label}{opt.sublabel ? ` (${opt.sublabel})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            {sourceTab === 'upload' && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`p-4 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 text-xs font-black cursor-pointer ${
                                        isBento ? 'border-black bg-[#faf8f2] hover:bg-[#fef9c3]' : 'border-[#2e2924] bg-[#0e0d0b] hover:border-[#bef264]'
                                    }`}
                                >
                                    <Upload className="w-4 h-4" />
                                    <span>{tx('Click to choose a .json file from your computer', 'اضغط لاختيار ملف .json من جهازك')}</span>
                                </button>
                            )}

                            {/* Editable JSON Editor */}
                            <div className="flex-1 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-[11px] font-bold">
                                    <span className={isBento ? 'text-black/70' : 'text-[#a8a29e]'}>
                                        {tx('JSON Source Editor', 'محرر كود JSON')}
                                    </span>
                                    {rawJsonText.trim() ? (
                                        parsedEditor.ok ? (
                                            <span className={`px-2 py-0.5 rounded-md font-black ${
                                                isBento ? 'bg-[#dcfce7] text-black border border-black' : 'bg-[#192211] text-[#bef264] border border-[#bef264]/35'
                                            }`}>
                                                Valid JSON · {(rawJsonText.length / 1024).toFixed(1)} KB
                                            </span>
                                        ) : (
                                            <span className={`px-2 py-0.5 rounded-md font-black ${
                                                isBento ? 'bg-[#fecdd3] text-black border border-red-600' : 'bg-[#2a1418] text-[#fb7185] border border-[#fb7185]/45'
                                            }`}>
                                                {tx('Syntax error detected (AI can inspect)', 'خطأ صيغة')}
                                            </span>
                                        )
                                    ) : null}
                                </div>
                                <textarea
                                    value={rawJsonText}
                                    onChange={(e) => setRawJsonText(e.target.value)}
                                    rows={12}
                                    spellCheck={false}
                                    placeholder={tx('Select a saved record above, upload a .json file, or paste your existing JSON here...', 'اختر من المنصة فوق أو ارفع ملف أو الصق كود JSON هنا...')}
                                    className={`w-full p-3 font-mono text-xs leading-relaxed resize-y min-h-[260px] ${inputCls}`}
                                />
                            </div>
                        </div>

                        {/* Right Column: What Must Remain + Upgrade Configuration */}
                        <div className={`lg:col-span-6 p-4 sm:p-5 flex flex-col justify-between gap-4 ${cardCls}`}>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                    <h2 className="text-sm font-black uppercase tracking-wider">
                                        {tx('2. What Must Remain & AI Rules', '2. ماذا يجب أن يبقى بدون تغيير + التطوير')}
                                    </h2>
                                </div>

                                {/* Guardrail Chips */}
                                <div className="space-y-2">
                                    <div className={`text-[11px] font-black uppercase tracking-wider ${isBento ? 'text-black/70' : 'text-[#a8a29e]'}`}>
                                        {tx('Preservation & Upgrade Switches', 'خيارات الحفاظ والتطوير')}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {([
                                            { key: 'keepIds' as const, label: tx('Keep Original IDs', 'حافظ على الـ IDs'), kind: 'keep' },
                                            { key: 'keepCorrectAnswers' as const, label: tx('Keep Correct Answers', 'حافظ على الإجابات الصح'), kind: 'keep' },
                                            { key: 'keepLanguage' as const, label: tx('Keep Exact Language', 'حافظ على اللغة'), kind: 'keep' },
                                            { key: 'keepItemCount' as const, label: tx('Keep Exact Item Count', 'نفس عدد العناصر'), kind: 'keep' },
                                            { key: 'fixSchemaAndMarkdown' as const, label: tx('Fix Schema & Raw Markdown', 'صلّح السكيما والماركداون'), kind: 'upgrade' },
                                            { key: 'upgradeFeatures' as const, label: tx('Upgrade Platform Features', 'استغل مميزات المنصة'), kind: 'upgrade' },
                                            { key: 'deepenExplanations' as const, label: tx('Deepen Explanations & Hints', 'حسّن الشرح والتلميحات'), kind: 'upgrade' }
                                        ]).map(flag => {
                                            const on = preserveFlags[flag.key];
                                            return (
                                                <button
                                                    key={flag.key}
                                                    type="button"
                                                    aria-pressed={on}
                                                    onClick={() => setPreserveFlags(prev => ({ ...prev, [flag.key]: !prev[flag.key] }))}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                                                        on
                                                            ? flag.kind === 'keep'
                                                                ? isBento
                                                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                    : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]'
                                                                : isBento
                                                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                    : 'bg-[#192211] text-[#bef264] border border-[#bef264]'
                                                            : isBento
                                                                ? 'bg-white text-black/60 border border-black/30 hover:bg-[#faf8f2]'
                                                                : 'bg-[#1a1714] text-[#78716c] border border-[#2e2924] hover:text-[#f5f3ec]'
                                                    }`}
                                                >
                                                    {on ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 opacity-50" />}
                                                    <span>{flag.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Explicit "What Must Remain Untouched" */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black flex items-center gap-1.5">
                                        <Lock className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                                        <span>{tx('What MUST Remain Untouched (Your Rules)', 'إيه اللي لازم يفضل زي ما هو بالظبط؟ (أوامر إلزامية للـ AI)')}</span>
                                    </label>
                                    <textarea
                                        value={keepInstructions}
                                        onChange={(e) => setKeepInstructions(e.target.value)}
                                        rows={3}
                                        placeholder={tx('e.g. Keep Q1-Q3 exact titles and Arabic terms, keep passingScore 70, keep current theme "bento", do NOT change code snippets in Q4...', 'مثال: متغيرش صياغة أول 3 أسئلة، سيب درجة النجاح 70، حافظ على المصطلحات الإنجليزية جوا العربي...')}
                                        className={`w-full p-3 text-xs font-medium leading-relaxed ${inputCls}`}
                                    />
                                </div>

                                {/* Custom Upgrade Goals */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black flex items-center gap-1.5">
                                        <Wand2 className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                        <span>{tx('Extra Improvements Wanted (Optional)', 'تطويرات إضافية مطلوبة (اختياري)')}</span>
                                    </label>
                                    <textarea
                                        value={upgradeGoals}
                                        onChange={(e) => setUpgradeGoals(e.target.value)}
                                        rows={2}
                                        placeholder={tx('e.g. Convert two MCQs into a matching and a compiler challenge, make distractors harder, add wireframe visualBlock...', 'مثال: حوّل سؤالين لتوصيل وكتابة كود، صعب الاختيارات الغلط، ضيف شريحة تفاعلية...')}
                                        className={`w-full p-3 text-xs font-medium leading-relaxed ${inputCls}`}
                                    />
                                </div>

                                {/* Optional Slide / PDF Reference Context */}
                                <div className={`p-3 ${subCardCls}`}>
                                    <button
                                        type="button"
                                        onClick={() => setShowContextDrawer(d => !d)}
                                        className="w-full flex items-center justify-between text-xs font-black cursor-pointer"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Paperclip className="w-3.5 h-3.5" />
                                            <span>{tx('Optional Reference Slides / PDF / Notes', 'إرفاق سلايدز أو ملف المادة المرجعي (اختياري)')}</span>
                                            {sourceFile && (
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] ${
                                                    isBento ? 'bg-[#bef264] border border-black' : 'bg-[#192211] text-[#bef264]'
                                                }`}>
                                                    {sourceFile.name}
                                                </span>
                                            )}
                                        </span>
                                        {showContextDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>

                                    {showContextDrawer && (
                                        <div className="mt-3 space-y-2.5">
                                            <textarea
                                                value={sourceContext}
                                                onChange={(e) => setSourceContext(e.target.value)}
                                                rows={3}
                                                placeholder={tx('Paste slide text, syllabus outcomes, or code notes so AI grounds upgrades directly in your material...', 'الصق نص السلايدز أو الدرس عشان التطوير يطابق المحتوى...')}
                                                className={`w-full p-2.5 text-xs ${inputCls}`}
                                            />
                                            <div className="flex flex-wrap items-center gap-2">
                                                <input
                                                    ref={contextFileRef}
                                                    type="file"
                                                    accept=".pdf,.pptx,.txt,.md"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0] || null;
                                                        setSourceFile(f);
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => contextFileRef.current?.click()}
                                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer ${
                                                        isBento ? 'bg-white border border-black' : 'bg-[#141210] border border-[#2e2924]'
                                                    }`}
                                                >
                                                    <Upload className="w-3.5 h-3.5" />
                                                    <span>{sourceFile ? tx('Change File', 'تغيير الملف') : tx('Attach PDF / PPTX / TXT / MD', 'إرفاق PDF / PPTX / TXT / MD')}</span>
                                                </button>
                                                {sourceFile && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSourceFile(null)}
                                                        className="text-[11px] font-bold text-rose-500 cursor-pointer hover:underline"
                                                    >
                                                        {tx('Remove file', 'حذف الملف')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => void handleAnalyzeAndUpgrade()}
                                disabled={isRefining || !rawJsonText.trim()}
                                className={`w-full py-3.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-45 ${
                                    isBento
                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[4px_4px_0px_#000] active:translate-y-0.5'
                                        : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_4px_0_#050504]'
                                }`}
                            >
                                {isRefining ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>{tx('Auditing & Upgrading JSON with AI...', 'جاري المراجعة والتطوير بالذكاء الاصطناعي...')}</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        <span>{tx('Analyze & Upgrade with AI', 'تحليل وتطوير بالذكاء الاصطناعي')}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </section>
                )}

                {/* STAGE 2: SPLIT-SCREEN OLD VS NEW COMPARISON */}
                {refineResult && diffModel && (
                    <section className="space-y-4">
                        {/* Summary + Audit Issues + View Switcher Strip */}
                        <div className={`p-4 sm:p-5 space-y-4 ${cardCls}`}>
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                            isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-[#192211] text-[#bef264] border border-[#bef264]/45'
                                        }`}>
                                            {refineResult.detectedType}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                            isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-[#111c22] text-[#bae6fd] border border-[#bae6fd]/40'
                                        }`}>
                                            Model: {refineResult.model}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowAuditList(s => !s)}
                                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                                                refineResult.auditIssues.length > 0
                                                    ? isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/45'
                                                    : isBento ? 'bg-[#dcfce7] text-black border border-black' : 'bg-[#192211] text-[#bef264]'
                                            }`}
                                        >
                                            {refineResult.auditIssues.length} {tx('Pre-Audit Findings', 'ملاحظات الفحص')}
                                        </button>
                                    </div>
                                    <p className="text-xs sm:text-sm font-bold leading-snug">{refineResult.summary}</p>
                                </div>

                                {/* View Switcher + Bulk Actions */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <div className={`p-1 rounded-xl flex items-center gap-1 ${
                                        isBento ? 'bg-[#faf8f2] border-2 border-black' : 'bg-[#0e0d0b] border border-[#2e2924]'
                                    }`}>
                                        {([
                                            { id: 'visual' as const, label: tx('Visual Split', 'مقارنة مرئية'), icon: Columns2 },
                                            { id: 'code' as const, label: tx('Raw JSON Split', 'مقارنة الكود'), icon: Code2 },
                                            { id: 'merged' as const, label: tx('Merged Result', 'النتيجة المدمجة'), icon: Braces }
                                        ]).map(v => {
                                            const VIcon = v.icon;
                                            const active = resultView === v.id;
                                            return (
                                                <button
                                                    key={v.id}
                                                    type="button"
                                                    onClick={() => setResultView(v.id)}
                                                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                                                        active
                                                            ? isBento
                                                                ? 'bg-[#fde047] text-black border border-black shadow-[1px_1px_0px_#000]'
                                                                : 'bg-[#bef264] text-[#0a0908]'
                                                            : isBento
                                                                ? 'text-black/70 hover:bg-white'
                                                                : 'text-[#a8a29e] hover:text-[#f5f3ec]'
                                                    }`}
                                                >
                                                    <VIcon className="w-3.5 h-3.5" />
                                                    <span>{v.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleBulkDecision('new')}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer ${
                                            isBento
                                                ? 'bg-[#dcfce7] hover:bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#192211] hover:bg-[#253318] text-[#bef264] border border-[#bef264]/45'
                                        }`}
                                    >
                                        {tx('Use All New', 'اعتماد الكل جديد')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleBulkDecision('old')}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer ${
                                            isBento
                                                ? 'bg-[#fef9c3] hover:bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#231e0f] hover:bg-[#2e2713] text-[#fde047] border border-[#fde047]/45'
                                        }`}
                                    >
                                        {tx('Keep All Old', 'إبقاء الكل قديم')}
                                    </button>
                                </div>
                            </div>

                            {/* Improvements Applied Pills + Stats */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                                <div className="flex flex-wrap gap-1.5">
                                    {refineResult.improvements.map((imp, idx) => (
                                        <span
                                            key={idx}
                                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                                                isBento ? 'bg-[#dcfce7] text-black border border-black/40' : 'bg-[#1a1714] text-[#d6d0c7] border border-[#2e2924]'
                                            }`}
                                        >
                                            <Lightbulb className={`w-3 h-3 shrink-0 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                            <span>{imp}</span>
                                        </span>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2 text-[11px] font-black shrink-0">
                                    <span className={isBento ? 'text-black' : 'text-[#bef264]'}>{decisionStats.newCount} {tx('New', 'جديد')}</span>
                                    <span>·</span>
                                    <span className={isBento ? 'text-black' : 'text-[#fde047]'}>{decisionStats.oldCount} {tx('Kept Old', 'قديم محفوظ')}</span>
                                    {decisionStats.droppedCount > 0 && (
                                        <>
                                            <span>·</span>
                                            <span className="text-rose-500">{decisionStats.droppedCount} {tx('Skipped', 'محذوف')}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Expandable Audit Findings */}
                            {showAuditList && refineResult.auditIssues.length > 0 && (
                                <div className={`p-3 space-y-1.5 max-h-48 overflow-y-auto ${subCardCls}`}>
                                    {refineResult.auditIssues.map((iss, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                            {iss.severity === 'error' ? (
                                                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                            ) : iss.severity === 'warning' ? (
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                            ) : (
                                                <Lightbulb className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                                            )}
                                            <span className="font-mono text-[11px] font-black opacity-75 shrink-0">{iss.path}:</span>
                                            <span className="font-medium">{iss.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* VIEW 1: VISUAL SPLIT-SCREEN OLD VS NEW COMPARISON */}
                        {resultView === 'visual' && (
                            <div className="space-y-4">
                                {/* Metadata Split Card */}
                                <div className={`p-4 space-y-3 ${cardCls}`}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <FileText className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} />
                                            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                                                {tx('Metadata & Top-Level Settings', 'الإعدادات الأساسية للملف')}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setMergeDecisions(prev => ({ ...prev, metadataChoice: 'old' }))}
                                                className={`px-3 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                                                    mergeDecisions.metadataChoice === 'old'
                                                        ? isBento
                                                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                            : 'bg-[#fde047] text-[#0a0908]'
                                                        : isBento
                                                            ? 'bg-white text-black border border-black/40'
                                                            : 'bg-[#1a1714] text-[#a8a29e] border border-[#2e2924]'
                                                }`}
                                            >
                                                {tx('Keep Old Metadata', 'إبقاء القديم')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMergeDecisions(prev => ({ ...prev, metadataChoice: 'new' }))}
                                                className={`px-3 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                                                    mergeDecisions.metadataChoice === 'new'
                                                        ? isBento
                                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                            : 'bg-[#bef264] text-[#0a0908]'
                                                        : isBento
                                                            ? 'bg-white text-black border border-black/40'
                                                            : 'bg-[#1a1714] text-[#a8a29e] border border-[#2e2924]'
                                                }`}
                                            >
                                                {tx('Use New Metadata', 'اعتماد الجديد')}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                        <div className={`p-3 space-y-1.5 transition-opacity ${
                                            mergeDecisions.metadataChoice === 'old' ? 'opacity-100 ring-2 ring-[#fde047]' : 'opacity-65'
                                        } ${subCardCls}`}>
                                            <div className="text-[10px] font-black uppercase tracking-wider opacity-70">{tx('OLD — ORIGINAL', 'القديم — الأصلي')}</div>
                                            {diffModel.metadataDiff.map(fd => (
                                                <div key={fd.key} className={`flex justify-between gap-2 text-xs px-2 py-1 rounded ${
                                                    fd.status !== 'same'
                                                        ? isBento ? 'bg-[#fecdd3]/60' : 'bg-[#2a1418]'
                                                        : ''
                                                }`}>
                                                    <span className="font-mono font-bold opacity-80 shrink-0">{fd.key}:</span>
                                                    <span className="truncate font-medium text-end">{fd.oldVal !== undefined ? (typeof fd.oldVal === 'object' ? JSON.stringify(fd.oldVal) : String(fd.oldVal)) : '—'}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className={`p-3 space-y-1.5 transition-opacity ${
                                            mergeDecisions.metadataChoice === 'new' ? 'opacity-100 ring-2 ring-[#bef264]' : 'opacity-65'
                                        } ${subCardCls}`}>
                                            <div className="text-[10px] font-black uppercase tracking-wider opacity-70">{tx('NEW — AI UPGRADED', 'الجديد — المطور بالـ AI')}</div>
                                            {diffModel.metadataDiff.map(fd => (
                                                <div key={fd.key} className={`flex justify-between gap-2 text-xs px-2 py-1 rounded ${
                                                    fd.status !== 'same'
                                                        ? isBento ? 'bg-[#dcfce7]' : 'bg-[#192211] text-[#bef264]'
                                                        : ''
                                                }`}>
                                                    <span className="font-mono font-bold opacity-80 shrink-0">{fd.key}:</span>
                                                    <span className="truncate font-medium text-end">{fd.newVal !== undefined ? (typeof fd.newVal === 'object' ? JSON.stringify(fd.newVal) : String(fd.newVal)) : '—'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Items Filter Strip */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                                        {diffModel.itemLabel}s ({visibleItems.length} / {diffModel.items.length})
                                    </h3>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setItemFilter('all')}
                                            className={`px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                                                itemFilter === 'all'
                                                    ? isBento ? 'bg-[#bef264] text-black border-2 border-black' : 'bg-[#bef264] text-[#0a0908]'
                                                    : isBento ? 'bg-white text-black border border-black/30' : 'bg-[#141210] text-[#a8a29e] border border-[#2e2924]'
                                            }`}
                                        >
                                            {tx('All Items', 'الكل')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setItemFilter('changed')}
                                            className={`px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                                                itemFilter === 'changed'
                                                    ? isBento ? 'bg-[#fde047] text-black border-2 border-black' : 'bg-[#fde047] text-[#0a0908]'
                                                    : isBento ? 'bg-white text-black border border-black/30' : 'bg-[#141210] text-[#a8a29e] border border-[#2e2924]'
                                            }`}
                                        >
                                            {tx('Changed / Added Only', 'المعدل والمضاف فقط')}
                                        </button>
                                    </div>
                                </div>

                                {/* Per-Item Split Comparison Rows */}
                                <div className="space-y-4">
                                    {visibleItems.map((item, idx) => {
                                        const choice = mergeDecisions.itemChoices[item.key] || (item.status === 'removed' ? 'drop' : 'new');
                                        const statusStyle =
                                            item.status === 'added'
                                                ? isBento ? 'bg-[#dcfce7] text-black border border-black' : 'bg-[#192211] text-[#bef264] border border-[#bef264]/40'
                                                : item.status === 'removed'
                                                    ? isBento ? 'bg-[#fecdd3] text-black border border-red-600' : 'bg-[#2a1418] text-[#fb7185] border border-[#fb7185]/45'
                                                    : item.status === 'modified'
                                                        ? isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/45'
                                                        : isBento ? 'bg-[#faf8f2] text-black border border-black/30' : 'bg-[#1a1714] text-[#a8a29e] border border-[#2e2924]';

                                        return (
                                            <div key={item.key} className={`p-4 space-y-3 ${cardCls}`}>
                                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-black/10 dark:border-white/10">
                                                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                        <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${
                                                            isBento ? 'bg-black text-white' : 'bg-[#1a1714] text-[#f5f3ec] border border-[#2e2924]'
                                                        }`}>
                                                            #{idx + 1}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${statusStyle}`}>
                                                            {item.status}
                                                        </span>
                                                        {item.changedFields.length > 0 && item.status === 'modified' && (
                                                            <span className="text-[11px] opacity-70 truncate">
                                                                Changed: {item.changedFields.slice(0, 4).join(', ')}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Keep Old vs Use New Toggle */}
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {item.oldItem && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleItemDecision(item, 'old')}
                                                                className={`px-3 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                                                                    choice === 'old'
                                                                        ? isBento
                                                                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                            : 'bg-[#fde047] text-[#0a0908]'
                                                                        : isBento
                                                                            ? 'bg-white text-black border border-black/35 hover:bg-[#fef9c3]'
                                                                            : 'bg-[#1a1714] text-[#a8a29e] border border-[#2e2924]'
                                                                }`}
                                                            >
                                                                {tx('Keep Old', 'إبقاء القديم')}
                                                            </button>
                                                        )}
                                                        {item.newItem && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleItemDecision(item, 'new')}
                                                                className={`px-3 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                                                                    choice === 'new'
                                                                        ? isBento
                                                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                            : 'bg-[#bef264] text-[#0a0908]'
                                                                        : isBento
                                                                            ? 'bg-white text-black border border-black/35 hover:bg-[#dcfce7]'
                                                                            : 'bg-[#1a1714] text-[#a8a29e] border border-[#2e2924]'
                                                                }`}
                                                            >
                                                                {item.status === 'added' ? tx('Include Added', 'إضافة الجديد') : tx('Use New', 'اعتماد الجديد')}
                                                            </button>
                                                        )}
                                                        {(!item.oldItem || !item.newItem) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleItemDecision(item, 'drop')}
                                                                className={`px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                                                                    choice === 'drop'
                                                                        ? isBento
                                                                            ? 'bg-[#fecdd3] text-black border-2 border-red-600'
                                                                            : 'bg-[#2a1418] text-[#fb7185] border border-[#fb7185]'
                                                                        : isBento
                                                                            ? 'bg-white text-black/60 border border-black/30'
                                                                            : 'bg-[#1a1714] text-[#78716c] border border-[#2e2924]'
                                                                }`}
                                                            >
                                                                {tx('Skip / Drop', 'استبعاد')}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* True Side-by-Side Split Cards */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
                                                    <div className={`p-3.5 transition-all flex flex-col gap-2 ${subCardCls} ${
                                                        choice === 'old' ? 'ring-2 ring-[#fde047] opacity-100' : 'opacity-65'
                                                    }`}>
                                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider opacity-70">
                                                            <span>{tx('OLD — ORIGINAL', 'القديم — الأصلي')}</span>
                                                            {choice === 'old' && <span className="px-1.5 py-0.5 rounded bg-[#fde047] text-black">{tx('SELECTED', 'مختار')}</span>}
                                                        </div>
                                                        {renderItemCardBody(item.oldItem, refineResult.detectedType, 'old')}
                                                    </div>

                                                    <div className={`p-3.5 transition-all flex flex-col gap-2 ${subCardCls} ${
                                                        choice === 'new' ? 'ring-2 ring-[#bef264] opacity-100' : 'opacity-65'
                                                    }`}>
                                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider opacity-70">
                                                            <span>{tx('NEW — AI UPGRADED', 'الجديد — المطور')}</span>
                                                            {choice === 'new' && <span className="px-1.5 py-0.5 rounded bg-[#bef264] text-[#0a0908]">{tx('SELECTED', 'مختار')}</span>}
                                                        </div>
                                                        {renderItemCardBody(item.newItem, refineResult.detectedType, 'new')}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* VIEW 2: SYNCHRONIZED RAW JSON SPLIT DIFF */}
                        {resultView === 'code' && (
                            <div className={`overflow-hidden ${cardCls}`}>
                                <div className="grid grid-cols-2 border-b border-black/15 dark:border-[#2e2924] text-xs font-black uppercase tracking-wider">
                                    <div className={`px-4 py-2.5 border-e border-black/15 dark:border-[#2e2924] ${isBento ? 'bg-[#fecdd3]/60' : 'bg-[#1a1714] text-[#fb7185]'}`}>
                                        {tx('OLD JSON (ORIGINAL)', 'الكود القديم')}
                                    </div>
                                    <div className={`px-4 py-2.5 ${isBento ? 'bg-[#dcfce7]' : 'bg-[#1a1714] text-[#bef264]'}`}>
                                        {tx('NEW JSON (AI UPGRADED)', 'الكود الجديد المطور')}
                                    </div>
                                </div>
                                <div className="max-h-[70vh] overflow-auto font-mono text-[11px] leading-5">
                                    {lineDiffRows.map((row, rIdx) => {
                                        const leftRowCls =
                                            row.type === 'removed' || row.type === 'changed'
                                                ? isBento ? 'bg-[#fecdd3]/60 text-black' : 'bg-[#2a1418] text-[#fda4af]'
                                                : '';
                                        const rightRowCls =
                                            row.type === 'added' || row.type === 'changed'
                                                ? isBento ? 'bg-[#dcfce7]/85 text-black' : 'bg-[#192211] text-[#bef264]'
                                                : '';
                                        return (
                                            <div key={rIdx} className="grid grid-cols-1 md:grid-cols-2 border-b border-black/5 dark:border-[#2e2924]/40">
                                                <div className={`flex gap-2 px-2.5 py-0.5 border-e border-black/10 dark:border-[#2e2924] overflow-x-auto ${leftRowCls}`}>
                                                    <span className="w-8 shrink-0 text-end select-none opacity-45">{row.leftNum ?? ''}</span>
                                                    <pre className="whitespace-pre">{row.leftText}</pre>
                                                </div>
                                                <div className={`flex gap-2 px-2.5 py-0.5 overflow-x-auto ${rightRowCls}`}>
                                                    <span className="w-8 shrink-0 text-end select-none opacity-45">{row.rightNum ?? ''}</span>
                                                    <pre className="whitespace-pre">{row.rightText}</pre>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* VIEW 3: FINAL MERGED JSON */}
                        {resultView === 'merged' && (
                            <div className={`p-4 space-y-2 ${cardCls}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-wider">
                                        {tx('Final Live-Merged JSON (Reflects Your Keep Old / Use New Choices)', 'النسخة النهائية المدمجة حسب اختياراتك')}
                                    </span>
                                    <span className="text-[11px] font-bold opacity-70">{(mergedPrettyText.length / 1024).toFixed(1)} KB</span>
                                </div>
                                <pre className={`p-4 rounded-xl font-mono text-xs overflow-auto max-h-[70vh] ${
                                    isBento ? 'bg-[#faf8f2] text-black border-2 border-black' : 'bg-[#0a0908] text-[#bef264] border border-[#2e2924]'
                                }`}>
                                    {mergedPrettyText}
                                </pre>
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* Sticky Bottom Merge / Save Action Bar */}
            {refineResult && (
                <footer className={`fixed bottom-0 inset-x-0 z-40 px-3 sm:px-6 py-3 ${
                    isBento
                        ? 'bg-white border-t-[2.5px] border-black'
                        : 'bg-[#141210]/95 backdrop-blur-md border-t border-[#2e2924]'
                }`}>
                    <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold hidden sm:block">
                            {loadedDbMeta
                                ? tx(`Target DB Record: "${loadedDbMeta.label}"`, `العنصر المحفوظ: "${loadedDbMeta.label}"`)
                                : tx('Ready to save or export your merged JSON', 'جاهز للحفظ على المنصة أو التحميل')}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                                type="button"
                                onClick={handleRefineAgain}
                                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fef9c3]'
                                        : 'bg-[#1c1917] text-[#f5f3ec] border border-[#2e2924] hover:border-[#bef264]'
                                }`}
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>{tx('Refine Again', 'تحسين تاني')}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => void handleCopyMerged()}
                                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                                    isBento
                                        ? 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#7dd3fc]'
                                        : 'bg-[#111c22] text-[#bae6fd] border border-[#bae6fd]/45'
                                }`}
                            >
                                {copiedMerged ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedMerged ? tx('Copied!', 'اتنسخ!') : tx('Copy Merged', 'نسخ')}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleDownloadMerged}
                                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                                    isBento
                                        ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#facc15]'
                                        : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/45'
                                }`}
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>{tx('Download .json', 'تحميل JSON')}</span>
                            </button>

                            {canDirectSaveToDb && (
                                <button
                                    type="button"
                                    onClick={() => void handleSaveToPlatform()}
                                    disabled={isSavingToDb}
                                    className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                        isBento
                                            ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                            : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                    }`}
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>
                                        {isSavingToDb
                                            ? tx('Saving...', 'جاري الحفظ...')
                                            : loadedDbMeta
                                                ? tx('Save Updates to DB', 'حفظ التعديلات في المنصة')
                                                : tx('Import to Platform', 'استيراد للمنصة')}
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
};

export default AiJsonStudioPage;
