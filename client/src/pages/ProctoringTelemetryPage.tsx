import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ShieldAlert,
    EyeOff,
    Activity,
    Copy,
    Clock,
    Zap,
    AlertTriangle,
    ArrowLeft,
    RefreshCw,
    User,
    Calendar,
    HelpCircle,
    CheckCircle2,
    FileText,
    Table,
    Filter,
    PlayCircle,
    Flag
} from 'lucide-react';
import { api } from '../lib/api';
import type { DetailedAttemptData } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { MathRenderer } from '../components/common/MathRenderer';
import { exportAttemptToCSV, exportAttemptToPDF } from '../lib/exportUtils';
import { AmbientBackground } from '../components/AmbientBackground';

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.max(0, Math.round(seconds % 60));
    return `${mins}m ${secs}s`;
};

const formatOffset = (offsetMs: number) => {
    const totalSec = Math.max(0, Math.round(offsetMs / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `+${mins}:${String(secs).padStart(2, '0')}`;
};

const describeTelemetryEvent = (type: string, details?: string) => {
    switch (type) {
        case 'tab_hidden':
            return {
                title: 'Switched Tab / Hidden Page',
                detail: 'Browser tab lost foreground visibility',
                severity: 'high' as const
            };
        case 'window_blur':
            return {
                title: 'Window Focus Lost',
                detail: 'Clicked outside browser or switched app window',
                severity: 'warn' as const
            };
        case 'copy_attempt':
            return {
                title: 'Copy Attempt Blocked',
                detail: 'Student triggered clipboard copy on exam content',
                severity: 'high' as const
            };
        case 'paste_attempt':
            return {
                title: 'Paste Action Detected',
                detail: 'Student attempted clipboard paste in exam',
                severity: 'high' as const
            };
        case 'fullscreen_exit':
            return {
                title: 'Exited Fullscreen Mode',
                detail: 'Left fullscreen proctored exam viewport',
                severity: 'high' as const
            };
        case 'rapid_guess':
            return {
                title: 'Rapid Response (< 2s)',
                detail: details ? `Answered in ${details}` : 'Submitted unusually fast answer',
                severity: 'warn' as const
            };
        case 'context_menu':
            return {
                title: 'Right-Click Blocked',
                detail: 'Opened context menu during exam',
                severity: 'info' as const
            };
        default:
            return {
                title: type.replace(/_/g, ' '),
                detail: details || 'Proctoring telemetry event recorded',
                severity: 'info' as const
            };
    }
};

const ProctoringTelemetryPage: React.FC = () => {
    const { attemptId } = useParams<{ attemptId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const isAdminRoute = location.pathname.startsWith('/admin');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState<DetailedAttemptData | null>(null);
    const [filter, setFilter] = useState<'all' | 'wrong' | 'correct' | 'unanswered'>('all');
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);

    const loadDetails = useCallback(async () => {
        if (!attemptId) {
            setError(tx('Missing attempt ID in URL.', 'رقم المحاولة مش موجود في اللينك.'));
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await api.getAttemptDetails(attemptId);
            if (res.success && res.attempt) {
                setAttempt(res.attempt);
            } else {
                setError(tx('Telemetry record not found.', 'سجل المراقبة ده مش موجود.'));
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : tx('Failed to load telemetry inspection data.', 'فشل تحميل بيانات مراقبة الامتحان.')
            );
        } finally {
            setLoading(false);
        }
    }, [attemptId, tx]);

    useEffect(() => {
        void loadDetails();
    }, [loadDetails]);

    const handleExportPDF = async () => {
        if (!attempt) return;
        setIsExportingPDF(true);
        try {
            await exportAttemptToPDF(attempt);
        } finally {
            setIsExportingPDF(false);
        }
    };

    const handleExportCSV = () => {
        if (!attempt) return;
        setIsExportingCSV(true);
        try {
            exportAttemptToCSV(attempt);
        } finally {
            setIsExportingCSV(false);
        }
    };

    const questions = useMemo(() => attempt?.questionsBreakdown || [], [attempt]);
    const correctQuestions = questions.filter((q) => q.isCorrect);
    const wrongQuestions = questions.filter((q) => !q.isCorrect && q.isAnswered);
    const unansweredQuestions = questions.filter((q) => !q.isAnswered);
    const filteredQuestions =
        filter === 'wrong'
            ? wrongQuestions
            : filter === 'correct'
              ? correctQuestions
              : filter === 'unanswered'
                ? unansweredQuestions
                : questions;

    const telemetry = attempt?.telemetry;
    const integrityScore = telemetry?.integrityScore ?? 100;
    const tabSwitches = telemetry?.tabSwitches ?? 0;
    const focusLosses = telemetry?.focusLossCount ?? 0;
    const copyPastes = telemetry?.copyPasteAttempts ?? 0;
    const fullscreenExits = telemetry?.fullscreenExits ?? 0;
    const rapidGuesses = telemetry?.rapidGuesses ?? 0;
    const events = useMemo(() => telemetry?.events || [], [telemetry]);
    const totalQuestionsCount = questions.length || attempt?.totalQuestions || 0;
    const avgTimePerQ =
        totalQuestionsCount > 0 && attempt?.timeTaken
            ? Math.round(attempt.timeTaken / totalQuestionsCount)
            : 0;

    const isPristine = integrityScore >= 90;
    const isModerate = integrityScore >= 70 && integrityScore < 90;

    // Build chronological session timeline: Session Start -> Timestamped Events -> Session Submitted
    const chronologicalTimeline = useMemo(() => {
        if (!attempt) return [];
        const completedMs = attempt.completedAt ? new Date(attempt.completedAt).getTime() : Date.now();
        const durationMs = Math.max(0, (attempt.timeTaken || 0) * 1000);
        const estimatedStartMs = completedMs - durationMs;

        const sortedEvents = [...events]
            .map((evt, idx) => {
                const evtMs = evt.timestamp ? new Date(evt.timestamp).getTime() : estimatedStartMs;
                const info = describeTelemetryEvent(evt.type, evt.details);
                const qNum = evt.questionIndex !== undefined ? evt.questionIndex + 1 : null;
                const linkedQ = evt.questionIndex !== undefined ? questions[evt.questionIndex] : undefined;
                return {
                    id: `evt-${idx}`,
                    tsMs: evtMs,
                    offsetLabel: formatOffset(evtMs - estimatedStartMs),
                    clockLabel: new Date(evtMs).toLocaleTimeString(),
                    title: info.title,
                    detail: info.detail,
                    questionBadge: qNum ? `Q${qNum}` : null,
                    questionSnippet: linkedQ?.question?.slice(0, 70) || null,
                    severity: info.severity
                };
            })
            .sort((a, b) => a.tsMs - b.tsMs);

        return [
            {
                id: 'session-start',
                tsMs: estimatedStartMs,
                offsetLabel: '+0:00',
                clockLabel: new Date(estimatedStartMs).toLocaleTimeString(),
                title: tx('Exam Session Started', 'بداية جلسة الامتحان'),
                detail: `${attempt.quizTitle || 'Quiz'} (${totalQuestionsCount} ${tx('questions', 'سؤال')})`,
                questionBadge: null,
                questionSnippet: null,
                severity: 'start' as const
            },
            ...sortedEvents,
            {
                id: 'session-end',
                tsMs: completedMs,
                offsetLabel: formatOffset(durationMs),
                clockLabel: new Date(completedMs).toLocaleTimeString(),
                title: tx('Exam Submitted & Graded', 'تسليم الامتحان والتقييم'),
                detail: `${attempt.percentage}% (${attempt.score} pts) • ${tx('Integrity', 'النزاهة')} ${integrityScore}%`,
                questionBadge: null,
                questionSnippet: null,
                severity: 'end' as const
            }
        ];
    }, [attempt, events, integrityScore, questions, totalQuestionsCount, tx]);

    const shellCardClass = isBento
        ? 'bg-white border-[2.5px] border-black shadow-[4px_4px_0px_#000] rounded-2xl text-black'
        : 'bg-white/90 dark:bg-[#141210]/90 border border-slate-200 dark:border-white/10 shadow-sm rounded-2xl';

    return (
        <div
            className={`min-h-dvh relative pb-8 transition-colors ${
                isBento
                    ? 'bg-[#f5f3ec] text-black'
                    : 'bg-slate-50 dark:bg-[#0a0908] text-slate-900 dark:text-slate-100'
            }`}
        >
            <AmbientBackground />

            <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-5 pt-4 space-y-4">
                {/* Compact Header Strip */}
                <div className={`p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 ${shellCardClass}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <button
                            type="button"
                            onClick={() => {
                                if (window.history.length > 1) {
                                    navigate(-1);
                                } else {
                                    window.close();
                                    navigate(isAdminRoute ? '/admin' : '/profile');
                                }
                            }}
                            className={`btn-unstyled inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all shrink-0 ${
                                isBento
                                    ? 'bg-[#fef08a] hover:bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-white'
                            }`}
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>{isAdminRoute ? tx('Admin', 'لوحة التحكم') : tx('Back to Profile', 'رجوع للبروفايل')}</span>
                        </button>

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                        isBento
                                            ? 'bg-[#bae6fd] text-black border border-black'
                                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                    }`}
                                >
                                    {tx('Inspector', 'فاحص المحاولة')}
                                </span>
                                {attempt && (
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            attempt.passed
                                                ? isBento
                                                    ? 'bg-[#bef264] text-black border border-black'
                                                    : 'bg-emerald-500/15 text-emerald-600'
                                                : isBento
                                                  ? 'bg-[#fecdd3] text-black border border-black'
                                                  : 'bg-red-500/15 text-red-600'
                                        }`}
                                    >
                                        {attempt.passed ? tx('Passed', 'ناجح') : tx('Failed', 'راسب')} • {attempt.percentage}%
                                    </span>
                                )}
                            </div>
                            <h1 className="text-sm sm:text-lg font-black tracking-tight truncate mt-0.5">
                                {attempt ? `${attempt.userName} — ${attempt.quizTitle || 'Quiz'}` : tx('Exam Telemetry Inspector', 'تقرير فحص الامتحان')}
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void loadDetails()}
                            disabled={loading}
                            className={`btn-unstyled inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all disabled:opacity-50 ${
                                isBento
                                    ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white'
                            }`}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            <span>{tx('Refresh', 'تحديث')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => void handleExportPDF()}
                            disabled={loading || isExportingPDF || !attempt}
                            className={`btn-unstyled inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all disabled:opacity-50 ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{isExportingPDF ? '...' : 'PDF'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportCSV}
                            disabled={loading || isExportingCSV || !attempt}
                            className={`btn-unstyled inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all disabled:opacity-50 ${
                                isBento
                                    ? 'bg-[#fed7aa] hover:bg-[#fdba74] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                        >
                            <Table className="w-3.5 h-3.5" />
                            <span>{isExportingCSV ? '...' : 'CSV'}</span>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className={`p-12 text-center ${shellCardClass}`}>
                        <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-500" />
                        <p className="text-xs font-black uppercase tracking-wider">
                            {tx('Loading Proctoring Telemetry...', 'بنحمل بيانات المراقبة والأسئلة...')}
                        </p>
                    </div>
                ) : error || !attempt ? (
                    <div className={`p-10 text-center space-y-3 ${shellCardClass}`}>
                        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
                        <h2 className="text-base font-black">{error || tx('Attempt Not Found', 'المحاولة مش موجودة')}</h2>
                        <button
                            type="button"
                            onClick={() => void loadDetails()}
                            className={`btn-unstyled px-4 py-2 rounded-xl text-xs font-black cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-indigo-600 text-white'
                            }`}
                        >
                            {tx('Retry', 'حاول تاني')}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Compact Overview + Telemetry Metrics Grid */}
                        <div className={`p-4 space-y-3 ${shellCardClass}`}>
                            {/* Student Metadata Row */}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex flex-wrap items-center gap-3 font-bold">
                                    <span className="flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5" />
                                        {attempt.userEmail}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {attempt.completedAt ? new Date(attempt.completedAt).toLocaleString() : 'Recent'}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        {formatDuration(attempt.timeTaken || 0)}
                                    </span>
                                </div>
                                <span
                                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                        isBento
                                            ? isPristine
                                                ? 'bg-[#bef264] border border-black'
                                                : isModerate
                                                  ? 'bg-[#fde047] border border-black'
                                                  : 'bg-[#fecdd3] border border-black'
                                            : 'bg-slate-100 dark:bg-white/10'
                                    }`}
                                >
                                    {isPristine
                                        ? tx('Status: Pristine', 'الحالة: سليم تماماً')
                                        : isModerate
                                          ? tx('Status: Moderate Caution', 'الحالة: ملاحظات متوسطة')
                                          : tx('Status: Flagged / High Risk', 'الحالة: خطر عالي')}
                                </span>
                            </div>

                            {/* Tight 8-tile Compact Stat Bento Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                                <div className={`p-2.5 rounded-xl ${isBento ? 'bg-[#d9f99d] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="text-[9px] font-black uppercase opacity-75">{tx('Score', 'النتيجة')}</div>
                                    <div className="text-lg font-black leading-tight">{attempt.percentage}%</div>
                                    <div className="text-[9px] font-bold opacity-75">{attempt.score} pts</div>
                                </div>

                                <div className={`p-2.5 rounded-xl ${isBento ? (isPristine ? 'bg-[#bef264]' : isModerate ? 'bg-[#fde047]' : 'bg-[#fecdd3]') + ' border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="text-[9px] font-black uppercase opacity-75">{tx('Integrity', 'النزاهة')}</div>
                                    <div className="text-lg font-black leading-tight">{integrityScore}%</div>
                                    <div className="text-[9px] font-bold opacity-75">{events.length} events</div>
                                </div>

                                <div className={`p-2.5 rounded-xl ${isBento ? 'bg-[#e0f2fe] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="text-[9px] font-black uppercase opacity-75 flex items-center gap-1"><HelpCircle className="w-3 h-3" /> {tx('Questions', 'الأسئلة')}</div>
                                    <div className="text-lg font-black leading-tight">{totalQuestionsCount}</div>
                                    <div className="text-[9px] font-bold opacity-75">{avgTimePerQ}s avg/q</div>
                                </div>

                                <div className={`p-2.5 rounded-xl ${isBento ? 'bg-[#f0fdf4] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                                    <div className="text-[9px] font-black uppercase opacity-75 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {tx('Correct', 'صح')}</div>
                                    <div className="text-lg font-black leading-tight">{correctQuestions.length}</div>
                                    <div className="text-[9px] font-bold opacity-75">{wrongQuestions.length} wrong • {unansweredQuestions.length} skip</div>
                                </div>

                                <div className={`p-2.5 rounded-xl ${isBento ? 'bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="text-[9px] font-black uppercase opacity-75 flex items-center gap-1"><EyeOff className="w-3 h-3" /> {tx('Tabs', 'تابات')}</div>
                                    <div className="text-lg font-black leading-tight">{tabSwitches}</div>
                                    <div className="text-[9px] font-bold opacity-75">switches</div>
                                </div>

                                <div className={`p-2.5 rounded-xl ${isBento ? 'bg-[#fed7aa] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="text-[9px] font-black uppercase opacity-75 flex items-center gap-1"><Activity className="w-3 h-3" /> {tx('Focus', 'تركيز')}</div>
                                    <div className="text-lg font-black leading-tight">{focusLosses}</div>
                                    <div className="text-[9px] font-bold opacity-75">losses</div>
                                </div>

                                <div className={`p-2.5 rounded-xl ${isBento ? 'bg-[#ffe4e6] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="text-[9px] font-black uppercase opacity-75 flex items-center gap-1"><Copy className="w-3 h-3" /> {tx('Copy/Paste', 'نسخ')}</div>
                                    <div className="text-lg font-black leading-tight">{copyPastes}</div>
                                    <div className="text-[9px] font-bold opacity-75">{fullscreenExits} fs exits</div>
                                </div>

                                <div className={`p-2.5 rounded-xl ${isBento ? 'bg-[#ffedd5] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="text-[9px] font-black uppercase opacity-75 flex items-center gap-1"><Zap className="w-3 h-3" /> {tx('Rushed', 'متسرع')}</div>
                                    <div className="text-lg font-black leading-tight">{rapidGuesses}</div>
                                    <div className="text-[9px] font-bold opacity-75">&lt; 2s ans</div>
                                </div>
                            </div>
                        </div>

                        {/* Split Compact Layout: Chronological "What Happened When" Timeline + Question Breakdown */}
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                            {/* Left Column: Chronological What Happened When Log (4 cols on xl) */}
                            <div className={`xl:col-span-4 p-4 space-y-3 ${shellCardClass}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                                isBento
                                                    ? 'bg-[#fde047] border-2 border-black text-black'
                                                    : 'bg-indigo-500/10 text-indigo-500'
                                            }`}
                                        >
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-xs font-black uppercase tracking-wider">
                                                {tx('What Happened When', 'تسلسل الأحداث بالوقت')}
                                            </h2>
                                            <p className="text-[10px] font-semibold opacity-70">
                                                {tx('Chronological start, flags & submission', 'من أول فتح الامتحان لحد التسليم')}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                            isBento ? 'bg-[#f5f3ec] border border-black' : 'bg-slate-100 dark:bg-white/10'
                                        }`}
                                    >
                                        {chronologicalTimeline.length}
                                    </span>
                                </div>

                                <div className="space-y-2 max-h-[65vh] overflow-y-auto custom-scrollbar pe-1">
                                    {chronologicalTimeline.map((item) => {
                                        const isStart = item.severity === 'start';
                                        const isEnd = item.severity === 'end';
                                        const isHigh = item.severity === 'high';
                                        const isWarn = item.severity === 'warn';

                                        const badgeColor = isBento
                                            ? isStart
                                                ? 'bg-[#bae6fd]'
                                                : isEnd
                                                  ? 'bg-[#bef264]'
                                                  : isHigh
                                                    ? 'bg-[#fecdd3]'
                                                    : isWarn
                                                      ? 'bg-[#fde047]'
                                                      : 'bg-white'
                                            : 'bg-slate-100 dark:bg-white/5';

                                        return (
                                            <div
                                                key={item.id}
                                                className={`p-2.5 rounded-xl space-y-1 text-xs ${
                                                    isBento
                                                        ? `${badgeColor} border-2 border-black shadow-[2px_2px_0px_#000]`
                                                        : 'bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {isStart ? (
                                                            <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                                                        ) : isEnd ? (
                                                            <Flag className="w-3.5 h-3.5 shrink-0" />
                                                        ) : isHigh ? (
                                                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                                                        ) : (
                                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                        )}
                                                        <span className="font-black truncate">{item.title}</span>
                                                    </div>

                                                    <span
                                                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-black shrink-0 ${
                                                            isBento ? 'bg-white border border-black text-black' : 'bg-black/10 dark:bg-white/10'
                                                        }`}
                                                    >
                                                        {item.offsetLabel}
                                                    </span>
                                                </div>

                                                <div className="text-[11px] font-semibold opacity-85 leading-snug">
                                                    {item.detail}
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-[10px] font-mono opacity-75">
                                                    <span>{item.clockLabel}</span>
                                                    {item.questionBadge && (
                                                        <span
                                                            className={`px-1.5 py-0.5 rounded font-black ${
                                                                isBento ? 'bg-black text-white' : 'bg-indigo-500/20 text-indigo-400'
                                                            }`}
                                                        >
                                                            {item.questionBadge}
                                                        </span>
                                                    )}
                                                </div>
                                                {item.questionSnippet && (
                                                    <div className="text-[10px] italic opacity-75 truncate border-t border-black/10 dark:border-white/10 pt-1">
                                                        "{item.questionSnippet}..."
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right Column: Compact Filterable Question-by-Question Breakdown (8 cols on xl) */}
                            <div className={`xl:col-span-8 p-4 space-y-3 ${shellCardClass}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                        <Filter className="w-3.5 h-3.5" />
                                        <span>{tx('Question Answers & Timing', 'تفاصيل الأسئلة والوقت')}</span>
                                    </h2>

                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {(
                                            [
                                                { id: 'all', label: tx(`All (${questions.length})`, `الكل (${questions.length})`), bentoBg: 'bg-[#bef264]' },
                                                { id: 'wrong', label: tx(`Wrong (${wrongQuestions.length})`, `غلط (${wrongQuestions.length})`), bentoBg: 'bg-[#fecdd3]' },
                                                { id: 'correct', label: tx(`Correct (${correctQuestions.length})`, `صح (${correctQuestions.length})`), bentoBg: 'bg-[#d9f99d]' },
                                                ...(unansweredQuestions.length > 0
                                                    ? [{ id: 'unanswered', label: tx(`Skipped (${unansweredQuestions.length})`, `متساب (${unansweredQuestions.length})`), bentoBg: 'bg-[#fde047]' }]
                                                    : [])
                                            ] as { id: typeof filter; label: string; bentoBg: string }[]
                                        ).map((tab) => {
                                            const active = filter === tab.id;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    onClick={() => setFilter(tab.id)}
                                                    className={`btn-unstyled px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                                                        isBento
                                                            ? active
                                                                ? `${tab.bentoBg} text-black border-2 border-black shadow-[2px_2px_0px_#000]`
                                                                : 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black/40'
                                                            : active
                                                              ? 'bg-indigo-600 text-white'
                                                              : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-gray-300'
                                                    }`}
                                                >
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {filteredQuestions.length === 0 ? (
                                    <div className={`p-8 text-center rounded-xl text-xs font-bold ${isBento ? 'bg-[#f5f3ec] border-2 border-black' : 'opacity-70'}`}>
                                        {questions.length === 0
                                            ? tx('No per-question payload was stored for this older submission.', 'مفيش تفاصيل أسئلة متخزنة للمحاولة القديمة دي.')
                                            : tx('No questions match this filter.', 'مفيش أسئلة مطابقة للفلتر ده.')}
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 max-h-[65vh] overflow-y-auto custom-scrollbar pe-1">
                                        {filteredQuestions.map((q, qIndex) => {
                                            const isAnswered =
                                                q.isAnswered ??
                                                (q.studentAnswer !== undefined &&
                                                    q.studentAnswer !== null &&
                                                    q.studentAnswer !== '');
                                            const isCorrect = q.isCorrect;
                                            const isWrong = !isCorrect && isAnswered;
                                            const qEvents = events.filter((e) => e.questionIndex === q.questionIndex);
                                            const qTimeSec =
                                                telemetry?.timePerQuestion?.[String(q.questionIndex)] ??
                                                telemetry?.timePerQuestion?.[String(q.questionId)];

                                            const correctIdx =
                                                typeof q.correctAnswer === 'number'
                                                    ? q.correctAnswer
                                                    : typeof q.correctAnswer === 'string' &&
                                                        q.correctAnswer.trim() !== '' &&
                                                        !isNaN(Number(q.correctAnswer))
                                                      ? Number(q.correctAnswer)
                                                      : null;
                                            const studentIdx =
                                                typeof q.studentAnswer === 'number'
                                                    ? q.studentAnswer
                                                    : typeof q.studentAnswer === 'string' &&
                                                        q.studentAnswer.trim() !== '' &&
                                                        !isNaN(Number(q.studentAnswer))
                                                      ? Number(q.studentAnswer)
                                                      : null;

                                            const studentText =
                                                studentIdx !== null && Array.isArray(q.options) && q.options[studentIdx]
                                                    ? `${String.fromCharCode(65 + studentIdx)}. ${q.options[studentIdx]}`
                                                    : q.studentAnswer !== undefined && q.studentAnswer !== null && q.studentAnswer !== ''
                                                      ? typeof q.studentAnswer === 'object'
                                                          ? JSON.stringify(q.studentAnswer)
                                                          : String(q.studentAnswer)
                                                      : tx('No answer', 'مجاوبش');

                                            const correctText =
                                                correctIdx !== null && Array.isArray(q.options) && q.options[correctIdx]
                                                    ? `${String.fromCharCode(65 + correctIdx)}. ${q.options[correctIdx]}`
                                                    : q.correctAnswer !== undefined && q.correctAnswer !== null
                                                      ? String(q.correctAnswer)
                                                      : 'N/A';

                                            return (
                                                <div
                                                    key={q.questionId || qIndex}
                                                    className={`p-3.5 rounded-xl space-y-2 ${
                                                        isBento
                                                            ? isCorrect
                                                                ? 'bg-[#f0fdf4] border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                : isWrong
                                                                  ? 'bg-[#fff1f2] border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                  : 'bg-[#fefce8] border-2 border-black shadow-[2px_2px_0px_#000]'
                                                            : 'bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10'
                                                    }`}
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span
                                                                className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                                                                    isBento
                                                                        ? isCorrect
                                                                            ? 'bg-[#bef264] text-black border border-black'
                                                                            : isWrong
                                                                              ? 'bg-[#fecdd3] text-black border border-black'
                                                                              : 'bg-[#fde047] text-black border border-black'
                                                                        : isCorrect
                                                                          ? 'bg-emerald-500 text-white'
                                                                          : isWrong
                                                                            ? 'bg-red-500 text-white'
                                                                            : 'bg-amber-500 text-white'
                                                                }`}
                                                            >
                                                                Q{q.questionIndex + 1}
                                                            </span>
                                                            {qTimeSec !== undefined && (
                                                                <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px] font-mono font-bold">
                                                                    {qTimeSec}s spent
                                                                </span>
                                                            )}
                                                            {qEvents.map((qe, qeIdx) => (
                                                                <span
                                                                    key={qeIdx}
                                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 ${
                                                                        isBento
                                                                            ? 'bg-[#fde047] border border-black text-black'
                                                                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                                                                    }`}
                                                                >
                                                                    <AlertTriangle className="w-2.5 h-2.5" />
                                                                    {describeTelemetryEvent(qe.type, qe.details).title} ({new Date(qe.timestamp).toLocaleTimeString()})
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <span className="text-[11px] font-black uppercase">
                                                            {isCorrect
                                                                ? `+${q.points} pts`
                                                                : isWrong
                                                                  ? '0 pts'
                                                                  : tx('Skipped', 'متساب')}
                                                        </span>
                                                    </div>

                                                    <div className="text-xs sm:text-sm font-bold leading-snug">
                                                        <MathRenderer text={q.question} />
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                        <div
                                                            className={`p-2.5 rounded-lg ${
                                                                isBento
                                                                    ? 'bg-white border border-black'
                                                                    : 'bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10'
                                                            }`}
                                                        >
                                                            <div className="text-[9px] font-black uppercase opacity-65 mb-0.5">
                                                                {tx("Student's Answer", 'إجابة الطالب')}
                                                            </div>
                                                            <div className="font-bold text-xs">
                                                                <MathRenderer text={studentText} />
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`p-2.5 rounded-lg ${
                                                                isBento
                                                                    ? 'bg-[#d9f99d] border border-black'
                                                                    : 'bg-emerald-500/10 border border-emerald-500/20'
                                                            }`}
                                                        >
                                                            <div className="text-[9px] font-black uppercase opacity-65 mb-0.5">
                                                                {tx('Correct Answer', 'الإجابة الصحيحة')}
                                                            </div>
                                                            <div className="font-bold text-xs">
                                                                <MathRenderer text={correctText} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ProctoringTelemetryPage;
