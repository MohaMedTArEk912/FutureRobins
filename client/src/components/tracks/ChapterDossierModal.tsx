import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { SkillModule, BadgeNode } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import {
    Sparkles,
    CheckCircle2,
    Lock,
    Play,
    Award,
    Clock,
    Zap,
    Trophy,
    Shield,
    BookOpen,
    ArrowRight
} from 'lucide-react';
import Modal from '../common/Modal';
import { getChapterStoryLore, type ChapterLore } from './storyLoreData';
import { sounds } from '../../lib/soundEffects';

interface ChapterDossierModalProps {
    isOpen: boolean;
    onClose: () => void;
    moduleNode: {
        module: SkillModule;
        badges: BadgeNode[];
        isCompleted: boolean;
        isLocked: boolean;
    } | null;
    chapterIndex: number;
    totalChapters: number;
    trackTitle: string;
    trackCategory: string;
    onCompleteChapter: (moduleId: string, moduleName: string) => void;
    isCompleting: boolean;
}

export const ChapterDossierModal: React.FC<ChapterDossierModalProps> = ({
    isOpen,
    onClose,
    moduleNode,
    chapterIndex,
    totalChapters,
    trackTitle,
    trackCategory,
    onCompleteChapter,
    isCompleting
}) => {
    const { isBento } = useTheme();
    const navigate = useNavigate();

    if (!moduleNode) return null;

    const { module, badges, isCompleted, isLocked } = moduleNode;
    const lore: ChapterLore = getChapterStoryLore(
        module.title,
        chapterIndex,
        totalChapters,
        trackCategory
    );

    const quizzes = module.quizIds || [];
    const submodules = module.subModules || [];

    const handleLaunchQuiz = (quizId: string) => {
        sounds.playClick();
        onClose();
        navigate(`/quiz/${encodeURIComponent(quizId)}`);
    };

    const handleClaimReward = () => {
        sounds.playPowerUp();
        onCompleteChapter(module.moduleId, module.title);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={lore.storyTitle}
            description={`${trackTitle} • ${lore.actTitle}`}
            maxWidth="max-w-2xl"
            icon={
                <div className={`p-2 rounded-xl flex items-center justify-center ${
                    isCompleted
                        ? isBento ? 'bg-[#bef264] text-black border-2 border-black' : 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/35'
                        : isLocked
                            ? isBento ? 'bg-[#f5f3ec] text-black border-2 border-black' : 'bg-[#1a1714] text-[#78716c] border border-[#2e2924]'
                            : isBento ? 'bg-[#fde047] text-black border-2 border-black' : 'bg-[#231f14] text-[#fde047] border border-[#fde047]/35'
                }`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : isLocked ? <Lock className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
            }
        >
            <div className="space-y-6 text-sm">
                {/* Epigraph & Chapter Banner */}
                <div className={`p-4 sm:p-5 rounded-2xl relative overflow-hidden transition-all ${
                    isBento
                        ? 'bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-black'
                        : lore.isBossTrial
                            ? 'bg-[#231f14] border border-[#fde047]/35'
                            : 'bg-[#1a1714] border border-[#2e2924]'
                }`}>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                            isBento
                                ? 'bg-black text-[#bef264]'
                                : 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/30'
                        }`}>
                            Chapter {lore.chapterNumber} of {totalChapters}
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                            <span className={`flex items-center gap-1 font-semibold ${isBento ? 'text-black/70' : 'text-[#a8a29e]'}`}>
                                <Clock className="w-3.5 h-3.5" />
                                {lore.recommendedTime}
                            </span>
                            <span className={`flex items-center gap-1 font-black ${
                                isBento ? 'text-black' : 'text-[#fde047]'
                            }`}>
                                <Zap className="w-3.5 h-3.5" />
                                +{module.xpReward || 120} XP
                            </span>
                        </div>
                    </div>

                    <h3 className={`text-base sm:text-lg font-black tracking-tight mb-2 ${
                        isBento ? 'text-black font-mono' : 'text-[#f5f3ec]'
                    }`}>
                        {lore.isBossTrial && lore.bossName ? `⚔️ ${lore.bossName}` : module.title}
                    </h3>

                    <p className={`text-xs sm:text-sm leading-relaxed mb-3 ${
                        isBento ? 'text-neutral-800' : 'text-[#d6d0c7]'
                    }`}>
                        {module.description || lore.narrative}
                    </p>

                    {/* Narrative Lore Quote */}
                    <div className={`p-3 rounded-xl border text-xs italic ${
                        isBento
                            ? 'bg-[#fef9c3] border-black/25 text-black'
                            : 'bg-[#0e0d0b] border-[#2e2924] text-[#a8a29e]'
                    }`}>
                        {lore.flavorQuote}
                    </div>
                </div>

                {/* Key Knowledge Scrolls / Concepts */}
                <div>
                    <h4 className={`text-xs font-black uppercase tracking-wider mb-2.5 flex items-center gap-2 ${
                        isBento ? 'text-black font-mono' : 'text-[#f5f3ec]'
                    }`}>
                        <BookOpen className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                        Key Competencies & Wisdom
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {lore.keySkills.map((skill, sIdx) => (
                            <span
                                key={sIdx}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border border-black shadow-[1.5px_1.5px_0px_#000]'
                                        : 'bg-[#1a1714] text-[#d6d0c7] border border-[#2e2924]'
                                }`}
                            >
                                ✦ {skill}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Associated Quizzes & Practice Gauntlets */}
                {quizzes.length > 0 && (
                    <div>
                        <h4 className={`text-xs font-black uppercase tracking-wider mb-2.5 flex items-center gap-2 ${
                            isBento ? 'text-black font-mono' : 'text-[#f5f3ec]'
                        }`}>
                            <Trophy className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                            Chapter Quizzes & Challenges ({quizzes.length})
                        </h4>
                        <div className="space-y-2">
                            {quizzes.map((quizId, qIdx) => {
                                const cleanQuizTitle = quizId
                                    .replace(/-[a-f0-9]{8}$/i, '')
                                    .replace(/-/g, ' ')
                                    .replace(/\b\w/g, l => l.toUpperCase());

                                return (
                                    <div
                                        key={qIdx}
                                        className={`p-3 sm:p-3.5 rounded-xl flex items-center justify-between gap-3 transition-all ${
                                            isBento
                                                ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#1a1714] border border-[#2e2924] hover:border-[#bef264]/60'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                isBento
                                                    ? 'bg-[#fde047] text-black border border-black'
                                                    : 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/25'
                                            }`}>
                                                <Play className="w-4 h-4" />
                                            </div>
                                            <div className="truncate">
                                                <p className={`font-bold text-xs sm:text-sm truncate ${
                                                    isBento ? 'text-black' : 'text-[#f5f3ec]'
                                                }`}>
                                                    {cleanQuizTitle}
                                                </p>
                                                <span className={`text-[11px] ${isBento ? 'text-neutral-600' : 'text-[#a8a29e]'}`}>
                                                    Challenge #{qIdx + 1}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleLaunchQuiz(quizId)}
                                            className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                                isBento
                                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5'
                                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                            }`}
                                        >
                                            <span>Play</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Submodules / Lessons */}
                {submodules.length > 0 && (
                    <div>
                        <h4 className={`text-xs font-black uppercase tracking-wider mb-2.5 flex items-center gap-2 ${
                            isBento ? 'text-black font-mono' : 'text-[#f5f3ec]'
                        }`}>
                            <Shield className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                            Lesson Milestones ({submodules.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {submodules.map((sub, sIdx) => (
                                <div
                                    key={sIdx}
                                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                                        isBento
                                            ? 'bg-white border-black/25 text-black'
                                            : 'bg-[#1a1714] border-[#2e2924] text-[#d6d0c7]'
                                    }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isBento ? 'bg-black' : 'bg-[#bef264]'}`} />
                                    <span className="truncate">{sub.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Badges / Unlocks */}
                {badges.length > 0 && (
                    <div>
                        <h4 className={`text-xs font-black uppercase tracking-wider mb-2.5 flex items-center gap-2 ${
                            isBento ? 'text-black font-mono' : 'text-[#f5f3ec]'
                        }`}>
                            <Award className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} />
                            Associated Credentials & Relics
                        </h4>
                        <div className="flex flex-wrap gap-2.5">
                            {badges.map((badge, bIdx) => (
                                <div
                                    key={bIdx}
                                    className={`p-2 rounded-xl flex items-center gap-2 border text-xs font-bold ${
                                        isBento
                                            ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                                            : 'bg-[#151e24] border-[#bae6fd]/30 text-[#bae6fd]'
                                    }`}
                                >
                                    <Award className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} />
                                    <span>{badge.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action Controls */}
                <div className={`pt-4 border-t flex items-center justify-between flex-wrap gap-3 ${isBento ? 'border-black/20' : 'border-[#2e2924]'}`}>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                            isBento
                                ? 'bg-white border-2 border-black text-black hover:bg-[#f5f3ec]'
                                : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                        }`}
                    >
                        Close Dossier
                    </button>

                    {isLocked ? (
                        <div className={`flex items-center gap-2 text-xs font-bold ${isBento ? 'text-black' : 'text-[#fde047]'}`}>
                            <Lock className="w-4 h-4" />
                            <span>Complete previous chapters to unlock</span>
                        </div>
                    ) : isCompleted ? (
                        <div className="flex items-center gap-2">
                            <span className={`flex items-center gap-1.5 text-xs font-black ${isBento ? 'text-black' : 'text-[#bef264]'}`}>
                                <CheckCircle2 className="w-4 h-4" />
                                Chapter Mastered
                            </span>
                            <button
                                type="button"
                                onClick={handleClaimReward}
                                disabled={isCompleting}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5'
                                        : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                }`}
                            >
                                Re-verify Mastery
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleClaimReward}
                            disabled={isCompleting}
                            className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] active:scale-[0.98]'
                            }`}
                        >
                            <Sparkles className="w-4 h-4" />
                            <span>{isCompleting ? 'Claiming Wisdom...' : `Complete Quest (+${module.xpReward || 120} XP)`}</span>
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};
