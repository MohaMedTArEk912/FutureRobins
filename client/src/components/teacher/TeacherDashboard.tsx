import React, { useState, useEffect, useMemo } from 'react';
import {
    GraduationCap, Users, Compass, Copy, Link2, RefreshCw,
    BarChart3, Sparkles, MonitorPlay, UserPlus, MessageCircle, Search,
    ArrowUpCircle, ArrowDownCircle,
    Trash2, CheckCircle2, XCircle, X, FileCode, ArrowLeft
} from 'lucide-react';
import type {
    UserData,
    ClassSummary,
    SkillTrack,
    Quiz,
    ClanChatMessage
} from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import { useTeacherWorkspace } from '../../context/TeacherWorkspaceContext';
import { ClanEmblem } from '../social/ClassEmblem';
import { ClassCurriculumSection } from '../social/ClassCurriculumSection';
import { ClassAnalyticsLogsSection } from '../social/ClassAnalyticsLogsSection';
import { TeacherAiToolsSection } from '../social/TeacherAiToolsSection';
import { ClanChatSection } from '../social/ClassChatSection';
import PresentationLibraryManager from '../presentation/PresentationLibraryManager';
import Avatar from '../Avatar';
import TeacherBoardBrowser from './TeacherBoardBrowser';
import TeacherTrackQuizBrowser from './TeacherTrackQuizBrowser';
import { getTeacherThemeStyles, type TeacherSectionId } from './teacherTheme';

interface TeacherDashboardProps {
    user: UserData;
    skillTracks: SkillTrack[];
    quizzes: Quiz[];
    onRefreshUser: () => void;
    onLogout?: () => void;
    onSelectQuiz: (quiz: Quiz) => void;
    onViewProfile?: () => void;
}

const SECTION_DESCRIPTIONS: Record<TeacherSectionId, { title: string; subtitle: string }> = {
    overview: {
        title: 'Teacher Command Center',
        subtitle: 'All your cohorts, live interactive lessons, student logs, and AI tools in one unified studio.'
    },
    my_classes: {
        title: 'Assigned Classes',
        subtitle: 'Browse classes assigned to you by Admin and jump directly into any teaching workspace.'
    },
    sessions: {
        title: 'Sessions, Interactive Board & Presentations',
        subtitle: 'Deliver class sessions, present live on the interactive whiteboard, and manage your slide JSON library in one place.'
    },
    presentations: {
        title: 'Sessions, Interactive Board & Presentations',
        subtitle: 'Download sample JSON templates, upload decks, and assign multiple presentations per module/session.'
    },
    board_studio: {
        title: 'Sessions, Interactive Board & Presentations',
        subtitle: 'Teach live with clickable wireframes, pen annotations, laser pointer, and check-up polls in one unified board.'
    },
    analytics: {
        title: 'Analytics & Student Logs',
        subtitle: 'Track mastery rates, weak topics, per-student activity history, and send quick feedback.'
    },
    ai_studio: {
        title: 'AI Quiz & Lesson Studio',
        subtitle: 'Generate teacher-crafted quiz questions straight from your slide decks and class metrics.'
    },
    students: {
        title: 'Students & Invites',
        subtitle: 'Share join links, approve enrollment requests, invite registered learners, and manage roles.'
    },
    chat: {
        title: 'Class Chat & Updates',
        subtitle: 'Communicate directly with your class and post timely reminders.'
    },
    library: {
        title: 'Tracks & Quiz Library',
        subtitle: 'Preview curriculum roadmaps and test quizzes before assigning them to your classes.'
    }
};

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
    user,
    skillTracks,
    quizzes,
    onSelectQuiz
}) => {
    const { theme } = useTheme();
    const styles = useMemo(() => getTeacherThemeStyles(theme), [theme]);
    const { showNotification } = useNotification();
    const {
        activeSection,
        setActiveSection,
        myClasses,
        setMyClasses,
        loadingClasses,
        selectedClassId,
        setSelectedClassId,
        activeClan,
        setActiveClan,
        loadingActiveClan,
        loadMyClasses,
        loadActiveClan
    } = useTeacherWorkspace();

    // Workspace Controls (Invite / Roster / Chat / Search)
    const [inviteQuery, setInviteQuery] = useState('');
    const [inviteResults, setInviteResults] = useState<UserData[]>([]);
    const [regeneratingLink, setRegeneratingLink] = useState(false);
    const [rosterSearch, setRosterSearch] = useState('');
    const [confirmKickUserId, setConfirmKickUserId] = useState<string | null>(null);
    const [classSearch, setClassSearch] = useState('');
    const [chatMessages, setChatMessages] = useState<ClanChatMessage[]>([]);
    const [presetUploadTarget, setPresetUploadTarget] = useState<{ trackId: string; moduleId: string } | null>(null);
    const [presentationsVersion, setPresentationsVersion] = useState(0);

    useEffect(() => {
        if (activeClan) {
            setChatMessages(activeClan.chatMessages || []);
        }
    }, [activeClan]);

    const getInviteUrl = (code?: string) =>
        code && typeof window !== 'undefined' ? `${window.location.origin}/classes/join/${code}` : '';

    const handleCopyInviteLink = async (code?: string) => {
        const url = getInviteUrl(code);
        if (!url) {
            showNotification('error', 'Invite link unavailable');
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            showNotification('success', 'Class invite link copied!');
        } catch {
            showNotification('error', 'Could not copy link');
        }
    };

    const handleRegenerateInvite = async () => {
        if (!activeClan) return;
        setRegeneratingLink(true);
        try {
            const res = await api.regenerateInviteCode(activeClan.clanId, user.userId);
            setActiveClan(prev => (prev ? { ...prev, inviteCode: res.inviteCode } : null));
            setMyClasses(prev => prev.map(c => (c.clanId === activeClan.clanId ? { ...c, inviteCode: res.inviteCode } : c)));
            showNotification('success', 'New invite link generated!');
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to regenerate invite link');
        } finally {
            setRegeneratingLink(false);
        }
    };

    const openClassSection = (clanId: string, section: TeacherSectionId = 'sessions') => {
        setSelectedClassId(clanId);
        setActiveSection(section);
    };

    const handleInviteSearch = async () => {
        if (!inviteQuery.trim() || !activeClan) return;
        try {
            const results = await api.searchUsers(inviteQuery);
            const memberSet = new Set((activeClan.members || []).map(m => m.userId));
            setInviteResults(results.filter((u: UserData) => !memberSet.has(u.userId)));
        } catch {
            showNotification('error', 'Failed to search students');
        }
    };

    const handleSendSiteInvite = async (targetUserId: string) => {
        if (!activeClan) return;
        try {
            await api.inviteToClan(activeClan.clanId, targetUserId, user.userId);
            showNotification('success', 'Class invitation sent!');
            setInviteResults(prev => prev.filter(u => u.userId !== targetUserId));
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to invite student');
        }
    };

    const handleJoinRequestDecision = async (targetUserId: string, accept: boolean) => {
        if (!activeClan) return;
        try {
            await api.handleJoinRequest(activeClan.clanId, targetUserId, accept, user.userId);
            showNotification('success', accept ? 'Student admitted to class!' : 'Join request declined.');
            await loadActiveClan(activeClan.clanId, true);
            await loadMyClasses(activeClan.clanId);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to update join request');
        }
    };

    const handleRoleChange = async (targetUserId: string, newRole: 'elder' | 'member') => {
        if (!activeClan) return;
        try {
            await api.updateMemberRole(activeClan.clanId, targetUserId, newRole, user.userId);
            showNotification('success', newRole === 'elder' ? 'Promoted to Class Assistant!' : 'Changed role to Student.');
            await loadActiveClan(activeClan.clanId, true);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to update role');
        }
    };

    const handleRemoveMember = async (targetUserId: string) => {
        if (!activeClan) return;
        try {
            await api.kickMember(activeClan.clanId, targetUserId, user.userId);
            setConfirmKickUserId(null);
            showNotification('success', 'Student removed from class.');
            await loadActiveClan(activeClan.clanId, true);
            await loadMyClasses(activeClan.clanId);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to remove student');
        }
    };

    // Chat handlers
    const handleSendChat = async (content: string) => {
        if (!activeClan) return;
        await api.sendClanMessage(activeClan.clanId, content, user.userId);
        const fresh = await api.getClanMessages(activeClan.clanId, user.userId);
        setChatMessages(fresh);
    };
    const handleEditChat = async (messageId: string, content: string) => {
        if (!activeClan) return;
        await api.editClanMessage(activeClan.clanId, messageId, content, user.userId);
        const fresh = await api.getClanMessages(activeClan.clanId, user.userId);
        setChatMessages(fresh);
    };
    const handleDeleteChat = async (messageId: string) => {
        if (!activeClan) return;
        await api.deleteClanMessage(activeClan.clanId, messageId, user.userId);
        const fresh = await api.getClanMessages(activeClan.clanId, user.userId);
        setChatMessages(fresh);
    };

    // Derived KPIs & Filtered Lists
    const totals = useMemo(() => {
        const totalClasses = myClasses.length;
        const totalStudents = myClasses.reduce((sum, c) => sum + Math.max(0, (c.memberCount || 1) - 1), 0);
        const finishedSessions = myClasses.reduce((sum, c) => sum + (c.finishedSessionsCount || 0), 0);
        const tracksConfigured = myClasses.filter(c => Boolean(c.trackId)).length;
        return { totalClasses, totalStudents, finishedSessions, tracksConfigured };
    }, [myClasses]);

    const trackMap = useMemo(
        () => new Map((skillTracks || []).map(t => [t.trackId, t])),
        [skillTracks]
    );

    const filteredClasses = useMemo(() => {
        const q = classSearch.trim().toLowerCase();
        if (!q) return myClasses;
        return myClasses.filter(c => {
            const trackTitle = c.trackId ? (trackMap.get(c.trackId)?.title || '') : '';
            return (
                (c.name || '').toLowerCase().includes(q) ||
                (c.tag || '').toLowerCase().includes(q) ||
                trackTitle.toLowerCase().includes(q)
            );
        });
    }, [myClasses, classSearch, trackMap]);

    const filteredRoster = useMemo(() => {
        const members = activeClan?.members || [];
        const q = rosterSearch.trim().toLowerCase();
        if (!q) return members;
        return members.filter(m =>
            (m.name || '').toLowerCase().includes(q) || (m.userId || '').toLowerCase().includes(q)
        );
    }, [activeClan?.members, rosterSearch]);

    const sectionInfo = SECTION_DESCRIPTIONS[activeSection];
    const isClassContextualSection = (
        activeSection === 'sessions'
        || activeSection === 'board_studio'
        || activeSection === 'presentations'
        || activeSection === 'analytics'
        || activeSection === 'ai_studio'
        || activeSection === 'students'
        || activeSection === 'chat'
    );

    const renderEmptyNoClassesCard = (contextMessage: string) => (
        <div className={`p-6 sm:p-10 md:p-12 rounded-[1.75rem] sm:rounded-[2rem] text-center space-y-4 ${styles.surfaceCard}`}>
            <GraduationCap className={`w-14 h-14 mx-auto ${styles.isBento ? 'text-black' : 'text-indigo-500'}`} />
            <h2 className="text-2xl font-black uppercase tracking-tight">No Classes Assigned Yet</h2>
            <p className={`text-sm max-w-md mx-auto font-medium ${styles.mutedText}`}>
                {contextMessage} Only an Administrator can create new classes and assign teachers or students.
            </p>
            <button
                type="button"
                onClick={() => setActiveSection('board_studio')}
                className={`px-6 py-3.5 rounded-2xl text-xs uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer ${styles.primaryBtn}`}
            >
                <MonitorPlay className="w-4 h-4" />
                <span>Open Interactive Board Practice</span>
            </button>
        </div>
    );

    const renderClassCard = (cls: ClassSummary) => {
        const assignedTrack = cls.trackId ? trackMap.get(cls.trackId) : undefined;
        const studentsCount = Math.max(0, (cls.memberCount || 1) - 1);
        const totalSessions = assignedTrack?.modules?.length || 0;
        const isSelected = cls.clanId === selectedClassId;

        return (
            <div
                key={cls.clanId}
                className={`p-5 sm:p-6 rounded-[1.75rem] space-y-4 transition-all ${styles.surfaceCard} ${
                    isSelected && !styles.isBento ? 'ring-2 ring-indigo-500/40' : ''
                }`}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <ClanEmblem logo={cls.logo} tag={cls.tag} name={cls.name} size="md" />
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black ${styles.pillPrimary}`}>
                                    [{cls.tag}]
                                </span>
                                {assignedTrack ? (
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black truncate max-w-[190px] ${styles.pillSuccess}`}>
                                        {assignedTrack.icon || '🗺️'} {assignedTrack.title}
                                    </span>
                                ) : (
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${styles.pillWarning}`}>
                                        No Track Assigned
                                    </span>
                                )}
                            </div>
                            <h3 className="text-lg sm:text-xl font-black truncate mt-1">{cls.name}</h3>
                        </div>
                    </div>

                    {cls.inviteCode && (
                        <button
                            type="button"
                            onClick={() => handleCopyInviteLink(cls.inviteCode)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 shrink-0 cursor-pointer ${styles.secondaryBtn}`}
                            title="Copy student join link"
                        >
                            <Copy className="w-3 h-3" />
                            <span>{cls.inviteCode}</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-2.5 text-center">
                    <div className={`p-2 sm:p-2.5 rounded-xl ${styles.subtleBox}`}>
                        <div className={`text-[9px] sm:text-[10px] font-black uppercase ${styles.mutedText}`}>Students</div>
                        <div className="text-sm sm:text-base font-black">{studentsCount}</div>
                    </div>
                    <div className={`p-2 sm:p-2.5 rounded-xl ${styles.subtleBox}`}>
                        <div className={`text-[9px] sm:text-[10px] font-black uppercase ${styles.mutedText}`}>Finished</div>
                        <div className={`text-sm sm:text-base font-black ${styles.isBento ? '' : 'text-emerald-500'}`}>
                            {cls.finishedSessionsCount}{totalSessions > 0 ? `/${totalSessions}` : ''}
                        </div>
                    </div>
                    <div className={`p-2 sm:p-2.5 rounded-xl ${styles.subtleBox}`}>
                        <div className={`text-[9px] sm:text-[10px] font-black uppercase ${styles.mutedText}`}>Access</div>
                        <div className={`text-sm sm:text-base font-black ${styles.isBento ? '' : 'text-amber-500'}`}>
                            {cls.isPublic ? 'Public' : 'Invite'}
                        </div>
                    </div>
                </div>

                <div className="space-y-2 pt-1">
                    <button
                        type="button"
                        onClick={() => openClassSection(cls.clanId, 'sessions')}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer ${styles.primaryBtn}`}
                    >
                        <MonitorPlay className="w-3.5 h-3.5 shrink-0" />
                        <span>Enter Class Studio</span>
                    </button>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                            type="button"
                            onClick={() => openClassSection(cls.clanId, 'students')}
                            className={`py-2 px-2.5 rounded-xl text-[11px] uppercase flex items-center justify-center gap-1 cursor-pointer ${styles.secondaryBtn}`}
                        >
                            <UserPlus className={`w-3.5 h-3.5 shrink-0 ${styles.isBento ? '' : 'text-emerald-500'}`} />
                            <span>Students</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => openClassSection(cls.clanId, 'chat')}
                            className={`py-2 px-2.5 rounded-xl text-[11px] uppercase flex items-center justify-center gap-1 cursor-pointer ${styles.secondaryBtn}`}
                        >
                            <MessageCircle className={`w-3.5 h-3.5 shrink-0 ${styles.isBento ? '' : 'text-sky-500'}`} />
                            <span>Chat</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => openClassSection(cls.clanId, 'analytics')}
                            className={`py-2 px-2.5 rounded-xl text-[11px] uppercase flex items-center justify-center gap-1 cursor-pointer ${styles.secondaryBtn}`}
                        >
                            <BarChart3 className={`w-3.5 h-3.5 shrink-0 ${styles.isBento ? '' : 'text-indigo-500'}`} />
                            <span>Analytics</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => openClassSection(cls.clanId, 'ai_studio')}
                            className={`py-2 px-2.5 rounded-xl text-[11px] uppercase flex items-center justify-center gap-1 cursor-pointer ${styles.secondaryBtn}`}
                        >
                            <Sparkles className={`w-3.5 h-3.5 shrink-0 ${styles.isBento ? '' : 'text-sky-500'}`} />
                            <span>AI Studio</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col justify-between">
            {/* Main Content Area */}
            <main className="flex-1 min-w-0 w-full space-y-6">
                        {/* Overview Hero vs Focused Section Header */}
                        {activeSection === 'overview' ? (
                            <section className={`rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-8 ${styles.heroBanner}`}>
                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles.pillPrimary}`}>
                                                Teacher Command Center
                                            </span>
                                            <span className={`text-xs font-bold ${styles.mutedText}`}>
                                                Classes, Interactive Motion Boards, Analytics &amp; AI Studio
                                            </span>
                                        </div>
                                        <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
                                            Welcome back, {user.name}
                                        </h1>
                                        <p className={`text-xs sm:text-sm max-w-2xl font-medium ${styles.mutedText}`}>
                                            Switch cohorts from the left sidebar anytime, run live interactive lessons, inspect per-student performance logs, and turn lesson slides into quizzes in seconds.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2.5 shrink-0">
                                        {myClasses[0] && (
                                            <button
                                                type="button"
                                                onClick={() => openClassSection(selectedClassId || myClasses[0].clanId, 'sessions')}
                                                className={`px-5 py-3 rounded-2xl text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition ${styles.primaryBtn}`}
                                            >
                                                <Compass className="w-4 h-4" />
                                                <span>Open Class Sessions</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setActiveSection('board_studio')}
                                            className={`px-4 py-3 rounded-2xl text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition ${styles.secondaryBtn}`}
                                        >
                                            <MonitorPlay className="w-4 h-4" />
                                            <span>Teaching Board</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Teacher Aggregate KPI Strip */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                                    <div className={`p-4 rounded-2xl ${styles.kpiTile('neutral')}`}>
                                        <div className={`text-[10px] font-black uppercase ${styles.mutedText}`}>My Classes</div>
                                        <div className="text-2xl font-black mt-0.5">{totals.totalClasses}</div>
                                    </div>
                                    <div className={`p-4 rounded-2xl ${styles.kpiTile('indigo')}`}>
                                        <div className={`text-[10px] font-black uppercase ${styles.mutedText}`}>Students Enrolled</div>
                                        <div className={`text-2xl font-black mt-0.5 ${styles.isBento ? '' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                            {totals.totalStudents}
                                        </div>
                                    </div>
                                    <div className={`p-4 rounded-2xl ${styles.kpiTile('emerald')}`}>
                                        <div className={`text-[10px] font-black uppercase ${styles.mutedText}`}>Sessions Finished</div>
                                        <div className={`text-2xl font-black mt-0.5 ${styles.isBento ? '' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            {totals.finishedSessions}
                                        </div>
                                    </div>
                                    <div className={`p-4 rounded-2xl ${styles.kpiTile('amber')}`}>
                                        <div className={`text-[10px] font-black uppercase ${styles.mutedText}`}>Active Tracks</div>
                                        <div className={`text-2xl font-black mt-0.5 ${styles.isBento ? '' : 'text-amber-600 dark:text-amber-400'}`}>
                                            {totals.tracksConfigured}/{totals.totalClasses}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        ) : (
                            <div className="space-y-4">
                                <section className={`rounded-[1.75rem] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${styles.sectionHeaderCard}`}>
                                    <div className="flex items-start gap-3 min-w-0">
                                        {isClassContextualSection && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveSection('overview')}
                                                title="Back to Command Center"
                                                className={`mt-0.5 px-3 py-2 rounded-xl text-xs uppercase flex items-center gap-1.5 shrink-0 cursor-pointer transition ${styles.secondaryBtn}`}
                                            >
                                                <ArrowLeft className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Command Center</span>
                                            </button>
                                        )}
                                        <div className="min-w-0">
                                            <h1 className="text-xl sm:text-2xl font-black tracking-tight">{sectionInfo.title}</h1>
                                            <p className={`text-xs sm:text-sm font-medium mt-0.5 ${styles.mutedText}`}>
                                                {sectionInfo.subtitle}
                                            </p>
                                        </div>
                                    </div>

                                    {isClassContextualSection && myClasses.length > 0 && (
                                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                                            {activeClan?.inviteCode && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyInviteLink(activeClan.inviteCode)}
                                                    className={`px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer ${styles.secondaryBtn}`}
                                                >
                                                    <Link2 className="w-3.5 h-3.5" />
                                                    <span>Copy Link ({activeClan.inviteCode})</span>
                                                </button>
                                            )}
                                            <select
                                                value={selectedClassId}
                                                onChange={(e) => setSelectedClassId(e.target.value)}
                                                aria-label="Select class"
                                                className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer ${styles.select}`}
                                            >
                                                {myClasses.map(c => (
                                                    <option key={c.clanId} value={c.clanId}>
                                                        [{c.tag}] {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </section>

                                {/* Inside-Class Workspace Bar: Students & Invites + Class Chat + Sessions + Analytics + AI Studio */}
                                {isClassContextualSection && myClasses.length > 0 && (
                                    <div className={`p-1.5 rounded-2xl flex flex-wrap items-center gap-1.5 ${
                                        styles.isBento
                                            ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000]'
                                            : 'bg-white/90 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 shadow-sm'
                                    }`}>
                                        {([
                                            {
                                                id: 'sessions' as const,
                                                active: activeSection === 'sessions' || activeSection === 'board_studio' || activeSection === 'presentations',
                                                label: 'Sessions & Board',
                                                icon: MonitorPlay
                                            },
                                            {
                                                id: 'students' as const,
                                                active: activeSection === 'students',
                                                label: 'Students & Invites',
                                                icon: Users,
                                                badge: (activeClan?.activeJoinRequests?.length || 0) > 0
                                                    ? `+${activeClan?.activeJoinRequests?.length}`
                                                    : activeClan
                                                        ? Math.max(0, (activeClan.members?.length || 1) - 1)
                                                        : undefined
                                            },
                                            {
                                                id: 'chat' as const,
                                                active: activeSection === 'chat',
                                                label: 'Class Chat',
                                                icon: MessageCircle
                                            },
                                            {
                                                id: 'analytics' as const,
                                                active: activeSection === 'analytics',
                                                label: 'Analytics & Logs',
                                                icon: BarChart3
                                            },
                                            {
                                                id: 'ai_studio' as const,
                                                active: activeSection === 'ai_studio',
                                                label: 'AI Quiz Studio',
                                                icon: Sparkles
                                            }
                                        ]).map((item) => {
                                            const NavIcon = item.icon;
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setActiveSection(item.id)}
                                                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                                                        item.active
                                                            ? styles.isBento
                                                                ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                : 'bg-indigo-600 text-white shadow-sm'
                                                            : styles.isBento
                                                                ? 'text-slate-700 hover:text-black hover:bg-slate-100'
                                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                                                    }`}
                                                >
                                                    <NavIcon className="w-3.5 h-3.5 shrink-0" />
                                                    <span>{item.label}</span>
                                                    {item.badge !== undefined && (
                                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                                            item.active
                                                                ? styles.isBento
                                                                    ? 'bg-black text-white'
                                                                    : 'bg-white/20 text-white'
                                                                : styles.isBento
                                                                    ? 'bg-[#bef264] text-black border border-black'
                                                                    : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                                                        }`}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECTION 1: COMMAND CENTER OVERVIEW */}
                        {activeSection === 'overview' && (
                            <div className="space-y-6">
                                {/* Quick Launchpad for Active Class */}
                                {activeClan && (
                                    <section className={`rounded-[1.75rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4 ${styles.surfaceCard}`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <ClanEmblem logo={activeClan.logo} tag={activeClan.tag} name={activeClan.name} size="sm" />
                                                <div className="min-w-0">
                                                    <div className={`text-[10px] font-black uppercase tracking-widest ${styles.mutedText}`}>
                                                        Focused Class Launchpad
                                                    </div>
                                                    <h2 className="text-lg font-black truncate">
                                                        [{activeClan.tag}] {activeClan.name}
                                                    </h2>
                                                </div>
                                            </div>
                                            {activeClan.inviteCode && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyInviteLink(activeClan.inviteCode)}
                                                    className={`px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-center ${styles.secondaryBtn}`}
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                    <span>Copy Join Link ({activeClan.inviteCode})</span>
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                                            {([
                                                { id: 'sessions' as const, label: 'Sessions & Board', icon: Compass, accent: 'indigo' as const },
                                                { id: 'analytics' as const, label: 'Student Logs', icon: BarChart3, accent: 'emerald' as const },
                                                { id: 'ai_studio' as const, label: 'AI Quiz Gen', icon: Sparkles, accent: 'violet' as const },
                                                { id: 'students' as const, label: 'Students & Invites', icon: Users, accent: 'amber' as const },
                                                { id: 'chat' as const, label: 'Class Chat', icon: MessageCircle, accent: 'neutral' as const }
                                            ]).map(tool => {
                                                const Icon = tool.icon;
                                                return (
                                                    <button
                                                        key={tool.id}
                                                        type="button"
                                                        onClick={() => setActiveSection(tool.id)}
                                                        className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col gap-2 hover:-translate-y-0.5 ${
                                                            styles.isBento ? styles.kpiTile(tool.accent) : `${styles.subtleBox} hover:border-indigo-500/40`
                                                        }`}
                                                    >
                                                        <Icon className={`w-5 h-5 ${styles.isBento ? 'stroke-[2.5]' : 'text-indigo-500'}`} />
                                                        <span className="text-xs font-black leading-tight">{tool.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {/* Command Center Classes & Search */}
                                <section className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h2 className="text-lg font-black uppercase tracking-tight">
                                                Assigned Classes ({myClasses.length})
                                            </h2>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${styles.pillNeutral}`}>
                                                Provisioned by Admin
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            {myClasses.length > 0 && (
                                                <div className="relative flex-1 sm:w-72">
                                                    <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${styles.mutedText}`} />
                                                    <input
                                                        type="text"
                                                        value={classSearch}
                                                        onChange={e => setClassSearch(e.target.value)}
                                                        placeholder="Search classes by name, tag, or track..."
                                                        className={`w-full pl-10 pr-8 py-2.5 rounded-xl text-xs font-bold ${styles.input}`}
                                                    />
                                                    {classSearch && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setClassSearch('')}
                                                            aria-label="Clear search"
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md opacity-60 hover:opacity-100 cursor-pointer"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => loadMyClasses(selectedClassId)}
                                                disabled={loadingClasses}
                                                title="Refresh assigned classes"
                                                className={`p-2.5 rounded-xl cursor-pointer transition-all disabled:opacity-50 ${styles.secondaryBtn}`}
                                            >
                                                <RefreshCw className={`w-4 h-4 ${loadingClasses ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {loadingClasses ? (
                                        <div className={`py-14 text-center rounded-[2rem] ${styles.surfaceCard}`}>
                                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
                                            <p className={`text-xs font-bold ${styles.mutedText}`}>Loading your classes...</p>
                                        </div>
                                    ) : myClasses.length === 0 ? (
                                        renderEmptyNoClassesCard('Ask an Administrator to assign you as the teacher of a class to unlock curriculum sessions, live motion slide boards, homework tracking, and student analytics.')
                                    ) : filteredClasses.length === 0 ? (
                                        <div className={`p-10 rounded-[2rem] text-center space-y-2 ${styles.surfaceCard}`}>
                                            <p className={`text-sm font-bold ${styles.mutedText}`}>No classes match "{classSearch}".</p>
                                            <button
                                                type="button"
                                                onClick={() => setClassSearch('')}
                                                className={`px-4 py-2 rounded-xl text-xs cursor-pointer ${styles.secondaryBtn}`}
                                            >
                                                Clear Search
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                            {filteredClasses.map(renderClassCard)}
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {/* SECTION 2: ALL CLASSES */}
                        {activeSection === 'my_classes' && (
                            <section className="space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="relative flex-1 max-w-md">
                                        <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${styles.mutedText}`} />
                                        <input
                                            value={classSearch}
                                            onChange={e => setClassSearch(e.target.value)}
                                            placeholder="Filter classes by name or tag..."
                                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold ${styles.input}`}
                                        />
                                    </div>
                                    <div className={`px-3.5 py-2 rounded-xl text-xs font-bold ${styles.pillNeutral}`}>
                                        Provisioned by Admin
                                    </div>
                                </div>

                                {loadingClasses ? (
                                    <div className={`py-14 text-center rounded-[2rem] ${styles.surfaceCard}`}>
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
                                        <p className={`text-xs font-bold ${styles.mutedText}`}>Loading classes...</p>
                                    </div>
                                ) : myClasses.length === 0 ? (
                                    renderEmptyNoClassesCard('Ask your Administrator to assign you as the teacher of a class to access curriculum sessions, live motion slide boards, homework tracking, and student analytics.')
                                ) : filteredClasses.length === 0 ? (
                                    <div className={`p-10 rounded-[2rem] text-center ${styles.surfaceCard}`}>
                                        <p className={`text-sm font-bold ${styles.mutedText}`}>No classes match "{classSearch}".</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                        {filteredClasses.map(renderClassCard)}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* SECTION 4: UNIFIED SESSIONS, INTERACTIVE BOARD & PRESENTATIONS STUDIO */}
                        {(activeSection === 'sessions' || activeSection === 'board_studio' || activeSection === 'presentations') && (
                            <div className="space-y-5">
                                {/* Unified 3-in-1 Sub-Tab Switcher */}
                                <div className={`p-1.5 rounded-2xl flex flex-wrap items-center gap-1.5 w-full sm:w-fit ${
                                    styles.isBento
                                        ? 'bg-slate-100 border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10'
                                }`}>
                                    {([
                                        { id: 'sessions' as const, label: 'Class Sessions', icon: Compass },
                                        { id: 'board_studio' as const, label: 'Interactive Board', icon: MonitorPlay },
                                        { id: 'presentations' as const, label: 'Presentations & JSON', icon: FileCode }
                                    ]).map((tab) => {
                                        const TabIcon = tab.icon;
                                        const isSubActive = activeSection === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => setActiveSection(tab.id)}
                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                                                    isSubActive
                                                        ? styles.isBento
                                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                            : 'bg-indigo-600 text-white shadow-sm'
                                                        : styles.isBento
                                                            ? 'text-slate-700 hover:text-black hover:bg-white'
                                                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                            >
                                                <TabIcon className="w-3.5 h-3.5" />
                                                <span>{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {activeSection === 'sessions' && (
                                    myClasses.length === 0 ? (
                                        renderEmptyNoClassesCard('Once an Administrator assigns you a class, its curriculum sessions, slide decks, and homework status will appear here.')
                                    ) : loadingActiveClan || !activeClan ? (
                                        <div className={`py-14 text-center rounded-[2rem] ${styles.surfaceCard}`}>
                                            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600 mx-auto" />
                                        </div>
                                    ) : (
                                        <ClassCurriculumSection
                                            clan={activeClan}
                                            user={user}
                                            isTeacherOwner={true}
                                            presentationsRefreshKey={presentationsVersion}
                                            onRefreshClan={() => loadActiveClan(activeClan.clanId, true)}
                                            onRequestUploadSlides={(trackId, moduleId) => {
                                                setPresetUploadTarget({ trackId, moduleId });
                                                setActiveSection('presentations');
                                            }}
                                        />
                                    )
                                )}

                                {activeSection === 'board_studio' && (
                                    <TeacherBoardBrowser
                                        key={presentationsVersion}
                                        user={user}
                                        skillTracks={skillTracks}
                                        initialTrackId={activeClan?.trackId}
                                        selectedClassId={selectedClassId}
                                        onUploadForModule={(trackId, moduleId) => {
                                            setPresetUploadTarget({ trackId, moduleId });
                                            setActiveSection('presentations');
                                        }}
                                    />
                                )}

                                {activeSection === 'presentations' && (
                                    <PresentationLibraryManager
                                        key={presetUploadTarget ? `${presetUploadTarget.trackId}:${presetUploadTarget.moduleId}` : 'default'}
                                        currentUser={user}
                                        skillTracks={skillTracks}
                                        classes={myClasses}
                                        isAdminView={false}
                                        initialUploadTrackId={presetUploadTarget?.trackId}
                                        initialUploadModuleId={presetUploadTarget?.moduleId}
                                        onChanged={() => {
                                            setPresetUploadTarget(null);
                                            setPresentationsVersion(v => v + 1);
                                            loadMyClasses();
                                        }}
                                    />
                                )}
                            </div>
                        )}

                        {/* SECTION 6: ANALYTICS & STUDENT LOGS */}
                        {activeSection === 'analytics' && (
                            myClasses.length === 0 ? (
                                renderEmptyNoClassesCard('Once an Administrator assigns you a class, cohort analytics, weak topics, and individual student logs will appear here.')
                            ) : loadingActiveClan || !activeClan ? (
                                <div className={`py-14 text-center rounded-[2rem] ${styles.surfaceCard}`}>
                                    <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600 mx-auto" />
                                </div>
                            ) : (
                                <div className={`p-5 sm:p-6 rounded-[2rem] ${styles.surfaceCard}`}>
                                    <ClassAnalyticsLogsSection
                                        clan={activeClan}
                                        user={user}
                                        onOpenAiCoach={() => setActiveSection('ai_studio')}
                                    />
                                </div>
                            )
                        )}

                        {/* SECTION 7: AI QUIZ & LESSON STUDIO */}
                        {activeSection === 'ai_studio' && (
                            myClasses.length === 0 ? (
                                renderEmptyNoClassesCard('Once an Administrator assigns you a class, you can generate quiz questions from slides JSON and run AI lesson coaching here.')
                            ) : loadingActiveClan || !activeClan ? (
                                <div className={`py-14 text-center rounded-[2rem] ${styles.surfaceCard}`}>
                                    <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600 mx-auto" />
                                </div>
                            ) : (
                                <div className={`p-5 sm:p-6 rounded-[2rem] ${styles.surfaceCard}`}>
                                    <TeacherAiToolsSection
                                        clan={activeClan}
                                        user={user}
                                        onQuizPublished={() => loadActiveClan(activeClan.clanId, true)}
                                    />
                                </div>
                            )
                        )}

                        {/* SECTION 8: STUDENTS & INVITES */}
                        {activeSection === 'students' && (
                            myClasses.length === 0 ? (
                                renderEmptyNoClassesCard('Once an Administrator assigns you a class, you can share student invite links, approve requests, and manage your roster here.')
                            ) : loadingActiveClan || !activeClan ? (
                                <div className={`py-14 text-center rounded-[2rem] ${styles.surfaceCard}`}>
                                    <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600 mx-auto" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Top Grid: Invite Link + Direct Student Search */}
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                        <div className={`p-6 rounded-[2rem] space-y-4 ${styles.surfaceCard}`}>
                                            <div className="flex items-center justify-between gap-2">
                                                <h2 className="text-sm font-black uppercase tracking-wider">Shareable Invite Link</h2>
                                                <span className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-black ${styles.pillPrimary}`}>
                                                    {activeClan.inviteCode || 'NONE'}
                                                </span>
                                            </div>
                                            <p className={`text-xs font-medium ${styles.mutedText}`}>
                                                Send this link or join code to your students so they join <span className="font-bold">[{activeClan.tag}] {activeClan.name}</span> directly.
                                            </p>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input
                                                    readOnly
                                                    value={getInviteUrl(activeClan.inviteCode)}
                                                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-mono ${styles.input}`}
                                                />
                                                <div className="flex gap-2 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyInviteLink(activeClan.inviteCode)}
                                                        className={`px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer ${styles.primaryBtn}`}
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                        <span>Copy Link</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={regeneratingLink}
                                                        onClick={handleRegenerateInvite}
                                                        className={`px-3 py-2.5 rounded-xl cursor-pointer ${styles.secondaryBtn}`}
                                                        title="Generate a fresh invite code"
                                                    >
                                                        <RefreshCw className={`w-4 h-4 ${regeneratingLink ? 'animate-spin' : ''}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`p-6 rounded-[2rem] space-y-4 ${styles.surfaceCard}`}>
                                            <h2 className="text-sm font-black uppercase tracking-wider">Invite Registered Students</h2>
                                            <div className="flex gap-2">
                                                <input
                                                    value={inviteQuery}
                                                    onChange={e => setInviteQuery(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleInviteSearch()}
                                                    placeholder="Search student by name or email..."
                                                    className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold ${styles.input}`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleInviteSearch}
                                                    className={`px-4 py-2.5 rounded-xl text-xs uppercase cursor-pointer shrink-0 ${styles.primaryBtn}`}
                                                >
                                                    Search
                                                </button>
                                            </div>
                                            {inviteResults.length > 0 && (
                                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                                    {inviteResults.map(stu => (
                                                        <div key={stu.userId} className={`p-3 rounded-xl flex items-center justify-between gap-2 ${styles.subtleBox}`}>
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-sm truncate">{stu.name}</div>
                                                                <div className={`text-xs truncate ${styles.mutedText}`}>{stu.email}</div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSendSiteInvite(stu.userId)}
                                                                className={`px-3.5 py-1.5 rounded-lg text-xs cursor-pointer shrink-0 ${styles.successBtn}`}
                                                            >
                                                                Send Invite
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Pending Join Requests */}
                                    {(activeClan.activeJoinRequests?.length || 0) > 0 && (
                                        <div className={`p-6 rounded-[2rem] space-y-3 ${styles.surfaceCard}`}>
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-sm font-black uppercase tracking-wider">
                                                    Pending Join Requests ({activeClan.activeJoinRequests?.length})
                                                </h2>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {activeClan.activeJoinRequests?.map(req => (
                                                    <div key={req.userId} className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 ${styles.subtleBox}`}>
                                                        <div className="min-w-0">
                                                            <div className="font-black text-sm truncate">{req.userId}</div>
                                                            <div className={`text-[11px] font-semibold ${styles.mutedText}`}>
                                                                Requested {new Date(req.createdAt).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleJoinRequestDecision(req.userId, true)}
                                                                className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer ${styles.successBtn}`}
                                                            >
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                <span>Approve</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleJoinRequestDecision(req.userId, false)}
                                                                className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer ${styles.dangerBtn}`}
                                                            >
                                                                <XCircle className="w-3.5 h-3.5" />
                                                                <span>Decline</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Full Enrolled Class Roster */}
                                    <div className={`p-6 rounded-[2rem] space-y-4 ${styles.surfaceCard}`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <h2 className="text-sm font-black uppercase tracking-wider">
                                                Class Roster ({activeClan.members.length})
                                            </h2>
                                            <div className="relative w-full sm:w-64">
                                                <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${styles.mutedText}`} />
                                                <input
                                                    value={rosterSearch}
                                                    onChange={e => setRosterSearch(e.target.value)}
                                                    placeholder="Filter enrolled members..."
                                                    className={`w-full pl-8 pr-3 py-2 rounded-xl text-xs font-bold ${styles.input}`}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                            {filteredRoster.map(m => {
                                                const isLeaderRow = m.role === 'leader' || m.userId === activeClan.leaderId;
                                                const isConfirmingKick = confirmKickUserId === m.userId;

                                                return (
                                                    <div key={m.userId} className={`p-4 rounded-2xl flex flex-col justify-between gap-3 ${styles.subtleBox}`}>
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center font-black text-xs shrink-0 ${styles.pillPrimary}`}>
                                                                {m.avatar
                                                                    ? <Avatar config={m.avatar} size="sm" className="w-full h-full" />
                                                                    : (m.name || m.userId || 'U').slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-black text-sm truncate">{m.name || m.userId}</div>
                                                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                                                        isLeaderRow
                                                                            ? styles.pillWarning
                                                                            : m.role === 'elder'
                                                                                ? styles.pillPrimary
                                                                                : styles.pillNeutral
                                                                    }`}>
                                                                        {isLeaderRow ? 'Teacher' : m.role === 'elder' ? 'Assistant' : 'Student'}
                                                                    </span>
                                                                    <span className={`text-[11px] font-bold ${styles.mutedText}`}>
                                                                        {m.contribution || 0} XP
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {!isLeaderRow && (
                                                            <div className={`pt-2.5 border-t flex items-center justify-between gap-2 ${styles.divider}`}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRoleChange(m.userId, m.role === 'elder' ? 'member' : 'elder')}
                                                                    className={`px-2.5 py-1.5 rounded-xl text-[11px] flex items-center gap-1 cursor-pointer ${styles.secondaryBtn}`}
                                                                >
                                                                    {m.role === 'elder' ? (
                                                                        <>
                                                                            <ArrowDownCircle className="w-3.5 h-3.5" />
                                                                            <span>Set Student</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <ArrowUpCircle className="w-3.5 h-3.5" />
                                                                            <span>Make Assistant</span>
                                                                        </>
                                                                    )}
                                                                </button>

                                                                {isConfirmingKick ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveMember(m.userId)}
                                                                            className={`px-2.5 py-1.5 rounded-xl text-[11px] cursor-pointer ${styles.dangerBtn}`}
                                                                        >
                                                                            Confirm
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setConfirmKickUserId(null)}
                                                                            className={`px-2 py-1.5 rounded-xl text-[11px] cursor-pointer ${styles.secondaryBtn}`}
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setConfirmKickUserId(m.userId)}
                                                                        className={`p-1.5 rounded-xl cursor-pointer ${styles.dangerBtn}`}
                                                                        title="Remove from class"
                                                                        aria-label={`Remove ${m.name || m.userId}`}
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )
                        )}

                        {/* SECTION 9: CLASS CHAT */}
                        {activeSection === 'chat' && (
                            myClasses.length === 0 ? (
                                renderEmptyNoClassesCard('Once an Administrator assigns you a class, you can chat with students and share class resources here.')
                            ) : loadingActiveClan || !activeClan ? (
                                <div className={`py-14 text-center rounded-[2rem] ${styles.surfaceCard}`}>
                                    <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600 mx-auto" />
                                </div>
                            ) : (
                                <div className={`p-5 sm:p-6 rounded-[2rem] ${styles.surfaceCard}`}>
                                    <ClanChatSection
                                        clan={activeClan}
                                        currentUser={user}
                                        messages={chatMessages}
                                        onSendMessage={handleSendChat}
                                        onEditMessage={handleEditChat}
                                        onDeleteMessage={handleDeleteChat}
                                        isLeader={true}
                                        isElder={true}
                                        isBento={styles.isBento}
                                        onMarkAsRead={() => {}}
                                    />
                                </div>
                            )
                        )}

                        {/* SECTION 10: TRACKS & QUIZ LIBRARY */}
                        {activeSection === 'library' && (
                            <TeacherTrackQuizBrowser
                                skillTracks={skillTracks}
                                quizzes={quizzes}
                                initialTrackId={activeClan?.trackId}
                                onSelectQuiz={onSelectQuiz}
                            />
                        )}
                    </main>
        </div>
    );
};

export default TeacherDashboard;
