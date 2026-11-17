import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    BarChart3, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
    Clock, Users, Activity, Search, Bell, Send, Download, ShieldAlert,
    BookOpen, Flame, Sparkles, Filter
} from 'lucide-react';
import type {
    Clan,
    UserData,
    ClassAnalyticsResponse,
    ClassStudentAnalyticsItem
} from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import Avatar from '../Avatar';

interface ClassAnalyticsLogsSectionProps {
    clan: Clan;
    user: UserData;
    onOpenAiCoach?: (prefill: { students: ClassStudentAnalyticsItem[]; weakTopics: ClassAnalyticsResponse['weakTopics'] }) => void;
}

type AnalyticsSubTab = 'overview' | 'students' | 'logs';

export const ClassAnalyticsLogsSection: React.FC<ClassAnalyticsLogsSectionProps> = ({
    clan,
    user,
    onOpenAiCoach
}) => {
    const { isBento } = useTheme();
    const { showNotification } = useNotification();

    const [data, setData] = useState<ClassAnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [subTab, setSubTab] = useState<AnalyticsSubTab>('overview');

    // Student performance filters & selected inline dossier
    const [studentSearch, setStudentSearch] = useState('');
    const [riskFilter, setRiskFilter] = useState<'all' | 'at_risk' | 'needs_attention' | 'on_track'>('all');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    // Inline quick alert for selected student
    const [quickAlertSessionId, setQuickAlertSessionId] = useState<string>('');
    const [quickAlertMsg, setQuickAlertMsg] = useState('');
    const [sendingQuickAlert, setSendingQuickAlert] = useState(false);

    // Activity logs filters
    const [logTypeFilter, setLogTypeFilter] = useState<'all' | 'quiz_attempt' | 'homework_alert' | 'session_completed' | 'member_joined'>('all');
    const [logStudentFilter, setLogStudentFilter] = useState<string>('all');

    const loadAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.getClassAnalyticsAndLogs(clan.clanId, user.userId);
            setData(res);
            if (res.students.length > 0 && !selectedStudentId) {
                setSelectedStudentId(res.students[0].userId);
            }
            if (res.sessionAnalytics.length > 0 && !quickAlertSessionId) {
                setQuickAlertSessionId(res.sessionAnalytics[0].moduleId);
            }
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to load class analytics');
        } finally {
            setLoading(false);
        }
    }, [clan.clanId, user.userId, selectedStudentId, quickAlertSessionId, showNotification]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    const filteredStudents = useMemo(() => {
        if (!data) return [];
        const q = studentSearch.trim().toLowerCase();
        return data.students.filter(s => {
            if (riskFilter !== 'all' && s.riskLevel !== riskFilter) return false;
            if (q && !s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [data, studentSearch, riskFilter]);

    const selectedStudent = useMemo(() => {
        if (!data || data.students.length === 0) return null;
        return data.students.find(s => s.userId === selectedStudentId) || filteredStudents[0] || data.students[0];
    }, [data, selectedStudentId, filteredStudents]);

    const filteredLogs = useMemo(() => {
        if (!data) return [];
        return data.activityLogs.filter(log => {
            if (logTypeFilter !== 'all' && log.type !== logTypeFilter) return false;
            if (logStudentFilter !== 'all' && log.studentId !== logStudentFilter) return false;
            return true;
        });
    }, [data, logTypeFilter, logStudentFilter]);

    const handleSendQuickStudentAlert = async () => {
        if (!selectedStudent || !quickAlertSessionId) {
            showNotification('error', 'Choose a session first to send an alert');
            return;
        }
        setSendingQuickAlert(true);
        try {
            const res = await api.sendHomeworkAlert(
                clan.clanId,
                {
                    moduleId: quickAlertSessionId,
                    targetUserIds: [selectedStudent.userId],
                    message: quickAlertMsg.trim() || undefined
                },
                user.userId
            );
            showNotification('success', res.message || `Reminder sent to ${selectedStudent.name}!`);
            setQuickAlertMsg('');
            loadAnalytics();
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to send alert');
        } finally {
            setSendingQuickAlert(false);
        }
    };

    const handleExportLogsCsv = () => {
        if (!data) return;
        const rows = [
            ['Timestamp', 'Event Type', 'Student', 'Title', 'Score %', 'Passed', 'Time (s)', 'Details']
        ];
        filteredLogs.forEach(log => {
            rows.push([
                new Date(log.timestamp).toISOString(),
                log.type,
                `"${(log.studentName || '').replace(/"/g, '""')}"`,
                `"${(log.title || '').replace(/"/g, '""')}"`,
                log.percentage !== undefined ? String(log.percentage) : '',
                log.passed !== undefined ? String(log.passed) : '',
                log.timeTaken !== undefined ? String(log.timeTaken) : '',
                `"${(log.message || '').replace(/"/g, '""')}"`
            ]);
        });
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${clan.tag || 'class'}-performance-logs.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('success', 'Student performance log CSV downloaded!');
    };

    if (loading) {
        return (
            <div className="py-16 text-center space-y-3">
                <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-500 mx-auto" />
                <p className="text-xs font-bold text-gray-500">Computing student performance analytics &amp; activity logs...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-8 text-center rounded-2xl border border-dashed border-gray-300 dark:border-white/15">
                <p className="text-sm font-bold text-gray-500">Unable to load analytics right now.</p>
            </div>
        );
    }

    const { overview, sessionAnalytics, weakTopics, students } = data;

    return (
        <div className="space-y-6">
            {/* Header + Sub-Tab Controls + Quick Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-500" />
                        <span>Teacher Analytics &amp; Student Performance Logs</span>
                    </h2>
                    <p className="text-xs text-gray-500 font-semibold mt-0.5">
                        Track individual accuracy, homework completion, weak concepts, and every student learning event.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {onOpenAiCoach && (
                        <button
                            type="button"
                            onClick={() => onOpenAiCoach({ students: data.students, weakTopics: data.weakTopics })}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                                isBento
                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow'
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Ask AI Performance Coach</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleExportLogsCsv}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f1f5f9]'
                                : 'bg-black/10 dark:bg-white/10 hover:bg-black/20'
                        }`}
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`p-4 rounded-2xl ${isBento ? 'bg-[#e0f2fe] border-2 border-black shadow-[3px_3px_0px_#000]' : 'bg-indigo-500/10 border border-indigo-500/20'}`}>
                    <div className="text-[10px] font-black uppercase tracking-wider opacity-70 flex items-center justify-between">
                        <span>Students</span>
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <div className="text-2xl font-black mt-1">{overview.totalStudents}</div>
                    <div className="text-[11px] font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                        {overview.activeStudents7d} active (7d)
                        {overview.atRiskCount > 0 && (
                            <span className="text-rose-500 ml-2">• {overview.atRiskCount} at risk</span>
                        )}
                    </div>
                </div>

                <div className={`p-4 rounded-2xl ${isBento ? 'bg-[#dcfce7] border-2 border-black shadow-[3px_3px_0px_#000]' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                    <div className="text-[10px] font-black uppercase tracking-wider opacity-70 flex items-center justify-between">
                        <span>Class Avg Score</span>
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black mt-1">{overview.classAvgScore}%</div>
                    <div className="text-[11px] font-bold mt-1 opacity-75">
                        Pass Rate: {overview.classPassRate}%
                    </div>
                </div>

                <div className={`p-4 rounded-2xl ${isBento ? 'bg-[#fef9c3] border-2 border-black shadow-[3px_3px_0px_#000]' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                    <div className="text-[10px] font-black uppercase tracking-wider opacity-70 flex items-center justify-between">
                        <span>Homework Done</span>
                        <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black mt-1">{overview.homeworkCompletionRate}%</div>
                    <div className="text-[11px] font-bold mt-1 opacity-75">
                        {overview.finishedSessionsCount}/{overview.totalSessionsCount} sessions finished
                    </div>
                </div>

                <div className={`p-4 rounded-2xl ${isBento ? 'bg-[#f3e8ff] border-2 border-black shadow-[3px_3px_0px_#000]' : 'bg-violet-500/10 border border-violet-500/20'}`}>
                    <div className="text-[10px] font-black uppercase tracking-wider opacity-70 flex items-center justify-between">
                        <span>Quiz Activity</span>
                        <Activity className="w-3.5 h-3.5 text-violet-500" />
                    </div>
                    <div className="text-2xl font-black mt-1">{overview.totalQuizAttempts}</div>
                    <div className="text-[11px] font-bold mt-1 opacity-75">
                        {overview.totalTimeMinutes} min total study
                    </div>
                </div>
            </div>

            {/* Inline Page Sub-Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap border-b border-gray-200 dark:border-white/10 pb-3">
                {[
                    { id: 'overview' as const, label: 'Class Insights & Weak Concepts', icon: BarChart3 },
                    { id: 'students' as const, label: `Student Tracker (${students.length})`, icon: Users },
                    { id: 'logs' as const, label: `Activity & Performance Log (${data.activityLogs.length})`, icon: Activity }
                ].map(t => {
                    const Icon = t.icon;
                    const active = subTab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setSubTab(t.id)}
                            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition ${
                                active
                                    ? isBento ? 'bg-black text-[#bef264]' : 'bg-indigo-600 text-white shadow'
                                    : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{t.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* SUB-TAB 1: Class Overview & Weak Topics */}
            {subTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Session Progress Breakdown */}
                    <div className={`p-5 rounded-3xl space-y-4 ${
                        isBento ? 'bg-white border-2 border-black shadow-[4px_4px_0px_#000]' : 'bg-gray-50/80 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10'
                    }`}>
                        <h3 className="text-sm font-black uppercase tracking-tight">Session Homework &amp; Score Breakdown</h3>
                        {sessionAnalytics.length === 0 ? (
                            <p className="text-xs text-gray-500">Assign a Track to this class to see per-session analytics.</p>
                        ) : (
                            <div className="space-y-3">
                                {sessionAnalytics.map(sa => (
                                    <div key={sa.moduleId} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs font-bold gap-2">
                                            <span className="truncate flex items-center gap-1.5">
                                                <span className={`w-2 h-2 rounded-full ${sa.isFinished ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                {sa.title}
                                            </span>
                                            <span className="shrink-0 opacity-80">
                                                {sa.quizCount > 0 ? `${sa.completedStudents}/${sa.completedStudents + sa.pendingStudents} done • ${sa.avgScore}% avg` : 'No quiz'}
                                            </span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${sa.completionRate >= 80 ? 'bg-emerald-500' : sa.completionRate >= 40 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                                style={{ width: `${sa.quizCount > 0 ? sa.completionRate : (sa.isFinished ? 100 : 15)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Top Class Weak Topics & Misconceptions */}
                    <div className={`p-5 rounded-3xl space-y-4 ${
                        isBento ? 'bg-[#fff1f2] border-2 border-black shadow-[4px_4px_0px_#000]' : 'bg-rose-500/5 border border-rose-500/20'
                    }`}>
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                                <span>Most Missed Topics &amp; Misconceptions</span>
                            </h3>
                        </div>

                        {weakTopics.length === 0 ? (
                            <div className="py-8 text-center text-xs text-gray-500">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                No weak topics recorded yet! Weak areas will surface once students submit quizzes.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {weakTopics.slice(0, 5).map((wt, idx) => (
                                    <div key={idx} className={`p-3.5 rounded-2xl space-y-2 ${isBento ? 'bg-white border-2 border-black' : 'bg-white/80 dark:bg-black/30 border border-white/10'}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="font-black text-xs truncate">{wt.topic}</div>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-500 shrink-0">
                                                {wt.errorRate}% Error Rate • {wt.affectedStudentsCount} student(s)
                                            </span>
                                        </div>
                                        {wt.sampleMistakes && wt.sampleMistakes[0] && (
                                            <div className="text-[11px] bg-black/5 dark:bg-white/5 p-2 rounded-lg space-y-0.5">
                                                <div className="font-bold opacity-85 line-clamp-1">Q: {wt.sampleMistakes[0].question}</div>
                                                <div className="text-rose-500">Mistake ({wt.sampleMistakes[0].studentName}): {wt.sampleMistakes[0].userAnswer}</div>
                                                <div className="text-emerald-600 dark:text-emerald-400">Expected: {wt.sampleMistakes[0].correctAnswer}</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SUB-TAB 2: Student Performance Tracker (Inline Master-Detail, Zero Modals) */}
            {subTab === 'students' && (
                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] xl:grid-cols-[300px_1fr] gap-5 items-start">
                    {/* Left: Filterable Student Roster */}
                    <div className="space-y-3 min-w-0">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
                            <input
                                value={studentSearch}
                                onChange={e => setStudentSearch(e.target.value)}
                                placeholder="Filter students..."
                                className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-bold ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black placeholder:text-slate-500'
                                        : 'bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10'
                                }`}
                            />
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {([
                                { id: 'all', label: 'All' },
                                { id: 'at_risk', label: 'At Risk' },
                                { id: 'needs_attention', label: 'Watch' },
                                { id: 'on_track', label: 'On Track' }
                            ] as const).map(f => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setRiskFilter(f.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer transition ${
                                        riskFilter === f.id
                                            ? isBento ? 'bg-black text-[#bef264] border-2 border-black' : 'bg-indigo-600 text-white'
                                            : isBento ? 'bg-white text-black border border-black/30 hover:border-black' : 'bg-black/5 dark:bg-white/5 opacity-80'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                            {filteredStudents.length === 0 ? (
                                <p className="text-xs text-gray-500 p-4 text-center">No matching students in this class.</p>
                            ) : (
                                filteredStudents.map(st => {
                                    const isSel = selectedStudent?.userId === st.userId;
                                    return (
                                        <button
                                            key={st.userId}
                                            type="button"
                                            onClick={() => setSelectedStudentId(st.userId)}
                                            className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                                                isSel
                                                    ? isBento ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-indigo-600 text-white border-indigo-500 shadow-lg'
                                                    : isBento ? 'bg-[#f8fafc] text-black border-2 border-black/25 hover:border-black' : 'bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/10 hover:border-indigo-500/40'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center font-black text-xs ${
                                                    isBento ? 'bg-white border border-black' : 'bg-indigo-500/15'
                                                }`}>
                                                    {st.avatar ? <Avatar config={st.avatar} size="sm" className="w-full h-full" /> : st.name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-black text-xs truncate">{st.name}</div>
                                                    <div className={`text-[10px] font-bold ${isBento ? 'text-black/75' : 'opacity-75'}`}>
                                                        Avg {st.avgScore}% • HW {st.homeworkCompletionRate}%
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${
                                                st.riskLevel === 'at_risk'
                                                    ? isBento ? 'bg-[#fecaca] text-black border border-black' : 'bg-rose-500/20 text-rose-500'
                                                    : st.riskLevel === 'needs_attention'
                                                        ? isBento ? 'bg-[#fef08a] text-black border border-black' : 'bg-amber-500/20 text-amber-500'
                                                        : isBento ? 'bg-[#dcfce7] text-black border border-black' : 'bg-emerald-500/20 text-emerald-500'
                                            }`}>
                                                {st.riskLevel === 'at_risk' ? 'At Risk' : st.riskLevel === 'needs_attention' ? 'Watch' : 'Great'}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Inline Student Performance Dossier */}
                    {selectedStudent ? (
                        <div className={`min-w-0 p-5 sm:p-6 rounded-3xl space-y-5 ${
                            isBento ? 'bg-[#f8fafc] text-black border-2 border-black shadow-[3px_3px_0px_#000]' : 'bg-white dark:bg-[#161827] border border-gray-200 dark:border-white/10 shadow-xl'
                        }`}>
                            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b ${
                                isBento ? 'border-black/15' : 'border-gray-200 dark:border-white/10'
                            }`}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center font-black shrink-0 ${
                                        isBento ? 'bg-white border-2 border-black' : 'bg-indigo-500/15'
                                    }`}>
                                        {selectedStudent.avatar ? <Avatar config={selectedStudent.avatar} size="md" className="w-full h-full" /> : selectedStudent.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-lg font-black">{selectedStudent.name}</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                isBento ? 'bg-[#e0f2fe] text-black border border-black' : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                                            }`}>
                                                Lvl {selectedStudent.level} • {selectedStudent.xp} XP
                                            </span>
                                            {selectedStudent.streak > 0 && (
                                                <span className={`inline-flex items-center gap-0.5 text-[10px] font-black ${
                                                    isBento ? 'text-amber-700' : 'text-amber-500'
                                                }`}>
                                                    <Flame className="w-3 h-3" /> {selectedStudent.streak}d streak
                                                </span>
                                            )}
                                        </div>
                                        <div className={`text-xs flex items-center gap-2 flex-wrap mt-0.5 font-semibold ${
                                            isBento ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'
                                        }`}>
                                            <span className="truncate">{selectedStudent.email}</span>
                                            <span>•</span>
                                            <span className="inline-flex items-center gap-1">
                                                Trend:
                                                {selectedStudent.recentTrend === 'improving' && <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
                                                {selectedStudent.recentTrend === 'declining' && <TrendingDown className="w-3.5 h-3.5 text-rose-600" />}
                                                {selectedStudent.recentTrend === 'stable' && <Minus className="w-3.5 h-3.5 text-slate-500" />}
                                                {selectedStudent.recentTrend}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setLogStudentFilter(selectedStudent.userId);
                                        setSubTab('logs');
                                    }}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shrink-0 ${
                                        isBento
                                            ? 'bg-[#e0f2fe] hover:bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow'
                                    }`}
                                >
                                    View Student Full Log →
                                </button>
                            </div>

                            {/* Student Metrics */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className={`p-3 rounded-2xl ${isBento ? 'bg-white border-2 border-black' : 'bg-black/5 dark:bg-white/5'}`}>
                                    <div className={`text-[10px] font-black uppercase ${isBento ? 'text-slate-700' : 'opacity-65'}`}>Avg Score</div>
                                    <div className="text-lg font-black">{selectedStudent.avgScore}%</div>
                                </div>
                                <div className={`p-3 rounded-2xl ${isBento ? 'bg-[#dcfce7] border-2 border-black' : 'bg-black/5 dark:bg-white/5'}`}>
                                    <div className={`text-[10px] font-black uppercase ${isBento ? 'text-slate-700' : 'opacity-65'}`}>Pass Rate</div>
                                    <div className={`text-lg font-black ${isBento ? 'text-emerald-800' : 'text-emerald-500'}`}>{selectedStudent.passRate}%</div>
                                </div>
                                <div className={`p-3 rounded-2xl ${isBento ? 'bg-[#fef9c3] border-2 border-black' : 'bg-black/5 dark:bg-white/5'}`}>
                                    <div className={`text-[10px] font-black uppercase ${isBento ? 'text-slate-700' : 'opacity-65'}`}>Homework</div>
                                    <div className="text-lg font-black">{selectedStudent.finishedHomeworkSessions}/{selectedStudent.totalHomeworkSessions}</div>
                                </div>
                                <div className={`p-3 rounded-2xl ${isBento ? 'bg-[#f3e8ff] border-2 border-black' : 'bg-black/5 dark:bg-white/5'}`}>
                                    <div className={`text-[10px] font-black uppercase ${isBento ? 'text-slate-700' : 'opacity-65'}`}>Study Time</div>
                                    <div className="text-lg font-black">{Math.round(selectedStudent.totalTimeSeconds / 60)}m</div>
                                </div>
                            </div>

                            {/* Recent Quiz Score Trajectory */}
                            {selectedStudent.recentScores.length > 0 && (
                                <div className="space-y-2">
                                    <div className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black/80' : 'opacity-70'}`}>Recent Score History</div>
                                    <div className={`grid grid-cols-4 sm:grid-cols-8 gap-1.5 sm:gap-2 items-end h-28 p-2.5 sm:p-3 rounded-2xl ${
                                        isBento ? 'bg-white border-2 border-black' : 'bg-black/5 dark:bg-black/30'
                                    }`}>
                                        {selectedStudent.recentScores.map((rs, idx) => (
                                            <div key={idx} className="flex flex-col items-center justify-end h-full gap-1" title={`${rs.quizTitle}: ${rs.percentage}%`}>
                                                <span className="text-[10px] font-black">{rs.percentage}%</span>
                                                <div
                                                    className={`w-full rounded-t-lg ${rs.passed ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                    style={{ height: `${Math.max(12, rs.percentage * 0.65)}%` }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Student Specific Wrong Answers */}
                            <div className="space-y-2">
                                <div className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black/80' : 'opacity-70'}`}>Recent Mistakes to Review With Student</div>
                                {selectedStudent.wrongAnswers.length === 0 ? (
                                    <p className="text-xs text-emerald-600 font-bold">No recent wrong answers logged for this student.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedStudent.wrongAnswers.map((wa, idx) => (
                                            <div key={idx} className={`p-3 rounded-xl text-xs space-y-1 ${
                                                isBento ? 'bg-[#fff1f2] border-2 border-black' : 'bg-rose-500/5 border border-rose-500/20'
                                            }`}>
                                                <div className="font-bold">{wa.quizTitle}: {wa.question}</div>
                                                <div className="flex flex-wrap gap-3 text-[11px]">
                                                    <span className="text-rose-600 font-bold">Chose: {wa.userAnswer}</span>
                                                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">Correct: {wa.correctAnswer}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Inline Targeted Reminder Bar (Zero Modal) */}
                            {sessionAnalytics.length > 0 && (
                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2.5">
                                    <div className="text-xs font-black uppercase flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                        <Bell className="w-3.5 h-3.5" />
                                        <span>Send Direct Reminder to {selectedStudent.name}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <select
                                            value={quickAlertSessionId}
                                            onChange={e => setQuickAlertSessionId(e.target.value)}
                                            className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-black/40 border border-black/15 dark:border-white/15"
                                        >
                                            {sessionAnalytics.map(s => (
                                                <option key={s.moduleId} value={s.moduleId}>{s.title}</option>
                                            ))}
                                        </select>
                                        <input
                                            value={quickAlertMsg}
                                            onChange={e => setQuickAlertMsg(e.target.value)}
                                            placeholder={`Hi ${selectedStudent.name}, remember to review and finish your homework!`}
                                            className="flex-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-black/40 border border-black/15 dark:border-white/15"
                                        />
                                        <button
                                            type="button"
                                            disabled={sendingQuickAlert}
                                            onClick={handleSendQuickStudentAlert}
                                            className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            <span>{sendingQuickAlert ? 'Sending...' : 'Send Alert'}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-10 text-center rounded-3xl border border-dashed border-gray-300 dark:border-white/10">
                            <p className="text-sm font-bold text-gray-500">Invite students to this class to inspect individual dossiers.</p>
                        </div>
                    )}
                </div>
            )}

            {/* SUB-TAB 3: Unified Chronological Student Activity & Performance Log */}
            {subTab === 'logs' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-black uppercase opacity-70">
                            <Filter className="w-3.5 h-3.5" />
                            <span>Filter Log:</span>
                        </div>
                        <select
                            value={logTypeFilter}
                            onChange={e => setLogTypeFilter(e.target.value as typeof logTypeFilter)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                        >
                            <option value="all">All Event Types</option>
                            <option value="quiz_attempt">Quiz Submissions</option>
                            <option value="homework_alert">Homework Alerts Sent</option>
                            <option value="session_completed">Sessions Finished</option>
                            <option value="member_joined">Student Enrollments</option>
                        </select>

                        <select
                            value={logStudentFilter}
                            onChange={e => setLogStudentFilter(e.target.value)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                        >
                            <option value="all">All Students</option>
                            {students.map(s => (
                                <option key={s.userId} value={s.userId}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {filteredLogs.length === 0 ? (
                        <div className="p-10 text-center rounded-2xl border border-dashed border-gray-300 dark:border-white/10 text-xs font-bold text-gray-500">
                            No activity events match the selected filter.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                            {filteredLogs.map(log => (
                                <div
                                    key={log.id}
                                    className={`p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                        isBento ? 'bg-white border-2 border-black' : 'bg-gray-50 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/10'
                                    }`}
                                >
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black ${
                                            log.type === 'quiz_attempt'
                                                ? (log.passed ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500')
                                                : log.type === 'homework_alert'
                                                    ? 'bg-amber-500/15 text-amber-500'
                                                    : log.type === 'session_completed'
                                                        ? 'bg-indigo-500/15 text-indigo-500'
                                                        : 'bg-sky-500/15 text-sky-500'
                                        }`}>
                                            {log.type === 'quiz_attempt' ? `${log.percentage ?? 0}%`
                                                : log.type === 'homework_alert' ? <Bell className="w-4 h-4" />
                                                    : log.type === 'session_completed' ? <CheckCircle2 className="w-4 h-4" />
                                                        : <Users className="w-4 h-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-black text-xs">{log.studentName}</span>
                                                <span className="text-xs font-semibold opacity-80 truncate">{log.title}</span>
                                            </div>
                                            {log.message && (
                                                <div className="text-[11px] opacity-70 truncate">{log.message}</div>
                                            )}
                                            <div className="flex items-center gap-3 text-[10px] opacity-60 font-bold mt-0.5">
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </span>
                                                {log.type === 'quiz_attempt' && log.timeTaken !== undefined && (
                                                    <span>Time: {log.timeTaken}s</span>
                                                )}
                                                {log.type === 'quiz_attempt' && (log.tabSwitches ?? 0) > 0 && (
                                                    <span className="text-amber-500 inline-flex items-center gap-0.5">
                                                        <ShieldAlert className="w-3 h-3" /> {log.tabSwitches} tab switch(es)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {log.type === 'quiz_attempt' && (
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase self-end sm:self-center shrink-0 ${
                                            log.passed ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                                        }`}>
                                            {log.passed ? `Passed (${log.score}/${log.totalQuestions})` : `Needs Retry (${log.score}/${log.totalQuestions})`}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClassAnalyticsLogsSection;
