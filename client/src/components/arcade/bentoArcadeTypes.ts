export type BentoGameMode = 'smash' | 'dash';

export type BentoPowerupKind = 'xp' | 'wide' | 'multi' | 'heavy';

export type DashItemKind = 'magnet' | 'shield' | 'rocket' | 'shockwave' | 'slowmo';

export interface BentoHudSnapshot {
    mode: BentoGameMode;
    status: 'menu' | 'playing' | 'paused' | 'gameover';
    score: number;
    elapsedSeconds: number;
    // In-run XP & Level
    runXp: number;
    runLevel: number;
    runLevelXp: number;
    runLevelNextXp: number;
    // Smash-specific
    wave: number;
    lives: number;
    bricksRemaining: number;
    waitingForLaunch: boolean;
    activeBuffs: {
        wideSec: number;
        heavySec: number;
    };
    // Dash 3D-specific
    distanceMeters: number;
    coinsCollected: number;
    hasShield: boolean;
    speedMultiplier: number;
    gravityInverted: boolean;
    ultCharge: number;
    ultActiveSec: number;
    inventoryItems: DashItemKind[];
    activeDashBuffs: {
        magnetSec: number;
        rocketSec: number;
        slowmoSec: number;
    };
    enemiesDefeated: number;
    nearMissCount: number;
    // Shared combo / notices
    comboCount: number;
    comboMultiplier: number;
    levelUpNotice: { level: number; timestamp: number } | null;
    deathReason: 'lives' | 'fall' | 'obstacle' | 'enemy' | null;
    pauseReason: 'manual' | 'resize' | 'blur' | null;
}

export interface BentoArcadeProfile {
    totalArcadeXp: number;
    bestSmashScore: number;
    bestSmashWave: number;
    bestDashDistance: number;
    bestDashScore: number;
    runsPlayed: number;
    muted: boolean;
}

export interface BentoRunSummary {
    mode: BentoGameMode;
    score: number;
    elapsedSeconds: number;
    wave: number;
    distanceMeters: number;
    coinsCollected: number;
    runLevel: number;
    runXpEarned: number;
    isNewBest: boolean;
    deathReason: 'lives' | 'fall' | 'obstacle' | 'enemy' | null;
}

export const BENTO_ARCADE_PROFILE_KEY = 'bento_arcade_profile_v1';

export const DEFAULT_BENTO_PROFILE: BentoArcadeProfile = {
    totalArcadeXp: 0,
    bestSmashScore: 0,
    bestSmashWave: 1,
    bestDashDistance: 0,
    bestDashScore: 0,
    runsPlayed: 0,
    muted: false
};

export function loadBentoProfile(userKey?: string): BentoArcadeProfile {
    try {
        const key = userKey ? `${BENTO_ARCADE_PROFILE_KEY}_${userKey}` : BENTO_ARCADE_PROFILE_KEY;
        const raw = localStorage.getItem(key) || localStorage.getItem(BENTO_ARCADE_PROFILE_KEY);
        if (!raw) return { ...DEFAULT_BENTO_PROFILE };
        return { ...DEFAULT_BENTO_PROFILE, ...(JSON.parse(raw) as Partial<BentoArcadeProfile>) };
    } catch {
        return { ...DEFAULT_BENTO_PROFILE };
    }
}

export function saveBentoProfile(profile: BentoArcadeProfile, userKey?: string): void {
    try {
        const key = userKey ? `${BENTO_ARCADE_PROFILE_KEY}_${userKey}` : BENTO_ARCADE_PROFILE_KEY;
        localStorage.setItem(key, JSON.stringify(profile));
    } catch {
        // Ignore storage errors
    }
}

export function getBentoRunXpForLevel(level: number): number {
    return Math.round(90 * Math.pow(Math.max(1, level), 1.25));
}

export function computeBentoRunLevel(runXp: number): {
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
} {
    let level = 1;
    let remaining = Math.max(0, Math.floor(runXp));
    while (true) {
        const needed = getBentoRunXpForLevel(level);
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

export function getBentoRankInfo(totalXp: number): {
    rankLevel: number;
    title: string;
    arTitle: string;
    currentXp: number;
    nextXp: number;
    progressPct: number;
} {
    let rankLevel = 1;
    let remaining = Math.max(0, Math.floor(totalXp));
    while (true) {
        const needed = Math.round(180 * Math.pow(rankLevel, 1.3));
        if (remaining < needed) {
            const t = getBentoRankTitle(rankLevel);
            return {
                rankLevel,
                title: t.en,
                arTitle: t.ar,
                currentXp: remaining,
                nextXp: needed,
                progressPct: Math.min(100, Math.round((remaining / needed) * 100))
            };
        }
        remaining -= needed;
        rankLevel += 1;
        if (rankLevel >= 50) {
            const t = getBentoRankTitle(50);
            return {
                rankLevel: 50,
                title: t.en,
                arTitle: t.ar,
                currentXp: needed,
                nextXp: needed,
                progressPct: 100
            };
        }
    }
}

function getBentoRankTitle(level: number): { en: string; ar: string } {
    if (level >= 20) return { en: 'Studio Legend', ar: 'أسطورة الاستوديو' };
    if (level >= 14) return { en: 'Bento Architect', ar: 'معماري البينتو' };
    if (level >= 10) return { en: 'Brutalist Ace', ar: 'بطل البروتاليست' };
    if (level >= 7) return { en: 'Card Breaker', ar: 'محطم البطاقات' };
    if (level >= 4) return { en: 'Grid Maker', ar: 'صانع الشبكة' };
    if (level >= 2) return { en: 'Sticker Rookie', ar: 'جامع الاستيكرز' };
    return { en: 'Paper Intern', ar: 'متدرب الورق' };
}
