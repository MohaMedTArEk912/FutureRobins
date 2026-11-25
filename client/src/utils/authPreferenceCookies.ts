export type MascotGender = 'male' | 'female';
export type LastLoginMethod = 'email' | 'google';

const MASCOT_GENDER_KEY = 'future_robins_mascot_gender';
const MASCOT_GENDER_COOKIE = 'fr_mascot_gender';

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
    avatar?: { gender?: string | null };
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
    if (user.lastLoginMethod) {
        setLastLoginMethod(user.lastLoginMethod);
    }
    if (user.email) {
        setLastLoginEmail(user.email);
    }
}
