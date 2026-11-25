import type { AvatarConfig } from '../types';

export type MascotGender = 'male' | 'female';
export type LastLoginMethod = 'email' | 'google';

const MASCOT_GENDER_KEY = 'future_robins_mascot_gender';
const MASCOT_GENDER_COOKIE = 'fr_mascot_gender';

const AVATAR_IDENTITY_KEY = 'future_robins_avatar_identity';
const AVATAR_IDENTITY_COOKIE = 'fr_avatar_identity';

const LAST_LOGIN_METHOD_KEY = 'future_robins_last_login_method';
const LAST_LOGIN_METHOD_COOKIE = 'fr_last_login_method';

const LAST_LOGIN_EMAIL_KEY = 'future_robins_last_login_email';
const LAST_LOGIN_EMAIL_COOKIE = 'fr_last_login_email';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    try {
        const prefix = `${encodeURIComponent(name)}=`;
        const parts = document.cookie ? document.cookie.split('; ') : [];
        for (const part of parts) {
            if (part.startsWith(prefix)) {
                return decodeURIComponent(part.slice(prefix.length));
            }
        }
    } catch {
        // Ignore cookie parsing errors
    }
    return null;
}

function writeCookie(name: string, value: string, maxAgeSeconds = ONE_YEAR_SECONDS): void {
    if (typeof document === 'undefined') return;
    try {
        const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
        const secureAttr = isHttps ? '; Secure' : '';
        document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secureAttr}`;
    } catch {
        // Ignore cookie write restrictions
    }
}

function readLocal(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeLocal(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Ignore storage restrictions
    }
}

export function hasStoredMascotGender(): boolean {
    const cookieVal = readCookie(MASCOT_GENDER_COOKIE);
    if (cookieVal === 'female' || cookieVal === 'male') {
        return true;
    }

    const localVal = readLocal(MASCOT_GENDER_KEY);
    return localVal === 'female' || localVal === 'male';
}

export function getStoredMascotGender(): MascotGender {
    const cookieVal = readCookie(MASCOT_GENDER_COOKIE);
    if (cookieVal === 'female' || cookieVal === 'male') {
        writeLocal(MASCOT_GENDER_KEY, cookieVal);
        return cookieVal;
    }

    const localVal = readLocal(MASCOT_GENDER_KEY);
    if (localVal === 'female' || localVal === 'male') {
        writeCookie(MASCOT_GENDER_COOKIE, localVal);
        return localVal;
    }

    return 'male';
}

export function setStoredMascotGender(gender?: string | null): void {
    if (gender !== 'male' && gender !== 'female') return;
    writeCookie(MASCOT_GENDER_COOKIE, gender);
    writeLocal(MASCOT_GENDER_KEY, gender);
}

const VALID_MOODS = new Set(['happy', 'neutral', 'cool', 'excited']);
const VALID_CLOTHING = new Set(['shirt', 'hoodie', 'blazer', 'dress', 'tshirt', 'jacket', 'sweater', 'tank', 'jersey', 'kimono', 'astronaut', 'varsity']);
const VALID_BOTTOMS = new Set(['jeans', 'joggers', 'shorts', 'cargo', 'skirt', 'chinos']);
const VALID_SHOES = new Set(['sneakers', 'high_tops', 'boots', 'cleats', 'loafers', 'slides']);
const VALID_FRAMES = new Set(['none', 'gold', 'diamond', 'cyberpunk']);

function normalizeStoredAvatar(raw: unknown): AvatarConfig | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    const gender = obj.gender === 'female' ? 'female' : obj.gender === 'male' ? 'male' : null;
    if (!gender && typeof obj.skinColor !== 'string' && typeof obj.hairStyle !== 'string') {
        return null;
    }

    const mood = typeof obj.mood === 'string' && VALID_MOODS.has(obj.mood)
        ? (obj.mood as AvatarConfig['mood'])
        : 'happy';
    const clothing = typeof obj.clothing === 'string' && VALID_CLOTHING.has(obj.clothing)
        ? (obj.clothing as AvatarConfig['clothing'])
        : 'shirt';
    const bottoms = typeof obj.bottoms === 'string' && VALID_BOTTOMS.has(obj.bottoms)
        ? (obj.bottoms as AvatarConfig['bottoms'])
        : 'jeans';
    const shoes = typeof obj.shoes === 'string' && VALID_SHOES.has(obj.shoes)
        ? (obj.shoes as AvatarConfig['shoes'])
        : 'sneakers';
    const frame = typeof obj.frame === 'string' && VALID_FRAMES.has(obj.frame)
        ? (obj.frame as AvatarConfig['frame'])
        : 'none';

    return {
        skinColor: typeof obj.skinColor === 'string' && obj.skinColor ? obj.skinColor : '#F5D0C5',
        hairStyle: typeof obj.hairStyle === 'string' && obj.hairStyle ? obj.hairStyle : 'short',
        hairColor: typeof obj.hairColor === 'string' && obj.hairColor ? obj.hairColor : '#4A3728',
        accessory: typeof obj.accessory === 'string' && obj.accessory ? obj.accessory : 'none',
        backgroundColor: typeof obj.backgroundColor === 'string' && obj.backgroundColor ? obj.backgroundColor : 'bg-indigo-100',
        mood,
        gender: gender || 'male',
        clothing,
        outfitColor: typeof obj.outfitColor === 'string' && obj.outfitColor ? obj.outfitColor : '#3b82f6',
        bottoms,
        bottomsColor: typeof obj.bottomsColor === 'string' && obj.bottomsColor ? obj.bottomsColor : '#1e293b',
        shoes,
        shoesColor: typeof obj.shoesColor === 'string' && obj.shoesColor ? obj.shoesColor : '#ef4444',
        frame,
    };
}

export function getStoredAvatarConfig(): AvatarConfig | null {
    const cookieVal = readCookie(AVATAR_IDENTITY_COOKIE);
    if (cookieVal) {
        try {
            const parsed = normalizeStoredAvatar(JSON.parse(cookieVal));
            if (parsed) {
                writeLocal(AVATAR_IDENTITY_KEY, JSON.stringify(parsed));
                return parsed;
            }
        } catch {
            // Ignore malformed cookie JSON
        }
    }

    const localVal = readLocal(AVATAR_IDENTITY_KEY);
    if (localVal) {
        try {
            const parsed = normalizeStoredAvatar(JSON.parse(localVal));
            if (parsed) {
                writeCookie(AVATAR_IDENTITY_COOKIE, JSON.stringify(parsed));
                return parsed;
            }
        } catch {
            // Ignore malformed localStorage JSON
        }
    }

    return null;
}

export function setStoredAvatarConfig(avatar?: Partial<AvatarConfig> | null): void {
    const normalized = normalizeStoredAvatar(avatar);
    if (!normalized) return;
    const compact = JSON.stringify(normalized);
    writeCookie(AVATAR_IDENTITY_COOKIE, compact);
    writeLocal(AVATAR_IDENTITY_KEY, compact);
    setStoredMascotGender(normalized.gender);
}

export function getLastLoginMethod(): LastLoginMethod | null {
    const cookieVal = readCookie(LAST_LOGIN_METHOD_COOKIE);
    if (cookieVal === 'email' || cookieVal === 'google') {
        writeLocal(LAST_LOGIN_METHOD_KEY, cookieVal);
        return cookieVal;
    }

    const localVal = readLocal(LAST_LOGIN_METHOD_KEY);
    if (localVal === 'email' || localVal === 'google') {
        writeCookie(LAST_LOGIN_METHOD_COOKIE, localVal);
        return localVal;
    }

    return null;
}

export function setLastLoginMethod(method?: string | null): void {
    if (method !== 'email' && method !== 'google') return;
    writeCookie(LAST_LOGIN_METHOD_COOKIE, method);
    writeLocal(LAST_LOGIN_METHOD_KEY, method);
}

export function getLastLoginEmail(): string | null {
    const cookieVal = readCookie(LAST_LOGIN_EMAIL_COOKIE);
    if (cookieVal && cookieVal.includes('@')) {
        writeLocal(LAST_LOGIN_EMAIL_KEY, cookieVal);
        return cookieVal;
    }

    const localVal = readLocal(LAST_LOGIN_EMAIL_KEY);
    if (localVal && localVal.includes('@')) {
        writeCookie(LAST_LOGIN_EMAIL_COOKIE, localVal);
        return localVal;
    }

    return null;
}

export function setLastLoginEmail(email?: string | null): void {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return;
    writeCookie(LAST_LOGIN_EMAIL_COOKIE, normalized);
    writeLocal(LAST_LOGIN_EMAIL_KEY, normalized);
}

export function syncAuthPreferencesFromUser(user?: {
    userId?: string;
    email?: string;
    avatar?: Partial<AvatarConfig> | { gender?: string | null } | null;
    lastLoginMethod?: string | null;
} | null): void {
    if (!user) return;
    const isDemo = Boolean(
        user.userId?.startsWith('demo_') ||
        user.email?.endsWith('@quizplatform.demo') ||
        user.email?.endsWith('@futurerobins.demo')
    );
    if (isDemo) return;

    setStoredMascotGender(user.avatar?.gender);
    if (user.avatar && Object.keys(user.avatar).length > 1) {
        setStoredAvatarConfig(user.avatar as Partial<AvatarConfig>);
    }
    if (user.lastLoginMethod) {
        setLastLoginMethod(user.lastLoginMethod);
    }
    if (user.email) {
        setLastLoginEmail(user.email);
    }
}
