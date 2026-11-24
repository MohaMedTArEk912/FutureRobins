import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowDown,
    ArrowUp,
    Blocks,
    Footprints,
    Heart,
    Pause,
    Play,
    RotateCcw,
    Shield,
    Sparkles,
    Trophy,
    Volume2,
    VolumeX,
    X
} from 'lucide-react';
import { useSecretGame } from '../../context/SecretGameContext';
import { useLanguage } from '../../context/LanguageContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { BentoArcadeEngine } from './bentoArcadeEngine';
import { bentoArcadeAudio } from './bentoArcadeAudio';
import {
    getBentoRankInfo,
    loadBentoProfile,
    saveBentoProfile,
    type BentoArcadeProfile,
    type BentoGameMode,
    type BentoHudSnapshot,
    type BentoRunSummary
} from './bentoArcadeTypes';

const INITIAL_HUD: BentoHudSnapshot = {
    mode: 'smash',
    status: 'menu',
    score: 0,
    elapsedSeconds: 0,
    runXp: 0,
    runLevel: 1,
    runLevelXp: 0,
    runLevelNextXp: 90,
    wave: 1,
    lives: 3,
    bricksRemaining: 0,
    waitingForLaunch: true,
    activeBuffs: { wideSec: 0, heavySec: 0 },
    distanceMeters: 0,
    coinsCollected: 0,
    hasShield: false,
    speedMultiplier: 1,
    comboCount: 0,
    comboMultiplier: 1,
    levelUpNotice: null,
    deathReason: null,
    pauseReason: null
};

export const BentoArcadeOverlay: React.FC = () => {
    const { phase, exitSecretGame } = useSecretGame();
    const { tx } = useLanguage();
    const auth = useOptionalAuth();
    const currentUser = auth?.currentUser ?? null;
    const updateUser = auth?.updateUser;

    const userStorageKey = currentUser?.userId || undefined;
    const [profile, setProfile] = useState<BentoArcadeProfile>(() => loadBentoProfile(userStorageKey));
    const [hud, setHud] = useState<BentoHudSnapshot>(INITIAL_HUD);
    const [summary, setSummary] = useState<BentoRunSummary | null>(null);
    const [showLevelBanner, setShowLevelBanner] = useState<number | null>(null);
    const [platformSync, setPlatformSync] = useState<{
        status: 'idle' | 'syncing' | 'synced' | 'guest' | 'capped';
        awarded: number;
    }>({ status: 'idle', awarded: 0 });

    const [isTouchViewport, setIsTouchViewport] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    });

    const stageRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<BentoArcadeEngine | null>(null);
    const keysRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
    const touchStartYRef = useRef<number | null>(null);
    const lastBannerLevelRef = useRef<number>(1);
    const bannerTimerRef = useRef<number | null>(null);
    const profileRef = useRef<BentoArcadeProfile>(profile);

    useEffect(() => {
        profileRef.current = profile;
        bentoArcadeAudio.setMuted(profile.muted);
    }, [profile]);

    useEffect(() => {
        const loaded = loadBentoProfile(userStorageKey);
        const raf = window.requestAnimationFrame(() => {
            setProfile(loaded);
            bentoArcadeAudio.setMuted(loaded.muted);
        });
        return () => window.cancelAnimationFrame(raf);
    }, [userStorageKey]);

    const handleRunComplete = useCallback(
        (finalHud: BentoHudSnapshot) => {
            const prev = profileRef.current;
            const newTotalXp = prev.totalArcadeXp + finalHud.runXp;
            const isNewBest =
                finalHud.mode === 'smash'
                    ? finalHud.score > prev.bestSmashScore
                    : finalHud.distanceMeters > prev.bestDashDistance || finalHud.score > prev.bestDashScore;

            const nextProfile: BentoArcadeProfile = {
                ...prev,
                totalArcadeXp: newTotalXp,
                runsPlayed: prev.runsPlayed + 1,
                bestSmashScore:
                    finalHud.mode === 'smash' ? Math.max(prev.bestSmashScore, finalHud.score) : prev.bestSmashScore,
                bestSmashWave:
                    finalHud.mode === 'smash' ? Math.max(prev.bestSmashWave, finalHud.wave) : prev.bestSmashWave,
                bestDashDistance:
                    finalHud.mode === 'dash'
                        ? Math.max(prev.bestDashDistance, finalHud.distanceMeters)
                        : prev.bestDashDistance,
                bestDashScore:
                    finalHud.mode === 'dash' ? Math.max(prev.bestDashScore, finalHud.score) : prev.bestDashScore
            };

            saveBentoProfile(nextProfile, userStorageKey);
            setProfile(nextProfile);

            setSummary({
                mode: finalHud.mode,
                score: finalHud.score,
                elapsedSeconds: finalHud.elapsedSeconds,
                wave: finalHud.wave,
                distanceMeters: finalHud.distanceMeters,
                coinsCollected: finalHud.coinsCollected,
                runLevel: finalHud.runLevel,
                runXpEarned: finalHud.runXp,
                isNewBest,
                deathReason: finalHud.deathReason
            });

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
                score: finalHud.mode === 'dash' ? finalHud.distanceMeters : finalHud.score,
                arcadeXpEarned: finalHud.runXp
            })
                .then((res) => {
                    if (res.awardedPlatformXp > 0) {
                        updateUser?.({ xp: res.xp, level: res.level });
                        setPlatformSync({ status: 'synced', awarded: res.awardedPlatformXp });
                    } else {
                        setPlatformSync({
                            status: res.dailyRemaining === 0 ? 'capped' : 'idle',
                            awarded: 0
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

    // Mount 60fps canvas engine
    useEffect(() => {
        const canvas = canvasRef.current;
        const stage = stageRef.current;
        if (!canvas || !stage) return;

        const engine = new BentoArcadeEngine(canvas, {
            onHudUpdate: (snap) => {
                setHud(snap);
                if (snap.levelUpNotice && snap.levelUpNotice.level > lastBannerLevelRef.current) {
                    lastBannerLevelRef.current = snap.levelUpNotice.level;
                    setShowLevelBanner(snap.levelUpNotice.level);
                    if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current);
                    bannerTimerRef.current = window.setTimeout(() => {
                        setShowLevelBanner(null);
                        bannerTimerRef.current = null;
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
            // Use clientWidth/clientHeight (untransformed layout box) so enter/exit CSS scale
            // transforms never inflate the canvas dimensions beyond the viewport.
            const width = stageRef.current.clientWidth;
            const height = stageRef.current.clientHeight;
            if (width <= 0 || height <= 0) return;
            const coarse = window.matchMedia('(pointer: coarse)').matches || width < 768;
            setIsTouchViewport(coarse);
            const controlInset = coarse ? 84 : 0;
            engineRef.current.resize(width, height, controlInset);
        };

        syncSize();
        const ro = new ResizeObserver(syncSize);
        ro.observe(stage);

        const onVis = () => {
            if (document.hidden) engineRef.current?.pause('blur');
        };
        document.addEventListener('visibilitychange', onVis);

        return () => {
            document.removeEventListener('visibilitychange', onVis);
            ro.disconnect();
            if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current);
            engine.destroy();
            engineRef.current = null;
        };
    }, []);

    const startMode = useCallback((mode: BentoGameMode) => {
        lastBannerLevelRef.current = 1;
        setShowLevelBanner(null);
        setSummary(null);
        setPlatformSync({ status: 'idle', awarded: 0 });
        engineRef.current?.startRun(mode);
    }, []);

    const returnToMenu = useCallback(() => {
        lastBannerLevelRef.current = 1;
        setShowLevelBanner(null);
        setSummary(null);
        setPlatformSync({ status: 'idle', awarded: 0 });
        engineRef.current?.setMenuMode();
    }, []);

    const toggleMute = useCallback(() => {
        setProfile((prev) => {
            const next = { ...prev, muted: !prev.muted };
            bentoArcadeAudio.setMuted(next.muted);
            saveBentoProfile(next, userStorageKey);
            return next;
        });
    }, [userStorageKey]);

    // Global keyboard controls for both Smash & Dash
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const engine = engineRef.current;
            if (!engine) return;
            const key = e.key;

            if (hud.status === 'playing' && hud.mode === 'smash') {
                if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
                    e.preventDefault();
                    keysRef.current.left = true;
                    engine.setPaddleKeys(keysRef.current.left, keysRef.current.right);
                    return;
                }
                if (key === 'ArrowRight' || key === 'd' || key === 'D') {
                    e.preventDefault();
                    keysRef.current.right = true;
                    engine.setPaddleKeys(keysRef.current.left, keysRef.current.right);
                    return;
                }
                if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') {
                    e.preventDefault();
                    engine.launchSmashBall();
                    return;
                }
            }

            if (hud.status === 'playing' && hud.mode === 'dash') {
                if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') {
                    e.preventDefault();
                    if (!e.repeat) engine.triggerDashJump();
                    return;
                }
                if (key === 'ArrowDown' || key === 's' || key === 'S') {
                    e.preventDefault();
                    engine.triggerDashSlam();
                    return;
                }
            }

            if ((key === 'Enter' || key === ' ') && hud.status === 'gameover') {
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
                if (hud.status === 'playing') engine.pause('manual');
                else if (hud.status === 'paused') engine.resume();
                else exitSecretGame();
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                keysRef.current.left = false;
                engineRef.current?.setPaddleKeys(keysRef.current.left, keysRef.current.right);
            }
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                keysRef.current.right = false;
                engineRef.current?.setPaddleKeys(keysRef.current.left, keysRef.current.right);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [hud.status, hud.mode, startMode, exitSecretGame]);

    // Pointer/Touch interaction on canvas
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (hud.status !== 'playing' || hud.mode !== 'smash') return;
        const rect = stageRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0) return;
        const stageW = stageRef.current?.clientWidth || rect.width;
        const localX = ((e.clientX - rect.left) / rect.width) * stageW;
        engineRef.current?.setPaddlePointerX(localX);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (hud.status !== 'playing') return;
        if (hud.mode === 'smash') {
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
                // ignore pointer capture issues on older touch browsers
            }
            const rect = stageRef.current?.getBoundingClientRect();
            if (rect && rect.width > 0) {
                const stageW = stageRef.current?.clientWidth || rect.width;
                const localX = ((e.clientX - rect.left) / rect.width) * stageW;
                engineRef.current?.setPaddlePointerX(localX);
            }
            if (hud.waitingForLaunch) {
                engineRef.current?.launchSmashBall();
            }
        } else if (hud.mode === 'dash') {
            touchStartYRef.current = e.clientY;
            engineRef.current?.triggerDashJump();
        }
    };

    const handleTouchMoveStage = (e: React.TouchEvent<HTMLDivElement>) => {
        if (hud.status !== 'playing' || e.touches.length === 0) return;
        if (hud.mode === 'smash') {
            const rect = stageRef.current?.getBoundingClientRect();
            if (!rect || rect.width <= 0) return;
            const stageW = stageRef.current?.clientWidth || rect.width;
            const localX = ((e.touches[0].clientX - rect.left) / rect.width) * stageW;
            engineRef.current?.setPaddlePointerX(localX);
            return;
        }
        if (hud.mode === 'dash' && touchStartYRef.current !== null) {
            const dy = e.touches[0].clientY - touchStartYRef.current;
            if (dy > 38) {
                engineRef.current?.triggerDashSlam();
                touchStartYRef.current = null;
            }
        }
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

    const rankInfo = useMemo(() => getBentoRankInfo(profile.totalArcadeXp), [profile.totalArcadeXp]);
    const runXpPct = Math.min(100, Math.round((hud.runLevelXp / Math.max(1, hud.runLevelNextXp)) * 100));
    const isRevealed = hasEnteredFrame && (phase === 'entering' || phase === 'active');
    const isExiting = phase === 'exiting';

    const deathLabel =
        summary?.deathReason === 'lives'
            ? tx('Out of Balls!', 'انتهت جميع الكرات!')
            : summary?.deathReason === 'obstacle'
                ? tx('Hit a Warning Block (!)', 'اصطدمت بمكعب تحذير (!)')
                : tx('Fell Off the Bento Cards!', 'سقطت من فوق البطاقات!');

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={tx('Neo-Brutalist Bento Secret Arcade', 'أركيد بينتو السري')}
            className={`secret-arcade-shell fixed inset-0 h-dvh z-[120] flex flex-col bg-[#f5f3ec] text-black select-none will-change-[opacity,transform] transition-[opacity,transform] duration-[780ms] ease-[cubic-bezier(0.22,0.86,0.24,1)] ${
                isRevealed
                    ? 'opacity-100 scale-100'
                    : isExiting
                        ? 'opacity-0 scale-[1.035] pointer-events-none'
                        : 'opacity-0 scale-[1.045] pointer-events-none'
            }`}
            style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)'
            }}
        >
            {/* Neo-Brutalist 4-Band Solid Paper Wipe Ribbon during Portal Enter */}
            {phase === 'entering' && (
                <div
                    aria-hidden="true"
                    className="arcade-bento-ribbon pointer-events-none absolute inset-x-0 top-0 h-3 z-[130] grid grid-cols-4 border-y-[2.5px] border-black"
                >
                    <div className="bg-[#fde047] border-r-2 border-black" />
                    <div className="bg-[#bae6fd] border-r-2 border-black" />
                    <div className="bg-[#bef264] border-r-2 border-black" />
                    <div className="bg-[#fed7aa]" />
                </div>
            )}

            {/* Top Neo-Brutalist HUD Bar (Clean 2-row stack on mobile so nothing collides, single bar on sm+) */}
            <header
                className={`shrink-0 bg-white border-b-[3px] border-black z-20 will-change-[opacity,transform] transition-[opacity,transform] duration-[680ms] ease-[cubic-bezier(0.22,0.86,0.24,1)] ${
                    isRevealed
                        ? 'opacity-100 translate-y-0 delay-[100ms]'
                        : 'opacity-0 -translate-y-full delay-0'
                }`}
            >
                <div className="h-12 sm:h-15 px-3 sm:px-5 flex items-center justify-between gap-2">
                    {/* Left: Bento Arcade Brand + Mode Pill */}
                    <div className="flex items-center gap-1.5 min-w-0">
                        <div className="min-w-0 leading-tight">
                            <div className="flex items-center gap-1.5">
                                <span className="font-black text-xs sm:text-sm tracking-tight uppercase whitespace-nowrap">
                                    BENTO ARCADE
                                </span>
                                {hud.status !== 'menu' && (
                                    <span
                                        className={`px-1.5 py-0.5 rounded border-2 border-black text-[9px] font-black uppercase whitespace-nowrap shrink-0 ${
                                            hud.mode === 'smash' ? 'bg-[#bae6fd]' : 'bg-[#bef264]'
                                        }`}
                                    >
                                        {hud.mode === 'smash' ? tx('SMASH', 'تكسير') : tx('DASH', 'جري')}
                                    </span>
                                )}
                            </div>
                            <div className="hidden sm:block text-[10px] font-bold text-black/70">
                                {tx(`LV.${rankInfo.rankLevel} • ${rankInfo.title}`, `المستوى ${rankInfo.rankLevel} • ${rankInfo.arTitle}`)}
                            </div>
                        </div>
                    </div>

                    {/* Desktop/Tablet Center: Live Telemetry & Lime XP Bar */}
                    {hud.status !== 'menu' ? (
                        <div dir="ltr" className="hidden sm:flex items-center gap-4 min-w-0 flex-1 justify-center max-w-2xl">
                            {/* Score */}
                            <div className="flex flex-col items-center leading-none">
                                <span className="text-[9px] font-black uppercase text-black/60">SCORE</span>
                                <span className="font-mono text-sm font-black tabular-nums">
                                    {hud.score.toLocaleString()}
                                </span>
                            </div>

                            {hud.mode === 'smash' ? (
                                <>
                                    <div className="flex flex-col items-center leading-none">
                                        <span className="text-[9px] font-black uppercase text-black/60">WAVE</span>
                                        <span className="font-mono text-sm font-black tabular-nums">
                                            #{hud.wave}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-0.5" aria-label={`Lives: ${hud.lives}`}>
                                        {[1, 2, 3].map((i) => (
                                            <Heart
                                                key={i}
                                                className={`w-4 h-4 ${
                                                    i <= hud.lives
                                                        ? 'fill-[#fb7185] text-black stroke-[2.5]'
                                                        : 'fill-transparent text-black/25 stroke-[2]'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    {(hud.activeBuffs.wideSec > 0 || hud.activeBuffs.heavySec > 0) && (
                                        <div className="hidden md:flex items-center gap-1">
                                            {hud.activeBuffs.wideSec > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-[#bae6fd] border-2 border-black text-[9px] font-black">
                                                    WIDE {hud.activeBuffs.wideSec}s
                                                </span>
                                            )}
                                            {hud.activeBuffs.heavySec > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-[#fed7aa] border-2 border-black text-[9px] font-black">
                                                    SMASH {hud.activeBuffs.heavySec}s
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="flex flex-col items-center leading-none">
                                        <span className="text-[9px] font-black uppercase text-black/60">DIST</span>
                                        <span className="font-mono text-sm font-black tabular-nums">
                                            {hud.distanceMeters}m
                                        </span>
                                    </div>
                                    {hud.hasShield && (
                                        <span className="px-1.5 py-0.5 rounded bg-[#bae6fd] border-2 border-black text-[9px] font-black inline-flex items-center gap-0.5">
                                            <Shield className="w-3 h-3" /> ON
                                        </span>
                                    )}
                                </>
                            )}

                            {hud.comboMultiplier > 1 && (
                                <span className="inline-flex px-1.5 py-0.5 rounded bg-[#fde047] border-2 border-black shadow-[1.5px_1.5px_0px_#000] font-mono text-[10px] font-black">
                                    ×{hud.comboMultiplier}
                                </span>
                            )}

                            {/* Live Run Level & Lime XP Progress Bar */}
                            <div className="flex flex-col gap-0.5 w-36 shrink-0">
                                <div className="flex items-center justify-between text-[10px] font-mono font-black">
                                    <span>LV.{String(hud.runLevel).padStart(2, '0')}</span>
                                    <span className="text-black/65 tabular-nums">
                                        {hud.runLevelXp}/{hud.runLevelNextXp}
                                    </span>
                                </div>
                                <div className="h-2.5 w-full bg-white border-2 border-black rounded-sm overflow-hidden">
                                    <div
                                        className="h-full bg-[#bef264] transition-all duration-150"
                                        style={{ width: `${runXpPct}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_#000] text-[11px] font-black uppercase">
                            <span>{tx('CHOOSE YOUR BENTO GAME', 'اختار لعبتك في وضع بينتو')}</span>
                        </div>
                    )}

                    {/* Right: Mute, Pause, Exit */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={toggleMute}
                            className="h-8 w-8 rounded-lg bg-white hover:bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 flex items-center justify-center cursor-pointer"
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
                                className="h-8 w-8 rounded-lg bg-[#fde047] hover:bg-[#facc15] border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 flex items-center justify-center cursor-pointer"
                                aria-label={hud.status === 'playing' ? tx('Pause', 'إيقاف مؤقت') : tx('Resume', 'استكمال')}
                            >
                                {hud.status === 'playing' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={exitSecretGame}
                            className="h-8 px-2.5 sm:px-3 rounded-lg bg-[#fda4af] hover:bg-[#fb7185] border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 font-black text-[11px] uppercase flex items-center gap-1 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5 stroke-[3]" />
                            <span className="hidden sm:inline">{tx('EXIT', 'خروج')}</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Row 2: Dedicated Live Telemetry Strip (Zero Overlap!) */}
                {hud.status !== 'menu' && (
                    <div
                        dir="ltr"
                        className="sm:hidden px-3 py-1.5 bg-[#faf8f2] border-t-2 border-black flex items-center justify-between gap-2"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex items-baseline gap-1 whitespace-nowrap">
                                <span className="text-[9px] font-black uppercase text-black/60">SCR</span>
                                <span className="font-mono text-xs font-black tabular-nums">
                                    {hud.score.toLocaleString()}
                                </span>
                            </div>

                            {hud.mode === 'smash' ? (
                                <>
                                    <div className="flex items-baseline gap-0.5 whitespace-nowrap">
                                        <span className="text-[9px] font-black uppercase text-black/60">W</span>
                                        <span className="font-mono text-xs font-black tabular-nums">#{hud.wave}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0" aria-label={`Lives: ${hud.lives}`}>
                                        {[1, 2, 3].map((i) => (
                                            <Heart
                                                key={i}
                                                className={`w-3.5 h-3.5 ${
                                                    i <= hud.lives
                                                        ? 'fill-[#fb7185] text-black stroke-[2.5]'
                                                        : 'fill-transparent text-black/25 stroke-[2]'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-baseline gap-0.5 whitespace-nowrap">
                                        <span className="text-[9px] font-black uppercase text-black/60">DIST</span>
                                        <span className="font-mono text-xs font-black tabular-nums">
                                            {hud.distanceMeters}m
                                        </span>
                                    </div>
                                    {hud.hasShield && (
                                        <span className="px-1 py-0.5 rounded bg-[#bae6fd] border border-black text-[8px] font-black inline-flex items-center gap-0.5 shrink-0">
                                            <Shield className="w-2.5 h-2.5" />
                                        </span>
                                    )}
                                </>
                            )}

                            {hud.comboMultiplier > 1 && (
                                <span className="px-1 py-0.5 rounded bg-[#fde047] border border-black font-mono text-[9px] font-black shrink-0">
                                    ×{hud.comboMultiplier}
                                </span>
                            )}
                        </div>

                        {/* Compact Mobile LV + XP Bar */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-[10px] font-black whitespace-nowrap">
                                LV.{String(hud.runLevel).padStart(2, '0')}
                            </span>
                            <div className="h-2.5 w-16 bg-white border-2 border-black rounded-sm overflow-hidden">
                                <div
                                    className="h-full bg-[#bef264] transition-all duration-150"
                                    style={{ width: `${runXpPct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Playable Dot-Grid Canvas Stage */}
            <div
                ref={stageRef}
                dir="ltr"
                onPointerMove={handlePointerMove}
                onPointerDown={handlePointerDown}
                onTouchMove={handleTouchMoveStage}
                className="relative flex-1 min-h-0 w-full overflow-hidden touch-none"
            >
                <canvas ref={canvasRef} className="block w-full h-full" />

                {/* Floating Level-Up Sticker Toast */}
                {showLevelBanner !== null && hud.status === 'playing' && (
                    <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-in zoom-in-95 duration-200">
                        <div className="px-4 py-1.5 rounded-xl bg-[#fde047] border-[3px] border-black shadow-[4px_4px_0px_#000] flex items-center gap-2">
                            <Sparkles className="w-4 h-4 stroke-[2.5]" />
                            <span className="font-black text-xs sm:text-sm uppercase tracking-wider">
                                {tx(`LEVEL UP! LV.${showLevelBanner}`, `ترقية! مستوى ${showLevelBanner}`)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Smash Launch Prompt */}
                {hud.status === 'playing' && hud.mode === 'smash' && hud.waitingForLaunch && (
                    <div className="pointer-events-none absolute bottom-16 sm:bottom-14 inset-x-3 flex justify-center z-10">
                        <div className="px-3.5 py-1.5 rounded-full bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-[10px] sm:text-[11px] font-black uppercase tracking-wide text-center">
                            {isTouchViewport
                                ? tx('Tap to Launch • Slide Finger to Move Paddle', 'اضغط للإطلاق • اسحب بإصبعك لتحريك المضرب')
                                : tx('Tap / Click or Press SPACE to Launch', 'اضغط على الشاشة أو SPACE للإطلاق')}
                        </div>
                    </div>
                )}

                {/* MODE SELECTION OVERLAY */}
                {hud.status === 'menu' && (
                    <div dir="auto" className="absolute inset-0 z-20 flex items-start sm:items-center justify-center p-3 sm:p-5 overflow-y-auto">
                        <div
                            className={`w-full max-w-3xl bg-white border-[3px] border-black rounded-2xl p-4 sm:p-5 shadow-[8px_8px_0px_#000] my-auto will-change-[opacity,transform] transition-[opacity,transform] duration-[720ms] ease-[cubic-bezier(0.22,0.86,0.24,1)] ${
                                isRevealed
                                    ? 'opacity-100 translate-y-0 scale-100 delay-[170ms]'
                                    : 'opacity-0 translate-y-7 scale-[0.95] delay-0'
                            }`}
                        >
                            {/* Header + Persistent Bento Rank */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 mb-4 border-b-2 border-black">
                                <div>
                                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#bef264] border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase tracking-wider mb-1">
                                        {tx('SECRET BENTO ARCADE', 'أركيد بينتو السري')}
                                    </span>
                                    <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                                        {tx('Pick Your Mini-Game', 'اختار لعبتك المفضلة')}
                                    </h2>
                                    <p className="text-xs font-semibold text-black/70 mt-0.5">
                                        {tx(
                                            'Level up in both modes and sync bonus XP straight to your Future Robins account.',
                                            'ارفع مستواك في الوضعين واكسب نقاط XP حقيقية تضاف لحسابك على المنصة.'
                                        )}
                                    </p>
                                </div>

                                <div className="shrink-0 bg-[#faf8f2] border-2 border-black rounded-xl px-3.5 py-2 shadow-[3px_3px_0px_#000] min-w-[190px]">
                                    <div className="text-[10px] font-black uppercase tracking-wider mb-1">
                                        LV.{rankInfo.rankLevel} • {tx(rankInfo.title, rankInfo.arTitle)}
                                    </div>
                                    <div className="h-2.5 w-full bg-white border-2 border-black rounded-sm overflow-hidden mb-1">
                                        <div className="h-full bg-[#bef264]" style={{ width: `${rankInfo.progressPct}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between font-mono text-[10px] font-bold text-black/70">
                                        <span>{profile.totalArcadeXp.toLocaleString()} XP</span>
                                        <span>
                                            {rankInfo.currentXp}/{rankInfo.nextXp}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Two Symmetrical Neo-Brutalist Game Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* BENTO SMASH */}
                                <button
                                    type="button"
                                    onClick={() => startMode('smash')}
                                    className="group text-start flex flex-col justify-between p-3.5 rounded-2xl bg-[#f0f9ff] hover:bg-[#e0f2fe] border-[3px] border-black shadow-[5px_5px_0px_#000] hover:shadow-[7px_7px_0px_#000] hover:-translate-y-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                                >
                                    <div>
                                        {/* Gameplay Preview Image */}
                                        <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border-2 border-black shadow-[3px_3px_0px_#000] bg-[#f5f3ec] mb-3">
                                            <img
                                                src="/images/arcade/bento-smash.jpg"
                                                alt={tx('Bento Smash gameplay preview', 'معاينة لعبة تكسير البطاقات')}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                                                loading="eager"
                                            />
                                            <span className="absolute top-2 end-2 px-2 py-0.5 rounded-full bg-[#fde047] border-2 border-black shadow-[1.5px_1.5px_0px_#000] text-[9px] font-black uppercase">
                                                {tx('BRICK BREAKER', 'تكسير البطاقات')}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-7 h-7 rounded-lg bg-[#bae6fd] border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0">
                                                <Blocks className="w-3.5 h-3.5 stroke-[2.5]" />
                                            </div>
                                            <h3 className="text-base sm:text-lg font-black tracking-tight">
                                                BENTO SMASH
                                            </h3>
                                        </div>
                                        <p className="text-xs font-semibold text-black/75 leading-relaxed">
                                            {tx(
                                                'Shatter walls of KPI widget cards, chain bounce combos, and catch Wide-Paddle, Multi-Ball, Smash-Ball, and +XP stickers across escalating waves.',
                                                'كسّر جدران بطاقات البينتو، اعمل كومبو متتالي، والتقط استيكرات توسيع المضرب وتعدد الكرات و +XP عبر موجات متصاعدة.'
                                            )}
                                        </p>
                                    </div>

                                    <div className="mt-3.5 pt-2.5 border-t-2 border-black/15 flex items-center justify-between text-xs font-black">
                                        <span className="font-mono text-black/75">
                                            {tx('BEST:', 'الأفضل:')} {profile.bestSmashScore.toLocaleString()}
                                        </span>
                                        <span className="px-2.5 py-1 rounded-lg bg-[#bef264] border-2 border-black shadow-[2px_2px_0px_#000]">
                                            {tx('PLAY →', 'العب ←')}
                                        </span>
                                    </div>
                                </button>

                                {/* PAPER DASH */}
                                <button
                                    type="button"
                                    onClick={() => startMode('dash')}
                                    className="group text-start flex flex-col justify-between p-3.5 rounded-2xl bg-[#f7fee7] hover:bg-[#ecfccb] border-[3px] border-black shadow-[5px_5px_0px_#000] hover:shadow-[7px_7px_0px_#000] hover:-translate-y-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                                >
                                    <div>
                                        {/* Gameplay Preview Image */}
                                        <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border-2 border-black shadow-[3px_3px_0px_#000] bg-[#f5f3ec] mb-3">
                                            <img
                                                src="/images/arcade/paper-dash.jpg"
                                                alt={tx('Paper Dash gameplay preview', 'معاينة لعبة الجري والقفز')}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                                                loading="eager"
                                            />
                                            <span className="absolute top-2 end-2 px-2 py-0.5 rounded-full bg-[#fde047] border-2 border-black shadow-[1.5px_1.5px_0px_#000] text-[9px] font-black uppercase">
                                                {tx('CARD RUNNER', 'جري وقفز')}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-7 h-7 rounded-lg bg-[#bef264] border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0">
                                                <Footprints className="w-3.5 h-3.5 stroke-[2.5]" />
                                            </div>
                                            <h3 className="text-base sm:text-lg font-black tracking-tight">
                                                PAPER DASH
                                            </h3>
                                        </div>
                                        <p className="text-xs font-semibold text-black/75 leading-relaxed">
                                            {tx(
                                                'Leap across floating Bento cards with double-jump & fast-slam, dodge coral "!" warning blocks, grab shields, and collect yellow XP coin arcs.',
                                                'اقفز فوق بطاقات البينتو الطائرة مع القفز المزدوج والهبوط السريع، تفادى مكعبات التحذير (!)، والتقط الدروع والعملات الذهبية.'
                                            )}
                                        </p>
                                    </div>

                                    <div className="mt-3.5 pt-2.5 border-t-2 border-black/15 flex items-center justify-between text-xs font-black">
                                        <span className="font-mono text-black/75">
                                            {tx('BEST:', 'الأفضل:')} {profile.bestDashDistance}m
                                        </span>
                                        <span className="px-2.5 py-1 rounded-lg bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_#000]">
                                            {tx('PLAY →', 'العب ←')}
                                        </span>
                                    </div>
                                </button>
                            </div>

                            {/* Quick Controls Footer */}
                            <div className="mt-4 pt-3 border-t-2 border-black/15 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-black/70">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded bg-[#faf8f2] border border-black font-mono text-[10px]">
                                        MOUSE / DRAG / A-D
                                    </span>
                                    <span>Smash</span>
                                    <span>·</span>
                                    <span className="px-1.5 py-0.5 rounded bg-[#faf8f2] border border-black font-mono text-[10px]">
                                        SPACE / TAP / ↓ SLAM
                                    </span>
                                    <span>Dash</span>
                                </div>
                                <span className="font-mono text-[10px]">ESC = {tx('Pause / Exit', 'إيقاف / خروج')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* PAUSE MODAL */}
                {hud.status === 'paused' && (
                    <div dir="auto" className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/35">
                        <div className="w-full max-w-sm bg-white border-[3px] border-black rounded-2xl p-5 shadow-[7px_7px_0px_#000] text-center animate-in zoom-in-95 duration-200">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#fde047] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center">
                                <Pause className="w-5 h-5 stroke-[2.5]" />
                            </div>
                            <h3 className="text-lg font-black uppercase">
                                {tx('Game Paused', 'اللعبة متوقفة')}
                            </h3>
                            <p className="text-xs font-semibold text-black/70 mt-1 mb-5">
                                {hud.pauseReason === 'resize'
                                    ? tx('Paused automatically after resizing the window.', 'تم الإيقاف تلقائياً بعد تغيير حجم الشاشة.')
                                    : tx('Ready to jump right back in?', 'جاهز ترجع تكمل الجولة؟')}
                            </p>

                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => engineRef.current?.resume()}
                                    className="w-full h-11 rounded-xl bg-[#bef264] hover:bg-[#a3e635] border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                    {tx('Resume', 'استكمال')}
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => startMode(hud.mode)}
                                        className="h-10 rounded-xl bg-white hover:bg-[#f1f5f9] border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        {tx('Restart', 'إعادة')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={returnToMenu}
                                        className="h-10 rounded-xl bg-white hover:bg-[#f1f5f9] border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs cursor-pointer"
                                    >
                                        {tx('Switch Game', 'تغيير اللعبة')}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={exitSecretGame}
                                    className="h-9 text-xs font-black text-black/65 hover:text-black cursor-pointer"
                                >
                                    {tx('Return to Future Robins', 'العودة لفيوتشر روبينز')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* GAME OVER SUMMARY MODAL */}
                {hud.status === 'gameover' && summary && (
                    <div dir="auto" className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
                        <div className="w-full max-w-md bg-white border-[3px] border-black rounded-2xl p-5 shadow-[8px_8px_0px_#000] my-auto animate-in zoom-in-95 duration-200">
                            <div className="flex items-start justify-between gap-2 mb-4">
                                <div>
                                    <span className="inline-block px-2 py-0.5 rounded bg-[#fda4af] border-2 border-black text-[10px] font-black uppercase mb-1">
                                        {deathLabel}
                                    </span>
                                    <h3 className="text-xl font-black tracking-tight">
                                        {tx('Run Complete!', 'انتهت الجولة!')}
                                    </h3>
                                </div>
                                {summary.isNewBest && (
                                    <span className="px-2.5 py-1 rounded-xl bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase flex items-center gap-1 shrink-0">
                                        <Trophy className="w-3.5 h-3.5" />
                                        {tx('NEW BEST', 'رقم قياسي')}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <div className="p-2.5 rounded-xl bg-[#faf8f2] border-2 border-black shadow-[2px_2px_0px_#000] text-center">
                                    <div className="text-[10px] font-black uppercase text-black/60">
                                        {summary.mode === 'dash' ? tx('DISTANCE', 'المسافة') : tx('SCORE', 'النقاط')}
                                    </div>
                                    <div className="font-mono text-base font-black mt-0.5 tabular-nums">
                                        {summary.mode === 'dash'
                                            ? `${summary.distanceMeters}m`
                                            : summary.score.toLocaleString()}
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000] text-center">
                                    <div className="text-[10px] font-black uppercase text-black/60">
                                        {tx('LEVEL', 'المستوى')}
                                    </div>
                                    <div className="font-mono text-base font-black mt-0.5">
                                        LV.{summary.runLevel}
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-[#e0f2fe] border-2 border-black shadow-[2px_2px_0px_#000] text-center">
                                    <div className="text-[10px] font-black uppercase text-black/60">
                                        {summary.mode === 'dash' ? tx('COINS', 'العملات') : tx('WAVE', 'الموجة')}
                                    </div>
                                    <div className="font-mono text-base font-black mt-0.5 tabular-nums">
                                        {summary.mode === 'dash' ? summary.coinsCollected : `#${summary.wave}`}
                                    </div>
                                </div>
                            </div>

                            {/* XP & Platform Sync Card */}
                            <div className="p-3.5 rounded-xl bg-[#faf8f2] border-2 border-black shadow-[3px_3px_0px_#000] mb-4">
                                <div className="flex items-center justify-between text-xs font-mono font-black mb-1.5">
                                    <span>+{summary.runXpEarned.toLocaleString()} {tx('ARCADE XP', 'XP أركيد')}</span>
                                    <span>LV.{rankInfo.rankLevel}</span>
                                </div>
                                <div className="h-2.5 w-full bg-white border-2 border-black rounded-sm overflow-hidden mb-2">
                                    <div className="h-full bg-[#bef264]" style={{ width: `${rankInfo.progressPct}%` }} />
                                </div>
                                <div className="flex items-center justify-between text-[11px] font-bold">
                                    <span className="text-black/70">{tx(rankInfo.title, rankInfo.arTitle)}</span>
                                    {platformSync.status === 'syncing' && (
                                        <span>{tx('Syncing XP...', 'جاري الحفظ...')}</span>
                                    )}
                                    {platformSync.status === 'synced' && (
                                        <span className="px-2 py-0.5 rounded bg-[#bef264] border border-black font-black">
                                            +{platformSync.awarded} {tx('Platform XP', 'XP للمنصة')}
                                        </span>
                                    )}
                                    {platformSync.status === 'capped' && (
                                        <span className="text-black/60">{tx('Daily Platform XP cap reached', 'وصلت للحد اليومي')}</span>
                                    )}
                                    {platformSync.status === 'guest' && (
                                        <span className="text-black/60">{tx('Sign in to sync Platform XP', 'سجل الدخول لحفظ XP')}</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => startMode(summary.mode)}
                                    className="w-full h-11 rounded-xl bg-[#bef264] hover:bg-[#a3e635] border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                                    {tx('Play Again (Enter)', 'العب مجدداً')}
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={returnToMenu}
                                        className="h-10 rounded-xl bg-white hover:bg-[#f1f5f9] border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs cursor-pointer"
                                    >
                                        {tx('Switch Game', 'تغيير اللعبة')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={exitSecretGame}
                                        className="h-10 rounded-xl bg-[#fda4af] hover:bg-[#fb7185] border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs cursor-pointer"
                                    >
                                        {tx('Back to Site', 'العودة للموقع')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MOBILE TACTILE CONTROLS FOR PAPER DASH (JUMP + SLAM) */}
                {hud.status === 'playing' && hud.mode === 'dash' && isTouchViewport && (
                    <div
                        dir="ltr"
                        className="absolute inset-x-0 bottom-0 z-20 px-3.5 pt-2 flex items-center justify-between gap-3 pointer-events-none"
                        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
                    >
                        <button
                            type="button"
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                engineRef.current?.triggerDashSlam();
                            }}
                            className="pointer-events-auto h-14 px-5 rounded-2xl bg-[#fed7aa] active:bg-[#fdba74] border-[3px] border-black shadow-[4px_4px_0px_#000] active:translate-y-0.5 font-black text-xs uppercase flex items-center gap-1.5 touch-manipulation"
                        >
                            <ArrowDown className="w-5 h-5 stroke-[3]" />
                            <span>SLAM</span>
                        </button>

                        <button
                            type="button"
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                engineRef.current?.triggerDashJump();
                            }}
                            className="pointer-events-auto flex-1 max-w-[200px] h-14 rounded-2xl bg-[#bef264] active:bg-[#a3e635] border-[3px] border-black shadow-[4px_4px_0px_#000] active:translate-y-0.5 font-black text-sm uppercase flex items-center justify-center gap-2 touch-manipulation"
                        >
                            <ArrowUp className="w-5 h-5 stroke-[3]" />
                            <span>JUMP ×2</span>
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default BentoArcadeOverlay;
