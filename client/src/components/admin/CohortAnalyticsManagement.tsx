import React, { useState, useEffect, useCallback } from 'react';
import {
    Users,
    TrendingUp,
    TrendingDown,
    Award,
    AlertTriangle,
    RefreshCw,
    Search,
    BookOpen,
    Layers,
    UserCheck
} from 'lucide-react';
import type { CohortAnalyticsResponse } from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface CohortAnalyticsManagementProps {
    onNotification?: (type: 'success' | 'error' | 'warning', message: string) => void;
}

const CohortAnalyticsManagement: React.FC<CohortAnalyticsManagementProps> = ({
    onNotification
}) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const [data, setData] = useState<CohortAnalyticsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTier, setSelectedTier] = useState<'high' | 'medium' | 'atRisk'>('atRisk');
    const [searchTerm, setSearchTerm] = useState('');

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.getCohortAnalytics();
            if (res.success) {
                setData(res);
            }
        } catch (err: unknown) {
            console.error('Failed to load cohort analytics:', err);
            if (onNotification) {
                onNotification('error', 'Failed to load cohort analytics data');
            }
        } finally {
            setIsLoading(false);
        }
    }, [onNotification]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const summary = data?.summary;
    const levelCohorts = summary?.levelCohorts || [];
    const performanceTiers = summary?.performanceTiers;
    const categoryPerformance = summary?.categoryPerformance || [];

    const activeTierUsers = performanceTiers?.[selectedTier]?.users || [];
    const filteredTierUsers = activeTierUsers.filter((u) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
            (u.name || '').toLowerCase().includes(term) ||
            (u.email || '').toLowerCase().includes(term)
        );
    });

    const cardSurface = isBento
        ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
        : 'bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm';

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div
                className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 ${
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
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                            }`}
                        >
                            <Layers className="w-3 h-3" />
                            {tx('Group & Cohort Intelligence', 'تحليل المجموعات والمستويات')}
                        </span>
                    </div>
                    <h2 className={`text-xl sm:text-2xl font-black uppercase tracking-tight ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                        {tx('Student Cohort & Tier Performance Analytics', 'تحليل أداء الطلاب والفئات')}
                    </h2>
                    <p className={`text-xs font-medium max-w-2xl mt-1 ${isBento ? 'text-slate-700 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                        {tx(
                            'Compare learning trends across student cohorts. Evaluate high performers vs. at-risk learners, assess level progression, and monitor category pass rates.',
                            'قارن مستويات الطلاب بين المتفوقين واللي محتاجين متابعة، وتابع نسب النجاح في كل مجال.'
                        )}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => void loadData()}
                    disabled={isLoading}
                    className={`btn-unstyled px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                        isBento
                            ? 'bg-[#fef08a] hover:bg-[#fde047] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                            : 'bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 shadow-sm hover:scale-105 active:scale-95'
                    }`}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>{tx('Refresh Data', 'تحديث البيانات')}</span>
                </button>
            </div>

            {/* KPI Summary Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`p-5 ${isBento ? 'bg-[#e0f2fe] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]' : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('Total Students', 'إجمالي الطلاب')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-indigo-500/10 text-indigo-500'}`}>
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                        {summary?.totalStudents ?? 0}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-gray-400'}`}>
                        {tx('from', 'من')} {summary?.totalAttemptsEvaluated ?? 0} {tx('total attempts', 'محاولة')}
                    </div>
                </div>

                <div className={`p-5 ${isBento ? 'bg-[#d9f99d] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]' : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('High Performers', 'المتفوقون')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black ${isBento ? 'text-black' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {performanceTiers?.high?.count ?? 0} {tx('Students', 'طالب')}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-emerald-500'}`}>
                        {tx('Average score ≥ 80%', 'المتوسط ≥ 80%')}
                    </div>
                </div>

                <div className={`p-5 ${isBento ? 'bg-[#ffedd5] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]' : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('Proficient Learners', 'مستوى متوسط')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-blue-500/10 text-blue-500'}`}>
                            <UserCheck className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black ${isBento ? 'text-black' : 'text-blue-600 dark:text-blue-400'}`}>
                        {performanceTiers?.medium?.count ?? 0} {tx('Students', 'طالب')}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-blue-500'}`}>
                        {tx('Average score 60-79%', 'المتوسط 60-79%')}
                    </div>
                </div>

                <div className={`p-5 ${isBento ? 'bg-[#ffe4e6] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]' : 'rounded-3xl bg-white/70 dark:bg-[#141210]/70 backdrop-blur-xl border border-gray-200/70 dark:border-white/5 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>
                            {tx('Needs Attention', 'يحتاج متابعة')}
                        </span>
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-red-500/10 text-red-500'}`}>
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black ${isBento ? 'text-black' : 'text-red-600 dark:text-red-400'}`}>
                        {performanceTiers?.atRisk?.count ?? 0} {tx('Students', 'طالب')}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${isBento ? 'text-black/80' : 'text-red-500'}`}>
                        {tx('Average score < 60%', 'المتوسط < 60%')}
                    </div>
                </div>
            </div>

            {/* Level Cohort Progression Cards */}
            <div className={`${cardSurface} p-6 space-y-4`}>
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${isBento ? 'bg-[#fde047] border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'text-indigo-500'}`}>
                        <Award className="w-5 h-5" />
                    </div>
                    <h3 className={`text-base font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                        {tx('Experience & Gamification Cohorts', 'فئات الخبرة والمستويات')}
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {levelCohorts.map((cohort, idx) => (
                        <div
                            key={idx}
                            className={`p-5 rounded-2xl space-y-3 ${
                                isBento
                                    ? 'bg-[#f5f3ec] border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-gray-50/80 dark:bg-black/20 border border-gray-200/60 dark:border-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-black uppercase tracking-wide ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                                    {cohort.name}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                                    {cohort.users} Students
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <div className={`text-[9px] font-bold uppercase ${isBento ? 'text-slate-600' : 'text-gray-400'}`}>Avg Score</div>
                                    <div className={`text-lg font-black ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>{cohort.avgScore}%</div>
                                </div>
                                <div>
                                    <div className={`text-[9px] font-bold uppercase ${isBento ? 'text-slate-600' : 'text-gray-400'}`}>Pass Rate</div>
                                    <div className={`text-lg font-black ${isBento ? 'text-black' : 'text-emerald-600 dark:text-emerald-400'}`}>{cohort.passRate}%</div>
                                </div>
                            </div>

                            <div className={`w-full h-2.5 rounded-full overflow-hidden ${isBento ? 'bg-white border border-black' : 'bg-gray-200 dark:bg-white/10'}`}>
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${isBento ? 'bg-[#bef264]' : 'bg-indigo-600'}`}
                                    style={{ width: `${cohort.passRate}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Performance Tier Explorer */}
            <div className={`${cardSurface} p-6 space-y-4`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${isBento ? 'bg-[#bae6fd] border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'text-indigo-500'}`}>
                            <TrendingDown className="w-5 h-5" />
                        </div>
                        <h3 className={`text-base font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                            {tx('Performance Tier Roster', 'قائمة مستويات الأداء')}
                        </h3>
                    </div>

                    {/* Tier Switcher Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedTier('atRisk')}
                            className={`btn-unstyled px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                isBento
                                    ? selectedTier === 'atRisk'
                                        ? 'bg-[#fecdd3] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-white hover:bg-[#ffe4e6] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : selectedTier === 'atRisk'
                                      ? 'bg-red-600 text-white rounded-xl shadow-md shadow-red-500/25'
                                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-xl'
                            }`}
                        >
                            {tx('Needs Attention', 'يحتاج متابعة')} ({performanceTiers?.atRisk?.count ?? 0})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedTier('medium')}
                            className={`btn-unstyled px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                isBento
                                    ? selectedTier === 'medium'
                                        ? 'bg-[#bae6fd] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-white hover:bg-[#e0f2fe] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : selectedTier === 'medium'
                                      ? 'bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/25'
                                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-xl'
                            }`}
                        >
                            {tx('Proficient', 'متوسط')} ({performanceTiers?.medium?.count ?? 0})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedTier('high')}
                            className={`btn-unstyled px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                isBento
                                    ? selectedTier === 'high'
                                        ? 'bg-[#bef264] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-white hover:bg-[#ecfccb] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : selectedTier === 'high'
                                      ? 'bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-500/25'
                                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-xl'
                            }`}
                        >
                            {tx('High Performers', 'متفوقون')} ({performanceTiers?.high?.count ?? 0})
                        </button>
                    </div>
                </div>

                {/* Single-Border Search Bar */}
                <div
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                        isBento
                            ? 'bg-[#f5f3ec] rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                            : 'bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl'
                    }`}
                >
                    <Search className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-gray-400'}`} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={tx('Search student by name or email in this tier...', 'ابحث بالطالب أو الإيميل في الفئة دي...')}
                        className={`chat-bare-input flex-1 bg-transparent border-none text-xs font-bold outline-none ${
                            isBento ? 'text-black placeholder:text-slate-500' : 'text-gray-900 dark:text-white placeholder:text-gray-400'
                        }`}
                    />
                </div>

                {/* Tier Student List */}
                <div className="space-y-2">
                    {filteredTierUsers.length === 0 ? (
                        <div className={`py-12 text-center text-xs font-bold ${isBento ? 'text-slate-700' : 'text-gray-400'}`}>
                            {tx('No students currently in this performance cohort.', 'مفيش طلاب حالياً في الفئة دي.')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {filteredTierUsers.map((u) => (
                                <div
                                    key={u.userId}
                                    className={`p-4 rounded-2xl flex items-center justify-between gap-3 ${
                                        isBento
                                            ? 'bg-[#f5f3ec] border-2 border-black shadow-[3px_3px_0px_#000]'
                                            : 'bg-gray-50/80 dark:bg-black/20 border border-gray-200/50 dark:border-white/5'
                                    }`}
                                >
                                    <div className="min-w-0">
                                        <div className={`text-xs font-black truncate ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                                            {u.name}
                                        </div>
                                        <div className={`text-[10px] truncate ${isBento ? 'text-slate-600 font-semibold' : 'text-gray-400'}`}>
                                            {u.email}
                                        </div>
                                        <div className={`text-[9px] font-bold mt-1 ${isBento ? 'text-slate-700' : 'text-gray-400'}`}>
                                            Level {u.level} • {u.attempts} attempts
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span
                                            className={`px-2 py-0.5 rounded-lg text-sm font-black inline-block ${
                                                isBento
                                                    ? u.avgScore >= 80
                                                        ? 'bg-[#bef264] text-black border border-black'
                                                        : u.avgScore >= 60
                                                          ? 'bg-[#bae6fd] text-black border border-black'
                                                          : 'bg-[#fecdd3] text-black border border-black'
                                                    : u.avgScore >= 80
                                                      ? 'text-emerald-500'
                                                      : u.avgScore >= 60
                                                        ? 'text-blue-500'
                                                        : 'text-red-500'
                                            }`}
                                        >
                                            {u.avgScore}%
                                        </span>
                                        <div className={`text-[9px] font-bold mt-0.5 ${isBento ? 'text-slate-600' : 'text-gray-400'}`}>Avg Score</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Category Mastery Table */}
            <div className={`${cardSurface} p-6 space-y-4`}>
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${isBento ? 'bg-[#fed7aa] border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'text-indigo-500'}`}>
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <h3 className={`text-base font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                        {tx('Topic & Category Mastery Matrix', 'مصفوفة إتقان المواضيع والتخصصات')}
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryPerformance.map((cat, cIdx) => (
                        <div
                            key={cIdx}
                            className={`p-4 rounded-2xl flex items-center justify-between gap-4 ${
                                isBento
                                    ? 'bg-[#f5f3ec] border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-gray-50/80 dark:bg-black/20 border border-gray-200/50 dark:border-white/5'
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className={`text-xs font-black truncate mb-1.5 ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                                    {cat.category}
                                </div>
                                <div className={`w-full h-2.5 rounded-full overflow-hidden ${isBento ? 'bg-white border border-black' : 'bg-gray-200 dark:bg-white/10'}`}>
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            isBento
                                                ? cat.passRate >= 75
                                                    ? 'bg-[#22c55e]'
                                                    : cat.passRate >= 50
                                                      ? 'bg-[#facc15]'
                                                      : 'bg-[#ef4444]'
                                                : cat.passRate >= 75
                                                  ? 'bg-emerald-500'
                                                  : cat.passRate >= 50
                                                    ? 'bg-amber-500'
                                                    : 'bg-red-500'
                                        }`}
                                        style={{ width: `${cat.passRate}%` }}
                                    />
                                </div>
                                <div className={`text-[10px] font-bold mt-1.5 ${isBento ? 'text-slate-700' : 'text-gray-400'}`}>
                                    {cat.totalAttempts} attempts evaluated
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <div className={`text-sm font-black ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                                    {cat.avgScore}% Avg
                                </div>
                                <div
                                    className={`text-[10px] font-black ${
                                        isBento
                                            ? 'text-slate-800'
                                            : cat.passRate >= 75
                                              ? 'text-emerald-500'
                                              : cat.passRate >= 50
                                                ? 'text-amber-500'
                                                : 'text-red-500'
                                    }`}
                                >
                                    {cat.passRate}% Pass Rate
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CohortAnalyticsManagement;
