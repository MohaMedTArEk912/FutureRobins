import React, { useState, useMemo } from 'react';
import {
    Compass,
    CheckCircle2,
    BookOpen,
    Award,
    ArrowLeft,
    Search,
    Play,
    Layers,
    EyeOff
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import {
    groupQuizzesForTrack,
    classifyQuizKind,
    type TrackAssessmentKind,
    type TrackQuizItem
} from '../../utils/trackQuizUtils';
import type { Quiz, SkillTrack } from '../../types';

const STANDALONE_TRACK_ID = '__standalone_quizzes__';
const ALL_QUIZZES_TRACK_ID = '__all_quizzes__';

interface ClassroomQuizPickerProps {
    skillTracks: SkillTrack[];
    quizzes: Quiz[];
    onLaunchQuiz: (quiz: Quiz) => void;
    compact?: boolean;
}

const CATEGORY_TABS: {
    id: TrackAssessmentKind;
    label: string;
    singularLabel: string;
    emptyLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    bentoActiveBg: string;
    bentoBadgeBg: string;
}[] = [
    {
        id: 'quiz',
        label: 'Session Quizzes',
        singularLabel: 'Session Quiz',
        emptyLabel: 'No session quizzes in this track yet.',
        icon: CheckCircle2,
        bentoActiveBg: 'bg-[#bef264]',
        bentoBadgeBg: 'bg-[#d9f99d] text-black border border-black'
    },
    {
        id: 'homework',
        label: 'Homework',
        singularLabel: 'Homework',
        emptyLabel: 'No homework quizzes in this track yet.',
        icon: BookOpen,
        bentoActiveBg: 'bg-[#fde047]',
        bentoBadgeBg: 'bg-[#fef08a] text-black border border-black'
    },
    {
        id: 'exam',
        label: 'Exams',
        singularLabel: 'Exam',
        emptyLabel: 'No exams in this track yet.',
        icon: Award,
        bentoActiveBg: 'bg-[#bae6fd]',
        bentoBadgeBg: 'bg-[#fecdd3] text-black border border-black'
    }
];

export const ClassroomQuizPicker: React.FC<ClassroomQuizPickerProps> = ({
    skillTracks,
    quizzes,
    onLaunchQuiz,
    compact = false
}) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();

    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<TrackAssessmentKind>('quiz');
    const [searchQuery, setSearchQuery] = useState('');

    // Summarize tracks with counts per the 3 types + detect standalone/unlinked quizzes
    const { trackEntries, standaloneBuckets, allQuizzesBuckets } = useMemo(() => {
        const allMatchedIds = new Set<string>();

        const entries = skillTracks.map(track => {
            const grouped = groupQuizzesForTrack(track, quizzes, '');
            grouped.matchedIds.forEach(id => allMatchedIds.add(id));
            return {
                track,
                grouped,
                counts: {
                    quiz: grouped.quizzes.length,
                    homework: grouped.homework.length,
                    exam: grouped.exams.length,
                    total: grouped.totalCount
                }
            };
        });

        const unlinked: Record<TrackAssessmentKind, TrackQuizItem[]> = {
            quiz: [],
            homework: [],
            exam: []
        };

        quizzes.forEach(q => {
            const qid = String(q.id || q._id || '');
            const altQid = q._id ? String(q._id) : '';
            const isMatched = (qid && allMatchedIds.has(qid)) || (altQid && allMatchedIds.has(altQid));
            if (!isMatched) {
                const kind = classifyQuizKind(q);
                unlinked[kind].push({ quiz: q, kind });
            }
        });

        const allBuckets: Record<TrackAssessmentKind, TrackQuizItem[]> = {
            quiz: [],
            homework: [],
            exam: []
        };
        quizzes.forEach(q => {
            const kind = classifyQuizKind(q);
            allBuckets[kind].push({ quiz: q, kind });
        });

        return {
            trackEntries: entries,
            standaloneBuckets: unlinked,
            allQuizzesBuckets: allBuckets
        };
    }, [skillTracks, quizzes]);

    const standaloneTotal =
        standaloneBuckets.quiz.length + standaloneBuckets.homework.length + standaloneBuckets.exam.length;

    const currentEntry = useMemo(
        () => trackEntries.find(e => e.track.trackId === selectedTrackId) || null,
        [trackEntries, selectedTrackId]
    );

    const isStandaloneSelected = selectedTrackId === STANDALONE_TRACK_ID;
    const isAllQuizzesSelected = selectedTrackId === ALL_QUIZZES_TRACK_ID;

    // Active track quizzes grouped & filtered by searchQuery
    const step2Buckets = useMemo<Record<TrackAssessmentKind, TrackQuizItem[]>>(() => {
        const qSearch = searchQuery.trim().toLowerCase();
        const matchesSearch = (item: TrackQuizItem) => {
            if (!qSearch) return true;
            const hay = `${item.quiz.title || ''} ${item.quiz.description || ''} ${item.sessionLabel || ''}`.toLowerCase();
            return hay.includes(qSearch);
        };

        if (isAllQuizzesSelected) {
            return {
                quiz: allQuizzesBuckets.quiz.filter(matchesSearch),
                homework: allQuizzesBuckets.homework.filter(matchesSearch),
                exam: allQuizzesBuckets.exam.filter(matchesSearch)
            };
        }

        if (isStandaloneSelected) {
            return {
                quiz: standaloneBuckets.quiz.filter(matchesSearch),
                homework: standaloneBuckets.homework.filter(matchesSearch),
                exam: standaloneBuckets.exam.filter(matchesSearch)
            };
        }

        if (currentEntry) {
            const grouped = groupQuizzesForTrack(currentEntry.track, quizzes, searchQuery);
            return {
                quiz: grouped.quizzes,
                homework: grouped.homework,
                exam: grouped.exams
            };
        }

        return { quiz: [], homework: [], exam: [] };
    }, [isAllQuizzesSelected, allQuizzesBuckets, isStandaloneSelected, standaloneBuckets, currentEntry, quizzes, searchQuery]);

    const handleSelectTrack = (trackId: string, counts: { quiz: number; homework: number; exam: number }) => {
        setSelectedTrackId(trackId);
        setSearchQuery('');
        // Jump straight to the first non-empty quiz type
        if (counts.quiz > 0) setActiveCategory('quiz');
        else if (counts.homework > 0) setActiveCategory('homework');
        else if (counts.exam > 0) setActiveCategory('exam');
        else setActiveCategory('quiz');
    };

    const currentItems = step2Buckets[activeCategory] || [];
    const activeTabMeta = CATEGORY_TABS.find(t => t.id === activeCategory) || CATEGORY_TABS[0];

    // Step indicator + Step 1 vs Step 2 view
    if (!selectedTrackId || (!currentEntry && !isStandaloneSelected && !isAllQuizzesSelected)) {
        const step1Search = searchQuery.trim().toLowerCase();
        const quickMatchedQuizzes = step1Search
            ? quizzes.filter(q =>
                `${q.title || ''} ${q.description || ''} ${q.category || ''}`.toLowerCase().includes(step1Search)
              )
            : [];

        return (
            <div className="space-y-3 flex-1 min-h-0 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isBento
                                ? 'bg-[#bae6fd] text-black border border-black'
                                : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                        }`}>
                            {tx('Step 1 of 2', 'خطوة ١ من ٢')}
                        </span>
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight">
                            {tx('Choose Curriculum Track', 'اختار مسار التعلم')}
                        </h3>
                    </div>
                    <div className="relative w-full sm:w-56 shrink-0">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
                        <input
                            type="text"
                            placeholder={tx('Search all quizzes...', 'ابحث في كل الكويزات...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-bold ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black focus:outline-none'
                                    : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                            }`}
                        />
                    </div>
                </div>

                {step1Search ? (
                    quickMatchedQuizzes.length === 0 ? (
                        <div className={`p-6 rounded-2xl text-center text-xs font-bold flex-1 flex items-center justify-center ${
                            isBento ? 'bg-slate-50 border-2 border-black/25' : 'bg-slate-50 dark:bg-white/5 text-slate-400'
                        }`}>
                            {tx('No quizzes match your search.', 'مفيش كويزات مطابقة للبحث.')}
                        </div>
                    ) : (
                        <div className={`flex-1 min-h-0 content-start grid gap-2.5 overflow-y-auto pr-1 ${
                            compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
                        }`}>
                            {quickMatchedQuizzes.map(quiz => {
                                const questionCount = quiz.questions?.length || 0;
                                const isEmpty = questionCount === 0;
                                return (
                                    <div
                                        key={quiz.id || quiz._id}
                                        onClick={() => !isEmpty && onLaunchQuiz(quiz)}
                                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition ${
                                            isEmpty
                                                ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-white/[0.02] border-slate-200 dark:border-white/5'
                                                : isBento
                                                    ? 'cursor-pointer bg-white border-2 border-black shadow-[3px_3px_0_#000] hover:bg-[#fef9c3]'
                                                    : 'cursor-pointer bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 hover:bg-indigo-50 dark:hover:bg-white/10 hover:border-indigo-400'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                    {questionCount} {tx('Questions', 'سؤال')}
                                                </span>
                                                {quiz.isVisible === false && (
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                                        isBento ? 'bg-slate-200 text-black border border-black' : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                                                    }`}>
                                                        <EyeOff className="w-2.5 h-2.5" />
                                                        {tx('Hidden', 'مخفي')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs sm:text-sm font-black truncate">{quiz.title}</div>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={isEmpty}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isEmpty) onLaunchQuiz(quiz);
                                            }}
                                            className={`btn-unstyled px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 transition ${
                                                isEmpty
                                                    ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                                                    : isBento
                                                        ? 'cursor-pointer active:scale-95 bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                                        : 'cursor-pointer active:scale-95 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                                            }`}
                                        >
                                            <Play className="w-3 h-3 fill-current" />
                                            <span>{isEmpty ? tx('No Qs', 'فاضي') : tx('Host', 'ابدأ')}</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : trackEntries.length === 0 && standaloneTotal === 0 && quizzes.length === 0 ? (
                    <div className={`p-6 rounded-2xl text-center text-xs font-bold flex-1 flex items-center justify-center ${
                        isBento ? 'bg-slate-50 border-2 border-black/25' : 'bg-slate-50 dark:bg-white/5 text-slate-400'
                    }`}>
                        {tx('No tracks or quizzes available yet.', 'مفيش مسارات أو كويزات متاحة دلوقتي.')}
                    </div>
                ) : (
                    <div className={`flex-1 min-h-0 content-start grid gap-2.5 overflow-y-auto pr-1 ${
                        compact
                            ? 'grid-cols-1 sm:grid-cols-2'
                            : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                    }`}>
                        {quizzes.length > 0 && (
                            <button
                                type="button"
                                onClick={() =>
                                    handleSelectTrack(ALL_QUIZZES_TRACK_ID, {
                                        quiz: allQuizzesBuckets.quiz.length,
                                        homework: allQuizzesBuckets.homework.length,
                                        exam: allQuizzesBuckets.exam.length
                                    })
                                }
                                className={`btn-unstyled p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                                    isBento
                                        ? 'bg-[#fef9c3] hover:bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0_#000]'
                                        : 'bg-indigo-50/70 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2 w-full">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-lg shrink-0">🎯</span>
                                        <div className="min-w-0">
                                            <div className="text-xs sm:text-sm font-black leading-snug">
                                                {tx('All Platform Quizzes', 'كل كويزات المنصة')}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                                {quizzes.length} {tx('Total Quizzes', 'كويز متاح')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 w-full">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        isBento ? 'bg-[#bef264] border border-black text-black' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    }`}>
                                        {allQuizzesBuckets.quiz.length} {tx('Quizzes', 'كويز')}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        isBento ? 'bg-[#fef08a] border border-black text-black' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    }`}>
                                        {allQuizzesBuckets.homework.length} {tx('Homework', 'واجب')}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        isBento ? 'bg-[#bae6fd] border border-black text-black' : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                                    }`}>
                                        {allQuizzesBuckets.exam.length} {tx('Exams', 'امتحان')}
                                    </span>
                                </div>
                            </button>
                        )}
                        {trackEntries.map(({ track, counts }) => (
                            <button
                                key={track.trackId}
                                type="button"
                                onClick={() => handleSelectTrack(track.trackId, counts)}
                                className={`btn-unstyled p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                                    isBento
                                        ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[3px_3px_0_#000] hover:translate-y-[-1px]'
                                        : 'bg-slate-50 dark:bg-white/[0.04] hover:bg-indigo-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 hover:border-indigo-400 shadow-sm'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2 w-full">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-lg shrink-0">{track.icon || '🗺️'}</span>
                                        <div className="min-w-0">
                                            <div className="text-xs sm:text-sm font-black leading-snug line-clamp-2">
                                                {track.title}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                                {track.modules?.length || 0} {tx('Sessions', 'سيشن')} • {counts.total} {tx('Assessments', 'تقييم')}
                                            </div>
                                        </div>
                                    </div>
                                    <Compass className="w-4 h-4 shrink-0 opacity-50 mt-0.5" />
                                </div>

                                {/* 3 Category Mini Counters */}
                                <div className="flex flex-wrap items-center gap-1.5 w-full">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        isBento ? 'bg-[#bef264] border border-black text-black' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    }`}>
                                        {counts.quiz} {tx('Quizzes', 'كويز')}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        isBento ? 'bg-[#fef08a] border border-black text-black' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    }`}>
                                        {counts.homework} {tx('Homework', 'واجب')}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        isBento ? 'bg-[#bae6fd] border border-black text-black' : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                                    }`}>
                                        {counts.exam} {tx('Exams', 'امتحان')}
                                    </span>
                                </div>
                            </button>
                        ))}

                        {standaloneTotal > 0 && (
                            <button
                                type="button"
                                onClick={() =>
                                    handleSelectTrack(STANDALONE_TRACK_ID, {
                                        quiz: standaloneBuckets.quiz.length,
                                        homework: standaloneBuckets.homework.length,
                                        exam: standaloneBuckets.exam.length
                                    })
                                }
                                className={`btn-unstyled p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                                    isBento
                                        ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[3px_3px_0_#000]'
                                        : 'bg-slate-50 dark:bg-white/[0.04] hover:bg-indigo-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2 w-full">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Layers className="w-4 h-4 shrink-0 text-indigo-500" />
                                        <div className="min-w-0">
                                            <div className="text-xs sm:text-sm font-black leading-snug">
                                                {tx('Standalone & General Quizzes', 'كويزات عامة ومستقلة')}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                                {standaloneTotal} {tx('Unlinked Assessments', 'تقييم عام')}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 w-full">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        isBento ? 'bg-[#bef264] border border-black text-black' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    }`}>
                                        {standaloneBuckets.quiz.length} {tx('Quizzes', 'كويز')}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        isBento ? 'bg-[#fef08a] border border-black text-black' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    }`}>
                                        {standaloneBuckets.homework.length} {tx('Homework', 'واجب')}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        isBento ? 'bg-[#bae6fd] border border-black text-black' : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                                    }`}>
                                        {standaloneBuckets.exam.length} {tx('Exams', 'امتحان')}
                                    </span>
                                </div>
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // STEP 2: 3 Quiz Type Category Tabs + Matching Quiz Cards inside Chosen Track
    const activeTrackTitle = isAllQuizzesSelected
        ? tx('All Platform Quizzes', 'كل كويزات المنصة')
        : isStandaloneSelected
            ? tx('Standalone & General Quizzes', 'كويزات عامة ومستقلة')
            : currentEntry?.track.title || tx('Selected Track', 'المسار المختار');
    const activeTrackIcon = isAllQuizzesSelected ? '🎯' : isStandaloneSelected ? '📚' : currentEntry?.track.icon || '🗺️';

    return (
        <div className="space-y-3 flex-1 min-h-0 flex flex-col animate-in fade-in duration-150">
            {/* Step 2 Top Bar: Back to Tracks + Step Badge + Search, followed by Full Track Title */}
            <div className="space-y-2 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedTrackId(null);
                                setSearchQuery('');
                            }}
                            className={`btn-unstyled inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer transition ${
                                isBento
                                    ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200'
                            }`}
                        >
                            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                            <span>{tx('Tracks', 'المسارات')}</span>
                        </button>

                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25'
                        }`}>
                            {tx('Step 2 of 2', 'خطوة ٢ من ٢')}
                        </span>
                    </div>

                    <div className="relative flex-1 min-w-[180px] sm:max-w-[240px]">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
                        <input
                            type="text"
                            placeholder={tx('Filter in track...', 'ابحث في المسار...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-bold ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black focus:bg-[#fef9c3] focus:outline-none'
                                    : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                            }`}
                        />
                    </div>
                </div>

                <div className={`px-3 py-2 rounded-xl flex items-center justify-between gap-2 ${
                    isBento
                        ? 'bg-[#f8fafc] border-2 border-black/20 text-black'
                        : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100'
                }`}>
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base leading-none shrink-0">{activeTrackIcon}</span>
                        <span className="text-xs sm:text-sm font-black tracking-tight truncate">
                            {activeTrackTitle}
                        </span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-60 whitespace-nowrap shrink-0">
                        {step2Buckets.quiz.length + step2Buckets.homework.length + step2Buckets.exam.length} {tx('Quizzes', 'كويز')}
                    </span>
                </div>
            </div>

            {/* 3 Quiz Type Category Tabs: Session Quizzes | Homework | Exams */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
                {CATEGORY_TABS.map(tab => {
                    const Icon = tab.icon;
                    const count = step2Buckets[tab.id].length;
                    const isActive = activeCategory === tab.id;
                    const tabLabel = tab.id === 'quiz'
                        ? tx('Session Quizzes', 'كويزات السيشن')
                        : tab.id === 'homework'
                            ? tx('Homework', 'الواجبات')
                            : tx('Exams', 'الامتحانات');
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveCategory(tab.id)}
                            className={`btn-unstyled px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition ${
                                isActive
                                    ? isBento
                                        ? `${tab.bentoActiveBg} text-black border-2 border-black shadow-[2px_2px_0_#000]`
                                        : 'bg-indigo-600 text-white shadow-md'
                                    : isBento
                                        ? 'bg-white hover:bg-slate-50 text-black border-2 border-black/30 hover:border-black'
                                        : 'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{tabLabel}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black shrink-0 ${
                                isActive
                                    ? isBento ? 'bg-white text-black border border-black' : 'bg-white/20 text-white'
                                    : 'bg-black/10 dark:bg-white/10'
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Matching Quizzes Grid */}
            {currentItems.length === 0 ? (
                <div className={`p-6 rounded-2xl text-center text-xs font-bold flex-1 flex items-center justify-center ${
                    isBento ? 'bg-slate-50 border-2 border-black/20 text-slate-600' : 'bg-slate-50 dark:bg-white/5 text-slate-400'
                }`}>
                    {activeTabMeta.emptyLabel}
                </div>
            ) : (
                <div className={`flex-1 min-h-0 content-start grid gap-2.5 overflow-y-auto pr-1 ${
                    compact
                        ? 'grid-cols-1'
                        : 'grid-cols-1 sm:grid-cols-2'
                }`}>
                    {currentItems.map(({ quiz, sessionLabel }) => {
                        const questionCount = quiz.questions?.length || 0;
                        const isEmpty = questionCount === 0;
                        return (
                        <div
                            key={quiz.id || quiz._id}
                            onClick={() => !isEmpty && onLaunchQuiz(quiz)}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition ${
                                isEmpty
                                    ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-white/[0.02] border-slate-200 dark:border-white/5'
                                    : isBento
                                        ? 'cursor-pointer bg-white border-2 border-black shadow-[3px_3px_0_#000] hover:bg-[#fef9c3]'
                                        : 'cursor-pointer bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 hover:bg-indigo-50 dark:hover:bg-white/10 hover:border-indigo-400'
                            }`}
                        >
                            <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                        isBento ? activeTabMeta.bentoBadgeBg : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                                    }`}>
                                        {activeTabMeta.id === 'quiz'
                                            ? tx('Session Quiz', 'كويز سيشن')
                                            : activeTabMeta.id === 'homework'
                                                ? tx('Homework', 'واجب')
                                                : tx('Exam', 'امتحان')}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                        {questionCount} {tx('Questions', 'سؤال')}
                                    </span>
                                    {quiz.isVisible === false && (
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                            isBento ? 'bg-slate-200 text-black border border-black' : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                                        }`}>
                                            <EyeOff className="w-2.5 h-2.5" />
                                            {tx('Hidden', 'مخفي')}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs sm:text-sm font-black truncate">
                                    {quiz.title}
                                </div>
                                {sessionLabel && (
                                    <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                        {sessionLabel}
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                disabled={isEmpty}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isEmpty) onLaunchQuiz(quiz);
                                }}
                                className={`btn-unstyled px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 transition ${
                                    isEmpty
                                        ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                                        : isBento
                                            ? 'cursor-pointer active:scale-95 bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                            : 'cursor-pointer active:scale-95 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                                }`}
                            >
                                <Play className="w-3 h-3 fill-current" />
                                <span>{isEmpty ? tx('No Qs', 'فاضي') : tx('Host', 'ابدأ')}</span>
                            </button>
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ClassroomQuizPicker;
