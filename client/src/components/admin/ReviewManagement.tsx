import React, { useState } from 'react';
import { Check, BookOpen } from 'lucide-react';
import Avatar from '../Avatar.tsx';
import type { AttemptData, Quiz, UserData } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface ReviewManagementProps {
    currentUser: UserData;
    users: UserData[];
    quizzes: Quiz[];
    pendingReviews: AttemptData[];
    onRefresh: () => void | Promise<void>;
    onNotification: (type: 'success' | 'error', message: string) => void;
}

const ReviewManagement: React.FC<ReviewManagementProps> = ({ currentUser, users, quizzes, pendingReviews, onRefresh, onNotification }) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const [reviewingAttempt, setReviewingAttempt] = useState<AttemptData | null>(null);
    const [reviewFeedback, setReviewFeedback] = useState<Record<number, string>>({});
    const [reviewScores, setReviewScores] = useState<Record<string, number>>({});

    const getQuizForAttempt = (attempt: AttemptData) => {
        return quizzes.find((q) => q.id === attempt.quizId || q._id === attempt.quizId);
    };

    const reviewQuestions = reviewingAttempt
        ? Array.isArray(getQuizForAttempt(reviewingAttempt)?.questions)
            ? getQuizForAttempt(reviewingAttempt)!.questions
            : []
        : [];

    const handleReviewSubmit = async () => {
        if (!reviewingAttempt) return;
        const additionalPoints = Object.values(reviewScores).reduce((sum, score) => sum + score, 0);

        try {
            await api.submitReview(
                reviewingAttempt.attemptId,
                {
                    feedback: reviewFeedback,
                    scoreAdjustment: additionalPoints
                },
                currentUser.userId
            );

            setReviewingAttempt(null);
            setReviewFeedback({});
            setReviewScores({});
            onNotification('success', 'Review submitted successfully');
            await Promise.resolve(onRefresh());
        } catch (error) {
            console.error('Submit review error:', error);
            onNotification('error', 'Failed to submit review');
        }
    };

    const totalAdjustment = Object.values(reviewScores).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {pendingReviews.length === 0 && !reviewingAttempt ? (
                <div
                    className={`py-20 px-6 text-center ${
                        isBento
                            ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'bg-white/60 dark:bg-[#1e1e2d]/60 backdrop-blur-xl rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-sm'
                    }`}
                >
                    <div
                        className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                            isBento
                                ? 'bg-[#bef264] border-2 border-black text-black shadow-[3px_3px_0px_#000]'
                                : 'bg-emerald-500/10 text-emerald-500'
                        }`}
                    >
                        <Check className="w-10 h-10" />
                    </div>
                    <p
                        className={`font-black uppercase tracking-widest text-sm ${
                            isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        {tx('All caught up! No pending reviews.', 'كل المراجعات خالصة! مفيش مراجعات معلقة.')}
                    </p>
                </div>
            ) : reviewingAttempt ? (
                <div className="space-y-6">
                    {/* Header Workspace */}
                    <div
                        className={`flex flex-col sm:flex-row justify-between items-center p-5 sm:p-6 sticky top-2 z-20 ${
                            isBento
                                ? 'bg-white rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_#000]'
                                : 'bg-white/70 dark:bg-[#1e1e2d]/70 backdrop-blur-3xl rounded-3xl border border-white/20 dark:border-white/5 shadow-2xl'
                        }`}
                    >
                        <div className="flex items-center gap-4 mb-4 sm:mb-0">
                            <div
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden ${
                                    isBento
                                        ? 'bg-[#ddd6fe] border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-gradient-to-br from-purple-600 to-indigo-600 p-0.5 shadow-xl'
                                }`}
                            >
                                <div className={`w-full h-full flex items-center justify-center overflow-hidden ${isBento ? '' : 'bg-white dark:bg-[#1e1e2d] rounded-[14px]'}`}>
                                    {(() => {
                                        const student = users?.find((u) => u.userId === reviewingAttempt.userId);
                                        return student?.avatar ? (
                                            <Avatar config={student.avatar} size="md" className="w-full h-full" />
                                        ) : (
                                            <span className={`font-black text-lg ${isBento ? 'text-black' : 'text-purple-600'}`}>
                                                {(reviewingAttempt.userName || 'S').charAt(0)}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div>
                                <h3 className={`text-xl font-black uppercase tracking-tight ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                                    {tx('Grading', 'تصحيح')}{' '}
                                    <span className={isBento ? 'underline decoration-2' : 'text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-500'}>
                                        {reviewingAttempt.userName || 'Student'}
                                    </span>
                                </h3>
                                <p className={`text-xs font-bold uppercase tracking-widest ${isBento ? 'text-slate-700' : 'text-gray-400 dark:text-gray-500'}`}>
                                    Quiz: {getQuizForAttempt(reviewingAttempt)?.title || 'Quiz'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div
                                className={`px-5 py-2.5 rounded-2xl text-center flex-1 sm:flex-none ${
                                    isBento
                                        ? 'bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-gray-50 dark:bg-black/20 border border-white/10'
                                }`}
                            >
                                <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-0.5 ${isBento ? 'text-black' : 'text-gray-400'}`}>Adjustment</div>
                                <div className={`text-lg font-black ${isBento ? 'text-black' : totalAdjustment >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {totalAdjustment > 0 ? '+' : ''}
                                    {totalAdjustment} pts
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReviewingAttempt(null)}
                                className={`btn-unstyled px-4 py-3 font-black text-xs uppercase tracking-widest transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-white hover:bg-[#fecdd3] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-2xl text-gray-600 dark:text-gray-400'
                                }`}
                            >
                                {tx('Cancel', 'إلغاء')}
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleReviewSubmit()}
                                className={`btn-unstyled flex-1 sm:flex-none px-7 py-3 font-black text-xs uppercase tracking-[0.1em] transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-purple-500/30 hover:-translate-y-0.5'
                                }`}
                            >
                                {tx('Submit Review', 'اعتماد المراجعة')}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {reviewQuestions.map((q, idx) => {
                            if (q.type !== 'text') return null;
                            const ans = reviewingAttempt.answers?.[q.id];

                            return (
                                <div
                                    key={q.id}
                                    className={`p-6 space-y-5 group transition-all ${
                                        isBento
                                            ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                                            : 'bg-white/60 dark:bg-[#1e1e2d]/60 backdrop-blur-xl rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-sm hover:shadow-xl'
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                                        isBento
                                                            ? 'bg-[#ddd6fe] text-black border border-black'
                                                            : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                                    }`}
                                                >
                                                    Quest {idx + 1}
                                                </span>
                                                <span
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                                        isBento
                                                            ? 'bg-[#bae6fd] text-black border border-black'
                                                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                                    }`}
                                                >
                                                    Open Text
                                                </span>
                                            </div>
                                            <p className={`text-lg font-black leading-tight tracking-tight uppercase ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>{q.question}</p>
                                        </div>
                                        <div
                                            className={`flex flex-col items-center p-2 rounded-2xl min-w-[70px] ${
                                                isBento
                                                    ? 'bg-[#fef08a] border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-gray-50 dark:bg-black/20 border border-white/5'
                                            }`}
                                        >
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${isBento ? 'text-black' : 'text-gray-400'}`}>Points</span>
                                            <span className={`text-lg font-black ${isBento ? 'text-black' : 'text-indigo-500'}`}>{q.points || 1}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className={`text-[10px] font-black uppercase tracking-[0.2em] ms-1 ${isBento ? 'text-black' : 'text-gray-400'}`}>Student Response</label>
                                        <div
                                            className={`p-5 rounded-2xl font-bold text-sm leading-relaxed ${
                                                isBento
                                                    ? 'bg-[#f5f3ec] border-2 border-black text-black'
                                                    : 'bg-gray-50/50 dark:bg-[#050505]/50 text-gray-900 dark:text-gray-100 border-2 border-indigo-500/5 shadow-inner'
                                            }`}
                                        >
                                            {(() => {
                                                if (typeof ans === 'object' && ans !== null) {
                                                    return 'selected' in ans && ans.selected !== undefined ? String(ans.selected) : JSON.stringify(ans);
                                                }
                                                return ans || <span className="opacity-60 italic">No answer provided by students.</span>;
                                            })()}
                                        </div>
                                    </div>

                                    {q.explanation && (
                                        <div
                                            className={`p-4 rounded-2xl flex gap-3 items-start ${
                                                isBento
                                                    ? 'bg-[#d9f99d] border-2 border-black text-black'
                                                    : 'bg-emerald-500/5 border border-emerald-500/10'
                                            }`}
                                        >
                                            <div className={`p-2 rounded-xl mt-0.5 ${isBento ? 'bg-white border border-black text-black' : 'bg-emerald-500/10'}`}>
                                                <BookOpen className={`w-4 h-4 ${isBento ? 'text-black' : 'text-emerald-500'}`} />
                                            </div>
                                            <div>
                                                <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isBento ? 'text-black' : 'text-emerald-600 dark:text-emerald-400'}`}>Reference Guide</div>
                                                <p className={`text-xs font-bold leading-relaxed ${isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'}`}>{q.explanation}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className={`grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 ${isBento ? 'border-t-2 border-black/15' : 'border-t border-white/10'}`}>
                                        <div className="sm:col-span-1">
                                            <label className={`text-[10px] font-black uppercase tracking-widest ms-1 mb-1.5 block ${isBento ? 'text-black' : 'text-gray-400'}`}>Score Adj.</label>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                className="w-full bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl px-4 py-3 text-gray-900 dark:text-white font-black outline-none transition-all placeholder:text-gray-300"
                                                onChange={(e) => setReviewScores({ ...reviewScores, [q.id]: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="sm:col-span-3">
                                            <label className={`text-[10px] font-black uppercase tracking-widest ms-1 mb-1.5 block ${isBento ? 'text-black' : 'text-gray-400'}`}>Written Feedback</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Excellent detail in your explanation..."
                                                className="w-full bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl px-5 py-3 text-gray-900 dark:text-white font-bold outline-none transition-all placeholder:text-gray-400"
                                                onChange={(e) => setReviewFeedback({ ...reviewFeedback, [q.id]: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingReviews.map((attempt) => (
                        <div
                            key={attempt.attemptId}
                            className={`p-5 transition-all group flex items-center justify-between gap-3 ${
                                isBento
                                    ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000] hover:-translate-y-0.5'
                                    : 'bg-white/60 dark:bg-[#1e1e2d]/60 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/5 hover:border-indigo-500/30 shadow-sm'
                            }`}
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden font-black shrink-0 ${
                                        isBento
                                            ? 'bg-[#ddd6fe] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg group-hover:scale-110 transition-transform text-indigo-600'
                                    }`}
                                >
                                    <div className={`w-full h-full flex items-center justify-center overflow-hidden ${isBento ? '' : 'bg-white dark:bg-[#1e1e2d] rounded-[14px]'}`}>
                                        {(() => {
                                            const student = users?.find((u) => u.userId === attempt.userId);
                                            return student?.avatar ? (
                                                <Avatar config={student.avatar} size="sm" className="w-full h-full" />
                                            ) : (
                                                (attempt.userName || 'S').charAt(0)
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <h4 className={`font-black uppercase tracking-tight truncate ${isBento ? 'text-black' : 'text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors'}`}>
                                        {attempt.userName || 'Student'}
                                    </h4>
                                    <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-0.5 ${isBento ? 'text-slate-600' : 'text-gray-400'}`}>
                                        <span className={isBento ? 'text-black' : 'text-indigo-500'}>{attempt.quizTitle || 'Quiz'}</span>
                                        <span className="w-1 h-1 rounded-full bg-gray-400" />
                                        <span>{attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString() : 'Recent'}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReviewingAttempt(attempt)}
                                className={`btn-unstyled px-5 py-2.5 font-black text-xs uppercase tracking-widest transition-all cursor-pointer shrink-0 ${
                                    isBento
                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-[1.25rem] hover:bg-indigo-600 hover:text-white'
                                }`}
                            >
                                {tx('Review', 'مراجعة')}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReviewManagement;
