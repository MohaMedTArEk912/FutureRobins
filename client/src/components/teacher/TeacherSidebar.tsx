import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    GraduationCap,
    Compass,
    MonitorPlay,
    BookOpen,
    FileCode,
    BarChart3,
    Sparkles,
    Users,
    MessageCircle,
    Gamepad2,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    Award,
    User,
    LogOut,
    ArrowLeft,
    MessageSquare,
    type LucideIcon
} from 'lucide-react';
import type { UserData, ClassSummary, Clan } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import NotificationCenter from '../NotificationCenter';
import { ClanEmblem } from '../social/ClassEmblem';
import Avatar from '../Avatar';
import type { TeacherSectionId, TeacherThemeStyles } from './teacherTheme';

interface NavItemConfig {
    id: string;
    label: string;
    icon: LucideIcon;
    section?: TeacherSectionId;
    route?: string;
    matchRoutes?: string[];
    badge?: string | number;
    requiresClass?: boolean;
}

interface NavGroup {
    id: string;
    label: string;
    items: NavItemConfig[];
}

interface TeacherSidebarProps {
    user: UserData;
    styles: TeacherThemeStyles;
    activeSection: TeacherSectionId;
    onSelectSection: (section: TeacherSectionId) => void;
    myClasses: ClassSummary[];
    selectedClassId: string;
    activeClan: Clan | null;
    onSelectClass: (clanId: string) => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
    mobileOpen: boolean;
    onSetMobileOpen: (open: boolean) => void;
}

const DASHBOARD_PATHS = new Set(['/', '/dashboard', '/teacher']);

const ROUTE_TITLES: { prefix: string; label: string; icon: LucideIcon }[] = [
    { prefix: '/classroom', label: 'Live Classroom', icon: Gamepad2 },
    { prefix: '/leaderboard', label: 'Rankings', icon: Award },
    { prefix: '/social', label: 'Social Hub', icon: Users },
    { prefix: '/profile', label: 'Teacher Profile', icon: User },
    { prefix: '/tracks', label: 'Skill Tracks', icon: Compass },
    { prefix: '/quizzes', label: 'Quiz Bank', icon: BookOpen },
    { prefix: '/analytics', label: 'Analytics', icon: BarChart3 },
    { prefix: '/classes', label: 'Classes', icon: GraduationCap },
    { prefix: '/clans', label: 'Classes', icon: GraduationCap }
];

export const TeacherSidebar: React.FC<TeacherSidebarProps> = ({
    user,
    styles,
    activeSection,
    onSelectSection,
    myClasses,
    selectedClassId,
    activeClan,
    onSelectClass,
    collapsed,
    onToggleCollapse,
    mobileOpen,
    onSetMobileOpen
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();
    const { isOpen: isChatOpen, openChat, closeChat, unreadCount: chatUnreadCount } = useChat();

    const isOnDashboard = DASHBOARD_PATHS.has(location.pathname);
    const isOnProfile = location.pathname === '/profile';

    const selectedSummary = myClasses.find(c => c.clanId === selectedClassId) || myClasses[0];
    const studentCount = activeClan
        ? Math.max(0, (activeClan.members?.length || 1) - 1)
        : selectedSummary
            ? Math.max(0, (selectedSummary.memberCount || 1) - 1)
            : 0;
    const pendingRequestsCount = activeClan?.activeJoinRequests?.length || 0;

    const navGroups: NavGroup[] = [
        {
            id: 'studio',
            label: 'Studio & Classes',
            items: [
                { id: 'overview', section: 'overview', label: 'Command Center', icon: LayoutDashboard },
                {
                    id: 'my_classes',
                    section: 'my_classes',
                    matchRoutes: ['/classes', '/clans'],
                    label: 'Assigned Classes',
                    icon: GraduationCap,
                    badge: myClasses.length
                }
            ]
        },
        {
            id: 'teaching',
            label: 'Teaching & Content',
            items: [
                { id: 'sessions', section: 'sessions', label: 'Sessions & Board', icon: Compass, requiresClass: true },
                { id: 'presentations', section: 'presentations', label: 'Presentations & JSON', icon: FileCode },
                { id: 'board_studio', section: 'board_studio', label: 'Interactive Board', icon: MonitorPlay },
                {
                    id: 'library',
                    section: 'library',
                    matchRoutes: ['/tracks', '/quizzes'],
                    label: 'Tracks & Quizzes',
                    icon: BookOpen
                },
                { id: 'classroom', route: '/classroom', label: 'Live Classroom', icon: Gamepad2 }
            ]
        },
        {
            id: 'insights',
            label: 'Insights & AI',
            items: [
                {
                    id: 'analytics',
                    section: 'analytics',
                    matchRoutes: ['/analytics'],
                    label: 'Analytics & Logs',
                    icon: BarChart3,
                    requiresClass: true
                },
                { id: 'ai_studio', section: 'ai_studio', label: 'AI Quiz Studio', icon: Sparkles, requiresClass: true }
            ]
        },
        {
            id: 'community',
            label: 'Students & Community',
            items: [
                {
                    id: 'students',
                    section: 'students',
                    label: 'Students & Invites',
                    icon: Users,
                    badge: pendingRequestsCount > 0 ? `+${pendingRequestsCount}` : (selectedSummary ? studentCount : undefined),
                    requiresClass: true
                },
                { id: 'chat', section: 'chat', label: 'Class Chat', icon: MessageCircle, requiresClass: true },
                { id: 'leaderboard', route: '/leaderboard', label: 'Rankings', icon: Award },
                { id: 'social', route: '/social', label: 'Social Hub', icon: Users }
            ]
        }
    ];

    const isItemActive = (item: NavItemConfig) => {
        if (item.route) {
            return location.pathname === item.route || location.pathname.startsWith(`${item.route}/`);
        }
        if (isOnDashboard && item.section) {
            return activeSection === item.section;
        }
        if (item.matchRoutes) {
            return item.matchRoutes.some(
                p => location.pathname === p || location.pathname.startsWith(`${p}/`)
            );
        }
        return false;
    };

    const activeRouteMeta = ROUTE_TITLES.find(
        r => location.pathname === r.prefix || location.pathname.startsWith(`${r.prefix}/`)
    );
    const activeSectionMeta = navGroups.flatMap(g => g.items).find(i => i.section === activeSection);
    const mobileHeaderLabel = isOnDashboard
        ? (activeSectionMeta?.label || 'Command Center')
        : (activeRouteMeta?.label || 'Teacher Studio');
    const MobileHeaderIcon = isOnDashboard
        ? (activeSectionMeta?.icon || LayoutDashboard)
        : (activeRouteMeta?.icon || LayoutDashboard);

    const handlePickItem = (item: NavItemConfig) => {
        onSetMobileOpen(false);
        if (item.route) {
            navigate(item.route);
            return;
        }
        if (item.section) {
            onSelectSection(item.section);
        }
    };

    const handleGoBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    const handleLogout = () => {
        onSetMobileOpen(false);
        logout();
        navigate('/login', { replace: true });
    };

    const renderSidebarInner = (isMobileDrawer: boolean) => {
        const compact = collapsed && !isMobileDrawer;

        return (
            <div className="flex flex-col h-full min-h-0">
                {/* Teacher Identity Header (Clickable -> Profile) */}
                <div className={`${compact ? 'p-3 flex-col items-center gap-2.5' : 'p-4 items-center justify-between gap-2'} flex shrink-0 ${styles.sidebarHeaderBorder}`}>
                    <button
                        type="button"
                        onClick={() => {
                            onSetMobileOpen(false);
                            navigate('/profile');
                        }}
                        title={compact ? `${user.name} (View Profile)` : 'Open Teacher Profile'}
                        className={`flex items-center gap-3 min-w-0 text-left cursor-pointer rounded-2xl transition-all ${
                            compact ? 'justify-center p-0.5' : 'flex-1 p-1 -m-1 hover:opacity-90'
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 ${
                            styles.isBento
                                ? `bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_#000] ${isOnProfile ? 'ring-2 ring-black' : ''}`
                                : styles.isDark
                                    ? `bg-indigo-500/20 border ${isOnProfile ? 'border-indigo-400 ring-2 ring-indigo-500/40' : 'border-indigo-400/30'}`
                                    : `bg-indigo-100 border ${isOnProfile ? 'border-indigo-600 ring-2 ring-indigo-500/30' : 'border-indigo-200'}`
                        }`}>
                            {user.avatar ? (
                                <Avatar config={user.avatar} size="sm" className="w-full h-full" />
                            ) : (
                                <span className="font-black text-xs">
                                    {(user.name || 'T').slice(0, 2).toUpperCase()}
                                </span>
                            )}
                        </div>
                        {!compact && (
                            <div className="min-w-0">
                                <div className="text-sm font-black truncate">{user.name}</div>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mt-0.5 ${styles.pillPrimary}`}>
                                    Teacher Studio
                                </span>
                            </div>
                        )}
                    </button>

                    {isMobileDrawer ? (
                        <button
                            type="button"
                            onClick={() => onSetMobileOpen(false)}
                            className={`p-2 rounded-xl cursor-pointer shrink-0 ${styles.secondaryBtn}`}
                            aria-label="Close sidebar"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            className={`hidden lg:flex items-center justify-center ${compact ? 'w-full py-1.5' : 'p-1.5'} rounded-xl cursor-pointer shrink-0 ${styles.secondaryBtn}`}
                            title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
                            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            {compact ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        </button>
                    )}
                </div>

                {/* Navbar Utility Row moved into Sidebar: Messages, Notifications, Back */}
                <div className={`${compact ? 'px-2.5 py-2.5 flex-col items-center gap-2' : 'px-3.5 py-2.5 items-center gap-2'} flex shrink-0 border-b ${styles.divider}`}>
                    {!isOnDashboard && (
                        <button
                            type="button"
                            onClick={handleGoBack}
                            title="Back to previous page"
                            aria-label="Go back"
                            className={`${compact ? 'w-full py-2 justify-center' : 'px-2.5 py-2'} rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shrink-0 ${styles.secondaryBtn}`}
                        >
                            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                            {!compact && <span>Back</span>}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => (isChatOpen ? closeChat() : openChat())}
                        title="Messages & Chat Hub"
                        aria-label="Open Chat Hub"
                        className={`relative ${compact ? 'w-full py-2 justify-center' : 'flex-1 py-2 px-2.5 justify-center'} rounded-xl text-xs flex items-center gap-1.5 cursor-pointer ${
                            isChatOpen ? styles.primaryBtn : styles.secondaryBtn
                        }`}
                    >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                        {!compact && <span className="truncate">Messages</span>}
                        {chatUnreadCount > 0 && (
                            <span className={`min-w-[18px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-black ${
                                compact ? 'absolute -top-1.5 -right-1.5' : ''
                            } ${
                                styles.isBento
                                    ? 'bg-[#ef4444] text-white border border-black'
                                    : 'bg-rose-500 text-white'
                            }`}>
                                {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                            </span>
                        )}
                    </button>

                    <div className={compact ? 'flex justify-center' : 'shrink-0'}>
                        <NotificationCenter currentUser={user} align={isMobileDrawer ? 'right' : 'left'} />
                    </div>
                </div>

                {/* Active Class Switcher */}
                {!compact && (
                    <div className="p-3.5 pb-2 shrink-0">
                        <div className={`p-3 rounded-2xl space-y-2.5 ${styles.sidebarSwitcherBox}`}>
                            <div className="flex items-center justify-between gap-2">
                                <span className={`text-[10px] uppercase tracking-widest ${styles.sidebarSectionLabel}`}>
                                    Active Class
                                </span>
                                <span className={`text-[10px] font-bold ${styles.mutedText}`}>
                                    {myClasses.length} Assigned
                                </span>
                            </div>

                            {myClasses.length > 0 ? (
                                <>
                                    <div className="flex items-center gap-2.5">
                                        {selectedSummary && (
                                            <ClanEmblem
                                                logo={selectedSummary.logo}
                                                tag={selectedSummary.tag}
                                                name={selectedSummary.name}
                                                size="sm"
                                            />
                                        )}
                                        <select
                                            value={selectedClassId || selectedSummary?.clanId || ''}
                                            onChange={(e) => onSelectClass(e.target.value)}
                                            aria-label="Switch active class"
                                            className={`w-full px-2.5 py-2 rounded-xl text-xs font-black cursor-pointer truncate ${styles.select}`}
                                        >
                                            {myClasses.map(cls => (
                                                <option key={cls.clanId} value={cls.clanId}>
                                                    [{cls.tag}] {cls.name} ({Math.max(0, (cls.memberCount || 1) - 1)} stu)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {selectedSummary && (
                                        <div className="flex items-center justify-between text-[11px] font-bold">
                                            <span className={styles.mutedText}>
                                                {studentCount} {studentCount === 1 ? 'Student' : 'Students'}
                                            </span>
                                            <span className={styles.mutedText}>
                                                {selectedSummary.finishedSessionsCount || 0} Done
                                            </span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className={`text-[11px] font-semibold leading-snug ${styles.mutedText}`}>
                                    Awaiting Admin class assignment.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Unified De-Duplicated Navigation Groups */}
                <nav className={`flex-1 overflow-y-auto ${compact ? 'px-2.5 py-2 space-y-2' : 'px-3 py-2 space-y-4'}`}>
                    {navGroups.map((group, groupIdx) => (
                        <div key={group.id} className="space-y-1">
                            {!compact ? (
                                <div className={`px-2.5 pb-1 text-[10px] uppercase tracking-widest ${styles.sidebarSectionLabel}`}>
                                    {group.label}
                                </div>
                            ) : groupIdx > 0 ? (
                                <div className={`my-1.5 border-t ${styles.divider}`} />
                            ) : null}

                            {group.items.map(item => {
                                const Icon = item.icon;
                                const active = isItemActive(item);
                                const noClassHint = Boolean(item.requiresClass && myClasses.length === 0);

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handlePickItem(item)}
                                        title={compact ? item.label : undefined}
                                        className={`w-full flex items-center ${compact ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'} rounded-xl text-xs transition-all cursor-pointer ${
                                            active ? styles.navItemActive : styles.navItemIdle
                                        } ${noClassHint ? 'opacity-70' : ''}`}
                                    >
                                        <span className="flex items-center gap-2.5 min-w-0">
                                            <Icon className={`w-4 h-4 shrink-0 ${styles.isBento ? 'stroke-[2.5]' : ''}`} />
                                            {!compact && <span className="truncate">{item.label}</span>}
                                        </span>

                                        {!compact && item.badge !== undefined && (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                                active ? styles.navBadgeActive : styles.navBadgeIdle
                                            }`}>
                                                {item.badge}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* Sidebar Footer: Profile & Logout */}
                <div className={`p-3.5 border-t shrink-0 ${styles.divider}`}>
                    {/* Profile + Logout Row */}
                    <div className={compact ? 'flex flex-col gap-2' : 'grid grid-cols-2 gap-2'}>
                        <button
                            type="button"
                            onClick={() => {
                                onSetMobileOpen(false);
                                navigate('/profile');
                            }}
                            title="Teacher Profile"
                            className={`py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                isOnProfile ? styles.primaryBtn : styles.secondaryBtn
                            }`}
                        >
                            <User className="w-3.5 h-3.5 shrink-0" />
                            {!compact && <span className="truncate">Profile</span>}
                        </button>

                        <button
                            type="button"
                            onClick={handleLogout}
                            title="Logout"
                            aria-label="Logout"
                            className={`py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${styles.dangerBtn}`}
                        >
                            <LogOut className="w-3.5 h-3.5 shrink-0" />
                            {!compact && <span className="truncate">Logout</span>}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Mobile & Tablet Top Bar (replaces Top Navbar for Teachers) */}
            <div className={`lg:hidden flex items-center justify-between gap-2.5 p-3 rounded-2xl mb-1 ${styles.mobileTopBar}`}>
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        type="button"
                        onClick={() => onSetMobileOpen(true)}
                        className={`p-2 rounded-xl cursor-pointer shrink-0 ${styles.primaryBtn}`}
                        aria-label="Open Teacher Menu"
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                    {!isOnDashboard && (
                        <button
                            type="button"
                            onClick={handleGoBack}
                            className={`p-2 rounded-xl cursor-pointer shrink-0 ${styles.secondaryBtn}`}
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-black truncate">
                            <MobileHeaderIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{mobileHeaderLabel}</span>
                        </div>
                        {selectedSummary && (
                            <div className={`text-[11px] font-bold truncate ${styles.mutedText}`}>
                                [{selectedSummary.tag}] {selectedSummary.name}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => (isChatOpen ? closeChat() : openChat())}
                        title="Messages"
                        aria-label="Open Chat Hub"
                        className={`relative p-2 rounded-xl cursor-pointer ${styles.secondaryBtn}`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {chatUnreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                                {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                            </span>
                        )}
                    </button>

                    <NotificationCenter currentUser={user} />
                </div>
            </div>

            {/* Mobile Slide-Over Drawer */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-[140] lg:hidden flex"
                    onClick={() => onSetMobileOpen(false)}
                >
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" />
                    <aside
                        onClick={(e) => e.stopPropagation()}
                        className={`relative z-10 w-[85vw] max-w-[310px] h-full overflow-hidden flex flex-col ${styles.sidebarShell}`}
                    >
                        {renderSidebarInner(true)}
                    </aside>
                </div>
            )}

            {/* Desktop Persistent Fixed-Height Sidebar (overflow-visible so Notification popover never clips) */}
            <aside
                className={`hidden lg:flex flex-col shrink-0 lg:h-full rounded-[1.75rem] transition-[width] duration-200 overflow-visible relative z-30 ${
                    collapsed ? 'w-[80px]' : 'w-[252px] xl:w-[268px]'
                } ${styles.sidebarShell}`}
            >
                {renderSidebarInner(false)}
            </aside>
        </>
    );
};

export default TeacherSidebar;
