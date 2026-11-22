export type SnakeGameMode = 'hunt' | 'harvest';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface GridPoint {
    x: number;
    y: number;
}

export type HunterTier = 1 | 2 | 3;

export type FlankRole = 'cutoff' | 'left-pinch' | 'right-pinch' | 'tail-block';

export interface HunterSnake {
    id: number;
    tier: HunterTier;
    role: FlankRole;
    segments: GridPoint[];
    prevSegments: GridPoint[];
    dir: Direction;
    tickAccumulator: number;
    tickInterval: number; // ms per grid cell
    accent: string;
    headColor: string;
    spawnAge: number;
}

export type FoodKind = 'standard' | 'overcharge' | 'debris';

export type HarvestShapeId =
    | 'standard'
    | 'cross'
    | 'donut'
    | 'letterbox'
    | 'trench'
    | 'pillars'
    | 'diamond'
    | 'hourglass'
    | 'megagrid'
    | 'letter-s'
    | 'letter-h'
    | 'letter-c'
    | 'letter-t'
    | 'letter-x';

export type HarvestShapeDifficulty = 'easy' | 'medium' | 'hard';

export interface HarvestShapeMeta {
    id: HarvestShapeId;
    name: string;
    arName: string;
    difficulty: HarvestShapeDifficulty;
    baseDurationSec: number;
    targetZoom: number;
    accentColor: string;
    description: string;
    arDescription: string;
}

export const HARVEST_SHAPES: Record<HarvestShapeId, HarvestShapeMeta> = {
    standard: {
        id: 'standard',
        name: 'OPEN MATRIX',
        arName: 'المصفوفة المفتوحة',
        difficulty: 'easy',
        baseDurationSec: 26,
        targetZoom: 1.42,
        accentColor: '#bef264',
        description: 'Standard rectangular perimeter',
        arDescription: 'محيط مستطيل قياسي'
    },
    cross: {
        id: 'cross',
        name: 'CRUX QUADRANTS',
        arName: 'المحاور المتقاطعة',
        difficulty: 'medium',
        baseDurationSec: 18,
        targetZoom: 1.42,
        accentColor: '#fde047',
        description: 'Voided corner quadrants form a tactical plus cross',
        arDescription: 'زوايا محجوبة تشكل صليباً تكتيكياً'
    },
    donut: {
        id: 'donut',
        name: 'CORE SANCTUARY',
        arName: 'الحلقة المجوفة',
        difficulty: 'medium',
        baseDurationSec: 16,
        targetZoom: 1.42,
        accentColor: '#38bdf8',
        description: 'Hollow central barrier turns the grid into an orbital loop',
        arDescription: 'حاجز مركزي يحول الساحة إلى مدار دائري'
    },
    letterbox: {
        id: 'letterbox',
        name: 'LETTERBOX SLIT',
        arName: 'الشريط العريض',
        difficulty: 'hard',
        baseDurationSec: 13,
        targetZoom: 1.54,
        accentColor: '#fb7185',
        description: 'Constricted vertical clearance testing horizontal reflexes',
        arDescription: 'ارتفاع ضيق ومضغوط يختبر السرعة الأفقية'
    },
    trench: {
        id: 'trench',
        name: 'TWIN TRENCHES',
        arName: 'الخندقان التوأمان',
        difficulty: 'hard',
        baseDurationSec: 14,
        targetZoom: 1.42,
        accentColor: '#f43f5e',
        description: 'Dual vertical channels linked by narrow crossover bridges',
        arDescription: 'ممران رأسيان يربطهما جسور عبور ضيقة'
    },
    pillars: {
        id: 'pillars',
        name: 'FOUR MONOLITHS',
        arName: 'الأعمدة الأربعة',
        difficulty: 'medium',
        baseDurationSec: 17,
        targetZoom: 1.42,
        accentColor: '#e879f9',
        description: 'Four monolithic pylons create chicane chokepoints',
        arDescription: 'أربعة أعمدة ضخمة تصنع اختناقات حركية'
    },
    diamond: {
        id: 'diamond',
        name: 'OCTAGON VAULT',
        arName: 'القبة الثمانية',
        difficulty: 'medium',
        baseDurationSec: 16,
        targetZoom: 1.42,
        accentColor: '#34d399',
        description: 'Chamfered diagonal corners create a high-speed ring',
        arDescription: 'زوايا مشطوفة مائلة تمنح تدفقاً سريعاً'
    },
    hourglass: {
        id: 'hourglass',
        name: 'HOURGLASS CHOKE',
        arName: 'عنق الزجاجة',
        difficulty: 'hard',
        baseDurationSec: 12,
        targetZoom: 1.42,
        accentColor: '#f97316',
        description: 'Narrow center waist between two spacious chambers',
        arDescription: 'ممر وسطي ضيق يربط بين غرفتين واسعتين'
    },
    megagrid: {
        id: 'megagrid',
        name: 'MEGA EXPANSION',
        arName: 'التوسع العملاق',
        difficulty: 'hard',
        baseDurationSec: 24,
        targetZoom: 1.0,
        accentColor: '#a78bfa',
        description: 'Camera zooms out to reveal a sprawling high-capacity matrix',
        arDescription: 'زووم واسع يكشف مصفوفة هائلة على الشاشة كاملة'
    },
    'letter-s': {
        id: 'letter-s',
        name: 'GLYPH [S] // SERPENTINE',
        arName: 'حرف S // المسار الأفعواني',
        difficulty: 'hard',
        baseDurationSec: 14,
        targetZoom: 1.42,
        accentColor: '#10b981',
        description: 'Letter-S winding raceway with alternating corner chutes',
        arDescription: 'مسار متعرج على شكل حرف S بممرات تبادلية'
    },
    'letter-h': {
        id: 'letter-h',
        name: 'GLYPH [H] // TWIN TOWERS',
        arName: 'حرف H // البرجان التوأمان',
        difficulty: 'medium',
        baseDurationSec: 17,
        targetZoom: 1.42,
        accentColor: '#06b6d4',
        description: 'Letter-H dual columns connected by a central crossover bridge',
        arDescription: 'عمودان رأسيان متصلان بجسر أوسط على شكل حرف H'
    },
    'letter-c': {
        id: 'letter-c',
        name: 'GLYPH [C] // HORSESHOE',
        arName: 'حرف C // حدوة الفرس',
        difficulty: 'medium',
        baseDurationSec: 16,
        targetZoom: 1.42,
        accentColor: '#f59e0b',
        description: 'Letter-C arena with wide open right bay and perimeter loop',
        arDescription: 'محيط على شكل حرف C مع مدخل شرقي مفتوح'
    },
    'letter-t': {
        id: 'letter-t',
        name: 'GLYPH [T] // MONOLITH',
        arName: 'حرف T // العمود T',
        difficulty: 'medium',
        baseDurationSec: 16,
        targetZoom: 1.42,
        accentColor: '#ec4899',
        description: 'Letter-T crossbar roof with descending center vertical trunk',
        arDescription: 'سقف أفقي عريض مع جذع رأسي نازل على شكل حرف T'
    },
    'letter-x': {
        id: 'letter-x',
        name: 'GLYPH [X] // CROSS-NEXUS',
        arName: 'حرف X // التقاطع المتقاطع',
        difficulty: 'hard',
        baseDurationSec: 13,
        targetZoom: 1.42,
        accentColor: '#8b5cf6',
        description: 'Letter-X intersecting diagonal channels with 4 void notches',
        arDescription: 'قنوات قطرية متقاطعة في المركز على شكل حرف X'
    }
};

export type WeaponKind = 'railgun' | 'nova' | 'bolt';

export interface WeaponMeta {
    kind: WeaponKind;
    name: string;
    arName: string;
    shortTag: string;
    color: string;
}

export const WEAPON_META: Record<WeaponKind, WeaponMeta> = {
    railgun: {
        kind: 'railgun',
        name: 'RAIL BEAM',
        arName: 'شعاع ليزر',
        shortTag: 'RAIL',
        color: '#fb7185'
    },
    nova: {
        kind: 'nova',
        name: 'EMP NOVA',
        arName: 'موجة صدمة',
        shortTag: 'NOVA',
        color: '#fde047'
    },
    bolt: {
        kind: 'bolt',
        name: 'PLASMA LANCE',
        arName: 'رمح بلازما',
        shortTag: 'LANCE',
        color: '#bae6fd'
    }
};

export interface WeaponDrop {
    id: number;
    x: number;
    y: number;
    kind: WeaponKind;
    createdAt: number;
    expiresAt: number;
}

export interface WeaponBeamEffect {
    id: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    color: string;
    createdAt: number;
    duration: number;
}

export interface WeaponProjectile {
    id: number;
    worldX: number;
    worldY: number;
    dir: Direction;
    speedCellsPerSec: number;
    remainingCells: number;
    color: string;
    hitHunterIds: Set<number>;
    trail: Array<{ x: number; y: number }>;
}

export type EscapePatternKind =
    | 'straight-boost'
    | 'straight-run'
    | 'diagonal-kite'
    | 'loop-stall'
    | 'pause-abuse';

export interface ContainmentWall {
    id: number;
    cells: GridPoint[];
    pattern: EscapePatternKind;
    createdAt: number;
    armAt: number; // Telegraph warning until armAt, solid deadly barrier afterwards
    expiresAt: number;
    armedSoundPlayed: boolean;
}

export interface ContainmentAlert {
    pattern: EscapePatternKind;
    title: string;
    arTitle: string;
    timestamp: number;
}

export interface FoodNode {
    id: number;
    x: number;
    y: number;
    kind: FoodKind;
    xpValue: number;
    scoreValue: number;
    createdAt: number;
    expiresAt: number | null; // null = never expires
}

export interface FloatingPopup {
    id: number;
    worldX: number;
    worldY: number;
    text: string;
    color: string;
    createdAt: number;
    duration: number;
}

export interface ParticleBurst {
    id: number;
    worldX: number;
    worldY: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    createdAt: number;
    duration: number;
}

export interface LevelPulseRing {
    id: number;
    worldX: number;
    worldY: number;
    createdAt: number;
    duration: number;
    color: string;
    label?: string;
    maxRadiusCells?: number;
}

export interface HudSnapshot {
    mode: SnakeGameMode;
    status: 'menu' | 'playing' | 'paused' | 'gameover';
    score: number;
    elapsedSeconds: number;
    length: number;
    // In-run XP & Level
    runXp: number;
    runLevel: number;
    runLevelXp: number;
    runLevelNextXp: number;
    // Hunt-specific
    threatLevel: number;
    huntersAlive: number;
    takedowns: number;
    boostEnergy: number; // 0..100
    isBoosting: boolean;
    boostCooldownSec: number; // Remaining cooldown in seconds (0 = ready)
    boostCooldownRatio: number; // 0..1 (1 = full cooldown remaining)
    boostOverheated: boolean; // True during full burnout lockout
    heldWeapon: WeaponKind | null;
    weaponDropsOnMap: number;
    escapeRisk: number; // 0..100 anti-escape containment detection meter
    containmentAlert: ContainmentAlert | null;
    // Harvest-specific
    comboCount: number;
    comboMultiplier: number;
    comboTimeRatio: number; // 0..1
    harvestShape: HarvestShapeMeta;
    harvestNextShape: HarvestShapeMeta;
    harvestShapeRemainingSec: number;
    harvestShapeDurationSec: number;
    harvestIsShiftWarning: boolean;
    // Level-up banner flash
    levelUpNotice: { level: number; timestamp: number } | null;
    deathReason: 'hunter' | 'self' | 'border' | 'wall' | null;
    pauseReason: 'manual' | 'resize' | 'blur' | null;
}

export interface ArcadeProfile {
    totalArcadeXp: number;
    bestHuntSeconds: number;
    bestHuntScore: number;
    bestHuntTakedowns: number;
    bestHarvestScore: number;
    bestHarvestLength: number;
    runsPlayed: number;
    muted: boolean;
}

export interface RunSummary {
    mode: SnakeGameMode;
    score: number;
    elapsedSeconds: number;
    length: number;
    takedowns: number;
    runLevel: number;
    runXpEarned: number;
    isNewBest: boolean;
    deathReason: 'hunter' | 'self' | 'border' | 'wall' | null;
    previousTotalXp: number;
    newTotalXp: number;
}

export const ARCADE_PROFILE_KEY = 'noir_snake_arcade_profile_v1';

export const DEFAULT_ARCADE_PROFILE: ArcadeProfile = {
    totalArcadeXp: 0,
    bestHuntSeconds: 0,
    bestHuntScore: 0,
    bestHuntTakedowns: 0,
    bestHarvestScore: 0,
    bestHarvestLength: 0,
    runsPlayed: 0,
    muted: false
};

export function loadArcadeProfile(userKey?: string): ArcadeProfile {
    try {
        const key = userKey ? `${ARCADE_PROFILE_KEY}_${userKey}` : ARCADE_PROFILE_KEY;
        const raw = localStorage.getItem(key) || localStorage.getItem(ARCADE_PROFILE_KEY);
        if (!raw) return { ...DEFAULT_ARCADE_PROFILE };
        const parsed = JSON.parse(raw) as Partial<ArcadeProfile>;
        return {
            ...DEFAULT_ARCADE_PROFILE,
            ...parsed
        };
    } catch {
        return { ...DEFAULT_ARCADE_PROFILE };
    }
}

export function saveArcadeProfile(profile: ArcadeProfile, userKey?: string): void {
    try {
        const key = userKey ? `${ARCADE_PROFILE_KEY}_${userKey}` : ARCADE_PROFILE_KEY;
        localStorage.setItem(key, JSON.stringify(profile));
    } catch {
        // Ignore storage quota errors
    }
}

/**
 * Fast, rewarding in-run level progression curve:
 * Lv 1 -> 2: 80 XP
 * Lv 2 -> 3: 190 XP
 * Lv 3 -> 4: 316 XP
 */
export function getRunXpForLevelStep(level: number): number {
    return Math.round(80 * Math.pow(Math.max(1, level), 1.25));
}

export function computeRunLevelProgress(runXp: number): {
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
} {
    let level = 1;
    let remaining = Math.max(0, Math.floor(runXp));
    while (true) {
        const needed = getRunXpForLevelStep(level);
        if (remaining < needed) {
            return { level, currentLevelXp: remaining, nextLevelXp: needed };
        }
        remaining -= needed;
        level += 1;
        if (level >= 99) {
            return { level: 99, currentLevelXp: needed, nextLevelXp: needed };
        }
    }
}

/**
 * Cumulative persistent Arcade Rank progression across sessions.
 */
export function getArcadeRankInfo(totalArcadeXp: number): {
    rankLevel: number;
    title: string;
    arTitle: string;
    currentXp: number;
    nextXp: number;
    progressPct: number;
} {
    let rankLevel = 1;
    let remaining = Math.max(0, Math.floor(totalArcadeXp));
    while (true) {
        const needed = Math.round(180 * Math.pow(rankLevel, 1.3));
        if (remaining < needed) {
            const titleEntry = getRankTitle(rankLevel);
            return {
                rankLevel,
                title: titleEntry.en,
                arTitle: titleEntry.ar,
                currentXp: remaining,
                nextXp: needed,
                progressPct: Math.min(100, Math.round((remaining / needed) * 100))
            };
        }
        remaining -= needed;
        rankLevel += 1;
        if (rankLevel >= 50) {
            const titleEntry = getRankTitle(50);
            return {
                rankLevel: 50,
                title: titleEntry.en,
                arTitle: titleEntry.ar,
                currentXp: needed,
                nextXp: needed,
                progressPct: 100
            };
        }
    }
}

function getRankTitle(level: number): { en: string; ar: string } {
    if (level >= 20) return { en: 'Obsidian Sovereign', ar: 'سيد الأوبسيديان' };
    if (level >= 14) return { en: 'Apex Architect', ar: 'المعماري الأعلى' };
    if (level >= 10) return { en: 'Noir Phantom', ar: 'شبح النوار' };
    if (level >= 7) return { en: 'Vector Stalker', ar: 'صياد المسارات' };
    if (level >= 4) return { en: 'Shadow Weaver', ar: 'ناسج الظل' };
    if (level >= 2) return { en: 'Signal Runner', ar: 'عدّاء الإشارة' };
    return { en: 'Grid Drifter', ar: 'عابر الشبكة' };
}

export const DIR_VECTORS: Record<Direction, GridPoint> = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
};

export const OPPOSITE_DIR: Record<Direction, Direction> = {
    UP: 'DOWN',
    DOWN: 'UP',
    LEFT: 'RIGHT',
    RIGHT: 'LEFT'
};

export const ALL_DIRS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

export function pointKey(x: number, y: number): string {
    return `${x},${y}`;
}
