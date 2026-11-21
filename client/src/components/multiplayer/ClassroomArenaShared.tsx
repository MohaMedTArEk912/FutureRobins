import React, { useState, useRef, useEffect } from 'react';
import {
    Trophy,
    Flame,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    Eye,
    Sparkles,
    Info,
    UserCheck,
    Users
} from 'lucide-react';
import { MathRenderer } from '../common/MathRenderer';
import { useLanguage } from '../../context/LanguageContext';
import type { ClassroomQuestionDTO, ClassroomRoomState } from '../../types';
import { OPTION_LETTERS, getRoleTag } from './classroomHelpers';

interface ScoreStripProps {
    room: ClassroomRoomState;
    myUserId: string;
    isBento: boolean;
}

export const ClassroomScoreStrip: React.FC<ScoreStripProps> = ({ room, myUserId, isBento }) => {
    const { tx } = useLanguage();
    const activeParticipants = room.players.filter(p => !p.isSpectator);
    const submittedSet = new Set(room.submittedUserIds || []);

    if (activeParticipants.length === 0) return null;

    return (
        <div className="w-full overflow-x-auto pb-1">
            <div className="flex items-stretch gap-2 min-w-max">
                {activeParticipants.map((player) => {
                    const isMe = player.id === myUserId;
                    const isTurn = room.mode === 'turn_based' && room.currentTurnUserId === player.id && room.gameState === 'question';
                    const hasSubmitted = submittedSet.has(player.id) || player.hasSubmitted;
                    const roleTag = getRoleTag(player);

                    return (
                        <div
                            key={player.id}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all shrink-0 ${
                                isTurn
                                    ? isBento
                                        ? 'bg-[#bef264] border-2 border-black shadow-[2px_2px_0_#000] text-black'
                                        : 'bg-emerald-500/15 border-2 border-emerald-400 text-slate-900 dark:text-white shadow-sm'
                                    : isMe
                                        ? isBento
                                            ? 'bg-[#fef9c3] border-2 border-black text-black'
                                            : 'bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-300 dark:border-indigo-400/50 text-slate-900 dark:text-white'
                                        : isBento
                                            ? 'bg-white border-2 border-black text-black'
                                            : 'bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100'
                            }`}
                        >
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                                roleTag === 'TEACHER'
                                    ? isBento ? 'bg-[#93c5fd] text-black border border-black' : 'bg-indigo-600 text-white'
                                    : isBento ? 'bg-black text-white' : 'bg-slate-200 dark:bg-white/15 text-slate-800 dark:text-white'
                            }`}>
                                {player.name.charAt(0).toUpperCase()}
                            </div>

                            <div className="min-w-0 leading-tight">
                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-black truncate max-w-[92px]">
                                        {player.name.split(' ')[0]}
                                        {isMe ? tx(' (You)', ' (أنت)') : ''}
                                    </span>
                                    <span className={`text-[9px] font-black px-1 py-0.5 rounded ${
                                        roleTag === 'TEACHER'
                                            ? isBento ? 'bg-[#e0f2fe] text-black border border-black' : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300'
                                            : isBento ? 'bg-slate-100 text-black border border-black/40' : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                    }`}>
                                        {roleTag === 'TEACHER' ? tx('TCH', 'مدرس') : roleTag === 'HOST' ? tx('HOST', 'مضيف') : roleTag === 'BOT' ? tx('BOT', 'بوت') : tx('STU', 'طالب')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-mono font-black">
                                    <span>{player.score} {tx('pts', 'نقطة')}</span>
                                    {player.streak > 1 && (
                                        <span className="text-orange-500 flex items-center gap-0.5 text-[10px]">
                                            <Flame className="w-3 h-3 fill-orange-500" />
                                            {player.streak}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {room.gameState === 'question' && (
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ml-0.5 ${
                                    room.mode === 'turn_based'
                                        ? isTurn
                                            ? 'bg-emerald-600 text-white'
                                            : isBento ? 'bg-slate-100 text-slate-600 border border-black/30' : 'bg-slate-200/70 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                                        : hasSubmitted
                                            ? 'bg-emerald-600 text-white'
                                            : isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                                }`}>
                                    {room.mode === 'turn_based'
                                        ? isTurn ? tx('TURN', 'دورك') : tx('WAIT', 'انتظار')
                                        : hasSubmitted ? tx('✓ SENT', '✓ تمام') : '...'}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const ClassroomParticipantsScoreboard: React.FC<ScoreStripProps> = ({ room, myUserId, isBento }) => {
    const { tx } = useLanguage();
    const submittedSet = new Set(room.submittedUserIds || []);
    const rankedParticipants = [...room.players]
        .filter(p => !p.isSpectator)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (b.correctCount || 0) - (a.correctCount || 0);
        });

    return (
        <div className={`rounded-2xl p-4 flex flex-col gap-3 ${
            isBento
                ? 'bg-white text-black border-[3px] border-black shadow-[5px_5px_0_#000]'
                : 'bg-white dark:bg-[#141210]/90 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-xl backdrop-blur-xl'
        }`}>
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isBento ? 'bg-[#fde047] text-black border-2 border-black' : 'bg-indigo-500/15 text-indigo-500'
                    }`}>
                        <Trophy className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight truncate">
                            {tx('Participants Score', 'نقط المشاركين')}
                        </h3>
                        <p className="text-[10px] font-bold opacity-65 truncate">
                            {tx('Live Standings & Accuracy', 'الترتيب المباشر والدقة')}
                        </p>
                    </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shrink-0 ${
                    isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                }`}>
                    <Users className="w-3 h-3" />
                    <span>{rankedParticipants.length}</span>
                </span>
            </div>

            {rankedParticipants.length === 0 ? (
                <div className="py-6 text-center text-xs font-bold opacity-60">
                    {tx('No active participants yet.', 'مفيش مشاركين نشطين لسه.')}
                </div>
            ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                    {rankedParticipants.map((player, idx) => {
                        const isMe = player.id === myUserId;
                        const isTurn = room.mode === 'turn_based' && room.currentTurnUserId === player.id && room.gameState === 'question';
                        const hasSubmitted = submittedSet.has(player.id) || player.hasSubmitted;
                        const roleTag = getRoleTag(player);
                        const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

                        return (
                            <div
                                key={player.id}
                                className={`p-2.5 rounded-xl flex items-center justify-between gap-2.5 transition-all ${
                                    isTurn
                                        ? isBento
                                            ? 'bg-[#bef264] border-2 border-black shadow-[2px_2px_0_#000] text-black'
                                            : 'bg-emerald-500/15 border-2 border-emerald-400 text-slate-900 dark:text-white'
                                        : isMe
                                            ? isBento
                                                ? 'bg-[#fef9c3] border-2 border-black text-black'
                                                : 'bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-300 dark:border-indigo-400/50 text-slate-900 dark:text-white'
                                            : isBento
                                                ? 'bg-slate-50 border-2 border-black/25 text-black'
                                                : 'bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                        isBento ? 'bg-white border border-black text-black' : 'bg-black/10 dark:bg-white/10'
                                    }`}>
                                        {rankBadge}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-black truncate max-w-[115px]">
                                                {player.name}{isMe ? tx(' (You)', ' (أنت)') : ''}
                                            </span>
                                            <span className={`text-[9px] font-black px-1 py-0.5 rounded shrink-0 ${
                                                roleTag === 'TEACHER'
                                                    ? isBento ? 'bg-[#e0f2fe] text-black border border-black' : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300'
                                                    : isBento ? 'bg-white text-black border border-black/40' : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                            }`}>
                                                {roleTag === 'TEACHER' ? tx('TCH', 'مدرس') : roleTag === 'HOST' ? tx('HOST', 'مضيف') : roleTag === 'BOT' ? tx('BOT', 'بوت') : tx('STU', 'طالب')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold opacity-75 mt-0.5">
                                            <span>{player.correctCount || 0}/{player.answeredCount || 0} {tx('right', 'صح')}</span>
                                            {player.streak > 1 && (
                                                <span className="text-orange-500 inline-flex items-center gap-0.5 font-black">
                                                    <Flame className="w-3 h-3 fill-orange-500" />
                                                    {player.streak}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className="font-mono font-black text-sm leading-none">
                                        {player.score} <span className="text-[10px] opacity-70">{tx('pts', 'نقطة')}</span>
                                    </span>
                                    {room.gameState === 'question' && (
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                            room.mode === 'turn_based'
                                                ? isTurn
                                                    ? 'bg-emerald-600 text-white'
                                                    : isBento ? 'bg-white text-slate-600 border border-black/30' : 'bg-black/10 dark:bg-white/10 opacity-70'
                                                : hasSubmitted
                                                    ? 'bg-emerald-600 text-white'
                                                    : isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                                        }`}>
                                            {room.mode === 'turn_based'
                                                ? isTurn ? tx('TURN', 'دورك') : tx('WAIT', 'انتظار')
                                                : hasSubmitted ? tx('✓ SENT', '✓ تمام') : '...'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface WaitingCardProps {
    room: ClassroomRoomState;
    isBento: boolean;
    isHost: boolean;
    onForceReveal?: () => void;
    revealing?: boolean;
}

export const ClassroomWaitingCard: React.FC<WaitingCardProps> = ({
    room,
    isBento,
    isHost,
    onForceReveal,
    revealing = false
}) => {
    const { tx } = useLanguage();
    const eligible = room.players.filter(p => !p.isSpectator);
    const submittedSet = new Set(room.submittedUserIds || []);
    const submittedCount = eligible.filter(p => submittedSet.has(p.id) || p.hasSubmitted).length;
    const total = Math.max(1, eligible.length);
    const pct = Math.min(100, Math.round((submittedCount / total) * 100));

    return (
        <div className={`w-full rounded-2xl p-5 text-center space-y-4 ${
            isBento
                ? 'bg-white border-[3px] border-black shadow-[5px_5px_0_#000] text-black'
                : 'bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 shadow-xl text-slate-900 dark:text-white'
        }`}>
            <div className="flex flex-col items-center gap-2">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    isBento ? 'bg-[#bae6fd] border-2 border-black text-black' : 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-300'
                }`}>
                    <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight">
                    {tx('Waiting for Everyone to Click Submit...', 'مستنيين الكل يبعت إجابته...')}
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {tx(
                        `Answers stay locked and hidden until all participants submit (${submittedCount} of ${total} ready).`,
                        `الإجابات بتفضل مستخبية لحد ما الكل يخلص (${submittedCount} من ${total} جاهزين).`
                    )}
                </p>
            </div>

            {/* Live Progress Bar */}
            <div className="max-w-md mx-auto space-y-1.5">
                <div className={`w-full h-3 rounded-full overflow-hidden ${
                    isBento ? 'bg-slate-100 border-2 border-black' : 'bg-slate-200 dark:bg-white/10'
                }`}>
                    <div
                        className={`h-full transition-all duration-300 ${
                            isBento ? 'bg-[#bef264]' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex justify-between text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>{tx('Live Submissions', 'الإجابات المباشرة')}</span>
                    <span>{submittedCount} / {total} {tx('Submitted', 'اتسلمت')}</span>
                </div>
            </div>

            {/* Per-participant submission checklist */}
            <div className="flex flex-wrap items-center justify-center gap-2">
                {eligible.map(p => {
                    const done = submittedSet.has(p.id) || p.hasSubmitted;
                    return (
                        <div
                            key={p.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                done
                                    ? isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                                    : isBento
                                        ? 'bg-[#fef9c3] text-black border-2 border-black/50'
                                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                            }`}
                        >
                            {done ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                                <Clock className="w-3.5 h-3.5 animate-pulse text-amber-600 dark:text-amber-400 shrink-0" />
                            )}
                            <span>{p.name.split(' ')[0]}</span>
                            <span className="text-[10px] opacity-75">
                                {done ? tx('Submitted', 'سلم') : tx('Answering', 'بيجاوب')}
                            </span>
                        </div>
                    );
                })}
            </div>

            {isHost && onForceReveal && (
                <div className="pt-1">
                    <button
                        type="button"
                        onClick={onForceReveal}
                        disabled={revealing}
                        className={`btn-unstyled inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition ${
                            isBento
                                ? 'bg-[#fde047] hover:bg-amber-300 text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                    >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{revealing ? tx('Revealing...', 'جاري الكشف...') : tx('Reveal Answers Now', 'اكشف الإجابات دلوقتي')}</span>
                    </button>
                </div>
            )}
        </div>
    );
};

interface RevealSectionProps {
    room: ClassroomRoomState;
    myUserId: string;
    isBento: boolean;
}

export const ClassroomRevealSection: React.FC<RevealSectionProps> = ({ room, myUserId, isBento }) => {
    const { tx } = useLanguage();
    const currentQ = room.currentQuestion;
    const correctIdx = typeof currentQ?.correctAnswer === 'number'
        ? currentQ.correctAnswer
        : room.roundReveal?.correctAnswer ?? -1;

    const explanationBox = currentQ?.explanation && currentQ.explanation.trim() ? (
        <div className={`p-3 rounded-xl text-start text-xs leading-relaxed ${
            isBento
                ? 'bg-[#fef9c3] border-2 border-black text-black'
                : 'bg-indigo-500/10 border border-indigo-500/25 text-slate-700 dark:text-slate-200'
        }`}>
            <span className="font-black uppercase tracking-wider text-[10px] block opacity-75 mb-0.5">
                💡 {tx('Explanation', 'التوضيح')}
            </span>
            <MathRenderer text={currentQ.explanation} />
        </div>
    ) : null;

    if (room.mode === 'turn_based') {
        const res = room.lastTurnResult;
        const isCorrect = Boolean(res?.isCorrect);
        const timedOut = Boolean(res?.timedOut);

        return (
            <div className="w-full space-y-3">
                <div className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCorrect
                        ? isBento
                            ? 'bg-[#bef264] border-[3px] border-black text-black shadow-[4px_4px_0_#000]'
                            : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                        : isBento
                            ? 'bg-[#fecdd3] border-[3px] border-black text-black shadow-[4px_4px_0_#000]'
                            : 'bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className="text-3xl shrink-0">
                            {isCorrect ? '🎉' : timedOut ? '⏰' : '💥'}
                        </div>
                        <div className="text-start">
                            <div className="text-[10px] font-black uppercase tracking-wider opacity-80">
                                {tx(`${res?.playerName || 'Player'}'s Turn Result`, `نتيجة دور ${res?.playerName || 'اللاعب'}`)}
                            </div>
                            <div className="text-lg font-black leading-tight">
                                {isCorrect
                                    ? tx(`Correct Answer! +${res?.points || 0} pts`, `إجابة صح! +${res?.points || 0} نقطة`)
                                    : timedOut
                                        ? tx('Time Expired! (0 pts)', 'الوقت خلص! (0 نقطة)')
                                        : tx('Incorrect Answer (0 pts)', 'إجابة غلط (0 نقطة)')}
                            </div>
                        </div>
                    </div>
                    {currentQ && correctIdx >= 0 && currentQ.options?.[correctIdx] && (
                        <div className={`px-3 py-1.5 rounded-xl text-xs font-bold text-start ${
                            isBento ? 'bg-white border-2 border-black text-black' : 'bg-white/80 dark:bg-black/30 text-slate-900 dark:text-white'
                        }`}>
                            <span className="text-[10px] uppercase font-black opacity-70 block">
                                {tx(`Correct Option (${OPTION_LETTERS[correctIdx]})`, `الإجابة الصح (${OPTION_LETTERS[correctIdx]})`)}
                            </span>
                            <span className="truncate max-w-[220px] inline-block">{currentQ.options[correctIdx]}</span>
                        </div>
                    )}
                </div>

                {currentQ && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {currentQ.options.map((opt, idx) => {
                            const isOptCorrect = idx === correctIdx;
                            const wasPicked = res?.answerIndex === idx;
                            return (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-xl flex items-center justify-between gap-2 text-xs font-bold ${
                                        isOptCorrect
                                            ? isBento
                                                ? 'bg-[#bef264] border-2 border-black text-black'
                                                : 'bg-emerald-500/20 border border-emerald-500 text-emerald-700 dark:text-emerald-200'
                                            : wasPicked
                                                ? isBento
                                                    ? 'bg-[#fecdd3] border-2 border-black text-black'
                                                    : 'bg-rose-500/20 border border-rose-500 text-rose-700 dark:text-rose-200'
                                                : isBento
                                                    ? 'bg-white/80 border border-black/30 text-slate-500'
                                                    : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-6 h-6 rounded-lg bg-black/10 dark:bg-white/10 flex items-center justify-center font-black shrink-0">
                                            {OPTION_LETTERS[idx]}
                                        </span>
                                        <MathRenderer text={opt} className="truncate" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase shrink-0">
                                        {isOptCorrect ? tx('✓ Correct', '✓ صح') : wasPicked ? tx('✗ Picked', '✗ اختياره') : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {explanationBox}
            </div>
        );
    }

    // SIMULTANEOUS MODE REVEAL: Show correct option + who answered right/wrong & picked what
    const reveal = room.roundReveal;
    const results = reveal?.results || [];
    const correctOptionText = currentQ?.options?.[correctIdx] || '';
    const rightCount = results.filter(r => r.isCorrect).length;

    return (
        <div className="w-full space-y-3">
            {/* Correct Answer Header */}
            <div className={`p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                isBento
                    ? 'bg-[#bef264] border-[3px] border-black text-black shadow-[4px_4px_0_#000]'
                    : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
            }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <Sparkles className="w-5 h-5 shrink-0" />
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-wider opacity-80">
                            {tx(
                                `Correct Answer (${OPTION_LETTERS[correctIdx] || '?'}) • ${rightCount} / ${results.length} Right`,
                                `الإجابة الصح (${OPTION_LETTERS[correctIdx] || '؟'}) • ${rightCount} / ${results.length} صح`
                            )}
                        </div>
                        <div className="text-sm sm:text-base font-black truncate">
                            {correctOptionText || tx('Round Complete', 'الجولة خلصت')}
                        </div>
                    </div>
                </div>
                {currentQ && (
                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {currentQ.options.map((_, idx) => {
                            const count = reveal?.optionCounts?.[idx] || 0;
                            const isRight = idx === correctIdx;
                            return (
                                <span
                                    key={idx}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-black ${
                                        isRight
                                            ? isBento ? 'bg-white text-black border-2 border-black' : 'bg-emerald-600 text-white'
                                            : isBento ? 'bg-black/10 text-black' : 'bg-black/10 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    {OPTION_LETTERS[idx]}: {count}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Who Answered Right / Picked What Grid */}
            <div className={`p-3 rounded-2xl space-y-2 ${
                isBento
                    ? 'bg-white border-2 border-black shadow-[3px_3px_0_#000]'
                    : 'bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10'
            }`}>
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                    <span>{tx('Who Answered Right', 'مين جاوب صح')}</span>
                    <span>{tx('Choice • Time • Points', 'الاختيار • الوقت • النقط')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[210px] overflow-y-auto pr-0.5">
                    {results.map((item) => {
                        const isMe = item.userId === myUserId;
                        const pickedLabel = item.answerIndex >= 0
                            ? `${OPTION_LETTERS[item.answerIndex] || '?'}`
                            : tx('Timeout', 'الوقت خلص');
                        const seconds = (item.timeSpentMs / 1000).toFixed(1);

                        return (
                            <div
                                key={item.userId}
                                className={`p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs ${
                                    item.isCorrect
                                        ? isBento
                                            ? 'bg-emerald-100 border-2 border-black text-black'
                                            : 'bg-emerald-500/12 border border-emerald-500/35 text-slate-900 dark:text-white'
                                        : isBento
                                            ? 'bg-rose-100 border-2 border-black text-black'
                                            : 'bg-rose-500/10 border border-rose-500/30 text-slate-900 dark:text-white'
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    {item.isCorrect ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                    )}
                                    <div className="min-w-0 truncate">
                                        <span className="font-black">
                                            {item.userName}
                                            {isMe ? tx(' (You)', ' (أنت)') : ''}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] font-black">
                                    <span className={`px-1.5 py-0.5 rounded ${
                                        isBento ? 'bg-white border border-black text-black' : 'bg-black/10 dark:bg-white/10'
                                    }`}>
                                        {pickedLabel}
                                    </span>
                                    <span className="opacity-70">{seconds}s</span>
                                    <span className={item.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                                        +{item.points}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {explanationBox}
        </div>
    );
};

interface PodiumSectionProps {
    room: ClassroomRoomState;
    myUserId: string;
    isBento: boolean;
}

export const ClassroomPodiumSection: React.FC<PodiumSectionProps> = ({ room, myUserId, isBento }) => {
    const { tx } = useLanguage();
    const ranked = [...room.players]
        .filter(p => !p.isSpectator)
        .sort((a, b) => b.score - a.score);

    return (
        <div className="w-full max-w-lg mx-auto text-center space-y-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
                isBento
                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0_#000]'
                    : 'bg-amber-500/20 text-amber-400'
            }`}>
                <Trophy className="w-8 h-8" />
            </div>

            <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-300">
                    {tx('Session Complete', 'الجولة خلصت')} • {room.quizTitle}
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
                    {tx('Final Arena Podium', 'الترتيب النهائي للساحة')}
                </h2>
            </div>

            <div className={`p-3.5 rounded-2xl space-y-2 text-start max-h-[260px] overflow-y-auto ${
                isBento
                    ? 'bg-white border-[3px] border-black shadow-[5px_5px_0_#000]'
                    : 'bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 shadow-xl'
            }`}>
                {ranked.map((p, idx) => {
                    const isWinner = idx === 0;
                    const isMe = p.id === myUserId;
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                    return (
                        <div
                            key={p.id}
                            className={`p-3 rounded-xl flex items-center justify-between gap-3 ${
                                isWinner
                                    ? isBento
                                        ? 'bg-[#fde047] border-2 border-black text-black font-black'
                                        : 'bg-amber-500/15 border border-amber-500/50 text-amber-700 dark:text-amber-300 font-black'
                                    : isBento
                                        ? 'bg-slate-50 border border-black/25 text-black'
                                        : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                    isBento ? 'bg-white border border-black text-black' : 'bg-black/10 dark:bg-white/10'
                                }`}>
                                    {medal}
                                </span>
                                <div className="min-w-0">
                                    <div className="text-sm font-black truncate">
                                        {p.name}{isMe ? tx(' (You)', ' (أنت)') : ''}
                                    </div>
                                    <div className="text-[11px] opacity-75 font-bold">
                                        {p.correctCount}/{room.totalQuestions} {tx('correct', 'صح')} • {getRoleTag(p)}
                                    </div>
                                </div>
                            </div>
                            <span className="font-mono font-black text-base shrink-0">{p.score} {tx('pts', 'نقطة')}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

interface HostParticipatesControlProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    isBento: boolean;
    label?: string;
    disabled?: boolean;
    popoverAlign?: 'left' | 'right';
}

export const HostParticipatesControl: React.FC<HostParticipatesControlProps> = ({
    checked,
    onChange,
    isBento,
    label,
    disabled = false,
    popoverAlign = 'right'
}) => {
    const { tx } = useLanguage();
    const resolvedLabel = label || tx('Teacher plays & scores', 'المدرس يلعب وياخد نقط');
    const [showInfo, setShowInfo] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!showInfo) return;
        const onPointerDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setShowInfo(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowInfo(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [showInfo]);

    return (
        <div ref={wrapRef} className="relative inline-flex items-center gap-1.5">
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={`btn-unstyled inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer select-none ${
                    checked
                        ? isBento
                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                        : isBento
                            ? 'bg-slate-100 text-slate-700 border-2 border-black shadow-[2px_2px_0_#000]'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/15'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
                <span className={`relative inline-flex items-center w-8 h-4.5 rounded-full p-0.5 transition-colors shrink-0 ${
                    checked
                        ? isBento ? 'bg-black' : 'bg-emerald-600'
                        : isBento ? 'bg-slate-400' : 'bg-slate-300 dark:bg-white/25'
                }`}>
                    <span className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                        checked ? 'translate-x-3.5' : 'translate-x-0'
                    }`} />
                </span>

                <span className="inline-flex items-center gap-1">
                    {checked ? (
                        <UserCheck className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{resolvedLabel}</span>
                </span>

                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase ${
                    checked
                        ? isBento ? 'bg-white text-black border border-black' : 'bg-emerald-600 text-white'
                        : isBento ? 'bg-white text-slate-700 border border-black/40' : 'bg-black/10 dark:bg-white/15'
                }`}>
                    {checked ? tx('ON', 'مفعل') : tx('OFF', 'مقفول')}
                </span>
            </button>

            <button
                type="button"
                aria-label={tx('What does Teacher plays and scores mean?', 'يعني إيه المدرس يلعب وياخد نقط؟')}
                aria-expanded={showInfo}
                onClick={() => setShowInfo(prev => !prev)}
                onMouseEnter={() => setShowInfo(true)}
                onMouseLeave={() => setShowInfo(false)}
                className={`btn-unstyled w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition ${
                    showInfo
                        ? isBento
                            ? 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                            : 'bg-indigo-600 text-white'
                        : isBento
                            ? 'bg-white hover:bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300'
                }`}
            >
                <Info className="w-3.5 h-3.5" />
            </button>

            {showInfo && (
                <div
                    role="tooltip"
                    className={`absolute ${popoverAlign === 'left' ? 'left-0' : 'right-0'} top-full mt-2 w-72 p-3 rounded-2xl text-start text-[11px] z-50 space-y-1.5 animate-in fade-in zoom-in-95 duration-150 ${
                        isBento
                            ? 'bg-white text-black border-2 border-black shadow-[4px_4px_0_#000]'
                            : 'bg-white dark:bg-[#16192b] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/15 shadow-2xl'
                    }`}
                >
                    <div className="font-black uppercase tracking-wider text-[10px] text-indigo-600 dark:text-indigo-300">
                        {tx('Host Participation Mode', 'وضع مشاركة المضيف')}
                    </div>
                    <p className="leading-snug">
                        <strong className="text-emerald-700 dark:text-emerald-300">{tx('ON (Active Player):', 'مفعل (لاعب نشط):')}</strong>{' '}
                        {tx(
                            'You join turns (Mode 1) or submit answers (Mode 2) with students and earn points on the scoreboard.',
                            'بتدخل في الأدوار (نظام ١) أو بتبعت إجاباتك (نظام ٢) مع الطلاب وتاخد نقط على لوحة الترتيب.'
                        )}
                    </p>
                    <p className="leading-snug">
                        <strong className="text-slate-600 dark:text-slate-300">{tx('OFF (Monitor Only):', 'مقفول (مراقب فقط):')}</strong>{' '}
                        {tx(
                            'You host and reveal answers without taking turns or appearing on the leaderboard.',
                            'بتدير الساحة وتكشف الإجابات من غير ما تاخد دور أو تظهر في لوحة المتصدرين.'
                        )}
                    </p>
                </div>
            )}
        </div>
    );
};

interface QuestionCardProps {
    question: ClassroomQuestionDTO;
    isBento: boolean;
    compact?: boolean;
}

export const ClassroomQuestionCard: React.FC<QuestionCardProps> = ({
    question,
    isBento,
    compact = false
}) => (
    <div className={`${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'} rounded-2xl text-center space-y-2.5 ${
        isBento
            ? 'bg-white border-[3px] border-black shadow-[5px_5px_0_#000]'
            : 'bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 shadow-xl'
    }`}>
        <MathRenderer
            text={question.question}
            className={`${compact ? 'text-sm sm:text-base' : 'text-lg sm:text-2xl'} font-black leading-snug`}
        />
        {question.codeSnippet && question.codeSnippet.trim() && (
            <pre className={`text-left text-xs font-mono p-3 rounded-xl overflow-x-auto max-h-40 ${
                isBento
                    ? 'bg-slate-900 text-lime-300 border-2 border-black'
                    : 'bg-slate-900 text-slate-100 border border-white/10'
            }`}>
                <code>{question.codeSnippet}</code>
            </pre>
        )}
        {question.imageUrl && question.imageUrl.trim() && (
            <img
                src={question.imageUrl}
                alt="Question visual"
                className="max-h-40 mx-auto rounded-xl object-contain border border-black/15 dark:border-white/15"
            />
        )}
    </div>
);
