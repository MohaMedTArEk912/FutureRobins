import React, { useEffect, useRef } from 'react';

interface GridCell {
    x: number;
    y: number;
}

interface TurnMark {
    x: number;
    y: number;
    bornAt: number;
    color: string;
}

interface TargetNode {
    x: number;
    y: number;
    color: string;
    phase: number;
}

interface RippleWave {
    x: number;
    y: number;
    bornAt: number;
    color: string;
}

type WallSide = 'top' | 'bottom' | 'left' | 'right';

interface WallImpact {
    wall: WallSide;
    px: number;
    py: number;
    bornAt: number;
    color: string;
}

interface WallBounds {
    minCol: number;
    maxCol: number;
    minRow: number;
    maxRow: number;
    topPx: number;
    bottomPx: number;
    leftPx: number;
    rightPx: number;
    hasTopWall: boolean;
    hasBottomWall: boolean;
    hasLeftWall: boolean;
    hasRightWall: boolean;
    collapsed: boolean;
}

interface ReboundImpulse {
    dx: number;
    dy: number;
    stepsLeft: number;
}

const CELL = 44;
const IDLE_AFTER_MS = 3200;
const WALL_POLL_INTERVAL_MS = 140;

// Bento-calibrated high-contrast studio palette
const C_LIME = '#bef264';
const C_YELLOW = '#fde047';
const C_SKY = '#bae6fd';
const C_EMBER = '#fb7185';
const C_PAPER = '#f5f3ec';

const TARGET_PALETTE = [C_YELLOW, C_SKY, C_EMBER];

const DIRS: readonly GridCell[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
];

function easeOutCubic(t: number): number {
    const inv = 1 - Math.max(0, Math.min(1, t));
    return 1 - inv * inv * inv;
}

function hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

function segmentColor(index: number, total: number): string {
    const ratio = index / Math.max(1, total - 1);
    if (ratio < 0.28) return C_LIME;
    if (ratio < 0.56) return C_YELLOW;
    if (ratio < 0.82) return C_SKY;
    return C_PAPER;
}

function getViewportProfile(viewportWidth: number) {
    if (viewportWidth < 640) {
        return { baseLength: 10, maxLength: 13, targetCount: 2, headSize: 18, bodyStart: 14 };
    }
    if (viewportWidth < 1024) {
        return { baseLength: 14, maxLength: 18, targetCount: 3, headSize: 20, bodyStart: 16 };
    }
    return { baseLength: 18, maxLength: 22, targetCount: 3, headSize: 22, bodyStart: 18 };
}

export const NoirGeometricSnakeCanvas: React.FC = React.memo(() => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        let reducedMotion = reducedMotionQuery.matches;

        let width = window.innerWidth;
        let height = window.innerHeight;
        let dpr = Math.min(window.devicePixelRatio || 1, 2);
        let cols = Math.max(6, Math.floor(width / CELL));
        let rows = Math.max(5, Math.floor(height / CELL));
        let offsetX = Math.floor((width - cols * CELL) / 2);
        let offsetY = Math.floor((height - rows * CELL) / 2);
        let profile = getViewportProfile(width);

        const toPxX = (gx: number) => offsetX + gx * CELL + CELL * 0.5;
        const toPxY = (gy: number) => offsetY + gy * CELL + CELL * 0.5;

        const bounds: WallBounds = {
            minCol: 1,
            maxCol: Math.max(1, cols - 2),
            minRow: 1,
            maxRow: Math.max(1, rows - 2),
            topPx: 0,
            bottomPx: height,
            leftPx: 0,
            rightPx: width,
            hasTopWall: false,
            hasBottomWall: false,
            hasLeftWall: false,
            hasRightWall: false,
            collapsed: false
        };

        const clampCell = (c: GridCell): GridCell => ({
            x: Math.max(bounds.minCol, Math.min(bounds.maxCol, c.x)),
            y: Math.max(bounds.minRow, Math.min(bounds.maxRow, c.y))
        });

        const isInsideBounds = (x: number, y: number): boolean =>
            x >= bounds.minCol && x <= bounds.maxCol && y >= bounds.minRow && y <= bounds.maxRow;

        const segments: GridCell[] = [];
        let prevTail: GridCell = { x: 1, y: 2 };
        let heading: GridCell = { x: 1, y: 0 };
        let stepProgress = 0;
        let targetLength = profile.baseLength;
        let pulseWave = -1; // travels down spine on target capture or wall rebound
        let reboundImpulse: ReboundImpulse | null = null;
        let lastWallPollAt = 0;

        const turnMarks: TurnMark[] = [];
        const ripples: RippleWave[] = [];
        const wallImpacts: WallImpact[] = [];
        const targets: TargetNode[] = [];

        const pointer = {
            active: false,
            showReticle: false,
            rawX: width * 0.65,
            rawY: height * 0.45,
            cellX: Math.floor(cols * 0.65),
            cellY: Math.floor(rows * 0.45),
            inBlockedChrome: false,
            lastMoveAt: 0
        };

        let patrolGoal: GridCell = {
            x: Math.floor(cols * 0.72),
            y: Math.floor(rows * 0.55)
        };

        const emitWallImpact = (wall: WallSide, cellX: number, cellY: number, now: number) => {
            let px = toPxX(cellX);
            let py = toPxY(cellY);
            let color = C_LIME;

            if (wall === 'top') {
                py = bounds.hasTopWall ? bounds.topPx : offsetY + bounds.minRow * CELL;
                color = C_LIME;
            } else if (wall === 'bottom') {
                py = bounds.hasBottomWall ? bounds.bottomPx : offsetY + (bounds.maxRow + 1) * CELL;
                color = C_YELLOW;
            } else if (wall === 'left') {
                px = bounds.hasLeftWall ? bounds.leftPx : offsetX + bounds.minCol * CELL;
                color = C_SKY;
            } else {
                px = bounds.hasRightWall ? bounds.rightPx : offsetX + (bounds.maxCol + 1) * CELL;
                color = C_SKY;
            }

            // Avoid stacking duplicate sparks at the exact same moment
            const last = wallImpacts[wallImpacts.length - 1];
            if (last && last.wall === wall && now - last.bornAt < 180) return;

            wallImpacts.push({ wall, px, py, bornAt: now, color });
            if (wallImpacts.length > 10) wallImpacts.shift();
            pulseWave = 0;
        };

        const spawnTarget = (colorIndex: number): TargetNode => {
            const spanX = Math.max(1, bounds.maxCol - bounds.minCol + 1);
            const spanY = Math.max(1, bounds.maxRow - bounds.minRow + 1);
            const padX = spanX > 6 ? 1 : 0;
            const padY = spanY > 5 ? 1 : 0;
            const loX = bounds.minCol + padX;
            const hiX = Math.max(loX, bounds.maxCol - padX);
            const loY = bounds.minRow + padY;
            const hiY = Math.max(loY, bounds.maxRow - padY);

            for (let attempt = 0; attempt < 30; attempt++) {
                const tx = loX + Math.floor(Math.random() * (hiX - loX + 1));
                const ty = loY + Math.floor(Math.random() * (hiY - loY + 1));
                const onSnake = segments.some((s) => s.x === tx && s.y === ty);
                const onOther = targets.some((t) => Math.abs(t.x - tx) + Math.abs(t.y - ty) < 3);
                if (!onSnake && !onOther) {
                    return {
                        x: tx,
                        y: ty,
                        color: TARGET_PALETTE[colorIndex % TARGET_PALETTE.length],
                        phase: Math.random() * Math.PI * 2
                    };
                }
            }
            return {
                x: Math.floor((loX + hiX) / 2),
                y: Math.floor((loY + hiY) / 2),
                color: TARGET_PALETTE[colorIndex % TARGET_PALETTE.length],
                phase: 0
            };
        };

        const seedTargets = () => {
            targets.length = 0;
            for (let i = 0; i < profile.targetCount; i++) {
                targets.push(spawnTarget(i));
            }
        };

        const updateWallBounds = () => {
            let topPx = 0;
            let bottomPx = height;
            let leftPx = 0;
            let rightPx = width;
            let hasTopWall = false;
            let hasBottomWall = false;
            let hasLeftWall = false;
            let hasRightWall = false;

            const elements = document.querySelectorAll<HTMLElement>(
                'header, footer, aside, [data-snake-wall]'
            );

            for (let i = 0; i < elements.length; i++) {
                const el = elements[i];
                // Never treat modal headers/footers inside dialogs as playfield walls
                if (el.closest('[role="dialog"], .app-dialog-overlay')) continue;

                const rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) continue;

                const role = el.dataset.snakeWall;
                const tag = el.tagName;

                // Top navigation bar / admin header / teacher mobile top bar
                if (role === 'top' || tag === 'HEADER') {
                    if (rect.top <= 40 && rect.bottom > 0 && rect.bottom < height * 0.45) {
                        if (rect.bottom > topPx) {
                            topPx = rect.bottom;
                            hasTopWall = true;
                        }
                    }
                    continue;
                }

                // Footer / mobile bottom navigation bar
                if (role === 'bottom' || tag === 'FOOTER') {
                    if (rect.top < height && rect.bottom > topPx + 16) {
                        const clampedTop = Math.max(topPx + 4, rect.top);
                        if (clampedTop < bottomPx) {
                            bottomPx = clampedTop;
                            hasBottomWall = true;
                        }
                    }
                    continue;
                }

                // Desktop sidebars (admin / teacher)
                if (role === 'side' || tag === 'ASIDE') {
                    if (rect.height < height * 0.35) continue;
                    if (rect.left <= 24 && rect.right > 0 && rect.right < width * 0.45) {
                        if (rect.right > leftPx) {
                            leftPx = rect.right;
                            hasLeftWall = true;
                        }
                    } else if (rect.right >= width - 24 && rect.left < width && rect.left > width * 0.55) {
                        if (rect.left < rightPx) {
                            rightPx = rect.left;
                            hasRightWall = true;
                        }
                    }
                }
            }

            const halfHead = profile.headSize * 0.5;
            const clearance = halfHead + 4;
            const openHeight = bottomPx - topPx;
            const openWidth = rightPx - leftPx;
            const collapsed = openHeight < CELL || openWidth < CELL * 2;

            // Convert pixel edges to grid cells so the head tile stays cleanly outside chrome
            const edgePad = width < 640 ? 0 : 1;
            let minRow = hasTopWall
                ? Math.max(0, Math.ceil((topPx - offsetY - (CELL * 0.5 - clearance)) / CELL))
                : edgePad;
            let maxRow = hasBottomWall
                ? Math.min(rows - 1, Math.floor((bottomPx - offsetY - (CELL * 0.5 + clearance)) / CELL))
                : rows - 1 - edgePad;
            let minCol = hasLeftWall
                ? Math.max(0, Math.ceil((leftPx - offsetX - (CELL * 0.5 - clearance)) / CELL))
                : edgePad;
            let maxCol = hasRightWall
                ? Math.min(cols - 1, Math.floor((rightPx - offsetX - (CELL * 0.5 + clearance)) / CELL))
                : cols - 1 - edgePad;

            minRow = Math.max(0, Math.min(rows - 1, minRow));
            maxRow = Math.max(0, Math.min(rows - 1, maxRow));
            if (maxRow < minRow) {
                maxRow = minRow;
            }
            minCol = Math.max(0, Math.min(cols - 1, minCol));
            maxCol = Math.max(0, Math.min(cols - 1, maxCol));
            if (maxCol < minCol) {
                maxCol = minCol;
            }

            bounds.minCol = minCol;
            bounds.maxCol = maxCol;
            bounds.minRow = minRow;
            bounds.maxRow = maxRow;
            bounds.topPx = topPx;
            bounds.bottomPx = bottomPx;
            bounds.leftPx = leftPx;
            bounds.rightPx = rightPx;
            bounds.hasTopWall = hasTopWall;
            bounds.hasBottomWall = hasBottomWall;
            bounds.hasLeftWall = hasLeftWall;
            bounds.hasRightWall = hasRightWall;
            bounds.collapsed = collapsed;

            // Keep pointer blocked-chrome state synced when user scrolls footer/nav under cursor
            pointer.inBlockedChrome =
                (hasTopWall && pointer.rawY <= topPx) ||
                (hasBottomWall && pointer.rawY >= bottomPx) ||
                (hasLeftWall && pointer.rawX <= leftPx) ||
                (hasRightWall && pointer.rawX >= rightPx);

            // Relocate any target diamonds covered by the scrolling footer or navbar
            if (!collapsed) {
                for (let i = 0; i < targets.length; i++) {
                    if (!isInsideBounds(targets[i].x, targets[i].y)) {
                        targets[i] = spawnTarget(i);
                    }
                }
            }
            patrolGoal = clampCell(patrolGoal);
        };

        const initSnake = () => {
            segments.length = 0;
            targetLength = profile.baseLength;
            const startX = Math.max(
                bounds.minCol + 2,
                Math.min(bounds.maxCol - 1, Math.floor((bounds.minCol + bounds.maxCol) * 0.4))
            );
            const startY = Math.max(
                bounds.minRow,
                Math.min(bounds.maxRow, Math.floor(bounds.minRow + (bounds.maxRow - bounds.minRow) * 0.35))
            );
            for (let i = 0; i < profile.baseLength; i++) {
                segments.push({ x: Math.max(bounds.minCol, startX - i), y: startY });
            }
            prevTail = { ...segments[segments.length - 1] };
        };

        const resize = (forceSeed = false) => {
            const prevWidth = width;
            const prevHeight = height;

            width = window.innerWidth;
            height = window.innerHeight;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            cols = Math.max(6, Math.floor(width / CELL));
            rows = Math.max(5, Math.floor(height / CELL));
            offsetX = Math.floor((width - cols * CELL) / 2);
            offsetY = Math.floor((height - rows * CELL) / 2);
            profile = getViewportProfile(width);

            updateWallBounds();

            if (segments.length === 0) {
                initSnake();
                seedTargets();
                return;
            }

            // Trim snake smoothly when narrowing viewport to mobile
            targetLength = Math.min(profile.maxLength, Math.max(profile.baseLength, targetLength));
            while (segments.length > profile.maxLength) {
                segments.pop();
            }

            for (let i = 0; i < segments.length; i++) {
                segments[i] = clampCell(segments[i]);
            }
            prevTail = clampCell(prevTail);
            patrolGoal = clampCell(patrolGoal);

            // Avoid jittering targets on minor mobile browser address-bar height changes
            const majorResize =
                forceSeed ||
                Math.abs(width - prevWidth) > 24 ||
                Math.abs(height - prevHeight) > 140 ||
                targets.length !== profile.targetCount;
            if (majorResize) {
                seedTargets();
            }
        };

        resize(true);

        const pickNextStep = (now: number) => {
            if (bounds.collapsed) return;
            const head = segments[0];

            // 1. Check if scrolling pushed the snake head past a dynamic wall (footer scrolling up, etc.)
            const pastBottom = head.y > bounds.maxRow;
            const pastTop = head.y < bounds.minRow;
            const pastLeft = head.x < bounds.minCol;
            const pastRight = head.x > bounds.maxCol;

            if (pastBottom || pastTop || pastLeft || pastRight) {
                let escapeDir: GridCell;
                let wallHit: WallSide;

                if (pastBottom) {
                    escapeDir = { x: 0, y: -1 };
                    wallHit = 'bottom';
                } else if (pastTop) {
                    escapeDir = { x: 0, y: 1 };
                    wallHit = 'top';
                } else if (pastLeft) {
                    escapeDir = { x: 1, y: 0 };
                    wallHit = 'left';
                } else {
                    escapeDir = { x: -1, y: 0 };
                    wallHit = 'right';
                }

                emitWallImpact(wallHit, head.x, head.y, now);
                reboundImpulse = { dx: escapeDir.x, dy: escapeDir.y, stepsLeft: 3 };
                heading = escapeDir;

                const nextHead: GridCell = {
                    x: Math.max(bounds.minCol, Math.min(bounds.maxCol, head.x + heading.x)),
                    y: Math.max(bounds.minRow, Math.min(bounds.maxRow, head.y + heading.y))
                };
                prevTail = { ...segments[segments.length - 1] };
                segments.unshift(nextHead);
                if (segments.length > targetLength) segments.pop();
                return;
            }

            // 2. Detect direct head-on collision with Nav, Footer, Sidebar, or Viewport wall
            const aheadX = head.x + heading.x;
            const aheadY = head.y + heading.y;
            let hitWall: WallSide | null = null;
            if (aheadY < bounds.minRow) hitWall = 'top';
            else if (aheadY > bounds.maxRow) hitWall = 'bottom';
            else if (aheadX < bounds.minCol) hitWall = 'left';
            else if (aheadX > bounds.maxCol) hitWall = 'right';

            if (hitWall) {
                emitWallImpact(hitWall, head.x, head.y, now);
                reboundImpulse = {
                    dx: -heading.x,
                    dy: -heading.y,
                    stepsLeft: 3
                };
            }

            const isPointerFollowing =
                pointer.active &&
                now - pointer.lastMoveAt < IDLE_AFTER_MS &&
                !(pointer.inBlockedChrome && reboundImpulse !== null);

            let goal: GridCell;
            if (reboundImpulse && reboundImpulse.stepsLeft > 0) {
                goal = clampCell({
                    x: head.x + reboundImpulse.dx * 3,
                    y: head.y + reboundImpulse.dy * 3
                });
            } else if (isPointerFollowing) {
                goal = clampCell({ x: pointer.cellX, y: pointer.cellY });
            } else {
                // Calm autonomous geometric patrol toward nearest visible target node
                if (targets.length > 0) {
                    let bestTarget = targets[0];
                    let bestDist = Infinity;
                    for (const t of targets) {
                        const d = Math.abs(t.x - head.x) + Math.abs(t.y - head.y);
                        if (d < bestDist) {
                            bestDist = d;
                            bestTarget = t;
                        }
                    }
                    goal = clampCell({ x: bestTarget.x, y: bestTarget.y });
                } else {
                    if (Math.abs(head.x - patrolGoal.x) + Math.abs(head.y - patrolGoal.y) <= 1) {
                        patrolGoal = clampCell({
                            x: bounds.minCol + Math.floor(Math.random() * Math.max(1, bounds.maxCol - bounds.minCol + 1)),
                            y: bounds.minRow + Math.floor(Math.random() * Math.max(1, bounds.maxRow - bounds.minRow + 1))
                        });
                    }
                    goal = patrolGoal;
                }
            }

            const distToGoal = Math.abs(goal.x - head.x) + Math.abs(goal.y - head.y);
            const orbitingPointer = isPointerFollowing && !reboundImpulse && distToGoal <= 2;

            let bestDir: GridCell | null = null;
            let bestScore = Infinity;

            for (const d of DIRS) {
                if (d.x === -heading.x && d.y === -heading.y) continue;

                const nx = head.x + d.x;
                const ny = head.y + d.y;

                if (!isInsideBounds(nx, ny)) continue;

                const nextDist = Math.abs(goal.x - nx) + Math.abs(goal.y - ny);
                const sameAxis = d.x === heading.x && d.y === heading.y;

                let bodyPenalty = 0;
                for (let i = 1; i < segments.length - 1; i++) {
                    if (segments[i].x === nx && segments[i].y === ny) {
                        bodyPenalty = 14 - i * 0.35;
                        break;
                    }
                }

                const reboundBonus =
                    reboundImpulse && d.x === reboundImpulse.dx && d.y === reboundImpulse.dy
                        ? -7.5
                        : 0;

                let wallHugPenalty = 0;
                if (reboundImpulse) {
                    if (bounds.hasBottomWall && ny === bounds.maxRow) wallHugPenalty += 1.4;
                    if (bounds.hasTopWall && ny === bounds.minRow) wallHugPenalty += 1.4;
                }

                let score: number;
                if (orbitingPointer) {
                    const radiusErr = Math.abs(nextDist - 2) * 3.2;
                    score = radiusErr + bodyPenalty + (sameAxis ? -0.35 : 0.15);
                } else {
                    const axisBias = sameAxis ? -0.78 : 0;
                    score = nextDist + bodyPenalty + axisBias + reboundBonus + wallHugPenalty;
                }

                if (score < bestScore) {
                    bestScore = score;
                    bestDir = d;
                }
            }

            if (!bestDir) {
                const reverse = { x: -heading.x, y: -heading.y };
                if (isInsideBounds(head.x + reverse.x, head.y + reverse.y)) {
                    bestDir = reverse;
                } else {
                    bestDir = heading;
                }
            }

            if (reboundImpulse) {
                if (bestDir.x === reboundImpulse.dx && bestDir.y === reboundImpulse.dy) {
                    reboundImpulse.stepsLeft--;
                } else if (!hitWall) {
                    reboundImpulse.stepsLeft--;
                }
                if (reboundImpulse.stepsLeft <= 0) {
                    reboundImpulse = null;
                }
            }

            const turned = bestDir.x !== heading.x || bestDir.y !== heading.y;
            if (turned) {
                turnMarks.push({
                    x: head.x,
                    y: head.y,
                    bornAt: now,
                    color: hitWall === 'bottom' ? C_YELLOW : hitWall === 'top' ? C_LIME : isPointerFollowing ? C_LIME : C_YELLOW
                });
                if (turnMarks.length > 18) turnMarks.shift();
            }

            heading = bestDir;
            const nextHead: GridCell = clampCell({
                x: head.x + heading.x,
                y: head.y + heading.y
            });

            prevTail = { ...segments[segments.length - 1] };
            segments.unshift(nextHead);

            if (segments.length > targetLength) {
                segments.pop();
            }
            if (targetLength > profile.baseLength && Math.random() < 0.08) {
                targetLength--;
            }

            // Check geometric target node capture
            for (let i = 0; i < targets.length; i++) {
                const t = targets[i];
                if (t.x === nextHead.x && t.y === nextHead.y) {
                    ripples.push({
                        x: t.x,
                        y: t.y,
                        bornAt: now,
                        color: t.color
                    });
                    if (ripples.length > 8) ripples.shift();
                    pulseWave = 0;
                    targetLength = Math.min(profile.maxLength, targetLength + 1);
                    targets[i] = spawnTarget(i + Math.floor(now / 1000));
                    break;
                }
            }
        };

        const drawFrame = (now: number) => {
            ctx.clearRect(0, 0, width, height);

            // 1. Crisp architectural orthogonal grid (minor 44px + major 88px + registration crosshairs)
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(245, 243, 236, 0.052)';
            ctx.beginPath();
            for (let c = 0; c <= cols; c++) {
                if (c % 2 === 0) continue;
                const x = offsetX + c * CELL + 0.5;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            for (let r = 0; r <= rows; r++) {
                if (r % 2 === 0) continue;
                const y = offsetY + r * CELL + 0.5;
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();

            // Major structural lines every 2 cells (88px)
            ctx.strokeStyle = 'rgba(245, 243, 236, 0.09)';
            ctx.beginPath();
            for (let c = 0; c <= cols; c += 2) {
                const x = offsetX + c * CELL + 0.5;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            for (let r = 0; r <= rows; r += 2) {
                const y = offsetY + r * CELL + 0.5;
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();

            // Major coordinate crosshairs every 2 cells (88px)
            ctx.strokeStyle = 'rgba(245, 243, 236, 0.22)';
            ctx.beginPath();
            for (let c = 0; c <= cols; c += 2) {
                const x = offsetX + c * CELL + 0.5;
                for (let r = 0; r <= rows; r += 2) {
                    const y = offsetY + r * CELL + 0.5;
                    ctx.moveTo(x - 4, y);
                    ctx.lineTo(x + 4, y);
                    ctx.moveTo(x, y - 4);
                    ctx.lineTo(x, y + 4);
                }
            }
            ctx.stroke();

            if (bounds.collapsed) return;

            // 2. Responsive cursor grid cell corner brackets (desktop pointer only, inside open playfield)
            const pointerFresh =
                pointer.active &&
                pointer.showReticle &&
                !pointer.inBlockedChrome &&
                now - pointer.lastMoveAt < IDLE_AFTER_MS;
            if (pointerFresh) {
                const clampedPtr = clampCell({ x: pointer.cellX, y: pointer.cellY });
                const bx = offsetX + clampedPtr.x * CELL;
                const by = offsetY + clampedPtr.y * CELL;
                const arm = 8;
                ctx.strokeStyle = 'rgba(190, 242, 100, 0.52)';
                ctx.lineWidth = 1.75;
                ctx.beginPath();
                ctx.moveTo(bx + 2, by + 2 + arm);
                ctx.lineTo(bx + 2, by + 2);
                ctx.lineTo(bx + 2 + arm, by + 2);
                ctx.moveTo(bx + CELL - 2 - arm, by + 2);
                ctx.lineTo(bx + CELL - 2, by + 2);
                ctx.lineTo(bx + CELL - 2, by + 2 + arm);
                ctx.moveTo(bx + CELL - 2, by + CELL - 2 - arm);
                ctx.lineTo(bx + CELL - 2, by + CELL - 2);
                ctx.lineTo(bx + CELL - 2 - arm, by + CELL - 2);
                ctx.moveTo(bx + 2 + arm, by + CELL - 2);
                ctx.lineTo(bx + 2, by + CELL - 2);
                ctx.lineTo(bx + 2, by + CELL - 2 - arm);
                ctx.stroke();
            }

            // 3. 90-degree geometric corner wake marks
            for (let i = turnMarks.length - 1; i >= 0; i--) {
                const m = turnMarks[i];
                const age = (now - m.bornAt) / 1450;
                if (age >= 1) {
                    turnMarks.splice(i, 1);
                    continue;
                }
                const alpha = (1 - age) * 0.42;
                const mx = offsetX + m.x * CELL + 5;
                const my = offsetY + m.y * CELL + 5;
                const size = CELL - 10;
                ctx.strokeStyle = hexToRgba(m.color, alpha);
                ctx.lineWidth = 1.25;
                ctx.strokeRect(mx + 0.5, my + 0.5, size, size);
            }

            // 4. Minimalist collectible geometric target diamonds
            for (const t of targets) {
                const cx = toPxX(t.x);
                const cy = toPxY(t.y);
                const breathe = 0.5 + 0.5 * Math.sin(now * 0.0024 + t.phase);
                const r = (width < 640 ? 5.5 : 7) + breathe * 1.6;

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(Math.PI / 4);
                ctx.strokeStyle = hexToRgba(t.color, 0.52 + breathe * 0.25);
                ctx.lineWidth = 1.75;
                ctx.strokeRect(-r, -r, r * 2, r * 2);
                ctx.fillStyle = hexToRgba(t.color, 0.2 + breathe * 0.14);
                ctx.fillRect(-r, -r, r * 2, r * 2);
                ctx.restore();

                ctx.fillStyle = hexToRgba(t.color, 0.88);
                ctx.fillRect(cx - 2, cy - 2, 4, 4);
            }

            // 5. Crisp geometric square capture ripples
            for (let i = ripples.length - 1; i >= 0; i--) {
                const rp = ripples[i];
                const t = (now - rp.bornAt) / 780;
                if (t >= 1) {
                    ripples.splice(i, 1);
                    continue;
                }
                const eased = easeOutCubic(t);
                const half = 10 + eased * (CELL * 1.45);
                const cx = toPxX(rp.x);
                const cy = toPxY(rp.y);
                ctx.strokeStyle = hexToRgba(rp.color, (1 - t) * 0.62);
                ctx.lineWidth = 1.75;
                ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
            }

            // 5b. Tactile wall-rebound rails & geometric bounce sparks along Nav / Footer / Sidebar seam
            for (let i = wallImpacts.length - 1; i >= 0; i--) {
                const imp = wallImpacts[i];
                const t = (now - imp.bornAt) / 560;
                if (t >= 1) {
                    wallImpacts.splice(i, 1);
                    continue;
                }
                const eased = easeOutCubic(t);
                const alpha = (1 - t) * 0.92;
                const railHalf = 12 + eased * (width < 640 ? 24 : 36);
                const kick = 4 + eased * (width < 640 ? 18 : 24);

                ctx.fillStyle = hexToRgba(imp.color, alpha);
                if (imp.wall === 'top' || imp.wall === 'bottom') {
                    const normalY = imp.wall === 'top' ? 1 : -1;
                    const railY = imp.wall === 'top' ? imp.py + 1 : imp.py - 3.5;
                    ctx.fillRect(imp.px - railHalf, railY, railHalf * 2, 2.5);
                    const sparkAlpha = (1 - t) * 0.82;
                    ctx.fillStyle = hexToRgba(imp.color, sparkAlpha);
                    const spread = 8 + eased * (width < 640 ? 18 : 26);
                    ctx.fillRect(imp.px - 2, imp.py + normalY * kick - 2, 4, 4);
                    ctx.fillRect(imp.px - spread - 1.5, imp.py + normalY * (kick * 0.65) - 1.5, 3, 3);
                    ctx.fillRect(imp.px + spread - 1.5, imp.py + normalY * (kick * 0.65) - 1.5, 3, 3);
                } else {
                    const normalX = imp.wall === 'left' ? 1 : -1;
                    const railX = imp.wall === 'left' ? imp.px + 1 : imp.px - 3.5;
                    ctx.fillRect(railX, imp.py - railHalf, 2.5, railHalf * 2);
                    const sparkAlpha = (1 - t) * 0.82;
                    ctx.fillStyle = hexToRgba(imp.color, sparkAlpha);
                    const spread = 8 + eased * (width < 640 ? 18 : 26);
                    ctx.fillRect(imp.px + normalX * kick - 2, imp.py - 2, 4, 4);
                    ctx.fillRect(imp.px + normalX * (kick * 0.65) - 1.5, imp.py - spread - 1.5, 3, 3);
                    ctx.fillRect(imp.px + normalX * (kick * 0.65) - 1.5, imp.py + spread - 1.5, 3, 3);
                }
            }

            // 6. Interpolated geometric snake spine & articulated Bento blocks
            const easedStep = easeOutCubic(stepProgress);
            const pts: { x: number; y: number }[] = [];

            for (let i = 0; i < segments.length; i++) {
                const curr = segments[i];
                const prev = i === segments.length - 1 ? prevTail : segments[i + 1];
                const ix = prev.x + (curr.x - prev.x) * easedStep;
                const iy = prev.y + (curr.y - prev.y) * easedStep;
                pts.push({ x: toPxX(ix), y: toPxY(iy) });
            }

            if (pts.length >= 2) {
                ctx.lineCap = 'square';
                ctx.lineJoin = 'miter';
                for (let i = 0; i < pts.length - 1; i++) {
                    const ratio = i / (pts.length - 1);
                    const col = segmentColor(i, pts.length);
                    const alpha = Math.max(0.1, (1 - ratio) * 0.68);
                    ctx.strokeStyle = hexToRgba(col, alpha);
                    ctx.lineWidth = Math.max(1.5, 3.6 - ratio * 2.1);
                    ctx.beginPath();
                    ctx.moveTo(pts[i].x, pts[i].y);
                    ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
                    ctx.stroke();
                }
            }

            for (let i = pts.length - 1; i >= 0; i--) {
                const p = pts[i];
                const ratio = i / Math.max(1, pts.length - 1);
                const col = segmentColor(i, pts.length);
                const pulseBoost =
                    pulseWave >= 0 ? Math.max(0, 1 - Math.abs(i - pulseWave) * 0.45) : 0;

                const baseSize =
                    i === 0 ? profile.headSize : Math.max(7, profile.bodyStart - ratio * 8.5);
                const size = baseSize + pulseBoost * 4;
                const half = size * 0.5;

                if (i === 0) {
                    ctx.fillStyle = hexToRgba(C_LIME, 0.96);
                    ctx.fillRect(p.x - half, p.y - half, size, size);
                    ctx.strokeStyle = '#0a0908';
                    ctx.lineWidth = 1.75;
                    ctx.strokeRect(p.x - half, p.y - half, size, size);

                    const angle = Math.atan2(heading.y, heading.x);
                    const chevronScale = profile.headSize / 22;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(angle);
                    ctx.strokeStyle = '#0a0908';
                    ctx.lineWidth = 2.1;
                    ctx.lineCap = 'square';
                    ctx.lineJoin = 'miter';
                    ctx.beginPath();
                    ctx.moveTo(-3 * chevronScale, -4.5 * chevronScale);
                    ctx.lineTo(3.5 * chevronScale, 0);
                    ctx.lineTo(-3 * chevronScale, 4.5 * chevronScale);
                    ctx.stroke();
                    ctx.restore();
                } else {
                    const fillAlpha = Math.max(0.06, (1 - ratio) * 0.36 + pulseBoost * 0.32);
                    const strokeAlpha = Math.max(0.14, (1 - ratio) * 0.82 + pulseBoost * 0.25);

                    ctx.fillStyle = hexToRgba(col, fillAlpha);
                    ctx.fillRect(p.x - half, p.y - half, size, size);

                    ctx.strokeStyle = hexToRgba(col, strokeAlpha);
                    ctx.lineWidth = i < 6 ? 1.5 : 1.2;
                    ctx.strokeRect(p.x - half + 0.5, p.y - half + 0.5, size - 1, size - 1);
                }
            }
        };

        let rafId = 0;
        let lastTs = performance.now();

        const loop = (now: number) => {
            if (document.hidden) {
                lastTs = now;
                rafId = requestAnimationFrame(loop);
                return;
            }

            if (now - lastWallPollAt >= WALL_POLL_INTERVAL_MS) {
                lastWallPollAt = now;
                updateWallBounds();
            }

            const dt = Math.min(48, Math.max(0, now - lastTs));
            lastTs = now;

            const head = segments[0];
            const isFollowing = pointer.active && now - pointer.lastMoveAt < IDLE_AFTER_MS;
            const dist = isFollowing
                ? Math.abs(pointer.cellX - head.x) + Math.abs(pointer.cellY - head.y)
                : 6;

            const stepDurationMs =
                reboundImpulse ? 128 : dist > 9 ? 132 : dist <= 3 ? 205 : 165;

            stepProgress += dt / stepDurationMs;
            if (stepProgress >= 1) {
                stepProgress -= Math.floor(stepProgress);
                pickNextStep(now);
            }

            if (pulseWave >= 0) {
                pulseWave += dt * 0.022;
                if (pulseWave > segments.length + 2) {
                    pulseWave = -1;
                }
            }

            drawFrame(now);
            rafId = requestAnimationFrame(loop);
        };

        const updatePointerFromEvent = (e: PointerEvent, showReticle: boolean) => {
            const gx = Math.floor((e.clientX - offsetX) / CELL);
            const gy = Math.floor((e.clientY - offsetY) / CELL);
            pointer.active = true;
            pointer.showReticle = showReticle;
            pointer.rawX = e.clientX;
            pointer.rawY = e.clientY;
            pointer.inBlockedChrome =
                (bounds.hasTopWall && e.clientY <= bounds.topPx) ||
                (bounds.hasBottomWall && e.clientY >= bounds.bottomPx) ||
                (bounds.hasLeftWall && e.clientX <= bounds.leftPx) ||
                (bounds.hasRightWall && e.clientX >= bounds.rightPx);
            const clamped = clampCell({ x: gx, y: gy });
            pointer.cellX = clamped.x;
            pointer.cellY = clamped.y;
            pointer.lastMoveAt = performance.now();
        };

        const handlePointerMove = (e: PointerEvent) => {
            // Avoid sticky cursor brackets during mobile touch scrolling
            if (e.pointerType === 'touch') return;
            updatePointerFromEvent(e, true);
        };

        const handlePointerDown = (e: PointerEvent) => {
            if (e.pointerType === 'touch') {
                updatePointerFromEvent(e, false);
            }
        };

        const handlePointerLeave = () => {
            pointer.active = false;
            pointer.showReticle = false;
        };

        const handleScroll = () => {
            updateWallBounds();
            lastWallPollAt = performance.now();
        };

        const handleResize = () => {
            resize(false);
        };

        const handleMotionChange = (e: MediaQueryListEvent) => {
            reducedMotion = e.matches;
            cancelAnimationFrame(rafId);
            if (reducedMotion) {
                stepProgress = 1;
                drawFrame(performance.now());
            } else {
                lastTs = performance.now();
                rafId = requestAnimationFrame(loop);
            }
        };

        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        window.addEventListener('pointerdown', handlePointerDown, { passive: true });
        document.addEventListener('pointerleave', handlePointerLeave);
        window.addEventListener('resize', handleResize, { passive: true });
        window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
        reducedMotionQuery.addEventListener('change', handleMotionChange);

        if (reducedMotion) {
            stepProgress = 1;
            drawFrame(performance.now());
        } else {
            rafId = requestAnimationFrame(loop);
        }

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('pointerleave', handlePointerLeave);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll, { capture: true });
            reducedMotionQuery.removeEventListener('change', handleMotionChange);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 block w-full h-full"
            aria-hidden="true"
        />
    );
});

NoirGeometricSnakeCanvas.displayName = 'NoirGeometricSnakeCanvas';
