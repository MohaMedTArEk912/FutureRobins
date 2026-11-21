import {
    ALL_DIRS,
    DIR_VECTORS,
    OPPOSITE_DIR,
    pointKey,
    type Direction,
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
}): Direction {
    const { hunter, playerSegments, playerDir, allHunters } = params;
    const head = hunter.segments[0];
    const playerHead = playerSegments[0];

    // Candidate non-reversing directions
    const candidateDirs = ALL_DIRS.filter((d) => d !== OPPOSITE_DIR[hunter.dir]);

    // Build obstacle set: player body (excluding player head), plus all hunter bodies (excluding moving tails)
    const blocked = new Set<string>();
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
