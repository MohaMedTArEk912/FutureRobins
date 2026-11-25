import React, { Suspense, lazy, useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import { useOptionalAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSecretGame } from '../context/SecretGameContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavArrangement } from '../context/NavArrangementContext';
import { TeacherWorkspaceProvider, useTeacherWorkspace } from '../context/TeacherWorkspaceContext';
import { PersistentShellProvider } from '../context/PersistentShellContext';
import { getTeacherThemeStyles } from '../components/teacher/teacherTheme';
import TeacherSidebar from '../components/teacher/TeacherSidebar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import BottomNav from '../components/BottomNav';
import { AmbientBackground } from '../components/AmbientBackground';
import SpatialRouteStage from '../components/SpatialRouteStage';
import InstallPWA from '../components/InstallPWA';
import PwaUpdatePrompt from '../components/PwaUpdatePrompt';
import { GlobalChatDrawer } from '../components/chat/GlobalChatDrawer';
import { NavbarCustomizerModal } from '../components/nav/NavbarCustomizerModal';
import { SwordsSvg } from '../components/common/BrandIcons';
import { prefetchPrimaryRoutes } from '../lib/routePrefetch';

const NoirSnakeGameOverlay = lazy(() => import('../components/arcade/NoirSnakeGameOverlay'));
const BentoArcadeOverlay = lazy(() => import('../components/arcade/BentoArcadeOverlay'));

const AppShellFrame: React.FC<{
    isQuizOrGame: boolean;
    isStandaloneViewport: boolean;
}> = ({ isQuizOrGame, isStandaloneViewport }) => {
    const auth = useOptionalAuth();
    const currentUser = auth?.currentUser ?? null;
    const logout = auth?.logout;
    const { theme, isBento } = useTheme();
    const { phase, isChromeHidden } = useSecretGame();
    const isSecretTransitioning = phase !== 'idle';
    // CRITICAL: Never apply `transform` (`scale-*`/`translate-*`) or `will-change: transform` while idle!
    // Either property turns this page-height wrapper into a CSS containing block for `position: fixed`
    // descendants, pushing inline modals off the bottom of tall pages and breaking sticky chrome.
    const chromeTransitionClass = isChromeHidden
        ? 'transition-[opacity,transform] duration-[760ms] ease-[cubic-bezier(0.22,0.86,0.24,1)] will-change-[opacity,transform] origin-top opacity-0 scale-[0.93] translate-y-4 pointer-events-none select-none'
        : isSecretTransitioning
            ? 'transition-[opacity,transform] duration-[720ms] ease-[cubic-bezier(0.22,0.86,0.24,1)] will-change-[opacity,transform] origin-top opacity-100 scale-100 translate-y-0'
            : '';
    const location = useLocation();
    const navigate = useNavigate();
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
    const showPersistentStudentShell = !showTeacherSidebarShell && !isQuizOrGame && !isStandaloneViewport;

    useEffect(() => {
        contentScrollRef.current?.scrollTo({ top: 0 });
    }, [location.pathname, activeSection]);

    // Teacher Sidebar Shell with vertical spatial transitions
    if (showTeacherSidebarShell) {
        return (
            <PersistentShellProvider inPersistentShell={false}>
                <div className={`min-h-dvh lg:h-dvh lg:overflow-hidden flex flex-col transition-colors relative ${styles.pageShell}`}>
                    <AmbientBackground />
                    <div
                        aria-hidden={isChromeHidden || undefined}
                        className={`flex-1 min-h-0 relative z-10 w-full max-w-[1520px] mx-auto px-3 sm:px-5 py-4 lg:py-0 flex flex-col lg:flex-row gap-5 ${chromeTransitionClass}`}
                    >
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
                            <SpatialRouteStage axis="y" />
                        </div>
                    </div>
                </div>
            </PersistentShellProvider>
        );
    }

    // Standard Student / Guest / Admin Browsing Shell:
    // Keeps AmbientBackground (live snake), Navbar (gliding pill), Footer, and BottomNav mounted
    // while SpatialRouteStage grabs & swaps pages cleanly in navbar link order.
    if (showPersistentStudentShell) {
        const handleLogout = () => {
            logout?.();
            navigate('/login', { replace: true });
        };

        return (
            <PersistentShellProvider inPersistentShell={true}>
                <div className={`min-h-dvh flex flex-col justify-between transition-colors duration-200 relative selection:bg-indigo-500/25 dark:selection:bg-[#bef264]/28 ${
                    isBento
                        ? 'bg-transparent text-black'
                        : 'bg-[#0a0908] text-[#f5f3ec]'
                }`}>
                    <AmbientBackground />
                    <div
                        aria-hidden={isChromeHidden || undefined}
                        className={`flex-1 flex flex-col justify-between ${chromeTransitionClass}`}
                    >
                        <Navbar
                            user={currentUser}
                            onViewProfile={() => navigate('/profile')}
                            onViewLeaderboard={() => navigate('/leaderboard')}
                            onLogout={handleLogout}
                            showActions={true}
                        />
                        <SpatialRouteStage axis="x" className="relative z-10 flex flex-col" />
                        <Footer />
                        <BottomNav />
                    </div>
                </div>
            </PersistentShellProvider>
        );
    }

    // Full-screen game, quiz, classroom lobby (/live-arena), or join-class routes
    return (
        <PersistentShellProvider inPersistentShell={false}>
            <div className={`min-h-dvh flex flex-col transition-colors duration-200 relative selection:bg-indigo-500/25 dark:selection:bg-[#bef264]/28 ${
                isBento
                    ? 'bg-transparent text-black'
                    : 'bg-[#0a0908] text-[#f5f3ec]'
            }`}>
                <AmbientBackground />
                <SpatialRouteStage axis="x" className="relative z-10 flex-1 flex flex-col" />
            </div>
        </PersistentShellProvider>
    );
};

const MainLayout: React.FC = () => {
    const { socket } = useSocket();
    const { showNotification } = useNotification();
    const { tx } = useLanguage();
    const { activeGame, isChromeHidden } = useSecretGame();
    const { primaryItems } = useNavArrangement();
    const auth = useOptionalAuth();
    const currentUser = auth?.currentUser ?? null;
    const updateUser = auth?.updateUser;
    const refreshUser = auth?.refreshUser;
    const navigate = useNavigate();
    const location = useLocation();
    const [gameInvite, setGameInvite] = useState<{ fromId: string; fromName: string; quizId: string; roomId: string } | null>(null);

    const isQuizOrGame =
        location.pathname.startsWith('/quiz') ||
        location.pathname.startsWith('/game') ||
        location.pathname.startsWith('/results');

    const isStandaloneViewport =
        location.pathname.startsWith('/live-arena') ||
        location.pathname.startsWith('/classroom') ||
        location.pathname.startsWith('/classes/join') ||
        location.pathname.startsWith('/clans/join');

    // Warm primary nav chunks on idle so spatial page swipes animate with 0ms Suspense delay
    useEffect(() => {
        const paths = primaryItems.map((i) => i.path);
        prefetchPrimaryRoutes([...paths, '/profile']);
    }, [primaryItems]);

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
            <AppShellFrame
                isQuizOrGame={isQuizOrGame}
                isStandaloneViewport={isStandaloneViewport}
            />
            {/* Unified Bottom Floating Notification Stack (prevents PWA banners from stacking/overlapping) */}
            <div className={`fixed bottom-20 xl:bottom-6 start-3 end-3 sm:start-auto sm:end-6 z-[80] flex flex-col gap-2.5 sm:items-end pointer-events-none pb-safe transition-opacity duration-300 ${isChromeHidden ? 'opacity-0' : 'opacity-100'}`}>
                <PwaUpdatePrompt inline />
                <InstallPWA inline />
            </div>
            <NavbarCustomizerModal /> {/* Global Nav Customizer */}
            {!isQuizOrGame && !isChromeHidden && (
                <GlobalChatDrawer />
            )}
            {activeGame === 'noir-snake' && (
                <Suspense fallback={null}>
                    <NoirSnakeGameOverlay />
                </Suspense>
            )}
            {activeGame === 'bento-arcade' && (
                <Suspense fallback={null}>
                    <BentoArcadeOverlay />
                </Suspense>
            )}

            {/* Global Invite Modal */}
            {gameInvite && (
                <div className="app-dialog-overlay fixed inset-0 z-[200] flex items-center justify-center bg-black/30 dark:bg-black/65 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="app-dialog-panel app-dialog-panel--padded bg-white dark:bg-[#161411] border border-gray-200 dark:border-[#f5f3ec]/12 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-xl bg-orange-500 dark:bg-[#fde047] flex items-center justify-center text-white dark:text-[#0a0908] text-2xl mb-4 shadow-lg shadow-orange-500/25 dark:shadow-[0_8px_24px_rgba(251,113,133,0.22)]">
                            <SwordsSvg className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-black tracking-tight mb-1 text-gray-900 dark:text-[#f5f3ec] uppercase">
                            Quiz Challenge!
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-[#b5aea4] leading-relaxed mb-6 font-medium">
                            <span className="font-black text-orange-500 dark:text-[#fde047]">{gameInvite.fromName}</span> challenged you to a live 1v1 duel!
                        </p>
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={() => setGameInvite(null)}
                                className="flex-1 py-2.5 px-3 text-xs font-bold text-gray-600 dark:text-[#b5aea4] hover:bg-gray-100 dark:hover:bg-[#f5f3ec]/8 rounded-2xl transition-colors cursor-pointer border border-gray-200 dark:border-[#f5f3ec]/12"
                            >
                                Decline
                            </button>
                            <button
                                type="button"
                                onClick={acceptInvite}
                                className="flex-1 py-2.5 px-3 bg-orange-500 dark:bg-[#bef264] text-white dark:text-[#0a0908] font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-orange-500/25 dark:shadow-[0_10px_24px_-6px_rgba(190,242,100,0.35)] hover:opacity-95 active:scale-95 transition-all cursor-pointer"
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
