import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Clan, UserData, ClanChatMessage, AvatarConfig, ClanMember } from '../../types';
import Avatar from '../Avatar';
import { ClassEmblem } from './ClassEmblem';
import {
    MessageCircle,
    Send,
    Trash2,
    Edit2,
    Star,
    Crown,
    Sparkles,
    Maximize2,
    Minimize2,
    Users,
    Hash,
    Search,
    X,
    PanelLeftClose,
    PanelLeftOpen,
    Megaphone,
    Zap,
    User as UserIcon
} from 'lucide-react';
import { useConfirm } from '../../hooks/useConfirm';
import ConfirmDialog from '../ConfirmDialog';
import { useUserProfileModal } from '../../context/UserProfileModalContext';
import { useChat } from '../../context/ChatContext';
import { useData } from '../../context/DataContext';
import { InlineDirectChat } from './InlineDirectChat';

interface MemberActionTarget {
    userId: string;
    name: string;
    avatar?: AvatarConfig | null;
    role?: 'leader' | 'elder' | 'member';
    anchor?: { x: number; y: number };
    equippedBadge?: {
        id: string;
        name: string;
        title?: string;
        icon: string;
        rarity?: string;
    } | null;
}

interface ClanChatSectionProps {
    clan: Clan;
    currentUser: UserData;
    messages: ClanChatMessage[];
    onSendMessage: (content: string) => void;
    onEditMessage: (messageId: string, newContent: string) => void;
    onDeleteMessage: (messageId: string) => void;
    isLeader: boolean;
    isElder: boolean;
    isBento: boolean;
    onMarkAsRead?: () => void;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const ClanChatSection: React.FC<ClanChatSectionProps> = ({
    clan,
    currentUser,
    messages,
    onSendMessage,
    onEditMessage,
    onDeleteMessage,
    isLeader,
    isElder,
    isBento,
    onMarkAsRead
}) => {
    const { confirm, confirmState, handleCancel } = useConfirm();
    const { openUserProfile, isOpen: isProfileModalOpen } = useUserProfileModal();
    const { markFriendAsRead, isOpen: isGlobalChatOpen, onlineUserIds } = useChat();
    const { allUsers } = useData();
    const [inputContent, setInputContent] = useState('');
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [showMobileRoster, setShowMobileRoster] = useState(false);
    const [showQuickComms, setShowQuickComms] = useState(true);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [memberActionTarget, setMemberActionTarget] = useState<MemberActionTarget | null>(null);
    const [dmTarget, setDmTarget] = useState<UserData | null>(null);
    const lastPointerRef = useRef({ x: 16, y: 80 });

    useEffect(() => {
        const onDown = (e: PointerEvent) => { lastPointerRef.current = { x: e.clientX, y: e.clientY }; };
        window.addEventListener('pointerdown', onDown, true);
        return () => window.removeEventListener('pointerdown', onDown, true);
    }, []);

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const onMarkAsReadRef = useRef(onMarkAsRead);

    // Escape key listener: prioritize topmost overlay before exiting fullscreen chat
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (isProfileModalOpen || isGlobalChatOpen || confirmState.isOpen) {
                return;
            }
            if (memberActionTarget) {
                setMemberActionTarget(null);
            } else if (isSearchOpen) {
                setIsSearchOpen(false);
                setSearchQuery('');
            } else if (showMobileRoster) {
                setShowMobileRoster(false);
            } else if (isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        isFullscreen,
        isSearchOpen,
        showMobileRoster,
        memberActionTarget,
        isProfileModalOpen,
        isGlobalChatOpen,
        confirmState.isOpen
    ]);

    // Lock body scroll when fullscreen
    useEffect(() => {
        if (isFullscreen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isFullscreen]);

    const handleToggleFullscreen = () => {
        setShowMobileRoster(false);
        setIsFullscreen(prev => !prev);
    };

    useEffect(() => {
        if (isSearchOpen) {
            searchInputRef.current?.focus();
        }
    }, [isSearchOpen]);

    useEffect(() => {
        onMarkAsReadRef.current = onMarkAsRead;
    }, [onMarkAsRead]);

    // Map clan members by userId for dynamic avatar/role resolution & badge display
    const memberMap = useMemo(() => {
        const map = new Map<string, { role: 'leader' | 'elder' | 'member'; avatar?: AvatarConfig; name?: string; equippedBadge?: { id: string; name: string; title?: string; icon: string; rarity?: string } | null }>();
        (clan.members || []).forEach(m => {
            map.set(m.userId, {
                role: m.role || 'member',
                avatar: m.avatar,
                name: m.name,
                equippedBadge: m.equippedBadge || null
            });
        });
        return map;
    }, [clan.members]);

    const { staffMembers, studentMembers } = useMemo(() => {
        const members = clan.members || [];
        return {
            staffMembers: members.filter(m => m.role === 'leader' || m.role === 'elder'),
            studentMembers: members.filter(m => m.role === 'member')
        };
    }, [clan.members]);

    const filteredMessages = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return messages;
        return messages.filter(m => {
            const name = (m.senderName || memberMap.get(m.senderId)?.name || '').toLowerCase();
            return m.content.toLowerCase().includes(q) || name.includes(q);
        });
    }, [messages, searchQuery, memberMap]);

    // Auto-scroll strictly within internal container without hijacking window viewport
    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        if (!searchQuery.trim()) {
            scrollToBottom();
        }
        if (onMarkAsReadRef.current) {
            onMarkAsReadRef.current();
        }
    }, [messages.length, isFullscreen, searchQuery]);

    // Quick communication snippets
    const quickSnippets = [
        "Great session! 🎓",
        "Homework question? 📝",
        "Welcome to the class! 📚",
        "Let's finish the track! 🏆",
        "Need help with this module! 💡"
    ];

    const handleSend = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = inputContent.trim();
        if (!trimmed) return;
        onSendMessage(trimmed);
        setInputContent('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleStartEdit = (msg: ClanChatMessage) => {
        setEditingMessageId(msg.id);
        setEditContent(msg.content);
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setEditContent('');
    };

    const handleSaveEdit = (messageId: string) => {
        const trimmed = editContent.trim();
        if (!trimmed) return;
        onEditMessage(messageId, trimmed);
        setEditingMessageId(null);
        setEditContent('');
    };

    const handleDelete = async (messageId: string) => {
        const confirmed = await confirm({
            title: 'Delete Message',
            message: 'Are you sure you want to delete this message from the class chat?',
            confirmText: 'Delete',
            type: 'danger'
        });
        if (confirmed) {
            onDeleteMessage(messageId);
        }
    };

    const formatDayLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const now = new Date();
        if (date.toDateString() === now.toDateString()) return 'Today';
        const yesterday = new Date(now.getTime() - 86400000);
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        const sameYear = date.getFullYear() === now.getFullYear();
        return date.toLocaleDateString([], sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTimeOnly = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    const memberCount = (clan.members || []).length;
    const latestAnnouncement = (clan.announcements || [])[0];
    const messageCountLabel = `${messages.length} ${messages.length === 1 ? 'message' : 'messages'}`;

    const handleMemberClick = (target: MemberActionTarget) => {
        if (!target.userId || target.userId === 'undefined') return;
        if (target.userId === currentUser.userId) {
            setShowMobileRoster(false);
            openUserProfile(target.userId);
            return;
        }
        setMemberActionTarget(target);
    };

    const handleOpenSelectedProfile = () => {
        if (!memberActionTarget) return;
        const targetId = memberActionTarget.userId;
        setMemberActionTarget(null);
        setShowMobileRoster(false);
        openUserProfile(targetId);
    };

    const handleStartPrivateChat = () => {
        if (!memberActionTarget) return;
        const existingUser = allUsers.find(u => u.userId === memberActionTarget.userId);
        const targetUser: UserData = existingUser || {
            userId: memberActionTarget.userId,
            name: memberActionTarget.name || 'Classmate',
            email: '',
            avatar: memberActionTarget.avatar || undefined,
            role: memberActionTarget.role === 'leader' ? 'teacher' : 'student',
            totalScore: 0,
            totalTime: 0,
            totalAttempts: 0,
            xp: 0,
            level: 1,
            streak: 0,
            lastLoginDate: new Date().toISOString(),
            badges: []
        };
        setMemberActionTarget(null);
        setShowMobileRoster(false);
        markFriendAsRead(targetUser.userId);
        setDmTarget(targetUser);
    };

    const renderMemberRow = (m: ClanMember) => {
        const isCurrent = m.userId === currentUser.userId;
        const role = m.role || 'member';
        return (
            <button
                key={m.userId}
                type="button"
                onClick={() => handleMemberClick({
                    userId: m.userId,
                    name: m.name || 'Class Member',
                    avatar: m.avatar,
                    role: m.role,
                    equippedBadge: m.equippedBadge
                })}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    isBento
                        ? (isCurrent
                            ? 'bg-[#bef264]/50 border-2 border-black shadow-[2px_2px_0px_#000]'
                            : 'hover:bg-white border-2 border-transparent hover:border-black')
                        : (isCurrent
                            ? 'bg-violet-500/10 text-violet-900 dark:text-white'
                            : 'hover:bg-slate-200/70 dark:hover:bg-white/5')
                }`}
            >
                <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center text-[11px] font-black shrink-0 ${
                    isBento
                        ? 'border-2 border-black bg-[#fde047] text-black'
                        : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
                }`}>
                    {m.avatar ? (
                        <Avatar config={m.avatar} size="sm" className="w-full h-full object-cover" />
                    ) : (
                        (m.name || 'M').substring(0, 2).toUpperCase()
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold truncate ${isBento ? 'text-black' : 'text-slate-900 dark:text-slate-100'}`}>
                            {m.name}
                        </span>
                        {isCurrent && (
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                isBento ? 'bg-black text-[#bef264]' : 'bg-violet-600 text-white'
                            }`}>
                                You
                            </span>
                        )}
                    </div>
                    {m.equippedBadge && (
                        <p className={`text-[10px] truncate font-semibold ${isBento ? 'text-black/60' : 'text-slate-500 dark:text-slate-400'}`}>
                            {m.equippedBadge.icon} {m.equippedBadge.title || m.equippedBadge.name}
                        </p>
                    )}
                </div>

                {role === 'leader' && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                        isBento ? 'bg-[#facc15] text-black border border-black' : 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                    }`}>
                        Teacher
                    </span>
                )}
                {role === 'elder' && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                        isBento ? 'bg-[#93c5fd] text-black border border-black' : 'bg-blue-500/20 text-blue-600 dark:text-blue-300'
                    }`}>
                        Asst
                    </span>
                )}
            </button>
        );
    };

    const renderSidebarBody = () => (
        <div className="flex flex-col h-full">
            {/* Class Identity Header */}
            <div className={`p-4 border-b shrink-0 ${
                isBento ? 'bg-[#ddd6fe] border-b-[2.5px] border-black' : 'border-slate-200 dark:border-white/10'
            }`}>
                <div className="flex items-center gap-3">
                    <ClassEmblem logo={clan.logo} tag={clan.tag} name={clan.name} size="sm" />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                isBento ? 'bg-black text-[#bef264]' : 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
                            }`}>
                                #{clan.tag}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase ${
                                isBento ? 'text-black/75' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live
                            </span>
                        </div>
                        <h3 className={`text-sm font-black truncate mt-1 ${isBento ? 'text-black' : 'text-slate-900 dark:text-white'}`}>
                            {clan.name}
                        </h3>
                    </div>
                </div>

                {clan.description && (
                    <p className={`text-xs mt-3 line-clamp-2 leading-relaxed font-medium ${
                        isBento ? 'text-black/75' : 'text-slate-600 dark:text-slate-400'
                    }`}>
                        {clan.description}
                    </p>
                )}

                <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className={`px-2.5 py-1.5 rounded-xl ${
                        isBento ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10'
                    }`}>
                        <div className={`text-[10px] font-bold uppercase ${isBento ? 'text-black/60' : 'text-slate-400'}`}>Members</div>
                        <div className={`text-sm font-black font-tabular ${isBento ? 'text-black' : 'text-slate-900 dark:text-white'}`}>{memberCount}</div>
                    </div>
                    <div className={`px-2.5 py-1.5 rounded-xl ${
                        isBento ? 'bg-[#fef08a] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10'
                    }`}>
                        <div className={`text-[10px] font-bold uppercase ${isBento ? 'text-black/60' : 'text-slate-400'}`}>Messages</div>
                        <div className={`text-sm font-black font-tabular ${isBento ? 'text-black' : 'text-slate-900 dark:text-white'}`}>{messages.length}</div>
                    </div>
                </div>
            </div>

            {/* Latest Class Notice (if present) */}
            {latestAnnouncement && (
                <div className={`mx-3 mt-3 p-3 rounded-xl shrink-0 ${
                    isBento
                        ? 'bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000]'
                        : 'bg-amber-500/10 border border-amber-500/20'
                }`}>
                    <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider mb-1 ${
                        isBento ? 'text-black' : 'text-amber-600 dark:text-amber-300'
                    }`}>
                        <Megaphone className="w-3 h-3" />
                        <span>Pinned Notice</span>
                    </div>
                    <p className={`text-xs font-semibold line-clamp-2 ${
                        isBento ? 'text-black/80' : 'text-slate-700 dark:text-slate-200'
                    }`}>
                        {latestAnnouncement.content}
                    </p>
                </div>
            )}

            {/* Roster List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                {staffMembers.length > 0 && (
                    <div>
                        <div className={`px-2 mb-1.5 text-[10px] font-black uppercase tracking-wider ${
                            isBento ? 'text-black/55' : 'text-slate-400'
                        }`}>
                            Instructors — {staffMembers.length}
                        </div>
                        <div className="space-y-1">
                            {staffMembers.map(renderMemberRow)}
                        </div>
                    </div>
                )}

                <div>
                    <div className={`px-2 mb-1.5 text-[10px] font-black uppercase tracking-wider ${
                        isBento ? 'text-black/55' : 'text-slate-400'
                    }`}>
                        Students — {studentMembers.length}
                    </div>
                    {studentMembers.length === 0 ? (
                        <p className={`px-2 text-xs font-medium ${isBento ? 'text-black/50' : 'text-slate-400'}`}>
                            No students joined yet.
                        </p>
                    ) : (
                        <div className="space-y-1">
                            {studentMembers.map(renderMemberRow)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const chatSection = (
        <section
            id={isFullscreen ? undefined : 'clan-chat'}
            className={`flex overflow-hidden transition-all ${
                isFullscreen
                    ? 'w-full h-full'
                    : 'rounded-[1.75rem] sm:rounded-[2rem]'
            } ${
                isBento
                    ? (isFullscreen
                        ? 'bg-white text-black'
                        : 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]')
                    : (isFullscreen
                        ? 'bg-white dark:bg-[#11131f] text-slate-900 dark:text-white'
                        : 'bg-white/95 dark:bg-[#13141f]/95 border border-slate-200 dark:border-white/10 shadow-xl backdrop-blur-xl')
            }`}
        >
            {/* Fullscreen Desktop Sidebar */}
            {isFullscreen && showSidebar && (
                <aside className={`hidden lg:flex w-72 xl:w-80 shrink-0 flex-col h-full ${
                    isBento
                        ? 'bg-[#f5f3ec] border-r-[2.5px] border-black'
                        : 'bg-slate-50 dark:bg-[#0d0e17] border-r border-slate-200 dark:border-white/10'
                }`}>
                    {renderSidebarBody()}
                </aside>
            )}

            {/* Fullscreen Mobile/Tablet Roster Drawer */}
            {isFullscreen && showMobileRoster && (
                <div className="fixed inset-0 z-50 lg:hidden flex">
                    <div
                        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
                        onClick={() => setShowMobileRoster(false)}
                        aria-hidden="true"
                    />
                    <aside className={`relative z-10 w-72 max-w-[85vw] h-full flex flex-col ${
                        isBento ? 'bg-[#f5f3ec] border-r-[3px] border-black' : 'bg-white dark:bg-[#0d0e17] border-r border-slate-200 dark:border-white/10'
                    }`}>
                        <div className={`px-4 py-3 flex items-center justify-between border-b ${
                            isBento ? 'bg-white border-b-2 border-black' : 'border-slate-200 dark:border-white/10'
                        }`}>
                            <span className="text-xs font-black uppercase tracking-wider">Class Roster</span>
                            <button
                                type="button"
                                onClick={() => setShowMobileRoster(false)}
                                className={`p-1.5 rounded-lg cursor-pointer ${
                                    isBento ? 'bg-white border-2 border-black text-black' : 'hover:bg-slate-100 dark:hover:bg-white/10'
                                }`}
                                aria-label="Close roster"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden">
                            {renderSidebarBody()}
                        </div>
                    </aside>
                </div>
            )}

            {/* Main Chat Column */}
            <div className="flex-1 min-w-0 flex flex-col h-full">
                {dmTarget ? (<InlineDirectChat friend={dmTarget} isBento={isBento} isFullscreen={isFullscreen} onBack={() => setDmTarget(null)} onOpenProfile={openUserProfile} />) : (<>
                {/* Sleek Single-Bar Header */}
                <header className={`px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-3 shrink-0 ${
                    isBento
                        ? (isFullscreen ? 'bg-white border-b-[2.5px] border-black' : 'bg-[#ddd6fe] border-b-[2.5px] border-black')
                        : 'bg-white/80 dark:bg-[#13141f]/90 border-slate-200 dark:border-white/10'
                }`}>
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        {isFullscreen && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowSidebar(prev => !prev)}
                                    className={`hidden lg:inline-flex p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                                        isBento
                                            ? 'bg-[#f5f3ec] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fef08a]'
                                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                                    }`}
                                    title={showSidebar ? 'Hide class sidebar' : 'Show class sidebar'}
                                    aria-label={showSidebar ? 'Hide class sidebar' : 'Show class sidebar'}
                                >
                                    {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowMobileRoster(true)}
                                    className={`lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black cursor-pointer shrink-0 ${
                                        isBento
                                            ? 'bg-[#fef08a] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200'
                                    }`}
                                    title="View class roster"
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    <span>{memberCount}</span>
                                </button>
                            </>
                        )}

                        {!isFullscreen && (
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                            }`}>
                                <MessageCircle className="w-5 h-5" />
                            </div>
                        )}

                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                {isFullscreen && (
                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                        isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                            : 'bg-violet-600/15 text-violet-600 dark:text-violet-400'
                                    }`}>
                                        <Hash className="w-4 h-4" />
                                    </span>
                                )}
                                <h2 className="text-sm sm:text-base font-black tracking-tight text-gray-900 dark:text-white truncate">
                                    {isFullscreen ? 'class-discussion' : 'Class Discussion'}
                                </h2>
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                                    isBento
                                        ? 'bg-black text-[#bef264]'
                                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                                }`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Live
                                </span>
                            </div>
                            <p className={`hidden sm:block text-xs font-medium truncate ${
                                isBento ? 'text-black/70' : 'text-slate-500 dark:text-slate-400'
                            }`}>
                                {isFullscreen
                                    ? `Ask questions, discuss sessions, and coordinate homework in ${clan.name}`
                                    : `[${clan.tag}] ${clan.name} • ${memberCount} members • ${messageCountLabel}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Inline Search Toggle */}
                        {isSearchOpen ? (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${
                                isBento
                                    ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                            }`}>
                                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search chat..."
                                    className="chat-bare-input w-28 sm:w-40 bg-transparent text-xs font-semibold focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setIsSearchOpen(false);
                                    }}
                                    className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                    aria-label="Clear search"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsSearchOpen(true)}
                                className={`p-2 rounded-xl transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fef08a]'
                                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                                }`}
                                title="Search messages"
                                aria-label="Search messages"
                            >
                                <Search className="w-4 h-4" />
                            </button>
                        )}

                        {/* Fullscreen Toggle */}
                        <button
                            type="button"
                            onClick={handleToggleFullscreen}
                            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-black uppercase tracking-wider ${
                                isBento
                                    ? 'bg-[#fef08a] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047] active:translate-y-0.5'
                                    : 'bg-violet-600/10 hover:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-500/20'
                            }`}
                            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen Chat'}
                            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Chat'}
                        >
                            {isFullscreen ? (
                                <>
                                    <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Exit</span>
                                </>
                            ) : (
                                <>
                                    <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Fullscreen</span>
                                </>
                            )}
                        </button>
                    </div>
                </header>

                {/* Messages Stream */}
                <div
                    ref={messagesContainerRef}
                    className={`flex-1 overflow-y-auto px-4 sm:px-6 py-4 custom-scrollbar ${
                        isFullscreen ? 'min-h-0' : 'max-h-[480px] min-h-[340px]'
                    } ${
                        isBento
                            ? 'bg-[#fafafa]'
                            : 'bg-slate-50/70 dark:bg-[#0b0d16]'
                    }`}
                >
                    <div className={`w-full min-h-full flex flex-col justify-end ${isFullscreen ? 'max-w-4xl mx-auto' : ''}`}>
                        {filteredMessages.length === 0 ? (
                            <div className="my-auto flex flex-col items-center justify-center text-center py-12 px-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3.5 ${
                                    isBento
                                        ? 'bg-[#fef08a] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-violet-500/10 text-violet-500'
                                }`}>
                                    {searchQuery.trim() ? <Search className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
                                </div>
                                <h3 className="text-base font-black tracking-tight text-gray-900 dark:text-white mb-1">
                                    {searchQuery.trim() ? 'No matching messages' : `Welcome to #${clan.tag}`}
                                </h3>
                                <p className={`text-xs max-w-sm ${isBento ? 'text-black/70 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {searchQuery.trim()
                                        ? `Nothing matched "${searchQuery}". Try another keyword.`
                                        : `Start the conversation with your classmates or ask your teacher a question about today's session.`}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1 pb-1">
                                {/* Channel Start Header */}
                                {!searchQuery.trim() && (
                                    <div className={`mb-6 pb-5 border-b ${
                                        isBento ? 'border-black/15' : 'border-slate-200 dark:border-white/10'
                                    }`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                                                isBento
                                                    ? 'bg-[#ddd6fe] text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000]'
                                                    : 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                                            }`}>
                                                <Hash className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className={`text-base sm:text-lg font-black tracking-tight ${isBento ? 'text-black' : 'text-slate-900 dark:text-white'}`}>
                                                    Welcome to #{clan.tag} Discussion
                                                </h3>
                                                <p className={`text-xs font-medium ${isBento ? 'text-black/65' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    This is the start of the class conversation for {clan.name}.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {filteredMessages.map((msg, idx) => {
                                    const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
                                    const currentDate = new Date(msg.createdAt);
                                    const prevDate = prevMsg ? new Date(prevMsg.createdAt) : null;

                                    const isNewDay =
                                        !prevDate ||
                                        isNaN(currentDate.getTime()) ||
                                        isNaN(prevDate.getTime()) ||
                                        currentDate.toDateString() !== prevDate.toDateString();

                                    const isGrouped =
                                        !isNewDay &&
                                        prevMsg &&
                                        prevMsg.senderId === msg.senderId &&
                                        Math.abs(currentDate.getTime() - prevDate.getTime()) <= FIVE_MINUTES_MS;

                                    const isMe = msg.senderId === currentUser.userId;
                                    const memberInfo = memberMap.get(msg.senderId);
                                    const role = msg.senderRole || memberInfo?.role || 'member';
                                    const avatar = (msg.senderAvatar as AvatarConfig) || (isMe ? currentUser.avatar : memberInfo?.avatar);
                                    const senderDisplayName = msg.senderName || memberInfo?.name || (isMe ? currentUser.name : 'Class Member');
                                    const senderBadge =
                                        msg.senderBadge ||
                                        memberInfo?.equippedBadge ||
                                        (isMe && currentUser.equippedBadgeId
                                            ? (currentUser.badges || []).find(b => b.id === currentUser.equippedBadgeId)
                                            : null);
                                    const isEditingThis = editingMessageId === msg.id;

                                    const canModerate = isLeader || isElder;
                                    const canDelete = isMe || canModerate;
                                    const canEdit = isMe || canModerate;

                                    const isTeacherMsg = role === 'leader';

                                    return (
                                        <React.Fragment key={msg.id}>
                                            {isNewDay && (
                                                <div className="flex items-center gap-3 my-4">
                                                    <div className={`flex-1 h-px ${isBento ? 'bg-black/15' : 'bg-slate-200 dark:bg-white/10'}`} />
                                                    <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                                                        isBento
                                                            ? 'bg-white text-black border border-black/30'
                                                            : 'bg-slate-200/70 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                        {formatDayLabel(msg.createdAt)}
                                                    </span>
                                                    <div className={`flex-1 h-px ${isBento ? 'bg-black/15' : 'bg-slate-200 dark:bg-white/10'}`} />
                                                </div>
                                            )}

                                            <div
                                                className={`group/row relative flex items-start gap-3 px-3 rounded-xl transition-colors ${
                                                    isGrouped ? 'py-1' : 'pt-2.5 pb-1.5 mt-1'
                                                } ${
                                                    isTeacherMsg
                                                        ? (isBento
                                                            ? 'border-l-[3px] border-black bg-[#fef9c3]/55 hover:bg-[#fef9c3]/85'
                                                            : 'border-l-[3px] border-amber-400 bg-amber-500/[0.06] hover:bg-amber-500/[0.1]')
                                                        : isMe
                                                            ? (isBento
                                                                ? 'bg-[#bef264]/20 hover:bg-[#bef264]/35'
                                                                : 'bg-violet-500/[0.05] hover:bg-violet-500/[0.09]')
                                                            : (isBento
                                                                ? 'hover:bg-black/[0.035]'
                                                                : 'hover:bg-slate-200/50 dark:hover:bg-white/[0.03]')
                                                }`}
                                            >
                                                {/* Left Gutter: Avatar on group start, hover timestamp on continuation */}
                                                {isGrouped ? (
                                                    <div className="w-9 shrink-0 flex items-center justify-end pt-0.5">
                                                        <span className="opacity-0 group-hover/row:opacity-100 text-[10px] font-semibold text-slate-400 font-tabular select-none">
                                                            {formatTimeOnly(msg.createdAt)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={() => !isMe && handleMemberClick({
                                                            userId: msg.senderId,
                                                            name: senderDisplayName,
                                                            avatar: avatar || null,
                                                            role,
                                                            equippedBadge: senderBadge || undefined
                                                        })}
                                                        className={`shrink-0 mt-0.5 ${!isMe ? 'cursor-pointer transition-transform hover:scale-105' : ''}`}
                                                        title={!isMe ? `Message or view ${senderDisplayName}'s profile` : undefined}
                                                    >
                                                        <div className={`w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-xs font-black ${
                                                            isBento
                                                                ? `border-2 border-black shadow-[1.5px_1.5px_0px_#000] ${isMe ? 'bg-[#bef264] text-black' : 'bg-[#fde047] text-black'}`
                                                                : `${isMe ? 'bg-violet-600 text-white' : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'} shadow-sm`
                                                        }`}>
                                                            {avatar ? (
                                                                <Avatar config={avatar} size="sm" className="w-full h-full object-cover" />
                                                            ) : (
                                                                senderDisplayName.substring(0, 2).toUpperCase()
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Message Content */}
                                                <div className="min-w-0 flex-1 pr-14 sm:pr-16">
                                                    {!isGrouped && (
                                                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                                            <span
                                                                onClick={() => !isMe && handleMemberClick({
                                                                    userId: msg.senderId,
                                                                    name: senderDisplayName,
                                                                    avatar: avatar || null,
                                                                    role,
                                                                    equippedBadge: senderBadge || undefined
                                                                })}
                                                                title={!isMe ? `Message or view ${senderDisplayName}'s profile` : undefined}
                                                                className={`text-xs sm:text-sm font-black ${
                                                                    isMe
                                                                        ? (isBento ? 'text-black' : 'text-violet-600 dark:text-violet-400')
                                                                        : (isBento ? 'text-black hover:underline cursor-pointer' : 'text-slate-900 dark:text-white hover:text-violet-500 cursor-pointer')
                                                                }`}
                                                            >
                                                                {senderDisplayName}
                                                            </span>
                                                            {isMe && (
                                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                                    isBento ? 'bg-black text-[#bef264]' : 'bg-violet-600/15 text-violet-600 dark:text-violet-300'
                                                                }`}>
                                                                    You
                                                                </span>
                                                            )}

                                                            {role === 'leader' && (
                                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                                                    isBento
                                                                        ? 'bg-[#facc15] text-black border border-black'
                                                                        : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                                                }`}>
                                                                    <Crown className="w-2.5 h-2.5 fill-current" />
                                                                    Teacher
                                                                </span>
                                                            )}
                                                            {role === 'elder' && (
                                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                                                    isBento
                                                                        ? 'bg-[#93c5fd] text-black border border-black'
                                                                        : 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                                                                }`}>
                                                                    <Star className="w-2.5 h-2.5 fill-current" />
                                                                    Assistant
                                                                </span>
                                                            )}

                                                            {senderBadge && (
                                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                                                    isBento
                                                                        ? 'bg-[#fef08a] text-black border border-black'
                                                                        : 'bg-amber-400/15 text-amber-600 dark:text-amber-400 border border-amber-400/25'
                                                                }`} title={senderBadge.name}>
                                                                    <span>{senderBadge.icon}</span>
                                                                    <span>{senderBadge.title || senderBadge.name}</span>
                                                                </span>
                                                            )}

                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold ml-1 font-tabular">
                                                                {formatTimeOnly(msg.createdAt)}
                                                            </span>

                                                            {msg.isEdited && (
                                                                <span className="text-[10px] text-slate-400 italic font-medium">
                                                                    (edited)
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {isEditingThis ? (
                                                        <div className={`mt-1 p-3 rounded-xl border-2 ${
                                                            isBento
                                                                ? 'bg-white border-black shadow-[3px_3px_0px_#000]'
                                                                : 'bg-white dark:bg-[#1a1b26] border-violet-500 shadow-lg'
                                                        }`}>
                                                            <textarea
                                                                value={editContent}
                                                                onChange={(e) => setEditContent(e.target.value)}
                                                                rows={2}
                                                                className="chat-bare-input w-full text-xs sm:text-sm font-medium focus:outline-none resize-none bg-transparent text-slate-900 dark:text-white"
                                                                maxLength={500}
                                                            />
                                                            <div className="flex items-center justify-end gap-2 mt-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={handleCancelEdit}
                                                                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                                                                        isBento
                                                                            ? 'bg-slate-200 text-black border border-black hover:bg-slate-300'
                                                                            : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                                                                    }`}
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEdit(msg.id)}
                                                                    className={`px-3 py-1 rounded-lg text-xs font-black cursor-pointer ${
                                                                        isBento
                                                                            ? 'bg-[#bef264] text-black border border-black shadow-[1.5px_1.5px_0px_#000]'
                                                                            : 'bg-violet-600 text-white shadow-md'
                                                                    }`}
                                                                >
                                                                    Save Changes
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className={`text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap max-w-[70ch] ${
                                                            isBento ? 'text-black font-medium' : 'text-slate-800 dark:text-slate-200'
                                                        }`}>
                                                            {msg.content}
                                                            {isGrouped && msg.isEdited && (
                                                                <span className="ml-1.5 text-[10px] text-slate-400 italic">(edited)</span>
                                                            )}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Floating Hover Actions */}
                                                {!isEditingThis && (canEdit || canDelete) && (
                                                    <div className={`absolute right-2.5 top-2 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity flex items-center gap-1 p-0.5 rounded-lg ${
                                                        isBento
                                                            ? 'bg-white border border-black shadow-[1.5px_1.5px_0px_#000]'
                                                            : 'bg-white dark:bg-[#1a1b26] border border-slate-200 dark:border-white/10 shadow-sm'
                                                    }`}>
                                                        {canEdit && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartEdit(msg)}
                                                                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                                                    isBento
                                                                        ? 'hover:bg-[#fef08a] text-black'
                                                                        : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                                                }`}
                                                                title={isMe ? 'Edit message' : 'Moderate: Edit message'}
                                                            >
                                                                <Edit2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(msg.id)}
                                                                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                                                    isBento
                                                                        ? 'hover:bg-red-200 text-red-600'
                                                                        : 'hover:bg-red-500/10 text-slate-500 hover:text-red-500'
                                                                }`}
                                                                title={isMe ? 'Delete message' : 'Moderate: Delete message'}
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Unified Composer Dock */}
                <div className={`px-4 sm:px-6 pt-2 pb-3.5 sm:pb-4 shrink-0 border-t ${
                    isBento
                        ? 'bg-white border-t-[2px] border-black/15'
                        : 'bg-white dark:bg-[#13141f] border-slate-200 dark:border-white/10'
                }`}>
                    <div className={isFullscreen ? 'max-w-4xl mx-auto w-full' : 'w-full'}>
                        {/* Compact Quick Snippets Row */}
                        {showQuickComms && (
                            <div className="flex items-center gap-1.5 pb-2.5 overflow-x-auto sm:flex-wrap no-scrollbar">
                                <span className={`text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 pr-1 ${
                                    isBento ? 'text-black/60' : 'text-slate-400'
                                }`}>
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    Quick
                                </span>
                                {quickSnippets.map((snippet, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => onSendMessage(snippet)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                                            isBento
                                                ? 'bg-[#fef9c3] text-black border border-black hover:bg-[#bef264] active:translate-y-0.5'
                                                : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-violet-600 hover:text-white border border-slate-200 dark:border-white/10'
                                        }`}
                                    >
                                        {snippet}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Single Unified Composer Card */}
                        <form
                            onSubmit={handleSend}
                            className={`rounded-2xl transition-all ${
                                isBento
                                    ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000] focus-within:shadow-[5px_5px_0px_#000]'
                                    : 'bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20'
                            }`}
                        >
                            <textarea
                                ref={textareaRef}
                                value={inputContent}
                                onChange={(e) => {
                                    setInputContent(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder={`Message #${clan.tag} discussion...`}
                                rows={1}
                                maxLength={500}
                                className="chat-bare-input w-full px-4 pt-3 pb-1.5 text-xs sm:text-sm font-semibold bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none resize-none max-h-32 block"
                            />

                            <div className="px-3 pb-2.5 pt-1 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickComms(prev => !prev)}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                                            showQuickComms
                                                ? (isBento ? 'bg-[#fef08a] text-black border border-black' : 'bg-violet-500/15 text-violet-600 dark:text-violet-300')
                                                : (isBento ? 'text-black/60 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5')
                                        }`}
                                        title={showQuickComms ? 'Hide quick replies' : 'Show quick replies'}
                                    >
                                        <Zap className="w-3 h-3" />
                                        <span>Quick</span>
                                    </button>
                                    <span className="hidden sm:inline text-[10px] font-medium text-slate-400">
                                        Enter to send · Shift+Enter for new line
                                    </span>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <span className={`text-[10px] font-bold font-tabular ${
                                        inputContent.length > 450 ? 'text-amber-500' : 'text-slate-400'
                                    }`}>
                                        {inputContent.length}/500
                                    </span>
                                    <button
                                        type="submit"
                                        disabled={!inputContent.trim()}
                                        className={`px-3.5 py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-black uppercase text-[11px] tracking-wider transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                                            isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-y-0.5'
                                                : 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm active:scale-95'
                                        }`}
                                    >
                                        <span>Send</span>
                                        <Send className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
                </>)}
            </div>

            <ConfirmDialog
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.confirmText}
                cancelText={confirmState.cancelText}
                type={confirmState.type}
                onConfirm={confirmState.onConfirm}
                onCancel={handleCancel}
            />
        </section>
    );

    const isTargetOnline = memberActionTarget ? onlineUserIds.has(memberActionTarget.userId) : false;

    const popoverWidth = 248;
    const popoverLeft = memberActionTarget?.anchor
        ? Math.max(8, Math.min(memberActionTarget.anchor.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - popoverWidth - 8))
        : 16;
    const popoverTop = memberActionTarget?.anchor
        ? Math.max(8, Math.min(memberActionTarget.anchor.y + 10, (typeof window !== 'undefined' ? window.innerHeight : 800) - 200))
        : 80;

    const memberActionModal =
        memberActionTarget && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[9950]" onClick={() => setMemberActionTarget(null)}>
                    <div
                        role="menu"
                        aria-label={`Actions for ${memberActionTarget.name}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ left: popoverLeft, top: popoverTop, width: popoverWidth }}
                        className={`absolute rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[4px_4px_0px_#000]'
                                : 'bg-white dark:bg-[#13141f] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-xl'
                        }`}
                    >
                        <div className={`px-3 py-2.5 flex items-center gap-2.5 border-b ${
                            isBento ? 'bg-[#fef08a] border-b-2 border-black' : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10'
                        }`}>
                            <div className="relative shrink-0">
                                <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center text-[11px] font-black ${
                                    isBento ? 'bg-[#fde047] border-2 border-black text-black' : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
                                }`}>
                                    {memberActionTarget.avatar ? (
                                        <Avatar config={memberActionTarget.avatar} size="sm" className="w-full h-full object-cover" />
                                    ) : (
                                        (memberActionTarget.name || 'M').substring(0, 2).toUpperCase()
                                    )}
                                </div>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${isTargetOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-black truncate">{memberActionTarget.name}</p>
                                <p className="text-[10px] font-semibold opacity-60 truncate">
                                    {memberActionTarget.role === 'leader' ? 'Teacher' : memberActionTarget.role === 'elder' ? 'Assistant' : 'Class Member'}
                                    {isTargetOnline ? ' • Online' : ''}
                                </p>
                            </div>
                        </div>
                        <div className="p-1.5 space-y-1">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleStartPrivateChat}
                                className={`btn-unstyled w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-black text-start cursor-pointer transition-colors ${
                                    isBento ? 'hover:bg-[#bef264]' : 'hover:bg-violet-500/10'
                                }`}
                            >
                                <MessageCircle className="w-4 h-4 shrink-0" />
                                <span>Chat privately</span>
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleOpenSelectedProfile}
                                className={`btn-unstyled w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-black text-start cursor-pointer transition-colors ${
                                    isBento ? 'hover:bg-[#bae6fd]' : 'hover:bg-indigo-500/10'
                                }`}
                            >
                                <UserIcon className="w-4 h-4 shrink-0" />
                                <span>View profile</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )
            : null;

    if (isFullscreen && typeof document !== 'undefined') {
        return (
            <>
                {createPortal(
                    <div className="fixed inset-0 z-[9900] chat-overlay-shell flex overflow-hidden">
                        {chatSection}
                    </div>,
                    document.body
                )}
                {memberActionModal}
            </>
        );
    }

    return (
        <>
            {chatSection}
            {memberActionModal}
        </>
    );
};
