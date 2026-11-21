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

const SPRING_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * SpatialRouteStage preserves the outgoing page's live DOM instance inside a keyed
 * 2-slot pool (zero unmount/remount flash on exit) and drives synchronized Web Animations
 * API spring physics on both the page planes and their inner section cards.
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
            durationMs: 560,
            transitionId: 0,
            isAnimating: false
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

        const visualDir: 1 | -1 =
            axis === 'x' && isArabic ? (logicalDir === 1 ? -1 : 1) : logicalDir;
        const durationMs = Math.min(620, 520 + Math.min(3, Math.max(0, hopDistance - 1)) * 28);
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

    // Drive GPU Web Animations API spring physics before paint on Frame 0
    useLayoutEffect(() => {
        if (!state.meta.isAnimating || state.meta.transitionId === 0) return;

        const { activeKey, exitingKey, dir, durationMs: dur, transitionId: tid } = state.meta;
        const exitEl = exitingKey ? layerRefs.current[exitingKey] : null;
        const enterEl = layerRefs.current[activeKey];

        const reducedMotion =
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const runningAnimations: Animation[] = [];

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

        if (axis === 'x') {
            // 1. Outgoing Page Plane: tactile grab -> continuous directional pull in -dir
            if (exitEl) {
                const exitAnim = exitEl.animate(
                    [
                        { transform: 'translate3d(0%, 0, 0) scale(1)', opacity: 1, offset: 0 },
                        {
                            transform: `translate3d(${dir * -14}px, 0, 0) scale(0.986)`,
                            opacity: 0.96,
                            offset: 0.12
                        },
                        {
                            transform: `translate3d(${dir * -54}%, 0, 0) scale(0.95)`,
                            opacity: 0,
                            offset: 1
                        }
                    ],
                    {
                        duration: dur,
                        easing: SPRING_EASE,
                        fill: 'forwards'
                    }
                );
                runningAnimations.push(exitAnim);

                // Outgoing page cards/sections get pulled with progressive inertia
                const exitBlocks = getSpatialContentBlocks(exitEl);
                const maxExit = Math.min(6, exitBlocks.length);
                for (let i = 0; i < maxExit; i++) {
                    const block = exitBlocks[i];
                    const pullPx = dir * -(18 + i * 14);
                    const bAnim = block.animate(
                        [
                            { transform: 'translate3d(0, 0, 0)' },
                            { transform: `translate3d(${pullPx}px, 0, 0)` }
                        ],
                        {
                            duration: dur,
                            easing: SPRING_EASE,
                            fill: 'forwards'
                        }
                    );
                    runningAnimations.push(bAnim);
                }
            }

            // 2. Incoming Page Plane: arrives from +dir with synchronized spring curve
            if (enterEl) {
                const enterAnim = enterEl.animate(
                    [
                        {
                            transform: `translate3d(${dir * 54}%, 0, 0) scale(0.965)`,
                            opacity: 0,
                            offset: 0
                        },
                        {
                            transform: `translate3d(${dir * 14}%, 0, 0) scale(0.992)`,
                            opacity: 1,
                            offset: 0.42
                        },
                        {
                            transform: 'translate3d(0%, 0, 0) scale(1)',
                            opacity: 1,
                            offset: 1
                        }
                    ],
                    {
                        duration: dur,
                        easing: SPRING_EASE,
                        fill: 'none'
                    }
                );
                runningAnimations.push(enterAnim);

                // Incoming page cards/sections arrive with staggered physical mass inertia
                const enterBlocks = getSpatialContentBlocks(enterEl);
                const maxEnter = Math.min(6, enterBlocks.length);
                for (let i = 0; i < maxEnter; i++) {
                    const block = enterBlocks[i];
                    const trailPx = dir * (22 + i * 16);
                    const blockDur = Math.min(760, dur + 35 + i * 36);
                    const bAnim = block.animate(
                        [
                            { transform: `translate3d(${trailPx}px, 0, 0)` },
                            { transform: 'translate3d(0, 0, 0)' }
                        ],
                        {
                            duration: blockDur,
                            easing: SPRING_EASE,
                            fill: 'none'
                        }
                    );
                    runningAnimations.push(bAnim);
                }
            }
        } else {
            // Vertical Teacher Sidebar spatial transition
            if (exitEl) {
                runningAnimations.push(
                    exitEl.animate(
                        [
                            { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
                            { transform: `translate3d(0, ${dir * -36}px, 0) scale(0.985)`, opacity: 0 }
                        ],
                        { duration: 440, easing: SPRING_EASE, fill: 'forwards' }
                    )
                );
            }
            if (enterEl) {
                runningAnimations.push(
                    enterEl.animate(
                        [
                            { transform: `translate3d(0, ${dir * 36}px, 0) scale(0.985)`, opacity: 0 },
                            { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 }
                        ],
                        { duration: 460, easing: SPRING_EASE, fill: 'none' }
                    )
                );
            }
        }

        const totalWait = axis === 'x' ? dur + 160 : 480;
        const timer = window.setTimeout(() => {
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
        }, totalWait);

        return () => {
            window.clearTimeout(timer);
            for (const anim of runningAnimations) {
                try {
                    anim.cancel();
                } catch {
                    // ignore already finished animation
                }
            }
        };
    }, [
        state.meta.isAnimating,
        state.meta.transitionId,
        state.meta.activeKey,
        state.meta.exitingKey,
        state.meta.dir,
        state.meta.durationMs,
        axis
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
