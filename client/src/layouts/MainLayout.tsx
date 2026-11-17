import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import { useOptionalAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { TeacherWorkspaceProvider, useTeacherWorkspace } from '../context/TeacherWorkspaceContext';
import { getTeacherThemeStyles } from '../components/teacher/teacherTheme';
import TeacherSidebar from '../components/teacher/TeacherSidebar';
import { AmbientBackground } from '../components/AmbientBackground';
import InstallPWA from '../components/InstallPWA';
import PwaUpdatePrompt from '../components/PwaUpdatePrompt';
import { GlobalChatDrawer } from '../components/chat/GlobalChatDrawer';
import { NavbarCustomizerModal } from '../components/nav/NavbarCustomizerModal';

const TeacherShellFrame: React.FC<{ isQuizOrGame: boolean }> = ({ isQuizOrGame }) => {
    const auth = useOptionalAuth();
    const currentUser = auth?.currentUser ?? null;
    const { theme } = useTheme();
    const location = useLocation();
    const contentScrollRef = useRef<HTMLDivElement | null>(null);
    const styles = useMemo(() => getTeacherThemeStyles(theme), [theme]);
    const {
        activeSection,
        navigateToSection,
        myClasses,
        selectedClassId,
        setSelectedClassId,
        activeClan,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileDrawerOpen,
        setMobileDrawerOpen
    } = useTeacherWorkspace();

    const showTeacherSidebarShell = currentUser?.role === 'teacher' && !isQuizOrGame;

    useEffect(() => {
        contentScrollRef.current?.scrollTo({ top: 0 });
    }, [location.pathname, activeSection]);

    if (!showTeacherSidebarShell) {
        return <Outlet />;
    }

    return (
        <div className={`min-h-dvh lg:h-dvh lg:overflow-hidden flex flex-col transition-colors ${styles.pageShell}`}>
            {!styles.isBento && <AmbientBackground />}
            <div className="flex-1 min-h-0 relative w-full max-w-[1520px] mx-auto px-3 sm:px-5 py-4 lg:py-0 flex flex-col lg:flex-row gap-5">
                <div className="lg:py-3 lg:h-full shrink-0">
                    <TeacherSidebar
                        user={currentUser}
                        styles={styles}
                        activeSection={activeSection}
                        onSelectSection={(section) => navigateToSection(section)}
                        myClasses={myClasses}
                        selectedClassId={selectedClassId}
                        activeClan={activeClan}
                        onSelectClass={(id) => setSelectedClassId(id)}
                        collapsed={sidebarCollapsed}
                        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
                        mobileOpen={mobileDrawerOpen}
                        onSetMobileOpen={setMobileDrawerOpen}
                    />
                </div>
                <div
                    ref={contentScrollRef}
                    className="flex-1 min-w-0 min-h-0 w-full flex flex-col lg:h-full lg:overflow-y-auto lg:overflow-x-hidden lg:py-3 lg:pl-1.5 lg:pr-4"
                >
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

const MainLayout: React.FC = () => {
    const { socket } = useSocket();
    const { showNotification } = useNotification();
    const auth = useOptionalAuth();
    const currentUser = auth?.currentUser ?? null;
    const updateUser = auth?.updateUser;
    const refreshUser = auth?.refreshUser;
    const navigate = useNavigate();
    const location = useLocation();
    const [gameInvite, setGameInvite] = useState<{ fromId: string; fromName: string; quizId: string; roomId: string } | null>(null);

    const isQuizOrGame = location.pathname.startsWith('/quiz') || location.pathname.startsWith('/game');

    // Socket Listeners (Global)
    useEffect(() => {
        if (!socket) return;

        const handleInvite = (invite: { fromId: string; fromName: string; quizId: string; roomId: string }) => {
            setGameInvite(invite);
            showNotification('info', `${invite.fromName} challenged you to a quiz!`, {
                title: '⚔️ Quiz Challenge',
                action: {
                    label: 'Accept Duel',
                    onClick: () => {
                        navigate('/game/vs', {
                            state: {
                                quizId: invite.quizId,
                                opponent: { id: invite.fromId, name: invite.fromName },
                                roomId: invite.roomId
                            }
                        });
                    }
                }
            });
        };

        const handleClassroomInvite = (invite: { fromUser?: { name: string }; pin: string; quizTitle?: string }) => {
            const senderName = invite.fromUser?.name || 'A classmate';
            showNotification('info', `${senderName} invited you to join Classroom Duel: ${invite.quizTitle || 'Live Arena'}!`, {
                title: '🎓 Classroom Invite',
                action: {
                    label: 'Join Duel',
                    onClick: () => {
                        navigate(`/classroom?pin=${invite.pin}`);
                    }
                }
            });
        };

        const handleHomeworkAlert = (alert: { title?: string; message?: string; link?: string; className?: string }) => {
            showNotification('warning', alert.message || 'You have pending homework to complete!', {
                title: alert.title || '📚 Homework Reminder',
                duration: 8000,
                action: alert.link ? {
                    label: 'Open Homework',
                    onClick: () => navigate(alert.link!)
                } : undefined
            });
        };

        const handleClassInvite = (invite: { clanName?: string; inviterName?: string }) => {
            showNotification('info', `${invite.inviterName || 'A teacher'} invited you to join "${invite.clanName || 'Class'}"`, {
                title: '🎓 Class Invitation',
                duration: 7000,
                action: {
                    label: 'View Invite',
                    onClick: () => navigate('/classes')
                }
            });
        };

        const handleRoleUpdated = (payload: { userId?: string; role?: 'user' | 'student' | 'teacher' | 'admin' }) => {
            if (payload?.role) {
                updateUser?.({ role: payload.role });
                refreshUser?.();
                const label = payload.role === 'teacher' ? 'Teacher Mode' : payload.role === 'admin' ? 'Admin Mode' : 'Student Mode';
                showNotification('info', `Your account role was updated to ${label}.`, {
                    title: '🔄 Role Updated',
                    duration: 7000
                });
            }
        };

        const handleNewNotification = (payload: { type?: string; title?: string; message?: string; link?: string }) => {
            if (payload?.type === 'tournament_invite') {
                showNotification('info', payload.message || 'You were invited to a tournament!', {
                    title: payload.title || '🏆 Tournament Invite',
                    duration: 8000,
                    action: {
                        label: 'View Arena',
                        onClick: () => navigate(payload.link || '/tournaments')
                    }
                });
            }
        };

        const handleTournamentRequestStatus = (payload: { tournamentId?: string; status?: string; userId?: string; tournamentName?: string }) => {
            if (payload?.userId && currentUser?.userId && payload.userId !== currentUser.userId) return;
            if (location.pathname === '/tournaments') return;
            if (payload?.status === 'approved') {
                showNotification(
                    'success',
                    `Your request to join "${payload.tournamentName || 'the tournament'}" was approved!`,
                    {
                        title: '🎉 Tournament Approved',
                        duration: 8000,
                        action: {
                            label: 'Open Arena',
                            onClick: () => navigate(payload.tournamentId ? `/tournaments?invite=${encodeURIComponent(payload.tournamentId)}` : '/tournaments')
                        }
                    }
                );
            }
        };

        socket.on('game_invite', handleInvite);
        socket.on('classroom_invite_received', handleClassroomInvite);
        socket.on('homework_alert', handleHomeworkAlert);
        socket.on('class_invite_received', handleClassInvite);
        socket.on('user_role_updated', handleRoleUpdated);
        socket.on('new_notification', handleNewNotification);
        socket.on('tournament_request_status', handleTournamentRequestStatus);

        return () => {
            socket.off('game_invite', handleInvite);
            socket.off('classroom_invite_received', handleClassroomInvite);
            socket.off('homework_alert', handleHomeworkAlert);
            socket.off('class_invite_received', handleClassInvite);
            socket.off('user_role_updated', handleRoleUpdated);
            socket.off('new_notification', handleNewNotification);
            socket.off('tournament_request_status', handleTournamentRequestStatus);
        };
    }, [socket, showNotification, navigate, updateUser, refreshUser, location.pathname, currentUser?.userId]);

    const acceptInvite = () => {
        if (!gameInvite) return;
        navigate('/game/vs', {
            state: {
                quizId: gameInvite.quizId,
                opponent: { id: gameInvite.fromId, name: gameInvite.fromName },
                roomId: gameInvite.roomId
            }
        });
        setGameInvite(null);
    };

    return (
        <TeacherWorkspaceProvider>
            <TeacherShellFrame isQuizOrGame={isQuizOrGame} />
            <InstallPWA /> {/* Global PWA install prompt */}
            <PwaUpdatePrompt /> {/* Global PWA auto-update prompt */}
            <NavbarCustomizerModal /> {/* Global Nav Customizer */}
            {!isQuizOrGame && (
                <GlobalChatDrawer />
            )}

            {/* Global Invite Modal */}
            {gameInvite && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 dark:bg-black/45 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#13141f] border border-gray-200 dark:border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-white text-2xl mb-4 shadow-lg shadow-orange-500/25">
                            ⚔️
                        </div>
                        <h3 className="text-lg font-black tracking-tight mb-1 text-gray-900 dark:text-white uppercase">
                            Quiz Challenge!
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-6 font-medium">
                            <span className="font-black text-orange-500 dark:text-orange-400">{gameInvite.fromName}</span> challenged you to a live 1v1 duel!
                        </p>
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={() => setGameInvite(null)}
                                className="flex-1 py-2.5 px-3 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-2xl transition-colors cursor-pointer border border-gray-200 dark:border-white/5"
                            >
                                Decline
                            </button>
                            <button
                                type="button"
                                onClick={acceptInvite}
                                className="flex-1 py-2.5 px-3 bg-gradient-to-r from-orange-500 via-rose-500 to-pink-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-orange-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                            >
                                Accept Duel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </TeacherWorkspaceProvider>
    );
};

export default MainLayout;
