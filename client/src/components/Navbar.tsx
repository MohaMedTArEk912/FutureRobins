import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
    User,
    LogOut,
    ArrowLeft,
    Menu,
    X,
    ChevronDown,
    Sparkles,
    MessageSquare,
    Gamepad2,
    GraduationCap,
    Check
} from 'lucide-react';
import NotificationCenter from './NotificationCenter.tsx';
import type { UserData } from '../types/index.ts';
import { useNavigate, useLocation } from 'react-router-dom';
import Avatar from './Avatar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavArrangement } from '../context/NavArrangementContext';
import { useSecretGame } from '../context/SecretGameContext';
import DemoRoleSwitchButton from './DemoRoleSwitchButton';
import { prefetchRoute } from '../lib/routePrefetch';
import { navigateBackSafely } from '../lib/navigation';

interface NavbarProps {
    user?: UserData | null;
    onBack?: () => void;
    onViewProfile?: () => void;
    onViewLeaderboard?: () => void;
    onLogout?: () => void;
    showBack?: boolean;
    title?: string;
    showActions?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({
    user,
    onBack,
    onViewProfile,
    onViewLeaderboard,
    onLogout,
    showBack,
    title = "Quiz Platform",
    showActions = true
}) => {
    const { isBento } = useTheme();
    const { isArabic, tx } = useLanguage();
    const { logout: authLogout } = useAuth();
    const { isOpen: isChatOpen, openChat, closeChat, unreadCount: chatUnreadCount } = useChat();
    const { primaryItems, secondaryItems } = useNavArrangement();
    const { launchNoirSnake, launchBentoArcade } = useSecretGame();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isBrandOpen, setIsBrandOpen] = useState(false);
    const moreDropdownRef = useRef<HTMLDivElement>(null);
    const desktopBrandRef = useRef<HTMLDivElement>(null);
    const mobileBrandRef = useRef<HTMLDivElement>(null);
    const navTrackRef = useRef<HTMLElement>(null);
    const glidePillRef = useRef<HTMLSpanElement>(null);
    const navBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const navigate = useNavigate();
    const location = useLocation();

    const isGuest = !user || user.userId === 'guest' || !user.email;
    const isDemoAccount = user?.userId === 'demo_student' || user?.userId === 'demo_teacher';
    const isRoot = location.pathname === '/' || location.pathname === '/dashboard';
    const shouldShowBack = showBack !== undefined ? showBack : !isRoot;

    // Close dropdowns when clicking outside or pressing Escape
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (moreDropdownRef.current && !moreDropdownRef.current.contains(target)) {
                setIsMoreOpen(false);
            }
            const clickedDesktopBrand = desktopBrandRef.current?.contains(target);
            const clickedMobileBrand = mobileBrandRef.current?.contains(target);
            if (!clickedDesktopBrand && !clickedMobileBrand) {
                setIsBrandOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsMoreOpen(false);
                setIsBrandOpen(false);
                setIsMenuOpen(false);
            }
        };

        if (isMoreOpen || isMenuOpen || isBrandOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMoreOpen, isMenuOpen, isBrandOpen]);

    // Automatically close mobile menu and dropdowns on route change
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsMenuOpen(false);
        setIsMoreOpen(false);
        setIsBrandOpen(false);
    }, [location.pathname]);

    // Warm-load the active theme's secret arcade chunk when the Brand Switcher opens
    // so switching into Arcade plays with 0ms lazy-load delay.
    useEffect(() => {
        if (!isBrandOpen) return;
        if (isBento) {
            void import('./arcade/BentoArcadeOverlay');
        } else {
            void import('./arcade/NoirSnakeGameOverlay');
        }
    }, [isBrandOpen, isBento]);

    const handleLaunchArcade = useCallback(() => {
        setIsBrandOpen(false);
        setIsMenuOpen(false);
        if (isBento) {
            launchBentoArcade();
        } else {
            launchNoirSnake();
        }
    }, [isBento, launchBentoArcade, launchNoirSnake]);

    const renderBrandSwitcher = (containerRef: React.RefObject<HTMLDivElement | null>, showStatusDot: boolean) => (
        <div className="relative min-w-0" ref={containerRef}>
            <button
                type="button"
                onClick={() => {
                    setIsMoreOpen(false);
                    setIsBrandOpen(prev => !prev);
                }}
                aria-haspopup="menu"
                aria-expanded={isBrandOpen}
                aria-label={tx('Switch between Quiz Platform and Arcade', 'التبديل بين منصة الكويزات والأركيد')}
                className={`btn-unstyled flex items-center gap-1.5 px-2.5 py-1.5 -ms-2 rounded-xl min-w-0 cursor-pointer transition-all text-start select-none ${
                    isBento
                        ? isBrandOpen
                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                            : 'border-2 border-transparent text-black hover:bg-[#fef9c3]'
                        : isBrandOpen
                            ? 'bg-[#1c1917] text-[#f5f3ec] border border-[#2e2924]'
                            : 'border border-transparent text-[#f5f3ec] hover:bg-[#1c1917]/80'
                }`}
            >
                <span className="text-sm sm:text-base font-black tracking-tight whitespace-nowrap truncate">
                    {tx('Quiz Platform', 'منصة الكويزات')}
                </span>
                {showStatusDot && (isRoot || !title || title === 'Quiz Platform') && (
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse hidden sm:inline-block shrink-0 ${isBento ? 'bg-black' : 'bg-[#fde047]'}`} />
                )}
                <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                        isBrandOpen ? 'rotate-180' : ''
                    } ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}
                />
            </button>

            {isBrandOpen && (
                <div
                    role="menu"
                    className={`absolute top-full mt-2 start-0 w-64 sm:w-[272px] p-2 rounded-2xl z-[60] space-y-1.5 animate-in fade-in zoom-in-95 duration-150 ${
                        isBento
                            ? 'bg-white border-[3px] border-black shadow-[6px_6px_0px_#000] text-black'
                            : 'bg-[#141210] border-[1.5px] border-[#2e2924] shadow-[0_12px_0_#050504] text-[#f5f3ec]'
                    }`}
                >
                    <div className={`px-2.5 pt-1 pb-0.5 text-[10px] font-black uppercase tracking-widest ${
                        isBento ? 'text-black/60' : 'text-[#78716c]'
                    }`}>
                        {tx('Switch Space', 'اختار الوضع')}
                    </div>

                    {/* Option 1: Quiz Platform */}
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            setIsBrandOpen(false);
                            navigate('/');
                        }}
                        className={`btn-unstyled w-full flex items-center gap-3 p-2.5 rounded-xl text-start transition-all cursor-pointer ${
                            isBento
                                ? 'bg-[#fef9c3] hover:bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                                : 'bg-[#1c1917] hover:bg-[#24201c] border border-[#2e2924] text-[#f5f3ec]'
                        }`}
                    >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                : 'bg-[#192211] text-[#bef264] border border-[#bef264]/40'
                        }`}>
                            <GraduationCap className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-black leading-tight truncate">
                                {tx('Quiz Platform', 'منصة الكويزات')}
                            </div>
                            <div className={`text-[10px] font-bold mt-0.5 truncate ${
                                isBento ? 'text-black/70' : 'text-[#a8a29e]'
                            }`}>
                                {tx('Roads, quizzes & live arena', 'المسارات والكويزات والساحة')}
                            </div>
                        </div>
                        <Check className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                    </button>

                    {/* Option 2: Theme-Matched Secret Arcade */}
                    <button
                        type="button"
                        role="menuitem"
                        onClick={handleLaunchArcade}
                        className={`btn-unstyled w-full flex items-center gap-3 p-2.5 rounded-xl text-start transition-all cursor-pointer ${
                            isBento
                                ? 'bg-[#faf8f2] hover:bg-[#bef264] border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                                : 'bg-[#0e0d0b] hover:bg-[#1c1917] border border-[#2e2924] hover:border-[#fde047]/50 text-[#f5f3ec]'
                        }`}
                    >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/40'
                        }`}>
                            <Gamepad2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-black leading-tight truncate">
                                {tx('Arcade', 'الأركيد')}
                            </div>
                            <div className={`text-[10px] font-bold mt-0.5 truncate ${
                                isBento ? 'text-black/70' : 'text-[#a8a29e]'
                            }`}>
                                {isBento
                                    ? tx('Bento Smash & Paper Dash', 'Bento Smash و Paper Dash')
                                    : tx('0xSNAKE • Hunted & Harvest', '0xSNAKE • المطاردة والحصاد')}
                            </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 ${
                            isBento
                                ? 'bg-[#fde047] text-black border-[1.5px] border-black'
                                : 'bg-[#bef264] text-[#0a0908]'
                        }`}>
                            {tx('Play', 'العب')}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );

    const handleProfileClick = () => {
        if (onViewProfile) onViewProfile();
        else navigate('/profile');
    };

    const handleLeaderboardClick = () => {
        if (onViewLeaderboard) onViewLeaderboard();
        else navigate('/leaderboard');
    };

    const handleLogoutClick = () => {
        if (onLogout) onLogout();
        else authLogout();
    };

    const handleBack = () => {
        if (onBack) {
            onBack();
            return;
        }
        navigateBackSafely(navigate, '/');
    };

    const allNavItems = useMemo(() => {
        return [...primaryItems, ...secondaryItems];
    }, [primaryItems, secondaryItems]);

    const isActive = useCallback((path: string) => {
        if (path === '/') {
            return location.pathname === '/' || location.pathname === '/dashboard';
        }
        return location.pathname === path || location.pathname.startsWith(`${path}/`);
    }, [location.pathname]);

    const isSecondaryActive = useMemo(() => {
        return secondaryItems.some(item => isActive(item.path));
    }, [isActive, secondaryItems]);

    const activeSecondaryItem = useMemo(() => {
        return secondaryItems.find(item => isActive(item.path));
    }, [isActive, secondaryItems]);

    const activeDesktopKey = useMemo(() => {
        const primaryMatch = primaryItems.find(item => isActive(item.path));
        if (primaryMatch) return primaryMatch.path;
        if (isSecondaryActive) return '__more__';
        return null;
    }, [primaryItems, isActive, isSecondaryActive]);

    const measureGlidePill = useCallback(() => {
        const track = navTrackRef.current;
        const pill = glidePillRef.current;
        const btn = activeDesktopKey ? navBtnRefs.current[activeDesktopKey] : null;
        if (!track || !pill || !btn) {
            if (pill) pill.style.opacity = '0';
            return;
        }
        const trackRect = track.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        if (btnRect.width === 0) {
            pill.style.opacity = '0';
            return;
        }
        const left = btnRect.left - trackRect.left;
        const top = btnRect.top - trackRect.top;
        pill.style.width = `${btnRect.width}px`;
        pill.style.height = `${btnRect.height}px`;
        pill.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        pill.style.opacity = '1';
    }, [activeDesktopKey]);

    useLayoutEffect(() => {
        measureGlidePill();
    }, [measureGlidePill, isArabic, isBento, primaryItems]);

    useEffect(() => {
        const track = navTrackRef.current;
        if (!track || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => measureGlidePill());
        ro.observe(track);
        window.addEventListener('resize', measureGlidePill, { passive: true });
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', measureGlidePill);
        };
    }, [measureGlidePill]);

    const hasClanInvites = Boolean(user?.clanInvites && user.clanInvites.length > 0);

    // Teachers use the unified left sidebar as their primary navigation bar
    if (user?.role === 'teacher') {
        return null;
    }

    return (
        <header data-snake-wall="top" className={`sticky top-0 z-50 pt-safe pl-safe pr-safe transition-colors ${
            isBento
                ? 'bg-white text-black border-b-3 border-black shadow-[0_4px_0px_#000]'
                : 'glass-panel border-b border-slate-200/80 dark:border-[#f5f3ec]/10'
        }`}>
            <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5">
                {/* Desktop View (xl:flex) - Responsive 3-section bar without horizontal collision */}
                <div className="hidden xl:flex items-center justify-between gap-3 w-full min-h-10">
                    {/* Left Column: Brand & Optional Back Button */}
                    <div className="flex items-center justify-start gap-2.5 shrink-0">
                        {shouldShowBack && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className={`h-9 flex items-center gap-1.5 px-3 rounded-xl transition-all text-xs active:scale-95 cursor-pointer shrink-0 ${
                                    isBento
                                        ? 'bg-[#fde047] text-black font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1917] dark:hover:bg-[#24201c] text-slate-700 dark:text-[#f5f3ec] font-semibold border border-slate-200/60 dark:border-[#f5f3ec]/12'
                                }`}
                                title={tx('Go back to previous page', 'الرجوع للصفحة اللي فاتت')}
                                aria-label={tx('Go back', 'رجوع')}
                            >
                                <ArrowLeft className={`w-4 h-4 ${isBento ? 'stroke-[2.5]' : ''} ${isArabic ? 'rotate-180' : ''}`} />
                                <span>{tx('Back', 'رجوع')}</span>
                            </button>
                        )}

                        {renderBrandSwitcher(desktopBrandRef, true)}
                    </div>

                    {/* Center Column: Segmented Pill Navigation */}
                    <div className="min-w-0 flex-1 flex items-center justify-center">
                        <nav ref={navTrackRef} className={`relative flex items-center gap-1 p-1 rounded-2xl shrink-0 ${
                            isBento
                                ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-slate-100/80 dark:bg-[#141210] border border-slate-200/80 dark:border-[#f5f3ec]/10 shadow-inner'
                        }`}>
                            <span
                                ref={glidePillRef}
                                aria-hidden="true"
                                className={`nav-glide-indicator pointer-events-none absolute left-0 top-0 z-0 rounded-xl opacity-0 ${
                                    isBento
                                        ? 'bg-[#bef264] border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-white dark:bg-[#bef264] shadow-sm shadow-indigo-500/20 dark:shadow-[0_6px_18px_-6px_rgba(190,242,100,0.4)]'
                                }`}
                            />
                            {primaryItems.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.path);

                                return (
                                    <button
                                        key={item.path}
                                        ref={(el) => { navBtnRefs.current[item.path] = el; }}
                                        type="button"
                                        onMouseEnter={() => prefetchRoute(item.path)}
                                        onFocus={() => prefetchRoute(item.path)}
                                        onClick={() => {
                                            if (item.path === '/leaderboard') {
                                                handleLeaderboardClick();
                                            } else {
                                                navigate(item.path);
                                            }
                                        }}
                                        className={`relative z-10 h-8 flex items-center gap-1.5 px-2.5 2xl:px-3 rounded-xl font-bold text-xs whitespace-nowrap transition-colors duration-200 cursor-pointer border-2 border-transparent ${
                                            isBento
                                                ? (active
                                                    ? 'text-black font-black'
                                                    : 'text-black hover:bg-[#fef9c3]')
                                                : (active
                                                    ? 'text-slate-900 dark:text-[#0a0908] dark:font-black'
                                                    : 'text-slate-600 dark:text-[#b5aea4] hover:text-slate-900 dark:hover:text-[#f5f3ec] hover:bg-white/60 dark:hover:bg-[#f5f3ec]/[0.06]')
                                        }`}
                                    >
                                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isBento ? 'stroke-[2.5]' : (active ? 'text-indigo-600 dark:text-[#0a0908]' : '')}`} />
                                        <span className="2xl:hidden whitespace-nowrap">{item.shortLabel || item.label}</span>
                                        <span className="hidden 2xl:inline whitespace-nowrap">{item.label}</span>
                                        {active && (
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isBento ? 'bg-black' : 'bg-indigo-600 dark:bg-[#0a0908]'}`} />
                                        )}
                                    </button>
                                );
                            })}

                            {/* More Dropdown */}
                            <div className="relative z-10" ref={moreDropdownRef}>
                                <button
                                    ref={(el) => { navBtnRefs.current['__more__'] = el; }}
                                    type="button"
                                    onClick={() => setIsMoreOpen(prev => !prev)}
                                    aria-expanded={isMoreOpen}
                                    aria-haspopup="true"
                                    className={`relative z-10 h-8 flex items-center gap-1.5 px-2.5 2xl:px-3 rounded-xl font-bold text-xs whitespace-nowrap transition-colors duration-200 cursor-pointer border-2 border-transparent ${
                                        isBento
                                            ? (isSecondaryActive
                                                ? 'text-black font-black'
                                                : 'text-black hover:bg-[#fef9c3]')
                                            : (isSecondaryActive
                                                ? 'text-slate-900 dark:text-[#0a0908] dark:font-black'
                                                : 'text-slate-600 dark:text-[#b5aea4] hover:text-slate-900 dark:hover:text-[#f5f3ec] hover:bg-white/60 dark:hover:bg-[#f5f3ec]/[0.06]')
                                    }`}
                                >
                                    <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isBento ? 'stroke-[2.5]' : (isSecondaryActive ? 'text-indigo-600 dark:text-[#0a0908]' : '')}`} />
                                    <span>{isSecondaryActive && activeSecondaryItem ? activeSecondaryItem.shortLabel : tx('More', 'المزيد')}</span>
                                    {isSecondaryActive && (
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isBento ? 'bg-black' : 'bg-indigo-600 dark:bg-[#0a0908]'}`} />
                                    )}
                                    <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} />
                                    {hasClanInvites && (
                                        <span className="absolute -top-0.5 -end-0.5 w-2 h-2 rounded-full bg-rose-500 dark:bg-[#fb7185] ring-2 ring-white dark:ring-[#0a0908]"></span>
                                    )}
                                </button>

                                {/* Dropdown Floating Menu */}
                                {isMoreOpen && (
                                    <div className={`absolute top-full mt-2 end-0 w-64 p-2 rounded-2xl z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150 ${
                                        isBento
                                            ? 'bg-white border-2.5 border-black shadow-[5px_5px_0px_#000]'
                                            : 'bg-white/95 dark:bg-[#141210] backdrop-blur-xl dark:backdrop-blur-none border border-slate-200/80 dark:border-[1.5px] dark:border-[#2b2722] shadow-2xl dark:shadow-[0_6px_0_#050504]'
                                    }`}>
                                        {secondaryItems.length === 0 ? (
                                            <div className={`p-3 text-center rounded-xl text-xs font-bold ${
                                                isBento ? 'text-black/70 bg-[#fef9c3]' : 'text-slate-500 dark:text-[#a8a29e] bg-slate-50 dark:bg-[#1c1917]'
                                            }`}>
                                                {tx('All tabs are pinned to top bar!', 'كل الأقسام متثبتة فوق بالفعل!')}
                                            </div>
                                        ) : (
                                            secondaryItems.map((item) => {
                                                const Icon = item.icon;
                                                const active = isActive(item.path);
                                                const showDot = (item.path === '/clans' || item.path === '/classes') && hasClanInvites;

                                                return (
                                                    <button
                                                        key={item.path}
                                                        type="button"
                                                        onMouseEnter={() => prefetchRoute(item.path)}
                                                        onFocus={() => prefetchRoute(item.path)}
                                                        onClick={() => {
                                                            navigate(item.path);
                                                            setIsMoreOpen(false);
                                                        }}
                                                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                                            isBento
                                                                ? (active
                                                                    ? 'bg-[#bef264] text-black border-2 border-black font-black'
                                                                    : 'text-black hover:bg-[#fef9c3] font-bold')
                                                                : (active
                                                                    ? 'bg-indigo-50 dark:bg-[#bef264]/15 text-indigo-600 dark:text-[#bef264] font-semibold'
                                                                    : 'text-slate-700 dark:text-[#d6d0c7] hover:bg-slate-100 dark:hover:bg-[#f5f3ec]/[0.06]')
                                                        }`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                            isBento
                                                                ? 'bg-white border border-black shadow-[1px_1px_0px_#000]'
                                                                : 'bg-slate-100 dark:bg-[#1c1917] dark:border dark:border-[#f5f3ec]/10 text-indigo-600 dark:text-[#fde047]'
                                                        }`}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold truncate">{item.label}</span>
                                                                {showDot && (
                                                                    <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-[#fb7185]"></span>
                                                                )}
                                                            </div>
                                                            {item.description && (
                                                                <p className="text-[10px] text-slate-500 dark:text-[#888177] truncate mt-0.5">
                                                                    {item.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                        {isDemoAccount && (
                                            <div className={`pt-1.5 mt-1 border-t ${isBento ? 'border-black/20' : 'border-slate-200/80 dark:border-[#2e2924]'}`}>
                                                <DemoRoleSwitchButton
                                                    variant="drawer"
                                                    onAfterSwitch={() => setIsMoreOpen(false)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </nav>
                    </div>

                    {/* Right Column: User Profile, Logout, Chat Hub, Notification Bell */}
                    <div className="flex items-center justify-end gap-2 shrink-0">
                        {showActions && (
                            <>
                                {!isGuest ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onMouseEnter={() => prefetchRoute('/profile')}
                                            onFocus={() => prefetchRoute('/profile')}
                                            onClick={handleProfileClick}
                                            className={`h-9 flex items-center gap-2 px-3 rounded-xl transition-all font-semibold text-xs active:scale-95 cursor-pointer shrink-0 ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fef9c3] font-black'
                                                    : 'bg-slate-100/80 dark:bg-[#1c1917] border border-slate-200/80 dark:border-[#f5f3ec]/12 text-slate-700 dark:text-[#f5f3ec] hover:border-indigo-500/40 dark:hover:border-[#bef264]/45 hover:text-indigo-600 dark:hover:text-[#bef264]'
                                            }`}
                                            title={tx('Profile', 'ملفي الشخصي')}
                                        >
                                            <div className={`w-5 h-5 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${
                                                isBento ? 'border border-black bg-white' : 'ring-1 ring-indigo-500/40 dark:ring-[#bef264]/50 bg-slate-100 dark:bg-[#0a0908]'
                                            }`}>
                                                {user?.avatar ? (
                                                    <Avatar config={user.avatar} size="sm" className="w-full h-full" />
                                                ) : (
                                                    <div className="w-full h-full bg-indigo-500 dark:bg-[#bef264] flex items-center justify-center text-[10px] font-black text-white dark:text-[#0a0908]">
                                                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="truncate max-w-[100px]">{user?.name || tx('Profile', 'حسابي')}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleLogoutClick}
                                            className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all cursor-pointer active:scale-95 shrink-0 ${
                                                isBento
                                                    ? 'bg-[#fecdd3] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                                    : 'text-slate-400 dark:text-[#a8a29e] hover:text-rose-500 dark:hover:text-[#fb7185] hover:bg-rose-50 dark:hover:bg-[#fb7185]/12 border border-transparent hover:border-rose-200 dark:hover:border-[#fb7185]/30'
                                            }`}
                                            title={tx('Logout', 'تسجيل الخروج')}
                                            aria-label={tx('Logout', 'تسجيل الخروج')}
                                        >
                                            <LogOut className={`w-4 h-4 ${isBento ? 'stroke-[2.5]' : ''}`} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => navigate('/login')}
                                            className={`h-9 px-3 text-xs font-bold transition-colors cursor-pointer rounded-xl flex items-center justify-center ${
                                                isBento
                                                    ? 'text-black font-black uppercase hover:bg-black/5'
                                                    : 'text-slate-700 dark:text-[#d6d0c7] hover:text-indigo-600 dark:hover:text-[#f5f3ec]'
                                            }`}
                                        >
                                            {tx('Log In', 'دخول')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/register')}
                                            className={`h-9 px-3.5 text-xs rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                                                isBento
                                                    ? 'bg-[#bef264] text-black font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-[#bef264] dark:hover:bg-[#d2fa8a] text-white dark:text-[#0a0908] font-bold dark:font-black shadow-sm shadow-indigo-600/25 dark:shadow-[0_6px_18px_-4px_rgba(190,242,100,0.35)]'
                                            }`}
                                        >
                                            {tx('Sign Up', 'حساب جديد')}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                        {!isGuest && (
                            <button
                                type="button"
                                onClick={() => (isChatOpen ? closeChat() : openChat())}
                                className={`relative h-9 w-9 flex items-center justify-center rounded-xl transition-all cursor-pointer active:scale-95 shrink-0 ${
                                    isBento
                                        ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                        : 'text-slate-700 dark:text-[#fde047] hover:text-indigo-600 dark:hover:text-[#fef08a] bg-slate-100/80 dark:bg-[#1c1917] border border-slate-200/80 dark:border-[#f5f3ec]/12 hover:border-indigo-500/40 dark:hover:border-[#fde047]/40'
                                }`}
                                title={tx('Chat Hub (Classes & Friends)', 'مركز الشات (الكلاسات والأصدقاء)')}
                                aria-label={tx('Open Chat Hub', 'فتح الشات')}
                            >
                                <MessageSquare className={`w-4 h-4 ${isBento ? 'stroke-[2.5]' : ''}`} />
                                {chatUnreadCount > 0 && (
                                    <span className={`absolute -top-1.5 -end-1.5 min-w-[18px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-black animate-bounce shadow-sm ${
                                        isBento ? 'bg-[#ef4444] text-white border border-black' : 'bg-rose-500 dark:bg-[#fb7185] text-white dark:text-[#0a0908] ring-2 ring-white dark:ring-[#0a0908]'
                                    }`}>
                                        {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                                    </span>
                                )}
                            </button>
                        )}
                        <NotificationCenter currentUser={user} />
                    </div>
                </div>

                {/* Mobile & Tablet Row (< xl) */}
                <div className="flex xl:hidden items-center justify-between gap-3 w-full min-h-10">
                    {/* Left Section: Back button + Brand */}
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                        {shouldShowBack && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className={`h-9 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl transition-all text-xs active:scale-95 cursor-pointer shrink-0 ${
                                    isBento
                                        ? 'bg-[#fde047] text-black font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1917] dark:hover:bg-[#24201c] text-slate-700 dark:text-[#f5f3ec] font-semibold border border-slate-200/60 dark:border-[#f5f3ec]/12'
                                }`}
                                title={tx('Go back to previous page', 'الرجوع للصفحة اللي فاتت')}
                                aria-label={tx('Go back', 'رجوع')}
                            >
                                <ArrowLeft className={`w-4 h-4 ${isBento ? 'stroke-[2.5]' : ''} ${isArabic ? 'rotate-180' : ''}`} />
                                <span className="hidden sm:inline">{tx('Back', 'رجوع')}</span>
                            </button>
                        )}

                        {renderBrandSwitcher(mobileBrandRef, false)}
                    </div>

                    {/* Mobile & Tablet Right Controls */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {!isGuest && (
                            <button
                                type="button"
                                onClick={() => (isChatOpen ? closeChat() : openChat())}
                                className={`relative h-9 w-9 flex items-center justify-center rounded-xl transition-all cursor-pointer active:scale-95 ${
                                    isBento
                                        ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'text-slate-700 dark:text-[#fde047] bg-slate-100 dark:bg-[#1c1917] border border-slate-200/80 dark:border-[#f5f3ec]/12'
                                }`}
                                title={tx('Chat Hub', 'الشات')}
                                aria-label={tx('Open Chat Hub', 'فتح الشات')}
                            >
                                <MessageSquare className={`w-4 h-4 ${isBento ? 'stroke-[2.5]' : ''}`} />
                                {chatUnreadCount > 0 && (
                                    <span className="absolute -top-1 -end-1 min-w-[15px] h-3.5 px-0.5 rounded-full flex items-center justify-center text-[8px] font-black bg-rose-500 dark:bg-[#fb7185] text-white dark:text-[#0a0908]">
                                        {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                                    </span>
                                )}
                            </button>
                        )}
                        <NotificationCenter currentUser={user} />
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all cursor-pointer active:scale-95 ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'text-slate-700 dark:text-[#f5f3ec] bg-slate-100 dark:bg-[#1c1917] border border-slate-200/80 dark:border-[#f5f3ec]/12 hover:bg-slate-200 dark:hover:bg-[#24201c]'
                            }`}
                            aria-label={tx('Toggle navigation menu', 'فتح أو قفل القائمة')}
                        >
                            {isMenuOpen ? <X className={`w-5 h-5 ${isBento ? 'stroke-[2.5]' : ''}`} /> : <Menu className={`w-5 h-5 ${isBento ? 'stroke-[2.5]' : ''}`} />}
                        </button>
                    </div>
                </div>

                {/* Mobile & Tablet Navigation Drawer */}
                {isMenuOpen && (
                    <>
                        <div
                            className="fixed inset-0 top-[53px] sm:top-[57px] bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs dark:backdrop-blur-none z-40 xl:hidden animate-in fade-in duration-200"
                            onClick={() => setIsMenuOpen(false)}
                            aria-hidden="true"
                        />
                        <div className={`xl:hidden relative z-50 mt-3 p-4 rounded-3xl space-y-4 max-h-[calc(100dvh-76px)] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200 shadow-2xl ${
                            isBento
                                ? 'bg-white text-black border-3 border-black shadow-[6px_6px_0px_#000]'
                                : 'bg-white dark:bg-[#141210] border border-slate-200/90 dark:border-[1.5px] dark:border-[#2e2924] shadow-2xl dark:shadow-[0_6px_0_#050504]'
                        }`}>
                            {/* Navigation Items Header */}
                            <div className="flex items-center justify-between pb-1">
                                <span className={`text-[11px] font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-slate-500 dark:text-[#a8a29e]'}`}>
                                    {tx('Navigation', 'الأقسام')}
                                </span>
                            </div>

                            {/* Navigation Items Grid */}
                            <div className="grid grid-cols-2 gap-2">
                                {allNavItems.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.path);
                                    const showBadge = item.path === '/clans' && hasClanInvites;

                                    return (
                                        <button
                                            key={item.path}
                                            type="button"
                                            onClick={() => {
                                                if (item.path === '/leaderboard') {
                                                    handleLeaderboardClick();
                                                } else {
                                                    navigate(item.path);
                                                }
                                                setIsMenuOpen(false);
                                            }}
                                            className={`flex items-center gap-2.5 p-2.5 min-h-[44px] rounded-2xl font-semibold text-xs transition-all border cursor-pointer active:scale-95 text-left ${
                                                isBento
                                                    ? (active
                                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black'
                                                        : 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] font-bold hover:bg-[#fef9c3]')
                                                    : (active
                                                        ? 'bg-indigo-600 dark:bg-[#bef264] border-indigo-600 dark:border-[#bef264] text-white dark:text-[#0a0908] dark:font-black shadow-md shadow-indigo-600/25 dark:shadow-none'
                                                        : 'bg-slate-50 dark:bg-[#1c1917] border-slate-200/60 dark:border-[#f5f3ec]/10 text-slate-600 dark:text-[#b5aea4] hover:bg-slate-100 dark:hover:bg-[#24201c] hover:text-slate-900 dark:hover:text-[#f5f3ec]')
                                            }`}
                                        >
                                            <Icon className={`w-4 h-4 shrink-0 ${isBento ? 'stroke-[2.5]' : ''}`} />
                                            <span className="truncate flex-1">{item.label}</span>
                                            {active && (
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isBento ? 'bg-black' : 'bg-white dark:bg-[#0a0908]'}`} />
                                            )}
                                            {showBadge && (
                                                <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-[#fb7185] shrink-0"></span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                        {/* Mobile User Actions */}
                        <div className={`space-y-3 pt-3 ${isBento ? 'border-t-2 border-black' : 'border-t border-slate-200 dark:border-[#f5f3ec]/10'}`}>
                            {!isGuest ? (
                                <>
                                    <div className={`flex items-center gap-3 p-2.5 rounded-2xl ${
                                        isBento
                                            ? 'bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-slate-50 dark:bg-[#1c1917] border border-slate-200/60 dark:border-[#f5f3ec]/10'
                                    }`}>
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs overflow-hidden shrink-0 ${
                                            isBento ? 'border-2 border-black bg-white' : 'bg-white dark:bg-[#0a0908] border border-slate-200 dark:border-[#f5f3ec]/14 text-white'
                                        }`}>
                                            {user?.avatar ? (
                                                <Avatar config={user.avatar} size="sm" className="w-full h-full" />
                                            ) : (
                                                <div className="w-full h-full bg-indigo-500 dark:bg-[#bef264] flex items-center justify-center dark:text-[#0a0908] font-black">
                                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-[10px] uppercase font-bold tracking-wider ${isBento ? 'text-slate-600' : 'text-slate-400 dark:text-[#888177]'}`}>{tx('Signed in as', 'مسجل باسم')}</p>
                                            <p className={`text-xs truncate ${isBento ? 'font-black text-black' : 'font-semibold text-slate-900 dark:text-[#f5f3ec]'}`}>{user?.name || tx('User', 'مستخدم')}</p>
                                        </div>
                                    </div>

                                    <DemoRoleSwitchButton
                                        variant="drawer"
                                        onAfterSwitch={() => setIsMenuOpen(false)}
                                    />

                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                openChat();
                                                setIsMenuOpen(false);
                                            }}
                                            className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer active:scale-95 ${
                                                isBento
                                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black'
                                                    : 'bg-indigo-600/10 dark:bg-[#fde047]/12 border border-indigo-500/20 dark:border-[#fde047]/30 text-indigo-600 dark:text-[#fde047]'
                                            }`}
                                        >
                                            <MessageSquare className={`w-4 h-4 ${isBento ? 'stroke-[2.5]' : ''}`} />
                                            <span>{tx('Chat', 'الشات')}</span>
                                            {chatUnreadCount > 0 && (
                                                <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-black">
                                                    {chatUnreadCount}
                                                </span>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleProfileClick();
                                                setIsMenuOpen(false);
                                            }}
                                            className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer active:scale-95 ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black'
                                                    : 'bg-slate-50 dark:bg-[#1c1917] border border-slate-200/60 dark:border-[#f5f3ec]/10 text-slate-700 dark:text-[#f5f3ec] hover:bg-slate-100 dark:hover:bg-[#24201c]'
                                            }`}
                                        >
                                            <User className={`w-4 h-4 ${isBento ? 'text-black stroke-[2.5]' : 'text-indigo-500 dark:text-[#bae6fd]'}`} />
                                            {tx('Profile', 'حسابي')}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleLogoutClick();
                                                setIsMenuOpen(false);
                                            }}
                                            className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl transition-all font-semibold text-xs cursor-pointer active:scale-95 ${
                                                isBento
                                                    ? 'bg-[#fecdd3] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black'
                                                    : 'text-rose-600 dark:text-[#fb7185] hover:bg-rose-50 dark:hover:bg-[#fb7185]/12 border border-rose-500/10 dark:border-[#fb7185]/25'
                                            }`}
                                        >
                                            <LogOut className={`w-4 h-4 ${isBento ? 'stroke-[2.5]' : ''}`} />
                                            {tx('Logout', 'خروج')}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigate('/login');
                                            setIsMenuOpen(false);
                                        }}
                                        className={`w-full py-2.5 font-bold text-xs rounded-xl transition-all text-center cursor-pointer ${
                                            isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black'
                                                : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-[#bef264] dark:hover:bg-[#d2fa8a] text-white dark:text-[#0a0908] dark:font-black shadow-md'
                                        }`}
                                    >
                                        {tx('Log In', 'تسجيل الدخول')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigate('/register');
                                            setIsMenuOpen(false);
                                        }}
                                        className={`w-full py-2.5 font-bold text-xs rounded-xl transition-all text-center cursor-pointer ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black'
                                                : 'bg-slate-100 dark:bg-[#1c1917] border border-slate-200 dark:border-[#f5f3ec]/12 text-slate-700 dark:text-[#f5f3ec]'
                                        }`}
                                    >
                                        {tx('Create Free Account', 'اعمل حساب مجاني')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    </>
                )}
            </div>

            {/* Navbar & Menu Customizer Modal */}
        </header>
    );
};

export default Navbar;
