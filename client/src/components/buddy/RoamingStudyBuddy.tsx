import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Sparkles, Palette, EyeOff, Eye, Zap } from 'lucide-react';
import { FullBodyBuddy, type BuddyAction } from './FullBodyBuddy';
import { useOptionalAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../context/ChatContext';
import {
    generateBuddyComment,
    type BuddyComment,
    type BuddyArcadeStats,
} from '../../utils/buddyMatrixEngine';

const DOCKED_STORAGE_KEY = 'fr_roaming_buddy_docked';
const BUDDY_W = 88;
const BUDDY_H = 126;
const EDGE_PADDING = 16;

function readArcadeStats(
    user?: {
        arcadeStats?: {
            bestHuntScore?: number;
            bestHarvestScore?: number;
            bestSmashScore?: number;
            bestDashDistance?: number;
        };
    } | null
): BuddyArcadeStats | null {
    const userBest = Math.max(
        user?.arcadeStats?.bestHuntScore ?? 0,
        user?.arcadeStats?.bestHarvestScore ?? 0,
        user?.arcadeStats?.bestSmashScore ?? 0,
        user?.arcadeStats?.bestDashDistance ?? 0
    );
    if (userBest > 0) {
        return { bestScore: userBest, gamesPlayed: 3 };
    }
    try {
        const raw = localStorage.getItem('fr_arcade_stats') || localStorage.getItem('noir_snake_stats');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return {
                bestScore: Number(parsed.bestScore ?? parsed.highScore ?? 0) || 0,
                gamesPlayed: Number(parsed.gamesPlayed ?? 0) || 0,
            };
        }
    } catch {
        // Ignore malformed localStorage
    }
    return null;
}

export const RoamingStudyBuddy: React.FC = () => {
    const auth = useOptionalAuth();
    const currentUser = auth?.currentUser ?? null;
    const { allAttempts, availableQuizzes, skillTracks, challenges, userWithRank } = useData();
    const { language, tx } = useLanguage();
    const { isBento } = useTheme();
    const { isOpen: isChatOpen, openBuddyChat } = useChat();
    const location = useLocation();
    const navigate = useNavigate();

    const [isDocked, setIsDocked] = useState<boolean>(() => {
        try {
            return localStorage.getItem(DOCKED_STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    });

    const [pos, setPos] = useState<{ x: number; y: number }>(() => {
        if (typeof window === 'undefined') return { x: 24, y: 240 };
        const bottomSafe = window.innerWidth < 768 ? 110 : 96;
        return {
            x: Math.max(EDGE_PADDING, window.innerWidth - BUDDY_W - 24),
            y: Math.max(84, window.innerHeight - BUDDY_H - bottomSafe),
        };
    });

    const [action, setAction] = useState<BuddyAction>('idle');
    const [facing, setFacing] = useState<'left' | 'right'>('left');
    const [moveDurationMs, setMoveDurationMs] = useState(1200);
    const [comment, setComment] = useState<BuddyComment | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [pokeCount, setPokeCount] = useState(0);

    const idleSecondsRef = useRef(0);
    const recentIdsRef = useRef<string[]>([]);
    const posRef = useRef(pos);

    useEffect(() => {
        posRef.current = pos;
    }, [pos]);

    const dragRef = useRef<{
        active: boolean;
        moved: boolean;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
        lastX: number;
    }>({ active: false, moved: false, startX: 0, startY: 0, origX: 0, origY: 0, lastX: 0 });
    const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pokeResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clampPosition = useCallback((x: number, y: number) => {
        if (typeof window === 'undefined') return { x, y };
        const bottomSafe = window.innerWidth < 768 ? 96 : 76;
        const maxX = Math.max(EDGE_PADDING, window.innerWidth - BUDDY_W - EDGE_PADDING);
        const maxY = Math.max(72, window.innerHeight - BUDDY_H - bottomSafe);
        return {
            x: Math.min(Math.max(EDGE_PADDING, x), maxX),
            y: Math.min(Math.max(72, y), maxY),
        };
    }, []);

    // Keep buddy inside viewport on resize
    useEffect(() => {
        const handleResize = () => {
            setPos((prev) => clampPosition(prev.x, prev.y));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [clampPosition]);

    // Track user idle seconds for sleepy nap routine
    useEffect(() => {
        const resetIdle = () => {
            idleSecondsRef.current = 0;
        };
        const tick = setInterval(() => {
            idleSecondsRef.current += 5;
        }, 5000);
        window.addEventListener('pointerdown', resetIdle, { passive: true });
        window.addEventListener('keydown', resetIdle, { passive: true });
        return () => {
            clearInterval(tick);
            window.removeEventListener('pointerdown', resetIdle);
            window.removeEventListener('keydown', resetIdle);
        };
    }, []);

    const showComment = useCallback((nextComment: BuddyComment) => {
        setComment(nextComment);
        recentIdsRef.current = [nextComment.id, ...recentIdsRef.current].slice(0, 6);
        if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = setTimeout(() => {
            setComment(null);
        }, 7000);
    }, []);

    const triggerMatrixComment = useCallback(
        (forcedPokeCount = pokeCount) => {
            const generated = generateBuddyComment(
                {
                    user: currentUser,
                    attempts: allAttempts,
                    quizzes: availableQuizzes,
                    skillTracks,
                    challenges,
                    userWithRank,
                    pathname: location.pathname,
                    idleSeconds: idleSecondsRef.current,
                    pokeCount: forcedPokeCount,
                    language,
                    arcadeStats: readArcadeStats(
                        currentUser as {
                            arcadeStats?: {
                                bestHuntScore?: number;
                                bestHarvestScore?: number;
                                bestSmashScore?: number;
                                bestDashDistance?: number;
                            };
                        } | null
                    ),
                },
                recentIdsRef.current
            );
            showComment(generated);
            return generated;
        },
        [
            pokeCount,
            currentUser,
            allAttempts,
            availableQuizzes,
            skillTracks,
            challenges,
            userWithRank,
            location.pathname,
            language,
            showComment,
        ]
    );

    const runActionRoutine = useCallback(
        (specific?: BuddyAction, withQuip = false) => {
            const reducedMotion =
                typeof window !== 'undefined' &&
                window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

            let chosen = specific;
            if (!chosen) {
                if (idleSecondsRef.current >= 45) {
                    chosen = 'sleep_bed';
                } else {
                    const pool: BuddyAction[] = [
                        'walk',
                        'skateboard',
                        'jetpack_fly',
                        'play_football',
                        'sleep_bed',
                        'study_desk',
                        'gaming_console',
                        'guitar_rock',
                        'patrol_hop',
                        'zoom_dash',
                        'wave',
                        'dance',
                        'edge_peek',
                        'backflip_spin',
                        'orbit_float',
                        'comic_shake',
                    ];
                    chosen = pool[Math.floor(Math.random() * pool.length)];
                }
            }

            let settleMs =
                chosen === 'sleep_bed'
                    ? 6000
                    : chosen === 'play_football' ||
                      chosen === 'study_desk' ||
                      chosen === 'gaming_console' ||
                      chosen === 'guitar_rock'
                    ? 4800
                    : 2600;

            if (reducedMotion && chosen !== 'nap_zzz' && chosen !== 'sleep_bed') {
                setAction('wave');
            } else {
                setAction(chosen);

                if (
                    chosen === 'walk' ||
                    chosen === 'patrol_hop' ||
                    chosen === 'zoom_dash' ||
                    chosen === 'edge_peek' ||
                    chosen === 'skateboard' ||
                    chosen === 'jetpack_fly'
                ) {
                    const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
                    const h = typeof window !== 'undefined' ? window.innerHeight : 768;
                    const anchors = [
                        { x: EDGE_PADDING, y: Math.max(96, h - BUDDY_H - 96) },
                        { x: w - BUDDY_W - EDGE_PADDING, y: Math.max(96, h - BUDDY_H - 96) },
                        { x: Math.round(w * 0.25), y: Math.max(96, h - BUDDY_H - 96) },
                        { x: Math.round(w * 0.68), y: Math.max(96, h - BUDDY_H - 96) },
                        { x: w - BUDDY_W - EDGE_PADDING, y: Math.max(96, Math.round(h * 0.42)) },
                        { x: EDGE_PADDING, y: Math.max(96, Math.round(h * 0.44)) },
                    ];
                    const current = posRef.current;
                    const candidates = anchors.filter(
                        (a) => Math.hypot(a.x - current.x, a.y - current.y) > 90
                    );
                    const nextAnchor = (candidates.length > 0 ? candidates : anchors)[
                        Math.floor(Math.random() * (candidates.length > 0 ? candidates.length : anchors.length))
                    ];
                    const clamped = clampPosition(nextAnchor.x, nextAnchor.y);

                    if (Math.abs(clamped.x - current.x) > 12) {
                        setFacing(clamped.x >= current.x ? 'right' : 'left');
                    }

                    const dist = Math.hypot(clamped.x - current.x, clamped.y - current.y);
                    const duration =
                        chosen === 'zoom_dash'
                            ? Math.max(550, Math.min(900, Math.round(dist * 0.9)))
                            : Math.max(950, Math.min(2100, Math.round(dist * 2.2)));

                    setMoveDurationMs(duration);
                    setPos(clamped);
                    settleMs = duration + 180;
                }
            }

            if (withQuip) {
                const quip = triggerMatrixComment();
                if (quip.tone === 'mock' && !specific && chosen === 'idle') {
                    setAction('comic_shake');
                }
            }

            if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
            actionTimerRef.current = setTimeout(() => {
                setAction('idle');
            }, settleMs);
        },
        [clampPosition, triggerMatrixComment]
    );

    // Autonomous roaming & actions every 9–16s
    useEffect(() => {
        if (isDocked || isHovered || isDragging || isChatOpen || menuOpen || !currentUser) return;

        const delay = 9000 + Math.floor(Math.random() * 7000);
        const timer = setTimeout(() => {
            runActionRoutine(undefined, Math.random() > 0.35);
        }, delay);

        return () => clearTimeout(timer);
    }, [isDocked, isHovered, isDragging, isChatOpen, menuOpen, currentUser, action, comment, runActionRoutine]);

    useEffect(() => {
        return () => {
            if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
            if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
            if (pokeResetRef.current) clearTimeout(pokeResetRef.current);
        };
    }, []);

    if (!currentUser) return null;

    const toggleDock = (next: boolean) => {
        setIsDocked(next);
        setMenuOpen(false);
        setComment(null);
        try {
            localStorage.setItem(DOCKED_STORAGE_KEY, String(next));
        } catch {
            // Ignore storage errors
        }
    };

    if (isDocked) {
        return (
            <button
                type="button"
                onClick={() => toggleDock(false)}
                title={tx('Wake up Study Buddy', 'صحّي رفيقك الدراسي')}
                className={`fixed bottom-20 xl:bottom-6 start-4 z-[75] inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                    isBento
                        ? 'bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:-translate-y-0.5'
                        : 'bg-[#141210]/95 text-[#bef264] border border-[#bef264]/45 shadow-lg hover:border-[#bef264]'
                }`}
            >
                <Eye className="w-3.5 h-3.5" />
                <span>{tx('Buddy', 'رفيقك')}</span>
            </button>
        );
    }

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button')) return;
        dragRef.current = {
            active: true,
            moved: false,
            startX: e.clientX,
            startY: e.clientY,
            origX: pos.x,
            origY: pos.y,
            lastX: e.clientX,
        };
        setMoveDurationMs(0);
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current.active) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const stepDx = e.clientX - dragRef.current.lastX;
        if (Math.abs(stepDx) > 2) {
            setFacing(stepDx >= 0 ? 'right' : 'left');
            dragRef.current.lastX = e.clientX;
        }
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            dragRef.current.moved = true;
            setAction('dragging');
        }
        setPos(clampPosition(dragRef.current.origX + dx, dragRef.current.origY + dy));
    };

    const handlePointerUp = () => {
        if (!dragRef.current.active) return;
        const wasClick = !dragRef.current.moved;
        dragRef.current.active = false;
        setIsDragging(false);

        if (wasClick) {
            const nextPoke = pokeCount + 1;
            setPokeCount(nextPoke);
            if (pokeResetRef.current) clearTimeout(pokeResetRef.current);
            pokeResetRef.current = setTimeout(() => setPokeCount(0), 6000);

            setMenuOpen((prev) => !prev);
            runActionRoutine(nextPoke >= 4 ? 'comic_shake' : 'wave', false);
            if (!comment || nextPoke >= 4) {
                triggerMatrixComment(nextPoke);
            }
        } else {
            runActionRoutine('wave', false);
        }
    };

    const isNearRight = typeof window !== 'undefined' && pos.x > window.innerWidth * 0.55;
    const isNearTop = pos.y < 230;
    const activeMood = comment?.mood ?? (action === 'nap_zzz' ? 'neutral' : action === 'dance' || action === 'wave' ? 'excited' : 'happy');
    const displayAction: BuddyAction = isDragging ? 'dragging' : action;

    return (
        <div
            className="fixed z-[75] pointer-events-none select-none"
            style={{
                left: pos.x,
                top: pos.y,
                transition: isDragging
                    ? 'none'
                    : `left ${moveDurationMs}ms linear, top ${moveDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
        >
            {/* Speech Bubble */}
            {comment && !menuOpen && (
                <div
                    className={`pointer-events-auto absolute w-[min(16rem,calc(100vw-28px))] sm:w-72 p-3 rounded-2xl text-xs leading-relaxed transition-all animate-in fade-in zoom-in-95 duration-200 ${
                        isNearTop ? 'top-[132px]' : 'bottom-[132px]'
                    } ${isNearRight ? 'right-0' : 'left-0'} ${
                        isBento
                            ? 'bg-white text-black border-[2.5px] border-black shadow-[4px_4px_0px_#000]'
                            : 'bg-[#141210]/95 text-[#f5f3ec] border border-[#bef264]/45 shadow-2xl backdrop-blur-md'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                comment.tone === 'mock'
                                    ? isBento
                                        ? 'bg-[#fecdd3] text-black border border-black'
                                        : 'bg-[#fb7185]/20 text-[#fda4af] border border-[#fb7185]/40'
                                    : comment.tone === 'hype'
                                    ? isBento
                                        ? 'bg-[#bef264] text-black border border-black'
                                        : 'bg-[#bef264]/20 text-[#bef264] border border-[#bef264]/40'
                                    : isBento
                                    ? 'bg-[#fde047] text-black border border-black'
                                    : 'bg-[#fde047]/15 text-[#fde047] border border-[#fde047]/35'
                            }`}
                        >
                            <Zap className="w-2.5 h-2.5" />
                            {comment.tone === 'mock'
                                ? tx('Playful Roast', 'تحفيل لطيف')
                                : comment.tone === 'hype'
                                ? tx('Hype Check', 'تشجيع ناري')
                                : tx('Buddy Note', 'ملاحظة رفيقك')}
                        </span>
                        <button
                            type="button"
                            onClick={() => setComment(null)}
                            className="text-[10px] font-black opacity-60 hover:opacity-100 cursor-pointer px-1"
                            aria-label="Dismiss bubble"
                        >
                            ✕
                        </button>
                    </div>
                    <p className="font-bold">{comment.text}</p>
                    {comment.cta && (
                        <button
                            type="button"
                            onClick={() => {
                                const cta = comment.cta!;
                                setComment(null);
                                setMenuOpen(false);
                                if (cta.action === 'open_buddy_chat') {
                                    openBuddyChat(cta.prompt);
                                } else if (cta.target) {
                                    navigate(cta.target);
                                }
                            }}
                            className={`mt-2 w-full py-1.5 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                            }`}
                        >
                            {comment.cta.label} →
                        </button>
                    )}
                </div>
            )}

            {/* Mini Control Bar */}
            {menuOpen && (
                <div
                    className={`pointer-events-auto absolute max-w-[calc(100vw-24px)] ${
                        isNearTop ? 'top-[126px] sm:top-[132px]' : 'bottom-[126px] sm:bottom-[132px]'
                    } ${
                        isNearRight ? 'right-0' : 'left-0'
                    } flex items-center gap-1.5 p-1.5 rounded-2xl animate-in fade-in zoom-in-95 duration-150 ${
                        isBento
                            ? 'bg-white border-[2.5px] border-black shadow-[4px_4px_0px_#000]'
                            : 'bg-[#141210]/95 border border-[#2e2924] shadow-2xl backdrop-blur-md'
                    }`}
                >
                    <button
                        type="button"
                        onClick={() => {
                            setMenuOpen(false);
                            openBuddyChat();
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                            isBento
                                ? 'bg-[#bef264] text-black border border-black hover:bg-[#a3e635]'
                                : 'bg-[#bef264] text-[#0a0908] hover:bg-[#d2fa8a]'
                        }`}
                    >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{tx('Chat', 'دردشة')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            const funScenes: BuddyAction[] = [
                                'play_football',
                                'sleep_bed',
                                'skateboard',
                                'guitar_rock',
                                'jetpack_fly',
                                'study_desk',
                                'gaming_console',
                                'dance',
                                'backflip_spin',
                            ];
                            const pick = funScenes[Math.floor(Math.random() * funScenes.length)];
                            runActionRoutine(pick, true);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                            isBento
                                ? 'bg-[#fde047] text-black border border-black hover:bg-[#facc15]'
                                : 'bg-[#1c1917] text-[#fde047] border border-[#2e2924] hover:border-[#fde047]/50'
                        }`}
                        title={tx('Roast, dance, or roam', 'شجّعني أو اتحرك')}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{tx('Action', 'حركة')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setMenuOpen(false);
                            navigate('/profile');
                        }}
                        className={`p-1.5 rounded-xl cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border border-black hover:bg-neutral-100'
                                : 'bg-[#1c1917] text-[#f5f3ec] border border-[#2e2924] hover:border-[#bef264]/50'
                        }`}
                        title={tx('Customize Avatar', 'تعديل الأفاتار')}
                        aria-label={tx('Customize Avatar', 'تعديل الأفاتار')}
                    >
                        <Palette className="w-3.5 h-3.5" />
                    </button>

                    <button
                        type="button"
                        onClick={() => toggleDock(true)}
                        className={`p-1.5 rounded-xl cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border border-black hover:bg-[#fecdd3]'
                                : 'bg-[#1c1917] text-[#a8a29e] border border-[#2e2924] hover:text-[#fb7185]'
                        }`}
                        title={tx('Quiet / Dock Buddy', 'إخفاء مؤقت')}
                        aria-label={tx('Quiet / Dock Buddy', 'إخفاء مؤقت')}
                    >
                        <EyeOff className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Full-Body Interactive Character */}
            <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                role="button"
                tabIndex={0}
                aria-label={tx('Study Buddy Companion', 'رفيقك الدراسي')}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setMenuOpen((prev) => !prev);
                        runActionRoutine('wave', true);
                    }
                }}
                className={`pointer-events-auto relative cursor-grab active:cursor-grabbing transition-transform duration-200 origin-bottom scale-90 sm:scale-100 ${
                    isHovered ? 'sm:scale-105' : ''
                }`}
            >
                <FullBodyBuddy
                    avatar={currentUser.avatar}
                    moodOverride={activeMood}
                    action={displayAction}
                    facing={facing}
                />
            </div>
        </div>
    );
};

export default RoamingStudyBuddy;
