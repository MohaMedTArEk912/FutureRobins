import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type { Clan, UserData, ClanChatMessage, AvatarConfig, ClanLogo, ClanLeaderboardEntry, ClassSummary, SkillTrack, ClassStudentAnalyticsItem, ClassWeakTopicItem } from '../../types';
import { ClanEmblem } from './ClassEmblem';
import { ClanLogoMakerModal } from './ClassLogoMakerModal';
import { ClanChatSection } from './ClassChatSection';
import { ClassCurriculumSection } from './ClassCurriculumSection';
import { ClassAnalyticsLogsSection } from './ClassAnalyticsLogsSection';
import { TeacherAiToolsSection } from './TeacherAiToolsSection';
import { Users, Trophy, Palette, LogOut, Star, UserPlus, Edit2, Check, X, MoreVertical, Trash2, ArrowUpCircle, ArrowDownCircle, Bell, Pin, Megaphone, MessageCircle, Lock, ExternalLink, Award, GraduationCap, Link2, Copy, RefreshCw, Compass, Plus, Settings, BarChart3, Sparkles } from 'lucide-react';
import Avatar from '../Avatar';
import { useNotification } from '../../context/NotificationContext';
import { useConfirm } from '../../hooks/useConfirm';
import ConfirmDialog from '../ConfirmDialog';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import { useUserProfileModal } from '../../context/UserProfileModalContext';

interface ClanHubProps {
    user: UserData;
    onUpdateUser: () => void;
}

export const ClanHub: React.FC<ClanHubProps> = ({ user, onUpdateUser }) => {
    const { isBento } = useTheme();
    const { showNotification } = useNotification();
    const { confirm, confirmState, handleCancel } = useConfirm();
    const { socket } = useSocket();
    const { openUserProfile } = useUserProfileModal();
    const isAdminAccount = user.role === 'admin' || Boolean(user.isAdmin);
    const isTeacherAccount = user.role === 'teacher' || isAdminAccount;
    const [myClasses, setMyClasses] = useState<ClassSummary[]>([]);
    const [activeClassId, setActiveClassId] = useState<string>(user.clanId || '');
    const [clan, setClan] = useState<Clan | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState<'my_clan' | 'my_classes' | 'create' | 'leaderboard'>(user.clanId ? 'my_clan' : 'my_classes');
    const [classSubTab, setClassSubTab] = useState<'curriculum' | 'analytics' | 'ai_tools' | 'invite' | 'members' | 'chat' | 'settings'>('curriculum');
    const [aiInitialTool, setAiInitialTool] = useState<'question_gen' | 'coach' | 'lesson_rubric'>('question_gen');
    const [aiCoachPrefill, setAiCoachPrefill] = useState<{ students: ClassStudentAnalyticsItem[]; weakTopics: ClassWeakTopicItem[] } | null>(null);
    const [availableTracks, setAvailableTracks] = useState<SkillTrack[]>([]);
    const [joinCodeInput, setJoinCodeInput] = useState('');
    const [joiningByCode, setJoiningByCode] = useState(false);
    const [regeneratingLink, setRegeneratingLink] = useState(false);

    // Class Leaderboard State
    const [clanLeaderboard, setClanLeaderboard] = useState<ClanLeaderboardEntry[]>([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

    // Inline Teacher Announcement Banner Editor (Zero Modals)
    const [isEditingBanner, setIsEditingBanner] = useState(false);
    const [bannerForm, setBannerForm] = useState({ text: '', url: '', buttonText: '' });
    const [createLogo, setCreateLogo] = useState<ClanLogo | null>(null);
    const [showCreateLogoMaker, setShowCreateLogoMaker] = useState(false);
    const [bannerUrlError, setBannerUrlError] = useState('');
    const [isSavingBanner, setIsSavingBanner] = useState(false);

    // Create Form State
    const [createForm, setCreateForm] = useState({ name: '', tag: '', description: '', isPublic: false, trackId: '' });

    // Inline Class Settings & Invite State (Zero Modals)
    const [editForm, setEditForm] = useState({ name: '', description: '', isPublic: true });
    const [inviteQuery, setInviteQuery] = useState('');
    const [inviteResults, setInviteResults] = useState<UserData[]>([]);

    // Chat State
    const [chatMessages, setChatMessages] = useState<ClanChatMessage[]>([]);
    const [lastViewed, setLastViewed] = useState<number>(0);
    const [unreadCount, setUnreadCount] = useState(0);

    const clanInvites = Array.isArray(user.clanInvites) ? user.clanInvites : [];

    // Inline Announcement Composer State (Zero Modals)
    const [isComposingAnnouncement, setIsComposingAnnouncement] = useState(false);
    const [announcementContent, setAnnouncementContent] = useState('');

    // Initial load of lastViewed from localStorage
    useEffect(() => {
        if (clan?.clanId) {
            const savedLastViewed = localStorage.getItem(`clan_chat_last_viewed_${clan.clanId}`);
            if (savedLastViewed) {
                setLastViewed(parseInt(savedLastViewed, 10));
            } else {
                setLastViewed(0);
            }
        }
    }, [clan?.clanId]);

    // Optimize: Calculate unread count whenever messages receive or lastViewed changes
    useEffect(() => {
        if (!chatMessages.length) {
            setUnreadCount(0);
            return;
        }

        // Count messages newer than lastViewed
        const count = chatMessages.filter(msg => new Date(msg.createdAt).getTime() > lastViewed).length;
        setUnreadCount(count);
    }, [chatMessages, lastViewed]);

    // Stabilized mark-as-read callback to eliminate infinite re-render / scroll hijacking loops
    const handleMarkChatAsRead = useCallback(() => {
        if (clan?.clanId) {
            const now = Date.now();
            setLastViewed(prev => (now - prev < 1500 ? prev : now));
            try {
                localStorage.setItem(`clan_chat_last_viewed_${clan.clanId}`, now.toString());
            } catch {
                // ignore storage issues
            }
            setUnreadCount(0);
        }
    }, [clan?.clanId]);


    // Load chat messages when clan is loaded
    useEffect(() => {
        if (clan?.chatMessages) {
            setChatMessages(clan.chatMessages);
        }
    }, [clan?.chatMessages]);

    // Socket connection for chat
    useEffect(() => {
        if (!socket || !clan?.clanId) return;

        socket.emit('join_clan_chat', clan.clanId);

        const handleNewMessage = (message: ClanChatMessage) => {
            setChatMessages(prev => {
                const withoutTemp = prev.filter(m => !(m.id.startsWith('temp_') && m.senderId === message.senderId && m.content === message.content));
                if (withoutTemp.some(m => m.id === message.id)) {
                    return withoutTemp;
                }
                return [...withoutTemp, message];
            });

            // If chat or clan view is open, mark as read
            if (view === 'my_clan') {
                const now = Date.now();
                setLastViewed(now);
                localStorage.setItem(`clan_chat_last_viewed_${clan.clanId}`, now.toString());
            }
        };

        const handleMessageEdited = ({ messageId, newContent, isEdited, updatedAt }: { messageId: string, newContent: string, isEdited?: boolean, updatedAt?: string }) => {
            setChatMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, content: newContent, isEdited: isEdited ?? true, updatedAt: updatedAt ?? new Date().toISOString() } : msg
            ));
        };

        const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
            setChatMessages(prev => prev.filter(msg => msg.id !== messageId));
        };

        const handleChatError = ({ message }: { message: string }) => {
            showNotification('error', message);
        };

        socket.on('new_clan_message', handleNewMessage);
        socket.on('clan_message_edited', handleMessageEdited);
        socket.on('clan_message_deleted', handleMessageDeleted);
        socket.on('chat_error', handleChatError);

        // Listen for real-time kick notifications
        const handleKickedFromClan = (data: { message?: string }) => {
            showNotification('error', data.message || 'You have been removed from the class');
            setClan(null);
            setView('my_classes');
            onUpdateUser();
        };

        socket.on('kicked_from_clan', handleKickedFromClan);

        return () => {
            socket.off('new_clan_message', handleNewMessage);
            socket.off('clan_message_edited', handleMessageEdited);
            socket.off('clan_message_deleted', handleMessageDeleted);
            socket.off('chat_error', handleChatError);
            socket.off('kicked_from_clan', handleKickedFromClan);
            socket.emit('leave_clan_chat', clan.clanId);
        };
    }, [socket, clan?.clanId, view, showNotification, onUpdateUser]);

    const handleSendMessage = useCallback(async (content: string) => {
        if (!clan?.clanId || !content.trim()) return;

        const role = (clan.members?.find(m => m.userId === user.userId)?.role) || (clan.leaderId === user.userId ? 'leader' : 'member');
        const tempMsg: ClanChatMessage = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            senderId: user.userId,
            senderName: user.name,
            senderAvatar: user.avatar,
            senderRole: role,
            content: content.trim(),
            createdAt: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, tempMsg]);

        if (socket?.connected) {
            socket.emit('send_clan_message', {
                clanId: clan.clanId,
                senderId: user.userId,
                senderName: user.name,
                senderAvatar: user.avatar,
                senderRole: role,
                content: content.trim()
            });
        } else {
            try {
                const saved = await api.sendClanMessage(clan.clanId, content.trim(), user.userId);
                setChatMessages(prev => prev.map(m => m.id === tempMsg.id ? saved : m));
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to send message';
                showNotification('error', msg);
                setChatMessages(prev => prev.filter(m => m.id !== tempMsg.id));
            }
        }

        const now = Date.now();
        setLastViewed(now);
        localStorage.setItem(`clan_chat_last_viewed_${clan.clanId}`, now.toString());
        setUnreadCount(0);
    }, [clan, user, socket, showNotification]);

    const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
        if (!clan?.clanId || !newContent.trim()) return;

        setChatMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, isEdited: true, updatedAt: new Date().toISOString() } : m));

        if (socket?.connected) {
            socket.emit('edit_clan_message', {
                clanId: clan.clanId,
                messageId,
                newContent: newContent.trim(),
                userId: user.userId
            });
        } else {
            try {
                await api.editClanMessage(clan.clanId, messageId, newContent.trim(), user.userId);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to edit message';
                showNotification('error', msg);
            }
        }
    }, [clan?.clanId, socket, user.userId, showNotification]);

    const handleDeleteMessage = useCallback(async (messageId: string) => {
        if (!clan?.clanId) return;

        setChatMessages(prev => prev.filter(m => m.id !== messageId));

        if (socket?.connected) {
            socket.emit('delete_clan_message', {
                clanId: clan.clanId,
                messageId,
                userId: user.userId
            });
        } else {
            try {
                await api.deleteClanMessage(clan.clanId, messageId, user.userId);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to delete message';
                showNotification('error', msg);
            }
        }
    }, [clan?.clanId, socket, user.userId, showNotification]);

    const fetchClanLeaderboard = useCallback(async (showBlockingSpinner = false, forceRefresh = false) => {
        if (showBlockingSpinner || clanLeaderboard.length === 0) {
            setLoadingLeaderboard(true);
        }
        try {
            const data = await api.getClanLeaderboard(forceRefresh);
            setClanLeaderboard(Array.isArray(data) ? data : []);
        } catch {
            showNotification('error', 'Failed to fetch class rankings');
        } finally {
            setLoadingLeaderboard(false);
        }
    }, [showNotification, clanLeaderboard.length]);

    const isValidBannerUrl = (url: string) => {
        if (!url.trim()) return true;
        if (url.startsWith('/') && !url.startsWith('//')) return true;
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    };

    
    const handleSaveClanLogo = async (newLogo: ClanLogo) => {
        if (!clan) return;
        try {
            await api.updateClan(clan.clanId, { logo: newLogo }, user.userId);
            await loadClan(clan.clanId);
            showNotification('success', '🎉 Class emblem updated successfully!');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to update class emblem';
            showNotification('error', msg);
        }
    };

    const handleSaveBanner = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clan) return;
        if (bannerForm.url && !isValidBannerUrl(bannerForm.url)) {
            setBannerUrlError('Please provide a valid URL starting with http://, https://, or / (e.g. https://example.com)');
            return;
        }
        setBannerUrlError('');
        setIsSavingBanner(true);
        try {
            await api.updateClan(clan.clanId, {
                announcementBanner: {
                    text: bannerForm.text.trim(),
                    url: bannerForm.url.trim(),
                    buttonText: (bannerForm.buttonText || '').trim()
                }
            }, user.userId);
            await loadClan(clan.clanId);
            setIsEditingBanner(false);
            showNotification('success', 'Announcement banner updated successfully!');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to update announcement banner';
            showNotification('error', msg);
        } finally {
            setIsSavingBanner(false);
        }
    };

    const loadClan = useCallback(async (clanId: string, showBlockingSpinner = false, forceRefresh = false) => {
        if (showBlockingSpinner) {
            setLoading(true);
        }
        try {
            const data = await api.getClan(clanId, user.userId, forceRefresh);
            setClan(data);
            setActiveClassId(data.clanId);
            if (data.chatMessages) {
                setChatMessages(data.chatMessages);
            }
            setEditForm({ name: data.name, description: data.description, isPublic: data.isPublic });
            if (data.announcementBanner) {
                setBannerForm({
                    text: data.announcementBanner.text || '',
                    url: data.announcementBanner.url || '',
                    buttonText: data.announcementBanner.buttonText || ''
                });
            }
        } catch {
            setError('Failed to load class');
        } finally {
            setLoading(false);
        }
    }, [user.userId]);

    const refreshMyClasses = useCallback(async (preferredClanId?: string) => {
        try {
            const classes = await api.getMyClasses(user.userId);
            const list = Array.isArray(classes) ? classes : [];
            setMyClasses(list);

            const targetId = preferredClanId || activeClassId || user.clanId || list[0]?.clanId || '';
            if (targetId && list.some(c => c.clanId === targetId)) {
                setActiveClassId(targetId);
                await loadClan(targetId, false, true);
                setView('my_clan');
            } else if (list.length > 0) {
                setActiveClassId(list[0].clanId);
                await loadClan(list[0].clanId, false, true);
                setView('my_clan');
            } else if (user.clanId) {
                await loadClan(user.clanId, false, true);
                setView('my_clan');
            } else {
                setClan(null);
                setView('my_classes');
                setLoading(false);
            }
        } catch {
            if (user.clanId) {
                await loadClan(user.clanId, false);
            } else {
                setView('my_classes');
                setLoading(false);
            }
        }
    }, [user.userId, user.clanId, activeClassId, loadClan]);

    useEffect(() => {
        refreshMyClasses();
        fetchClanLeaderboard(false);
        api.getSkillTracks().then(t => setAvailableTracks(Array.isArray(t) ? t : [])).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.userId, user.clanId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const created = await api.createClan({
                ...createForm,
                trackId: createForm.trackId || undefined,
                logo: createLogo || undefined
            }, user.userId);
            showNotification('success', `Class "${created.name}" created!`);
            setCreateForm({ name: '', tag: '', description: '', isPublic: false, trackId: '' });
            setCreateLogo(null);
            onUpdateUser();
            await refreshMyClasses(created.clanId);
            setView('my_clan');
            setClassSubTab('curriculum');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to create class';
            setError(msg);
            showNotification('error', msg);
        }
    };

    const handleJoinByCode = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = joinCodeInput.trim();
        if (!trimmed) return;
        const match = trimmed.match(/\/join\/([A-Za-z0-9]+)/i);
        const code = match ? match[1] : trimmed;

        setJoiningByCode(true);
        try {
            const res = await api.joinClassByInvite(code, user.userId);
            showNotification('success', res.message || 'Joined class!');
            setJoinCodeInput('');
            onUpdateUser();
            await refreshMyClasses(res.clan?.clanId);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Invalid invite code');
        } finally {
            setJoiningByCode(false);
        }
    };

    const getInviteUrl = (code?: string) => {
        if (!code || typeof window === 'undefined') return '';
        return `${window.location.origin}/classes/join/${code}`;
    };

    const handleCopyInviteLink = (code?: string) => {
        const url = getInviteUrl(code);
        if (!url) return;
        navigator.clipboard.writeText(url);
        showNotification('success', 'Class invite link copied to clipboard!');
    };

    const handleRegenerateInvite = async () => {
        if (!clan) return;
        setRegeneratingLink(true);
        try {
            const res = await api.regenerateInviteCode(clan.clanId, user.userId);
            setClan(prev => prev ? { ...prev, inviteCode: res.inviteCode } : null);
            showNotification('success', 'Invite link regenerated!');
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to regenerate invite link');
        } finally {
            setRegeneratingLink(false);
        }
    };

    const handleUpdateClan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clan) return;
        try {
            await api.updateClan(clan.clanId, editForm, user.userId);
            loadClan(clan.clanId, false, true);
            showNotification('success', 'Class details updated!');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to update class';
            setError(msg);
        }
    };

    const handleLeave = async () => {
        if (!clan) return;
        const confirmed = await confirm({
            title: 'Leave Class',
            message: `Are you sure you want to leave "${clan.name}"?`,
            confirmText: 'Leave',
            type: 'danger'
        });
        if (!confirmed) return;
        try {
            await api.leaveClan(user.userId);
            setClan(null);
            onUpdateUser();
            await refreshMyClasses();
            showNotification('success', 'You have left the class');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to leave class';
            showNotification('error', msg);
        }
    };

    const handleInviteSearch = async () => {
        if (!inviteQuery.trim() || !clan) return;
        try {
            const results = await api.searchUsers(inviteQuery);
            const currentMemberIds = new Set((clan.members || []).map(m => m.userId));
            setInviteResults(results.filter((u: UserData) => !currentMemberIds.has(u.userId)));
        } catch (err) {
            console.error(err);
        }
    };

    const sendInvite = async (targetId: string) => {
        if (!clan) return;
        try {
            await api.inviteToClan(clan.clanId, targetId, user.userId);
            showNotification('success', 'Class invite sent!');
            setInviteResults(inviteResults.filter(u => u.userId !== targetId));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to send invite';
            showNotification('error', msg);
        }
    };

    const handleKick = async (targetId: string) => {
        if (!clan) return;
        const confirmed = await confirm({
            title: 'Remove Member',
            message: 'Are you sure you want to remove this student from the class?',
            confirmText: 'Remove',
            type: 'danger'
        });
        if (!confirmed) return;
        try {
            // ISSUE: Frontend caching old clan data, user state not refreshed
            // FIX: Optimistic update + full refresh + WebSocket notification
            
            // 1. Optimistic UI update (removes stale display)
            setClan(prevClan => {
                if (!prevClan) return null;
                return {
                    ...prevClan,
                    members: prevClan.members.filter(m => m.userId !== targetId)
                };
            });

            // 2. Execute kick on backend
            await api.kickMember(clan.clanId, targetId, user.userId);

            // 3. Full refresh from server (clear cache)
            await loadClan(clan.clanId);
            // 4. Refresh user state (clear any stale clanId)
            onUpdateUser();

            // 5. WebSocket notification to kicked user
            if (socket && socket.connected) {
                socket.emit('user_kicked_from_clan', {
                    targetUserId: targetId,
                    clanId: clan.clanId,
                    clanName: clan.name
                });
            }

            showNotification('success', 'Member removed');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to remove member';
            showNotification('error', msg);
            // Revert optimistic update
            loadClan(clan.clanId);
        }
    };

    const handleRoleUpdate = async (targetId: string, newRole: 'elder' | 'member') => {
        if (!clan) return;
        try {
            await api.updateMemberRole(clan.clanId, targetId, newRole, user.userId);
            loadClan(clan.clanId);
            showNotification('success', 'Role updated');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to update role';
            showNotification('error', msg);
        }
    };

    const handleRequestAction = async (targetId: string, accept: boolean) => {
        if (!clan) return;
        try {
            await api.handleJoinRequest(clan.clanId, targetId, accept, user.userId);
            loadClan(clan.clanId);
            showNotification('success', accept ? 'Request accepted' : 'Request rejected');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to process request';
            showNotification('error', msg);
        }
    };

    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    if (loading && !clan) return (
        <div className="flex items-center justify-center py-20">
            <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">Loading Class...</p>
            </div>
        </div>
    );

    // View: Active Class (when user belongs to at least one class and is not creating a new one)
    if (clan && view !== 'create' && (myClasses.length > 0 || user.clanId)) {
        const isLeader = clan.members.some(m => m.userId === user.userId && m.role === 'leader') || clan.leaderId === user.userId || user.role === 'admin';
        const isElder = clan.members.some(m => m.userId === user.userId && m.role === 'elder');

        return (
            <div className="space-y-6 relative">
                {/* Multi-Class Switcher Bar (especially for teachers managing multiple classes) */}
                {(myClasses.length > 1 || isTeacherAccount) && (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 overflow-x-auto py-1">
                            {myClasses.map(cls => {
                                const isActiveCls = cls.clanId === clan.clanId && view === 'my_clan';
                                return (
                                    <button
                                        key={cls.clanId}
                                        type="button"
                                        onClick={() => {
                                            setView('my_clan');
                                            loadClan(cls.clanId, false, true);
                                        }}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shrink-0 cursor-pointer transition ${
                                            isActiveCls
                                                ? isBento
                                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-indigo-600 text-white shadow'
                                                : isBento
                                                    ? 'bg-white text-black border-2 border-black/30 hover:border-black'
                                                    : 'bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10'
                                        }`}
                                    >
                                        <GraduationCap className="w-3.5 h-3.5" />
                                        <span>[{cls.tag}] {cls.name}</span>
                                        <span className="text-[10px] opacity-70">({cls.memberCount})</span>
                                    </button>
                                );
                            })}
                        </div>
                        {isAdminAccount && (
                            <button
                                type="button"
                                onClick={() => setView('create')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0 ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                                }`}
                            >
                                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                <span>New Class</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Class Hub Sub-Navigation */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className={`inline-flex items-center gap-1.5 p-1 rounded-2xl flex-wrap ${
                        isBento
                            ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000]'
                            : 'bg-white/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10'
                    }`}>
                        <button
                            type="button"
                            onClick={() => {
                                setView('my_clan');
                                loadClan(clan.clanId, false);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                view === 'my_clan'
                                    ? (isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-violet-600 text-white shadow-md shadow-violet-600/30')
                                    : (isBento ? 'text-black hover:bg-[#fef9c3]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')
                            }`}
                        >
                            <GraduationCap className="w-3.5 h-3.5" />
                            <span>My Class</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setView('leaderboard');
                                fetchClanLeaderboard(false);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                view === 'leaderboard'
                                    ? (isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-violet-600 text-white shadow-md shadow-violet-600/30')
                                    : (isBento ? 'text-black hover:bg-[#fef9c3]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')
                            }`}
                        >
                            <Award className="w-3.5 h-3.5" />
                            <span>Class Rankings</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setView('my_clan');
                                setClassSubTab('chat');
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer relative ${
                                view === 'my_clan' && classSubTab === 'chat'
                                    ? (isBento ? 'bg-[#fde047] text-black border-2 border-black' : 'bg-indigo-600 text-white')
                                    : (isBento ? 'text-black hover:bg-[#fef9c3]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')
                            }`}
                        >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Class Chat</span>
                            {unreadCount > 0 && (
                                <span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                                    isBento ? 'bg-[#ff6b6b] text-black border border-black' : 'bg-red-500 text-white'
                                }`}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Prominent Theme-Aware Leader Announcement Banner */}
                {(clan.announcementBanner?.text || isLeader) && (
                    <div className={`p-4 sm:p-5 rounded-3xl transition-all relative overflow-hidden ${
                        isBento
                            ? 'bg-[#fef08a] text-black border-3 border-black shadow-[6px_6px_0px_#000]'
                            : 'bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-violet-500/15 border-2 border-amber-500/30 text-slate-900 dark:text-white shadow-xl backdrop-blur-xl'
                    }`}>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                    isBento
                                        ? 'bg-[#facc15] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/30'
                                }`}>
                                    <Megaphone className="w-6 h-6 animate-bounce" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                            isBento ? 'bg-black text-white' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold border border-amber-500/30'
                                        }`}>
                                            📢 Leader Announcement
                                        </span>
                                        {clan.announcementBanner?.updatedAt && (
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                                {new Date(clan.announcementBanner.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm sm:text-base font-bold leading-relaxed break-words ${
                                        isBento ? 'text-black' : 'text-slate-900 dark:text-white'
                                    }`}>
                                        {clan.announcementBanner?.text || (isLeader ? 'No announcement banner published yet. Click "Edit Banner" to post clan news, links, or alerts!' : '')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end flex-wrap">
                                {clan.announcementBanner?.url && (
                                    <a
                                        href={clan.announcementBanner.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] active:translate-y-0.5'
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 active:scale-95'
                                        }`}
                                    >
                                        <span>{clan.announcementBanner.buttonText || 'Open Link'}</span>
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                )}
                                {isLeader && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!isEditingBanner) {
                                                setBannerForm({
                                                    text: clan.announcementBanner?.text || '',
                                                    url: clan.announcementBanner?.url || '',
                                                    buttonText: clan.announcementBanner?.buttonText || ''
                                                });
                                                setBannerUrlError('');
                                            }
                                            setIsEditingBanner(prev => !prev);
                                        }}
                                        className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fef9c3] active:translate-y-0.5'
                                                : 'glass-card hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-white border border-slate-200 dark:border-white/10'
                                        }`}
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        <span>{isEditingBanner ? 'Close Editor' : 'Edit Banner'}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Inline Announcement Banner Editor (Zero Modal) */}
                        {isEditingBanner && isLeader && (
                            <form onSubmit={handleSaveBanner} className="mt-5 pt-5 border-t border-black/15 dark:border-white/15 space-y-4">
                                <div>
                                    <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isBento ? 'text-black' : 'text-gray-700 dark:text-gray-200'}`}>
                                        Announcement Message
                                    </label>
                                    <textarea
                                        required
                                        value={bannerForm.text}
                                        onChange={(e) => setBannerForm(prev => ({ ...prev, text: e.target.value }))}
                                        placeholder="e.g. Session 10 live tonight at 8PM! Finish Travelo Footer homework..."
                                        rows={2}
                                        className={`w-full p-3 rounded-xl font-medium text-sm focus:outline-none transition-all resize-none ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/15 text-gray-900 dark:text-white'
                                        }`}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-black uppercase tracking-wider">Action Link URL (Optional)</label>
                                            {bannerForm.url && (
                                                <button type="button" onClick={() => setBannerForm(prev => ({ ...prev, url: '', buttonText: '' }))} className="text-xs text-rose-500 font-bold cursor-pointer">
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={bannerForm.url}
                                            onChange={(e) => {
                                                setBannerForm(prev => ({ ...prev, url: e.target.value }));
                                                if (bannerUrlError) setBannerUrlError('');
                                            }}
                                            placeholder="https://... or /study"
                                            className={`w-full p-2.5 rounded-xl font-mono text-xs ${
                                                isBento ? 'bg-white text-black border-2 border-black' : 'bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/15'
                                            }`}
                                        />
                                        {bannerUrlError && <p className="text-xs text-rose-500 font-bold mt-1">{bannerUrlError}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider mb-1">Button Label (Optional)</label>
                                        <input
                                            type="text"
                                            value={bannerForm.buttonText}
                                            onChange={(e) => setBannerForm(prev => ({ ...prev, buttonText: e.target.value }))}
                                            placeholder="e.g. Join Live Session"
                                            maxLength={40}
                                            className={`w-full p-2.5 rounded-xl font-medium text-xs ${
                                                isBento ? 'bg-white text-black border-2 border-black' : 'bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/15'
                                            }`}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mr-1">Presets:</span>
                                        {[
                                            { label: 'Discord', url: 'https://discord.gg/', btn: 'Join Discord' },
                                            { label: 'WhatsApp', url: 'https://chat.whatsapp.com/', btn: 'WhatsApp Group' },
                                            { label: 'Study', url: '/study', btn: 'Study Resources' }
                                        ].map(p => (
                                            <button
                                                key={p.label}
                                                type="button"
                                                onClick={() => setBannerForm(prev => ({ ...prev, url: p.url, buttonText: p.btn }))}
                                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/70 dark:bg-white/10 border border-black/15 cursor-pointer"
                                            >
                                                + {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setIsEditingBanner(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-black/10 dark:bg-white/10 cursor-pointer">
                                            Cancel
                                        </button>
                                        <button type="submit" disabled={isSavingBanner} className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-emerald-600 text-white cursor-pointer">
                                            {isSavingBanner ? 'Saving...' : 'Save Banner'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* Conditional View Rendering */}
                {view === 'leaderboard' && (
                    <div className={`p-6 sm:p-8 rounded-[2.5rem] transition-all ${
                        isBento
                            ? 'bg-white text-black border-3 border-black shadow-[6px_6px_0px_#000]'
                            : 'bg-white/90 dark:bg-[#13141f] border border-gray-200 dark:border-white/10 shadow-xl backdrop-blur-xl'
                    }`}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-white/10">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                    isBento ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-amber-500 text-white'
                                }`}>
                                    <Award className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Class Rankings</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">Top performing classes across tracks and homework</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchClanLeaderboard(true)}
                                disabled={loadingLeaderboard}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isBento ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-slate-100' : 'glass-card border border-slate-200 dark:border-white/10'
                                }`}
                            >
                                {loadingLeaderboard ? 'Refreshing...' : 'Refresh Rankings'}
                            </button>
                        </div>

                        {loadingLeaderboard && clanLeaderboard.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto mb-3"></div>
                                <p className="text-xs font-bold text-gray-500">Loading class rankings...</p>
                            </div>
                        ) : clanLeaderboard.length === 0 ? (
                            <div className="text-center py-16">
                                <Trophy className="w-12 h-12 mx-auto text-gray-400 mb-2 opacity-50" />
                                <h3 className="text-lg font-black uppercase">No Class Rankings Yet</h3>
                                <p className="text-xs text-gray-500 mt-1">Classes will appear here as they earn XP through homework and quizzes.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {clanLeaderboard.map((item, index) => {
                                    const isMyClan = user.clanId && (item.clanId === user.clanId);

                                    return (
                                        <div
                                            key={item.clanId}
                                            className={`p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                                                isBento
                                                    ? (isMyClan
                                                        ? 'bg-[#bef264] text-black border-2.5 border-black shadow-[4px_4px_0px_#000]'
                                                        : 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]')
                                                    : (isMyClan
                                                        ? 'bg-violet-500/10 border-2 border-violet-500 text-slate-900 dark:text-white shadow-md'
                                                        : 'bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 text-slate-800 dark:text-slate-200 hover:border-violet-500/30')
                                            }`}
                                        >
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <ClanEmblem
                                                    logo={item.logo}
                                                    tag={item.tag}
                                                    name={item.name}
                                                    size="sm"
                                                />
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                                    index === 0
                                                        ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : index === 1
                                                            ? 'bg-slate-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                            : index === 2
                                                                ? 'bg-amber-600 text-white border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                : isBento
                                                                    ? 'bg-slate-100 text-black border border-black'
                                                                    : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                                                }`}>
                                                    #{index + 1}
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-black text-base truncate">
                                                            [{item.tag}] {item.name}
                                                        </h3>
                                                        {isMyClan && (
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                                isBento ? 'bg-black text-white' : 'bg-violet-600 text-white'
                                                            }`}>
                                                                Your Class
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs opacity-75 font-medium truncate mt-0.5">
                                                        Teacher: {item.leaderName || 'Unknown'} • Level {item.level}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                                                <div className="text-right">
                                                    <div className="font-tabular font-black text-sm sm:text-base">
                                                        {item.totalXP?.toLocaleString() || 0} XP
                                                    </div>
                                                    <div className="text-[10px] opacity-60 font-bold uppercase tracking-wider">
                                                        {item.memberCount || 1} Members
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {view === 'my_clan' && (
                    <div className={`rounded-[1.75rem] sm:rounded-[2.5rem] overflow-hidden ${
                        isBento
                            ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                            : 'bg-white dark:bg-[#13141f] border border-gray-200 dark:border-white/10 shadow-sm'
                    }`}>
                    {/* Clan Header */}
                    <div className="relative bg-gradient-to-r from-violet-600 to-indigo-600 p-5 pt-14 sm:p-8 sm:pt-8 text-white overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
                        <div className="absolute top-4 right-4 flex gap-2 z-10">
                            {isAdminAccount && (
                                <button onClick={() => setClassSubTab('settings')} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-sm transition-colors text-white/80 hover:text-white cursor-pointer" title="Class Settings & Emblem Studio">
                                    <Settings className="w-5 h-5" />
                                </button>
                            )}
                            <button onClick={handleLeave} className="p-2.5 bg-white/10 hover:bg-red-500/50 rounded-xl backdrop-blur-sm transition-colors text-white/80 hover:text-white cursor-pointer" title="Leave Class">
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="relative flex flex-col md:flex-row items-center gap-6">
                            <div className="relative group">
                                <ClanEmblem
                                    logo={clan.logo}
                                    tag={clan.tag}
                                    name={clan.name}
                                    size="2xl"
                                    interactive={isAdminAccount}
                                    onClick={() => isAdminAccount && setClassSubTab('settings')}
                                />
                                {isAdminAccount && (
                                    <button
                                        type="button"
                                        onClick={() => setClassSubTab('settings')}
                                        className={`absolute -bottom-1 -right-1 p-2 rounded-xl transition-transform hover:scale-110 cursor-pointer ${
                                            isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-white text-violet-700 shadow-md'
                                        }`}
                                        title="Change Class Emblem"
                                    >
                                        <Palette className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="text-center md:text-left">
                                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 justify-center md:justify-start mb-2">
                                    <h1 className="text-xl sm:text-3xl font-black uppercase tracking-tight">
                                        [{clan.tag}] {clan.name}
                                    </h1>
                                    {isAdminAccount && (
                                        <button
                                            type="button"
                                            onClick={() => setClassSubTab('settings')}
                                            className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                                isBento
                                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                                    : 'bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm'
                                            }`}
                                        >
                                            <Palette className="w-3.5 h-3.5" />
                                            <span>Settings &amp; Emblem</span>
                                        </button>
                                    )}
                                </div>
                                <p className="text-white/70 max-w-xl text-sm font-medium">{clan.description || 'No description provided.'}</p>
                                <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
                                    <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${
                                        isBento
                                            ? 'bg-white text-black border border-black shadow-[1px_1px_0px_#000]'
                                            : 'bg-white/10 backdrop-blur-sm text-white'
                                    }`}>
                                        <Trophy className="w-3.5 h-3.5 text-yellow-300" />
                                        Lvl {clan.level}
                                    </span>
                                    <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${
                                        isBento
                                            ? 'bg-white text-black border border-black shadow-[1px_1px_0px_#000]'
                                            : 'bg-white/10 backdrop-blur-sm text-white'
                                    }`}>
                                        <Star className="w-3.5 h-3.5 text-blue-300" />
                                        {clan.totalXP.toLocaleString()} XP
                                    </span>
                                    <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${
                                        isBento
                                            ? 'bg-white text-black border border-black shadow-[1px_1px_0px_#000]'
                                            : 'bg-white/10 backdrop-blur-sm text-white'
                                    }`}>
                                        <Users className="w-3.5 h-3.5 text-green-300" />
                                        {clan.members.length} Members
                                    </span>
                                    {isLeader && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyInviteLink(clan.inviteCode)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition ${
                                                    isBento
                                                        ? 'bg-[#fde047] text-black border border-black shadow-[1px_1px_0px_#000]'
                                                        : 'bg-white text-indigo-700 hover:bg-indigo-50 shadow'
                                                }`}
                                            >
                                                <Link2 className="w-3.5 h-3.5" />
                                                <span>Copy Invite Link</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setClassSubTab('invite')}
                                                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition ${
                                                    isBento
                                                        ? 'bg-[#bef264] text-black border border-black shadow-[1px_1px_0px_#000]'
                                                        : 'bg-emerald-400 text-black hover:bg-emerald-300 shadow'
                                                }`}
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                                <span>Invite Students</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Inside-Class Tab Switcher */}
                    <div className={`px-3 sm:px-6 py-2.5 sm:py-3 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap ${
                        isBento ? 'border-black/15' : 'border-gray-200 dark:border-white/10'
                    }`}>
                        {([
                            { id: 'curriculum' as const, label: 'Sessions & Board', icon: Compass },
                            ...(isLeader ? [
                                { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
                                { id: 'ai_tools' as const, label: 'AI Studio', icon: Sparkles },
                                { id: 'invite' as const, label: 'Invites', icon: UserPlus }
                            ] : []),
                            { id: 'members' as const, label: `Roster (${clan.members.length})`, icon: Users },
                            { id: 'chat' as const, label: 'Class Chat', icon: MessageCircle },
                            ...(isAdminAccount ? [{ id: 'settings' as const, label: 'Settings', icon: Settings }] : [])
                        ]).map(tab => {
                            const Icon = tab.icon;
                            const active = classSubTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setClassSubTab(tab.id)}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${
                                        active
                                            ? isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'text-white bg-indigo-600 shadow-sm'
                                            : isBento
                                                ? 'text-black/75 hover:text-black hover:bg-black/5 border-2 border-transparent'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5 shrink-0" />
                                    <span>{tab.label}</span>
                                    {tab.id === 'chat' && unreadCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-red-500 text-white">{unreadCount}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="p-4 sm:p-6 md:p-8">
                        {classSubTab === 'curriculum' && (
                            <ClassCurriculumSection
                                clan={clan}
                                user={user}
                                isTeacherOwner={isLeader}
                                onRefreshClan={() => loadClan(clan.clanId, false, true)}
                            />
                        )}

                        {classSubTab === 'chat' && (
                        <>
                        {/* Announcements Section */}
                        <div className="mb-10">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                                        <Megaphone className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                        Announcements
                                    </h2>
                                </div>
                                {(isLeader || clan.members.find(m => m.userId === user.userId)?.role === 'elder') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAnnouncementContent('');
                                            setIsComposingAnnouncement(prev => !prev);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-500/20 cursor-pointer"
                                    >
                                        <Megaphone className="w-4 h-4" />
                                        <span>{isComposingAnnouncement ? 'Cancel' : 'Post New'}</span>
                                    </button>
                                )}
                            </div>

                            {/* Inline Announcement Composer (Zero Modal) */}
                            {isComposingAnnouncement && (isLeader || clan.members.find(m => m.userId === user.userId)?.role === 'elder') && (
                                <div className={`mb-6 p-5 rounded-2xl space-y-3 ${
                                    isBento
                                        ? 'bg-[#f5f3ff] border-2 border-black shadow-[4px_4px_0px_#000]'
                                        : 'bg-violet-500/5 border border-violet-500/25'
                                }`}>
                                    <label className="block text-xs font-black uppercase tracking-wider">New Class Announcement</label>
                                    <textarea
                                        value={announcementContent}
                                        onChange={(e) => setAnnouncementContent(e.target.value)}
                                        placeholder="Share important updates, session notes, or reminders with students..."
                                        rows={4}
                                        className={`w-full p-3.5 rounded-xl font-medium text-sm focus:outline-none resize-none ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black'
                                                : 'bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10'
                                        }`}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsComposingAnnouncement(false);
                                                setAnnouncementContent('');
                                            }}
                                            className="px-4 py-2 rounded-xl text-xs font-bold bg-black/10 dark:bg-white/10 cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!announcementContent.trim()) {
                                                    showNotification('error', 'Please enter announcement content');
                                                    return;
                                                }
                                                try {
                                                    await api.createClanAnnouncement(clan.clanId, announcementContent.trim(), user.userId);
                                                    loadClan(clan.clanId);
                                                    setIsComposingAnnouncement(false);
                                                    setAnnouncementContent('');
                                                    showNotification('success', 'Announcement posted successfully!');
                                                } catch (e) {
                                                    const msg = e instanceof Error ? e.message : 'Failed to post announcement';
                                                    showNotification('error', msg);
                                                }
                                            }}
                                            className={`px-5 py-2 rounded-xl text-xs font-black uppercase cursor-pointer ${
                                                isBento ? 'bg-[#bef264] text-black border-2 border-black' : 'bg-violet-600 hover:bg-violet-700 text-white'
                                            }`}
                                        >
                                            Post Announcement
                                        </button>
                                    </div>
                                </div>
                            )}

                            {clan.announcements && clan.announcements.length > 0 ? (
                                <div className="grid gap-4">
                                    {clan.announcements.map((ann) => {
                                        const author = clan.members.find(m => m.userId === ann.authorId);
                                        const announcementDate = new Date(ann.createdAt);
                                        const isToday = announcementDate.toDateString() === new Date().toDateString();
                                        const isYesterday = announcementDate.toDateString() === new Date(Date.now() - 86400000).toDateString();
                                        
                                        let dateDisplay = '';
                                        if (isToday) {
                                            dateDisplay = `Today at ${announcementDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
                                        } else if (isYesterday) {
                                            dateDisplay = `Yesterday at ${announcementDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
                                        } else {
                                            dateDisplay = announcementDate.toLocaleDateString('en-US', { 
                                                month: 'short', 
                                                day: 'numeric', 
                                                year: announcementDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined 
                                            });
                                        }

                                        return (
                                            <div 
                                                key={ann.id} 
                                                className={`p-5 rounded-xl border transition-all hover:shadow-lg ${
                                                    ann.isPinned 
                                                        ? 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-900/10 border-orange-300 dark:border-orange-800 shadow-sm' 
                                                        : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                                } relative group`}
                                            >
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                        {author?.avatar ? (
                                                            <Avatar config={author.avatar} size="sm" className="w-full h-full rounded-lg" />
                                                        ) : (
                                                            <span className="text-white font-bold text-sm">
                                                                {ann.authorName ? ann.authorName.substring(0, 2).toUpperCase() : '??'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {ann.isPinned && (
                                                                <Pin className="w-3.5 h-3.5 text-orange-500 fill-orange-500 flex-shrink-0" />
                                                            )}
                                                            <span className="font-bold text-gray-900 dark:text-white text-sm truncate">
                                                                {ann.authorName}
                                                            </span>
                                                            {author?.role === 'leader' && (
                                                                <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider flex-shrink-0">
                                                                    Teacher
                                                                </span>
                                                            )}
                                                            {author?.role === 'elder' && (
                                                                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider flex-shrink-0">
                                                                    Assistant
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {dateDisplay}
                                                        </span>
                                                    </div>
                                                    {(isLeader || clan.members.find(m => m.userId === user.userId)?.role === 'elder') && (
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        await api.pinClanAnnouncement(clan.clanId, ann.id, user.userId);
                                                                        loadClan(clan.clanId);
                                                                    } catch (e) { const msg = e instanceof Error ? e.message : 'Failed to pin announcement'; showNotification('error', msg); }
                                                                }}
                                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-orange-500 transition-colors"
                                                                title={ann.isPinned ? "Unpin" : "Pin"}
                                                            >
                                                                <Pin className={`w-4 h-4 ${ann.isPinned ? 'text-orange-500 fill-orange-500' : ''}`} />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    const confirmed = await confirm({
                                                                        title: 'Delete Announcement',
                                                                        message: 'Are you sure you want to delete this announcement?',
                                                                        confirmText: 'Delete',
                                                                        type: 'danger'
                                                                    });
                                                                    if (!confirmed) return;
                                                                    try {
                                                                        await api.deleteClanAnnouncement(clan.clanId, ann.id, user.userId);
                                                                        loadClan(clan.clanId);
                                                                    } catch (e) { const msg = e instanceof Error ? e.message : 'Failed to delete announcement'; showNotification('error', msg); }
                                                                }}
                                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="pl-[52px]">
                                                    <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap break-words">
                                                        {ann.content}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                                    <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p className="text-sm font-medium">No announcements yet.</p>
                                    <p className="text-xs mt-1 opacity-75">Teacher updates and session reminders will appear here!</p>
                                </div>
                            )}
                        </div>

                        {/* Dedicated Clan Chat Section */}
                        <div id="clan-chat" className="mb-10">
                            <ClanChatSection
                                clan={clan}
                                currentUser={user}
                                messages={chatMessages}
                                onSendMessage={handleSendMessage}
                                onEditMessage={handleEditMessage}
                                onDeleteMessage={handleDeleteMessage}
                                isLeader={isLeader}
                                isElder={isElder}
                                isBento={isBento}
                                onMarkAsRead={handleMarkChatAsRead}
                            />
                        </div>
                        </>
                        )}

                        {classSubTab === 'members' && (
                        <>
                        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
                                    <Users className="w-5 h-5 text-violet-500" />
                                </div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Class Roster &amp; Students</h2>
                            </div>
                            {isLeader && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleCopyInviteLink(clan.inviteCode)}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-500 rounded-xl font-bold text-sm hover:bg-indigo-500/20 transition-all cursor-pointer"
                                    >
                                        <Link2 className="w-4 h-4" />
                                        Copy Invite Link
                                    </button>
                                    <button type="button" onClick={() => setClassSubTab('invite')} className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/30 text-violet-500 rounded-xl font-bold text-sm hover:bg-violet-500/20 transition-all cursor-pointer">
                                        <UserPlus className="w-4 h-4" />
                                        Invite Students
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Join Requests */}
                        {(isLeader || clan.members.find(m => m.userId === user.userId)?.role === 'elder') && clan.activeJoinRequests && clan.activeJoinRequests.length > 0 && (
                            <div className="mb-8 bg-orange-500/5 border border-orange-500/20 rounded-2xl p-6">
                                <h3 className="text-lg font-black text-orange-600 dark:text-orange-400 mb-4 flex items-center gap-2 uppercase tracking-tight">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                                    </span>
                                    Join Requests ({clan.activeJoinRequests.length})
                                </h3>
                                <div className="space-y-3">
                                    {clan.activeJoinRequests.map((req: { userId: string; name?: string; avatar?: AvatarConfig }) => (
                                        <div key={req.userId} className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                                            <div
                                                onClick={() => openUserProfile(req.userId)}
                                                className="flex items-center gap-3 cursor-pointer group"
                                                title="View user profile"
                                            >
                                                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center font-bold text-gray-500 overflow-hidden group-hover:ring-2 group-hover:ring-indigo-500 transition-all">
                                                    {req.avatar ? (
                                                        <Avatar config={req.avatar} size="sm" className="w-full h-full" />
                                                    ) : (
                                                        req.name ? req.name.substring(0, 2).toUpperCase() : '??'
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{req.name || 'Unknown User'}</div>
                                                    <div className="text-xs text-gray-500">Requested a while ago</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleRequestAction(req.userId, true)} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => handleRequestAction(req.userId, false)} className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><X className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {clan.members.map((member) => (
                                <div key={member.userId} className="relative flex items-center gap-4 p-4 rounded-2xl bg-white/60 dark:bg-white/5 border border-white/20 dark:border-white/5 group hover:border-violet-500/20 transition-all">
                                    <div
                                        onClick={() => openUserProfile(member.userId)}
                                        className="flex items-center gap-4 flex-1 cursor-pointer group/member min-w-0"
                                        title={`View ${member.name}'s profile`}
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center font-bold text-lg text-gray-600 dark:text-gray-300 overflow-hidden shrink-0 group-hover/member:ring-2 group-hover/member:ring-indigo-500 transition-all">
                                            {member.avatar ? (
                                                <Avatar config={member.avatar} size="md" className="w-full h-full" />
                                            ) : (
                                                member.name ? member.name.substring(0, 2).toUpperCase() : '??'
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-gray-900 dark:text-white group-hover/member:text-indigo-600 dark:group-hover/member:text-indigo-400 transition-colors truncate">{member.name || 'Unknown User'}</span>
                                                {member.role === 'leader' && <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Teacher</span>}
                                                {member.role === 'elder' && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Assistant</span>}
                                                {member.equippedBadge && (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                        isBento
                                                            ? 'bg-[#fef08a] text-black border border-black shadow-[1px_1px_0px_#000]'
                                                            : 'bg-amber-400/15 text-amber-600 dark:text-amber-400 border border-amber-400/25'
                                                    }`} title={member.equippedBadge.name}>
                                                        <span>{member.equippedBadge.icon}</span>
                                                        <span>{member.equippedBadge.title || member.equippedBadge.name}</span>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                                Contributed: <span className="font-medium text-violet-600 dark:text-violet-400">{member.contribution || 0} XP</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Menu - Only if user has power and target is not self */}
                                    {user.userId !== member.userId && (
                                        (isLeader || (clan.members.find(m => m.userId === user.userId)?.role === 'elder' && member.role === 'member')) && (
                                            <div className="relative">
                                                <button onClick={() => setActiveMenu(activeMenu === member.userId ? null : member.userId)} className="p-2 text-gray-400 hover:text-violet-600 dark:hover:text-white transition-colors">
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                                {activeMenu === member.userId && (
                                                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                                        {isLeader && member.role !== 'leader' && (
                                                            <>
                                                                {member.role === 'member' ? (
                                                                    <button onClick={() => handleRoleUpdate(member.userId, 'elder')} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                                                                        <ArrowUpCircle className="w-4 h-4 text-blue-500" /> Promote to Assistant
                                                                    </button>
                                                                ) : (
                                                                    <button onClick={() => handleRoleUpdate(member.userId, 'member')} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                                                                        <ArrowDownCircle className="w-4 h-4 text-orange-500" /> Set as Student
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        <button onClick={() => handleKick(member.userId)} className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2 text-sm font-medium">
                                                            <Trash2 className="w-4 h-4" /> Remove Student
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                        </>
                        )}

                        {classSubTab === 'analytics' && isLeader && (
                            <ClassAnalyticsLogsSection
                                clan={clan}
                                user={user}
                                onOpenAiCoach={(prefill) => {
                                    setAiCoachPrefill(prefill);
                                    setAiInitialTool('coach');
                                    setClassSubTab('ai_tools');
                                }}
                            />
                        )}

                        {classSubTab === 'ai_tools' && isLeader && (
                            <TeacherAiToolsSection
                                clan={clan}
                                user={user}
                                initialTool={aiInitialTool}
                                coachPrefill={aiCoachPrefill}
                                onQuizPublished={() => loadClan(clan.clanId, false, true)}
                            />
                        )}

                        {/* Invite Students Tab (Zero Modal) */}
                        {classSubTab === 'invite' && isLeader && (
                            <div className="space-y-6 max-w-3xl">
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-tight">Invite Students to Class</h2>
                                    <p className="text-xs text-gray-500 font-semibold mt-0.5">
                                        Share an instant join link/code or invite registered students directly from the platform.
                                    </p>
                                </div>

                                {/* Section 1: Invite via Link / Code */}
                                <div className={`p-5 rounded-2xl space-y-3 ${
                                    isBento ? 'bg-[#fef9c3] border-2 border-black shadow-[4px_4px_0px_#000]' : 'bg-indigo-500/10 border border-indigo-500/20'
                                }`}>
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                            <Link2 className="w-4 h-4 text-indigo-500" />
                                            Shareable Invite Link &amp; Class Code
                                        </span>
                                        <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-black/10 dark:bg-white/10">
                                            Code: {clan.inviteCode || 'Generating...'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                            readOnly
                                            value={getInviteUrl(clan.inviteCode)}
                                            className="flex-1 px-3.5 py-2.5 rounded-xl text-xs font-mono bg-white dark:bg-black/30 border border-black/15 dark:border-white/15"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleCopyInviteLink(clan.inviteCode)}
                                                className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                                                    isBento ? 'bg-[#bef264] text-black border-2 border-black' : 'bg-indigo-600 text-white'
                                                }`}
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                                <span>Copy Link</span>
                                            </button>
                                            <button
                                                type="button"
                                                disabled={regeneratingLink}
                                                onClick={handleRegenerateInvite}
                                                title="Generate new invite link"
                                                className="px-3 py-2.5 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 cursor-pointer disabled:opacity-50"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${regeneratingLink ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Search & Invite From Site */}
                                <div className="space-y-3">
                                    <div className="text-xs font-black uppercase tracking-wider opacity-75">
                                        Invite Directly From Site
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            placeholder="Search student by name or email..."
                                            className={`flex-1 p-3.5 rounded-xl font-bold text-sm ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white'
                                            }`}
                                            value={inviteQuery}
                                            onChange={e => setInviteQuery(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleInviteSearch()}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleInviteSearch}
                                            className={`px-6 rounded-xl font-black text-xs uppercase cursor-pointer ${
                                                isBento
                                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#a3e635]'
                                                    : 'bg-violet-600 text-white'
                                            }`}
                                        >
                                            Search
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {inviteResults.length === 0 ? (
                                            <p className="text-xs text-gray-500 py-3">
                                                Search for any student username or email to send a class invite notification.
                                            </p>
                                        ) : (
                                            inviteResults.map(u => (
                                                <div
                                                    key={u.userId}
                                                    className={`flex items-center justify-between p-3.5 rounded-xl ${
                                                        isBento
                                                            ? 'bg-slate-100 text-black border border-black'
                                                            : 'bg-gray-50 dark:bg-black/20'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                                            {u.avatar ? (
                                                                <Avatar config={u.avatar} size="sm" className="w-full h-full" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center font-bold text-xs text-gray-500">
                                                                    {u.name.substring(0, 1)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm">{u.name}</div>
                                                            <div className="text-[11px] opacity-60">{u.email}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => sendInvite(u.userId)}
                                                        className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase cursor-pointer ${
                                                            isBento
                                                                ? 'bg-[#bef264] text-black border border-black shadow-[1px_1px_0px_#000] hover:bg-[#a3e635]'
                                                                : 'bg-violet-600 text-white'
                                                        }`}
                                                    >
                                                        Send Invite
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Class Settings & Inline Emblem Studio Tab (Admin Only) */}
                        {classSubTab === 'settings' && isAdminAccount && (
                            <div className="space-y-8">
                                <form onSubmit={handleUpdateClan} className={`p-6 rounded-3xl space-y-4 max-w-2xl ${
                                    isBento ? 'bg-slate-50 border-2 border-black shadow-[4px_4px_0px_#000]' : 'bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10'
                                }`}>
                                    <h2 className="text-xl font-black uppercase tracking-tight">Class Details &amp; Enrollment</h2>
                                    <div>
                                        <label className={`block text-xs font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black' : 'text-gray-500'}`}>Class Name</label>
                                        <input
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            className={`w-full p-3 rounded-xl font-bold ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black' : 'text-gray-500'}`}>Description</label>
                                        <textarea
                                            value={editForm.description}
                                            onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                            rows={3}
                                            className={`w-full p-3 rounded-xl font-bold ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black' : 'text-gray-500'}`}>Enrollment Privacy</label>
                                        <select
                                            value={editForm.isPublic ? 'public' : 'private'}
                                            onChange={e => setEditForm({ ...editForm, isPublic: e.target.value === 'public' })}
                                            className={`w-full p-3 rounded-xl font-bold ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white'
                                            }`}
                                        >
                                            <option value="public">Open (Public Class)</option>
                                            <option value="private">Private (Invite Link / Approval)</option>
                                        </select>
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="submit"
                                            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer ${
                                                isBento
                                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#a3e635]'
                                                    : 'bg-violet-600 hover:bg-violet-700 text-white'
                                            }`}
                                        >
                                            Save Class Changes
                                        </button>
                                    </div>
                                </form>

                                <ClanLogoMakerModal
                                    inline={true}
                                    isOpen={true}
                                    onClose={() => setClassSubTab('curriculum')}
                                    clanName={clan.name}
                                    clanTag={clan.tag}
                                    initialLogo={clan.logo}
                                    onSave={handleSaveClanLogo}
                                />
                            </div>
                        )}
                    </div>
                </div>
                )}

                {confirmState.isOpen && (
                    <ConfirmDialog
                        title={confirmState.title}
                        message={confirmState.message}
                        confirmText={confirmState.confirmText}
                        cancelText={confirmState.cancelText}
                        type={confirmState.type}
                        onConfirm={confirmState.onConfirm}
                        onCancel={handleCancel}
                    />
                )}
            </div >
        );
    }

    // View: Browse / Setup
    return (
        <div className="space-y-8">
            {/* Hero Header Card */}
            <div className={`p-5 sm:p-8 md:p-10 rounded-[1.75rem] sm:rounded-[2.5rem] text-center relative overflow-hidden ${
                isBento
                    ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                    : 'bg-white/90 dark:bg-[#13141f] border border-gray-200 dark:border-white/10 shadow-xl backdrop-blur-xl'
            }`}>
                <div className="flex items-center justify-center gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-wider select-none inline-flex items-center gap-1.5 ${
                        isBento
                            ? 'font-black bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] -rotate-1'
                            : 'font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20'
                    }`}>
                        <GraduationCap className="w-3.5 h-3.5" />
                        CLASSROOMS &amp; TRACKS
                    </span>
                </div>
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                    isBento
                        ? 'bg-[#ddd6fe] text-black border-2.5 border-black shadow-[3px_3px_0px_#000]'
                        : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30'
                }`}>
                    <GraduationCap className="w-8 h-8" />
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">
                    Class Hub
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base font-semibold max-w-lg mx-auto mb-6">
                    {isTeacherAccount
                        ? 'Manage your assigned classes, present motion slides, finish sessions, and track student homework.'
                        : 'Join your teacher’s class with an invite link or code, follow live presentations, and complete session homework.'}
                </p>

                {/* Quick Join via Invite Code / Link */}
                <form onSubmit={handleJoinByCode} className="max-w-md mx-auto mb-6 flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={joinCodeInput}
                        onChange={e => setJoinCodeInput(e.target.value)}
                        placeholder="Paste class invite code or link..."
                        className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold ${
                            isBento
                                ? 'bg-white text-black border-2 border-black'
                                : 'bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10'
                        }`}
                    />
                    <button
                        type="submit"
                        disabled={joiningByCode || !joinCodeInput.trim()}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer disabled:opacity-50 shrink-0 ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                    >
                        {joiningByCode ? 'Joining...' : 'Join Code'}
                    </button>
                </form>

                {/* Tab Switcher */}
                <div className={`inline-flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl max-w-full mx-auto ${
                    isBento
                        ? 'bg-slate-100 dark:bg-white/5 border-2 border-black shadow-[3px_3px_0px_#000]'
                        : 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10'
                }`}>
                    {([
                        { id: 'my_classes', label: isTeacherAccount ? 'My Classes & Invites' : 'My Class & Invites', icon: GraduationCap },
                        { id: 'leaderboard', label: 'Class Rankings', icon: Award },
                        ...(isAdminAccount ? [{ id: 'create', label: 'Create Class', icon: Plus }] : [])
                    ] as const).map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => {
                                setView(id as 'my_classes' | 'create' | 'leaderboard');
                                if (id === 'leaderboard') fetchClanLeaderboard();
                            }}
                            className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                                view === id
                                    ? (isBento
                                        ? 'font-black bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'font-bold bg-violet-600 text-white shadow-md shadow-violet-500/30')
                                    : (isBento
                                        ? 'font-bold text-gray-700 hover:text-black hover:bg-black/5'
                                        : 'font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white')
                            }`}
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
                {myClasses.length > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            setView('my_clan');
                            loadClan(myClasses[0].clanId, false);
                        }}
                        className="mt-4 block mx-auto text-xs font-black text-indigo-500 hover:underline cursor-pointer"
                    >
                        ← Back to My Classes ({myClasses.length})
                    </button>
                )}
            </div>

            {error && (
                <div className={`p-4 rounded-2xl text-center font-bold text-sm ${
                    isBento
                        ? 'bg-[#fee2e2] text-red-900 border-2 border-black shadow-[3px_3px_0px_#000]'
                        : 'bg-red-500/10 border border-red-500/20 text-red-500'
                }`}>
                    {error}
                </div>
            )}

            {view === 'my_classes' && (
                <div className="space-y-8">
                    {/* Pending Invites */}
                    {clanInvites.length > 0 && (
                        <div className={`p-6 rounded-[2rem] relative overflow-hidden ${
                            isBento
                                ? 'bg-[#ddd6fe] text-black border-3 border-black shadow-[5px_5px_0px_#000]'
                                : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xl'
                        }`}>
                            <h3 className="text-xl font-black mb-6 flex items-center gap-3 relative z-10">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                    isBento ? 'bg-white text-black border-2 border-black' : 'bg-white/20 backdrop-blur-sm text-white'
                                }`}>
                                    <Bell className="w-5 h-5 animate-pulse" />
                                </div>
                                Class Invitations
                                <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                                    isBento ? 'bg-black text-white' : 'bg-white text-violet-600 shadow-sm'
                                }`}>
                                    {clanInvites.length}
                                </span>
                            </h3>
                            <div className="space-y-3 relative z-10">
                                {clanInvites.map((invite) => (
                                    <div
                                        key={invite.clanId}
                                        className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-colors ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-black/20 backdrop-blur-md border border-white/10 text-white hover:bg-black/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                                isBento ? 'bg-[#bef264] border border-black text-black' : 'bg-white/10 border border-white/10 text-white'
                                            }`}>
                                                <GraduationCap className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg leading-tight">{invite.clanName}</div>
                                                <div className={`text-xs mt-0.5 font-medium ${isBento ? 'text-gray-600' : 'text-white/60'}`}>
                                                    Invited by your teacher
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await api.respondToClanInvite(invite.clanId, true, user.userId);
                                                        onUpdateUser();
                                                    } catch (e) {
                                                        const msg = e instanceof Error ? e.message : 'Failed to accept invite';
                                                        setError(msg);
                                                    }
                                                }}
                                                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-md cursor-pointer ${
                                                    isBento
                                                        ? 'bg-[#bef264] text-black border-2 border-black hover:bg-[#a3e635]'
                                                        : 'bg-white text-violet-600 hover:scale-105 active:scale-95'
                                                }`}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await api.respondToClanInvite(invite.clanId, false, user.userId);
                                                        onUpdateUser();
                                                    } catch (e) {
                                                        const msg = e instanceof Error ? e.message : 'Failed to decline invite';
                                                        setError(msg);
                                                    }
                                                }}
                                                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                                                    isBento
                                                        ? 'bg-white text-black border-2 border-black hover:bg-gray-100'
                                                        : 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20'
                                                }`}
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Enrolled Classes (Student sees only their own class(es), no public browse directory) */}
                    {myClasses.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {myClasses.map((cls) => (
                                <div
                                    key={cls.clanId}
                                    className={`rounded-[2rem] p-6 transition-all flex flex-col justify-between gap-5 ${
                                        isBento
                                            ? 'bg-white text-black border-2.5 border-black shadow-[4px_4px_0px_#000]'
                                            : 'bg-white dark:bg-[#13141f] border border-gray-200 dark:border-white/10 shadow-sm'
                                    }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <ClanEmblem logo={cls.logo} tag={cls.tag} name={cls.name} size="md" />
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-black truncate">[{cls.tag}] {cls.name}</h3>
                                            <p className="text-xs font-bold opacity-65 mt-0.5">
                                                Teacher: {cls.leaderName || 'Instructor'}
                                            </p>
                                            {cls.trackTitle && (
                                                <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/15 text-indigo-500">
                                                    {cls.trackIcon || '🗺️'} {cls.trackTitle}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveClassId(cls.clanId);
                                            loadClan(cls.clanId, false);
                                            setView('my_clan');
                                        }}
                                        className={`w-full py-3 rounded-xl text-sm font-black cursor-pointer transition-all ${
                                            isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#a3e635]'
                                                : 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg'
                                        }`}
                                    >
                                        Open Class Dashboard →
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={`text-center py-16 px-6 rounded-[2.5rem] ${
                            isBento
                                ? 'bg-white text-black border-3 border-black shadow-[6px_6px_0px_#000]'
                                : 'bg-white dark:bg-[#13141f] border border-gray-200 dark:border-white/10 shadow-lg'
                        }`}>
                            <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center ${
                                isBento
                                    ? 'bg-[#ddd6fe] text-black border-2.5 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-violet-500/10 text-violet-500 dark:bg-white/10 dark:text-violet-400'
                            }`}>
                                <GraduationCap className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tight mb-2 text-gray-900 dark:text-white">
                                {isTeacherAccount ? 'No Classes Assigned Yet' : 'Not Enrolled in a Class Yet'}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 font-medium text-sm max-w-md mx-auto mb-8">
                                {isTeacherAccount
                                    ? 'Only an Administrator can create new classes and assign teachers or students. Ask an administrator to assign you to a class.'
                                    : 'Paste your teacher’s class invite link or code above, or wait for a class assignment from your administrator.'}
                            </p>
                            {isAdminAccount && (
                                <button
                                    type="button"
                                    onClick={() => setView('create')}
                                    className={`px-6 py-3.5 rounded-xl text-sm inline-flex items-center gap-2 transition-all cursor-pointer ${
                                        isBento
                                            ? 'bg-[#bef264] text-black font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#a3e635]'
                                            : 'bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-lg shadow-violet-500/25'
                                    }`}
                                >
                                    <GraduationCap className="w-4 h-4" />
                                    <span>Create a Class</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {view === 'leaderboard' && (
                <div className={`p-6 sm:p-8 rounded-[2.5rem] transition-all ${
                    isBento
                        ? 'bg-white text-black border-3 border-black shadow-[6px_6px_0px_#000]'
                        : 'bg-white/90 dark:bg-[#13141f] border border-gray-200 dark:border-white/10 shadow-xl backdrop-blur-xl'
                }`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-white/10">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                isBento ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-amber-500 text-white'
                            }`}>
                                <Award className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Class Rankings</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">Top performing classes across tracks and homework</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => fetchClanLeaderboard(false, true)}
                            disabled={loadingLeaderboard}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isBento ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-slate-100' : 'glass-card border border-slate-200 dark:border-white/10'
                            }`}
                        >
                            {loadingLeaderboard ? 'Refreshing...' : 'Refresh Rankings'}
                        </button>
                    </div>

                    {loadingLeaderboard ? (
                        <div className="text-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto mb-3"></div>
                            <p className="text-xs font-bold text-gray-500">Loading class rankings...</p>
                        </div>
                    ) : clanLeaderboard.length === 0 ? (
                        <div className="text-center py-16">
                            <Trophy className="w-12 h-12 mx-auto text-gray-400 mb-2 opacity-50" />
                            <h3 className="text-lg font-black uppercase">No Class Rankings Yet</h3>
                            <p className="text-xs text-gray-500 mt-1">Classes will appear here as they earn XP through homework and quizzes.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {clanLeaderboard.map((item, index) => (
                                <div
                                    key={item.clanId}
                                    className={`p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                            : 'bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 text-slate-800 dark:text-slate-200 hover:border-violet-500/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                                            index === 0
                                                ? 'bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : index === 1
                                                    ? 'bg-slate-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : index === 2
                                                        ? 'bg-amber-600 text-white border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : isBento
                                                            ? 'bg-slate-100 text-black border border-black'
                                                            : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                                        }`}>
                                            #{index + 1}
                                        </div>

                                        <div className="min-w-0">
                                            <h3 className="font-black text-base truncate">
                                                [{item.tag}] {item.name}
                                            </h3>
                                            <p className="text-xs opacity-75 font-medium truncate mt-0.5">
                                                Teacher: {item.leaderName || 'Unknown'} • Level {item.level}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                                        <div className="text-right">
                                            <div className="font-tabular font-black text-sm sm:text-base">
                                                {item.totalXP?.toLocaleString() || 0} XP
                                            </div>
                                            <div className="text-[10px] opacity-60 font-bold uppercase tracking-wider">
                                                {item.memberCount || 1} Students
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view === 'create' && (
                isAdminAccount ? (
                <div className={`rounded-[2.5rem] p-8 max-w-2xl mx-auto ${
                    isBento
                        ? 'bg-white text-black border-3 border-black shadow-[6px_6px_0px_#000]'
                        : 'bg-white dark:bg-[#13141f] border border-gray-200 dark:border-white/10 shadow-xl'
                }`}>
                    <div className="flex items-center gap-3 mb-8">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                        }`}>
                            <GraduationCap className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Create a Class</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold">Teacher-only classroom setup with track, invite link, and homework tracking</p>
                        </div>
                    </div>
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div>
                            <label className={`block text-xs font-black uppercase tracking-wider mb-2 ${
                                isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                                Class Name
                            </label>
                            <input
                                type="text"
                                required
                                value={createForm.name}
                                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                                className={`w-full p-4 rounded-xl focus:outline-none transition-all font-bold text-sm ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[3px_3px_0px_#000]'
                                        : 'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500'
                                }`}
                                placeholder="e.g. Python Junior — Cohort A"
                            />
                        </div>
                        <div>
                            <label className={`block text-xs font-black uppercase tracking-wider mb-2 ${
                                isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                                Assign Track (Optional — can change anytime)
                            </label>
                            <select
                                value={createForm.trackId}
                                onChange={e => setCreateForm({ ...createForm, trackId: e.target.value })}
                                className={`w-full p-4 rounded-xl focus:outline-none transition-all font-bold text-sm ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white'
                                }`}
                            >
                                <option value="">-- Choose a Curriculum Track --</option>
                                {availableTracks.map(t => (
                                    <option key={t.trackId} value={t.trackId}>
                                        {t.icon || '🗺️'} {t.title} ({t.modules?.length || 0} sessions)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={`block text-xs font-black uppercase tracking-wider mb-2 ${
                                isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                                Class Emblem / Logo
                            </label>
                            <div className={`flex items-center gap-4 p-4 rounded-2xl ${
                                isBento ? 'bg-yellow-50 border-2 border-black' : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                            }`}>
                                <ClanEmblem
                                    logo={createLogo || { shape: 'rounded', icon: 'Shield', bgColor: '#fde047', iconColor: '#000000', showTag: true }}
                                    tag={createForm.tag || 'CLASS'}
                                    name={createForm.name || 'New Class'}
                                    size="lg"
                                />
                                <div className="flex-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateLogoMaker(prev => !prev)}
                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                                            isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                                : 'bg-violet-600 hover:bg-violet-700 text-white shadow-md'
                                        }`}
                                    >
                                        <Palette className="w-4 h-4" />
                                        <span>{createLogo ? 'Edit Emblem' : 'Design Class Emblem'}</span>
                                    </button>
                                    <p className="text-[11px] text-gray-500 mt-1">Pick a custom silhouette, emblem icon, colors, or upload picture</p>
                                </div>
                            </div>
                            {/* Inline Class Emblem Studio for Create Class (Zero Modal) */}
                            {showCreateLogoMaker && (
                                <div className="mt-4">
                                    <ClanLogoMakerModal
                                        inline={true}
                                        isOpen={true}
                                        onClose={() => setShowCreateLogoMaker(false)}
                                        clanName={createForm.name || 'New Class'}
                                        clanTag={createForm.tag || 'CLASS'}
                                        initialLogo={createLogo}
                                        onSave={(newLogo) => {
                                            setCreateLogo(newLogo);
                                            setShowCreateLogoMaker(false);
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className={`block text-xs font-black uppercase tracking-wider mb-2 ${
                                    isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                    Class Code Tag (2-5 Letters)
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={5}
                                    minLength={2}
                                    value={createForm.tag}
                                    onChange={e => setCreateForm({ ...createForm, tag: e.target.value.toUpperCase() })}
                                    className={`w-full p-4 rounded-xl focus:outline-none transition-all font-bold text-sm font-mono uppercase ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[3px_3px_0px_#000]'
                                            : 'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500'
                                    }`}
                                    placeholder="PY101"
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-black uppercase tracking-wider mb-2 ${
                                    isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                    Enrollment Mode
                                </label>
                                <select
                                    value={createForm.isPublic ? 'public' : 'private'}
                                    onChange={e => setCreateForm({ ...createForm, isPublic: e.target.value === 'public' })}
                                    className={`w-full p-4 rounded-xl focus:outline-none transition-all font-bold text-sm ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white'
                                    }`}
                                >
                                    <option value="private">Invite Link / Approval (Recommended)</option>
                                    <option value="public">Open (Any student can join)</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className={`block text-xs font-black uppercase tracking-wider mb-2 ${
                                isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                                Description
                            </label>
                            <textarea
                                value={createForm.description}
                                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                                rows={3}
                                className={`w-full p-4 rounded-xl focus:outline-none transition-all font-bold text-sm resize-none ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[3px_3px_0px_#000]'
                                        : 'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500'
                                }`}
                                placeholder="Describe the class schedule, goals, or track..."
                            />
                        </div>
                        <button
                            type="submit"
                            className={`w-full py-4 rounded-2xl text-lg font-black transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2.5 border-black shadow-[4px_4px_0px_#000] hover:bg-[#a3e635] active:translate-y-0.5'
                                    : 'bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-lg shadow-violet-500/20 hover:scale-[1.01] active:scale-[0.99]'
                            }`}
                        >
                            Create Class
                        </button>
                    </form>
                </div>
                ) : (
                <div className={`rounded-[2.5rem] p-10 max-w-lg mx-auto text-center space-y-4 ${
                    isBento
                        ? 'bg-white text-black border-3 border-black shadow-[6px_6px_0px_#000]'
                        : 'bg-white dark:bg-[#13141f] border border-gray-200 dark:border-white/10 shadow-xl'
                }`}>
                    <Lock className="w-12 h-12 mx-auto text-amber-500" />
                    <h2 className="text-xl font-black uppercase">Admin Only</h2>
                    <p className="text-sm text-gray-500">
                        Only Administrators can create classes and assign teachers or students. Contact your administrator to get enrolled or assigned.
                    </p>
                </div>
                )
            )}
            
            {confirmState.isOpen && (
                <ConfirmDialog
                    title={confirmState.title}
                    message={confirmState.message}
                    confirmText={confirmState.confirmText}
                    cancelText={confirmState.cancelText}
                    type={confirmState.type}
                    onConfirm={confirmState.onConfirm}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
};

export const ClassHub = ClanHub;
