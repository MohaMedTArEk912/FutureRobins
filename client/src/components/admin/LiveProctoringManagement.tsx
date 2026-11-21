import React, { useState, useEffect, useCallback } from 'react';
import {
    ShieldCheck,
    ShieldAlert,
    AlertTriangle,
    EyeOff,
    Activity,
    Copy,
    RefreshCw,
    Search,
    Clock,
    Zap,
    ExternalLink
} from 'lucide-react';
import type { LiveProctoringResponse } from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface LiveProctoringManagementProps {
    onNotification?: (type: 'success' | 'error' | 'warning', message: string) => void;
}

const LiveProctoringManagement: React.FC<LiveProctoringManagementProps> = ({
    onNotification
}) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const [data, setData] = useState<LiveProctoringResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'moderate' | 'clean'>('all');

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.getLiveProctoringData();
            if (res.success) {
                setData(res);
            }
        } catch (err: unknown) {
            console.error('Failed to load proctoring data:', err);
            if (onNotification) {
                onNotification('error', 'Failed to load live proctoring telemetry data');
            }
        } finally {
            setIsLoading(false);
        }
    }, [onNotification]);

    useEffect(() => {
        void loadData();
        const interval = setInterval(() => {
            void loadData();
        }, 15000);
        return () => clearInterval(interval);
    }, [loadData]);

    const summary = data?.summary;
    const allSessions = data?.sessions || [];

    const filteredSessions = allSessions.filter((s) => {
        const matchesSearch =
            s.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.quizTitle.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesRisk =
            riskFilter === 'all' ||
            (riskFilter === 'high' && s.riskLevel === 'high') ||
            (riskFilter === 'moderate' && s.riskLevel === 'moderate') ||
            (riskFilter === 'clean' && s.riskLevel === 'clean');

        return matchesSearch && matchesRisk;
    });

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div
                className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 transition-all ${
                    isBento
                        ? 'bg-white rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_#000]'
                        : 'bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm'
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
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                            {tx('Live Exam Security Center', 'مركز أمان الامتحانات المباشر')}
                        </span>
                    </div>
                    <h2
                        className={`text-xl sm:text-2xl font-black uppercase tracking-tight ${
                            isBento ? 'text-black' : 'text-gray-900 dark:text-white'
                        }`}
                    >
                        {tx('Real-Time Proctoring & Integrity Telemetry', 'مراقبة الامتحانات وتتبع النزاهة لحظياً')}
                    </h2>
                    <p
                        className={`text-xs font-medium max-w-2xl mt-1 ${
                            isBento ? 'text-slate-700 font-semibold' : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        {tx(
                            'Live surveillance of student exam sessions. Detect tab switching, window focus loss, clipboard copying, fullscreen exits, and rapid response rushing in real time.',
                            'متابعة لحظية لجلسات الامتحان وكشف تبديل التابات أو النسخ أو التسرع في الإجابات.'
                        )}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => void loadData()}
                    disabled={isLoading}
                    className={`btn-unstyled px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                        isBento
                            ? 'bg-[#fef08a] hover:bg-[#fde047] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] active:translate-y-0.5'
                            : 'bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 shadow-sm hover:scale-105 active:scale-95'
                    }`}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>{tx('Live Refresh', 'تحديث مباشر')}</span>
                </button>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                    className={`p-5 transition-all ${
                        isBento
                            ? 'bg-[#d9f99d] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('Avg Integrity', 'متوسط النزاهة')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black ${isBento ? 'text-black' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {summary?.avgIntegrityScore ?? 100}%
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-gray-400'}`}>
                        {summary?.cleanCount ?? 0} {tx('pristine sessions', 'جلسات سليمة')}
                    </div>
                </div>

                <div
                    className={`p-5 transition-all ${
                        isBento
                            ? 'bg-[#ffe4e6] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('High Risk Flags', 'تنبيهات خطيرة')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-red-500/10 text-red-500'}`}>
                            <ShieldAlert className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black ${isBento ? 'text-black' : 'text-red-600 dark:text-red-400'}`}>
                        {summary?.highRiskCount ?? 0}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-red-500'}`}>
                        {tx('Score < 70% integrity', 'نزاهة أقل من 70%')}
                    </div>
                </div>

                <div
                    className={`p-5 transition-all ${
                        isBento
                            ? 'bg-[#fef9c3] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('Tab Switches', 'تغيير التاب')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-amber-500/10 text-amber-500'}`}>
                            <EyeOff className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black ${isBento ? 'text-black' : 'text-amber-600 dark:text-amber-400'}`}>
                        {summary?.totalTabSwitches ?? 0}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-gray-400'}`}>
                        {tx('Total focus losses:', 'فقدان التركيز:')} {summary?.totalFocusLosses ?? 0}
                    </div>
                </div>

                <div
                    className={`p-5 transition-all ${
                        isBento
                            ? 'bg-[#e0f2fe] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('Rushing Flags', 'حل متسرع')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-indigo-500/10 text-indigo-500'}`}>
                            <Zap className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black ${isBento ? 'text-black' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {summary?.totalRapidGuesses ?? 0}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-gray-400'}`}>
                        {tx('Answers < 1.8 seconds', 'إجابات أسرع من 1.8 ثانية')}
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                <div
                    className={`flex-1 flex items-center gap-3 px-4 py-2.5 ${
                        isBento
                            ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[4px_4px_0px_#000]'
                            : 'bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm'
                    }`}
                >
                    <Search className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-gray-400'}`} />
                    <input
                        type="text"
                        placeholder={tx('Search student by name, email, or quiz...', 'ابحث بالطالب أو الإيميل أو اسم الكويز...')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`chat-bare-input flex-1 bg-transparent border-none focus:ring-0 text-xs font-bold outline-none ${
                            isBento ? 'text-black placeholder:text-slate-500' : 'text-gray-900 dark:text-white placeholder:text-gray-400'
                        }`}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setRiskFilter('all')}
                        className={`btn-unstyled px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                            isBento
                                ? riskFilter === 'all'
                                    ? 'bg-[#bef264] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-white hover:bg-[#fef9c3] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                : riskFilter === 'all'
                                  ? 'bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-500/30'
                                  : 'bg-white/70 dark:bg-[#141210]/70 text-gray-600 dark:text-gray-400 rounded-2xl border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10'
                        }`}
                    >
                        {tx('All', 'الكل')} ({allSessions.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setRiskFilter('high')}
                        className={`btn-unstyled px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                            isBento
                                ? riskFilter === 'high'
                                    ? 'bg-[#fecdd3] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-white hover:bg-[#ffe4e6] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                : riskFilter === 'high'
                                  ? 'bg-red-600 text-white rounded-2xl shadow-md shadow-red-500/30'
                                  : 'bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl border border-red-500/20 hover:bg-red-500/20'
                        }`}
                    >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {tx('High Risk', 'خطر عالي')} ({summary?.highRiskCount ?? 0})
                    </button>

                    <button
                        type="button"
                        onClick={() => setRiskFilter('moderate')}
                        className={`btn-unstyled px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                            isBento
                                ? riskFilter === 'moderate'
                                    ? 'bg-[#fde047] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-white hover:bg-[#fef9c3] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                : riskFilter === 'moderate'
                                  ? 'bg-amber-600 text-white rounded-2xl shadow-md shadow-amber-500/30'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20 hover:bg-amber-500/20'
                        }`}
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {tx('Moderate', 'متوسط')} ({summary?.moderateCount ?? 0})
                    </button>

                    <button
                        type="button"
                        onClick={() => setRiskFilter('clean')}
                        className={`btn-unstyled px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                            isBento
                                ? riskFilter === 'clean'
                                    ? 'bg-[#d9f99d] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-white hover:bg-[#ecfccb] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                : riskFilter === 'clean'
                                  ? 'bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-500/30'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                    >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {tx('Pristine', 'سليم')} ({summary?.cleanCount ?? 0})
                    </button>
                </div>
            </div>

            {/* Live Proctoring Grid */}
            {isLoading ? (
                <div
                    className={`py-20 text-center text-sm font-bold animate-pulse ${
                        isBento
                            ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000] text-black'
                            : 'text-gray-400'
                    }`}
                >
                    {tx('Scanning active exam sessions and telemetry streams...', 'بنفحص جلسات الامتحان وبيانات النزاهة...')}
                </div>
            ) : filteredSessions.length === 0 ? (
                <div
                    className={`py-20 text-center ${
                        isBento
                            ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'bg-white/70 dark:bg-[#141210]/70 rounded-3xl border border-gray-200 dark:border-white/5'
                    }`}
                >
                    <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className={`text-sm font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                        {riskFilter === 'high'
                            ? tx('No High Risk Breaches Detected!', 'مفيش أي مخالفات عالية الخطورة!')
                            : tx('No Exam Sessions Found.', 'مفيش جلسات امتحان متسجلة.')}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredSessions.map((s) => {
                        const tel = s.telemetry;
                        const integrity = tel.integrityScore ?? 100;
                        const isHighRisk = s.riskLevel === 'high';
                        const isModerate = s.riskLevel === 'moderate';
                        const inspectHref = `/admin/proctoring/${encodeURIComponent(s.attemptId)}`;

                        return (
                            <div
                                key={s.attemptId}
                                className={`p-5 sm:p-6 transition-all flex flex-col justify-between gap-4 ${
                                    isBento
                                        ? isHighRisk
                                            ? 'bg-[#fff1f2] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_#000]'
                                            : isModerate
                                              ? 'bg-[#fefce8] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_#000]'
                                              : 'bg-white rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_#000]'
                                        : isHighRisk
                                          ? 'rounded-3xl border bg-red-50/50 dark:bg-red-950/15 border-red-300 dark:border-red-500/30 hover:shadow-lg'
                                          : isModerate
                                            ? 'rounded-3xl border bg-amber-50/50 dark:bg-amber-950/15 border-amber-300 dark:border-amber-500/30 hover:shadow-lg'
                                            : 'rounded-3xl border bg-white/70 dark:bg-[#141210]/70 border-gray-200 dark:border-white/5 hover:shadow-lg'
                                }`}
                            >
                                <div>
                                    {/* Student Header */}
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider truncate max-w-[200px] ${
                                                        isBento
                                                            ? 'bg-[#fed7aa] text-black border border-black'
                                                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                                    }`}
                                                >
                                                    {s.quizTitle}
                                                </span>
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                        isBento
                                                            ? s.passed
                                                                ? 'bg-[#bef264] text-black border border-black'
                                                                : 'bg-[#fecdd3] text-black border border-black'
                                                            : s.passed
                                                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                                    }`}
                                                >
                                                    {s.passed ? tx('Passed', 'ناجح') : tx('Failed', 'راسب')} ({s.percentage}%)
                                                </span>
                                            </div>
                                            <h4 className={`text-base font-black truncate ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                                                {s.userName}
                                            </h4>
                                            <p className={`text-xs truncate ${isBento ? 'text-slate-600 font-semibold' : 'text-gray-400'}`}>
                                                {s.userEmail}
                                            </p>
                                        </div>

                                        {/* Integrity Gauge Badge */}
                                        <div className="text-right shrink-0">
                                            <div
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                                    isBento
                                                        ? isHighRisk
                                                            ? 'bg-[#fecdd3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                            : isModerate
                                                              ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                              : 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : isHighRisk
                                                          ? 'bg-red-500 text-white border border-red-600 shadow-sm shadow-red-500/25'
                                                          : isModerate
                                                            ? 'bg-amber-500 text-white border border-amber-600 shadow-sm shadow-amber-500/25'
                                                            : 'bg-emerald-500 text-white border border-emerald-600 shadow-sm shadow-emerald-500/25'
                                                }`}
                                            >
                                                {isHighRisk ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                                <span>{integrity}% Integrity</span>
                                            </div>
                                            <div className={`text-[10px] font-bold mt-1.5 ${isBento ? 'text-slate-600' : 'text-gray-400'}`}>
                                                {new Date(s.completedAt).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Security Event Pills */}
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        <span
                                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 ${
                                                isBento
                                                    ? tel.tabSwitches > 0
                                                        ? 'bg-[#fde047] text-black border-2 border-black'
                                                        : 'bg-slate-100 text-slate-700 border border-black/25'
                                                    : tel.tabSwitches > 0
                                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                                      : 'bg-black/5 dark:bg-white/5 text-gray-500'
                                            }`}
                                        >
                                            <EyeOff className="w-3 h-3" /> {tel.tabSwitches} {tx('Tab Switches', 'تغيير التاب')}
                                        </span>

                                        <span
                                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 ${
                                                isBento
                                                    ? tel.focusLossCount > 0
                                                        ? 'bg-[#fed7aa] text-black border-2 border-black'
                                                        : 'bg-slate-100 text-slate-700 border border-black/25'
                                                    : tel.focusLossCount > 0
                                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                                      : 'bg-black/5 dark:bg-white/5 text-gray-500'
                                            }`}
                                        >
                                            <Activity className="w-3 h-3" /> {tel.focusLossCount} {tx('Focus Loss', 'فقدان تركيز')}
                                        </span>

                                        {(tel.copyPasteAttempts || 0) > 0 && (
                                            <span
                                                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 ${
                                                    isBento
                                                        ? 'bg-[#fecdd3] text-black border-2 border-black'
                                                        : 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30'
                                                }`}
                                            >
                                                <Copy className="w-3 h-3" /> {tel.copyPasteAttempts} Copy/Paste
                                            </span>
                                        )}

                                        {(tel.fullscreenExits || 0) > 0 && (
                                            <span
                                                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 ${
                                                    isBento
                                                        ? 'bg-[#fecdd3] text-black border-2 border-black'
                                                        : 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30'
                                                }`}
                                            >
                                                <AlertTriangle className="w-3 h-3" /> {tel.fullscreenExits} Fullscreen Exits
                                            </span>
                                        )}

                                        {(tel.rapidGuesses || 0) > 0 && (
                                            <span
                                                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 ${
                                                    isBento
                                                        ? 'bg-[#e0f2fe] text-black border-2 border-black'
                                                        : 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30'
                                                }`}
                                            >
                                                <Zap className="w-3 h-3" /> {tel.rapidGuesses} Rushed (&lt;2s)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Action -> Opens Dedicated Telemetry Inspector Page in Blank Tab */}
                                <div
                                    className={`pt-3 flex items-center justify-between ${
                                        isBento ? 'border-t-2 border-black/15' : 'border-t border-gray-200/50 dark:border-white/5'
                                    }`}
                                >
                                    <span className={`text-[11px] font-bold flex items-center gap-1 ${isBento ? 'text-slate-700' : 'text-gray-400'}`}>
                                        <Clock className="w-3 h-3" />
                                        {tx('Duration:', 'المدة:')} {Math.floor(s.timeTaken / 60)}m {s.timeTaken % 60}s
                                    </span>

                                    <a
                                        href={inspectHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`px-3.5 py-1.5 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer no-underline ${
                                            isBento
                                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] hover:-translate-y-0.5'
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/20'
                                        }`}
                                    >
                                        <span>{tx('Inspect Telemetry', 'فحص التفاصيل')}</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LiveProctoringManagement;
