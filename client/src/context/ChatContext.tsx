import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';
import { api } from '../lib/api';
import type { UserData, ClanChatMessage, DirectChatMessage, Clan } from '../types';

interface ChallengeDataPayload {
    quizId?: string;
    quizTitle?: string;
    roomId?: string;
    status?: 'pending' | 'in_progress' | 'completed';
    result?: {
        winnerId?: string | null;
        isDraw?: boolean;
        myScore?: number;
        opponentScore?: number;
    };
}

export type EnrichedDirectMessage = DirectChatMessage & {
    challengeData?: ChallengeDataPayload;
};

export interface OpenChatOptions {
    returnToLabel?: string;
}

interface ChatContextType {
    isOpen: boolean;
    activeTab: 'clan' | 'direct';
    activeFriend: UserData | null;
    unreadCount: number;
    unreadClanCount: number;
    unreadByFriend: Record<string, number>;
    clanMessages: ClanChatMessage[];
    directMessages: Record<string, EnrichedDirectMessage[]>;
    clan: Clan | null;
    onlineUserIds: Set<string>;
    returnToLabel: string | null;
    openChat: (tab?: 'clan' | 'direct', friend?: UserData | string, options?: OpenChatOptions) => void;
    closeChat: () => void;
    setActiveTab: (tab: 'clan' | 'direct') => void;
    setActiveFriend: (friend: UserData | null) => void;
    sendDirectMessage: (receiverId: string, content: string, type?: 'text' | 'challenge', challengeData?: ChallengeDataPayload) => void;
    sendClanMessage: (content: string) => Promise<void>;
    editClanMessage: (messageId: string, content: string) => Promise<void>;
    deleteClanMessage: (messageId: string) => Promise<void>;
    markClanAsRead: () => void;
    markFriendAsRead: (friendId: string) => void;
    refreshClan: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const { socket, connected } = useSocket();
    const { allUsers } = useData();
    const currentUserId = currentUser?.userId;
    const currentUserClanId = currentUser?.clanId;
    const currentUserName = currentUser?.name;

    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'clan' | 'direct'>('clan');
    const [activeFriend, setActiveFriend] = useState<UserData | null>(null);
    const [returnToLabel, setReturnToLabel] = useState<string | null>(null);

    const [clan, setClan] = useState<Clan | null>(null);
    const currentClanId = clan?.clanId;
    const [clanMessages, setClanMessages] = useState<ClanChatMessage[]>([]);
    const [unreadClanCount, setUnreadClanCount] = useState(0);

    const [directMessages, setDirectMessages] = useState<Record<string, EnrichedDirectMessage[]>>({});
    const [unreadByFriend, setUnreadByFriend] = useState<Record<string, number>>({});
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

    // LocalStorage key for Direct Messages
    const dmStorageKey = useMemo(() => {
        return currentUserId ? `quiz_direct_messages_${currentUserId}` : null;
    }, [currentUserId]);

    // Load initial cached DMs
    useEffect(() => {
        if (!dmStorageKey) return;
        try {
            const raw = localStorage.getItem(dmStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (typeof parsed === 'object' && parsed !== null) {
                    queueMicrotask(() => setDirectMessages(parsed));
                }
            }
        } catch {
            // Ignore storage parse issues
        }
    }, [dmStorageKey]);

    // Persist DMs to LocalStorage
    const saveDirectMessagesToStorage = useCallback((msgs: Record<string, EnrichedDirectMessage[]>) => {
        if (!dmStorageKey) return;
        try {
            localStorage.setItem(dmStorageKey, JSON.stringify(msgs));
        } catch {
            // Ignore quota issues
        }
    }, [dmStorageKey]);

    // Load User's Clan
    const loadClan = useCallback(async () => {
        if (!currentUserClanId || !currentUserId) {
            setClan(null);
            setClanMessages([]);
            return;
        }

        try {
            const clanData = await api.getClan(currentUserClanId, currentUserId, true);
            const isDemoViewer = currentUserId === 'demo_student' || currentUserId === 'demo_teacher';
            if (
                !isDemoViewer &&
                (clanData.tag === 'DEMO' || clanData.name === 'Live Demo Cohort' || clanData.leaderId === 'demo_teacher')
            ) {
                setClan(null);
                setClanMessages([]);
                return;
            }
            setClan(clanData);
            if (clanData.chatMessages) {
                setClanMessages(clanData.chatMessages);
            }
        } catch {
            // User might not be in clan
            setClan(null);
        }
    }, [currentUserClanId, currentUserId]);

    useEffect(() => {
        queueMicrotask(() => {
            void loadClan();
        });
    }, [loadClan]);

    // Join clan room and user room via socket
    useEffect(() => {
        if (!socket || !connected || !currentUser?.userId) return;

        socket.emit('join_user', currentUser.userId);

        if (currentUser.clanId) {
            socket.emit('join_clan_chat', currentUser.clanId);
        }

        // Query online presence for user's friends
        const handleStatusMap = (res: unknown) => {
            if (Array.isArray(res)) {
                setOnlineUserIds(new Set(res));
            } else if (res && typeof res === 'object') {
                const online = Object.entries(res as Record<string, boolean>)
                    .filter(([, isOnline]) => Boolean(isOnline))
                    .map(([uid]) => uid);
                setOnlineUserIds(new Set(online));
            }
        };

        const friendIds = currentUser.friends || [];
        if (friendIds.length > 0) {
            socket.emit('get_online_users', friendIds, handleStatusMap);
        }

        socket.on('online_users_status', handleStatusMap);

        const handleUserOnline = ({ userId }: { userId: string }) => {
            setOnlineUserIds(prev => new Set(prev).add(userId));
        };

        const handleUserOffline = ({ userId }: { userId: string }) => {
            setOnlineUserIds(prev => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        };

        socket.on('user_online', handleUserOnline);
        socket.on('user_offline', handleUserOffline);

        return () => {
            socket.off('online_users_status', handleStatusMap);
            socket.off('user_online', handleUserOnline);
            socket.off('user_offline', handleUserOffline);
        };
    }, [socket, connected, currentUser?.userId, currentUser?.clanId, currentUser?.friends]);

    // Socket: Handle incoming Clan Messages
    useEffect(() => {
        if (!socket || !connected) return;

        const handleNewClanMessage = (msg: ClanChatMessage) => {
            setClanMessages(prev => {
                const filtered = prev.filter(m => !(m.id.startsWith('temp_') && m.senderId === msg.senderId && m.content === msg.content));
                if (filtered.some(m => m.id === msg.id)) return filtered;
                return [...filtered, msg];
            });

            // If chat is open on clan tab, mark as read; else increment unread
            if (!isOpen || activeTab !== 'clan') {
                setUnreadClanCount(c => c + 1);
            }
        };

        const handleClanMessageEdited = ({ messageId, newContent, isEdited, updatedAt }: { messageId: string; newContent: string; isEdited?: boolean; updatedAt?: string }) => {
            setClanMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, isEdited: isEdited ?? true, updatedAt } : m));
        };

        const handleClanMessageDeleted = ({ messageId }: { messageId: string }) => {
            setClanMessages(prev => prev.filter(m => m.id !== messageId));
        };

        socket.on('new_clan_message', handleNewClanMessage);
        socket.on('clan_message_edited', handleClanMessageEdited);
        socket.on('clan_message_deleted', handleClanMessageDeleted);

        return () => {
            socket.off('new_clan_message', handleNewClanMessage);
            socket.off('clan_message_edited', handleClanMessageEdited);
            socket.off('clan_message_deleted', handleClanMessageDeleted);
        };
    }, [socket, connected, isOpen, activeTab]);

    // Socket: Handle incoming Direct Messages
    useEffect(() => {
        if (!socket || !connected || !currentUser?.userId) return;

        const handleNewDirectMessage = (msg: EnrichedDirectMessage) => {
            const otherUserId = msg.senderId === currentUser.userId ? msg.receiverId : msg.senderId;

            setDirectMessages(prev => {
                const currentList = prev[otherUserId] || [];
                if (currentList.some(m => m.id === msg.id)) return prev;
                const updatedList = [...currentList, msg];
                const updatedMap = { ...prev, [otherUserId]: updatedList };
                saveDirectMessagesToStorage(updatedMap);
                return updatedMap;
            });

            // If not actively viewing this friend's conversation, increment unread count
            const isViewing = isOpen && activeTab === 'direct' && activeFriend?.userId === otherUserId;
            if (!isViewing && msg.senderId !== currentUser.userId) {
                setUnreadByFriend(prev => ({
                    ...prev,
                    [otherUserId]: (prev[otherUserId] || 0) + 1
                }));
            }
        };

        socket.on('new_direct_message', handleNewDirectMessage);

        return () => {
            socket.off('new_direct_message', handleNewDirectMessage);
        };
    }, [socket, connected, currentUser?.userId, isOpen, activeTab, activeFriend?.userId, saveDirectMessagesToStorage]);

    const markClanAsRead = useCallback(() => {
        setUnreadClanCount(0);
        if (currentClanId) {
            try {
                localStorage.setItem(`clan_chat_last_viewed_${currentClanId}`, Date.now().toString());
            } catch {
                // ignore
            }
        }
    }, [currentClanId]);

    const markFriendAsRead = useCallback((friendId: string) => {
        setUnreadByFriend(prev => {
            if (!prev[friendId]) return prev;
            const next = { ...prev };
            delete next[friendId];
            return next;
        });
    }, []);

    // Open chat helper
    const openChat = useCallback((tab: 'clan' | 'direct' = 'clan', friend?: UserData | string, options?: OpenChatOptions) => {
        setReturnToLabel(options?.returnToLabel ?? null);
        setIsOpen(true);
        if (tab) {
            setActiveTab(tab);
        }

        if (friend) {
            setActiveTab('direct');
            if (typeof friend === 'string') {
                const resolved = allUsers.find(u => u.userId === friend);
                if (resolved) {
                    setActiveFriend(resolved);
                    markFriendAsRead(resolved.userId);
                } else {
                    const fallbackFriend: UserData = {
                        userId: friend,
                        name: friend,
                        email: '',
                        role: 'student',
                        totalScore: 0,
                        totalTime: 0,
                        totalAttempts: 0,
                        xp: 0,
                        level: 1,
                        streak: 0,
                        lastLoginDate: new Date().toISOString(),
                        badges: []
                    };
                    setActiveFriend(fallbackFriend);
                    markFriendAsRead(friend);
                }
            } else {
                setActiveFriend(friend);
                markFriendAsRead(friend.userId);
            }
        } else if (tab === 'clan') {
            markClanAsRead();
        }
    }, [allUsers, markClanAsRead, markFriendAsRead]);

    const closeChat = useCallback(() => {
        setIsOpen(false);
        setReturnToLabel(null);
    }, []);

    // Send direct message
    const sendDirectMessage = useCallback((receiverId: string, content: string, type: 'text' | 'challenge' = 'text', challengeData?: ChallengeDataPayload) => {
        if (!currentUserId || !content.trim()) return;

        const messageId = `dm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newMsg: EnrichedDirectMessage = {
            id: messageId,
            senderId: currentUserId,
            senderName: currentUserName || 'User',
            receiverId,
            content: content.trim(),
            type,
            challengeData,
            createdAt: new Date().toISOString(),
            isRead: false
        };

        // Add to local state immediately
        setDirectMessages(prev => {
            const list = prev[receiverId] || [];
            const nextList = [...list, newMsg];
            const updated = { ...prev, [receiverId]: nextList };
            saveDirectMessagesToStorage(updated);
            return updated;
        });

        // Broadcast through socket
        if (socket && connected) {
            socket.emit('send_direct_message', newMsg);
        }
    }, [currentUserId, currentUserName, socket, connected, saveDirectMessagesToStorage]);

    // Send Clan Message
    const sendClanMessage = useCallback(async (content: string) => {
        if (!currentUser?.clanId || !currentUser?.userId || !content.trim()) return;

        const tempId = `temp_${Date.now()}`;
        const equipped = currentUser.badges?.find(b => b.id === currentUser.equippedBadgeId);
        const tempMsg: ClanChatMessage = {
            id: tempId,
            senderId: currentUser.userId,
            senderName: currentUser.name || 'Member',
            senderAvatar: currentUser.avatar || null,
            senderRole: clan?.leaderId === currentUser.userId ? 'leader' : 'member',
            senderBadge: equipped ? { id: equipped.id, name: equipped.name, icon: equipped.icon || '🏅' } : null,
            content: content.trim(),
            createdAt: new Date().toISOString()
        };

        setClanMessages(prev => [...prev, tempMsg]);

        if (socket && connected) {
            socket.emit('send_clan_message', {
                clanId: currentUser.clanId,
                senderId: currentUser.userId,
                senderName: currentUser.name,
                senderAvatar: currentUser.avatar,
                senderRole: tempMsg.senderRole,
                content: content.trim()
            });
        } else {
            await api.sendClanMessage(currentUser.clanId, content.trim(), currentUser.userId);
            loadClan();
        }
    }, [currentUser, clan?.leaderId, socket, connected, loadClan]);

    // Edit Clan Message
    const editClanMessage = useCallback(async (messageId: string, content: string) => {
        if (!currentUserClanId || !currentUserId || !content.trim()) return;

        setClanMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: content.trim(), isEdited: true } : m));

        if (socket && connected) {
            socket.emit('edit_clan_message', {
                clanId: currentUserClanId,
                messageId,
                newContent: content.trim(),
                userId: currentUserId
            });
        } else {
            await api.editClanMessage(currentUserClanId, messageId, content.trim(), currentUserId);
        }
    }, [currentUserClanId, currentUserId, socket, connected]);

    // Delete Clan Message
    const deleteClanMessage = useCallback(async (messageId: string) => {
        if (!currentUserClanId || !currentUserId) return;

        setClanMessages(prev => prev.filter(m => m.id !== messageId));

        if (socket && connected) {
            socket.emit('delete_clan_message', {
                clanId: currentUserClanId,
                messageId,
                userId: currentUserId
            });
        } else {
            await api.deleteClanMessage(currentUserClanId, messageId, currentUserId);
        }
    }, [currentUserClanId, currentUserId, socket, connected]);

    // Total unread count
    const totalUnreadCount = useMemo(() => {
        const dmsUnread = Object.values(unreadByFriend).reduce((sum, count) => sum + count, 0);
        return unreadClanCount + dmsUnread;
    }, [unreadClanCount, unreadByFriend]);

    return (
        <ChatContext.Provider
            value={{
                isOpen,
                activeTab,
                activeFriend,
                unreadCount: totalUnreadCount,
                unreadClanCount,
                unreadByFriend,
                clanMessages,
                directMessages,
                clan,
                onlineUserIds,
                returnToLabel,
                openChat,
                closeChat,
                setActiveTab,
                setActiveFriend,
                sendDirectMessage,
                sendClanMessage,
                editClanMessage,
                deleteClanMessage,
                markClanAsRead,
                markFriendAsRead,
                refreshClan: loadClan
            }}
        >
            {children}
        </ChatContext.Provider>
    );
};
