import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Send, Sparkles, Trash2, ArrowUpRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../lib/api';
import { BuddyAvatar } from '../buddy/BuddyAvatar';

interface BuddyChatAction {
    label: string;
    route: string;
}

interface BuddyChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    mood?: 'happy' | 'excited' | 'cool' | 'neutral';
    suggestedActions?: BuddyChatAction[];
    blocked?: boolean;
    createdAt: string;
}

const MAX_STORED_MESSAGES = 30;

export const BuddyChatPanel: React.FC<{ isFullscreen?: boolean }> = ({ isFullscreen = false }) => {
    const { currentUser } = useAuth();
    const { closeChat, pendingBuddyPrompt, clearPendingBuddyPrompt } = useChat();
    const { isBento } = useTheme();
    const { language, tx } = useLanguage();
    const navigate = useNavigate();

    const storageKey = useMemo(
        () => (currentUser?.userId ? `fr_buddy_chat_${currentUser.userId}` : 'fr_buddy_chat_guest'),
        [currentUser?.userId]
    );

    const [messages, setMessages] = useState<BuddyChatMessage[]>(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.slice(-MAX_STORED_MESSAGES);
            }
        } catch {
            // Ignore malformed history
        }
        return [];
    });

    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [buddyMood, setBuddyMood] = useState<'happy' | 'excited' | 'cool' | 'neutral'>('happy');
    const [errorBanner, setErrorBanner] = useState<string | null>(null);
    const feedEndRef = useRef<HTMLDivElement>(null);
    const isSendingRef = useRef(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setMessages(parsed.slice(-MAX_STORED_MESSAGES));
                    return;
                }
            }
            setMessages([]);
        } catch {
            setMessages([]);
        }
    }, [storageKey]);

    const persistMessages = useCallback(
        (next: BuddyChatMessage[]) => {
            const trimmed = next.slice(-MAX_STORED_MESSAGES);
            try {
                localStorage.setItem(storageKey, JSON.stringify(trimmed));
            } catch {
                // Ignore storage quota errors
            }
        },
        [storageKey]
    );

    useEffect(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, isSending]);

    const sendPrompt = useCallback(
        async (rawText: string) => {
            const trimmed = rawText.trim().slice(0, 600);
            if (!trimmed || isSendingRef.current) return;

            isSendingRef.current = true;
            setIsSending(true);
            setErrorBanner(null);
            setBuddyMood('cool');

            const userMsg: BuddyChatMessage = {
                id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                role: 'user',
                content: trimmed,
                createdAt: new Date().toISOString(),
            };

            const historyPayload = messages.slice(-6).map((m) => ({
                role: m.role,
                content: m.content.slice(0, 400),
            }));

            const afterUser = [...messages, userMsg].slice(-MAX_STORED_MESSAGES);
            setMessages(afterUser);
            persistMessages(afterUser);
            setInput('');

            try {
                const res = await api.chatWithStudyBuddy({
                    message: trimmed,
                    history: historyPayload,
                    language,
                });

                const nextMood = res.mood || 'happy';
                setBuddyMood(nextMood);

                const assistantMsg: BuddyChatMessage = {
                    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    role: 'assistant',
                    content: res.reply,
                    mood: nextMood,
                    suggestedActions: Array.isArray(res.suggestedActions) ? res.suggestedActions : [],
                    blocked: Boolean(res.blocked),
                    createdAt: new Date().toISOString(),
                };

                const nextAll = [...afterUser, assistantMsg].slice(-MAX_STORED_MESSAGES);
                setMessages(nextAll);
                persistMessages(nextAll);
            } catch (err) {
                const msg = err instanceof Error ? err.message : tx('Could not reach Study Buddy.', 'تعذر الاتصال برفيقك الدراسي.');
                setErrorBanner(msg);
                setBuddyMood('neutral');
            } finally {
                isSendingRef.current = false;
                setIsSending(false);
            }
        },
        [messages, persistMessages, language, tx]
    );

    // Consume pending prompt sent from RoamingStudyBuddy or AnalyticsPanel
    useEffect(() => {
        if (pendingBuddyPrompt && !isSendingRef.current) {
            const promptToSend = pendingBuddyPrompt;
            clearPendingBuddyPrompt();
            void sendPrompt(promptToSend);
        }
    }, [pendingBuddyPrompt, clearPendingBuddyPrompt, sendPrompt]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void sendPrompt(input);
    };

    const handleClearHistory = () => {
        setMessages([]);
        setErrorBanner(null);
        setBuddyMood('happy');
        try {
            localStorage.removeItem(storageKey);
        } catch {
            // Ignore
        }
    };

    const quickChips = useMemo(
        () =>
            language === 'ar-EG'
                ? [
                      'اعملي جدول مذاكرة للأسبوع ده',
                      'إيه أضعف مواضيعي وأحسنها إزاي؟',
                      'رشحلي كويز أو مسار مناسب لمستواي',
                      'حفّل على أرقامي وشجعني!',
                  ]
                : [
                      'Build me a 5-day study plan',
                      'Review my weak topics & next drills',
                      'Recommend a quiz or skill track for me',
                      'Roast my stats and hype me up!',
                  ],
        [language]
    );

    const firstName = (currentUser?.name || tx('Learner', 'بطل')).split(' ')[0];

    return (
        <div className="flex-1 flex flex-col overflow-hidden h-full">
            {/* Buddy Header Bar */}
            <div
                className={`p-2.5 sm:p-3 border-b flex items-center justify-between gap-2 shrink-0 ${
                    isBento ? 'bg-[#f5f3ec] border-black/15' : 'bg-[#141210] border-[#2e2924]'
                }`}
            >
                <div className={`flex items-center justify-between w-full gap-2 ${isFullscreen ? 'max-w-4xl mx-auto' : ''}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 ${
                                isBento
                                    ? 'bg-[#bef264] border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#192211] border border-[#bef264]/45'
                            }`}
                        >
                            <BuddyAvatar
                                avatar={currentUser?.avatar}
                                moodOverride={isSending ? 'cool' : buddyMood}
                                size="xs"
                                animated
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <p className="font-black text-xs sm:text-sm truncate">
                                    {tx(`${firstName}'s Study Buddy`, `رفيق ${firstName} الدراسي`)}
                                </p>
                                <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                        isBento
                                            ? 'bg-[#bae6fd] text-black border border-black'
                                            : 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/35'
                                    }`}
                                >
                                    <ShieldCheck className="w-2.5 h-2.5" />
                                    <span>{tx('Study & Site Coach', 'مدرب المذاكرة')}</span>
                                </span>
                            </div>
                            <p className={`text-[10px] font-semibold truncate ${isBento ? 'text-neutral-600' : 'text-[#a8a29e]'}`}>
                                {isSending
                                    ? tx('Analyzing your stats & study path...', 'بيفحص مستواك ويجهز الخطة...')
                                    : tx('Study plans, weak topics & Future Robins recommendations', 'خطط مذاكرة، مراجعة نقاط الضعف وترشيحات المنصة')}
                            </p>
                        </div>
                    </div>

                    {messages.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearHistory}
                            className={`p-1.5 rounded-xl text-xs transition cursor-pointer shrink-0 ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black hover:bg-[#fecdd3]'
                                    : 'bg-[#1a1714] text-[#a8a29e] hover:text-[#fb7185] border border-[#2e2924]'
                            }`}
                            title={tx('Clear Buddy Chat', 'مسح المحادثة')}
                            aria-label={tx('Clear Buddy Chat', 'مسح المحادثة')}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar">
                <div className={`w-full space-y-3 ${isFullscreen ? 'max-w-4xl mx-auto' : ''}`}>
                    {messages.length === 0 ? (
                        <div className="py-8 px-2 text-center space-y-4">
                            <div className="flex justify-center">
                                <div
                                    className={`p-2 rounded-full ${
                                        isBento
                                            ? 'bg-[#fde047] border-[2.5px] border-black shadow-[4px_4px_0px_#000]'
                                            : 'bg-[#141210] border border-[#bef264]/40'
                                    }`}
                                >
                                    <BuddyAvatar
                                        avatar={currentUser?.avatar}
                                        moodOverride="excited"
                                        size="lg"
                                        animated
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm sm:text-base font-black uppercase tracking-tight">
                                    {tx(`Yo ${firstName}! Let's lock in.`, `أهلاً يا ${firstName}! يلا نخططها صح.`)}
                                </h3>
                                <p className={`text-xs max-w-xs mx-auto leading-relaxed ${isBento ? 'text-neutral-600 font-semibold' : 'text-[#a8a29e]'}`}>
                                    {tx(
                                        'Ask me for a custom study schedule, help on weak quiz topics, or which track to tackle next.',
                                        'اسألني عن جدول مذاكرة مخصص، شرح مفاهيم صعبة، أو أنسب كويز ومسار ليك دلوقتي.'
                                    )}
                                </p>
                            </div>
                            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                                {quickChips.map((chip) => (
                                    <button
                                        key={chip}
                                        type="button"
                                        onClick={() => void sendPrompt(chip)}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#bef264]'
                                                : 'bg-[#141210] text-[#f5f3ec] border border-[#2e2924] hover:border-[#bef264]/60'
                                        }`}
                                    >
                                        <Sparkles className="w-3 h-3 inline me-1 text-[#bef264]" />
                                        {chip}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[88%] rounded-2xl p-3 shadow-sm ${
                                            isUser
                                                ? isBento
                                                    ? 'bg-[#bae6fd] text-black border-2 border-black'
                                                    : 'bg-[#192211] text-[#f5f3ec] border border-[#bef264]/45'
                                                : isBento
                                                ? 'bg-white text-black border-2 border-black'
                                                : 'bg-[#141210] text-[#f5f3ec] border border-[#2e2924]'
                                        }`}
                                    >
                                        <p className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-line break-words">
                                            {msg.content}
                                        </p>

                                        {!isUser && Array.isArray(msg.suggestedActions) && msg.suggestedActions.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-black/10 dark:border-white/10">
                                                {msg.suggestedActions.map((act, idx) => (
                                                    <button
                                                        key={`${msg.id}-act-${idx}`}
                                                        type="button"
                                                        onClick={() => {
                                                            closeChat();
                                                            navigate(act.route);
                                                        }}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                                                            isBento
                                                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border border-black shadow-[1.5px_1.5px_0px_#000]'
                                                                : 'bg-[#1c2317] hover:bg-[#25301d] text-[#bef264] border border-[#bef264]/40'
                                                        }`}
                                                    >
                                                        <span>{act.label}</span>
                                                        <ArrowUpRight className="w-3 h-3" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-end mt-1 text-[9px] opacity-60 font-semibold select-none">
                                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {isSending && (
                        <div className="flex justify-start">
                            <div
                                className={`rounded-2xl px-3.5 py-2.5 text-xs font-bold flex items-center gap-2 ${
                                    isBento
                                        ? 'bg-[#fef9c3] text-black border-2 border-black'
                                        : 'bg-[#141210] text-[#bef264] border border-[#bef264]/35'
                                }`}
                            >
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>{tx('Buddy is thinking...', 'رفيقك بيفكر...')}</span>
                            </div>
                        </div>
                    )}

                    {errorBanner && (
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-bold">
                            {errorBanner}
                        </div>
                    )}

                    <div ref={feedEndRef} />
                </div>
            </div>

            {/* Input Bar */}
            <div
                className={`p-2.5 sm:p-3 border-t shrink-0 ${
                    isBento ? 'bg-neutral-50 border-t-2 border-black' : 'bg-[#141210] border-[#2e2924]'
                }`}
            >
                <div className={`w-full ${isFullscreen ? 'max-w-4xl mx-auto' : ''}`}>
                    {messages.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-2 custom-scrollbar">
                            {quickChips.map((chip) => (
                                <button
                                    key={chip}
                                    type="button"
                                    disabled={isSending}
                                    onClick={() => void sendPrompt(chip)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0 transition-all cursor-pointer disabled:opacity-50 ${
                                        isBento
                                            ? 'bg-white text-black border border-black hover:bg-yellow-100 shadow-[1px_1px_0px_#000]'
                                            : 'bg-[#1a1714] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2e2924] hover:border-[#bef264]/50'
                                    }`}
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2">
                        <input
                            type="text"
                            maxLength={600}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isSending}
                            placeholder={tx('Ask Buddy for a study plan, topic help, or quiz pick...', 'اسأل رفيقك عن خطة مذاكرة أو كويز...')}
                            className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-3.5 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all disabled:opacity-60 ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#0a0908] border border-[#2e2924] text-[#f5f3ec] placeholder:text-[#78716c] focus:border-[#bef264]'
                            }`}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isSending}
                            className={`p-2 sm:p-2.5 rounded-xl font-black transition-all cursor-pointer disabled:opacity-40 shrink-0 ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-y-0.5'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                            }`}
                            title={tx('Send to Buddy', 'إرسال')}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BuddyChatPanel;
