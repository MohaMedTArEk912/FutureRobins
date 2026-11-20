import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Copy, Check, GraduationCap, User as UserIcon, LogOut, X } from 'lucide-react';
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
    const { language, tx } = useLanguage();
    const { isBento } = useTheme();
    const auth = useOptionalAuth();
    const currentUser = auth?.currentUser ?? null;
    const updateUser = auth?.updateUser;
    const refreshUser = auth?.refreshUser;
    const demoLogin = auth?.demoLogin;
    const logout = auth?.logout;
    const navigate = useNavigate();
    const location = useLocation();
    const [gameInvite, setGameInvite] = useState<{ fromId: string; fromName: string; quizId: string; roomId: string } | null>(null);
    const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);
    const [demoSwitching, setDemoSwitching] = useState(false);
    const [demoLinkCopied, setDemoLinkCopied] = useState(false);

    const isQuizOrGame = location.pathname.startsWith('/quiz') || location.pathname.startsWith('/game');
    const isDemoAccount = currentUser?.userId === 'demo_student' || currentUser?.userId === 'demo_teacher';
    const isDemoTeacher = currentUser?.userId === 'demo_teacher';

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

    const handleSwitchDemoRole = async () => {
        if (!demoLogin || demoSwitching) return;
        setDemoSwitching(true);
        try {
            const nextRole = isDemoTeacher ? 'student' : 'teacher';
            await demoLogin({ role: nextRole, preferredLanguage: language });
            navigate('/', { replace: true });
            showNotification(
                'info',
                nextRole === 'teacher'
                    ? tx('Switched to Teacher Studio Demo view.', 'تم التحويل إلى عرض استوديو المدرس التجريبي.')
                    : tx('Switched to Student Demo view.', 'تم التحويل إلى عرض الطالب التجريبي.')
            );
        } catch (err) {
            console.error('Switch demo role error:', err);
        } finally {
            setDemoSwitching(false);
        }
    };

    const handleCopyDemoShareLink = async () => {
        const link = `${window.location.origin}/demo`;
        try {
            await navigator.clipboard.writeText(link);
            setDemoLinkCopied(true);
            window.setTimeout(() => setDemoLinkCopied(false), 2000);
        } catch {
            showNotification('info', `${tx('Live Demo Link:', 'لينك الديمو المباشر:')} ${link}`);
        }
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

            {/* Floating Live Demo Mode Bar (only for demo_student / demo_teacher) */}
            {isDemoAccount && !isQuizOrGame && !demoBannerDismissed && (
                <div className={`fixed bottom-16 xl:bottom-4 start-3 end-3 sm:end-auto z-[65] max-w-max rounded-2xl px-3 py-2 flex flex-wrap items-center gap-2 transition-all animate-in fade-in slide-in-from-bottom-3 ${
                    isBento
                        ? 'bg-[#fde047] text-black border-2 border-black shadow-[4px_4px_0px_#000]'
                        : 'bg-slate-900/95 dark:bg-[#13141f]/95 text-white border border-indigo-400/30 shadow-2xl backdrop-blur-md'
                }`}>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-1">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>
                            {isDemoTeacher
                                ? tx('Demo: Teacher', 'ديمو: مدرس')
                                : tx('Demo: Student', 'ديمو: طالب')}
                        </span>
                    </span>

                    <button
                        type="button"
                        disabled={demoSwitching}
                        onClick={() => void handleSwitchDemoRole()}
                        className={`btn-unstyled inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all disabled:opacity-60 ${
                            isBento
                                ? 'bg-[#bef264] text-black border border-black hover:bg-[#a3e635]'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                        title={tx('Switch between Student & Teacher workflows', 'التبديل بين حساب الطالب وحساب المدرس')}
                    >
                        {isDemoTeacher ? <UserIcon className="w-3 h-3 shrink-0" /> : <GraduationCap className="w-3 h-3 shrink-0" />}
                        <span>
                            {demoSwitching
                                ? tx('Switching...', 'بنبدل...')
                                : isDemoTeacher
                                    ? tx('Switch to Student', 'حساب الطالب')
                                    : tx('Try Teacher Studio', 'استوديو المدرس')}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => void handleCopyDemoShareLink()}
                        className={`btn-unstyled inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                            isBento
                                ? 'bg-white text-black border border-black hover:bg-[#bae6fd]'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                        title={tx('Copy /demo link', 'نسخ لينك الديمو')}
                    >
                        {demoLinkCopied ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                        <span>{demoLinkCopied ? tx('Copied!', 'اتنسخ!') : tx('Copy Link', 'نسخ اللينك')}</span>
                    </button>

                    {logout && (
                        <button
                            type="button"
                            onClick={() => {
                                logout();
                                navigate('/login');
                            }}
                            className={`btn-unstyled inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                                isBento
                                    ? 'bg-[#fecdd3] text-black border border-black hover:bg-rose-300'
                                    : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200'
                            }`}
                            title={tx('Exit demo session', 'الخروج من الديمو')}
                        >
                            <LogOut className="w-3 h-3 shrink-0" />
                            <span className="hidden sm:inline">{tx('Exit', 'خروج')}</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setDemoBannerDismissed(true)}
                        className="btn-unstyled p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
                        aria-label={tx('Hide demo bar', 'إخفاء شريط الديمو')}
                        title={tx('Hide', 'إخفاء')}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
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
