import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigationType, useOutlet } from 'react-router-dom';
import { useNavArrangement } from '../context/NavArrangementContext';
import { useLanguage } from '../context/LanguageContext';

interface SpatialRouteStageProps {
    axis?: 'x' | 'y';
    className?: string;
}

interface LayerSlot {
    key: string;
    element: React.ReactNode;
    scrollY: number;
}

interface TransitionMeta {
    activeKey: string;
    exitingKey: string | null;
    dir: 1 | -1;
    durationMs: number;
    transitionId: number;
    isAnimating: boolean;
    axis: 'x' | 'y';
}

/**
 * Keeps the outgoing page's already-mounted React tree 100% frozen in place
 * when `freeze === true` so React performs zero reconciliation and never
 * resets the outgoing page's component state during the exit animation.
 */
const FrozenLayer = React.memo<{ freeze: boolean; children: React.ReactNode }>(
    ({ children }) => <>{children}</>,
    (prevProps, nextProps) => nextProps.freeze === true || prevProps.children === nextProps.children
);
FrozenLayer.displayName = 'FrozenLayer';

/**
 * Normalizes route aliases & dynamic detail paths onto their canonical navbar slot
 * so spatial transition directions always match the visual navbar link order.
 */
function normalizeSpatialPath(pathname: string): string {
    const clean = pathname.replace(/\/+$/, '').toLowerCase() || '/';
    if (clean === '/dashboard' || clean === '/quizzes' || clean === '/teacher') return '/';
    if (clean.startsWith('/tracks') || clean.startsWith('/badge-tree')) return '/tracks';
    if (clean.startsWith('/tournaments') || clean.startsWith('/t/')) return '/tournaments';
    if (clean.startsWith('/leaderboard')) return '/leaderboard';
    if (clean.startsWith('/daily')) return '/daily';
    if (clean.startsWith('/live-arena') || clean.startsWith('/classroom')) return '/live-arena';
    if (clean.startsWith('/clans') || clean.startsWith('/classes')) return '/clans';
    if (clean.startsWith('/shop')) return '/shop';
    if (clean.startsWith('/social')) return '/social';
    if (clean.startsWith('/analytics')) return '/analytics';
    if (clean.startsWith('/profile')) return '/profile';
    if (clean.startsWith('/admin')) return '/admin';
    return clean;
}

/**
 * Finds the top-level visual section/card blocks inside a page layer,
 * automatically unwrapping single-child layout wrappers (such as `<PageLayout><main><div class="max-w-7xl">...`)
 * so individual page cards always animate with staggered physical inertia.
 */
function getSpatialContentBlocks(layerEl: HTMLElement): HTMLElement[] {
    let root: HTMLElement =
        layerEl.querySelector<HTMLElement>('[data-spatial-content], main') || layerEl;

    // Unwrap up to 3 levels if a container only wraps a single layout div
    for (let depth = 0; depth < 3; depth++) {
        const directChildren = Array.from(root.children).filter(
            (el): el is HTMLElement =>
                el instanceof HTMLElement &&
                el.tagName !== 'STYLE' &&
                el.tagName !== 'SCRIPT' &&
                !el.classList.contains('ambient-background')
        );
        if (directChildren.length === 1 && directChildren[0].children.length >= 1) {
            root = directChildren[0];
        } else {
            break;
        }
    }

    return Array.from(root.children).filter(
        (el): el is HTMLElement =>
            el instanceof HTMLElement &&
            el.tagName !== 'STYLE' &&
            el.tagName !== 'SCRIPT' &&
            !el.classList.contains('ambient-background')
    );
}

/**
 * 48-step pre-sampled C2-continuous physics curves running with `easing: 'linear'`
 * on the GPU compositor thread (zero mid-curve velocity stalls, full 60/120/144Hz fluidity).
 */
const SAMPLE_STEPS = 48;
const BASE_HORIZONTAL_MS = 880;
const VERTICAL_MS = 780;

function clamp01(v: number): number {
    return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

/** Perlin C2 smootherstep: zero velocity AND zero acceleration at both endpoints. */
function smootherstep(x: number): number {
    const t = clamp01(x);
    return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Asymmetric C2 spatial glide curve:
 * - 0%–16%: smooth tactile lift & acceleration ramp (never jumps on frame 1)
 * - 16%–56%: bold, unmistakable spatial sweep across the canvas
 * - 56%–100%: long, whisper-soft deceleration settle with zero snap
 */
function spatialEase(u: number): number {
    const warped = 1 - Math.pow(1 - clamp01(u), 1.28);
    return smootherstep(warped);
}

function buildHorizontalExitKeyframes(dir: 1 | -1): Keyframe[] {
    const frames: Keyframe[] = [];
    for (let i = 0; i <= SAMPLE_STEPS; i++) {
        const u = i / SAMPLE_STEPS;
        const move = spatialEase(u);
        const txPct = -dir * 68 * move;
        const fade = smootherstep(clamp01((u - 0.12) / 0.70));
        const opacity = 1 - fade;
        frames.push({
            offset: u,
            transform: `translate3d(${txPct.toFixed(3)}%, 0, 0)`,
            opacity: Number(opacity.toFixed(4))
        });
    }
    return frames;
}

function buildHorizontalEnterKeyframes(dir: 1 | -1): Keyframe[] {
    const frames: Keyframe[] = [];
    for (let i = 0; i <= SAMPLE_STEPS; i++) {
        const u = i / SAMPLE_STEPS;
        const move = spatialEase(u);
        const txPct = dir * 68 * (1 - move);
        const opacity = smootherstep(clamp01((u - 0.06) / 0.44));
        frames.push({
            offset: u,
            transform: `translate3d(${txPct.toFixed(3)}%, 0, 0)`,
            opacity: Number(opacity.toFixed(4))
        });
    }
    return frames;
}

function buildVerticalExitKeyframes(dir: 1 | -1, travel = 68): Keyframe[] {
    const frames: Keyframe[] = [];
    for (let i = 0; i <= SAMPLE_STEPS; i++) {
        const u = i / SAMPLE_STEPS;
        const move = spatialEase(u);
        const tyPx = -dir * travel * move;
        const fade = smootherstep(clamp01((u - 0.10) / 0.72));
        const opacity = 1 - fade;
        frames.push({
            offset: u,
            transform: `translate3d(0, ${tyPx.toFixed(2)}px, 0)`,
            opacity: Number(opacity.toFixed(4))
        });
    }
    return frames;
}

function buildVerticalEnterKeyframes(dir: 1 | -1, travel = 68): Keyframe[] {
    const frames: Keyframe[] = [];
    for (let i = 0; i <= SAMPLE_STEPS; i++) {
        const u = i / SAMPLE_STEPS;
        const move = spatialEase(u);
        const tyPx = dir * travel * (1 - move);
        const opacity = smootherstep(clamp01((u - 0.06) / 0.44));
        frames.push({
            offset: u,
            transform: `translate3d(0, ${tyPx.toFixed(2)}px, 0)`,
            opacity: Number(opacity.toFixed(4))
        });
    }
    return frames;
}

function buildBlockInertiaKeyframes(fromPx: number, toPx: number, axis: 'x' | 'y'): Keyframe[] {
    const frames: Keyframe[] = [];
    for (let i = 0; i <= SAMPLE_STEPS; i++) {
        const u = i / SAMPLE_STEPS;
        const move = spatialEase(u);
        const delta = fromPx + (toPx - fromPx) * move;
        frames.push({
            offset: u,
            transform:
                axis === 'x'
                    ? `translate3d(${delta.toFixed(2)}px, 0, 0)`
                    : `translate3d(0, ${delta.toFixed(2)}px, 0)`
        });
    }
    return frames;
}

/**
 * SpatialRouteStage preserves the outgoing page's live DOM instance inside a keyed
 * 2-slot pool (zero unmount/remount flash on exit) and drives synchronized 48-step
 * C2-continuous GPU Web Animations API physics across both page planes and their cards.
 */
export const SpatialRouteStage: React.FC<SpatialRouteStageProps> = ({
    axis = 'x',
    className = ''
}) => {
    const location = useLocation();
    const navigationType = useNavigationType();
    const outlet = useOutlet();
    const { primaryItems, secondaryItems, hiddenItems } = useNavArrangement();
    const { isArabic } = useLanguage();

    const layerRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const orderedSlots = useMemo(() => {
        const seen = new Set<string>();
        const list: string[] = [];
        const pushUnique = (rawPath: string) => {
            const norm = normalizeSpatialPath(rawPath);
            if (!seen.has(norm)) {
                seen.add(norm);
                list.push(norm);
            }
        };
        for (const item of primaryItems) pushUnique(item.path);
        for (const item of secondaryItems) pushUnique(item.path);
        for (const item of hiddenItems) pushUnique(item.path);
        pushUnique('/profile');
        pushUnique('/admin');
        return list;
    }, [primaryItems, secondaryItems, hiddenItems]);

    const routeKey = location.pathname;

    const [state, setState] = useState<{
        layers: LayerSlot[];
        meta: TransitionMeta;
    }>(() => ({
        layers: [{ key: routeKey, element: outlet, scrollY: 0 }],
        meta: {
            activeKey: routeKey,
            exitingKey: null,
            dir: 1,
            durationMs: BASE_HORIZONTAL_MS,
            transitionId: 0,
            isAnimating: false,
            axis
        }
    }));

    if (state.meta.activeKey !== routeKey) {
        const prevKey = state.meta.activeKey;
        const prevSlot = normalizeSpatialPath(prevKey);
        const nextSlot = normalizeSpatialPath(routeKey);
        const prevIdx = orderedSlots.indexOf(prevSlot);
        const nextIdx = orderedSlots.indexOf(nextSlot);

        let logicalDir: 1 | -1 = 1;
        let hopDistance = 1;

        if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
            logicalDir = nextIdx > prevIdx ? 1 : -1;
            hopDistance = Math.abs(nextIdx - prevIdx);
        } else if (navigationType === 'POP') {
            logicalDir = -1;
        } else {
            logicalDir = 1;
        }

        // Footer navigation: push current page down, next page falls in from the top
        const footerUp = (location.state as { spatial?: string } | null)?.spatial === 'drop';
        const effectiveAxis: 'x' | 'y' = footerUp ? 'y' : axis;
        const visualDir: 1 | -1 = footerUp
            ? -1
            : effectiveAxis === 'x' && isArabic ? (logicalDir === 1 ? -1 : 1) : logicalDir;
        const durationMs = Math.min(1060, BASE_HORIZONTAL_MS + Math.min(3, Math.max(0, hopDistance - 1)) * 60);
        const capturedScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

        setState((prev) => {
            const prevActiveLayer = prev.layers.find((l) => l.key === prev.meta.activeKey);
            const nextLayers: LayerSlot[] = [];

            if (prevActiveLayer && prevActiveLayer.key !== routeKey) {
                nextLayers.push({
                    ...prevActiveLayer,
                    scrollY: capturedScrollY
                });
            }
            nextLayers.push({
                key: routeKey,
                element: outlet,
                scrollY: 0
            });

            return {
                layers: nextLayers,
                meta: {
                    activeKey: routeKey,
                    exitingKey: prevActiveLayer ? prevActiveLayer.key : null,
                    dir: visualDir,
                    durationMs,
                    transitionId: prev.meta.transitionId + 1,
                    axis: effectiveAxis,
                    isAnimating: Boolean(prevActiveLayer && prevActiveLayer.key !== routeKey)
                }
            };
        });
    }

    // Keep the active layer's element reference fresh when not transitioning
    useEffect(() => {
        if (state.meta.isAnimating) return;
        const currentActive = state.layers.find((l) => l.key === routeKey);
        if (currentActive && currentActive.element === outlet && state.layers.length === 1) return;
        const timer = window.setTimeout(() => {
            setState((prev) => {
                if (prev.meta.isAnimating || prev.meta.activeKey !== routeKey) return prev;
                return {
                    ...prev,
                    layers: [{ key: routeKey, element: outlet, scrollY: 0 }]
                };
            });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [outlet, routeKey, state.meta.isAnimating, state.layers]);

    const {
        isAnimating: metaIsAnimating,
        transitionId: metaTransitionId,
        activeKey: metaActiveKey,
        exitingKey: metaExitingKey,
        dir: metaDir,
        durationMs: metaDurationMs,
        axis: metaAxis
    } = state.meta;

    // Drive GPU Web Animations API physics with Frame-0 mount isolation so zero frames are dropped
    useLayoutEffect(() => {
        if (!metaIsAnimating || metaTransitionId === 0) return;

        const activeKey = metaActiveKey;
        const exitingKey = metaExitingKey;
        const dir = metaDir;
        const dur = metaDurationMs;
        const tid = metaTransitionId;
        const exitEl = exitingKey ? layerRefs.current[exitingKey] : null;
        const enterEl = layerRefs.current[activeKey];

        const reducedMotion =
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reducedMotion || typeof Element.prototype.animate !== 'function') {
            const timer = window.setTimeout(() => {
                setState((prev) =>
                    prev.meta.transitionId === tid
                        ? {
                              layers: prev.layers.filter((l) => l.key === prev.meta.activeKey),
                              meta: { ...prev.meta, exitingKey: null, isAnimating: false }
                          }
                        : prev
                );
            }, 120);
            return () => window.clearTimeout(timer);
        }

        // Footer drop: current page is pushed down off-screen while the next page falls in from the top
        const isDrop = metaAxis === 'y' && dir === -1 && axis === 'x';
        const vTravel = isDrop ? Math.round(window.innerHeight * 0.85) : 68;
        const runningAnimations: Animation[] = [];
        let maxEndMs = metaAxis === 'x' ? dur : VERTICAL_MS;

        const stageAnimation = (anim: Animation, endMs: number) => {
            // Hold synchronously at keyframe 0 while browser finishes mount layout & GPU upload
            anim.pause();
            anim.currentTime = 0;
            runningAnimations.push(anim);
            if (endMs > maxEndMs) maxEndMs = endMs;
        };

        if (metaAxis === 'x') {
            // 1. Outgoing Page Plane: smooth depth pull + continuous sweep in -dir
            if (exitEl) {
                stageAnimation(
                    exitEl.animate(buildHorizontalExitKeyframes(dir), {
                        duration: dur,
                        easing: 'linear',
                        fill: 'both'
                    }),
                    dur
                );

                // Outgoing page sections trail with progressive physical inertia
                const exitBlocks = getSpatialContentBlocks(exitEl);
                const maxExit = Math.min(4, exitBlocks.length);
                for (let i = 0; i < maxExit; i++) {
                    const pullPx = dir * -(24 + i * 16);
                    stageAnimation(
                        exitBlocks[i].animate(buildBlockInertiaKeyframes(0, pullPx, 'x'), {
                            duration: dur,
                            easing: 'linear',
                            fill: 'both'
                        }),
                        dur
                    );
                }
            }

            // 2. Incoming Page Plane: glides smoothly from +dir with long C2 deceleration
            if (enterEl) {
                stageAnimation(
                    enterEl.animate(buildHorizontalEnterKeyframes(dir), {
                        duration: dur,
                        easing: 'linear',
                        fill: 'backwards'
                    }),
                    dur
                );

                // Incoming page cards settle with cascading physical mass inertia
                const enterBlocks = getSpatialContentBlocks(enterEl);
                const maxEnter = Math.min(5, enterBlocks.length);
                for (let i = 0; i < maxEnter; i++) {
                    const trailPx = dir * (28 + i * 20);
                    const blockDelay = i * 18;
                    const blockDur = dur + 30 + i * 18;
                    stageAnimation(
                        enterBlocks[i].animate(buildBlockInertiaKeyframes(trailPx, 0, 'x'), {
                            duration: blockDur,
                            delay: blockDelay,
                            easing: 'linear',
                            fill: 'backwards'
                        }),
                        blockDelay + blockDur
                    );
                }
            }
        } else {
            // Vertical Teacher Sidebar spatial transition (780ms C2-smooth glide + card inertia)
            if (exitEl) {
                stageAnimation(
                    exitEl.animate(buildVerticalExitKeyframes(dir, vTravel), {
                        duration: VERTICAL_MS,
                        easing: 'linear',
                        fill: 'both'
                    }),
                    VERTICAL_MS
                );
            }
            if (enterEl) {
                stageAnimation(
                    enterEl.animate(buildVerticalEnterKeyframes(dir, vTravel), {
                        duration: VERTICAL_MS,
                        easing: 'linear',
                        fill: 'backwards'
                    }),
                    VERTICAL_MS
                );

                const enterBlocks = getSpatialContentBlocks(enterEl);
                const maxEnter = Math.min(4, enterBlocks.length);
                for (let i = 0; i < maxEnter; i++) {
                    const trailPx = dir * (18 + i * 12);
                    const blockDelay = i * 16;
                    const blockDur = VERTICAL_MS + 24 + i * 16;
                    stageAnimation(
                        enterBlocks[i].animate(buildBlockInertiaKeyframes(trailPx, 0, 'y'), {
                            duration: blockDur,
                            delay: blockDelay,
                            easing: 'linear',
                            fill: 'backwards'
                        }),
                        blockDelay + blockDur
                    );
                }
            }
        }

        let cancelled = false;
        let finished = false;
        let fallbackTimer: number | null = null;

        const finishTransition = () => {
            if (cancelled || finished) return;
            finished = true;
            if (fallbackTimer !== null) {
                window.clearTimeout(fallbackTimer);
                fallbackTimer = null;
            }
            setState((prev) => {
                if (prev.meta.transitionId !== tid) return prev;
                return {
                    layers: prev.layers.filter((l) => l.key === prev.meta.activeKey),
                    meta: {
                        ...prev.meta,
                        exitingKey: null,
                        isAnimating: false
                    }
                };
            });
        };

        // Start playback on the next animation frame AFTER React mount layout & GPU upload complete
        // so Frame 1 starts at 0ms with every single motion frame rendered smoothly.
        let rafId2 = 0;
        const rafId = window.requestAnimationFrame(() => {
            rafId2 = window.requestAnimationFrame(() => {
                if (cancelled) return;
                for (const anim of runningAnimations) {
                    anim.play();
                }
                Promise.allSettled(runningAnimations.map((a) => a.finished)).then(() => {
                    finishTransition();
                });
            });
        });

        // Safety fallback in case a backgrounded tab throttles rAF/WAAPI completion
        fallbackTimer = window.setTimeout(finishTransition, maxEndMs + 320);

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(rafId);
            window.cancelAnimationFrame(rafId2);
            if (fallbackTimer !== null) {
                window.clearTimeout(fallbackTimer);
            }
            for (const anim of runningAnimations) {
                try {
                    anim.cancel();
                } catch {
                    // ignore already finished animation
                }
            }
        };
    }, [
        metaIsAnimating,
        metaTransitionId,
        metaActiveKey,
        metaExitingKey,
        metaDir,
        metaDurationMs,
        metaAxis
    ]);

    return (
        <div
            className={`spatial-stage relative w-full flex-1 ${state.meta.isAnimating ? 'is-transitioning' : ''} ${className}`}
            data-spatial-axis={axis}
        >
            {state.layers.map((layer) => {
                const isActive = layer.key === state.meta.activeKey;
                const isExiting = !isActive;

                return (
                    <div
                        key={layer.key}
                        ref={(el) => {
                            if (el) {
                                layerRefs.current[layer.key] = el;
                            } else {
                                delete layerRefs.current[layer.key];
                            }
                        }}
                        className={`spatial-layer w-full ${
                            isExiting
                                ? 'spatial-layer-exit'
                                : state.meta.isAnimating
                                  ? 'spatial-layer-enter'
                                  : ''
                        }`}
                        aria-hidden={isExiting ? 'true' : undefined}
                    >
                        <div
                            className="w-full"
                            style={
                                isExiting && layer.scrollY > 0
                                    ? { marginTop: `${-layer.scrollY}px` }
                                    : undefined
                            }
                        >
                            <FrozenLayer freeze={isExiting}>
                                {isActive ? outlet : layer.element}
                            </FrozenLayer>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default SpatialRouteStage;
