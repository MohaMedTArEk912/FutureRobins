import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { UserData } from '../lib/api';

interface AuthContextType {
    currentUser: UserData | null;
    isAdmin: boolean;
    isTeacher: boolean;
    isLoading: boolean;
    completeAuthSession: (user: UserData, jwt: string) => { user: UserData; token: string; isAdmin: boolean };
    login: (email: string, password: string) => Promise<{ user: UserData; token: string; isAdmin: boolean }>;
    register: (name: string, email: string, password: string) => Promise<{ user: UserData; token: string; isAdmin: boolean }>;
    googleLogin: (profile: { email: string; name: string; googleId: string }) => Promise<{ user: UserData; token: string; isAdmin: boolean }>;
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

    // Load session on mount
    useEffect(() => {
        const verifyAndLoadSession = async () => {
            const savedSession = sessionStorage.getItem('userSession');
            if (savedSession) {
                try {
                    const session = JSON.parse(savedSession);
                    const sessionToken = session.token as string | undefined;
                    // Verify session with server using JWT
                    const { valid, user } = await api.verifySession(sessionToken);

                    if (valid) {
                        setCurrentUser(user);
                        setIsAdmin(user.role === 'admin');
                        setToken(sessionToken ?? null);
                    } else {
                        throw new Error('Invalid session');
                    }
                } catch (error) {
                    console.error('Session verification failed:', error);
                    sessionStorage.removeItem('userSession');
                    setCurrentUser(null);
                    setIsAdmin(false);
                    setToken(null);
                }
            }
            setIsLoading(false);
        };

        verifyAndLoadSession();
    }, []);

    const refreshUser = useCallback(async () => {
        const savedSession = sessionStorage.getItem('userSession');
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
            const isAdminUser = user.role === 'admin';
            setIsAdmin(isAdminUser);
            sessionStorage.setItem('userSession', JSON.stringify({ user, token: currentToken, isAdmin: isAdminUser }));
        } catch (error) {
            console.error('Failed to refresh user:', error);
        }
    }, [currentUser?.userId, token]);

    const completeAuthSession = useCallback((user: UserData, jwt: string) => {
        const isAdminUser = user.role === 'admin';
        setCurrentUser(user);
        setIsAdmin(isAdminUser);
        setToken(jwt);
        sessionStorage.setItem('userSession', JSON.stringify({ user, token: jwt, isAdmin: isAdminUser }));
        return { user, token: jwt, isAdmin: isAdminUser };
    }, []);

    const login = async (email: string, password: string) => {
        const normalizedEmail = email.toLowerCase().trim();
        const { user, token: jwt } = await api.login({ email: normalizedEmail, password });
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
        return completeAuthSession(user, jwt);
    };

    const googleLogin = async (profile: { email: string; name: string; googleId: string }) => {
        const { user, token: jwt } = await api.googleLogin(profile);
        return completeAuthSession(user, jwt);
    };

    const logout = () => {
        sessionStorage.setItem('suppressRedirectAfterLogin', 'true');
        sessionStorage.removeItem('redirectAfterLogin');
        sessionStorage.removeItem('googleAuthData');
        localStorage.removeItem('weekly_challenge_subscriber');
        sessionStorage.removeItem('weekly_challenge_anon_subscriber');
        setCurrentUser(null);
        setIsAdmin(false);
        setToken(null);
        sessionStorage.removeItem('userSession');
    };

    const updateUser = useCallback((updates: Partial<UserData>) => {
        setCurrentUser(prev => {
            if (!prev) return null;
            const newState = { ...prev, ...updates };
            const nextIsAdmin = newState.role === 'admin';
            setIsAdmin(nextIsAdmin);
            sessionStorage.setItem('userSession', JSON.stringify({ user: newState, token, isAdmin: nextIsAdmin }));
            return newState;
        });
    }, [token]);

    const isTeacher = Boolean(currentUser && (currentUser.role === 'teacher' || currentUser.role === 'admin' || isAdmin));

    return (
        <AuthContext.Provider value={{ currentUser, isAdmin, isTeacher, isLoading, completeAuthSession, login, register, googleLogin, logout, updateUser, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};
