import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send, User as UserIcon } from 'lucide-react';
import Avatar from '../Avatar';
import { useChat } from '../../context/ChatContext';
import type { UserData } from '../../types';

interface InlineDirectChatProps {
    friend: UserData;
    isBento: boolean;
    isFullscreen: boolean;
    onBack: () => void;
    onOpenProfile: (userId: string) => void;
}

export const InlineDirectChat: React.FC<InlineDirectChatProps> = ({
    friend,
    isBento,
    isFullscreen,
    onBack,
    onOpenProfile
}) => {
    const { directMessages, sendDirectMessage, markFriendAsRead, onlineUserIds } = useChat();
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);

    const messages = useMemo(() => directMessages[friend.userId] || [], [directMessages, friend.userId]);
    const isOnline = onlineUserIds.has(friend.userId);

    useEffect(() => {
        markFriendAsRead(friend.userId);
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, friend.userId, markFriendAsRead]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        const text = input.trim();
        if (!text) return;
        sendDirectMessage(friend.userId, text, 'text');
        setInput('');
    };

    return (
        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
            <header className={`px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-3 shrink-0 ${
                isBento ? 'bg-[#bae6fd] border-b-[2.5px] border-black' : 'bg-white/80 dark:bg-[#13141f]/90 border-slate-200 dark:border-white/10'
            }`}>
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={onBack}
                        className={`btn-unstyled inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-pointer shrink-0 ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-violet-600/10 text-violet-600 dark:text-violet-300 border border-violet-500/20'
                        }`}
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Class Chat</span>
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                            <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center text-[11px] font-black ${
                                isBento ? 'border-2 border-black bg-[#fde047] text-black' : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
                            }`}>
                                {friend.avatar ? (
                                    <Avatar config={friend.avatar} size="sm" className="w-full h-full object-cover" />
                                ) : (
                                    (friend.name || 'M').substring(0, 2).toUpperCase()
                                )}
                            </div>
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-black truncate text-slate-900 dark:text-white">{friend.name}</p>
                            <p className="text-[10px] font-bold text-slate-500">Private chat • {isOnline ? 'Online' : 'Offline'}</p>
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onOpenProfile(friend.userId)}
                    className={`btn-unstyled p-2 rounded-xl cursor-pointer shrink-0 ${
                        isBento ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                    }`}
                    title="View profile"
                    aria-label="View profile"
                >
                    <UserIcon className="w-4 h-4" />
                </button>
            </header>

            <div className={`flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2 custom-scrollbar ${
                isFullscreen ? 'min-h-0' : 'max-h-[480px] min-h-[340px]'
            } ${isBento ? 'bg-[#fafafa]' : 'bg-slate-50/70 dark:bg-[#0b0d16]'}`}>
                {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-xs font-bold text-slate-500">
                        No messages yet with {friend.name}. Say hi 👋
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId !== friend.userId;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm font-medium break-words ${
                                    isMe
                                        ? (isBento ? 'bg-[#bae6fd] text-black border-2 border-black' : 'bg-indigo-600 text-white')
                                        : (isBento ? 'bg-white text-black border-2 border-black' : 'bg-white dark:bg-white/10 text-slate-900 dark:text-white')
                                }`}>
                                    {msg.content}
                                    <div className="text-[9px] opacity-60 text-end mt-0.5">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={endRef} />
            </div>

            <form onSubmit={handleSend} className={`p-3 border-t shrink-0 flex items-center gap-2 ${
                isBento ? 'bg-white border-t-2 border-black' : 'bg-white dark:bg-[#13141f] border-slate-200 dark:border-white/10'
            }`}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Message ${friend.name}...`}
                    className={`chat-bare-input flex-1 px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none ${
                        isBento ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white'
                    }`}
                />
                <button
                    type="submit"
                    disabled={!input.trim()}
                    className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-black uppercase text-[11px] tracking-wider cursor-pointer disabled:opacity-45 ${
                        isBento ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-violet-600 text-white'
                    }`}
                >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                </button>
            </form>
        </div>
    );
};

export default InlineDirectChat;
