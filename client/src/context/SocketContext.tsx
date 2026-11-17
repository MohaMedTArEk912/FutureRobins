import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const EMPTY_ONLINE_USERS = new Set<string>();

interface SocketContextType {
    socket: Socket | null;
    connected: boolean;
    onlineUsers: Set<string>;
    isUserOnline: (userId: string) => boolean;
    checkUserOnline: (userId: string) => Promise<boolean>;
}

const globalSocketStore = globalThis as { __quizSocketContext?: React.Context<SocketContextType | undefined> };
const SocketContext = import.meta.env.DEV
    ? (globalSocketStore.__quizSocketContext ??= createContext<SocketContextType | undefined>(undefined))
    : createContext<SocketContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        // Optional: return null or throw. Logic in App.tsx seemed to allow socket to be null.
        return {
            socket: null,
            connected: false,
            onlineUsers: new Set<string>(),
            isUserOnline: () => false,
            checkUserOnline: async () => false
        };
    }
    return context;
};

const resolveSocketConfig = () => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const isServerlessDomain = hostname.includes('vercel.app') || hostname.includes('netlify.app');

    const envUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
    const envPath = import.meta.env.VITE_SOCKET_PATH as string | undefined;
    const envEnabled = import.meta.env.VITE_ENABLE_SOCKET as string | undefined;

    // If explicitly disabled, respect that
    if (envEnabled === 'false') {
        return { enabled: false } as const;
    }

    // On serverless hosting without a dedicated external socket URL, disable socket by default to prevent failed connection spam
    if (isServerlessDomain && !envUrl && envEnabled !== 'true') {
        return { enabled: false } as const;
    }

    // Default to current origin or configured URL
    const url = envUrl ?? (isLocal ? 'http://localhost:5000' : window.location.origin);

    // Default path is /socket.io/ (standard for most Node deployments)
    const path = envPath ?? '/socket.io/';

    // Always prefer websocket for performance, fallback to polling
    const transports = ['websocket', 'polling'];

    return { enabled: true, url, path, transports } as const;
};

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const socketRef = useRef<Socket | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    const socketConfig = useMemo(() => resolveSocketConfig(), []);

    const userId = currentUser?.userId ?? null;

    // Helper to check if a user is online (from local cache)
    const isUserOnline = useCallback((targetUserId: string): boolean => {
        return Boolean(socketConfig.enabled && userId && onlineUsers.has(targetUserId));
    }, [socketConfig.enabled, userId, onlineUsers]);

    // Helper to check user online status via socket (server query)
    const checkUserOnline = useCallback((targetUserId: string): Promise<boolean> => {
        return new Promise((resolve) => {
            const socket = socketRef.current;
            if (!socket || !socket.connected) {
                resolve(false);
                return;
            }
            socket.emit('check_user_online', targetUserId, (response: { userId: string; isOnline: boolean }) => {
                if (response.isOnline) {
                    setOnlineUsers(prev => new Set(prev).add(response.userId));
                }
                resolve(response.isOnline);
            });
        });
    }, []);

    useEffect(() => {
        if (!socketConfig.enabled || !userId) {
            socketRef.current?.disconnect();
            socketRef.current = null;
            return;
        }

        // Netlify / Vercel Functions cannot hold WebSockets; allow production sockets only when explicitly enabled.
        const { url: socketUrl, path: socketPath, transports } = socketConfig;
        let cancelled = false;

        try {
            const newSocket = io(socketUrl, {
                transports,
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 10000,
                path: socketPath
            });
            socketRef.current = newSocket;
            void Promise.resolve().then(() => {
                if (!cancelled) {
                    setSocket(newSocket);
                    setConnected(newSocket.connected);
                }
            });

            newSocket.on('connect', () => {
                if (cancelled) return;
                if (import.meta.env.DEV) console.log('✅ WebSocket connected successfully');
                setSocket(newSocket);
                setConnected(true);
                newSocket.emit('join_user', userId);
            });

            newSocket.on('disconnect', (reason) => {
                if (cancelled) return;
                if (import.meta.env.DEV) console.log('❌ WebSocket disconnected:', reason);
                setConnected(false);
            });

            newSocket.on('connect_error', (error) => {
                if (cancelled) return;
                if (import.meta.env.DEV) console.log('⚠️ Socket connection error:', error.message);
                setConnected(false);
            });

            // Listen for presence updates
            newSocket.on('user_online', ({ userId: onlineUserId }: { userId: string }) => {
                if (cancelled) return;
                setOnlineUsers(prev => {
                    const updated = new Set(prev);
                    updated.add(onlineUserId);
                    return updated;
                });
            });

            newSocket.on('user_offline', ({ userId: offlineUserId }: { userId: string }) => {
                if (cancelled) return;
                setOnlineUsers(prev => {
                    const updated = new Set(prev);
                    updated.delete(offlineUserId);
                    return updated;
                });
            });

            return () => {
                cancelled = true;
                newSocket.disconnect();
                socketRef.current = null;
            };
        } catch (error) {
            if (import.meta.env.DEV) console.error('Socket initialization failed:', error);
            return;
        }
    }, [userId, socketConfig]);

    const isSocketActive = Boolean(socketConfig.enabled && userId);
    const activeSocket = isSocketActive ? socket : null;
    const activeConnected = isSocketActive ? connected : false;
    const activeOnlineUsers = isSocketActive ? onlineUsers : EMPTY_ONLINE_USERS;

    const contextValue = useMemo(() => ({
        socket: activeSocket,
        connected: activeConnected,
        onlineUsers: activeOnlineUsers,
        isUserOnline,
        checkUserOnline
    }), [activeSocket, activeConnected, activeOnlineUsers, isUserOnline, checkUserOnline]);

    return (
        <SocketContext.Provider value={contextValue}>
            {children}
        </SocketContext.Provider>
    );
};
