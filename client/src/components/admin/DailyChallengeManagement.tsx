import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Plus, Edit2, Trash2, RefreshCw, Code2, Calendar, Sparkles, Mail, Send, Bot, Layers, Gift, CheckCircle2 } from 'lucide-react';
import Modal from '../common/Modal';
import ConfirmDialog from '../ConfirmDialog';
import type { UserData, Quiz, CompilerQuestion, ShopItem, DailyChallengeItem } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import CompilerQuestionManagement from './CompilerQuestionManagement';
import { useTheme } from '../../context/ThemeContext.tsx';

interface AiTierPreview {
    title?: string;
    category?: string;
    giftLabel?: string;
    rewardCoins?: number;
    rewardXP?: number;
    description?: string;
    starterCode?: string;
    referenceCode?: string;
    hints?: string[];
}

interface AiGeneratedChallengePreview {
    referenceTitle?: string;
    language?: string;
    referenceCategory?: string;
    tiers?: Partial<Record<'easy' | 'medium' | 'hard', AiTierPreview>>;
}

interface DailyChallengeManagementProps {
    currentUser: UserData;
    quizzes?: Quiz[];
    onNotification: (type: 'success' | 'error', message: string) => void;
}

const DailyChallengeManagement: React.FC<DailyChallengeManagementProps> = ({ currentUser, quizzes = [], onNotification }) => {
    const { isBento } = useTheme();
    const [activeTab, setActiveTab] = useState<'schedule' | 'questions'>('schedule');
    const [dailyChallenges, setDailyChallenges] = useState<DailyChallengeItem[]>([]);
    const [compilerQuestions, setCompilerQuestions] = useState<CompilerQuestion[]>([]);
    const [editingChallenge, setEditingChallenge] = useState<DailyChallengeItem | null>(null);
    const [shopItems, setShopItems] = useState<ShopItem[]>([]);
    const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'reschedule', item: DailyChallengeItem } | null>(null);
    const [isAutoScheduling, setIsAutoScheduling] = useState(false);

    // AI 3-Tier Generator State
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiDate, setAiDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });
    const [selectedQuizId, setSelectedQuizId] = useState('random');
    const [selectedLanguage, setSelectedLanguage] = useState('javascript');
    const [customTopic, setCustomTopic] = useState('');
    const [tierRewards, setTierRewards] = useState({
        easy: { coins: 50, xp: 80, giftLabel: 'Bronze Novice Satchel' },
        medium: { coins: 100, xp: 180, giftLabel: 'Silver Adept Cache' },
        hard: { coins: 200, xp: 400, giftLabel: 'Gold Grandmaster Vault' }
    });
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [aiGeneratedPreview, setAiGeneratedPreview] = useState<AiGeneratedChallengePreview | null>(null);
    const [previewTierTab, setPreviewTierTab] = useState<'easy' | 'medium' | 'hard'>('easy');

    // Weekly Challenges Newsletter Broadcast State
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastData, setBroadcastData] = useState({
        title: '',
        description: '',
        category: 'Algorithmic Challenge'
    });
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

    const handleOpenBroadcast = async () => {
        try {
            const data = await api.getNewsletterSubscribers(currentUser.userId);
            setSubscriberCount(data.active || 0);
        } catch {
            setSubscriberCount(0);
        }
        const todayChallenge = dailyChallenges.find(c => new Date(c.date).toDateString() === new Date().toDateString());
        const qTitle = todayChallenge?.compilerQuestion?.title || 'Weekly Algorithmic Challenge';
        setBroadcastData({
            title: qTitle,
            description: todayChallenge?.compilerQuestion?.description?.substring(0, 150) || 'New weekly coding challenge dropped on Future Robins. Solve it to earn streak rewards and climb the rankings!',
            category: 'Algorithmic Challenge'
        });
        setShowBroadcastModal(true);
    };

    const handleSendBroadcast = async () => {
        if (!broadcastData.title.trim()) {
            onNotification('error', 'Please enter a challenge title');
            return;
        }
        setIsBroadcasting(true);
        try {
            const res = await api.broadcastChallengeDrop({
                challengeTitle: broadcastData.title,
                challengeDescription: broadcastData.description,
                trackCategory: broadcastData.category
            }, currentUser.userId);
            onNotification('success', res.message || 'Broadcast sent successfully!');
            setShowBroadcastModal(false);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to send broadcast';
            onNotification('error', msg);
        } finally {
            setIsBroadcasting(false);
        }
    };

    const handleGenerateAi = async (saveDirectly: boolean) => {
        if (!aiDate) {
            onNotification('error', 'Please select a date for the challenge');
            return;
        }

        setIsGeneratingAi(true);
        try {
            const res = await api.generateAiDailyChallenge({
                date: new Date(aiDate).toISOString(),
                referenceQuizId: selectedQuizId === 'random' ? undefined : selectedQuizId,
                language: selectedLanguage,
                customTopic: customTopic.trim() || undefined,
                tierRewards,
                saveDirectly
            }, currentUser.userId);

            if (saveDirectly) {
                onNotification('success', '✨ 3-Tier Daily Challenge generated & scheduled successfully!');
                setShowAiModal(false);
                setAiGeneratedPreview(null);
                loadData();
            } else {
                setAiGeneratedPreview(res);
                onNotification('success', '3-Tier challenge generated for preview! Review each level below.');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to generate 3-tier challenge with AI';
            onNotification('error', msg);
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleConfirmSchedulePreview = async () => {
        if (!aiGeneratedPreview) return;
        await handleGenerateAi(true);
    };

    const loadData = useCallback(async () => {
        try {
            const [challengesData, itemsData, questionsData] = await Promise.all([
                api.getDailyChallengesAdmin(currentUser.userId),
                api.getShopItems(),
                api.getCompilerQuestionsAdmin(currentUser.userId)
            ]);
            setDailyChallenges(challengesData);
            setShopItems(itemsData);
            setCompilerQuestions(questionsData);
        } catch (err) {
            console.error('Failed to load data', err);
            onNotification('error', 'Failed to load daily challenges data');
        }
    }, [currentUser.userId, onNotification]);

    useEffect(() => {
        if (activeTab === 'schedule') {
            loadData();
        }
    }, [activeTab, loadData]);

    const handleAutoScheduleWeek = async () => {
        const activeQuestions = compilerQuestions.filter(q => q.isActive);
        if (activeQuestions.length === 0) {
            onNotification('error', 'No active questions found in the Question Bank. Please add or activate questions.');
            return;
        }

        setIsAutoScheduling(true);
        try {
            // 1. Determine Start Date (Latest existing date + 1 day, or Tomorrow)
            let startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            startDate.setDate(startDate.getDate() + 1); // Default tomorrow

            const existingDates = dailyChallenges.map(c => new Date(c.date).getTime());
            if (existingDates.length > 0) {
                const maxDate = new Date(Math.max(...existingDates));
                maxDate.setHours(0, 0, 0, 0);
                if (maxDate >= startDate) {
                    startDate = new Date(maxDate);
                    startDate.setDate(startDate.getDate() + 1);
                }
            }

            // 2. Schedule 7 days - questions can be reused/rotated smoothly
            let scheduledCount = 0;
            const batchUsedQuestionIds = new Set<string>();

            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);

                // Find active questions not yet used in this batch
                let availableInBatch = activeQuestions.filter(q => !batchUsedQuestionIds.has(q.questionId));
                // If we exhausted questions within this batch, reset to allow reuse
                if (availableInBatch.length === 0) {
                    batchUsedQuestionIds.clear();
                    availableInBatch = activeQuestions;
                }

                // Prefer questions not used in the last 7 days among available
                const recentCutoff = new Date(currentDate);
                recentCutoff.setDate(recentCutoff.getDate() - 7);
                const recentQuestionIds = new Set(
                    dailyChallenges
                        .filter(c => new Date(c.date) > recentCutoff)
                        .map(c => c.compilerQuestionId)
                );

                const freshCandidates = availableInBatch.filter(q => !recentQuestionIds.has(q.questionId));
                const pool = freshCandidates.length > 0 ? freshCandidates : availableInBatch;

                const selectedQ = pool[Math.floor(Math.random() * pool.length)];
                batchUsedQuestionIds.add(selectedQ.questionId);

                await api.createDailyChallenge({
                    date: currentDate.toISOString(),
                    compilerQuestionId: selectedQ.questionId,
                    rewardCoins: 100,
                    rewardXP: 50
                }, currentUser.userId);

                scheduledCount++;
            }

            onNotification('success', `Scheduled ${scheduledCount} days successfully!`);
            setConfirmAction(null);
            loadData();
        } catch (error) {
            console.error(error);
            onNotification('error', 'Failed to auto-schedule');
        } finally {
            setIsAutoScheduling(false);
        }
    };

    const handleSaveChallenge = async () => {
        if (!editingChallenge) return;

        if (!editingChallenge.compilerQuestionId) {
            onNotification('error', 'Please select a compiler question');
            return;
        }

        try {
            // Check if exists
            const exists = dailyChallenges.some(c => new Date(c.date).toDateString() === new Date(editingChallenge.date).toDateString());

            // Prepare payload
            const payload = { ...editingChallenge };
            delete payload._isNew;
            delete payload._id;
            delete payload.quizId;
            delete payload.criteria;

            if (!editingChallenge._id) {
                if (!payload.compilerQuestionId) {
                    onNotification('error', 'Please select a question from the question bank');
                    return;
                }
                await api.createDailyChallenge({
                    date: payload.date,
                    compilerQuestionId: payload.compilerQuestionId,
                    rewardCoins: payload.rewardCoins,
                    rewardXP: payload.rewardXP,
                    rewardBadgeId: payload.rewardBadgeId,
                    rewardItemId: payload.rewardItemId,
                }, currentUser.userId);
                onNotification('success', exists ? 'Challenge appended to date' : 'Challenge scheduled');
            } else {
                await api.updateDailyChallenge(editingChallenge._id, payload, currentUser.userId);
                onNotification('success', 'Challenge updated');
            }
            setEditingChallenge(null);
            setConfirmAction(null);
            loadData();
        } catch (error) {
            console.error('Save challenge error:', error);
            onNotification('error', 'Failed to save challenge');
        }
    };

    const executeAction = async () => {
        if (!confirmAction) return;
        const { type, item } = confirmAction;

        try {
            if (type === 'delete') {
                const id = item._id || item.challengeId;
                if (!id) return;
                await api.deleteDailyChallenge(id, currentUser.userId);
                setDailyChallenges(prev => prev.filter(c => (c._id || c.challengeId) !== id));
                onNotification('success', 'Challenge deleted');
            } else if (type === 'reschedule') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayStr = today.toISOString();

                const id = item._id || item.challengeId;
                if (!id) return;
                const newPayload = { ...item, date: todayStr };
                delete newPayload._id;
                delete newPayload.challengeId;

                await api.updateDailyChallenge(id, newPayload, currentUser.userId);
                setEditingChallenge(null);
                loadData();
                onNotification('success', 'Challenge rescheduled/appended to today');
            }
        } catch (err) {
            console.error(err);
            onNotification('error', `Failed to ${type} challenge`);
        } finally {
            setConfirmAction(null);
        }
    };

    if (activeTab === 'questions') {
        return (
            <div className="space-y-4 animate-in fade-in duration-500">
                <div className="flex items-center gap-4 mb-6">
                    <button
                        type="button"
                        onClick={() => setActiveTab('schedule')}
                        className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] font-mono'
                                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                        }`}
                    >
                        ← Back to Schedule
                    </button>
                    <h2 className={`text-xl font-black uppercase tracking-tight ${isBento ? 'text-black font-mono' : 'text-gray-900 dark:text-white'}`}>
                        Manage Question Bank
                    </h2>
                </div>
                <CompilerQuestionManagement adminId={currentUser.userId} />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className={`p-4 sm:p-5 rounded-3xl transition-all flex flex-col 2xl:flex-row justify-between items-start 2xl:items-center gap-4 ${
                isBento
                    ? 'bg-white border-2 border-black shadow-[4px_4px_0px_#000]'
                    : 'bg-white/60 dark:bg-[#1c1917]/60 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-sm'
            }`}>
                <div className="flex items-center gap-3 shrink-0">
                    <div className={`p-2.5 rounded-2xl ${
                        isBento ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-teal-500/10'
                    }`}>
                        <Zap className={`w-6 h-6 ${isBento ? 'text-black' : 'text-teal-600 dark:text-teal-400'}`} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Daily Challenges</h2>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Schedule recurring coding tasks</p>
                    </div>
                </div>

                {/* Responsive Action Buttons Container */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full 2xl:w-auto">
                    <button
                        type="button"
                        onClick={() => {
                            setAiGeneratedPreview(null);
                            setShowAiModal(true);
                        }}
                        className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isBento
                                ? 'bg-[#fdba74] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                : 'bg-teal-600 text-white shadow-md shadow-teal-500/25 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:scale-95'
                        }`}
                        title="Generate 3-Tier Code Challenge using AI inspired by existing quizzes"
                    >
                        <Sparkles className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-yellow-300 animate-pulse'}`} />
                        <span>AI 3-Tier Generator</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleAutoScheduleWeek}
                        disabled={isAutoScheduling}
                        className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            isBento
                                ? 'bg-[#5eead4] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:scale-95'
                        }`}
                        title="Auto-Assign Questions for the Week"
                    >
                        {isAutoScheduling ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>Auto-Assign Week</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenBroadcast}
                        className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isBento
                                ? 'bg-[#fdba74] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                : 'bg-amber-500 text-white shadow-md shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:scale-95'
                        }`}
                        title="Broadcast Challenge Drop to Subscribers"
                    >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Notify Subscribers</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('questions')}
                        className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
                        }`}
                        title="View & Edit Question Bank"
                    >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Question Bank</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setEditingChallenge({ date: new Date().toISOString(), rewardCoins: 100, rewardXP: 50, _isNew: true })}
                        className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                : 'bg-teal-600 text-white shadow-md shadow-teal-500/25 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:scale-95'
                        }`}
                        title="Schedule a New Daily Challenge"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Schedule New</span>
                    </button>
                </div>
            </div>

            {/* Main Content Table */}
            <div className={`rounded-[2rem] border overflow-hidden transition-all ${
                isBento
                    ? 'bg-white border-2 border-black shadow-[4px_4px_0px_#000]'
                    : 'bg-white/60 dark:bg-[#1c1917]/60 backdrop-blur-xl border-white/20 dark:border-white/5 shadow-sm'
            }`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-black/20 text-gray-400 dark:text-gray-500 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">
                                <th className="px-6 py-4">Status & Date</th>
                                <th className="px-6 py-4">Questions & Tiers</th>
                                <th className="px-6 py-4">Rewards & Gifts</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {dailyChallenges.map((challenge) => {
                                const isPast = new Date(challenge.date) < new Date(new Date().setHours(0, 0, 0, 0));
                                const isToday = new Date(challenge.date).toDateString() === new Date().toDateString();

                                // Find associated question title if available
                                const question = compilerQuestions.find(q => q.questionId === challenge.compilerQuestionId);

                                return (
                                    <tr key={challenge._id || challenge.date} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-500/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${isToday ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : isPast ? 'bg-gray-300' : 'bg-indigo-500'}`} />
                                                <span className={`font-black uppercase text-xs tracking-tight ${isPast ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                    {new Date(challenge.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {challenge.populatedTiers?.easy || challenge.populatedTiers?.medium || challenge.populatedTiers?.hard ? (
                                                <div className="space-y-1.5 py-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[9px] font-black uppercase tracking-wider border border-teal-500/20 flex items-center gap-1">
                                                            <Layers className="w-3 h-3" /> 3 Tiers Active
                                                        </span>
                                                    </div>
                                                    {challenge.populatedTiers.easy && (
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                                            <span className="font-bold text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                                                                {challenge.populatedTiers.easy.question?.title || 'Easy Challenge'}
                                                            </span>
                                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                                                                🎁 {challenge.populatedTiers.easy.giftLabel}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {challenge.populatedTiers.medium && (
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                                            <span className="font-bold text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                                                                {challenge.populatedTiers.medium.question?.title || 'Medium Challenge'}
                                                            </span>
                                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold shrink-0">
                                                                🎁 {challenge.populatedTiers.medium.giftLabel}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {challenge.populatedTiers.hard && (
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                                            <span className="font-bold text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                                                                {challenge.populatedTiers.hard.question?.title || 'Hard Challenge'}
                                                            </span>
                                                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold shrink-0">
                                                                🎁 {challenge.populatedTiers.hard.giftLabel}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white uppercase text-sm tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                        {question?.title || challenge.title || 'Unknown Question'}
                                                    </div>
                                                    <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[180px] font-medium">
                                                        {question?.category || 'General'}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {challenge.populatedTiers ? (
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex gap-2">
                                                        <div className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[10px] font-black flex items-center gap-1">
                                                            <span>🪙</span> {(challenge.populatedTiers.easy?.rewardCoins || 50) + (challenge.populatedTiers.medium?.rewardCoins || 100) + (challenge.populatedTiers.hard?.rewardCoins || 200)}
                                                        </div>
                                                        <div className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black flex items-center gap-1">
                                                            <span>⚡</span> {(challenge.populatedTiers.easy?.rewardXP || 80) + (challenge.populatedTiers.medium?.rewardXP || 180) + (challenge.populatedTiers.hard?.rewardXP || 400)}
                                                        </div>
                                                    </div>
                                                    <span className="text-[9px] text-gray-400 font-semibold">User can solve all 3</span>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <div className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[10px] font-black flex items-center gap-1">
                                                        <span>🪙</span> {challenge.rewardCoins}
                                                    </div>
                                                    <div className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black flex items-center gap-1">
                                                        <span>⚡</span> {challenge.rewardXP}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => setEditingChallenge(challenge)}
                                                    className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all hover:scale-110"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmAction({ type: 'reschedule', item: challenge })}
                                                    className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all hover:scale-110"
                                                    title="Reschedule to Today"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmAction({ type: 'delete', item: challenge })}
                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-all hover:scale-110"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {dailyChallenges.length === 0 && (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="py-20 text-center">
                                            <div className="w-20 h-20 bg-indigo-500/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Calendar className="w-10 h-10 text-indigo-500/20" />
                                            </div>
                                            <p className="text-gray-400 font-black uppercase tracking-widest text-xs">No active challenges found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmDialog
                isOpen={!!confirmAction}
                onCancel={() => setConfirmAction(null)}
                onConfirm={executeAction}
                title={confirmAction?.type === 'delete' ? 'Delete Daily Challenge' : 'Reschedule Challenge'}
                message={confirmAction?.type === 'delete' ? 'Are you sure you want to permanently delete this daily challenge?' : 'Do you want to move this challenge to today? This will update the challenge date.'}
                confirmText={confirmAction?.type === 'delete' ? 'Delete' : 'Move to Today'}
                cancelText="Cancel"
                type={confirmAction?.type === 'delete' ? 'danger' : 'info'}
                showWarningBanner={confirmAction?.type === 'delete'}
            />

            {/* Edit Challenge Modal */}
            <Modal
                isOpen={!!editingChallenge}
                onClose={() => setEditingChallenge(null)}
                title="Edit Schedule"
                description="Configure daily goal parameters"
                maxWidth="max-w-2xl"
                icon={<Calendar className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />}
                footer={
                    <>
                        <button
                            onClick={() => setEditingChallenge(null)}
                            className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors cursor-pointer ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec]'
                                    : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                            }`}
                        >
                            Discard Changes
                        </button>
                        <button
                            onClick={handleSaveChallenge}
                            className={`flex-[2] py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:-translate-y-0.5'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                            }`}
                        >
                            Save Challenge
                        </button>
                    </>
                }
            >
                <div className="space-y-6">
                    {/* Date */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                            <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Date</label>
                            <input
                                type="date"
                                value={editingChallenge ? new Date(editingChallenge.date).toISOString().split('T')[0] : ''}
                                onChange={e => editingChallenge && setEditingChallenge({ ...editingChallenge, date: e.target.value })}
                                className={`w-full rounded-xl px-5 py-3.5 font-bold outline-none transition-all ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec]'
                                }`}
                            />
                        </div>
                    </div>

                    {/* Settings Grid */}
                    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-3xl ${
                        isBento
                            ? 'bg-[#f5f3ec] border-2 border-black shadow-[3px_3px_0px_#000]'
                            : 'bg-[#1a1714] border border-[#2e2924]'
                    }`}>
                        <div className="space-y-4">
                            <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ml-2 ${isBento ? 'text-black' : 'text-[#bef264]'}`}>Compiler Question</h4>
                            <select
                                value={editingChallenge?.compilerQuestionId || ''}
                                onChange={e => editingChallenge && setEditingChallenge({ ...editingChallenge, compilerQuestionId: e.target.value })}
                                className={`w-full rounded-xl px-4 py-3 font-bold outline-none transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec]'
                                }`}
                            >
                                <option value="">Select a Question...</option>
                                {compilerQuestions.filter(q => q.isActive).map(q => (
                                    <option key={q.questionId} value={q.questionId}>
                                        {q.title} ({q.difficulty})
                                    </option>
                                ))}
                            </select>

                            <p className={`text-xs pl-2 ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                                Select the coding question for this date. If left empty, the system will auto-select one.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ml-2 ${isBento ? 'text-black' : 'text-[#fde047]'}`}>Rewards Override</h4>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🪙</span>
                                    <input
                                        type="number"
                                        placeholder="Coins"
                                        value={editingChallenge?.rewardCoins || 0}
                                        onChange={e => editingChallenge && setEditingChallenge({ ...editingChallenge, rewardCoins: parseInt(e.target.value) })}
                                        className={`w-full rounded-xl px-4 py-3 pl-10 font-black outline-none transition-all ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#fde047] text-[#f5f3ec]'
                                        }`}
                                    />
                                </div>
                                <div className="relative flex-1">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">⚡</span>
                                    <input
                                        type="number"
                                        placeholder="XP"
                                        value={editingChallenge?.rewardXP || 0}
                                        onChange={e => editingChallenge && setEditingChallenge({ ...editingChallenge, rewardXP: parseInt(e.target.value) })}
                                        className={`w-full rounded-xl px-4 py-3 pl-10 font-black outline-none transition-all ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec]'
                                        }`}
                                    />
                                </div>
                            </div>

                            <select
                                value={editingChallenge?.rewardItemId || ''}
                                onChange={e => editingChallenge && setEditingChallenge({ ...editingChallenge, rewardItemId: e.target.value || undefined, rewardBadgeId: undefined })}
                                className={`w-full rounded-xl px-4 py-3 font-bold outline-none transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec]'
                                }`}
                            >
                                <option value="">No Shop Item Bonus</option>
                                {shopItems.map(item => (
                                    <option key={item.itemId} value={item.itemId}>
                                        {item.name} ({item.price} Coins)
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Challenge Broadcast Modal */}
            <Modal
                isOpen={showBroadcastModal}
                onClose={() => setShowBroadcastModal(false)}
                title="Weekly Challenge Notification Broadcast"
                description={`Send challenge drop email to ${subscriberCount ?? 0} active subscribers`}
                footer={
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowBroadcastModal(false)}
                            className={`px-4 py-2 font-bold rounded-xl transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec]'
                                    : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                            }`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSendBroadcast}
                            disabled={isBroadcasting || !broadcastData.title.trim()}
                            className={`px-6 py-2 font-black rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer ${
                                isBento
                                    ? 'bg-[#fde047] hover:bg-yellow-300 text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#fde047] hover:bg-[#fef08a] text-[#0a0908]'
                            }`}
                        >
                            {isBroadcasting ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Send to {subscriberCount ?? 0} Subscribers
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Challenge Title</label>
                        <input
                            type="text"
                            value={broadcastData.title}
                            onChange={e => setBroadcastData({ ...broadcastData, title: e.target.value })}
                            placeholder="e.g. Dijkstra's Shortest Path Algorithm"
                            className={`w-full rounded-xl px-4 py-3 font-bold outline-none ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                            }`}
                        />
                    </div>
                    <div>
                        <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Category</label>
                        <input
                            type="text"
                            value={broadcastData.category}
                            onChange={e => setBroadcastData({ ...broadcastData, category: e.target.value })}
                            placeholder="e.g. Graphs & Trees / Algorithmic Challenge"
                            className={`w-full rounded-xl px-4 py-3 font-bold outline-none ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                            }`}
                        />
                    </div>
                    <div>
                        <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Description & Highlights</label>
                        <textarea
                            rows={3}
                            value={broadcastData.description}
                            onChange={e => setBroadcastData({ ...broadcastData, description: e.target.value })}
                            placeholder="Explain the challenge, rewards, and key concepts..."
                            className={`w-full rounded-xl px-4 py-3 font-bold outline-none resize-none ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                            }`}
                        />
                    </div>
                    <div className={`p-3 rounded-xl text-xs font-medium ${
                        isBento
                            ? 'bg-[#fef08a] border-2 border-black text-black'
                            : 'bg-[#231f14] border border-[#fde047]/35 text-[#fde047]'
                    }`}>
                        📬 An email with a direct solving link and breakdown will be delivered to all active Weekly Challenge subscribers.
                    </div>
                </div>
            </Modal>

            {/* AI 3-Tier Challenge Generator Modal */}
            <Modal
                isOpen={showAiModal}
                onClose={() => {
                    if (!isGeneratingAi) setShowAiModal(false);
                }}
                title="AI 3-Tier Challenge Studio"
                description="Synthesize original Easy, Medium, and Hard coding puzzles referencing existing quizzes"
                maxWidth="max-w-4xl"
                icon={<Sparkles className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />}
                footer={
                    aiGeneratedPreview ? (
                        <div className="flex items-center justify-between w-full gap-3">
                            <button
                                onClick={() => setAiGeneratedPreview(null)}
                                disabled={isGeneratingAi}
                                className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec]'
                                        : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                                }`}
                            >
                                ← Edit Parameters
                            </button>
                            <button
                                onClick={handleConfirmSchedulePreview}
                                disabled={isGeneratingAi}
                                className={`px-7 py-3 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2 cursor-pointer ${
                                    isBento
                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                }`}
                            >
                                {isGeneratingAi ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                )}
                                Confirm & Schedule 3 Tiers to Calendar
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between w-full gap-3">
                            <button
                                onClick={() => setShowAiModal(false)}
                                disabled={isGeneratingAi}
                                className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec]'
                                        : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                                }`}
                            >
                                Cancel
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleGenerateAi(false)}
                                    disabled={isGeneratingAi}
                                    className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer ${
                                        isBento
                                            ? 'bg-[#bae6fd] hover:bg-sky-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#151e24] border border-[#bae6fd]/35 text-[#bae6fd] hover:bg-[#1b2830]'
                                    }`}
                                >
                                    {isGeneratingAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Code2 className="w-4 h-4" />}
                                    Preview 3 Tiers
                                </button>
                                <button
                                    onClick={() => handleGenerateAi(true)}
                                    disabled={isGeneratingAi}
                                    className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer ${
                                        isBento
                                            ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                            : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                    }`}
                                >
                                    {isGeneratingAi ? (
                                        <><RefreshCw className="w-4 h-4 animate-spin" /> Generating with AI...</>
                                    ) : (
                                        <><Sparkles className="w-4 h-4" /> Generate & Schedule</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )
                }
            >
                {aiGeneratedPreview ? (
                    /* Preview Mode */
                    <div className="space-y-5 animate-in fade-in duration-300">
                        {/* Reference Info Banner */}
                        <div className={`p-4 rounded-2xl flex items-center justify-between ${
                            isBento
                                ? 'bg-[#f5f3ec] border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-[#1a1714] border border-[#2e2924]'
                        }`}>
                            <div className="flex items-center gap-3">
                                <Sparkles className={`w-5 h-5 shrink-0 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                <div>
                                    <div className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#bef264]'}`}>
                                        Synthesized From: {aiGeneratedPreview.referenceTitle || 'General Question Pool'}
                                    </div>
                                    <div className={`text-[11px] ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                                        Language: <span className={`font-bold uppercase ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>{aiGeneratedPreview.language || selectedLanguage}</span> • Category: <span className={`font-bold ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>{aiGeneratedPreview.referenceCategory || 'Algorithms'}</span>
                                    </div>
                                </div>
                            </div>
                            <span className={`px-3 py-1 font-black text-xs rounded-xl ${
                                isBento
                                    ? 'bg-[#bef264] text-black border border-black'
                                    : 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/35'
                            }`}>
                                3 Levels Ready
                            </span>
                        </div>

                        {/* Tier Selector Tabs */}
                        <div className={`grid grid-cols-3 gap-2 p-1.5 rounded-2xl ${
                            isBento ? 'bg-[#f5f3ec] border-2 border-black' : 'bg-[#0e0d0b] border border-[#2e2924]'
                        }`}>
                            {(['easy', 'medium', 'hard'] as const).map(tierKey => {
                                const tierData = aiGeneratedPreview.tiers?.[tierKey];
                                const isActive = previewTierTab === tierKey;
                                const tierColor = isBento
                                    ? 'text-black'
                                    : tierKey === 'easy' ? 'text-[#bef264]' : tierKey === 'hard' ? 'text-[#fb7185]' : 'text-[#fde047]';
                                const activeBg = isBento
                                    ? tierKey === 'easy'
                                        ? 'bg-[#bef264] border-black text-black'
                                        : tierKey === 'hard'
                                            ? 'bg-[#fecdd3] border-black text-black'
                                            : 'bg-[#fde047] border-black text-black'
                                    : tierKey === 'easy'
                                        ? 'bg-[#1c2317] border-[#bef264]/45 text-[#f5f3ec]'
                                        : tierKey === 'hard'
                                            ? 'bg-[#251317] border-[#fb7185]/45 text-[#f5f3ec]'
                                            : 'bg-[#231f14] border-[#fde047]/45 text-[#f5f3ec]';

                                return (
                                    <button
                                        key={tierKey}
                                        onClick={() => setPreviewTierTab(tierKey)}
                                        className={`p-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex flex-col items-center gap-1 border cursor-pointer ${
                                            isActive
                                                ? activeBg
                                                : isBento
                                                    ? 'border-transparent text-neutral-700 hover:bg-white'
                                                    : 'border-transparent text-[#a8a29e] hover:text-[#f5f3ec]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${tierKey === 'easy' ? 'bg-[#bef264]' : tierKey === 'hard' ? 'bg-[#fb7185]' : 'bg-[#fde047]'}`} />
                                            <span className={tierColor}>{tierKey}</span>
                                        </div>
                                        <span className="text-[10px] font-bold opacity-75 truncate max-w-[120px]">
                                            {tierData?.title || 'Challenge'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Active Tier Preview Card */}
                        {(() => {
                            const curTier = aiGeneratedPreview.tiers?.[previewTierTab];
                            if (!curTier) return null;

                            return (
                                <div className={`space-y-4 p-5 rounded-2xl ${
                                    isBento
                                        ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-[#1a1714] border border-[#2e2924]'
                                }`}>
                                    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b ${isBento ? 'border-black/20' : 'border-[#2e2924]'}`}>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                    isBento
                                                        ? previewTierTab === 'easy' ? 'bg-[#bef264] text-black border border-black' :
                                                          previewTierTab === 'hard' ? 'bg-[#fecdd3] text-black border border-black' :
                                                          'bg-[#fde047] text-black border border-black'
                                                        : previewTierTab === 'easy' ? 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/35' :
                                                          previewTierTab === 'hard' ? 'bg-[#251317] text-[#fb7185] border border-[#fb7185]/35' :
                                                          'bg-[#231f14] text-[#fde047] border border-[#fde047]/35'
                                                }`}>
                                                    {previewTierTab} Level
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                    isBento ? 'bg-[#f5f3ec] text-black border border-black/30' : 'bg-[#0e0d0b] text-[#a8a29e] border border-[#2e2924]'
                                                }`}>
                                                    {curTier.category}
                                                </span>
                                            </div>
                                            <h3 className={`text-lg font-black ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                                {curTier.title}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                                                isBento
                                                    ? 'bg-[#fde047] text-black border border-black'
                                                    : 'bg-[#231f14] border border-[#fde047]/35 text-[#fde047]'
                                            }`}>
                                                <Gift className="w-3.5 h-3.5" /> {curTier.giftLabel || 'Loot Box'}
                                            </div>
                                            <div className={`text-xs font-bold ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                                                🪙 {curTier.rewardCoins} • ⚡ {curTier.rewardXP}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Problem Statement</label>
                                        <div className={`p-4 rounded-xl text-xs font-medium whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto ${
                                            isBento
                                                ? 'bg-[#f5f3ec] text-black border border-black/25'
                                                : 'bg-[#0e0d0b] text-[#d6d0c7] border border-[#2e2924]'
                                        }`}>
                                            {curTier.description}
                                        </div>
                                    </div>

                                    {/* Starter & Reference Code Preview */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Student Starter Stub</label>
                                            <pre className={`p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-36 overflow-y-auto ${
                                                isBento
                                                    ? 'bg-[#f5f3ec] text-black border border-black'
                                                    : 'bg-[#0e0d0b] text-[#bef264] border border-[#2e2924]'
                                            }`}>
                                                {curTier.starterCode || '// Starter code\n'}
                                            </pre>
                                        </div>
                                        <div>
                                            <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>AI Reference Solution</label>
                                            <pre className={`p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-36 overflow-y-auto ${
                                                isBento
                                                    ? 'bg-[#f5f3ec] text-black border border-black'
                                                    : 'bg-[#0e0d0b] text-[#bae6fd] border border-[#2e2924]'
                                            }`}>
                                                {curTier.referenceCode || '// Reference solution\n'}
                                            </pre>
                                        </div>
                                    </div>

                                    {/* Hints */}
                                    {curTier.hints && curTier.hints.length > 0 && (
                                        <div>
                                            <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Hints</label>
                                            <div className="space-y-1">
                                                {curTier.hints.map((hint: string, hIdx: number) => (
                                                    <div key={hIdx} className={`text-xs flex items-start gap-1.5 ${isBento ? 'text-neutral-800' : 'text-[#d6d0c7]'}`}>
                                                        <span className="text-[#fde047] shrink-0">💡</span>
                                                        <span>{hint}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    /* Configuration Form */
                    <div className="space-y-6">
                        {/* Target Date & Language */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={`text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                    <Calendar className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#bef264]'}`} /> Challenge Date
                                </label>
                                <input
                                    type="date"
                                    value={aiDate}
                                    onChange={e => setAiDate(e.target.value)}
                                    className={`w-full rounded-2xl px-4 py-3 text-sm font-bold outline-none ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec]'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className={`text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                    <Code2 className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} /> Programming Language
                                </label>
                                <select
                                    value={selectedLanguage}
                                    onChange={e => setSelectedLanguage(e.target.value)}
                                    className={`w-full rounded-2xl px-4 py-3 text-sm font-bold outline-none cursor-pointer ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec]'
                                    }`}
                                >
                                    <option value="javascript">JavaScript (ES6+)</option>
                                    <option value="python">Python 3</option>
                                    <option value="typescript">TypeScript</option>
                                </select>
                            </div>
                        </div>

                        {/* Reference Quiz Selector */}
                        <div>
                            <label className={`text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                <Sparkles className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#fde047]'}`} /> Reference Quiz Inspiration
                            </label>
                            <p className={`text-[11px] mb-2 font-medium ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                                AI inspects the selected quiz's questions, concepts, and explanations to synthesize completely new coding problems.
                            </p>
                            <select
                                value={selectedQuizId}
                                onChange={e => setSelectedQuizId(e.target.value)}
                                className={`w-full rounded-2xl px-4 py-3 text-sm font-bold outline-none cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec]'
                                }`}
                            >
                                <option value="random">🎲 Randomly Sample Existing Quizzes (Recommended)</option>
                                {quizzes.map(q => (
                                    <option key={q.id || q._id} value={q.id || q._id}>
                                        {q.title} ({q.category} • {q.difficulty})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Custom Topic / Admin Instructions */}
                        <div>
                            <label className={`text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                <Bot className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#fb7185]'}`} /> Custom Concept or Focus (Optional)
                            </label>
                            <input
                                type="text"
                                value={customTopic}
                                onChange={e => setCustomTopic(e.target.value)}
                                placeholder="e.g. Array manipulation, anagram detection, string reversal, recursion..."
                                className={`w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                                }`}
                            />
                        </div>

                        {/* 3 Distinct Tiers & Gifts Configuration */}
                        <div>
                            <label className={`text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                <Gift className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#bef264]'}`} /> Configure 3 Tiers & Distinct Gifts
                            </label>
                            <p className={`text-[11px] mb-3 font-medium ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                                Each difficulty level awards its own distinct gift and rewards. Users can solve all 3 levels every day.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Easy Tier Card */}
                                <div className={`p-4 rounded-2xl space-y-3 ${
                                    isBento
                                        ? 'bg-[#dcfce7] border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-[#171d14] border border-[#bef264]/35'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                            isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-[#bef264] text-[#0a0908]'
                                        }`}>
                                            Easy Tier
                                        </span>
                                        <span className={`text-[10px] font-bold ${isBento ? 'text-black' : 'text-[#bef264]'}`}>Warm-up</span>
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black/75' : 'text-[#a8a29e]'}`}>Gift Title</label>
                                        <input
                                            type="text"
                                            value={tierRewards.easy.giftLabel}
                                            onChange={e => setTierRewards({ ...tierRewards, easy: { ...tierRewards.easy, giftLabel: e.target.value } })}
                                            className={`w-full rounded-xl px-3 py-2 text-xs font-bold outline-none ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black'
                                                    : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec]'
                                            }`}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className={`block text-[10px] font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black/75' : 'text-[#a8a29e]'}`}>🪙 Coins</label>
                                            <input
                                                type="number"
                                                value={tierRewards.easy.coins}
                                                onChange={e => setTierRewards({ ...tierRewards, easy: { ...tierRewards.easy, coins: parseInt(e.target.value) || 0 } })}
                                                className={`w-full rounded-xl px-3 py-2 text-xs font-black outline-none ${
                                                    isBento
                                                        ? 'bg-white text-black border-2 border-black'
                                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec]'
                                                }`}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className={`block text-[10px] font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black/75' : 'text-[#a8a29e]'}`}>⚡ XP</label>
                                            <input
                                                type="number"
                                                value={tierRewards.easy.xp}
                                                onChange={e => setTierRewards({ ...tierRewards, easy: { ...tierRewards.easy, xp: parseInt(e.target.value) || 0 } })}
                                                className={`w-full rounded-xl px-3 py-2 text-xs font-black outline-none ${
                                                    isBento
                                                        ? 'bg-white text-black border-2 border-black'
                                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec]'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Medium Tier Card */}
                                <div className={`p-4 rounded-2xl space-y-3 ${
                                    isBento
                                        ? 'bg-[#fef08a] border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-[#231f14] border border-[#fde047]/35'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                            isBento ? 'bg-black text-[#fde047]' : 'bg-[#fde047] text-[#0a0908]'
                                        }`}>
                                            Medium Tier
                                        </span>
                                        <span className={`text-[10px] font-bold ${isBento ? 'text-black' : 'text-[#fde047]'}`}>Core</span>
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black/75' : 'text-[#a8a29e]'}`}>Gift Title</label>
                                        <input
                                            type="text"
                                            value={tierRewards.medium.giftLabel}
                                            onChange={e => setTierRewards({ ...tierRewards, medium: { ...tierRewards.medium, giftLabel: e.target.value } })}
                                            className={`w-full rounded-xl px-3 py-2 text-xs font-bold outline-none ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black'
                                                    : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec]'
                                            }`}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className={`block text-[10px] font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black/75' : 'text-[#a8a29e]'}`}>🪙 Coins</label>
                                            <input
                                                type="number"
                                                value={tierRewards.medium.coins}
                                                onChange={e => setTierRewards({ ...tierRewards, medium: { ...tierRewards.medium, coins: parseInt(e.target.value) || 0 } })}
                                                className={`w-full rounded-xl px-3 py-2 text-xs font-black outline-none ${
                                                    isBento
                                                        ? 'bg-white text-black border-2 border-black'
                                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec]'
                                                }`}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className={`block text-[10px] font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black/75' : 'text-[#a8a29e]'}`}>⚡ XP</label>
                                            <input
                                                type="number"
                                                value={tierRewards.medium.xp}
                                                onChange={e => setTierRewards({ ...tierRewards, medium: { ...tierRewards.medium, xp: parseInt(e.target.value) || 0 } })}
                                                className={`w-full rounded-xl px-3 py-2 text-xs font-black outline-none ${
                                                    isBento
                                                        ? 'bg-white text-black border-2 border-black'
                                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec]'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Hard Tier Card */}
                                <div className={`p-4 rounded-2xl space-y-3 ${
                                    isBento
                                        ? 'bg-[#fecdd3] border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-[#251317] border border-[#fb7185]/35'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                            isBento ? 'bg-black text-[#fecdd3]' : 'bg-[#fb7185] text-[#0a0908]'
                                        }`}>
                                            Hard Tier
                                        </span>
                                        <span className={`text-[10px] font-bold ${isBento ? 'text-black' : 'text-[#fb7185]'}`}>Grandmaster</span>
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black/75' : 'text-[#a8a29e]'}`}>Gift Title</label>
                                        <input
                                            type="text"
                                            value={tierRewards.hard.giftLabel}
                                            onChange={e => setTierRewards({ ...tierRewards, hard: { ...tierRewards.hard, giftLabel: e.target.value } })}
                                            className={`w-full rounded-xl px-3 py-2 text-xs font-bold outline-none ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black'
                                                    : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec]'
                                            }`}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className={`block text-[10px] font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black/75' : 'text-[#a8a29e]'}`}>🪙 Coins</label>
                                            <input
                                                type="number"
                                                value={tierRewards.hard.coins}
                                                onChange={e => setTierRewards({ ...tierRewards, hard: { ...tierRewards.hard, coins: parseInt(e.target.value) || 0 } })}
                                                className={`w-full rounded-xl px-3 py-2 text-xs font-black outline-none ${
                                                    isBento
                                                        ? 'bg-white text-black border-2 border-black'
                                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec]'
                                                }`}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className={`block text-[10px] font-black uppercase tracking-wider mb-1 ${isBento ? 'text-black/75' : 'text-[#a8a29e]'}`}>⚡ XP</label>
                                            <input
                                                type="number"
                                                value={tierRewards.hard.xp}
                                                onChange={e => setTierRewards({ ...tierRewards, hard: { ...tierRewards.hard, xp: parseInt(e.target.value) || 0 } })}
                                                className={`w-full rounded-xl px-3 py-2 text-xs font-black outline-none ${
                                                    isBento
                                                        ? 'bg-white text-black border-2 border-black'
                                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec]'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default DailyChallengeManagement;
