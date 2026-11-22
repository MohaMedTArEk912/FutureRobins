import React, { useState, useEffect } from 'react';
import { 
    Edit2, 
    Trash2, 
    Sparkles, 
    Check, 
    Plus, 
    Clock, 
    Target, 
    Coins, 
    Zap, 
    Type, 
    FileText, 
    Folder, 
    Sliders,
    Layers,
    Eye,
    CheckSquare,
    Square,
    X
} from 'lucide-react';
import Modal from '../common/Modal';
import ConfirmDialog from '../ConfirmDialog';
import QuestionEditor from './QuestionEditor';
import type { Quiz, Question, Subject } from '../../types';
import { DIFFICULTY_LEVELS } from '../../constants/quizDefaults';
import { QUIZ_ICON_OPTIONS, getQuizIconOption, DEFAULT_QUIZ_ICON } from '../../utils/quizIcons';
import { useTheme } from '../../context/ThemeContext';

interface QuizEditorModalProps {
    isOpen: boolean;
    quiz: Quiz | null;
    subjects: Subject[];
    onClose: () => void;
    onSave: (quiz: Quiz) => void;
    onNotification: (type: 'success' | 'error' | 'warning', message: string) => void;
}

const QuizEditorModal: React.FC<QuizEditorModalProps> = ({ 
    isOpen, 
    quiz, 
    subjects, 
    onClose, 
    onSave, 
    onNotification 
}) => {
    const { isBento } = useTheme();
    const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
    const [activeModalTab, setActiveModalTab] = useState<'general' | 'questions'>('general');
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

    // Question Selection & Bulk Edit States
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
    const [isBulkDeleteQuestionsOpen, setIsBulkDeleteQuestionsOpen] = useState(false);
    const [isBulkEditQuestionsOpen, setIsBulkEditQuestionsOpen] = useState(false);
    const [bulkQuestionPoints, setBulkQuestionPoints] = useState(10);
    const [bulkQuestionPart, setBulkQuestionPart] = useState('A');
    const [bulkQuestionType, setBulkQuestionType] = useState<'multiple-choice' | 'text' | 'code-output' | 'ordering' | 'matching'>('multiple-choice');
    const [enableBulkPoints, setEnableBulkPoints] = useState(false);
    const [enableBulkPart, setEnableBulkPart] = useState(false);
    const [enableBulkType, setEnableBulkType] = useState(false);

    useEffect(() => {
        if (quiz) {
            setEditingQuiz({
                ...quiz,
                shuffleQuestions: true,
                icon: quiz.icon || DEFAULT_QUIZ_ICON,
                questions: (quiz.questions || []).map(q => ({ ...q, shuffleOptions: true }))
            });
            setActiveModalTab('general');
            setEditingQuestion(null);
            setSelectedQuestionIds([]);
        }
    }, [quiz]);

    if (!editingQuiz) return null;

    const handleSaveQuiz = () => {
        if (!editingQuiz) return;

        // Validation
        if (!editingQuiz.title?.trim() || !editingQuiz.description?.trim()) {
            onNotification('error', 'Title and Description are required');
            return;
        }
        if (editingQuiz.timeLimit < 0) {
            onNotification('error', 'Time limit cannot be negative');
            return;
        }
        if (!editingQuiz.questions || editingQuiz.questions.length === 0) {
            onNotification('error', 'Quiz must have at least one question');
            return;
        }
        // Check for missing reference codes in compiler questions
        const missingRef = editingQuiz.questions?.find(q => q.isCompiler && (!q.compilerConfig?.referenceCode || !q.compilerConfig.referenceCode.trim()));
        if (missingRef) {
            onNotification('error', `Question "${missingRef.question}" is missing a reference answer code.`);
            return;
        }

        // Check ordering questions
        const invalidOrdering = editingQuiz.questions?.find(q => q.type === 'ordering' && (!q.orderingItems || q.orderingItems.length < 2 || q.orderingItems.some(item => !item.trim())));
        if (invalidOrdering) {
            onNotification('error', `Ordering question "${invalidOrdering.question || 'Untitled'}" must have at least 2 non-empty sequence steps.`);
            return;
        }

        // Check matching questions
        const invalidMatching = editingQuiz.questions?.find(q => q.type === 'matching' && (!q.matchingPairs || q.matchingPairs.length < 2 || q.matchingPairs.some(p => !p.left?.trim() || !p.right?.trim())));
        if (invalidMatching) {
            onNotification('error', `Matching question "${invalidMatching.question || 'Untitled'}" must have at least 2 complete pairs.`);
            return;
        }

        // Check code output questions
        const invalidCodeOutput = editingQuiz.questions?.find(q => q.type === 'code-output' && (!q.codeSnippet?.trim() || q.correctAnswer === undefined || String(q.correctAnswer).trim() === ''));
        if (invalidCodeOutput) {
            onNotification('error', `Code output question "${invalidCodeOutput.question || 'Untitled'}" must include both a code snippet and correct answer.`);
            return;
        }

        // Check short answer questions
        const invalidText = editingQuiz.questions?.find(q => q.type === 'text' && !q.isCompiler && (q.correctAnswer === undefined || String(q.correctAnswer).trim() === ''));
        if (invalidText) {
            onNotification('error', `Short answer question "${invalidText.question || 'Untitled'}" must have a correct answer specified.`);
            return;
        }

        onSave({
            ...editingQuiz,
            shuffleQuestions: true,
            questions: (editingQuiz.questions || []).map(q => ({ ...q, shuffleOptions: true }))
        });
    };

    const handleQuestionUpdate = (updatedQuestion: Question) => {
        if (!editingQuiz) return;
        const newQuestions = (editingQuiz.questions || []).map(q =>
            q.id === updatedQuestion.id ? updatedQuestion : q
        );
        setEditingQuiz({ ...editingQuiz, questions: newQuestions });
        setEditingQuestion(null);
    };

    const handleAddQuestion = (newQuestion: Question) => {
        if (!editingQuiz) return;
        setEditingQuiz({
            ...editingQuiz,
            questions: [...(editingQuiz.questions || []), newQuestion]
        });
        setEditingQuestion(null);
    };

    const handleDeleteQuestion = (questionId: number) => {
        if (!editingQuiz) return;
        setEditingQuiz({
            ...editingQuiz,
            questions: (editingQuiz.questions || []).filter(q => q.id !== questionId)
        });
        setSelectedQuestionIds(prev => prev.filter(id => id !== questionId));
    };

    // Question Multi-Selection Handlers
    const handleToggleSelectQuestion = (qId: number) => {
        setSelectedQuestionIds(prev =>
            prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
        );
    };

    const handleSelectAllQuestions = () => {
        const allIds = (editingQuiz?.questions || []).map(q => q.id);
        const allSelected = allIds.length > 0 && allIds.every(id => selectedQuestionIds.includes(id));
        if (allSelected) {
            setSelectedQuestionIds([]);
        } else {
            setSelectedQuestionIds(allIds);
        }
    };

    const confirmBulkDeleteQuestions = () => {
        if (!editingQuiz || selectedQuestionIds.length === 0) return;
        try {
            const updatedQuestions = (editingQuiz.questions || []).filter(q => !selectedQuestionIds.includes(q.id));
            setEditingQuiz({ ...editingQuiz, questions: updatedQuestions });
            onNotification('success', `Removed ${selectedQuestionIds.length} questions`);
        } finally {
            setSelectedQuestionIds([]);
            setIsBulkDeleteQuestionsOpen(false);
        }
    };

    const handleApplyBulkQuestionEdit = () => {
        if (!editingQuiz || selectedQuestionIds.length === 0) return;
        try {
            const updatedQuestions = (editingQuiz.questions || []).map(q => {
                if (selectedQuestionIds.includes(q.id)) {
                    return {
                        ...q,
                        ...(enableBulkPoints ? { points: Number(bulkQuestionPoints) } : {}),
                        ...(enableBulkPart ? { part: bulkQuestionPart } : {}),
                        ...(enableBulkType ? { type: bulkQuestionType } : {}),
                        shuffleOptions: true
                    };
                }
                return q;
            });
            setEditingQuiz({ ...editingQuiz, questions: updatedQuestions });
            onNotification('success', `Updated ${selectedQuestionIds.length} questions`);
        } finally {
            setSelectedQuestionIds([]);
            setIsBulkEditQuestionsOpen(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingQuiz.id ? "Edit Quiz" : "Create Quiz"}
            description={editingQuiz.id ? "Modify existing quiz details and questions" : "Configure new quiz parameters"}
            maxWidth="max-w-3xl"
            icon={<Edit2 className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />}
            footer={
                <div className="flex items-center justify-between gap-3 w-full">
                    <button 
                        onClick={onClose} 
                        className={`py-3 px-5 rounded-xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-gray-100 active:translate-x-0.5 active:translate-y-0.5'
                                : 'bg-[#1c1917] text-[#d6d0c7] border border-[#2e2924] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                        }`}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveQuiz} 
                        className={`flex-1 max-w-xs py-3 px-6 rounded-xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                : 'bg-[#bef264] text-[#0a0908] border border-[#bef264] shadow-[0_3px_0_#050504] hover:bg-[#d2fa8a] active:translate-y-0.5'
                        }`}
                    >
                        Save Quiz Changes
                    </button>
                </div>
            }
        >
            {/* Segmented Tab Switcher */}
            <div className={`flex gap-2 p-1.5 rounded-2xl mb-5 ${
                isBento
                    ? 'bg-[#f5f3ec] border-2 border-black shadow-[2px_2px_0px_#000]'
                    : 'bg-[#0e0d0b] border border-[#2e2924]'
            }`}>
                <button
                    type="button"
                    onClick={() => setActiveModalTab('general')}
                    className={`flex-1 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                        activeModalTab === 'general'
                            ? isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#bef264] text-[#0a0908] shadow-[0_2px_0_#050504]'
                            : isBento
                                ? 'text-gray-700 hover:text-black hover:bg-white/60'
                                : 'text-[#a8a29e] hover:text-[#f5f3ec] hover:bg-[#1c1917]'
                    }`}
                >
                    General Settings
                </button>
                <button
                    type="button"
                    onClick={() => setActiveModalTab('questions')}
                    className={`flex-1 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                        activeModalTab === 'questions'
                            ? isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#bef264] text-[#0a0908] shadow-[0_2px_0_#050504]'
                            : isBento
                                ? 'text-gray-700 hover:text-black hover:bg-white/60'
                                : 'text-[#a8a29e] hover:text-[#f5f3ec] hover:bg-[#1c1917]'
                    }`}
                >
                    Questions ({editingQuiz.questions?.length || 0})
                </button>
            </div>

            {activeModalTab === 'general' ? (
                <div className="space-y-4">
                    {/* Title */}
                    <div className="space-y-1">
                        <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            isBento ? 'text-black' : 'text-[#a8a29e]'
                        }`}>
                            <Type className="w-3.5 h-3.5" />
                            <span>Quiz Title</span>
                        </label>
                        <input 
                            placeholder="e.g. Introduction to Python Syntax" 
                            value={editingQuiz.title} 
                            onChange={e => setEditingQuiz({ ...editingQuiz, title: e.target.value })} 
                            className={`w-full rounded-xl px-4 py-3 font-bold text-base transition-all ${
                                isBento
                                    ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:outline-none'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder-[#78716c] focus:outline-none focus:border-[#bef264]'
                            }`} 
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            isBento ? 'text-black' : 'text-[#a8a29e]'
                        }`}>
                            <FileText className="w-3.5 h-3.5" />
                            <span>Description & Objectives</span>
                        </label>
                        <textarea 
                            placeholder="Provide a comprehensive summary of what this quiz covers..." 
                            value={editingQuiz.description} 
                            onChange={e => setEditingQuiz({ ...editingQuiz, description: e.target.value })} 
                            className={`w-full rounded-xl px-4 py-3 font-medium text-sm transition-all min-h-[75px] resize-y ${
                                isBento
                                    ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:outline-none'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder-[#78716c] focus:outline-none focus:border-[#bef264]'
                            }`} 
                            rows={3}
                        />
                    </div>

                    {/* Numeric Stats Grid: Time, Passing Score, Coins, XP */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Time Limit */}
                        <div className={`p-3 rounded-xl ${
                            isBento
                                ? 'bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#1a1714] border border-[#2e2924]'
                        }`}>
                            <label className={`text-[10px] font-black uppercase tracking-wider mb-1.5 flex items-center gap-1 ${
                                isBento ? 'text-black' : 'text-[#fde047]'
                            }`}>
                                <Clock className="w-3 h-3" />
                                <span>Time (min)</span>
                            </label>
                            <input 
                                type="number" 
                                min="0" 
                                placeholder="0" 
                                value={editingQuiz.timeLimit} 
                                onChange={e => setEditingQuiz({ ...editingQuiz, timeLimit: parseInt(e.target.value) || 0 })} 
                                className={`w-full rounded-lg px-2.5 py-1.5 font-black text-center text-sm focus:outline-none ${
                                    isBento
                                        ? 'bg-white border-2 border-black text-black'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#fde047]'
                                }`} 
                            />
                            <span className={`text-[9px] font-bold block text-center mt-1 ${isBento ? 'text-gray-600' : 'text-[#78716c]'}`}>0 = unlimited</span>
                        </div>

                        {/* Passing Score */}
                        <div className={`p-3 rounded-xl ${
                            isBento
                                ? 'bg-[#f0f9ff] border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#1a1714] border border-[#2e2924]'
                        }`}>
                            <label className={`text-[10px] font-black uppercase tracking-wider mb-1.5 flex items-center gap-1 ${
                                isBento ? 'text-black' : 'text-[#bae6fd]'
                            }`}>
                                <Target className="w-3 h-3" />
                                <span>Pass Score %</span>
                            </label>
                            <input 
                                type="number" 
                                min="0" 
                                max="100" 
                                placeholder="70" 
                                value={editingQuiz.passingScore} 
                                onChange={e => setEditingQuiz({ ...editingQuiz, passingScore: parseInt(e.target.value) || 0 })} 
                                className={`w-full rounded-lg px-2.5 py-1.5 font-black text-center text-sm focus:outline-none ${
                                    isBento
                                        ? 'bg-white border-2 border-black text-black'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bae6fd]'
                                }`} 
                            />
                            <span className={`text-[9px] font-bold block text-center mt-1 ${isBento ? 'text-gray-600' : 'text-[#78716c]'}`}>Percent required</span>
                        </div>

                        {/* Coins */}
                        <div className={`p-3 rounded-xl ${
                            isBento
                                ? 'bg-[#f0fdf4] border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#1a1714] border border-[#2e2924]'
                        }`}>
                            <label className={`text-[10px] font-black uppercase tracking-wider mb-1.5 flex items-center gap-1 ${
                                isBento ? 'text-black' : 'text-[#fde047]'
                            }`}>
                                <Coins className="w-3 h-3" />
                                <span>Coins</span>
                            </label>
                            <input 
                                type="number" 
                                min="0" 
                                placeholder="10" 
                                value={editingQuiz.coinsReward ?? 10} 
                                onChange={e => setEditingQuiz({ ...editingQuiz, coinsReward: parseInt(e.target.value) || 0 })} 
                                className={`w-full rounded-lg px-2.5 py-1.5 font-black text-center text-sm focus:outline-none ${
                                    isBento
                                        ? 'bg-white border-2 border-black text-black'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#fde047]'
                                }`} 
                            />
                            <span className={`text-[9px] font-bold block text-center mt-1 ${isBento ? 'text-gray-600' : 'text-[#78716c]'}`}>On completion</span>
                        </div>

                        {/* XP Reward */}
                        <div className={`p-3 rounded-xl ${
                            isBento
                                ? 'bg-[#fff7ed] border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#1a1714] border border-[#2e2924]'
                        }`}>
                            <label className={`text-[10px] font-black uppercase tracking-wider mb-1.5 flex items-center gap-1 ${
                                isBento ? 'text-black' : 'text-[#bef264]'
                            }`}>
                                <Zap className="w-3 h-3" />
                                <span>XP Reward</span>
                            </label>
                            <input 
                                type="number" 
                                min="0" 
                                placeholder="50" 
                                value={editingQuiz.xpReward ?? 50} 
                                onChange={e => setEditingQuiz({ ...editingQuiz, xpReward: parseInt(e.target.value) || 0 })} 
                                className={`w-full rounded-lg px-2.5 py-1.5 font-black text-center text-sm focus:outline-none ${
                                    isBento
                                        ? 'bg-white border-2 border-black text-black'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                }`} 
                            />
                            <span className={`text-[9px] font-bold block text-center mt-1 ${isBento ? 'text-gray-600' : 'text-[#78716c]'}`}>XP for ranking</span>
                        </div>
                    </div>

                    {/* Metadata Selection Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            {/* Category */}
                            <div className="space-y-1">
                                <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                    isBento ? 'text-black' : 'text-[#a8a29e]'
                                }`}>
                                    <Folder className="w-3.5 h-3.5" />
                                    <span>Category</span>
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="Category (e.g. Python Junior)" 
                                    value={editingQuiz.category} 
                                    onChange={e => setEditingQuiz({ ...editingQuiz, category: e.target.value })} 
                                    className={`w-full rounded-xl px-3.5 py-2.5 font-bold text-sm transition-all ${
                                        isBento
                                            ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:outline-none'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder-[#78716c] focus:outline-none focus:border-[#bef264]'
                                    }`} 
                                />
                            </div>

                            {/* Subject / Stack */}
                            <div className="space-y-1">
                                <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                    isBento ? 'text-black' : 'text-[#a8a29e]'
                                }`}>
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>Road / Stack</span>
                                </label>
                                <select
                                    value={editingQuiz.subjectId || ''}
                                    onChange={e => setEditingQuiz({ ...editingQuiz, subjectId: e.target.value || undefined })}
                                    className={`w-full rounded-xl px-3.5 py-2.5 font-bold text-sm transition-all appearance-none cursor-pointer ${
                                        isBento
                                            ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:outline-none'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:outline-none focus:border-[#bef264]'
                                    }`}
                                >
                                    <option value="">Uncategorized</option>
                                    {subjects.map(s => (
                                        <option key={s._id} value={s._id}>{s.title}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Difficulty */}
                            <div className="space-y-1">
                                <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                    isBento ? 'text-black' : 'text-[#a8a29e]'
                                }`}>
                                    <Sliders className="w-3.5 h-3.5" />
                                    <span>Difficulty Level</span>
                                </label>
                                <select 
                                    value={editingQuiz.difficulty} 
                                    onChange={e => setEditingQuiz({ ...editingQuiz, difficulty: e.target.value })} 
                                    className={`w-full rounded-xl px-3.5 py-2.5 font-bold text-sm transition-all appearance-none cursor-pointer ${
                                        isBento
                                            ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:outline-none'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:outline-none focus:border-[#bef264]'
                                    }`}
                                >
                                    {DIFFICULTY_LEVELS.map(level => (
                                        <option key={level} value={level}>{level}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Quiz Type */}
                            <div className="space-y-1">
                                <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                    isBento ? 'text-black' : 'text-[#a8a29e]'
                                }`}>
                                    <Target className="w-3.5 h-3.5" />
                                    <span>Quiz Type</span>
                                </label>
                                <select 
                                    value={editingQuiz.quizType || (editingQuiz.isQuestionPool ? 'pool' : 'quiz')} 
                                    onChange={e => {
                                        const val = e.target.value as 'quiz' | 'exam' | 'pool';
                                        setEditingQuiz({ 
                                            ...editingQuiz, 
                                            quizType: val,
                                            isQuestionPool: val === 'pool',
                                            questionsPerAttempt: editingQuiz.questionsPerAttempt || 10
                                        });
                                    }} 
                                    className={`w-full rounded-xl px-3.5 py-2.5 font-bold text-sm transition-all appearance-none cursor-pointer ${
                                        isBento
                                            ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:outline-none'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:outline-none focus:border-[#bef264]'
                                    }`}
                                >
                                    <option value="quiz">Regular Quiz</option>
                                    <option value="exam">Official Exam</option>
                                    <option value="pool">Question Bank / Pool Mode</option>
                                </select>
                            </div>
                        </div>

                        {/* Icon Picker */}
                        <div className="space-y-1">
                            <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                isBento ? 'text-black' : 'text-[#a8a29e]'
                            }`}>
                                <Sparkles className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#fde047]'}`} /> 
                                <span>Quiz Badge Icon</span>
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {QUIZ_ICON_OPTIONS.map(option => {
                                    const Icon = option.Icon;
                                    const isSelected = getQuizIconOption(editingQuiz.icon).key === option.key;

                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            onClick={() => setEditingQuiz({ ...editingQuiz, icon: option.key })}
                                            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 transition-all cursor-pointer ${
                                                isBento
                                                    ? isSelected
                                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                                        : 'bg-white text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] hover:bg-gray-50'
                                                    : isSelected
                                                        ? 'bg-[#bef264]/15 border-[1.5px] border-[#bef264] text-[#bef264]'
                                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#a8a29e] hover:border-[#443d35] hover:text-[#f5f3ec]'
                                            }`}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">{option.label}</span>
                                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Question Bank Settings */}
                    {(editingQuiz.quizType === 'pool' || editingQuiz.isQuestionPool) && (
                        <div className={`p-4 rounded-xl space-y-3 ${
                            isBento
                                ? 'bg-[#bae6fd] border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-[#1a1714] border border-[#bae6fd]/35'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>Question Bank Configuration</span>
                                </div>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                    isBento
                                        ? 'bg-white border border-black shadow-[1px_1px_0px_#000] text-black'
                                        : 'bg-[#bae6fd]/15 border border-[#bae6fd]/40 text-[#bae6fd]'
                                }`}>
                                    Pool Mode Active
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className={`text-xs font-black uppercase ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Questions Per Attempt</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max={Math.max(1, editingQuiz.questions?.length || 100)}
                                        value={editingQuiz.questionsPerAttempt || 10} 
                                        onChange={e => setEditingQuiz({ ...editingQuiz, questionsPerAttempt: Math.max(1, parseInt(e.target.value) || 1) })} 
                                        className={`w-full rounded-xl px-4 py-2.5 font-black focus:outline-none ${
                                            isBento
                                                ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bae6fd]'
                                        }`} 
                                    />
                                </div>
                                <div className={`flex flex-col justify-center text-xs font-semibold ${isBento ? 'text-black' : 'text-[#d6d0c7]'}`}>
                                    <span>Bank contains <strong className={isBento ? 'text-black' : 'text-[#bae6fd]'}>{editingQuiz.questions?.length || 0}</strong> total questions.</span>
                                    <span className={isBento ? 'opacity-80' : 'text-[#a8a29e]'}>Takes ~{Math.ceil((editingQuiz.questions?.length || 1) / (editingQuiz.questionsPerAttempt || 10))} rounds to test all questions.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Checkbox Banners */}
                    <div className="space-y-2.5 pt-1">
                        {/* Visible to Students */}
                        <div 
                            onClick={() => setEditingQuiz({ ...editingQuiz, isVisible: editingQuiz.isVisible === false ? true : false })}
                            className={`p-3.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer select-none transition-all ${
                                isBento
                                    ? `border-2 border-black shadow-[2px_2px_0px_#000] ${editingQuiz.isVisible !== false ? 'bg-[#dcfce7]' : 'bg-white opacity-70'}`
                                    : editingQuiz.isVisible !== false
                                        ? 'bg-[#171d14] border border-[#bef264]/35 hover:border-[#bef264]/60'
                                        : 'bg-[#1a1714] border border-[#2e2924] opacity-75 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    isBento
                                        ? 'bg-white border-2 border-black shadow-[1px_1px_0px_#000] text-black'
                                        : editingQuiz.isVisible !== false
                                            ? 'bg-[#bef264]/15 border border-[#bef264]/40 text-[#bef264]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#a8a29e]'
                                }`}>
                                    <Eye className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                        Visible to Students
                                    </div>
                                    <div className={`text-[11px] font-bold ${isBento ? 'text-gray-700' : 'text-[#a8a29e]'}`}>
                                        Turn this off to hide the quiz from public browsing while keeping it editable in admin tools.
                                    </div>
                                </div>
                            </div>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                isBento
                                    ? `border-2 border-black ${editingQuiz.isVisible !== false ? 'bg-[#bef264] text-black' : 'bg-white text-transparent'}`
                                    : editingQuiz.isVisible !== false
                                        ? 'bg-[#bef264] text-[#0a0908] border border-[#bef264]'
                                        : 'bg-[#0e0d0b] text-transparent border border-[#3a342e]'
                            }`}>
                                ✓
                            </div>
                        </div>

                        {/* Enable Review Mode */}
                        <div 
                            onClick={() => setEditingQuiz({ ...editingQuiz, reviewMode: !editingQuiz.reviewMode })}
                            className={`p-3.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer select-none transition-all ${
                                isBento
                                    ? `border-2 border-black shadow-[2px_2px_0px_#000] ${editingQuiz.reviewMode ? 'bg-[#fed7aa]' : 'bg-white opacity-70'}`
                                    : editingQuiz.reviewMode
                                        ? 'bg-[#171c20] border border-[#bae6fd]/35 hover:border-[#bae6fd]/60'
                                        : 'bg-[#1a1714] border border-[#2e2924] opacity-75 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    isBento
                                        ? 'bg-white border-2 border-black shadow-[1px_1px_0px_#000] text-black'
                                        : editingQuiz.reviewMode
                                            ? 'bg-[#bae6fd]/15 border border-[#bae6fd]/40 text-[#bae6fd]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#a8a29e]'
                                }`}>
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                        Enable Review Mode
                                    </div>
                                    <div className={`text-[11px] font-bold ${isBento ? 'text-gray-700' : 'text-[#a8a29e]'}`}>
                                        Show immediate feedback and explanations after each answer.
                                    </div>
                                </div>
                            </div>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                isBento
                                    ? `border-2 border-black ${editingQuiz.reviewMode ? 'bg-[#bef264] text-black' : 'bg-white text-transparent'}`
                                    : editingQuiz.reviewMode
                                        ? 'bg-[#bef264] text-[#0a0908] border border-[#bef264]'
                                        : 'bg-[#0e0d0b] text-transparent border border-[#3a342e]'
                            }`}>
                                ✓
                            </div>
                        </div>

                        {/* Shuffle Questions (Always Enforced) */}
                        <div 
                            className={`p-3.5 rounded-xl flex items-center justify-between gap-3 select-none ${
                                isBento
                                    ? 'bg-[#fef08a] border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#1e1b13] border border-[#fde047]/35'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    isBento
                                        ? 'bg-white border-2 border-black shadow-[1px_1px_0px_#000] text-black'
                                        : 'bg-[#fde047]/15 border border-[#fde047]/40 text-[#fde047]'
                                }`}>
                                    <Sliders className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                        Shuffle Questions Order (Always On)
                                    </div>
                                    <div className={`text-[11px] font-bold ${isBento ? 'text-gray-700' : 'text-[#a8a29e]'}`}>
                                        Question order is always randomized for every quiz attempt across the platform.
                                    </div>
                                </div>
                            </div>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black'
                                    : 'bg-[#bef264] text-[#0a0908] border border-[#bef264]'
                            }`}>
                                ✓
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Questions Tab Header Bar */}
                    <div className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl ${
                        isBento
                            ? 'bg-[#fef08a] border-2 border-black shadow-[3px_3px_0px_#000]'
                            : 'bg-[#1a1714] border border-[#2e2924]'
                    }`}>
                        <div className="flex items-center gap-2.5">
                            <span className={`font-black text-sm uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                📝 Questions Pool
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                                isBento 
                                    ? 'bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] text-black' 
                                    : 'bg-[#bef264]/15 border border-[#bef264]/35 text-[#bef264]'
                            }`}>
                                {editingQuiz.questions?.length || 0} Questions
                            </span>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setEditingQuestion({ 
                                id: 0, 
                                type: 'multiple-choice', 
                                part: 'A', 
                                question: '', 
                                options: ['', '', '', ''], 
                                correctAnswer: 0, 
                                points: 10, 
                                explanation: '' 
                            })} 
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                    : 'bg-[#bef264] text-[#0a0908] border border-[#bef264] shadow-[0_2px_0_#050504] hover:bg-[#d2fa8a]'
                            }`}
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Question</span>
                        </button>
                    </div>

                    {/* Bulk Selection Bar for Questions */}
                    <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                        isBento 
                            ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]'
                            : 'bg-[#1a1714] border-[#2e2924]'
                    }`}>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAllQuestions}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] hover:bg-gray-50'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#d6d0c7] hover:border-[#bef264] hover:text-[#f5f3ec]'
                                }`}
                            >
                                {editingQuiz.questions?.length > 0 && selectedQuestionIds.length === editingQuiz.questions.length ? (
                                    <CheckSquare className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                ) : (
                                    <Square className={`w-4 h-4 ${isBento ? 'text-gray-500' : 'text-[#78716c]'}`} />
                                )}
                                <span>{editingQuiz.questions?.length > 0 && selectedQuestionIds.length === editingQuiz.questions.length ? 'Deselect All' : 'Select All'}</span>
                            </button>
                            {selectedQuestionIds.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                    isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-[#bef264]/15 border border-[#bef264]/40 text-[#bef264]'
                                }`}>
                                    {selectedQuestionIds.length} Selected
                                </span>
                            )}
                        </div>

                        {selectedQuestionIds.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsBulkEditQuestionsOpen(true)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                        isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                            : 'bg-[#bef264] text-[#0a0908] hover:bg-[#d2fa8a]'
                                    }`}
                                >
                                    <Sliders className="w-3.5 h-3.5" />
                                    <span>Bulk Edit ({selectedQuestionIds.length})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsBulkDeleteQuestionsOpen(true)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                        isBento
                                            ? 'bg-[#ff6b6b] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                            : 'bg-[#fb7185] text-[#0a0908] hover:bg-[#fda4af]'
                                    }`}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete ({selectedQuestionIds.length})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedQuestionIds([])}
                                    className={`p-1 rounded-lg cursor-pointer ${isBento ? 'hover:bg-gray-100 text-black' : 'hover:bg-[#24201c] text-[#a8a29e] hover:text-[#f5f3ec]'}`}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Active Question Editor (Adding a New Question) */}
                    {editingQuestion && editingQuestion.id === 0 && (
                        <QuestionEditor
                            question={editingQuestion}
                            index={editingQuiz.questions?.length || 0}
                            onChange={setEditingQuestion}
                            onSave={() => handleAddQuestion({ ...editingQuestion, id: Date.now() })}
                            onCancel={() => setEditingQuestion(null)}
                        />
                    )}

                    {/* Questions List */}
                    <div className="space-y-2.5">
                        {(editingQuiz.questions || []).map((q, i) => (
                            <React.Fragment key={q.id}>
                                {editingQuestion && editingQuestion.id === q.id ? (
                                    <QuestionEditor
                                        question={editingQuestion}
                                        index={i}
                                        onChange={setEditingQuestion}
                                        onSave={() => handleQuestionUpdate(editingQuestion)}
                                        onCancel={() => setEditingQuestion(null)}
                                    />
                                ) : (
                                    <div className={`flex items-center justify-between p-3.5 rounded-xl transition-all ${
                                        selectedQuestionIds.includes(q.id)
                                            ? isBento
                                                ? 'bg-[#fef9c3] border-2 border-black shadow-[4px_4px_0px_#000] ring-2 ring-[#bef264]'
                                                : 'bg-[#171d14] border-[1.5px] border-[#bef264]'
                                            : isBento
                                                ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000]'
                                                : 'bg-[#1a1714] border border-[#2e2924] hover:border-[#443d35]'
                                    }`}>
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleSelectQuestion(q.id)}
                                                aria-label={selectedQuestionIds.includes(q.id) ? 'Deselect question' : 'Select question'}
                                                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                                    selectedQuestionIds.includes(q.id)
                                                        ? isBento
                                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                                            : 'bg-[#bef264] text-[#0a0908] border border-[#bef264]'
                                                        : isBento
                                                            ? 'bg-white border-2 border-black hover:bg-gray-100 shadow-[1px_1px_0px_#000]'
                                                            : 'bg-[#0e0d0b] border border-[#3a342e] text-transparent hover:border-[#bef264]'
                                                }`}
                                            >
                                                {selectedQuestionIds.includes(q.id) && <Check className="w-4 h-4 stroke-[3]" />}
                                            </button>
                                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                                isBento
                                                    ? 'bg-[#bae6fd] border-2 border-black shadow-[1.5px_1.5px_0px_#000] text-black'
                                                    : 'bg-[#bae6fd]/15 border border-[#bae6fd]/35 text-[#bae6fd]'
                                            }`}>
                                                Q{i + 1}
                                            </span>
                                            <div className="min-w-0 flex-1 pr-2">
                                                <p className={`font-bold text-sm truncate ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                                    {q.question || 'Untitled Question'}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {(() => {
                                                        const qType = q.isCompiler ? 'compiler' : (q.type || 'multiple-choice');
                                                        const badgeMap: Record<string, { label: string; color: string }> = {
                                                            'compiler': { label: 'Compiler', color: 'bg-[#fef08a]' },
                                                            'ordering': { label: 'Ordering', color: 'bg-[#fed7aa]' },
                                                            'matching': { label: 'Matching', color: 'bg-[#fbcfe8]' },
                                                            'code-output': { label: 'Code Output', color: 'bg-[#fed7aa]' },
                                                            'text': { label: 'Short Answer', color: 'bg-[#bef264]' },
                                                            'multiple-choice': { label: 'Multiple Choice', color: 'bg-[#bae6fd]' }
                                                        };
                                                        const badge = badgeMap[qType] || badgeMap['multiple-choice'];
                                                        return (
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                                isBento
                                                                    ? `${badge.color} border border-black text-black shadow-[1px_1px_0px_#000]`
                                                                    : 'bg-[#24201c] border border-[#3a342e] text-[#d6d0c7]'
                                                            }`}>
                                                                {badge.label}
                                                            </span>
                                                        );
                                                    })()}
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                        isBento
                                                            ? 'bg-[#bef264] border border-black text-black shadow-[1px_1px_0px_#000]'
                                                            : 'bg-[#bef264]/15 border border-[#bef264]/35 text-[#bef264]'
                                                    }`}>
                                                        {q.points || 10} pts
                                                    </span>
                                                    {!q.isCompiler && (!q.type || q.type === 'multiple-choice') && q.options && (
                                                        <span className={`text-[10px] font-bold ${isBento ? 'text-gray-600' : 'text-[#a8a29e]'}`}>
                                                            • {q.options.length} options
                                                        </span>
                                                    )}
                                                    {q.type === 'ordering' && q.orderingItems && (
                                                        <span className={`text-[10px] font-bold ${isBento ? 'text-gray-600' : 'text-[#a8a29e]'}`}>
                                                            • {q.orderingItems.length} steps
                                                        </span>
                                                    )}
                                                    {q.type === 'matching' && q.matchingPairs && (
                                                        <span className={`text-[10px] font-bold ${isBento ? 'text-gray-600' : 'text-[#a8a29e]'}`}>
                                                            • {q.matchingPairs.length} pairs
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const qToEdit = { ...q };
                                                    // Hydrate reference code if missing
                                                    if (qToEdit.isCompiler && (!qToEdit.compilerConfig?.referenceCode || qToEdit.compilerConfig.referenceCode.trim() === '')) {
                                                        const lang = qToEdit.compilerConfig?.language || 'javascript';
                                                        const comment = lang.includes('python') ? '# Enter the correct code solution here...' : '// Enter the correct code solution here...';
                                                        qToEdit.compilerConfig = {
                                                            ...(qToEdit.compilerConfig || { language: 'javascript', allowedLanguages: ['javascript'], initialCode: '' }),
                                                            referenceCode: comment
                                                        };
                                                    }
                                                    setEditingQuestion(qToEdit);
                                                }} 
                                                className={`p-2 rounded-lg transition-all cursor-pointer ${
                                                    isBento
                                                        ? 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#bae6fd] hover:border-[#bae6fd]'
                                                }`}
                                                title="Edit Question"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => handleDeleteQuestion(q.id)} 
                                                className={`p-2 rounded-lg transition-all cursor-pointer ${
                                                    isBento
                                                        ? 'bg-[#fca5a5] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#fb7185] hover:border-[#fb7185]'
                                                }`}
                                                title="Delete Question"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}

            {/* Bulk Edit Questions Modal */}
            <Modal
                isOpen={isBulkEditQuestionsOpen}
                onClose={() => setIsBulkEditQuestionsOpen(false)}
                title={`Bulk Edit ${selectedQuestionIds.length} Questions`}
                description="Update points, part, or type across all selected questions."
                maxWidth="max-w-md"
                footer={
                    <div className="flex justify-between items-center gap-3 w-full">
                        <button
                            type="button"
                            onClick={() => setIsBulkEditQuestionsOpen(false)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer ${
                                isBento ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#1c1917] text-[#d6d0c7] border border-[#2e2924] hover:bg-[#24201c]'
                            }`}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleApplyBulkQuestionEdit}
                            disabled={!enableBulkPoints && !enableBulkPart && !enableBulkType}
                            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50 cursor-pointer ${
                                isBento ? 'bg-[#bef264] text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000]' : 'bg-[#bef264] text-[#0a0908] hover:bg-[#d2fa8a]'
                            }`}
                        >
                            Apply Changes
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    {/* Points */}
                    <div className={`p-3 rounded-xl border ${isBento ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#1a1714] border-[#2e2924]'}`}>
                        <label onClick={() => setEnableBulkPoints(!enableBulkPoints)} className="flex items-center gap-2 cursor-pointer mb-2">
                            <input type="checkbox" checked={enableBulkPoints} onChange={() => {}} className="cursor-pointer accent-[#bef264]" />
                            <span className={`text-xs font-black uppercase ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>Update Points</span>
                        </label>
                        {enableBulkPoints && (
                            <div className="flex items-center gap-2 pl-6">
                                <input
                                    type="number"
                                    min="1"
                                    value={bulkQuestionPoints}
                                    onChange={e => setBulkQuestionPoints(Math.max(1, parseInt(e.target.value) || 1))}
                                    className={`w-24 px-3 py-1.5 rounded-lg text-sm font-black text-center ${
                                        isBento ? 'bg-white text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]' : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924]'
                                    }`}
                                />
                                <span className={`text-xs font-bold ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>pts</span>
                            </div>
                        )}
                    </div>

                    {/* Part */}
                    <div className={`p-3 rounded-xl border ${isBento ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#1a1714] border-[#2e2924]'}`}>
                        <label onClick={() => setEnableBulkPart(!enableBulkPart)} className="flex items-center gap-2 cursor-pointer mb-2">
                            <input type="checkbox" checked={enableBulkPart} onChange={() => {}} className="cursor-pointer accent-[#bef264]" />
                            <span className={`text-xs font-black uppercase ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>Update Part Section</span>
                        </label>
                        {enableBulkPart && (
                            <div className="pl-6">
                                <input
                                    type="text"
                                    value={bulkQuestionPart}
                                    onChange={e => setBulkQuestionPart(e.target.value.toUpperCase())}
                                    placeholder="e.g. A, B, 1, 2"
                                    className={`w-24 px-3 py-1.5 rounded-lg text-sm font-black text-center ${
                                        isBento ? 'bg-white text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]' : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924]'
                                    }`}
                                />
                            </div>
                        )}
                    </div>

                    {/* Question Type */}
                    <div className={`p-3 rounded-xl border ${isBento ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#1a1714] border-[#2e2924]'}`}>
                        <label onClick={() => setEnableBulkType(!enableBulkType)} className="flex items-center gap-2 cursor-pointer mb-2">
                            <input type="checkbox" checked={enableBulkType} onChange={() => {}} className="cursor-pointer accent-[#bef264]" />
                            <span className={`text-xs font-black uppercase ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>Update Question Type</span>
                        </label>
                        {enableBulkType && (
                            <div className="flex flex-wrap gap-2 pl-6">
                                {(['multiple-choice', 'ordering', 'matching', 'code-output', 'text'] as const).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setBulkQuestionType(t)}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                                            bulkQuestionType === t
                                                ? isBento ? 'bg-[#bef264] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]' : 'bg-[#bef264] text-[#0a0908]'
                                                : isBento ? 'bg-white text-black border border-black' : 'bg-[#0e0d0b] text-[#a8a29e] border border-[#2e2924] hover:text-[#f5f3ec]'
                                        }`}
                                    >
                                        {t.replace('-', ' ')}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Shuffle Answer Options (Always Enforced) */}
                    <div className={`p-3 rounded-xl border ${isBento ? 'bg-[#fef9c3]/50 border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#1e1b13] border-[#fde047]/35'}`}>
                        <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-black uppercase ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>Shuffle Answer Options</span>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                                isBento ? 'bg-[#bef264] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]' : 'bg-[#bef264] text-[#0a0908]'
                            }`}>
                                Always Enabled
                            </span>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Bulk Delete Questions Confirm Dialog */}
            <ConfirmDialog
                isOpen={isBulkDeleteQuestionsOpen}
                onCancel={() => setIsBulkDeleteQuestionsOpen(false)}
                onConfirm={confirmBulkDeleteQuestions}
                title={`Remove ${selectedQuestionIds.length} Questions?`}
                message={`Are you sure you want to remove these ${selectedQuestionIds.length} questions from this quiz?`}
                confirmText={`Remove ${selectedQuestionIds.length} Questions`}
                cancelText="Cancel"
                type="danger"
                showWarningBanner={false}
            />
        </Modal>
    );
};

export default QuizEditorModal;
