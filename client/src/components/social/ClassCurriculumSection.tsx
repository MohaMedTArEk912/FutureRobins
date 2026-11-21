import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Compass, CheckCircle2, Clock, Play, Bell, BookOpen, Lock,
    AlertTriangle, Send, Users, Presentation, ArrowRight, RotateCcw,
    Check, Layers, Radio, ClipboardCheck, MonitorPlay, Upload
} from 'lucide-react';
import type {
    Clan,
    UserData,
    SkillTrack,
    ClassHomeworkStatusResponse,
    ClassSessionStatus,
    MotionPresentation
} from '../../types';
import { api } from '../../lib/api';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import Avatar from '../Avatar';
import { PresentationModePlayer } from '../presentation/PresentationModePlayer';
import { TRAVELO_PART2_DECK } from '../../constants/traveloSlideDeck';

type SessionDashboardTab = 'overview' | 'board' | 'homework';

interface ClassCurriculumSectionProps {
    clan: Clan;
    user: UserData;
    isTeacherOwner: boolean;
    onRefreshClan: () => void;
    presentationsRefreshKey?: number;
    onRequestUploadSlides?: (trackId: string, moduleId: string) => void;
}

export const ClassCurriculumSection: React.FC<ClassCurriculumSectionProps> = ({
    clan,
    user,
    isTeacherOwner,
    onRefreshClan,
    presentationsRefreshKey = 0,
    onRequestUploadSlides
}) => {
    const { isBento } = useTheme();
    const { showNotification } = useNotification();
    const { socket } = useSocket();
    const navigate = useNavigate();

    const [tracks, setTracks] = useState<SkillTrack[]>([]);
    const [homeworkStatus, setHomeworkStatus] = useState<ClassHomeworkStatusResponse | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [assigningTrack, setAssigningTrack] = useState(false);
    const [selectedTrackId, setSelectedTrackId] = useState<string>(clan.trackId || '');

    // Selected Session Dashboard & Page Sub-Tabs (Zero Modals)
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [sessionTab, setSessionTab] = useState<SessionDashboardTab>('overview');
    const [togglingSessionId, setTogglingSessionId] = useState<string | null>(null);

    // Presentations per module (Teaching Board only)
    const [presentationsByModule, setPresentationsByModule] = useState<Record<string, MotionPresentation[]>>({});
    const [selectedBoardDeck, setSelectedBoardDeck] = useState<MotionPresentation | null>(null);
    const [livePresentationId, setLivePresentationId] = useState<string | null>(null);

    // Inline Homework Alert Composer (Zero Modals)
    const [alertTarget, setAlertTarget] = useState<{
        targetUserIds?: string[];
        targetName?: string;
    }>({});
    const [alertMessage, setAlertMessage] = useState('');
    const [sendingAlert, setSendingAlert] = useState(false);

    const loadData = useCallback(async () => {
        setLoadingStatus(true);
        try {
            const [allTracks, hwStatus, decks] = await Promise.all([
                api.getSkillTracks().catch(() => []),
                api.getClassHomeworkStatus(clan.clanId, user.userId).catch(() => null),
                api.getPresentations({ clanId: clan.clanId }, user.userId).catch(() => [])
            ]);

            setTracks(Array.isArray(allTracks) ? allTracks : []);
            if (hwStatus) {
                setHomeworkStatus(hwStatus);
                if (hwStatus.sessions?.length > 0 && !activeSessionId) {
                    const firstUnfinished = hwStatus.sessions.find(s => !s.isFinished) || hwStatus.sessions[0];
                    setActiveSessionId(firstUnfinished.moduleId);
                }
            }

            const grouped: Record<string, MotionPresentation[]> = {};
            if (Array.isArray(decks)) {
                decks.forEach(d => {
                    const targetModules = new Set([d.moduleId, ...(d.moduleIds || [])].filter((m): m is string => Boolean(m)));
                    targetModules.forEach(modId => {
                        if (!grouped[modId]) grouped[modId] = [];
                        grouped[modId].push(d);
                    });
                });
            }
            setPresentationsByModule(grouped);
        } finally {
            setLoadingStatus(false);
        }
    }, [clan.clanId, user.userId, activeSessionId]);

    useEffect(() => {
        setSelectedTrackId(clan.trackId || '');
        loadData();
    }, [clan.clanId, clan.trackId, presentationsRefreshKey, loadData]);

    // Real-time socket updates for session finish & live presentations
    useEffect(() => {
        if (!socket || !clan.clanId) return;

        const handleSessionUpdated = () => {
            loadData();
            onRefreshClan();
        };
        const handlePresStarted = ({ presentationId, clanId: targetClan }: { presentationId: string; clanId: string }) => {
            if (targetClan === clan.clanId) {
                setLivePresentationId(presentationId);
            }
        };
        const handlePresEnded = ({ clanId: targetClan }: { clanId: string }) => {
            if (targetClan === clan.clanId) {
                setLivePresentationId(null);
            }
        };

        socket.on('class_session_updated', handleSessionUpdated);
        socket.on('live_presentation_started', handlePresStarted);
        socket.on('live_presentation_ended', handlePresEnded);

        return () => {
            socket.off('class_session_updated', handleSessionUpdated);
            socket.off('live_presentation_started', handlePresStarted);
            socket.off('live_presentation_ended', handlePresEnded);
        };
    }, [socket, clan.clanId, loadData, onRefreshClan]);

    const handleAssignTrack = async (newTrackId: string) => {
        setSelectedTrackId(newTrackId);
        setAssigningTrack(true);
        try {
            await api.setClassTrack(clan.clanId, newTrackId || null, user.userId);
            showNotification('success', newTrackId ? 'Track assigned to class!' : 'Track cleared');
            setActiveSessionId(null);
            setSelectedBoardDeck(null);
            await loadData();
            onRefreshClan();
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to assign track');
        } finally {
            setAssigningTrack(false);
        }
    };

    const handleToggleSession = async (session: ClassSessionStatus, completed: boolean) => {
        setTogglingSessionId(session.moduleId);
        try {
            const res = await api.toggleClassSession(
                clan.clanId,
                session.moduleId,
                { completed, notifyStudents: completed },
                user.userId
            );
            showNotification('success', res.message || (completed ? 'Session marked finished!' : 'Session reopened'));
            await loadData();
            onRefreshClan();
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to update session');
        } finally {
            setTogglingSessionId(null);
        }
    };

    const handleSendInlineAlert = async (session: ClassSessionStatus) => {
        setSendingAlert(true);
        try {
            const res = await api.sendHomeworkAlert(
                clan.clanId,
                {
                    moduleId: session.moduleId,
                    targetUserIds: alertTarget.targetUserIds,
                    message: alertMessage.trim() || undefined
                },
                user.userId
            );
            showNotification('success', res.message || 'Homework alert sent!');
            setAlertMessage('');
            setAlertTarget({});
            await loadData();
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to send homework alert');
        } finally {
            setSendingAlert(false);
        }
    };

    const buildSessionFallbackDeck = useCallback((session: ClassSessionStatus): MotionPresentation => {
        const lowerTitle = `${session.title} ${homeworkStatus?.track?.title || ''}`.toLowerCase();
        if (lowerTitle.includes('travelo') || lowerTitle.includes('footer') || lowerTitle.includes('feature')) {
            return {
                ...TRAVELO_PART2_DECK,
                trackId: clan.trackId,
                moduleId: session.moduleId,
                clanId: clan.clanId
            };
        }

        return {
            title: session.title,
            description: session.description || '',
            trackId: clan.trackId,
            moduleId: session.moduleId,
            clanId: clan.clanId,
            theme: isBento ? 'bento' : 'dark-tech',
            slides: [
                {
                    id: 'intro',
                    layout: 'hero',
                    motion: 'zoom-in',
                    title: session.title,
                    subtitle: homeworkStatus?.track?.title || 'Class Session',
                    body: session.description || 'Welcome to today’s interactive session!'
                },
                ...(session.subModules && session.subModules.length > 0
                    ? [{
                        id: 'topics',
                        layout: 'bullets' as const,
                        motion: 'stagger' as const,
                        title: 'Session Topics',
                        bullets: session.subModules.map(sm => sm.title)
                    }]
                    : []),
                {
                    id: 'wrapup',
                    layout: 'homework',
                    motion: 'fade-up',
                    title: 'Homework & Practice',
                    bullets: session.quizzes.length > 0
                        ? session.quizzes.map(q => `Complete: ${q.title} (Pass: ${q.passingScore}%)`)
                        : ['Review session notes in Class Hub'],
                    callout: 'Make sure to complete your homework after this session!'
                }
            ]
        };
    }, [clan.clanId, clan.trackId, homeworkStatus?.track?.title, isBento]);

    const openBoardTab = async (session: ClassSessionStatus, deck?: MotionPresentation) => {
        if (deck) {
            try {
                const full = deck.presentationId
                    ? await api.getPresentation(deck.presentationId, user.userId)
                    : deck;
                setSelectedBoardDeck(full);
            } catch {
                setSelectedBoardDeck(deck);
            }
        } else {
            const firstSaved = (presentationsByModule[session.moduleId] || [])[0];
            if (firstSaved?.presentationId) {
                try {
                    const full = await api.getPresentation(firstSaved.presentationId, user.userId);
                    setSelectedBoardDeck(full);
                } catch {
                    setSelectedBoardDeck(firstSaved);
                }
            } else {
                setSelectedBoardDeck(buildSessionFallbackDeck(session));
            }
        }
        setSessionTab('board');
    };

    const sessions = homeworkStatus?.sessions || [];
    const students = homeworkStatus?.students || [];
    const activeSession = sessions.find(s => s.moduleId === activeSessionId) || sessions[0] || null;
    const finishedCount = sessions.filter(s => s.isFinished).length;

    const sessionDecks = activeSession ? (presentationsByModule[activeSession.moduleId] || []) : [];
    const freshSelectedFromDb = selectedBoardDeck?.presentationId
        ? sessionDecks.find(d => d.presentationId === selectedBoardDeck.presentationId)
        : undefined;
    const matchesActiveSession = Boolean(
        selectedBoardDeck && activeSession && (
            !selectedBoardDeck.presentationId
            || selectedBoardDeck.moduleId === activeSession.moduleId
            || selectedBoardDeck.moduleIds?.includes(activeSession.moduleId)
        )
    );
    const resolvedBoardDeck = freshSelectedFromDb
        || (matchesActiveSession ? selectedBoardDeck : undefined)
        || sessionDecks[0]
        || (activeSession ? buildSessionFallbackDeck(activeSession) : TRAVELO_PART2_DECK);

    // Student-specific pending alerts & homework
    const myStudentRow = students.find(s => s.userId === user.userId);
    const myPendingSessions = !isTeacherOwner
        ? sessions.filter(s => s.isFinished && s.quizzes.length > 0 && myStudentRow?.sessionProgress[s.moduleId]?.status !== 'completed')
        : [];
    const myRecentAlerts = !isTeacherOwner
        ? (homeworkStatus?.homeworkAlerts || []).filter(a => a.targetUserIds.includes(user.userId)).slice(0, 3)
        : [];
    const sessionAlerts = activeSession
        ? (homeworkStatus?.homeworkAlerts || []).filter(a => a.moduleId === activeSession.moduleId).slice(0, 5)
        : [];

    const handleSelectSession = (moduleId: string) => {
        setActiveSessionId(moduleId);
        setSelectedBoardDeck(null);
        setAlertTarget({});
        setAlertMessage('');
    };

    return (
        <div className="space-y-6 pr-1 pb-1">
            {/* Track Selection & Curriculum Banner */}
            <div className={`p-5 sm:p-6 rounded-3xl transition-all ${
                isBento
                    ? 'bg-[#e0f2fe] text-black border-2 border-black shadow-[4px_4px_0px_#000]'
                    : 'bg-indigo-500/10 border border-indigo-500/25 shadow-lg'
            }`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                            isBento ? 'bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-indigo-600 text-white shadow-md'
                        }`}>
                            {homeworkStatus?.track?.icon || <Compass className="w-6 h-6" />}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                                    isBento ? 'bg-black text-white' : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                                }`}>
                                    Class Track &amp; Sessions
                                </span>
                                {sessions.length > 0 && (
                                    <span className="text-xs font-black text-emerald-500">
                                        {finishedCount} / {sessions.length} Sessions Finished
                                    </span>
                                )}
                            </div>
                            <h3 className="text-xl font-black tracking-tight mt-1 truncate">
                                {homeworkStatus?.track?.title || 'No Track Selected Yet'}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                                {homeworkStatus?.track?.description || (user.role === 'admin'
                                    ? 'Choose a curriculum track below to unlock its sessions, interactive Teaching Board, and homework tracker.'
                                    : isTeacherOwner
                                        ? 'Ask an Administrator to assign a curriculum track for this class.'
                                        : 'Your class track has not been assigned by an Administrator yet.')}
                            </p>
                        </div>
                    </div>

                    {user.role === 'admin' && (
                        <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto">
                            <select
                                value={selectedTrackId}
                                disabled={assigningTrack}
                                onChange={e => handleAssignTrack(e.target.value)}
                                className={`w-full sm:w-auto sm:min-w-[230px] px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-white dark:bg-[#141210] border border-gray-300 dark:border-white/15 text-gray-900 dark:text-white'
                                }`}
                            >
                                <option value="">-- Choose Class Track --</option>
                                {tracks.map(t => (
                                    <option key={t.trackId} value={t.trackId}>
                                        {t.icon || '🗺️'} {t.title} ({t.modules?.length || 0} sessions)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Student Pending Homework Alerts Banner */}
            {!isTeacherOwner && (myPendingSessions.length > 0 || myRecentAlerts.length > 0) && (
                <div className={`p-5 rounded-3xl ${
                    isBento
                        ? 'bg-[#fed7aa] text-black border-2 border-black shadow-[4px_4px_0px_#000]'
                        : 'bg-amber-500/10 border-2 border-amber-500/30'
                }`}>
                    <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isBento ? 'bg-[#fde047] border-2 border-black' : 'bg-amber-500 text-white'
                        }`}>
                            <Bell className="w-5 h-5 animate-bounce" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                            <h4 className="text-sm font-black uppercase tracking-tight">
                                Pending Homework ({myPendingSessions.length})
                            </h4>
                            {myRecentAlerts[0] && (
                                <p className="text-xs font-bold opacity-85">
                                    Teacher Alert: &ldquo;{myRecentAlerts[0].message}&rdquo;
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2 pt-1">
                                {myPendingSessions.map(s => {
                                    const firstQuiz = s.quizzes[0];
                                    return (
                                        <button
                                            key={s.moduleId}
                                            type="button"
                                            onClick={() => firstQuiz ? navigate(`/quiz/${encodeURIComponent(firstQuiz.id)}`) : handleSelectSession(s.moduleId)}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                                                isBento
                                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow'
                                            }`}
                                        >
                                            <Play className="w-3.5 h-3.5 fill-current" />
                                            <span>Finish {s.title}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading or Empty Track */}
            {loadingStatus ? (
                <div className="py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-3" />
                    <p className="text-xs font-bold text-gray-500">Loading sessions &amp; homework tracker...</p>
                </div>
            ) : !homeworkStatus?.track || sessions.length === 0 ? (
                <div className={`p-6 sm:p-10 rounded-3xl text-center border-2 border-dashed space-y-4 ${
                    isBento ? 'border-black bg-white' : 'border-gray-200 dark:border-white/10'
                }`}>
                    <Compass className="w-12 h-12 mx-auto text-indigo-500 opacity-60" />
                    <div>
                        <h4 className="text-lg font-black uppercase">No Track Sessions Loaded</h4>
                        <p className="text-xs text-gray-500 mt-1">
                            {isTeacherOwner
                                ? 'Select a track from the dropdown above to view sessions, open the Teaching Board, and track student homework.'
                                : 'Wait for your teacher to select a curriculum track for this class.'}
                        </p>
                    </div>
                </div>
            ) : (
                /* Master-Detail: Sessions List + Tabbed Session Dashboard (Full Width Board when Teaching Board is open) */
                <div className={`grid grid-cols-1 gap-5 items-start ${
                    sessionTab === 'board' ? '' : 'xl:grid-cols-[248px_minmax(0,1fr)]'
                }`}>
                    {/* Session Switcher: Compact Horizontal Strip in Board View, Side Rail in Overview/Homework */}
                    {sessionTab === 'board' ? (
                        <div className={`p-3 rounded-2xl flex items-center gap-2 overflow-x-auto ${
                            isBento
                                ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-white/80 dark:bg-[#161827] border border-gray-200 dark:border-white/10'
                        }`}>
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-65 px-2 shrink-0">
                                Sessions ({sessions.length})
                            </span>
                            {sessions.map((session, idx) => {
                                const isSelected = activeSession?.moduleId === session.moduleId;
                                return (
                                    <button
                                        key={session.moduleId}
                                        type="button"
                                        onClick={() => handleSelectSession(session.moduleId)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer transition-all ${
                                            isSelected
                                                ? isBento
                                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-indigo-600 text-white shadow'
                                                : isBento
                                                    ? 'bg-slate-50 text-black border border-black/30 hover:border-black'
                                                    : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
                                        }`}
                                    >
                                        <span>S{session.level || idx + 1}:</span>
                                        <span className="max-w-[160px] truncate">{session.title}</span>
                                        {session.isFinished && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-2.5 min-w-0">
                            <div className="flex items-center justify-between px-1">
                                <h4 className="text-xs font-black uppercase tracking-widest opacity-70">
                                    Track Sessions ({sessions.length})
                                </h4>
                            </div>
                            <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1 pb-1">
                                {sessions.map((session, idx) => {
                                    const isSelected = activeSession?.moduleId === session.moduleId;
                                    const deckCount = (presentationsByModule[session.moduleId] || []).length;
                                    const myProg = myStudentRow?.sessionProgress[session.moduleId];
                                    const incompleteCount = session.incompleteStudentIds.length;

                                    return (
                                        <button
                                            key={session.moduleId}
                                            type="button"
                                            onClick={() => handleSelectSession(session.moduleId)}
                                            className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border ${
                                                isSelected
                                                    ? isBento
                                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                                        : 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20'
                                                    : isBento
                                                        ? 'bg-white text-black border-2 border-black/30 hover:border-black'
                                                        : 'bg-white/70 dark:bg-white/[0.03] border-gray-200 dark:border-white/10 hover:border-indigo-500/40'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                    isSelected
                                                        ? isBento ? 'bg-black text-white' : 'bg-white/20 text-white'
                                                        : session.isFinished
                                                            ? 'bg-emerald-500/15 text-emerald-500'
                                                            : 'bg-gray-200 dark:bg-white/10 text-gray-500'
                                                }`}>
                                                    Session {session.level || idx + 1}
                                                </span>

                                                {session.isFinished ? (
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-black ${
                                                        isSelected ? (isBento ? 'text-black' : 'text-emerald-200') : 'text-emerald-500'
                                                    }`}>
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Finished
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold opacity-60">
                                                        <Clock className="w-3 h-3" /> Upcoming
                                                    </span>
                                                )}
                                            </div>

                                            <div className="font-black text-sm leading-snug truncate">
                                                {session.title}
                                            </div>

                                            <div className="flex items-center gap-2 mt-2 text-[10px] font-bold opacity-80 flex-wrap">
                                                <span>{session.subModulesCount} Lessons</span>
                                                <span>•</span>
                                                <span>{session.quizzes.length} HW</span>
                                                {deckCount > 0 && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="inline-flex items-center gap-0.5">
                                                            <Presentation className="w-3 h-3" /> {deckCount} Deck{deckCount === 1 ? '' : 's'}
                                                        </span>
                                                    </>
                                                )}
                                            </div>

                                            {isTeacherOwner && session.quizzes.length > 0 && students.length > 0 && (
                                                <div className="mt-2 flex items-center justify-between text-[10px] font-black">
                                                    <span>HW: {session.completedStudentsCount}/{session.totalStudentsCount} Done</span>
                                                    {incompleteCount > 0 && session.isFinished && (
                                                        <span className={isSelected ? 'underline' : 'text-amber-500'}>
                                                            {incompleteCount} Pending
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {!isTeacherOwner && session.quizzes.length > 0 && (
                                                <div className="mt-2 text-[10px] font-black">
                                                    {myProg?.status === 'completed'
                                                        ? '✅ Your HW: Completed'
                                                        : session.isFinished
                                                            ? '⚠️ Your HW: Pending'
                                                            : '🔒 Locked until session finishes'}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Right Column: Tabbed Session Dashboard */}
                    {activeSession && (
                        <div className={`min-w-0 w-full rounded-3xl p-4 sm:p-5 space-y-4 ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[4px_4px_0px_#000]'
                                : 'bg-white/90 dark:bg-[#161827] border border-gray-200 dark:border-white/10 shadow-xl'
                        }`}>
                            {/* Session Dashboard Header */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-200 dark:border-white/10">
                                <div className="space-y-1.5 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                            isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-indigo-500/15 text-indigo-400'
                                        }`}>
                                            Session Dashboard • Level {activeSession.level || 1}
                                        </span>
                                        {activeSession.isFinished ? (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-500 inline-flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Finished by Teacher
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-500/15 text-slate-400">
                                                Active / In Progress
                                            </span>
                                        )}
                                        {livePresentationId && sessionDecks.some(d => d.presentationId === livePresentationId) && (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/15 text-rose-500 inline-flex items-center gap-1 animate-pulse">
                                                <Radio className="w-3 h-3" /> Live Session
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-2xl font-black tracking-tight">{activeSession.title}</h3>
                                    {activeSession.description && (
                                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                            {activeSession.description}
                                        </p>
                                    )}
                                </div>

                                {isTeacherOwner && (
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                        {activeSession.isFinished ? (
                                            <button
                                                type="button"
                                                disabled={togglingSessionId === activeSession.moduleId}
                                                onClick={() => handleToggleSession(activeSession, false)}
                                                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                                                    isBento
                                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
                                                }`}
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                                <span>Reopen Session</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={togglingSessionId === activeSession.moduleId}
                                                onClick={() => handleToggleSession(activeSession, true)}
                                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                                                    isBento
                                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25'
                                                }`}
                                            >
                                                <Check className="w-4 h-4 stroke-[3]" />
                                                <span>{togglingSessionId === activeSession.moduleId ? 'Saving...' : 'Finish Session'}</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Session Dashboard Navigation Tabs (Teaching Board Only - Uploads in Presentations Hub) */}
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap border-b border-gray-200 dark:border-white/10 pb-3">
                                {[
                                    { id: 'overview' as const, label: 'Overview & Content', icon: Layers },
                                    { id: 'board' as const, label: 'Teaching Board', icon: MonitorPlay },
                                    { id: 'homework' as const, label: isTeacherOwner ? `Homework & Alerts (${students.length})` : `Homework (${activeSession.quizzes.length})`, icon: ClipboardCheck }
                                ].map(tab => {
                                    const Icon = tab.icon;
                                    const isActive = sessionTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => {
                                                if (tab.id === 'board') {
                                                    openBoardTab(activeSession);
                                                } else {
                                                    setSessionTab(tab.id);
                                                }
                                            }}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                                                isActive
                                                    ? isBento
                                                        ? 'bg-black text-[#bef264] shadow-[2px_2px_0px_#000]'
                                                        : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                                    : isBento
                                                        ? 'bg-slate-100 text-black border border-black/25 hover:border-black'
                                                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
                                            }`}
                                        >
                                            <Icon className="w-3.5 h-3.5 shrink-0" />
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* TAB 1: Overview & Content */}
                            {sessionTab === 'overview' && (
                                <div className="space-y-6">
                                    {/* KPI Cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className={`p-3.5 rounded-2xl ${isBento ? 'bg-[#f8fafc] border-2 border-black' : 'bg-gray-50 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/5'}`}>
                                            <div className="text-[10px] font-black uppercase tracking-wider opacity-60">Lessons</div>
                                            <div className="text-xl font-black mt-0.5">{activeSession.subModulesCount}</div>
                                        </div>
                                        <div className={`p-3.5 rounded-2xl ${isBento ? 'bg-[#f8fafc] border-2 border-black' : 'bg-gray-50 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/5'}`}>
                                            <div className="text-[10px] font-black uppercase tracking-wider opacity-60">Motion Slides</div>
                                            <div className="text-xl font-black mt-0.5">{sessionDecks.length} Deck{sessionDecks.length === 1 ? '' : 's'}</div>
                                        </div>
                                        <div className={`p-3.5 rounded-2xl ${isBento ? 'bg-[#f8fafc] border-2 border-black' : 'bg-gray-50 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/5'}`}>
                                            <div className="text-[10px] font-black uppercase tracking-wider opacity-60">Homework</div>
                                            <div className="text-xl font-black mt-0.5">{activeSession.quizzes.length} Quiz{activeSession.quizzes.length === 1 ? '' : 'zes'}</div>
                                        </div>
                                        <div className={`p-3.5 rounded-2xl ${isBento ? 'bg-[#f8fafc] border-2 border-black' : 'bg-gray-50 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/5'}`}>
                                            <div className="text-[10px] font-black uppercase tracking-wider opacity-60">Completion</div>
                                            <div className="text-xl font-black mt-0.5 text-emerald-500">
                                                {activeSession.totalStudentsCount > 0
                                                    ? `${activeSession.completedStudentsCount}/${activeSession.totalStudentsCount}`
                                                    : '—'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Teaching Board & Assigned Slides Card */}
                                    <div className={`p-5 rounded-2xl space-y-4 ${
                                        isBento ? 'bg-[#fff7ed] border-2 border-black' : 'bg-indigo-500/5 border border-indigo-500/20'
                                    }`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Presentation className="w-5 h-5 text-indigo-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <h4 className="font-black text-sm uppercase tracking-tight">Session Teaching Board</h4>
                                                    <p className="text-xs opacity-75">
                                                        {sessionDecks.length > 0
                                                            ? 'Open the interactive Teaching Board with your module presentation.'
                                                            : isTeacherOwner
                                                                ? 'Upload & assign JSON slides from the Presentations tab, or launch the Teaching Board.'
                                                                : 'Open the live interactive Teaching Board for this session.'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                                                {isTeacherOwner && onRequestUploadSlides && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onRequestUploadSlides(clan.trackId || '', activeSession.moduleId)}
                                                        className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                                            isBento
                                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                : 'bg-white/80 dark:bg-white/10 hover:bg-white border border-black/15 dark:border-white/15'
                                                        }`}
                                                    >
                                                        <Upload className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{sessionDecks.length > 0 ? 'Manage Slides' : 'Upload Slides'}</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => openBoardTab(activeSession, sessionDecks[0])}
                                                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                                        isBento
                                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                                    }`}
                                                >
                                                    <MonitorPlay className="w-3.5 h-3.5 shrink-0" />
                                                    <span>{isTeacherOwner ? 'Open Teaching Board' : 'Open Class Board'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {sessionDecks.length > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                {sessionDecks.map(deck => (
                                                    <div
                                                        key={deck.presentationId || deck.title}
                                                        className={`p-3 rounded-xl flex items-center justify-between gap-2 ${
                                                            isBento ? 'bg-white border-2 border-black' : 'bg-white/70 dark:bg-black/30 border border-white/10'
                                                        }`}
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-xs truncate">{deck.title}</div>
                                                            <div className="text-[10px] opacity-70">
                                                                {deck.slides?.length || 0} slides • {deck.slides?.filter(s => s.layout === 'checkup').length || 0} check-ups
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => openBoardTab(activeSession, deck)}
                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase shrink-0 cursor-pointer ${
                                                                isBento
                                                                    ? 'bg-[#bef264] text-black border border-black'
                                                                    : 'bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25'
                                                            }`}
                                                        >
                                                            Open Board
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Session Content & Lessons */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 opacity-80">
                                            <Layers className="w-4 h-4 text-indigo-500" />
                                            <span>Session Content &amp; Lessons</span>
                                        </h4>
                                        {activeSession.subModules && activeSession.subModules.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                {activeSession.subModules.map((sub, i) => (
                                                    <div
                                                        key={sub.id || i}
                                                        className={`p-3.5 rounded-xl flex items-center gap-3 ${
                                                            isBento ? 'bg-slate-50 border-2 border-black' : 'bg-gray-50 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/5'
                                                        }`}
                                                    >
                                                        <span className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-500 font-black text-xs flex items-center justify-center shrink-0">
                                                            {i + 1}
                                                        </span>
                                                        <span className="text-xs font-bold truncate">{sub.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500">No sub-lessons listed for this session.</p>
                                        )}
                                    </div>

                                    {/* Quick Homework Preview */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 opacity-80">
                                                <BookOpen className="w-4 h-4 text-amber-500" />
                                                <span>Session Homework ({activeSession.quizzes.length})</span>
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={() => setSessionTab('homework')}
                                                className="text-xs font-black text-indigo-500 hover:underline cursor-pointer"
                                            >
                                                Open Homework &amp; Alerts Tab →
                                            </button>
                                        </div>

                                        {activeSession.quizzes.length === 0 ? (
                                            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] text-xs text-gray-500 font-medium">
                                                No homework quizzes linked to this session.
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {activeSession.quizzes.map(q => {
                                                    const myQuizStat = myStudentRow?.sessionProgress[activeSession.moduleId]?.quizzes.find(mq => mq.quizId === q.id);
                                                    const canStudentStart = isTeacherOwner || activeSession.isFinished || myQuizStat?.attempted;

                                                    return (
                                                        <div
                                                            key={q.id}
                                                            className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                                isBento ? 'bg-[#fefce8] border-2 border-black' : 'bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10'
                                                            }`}
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="font-black text-sm truncate">{q.title}</div>
                                                                <div className="text-[11px] text-gray-500 font-semibold mt-0.5">
                                                                    {q.questionsCount} Questions • Pass Score: {q.passingScore}%
                                                                    {!isTeacherOwner && myQuizStat && (
                                                                        <span className={`ml-2 font-black ${myQuizStat.passed ? 'text-emerald-500' : myQuizStat.attempted ? 'text-amber-500' : 'text-rose-500'}`}>
                                                                            • {myQuizStat.passed ? `Passed (${myQuizStat.bestPercentage}%)` : myQuizStat.attempted ? `Best: ${myQuizStat.bestPercentage}%` : 'Not Started'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                disabled={!canStudentStart}
                                                                onClick={() => navigate(`/quiz/${encodeURIComponent(q.id)}`)}
                                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                                                    isBento
                                                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                                }`}
                                                            >
                                                                {canStudentStart ? (
                                                                    <>
                                                                        <span>{isTeacherOwner ? 'Preview Quiz' : myQuizStat?.passed ? 'Retake' : 'Start Homework'}</span>
                                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Lock className="w-3.5 h-3.5" />
                                                                        <span>Locked</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: Interactive Teaching Board Only */}
                            {sessionTab === 'board' && (
                                <div className="space-y-3.5 min-w-0">
                                    {(sessionDecks.length > 1 || (sessionDecks.length === 0 && isTeacherOwner && onRequestUploadSlides)) && (
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            {sessionDecks.length > 1 ? (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {sessionDecks.map(deck => (
                                                        <button
                                                            key={deck.presentationId || deck.title}
                                                            type="button"
                                                            onClick={() => openBoardTab(activeSession, deck)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                                                                resolvedBoardDeck.presentationId === deck.presentationId
                                                                    ? isBento
                                                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                        : 'bg-indigo-600 text-white'
                                                                    : isBento
                                                                        ? 'bg-white text-black border-2 border-black/25 hover:border-black'
                                                                        : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200'
                                                            }`}
                                                        >
                                                            {deck.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold opacity-75">
                                                    No uploaded slides assigned to this session yet — showing default session deck.
                                                </span>
                                            )}

                                            {isTeacherOwner && onRequestUploadSlides && (
                                                <button
                                                    type="button"
                                                    onClick={() => onRequestUploadSlides(clan.trackId || '', activeSession.moduleId)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shrink-0 ${
                                                        isBento
                                                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                            : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/25'
                                                    }`}
                                                >
                                                    <Upload className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Upload Slides in Presentations</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <PresentationModePlayer
                                        key={`${resolvedBoardDeck.presentationId || resolvedBoardDeck.title}-${resolvedBoardDeck.updatedAt || ''}-${resolvedBoardDeck.slides?.length || 0}`}
                                        embedded={true}
                                        presentation={resolvedBoardDeck}
                                        clanId={clan.clanId}
                                        isTeacher={isTeacherOwner}
                                        userId={user.userId}
                                        userName={user.name}
                                        isSessionFinished={activeSession.isFinished}
                                        onFinishSession={isTeacherOwner
                                            ? () => handleToggleSession(activeSession, true)
                                            : undefined}
                                    />
                                </div>
                            )}

                            {/* TAB 4: Homework Quizzes, Student Tracker & Inline Alerts Composer */}
                            {sessionTab === 'homework' && (
                                <div className="space-y-6">
                                    {/* Quizzes List */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 opacity-80">
                                            <BookOpen className="w-4 h-4 text-amber-500" />
                                            <span>Assigned Homework Quizzes ({activeSession.quizzes.length})</span>
                                        </h4>
                                        {activeSession.quizzes.length === 0 ? (
                                            <p className="text-xs text-gray-500">No homework quizzes linked to this session.</p>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {activeSession.quizzes.map(q => {
                                                    const myQuizStat = myStudentRow?.sessionProgress[activeSession.moduleId]?.quizzes.find(mq => mq.quizId === q.id);
                                                    const canStudentStart = isTeacherOwner || activeSession.isFinished || myQuizStat?.attempted;

                                                    return (
                                                        <div
                                                            key={q.id}
                                                            className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                                isBento ? 'bg-[#fefce8] border-2 border-black' : 'bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10'
                                                            }`}
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="font-black text-sm truncate">{q.title}</div>
                                                                <div className="text-[11px] text-gray-500 font-semibold mt-0.5">
                                                                    {q.questionsCount} Questions • Pass Score: {q.passingScore}%
                                                                    {!isTeacherOwner && myQuizStat && (
                                                                        <span className={`ml-2 font-black ${myQuizStat.passed ? 'text-emerald-500' : myQuizStat.attempted ? 'text-amber-500' : 'text-rose-500'}`}>
                                                                            • {myQuizStat.passed ? `Passed (${myQuizStat.bestPercentage}%)` : myQuizStat.attempted ? `Best: ${myQuizStat.bestPercentage}%` : 'Not Started'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                disabled={!canStudentStart}
                                                                onClick={() => navigate(`/quiz/${encodeURIComponent(q.id)}`)}
                                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                                                    isBento
                                                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                                }`}
                                                            >
                                                                {canStudentStart ? (
                                                                    <>
                                                                        <span>{isTeacherOwner ? 'Preview Quiz' : myQuizStat?.passed ? 'Retake' : 'Start Homework'}</span>
                                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Lock className="w-3.5 h-3.5" />
                                                                        <span>Locked</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Teacher Inline Homework Alert Panel + Student Tracker */}
                                    {isTeacherOwner && activeSession.quizzes.length > 0 && (
                                        <div className={`grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-4 pt-4 border-t ${
                                            isBento ? 'border-black/15' : 'border-gray-200 dark:border-white/10'
                                        }`}>
                                            {/* Student Tracker */}
                                            <div className="space-y-2.5 min-w-0">
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                                        isBento ? 'text-black' : 'opacity-85'
                                                    }`}>
                                                        <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                                                        <span>Student Homework Tracker ({students.length})</span>
                                                    </h4>
                                                    {activeSession.incompleteStudentIds.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setAlertTarget({})}
                                                            className={`text-[11px] font-black cursor-pointer hover:underline ${
                                                                isBento ? 'text-black' : 'text-amber-600 dark:text-amber-400'
                                                            }`}
                                                        >
                                                            Select All Incomplete ({activeSession.incompleteStudentIds.length})
                                                        </button>
                                                    )}
                                                </div>

                                                {students.length === 0 ? (
                                                    <p className="text-xs text-gray-500">
                                                        Invite students using the Invite Students tab to track their homework here.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {students.map(student => {
                                                            const prog = student.sessionProgress[activeSession.moduleId];
                                                            const status = prog?.status || 'not_started';
                                                            const isDone = status === 'completed';
                                                            const isTargeted = alertTarget.targetUserIds?.[0] === student.userId;

                                                            return (
                                                                <div
                                                                    key={student.userId}
                                                                    className={`p-3 rounded-2xl space-y-2 transition-all ${
                                                                        isTargeted
                                                                            ? isBento
                                                                                ? 'bg-[#fef9c3] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                                                                : 'bg-amber-500/15 border-2 border-amber-500'
                                                                            : isBento
                                                                                ? 'bg-white text-black border-2 border-black'
                                                                                : 'bg-gray-50/70 dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/5'
                                                                    }`}
                                                                >
                                                                    {/* Top Compact Identity + Action Row */}
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                                            <div className={`w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center shrink-0 ${
                                                                                isBento ? 'bg-white border border-black' : 'bg-indigo-500/15'
                                                                            }`}>
                                                                                {student.avatar ? (
                                                                                    <Avatar config={student.avatar} size="sm" className="w-full h-full" />
                                                                                ) : (
                                                                                    <span className="font-black text-xs">{student.name.slice(0, 2).toUpperCase()}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="font-black text-xs sm:text-sm truncate">{student.name}</div>
                                                                        </div>

                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${
                                                                                isDone
                                                                                    ? isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                                                    : status === 'in_progress'
                                                                                        ? isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                                                                        : isBento ? 'bg-[#fecaca] text-black border border-black' : 'bg-rose-500/15 text-rose-500'
                                                                            }`}>
                                                                                {isDone ? '✓ Done' : status === 'in_progress' ? 'Needs Pass' : 'Pending'}
                                                                            </span>

                                                                            {!isDone && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setAlertTarget({
                                                                                        targetUserIds: [student.userId],
                                                                                        targetName: student.name
                                                                                    })}
                                                                                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                                                                                        isBento
                                                                                            ? isTargeted
                                                                                                ? 'bg-black text-[#fde047] border border-black'
                                                                                                : 'bg-[#fed7aa] text-black border border-black hover:bg-[#fdba74]'
                                                                                            : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                                                                    }`}
                                                                                >
                                                                                    <Bell className="w-3 h-3 shrink-0" />
                                                                                    <span>{isTargeted ? 'Selected' : 'Alert'}</span>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Compact Quiz Status Chips */}
                                                                    {prog?.quizzes && prog.quizzes.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {prog.quizzes.map(qz => (
                                                                                <span
                                                                                    key={qz.quizId}
                                                                                    title={`${qz.title}: ${qz.attempted ? `${qz.bestPercentage}%` : 'Not attempted'}`}
                                                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold max-w-full ${
                                                                                        isBento
                                                                                            ? 'bg-[#f8fafc] text-black border border-black/25'
                                                                                            : 'bg-white dark:bg-black/25 border border-gray-200 dark:border-white/10'
                                                                                    }`}
                                                                                >
                                                                                    <span className="truncate max-w-[180px]">{qz.title}</span>
                                                                                    <span className={`font-black shrink-0 ${
                                                                                        qz.passed
                                                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                                                            : qz.attempted
                                                                                                ? 'text-amber-600 dark:text-amber-400'
                                                                                                : 'text-rose-600 dark:text-rose-400'
                                                                                    }`}>
                                                                                        {qz.attempted ? `${qz.bestPercentage}%` : 'Pending'}
                                                                                    </span>
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Inline Homework Alert Composer (No Modal) */}
                                            <div className={`p-4 sm:p-5 rounded-2xl space-y-3 h-fit ${
                                                isBento
                                                    ? 'bg-[#fffbeb] text-black border-2 border-black shadow-[4px_4px_0px_#000]'
                                                    : 'bg-amber-500/5 border border-amber-500/25'
                                            }`}>
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                                        isBento ? 'bg-[#fde047] text-black border-2 border-black' : 'bg-amber-500/15 text-amber-500'
                                                    }`}>
                                                        <AlertTriangle className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-black text-xs sm:text-sm uppercase">Send Homework Alert</h4>
                                                        <p className={`text-[11px] font-bold truncate ${isBento ? 'text-slate-700' : 'opacity-75'}`}>
                                                            {alertTarget.targetName
                                                                ? `Recipient: ${alertTarget.targetName}`
                                                                : `Recipients: All ${activeSession.incompleteStudentIds.length} incomplete`}
                                                        </p>
                                                    </div>
                                                </div>

                                                <textarea
                                                    rows={2}
                                                    value={alertMessage}
                                                    onChange={e => setAlertMessage(e.target.value)}
                                                    placeholder={`Please complete your homework for "${activeSession.title}" before next class!`}
                                                    className={`w-full p-2.5 rounded-xl text-xs font-medium ${
                                                        isBento
                                                            ? 'bg-white border-2 border-black text-black placeholder:text-slate-500'
                                                            : 'bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10'
                                                    }`}
                                                />

                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {alertTarget.targetUserIds && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setAlertTarget({})}
                                                            className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer ${
                                                                isBento
                                                                    ? 'bg-white text-black border-2 border-black hover:bg-[#f1f5f9]'
                                                                    : 'bg-black/10 dark:bg-white/10'
                                                            }`}
                                                        >
                                                            All Incomplete
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        disabled={sendingAlert || activeSession.incompleteStudentIds.length === 0}
                                                        onClick={() => handleSendInlineAlert(activeSession)}
                                                        className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap ${
                                                            isBento
                                                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                : 'bg-amber-500 hover:bg-amber-600 text-white'
                                                        }`}
                                                    >
                                                        <Send className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{sendingAlert ? 'Sending...' : 'Send Alert'}</span>
                                                    </button>
                                                </div>

                                                {sessionAlerts.length > 0 && (
                                                    <div className={`pt-2.5 border-t space-y-1.5 ${
                                                        isBento ? 'border-black/15' : 'border-amber-500/20'
                                                    }`}>
                                                        <div className={`text-[10px] font-black uppercase tracking-wider ${
                                                            isBento ? 'text-slate-700' : 'opacity-60'
                                                        }`}>Recent Alerts ({sessionAlerts.length})</div>
                                                        {sessionAlerts.slice(0, 3).map((a, idx) => (
                                                            <div key={idx} className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium ${
                                                                isBento ? 'bg-white text-black border border-black/25' : 'bg-black/5 dark:bg-white/5 opacity-85'
                                                            }`}>
                                                                <span className="line-clamp-1">&ldquo;{a.message}&rdquo;</span>
                                                                <span className="text-[10px] font-bold opacity-70">{a.targetUserIds.length} student(s)</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClassCurriculumSection;
