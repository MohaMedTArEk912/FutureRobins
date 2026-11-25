import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { UserData } from '../lib/api';
import {
    setLastLoginEmail,
    setLastLoginMethod,
    syncAuthPreferencesFromUser
} from '../utils/authPreferenceCookies';

interface AuthContextType {
    currentUser: UserData | null;
    isAdmin: boolean;
    isTeacher: boolean;
    isLoading: boolean;
    completeAuthSession: (user: UserData, jwt: string) => { user: UserData; token: string; isAdmin: boolean };
    login: (email: string, password: string) => Promise<{ user: UserData; token: string; isAdmin: boolean }>;
    register: (name: string, email: string, password: string) => Promise<{ user: UserData; token: string; isAdmin: boolean }>;
    googleLogin: (profile: { email: string; name: string; googleId: string }) => Promise<{ user: UserData; token: string; isAdmin: boolean }>;
    demoLogin: (options?: { role?: 'student' | 'teacher'; preferredLanguage?: 'en' | 'ar-EG'; name?: string }) => Promise<{ user: UserData; token: string; isAdmin: boolean }>;
    logout: () => void;
    updateUser: (updates: Partial<UserData>) => void;
    refreshUser: () => Promise<void>;
}

const globalAuthStore = globalThis as { __quizAuthContext?: React.Context<AuthContextType | undefined> };
const AuthContext = import.meta.env.DEV
    ? (globalAuthStore.__quizAuthContext ??= createContext<AuthContextType | undefined>(undefined))
    : createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useOptionalAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserData | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState<string | null>(null);
    const lastDeviceSyncRef = useRef<number>(0);

    // Load session on mount
    useEffect(() => {
        const verifyAndLoadSession = async () => {
            const savedSession = sessionStorage.getItem('userSession') || localStorage.getItem('userSession');
            if (savedSession) {
                try {
                    const session = JSON.parse(savedSession);
                    const sessionToken = session.token as string | undefined;
                    // Verify session with server using JWT
                    const { valid, user } = await api.verifySession(sessionToken);

                    if (valid) {
                        const normalizedSession = JSON.stringify({
                            user,
                            token: sessionToken,
                            isAdmin: user.role === 'admin'
                        });
                        sessionStorage.setItem('userSession', normalizedSession);
                        localStorage.setItem('userSession', normalizedSession);
                        setCurrentUser(user);
                        setIsAdmin(user.role === 'admin');
                        setToken(sessionToken ?? null);
                        syncAuthPreferencesFromUser(user);
                        lastDeviceSyncRef.current = Date.now();
                    } else {
                        throw new Error('Invalid session');
                    }
                } catch (error) {
                    console.error('Session verification failed:', error);
                    sessionStorage.removeItem('userSession');
                    localStorage.removeItem('userSession');
                    setCurrentUser(null);
                    setIsAdmin(false);
                    setToken(null);
                }
            }
            setIsLoading(false);
        };

        verifyAndLoadSession();
    }, []);

    useEffect(() => {
        syncAuthPreferencesFromUser(currentUser);
    }, [currentUser]);

    const refreshUser = useCallback(async () => {
        const savedSession = sessionStorage.getItem('userSession') || localStorage.getItem('userSession');
        let currentUserId = currentUser?.userId;
        let currentToken = token;
        if (!currentUserId && savedSession) {
            try {
                const parsed = JSON.parse(savedSession);
                currentUserId = parsed.user?.userId;
                currentToken = parsed.token;
            } catch {
                // ignore
            }
        }
        if (!currentUserId) return;
        try {
            const { user } = await api.getUserData(currentUserId);
            setCurrentUser(prev => {
                if (prev && JSON.stringify(prev) === JSON.stringify(user)) {
                    return prev;
                }
                return user;
            });
            syncAuthPreferencesFromUser(user);
            const isAdminUser = user.role === 'admin';
            setIsAdmin(isAdminUser);
            const updatedSession = JSON.stringify({ user, token: currentToken, isAdmin: isAdminUser });
            sessionStorage.setItem('userSession', updatedSession);
            localStorage.setItem('userSession', updatedSession);
        } catch (error) {
            console.error('Failed to refresh user:', error);
        }
    }, [currentUser?.userId, token]);

    // Sync preferences (gender, lastLoginMethod, profile) across devices on tab focus/visibility
    useEffect(() => {
        if (!currentUser?.userId) return;
        const syncOnFocus = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            const now = Date.now();
            if (now - lastDeviceSyncRef.current < 30000) return;
            lastDeviceSyncRef.current = now;
            void refreshUser();
        };
        window.addEventListener('focus', syncOnFocus);
        document.addEventListener('visibilitychange', syncOnFocus);
        return () => {
            window.removeEventListener('focus', syncOnFocus);
            document.removeEventListener('visibilitychange', syncOnFocus);
        };
    }, [currentUser?.userId, refreshUser]);

    const completeAuthSession = useCallback((user: UserData, jwt: string) => {
        const isAdminUser = user.role === 'admin';
        setCurrentUser(user);
        setIsAdmin(isAdminUser);
        setToken(jwt);
        syncAuthPreferencesFromUser(user);
        lastDeviceSyncRef.current = Date.now();
        const sessionPayload = JSON.stringify({ user, token: jwt, isAdmin: isAdminUser });
        sessionStorage.setItem('userSession', sessionPayload);
        localStorage.setItem('userSession', sessionPayload);
        return { user, token: jwt, isAdmin: isAdminUser };
    }, []);

    const login = async (email: string, password: string) => {
        const normalizedEmail = email.toLowerCase().trim();
        const { user, token: jwt } = await api.login({ email: normalizedEmail, password });
        setLastLoginMethod('email');
        setLastLoginEmail(normalizedEmail);
        return completeAuthSession(user, jwt);
    };

    const register = async (name: string, email: string, password: string) => {
        const normalizedEmail = email.toLowerCase().trim();
        const userId = normalizedEmail.replace(/[^a-z0-9]/g, '_');

        const baseUserData: UserData = {
            userId,
            name: name.trim(),
            email: normalizedEmail,
            totalScore: 0,
            totalAttempts: 0,
            totalTime: 0,
            xp: 0,
            level: 1,
            streak: 0,
            lastLoginDate: new Date().toISOString(),
            badges: []
        };

        const registrationData: Partial<UserData> & { password: string } = { ...baseUserData, password };
        const { user, token: jwt } = await api.register(registrationData);
        setLastLoginMethod('email');
        setLastLoginEmail(normalizedEmail);
        return completeAuthSession(user, jwt);
    };

    const googleLogin = async (profile: { email: string; name: string; googleId: string }) => {
        const { user, token: jwt } = await api.googleLogin(profile);
        setLastLoginMethod('google');
        setLastLoginEmail(profile.email);
        return completeAuthSession(user, jwt);
    };

    const demoLogin = useCallback(async (options?: { role?: 'student' | 'teacher'; preferredLanguage?: 'en' | 'ar-EG'; name?: string }) => {
        const { user, token: jwt } = await api.demoLogin(options);
        return completeAuthSession(user, jwt);
    }, [completeAuthSession]);

    const logout = () => {
        // Persist chosen gender & last-login method in cookies/localStorage so logout keeps them
        syncAuthPreferencesFromUser(currentUser);
        sessionStorage.setItem('suppressRedirectAfterLogin', 'true');
        sessionStorage.removeItem('redirectAfterLogin');
        sessionStorage.removeItem('demoVisitorName');
        sessionStorage.removeItem('googleAuthData');
        localStorage.removeItem('weekly_challenge_subscriber');
        sessionStorage.removeItem('weekly_challenge_anon_subscriber');
        setCurrentUser(null);
        setIsAdmin(false);
        setToken(null);
        sessionStorage.removeItem('userSession');
        localStorage.removeItem('userSession');
    };

    const updateUser = useCallback((updates: Partial<UserData>) => {
        setCurrentUser(prev => {
            if (!prev) return null;
            const newState = { ...prev, ...updates };
            syncAuthPreferencesFromUser(newState);
            const nextIsAdmin = newState.role === 'admin';
            setIsAdmin(nextIsAdmin);
            const updatedSession = JSON.stringify({ user: newState, token, isAdmin: nextIsAdmin });
            sessionStorage.setItem('userSession', updatedSession);
            localStorage.setItem('userSession', updatedSession);
            return newState;
        });
    }, [token]);

    const isTeacher = Boolean(currentUser && (currentUser.role === 'teacher' || currentUser.role === 'admin' || isAdmin));

    return (
        <AuthContext.Provider value={{ currentUser, isAdmin, isTeacher, isLoading, completeAuthSession, login, register, googleLogin, demoLogin, logout, updateUser, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};
