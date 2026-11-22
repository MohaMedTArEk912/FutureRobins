import React, { useState } from 'react';
import { X, Search, Clock, Trophy } from 'lucide-react';
import type { Quiz } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface QuizSelectionModalProps {
    quizzes: Quiz[];
    isOpen: boolean;
    onClose: () => void;
    onSelect: (quizId: string) => void;
    title?: string;
}

const QuizSelectionModal: React.FC<QuizSelectionModalProps> = ({ quizzes, isOpen, onClose, onSelect, title = 'Select a Quiz' }) => {
    const { isBento } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');

    if (!isOpen) return null;

    const filteredQuizzes = (Array.isArray(quizzes) ? quizzes : []).filter(q => {
        if (!q) return false;
        const term = (searchTerm || '').toLowerCase();
        const quizTitle = (q.title || '').toLowerCase();
        const category = (q.category || '').toLowerCase();
        return quizTitle.includes(term) || category.includes(term);
    });

    return (
        <div
            className="app-dialog-overlay fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                className={`app-dialog-panel app-dialog-panel--structured rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden relative ${
                    isBento
                        ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                        : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504,0_24px_60px_rgba(0,0,0,0.78)]'
                }`}
            >
                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close quiz selector"
                    className={`absolute top-4 right-4 p-2 rounded-xl transition-all z-10 cursor-pointer ${
                        isBento
                            ? 'border-2 border-black bg-white hover:bg-[#fed7aa] text-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                            : 'bg-[#141210] border border-[#2e2924] hover:border-[#bef264]/50 text-[#a8a29e] hover:text-[#f5f3ec]'
                    }`}
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div
                    className={`app-dialog-header p-6 border-b ${
                        isBento
                            ? 'bg-[#fde047] border-b-[2.5px] border-black'
                            : 'bg-[#1a1714] border-[#2e2924]'
                    }`}
                >
                    <h2 className={`text-2xl font-black mb-1 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>{title}</h2>
                    <p className={`text-sm ${isBento ? 'text-black/80 font-bold' : 'text-[#a8a29e]'}`}>
                        Choose the battlefield for your challenge.
                    </p>
                </div>

                {/* Search */}
                <div
                    className={`app-dialog-toolbar p-4 border-b ${
                        isBento
                            ? 'border-b-[2.5px] border-black bg-[#f5f3ec]'
                            : 'border-[#2e2924] bg-[#161411]'
                    }`}
                >
                    <div className="relative">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isBento ? 'text-black' : 'text-[#78716c]'}`} />
                        <input
                            type="text"
                            placeholder="Search quizzes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full pl-12 pr-4 py-3 rounded-xl transition-all outline-none ${
                                isBento
                                    ? 'border-2 border-black bg-white text-black font-medium shadow-[2px_2px_0px_#000] placeholder-gray-500'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder-[#78716c]'
                            }`}
                        />
                    </div>
                </div>

                {/* Quiz Grid */}
                <div className="app-dialog-body app-dialog-body-spaced flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {filteredQuizzes.map(quiz => (
                            <button
                                type="button"
                                key={quiz.id || quiz._id}
                                onClick={() => onSelect(quiz.id || quiz._id!)}
                                className={`group relative flex flex-col p-4 rounded-2xl transition-all text-left cursor-pointer ${
                                    isBento
                                        ? 'bg-[#f5f3ec] border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5'
                                        : 'bg-[#1a1714] hover:bg-[#221e1a] border border-[#2e2924] hover:border-[#bef264]/70'
                                }`}
                            >
                                <div className="flex items-start justify-between mb-3 w-full">
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                                            isBento
                                                ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#141210] border border-[#2e2924] text-[#bef264]'
                                        }`}
                                    >
                                        {quiz.icon || '📝'}
                                    </div>
                                    <div
                                        className={`px-2 py-1 rounded-lg text-xs uppercase tracking-wider ${
                                            isBento
                                                ? 'bg-[#bef264] text-black font-black border border-black shadow-[1px_1px_0px_#000]'
                                                : 'bg-[#24201c] border border-[#3a332c] font-bold text-[#fde047]'
                                        }`}
                                    >
                                        {quiz.difficulty}
                                    </div>
                                </div>
                                <h3
                                    className={`line-clamp-1 mb-1 transition-colors ${
                                        isBento
                                            ? 'font-black text-black'
                                            : 'font-bold text-[#f5f3ec] group-hover:text-[#bef264]'
                                    }`}
                                >
                                    {quiz.title}
                                </h3>
                                <div
                                    className={`text-xs flex items-center gap-3 mt-auto ${
                                        isBento ? 'text-gray-700 font-bold' : 'text-[#a8a29e]'
                                    }`}
                                >
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Math.ceil((quiz.timeLimit || 0) / 60)}m</span>
                                    <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> {quiz.questions?.length || 0} Qs</span>
                                </div>
                            </button>
                        ))}
                    </div>
                    {filteredQuizzes.length === 0 && (
                        <div className={`text-center py-12 ${isBento ? 'text-gray-700 font-bold' : 'text-[#a8a29e]'}`}>
                            No quizzes found matching your search.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuizSelectionModal;
