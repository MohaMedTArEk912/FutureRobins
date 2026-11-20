import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Gamepad2,
    X,
    ArrowRight,
    Lock,
    Users,
    Send,
    Wifi,
    Radio,
    Loader2,
    Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MathRenderer } from '../common/MathRenderer';
import { sounds } from '../../lib/soundEffects';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useClassroomSync } from './useClassroomSync';
import {
    ClassroomScoreStrip,
    ClassroomParticipantsScoreboard,
    ClassroomWaitingCard,
    ClassroomRevealSection,
    ClassroomPodiumSection,
    ClassroomQuestionCard
} from './ClassroomArenaShared';
import {
    OPTION_SHAPES,
    getOptionThemeClass,
    getRoleTag,
    formatRoomTimeLeft
} from './classroomHelpers';
import ConfirmDialog from '../ConfirmDialog';
import type { ClassroomRoomState } from '../../types';

interface LivePlayerControllerProps {
    onBack?: () => void;
    onClose?: () => void;
    onPromotedToHost?: (room: ClassroomRoomState) => void;
    initialPin?: string;
}

export const LivePlayerController: React.FC<LivePlayerControllerProps> = ({
    onBack,
    onClose,
    onPromotedToHost,
    initialPin
}) => {
    const handleClose = useCallback(() => {
        if (onClose) onClose();
        else if (onBack) onBack();
    }, [onClose, onBack]);

    const { isBento } = useTheme();
    const { currentUser } = useAuth();
    const { tx } = useLanguage();
    const [searchParams] = useSearchParams();
    const urlPin = searchParams?.get('pin') || '';
    const resolvedInitialPin = (initialPin || urlPin || '').trim();

    const [pinInput, setPinInput] = useState(resolvedInitialPin);
    const [nickname, setNickname] = useState(currentUser?.name || '');
    const [myUserId, setMyUserId] = useState(
        () => currentUser?.userId || `student_${Math.floor(1000 + Math.random() * 9000)}`
    );
    const [activePin, setActivePin] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const autoJoinedRef = useRef(false);
    const activePinRef = useRef<string | null>(null);
    const selectedOptionRef = useRef<number | null>(null);

    useEffect(() => {
        activePinRef.current = activePin;
    }, [activePin]);

    useEffect(() => {
        selectedOptionRef.current = selectedOption;
    }, [selectedOption]);

    const handleRoomUpdate = useCallback((next: ClassroomRoomState, prev: ClassroomRoomState | null) => {
        if (prev && prev.currentQuestionIndex !== next.currentQuestionIndex) {
            setSelectedOption(null);
        } else if (prev?.gameState !== 'question' && next.gameState === 'question') {
            setSelectedOption(null);
            sounds.playPowerUp();
        }

        if (prev?.gameState === 'question' && next.gameState === 'reveal') {
            if (next.mode === 'turn_based' && next.lastTurnResult) {
                if (next.lastTurnResult.playerId === myUserId) {
                    if (next.lastTurnResult.isCorrect) sounds.playCorrect();
                    else sounds.playIncorrect();
                }
            } else if (next.mode === 'simultaneous' && next.roundReveal) {
                const mine = next.roundReveal.results.find(r => r.userId === myUserId);
                if (mine) {
                    if (mine.isCorrect) sounds.playCorrect();
                    else sounds.playIncorrect();
                }
            }
        }

        if (prev?.gameState !== 'game_over' && next.gameState === 'game_over') {
            confetti({ particleCount: 140, spread: 85, origin: { y: 0.5 } });
        }
    }, [myUserId]);

    const handleTimerExpired = useCallback(async (expiredRoom: ClassroomRoomState) => {
        if (!expiredRoom.pin || expiredRoom.gameState !== 'question') return;

        if (expiredRoom.mode === 'turn_based' && expiredRoom.currentTurnUserId === myUserId) {
            await api.submitClassroomAnswer(expiredRoom.pin, {
                userId: myUserId,
                questionIndex: expiredRoom.currentQuestionIndex,
                answerIndex: -1,
                timedOut: true
            }).catch(() => {});
        } else if (expiredRoom.mode === 'simultaneous') {
            const already = expiredRoom.submittedUserIds?.includes(myUserId);
            const latestOption = selectedOptionRef.current;
            if (!already) {
                await api.submitClassroomAnswer(expiredRoom.pin, {
                    userId: myUserId,
                    questionIndex: expiredRoom.currentQuestionIndex,
                    answerIndex: latestOption !== null ? latestOption : -1,
                    timedOut: latestOption === null
                }).catch(() => {});
            }
        }
    }, [myUserId]);

    const {
        room,
        setRoom: setRoomState,
        resetSync,
        error: syncError,
        timeLeft,
        socketConnected
    } = useClassroomSync({
        pin: activePin,
        enabled: Boolean(activePin),
        onRoomUpdate: handleRoomUpdate,
        onRoomClosed: () => {
            resetSync();
            setActivePin(null);
            setJoinError(tx('This live arena session has ended.', 'جلسة الساحة المباشرة انتهت.'));
        },
        onTimerExpired: handleTimerExpired
    });

    const performJoin = useCallback(async (targetPin: string, playerName: string) => {
        const cleanPin = targetPin.trim();
        const cleanName = playerName.trim();
        if (cleanPin.length < 4 || !cleanName) return;

        setJoining(true);
        setJoinError(null);
        try {
            const res = await api.joinClassroomRoom(cleanPin, {
                userId: myUserId,
                name: cleanName,
                role: currentUser?.role || 'student'
            });
            sounds.playPowerUp();
            setMyUserId(res.joinedUserId || myUserId);
            setActivePin(res.room.pin);
            setRoomState(res.room);
        } catch (err) {
            setJoinError(err instanceof Error ? err.message : 'Could not join classroom PIN');
        } finally {
            setJoining(false);
        }
    }, [myUserId, currentUser?.role, setRoomState]);

    // Auto-join immediately when clicking a room / opening an invite link while logged in
    useEffect(() => {
        if (autoJoinedRef.current) return;
        if (resolvedInitialPin.length >= 4 && (currentUser?.name || nickname).trim()) {
            autoJoinedRef.current = true;
            performJoin(resolvedInitialPin, (currentUser?.name || nickname).trim());
        }
    }, [resolvedInitialPin, currentUser?.name, nickname, performJoin]);

    // Clean leave on unmount (skip if promoted to host so room session stays active)
    const promotedToHostRef = useRef(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [leavingArena, setLeavingArena] = useState(false);
    const [roomNowMs, setRoomNowMs] = useState(() => Date.now());

    useEffect(() => {
        return () => {
            if (activePinRef.current && !promotedToHostRef.current) {
                api.leaveClassroomRoom(activePinRef.current, myUserId);
            }
        };
    }, [myUserId]);

    // Escape key to leave when on pre-join screen or prompt confirmation in active room
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (!room) {
                handleClose();
            } else if (room.gameState !== 'game_over') {
                setShowExitConfirm(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [handleClose, room]);

    const handleJoinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await performJoin(pinInput, nickname);
    };

    const handleSubmitAnswer = async (optionIdx: number) => {
        if (!room || room.gameState !== 'question' || submitting) return;
        setSubmitting(true);
        try {
            const res = await api.submitClassroomAnswer(room.pin, {
                userId: myUserId,
                questionIndex: room.currentQuestionIndex,
                answerIndex: optionIdx
            });
            setRoomState(res.room);
        } catch (err) {
            setJoinError(err instanceof Error ? err.message : 'Failed to submit answer');
        } finally {
            setSubmitting(false);
        }
    };

    const handleLeaveArena = useCallback(async () => {
        setLeavingArena(true);
        if (activePin) {
            try {
                await api.leaveClassroomRoom(activePin, myUserId);
            } catch {
                // Allow local exit even if room already closed
            }
        }
        setLeavingArena(false);
        setShowExitConfirm(false);
        handleClose();
    }, [activePin, myUserId, handleClose]);

    const requestLeaveArena = useCallback(() => {
        if (!room || room.gameState === 'game_over') {
            void handleLeaveArena();
            return;
        }
        setShowExitConfirm(true);
    }, [room, handleLeaveArena]);

    // Seamless transition when backend promotes this player to host
    useEffect(() => {
        if (!room || !onPromotedToHost || promotedToHostRef.current) return;
        if (room.hostId === myUserId) {
            promotedToHostRef.current = true;
            onPromotedToHost(room);
        }
    }, [room, myUserId, onPromotedToHost]);

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
            handleClose();
        }
    }, [roomTimeLeft?.expired, handleClose]);

    const me = room?.players.find(p => p.id === myUserId);
    const iHaveSubmitted = Boolean(me?.hasSubmitted || room?.submittedUserIds?.includes(myUserId));
    const isMyTurn = room?.mode === 'turn_based' && room.currentTurnUserId === myUserId;
    const activeTurnPlayer = room?.players.find(p => p.id === room.currentTurnUserId);
    const currentQ = room?.currentQuestion;
    const totalSec = room?.questionTimeSec || 25;
    const timerPct = Math.max(0, Math.min(100, (timeLeft / totalSec) * 100));

    // Keyboard shortcuts: 1-4 to pick option, Enter to submit in simultaneous mode
    useEffect(() => {
        if (!room || room.gameState !== 'question' || !currentQ || me?.isSpectator || submitting) return;
        const locked = room.mode === 'turn_based' ? !isMyTurn : iHaveSubmitted;
        if (locked) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const num = Number(e.key);
            if (num >= 1 && num <= currentQ.options.length) {
                const idx = num - 1;
                setSelectedOption(idx);
                if (room.mode === 'turn_based') {
                    handleSubmitAnswer(idx);
                }
            } else if (e.key === 'Enter' && room.mode === 'simultaneous' && selectedOption !== null) {
                handleSubmitAnswer(selectedOption);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room, currentQ, me?.isSpectator, isMyTurn, iHaveSubmitted, submitting, selectedOption]);

    // 1. PRE-JOIN SCREEN (if guest needs to type PIN or nickname)
    if (!room) {
        return (
            <div
                className="app-dialog-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150"
                onClick={(e) => {
                    if (e.target === e.currentTarget) handleClose();
                }}
            >
                <div className="modal-backdrop absolute inset-0 -z-10" />
                <div
                    className={`app-dialog-panel app-dialog-panel--padded relative w-full max-w-md p-6 rounded-2xl transition-all animate-in zoom-in-95 duration-200 ${
                        isBento
                            ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0_#000]'
                            : 'bg-white dark:bg-[#111322] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-2xl'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={handleClose}
                        className={`btn-unstyled absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition active:scale-95 ${
                            isBento
                                ? 'bg-[#fecdd3] hover:bg-rose-300 text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300'
                        }`}
                        title="Close"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>

                    <div className="text-center space-y-2 mb-5">
                        <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
                            isBento
                                ? 'bg-[#93c5fd] text-black border-2 border-black shadow-[3px_3px_0_#000]'
                                : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                        }`}>
                            <Gamepad2 className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">{tx('Join Live Arena', 'ادخل الساحة المباشرة')}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {tx('Enter the 6-digit PIN shared by your teacher or host.', 'اكتب كود الغرفة المكون من 6 أرقام اللي بعته المدرس أو المضيف.')}
                        </p>
                    </div>

                    {(joinError || syncError) && (
                        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-600 dark:text-rose-400 text-center">
                            {joinError || syncError}
                        </div>
                    )}

                    {joining ? (
                        <div className="py-8 flex flex-col items-center gap-2">
                            <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
                            <span className="text-xs font-black uppercase tracking-wider">{tx('Joining Live Room...', 'بندخلك الغرفة...')}</span>
                        </div>
                    ) : (
                        <form onSubmit={handleJoinSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider mb-1">
                                    {tx('Room PIN', 'كود الغرفة (PIN)')}
                                </label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    autoFocus
                                    placeholder={tx('e.g. 482910', 'مثال: 482910')}
                                    value={pinInput}
                                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                                    className={`w-full p-3 rounded-xl text-center text-xl font-mono font-black tracking-widest ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0_#000] focus:bg-[#fef9c3] focus:outline-none'
                                            : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                                    }`}
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider mb-1">
                                    {tx('Your Name', 'اسمك')}
                                </label>
                                <input
                                    type="text"
                                    maxLength={24}
                                    placeholder={tx('Enter your name', 'اكتب اسمك')}
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    className={`w-full p-3 rounded-xl text-center text-sm font-bold ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0_#000] focus:outline-none'
                                            : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                                    }`}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={pinInput.trim().length < 4 || !nickname.trim() || joining}
                                className={`btn-unstyled w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition ${
                                    isBento
                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0_#000] disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 disabled:shadow-none disabled:cursor-not-allowed'
                                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
                                }`}
                            >
                                <span>{tx('Enter Live Room', 'ادخل الغرفة المباشرة')}</span>
                                <ArrowRight className="w-4 h-4 stroke-[3]" />
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // 2. LIVE CONNECTED ARENA PAGE (Full dedicated page with Participants Scoreboard)
    return (
        <div className={`min-h-screen w-full flex flex-col font-sans overflow-x-hidden ${
            isBento ? 'bg-[#f5f3ec] text-black' : 'bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-white'
        }`}>
            {/* Slim Header Bar */}
            <header className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 shrink-0 ${
                isBento
                    ? 'bg-white border-b-2 border-black'
                    : 'bg-white/90 dark:bg-[#111322]/90 border-slate-200 dark:border-white/10 backdrop-blur-md'
            }`}>
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider truncate max-w-[180px] sm:max-w-[260px] ${
                        isBento
                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                            : 'bg-indigo-600 text-white'
                    }`}>
                        {room.quizTitle}
                    </span>
                    <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                    }`}>
                        {room.mode === 'simultaneous' ? tx('⚡ Everyone Answers', '⚡ الكل يجاوب') : tx('🎯 Turn-Based', '🎯 تحدي الأدوار')}
                    </span>
                    {room.gameState !== 'lobby' && (
                        <span className="text-xs font-mono font-black opacity-75 shrink-0">
                            {tx('Q', 'س')}{(room.currentQuestionIndex || 0) + 1}/{room.totalQuestions}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className={`hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                        socketConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
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

                    <span className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black ${
                        isBento
                            ? 'bg-[#fef08a] text-black border-2 border-black'
                            : 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300'
                    }`}>
                        PIN: {room.pin}
                    </span>

                    <button
                        type="button"
                        onClick={requestLeaveArena}
                        className={`btn-unstyled p-1.5 rounded-xl cursor-pointer transition active:scale-95 ${
                            isBento
                                ? 'bg-[#fecdd3] hover:bg-rose-300 text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500'
                        }`}
                        title={tx('Leave Arena', 'اخرج من الساحة')}
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>
            </header>

            {/* Compact Mobile Score Strip */}
            {room.gameState !== 'lobby' && (
                <div className={`lg:hidden px-4 py-2 border-b shrink-0 ${
                    isBento ? 'bg-white/80 border-black/15' : 'bg-white/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10'
                }`}>
                    <div className="max-w-6xl mx-auto">
                        <ClassroomScoreStrip room={room} myUserId={myUserId} isBento={isBento} />
                    </div>
                </div>
            )}

            {/* Main Centered Stage */}
            <main className="flex-1 min-h-0 overflow-y-auto flex items-start lg:items-center justify-center p-3 sm:p-5">
                <div className="w-full max-w-6xl">
                    {/* A. WAITING LOBBY */}
                    {room.gameState === 'lobby' && (
                        <div className={`max-w-xl mx-auto p-6 rounded-2xl text-center space-y-4 animate-in zoom-in-95 duration-200 ${
                            isBento
                                ? 'bg-white border-[3px] border-black shadow-[6px_6px_0_#000]'
                                : 'bg-white dark:bg-[#111322] border border-slate-200 dark:border-white/10 shadow-2xl'
                        }`}>
                            <div className="flex items-center justify-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                                    isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-amber-500/15 text-amber-500'
                                }`}>
                                    {tx(`Hosted by ${room.hostName}`, `باستضافة ${room.hostName}`)}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                                    isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-indigo-500/15 text-indigo-400'
                                }`}>
                                    {room.mode === 'simultaneous'
                                        ? tx('Everyone Answers Mode', 'نظام الكل يجاوب')
                                        : tx('Turn-Based Duel Mode', 'نظام تحدي الأدوار')}
                                </span>
                            </div>

                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                                    {tx("You're In! Waiting for Host...", 'دخلت بنجاح! مستنيين المضيف يبدأ...')}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {room.mode === 'simultaneous'
                                        ? tx('Everyone answers each question privately; results reveal when all click Submit.', 'كل واحد بيجاوب لوحده في سره، والنتايج بتظهر لما الكل يبعت.')
                                        : tx('Teacher and students take turns answering questions and competing for top score!', 'المدرس والطلاب بياخدوا أدوارهم على كل سؤال ويتنافسوا على المركز الأول!')}
                                </p>
                            </div>

                            <div className={`p-3.5 rounded-xl text-start space-y-2 ${
                                isBento ? 'bg-slate-50 border-2 border-black' : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                            }`}>
                                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider opacity-70">
                                    <span className="flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5" />
                                        {tx('Live Arena Roster', 'المشاركين في الساحة')} ({room.players.filter(p => !p.isSpectator).length})
                                    </span>
                                    <span className="text-emerald-600 dark:text-emerald-400 animate-pulse">● {tx('Connected', 'متصل')}</span>
                                </div>

                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                                    {room.players.filter(p => !p.isSpectator).map(p => (
                                        <span
                                            key={p.id}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                p.id === myUserId
                                                    ? isBento ? 'bg-[#bef264] border border-black text-black' : 'bg-indigo-600 text-white'
                                                    : isBento ? 'bg-white border border-black/40 text-black' : 'bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10'
                                            }`}
                                        >
                                            <span>{p.name}{p.id === myUserId ? tx(' (You)', ' (أنت)') : ''}</span>
                                            <span className="text-[9px] uppercase opacity-70">{getRoleTag(p)}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={requestLeaveArena}
                                className="btn-unstyled text-xs font-bold text-slate-500 hover:underline cursor-pointer bg-transparent border-0"
                            >
                                <span>{tx('Leave Room', 'اخرج من الغرفة')}</span>
                            </button>
                        </div>
                    )}

                    {/* B. QUESTION PHASE */}
                    {room.gameState === 'question' && currentQ && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start animate-in fade-in duration-150">
                            <div className="lg:col-span-8 space-y-3">
                            <div className={`px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 ${
                                room.mode === 'turn_based'
                                    ? isMyTurn
                                        ? isBento ? 'bg-[#bef264] border-2 border-black shadow-[3px_3px_0_#000]' : 'bg-emerald-500/15 border border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                                        : isBento ? 'bg-[#fef08a] border-2 border-black shadow-[3px_3px_0_#000]' : 'bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300'
                                    : isBento ? 'bg-[#bae6fd] border-2 border-black shadow-[3px_3px_0_#000]' : 'bg-indigo-500/15 border border-indigo-500/40 text-indigo-700 dark:text-indigo-200'
                            }`}>
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-xl shrink-0">
                                        {room.mode === 'turn_based' ? (isMyTurn ? '🎯' : '⏳') : iHaveSubmitted ? '⏳' : '⚡'}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black uppercase tracking-wider opacity-75">
                                            {room.mode === 'turn_based'
                                                ? (isMyTurn ? tx('Active Turn', 'دورك دلوقتي') : tx('Spectating Turn', 'بتتفرج على الدور'))
                                                : tx(`Everyone Answers (${room.submittedCount}/${room.eligibleCount} Submitted)`, `الكل يجاوب (${room.submittedCount}/${room.eligibleCount} سلموا)`)}
                                        </div>
                                        <div className="text-sm sm:text-base font-black truncate">
                                            {room.mode === 'turn_based'
                                                ? (isMyTurn
                                                    ? tx('Your Turn to Answer!', 'دورك تجاوب دلوقتي!')
                                                    : tx(`Waiting for ${activeTurnPlayer?.name || 'participant'} to answer...`, `مستنيين ${activeTurnPlayer?.name || 'المتسابق'} يجاوب...`))
                                                : iHaveSubmitted
                                                    ? tx('Submitted! Waiting for everyone else...', 'تم التسليم! مستنيين الباقي...')
                                                    : tx('Answer privately and click Submit!', 'جاوب لوحدك واضغط تسليم!')}
                                        </div>
                                    </div>
                                </div>

                                <div className={`px-3 py-1 rounded-xl font-mono font-black text-base shrink-0 ${
                                    timeLeft <= 5
                                        ? 'bg-rose-500 text-white animate-pulse'
                                        : isBento ? 'bg-white border-2 border-black text-black' : 'bg-black/10 dark:bg-white/10'
                                }`}>
                                    {timeLeft}s
                                </div>
                            </div>

                            {/* Smooth Countdown Progress Bar */}
                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${
                                isBento ? 'bg-slate-200 border border-black' : 'bg-slate-200 dark:bg-white/10'
                            }`}>
                                <div
                                    className={`h-full transition-all duration-300 ${
                                        timeLeft <= 5
                                            ? 'bg-rose-500'
                                            : isBento ? 'bg-black' : 'bg-indigo-500'
                                    }`}
                                    style={{ width: `${timerPct}%` }}
                                />
                            </div>

                            {room.mode === 'simultaneous' && iHaveSubmitted ? (
                                <div className="space-y-3">
                                    <ClassroomQuestionCard question={currentQ} isBento={isBento} compact />
                                    <ClassroomWaitingCard
                                        room={room}
                                        isBento={isBento}
                                        isHost={false}
                                    />
                                </div>
                            ) : (
                                <>
                                    <ClassroomQuestionCard question={currentQ} isBento={isBento} />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {currentQ.options.map((opt, idx) => {
                                            const locked = room.mode === 'turn_based' && !isMyTurn;
                                            const isSelected = selectedOption === idx;
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    disabled={locked || submitting}
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

                                    {room.mode === 'simultaneous' && (
                                        <div className="flex justify-end pt-1">
                                            <button
                                                type="button"
                                                disabled={selectedOption === null || submitting}
                                                onClick={() => selectedOption !== null && handleSubmitAnswer(selectedOption)}
                                                className={`btn-unstyled px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer transition ${
                                                    isBento
                                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0_#000] disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 disabled:shadow-none disabled:cursor-not-allowed'
                                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
                                                }`}
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                <span>
                                                    {submitting
                                                        ? tx('Submitting...', 'جاري الإرسال...')
                                                        : selectedOption === null
                                                            ? tx('Select an Answer First', 'اختار إجابة الأول')
                                                            : tx('Submit Answer', 'ابعت الإجابة')}
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                            </div>

                            <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-4">
                                <ClassroomParticipantsScoreboard room={room} myUserId={myUserId} isBento={isBento} />
                            </div>
                        </div>
                    )}

                    {/* C. REVEAL PHASE */}
                    {room.gameState === 'reveal' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start animate-in zoom-in-95 duration-200">
                            <div className="lg:col-span-8 space-y-4">
                                <ClassroomRevealSection room={room} myUserId={myUserId} isBento={isBento} />

                                <div className="text-center text-xs font-black uppercase tracking-wider opacity-70 flex items-center justify-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>{tx(`Waiting for ${room.hostName} to start next question...`, `مستنيين ${room.hostName} يفتح السؤال الجاي...`)}</span>
                                </div>
                            </div>

                            <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-4">
                                <ClassroomParticipantsScoreboard room={room} myUserId={myUserId} isBento={isBento} />
                            </div>
                        </div>
                    )}

                    {/* D. GAME OVER / PODIUM */}
                    {room.gameState === 'game_over' && (
                        <div className="space-y-4 animate-in zoom-in-95 duration-200">
                            <ClassroomPodiumSection room={room} myUserId={myUserId} isBento={isBento} />
                            <div className="flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={handleLeaveArena}
                                    className={`btn-unstyled px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider cursor-pointer ${
                                        isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0_#000]'
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                    }`}
                                >
                                    <span>{tx('Leave Arena', 'اخرج من الساحة')}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <ConfirmDialog
                isOpen={showExitConfirm}
                title={tx('Exit Live Arena?', 'تخرج من الساحة المباشرة؟')}
                message={tx(
                    'If you leave now, you will lose all your points, streak, and progress in this session.',
                    'لو خرجت دلوقتي هتخسر كل نقطك وسلسلة إجاباتك وتقدمك في الجلسة دي.'
                )}
                confirmText={tx('Exit Arena', 'اخرج من الساحة')}
                cancelText={tx('Stay in Arena', 'كمّل في الساحة')}
                type="warning"
                isLoading={leavingArena}
                onConfirm={handleLeaveArena}
                onCancel={() => setShowExitConfirm(false)}
            />
        </div>
    );
};

export default LivePlayerController;
