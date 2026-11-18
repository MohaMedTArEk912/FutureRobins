import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { shuffleQuestionsWithOptions } from '../../utils/shuffle';
import {
    Users,
    X,
    Copy,
    Check,
    UserPlus,
    Link,
    ArrowRight,
    Lock,
    Bot,
    Trash2,
    Play,
    Eye,
    Sparkles,
    Send,
    Clock,
    Wifi,
    Radio
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MathRenderer } from '../common/MathRenderer';
import { sounds } from '../../lib/soundEffects';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useClassroomSync } from './useClassroomSync';
import {
    ClassroomScoreStrip,
    ClassroomParticipantsScoreboard,
    ClassroomWaitingCard,
    ClassroomRevealSection,
    ClassroomPodiumSection,
    ClassroomQuestionCard,
    HostParticipatesControl
} from './ClassroomArenaShared';
import {
    OPTION_SHAPES,
    getOptionThemeClass,
    getRoleTag,
    formatRoomTimeLeft
} from './classroomHelpers';
import ConfirmDialog from '../ConfirmDialog';
import type { Quiz, ClassroomMode, ClassroomRoomState } from '../../types';

interface LiveHostModeProps {
    quiz?: Quiz;
    existingRoom?: ClassroomRoomState;
    initialMode?: ClassroomMode;
    initialHostParticipates?: boolean;
    initialQuestionTimeSec?: number;
    onClose: () => void;
}

export const LiveHostMode: React.FC<LiveHostModeProps> = ({
    quiz,
    existingRoom,
    initialMode = 'turn_based',
    initialHostParticipates = true,
    initialQuestionTimeSec = 25,
    onClose
}) => {
    const { currentUser } = useAuth();
    const { allUsers } = useData();
    const { showNotification } = useNotification();
    const { isBento } = useTheme();
    const { tx } = useLanguage();

    const [fallbackHostId] = useState(() => `host_${Math.floor(1000 + Math.random() * 9000)}`);
    const hostId = currentUser?.userId || fallbackHostId;
    const hostName = currentUser?.name || tx('Arena Host', 'مضيف الساحة');
    const hostRole = currentUser?.role || 'student';

    const questions = useMemo(() => {
        const raw = quiz?.questions || [];
        const withOptions = raw.filter(q => Array.isArray(q.options) && q.options.length > 0);
        return shuffleQuestionsWithOptions(withOptions.length > 0 ? withOptions : raw);
    }, [quiz]);

    const [pin, setPin] = useState<string | null>(existingRoom?.pin || null);
    const [creating, setCreating] = useState(!existingRoom);
    const [createError, setCreateError] = useState<string | null>(null);
    const [busyAction, setBusyAction] = useState(false);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);

    const [showInviteModal, setShowInviteModal] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedPin, setCopiedPin] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [exitingArena, setExitingArena] = useState(false);
    const [roomNowMs, setRoomNowMs] = useState(() => Date.now());

    const createdRef = useRef(false);
    const botTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const pinRef = useRef<string | null>(null);

    useEffect(() => {
        pinRef.current = pin;
    }, [pin]);

    const handleRoomUpdate = useCallback((next: ClassroomRoomState, prev: ClassroomRoomState | null) => {
        if (prev && prev.currentQuestionIndex !== next.currentQuestionIndex) {
            setSelectedOption(null);
        } else if (prev?.gameState !== 'question' && next.gameState === 'question') {
            setSelectedOption(null);
            sounds.playPowerUp();
        }

        if (prev?.gameState === 'question' && next.gameState === 'reveal') {
            if (next.mode === 'turn_based' && next.lastTurnResult) {
                if (next.lastTurnResult.isCorrect) sounds.playCorrect();
                else sounds.playIncorrect();
            } else if (next.mode === 'simultaneous' && next.roundReveal) {
                const mine = next.roundReveal.results.find(r => r.userId === hostId);
                if (mine) {
                    if (mine.isCorrect) sounds.playCorrect();
                    else sounds.playIncorrect();
                } else {
                    sounds.playCorrect();
                }
            }
        }

        if (prev?.gameState !== 'game_over' && next.gameState === 'game_over') {
            confetti({ particleCount: 150, spread: 95, origin: { y: 0.5 } });
        }
    }, [hostId]);

    const handleTimerExpired = useCallback(async (expiredRoom: ClassroomRoomState) => {
        if (!expiredRoom.pin || expiredRoom.gameState !== 'question') return;
        try {
            const res = await api.revealClassroomQuestion(expiredRoom.pin);
            setRoomState(res.room);
        } catch {
            // Safe ignore if already transitioned
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const {
        room,
        setRoom: setRoomState,
        error: syncError,
        timeLeft,
        socketConnected
    } = useClassroomSync({
        pin,
        enabled: Boolean(pin),
        onRoomUpdate: handleRoomUpdate,
        onRoomClosed: onClose,
        onTimerExpired: handleTimerExpired
    });

    const roomTimeLeft = useMemo(
        () => formatRoomTimeLeft(room?.expiresAt, roomNowMs),
        [room?.expiresAt, roomNowMs]
    );

    useEffect(() => {
        if (!room?.expiresAt) return;
        setRoomNowMs(Date.now());
        const ticker = setInterval(() => setRoomNowMs(Date.now()), 1000);
        return () => clearInterval(ticker);
    }, [room?.expiresAt]);

    useEffect(() => {
        if (roomTimeLeft?.expired) {
            onClose();
        }
    }, [roomTimeLeft?.expired, onClose]);

    // Create live MongoDB + Socket room on mount (or adopt existingRoom on host promotion)
    useEffect(() => {
        if (createdRef.current) return;
        createdRef.current = true;

        if (existingRoom) {
            setPin(existingRoom.pin);
            setRoomState(existingRoom);
            setCreating(false);
            return;
        }

        if (!quiz) {
            setCreateError('Quiz data is missing');
            setCreating(false);
            return;
        }

        setCreating(true);
        api.createClassroomRoom({
            hostId,
            hostName,
            hostRole,
            mode: initialMode,
            hostParticipates: initialHostParticipates,
            questionTimeSec: initialQuestionTimeSec,
            quizData: {
                id: String(quiz.id || quiz._id || ''),
                title: quiz.title,
                questions: questions.map((q, idx) => ({
                    id: q.id ?? idx,
                    question: q.question,
                    options: q.options || [],
                    codeSnippet: q.codeSnippet || '',
                    imageUrl: q.imageUrl || '',
                    correctAnswer:
                        typeof q.correctAnswer === 'number' || typeof q.correctAnswer === 'string'
                            ? q.correctAnswer
                            : String(q.correctAnswer ?? ''),
                    points: q.points || 10,
                    explanation: q.explanation || ''
                }))
            }
        })
            .then((res) => {
                setPin(res.room.pin);
                setRoomState(res.room);
            })
            .catch((err) => {
                setCreateError(err instanceof Error ? err.message : 'Could not create live room');
            })
            .finally(() => {
                setCreating(false);
            });
    }, [existingRoom, hostId, hostName, hostRole, initialMode, initialHostParticipates, initialQuestionTimeSec, quiz, questions, setRoomState]);

    // Clean up pending bot timers on unmount
    useEffect(() => {
        const timers = botTimersRef.current;
        return () => {
            Object.values(timers).forEach(clearTimeout);
        };
    }, []);

    // Vercel-safe Practice Bot turn / submission automation (runs only for explicitly added isBot players)
    useEffect(() => {
        if (!room || room.gameState !== 'question') {
            Object.values(botTimersRef.current).forEach(clearTimeout);
            botTimersRef.current = {};
            return;
        }

        const bots = room.players.filter(p => p.isBot && !p.isSpectator);
        const submittedSet = new Set(room.submittedUserIds || []);

        if (room.mode === 'turn_based') {
            const activeBot = bots.find(b => b.id === room.currentTurnUserId);
            if (!activeBot) return;
            const key = `${room.pin}:turn:${room.currentQuestionIndex}:${activeBot.id}`;
            if (botTimersRef.current[key]) return;

            botTimersRef.current[key] = setTimeout(() => {
                api.submitClassroomAnswer(room.pin, {
                    userId: activeBot.id,
                    questionIndex: room.currentQuestionIndex,
                    answerIndex: 0,
                    autoAnswer: true
                })
                    .then(res => setRoomState(res.room))
                    .catch(() => {});
            }, 1800);
        } else {
            bots.forEach((bot, idx) => {
                if (submittedSet.has(bot.id) || bot.hasSubmitted) return;
                const key = `${room.pin}:sim:${room.currentQuestionIndex}:${bot.id}`;
                if (botTimersRef.current[key]) return;

                botTimersRef.current[key] = setTimeout(() => {
                    api.submitClassroomAnswer(room.pin, {
                        userId: bot.id,
                        questionIndex: room.currentQuestionIndex,
                        answerIndex: 0,
                        autoAnswer: true
                    })
                        .then(res => setRoomState(res.room))
                        .catch(() => {});
                }, 1400 + idx * 650);
            });
        }
    }, [room, setRoomState]);

    const handleCloseArena = useCallback(async () => {
        setExitingArena(true);
        if (pinRef.current) {
            try {
                await api.leaveClassroomRoom(pinRef.current, hostId);
            } catch {
                // Always allow host to close local view even if room already expired
            }
        }
        setExitingArena(false);
        setShowExitConfirm(false);
        onClose();
    }, [hostId, onClose]);

    const requestCloseArena = useCallback(() => {
        if (creating || createError || !room || room.gameState === 'game_over') {
            void handleCloseArena();
            return;
        }
        setShowExitConfirm(true);
    }, [creating, createError, room, handleCloseArena]);

    const handleCopyInviteLink = useCallback(() => {
        if (!pin) return;
        const inviteUrl = `${window.location.origin}/live-arena?pin=${pin}`;
        navigator.clipboard.writeText(inviteUrl);
        setCopiedLink(true);
        showNotification('success', tx('Live Arena invite link copied!', 'تم نسخ رابط الدعوة للساحة!'), { title: tx('🔗 Link Ready', '🔗 الرابط جاهز') });
        setTimeout(() => setCopiedLink(false), 2000);
    }, [pin, showNotification, tx]);

    const handleCopyPin = useCallback(() => {
        if (!pin) return;
        navigator.clipboard.writeText(pin);
        setCopiedPin(true);
        showNotification('info', tx(`Room PIN ${pin} copied!`, `تم نسخ كود الغرفة ${pin}!`), { title: tx('PIN Copied', 'تم نسخ الكود') });
        setTimeout(() => setCopiedPin(false), 1800);
    }, [pin, showNotification, tx]);

    const handleUpdateSettings = async (patch: { mode?: ClassroomMode; hostParticipates?: boolean; questionTimeSec?: number }) => {
        if (!pin || busyAction) return;
        setBusyAction(true);
        try {
            const res = await api.updateClassroomSettings(pin, patch);
            setRoomState(res.room);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to update settings');
        } finally {
            setBusyAction(false);
        }
    };

    const handleToggleBot = async (action: 'add' | 'remove', botId?: string) => {
        if (!pin || busyAction) return;
        setBusyAction(true);
        try {
            const res = await api.toggleClassroomPracticeBot(pin, action, botId);
            setRoomState(res.room);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to update practice student');
        } finally {
            setBusyAction(false);
        }
    };

    const handleStartGame = async () => {
        if (!pin || busyAction) return;
        setBusyAction(true);
        try {
            const res = await api.startClassroomRoom(pin, {
                mode: room?.mode || initialMode,
                hostParticipates: room?.hostParticipates ?? initialHostParticipates
            });
            setSelectedOption(null);
            setRoomState(res.room);
            sounds.playPowerUp();
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Could not start session');
        } finally {
            setBusyAction(false);
        }
    };

    const handleSubmitAnswer = async (optionIdx: number) => {
        if (!pin || !room || room.gameState !== 'question' || busyAction) return;
        setBusyAction(true);
        try {
            const res = await api.submitClassroomAnswer(pin, {
                userId: hostId,
                questionIndex: room.currentQuestionIndex,
                answerIndex: optionIdx
            });
            setRoomState(res.room);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Could not submit answer');
        } finally {
            setBusyAction(false);
        }
    };

    const handleForceReveal = async () => {
        if (!pin || busyAction) return;
        setBusyAction(true);
        try {
            const res = await api.revealClassroomQuestion(pin);
            setRoomState(res.room);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Could not reveal question');
        } finally {
            setBusyAction(false);
        }
    };

    const handleNextQuestion = async () => {
        if (!pin || busyAction) return;
        setBusyAction(true);
        try {
            const res = await api.nextClassroomQuestion(pin);
            setSelectedOption(null);
            setRoomState(res.room);
            if (res.room.gameState === 'question') sounds.playLevelUp();
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to advance');
        } finally {
            setBusyAction(false);
        }
    };

    const handleSendInviteToUser = async (targetUser: { userId: string; name: string }) => {
        if (!pin) return;
        try {
            await api.inviteToClassroomRoom(pin, {
                toUserId: targetUser.userId,
                fromUser: { id: hostId, name: hostName },
                quizTitle: room?.quizTitle || quiz?.title || tx('Live Arena', 'الساحة المباشرة')
            });
            showNotification('success', `Live invite sent to ${targetUser.name}!`, { title: 'Invitation Sent' });
            setShowInviteModal(false);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Could not invite user');
        }
    };

    const filteredUsers = (allUsers || [])
        .filter(u =>
            u.userId !== hostId &&
            ((u.name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
             (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase()))
        )
        .slice(0, 8);

    const activeParticipants = (room?.players || []).filter(p => !p.isSpectator);
    const realJoinedPlayers = (room?.players || []).filter(p => !p.isBot && !p.isHost && !p.isSpectator);
    const activeTurnPlayer = room?.players.find(p => p.id === room.currentTurnUserId);
    const isMyTurn = room?.mode === 'turn_based' && room.currentTurnUserId === hostId;
    const hostPlayer = room?.players.find(p => p.id === hostId);
    const hostHasSubmitted = Boolean(hostPlayer?.hasSubmitted || room?.submittedUserIds?.includes(hostId));
    const currentQ = room?.currentQuestion;

    // Preview next turn player for Turn-Based "Next Turn ->" CTA
    const nextTurnPlayer = useMemo(() => {
        if (!room || room.mode !== 'turn_based' || !room.turnOrder?.length) return null;
        const idx = room.turnOrder.indexOf(room.currentTurnUserId);
        const nextId = room.turnOrder[(idx + 1) % room.turnOrder.length];
        return room.players.find(p => p.id === nextId) || null;
    }, [room]);

    return (
        <div className={`min-h-screen w-full flex flex-col font-sans overflow-x-hidden ${
            isBento ? 'bg-[#f5f3ec] text-black' : 'bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-white'
        }`}>
            {/* Slim Top Header */}
            <header className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 shrink-0 ${
                isBento
                    ? 'bg-white border-b-2 border-black'
                    : 'bg-white/90 dark:bg-[#111322]/90 border-slate-200 dark:border-white/10 backdrop-blur-md'
            }`}>
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider truncate max-w-[200px] sm:max-w-[280px] ${
                        isBento
                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                            : 'bg-indigo-600 text-white'
                    }`}>
                        {room?.quizTitle || quiz?.title || tx('Live Arena', 'الساحة المباشرة')}
                    </span>
                    <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        isBento
                            ? 'bg-[#bae6fd] text-black border border-black'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                    }`}>
                        {room?.mode === 'simultaneous' ? tx('⚡ Everyone Answers', '⚡ الكل يجاوب') : tx('🎯 Turn-Based', '🎯 تحدي الأدوار')}
                    </span>
                    {room && room.gameState !== 'lobby' && (
                        <span className="text-xs font-mono font-black opacity-75 shrink-0">
                            {tx('Q', 'س')}{(room.currentQuestionIndex || 0) + 1}/{room.totalQuestions}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className={`hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                        socketConnected
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                    }`} title={tx('Live Arena Connected', 'الساحة متصلة مباشر')}>
                        {socketConnected ? <Wifi className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5 animate-pulse" />}
                        <span>{tx('Live', 'مباشر')}</span>
                    </span>

                    {roomTimeLeft && (
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-mono font-black ${
                                roomTimeLeft.isUrgent
                                    ? isBento
                                        ? 'bg-[#fecdd3] text-black border-2 border-black'
                                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300'
                                    : isBento
                                        ? 'bg-slate-100 text-black border-2 border-black'
                                        : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200'
                            }`}
                            title={tx('Room auto-closes when timer ends', 'الغرفة هتقفل تلقائياً لما الوقت يخلص')}
                        >
                            <Clock className="w-3 h-3" />
                            <span>{roomTimeLeft.text}</span>
                        </span>
                    )}

                    {pin && (
                        <>
                            <button
                                type="button"
                                onClick={handleCopyPin}
                                className={`btn-unstyled px-3 py-1.5 rounded-xl text-xs font-mono font-black tracking-widest flex items-center gap-1.5 cursor-pointer transition active:scale-95 ${
                                    isBento
                                        ? 'bg-[#fef08a] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                        : 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300'
                                }`}
                                title={tx('Copy PIN', 'نسخ الكود')}
                            >
                                <span>PIN: {pin}</span>
                                {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 opacity-70" />}
                            </button>

                            <button
                                type="button"
                                onClick={handleCopyInviteLink}
                                className={`btn-unstyled px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition active:scale-95 ${
                                    isBento
                                        ? 'bg-[#93c5fd] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                        : 'bg-indigo-600 text-white'
                                }`}
                            >
                                <Link className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{copiedLink ? tx('Copied', 'اتنسخ') : tx('Invite Link', 'رابط الدعوة')}</span>
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={requestCloseArena}
                        className={`btn-unstyled p-1.5 rounded-xl cursor-pointer transition active:scale-95 ${
                            isBento
                                ? 'bg-[#fecdd3] hover:bg-rose-300 text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500'
                        }`}
                        title={tx('Exit Arena', 'اخرج من الساحة')}
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>
            </header>

            {/* Compact Mobile Score Strip */}
            {room && room.gameState !== 'lobby' && (
                <div className={`lg:hidden px-4 py-2 border-b shrink-0 ${
                    isBento ? 'bg-white/80 border-black/15' : 'bg-white/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10'
                }`}>
                    <div className="max-w-6xl mx-auto">
                        <ClassroomScoreStrip room={room} myUserId={hostId} isBento={isBento} />
                    </div>
                </div>
            )}

            {/* Main Centered Stage */}
            <main className="flex-1 min-h-0 overflow-y-auto flex items-start lg:items-center justify-center p-3 sm:p-5">
                <div className="w-full max-w-6xl">
                    {creating && (
                        <div className="text-center py-12 space-y-2">
                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-sm font-black">{tx('Creating Live Arena Room...', 'بنجهز غرفة الساحة المباشرة...')}</p>
                        </div>
                    )}

                    {(createError || syncError) && !creating && (
                        <div className="max-w-md mx-auto p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
                            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{createError || syncError}</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                            >
                                {tx('Back to Live Arena', 'ارجع للساحة المباشرة')}
                            </button>
                        </div>
                    )}

                    {/* 1. COMPACT LOBBY */}
                    {room && room.gameState === 'lobby' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch animate-in fade-in duration-200">
                            {/* Left: PIN & Mode Controls */}
                            <div className={`lg:col-span-6 p-5 rounded-2xl flex flex-col justify-between space-y-4 ${
                                isBento
                                    ? 'bg-white border-[3px] border-black shadow-[5px_5px_0_#000]'
                                    : 'bg-white dark:bg-[#111322] border border-slate-200 dark:border-white/10 shadow-xl'
                            }`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-300">
                                            {tx('Live Room Join PIN', 'كود الدخول المباشر')}
                                        </span>
                                        <div className="text-4xl font-black font-mono tracking-widest leading-none mt-1">
                                            {room.pin}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setShowInviteModal(true)}
                                            className={`btn-unstyled px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                                                isBento
                                                    ? 'bg-[#c4b5fd] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                                    : 'bg-indigo-600 text-white'
                                            }`}
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            <span>{tx('Invite User', 'ابعت دعوة')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCopyInviteLink}
                                            className={`btn-unstyled px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black'
                                                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200'
                                            }`}
                                        >
                                            <Link className="w-3.5 h-3.5" />
                                            <span>{copiedLink ? tx('Copied!', 'اتنسخ!') : tx('Copy Link', 'نسخ الرابط')}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Mode Selector */}
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-black uppercase tracking-wider opacity-75">
                                        {tx('Select Arena Mode', 'اختار نظام الساحة')}
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            {
                                                id: 'turn_based' as ClassroomMode,
                                                title: tx('🎯 Turn-Based Duel', '🎯 تحدي الأدوار'),
                                                desc: tx('Teacher & students take turns; each builds live score', 'المدرس والطلاب بياخدوا أدوارهم وكل واحد يجمع نقط')
                                            },
                                            {
                                                id: 'simultaneous' as ClassroomMode,
                                                title: tx('⚡ Everyone Answers', '⚡ الكل يجاوب'),
                                                desc: tx('Everyone submits alone; reveals who got it right together', 'الكل بيبعت إجابته لوحده والنتيجة بتظهر للكل سوا')
                                            }
                                        ].map(m => {
                                            const active = room.mode === m.id;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    disabled={busyAction}
                                                    onClick={() => handleUpdateSettings({ mode: m.id })}
                                                    className={`btn-unstyled p-2.5 rounded-xl text-left transition cursor-pointer ${
                                                        active
                                                            ? isBento
                                                                ? 'bg-[#bef264] border-2 border-black shadow-[2px_2px_0_#000] text-black'
                                                                : 'bg-indigo-600/15 border-2 border-indigo-500 text-slate-900 dark:text-white'
                                                            : isBento
                                                                ? 'bg-slate-50 border-2 border-black/30 hover:border-black text-black'
                                                                : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                                                    }`}
                                                >
                                                    <div className="text-xs font-black">{m.title}</div>
                                                    <div className="text-[10px] opacity-75 leading-snug mt-0.5">{m.desc}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Participation & Timer Row */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-black/10 dark:border-white/10">
                                    <HostParticipatesControl
                                        checked={room.hostParticipates}
                                        onChange={(next) => handleUpdateSettings({ hostParticipates: next })}
                                        isBento={isBento}
                                        disabled={busyAction}
                                        label={tx('Host joins turns & scores', 'المضيف يلعب وياخد نقط')}
                                        popoverAlign="left"
                                    />

                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 opacity-60" />
                                        {[15, 25, 40, 60].map(sec => (
                                            <button
                                                key={sec}
                                                type="button"
                                                onClick={() => handleUpdateSettings({ questionTimeSec: sec })}
                                                className={`btn-unstyled px-2 py-0.5 rounded-lg text-[11px] font-black cursor-pointer ${
                                                    room.questionTimeSec === sec
                                                        ? isBento ? 'bg-[#fde047] border border-black text-black' : 'bg-indigo-600 text-white'
                                                        : 'bg-black/5 dark:bg-white/10 opacity-75'
                                                }`}
                                            >
                                                <span>{sec}s</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Live Joined Roster & Launch */}
                            <div className={`lg:col-span-6 p-5 rounded-2xl flex flex-col justify-between space-y-4 ${
                                isBento
                                    ? 'bg-white border-[3px] border-black shadow-[5px_5px_0_#000]'
                                    : 'bg-white dark:bg-[#111322] border border-slate-200 dark:border-white/10 shadow-xl'
                            }`}>
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
                                            <Users className="w-4 h-4 text-indigo-500" />
                                            <span>{tx('Participants', 'المشاركين')} ({activeParticipants.length})</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleBot('add')}
                                            disabled={busyAction}
                                            className={`btn-unstyled inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                                                isBento
                                                    ? 'bg-[#e0f2fe] hover:bg-sky-200 text-black border border-black'
                                                    : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-300'
                                            }`}
                                            title={tx('Add a simulated student to practice or demo solo', 'ضيف طالب تجريبي عشان تجرب لوحدك')}
                                        >
                                            <Bot className="w-3.5 h-3.5" />
                                            <span>{tx('+ Practice Student', '+ طالب تجريبي')}</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[185px] overflow-y-auto pr-0.5">
                                        {room.players.map((p, idx) => {
                                            const roleTag = getRoleTag(p);
                                            return (
                                                <div
                                                    key={p.id}
                                                    className={`p-2.5 rounded-xl flex items-center justify-between gap-2 ${
                                                        isBento
                                                            ? 'bg-[#f8fafc] border-2 border-black'
                                                            : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                                                            {p.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-black truncate">{p.name}</div>
                                                            <div className="text-[10px] opacity-70 font-bold">
                                                                {p.isSpectator
                                                                    ? tx('Host Monitor Only', 'مراقب فقط')
                                                                    : room.mode === 'turn_based'
                                                                        ? `${tx('Turn', 'دور')} ${idx + 1} • ${roleTag}`
                                                                        : `${roleTag}`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {p.isBot && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleBot('remove', p.id)}
                                                            className="btn-unstyled p-1 rounded hover:bg-rose-100 text-rose-500 cursor-pointer shrink-0 bg-transparent border-0"
                                                            title="Remove Practice Student"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {activeParticipants.length === 0 ? (
                                        <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                            {tx(
                                                `No active players yet — turn ON Host joins turns & scores or wait for real players with PIN ${room.pin}.`,
                                                `مفيش لاعبين نشطين لسه — فعل "المضيف يلعب" أو استنى لاعبين حقيقيين يدخلوا بالكود ${room.pin}.`
                                            )}
                                        </p>
                                    ) : realJoinedPlayers.length === 0 ? (
                                        <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                            {tx(
                                                `Waiting for at least 1 real player to join with PIN ${room.pin} before starting.`,
                                                `مستنيين لاعب حقيقي واحد على الأقل يدخل بالكود ${room.pin} قبل ما تبدأ.`
                                            )}
                                        </p>
                                    ) : null}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleStartGame}
                                    disabled={busyAction || activeParticipants.length === 0 || realJoinedPlayers.length === 0}
                                    className={`btn-unstyled w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition ${
                                        isBento
                                            ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[4px_4px_0_#000] active:translate-y-0.5 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 disabled:shadow-none disabled:cursor-not-allowed'
                                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
                                    }`}
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                    <span>
                                        {realJoinedPlayers.length === 0
                                            ? tx('Waiting for Real Players...', 'مستنيين لاعبين حقيقيين...')
                                            : tx(`Start Live Arena (${room.totalQuestions} Qs)`, `ابدأ الساحة المباشرة (${room.totalQuestions} سؤال)`)}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 2. QUESTION PHASE */}
                    {room && room.gameState === 'question' && currentQ && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start animate-in fade-in duration-150">
                            <div className="lg:col-span-8 space-y-3">
                            {/* Turn / Submission Header Banner */}
                            <div className={`px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 ${
                                room.mode === 'turn_based'
                                    ? isMyTurn
                                        ? isBento ? 'bg-[#bef264] border-2 border-black shadow-[3px_3px_0_#000]' : 'bg-emerald-500/15 border border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                                        : isBento ? 'bg-[#fef08a] border-2 border-black shadow-[3px_3px_0_#000]' : 'bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300'
                                    : isBento ? 'bg-[#bae6fd] border-2 border-black shadow-[3px_3px_0_#000]' : 'bg-indigo-500/15 border border-indigo-500/40 text-indigo-700 dark:text-indigo-200'
                            }`}>
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-xl shrink-0">
                                        {room.mode === 'turn_based' ? (isMyTurn ? '🎯' : '⏳') : '⚡'}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black uppercase tracking-wider opacity-75">
                                            {room.mode === 'turn_based'
                                                ? tx('Turn-Based Duel', 'تحدي الأدوار')
                                                : tx(`Everyone Answers (${room.submittedCount}/${room.eligibleCount} Ready)`, `الكل يجاوب (${room.submittedCount}/${room.eligibleCount} جاهز)`)}
                                        </div>
                                        <div className="text-sm sm:text-base font-black truncate">
                                            {room.mode === 'turn_based'
                                                ? (isMyTurn
                                                    ? tx('Your Turn to Answer!', 'دورك تجاوب دلوقتي!')
                                                    : tx(`Waiting for ${activeTurnPlayer?.name || 'participant'} to answer...`, `مستنيين ${activeTurnPlayer?.name || 'المتسابق'} يجاوب...`))
                                                : hostPlayer?.isSpectator
                                                    ? tx('Monitoring student submissions...', 'بتراقب إجابات الطلاب...')
                                                    : hostHasSubmitted
                                                        ? tx('Your answer is locked in! Waiting for class...', 'إجابتك اتبعتت! مستنيين الباقي...')
                                                        : tx('Pick your answer and click Submit!', 'اختار إجابتك واضغط تسليم!')}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {room.mode === 'turn_based' && !isMyTurn && (
                                        <button
                                            type="button"
                                            onClick={handleForceReveal}
                                            className={`btn-unstyled px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer ${
                                                isBento ? 'bg-white border border-black text-black' : 'bg-black/10 dark:bg-white/10'
                                            }`}
                                        >
                                            <Eye className="w-3 h-3 inline me-1" />
                                            <span>{tx('Skip Turn', 'تخطي الدور')}</span>
                                        </button>
                                    )}
                                    <div className={`px-3 py-1 rounded-xl font-mono font-black text-base ${
                                        timeLeft <= 5
                                            ? 'bg-rose-500 text-white animate-pulse'
                                            : isBento ? 'bg-white border-2 border-black text-black' : 'bg-black/10 dark:bg-white/10'
                                    }`}>
                                        {timeLeft}s
                                    </div>
                                </div>
                            </div>

                            {/* Smooth Countdown Progress Bar */}
                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${
                                isBento ? 'bg-slate-200 border border-black' : 'bg-slate-200 dark:bg-white/10'
                            }`}>
                                <div
                                    className={`h-full transition-all duration-300 ${
                                        timeLeft <= 5 ? 'bg-rose-500' : isBento ? 'bg-black' : 'bg-indigo-500'
                                    }`}
                                    style={{ width: `${Math.max(0, Math.min(100, (timeLeft / (room.questionTimeSec || 25)) * 100))}%` }}
                                />
                            </div>

                            {/* Simultaneous Waiting Card (keeps question prompt visible above live progress) */}
                            {room.mode === 'simultaneous' && (hostHasSubmitted || hostPlayer?.isSpectator) ? (
                                <div className="space-y-3">
                                    <ClassroomQuestionCard question={currentQ} isBento={isBento} compact />
                                    <ClassroomWaitingCard
                                        room={room}
                                        isBento={isBento}
                                        isHost={true}
                                        onForceReveal={handleForceReveal}
                                        revealing={busyAction}
                                    />
                                </div>
                            ) : (
                                <>
                                    <ClassroomQuestionCard question={currentQ} isBento={isBento} />

                                    {/* 2x2 Options Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {currentQ.options.map((opt, idx) => {
                                            const locked = room.mode === 'turn_based' && !isMyTurn;
                                            const isSelected = selectedOption === idx;
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    disabled={locked || busyAction}
                                                    onClick={() => {
                                                        if (room.mode === 'turn_based') {
                                                            setSelectedOption(idx);
                                                            handleSubmitAnswer(idx);
                                                        } else {
                                                            setSelectedOption(idx);
                                                        }
                                                    }}
                                                    className={`btn-unstyled p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${getOptionThemeClass(idx, isBento, isSelected, locked)}`}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                                            isSelected
                                                                ? 'bg-black text-white'
                                                                : isBento ? 'bg-black text-white' : 'bg-indigo-600/15 text-indigo-600 dark:text-indigo-300'
                                                        }`}>
                                                            {OPTION_SHAPES[idx % 4]}
                                                        </span>
                                                        <MathRenderer text={opt} className="text-sm sm:text-base font-bold leading-snug break-words" />
                                                    </div>
                                                    {locked && (
                                                        <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/10 shrink-0">
                                                            <Lock className="w-3 h-3" />
                                                            <span>{tx('Wait', 'استنى')}</span>
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Explicit Submit button in Simultaneous Mode */}
                                    {room.mode === 'simultaneous' && (
                                        <div className="flex justify-end pt-1">
                                            <button
                                                type="button"
                                                disabled={selectedOption === null || busyAction}
                                                onClick={() => selectedOption !== null && handleSubmitAnswer(selectedOption)}
                                                className={`btn-unstyled px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer transition ${
                                                    isBento
                                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0_#000] disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 disabled:shadow-none disabled:cursor-not-allowed'
                                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
                                                }`}
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                <span>{selectedOption === null ? tx('Select an Answer First', 'اختار إجابة الأول') : tx('Submit Answer', 'ابعت الإجابة')}</span>
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                            </div>

                            <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-4">
                                <ClassroomParticipantsScoreboard room={room} myUserId={hostId} isBento={isBento} />
                            </div>
                        </div>
                    )}

                    {/* 3. REVEAL PHASE */}
                    {room && room.gameState === 'reveal' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start animate-in zoom-in-95 duration-200">
                            <div className="lg:col-span-8 space-y-4">
                                <ClassroomRevealSection room={room} myUserId={hostId} isBento={isBento} />

                                <div className="flex items-center justify-center">
                                    <button
                                        type="button"
                                        disabled={busyAction}
                                        onClick={handleNextQuestion}
                                        className={`btn-unstyled px-7 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer transition ${
                                            isBento
                                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[4px_4px_0_#000]'
                                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg'
                                        }`}
                                    >
                                        <span>
                                            {room.currentQuestionIndex < room.totalQuestions - 1
                                                ? room.mode === 'turn_based' && nextTurnPlayer
                                                    ? tx(`Next Turn: ${nextTurnPlayer.name.split(' ')[0]} →`, `الدور الجاي: ${nextTurnPlayer.name.split(' ')[0]} ←`)
                                                    : tx(`Next Question (${room.currentQuestionIndex + 2}/${room.totalQuestions})`, `السؤال الجاي (${room.currentQuestionIndex + 2}/${room.totalQuestions})`)
                                                : tx('View Final Podium 🏆', 'شوف الترتيب النهائي 🏆')}
                                        </span>
                                        <ArrowRight className="w-4 h-4 stroke-[3]" />
                                    </button>
                                </div>
                            </div>

                            <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-4">
                                <ClassroomParticipantsScoreboard room={room} myUserId={hostId} isBento={isBento} />
                            </div>
                        </div>
                    )}

                    {/* 4. GAME OVER / PODIUM */}
                    {room && room.gameState === 'game_over' && (
                        <div className="space-y-4 animate-in zoom-in-95 duration-200">
                            <ClassroomPodiumSection room={room} myUserId={hostId} isBento={isBento} />
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleStartGame}
                                    disabled={busyAction}
                                    className={`btn-unstyled px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                                        isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0_#000]'
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                    }`}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>{tx('Play Rematch', 'العب جولة تانية')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCloseArena}
                                    className={`btn-unstyled px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider cursor-pointer ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[3px_3px_0_#000]'
                                            : 'bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white'
                                    }`}
                                >
                                    <span>{tx('Close Arena', 'اقفل الساحة')}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Invite User Modal */}
            {showInviteModal && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                    onClick={() => setShowInviteModal(false)}
                >
                    <div
                        className={`w-full max-w-md p-5 rounded-2xl space-y-3 ${
                            isBento
                                ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0_#000]'
                                : 'bg-white dark:bg-[#111322] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-2xl'
                        }`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-indigo-500" />
                                <h3 className="text-sm font-black uppercase">{tx('Invite Student / Peer', 'ابعت دعوة لطالب أو زميل')}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowInviteModal(false)}
                                className="btn-unstyled p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer bg-transparent border-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <input
                            type="text"
                            placeholder={tx('Search by name or email...', 'ابحث بالاسم أو الإيميل...')}
                            value={userSearchQuery}
                            onChange={e => setUserSearchQuery(e.target.value)}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-bold ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black'
                                    : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15'
                            }`}
                        />

                        <div className="space-y-1.5 max-h-56 overflow-y-auto">
                            {filteredUsers.length === 0 ? (
                                <div className="text-center py-4 text-xs opacity-60 font-bold">
                                    {tx('No users found matching query.', 'مفيش حد بالاسم ده.')}
                                </div>
                            ) : (
                                filteredUsers.map(user => (
                                    <div
                                        key={user.userId}
                                        className={`p-2.5 rounded-xl flex items-center justify-between gap-2 ${
                                            isBento ? 'bg-slate-50 border border-black/25' : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <div className="text-xs font-black truncate">{user.name}</div>
                                            <div className="text-[10px] opacity-60 truncate">{user.email}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleSendInviteToUser(user)}
                                            className={`btn-unstyled px-3 py-1 rounded-lg text-[11px] font-black uppercase cursor-pointer ${
                                                isBento
                                                    ? 'bg-[#bef264] text-black border border-black shadow-[1.5px_1.5px_0_#000]'
                                                    : 'bg-indigo-600 text-white'
                                            }`}
                                        >
                                            <span>{tx('Send', 'ابعت')}</span>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
            <ConfirmDialog
                isOpen={showExitConfirm}
                title={tx('Exit Live Arena?', 'تخرج من الساحة المباشرة؟')}
                message={tx(
                    realJoinedPlayers.length > 0
                        ? 'If you leave now, you will lose all your points, streak, and progress in this session. Another player in the room will automatically become the new host.'
                        : 'If you leave now, you will lose your current session progress and the empty room will be closed.',
                    realJoinedPlayers.length > 0
                        ? 'لو خرجت دلوقتي هتخسر كل نقطك وسلسلة إجاباتك وتقدمك في الجلسة دي. هيتم نقل استضافة الغرفة تلقائياً للاعب تاني موجود.'
                        : 'لو خرجت دلوقتي هتخسر تقدمك في الجلسة دي والغرفة الفاضية هتتقفل.'
                )}
                confirmText={tx('Exit Arena', 'اخرج من الساحة')}
                cancelText={tx('Stay in Arena', 'كمّل في الساحة')}
                type="warning"
                isLoading={exitingArena}
                onConfirm={handleCloseArena}
                onCancel={() => setShowExitConfirm(false)}
            />
        </div>
    );
};

export default LiveHostMode;
