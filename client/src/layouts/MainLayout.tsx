import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import { useOptionalAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
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
    const { tx } = useLanguage();
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
            showNotification('info', tx(`${invite.fromName} challenged you to a quiz!`, `${invite.fromName} اتحداك في كويز مباشر!`), {
                title: tx('⚔️ Quiz Challenge', '⚔️ تحدي كويز'),
                action: {
                    label: tx('Accept Duel', 'اقبل التحدي'),
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
            const senderName = invite.fromUser?.name || tx('A classmate', 'زميلك');
            showNotification('info', tx(
                `${senderName} invited you to join Live Arena: ${invite.quizTitle || 'Live Arena'}!`,
                `${senderName} بعتلك دعوة للساحة المباشرة: ${invite.quizTitle || 'الساحة المباشرة'}!`
            ), {
                title: tx('🎮 Live Arena Invite', '🎮 دعوة للساحة المباشرة'),
                action: {
                    label: tx('Join Arena', 'ادخل الساحة'),
                    onClick: () => {
                        navigate(`/live-arena?pin=${invite.pin}`);
                    }
                }
            });
        };

        const handleHomeworkAlert = (alert: { title?: string; message?: string; link?: string; className?: string }) => {
            showNotification('warning', alert.message || tx('You have pending homework to complete!', 'عندك واجب لسه مخلصش!'), {
                title: alert.title || tx('📚 Homework Reminder', '📚 تذكير بالواجب'),
                duration: 8000,
                action: alert.link ? {
                    label: tx('Open Homework', 'افتح الواجب'),
                    onClick: () => navigate(alert.link!)
                } : undefined
            });
        };

        const handleClassInvite = (invite: { clanName?: string; inviterName?: string }) => {
            showNotification('info', tx(
                `${invite.inviterName || 'A teacher'} invited you to join "${invite.clanName || 'Class'}"`,
                `${invite.inviterName || 'مدرس'} بعتلك دعوة تنضم لكلاس "${invite.clanName || 'الكلاس'}"`
            ), {
                title: tx('🎓 Class Invitation', '🎓 دعوة كلاس'),
                duration: 7000,
                action: {
                    label: tx('View Invite', 'شوف الدعوة'),
                    onClick: () => navigate('/classes')
                }
            });
        };

        const handleRoleUpdated = (payload: { userId?: string; role?: 'user' | 'student' | 'teacher' | 'admin' }) => {
            if (payload?.role) {
                updateUser?.({ role: payload.role });
                refreshUser?.();
                const label = payload.role === 'teacher'
                    ? tx('Teacher Mode', 'وضع المدرس')
                    : payload.role === 'admin'
                        ? tx('Admin Mode', 'وضع الإدارة')
                        : tx('Student Mode', 'وضع الطالب');
                showNotification('info', tx(`Your account role was updated to ${label}.`, `تم تحديث صلاحية حسابك إلى ${label}.`), {
                    title: tx('🔄 Role Updated', '🔄 تحديث الصلاحية'),
                    duration: 7000
                });
            }
        };

        const handleNewNotification = (payload: { type?: string; title?: string; message?: string; link?: string }) => {
            if (payload?.type === 'tournament_invite') {
                showNotification('info', payload.message || tx('You were invited to a tournament!', 'اتدعيت لبطولة جديدة!'), {
                    title: payload.title || tx('🏆 Tournament Invite', '🏆 دعوة بطولة'),
                    duration: 8000,
                    action: {
                        label: tx('View Arena', 'افتح البطولة'),
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
    }, [socket, showNotification, navigate, updateUser, refreshUser, location.pathname, currentUser?.userId, tx]);

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
            {/* Unified Bottom Floating Notification Stack (prevents PWA banners from stacking/overlapping) */}
            <div className="fixed bottom-20 xl:bottom-6 start-3 end-3 sm:start-auto sm:end-6 z-[80] flex flex-col gap-2.5 sm:items-end pointer-events-none pb-safe">
                <PwaUpdatePrompt inline />
                <InstallPWA inline />
            </div>
            <NavbarCustomizerModal /> {/* Global Nav Customizer */}
            {!isQuizOrGame && (
                <GlobalChatDrawer />
            )}

            {/* Global Invite Modal */}
            {gameInvite && (
                <div className="app-dialog-overlay fixed inset-0 z-[200] flex items-center justify-center bg-black/30 dark:bg-black/45 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="app-dialog-panel app-dialog-panel--padded bg-white dark:bg-[#13141f] border border-gray-200 dark:border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
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
