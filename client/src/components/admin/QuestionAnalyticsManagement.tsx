import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Search,
    HelpCircle,
    Sparkles,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    TrendingDown,
    Flame,
    BookOpen,
    Table
} from 'lucide-react';
import type { UserData, Quiz, QuestionAnalyticsItem, QuestionAnalyticsSummary } from '../../types';
import { api } from '../../lib/api';
import { MathRenderer } from '../common/MathRenderer';
import { exportQuestionAnalyticsToCSV } from '../../lib/exportUtils';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface QuestionAnalyticsManagementProps {
    currentUser?: UserData;
    quizzes?: Quiz[];
    onNotification?: (type: 'success' | 'error' | 'warning', message: string) => void;
}

const QuestionAnalyticsManagement: React.FC<QuestionAnalyticsManagementProps> = ({
    quizzes = [],
    onNotification
}) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const [questions, setQuestions] = useState<QuestionAnalyticsItem[]>([]);
    const [summary, setSummary] = useState<QuestionAnalyticsSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedQuizId, setSelectedQuizId] = useState<string>('all');
    const [failureThreshold, setFailureThreshold] = useState<'all' | 'high' | 'critical'>('all');
    const [expandedQuestionKey, setExpandedQuestionKey] = useState<string | null>(null);

    const loadAnalytics = useCallback(async () => {
        setIsLoading(true);
        try {
            const quizFilter = selectedQuizId !== 'all' ? selectedQuizId : undefined;
            const res = await api.getQuestionAnalytics(quizFilter);
            if (res.success) {
                setQuestions(res.questions || []);
                setSummary(res.summary || null);
            }
        } catch (error) {
            console.error('Failed to load question error analytics:', error);
            if (onNotification) {
                onNotification('error', 'Failed to load question error analytics');
            }
        } finally {
            setIsLoading(false);
        }
    }, [selectedQuizId, onNotification]);

    useEffect(() => {
        void loadAnalytics();
    }, [loadAnalytics]);

    const filteredQuestions = useMemo(() => {
        return questions.filter((q) => {
            if (failureThreshold === 'critical' && q.failureRate < 70) return false;
            if (failureThreshold === 'high' && q.failureRate < 40) return false;

            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
                q.questionText.toLowerCase().includes(term) ||
                q.quizTitle.toLowerCase().includes(term) ||
                q.quizCategory.toLowerCase().includes(term)
            );
        });
    }, [questions, failureThreshold, searchTerm]);

    const toggleExpand = (key: string) => {
        setExpandedQuestionKey((prev) => (prev === key ? null : key));
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header / Intro Banner */}
            <div
                className={`p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                    isBento
                        ? 'bg-white rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_#000]'
                        : 'rounded-[2.5rem] bg-red-500/10 dark:bg-red-950/30 border border-red-500/20 shadow-sm'
                }`}
            >
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                isBento
                                    ? 'bg-[#fecdd3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                            }`}
                        >
                            <AlertTriangle className="w-3 h-3" /> {tx('Error Diagnostic Hub', 'مركز تحليل الأخطاء')}
                        </span>
                    </div>
                    <h2
                        className={`text-xl sm:text-2xl font-black uppercase tracking-tight ${
                            isBento ? 'text-black' : 'text-gray-900 dark:text-white'
                        }`}
                    >
                        {tx('Question-Level Error & Misconception Analytics', 'تحليل أخطاء الأسئلة والمفاهيم المغلوطة')}
                    </h2>
                    <p
                        className={`text-xs font-medium max-w-2xl mt-1 ${
                            isBento ? 'text-slate-700 font-semibold' : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        {tx(
                            'Identify where students struggle the most. Pinpoint top failed questions, distractor traps, and analyze student response distributions to optimize quiz clarity and learning roads.',
                            'اعرف أكتر الأسئلة اللي الطلاب بيغلطوا فيها، الاختيارات المشتتة، وحلل نسب الإجابات عشان تحسن الكويزات.'
                        )}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => exportQuestionAnalyticsToCSV(filteredQuestions, summary)}
                        disabled={isLoading || filteredQuestions.length === 0}
                        className={`btn-unstyled px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50 ${
                            isBento
                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-sm'
                        }`}
                    >
                        <Table className="w-3.5 h-3.5" />
                        <span>{tx('Export CSV / Excel', 'تصدير CSV / Excel')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => void loadAnalytics()}
                        disabled={isLoading}
                        className={`btn-unstyled px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                            isBento
                                ? 'bg-[#fef08a] hover:bg-[#fde047] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 shadow-sm hover:scale-105 active:scale-95'
                        }`}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>{tx('Refresh', 'تحديث')}</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                    className={`p-5 ${
                        isBento
                            ? 'bg-[#ffe4e6] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('Avg Failure Rate', 'متوسط الخطأ')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-red-500/10 text-red-500'}`}>
                            <TrendingDown className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black ${isBento ? 'text-black' : 'text-red-600 dark:text-red-400'}`}>
                        {summary?.avgFailureRate ?? 0}%
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-gray-400'}`}>
                        {tx('Across all evaluated attempts', 'على كل المحاولات')}
                    </div>
                </div>

                <div
                    className={`p-5 ${
                        isBento
                            ? 'bg-[#d9f99d] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('Overall Accuracy', 'نسبة الدقة')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black ${isBento ? 'text-black' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {summary?.avgAccuracy ?? 0}%
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-gray-400'}`}>
                        {tx('Global student correct rate', 'معدل الإجابات الصح')}
                    </div>
                </div>

                <div
                    className={`p-5 ${
                        isBento
                            ? 'bg-[#ffedd5] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('Toughest Quiz', 'أصعب كويز')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-teal-500/10 text-teal-500'}`}>
                            <Flame className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-lg sm:text-xl font-black truncate ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                        {summary?.hardestQuiz?.title || tx('None', 'لا يوجد')}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-teal-500'}`}>
                        {summary?.hardestQuiz ? `${summary.hardestQuiz.averageFailureRate}% error rate` : tx('No data', 'مفيش بيانات')}
                    </div>
                </div>

                <div
                    className={`p-5 ${
                        isBento
                            ? 'bg-[#e0f2fe] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('Questions Analyzed', 'الأسئلة المحللة')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-indigo-500/10 text-indigo-500'}`}>
                            <HelpCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                        {summary?.totalQuestionsAnalyzed ?? 0}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-gray-400'}`}>
                        {tx('from', 'من')} {summary?.totalAttemptsAnalyzed ?? 0} {tx('total attempts', 'محاولة')}
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                {/* Search */}
                <div
                    className={`flex-1 px-4 py-2.5 flex items-center gap-3 ${
                        isBento
                            ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[4px_4px_0px_#000]'
                            : 'bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm'
                    }`}
                >
                    <Search className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-gray-400'}`} />
                    <input
                        type="text"
                        placeholder={tx('Search failed questions by text, quiz, or topic...', 'ابحث بنص السؤال أو الكويز...')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`chat-bare-input flex-1 bg-transparent border-none focus:ring-0 text-xs font-bold outline-none ${
                            isBento ? 'text-black placeholder:text-slate-500' : 'text-gray-900 dark:text-white placeholder:text-gray-400'
                        }`}
                    />
                </div>

                {/* Quiz Filter Selector */}
                <div
                    className={`min-w-[210px] px-4 py-2 flex items-center gap-2 ${
                        isBento
                            ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[4px_4px_0px_#000]'
                            : 'bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-white/5'
                    }`}
                >
                    <BookOpen className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-indigo-500'}`} />
                    <select
                        value={selectedQuizId}
                        onChange={(e) => setSelectedQuizId(e.target.value)}
                        className={`w-full !bg-transparent !border-none !shadow-none text-xs font-bold outline-none cursor-pointer ${
                            isBento ? 'text-black' : 'text-gray-900 dark:text-white'
                        }`}
                    >
                        <option value="all" className="dark:bg-[#1c1917]">
                            {tx('All Quizzes', 'كل الكويزات')}
                        </option>
                        {quizzes.map((q) => (
                            <option key={q.id} value={q.id} className="dark:bg-[#1c1917]">
                                {q.title}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Failure Rate Threshold Filter */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setFailureThreshold('all')}
                        className={`btn-unstyled px-3.5 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                            isBento
                                ? failureThreshold === 'all'
                                    ? 'bg-[#bef264] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-white hover:bg-[#fef9c3] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                : failureThreshold === 'all'
                                  ? 'bg-indigo-600 text-white rounded-2xl shadow-sm'
                                  : 'bg-white/70 dark:bg-[#141210]/70 text-gray-500 dark:text-gray-400 rounded-2xl border border-gray-200 dark:border-white/5'
                        }`}
                    >
                        {tx('All', 'الكل')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setFailureThreshold('high')}
                        className={`btn-unstyled px-3.5 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                            isBento
                                ? failureThreshold === 'high'
                                    ? 'bg-[#fde047] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-white hover:bg-[#fef9c3] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                : failureThreshold === 'high'
                                  ? 'bg-amber-500 text-white rounded-2xl shadow-sm'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20'
                        }`}
                    >
                        &gt; 40% Missed
                    </button>
                    <button
                        type="button"
                        onClick={() => setFailureThreshold('critical')}
                        className={`btn-unstyled px-3.5 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                            isBento
                                ? failureThreshold === 'critical'
                                    ? 'bg-[#fecdd3] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-white hover:bg-[#ffe4e6] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                : failureThreshold === 'critical'
                                  ? 'bg-red-600 text-white rounded-2xl shadow-sm'
                                  : 'bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl border border-red-500/20'
                        }`}
                    >
                        &gt; 70% Critical
                    </button>
                </div>
            </div>

            {/* Questions Leaderboard List */}
            {isLoading ? (
                <div
                    className={`py-20 text-center text-sm font-bold animate-pulse ${
                        isBento
                            ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000] text-black'
                            : 'text-gray-400'
                    }`}
                >
                    {tx('Computing error distributions and ranking questions...', 'بنحسب نسب الخطأ وبنرتب الأسئلة...')}
                </div>
            ) : filteredQuestions.length === 0 ? (
                <div
                    className={`py-20 text-center ${
                        isBento
                            ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'bg-white/50 dark:bg-white/5 rounded-[2.5rem] border border-gray-200 dark:border-white/5'
                    }`}
                >
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <h4 className={`text-base font-black uppercase tracking-tight ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                        {tx('No Problematic Questions Found', 'مفيش أسئلة فيها نسبة خطأ عالية')}
                    </h4>
                    <p className={`text-xs max-w-sm mx-auto mt-1 ${isBento ? 'text-slate-700 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                        {tx(
                            'Either no attempts match your current filters or all questions have great pass rates!',
                            'يا إما مفيش محاولات مطابقة للفلتر أو كل الأسئلة نسب نجاحها ممتازة!'
                        )}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredQuestions.map((q, rankIndex) => {
                        const isExpanded = expandedQuestionKey === q.key;
                        const isCritical = q.failureRate >= 70;
                        const isHigh = q.failureRate >= 40 && q.failureRate < 70;

                        return (
                            <div
                                key={q.key}
                                className={`transition-all overflow-hidden ${
                                    isBento
                                        ? isCritical
                                            ? 'bg-[#fff1f2] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                                            : isHigh
                                              ? 'bg-[#fefce8] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                                              : 'bg-white rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                                        : isCritical
                                          ? 'rounded-3xl border bg-red-50/30 dark:bg-red-950/10 border-red-200 dark:border-red-500/20 shadow-sm hover:shadow-md'
                                          : isHigh
                                            ? 'rounded-3xl border bg-amber-50/30 dark:bg-amber-950/10 border-amber-200 dark:border-amber-500/20 shadow-sm hover:shadow-md'
                                            : 'rounded-3xl border bg-white/70 dark:bg-[#141210]/70 border-gray-200 dark:border-white/5 shadow-sm hover:shadow-md'
                                }`}
                            >
                                {/* Main Question Card Row */}
                                <div
                                    onClick={() => toggleExpand(q.key)}
                                    className="p-5 sm:p-6 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                                >
                                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                        <div
                                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                                isBento
                                                    ? rankIndex === 0
                                                        ? 'bg-[#fecdd3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : rankIndex === 1
                                                          ? 'bg-[#fed7aa] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                          : 'bg-[#fef08a] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : rankIndex === 0
                                                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                                      : rankIndex === 1
                                                        ? 'bg-orange-500 text-white'
                                                        : rankIndex === 2
                                                          ? 'bg-amber-500 text-white'
                                                          : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            #{rankIndex + 1}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                        isBento
                                                            ? 'bg-[#fed7aa] text-black border border-black'
                                                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                                    }`}
                                                >
                                                    {q.quizTitle}
                                                </span>
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                        isBento
                                                            ? 'bg-slate-100 text-black border border-black/30'
                                                            : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                                                    }`}
                                                >
                                                    {q.quizCategory}
                                                </span>
                                                <span className={`text-[10px] font-bold ${isBento ? 'text-slate-700' : 'text-gray-400'}`}>
                                                    {q.totalAttempts} total attempts • {q.wrongCount} wrong
                                                </span>
                                            </div>

                                            <h4 className={`text-sm sm:text-base font-bold line-clamp-2 ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                                                <MathRenderer text={q.questionText} />
                                            </h4>

                                            {q.mostCommonWrongChoice && (
                                                <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${isBento ? 'text-rose-700' : 'text-red-600 dark:text-red-400'}`}>
                                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="truncate">
                                                        Top Misconception: <span className="font-black underline decoration-red-400/50">"{q.mostCommonWrongChoice}"</span> ({q.mostCommonWrongCount} students)
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-5 w-full md:w-auto justify-between md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-black/10 dark:border-white/5">
                                        <div className="text-right">
                                            <div className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isBento ? 'text-slate-700' : 'text-gray-400'}`}>
                                                Failure Rate
                                            </div>
                                            <div
                                                className={`text-2xl font-black ${
                                                    isBento
                                                        ? 'text-black'
                                                        : isCritical
                                                          ? 'text-red-600 dark:text-red-400'
                                                          : isHigh
                                                            ? 'text-amber-500'
                                                            : 'text-gray-700 dark:text-gray-300'
                                                }`}
                                            >
                                                {q.failureRate}%
                                            </div>
                                        </div>

                                        <div
                                            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                                isBento
                                                    ? 'bg-[#fef08a] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-gray-100 dark:bg-white/5 text-gray-400'
                                            }`}
                                        >
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Diagnostics Drawer */}
                                {isExpanded && (
                                    <div
                                        className={`p-5 sm:p-6 space-y-5 animate-in slide-in-from-top-2 duration-150 ${
                                            isBento
                                                ? 'border-t-[2.5px] border-black bg-[#f5f3ec]'
                                                : 'border-t border-gray-200/60 dark:border-white/5 bg-white/40 dark:bg-black/20'
                                        }`}
                                    >
                                        {Array.isArray(q.optionDistribution) && q.optionDistribution.length > 0 && (
                                            <div>
                                                <h5 className={`text-[10px] font-black uppercase tracking-widest mb-2.5 ${isBento ? 'text-black' : 'text-gray-400'}`}>
                                                    Option Choice Distribution (% of students who selected each option)
                                                </h5>
                                                <div className="space-y-2">
                                                    {q.optionDistribution.map((opt) => (
                                                        <div
                                                            key={opt.optionIndex}
                                                            className={`p-3 rounded-2xl flex flex-col gap-1.5 ${
                                                                isBento
                                                                    ? opt.isCorrect
                                                                        ? 'bg-[#d9f99d] border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                        : opt.isTopMisconception
                                                                          ? 'bg-[#fecdd3] border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                          : 'bg-white border-2 border-black'
                                                                    : opt.isCorrect
                                                                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                                                                      : opt.isTopMisconception
                                                                        ? 'bg-red-500/10 border border-red-500/30'
                                                                        : 'bg-white/60 dark:bg-white/5 border border-gray-200/50 dark:border-white/5'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2 text-xs font-bold">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span
                                                                        className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                                                                            isBento ? 'bg-white border border-black text-black' : 'bg-black/10 dark:bg-white/10'
                                                                        }`}
                                                                    >
                                                                        {String.fromCharCode(65 + opt.optionIndex)}
                                                                    </span>
                                                                    <span className={`truncate ${isBento ? 'text-black' : 'text-gray-900 dark:text-gray-100'}`}>
                                                                        {opt.text}
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    {opt.isCorrect && (
                                                                        <span
                                                                            className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                                                                isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-emerald-500 text-white'
                                                                            }`}
                                                                        >
                                                                            <CheckCircle2 className="w-2.5 h-2.5" /> Correct Answer
                                                                        </span>
                                                                    )}
                                                                    {opt.isTopMisconception && (
                                                                        <span
                                                                            className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                                                                isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-red-500 text-white'
                                                                            }`}
                                                                        >
                                                                            <AlertTriangle className="w-2.5 h-2.5" /> Top Trap ({opt.count} picked)
                                                                        </span>
                                                                    )}
                                                                    <span className={`text-xs font-black ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                                                                        {opt.percentage}% ({opt.count})
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className={`w-full h-2.5 rounded-full overflow-hidden ${isBento ? 'bg-white border border-black' : 'bg-gray-200 dark:bg-white/10'}`}>
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                                        isBento
                                                                            ? opt.isCorrect
                                                                                ? 'bg-[#22c55e]'
                                                                                : opt.isTopMisconception
                                                                                  ? 'bg-[#ef4444]'
                                                                                  : 'bg-black'
                                                                            : opt.isCorrect
                                                                              ? 'bg-emerald-500'
                                                                              : opt.isTopMisconception
                                                                                ? 'bg-red-500'
                                                                                : 'bg-gray-400 dark:bg-gray-600'
                                                                    }`}
                                                                    style={{ width: `${opt.percentage}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {q.explanation && (
                                            <div
                                                className={`p-4 rounded-2xl flex items-start gap-3 ${
                                                    isBento
                                                        ? 'bg-[#e0f2fe] border-2 border-black text-black'
                                                        : 'bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/15'
                                                }`}
                                            >
                                                <Sparkles className={`w-4 h-4 shrink-0 mt-0.5 ${isBento ? 'text-black' : 'text-indigo-500'}`} />
                                                <div className="w-full">
                                                    <div className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isBento ? 'text-black' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                        Reference Guide / Explanation
                                                    </div>
                                                    <MathRenderer
                                                        text={q.explanation}
                                                        className={`text-xs font-medium leading-relaxed ${isBento ? 'text-black font-semibold' : 'text-gray-600 dark:text-gray-300'}`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default QuestionAnalyticsManagement;
