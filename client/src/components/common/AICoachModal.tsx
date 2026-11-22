import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, Sparkles, X, Lightbulb, RefreshCw } from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import { api } from '../../lib/api';
import { sounds } from '../../lib/soundEffects';
import { useTheme } from '../../context/ThemeContext';

interface AICoachModalProps {
    isOpen: boolean;
    question: string;
    options?: string[];
    category?: string;
    onClose: () => void;
}

const LOCAL_FALLBACKS = [
    '💡 Big Picture Clue: Break down the core objective of the question and think about what makes the right answer fundamentally distinct.',
    '🔍 Mechanical Clue: Pay attention to how the concepts interact. Eliminate options that violate key structural or syntax rules.',
    '🎯 Process of Elimination: Rule out answers that only meet part of the criteria. The correct answer satisfies every constraint stated.',
    '⚡ Key Distinction: Re-read the specific keywords in the prompt. One option aligns precisely with that exact definition.',
    '🧠 Deep Perspective: Contrast the remaining two closest options against the core domain definition.'
];

export const AICoachModal: React.FC<AICoachModalProps> = ({
    isOpen,
    question,
    options,
    category,
    onClose
}) => {
    const { isBento } = useTheme();
    const [hint, setHint] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [clueLevel, setClueLevel] = useState<number>(1);
    const [clueHistory, setClueHistory] = useState<string[]>([]);
    const lastQuestionRef = useRef(question);

    const fetchHint = useCallback(async (targetLevel = 1, priorHints: string[] = []) => {
        setIsLoading(true);
        sounds.playPowerUp();
        try {
            const res = await api.getAICoachHint({
                question,
                options,
                category,
                clueLevel: targetLevel,
                previousHints: priorHints
            });
            if (res.success && res.hint) {
                setHint(res.hint);
            } else {
                const idx = (targetLevel - 1) % LOCAL_FALLBACKS.length;
                setHint(LOCAL_FALLBACKS[idx]);
            }
        } catch (err) {
            console.error('Failed to get AI Coach hint:', err);
            const idx = (targetLevel - 1) % LOCAL_FALLBACKS.length;
            setHint(LOCAL_FALLBACKS[idx]);
        } finally {
            setIsLoading(false);
        }
    }, [question, options, category]);

    // Reset when modal opens or question changes
    useEffect(() => {
        if (isOpen) {
            if (lastQuestionRef.current !== question) {
                lastQuestionRef.current = question;
                setClueLevel(1);
                setClueHistory([]);
                fetchHint(1, []);
            } else if (!hint) {
                setClueLevel(1);
                setClueHistory([]);
                fetchHint(1, []);
            }
        } else {
            lastQuestionRef.current = question;
        }
    }, [isOpen, question, fetchHint, hint]);

    const handleNextClue = () => {
        if (isLoading) return;
        const nextLevel = clueLevel + 1;
        const updatedHistory = hint ? [...clueHistory, hint] : clueHistory;
        setClueLevel(nextLevel);
        setClueHistory(updatedHistory);
        fetchHint(nextLevel, updatedHistory);
    };

    if (!isOpen) return null;

    const getClueTitle = (level: number) => {
        switch (level) {
            case 1: return 'Clue 1: Conceptual Foundation';
            case 2: return 'Clue 2: Behavioral Mechanics';
            case 3: return 'Clue 3: Process of Elimination';
            case 4: return 'Clue 4: Deep Insight';
            default: return `Clue ${level}: Targeted Guidance`;
        }
    };

    return (
        <div className={`app-dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 ${
            isBento ? 'bg-black/55 backdrop-blur-sm' : 'bg-[#050504]/82'
        }`}>
            <div className={`app-dialog-panel app-dialog-panel--padded relative w-full max-w-lg p-6 sm:p-8 space-y-5 overflow-hidden transition-all ${
                isBento
                    ? 'bg-white text-black rounded-2xl border-[3px] border-black shadow-[8px_8px_0px_#000]'
                    : 'bg-[#141210] text-[#f5f3ec] rounded-2xl border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504]'
            }`}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            isBento
                                ? 'bg-[#bef264] border-2 border-black text-black shadow-[3px_3px_0px_#000]'
                                : 'bg-[#bef264]/15 border border-[#bef264]/40 text-[#bef264]'
                        }`}>
                            <Bot className="w-6 h-6" />
                        </div>
                        <div>
                            <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${
                                isBento ? 'text-black/70' : 'text-[#fde047]'
                            }`}>
                                <Sparkles className="w-3 h-3" />
                                Socratic AI Tutor
                            </div>
                            <h3 className={`text-lg font-black uppercase tracking-tight ${
                                isBento ? 'text-black' : 'text-[#f5f3ec]'
                            }`}>
                                AI Study Coach Hint
                            </h3>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className={`p-2 rounded-xl transition cursor-pointer ${
                            isBento
                                ? 'border-2 border-black bg-white hover:bg-[#fed7aa] text-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                : 'bg-[#1c1917] border border-[#2e2924] hover:border-[#bef264] text-[#a8a29e] hover:text-[#f5f3ec]'
                        }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Question Preview Box */}
                <div className={`p-4 rounded-2xl text-xs max-h-24 overflow-y-auto ${
                    isBento
                        ? 'bg-[#f5f3ec] border-2 border-black text-black'
                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#d6d0c7]'
                }`}>
                    <span className={`font-black uppercase text-[9px] block mb-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Current Question:</span>
                    <MathRenderer text={question} />
                </div>

                {/* AI Hint Card */}
                <div className={`p-6 rounded-2xl space-y-3 ${
                    isBento
                        ? 'bg-[#fef08a] border-2 border-black shadow-[4px_4px_0px_#000]'
                        : 'bg-[#1e1b13] border border-[#fde047]/35'
                }`}>
                    <div className={`flex items-center justify-between text-xs font-black uppercase tracking-wider ${
                        isBento ? 'text-black' : 'text-[#fde047]'
                    }`}>
                        <span className="flex items-center gap-1.5">
                            <Lightbulb className={`w-4 h-4 animate-pulse ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                            {getClueTitle(clueLevel)}
                        </span>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4].map((step) => (
                                <span
                                    key={step}
                                    title={`Clue level ${step}`}
                                    className={`w-2 h-2 rounded-full transition-all ${
                                        clueLevel >= step
                                            ? isBento ? 'bg-black scale-110' : 'bg-[#fde047] scale-110'
                                            : isBento ? 'bg-black/20' : 'bg-[#3a342e]'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className={`py-6 flex flex-col items-center justify-center gap-2 text-xs font-bold ${
                            isBento ? 'text-black' : 'text-[#a8a29e]'
                        }`}>
                            <RefreshCw className={`w-5 h-5 animate-spin ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                            <span>Formulating Clue #{clueLevel} from a new angle...</span>
                        </div>
                    ) : (
                        <div className={`text-sm sm:text-base leading-relaxed ${
                            isBento ? 'font-bold text-black' : 'font-medium text-[#f5f3ec]'
                        }`}>
                            <MathRenderer text={hint || ''} />
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleNextClue}
                        disabled={isLoading}
                        className={`px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50 ${
                            isBento
                                ? 'bg-white hover:bg-[#bae6fd] border-2 border-black text-black font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                : 'bg-[#1c1917] hover:bg-[#24201c] border border-[#2e2924] hover:border-[#bae6fd] font-black text-[#f5f3ec]'
                        }`}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Another Clue</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                            isBento ? 'bg-black/10 text-black' : 'bg-[#0e0d0b] border border-[#2e2924] text-[#bae6fd]'
                        }`}>
                            #{clueLevel + 1}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer ${
                            isBento
                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                        }`}
                    >
                        Got It, Let Me Answer!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AICoachModal;
