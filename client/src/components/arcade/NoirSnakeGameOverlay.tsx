import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Crosshair,
    Gamepad2,
    Grid3X3,
    Pause,
    Play,
    RotateCcw,
    ShieldAlert,
    Sparkles,
    Trophy,
    Volume2,
    VolumeX,
    X,
    Zap
} from 'lucide-react';
import { useSecretGame } from '../../context/SecretGameContext';
import { useLanguage } from '../../context/LanguageContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { NoirSnakeEngine } from './noirSnakeEngine';
import { noirSnakeAudio } from './noirSnakeAudio';
import {
    getArcadeRankInfo,
    loadArcadeProfile,
    saveArcadeProfile,
    type ArcadeProfile,
    type Direction,
    type HudSnapshot,
    type RunSummary,
    type SnakeGameMode
} from './noirSnakeTypes';

const INITIAL_HUD: HudSnapshot = {
    mode: 'hunt',
    status: 'menu',
    score: 0,
    elapsedSeconds: 0,
    length: 5,
    runXp: 0,
    runLevel: 1,
    runLevelXp: 0,
    runLevelNextXp: 80,
    threatLevel: 1,
    huntersAlive: 0,
    takedowns: 0,
    boostEnergy: 100,
    isBoosting: false,
    comboCount: 0,
    comboMultiplier: 1,
    comboTimeRatio: 0,
    levelUpNotice: null,
    deathReason: null,
    pauseReason: null
};

function formatClock(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const NoirSnakeGameOverlay: React.FC = () => {
    const { phase, exitSecretGame } = useSecretGame();
    const { tx } = useLanguage();
    const auth = useOptionalAuth();
    const currentUser = auth?.currentUser ?? null;
    const updateUser = auth?.updateUser;

    const userStorageKey = currentUser?.userId || undefined;
    const [profile, setProfile] = useState<ArcadeProfile>(() => loadArcadeProfile(userStorageKey));
    const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
    const [summary, setSummary] = useState<RunSummary | null>(null);
    const [platformSync, setPlatformSync] = useState<{
        status: 'idle' | 'syncing' | 'synced' | 'guest' | 'capped';
        awarded: number;
        dailyRemaining?: number;
    }>({ status: 'idle', awarded: 0 });
    const [showLevelBanner, setShowLevelBanner] = useState<number | null>(null);

    const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    });
    const [showTouchPad, setShowTouchPad] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    });

    const stageRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<NoirSnakeEngine | null>(null);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const levelBannerTimerRef = useRef<number | null>(null);
    const lastBannerLevelRef = useRef<number>(1);
    const profileRef = useRef<ArcadeProfile>(profile);

    useEffect(() => {
        profileRef.current = profile;
        noirSnakeAudio.setMuted(profile.muted);
    }, [profile]);

    // Reload per-user profile if user switches
    useEffect(() => {
        const loaded = loadArcadeProfile(userStorageKey);
        const raf = window.requestAnimationFrame(() => {
            setProfile(loaded);
            noirSnakeAudio.setMuted(loaded.muted);
        });
        return () => window.cancelAnimationFrame(raf);
    }, [userStorageKey]);

    // Track pointer type changes
    useEffect(() => {
        const mq = window.matchMedia('(pointer: coarse)');
        const onChange = (e: MediaQueryListEvent) => {
            setIsTouchDevice(e.matches);
            if (e.matches) setShowTouchPad(true);
        };
        mq.addEventListener?.('change', onChange);
        return () => mq.removeEventListener?.('change', onChange);
    }, []);

    const handleRunComplete = useCallback(
        (finalHud: HudSnapshot) => {
            const prev = profileRef.current;
            const prevTotalXp = prev.totalArcadeXp;
            const newTotalXp = prevTotalXp + finalHud.runXp;

            const isNewBest =
                finalHud.mode === 'hunt'
                    ? finalHud.elapsedSeconds > prev.bestHuntSeconds || finalHud.score > prev.bestHuntScore
                    : finalHud.score > prev.bestHarvestScore;

            const nextProfile: ArcadeProfile = {
                ...prev,
                totalArcadeXp: newTotalXp,
                runsPlayed: prev.runsPlayed + 1,
                bestHuntSeconds:
                    finalHud.mode === 'hunt'
                        ? Math.max(prev.bestHuntSeconds, finalHud.elapsedSeconds)
                        : prev.bestHuntSeconds,
                bestHuntScore:
                    finalHud.mode === 'hunt'
                        ? Math.max(prev.bestHuntScore, finalHud.score)
                        : prev.bestHuntScore,
                bestHuntTakedowns:
                    finalHud.mode === 'hunt'
                        ? Math.max(prev.bestHuntTakedowns, finalHud.takedowns)
                        : prev.bestHuntTakedowns,
                bestHarvestScore:
                    finalHud.mode === 'harvest'
                        ? Math.max(prev.bestHarvestScore, finalHud.score)
                        : prev.bestHarvestScore,
                bestHarvestLength:
                    finalHud.mode === 'harvest'
                        ? Math.max(prev.bestHarvestLength, finalHud.length)
                        : prev.bestHarvestLength
            };

            saveArcadeProfile(nextProfile, userStorageKey);
            setProfile(nextProfile);

            setSummary({
                mode: finalHud.mode,
                score: finalHud.score,
                elapsedSeconds: finalHud.elapsedSeconds,
                length: finalHud.length,
                takedowns: finalHud.takedowns,
                runLevel: finalHud.runLevel,
                runXpEarned: finalHud.runXp,
                isNewBest,
                deathReason: finalHud.deathReason,
                previousTotalXp: prevTotalXp,
                newTotalXp
            });

            // Sync capped real platform XP if logged in
            if (!currentUser?.userId) {
                setPlatformSync({ status: 'guest', awarded: 0 });
                return;
            }

            if (finalHud.runXp <= 0 && finalHud.elapsedSeconds < 4) {
                setPlatformSync({ status: 'idle', awarded: 0 });
                return;
            }

            setPlatformSync({ status: 'syncing', awarded: 0 });
            api.claimArcadeXp({
                mode: finalHud.mode,
                durationSeconds: finalHud.elapsedSeconds,
                score: finalHud.score,
                arcadeXpEarned: finalHud.runXp
            })
                .then((res) => {
                    if (res.awardedPlatformXp > 0) {
                        updateUser?.({ xp: res.xp, level: res.level });
                        setPlatformSync({
                            status: 'synced',
                            awarded: res.awardedPlatformXp,
                            dailyRemaining: res.dailyRemaining
                        });
                    } else {
                        setPlatformSync({
                            status: res.dailyRemaining === 0 ? 'capped' : 'idle',
                            awarded: 0,
                            dailyRemaining: res.dailyRemaining
                        });
                    }
                })
                .catch(() => {
                    setPlatformSync({ status: 'idle', awarded: 0 });
                });
        },
        [currentUser?.userId, updateUser, userStorageKey]
    );

    const handleRunCompleteRef = useRef(handleRunComplete);
    useEffect(() => {
        handleRunCompleteRef.current = handleRunComplete;
    }, [handleRunComplete]);

    // Mount & manage the 60fps canvas engine
    useEffect(() => {
        const canvas = canvasRef.current;
        const stage = stageRef.current;
        if (!canvas || !stage) return;

        const engine = new NoirSnakeEngine(canvas, {
            onHudUpdate: (snap) => {
                setHud(snap);
                if (snap.levelUpNotice && snap.levelUpNotice.level > lastBannerLevelRef.current) {
                    lastBannerLevelRef.current = snap.levelUpNotice.level;
                    setShowLevelBanner(snap.levelUpNotice.level);
                    if (levelBannerTimerRef.current !== null) {
                        window.clearTimeout(levelBannerTimerRef.current);
                    }
                    levelBannerTimerRef.current = window.setTimeout(() => {
                        setShowLevelBanner(null);
                        levelBannerTimerRef.current = null;
                    }, 1500);
                }
            },
            onGameOver: (finalSnap) => {
                handleRunCompleteRef.current(finalSnap);
            }
        });

        engineRef.current = engine;
        engine.startLoop();

        const syncSize = () => {
            if (!stageRef.current || !engineRef.current) return;
            const rect = stageRef.current.getBoundingClientRect();
            const dpadInset = showTouchPad && isTouchDevice ? 156 : 0;
            engineRef.current.resize(rect.width, rect.height, dpadInset);
        };

        syncSize();
        const ro = new ResizeObserver(syncSize);
        ro.observe(stage);

        const onVisChange = () => {
            if (document.hidden) {
                engineRef.current?.pause('blur');
            }
        };
        document.addEventListener('visibilitychange', onVisChange);

        return () => {
            document.removeEventListener('visibilitychange', onVisChange);
            ro.disconnect();
            if (levelBannerTimerRef.current !== null) {
                window.clearTimeout(levelBannerTimerRef.current);
            }
            engine.destroy();
            engineRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Recompute canvas bottom safe inset whenever touch D-pad visibility toggles
    useEffect(() => {
        if (!stageRef.current || !engineRef.current) return;
        const rect = stageRef.current.getBoundingClientRect();
        const dpadInset = showTouchPad && (isTouchDevice || rect.width < 768) ? 156 : 0;
        engineRef.current.resize(rect.width, rect.height, dpadInset);
    }, [showTouchPad, isTouchDevice]);

    const startMode = useCallback((mode: SnakeGameMode) => {
        lastBannerLevelRef.current = 1;
        setShowLevelBanner(null);
        setSummary(null);
        setPlatformSync({ status: 'idle', awarded: 0 });
        engineRef.current?.startRun(mode);
    }, []);

    const returnToModeMenu = useCallback(() => {
        lastBannerLevelRef.current = 1;
        setShowLevelBanner(null);
        setSummary(null);
        setPlatformSync({ status: 'idle', awarded: 0 });
        engineRef.current?.setMenuMode();
    }, []);

    const toggleMute = useCallback(() => {
        setProfile((prev) => {
            const next = { ...prev, muted: !prev.muted };
            noirSnakeAudio.setMuted(next.muted);
            saveArcadeProfile(next, userStorageKey);
            return next;
        });
    }, [userStorageKey]);

    // Global keyboard controls (WASD / Arrows / Space Boost / P or Esc Pause / Enter Restart)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const key = e.key;
            const engine = engineRef.current;
            if (!engine) return;

            const dirMap: Record<string, Direction> = {
                ArrowUp: 'UP',
                w: 'UP',
                W: 'UP',
                ArrowDown: 'DOWN',
                s: 'DOWN',
                S: 'DOWN',
                ArrowLeft: 'LEFT',
                a: 'LEFT',
                A: 'LEFT',
                ArrowRight: 'RIGHT',
                d: 'RIGHT',
                D: 'RIGHT'
            };

            if (dirMap[key]) {
                if (hud.status === 'playing') {
                    e.preventDefault();
                    engine.queueDirection(dirMap[key]);
                }
                return;
            }

            if (key === ' ' || key === 'Shift') {
                if (hud.status === 'playing' && hud.mode === 'hunt') {
                    e.preventDefault();
                    engine.setBoost(true);
                } else if (hud.status === 'gameover' && key === ' ') {
                    e.preventDefault();
                    startMode(hud.mode);
                }
                return;
            }

            if (key === 'Enter' && hud.status === 'gameover') {
                e.preventDefault();
                startMode(hud.mode);
                return;
            }

            if (key === 'p' || key === 'P') {
                e.preventDefault();
                if (hud.status === 'playing') engine.pause('manual');
                else if (hud.status === 'paused') engine.resume();
                return;
            }

            if (key === 'Escape') {
                e.preventDefault();
                if (hud.status === 'playing') {
                    engine.pause('manual');
                } else if (hud.status === 'paused') {
                    engine.resume();
                } else {
                    exitSecretGame();
                }
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Shift') {
                engineRef.current?.setBoost(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [hud.status, hud.mode, startMode, exitSecretGame]);

    // Touch swipe recognition on canvas stage
    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (hud.status !== 'playing' || e.touches.length === 0) return;
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX, y: t.clientY };
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (hud.status !== 'playing' || !touchStartRef.current || e.touches.length === 0) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStartRef.current.x;
        const dy = t.clientY - touchStartRef.current.y;
        const threshold = 18;

        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

        if (Math.abs(dx) > Math.abs(dy)) {
            engineRef.current?.queueDirection(dx > 0 ? 'RIGHT' : 'LEFT');
        } else {
            engineRef.current?.queueDirection(dy > 0 ? 'DOWN' : 'UP');
        }
        // Reset origin so continuous dragging chains turns effortlessly!
        touchStartRef.current = { x: t.clientX, y: t.clientY };
    };

    const handleTouchEnd = () => {
        touchStartRef.current = null;
    };

    const [hasEnteredFrame, setHasEnteredFrame] = useState(false);

    useEffect(() => {
        let raf2 = 0;
        const raf1 = window.requestAnimationFrame(() => {
            raf2 = window.requestAnimationFrame(() => {
                setHasEnteredFrame(true);
            });
        });
        return () => {
            window.cancelAnimationFrame(raf1);
            if (raf2) window.cancelAnimationFrame(raf2);
        };
    }, []);

    const rankInfo = useMemo(() => getArcadeRankInfo(profile.totalArcadeXp), [profile.totalArcadeXp]);
    const runXpPct = Math.min(100, Math.round((hud.runLevelXp / Math.max(1, hud.runLevelNextXp)) * 100));
    const isRevealed = hasEnteredFrame && (phase === 'entering' || phase === 'active');
    const isExiting = phase === 'exiting';

    const deathLabel =
        summary?.deathReason === 'hunter'
            ? tx('Intercepted by a Hunter Snake', 'تم الإمساك بك بواسطة ثعبان صياد')
            : summary?.deathReason === 'border'
                ? tx('Grid Perimeter Breach', 'اصطدام بحدود الشبكة')
                : tx('Self-Trajectory Collision', 'اصطدام بجسمك');

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={tx('Noir Secret Snake Arcade', 'لعبة الثعبان السرية')}
            className={`secret-arcade-shell fixed inset-0 z-[120] flex flex-col bg-[#0a0908] text-[#f5f3ec] select-none will-change-[opacity,transform] transition-[opacity,transform] duration-[780ms] ease-[cubic-bezier(0.22,0.86,0.24,1)] ${
                isRevealed
                    ? 'opacity-100 scale-100'
                    : isExiting
                        ? 'opacity-0 scale-[1.035] pointer-events-none'
                        : 'opacity-0 scale-[1.045] pointer-events-none'
            }`}
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            {/* Noir Tactical Scanline Sweep during Portal Enter */}
            {phase === 'entering' && (
                <div
                    aria-hidden="true"
                    className="arcade-noir-scanline pointer-events-none absolute inset-x-0 top-0 h-[3px] z-[130] bg-[#bef264]"
                />
            )}

            {/* Slim Top Tactical HUD Bar */}
            <header
                className={`shrink-0 h-12 sm:h-14 px-2.5 sm:px-5 bg-[#0e0d0b] border-b border-[#2e2924] flex items-center justify-between gap-2 z-20 will-change-[opacity,transform] transition-[opacity,transform] duration-[680ms] ease-[cubic-bezier(0.22,0.86,0.24,1)] ${
                    isRevealed
                        ? 'opacity-100 translate-y-0 delay-[100ms]'
                        : 'opacity-0 -translate-y-full delay-0'
                }`}
            >
                {/* Left: Protocol Brand & Active Mode */}
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#141210] border border-[#bef264]/50 flex items-center justify-center shrink-0">
                        <span className="w-2.5 h-2.5 bg-[#bef264] block" />
                    </div>
                    <div className="min-w-0 leading-tight">
                        <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] sm:text-xs font-black tracking-widest uppercase text-[#f5f3ec] truncate">
                                NOIR//SNAKE
                            </span>
                            {hud.status !== 'menu' && (
                                <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider border ${
                                        hud.mode === 'hunt'
                                            ? 'bg-[#2a1418] text-[#fb7185] border-[#fb7185]/45'
                                            : 'bg-[#192211] text-[#bef264] border-[#bef264]/45'
                                    }`}
                                >
                                    {hud.mode === 'hunt' ? tx('HUNTED', 'مطاردة') : tx('HARVEST', 'جمع')}
                                </span>
                            )}
                        </div>
                        <div className="hidden sm:block text-[10px] font-mono text-[#a8a29e]">
                            {tx(`RANK LV.${rankInfo.rankLevel} • ${rankInfo.title}`, `المستوى ${rankInfo.rankLevel} • ${rankInfo.arTitle}`)}
                        </div>
                    </div>
                </div>

                {/* Center: Live Telemetry & XP Progress Bar when in run */}
                {hud.status !== 'menu' ? (
                    <div dir="ltr" className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 justify-center max-w-2xl">
                        {/* Score */}
                        <div className="flex flex-col items-center leading-none">
                            <span className="text-[9px] font-mono uppercase text-[#a8a29e] tracking-wider">SCORE</span>
                            <span className="font-mono text-xs sm:text-sm font-black text-[#f5f3ec] tabular-nums">
                                {hud.score.toLocaleString()}
                            </span>
                        </div>

                        {/* Timer (Hunt) or Length+Combo (Harvest) */}
                        {hud.mode === 'hunt' ? (
                            <>
                                <div className="flex flex-col items-center leading-none">
                                    <span className="text-[9px] font-mono uppercase text-[#a8a29e] tracking-wider">TIME</span>
                                    <span className="font-mono text-xs sm:text-sm font-black text-[#bae6fd] tabular-nums">
                                        {formatClock(hud.elapsedSeconds)}
                                    </span>
                                </div>
                                <div className="hidden xs:flex sm:flex flex-col items-center leading-none">
                                    <span className="text-[9px] font-mono uppercase text-[#fb7185] tracking-wider">
                                        THREAT {hud.threatLevel}
                                    </span>
                                    <span className="font-mono text-xs sm:text-sm font-black text-[#fb7185] tabular-nums">
                                        {hud.huntersAlive}x
                                    </span>
                                </div>
                                {/* Boost meter */}
                                <div className="hidden md:flex flex-col gap-1 w-20">
                                    <div className="flex items-center justify-between text-[9px] font-mono text-[#bae6fd]">
                                        <span className="flex items-center gap-0.5 font-bold">
                                            <Zap className="w-2.5 h-2.5" /> BOOST
                                        </span>
                                        <span>{hud.boostEnergy}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[#1c1917] border border-[#2e2924] overflow-hidden">
                                        <div
                                            className="h-full bg-[#bae6fd] transition-all duration-100"
                                            style={{ width: `${hud.boostEnergy}%` }}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col items-center leading-none">
                                    <span className="text-[9px] font-mono uppercase text-[#a8a29e] tracking-wider">LEN</span>
                                    <span className="font-mono text-xs sm:text-sm font-black text-[#bef264] tabular-nums">
                                        {hud.length}
                                    </span>
                                </div>
                                {hud.comboMultiplier > 1 && (
                                    <div className="flex flex-col items-center leading-none px-1.5 py-0.5 rounded bg-[#231e0f] border border-[#fde047]/45">
                                        <span className="font-mono text-[10px] sm:text-xs font-black text-[#fde047] tabular-nums">
                                            ×{hud.comboMultiplier}
                                        </span>
                                        <div className="w-8 h-0.5 bg-[#1c1917] mt-0.5">
                                            <div
                                                className="h-full bg-[#fde047]"
                                                style={{ width: `${Math.round(hud.comboTimeRatio * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Live Run Level & XP Bar */}
                        <div className="flex flex-col gap-1 w-24 sm:w-36 shrink-0">
                            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono">
                                <span className="font-black text-[#fde047]">LV.{String(hud.runLevel).padStart(2, '0')}</span>
                                <span className="text-[#a8a29e] tabular-nums">
                                    {hud.runLevelXp}/{hud.runLevelNextXp} XP
                                </span>
                            </div>
                            <div className="h-2 w-full bg-[#1c1917] border border-[#2e2924] overflow-hidden">
                                <div
                                    className="h-full bg-[#bef264] transition-all duration-150"
                                    style={{ width: `${runXpPct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="hidden md:flex items-center gap-2 font-mono text-[11px] text-[#a8a29e]">
                        <span className="inline-block w-1.5 h-1.5 bg-[#bef264]" />
                        <span>{tx('SELECT PROTOCOL TO INITIALIZE', 'اختار وضع اللعب للبدء')}</span>
                    </div>
                )}

                {/* Right: Utility Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {hud.status !== 'menu' && (
                        <button
                            type="button"
                            onClick={() => setShowTouchPad((v) => !v)}
                            title={tx('Toggle On-Screen D-Pad', 'إظهار/إخفاء أزرار التحكم')}
                            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                                showTouchPad
                                    ? 'bg-[#192211] border-[#bef264]/50 text-[#bef264]'
                                    : 'bg-[#141210] border-[#2e2924] text-[#a8a29e] hover:text-[#f5f3ec]'
                            }`}
                            aria-label={tx('Toggle D-Pad', 'تبديل أزرار التحكم')}
                        >
                            <Gamepad2 className="w-3.5 h-3.5" />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={toggleMute}
                        title={profile.muted ? tx('Unmute SFX', 'تشغيل الصوت') : tx('Mute SFX', 'كتم الصوت')}
                        className="h-8 w-8 rounded-lg bg-[#141210] border border-[#2e2924] text-[#a8a29e] hover:text-[#f5f3ec] flex items-center justify-center transition-colors cursor-pointer"
                        aria-label={profile.muted ? tx('Unmute', 'تشغيل الصوت') : tx('Mute', 'كتم الصوت')}
                    >
                        {profile.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>

                    {(hud.status === 'playing' || hud.status === 'paused') && (
                        <button
                            type="button"
                            onClick={() =>
                                hud.status === 'playing'
                                    ? engineRef.current?.pause('manual')
                                    : engineRef.current?.resume()
                            }
                            title={hud.status === 'playing' ? tx('Pause (P / Esc)', 'إيقاف مؤقت') : tx('Resume', 'استكمال')}
                            className="h-8 w-8 rounded-lg bg-[#141210] border border-[#2e2924] text-[#f5f3ec] hover:border-[#bef264]/60 flex items-center justify-center transition-colors cursor-pointer"
                            aria-label={hud.status === 'playing' ? tx('Pause', 'إيقاف مؤقت') : tx('Resume', 'استكمال')}
                        >
                            {hud.status === 'playing' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={exitSecretGame}
                        className="h-8 px-2.5 sm:px-3 rounded-lg bg-[#1c1917] hover:bg-[#2a1418] border border-[#2e2924] hover:border-[#fb7185]/60 text-[#f5f3ec] hover:text-[#fda4af] font-mono text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{tx('EXIT', 'خروج')}</span>
                    </button>
                </div>
            </header>

            {/* Full-Viewport Canvas Stage */}
            <div
                ref={stageRef}
                dir="ltr"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative flex-1 min-h-0 w-full overflow-hidden touch-none"
            >
                <canvas ref={canvasRef} className="block w-full h-full" />

                {/* Floating Level-Up Tactical Banner */}
                {showLevelBanner !== null && hud.status === 'playing' && (
                    <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-in zoom-in-95 fade-in duration-200">
                        <div className="px-4 py-1.5 rounded-lg bg-[#141210] border-2 border-[#fde047] shadow-[0_4px_0_#050504] flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#fde047]" />
                            <span className="font-mono text-xs sm:text-sm font-black tracking-widest uppercase text-[#fde047]">
                                {tx(`LEVEL UP // LV.${showLevelBanner}`, `ترقية // مستوى ${showLevelBanner}`)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Hunt Mode Subtle Boost Pill on Small Screens */}
                {hud.status === 'playing' && hud.mode === 'hunt' && (
                    <div className="pointer-events-none md:hidden absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-1 rounded bg-[#0a0908]/85 border border-[#2e2924]">
                        <Zap className="w-3 h-3 text-[#bae6fd]" />
                        <div className="w-14 h-1.5 bg-[#1c1917] overflow-hidden">
                            <div className="h-full bg-[#bae6fd]" style={{ width: `${hud.boostEnergy}%` }} />
                        </div>
                    </div>
                )}

                {/* MODE SELECTION OVERLAY */}
                {hud.status === 'menu' && (
                    <div
                        dir="auto"
                        className="absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
                    >
                        <div
                            className={`w-full max-w-3xl bg-[#141210]/95 border-[1.5px] border-[#2e2924] rounded-2xl p-4 sm:p-5 shadow-[0_10px_0_#050504] my-auto will-change-[opacity,transform] transition-[opacity,transform] duration-[720ms] ease-[cubic-bezier(0.22,0.86,0.24,1)] ${
                                isRevealed
                                    ? 'opacity-100 translate-y-0 scale-100 delay-[170ms]'
                                    : 'opacity-0 translate-y-7 scale-[0.95] delay-0'
                            }`}
                        >
                            {/* Top Arcade Rank Strip */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 mb-4 border-b border-[#2e2924]">
                                <div>
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#192211] border border-[#bef264]/40 text-[#bef264] font-mono text-[10px] font-black tracking-widest uppercase mb-1">
                                        <span>// SECRET PROTOCOL</span>
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#f5f3ec]">
                                        {tx('Noir Snake Arcade', 'أركيد الثعبان السري')}
                                    </h2>
                                    <p className="text-xs text-[#a8a29e] mt-0.5">
                                        {tx(
                                            'Earn Arcade XP, level up mid-run, and sync bonus XP to your Quiz Platform profile.',
                                            'اجمع نقاط XP وارفع مستواك في كل الأوضاع مع مكافآت XP حقيقية لحسابك على المنصة.'
                                        )}
                                    </p>
                                </div>

                                {/* Persistent Arcade Rank Card */}
                                <div className="shrink-0 bg-[#0e0d0b] border border-[#2e2924] rounded-xl px-3.5 py-2 min-w-[190px]">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#fde047] font-black">
                                            LV.{rankInfo.rankLevel} • {tx(rankInfo.title, rankInfo.arTitle)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[#1c1917] overflow-hidden mb-1">
                                        <div
                                            className="h-full bg-[#bef264]"
                                            style={{ width: `${rankInfo.progressPct}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between font-mono text-[10px] text-[#a8a29e]">
                                        <span>{profile.totalArcadeXp.toLocaleString()} XP</span>
                                        <span>
                                            {rankInfo.currentXp}/{rankInfo.nextXp}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Two Symmetrical Mode Cards with Gameplay Preview Images */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Mode 1: HUNTED (Infinite World + Smart Escalating AI Hunters) */}
                                <button
                                    type="button"
                                    onClick={() => startMode('hunt')}
                                    className="group text-start flex flex-col justify-between p-3.5 rounded-xl bg-[#0e0d0b] hover:bg-[#191614] border-[1.5px] border-[#2e2924] hover:border-[#fb7185] shadow-[0_4px_0_#050504] transition-all cursor-pointer active:translate-y-0.5"
                                >
                                    <div>
                                        {/* Gameplay Preview Image */}
                                        <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-[#2e2924] group-hover:border-[#fb7185]/60 bg-[#0a0908] mb-3 transition-colors">
                                            <img
                                                src="/images/arcade/noir-hunted.jpg"
                                                alt={tx('Hunted Survival gameplay preview', 'معاينة وضع مطاردة البقاء')}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                                                loading="eager"
                                            />
                                            <span className="absolute top-2 end-2 font-mono text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#0a0908]/90 text-[#fb7185] border border-[#fb7185]/60">
                                                {tx('INFINITE WORLD', 'عالم لا نهائي')}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-7 h-7 rounded-lg bg-[#2a1418] border border-[#fb7185]/45 text-[#fb7185] flex items-center justify-center shrink-0">
                                                <Crosshair className="w-3.5 h-3.5" />
                                            </div>
                                            <h3 className="text-base font-black text-[#f5f3ec] group-hover:text-[#fb7185] transition-colors">
                                                {tx('Hunted Survival', 'مطاردة البقاء')}
                                            </h3>
                                        </div>
                                        <p className="text-xs text-[#a8a29e] leading-relaxed">
                                            {tx(
                                                'Camera follows you across an endless grid. The longer you survive, the more hunter snakes spawn—and the smarter they flank. Bait them into your tail to shatter them for bonus XP.',
                                                'الكاميرا تتحرك معك في عالم مفتوح بلا حدود. كلما صمدت أكثر زاد عدد وذكاء الثعابين الصيادة. استدرجهم للاصطدام بذيلك لتدميرهم وكسب XP مضاعف.'
                                            )}
                                        </p>
                                    </div>

                                    <div className="mt-3.5 pt-2.5 border-t border-[#23201c] flex items-center justify-between text-[11px] font-mono">
                                        <span className="text-[#a8a29e]">
                                            {tx('BEST:', 'الأفضل:')}{' '}
                                            <strong className="text-[#f5f3ec]">
                                                {formatClock(profile.bestHuntSeconds)}
                                            </strong>
                                        </span>
                                        <span className="font-black text-[#fb7185] group-hover:translate-x-0.5 transition-transform">
                                            {tx('DEPLOY →', 'ابدأ ←')}
                                        </span>
                                    </div>
                                </button>

                                {/* Mode 2: HARVEST (Screen-as-Border Classic Food Collector) */}
                                <button
                                    type="button"
                                    onClick={() => startMode('harvest')}
                                    className="group text-start flex flex-col justify-between p-3.5 rounded-xl bg-[#0e0d0b] hover:bg-[#191614] border-[1.5px] border-[#2e2924] hover:border-[#bef264] shadow-[0_4px_0_#050504] transition-all cursor-pointer active:translate-y-0.5"
                                >
                                    <div>
                                        {/* Gameplay Preview Image */}
                                        <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-[#2e2924] group-hover:border-[#bef264]/60 bg-[#0a0908] mb-3 transition-colors">
                                            <img
                                                src="/images/arcade/noir-harvest.jpg"
                                                alt={tx('Grid Harvest gameplay preview', 'معاينة وضع حصاد الشبكة')}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                                                loading="eager"
                                            />
                                            <span className="absolute top-2 end-2 font-mono text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#0a0908]/90 text-[#bef264] border border-[#bef264]/60">
                                                {tx('SCREEN BORDER', 'حدود الشاشة')}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-7 h-7 rounded-lg bg-[#192211] border border-[#bef264]/45 text-[#bef264] flex items-center justify-center shrink-0">
                                                <Grid3X3 className="w-3.5 h-3.5" />
                                            </div>
                                            <h3 className="text-base font-black text-[#f5f3ec] group-hover:text-[#bef264] transition-colors">
                                                {tx('Grid Harvest', 'حصاد الشبكة')}
                                            </h3>
                                        </div>
                                        <p className="text-xs text-[#a8a29e] leading-relaxed">
                                            {tx(
                                                'Pure classic snake locked inside crisp screen borders. Chain quick pickups for ×3 XP combos, snatch timed golden Overcharge nodes, and level up as speed climbs.',
                                                'وضع كلاسيكي نقي داخل حدود الشاشة. اجمع الطعام بسرعة لمضاعفة الكومبو حتى ×3 XP، التقط النقاط الذهبية المؤقتة، وارفع مستواك مع زيادة السرعة.'
                                            )}
                                        </p>
                                    </div>

                                    <div className="mt-3.5 pt-2.5 border-t border-[#23201c] flex items-center justify-between text-[11px] font-mono">
                                        <span className="text-[#a8a29e]">
                                            {tx('BEST:', 'الأفضل:')}{' '}
                                            <strong className="text-[#f5f3ec]">
                                                {profile.bestHarvestScore.toLocaleString()} PTS
                                            </strong>
                                        </span>
                                        <span className="font-black text-[#bef264] group-hover:translate-x-0.5 transition-transform">
                                            {tx('DEPLOY →', 'ابدأ ←')}
                                        </span>
                                    </div>
                                </button>
                            </div>

                            {/* Controls Legend */}
                            <div className="mt-4 pt-3 border-t border-[#23201c] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#a8a29e]">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-1.5 py-0.5 rounded bg-[#1c1917] border border-[#2e2924] text-[#f5f3ec]">
                                        WASD / ARROWS
                                    </span>
                                    <span>{tx('Steer', 'تحكم')}</span>
                                    <span className="opacity-30">·</span>
                                    <span className="px-1.5 py-0.5 rounded bg-[#1c1917] border border-[#2e2924] text-[#bae6fd]">
                                        SPACE
                                    </span>
                                    <span>{tx('Boost (Hunt)', 'اندفاع')}</span>
                                    <span className="opacity-30">·</span>
                                    <span className="px-1.5 py-0.5 rounded bg-[#1c1917] border border-[#2e2924] text-[#f5f3ec]">
                                        SWIPE / D-PAD
                                    </span>
                                    <span>{tx('Mobile', 'موبايل')}</span>
                                </div>
                                <span className="text-[#78716c]">ESC = {tx('Pause / Exit', 'إيقاف / خروج')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* PAUSE MODAL */}
                {hud.status === 'paused' && (
                    <div dir="auto" className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#0a0908]/75">
                        <div className="w-full max-w-sm bg-[#141210] border-[1.5px] border-[#2e2924] rounded-2xl p-5 shadow-[0_8px_0_#050504] text-center animate-in zoom-in-95 duration-200">
                            <div className="w-11 h-11 mx-auto mb-3 rounded-xl bg-[#1c1917] border border-[#fde047]/45 text-[#fde047] flex items-center justify-center">
                                <Pause className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-black uppercase tracking-wide text-[#f5f3ec]">
                                {tx('Session Paused', 'اللعبة متوقفة مؤقتاً')}
                            </h3>
                            <p className="text-xs text-[#a8a29e] mt-1 mb-5">
                                {hud.pauseReason === 'resize'
                                    ? tx('Paused automatically after viewport resize.', 'تم الإيقاف تلقائياً بعد تغيير حجم الشاشة.')
                                    : hud.pauseReason === 'blur'
                                        ? tx('Paused while tab was inactive.', 'تم الإيقاف أثناء مغادرة التبويب.')
                                        : tx('Take a breath—your XP and combo state are safe.', 'خذ استراحة — تقدمك ونقاطك محفوظة.')}
                            </p>

                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => engineRef.current?.resume()}
                                    className="w-full h-11 rounded-xl bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                    {tx('Resume Run', 'استكمال اللعب')}
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => startMode(hud.mode)}
                                        className="h-10 rounded-xl bg-[#1c1917] hover:bg-[#24201c] border border-[#2e2924] text-[#f5f3ec] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        {tx('Restart', 'إعادة')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={returnToModeMenu}
                                        className="h-10 rounded-xl bg-[#1c1917] hover:bg-[#24201c] border border-[#2e2924] text-[#f5f3ec] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        {tx('Switch Mode', 'تغيير الوضع')}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={exitSecretGame}
                                    className="h-9 rounded-xl text-xs font-mono font-bold text-[#a8a29e] hover:text-[#fda4af] transition-colors cursor-pointer"
                                >
                                    {tx('Return to Quiz Platform', 'العودة للمنصة')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* GAME OVER SUMMARY MODAL */}
                {hud.status === 'gameover' && summary && (
                    <div dir="auto" className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#0a0908]/80 overflow-y-auto">
                        <div className="w-full max-w-md bg-[#141210] border-[1.5px] border-[#2e2924] rounded-2xl p-5 shadow-[0_10px_0_#050504] my-auto animate-in zoom-in-95 fade-in duration-200">
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-black uppercase tracking-wider text-[#fb7185] mb-1">
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                        <span>{deathLabel}</span>
                                    </div>
                                    <h3 className="text-xl font-black tracking-tight text-[#f5f3ec]">
                                        {tx('Run Terminated', 'انتهت الجولة')}
                                    </h3>
                                </div>

                                {summary.isNewBest && (
                                    <span className="px-2.5 py-1 rounded-lg bg-[#231e0f] border border-[#fde047]/60 text-[#fde047] font-mono text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                                        <Trophy className="w-3 h-3" />
                                        {tx('NEW BEST', 'رقم قياسي')}
                                    </span>
                                )}
                            </div>

                            {/* Key Telemetry Tiles */}
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <div className="p-2.5 rounded-xl bg-[#0e0d0b] border border-[#2e2924] text-center">
                                    <div className="text-[10px] font-mono uppercase text-[#a8a29e]">
                                        {summary.mode === 'hunt' ? tx('SURVIVED', 'البقاء') : tx('SCORE', 'النقاط')}
                                    </div>
                                    <div className="font-mono text-base font-black text-[#f5f3ec] mt-0.5 tabular-nums">
                                        {summary.mode === 'hunt'
                                            ? formatClock(summary.elapsedSeconds)
                                            : summary.score.toLocaleString()}
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-[#0e0d0b] border border-[#2e2924] text-center">
                                    <div className="text-[10px] font-mono uppercase text-[#a8a29e]">
                                        {tx('RUN LEVEL', 'المستوى')}
                                    </div>
                                    <div className="font-mono text-base font-black text-[#fde047] mt-0.5 tabular-nums">
                                        LV.{summary.runLevel}
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-[#0e0d0b] border border-[#2e2924] text-center">
                                    <div className="text-[10px] font-mono uppercase text-[#a8a29e]">
                                        {summary.mode === 'hunt' ? tx('TAKEDOWNS', 'إسقاطات') : tx('LENGTH', 'الطول')}
                                    </div>
                                    <div className="font-mono text-base font-black text-[#bef264] mt-0.5 tabular-nums">
                                        {summary.mode === 'hunt' ? summary.takedowns : summary.length}
                                    </div>
                                </div>
                            </div>

                            {/* XP & Persistent Rank Box */}
                            <div className="p-3.5 rounded-xl bg-[#0e0d0b] border border-[#2e2924] mb-4">
                                <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                                    <span className="font-black text-[#bef264]">
                                        +{summary.runXpEarned.toLocaleString()} {tx('ARCADE XP', 'XP أركيد')}
                                    </span>
                                    <span className="text-[#fde047] font-bold">
                                        {tx(`RANK LV.${rankInfo.rankLevel}`, `رتبة ${rankInfo.rankLevel}`)}
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-[#1c1917] overflow-hidden mb-2">
                                    <div
                                        className="h-full bg-[#bef264] transition-all duration-500"
                                        style={{ width: `${rankInfo.progressPct}%` }}
                                    />
                                </div>

                                <div className="flex items-center justify-between text-[11px] font-mono">
                                    <span className="text-[#a8a29e]">
                                        {tx(rankInfo.title, rankInfo.arTitle)}
                                    </span>
                                    {platformSync.status === 'syncing' && (
                                        <span className="text-[#bae6fd]">
                                            {tx('Syncing Platform XP...', 'جاري إضافة XP لحسابك...')}
                                        </span>
                                    )}
                                    {platformSync.status === 'synced' && (
                                        <span className="text-[#bef264] font-black">
                                            +{platformSync.awarded} {tx('Platform XP Synced', 'XP أضيف لحسابك')}
                                        </span>
                                    )}
                                    {platformSync.status === 'capped' && (
                                        <span className="text-[#fde047]">
                                            {tx('Daily Platform XP cap reached', 'وصلت للحد اليومي لـ XP المنصة')}
                                        </span>
                                    )}
                                    {platformSync.status === 'guest' && (
                                        <span className="text-[#a8a29e]">
                                            {tx('Sign in to sync Platform XP', 'سجل الدخول لحفظ XP المنصة')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => startMode(summary.mode)}
                                    className="w-full h-11 rounded-xl bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    {tx('Play Again (Enter)', 'العب مجدداً')}
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={returnToModeMenu}
                                        className="h-10 rounded-xl bg-[#1c1917] hover:bg-[#24201c] border border-[#2e2924] text-[#f5f3ec] font-bold text-xs cursor-pointer"
                                    >
                                        {tx('Switch Mode', 'تغيير الوضع')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={exitSecretGame}
                                        className="h-10 rounded-xl bg-[#1c1917] hover:bg-[#2a1418] border border-[#2e2924] hover:border-[#fb7185]/50 text-[#f5f3ec] hover:text-[#fda4af] font-bold text-xs cursor-pointer"
                                    >
                                        {tx('Back to Site', 'العودة للموقع')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* RESPONSIVE ON-SCREEN TOUCH D-PAD + BOOST (Mobile/Tablet or toggled) */}
                {hud.status === 'playing' && showTouchPad && (
                    <div
                        dir="ltr"
                        className="absolute inset-x-0 bottom-0 z-20 px-4 pb-3 pt-2 flex items-end justify-between pointer-events-none"
                        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
                    >
                        {/* Left/Center Ergonomic D-Pad */}
                        <div className="pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1.5 w-[132px] h-[132px]">
                            <div />
                            <button
                                type="button"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    engineRef.current?.queueDirection('UP');
                                }}
                                aria-label="Up"
                                className="rounded-xl bg-[#141210]/90 active:bg-[#bef264] border border-[#2e2924] active:border-[#bef264] text-[#f5f3ec] active:text-[#0a0908] flex items-center justify-center touch-manipulation"
                            >
                                <ChevronUp className="w-5 h-5" />
                            </button>
                            <div />

                            <button
                                type="button"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    engineRef.current?.queueDirection('LEFT');
                                }}
                                aria-label="Left"
                                className="rounded-xl bg-[#141210]/90 active:bg-[#bef264] border border-[#2e2924] active:border-[#bef264] text-[#f5f3ec] active:text-[#0a0908] flex items-center justify-center touch-manipulation"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="rounded-xl bg-[#0e0d0b]/60 border border-[#23201c]" />
                            <button
                                type="button"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    engineRef.current?.queueDirection('RIGHT');
                                }}
                                aria-label="Right"
                                className="rounded-xl bg-[#141210]/90 active:bg-[#bef264] border border-[#2e2924] active:border-[#bef264] text-[#f5f3ec] active:text-[#0a0908] flex items-center justify-center touch-manipulation"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>

                            <div />
                            <button
                                type="button"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    engineRef.current?.queueDirection('DOWN');
                                }}
                                aria-label="Down"
                                className="rounded-xl bg-[#141210]/90 active:bg-[#bef264] border border-[#2e2924] active:border-[#bef264] text-[#f5f3ec] active:text-[#0a0908] flex items-center justify-center touch-manipulation"
                            >
                                <ChevronDown className="w-5 h-5" />
                            </button>
                            <div />
                        </div>

                        {/* Right: Hold-to-Boost Button (Hunt Mode) */}
                        {hud.mode === 'hunt' && (
                            <button
                                type="button"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    engineRef.current?.setBoost(true);
                                }}
                                onPointerUp={() => engineRef.current?.setBoost(false)}
                                onPointerCancel={() => engineRef.current?.setBoost(false)}
                                onPointerLeave={() => engineRef.current?.setBoost(false)}
                                className={`pointer-events-auto w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 font-mono text-[10px] font-black uppercase tracking-wider touch-manipulation transition-colors ${
                                    hud.isBoosting
                                        ? 'bg-[#bae6fd] border-[#bae6fd] text-[#0a0908]'
                                        : 'bg-[#141210]/90 border-[#bae6fd]/60 text-[#bae6fd]'
                                }`}
                            >
                                <Zap className="w-5 h-5" />
                                <span>BOOST</span>
                                <span className="text-[9px] opacity-80">{hud.boostEnergy}%</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default NoirSnakeGameOverlay;
