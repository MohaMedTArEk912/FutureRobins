/* eslint-disable react-refresh/only-export-components */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode
} from 'react';
import { api } from '../lib/api';
import type { UserData } from '../types';

export type AppLanguage = 'en' | 'ar-EG';

const STORAGE_LANG_KEY = 'app_language';

interface AccountUpdater {
    user: UserData | null;
    updateUser?: (updates: Partial<UserData>) => void;
}

export interface LanguageContextType {
    language: AppLanguage;
    isArabic: boolean;
    dir: 'ltr' | 'rtl';
    tx: (enText: string, arEgText: string) => string;
    formatNumber: (value: number) => string;
    setLanguage: (nextLang: AppLanguage) => Promise<void>;
    registerAccountSync: (
        user: UserData | null,
        isLoading: boolean,
        updateUser?: (updates: Partial<UserData>) => void
    ) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const applyDocumentLanguage = (lang: AppLanguage) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const isAr = lang === 'ar-EG';
    root.lang = isAr ? 'ar-EG' : 'en';
    root.dir = isAr ? 'rtl' : 'ltr';
    if (isAr) {
        root.classList.add('lang-ar');
        root.setAttribute('data-lang', 'ar-EG');
    } else {
        root.classList.remove('lang-ar');
        root.setAttribute('data-lang', 'en');
    }
};

const readStoredLanguage = (): AppLanguage => {
    try {
        const stored = localStorage.getItem(STORAGE_LANG_KEY);
        if (stored === 'ar-EG' || stored === 'en') {
            return stored;
        }
    } catch {
        // Ignore storage restrictions
    }
    return 'en';
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

export const useOptionalLanguage = () => useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<AppLanguage>(() => {
        const initial = readStoredLanguage();
        applyDocumentLanguage(initial);
        return initial;
    });
    const accountRef = useRef<AccountUpdater>({ user: null, updateUser: undefined });

    useEffect(() => {
        applyDocumentLanguage(language);
    }, [language]);

    const persistLanguagePreference = useCallback(async (nextLang: AppLanguage) => {
        try {
            localStorage.setItem(STORAGE_LANG_KEY, nextLang);
        } catch {
            // Ignore storage errors
        }

        const { user, updateUser } = accountRef.current;
        if (!user || user.userId === 'guest') return;

        // Optimistically update local session immediately
        updateUser?.({ preferredLanguage: nextLang });

        try {
            await api.updateUser(user.userId, { preferredLanguage: nextLang });
        } catch (error) {
            console.error('Failed to persist preferredLanguage to server:', error);
        }
    }, []);

    const setLanguage = useCallback(async (nextLang: AppLanguage) => {
        setLanguageState(nextLang);
        applyDocumentLanguage(nextLang);
        await persistLanguagePreference(nextLang);
    }, [persistLanguagePreference]);

    const registerAccountSync = useCallback((
        user: UserData | null,
        isLoading: boolean,
        updateUser?: (updates: Partial<UserData>) => void
    ) => {
        accountRef.current = { user, updateUser };
        if (isLoading || !user || user.userId === 'guest') return;

        if (user.preferredLanguage === 'ar-EG' || user.preferredLanguage === 'en') {
            if (user.preferredLanguage !== language) {
                setLanguageState(user.preferredLanguage);
                applyDocumentLanguage(user.preferredLanguage);
                try {
                    localStorage.setItem(STORAGE_LANG_KEY, user.preferredLanguage);
                } catch {
                    // ignore
                }
            }
        }
    }, [language]);

    const isArabic = language === 'ar-EG';
    const dir: 'ltr' | 'rtl' = isArabic ? 'rtl' : 'ltr';

    const tx = useCallback((enText: string, arEgText: string) => {
        return language === 'ar-EG' ? arEgText : enText;
    }, [language]);

    const formatNumber = useCallback((value: number) => {
        return new Intl.NumberFormat('en-US').format(value);
    }, []);

    const value = useMemo<LanguageContextType>(() => ({
        language,
        isArabic,
        dir,
        tx,
        formatNumber,
        setLanguage,
        registerAccountSync
    }), [
        language,
        isArabic,
        dir,
        tx,
        formatNumber,
        setLanguage,
        registerAccountSync
    ]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};
