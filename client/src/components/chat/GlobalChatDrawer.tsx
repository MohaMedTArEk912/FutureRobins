import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    X,
    MessageCircle,
    Users,
    Shield,
    Send,
    Search,
    ArrowLeft,
    Swords,
    Trash2,
    Edit2,
    ExternalLink,
    Maximize2,
    Minimize2,
    Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { useUserProfileModal } from '../../context/UserProfileModalContext';
import Avatar from '../Avatar';
import { ClanEmblem } from '../social/ClassEmblem';
import { BuddyChatPanel } from './BuddyChatPanel';
import type { UserData } from '../../types';

export const GlobalChatDrawer: React.FC = () => {
    const {
        isOpen,
        closeChat,
        activeTab,
        setActiveTab,
        activeFriend,
        setActiveFriend,
        clan,
        clanMessages,
        directMessages,
        unreadClanCount,
        unreadByFriend,
        onlineUserIds,
        returnToLabel,
        sendDirectMessage,
        sendClanMessage,
        editClanMessage,
        deleteClanMessage,
        markClanAsRead,
        markFriendAsRead
    } = useChat();

    const { currentUser } = useAuth();
    const { allUsers, availableQuizzes } = useData();
    const { isBento } = useTheme();
    const { openUserProfile, isOpen: isProfileModalOpen } = useUserProfileModal();
    const navigate = useNavigate();

    const [friendSearch, setFriendSearch] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [editingClanMsgId, setEditingClanMsgId] = useState<string | null>(null);
    const [editClanMsgContent, setEditClanMsgContent] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleCloseOrReturn = () => {
        setIsFullscreen(false);
        closeChat();
    };

    // Auto-scroll to bottom of conversation
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Escape key listener for fullscreen / close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isProfileModalOpen) {
                if (isFullscreen) {
                    setIsFullscreen(false);
                } else {
                    closeChat();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isFullscreen, isProfileModalOpen, closeChat]);

    // Lock body scroll when in fullscreen
    useEffect(() => {
        if (isOpen && isFullscreen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen, isFullscreen]);

    // User's friends & active DM contacts list
    const friendsList = useMemo(() => {
        if (!currentUser) return [];
        const contactIds = new Set<string>([
            ...(currentUser.friends || []),
            ...((currentUser.friendRequests || [])
                .filter(r => r.status === 'accepted')
                .map(r => r.from === currentUser.userId ? r.to : r.from)
                .filter((id): id is string => Boolean(id))),
            ...Object.keys(directMessages).filter(
                id => id !== currentUser.userId && (directMessages[id]?.length ?? 0) > 0
            )
        ]);

        const resolved = allUsers.filter(u => contactIds.has(u.userId));
        if (
            activeFriend &&
            activeFriend.userId !== currentUser.userId &&
            !resolved.some(u => u.userId === activeFriend.userId)
        ) {
            return [activeFriend, ...resolved];
        }
        return resolved;
    }, [currentUser, allUsers, directMessages, activeFriend]);

    // Filtered friends by search query
    const filteredFriends = useMemo(() => {
        if (!friendSearch.trim()) return friendsList;
        const q = friendSearch.toLowerCase().trim();
        return friendsList.filter(f => f.name.toLowerCase().includes(q) || f.userId.toLowerCase().includes(q));
    }, [friendsList, friendSearch]);

    // Active friend's DM messages
    const currentDmMessages = useMemo(() => {
        if (!activeFriend) return [];
        return directMessages[activeFriend.userId] || [];
    }, [activeFriend, directMessages]);

    // Mark as read when switching active view
    useEffect(() => {
        if (!isOpen) return;
        if (activeTab === 'clan') {
            markClanAsRead();
        } else if (activeTab === 'direct' && activeFriend) {
            markFriendAsRead(activeFriend.userId);
        }
    }, [isOpen, activeTab, activeFriend, markClanAsRead, markFriendAsRead]);

    // Scroll on new message
    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [clanMessages.length, currentDmMessages.length, isOpen, activeTab, activeFriend]);

    if (!isOpen || !currentUser) return null;

    // Quick snippets
    const quickSnippets = [
        "GG! 🎮",
        "Quiz duel? ⚔️",
        "Ready! 🔥",
        "Hey! 👋",
        "Let's rank up! 🏆"
    ];

    const handleSend = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = messageInput.trim();
        if (!trimmed) return;

        if (activeTab === 'clan') {
            sendClanMessage(trimmed);
        } else if (activeTab === 'direct' && activeFriend) {
            sendDirectMessage(activeFriend.userId, trimmed, 'text');
        }

        setMessageInput('');
    };

    const handleQuickSnippet = (snippet: string) => {
        if (activeTab === 'clan') {
            sendClanMessage(snippet);
        } else if (activeTab === 'direct' && activeFriend) {
            sendDirectMessage(activeFriend.userId, snippet, 'text');
        }
    };

    const handleStartDuel = (friend: UserData) => {
        // Pick a default quiz or first quiz available
        const defaultQuiz = availableQuizzes[0];
        const quizId = defaultQuiz?.id || 'general';
        const quizTitle = defaultQuiz?.title || 'Knowledge Duel';

        sendDirectMessage(friend.userId, `⚔️ I challenged you to a duel on "${quizTitle}"!`, 'challenge', {
            quizId,
            quizTitle,
            status: 'pending'
        });
    };

    const isLeader = clan?.leaderId === currentUser.userId;

    const renderInputBar = (placeholderText: string) => (
        <div className={`p-2.5 sm:p-3 border-t shrink-0 ${
            isBento ? 'bg-neutral-50 border-t-2 border-black' : 'bg-[#141210] border-[#2e2924]'
        }`}>
            <div className={`w-full ${isFullscreen ? 'max-w-4xl mx-auto' : ''}`}>
                {/* Quick Snippet Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-2 custom-scrollbar">
                    {quickSnippets.map(snippet => (
                        <button
                            key={snippet}
                            type="button"
                            onClick={() => handleQuickSnippet(snippet)}
                            className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0 transition-all cursor-pointer select-none ${
                                isBento
                                    ? 'bg-white text-black border border-black hover:bg-yellow-100 shadow-[1px_1px_0px_#000]'
                                    : 'bg-[#1a1714] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2e2924] hover:border-[#bef264]/50'
                            }`}
                        >
                            {snippet}
                        </button>
                    ))}
                </div>

                {/* Input Box Form */}
                <form onSubmit={handleSend} className="flex items-center gap-1.5 sm:gap-2">
                    <input
                        type="text"
                        value={messageInput}
                        onChange={e => setMessageInput(e.target.value)}
                        placeholder={placeholderText}
                        className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-3.5 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[3px_3px_0px_#000]'
                                : 'bg-[#0a0908] border border-[#2e2924] text-[#f5f3ec] placeholder:text-[#78716c] focus:border-[#bef264]'
                        }`}
                    />
                    <button
                        type="submit"
                        disabled={!messageInput.trim()}
                        className={`p-2 sm:p-2.5 rounded-xl font-black transition-all cursor-pointer disabled:opacity-40 shrink-0 ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-y-0.5'
                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                        }`}
                        title="Send Message"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );

    const renderFriendsList = () => (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className={`p-3 border-b ${isBento ? 'border-black/10' : 'border-[#2e2924]'}`}>
                <div className="relative">
                    <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isBento ? 'text-gray-400' : 'text-[#78716c]'}`} />
                    <input
                        type="text"
                        value={friendSearch}
                        onChange={e => setFriendSearch(e.target.value)}
                        placeholder="Search friends..."
                        className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold outline-none ${
                            isBento
                                ? 'bg-neutral-100 border-2 border-black focus:bg-white'
                                : 'bg-[#141210] border border-[#2e2924] text-[#f5f3ec] placeholder:text-[#78716c] focus:border-[#bef264]'
                        }`}
                    />
                </div>
            </div>

            {/* Friends List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {filteredFriends.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className={`w-10 h-10 mx-auto mb-2 ${isBento ? 'text-gray-400' : 'text-[#78716c]'}`} />
                        <p className={`font-bold text-xs ${isBento ? 'opacity-60' : 'text-[#a8a29e]'}`}>
                            {friendsList.length === 0 ? 'No friends added yet.' : 'No matching friends found.'}
                        </p>
                        {friendsList.length === 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    closeChat();
                                    navigate('/social');
                                }}
                                className={`mt-3 text-xs font-black underline cursor-pointer ${
                                    isBento ? 'text-indigo-500 hover:text-indigo-600' : 'text-[#bef264] hover:text-[#d2fa8a]'
                                }`}
                            >
                                Add Friends on Social Hub →
                            </button>
                        )}
                    </div>
                ) : (
                    filteredFriends.map(friend => {
                        const isOnline = onlineUserIds.has(friend.userId);
                        const unread = unreadByFriend[friend.userId] || 0;
                        const lastMsg = directMessages[friend.userId]?.slice(-1)[0];
                        const isSelected = activeFriend?.userId === friend.userId;

                        return (
                            <div
                                key={friend.userId}
                                onClick={() => {
                                    setActiveFriend(friend);
                                    markFriendAsRead(friend.userId);
                                }}
                                className={`p-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer select-none ${
                                    isSelected
                                        ? (isBento
                                            ? 'bg-[#fed7aa] border-2 border-black shadow-[3px_3px_0px_#000]'
                                            : 'bg-[#192211] border border-[#bef264]/55 text-[#f5f3ec]')
                                        : (isBento
                                            ? 'bg-white border-2 border-black shadow-[2.5px_2.5px_0px_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#000]'
                                            : 'bg-[#141210] hover:bg-[#1a1714] border border-[#2e2924]')
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="relative shrink-0">
                                        {friend.avatar ? (
                                            <Avatar config={friend.avatar} size="sm" className="w-10 h-10 rounded-full" />
                                        ) : (
                                            <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm ${
                                                isBento ? 'bg-sky-600 text-white' : 'bg-[#1a1714] border border-[#2e2924] text-[#bef264]'
                                            }`}>
                                                {friend.name.charAt(0)}
                                            </div>
                                        )}
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                                            isBento ? 'border-white' : 'border-[#141210]'
                                        } ${
                                            isOnline ? (isBento ? 'bg-emerald-500' : 'bg-[#bef264]') : 'bg-[#78716c]'
                                        }`} />
                                    </div>

                                    <div className="truncate">
                                        <p className="font-black text-sm truncate">{friend.name}</p>
                                        <p className={`text-[11px] truncate font-semibold ${isBento ? 'text-gray-500' : 'text-[#a8a29e]'}`}>
                                            {lastMsg ? lastMsg.content : (isOnline ? 'Active now' : 'Offline')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {unread > 0 && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#fb7185] text-[#0a0908]">
                                            {unread}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartDuel(friend);
                                        }}
                                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                                            isBento
                                                ? 'bg-[#bef264] text-black border border-black hover:bg-[#a3e635]'
                                                : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/35 hover:bg-[#2e2713]'
                                        }`}
                                        title="Challenge to Duel"
                                    >
                                        <Swords className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );

    const renderActiveConversation = (isSplit: boolean) => {
        if (!activeFriend) return null;

        return (
            <div className="flex-1 flex flex-col overflow-hidden h-full">
                {/* Direct Chat Header */}
                <div className={`p-2.5 sm:p-3 border-b flex items-center justify-between text-xs shrink-0 ${
                    isBento ? 'bg-sky-50 border-black/10' : 'bg-[#141210] border-[#2e2924]'
                }`}>
                    <div className={`flex items-center justify-between w-full ${isFullscreen ? 'max-w-4xl mx-auto' : ''}`}>
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            <button
                                type="button"
                                onClick={() => setActiveFriend(null)}
                                className={`p-1.5 rounded-xl transition-colors shrink-0 cursor-pointer ${
                                    isBento ? 'hover:bg-black/10' : 'hover:bg-[#1a1714] text-[#a8a29e] hover:text-[#f5f3ec]'
                                } ${
                                    isSplit ? 'md:hidden' : ''
                                }`}
                                title="Back to all friends"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div
                                onClick={() => openUserProfile(activeFriend.userId)}
                                className="flex items-center gap-2 sm:gap-2.5 min-w-0 cursor-pointer group"
                                title={`View ${activeFriend.name}'s profile`}
                            >
                                <div className="relative group-hover:scale-105 transition-transform shrink-0">
                                    {activeFriend.avatar ? (
                                        <Avatar config={activeFriend.avatar} size="sm" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full" />
                                    ) : (
                                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full font-bold flex items-center justify-center text-xs ${
                                            isBento ? 'bg-sky-600 text-white' : 'bg-[#1a1714] border border-[#2e2924] text-[#bef264]'
                                        }`}>
                                            {activeFriend.name.charAt(0)}
                                        </div>
                                    )}
                                    {onlineUserIds.has(activeFriend.userId) && (
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border animate-pulse ${
                                            isBento ? 'bg-emerald-500 border-white' : 'bg-[#bef264] border-[#141210]'
                                        }`} />
                                    )}
                                </div>
                                <div className="truncate">
                                    <p className={`font-black text-xs sm:text-sm truncate transition-colors ${
                                        isBento ? 'group-hover:text-indigo-600' : 'group-hover:text-[#bef264]'
                                    }`}>{activeFriend.name}</p>
                                    <p className={`text-[9px] sm:text-[10px] flex items-center gap-1 font-bold truncate ${
                                        isBento ? 'text-gray-500' : 'text-[#a8a29e]'
                                    }`}>
                                        {onlineUserIds.has(activeFriend.userId) ? (
                                            <span className={`font-extrabold ${isBento ? 'text-emerald-500' : 'text-[#bef264]'}`}>Online</span>
                                        ) : (
                                            <span>Offline</span>
                                        )}
                                        <span>•</span>
                                        <span>Lvl {activeFriend.level || 1}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => handleStartDuel(activeFriend)}
                            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                            }`}
                            title="Send Quiz Duel Challenge"
                        >
                            <Swords className="w-3.5 h-3.5" />
                            <span className="hidden xs:inline">Duel</span>
                        </button>
                    </div>
                </div>

                {/* Direct Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    <div className={`w-full space-y-3 ${isFullscreen ? 'max-w-4xl mx-auto' : ''}`}>
                        {currentDmMessages.length === 0 ? (
                            <div className="text-center py-16">
                                <MessageCircle className={`w-12 h-12 mx-auto mb-2 ${isBento ? 'text-gray-400 opacity-60' : 'text-[#78716c]'}`} />
                                <p className="font-bold text-sm">No messages yet with {activeFriend.name}.</p>
                                <p className={`text-xs mt-1 ${isBento ? 'opacity-60' : 'text-[#a8a29e]'}`}>Send a message or challenge them to a quiz duel!</p>
                            </div>
                        ) : (
                            currentDmMessages.map(msg => {
                                const isMe = msg.senderId === currentUser.userId;
                                const isChallenge = msg.type === 'challenge';

                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative`}>
                                        <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm transition-all ${
                                            isMe
                                                ? (isBento ? 'bg-[#bae6fd] text-black border-2 border-black' : 'bg-[#192211] text-[#f5f3ec] border border-[#bef264]/45')
                                                : (isBento ? 'bg-white text-black border-2 border-black' : 'bg-[#141210] text-[#f5f3ec] border border-[#2e2924]')
                                        }`}>
                                            {isChallenge ? (
                                                <div className="space-y-2">
                                                    <div className={`flex items-center gap-1.5 font-black text-xs ${isBento ? 'text-amber-600' : 'text-[#fde047]'}`}>
                                                        <Swords className="w-4 h-4" />
                                                        <span>QUIZ DUEL CHALLENGE</span>
                                                    </div>
                                                    <p className="font-bold text-xs">{msg.content}</p>
                                                    {!isMe && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                closeChat();
                                                                if (msg.challengeData?.roomId && msg.challengeData.roomId !== 'pending_room_id') {
                                                                    navigate('/game/vs', {
                                                                        state: {
                                                                            quizId: msg.challengeData.quizId,
                                                                            opponent: { id: msg.senderId, name: msg.senderName },
                                                                            roomId: msg.challengeData.roomId
                                                                        }
                                                                    });
                                                                } else {
                                                                    navigate(`/quiz/${msg.challengeData?.quizId || 'general'}`);
                                                                }
                                                            }}
                                                            className={`w-full py-2 font-black text-xs rounded-xl shadow cursor-pointer ${
                                                                isBento
                                                                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                                            }`}
                                                        >
                                                            Accept Challenge →
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-xs sm:text-sm font-medium leading-relaxed break-words">{msg.content}</p>
                                            )}

                                            <div className="flex items-center justify-end mt-1 text-[9px] opacity-60 font-semibold select-none">
                                                <span className="font-tabular tracking-tight">
                                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Direct Message Input Bar */}
                {renderInputBar(`Message ${activeFriend.name}...`)}
            </div>
        );
    };

    return (
        <div className={`fixed inset-0 z-[10010] chat-overlay-shell flex ${
            isFullscreen ? 'items-stretch justify-stretch' : 'justify-end items-stretch pointer-events-none'
        } animate-in fade-in duration-200`}>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 ${
                    isFullscreen ? 'bg-black/85' : 'bg-black/25 dark:bg-black/50 pointer-events-auto'
                } transition-opacity`}
                onClick={isFullscreen ? () => setIsFullscreen(false) : handleCloseOrReturn}
                aria-hidden="true"
            />

            {/* Sliding Panel */}
            <div className={`relative ${
                isFullscreen ? 'w-full h-full max-w-none rounded-none' : 'w-full max-w-md h-full'
            } pointer-events-auto flex flex-col shadow-2xl ${
                isFullscreen ? '' : 'animate-in slide-in-from-right duration-300'
            } ${
                isBento
                    ? 'bg-white text-black' + (isFullscreen ? '' : ' border-l-[3px] border-black')
                    : 'bg-[#0e0d0b] text-[#f5f3ec]' + (isFullscreen ? '' : ' border-l border-[#2e2924]')
            }`}>
                {/* Header */}
                <div className={`p-3 sm:p-4 border-b flex flex-col gap-2.5 sm:gap-3 shrink-0 ${
                    isBento
                        ? 'bg-[#fde047] border-b-[2.5px] border-black text-black'
                        : 'bg-[#141210] border-[#2e2924] text-[#f5f3ec]'
                }`}>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-black text-sm sm:text-base uppercase tracking-tight min-w-0">
                            <span className={`p-1.5 rounded-xl shrink-0 ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black'
                                    : 'bg-[#192211] text-[#bef264] border border-[#bef264]/40'
                            }`}>
                                <MessageCircle className="w-4 h-4 shrink-0" />
                            </span>
                            <span className="truncate">Social Chat Hub</span>
                            {isFullscreen && <span className="text-[10px] sm:text-xs opacity-75 font-mono lowercase tracking-normal shrink-0">(fullscreen)</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {returnToLabel && (
                                <button
                                    type="button"
                                    onClick={handleCloseOrReturn}
                                    className={`btn-unstyled inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                                        isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#a3e635]'
                                            : 'bg-[#1a1714] hover:bg-[#24201c] text-[#bef264] border border-[#bef264]/35'
                                    }`}
                                    title={`Return to ${returnToLabel}`}
                                >
                                    <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                                    <span className="hidden sm:inline">Back to {returnToLabel}</span>
                                    <span className="sm:hidden">Back</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsFullscreen(prev => !prev)}
                                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100'
                                        : 'bg-[#1a1714] text-[#a8a29e] hover:text-[#f5f3ec] hover:bg-[#24201c] border border-[#2e2924]'
                                }`}
                                title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen Mode'}
                                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
                            >
                                {isFullscreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                            </button>
                            <button
                                type="button"
                                onClick={handleCloseOrReturn}
                                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100'
                                        : 'bg-[#1a1714] text-[#a8a29e] hover:text-[#f5f3ec] hover:bg-[#24201c] border border-[#2e2924]'
                                }`}
                                title={returnToLabel ? `Close & return to ${returnToLabel}` : 'Close Chat'}
                            >
                                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className={`flex items-center gap-1.5 sm:gap-2 p-1 rounded-xl ${
                        isBento ? 'bg-black/10' : 'bg-[#0a0908] border border-[#2e2924]'
                    }`}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('direct')}
                            className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer truncate ${
                                activeTab === 'direct'
                                    ? (isBento ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#bef264] text-[#0a0908]')
                                    : (isBento ? 'opacity-70 hover:opacity-100' : 'text-[#a8a29e] hover:text-[#f5f3ec] hover:bg-[#1a1714]')
                            }`}
                        >
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Friends ({friendsList.length})</span>
                            {Object.values(unreadByFriend).reduce((a, b) => a + b, 0) > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 bg-[#fb7185] text-[#0a0908] rounded-full text-[10px] shrink-0">
                                    {Object.values(unreadByFriend).reduce((a, b) => a + b, 0)}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('clan');
                                markClanAsRead();
                            }}
                            className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer truncate ${
                                activeTab === 'clan'
                                    ? (isBento ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#bef264] text-[#0a0908]')
                                    : (isBento ? 'opacity-70 hover:opacity-100' : 'text-[#a8a29e] hover:text-[#f5f3ec] hover:bg-[#1a1714]')
                            }`}
                        >
                            <Shield className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Class</span>
                            {clan && <span className="opacity-75 hidden xs:inline truncate">[{clan.tag}]</span>}
                            {unreadClanCount > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 bg-[#fb7185] text-[#0a0908] rounded-full text-[10px] shrink-0">
                                    {unreadClanCount}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('buddy')}
                            className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer truncate ${
                                activeTab === 'buddy'
                                    ? (isBento ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#bef264] text-[#0a0908]')
                                    : (isBento ? 'opacity-70 hover:opacity-100' : 'text-[#a8a29e] hover:text-[#f5f3ec] hover:bg-[#1a1714]')
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Buddy</span>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* TAB: CLAN CHAT */}
                    {activeTab === 'clan' && (
                        clan ? (
                            <div className="flex-1 flex flex-col overflow-hidden h-full">
                                {/* Clan Banner Subheader */}
                                <div className={`p-2.5 sm:p-3 border-b flex items-center justify-between text-xs shrink-0 ${
                                    isBento ? 'bg-yellow-50 border-black/10' : 'bg-[#141210] border-[#2e2924]'
                                }`}>
                                    <div className={`flex items-center justify-between w-full ${isFullscreen ? 'max-w-4xl mx-auto' : ''}`}>
                                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                                            <ClanEmblem
                                                logo={clan.logo}
                                                tag={clan.tag}
                                                name={clan.name}
                                                size="sm"
                                            />
                                            <div className="truncate">
                                                <p className="font-black text-xs sm:text-sm truncate">[{clan.tag}] {clan.name}</p>
                                                <p className="text-[10px] sm:text-[11px] opacity-70 flex items-center gap-1.5 sm:gap-2 truncate">
                                                    <span>Lvl {clan.level}</span>
                                                    <span>•</span>
                                                    <span>{clan.members?.length || 1} Members</span>
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                closeChat();
                                                navigate('/clans');
                                            }}
                                            className="text-xs font-bold underline opacity-80 hover:opacity-100 flex items-center gap-1 cursor-pointer shrink-0"
                                        >
                                            <span>Hub</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>

                                {/* Clan Messages Feed */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                    <div className={`w-full space-y-3 ${isFullscreen ? 'max-w-4xl mx-auto' : ''}`}>
                                        {clanMessages.length === 0 ? (
                                            <div className="text-center py-16">
                                                <Shield className={`w-12 h-12 mx-auto mb-2 ${isBento ? 'text-gray-400 opacity-60' : 'text-[#78716c]'}`} />
                                                <p className="font-bold text-sm">No class messages yet.</p>
                                                <p className={`text-xs mt-1 ${isBento ? 'opacity-60' : 'text-[#a8a29e]'}`}>Be the first to say hello to your class!</p>
                                            </div>
                                        ) : (
                                            clanMessages.map(msg => {
                                                const isMe = msg.senderId === currentUser.userId;
                                                return (
                                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative`}>
                                                        <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm transition-all ${
                                                            isMe
                                                                ? (isBento ? 'bg-[#bef264] text-black border-2 border-black' : 'bg-[#192211] text-[#f5f3ec] border border-[#bef264]/45')
                                                                : (isBento ? 'bg-white text-black border-2 border-black' : 'bg-[#141210] text-[#f5f3ec] border border-[#2e2924]')
                                                        }`}>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span
                                                                    onClick={() => openUserProfile(msg.senderId)}
                                                                    className="text-[11px] font-black opacity-80 hover:underline cursor-pointer"
                                                                    title={`View ${msg.senderName}'s profile`}
                                                                >
                                                                    {msg.senderName}
                                                                </span>
                                                                {msg.senderRole === 'leader' && (
                                                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-black uppercase bg-amber-400 text-black">
                                                                        Leader
                                                                    </span>
                                                                )}
                                                                {msg.senderRole === 'elder' && (
                                                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-black uppercase bg-blue-400 text-black">
                                                                        Elder
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {editingClanMsgId === msg.id ? (
                                                                <div className="space-y-2">
                                                                    <input
                                                                        value={editClanMsgContent}
                                                                        onChange={e => setEditClanMsgContent(e.target.value)}
                                                                        className="w-full p-2 text-xs rounded border text-black bg-white"
                                                                    />
                                                                    <div className="flex justify-end gap-1.5">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setEditingClanMsgId(null)}
                                                                            className="px-2 py-1 text-[10px] font-bold"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                editClanMessage(msg.id, editClanMsgContent);
                                                                                setEditingClanMsgId(null);
                                                                            }}
                                                                            className="px-2 py-1 text-[10px] font-black bg-black text-white rounded"
                                                                        >
                                                                            Save
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs sm:text-sm font-medium leading-relaxed break-words">{msg.content}</p>
                                                            )}

                                                            <div className="flex items-center justify-end gap-2 mt-1 text-[9px] opacity-60 font-semibold select-none">
                                                                <span className="font-tabular tracking-tight">
                                                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                                </span>
                                                                {(isMe || isLeader) && !editingClanMsgId && (
                                                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                                                        {isMe && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setEditingClanMsgId(msg.id);
                                                                                    setEditClanMsgContent(msg.content);
                                                                                }}
                                                                                className="hover:underline p-0.5"
                                                                                title="Edit"
                                                                            >
                                                                            <Edit2 className="w-2.5 h-2.5" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => deleteClanMessage(msg.id)}
                                                                        className="hover:text-red-500 p-0.5"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="w-2.5 h-2.5" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </div>

                                {/* Clan Input Bar */}
                                {renderInputBar(`Message [${clan.tag}]...`)}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                                    isBento ? 'bg-[#faf8f2] border-2 border-black text-black' : 'bg-[#141210] border border-[#2e2924] text-[#a8a29e]'
                                }`}>
                                    <Shield className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-black uppercase tracking-tight">No Class Yet</h3>
                                <p className={`text-xs max-w-xs mt-1.5 mb-6 leading-relaxed ${isBento ? 'text-gray-600' : 'text-[#a8a29e]'}`}>
                                    Join a class to unlock class chat, group challenges, and shared XP!
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        closeChat();
                                        navigate('/classes');
                                    }}
                                    className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                        isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000]'
                                            : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                    }`}
                                >
                                    Explore Classes
                                </button>
                            </div>
                        )
                    )}

                    {/* TAB: BUDDY AI */}
                    {activeTab === 'buddy' && (
                        <BuddyChatPanel isFullscreen={isFullscreen} />
                    )}

                    {/* TAB: DIRECT MESSAGES */}
                    {activeTab === 'direct' && (
                        isFullscreen ? (
                            /* Fullscreen Split View for Direct Messages */
                            <div className="flex-1 flex flex-col md:flex-row overflow-hidden h-full">
                                {/* Left: Friends Directory (Fixed 320px on desktop) */}
                                <div className={`w-full md:w-80 border-r flex flex-col shrink-0 h-full overflow-hidden ${
                                    isBento ? 'border-black/15' : 'border-[#2e2924]'
                                } ${
                                    activeFriend ? 'hidden md:flex' : 'flex'
                                }`}>
                                    {renderFriendsList()}
                                </div>

                                {/* Right: Active Conversation or Selection Placeholder */}
                                <div className={`flex-1 flex flex-col h-full overflow-hidden ${
                                    !activeFriend ? 'hidden md:flex' : 'flex'
                                }`}>
                                    {activeFriend ? (
                                        renderActiveConversation(true)
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                            <Users className={`w-16 h-16 mb-3 ${isBento ? 'text-gray-400 opacity-60' : 'text-[#78716c]'}`} />
                                            <h3 className="text-lg font-black uppercase tracking-tight">Select a Friend</h3>
                                            <p className={`text-xs max-w-xs mt-1 ${isBento ? 'text-gray-500 opacity-75' : 'text-[#a8a29e]'}`}>
                                                Choose a friend from the list on the left to start chatting in real-time or challenge them to a quiz duel!
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Drawer View: Either Friends List or Active Conversation */
                            <div className="flex-1 flex flex-col overflow-hidden h-full">
                                {activeFriend ? renderActiveConversation(false) : renderFriendsList()}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default GlobalChatDrawer;
