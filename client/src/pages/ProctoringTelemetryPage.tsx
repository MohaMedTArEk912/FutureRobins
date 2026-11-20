import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ShieldCheck,
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
    XCircle,
    MinusCircle,
    FileText,
    Table,
    Filter
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
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
};

const ProctoringTelemetryPage: React.FC = () => {
    const { attemptId } = useParams<{ attemptId: string }>();
    const navigate = useNavigate();
    const { isBento } = useTheme();
    const { tx } = useLanguage();

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

    const questions = attempt?.questionsBreakdown || [];
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
    const events = telemetry?.events || [];
    const avgTimePerQ =
        questions.length > 0 && attempt?.timeTaken
            ? Math.round(attempt.timeTaken / questions.length)
            : 0;

    const isPristine = integrityScore >= 90;
    const isModerate = integrityScore >= 70 && integrityScore < 90;

    const shellCardClass = isBento
        ? 'bg-white border-[2.5px] border-black shadow-[5px_5px_0px_#000] rounded-2xl text-black'
        : 'bg-white/90 dark:bg-[#13141f]/90 border border-slate-200 dark:border-white/10 shadow-sm rounded-3xl';

    return (
        <div
            className={`min-h-dvh relative pb-12 transition-colors ${
                isBento
                    ? 'bg-[#f5f3ec] text-black'
                    : 'bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100'
            }`}
        >
            {!isBento && <AmbientBackground />}

            <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
                {/* Top Navigation & Export Bar */}
                <div className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 ${shellCardClass}`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={() => {
                                if (window.history.length > 1) {
                                    navigate(-1);
                                } else {
                                    navigate('/admin');
                                }
                            }}
                            className={`btn-unstyled inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                                isBento
                                    ? 'bg-[#fef08a] hover:bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-white'
                            }`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>{tx('Admin Console', 'لوحة التحكم')}</span>
                        </button>

                        <div className="min-w-0">
                            <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    isBento
                                        ? 'bg-[#bae6fd] text-black border border-black'
                                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                }`}
                            >
                                {tx('Telemetry Inspector', 'فحص مراقبة الامتحان')}
                            </span>
                            <h1 className="text-base sm:text-xl font-black tracking-tight truncate mt-0.5">
                                {attempt?.userName || tx('Exam Integrity Report', 'تقرير نزاهة الامتحان')}
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void loadDetails()}
                            disabled={loading}
                            className={`btn-unstyled inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition-all disabled:opacity-50 ${
                                isBento
                                    ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-white'
                            }`}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            <span>{tx('Refresh', 'تحديث')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => void handleExportPDF()}
                            disabled={loading || isExportingPDF || !attempt}
                            className={`btn-unstyled inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition-all disabled:opacity-50 ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{isExportingPDF ? tx('Exporting...', 'بنجهز...') : tx('PDF Report', 'تقرير PDF')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportCSV}
                            disabled={loading || isExportingCSV || !attempt}
                            className={`btn-unstyled inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition-all disabled:opacity-50 ${
                                isBento
                                    ? 'bg-[#ddd6fe] hover:bg-[#c4b5fd] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                        >
                            <Table className="w-3.5 h-3.5" />
                            <span>{isExportingCSV ? tx('Exporting...', 'بنجهز...') : tx('CSV', 'ملف CSV')}</span>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className={`p-16 text-center ${shellCardClass}`}>
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
                        <p className="text-sm font-black uppercase tracking-wider">
                            {tx('Loading Proctoring Telemetry...', 'بنحمل بيانات المراقبة والأسئلة...')}
                        </p>
                    </div>
                ) : error || !attempt ? (
                    <div className={`p-12 text-center space-y-4 ${shellCardClass}`}>
                        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
                        <h2 className="text-lg font-black">{error || tx('Attempt Not Found', 'المحاولة مش موجودة')}</h2>
                        <button
                            type="button"
                            onClick={() => void loadDetails()}
                            className={`btn-unstyled px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-indigo-600 text-white'
                            }`}
                        >
                            {tx('Retry', 'حاول تاني')}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Student & Quiz Overview */}
                        <div className={`p-5 sm:p-6 space-y-5 ${shellCardClass}`}>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                isBento
                                                    ? 'bg-[#ddd6fe] text-black border-2 border-black'
                                                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                            }`}
                                        >
                                            {attempt.quizTitle || 'Quiz'}
                                        </span>
                                        <span
                                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                attempt.passed
                                                    ? isBento
                                                        ? 'bg-[#bef264] text-black border-2 border-black'
                                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                    : isBento
                                                      ? 'bg-[#fecdd3] text-black border-2 border-black'
                                                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                            }`}
                                        >
                                            {attempt.passed ? tx('Passed', 'ناجح') : tx('Failed', 'راسب')} ({attempt.percentage}%)
                                        </span>
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black tracking-tight">{attempt.userName}</h2>
                                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold opacity-80">
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
                                </div>

                                <div
                                    className={`px-6 py-4 rounded-2xl text-center min-w-[130px] shrink-0 ${
                                        isBento
                                            ? isPristine
                                                ? 'bg-[#bef264] border-2 border-black shadow-[3px_3px_0px_#000] text-black'
                                                : isModerate
                                                  ? 'bg-[#fde047] border-2 border-black shadow-[3px_3px_0px_#000] text-black'
                                                  : 'bg-[#fecdd3] border-2 border-black shadow-[3px_3px_0px_#000] text-black'
                                            : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                                    }`}
                                >
                                    <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
                                        {tx('Integrity Score', 'نسبة النزاهة')}
                                    </div>
                                    <div className="text-3xl font-black mt-0.5">{integrityScore}%</div>
                                    <div className="text-[11px] font-bold">
                                        {isPristine
                                            ? tx('Pristine', 'سليم تماماً')
                                            : isModerate
                                              ? tx('Moderate Risk', 'ملاحظات متوسطة')
                                              : tx('Flagged', 'مشتبه به')}
                                    </div>
                                </div>
                            </div>

                            {/* Answer Stats Strip */}
                            <div className={`grid grid-cols-2 ${unansweredQuestions.length > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3`}>
                                <div className={`p-3.5 rounded-2xl flex items-center gap-3 ${isBento ? 'bg-[#e0f2fe] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <HelpCircle className="w-5 h-5 shrink-0" />
                                    <div>
                                        <div className="text-[10px] font-black uppercase opacity-75">{tx('Questions', 'الأسئلة')}</div>
                                        <div className="text-base font-black">{questions.length || attempt.totalQuestions || 0}</div>
                                    </div>
                                </div>
                                <div className={`p-3.5 rounded-2xl flex items-center gap-3 ${isBento ? 'bg-[#d9f99d] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                                    <div>
                                        <div className="text-[10px] font-black uppercase opacity-75">{tx('Correct', 'صح')}</div>
                                        <div className="text-base font-black">{correctQuestions.length}</div>
                                    </div>
                                </div>
                                <div className={`p-3.5 rounded-2xl flex items-center gap-3 ${isBento ? 'bg-[#ffe4e6] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-red-500/10 border border-red-500/20'}`}>
                                    <XCircle className="w-5 h-5 shrink-0 text-red-700 dark:text-red-400" />
                                    <div>
                                        <div className="text-[10px] font-black uppercase opacity-75">{tx('Wrong', 'غلط')}</div>
                                        <div className="text-base font-black">{wrongQuestions.length}</div>
                                    </div>
                                </div>
                                {unansweredQuestions.length > 0 && (
                                    <div className={`p-3.5 rounded-2xl flex items-center gap-3 ${isBento ? 'bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                                        <MinusCircle className="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-400" />
                                        <div>
                                            <div className="text-[10px] font-black uppercase opacity-75">{tx('Skipped', 'متساب')}</div>
                                            <div className="text-base font-black">{unansweredQuestions.length}</div>
                                        </div>
                                    </div>
                                )}
                                <div className={`p-3.5 rounded-2xl flex items-center gap-3 ${isBento ? 'bg-[#f3e8ff] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-purple-500/10 border border-purple-500/20'}`}>
                                    <Clock className="w-5 h-5 shrink-0 text-purple-700 dark:text-purple-400" />
                                    <div>
                                        <div className="text-[10px] font-black uppercase opacity-75">{tx('Avg / Q', 'متوسط/سؤال')}</div>
                                        <div className="text-base font-black">{avgTimePerQ}s</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Telemetry Signals & Audit Event Stream */}
                        <div className={`p-5 sm:p-6 space-y-5 ${shellCardClass}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                            isBento
                                                ? isPristine
                                                    ? 'bg-[#bef264] border-2 border-black text-black'
                                                    : 'bg-[#fecdd3] border-2 border-black text-black'
                                                : 'bg-indigo-500/10 text-indigo-500'
                                        }`}
                                    >
                                        {isPristine ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black uppercase tracking-tight">
                                            {tx('Security Telemetry & Audit Timeline', 'سجل أحداث المراقبة والأمان')}
                                        </h3>
                                        <p className="text-xs font-semibold opacity-70">
                                            {events.length} {tx('recorded telemetry events during this session', 'حدث مسجل خلال الجلسة')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                <div className={`p-3.5 rounded-2xl ${isBento ? 'bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase opacity-75">
                                        <EyeOff className="w-3.5 h-3.5" /> {tx('Tab Switches', 'تغيير التاب')}
                                    </div>
                                    <div className="text-2xl font-black mt-1">{tabSwitches}</div>
                                </div>
                                <div className={`p-3.5 rounded-2xl ${isBento ? 'bg-[#fed7aa] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase opacity-75">
                                        <Activity className="w-3.5 h-3.5" /> {tx('Focus Loss', 'فقدان التركيز')}
                                    </div>
                                    <div className="text-2xl font-black mt-1">{focusLosses}</div>
                                </div>
                                <div className={`p-3.5 rounded-2xl ${isBento ? 'bg-[#fecdd3] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase opacity-75">
                                        <Copy className="w-3.5 h-3.5" /> {tx('Copy / Paste', 'نسخ/لصق')}
                                    </div>
                                    <div className="text-2xl font-black mt-1">{copyPastes}</div>
                                </div>
                                <div className={`p-3.5 rounded-2xl ${isBento ? 'bg-[#fce7f3] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase opacity-75">
                                        <AlertTriangle className="w-3.5 h-3.5" /> {tx('Fullscreen Exit', 'خروج شاشة كاملة')}
                                    </div>
                                    <div className="text-2xl font-black mt-1">{fullscreenExits}</div>
                                </div>
                                <div className={`p-3.5 rounded-2xl ${isBento ? 'bg-[#e0f2fe] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5'}`}>
                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase opacity-75">
                                        <Zap className="w-3.5 h-3.5" /> {tx('Rapid Guesses', 'حل متسرع')}
                                    </div>
                                    <div className="text-2xl font-black mt-1">{rapidGuesses}</div>
                                </div>
                            </div>

                            {events.length === 0 ? (
                                <div
                                    className={`p-6 rounded-2xl text-center text-xs font-bold ${
                                        isBento
                                            ? 'bg-[#d9f99d] border-2 border-black text-black'
                                            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                    }`}
                                >
                                    {tx('No suspicious events or focus interruptions recorded.', 'مفيش أي أحداث مشبوهة أو خروج من الامتحان متسجلة.')}
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pe-1">
                                    {events.map((evt, idx) => (
                                        <div
                                            key={idx}
                                            className={`px-3.5 py-2.5 rounded-xl font-mono text-xs flex items-center justify-between gap-3 ${
                                                isBento
                                                    ? 'bg-[#f5f3ec] border-2 border-black text-black font-bold'
                                                    : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2 min-w-0">
                                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                                <span className="truncate">
                                                    {evt.type === 'tab_hidden' && 'Switched Tab / Hidden'}
                                                    {evt.type === 'window_blur' && 'Window Focus Lost'}
                                                    {evt.type === 'copy_attempt' && 'Copied Question Content'}
                                                    {evt.type === 'paste_attempt' && 'Pasted Content'}
                                                    {evt.type === 'fullscreen_exit' && 'Exited Fullscreen Mode'}
                                                    {evt.type === 'rapid_guess' && `Rapid Guessing (${evt.details || '< 2s'})`}
                                                    {evt.type === 'context_menu' && 'Right-Click / Context Menu Blocked'}
                                                    {![
                                                        'tab_hidden',
                                                        'window_blur',
                                                        'copy_attempt',
                                                        'paste_attempt',
                                                        'fullscreen_exit',
                                                        'rapid_guess',
                                                        'context_menu'
                                                    ].includes(evt.type) && evt.type}
                                                    {evt.questionIndex !== undefined && ` — Q${evt.questionIndex + 1}`}
                                                </span>
                                            </span>
                                            <span className="text-[11px] opacity-75 shrink-0">
                                                {new Date(evt.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Question Breakdown Section */}
                        <div className={`p-5 sm:p-6 space-y-4 ${shellCardClass}`}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                                    <Filter className="w-4 h-4" />
                                    <span>{tx('Question-by-Question Breakdown', 'تحليل الإجابات سؤال بسؤال')}</span>
                                </h3>

                                <div className="flex flex-wrap items-center gap-2">
                                    {(
                                        [
                                            { id: 'all', label: tx(`All (${questions.length})`, `الكل (${questions.length})`), bentoBg: 'bg-[#bef264]' },
                                            { id: 'wrong', label: tx(`Wrong (${wrongQuestions.length})`, `غلط (${wrongQuestions.length})`), bentoBg: 'bg-[#fecdd3]' },
                                            { id: 'correct', label: tx(`Correct (${correctQuestions.length})`, `صح (${correctQuestions.length})`), bentoBg: 'bg-[#d9f99d]' },
                                            ...(unansweredQuestions.length > 0
                                                ? [{ id: 'unanswered', label: tx(`Skipped (${unansweredQuestions.length})`, `متساب (${unansweredQuestions.length})`), bentoBg: 'bg-[#fef08a]' }]
                                                : [])
                                        ] as { id: typeof filter; label: string; bentoBg: string }[]
                                    ).map((tab) => {
                                        const active = filter === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => setFilter(tab.id)}
                                                className={`btn-unstyled px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all ${
                                                    isBento
                                                        ? active
                                                            ? `${tab.bentoBg} text-black border-2 border-black shadow-[2px_2px_0px_#000]`
                                                            : 'bg-white text-black border-2 border-black/30 hover:border-black'
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
                                <div className="py-10 text-center text-sm font-bold opacity-70">
                                    {tx('No questions match this filter.', 'مفيش أسئلة مطابقة للفلتر ده.')}
                                </div>
                            ) : (
                                <div className="space-y-4">
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
                                                className={`p-4 sm:p-5 rounded-2xl space-y-3 ${
                                                    isBento
                                                        ? isCorrect
                                                            ? 'bg-[#f0fdf4] border-2 border-black shadow-[3px_3px_0px_#000]'
                                                            : isWrong
                                                              ? 'bg-[#fff1f2] border-2 border-black shadow-[3px_3px_0px_#000]'
                                                              : 'bg-[#fefce8] border-2 border-black shadow-[3px_3px_0px_#000]'
                                                        : 'bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10'
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span
                                                            className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
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
                                                            <span className="text-[11px] font-bold opacity-75">
                                                                {qTimeSec}s
                                                            </span>
                                                        )}
                                                        {qEvents.length > 0 && (
                                                            <span
                                                                className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                                                                    isBento
                                                                        ? 'bg-[#fde047] border border-black text-black'
                                                                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                                                                }`}
                                                            >
                                                                {qEvents.length} {tx('Security Flag', 'تنبيه')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-black uppercase">
                                                        {isCorrect
                                                            ? `+${q.points} pts`
                                                            : isWrong
                                                              ? '0 pts'
                                                              : tx('Skipped', 'متساب')}
                                                    </span>
                                                </div>

                                                <div className="text-sm sm:text-base font-bold leading-relaxed whitespace-pre-line">
                                                    <MathRenderer text={q.question} />
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                                    <div
                                                        className={`p-3 rounded-xl ${
                                                            isBento
                                                                ? 'bg-white border-2 border-black'
                                                                : 'bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10'
                                                        }`}
                                                    >
                                                        <div className="text-[10px] font-black uppercase opacity-70 mb-1">
                                                            {tx("Student's Answer", 'إجابة الطالب')}
                                                        </div>
                                                        <div className="font-bold">
                                                            <MathRenderer text={studentText} />
                                                        </div>
                                                    </div>
                                                    <div
                                                        className={`p-3 rounded-xl ${
                                                            isBento
                                                                ? 'bg-[#d9f99d] border-2 border-black'
                                                                : 'bg-emerald-500/10 border border-emerald-500/20'
                                                        }`}
                                                    >
                                                        <div className="text-[10px] font-black uppercase opacity-70 mb-1">
                                                            {tx('Correct Answer', 'الإجابة الصحيحة')}
                                                        </div>
                                                        <div className="font-bold">
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
                    </>
                )}
            </div>
        </div>
    );
};

export default ProctoringTelemetryPage;
