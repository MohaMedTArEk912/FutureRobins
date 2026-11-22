import {
    ALL_DIRS,
    DIR_VECTORS,
    OPPOSITE_DIR,
    pointKey,
    type Direction,
    type EscapePatternKind,
    type FlankRole,
    type GridPoint,
    type HunterSnake,
    type HunterTier
} from './noirSnakeTypes';

const FLANK_ROLES: FlankRole[] = ['cutoff', 'left-pinch', 'right-pinch', 'tail-block'];

/**
 * Escalates threat smoothly with survival time + player run level.
 * Higher threat means:
 * - More active hunter snakes simultaneously
 * - Faster hunter movement ticks
 * - Higher probability of Tier 2 (Interceptor) and Tier 3 (Pack Flanker) AI brains
 */
export function computeHuntEscalation(elapsedSeconds: number, runLevel: number) {
    const threatLevel = 1 + Math.floor(elapsedSeconds / 18) + Math.floor(Math.max(0, runLevel - 1) / 2);

    // Starts with 1 hunter, grows steadily up to 7 active hunters at intense late game
    const maxHunters = Math.min(7, 1 + Math.floor((elapsedSeconds + 6) / 16) + Math.floor((runLevel - 1) / 3));

    // Respawn cooldown tightens as threat escalates (ms)
    const spawnCooldownMs = Math.max(2600, 6200 - threatLevel * 420);

    return {
        threatLevel,
        maxHunters,
        spawnCooldownMs
    };
}

/**
 * Picks AI intelligence tier based on current Threat Level & how many hunters exist.
 */
export function pickHunterTier(threatLevel: number, existingHunters: HunterSnake[]): HunterTier {
    if (threatLevel <= 1) return 1;
    if (threatLevel === 2) {
        return existingHunters.some((h) => h.tier >= 2) ? 1 : 2;
    }
    const roll = Math.random();
    if (threatLevel >= 5) {
        if (roll < 0.55) return 3;
        if (roll < 0.9) return 2;
        return 1;
    }
    if (threatLevel >= 3) {
        if (roll < 0.35) return 3;
        if (roll < 0.8) return 2;
        return 1;
    }
    return roll < 0.6 ? 2 : 1;
}

export function getHunterVisuals(tier: HunterTier): { accent: string; headColor: string } {
    if (tier === 3) {
        return { accent: '#ef4444', headColor: '#fde047' }; // Crimson body + tactical gold head highlight
    }
    if (tier === 2) {
        return { accent: '#f97316', headColor: '#fed7aa' }; // Amber-orange interceptor
    }
    return { accent: '#fb7185', headColor: '#fda4af' }; // Rose seeker
}

/**
 * Computes hunter movement tick interval (ms/cell).
 * Player base tick is ~112ms (boost ~74ms), so Tier 1 starts forgiving (~172ms)
 * and Tier 3 at high threat gets genuinely tense (~104ms).
 */
export function getHunterTickInterval(tier: HunterTier, threatLevel: number): number {
    const baseByTier: Record<HunterTier, number> = {
        1: 170,
        2: 145,
        3: 126
    };
    const threatSpeedup = Math.min(34, (threatLevel - 1) * 4.5);
    return Math.max(96, Math.round(baseByTier[tier] - threatSpeedup));
}

/**
 * Spawns a new AI hunter snake just outside the visible viewport ring around the player
 * so the player always has time to see the off-screen chevron warning and react.
 */
export function createHunterSnake(params: {
    id: number;
    playerHead: GridPoint;
    viewportHalfCols: number;
    viewportHalfRows: number;
    threatLevel: number;
    existingHunters: HunterSnake[];
    occupied: Set<string>;
}): HunterSnake | null {
    const { id, playerHead, viewportHalfCols, viewportHalfRows, threatLevel, existingHunters, occupied } = params;

    const tier = pickHunterTier(threatLevel, existingHunters);
    const visuals = getHunterVisuals(tier);
    const length = Math.min(11, 5 + tier + Math.floor(threatLevel / 3));
    const role = FLANK_ROLES[existingHunters.length % FLANK_ROLES.length];

    const minDistX = Math.max(10, Math.ceil(viewportHalfCols) + 3);
    const minDistY = Math.max(9, Math.ceil(viewportHalfRows) + 3);

    for (let attempt = 0; attempt < 24; attempt++) {
        const edge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
        let headX = playerHead.x;
        let headY = playerHead.y;
        let dir: Direction = 'RIGHT';

        if (edge === 0) {
            headX = playerHead.x + Math.floor((Math.random() * 2 - 1) * minDistX);
            headY = playerHead.y - minDistY - Math.floor(Math.random() * 4);
            dir = 'DOWN';
        } else if (edge === 1) {
            headX = playerHead.x + minDistX + Math.floor(Math.random() * 4);
            headY = playerHead.y + Math.floor((Math.random() * 2 - 1) * minDistY);
            dir = 'LEFT';
        } else if (edge === 2) {
            headX = playerHead.x + Math.floor((Math.random() * 2 - 1) * minDistX);
            headY = playerHead.y + minDistY + Math.floor(Math.random() * 4);
            dir = 'UP';
        } else {
            headX = playerHead.x - minDistX - Math.floor(Math.random() * 4);
            headY = playerHead.y + Math.floor((Math.random() * 2 - 1) * minDistY);
            dir = 'RIGHT';
        }

        const oppVec = DIR_VECTORS[OPPOSITE_DIR[dir]];
        const segments: GridPoint[] = [];
        let blocked = false;
        for (let i = 0; i < length; i++) {
            const sx = headX + oppVec.x * i;
            const sy = headY + oppVec.y * i;
            if (occupied.has(pointKey(sx, sy))) {
                blocked = true;
                break;
            }
            segments.push({ x: sx, y: sy });
        }

        if (!blocked) {
            return {
                id,
                tier,
                role,
                segments,
                prevSegments: segments.map((s) => ({ ...s })),
                dir,
                tickAccumulator: 0,
                tickInterval: getHunterTickInterval(tier, threatLevel),
                accent: visuals.accent,
                headColor: visuals.headColor,
                spawnAge: 0
            };
        }
    }

    return null;
}

export interface PlayerStepRecord {
    x: number;
    y: number;
    dir: Direction;
    boosting: boolean;
}

export interface EscapeEvaluation {
    riskDelta: number;
    detectedPattern: EscapePatternKind | null;
    diagonalSign?: { dx: number; dy: number };
    loopCenter?: GridPoint;
}

/**
 * Multi-signal Anti-Escape & Defect Detection algorithm.
 * Detects:
 * 1. Straight-line boost sprinting (`straight-boost`)
 * 2. Prolonged straight-line fleeing (`straight-run`)
 * 3. Diagonal staircase / zig-zag kiting (`diagonal-kite`)
 * 4. Tight-loop / box-stalling cheese (`loop-stall`)
 */
export function evaluateEscapePattern(params: {
    history: PlayerStepRecord[];
    straightSteps: number;
    boostStraightSteps: number;
}): EscapeEvaluation {
    const { history, straightSteps, boostStraightSteps } = params;
    const len = history.length;
    if (len < 6) {
        return { riskDelta: -3, detectedPattern: null };
    }

    // 1. Straight-line boost escape: rapid lock-on after 6+ straight boost steps
    if (boostStraightSteps >= 6) {
        return { riskDelta: 22, detectedPattern: 'straight-boost' };
    }

    // 2. Sustained straight-line fleeing (or >86% single-axis displacement over last 18 moves)
    if (straightSteps >= 11) {
        return { riskDelta: 15, detectedPattern: 'straight-run' };
    }

    if (len >= 18) {
        const recent18 = history.slice(-18);
        const first = recent18[0];
        const last = recent18[recent18.length - 1];
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const maxAxis = Math.max(absDx, absDy);
        const minAxis = Math.min(absDx, absDy);
        const boostCount = recent18.filter((s) => s.boosting).length;

        // Mostly straight corridor with tiny 1-2 cell jukes to try dodging naive straight detectors
        if (maxAxis >= 14 && minAxis <= 2) {
            return {
                riskDelta: boostCount >= 4 ? 19 : 13,
                detectedPattern: boostCount >= 4 ? 'straight-boost' : 'straight-run'
            };
        }

        // 3. Diagonal staircase / 2-direction zig-zag kiting
        const dirSet = new Set(recent18.map((s) => s.dir));
        const manhattan = absDx + absDy;
        if (dirSet.size === 2 && manhattan >= 14 && absDx >= 5 && absDy >= 5) {
            return {
                riskDelta: 15,
                detectedPattern: 'diagonal-kite',
                diagonalSign: { dx: Math.sign(dx) || 1, dy: Math.sign(dy) || 1 }
            };
        }
    }

    // 4. Tight-loop / box-stall cheese detector (staying trapped in a tiny area to farm survival clock)
    if (len >= 24) {
        const recent24 = history.slice(-24);
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const p of recent24) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        if (maxX - minX <= 6 && maxY - minY <= 6) {
            return {
                riskDelta: 14,
                detectedPattern: 'loop-stall',
                loopCenter: {
                    x: Math.round((minX + maxX) / 2),
                    y: Math.round((minY + maxY) / 2)
                }
            };
        }
    }

    // Partial ramp when building a straight streak (gives player real-time feedback on LOCK meter)
    if (boostStraightSteps >= 3) {
        return { riskDelta: 11, detectedPattern: null };
    }
    if (straightSteps >= 6) {
        return { riskDelta: 5.5, detectedPattern: null };
    }

    // Active varied movement naturally cools down escape risk
    return { riskDelta: -5, detectedPattern: null };
}

/**
 * Generates containment barrier cells placed ahead of (or boxing in) an escaping player.
 * Always leaves safe swerve space & telegraphs before arming so skilled players can react.
 */
export function buildContainmentWallCells(params: {
    pattern: EscapePatternKind;
    playerHead: GridPoint;
    playerDir: Direction;
    occupied: Set<string>;
    diagonalSign?: { dx: number; dy: number };
    loopCenter?: GridPoint;
}): GridPoint[] {
    const { pattern, playerHead, playerDir, occupied, diagonalSign, loopCenter } = params;
    const cells: GridPoint[] = [];
    const seen = new Set<string>();
    const addCell = (x: number, y: number) => {
        const key = pointKey(x, y);
        if (seen.has(key) || occupied.has(key)) return;
        // Never spawn a wall cell closer than 3 Manhattan cells from player head
        if (Math.abs(x - playerHead.x) + Math.abs(y - playerHead.y) < 3) return;
        seen.add(key);
        cells.push({ x, y });
    };

    const vec = DIR_VECTORS[playerDir];
    const perp = { x: -vec.y, y: vec.x };

    if (pattern === 'diagonal-kite' && diagonalSign) {
        // L-shaped corner blocker directly across the player's 45-degree escape cone
        const cornerX = playerHead.x + diagonalSign.dx * 6;
        const cornerY = playerHead.y + diagonalSign.dy * 6;
        for (let i = 0; i <= 6; i++) {
            addCell(cornerX - diagonalSign.dx * i, cornerY);
            addCell(cornerX, cornerY - diagonalSign.dy * i);
        }
        return cells;
    }

    if (pattern === 'loop-stall' && loopCenter) {
        // 3-sided Containment Clamp boxing the stall loop while leaving an ambush exit
        const radius = 5;
        const openDir = playerDir;
        for (let offset = -radius; offset <= radius; offset++) {
            if (openDir !== 'UP') addCell(loopCenter.x + offset, loopCenter.y - radius);
            if (openDir !== 'DOWN') addCell(loopCenter.x + offset, loopCenter.y + radius);
            if (openDir !== 'LEFT') addCell(loopCenter.x - radius, loopCenter.y + offset);
            if (openDir !== 'RIGHT') addCell(loopCenter.x + radius, loopCenter.y + offset);
        }
        return cells;
    }

    // Default: Straight-boost, Straight-run, or Pause-abuse -> Funnel firewall directly ahead!
    const distAhead = pattern === 'straight-boost' ? 9 : 7;
    const halfWidth = pattern === 'straight-boost' ? 4 : 3;
    const cx = playerHead.x + vec.x * distAhead;
    const cy = playerHead.y + vec.y * distAhead;

    // Solid perpendicular main wall
    for (let w = -halfWidth; w <= halfWidth; w++) {
        addCell(cx + perp.x * w, cy + perp.y * w);
    }

    // Short curved funnel wings curving 2 cells back on both ends to punish lazy 1-cell sidesteps
    for (let wing = 1; wing <= 2; wing++) {
        addCell(cx + perp.x * halfWidth - vec.x * wing, cy + perp.y * halfWidth - vec.y * wing);
        addCell(cx - perp.x * halfWidth - vec.x * wing, cy - perp.y * halfWidth - vec.y * wing);
    }

    return cells;
}

/**
 * Spawns an aggressive Interceptor Hunter Snake directly flanking the containment barrier
 * so the player cannot simply skirt around the wall without facing an active threat.
 */
export function createAmbushHunterSnake(params: {
    id: number;
    playerHead: GridPoint;
    playerDir: Direction;
    threatLevel: number;
    occupied: Set<string>;
    preferFlankSign?: 1 | -1;
}): HunterSnake | null {
    const { id, playerHead, playerDir, threatLevel, occupied, preferFlankSign } = params;
    const tier: HunterTier = threatLevel >= 3 ? 3 : 2;
    const visuals = getHunterVisuals(tier);
    const length = Math.min(9, 5 + tier);
    const vec = DIR_VECTORS[playerDir];
    const perp = { x: -vec.y, y: vec.x };
    const flankSigns: Array<1 | -1> = preferFlankSign
        ? [preferFlankSign, (preferFlankSign * -1) as 1 | -1]
        : Math.random() < 0.5
            ? [1, -1]
            : [-1, 1];

    // Try spawning slightly ahead + off to a flank of the wall, pointing inward to intercept the swerve
    const candidateOffsets: Array<{ ahead: number; side: number; dir: Direction }> = [];
    for (const sign of flankSigns) {
        const inwardDir: Direction =
            perp.x * sign > 0
                ? 'LEFT'
                : perp.x * sign < 0
                    ? 'RIGHT'
                    : perp.y * sign > 0
                        ? 'UP'
                        : 'DOWN';
        const headOnDir = OPPOSITE_DIR[playerDir];
        candidateOffsets.push(
            { ahead: 9, side: 6 * sign, dir: inwardDir },
            { ahead: 11, side: 5 * sign, dir: inwardDir },
            { ahead: 12, side: 2 * sign, dir: headOnDir },
            { ahead: 7, side: 7 * sign, dir: inwardDir }
        );
    }

    for (const cand of candidateOffsets) {
        const headX = playerHead.x + vec.x * cand.ahead + perp.x * cand.side;
        const headY = playerHead.y + vec.y * cand.ahead + perp.y * cand.side;
        const oppVec = DIR_VECTORS[OPPOSITE_DIR[cand.dir]];
        const segments: GridPoint[] = [];
        let blocked = false;
        for (let i = 0; i < length; i++) {
            const sx = headX + oppVec.x * i;
            const sy = headY + oppVec.y * i;
            if (occupied.has(pointKey(sx, sy))) {
                blocked = true;
                break;
            }
            segments.push({ x: sx, y: sy });
        }
        if (!blocked) {
            return {
                id,
                tier,
                role: cand.side >= 0 ? 'left-pinch' : 'right-pinch',
                segments,
                prevSegments: segments.map((s) => ({ ...s })),
                dir: cand.dir,
                tickAccumulator: 0,
                tickInterval: Math.max(92, getHunterTickInterval(tier, threatLevel) - 8),
                accent: visuals.accent,
                headColor: visuals.headColor,
                spawnAge: 0
            };
        }
    }

    return null;
}

/**
 * Counts how many reachable open cells exist from (startX, startY) up to `limit`.
 * Prevents Tier 2 & Tier 3 hunters from driving blindly into dead-end coils.
 */
function countOpenSpace(start: GridPoint, blocked: Set<string>, limit: number): number {
    const visited = new Set<string>([pointKey(start.x, start.y)]);
    const queue: GridPoint[] = [start];
    let headIdx = 0;

    while (headIdx < queue.length && visited.size < limit) {
        const cur = queue[headIdx++];
        for (const d of ALL_DIRS) {
            const v = DIR_VECTORS[d];
            const nx = cur.x + v.x;
            const ny = cur.y + v.y;
            const key = pointKey(nx, ny);
            if (!visited.has(key) && !blocked.has(key)) {
                visited.add(key);
                queue.push({ x: nx, y: ny });
            }
        }
    }
    return visited.size;
}

/**
 * Bounded BFS first-step lookup to route around player/other-hunter snake bodies smoothly.
 */
function bfsFirstStep(
    start: GridPoint,
    target: GridPoint,
    allowedFirstDirs: Direction[],
    blocked: Set<string>,
    maxNodes: number
): Direction | null {
    interface Node {
        x: number;
        y: number;
        firstDir: Direction;
    }

    const visited = new Set<string>([pointKey(start.x, start.y)]);
    const queue: Node[] = [];

    for (const d of allowedFirstDirs) {
        const v = DIR_VECTORS[d];
        const nx = start.x + v.x;
        const ny = start.y + v.y;
        const key = pointKey(nx, ny);
        if (blocked.has(key)) continue;
        if (nx === target.x && ny === target.y) return d;
        visited.add(key);
        queue.push({ x: nx, y: ny, firstDir: d });
    }

    let bestDir: Direction | null = null;
    let bestDist = Infinity;
    let idx = 0;

    while (idx < queue.length && visited.size < maxNodes) {
        const cur = queue[idx++];
        const dist = Math.abs(cur.x - target.x) + Math.abs(cur.y - target.y);
        if (dist < bestDist) {
            bestDist = dist;
            bestDir = cur.firstDir;
        }
        if (dist <= 1) {
            return cur.firstDir;
        }

        for (const d of ALL_DIRS) {
            const v = DIR_VECTORS[d];
            const nx = cur.x + v.x;
            const ny = cur.y + v.y;
            const key = pointKey(nx, ny);
            if (!visited.has(key) && !blocked.has(key)) {
                visited.add(key);
                queue.push({ x: nx, y: ny, firstDir: cur.firstDir });
            }
        }
    }

    return bestDir;
}

/**
 * Computes the target cell for a hunter snake depending on its AI tier and flanking role.
 */
function computeTargetPoint(
    hunter: HunterSnake,
    playerHead: GridPoint,
    playerDir: Direction,
    playerLength: number
): GridPoint {
    const pv = DIR_VECTORS[playerDir];
    const head = hunter.segments[0];
    const manhattan = Math.abs(head.x - playerHead.x) + Math.abs(head.y - playerHead.y);

    // When very close (<= 3 cells), every hunter lunges directly for the intercept/kill
    if (manhattan <= 3) {
        return { x: playerHead.x + pv.x, y: playerHead.y + pv.y };
    }

    // Tier 1: Direct pursuit toward player's current head
    if (hunter.tier === 1) {
        return { x: playerHead.x, y: playerHead.y };
    }

    // Tier 2: Predictive intercept along player's velocity vector
    if (hunter.tier === 2) {
        const lead = Math.min(6, Math.max(2, Math.floor(manhattan * 0.35)));
        return {
            x: playerHead.x + pv.x * lead,
            y: playerHead.y + pv.y * lead
        };
    }

    // Tier 3: Coordinated Pack Flanker (pincer roles around player)
    const perpLeft = { x: -pv.y, y: pv.x };
    const perpRight = { x: pv.y, y: -pv.x };
    const lead = Math.min(7, Math.max(3, Math.floor(manhattan * 0.42)));

    switch (hunter.role) {
        case 'cutoff':
            return {
                x: playerHead.x + pv.x * (lead + 2),
                y: playerHead.y + pv.y * (lead + 2)
            };
        case 'left-pinch':
            return {
                x: playerHead.x + pv.x * lead + perpLeft.x * 3,
                y: playerHead.y + pv.y * lead + perpLeft.y * 3
            };
        case 'right-pinch':
            return {
                x: playerHead.x + pv.x * lead + perpRight.x * 3,
                y: playerHead.y + pv.y * lead + perpRight.y * 3
            };
        case 'tail-block': {
            const backOffset = Math.min(4, Math.max(2, Math.floor(playerLength / 4)));
            return {
                x: playerHead.x - pv.x * backOffset + perpLeft.x * 2,
                y: playerHead.y - pv.y * backOffset + perpLeft.y * 2
            };
        }
    }
}

/**
 * Decides the hunter's next orthogonal direction.
 * Notice: The player's HEAD is deliberately NOT marked as a deadly obstacle for the hunter
 * (the hunter WANTS to hit the player head), whereas the player's BODY and all hunter bodies
 * ARE treated as obstacles so smarter hunters avoid suiciding into bodies unless baited tightly!
 */
export function decideHunterDirection(params: {
    hunter: HunterSnake;
    playerSegments: GridPoint[];
    playerDir: Direction;
    allHunters: HunterSnake[];
    blockedWallKeys?: Set<string>;
}): Direction {
    const { hunter, playerSegments, playerDir, allHunters, blockedWallKeys } = params;
    const head = hunter.segments[0];
    const playerHead = playerSegments[0];

    // Candidate non-reversing directions
    const candidateDirs = ALL_DIRS.filter((d) => d !== OPPOSITE_DIR[hunter.dir]);

    // Build obstacle set: player body (excluding player head), hunter bodies, and armed containment walls
    const blocked = new Set<string>();
    if (blockedWallKeys) {
        for (const k of blockedWallKeys) blocked.add(k);
    }
    for (let i = 1; i < playerSegments.length; i++) {
        blocked.add(pointKey(playerSegments[i].x, playerSegments[i].y));
    }
    for (const other of allHunters) {
        const limit = other.segments.length - 1;
        for (let i = 0; i < limit; i++) {
            if (other.id === hunter.id && i === 0) continue;
            blocked.add(pointKey(other.segments[i].x, other.segments[i].y));
        }
    }

    const safeDirs = candidateDirs.filter((d) => {
        const v = DIR_VECTORS[d];
        return !blocked.has(pointKey(head.x + v.x, head.y + v.y));
    });

    // If completely boxed in by player/other snakes, keep heading (will shatter into XP debris!)
    if (safeDirs.length === 0) {
        return hunter.dir;
    }
    if (safeDirs.length === 1) {
        return safeDirs[0];
    }

    const target = computeTargetPoint(hunter, playerHead, playerDir, playerSegments.length);

    // Tier 1: Fast greedy chase with slight natural imperfection (10% drift) so early game feels fair
    if (hunter.tier === 1) {
        if (Math.random() < 0.1) {
            return safeDirs[Math.floor(Math.random() * safeDirs.length)];
        }
        let bestDir = safeDirs[0];
        let bestDist = Infinity;
        for (const d of safeDirs) {
            const v = DIR_VECTORS[d];
            const nx = head.x + v.x;
            const ny = head.y + v.y;
            const dist = Math.abs(nx - target.x) + Math.abs(ny - target.y);
            // Small straight-line bias so hunters look sleek rather than zigzagging
            const straightBonus = d === hunter.dir ? -0.15 : 0;
            if (dist + straightBonus < bestDist) {
                bestDist = dist + straightBonus;
                bestDir = d;
            }
        }
        return bestDir;
    }

    // Tier 2 & Tier 3: Bounded BFS pathfinding around snake bodies + space awareness check
    const bfsBudget = hunter.tier === 3 ? 110 : 55;
    const bfsDir = bfsFirstStep(head, target, safeDirs, blocked, bfsBudget);

    // Evaluate candidate directions with combined target distance + open space safety
    let chosenDir = bfsDir || safeDirs[0];
    let bestScore = -Infinity;

    for (const d of safeDirs) {
        const v = DIR_VECTORS[d];
        const nextPt = { x: head.x + v.x, y: head.y + v.y };
        const dist = Math.abs(nextPt.x - target.x) + Math.abs(nextPt.y - target.y);
        const spaceCheckLimit = hunter.tier === 3 ? 18 : 10;
        const openSpace = countOpenSpace(nextPt, blocked, spaceCheckLimit);

        // Penalize tight pockets so smart hunters are harder to casually trap (still baitable!)
        const spacePenalty = openSpace < 6 ? -40 : openSpace < 10 ? -12 : 0;
        const bfsBonus = d === bfsDir ? 6.5 : 0;
        const straightBonus = d === hunter.dir ? 0.35 : 0;

        const score = -dist * 1.4 + bfsBonus + spacePenalty + straightBonus;
        if (score > bestScore) {
            bestScore = score;
            chosenDir = d;
        }
    }

    return chosenDir;
}
