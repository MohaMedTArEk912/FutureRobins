import React from 'react';
import { COMPILER_ALLOWED_LANGUAGES, COMPILER_INITIAL_CODE } from '../../constants/quizDefaults';
import { 
    ChevronDown, 
    Type, 
    Code, 
    Image as ImageIcon, 
    Shuffle, 
    CheckCircle2, 
    Circle, 
    Sparkles, 
    Star, 
    Lightbulb, 
    Save,
    ArrowUp,
    ArrowDown,
    Plus,
    Trash2,
    ListOrdered,
    Link2,
    Terminal,
    AlignLeft
} from 'lucide-react';
import CompilerQuestion from '../question-types/CompilerQuestion';
import { MathRenderer } from '../common/MathRenderer';
import { useTheme } from '../../context/ThemeContext';
import type { Question } from '../../types';

interface QuestionEditorProps {
    question: Question;
    index?: number;
    onChange: (q: Question) => void;
    onSave: () => void;
    onCancel: () => void;
}

const QUESTION_TYPES = [
    { id: 'multiple-choice', label: 'Multiple Choice', icon: '📋', color: 'bg-[#bae6fd]' },
    { id: 'ordering', label: 'Ordering', icon: '🔢', color: 'bg-[#fed7aa]' },
    { id: 'matching', label: 'Matching Pairs', icon: '🔗', color: 'bg-[#fbcfe8]' },
    { id: 'code-output', label: 'Code Output', icon: '💻', color: 'bg-[#fed7aa]' },
    { id: 'text', label: 'Short Answer', icon: '✍️', color: 'bg-[#bef264]' },
    { id: 'compiler', label: 'Compiler', icon: '⚡', color: 'bg-[#fef08a]' },
] as const;

const QuestionEditor: React.FC<QuestionEditorProps> = ({ question, index, onChange, onSave, onCancel }) => {
    const { isBento } = useTheme();

    const currentType = question.isCompiler ? 'compiler' : (question.type || 'multiple-choice');

    const handleTypeChange = (newType: string) => {
        if (newType === 'compiler') {
            onChange({
                ...question,
                type: 'text',
                isCompiler: true,
                compilerConfig: question.compilerConfig || {
                    language: 'javascript',
                    allowedLanguages: COMPILER_ALLOWED_LANGUAGES,
                    initialCode: COMPILER_INITIAL_CODE['javascript'],
                    referenceCode: '// Enter the correct code solution here...'
                }
            });
        } else if (newType === 'ordering') {
            const defaultItems = question.orderingItems && question.orderingItems.length >= 2
                ? question.orderingItems
                : (question.options && question.options.length >= 2 ? question.options : ['First Step', 'Second Step', 'Third Step', 'Fourth Step']);
            onChange({
                ...question,
                type: 'ordering',
                isCompiler: false,
                orderingItems: defaultItems,
                options: defaultItems
            });
        } else if (newType === 'matching') {
            onChange({
                ...question,
                type: 'matching',
                isCompiler: false,
                matchingPairs: question.matchingPairs && question.matchingPairs.length >= 2
                    ? question.matchingPairs
                    : [
                        { left: 'Premise 1', right: 'Match 1' },
                        { left: 'Premise 2', right: 'Match 2' },
                        { left: 'Premise 3', right: 'Match 3' }
                    ]
            });
        } else if (newType === 'code-output') {
            onChange({
                ...question,
                type: 'code-output',
                isCompiler: false,
                codeSnippet: question.codeSnippet || 'let a = 10;\nlet b = 20;\nconsole.log(a + b);',
                options: question.options && question.options.length >= 2 ? question.options : ['30', '1020', 'undefined', 'NaN'],
                correctAnswer: typeof question.correctAnswer === 'number' ? question.correctAnswer : 0
            });
        } else if (newType === 'text') {
            onChange({
                ...question,
                type: 'text',
                isCompiler: false,
                correctAnswer: typeof question.correctAnswer === 'string' ? question.correctAnswer : ''
            });
        } else {
            // multiple-choice
            onChange({
                ...question,
                type: 'multiple-choice',
                isCompiler: false,
                options: question.options && question.options.length >= 2 ? question.options : ['', '', '', ''],
                correctAnswer: typeof question.correctAnswer === 'number' ? question.correctAnswer : 0
            });
        }
    };

    // Ordering Helpers
    const orderingItems = question.orderingItems || question.options || ['First Step', 'Second Step', 'Third Step', 'Fourth Step'];
    const handleMoveOrderingItem = (idx: number, dir: 'up' | 'down') => {
        const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= orderingItems.length) return;
        const newItems = [...orderingItems];
        const [moved] = newItems.splice(idx, 1);
        newItems.splice(targetIdx, 0, moved);
        onChange({ ...question, orderingItems: newItems, options: newItems });
    };

    const handleUpdateOrderingItem = (idx: number, val: string) => {
        const newItems = [...orderingItems];
        newItems[idx] = val;
        onChange({ ...question, orderingItems: newItems, options: newItems });
    };

    const handleAddOrderingItem = () => {
        const newItems = [...orderingItems, `Step ${orderingItems.length + 1}`];
        onChange({ ...question, orderingItems: newItems, options: newItems });
    };

    const handleRemoveOrderingItem = (idx: number) => {
        if (orderingItems.length <= 2) return;
        const newItems = orderingItems.filter((_, i) => i !== idx);
        onChange({ ...question, orderingItems: newItems, options: newItems });
    };

    // Matching Helpers
    const matchingPairs = question.matchingPairs || [
        { left: 'Premise 1', right: 'Match 1' },
        { left: 'Premise 2', right: 'Match 2' }
    ];
    const handleUpdateMatchingPair = (idx: number, field: 'left' | 'right', val: string) => {
        const newPairs = [...matchingPairs];
        newPairs[idx] = { ...newPairs[idx], [field]: val };
        onChange({ ...question, matchingPairs: newPairs });
    };

    const handleAddMatchingPair = () => {
        const newPairs = [...matchingPairs, { left: '', right: '' }];
        onChange({ ...question, matchingPairs: newPairs });
    };

    const handleRemoveMatchingPair = (idx: number) => {
        if (matchingPairs.length <= 2) return;
        const newPairs = matchingPairs.filter((_, i) => i !== idx);
        onChange({ ...question, matchingPairs: newPairs });
    };

    return (
        <div className={`transition-all ${
            isBento
                ? 'bg-[#faf9f5] border-[2.5px] border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000] space-y-4 text-black'
                : 'bg-[#1a1714] p-4 rounded-xl border border-[#2e2924] space-y-3 text-[#f5f3ec]'
        }`}>
            {/* Top Editor Banner */}
            <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 ${
                isBento ? 'border-b-2 border-black' : 'border-b border-[#2e2924]'
            }`}>
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                        isBento
                            ? 'bg-[#bef264] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                            : 'bg-[#bef264]/15 border border-[#bef264]/40 text-[#bef264]'
                    }`}>
                        {question.id === 0 ? '✨ New Question' : `Editing Question ${index !== undefined ? `#${index + 1}` : ''}`}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                        isBento
                            ? 'bg-[#fef08a] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#d6d0c7]'
                    }`}>
                        {QUESTION_TYPES.find(t => t.id === currentType)?.label || 'Multiple Choice'}
                    </span>
                </div>

                {/* Question Type Switcher: 6 Types */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {QUESTION_TYPES.map((t) => {
                        const isSelected = currentType === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => handleTypeChange(t.id)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                                    isSelected
                                        ? isBento
                                            ? `${t.color} text-black border-2 border-black shadow-[2px_2px_0px_#000] scale-105`
                                            : 'bg-[#bef264] text-[#0a0908] border border-[#bef264]'
                                        : isBento
                                            ? 'bg-white text-gray-700 border-2 border-black hover:bg-gray-100'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#a8a29e] hover:text-[#f5f3ec] hover:border-[#443d35]'
                                }`}
                            >
                                <span>{t.icon}</span>
                                <span>{t.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Question Text / Prompt */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        isBento ? 'text-black' : 'text-[#a8a29e]'
                    }`}>
                        <Type className="w-3.5 h-3.5" />
                        <span>Question Prompt</span>
                    </label>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        isBento
                            ? 'bg-[#fef08a] border border-black text-black shadow-[1px_1px_0px_#000]'
                            : 'bg-[#fde047]/15 border border-[#fde047]/35 text-[#fde047]'
                    }`}>
                        Supports LaTeX: $x^2$ or $$E=mc^2$$
                    </span>
                </div>
                <textarea
                    placeholder="Enter your question prompt here (supports multiple lines and LaTeX formulas)..."
                    value={question.question}
                    onChange={e => onChange({ ...question, question: e.target.value })}
                    className={`w-full rounded-xl p-3.5 font-semibold text-sm transition-all min-h-[95px] resize-y ${
                        isBento
                            ? 'bg-white border-2 border-black text-black placeholder-gray-400 focus:outline-none focus:shadow-[4px_4px_0px_#000]'
                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder-[#78716c] focus:outline-none focus:border-[#bef264]'
                    }`}
                    rows={3}
                />
                {question.question && (question.question.includes('$') || question.question.includes('\\(') || question.question.includes('\\[')) && (
                    <div className={`p-3 rounded-xl text-xs space-y-1 ${
                        isBento
                            ? 'bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                            : 'bg-[#1e1b13] border border-[#fde047]/35 text-[#f5f3ec]'
                    }`}>
                        <div className={`font-black flex items-center gap-1.5 uppercase text-[10px] tracking-wider ${isBento ? 'text-black' : 'text-[#fde047]'}`}>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Live LaTeX / Math Preview:</span>
                        </div>
                        <div className="pl-1 font-medium">
                            <MathRenderer text={question.question} className={isBento ? 'text-black font-semibold' : 'text-[#f5f3ec]'} />
                        </div>
                    </div>
                )}
            </div>

            {/* Code Snippet (Shown for Code Output & Optional for Others) */}
            {(currentType === 'code-output' || question.codeSnippet !== undefined) && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            isBento ? 'text-black' : 'text-[#a8a29e]'
                        }`}>
                            <Code className="w-3.5 h-3.5" />
                            <span>{currentType === 'code-output' ? 'Target Code Snippet to Predict' : 'Code Snippet Preview (Optional)'}</span>
                        </label>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isBento
                                ? 'bg-[#fed7aa] border border-black text-black shadow-[1px_1px_0px_#000]'
                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#a8a29e]'
                        }`}>
                            Monospace
                        </span>
                    </div>
                    <div className={`relative rounded-xl overflow-hidden transition-all ${
                        isBento
                            ? 'border-2 border-black shadow-[2px_2px_0px_#000] focus-within:shadow-[4px_4px_0px_#000]'
                            : 'border border-[#2e2924]'
                    }`}>
                        <div className="bg-[#0a0908] px-3 py-1.5 border-b border-[#2e2924] flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#fb7185]" />
                            <span className="w-2.5 h-2.5 rounded-full bg-[#fde047]" />
                            <span className="w-2.5 h-2.5 rounded-full bg-[#bef264]" />
                            <span className="text-[10px] font-mono font-bold text-[#a8a29e] ml-2 uppercase tracking-wider">Snippet Window</span>
                        </div>
                        <textarea
                            placeholder="Provide code to display with the question (e.g. console.log output)..."
                            value={question.codeSnippet || ''}
                            onChange={e => onChange({ ...question, codeSnippet: e.target.value })}
                            className="w-full !bg-[#0e0d0b] !text-[#f5f3ec] p-3 font-mono text-xs focus:outline-none min-h-[90px] resize-y"
                            rows={4}
                        />
                    </div>
                </div>
            )}

            {/* Optional Media: Image URL */}
            {currentType !== 'compiler' && (
                <div className="space-y-1.5">
                    <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        isBento ? 'text-black' : 'text-[#a8a29e]'
                    }`}>
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Image URL (Optional)</span>
                    </label>
                    <input
                        type="url"
                        placeholder="https://images.unsplash.com/photo-diagram-flowchart.png"
                        value={question.imageUrl || ''}
                        onChange={e => onChange({ ...question, imageUrl: e.target.value })}
                        className={`w-full rounded-xl px-3.5 py-2.5 font-semibold text-sm transition-all ${
                            isBento
                                ? 'bg-white border-2 border-black text-black placeholder-gray-400 focus:outline-none focus:shadow-[4px_4px_0px_#000]'
                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder-[#78716c] focus:outline-none focus:border-[#bef264]'
                        }`}
                    />
                    {question.imageUrl && (
                        <div className={`p-3 rounded-xl flex items-center gap-3 ${
                            isBento
                                ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-[#0e0d0b] border border-[#2e2924]'
                        }`}>
                            <img
                                src={question.imageUrl}
                                alt="Question preview"
                                className={`max-h-24 max-w-xs rounded-lg object-contain ${
                                    isBento ? 'bg-gray-50 border-2 border-black' : 'bg-[#141210] border border-[#2e2924]'
                                }`}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <div className="text-xs space-y-1">
                                <span className={`font-black uppercase text-[10px] block ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>Image Attached</span>
                                <button
                                    type="button"
                                    onClick={() => onChange({ ...question, imageUrl: '' })}
                                    className={`font-bold underline text-xs cursor-pointer ${isBento ? 'text-red-600 hover:text-red-800' : 'text-[#fb7185] hover:text-[#fda4af]'}`}
                                >
                                    Remove image
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- 1. MULTIPLE CHOICE SUB-EDITOR --- */}
            {currentType === 'multiple-choice' && (
                <div className="space-y-3 pt-2">
                    {/* Shuffle Options Card (Always Enforced) */}
                    <div
                        className={`p-3 rounded-xl flex items-center justify-between gap-3 select-none ${
                            isBento
                                ? 'bg-[#fef08a] border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#1e1b13] border border-[#fde047]/35'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isBento
                                    ? 'bg-white border-2 border-black shadow-[1px_1px_0px_#000] text-black'
                                    : 'bg-[#fde047]/15 border border-[#fde047]/40 text-[#fde047]'
                            }`}>
                                <Shuffle className="w-4 h-4" />
                            </div>
                            <div>
                                <div className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                    Shuffle Options Randomly (Always On)
                                </div>
                                <div className={`text-[11px] font-bold ${isBento ? 'text-gray-700' : 'text-[#a8a29e]'}`}>
                                    Answer options are always shuffled across the entire platform
                                </div>
                            </div>
                        </div>
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            isBento ? 'bg-[#bef264] text-black border-2 border-black' : 'bg-[#bef264] text-[#0a0908]'
                        }`}>
                            ✓
                        </div>
                    </div>

                    {/* Instruction Header */}
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider pt-1">
                        <span className={isBento ? 'text-black' : 'text-[#f5f3ec]'}>
                            Answer Options ({question.options?.length || 4})
                        </span>
                        <span className={`text-[11px] font-bold ${isBento ? 'text-gray-600' : 'text-[#a8a29e]'}`}>
                            Click button to select the correct answer
                        </span>
                    </div>

                    {/* Option Cards in 2x2 Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(question.options || ['', '', '', '']).map((opt, idx) => {
                            const isCorrect = question.correctAnswer === idx;
                            const letter = String.fromCharCode(65 + idx);
                            const letterPillColors = ['bg-[#bae6fd]', 'bg-[#bef264]', 'bg-[#fef08a]', 'bg-[#fed7aa]'];
                            const pillColor = letterPillColors[idx % letterPillColors.length];

                            return (
                                <div
                                    key={idx}
                                    className={`relative rounded-xl p-3 transition-all ${
                                        isCorrect
                                            ? isBento
                                                ? 'bg-[#dcfce7] border-2 border-black shadow-[3px_3px_0px_#000]'
                                                : 'bg-[#171d14] border-[1.5px] border-[#bef264]'
                                            : isBento
                                                ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                                : 'bg-[#141210] border border-[#2e2924]'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                                                isBento
                                                    ? `${pillColor} border-2 border-black text-black shadow-[1px_1px_0px_#000]`
                                                    : isCorrect
                                                        ? 'bg-[#bef264] text-[#0a0908]'
                                                        : 'bg-[#1c1917] border border-[#2e2924] text-[#f5f3ec]'
                                            }`}>
                                                {letter}
                                            </span>
                                            <span className={`text-[11px] font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                                Option {letter}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onChange({ ...question, correctAnswer: idx })}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                                isBento
                                                    ? isCorrect
                                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : 'bg-white text-gray-600 border-2 border-black hover:bg-gray-100 hover:text-black'
                                                    : isCorrect
                                                        ? 'bg-[#bef264] text-[#0a0908] border border-[#bef264]'
                                                        : 'bg-[#1c1917] text-[#a8a29e] border border-[#2e2924] hover:border-[#bef264] hover:text-[#f5f3ec]'
                                            }`}
                                        >
                                            {isCorrect ? (
                                                <>
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    <span>Correct Answer</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Circle className="w-3.5 h-3.5" />
                                                    <span>Mark Correct</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <input
                                        placeholder={`Enter choice ${letter}...`}
                                        value={opt}
                                        onChange={e => {
                                            const newVal = e.target.value;
                                            const newOptions = [...(question.options || ['', '', '', ''])];
                                            newOptions[idx] = newVal;
                                            onChange({ ...question, options: newOptions });
                                        }}
                                        className={`w-full rounded-lg px-3 py-2 font-semibold text-sm transition-all ${
                                            isBento
                                                ? 'bg-white border-2 border-black text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder-[#78716c] focus:outline-none focus:border-[#bef264]'
                                        }`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* --- 2. ORDERING SUB-EDITOR --- */}
            {currentType === 'ordering' && (
                <div className={`space-y-3 p-4 rounded-xl ${
                    isBento
                        ? 'bg-[#fff7ed] border-2 border-black shadow-[3px_3px_0px_#000]'
                        : 'bg-[#141210] border border-[#fde047]/30'
                }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <ListOrdered className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                            <span className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                Target Sequence Steps ({orderingItems.length} steps)
                            </span>
                        </div>
                        <span className={`text-[11px] font-bold ${isBento ? 'text-gray-700' : 'text-[#a8a29e]'}`}>
                            Provide steps in correct order. They will be shuffled for students.
                        </span>
                    </div>

                    <div className="space-y-2">
                        {orderingItems.map((item, idx) => (
                            <div
                                key={idx}
                                className={`flex items-center gap-2 p-2.5 rounded-xl ${
                                    isBento ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#1a1714] border border-[#2e2924]'
                                }`}
                            >
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                    isBento
                                        ? 'bg-[#fed7aa] border-2 border-black text-black shadow-[1px_1px_0px_#000]'
                                        : 'bg-[#fde047]/15 border border-[#fde047]/40 text-[#fde047]'
                                }`}>
                                    {idx + 1}
                                </span>
                                <input
                                    placeholder={`Step #${idx + 1} description...`}
                                    value={item}
                                    onChange={e => handleUpdateOrderingItem(idx, e.target.value)}
                                    className={`flex-1 px-3 py-1.5 rounded-lg font-bold text-sm focus:outline-none ${
                                        isBento
                                            ? 'bg-white border border-black/30 text-black focus:border-black'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                    }`}
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveOrderingItem(idx, 'up')}
                                        className={`p-1.5 rounded-lg disabled:opacity-30 cursor-pointer ${
                                            isBento
                                                ? 'border border-black hover:bg-gray-100 text-black'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#d6d0c7] hover:border-[#bef264]'
                                        }`}
                                        title="Move Up"
                                    >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={idx === orderingItems.length - 1}
                                        onClick={() => handleMoveOrderingItem(idx, 'down')}
                                        className={`p-1.5 rounded-lg disabled:opacity-30 cursor-pointer ${
                                            isBento
                                                ? 'border border-black hover:bg-gray-100 text-black'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#d6d0c7] hover:border-[#bef264]'
                                        }`}
                                        title="Move Down"
                                    >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={orderingItems.length <= 2}
                                        onClick={() => handleRemoveOrderingItem(idx)}
                                        className={`p-1.5 rounded-lg disabled:opacity-30 cursor-pointer ${
                                            isBento
                                                ? 'border border-black hover:bg-red-100 text-red-600'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#fb7185] hover:border-[#fb7185]'
                                        }`}
                                        title="Remove Step"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleAddOrderingItem}
                        className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                            isBento
                                ? 'bg-white hover:bg-[#fed7aa] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#fde047]/15 border border-[#fde047]/40 text-[#fde047] hover:bg-[#fde047]/25'
                        }`}
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Sequence Step</span>
                    </button>
                </div>
            )}

            {/* --- 3. MATCHING PAIRS SUB-EDITOR --- */}
            {currentType === 'matching' && (
                <div className={`space-y-3 p-4 rounded-xl ${
                    isBento
                        ? 'bg-[#fdf2f8] border-2 border-black shadow-[3px_3px_0px_#000]'
                        : 'bg-[#141210] border border-[#fb7185]/30'
                }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Link2 className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#fb7185]'}`} />
                            <span className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                Matching Pairs ({matchingPairs.length} pairs)
                            </span>
                        </div>
                        <span className={`text-[11px] font-bold ${isBento ? 'text-gray-700' : 'text-[#a8a29e]'}`}>
                            Left column will be matched with right column
                        </span>
                    </div>

                    <div className="space-y-2">
                        {matchingPairs.map((pair, idx) => (
                            <div
                                key={idx}
                                className={`flex flex-col sm:flex-row items-center gap-2 p-2.5 rounded-xl ${
                                    isBento ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#1a1714] border border-[#2e2924]'
                                }`}
                            >
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                    isBento
                                        ? 'bg-[#fbcfe8] border-2 border-black text-black shadow-[1px_1px_0px_#000]'
                                        : 'bg-[#fb7185]/15 border border-[#fb7185]/40 text-[#fb7185]'
                                }`}>
                                    P{idx + 1}
                                </span>
                                <input
                                    placeholder="Left premise / term (e.g. HTML)..."
                                    value={pair.left}
                                    onChange={e => handleUpdateMatchingPair(idx, 'left', e.target.value)}
                                    className={`flex-1 w-full sm:w-auto px-3 py-1.5 rounded-lg font-bold text-sm focus:outline-none ${
                                        isBento
                                            ? 'bg-white border border-black/30 text-black focus:border-black'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                    }`}
                                />
                                <span className={`font-black text-sm ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>➔</span>
                                <input
                                    placeholder="Right match / definition (e.g. Structure)..."
                                    value={pair.right}
                                    onChange={e => handleUpdateMatchingPair(idx, 'right', e.target.value)}
                                    className={`flex-1 w-full sm:w-auto px-3 py-1.5 rounded-lg font-bold text-sm focus:outline-none ${
                                        isBento
                                            ? 'bg-white border border-black/30 text-black focus:border-black'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                    }`}
                                />
                                <button
                                    type="button"
                                    disabled={matchingPairs.length <= 2}
                                    onClick={() => handleRemoveMatchingPair(idx)}
                                    className={`p-1.5 rounded-lg disabled:opacity-30 cursor-pointer shrink-0 ${
                                        isBento
                                            ? 'border border-black hover:bg-red-100 text-red-600'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#fb7185] hover:border-[#fb7185]'
                                    }`}
                                    title="Remove Pair"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleAddMatchingPair}
                        className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                            isBento
                                ? 'bg-white hover:bg-[#fbcfe8] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#fb7185]/15 border border-[#fb7185]/40 text-[#fb7185] hover:bg-[#fb7185]/25'
                        }`}
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Matching Pair</span>
                    </button>
                </div>
            )}

            {/* --- 4. CODE OUTPUT SUB-EDITOR --- */}
            {currentType === 'code-output' && (
                <div className={`space-y-3 p-4 rounded-xl ${
                    isBento
                        ? 'bg-[#fff7ed] border-2 border-black shadow-[3px_3px_0px_#000]'
                        : 'bg-[#141210] border border-[#bae6fd]/30'
                }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Terminal className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} />
                            <span className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                Predicted Output Options (or exact output)
                            </span>
                        </div>
                        <span className={`text-[11px] font-bold ${isBento ? 'text-gray-600' : 'text-[#a8a29e]'}`}>
                            Mark the correct output from the list
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(question.options || ['Output 1', 'Output 2', 'Output 3', 'Output 4']).map((opt, idx) => {
                            const isCorrect = question.correctAnswer === idx || String(question.correctAnswer) === String(opt);
                            return (
                                <div
                                    key={idx}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl ${
                                        isCorrect
                                            ? isBento
                                                ? 'bg-[#bef264] border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#171d14] border-[1.5px] border-[#bef264]'
                                            : isBento
                                                ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#1a1714] border border-[#2e2924]'
                                    }`}
                                >
                                    <input
                                        placeholder={`Option #${idx + 1} output...`}
                                        value={opt}
                                        onChange={e => {
                                            const newOpts = [...(question.options || ['Output 1', 'Output 2', 'Output 3', 'Output 4'])];
                                            newOpts[idx] = e.target.value;
                                            onChange({ ...question, options: newOpts });
                                        }}
                                        className={`flex-1 px-3 py-1 font-mono text-xs bg-transparent border-0 focus:outline-none ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onChange({ ...question, correctAnswer: idx })}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer shrink-0 ${
                                            isBento
                                                ? isCorrect ? 'bg-black text-white border border-black' : 'bg-white text-black border border-black hover:bg-gray-100'
                                                : isCorrect ? 'bg-[#bef264] text-[#0a0908]' : 'bg-[#0e0d0b] text-[#a8a29e] border border-[#2e2924] hover:border-[#bef264] hover:text-[#f5f3ec]'
                                        }`}
                                    >
                                        {isCorrect ? 'Correct ✓' : 'Mark'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* --- 5. SHORT ANSWER / TEXT SUB-EDITOR --- */}
            {currentType === 'text' && (
                <div className={`space-y-3 p-4 rounded-xl ${
                    isBento
                        ? 'bg-[#f7fee7] border-2 border-black shadow-[3px_3px_0px_#000]'
                        : 'bg-[#141210] border border-[#bef264]/30'
                }`}>
                    <div className="flex items-center gap-2">
                        <AlignLeft className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                        <span className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                            Short Answer Key & Accepted Synonyms
                        </span>
                    </div>

                    <div>
                        <input
                            placeholder="e.g. Paris or Paris, City of Light"
                            value={typeof question.correctAnswer === 'string' ? question.correctAnswer : (Array.isArray(question.correctAnswer) ? question.correctAnswer.join(', ') : '')}
                            onChange={e => onChange({ ...question, correctAnswer: e.target.value })}
                            className={`w-full rounded-xl px-3.5 py-2.5 font-bold text-base focus:outline-none ${
                                isBento
                                    ? 'bg-white border-2 border-black text-black focus:shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                            }`}
                        />
                        <p className={`text-[11px] font-bold mt-1.5 ${isBento ? 'text-gray-700' : 'text-[#a8a29e]'}`}>
                            💡 Separate acceptable alternatives with a comma (e.g. <span className="font-mono font-black">42, forty-two</span>). Evaluation is case-insensitive and trims whitespace automatically.
                        </p>
                    </div>
                </div>
            )}

            {/* --- 6. COMPILER SUB-EDITOR --- */}
            {currentType === 'compiler' && (
                <div className={`space-y-3 p-4 rounded-xl ${
                    isBento
                        ? 'bg-[#f5f3ec] border-2 border-black shadow-[3px_3px_0px_#000]'
                        : 'bg-[#141210] border border-[#2e2924]'
                }`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={`text-xs font-black uppercase tracking-wider block mb-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                Default Language
                            </label>
                            <div className="relative">
                                <select
                                    value={question.compilerConfig?.language || 'javascript'}
                                    onChange={e => {
                                        const newLang = e.target.value;
                                        const currentRef = question.compilerConfig?.referenceCode || '';
                                        const isPlaceholder = !currentRef || currentRef.trim() === '' ||
                                            /^\s*(\/\/|#)\s*Enter the correct code solution/.test(currentRef);

                                        const newCommentPrefix = newLang.includes('python') ? '#' : '//';
                                        const newRef = isPlaceholder
                                            ? `${newCommentPrefix} Enter the correct code solution here...`
                                            : currentRef;

                                        onChange({
                                            ...question,
                                            compilerConfig: {
                                                ...(question.compilerConfig || { allowedLanguages: ['javascript'] }),
                                                language: newLang,
                                                initialCode: COMPILER_INITIAL_CODE[newLang] || '',
                                                referenceCode: newRef
                                            }
                                        });
                                    }}
                                    className={`w-full rounded-xl pl-3 pr-10 py-2.5 font-bold appearance-none cursor-pointer focus:outline-none ${
                                        isBento
                                            ? 'bg-white border-2 border-black text-black focus:shadow-[3px_3px_0px_#000]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                    }`}
                                >
                                    <option value="javascript">JavaScript</option>
                                    <option value="python">Python</option>
                                    <option value="typescript">TypeScript</option>
                                </select>
                                <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className={`text-xs font-black uppercase tracking-wider block mb-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                Allowed Languages (comma separated)
                            </label>
                            <input
                                value={question.compilerConfig?.allowedLanguages?.join(', ') || 'javascript'}
                                onChange={e => onChange({
                                    ...question,
                                    compilerConfig: {
                                        ...(question.compilerConfig || { language: 'javascript', initialCode: '', referenceCode: '' }),
                                        allowedLanguages: e.target.value.split(',').map(s => s.trim())
                                    }
                                })}
                                className={`w-full rounded-xl px-3.5 py-2.5 font-bold focus:outline-none ${
                                    isBento
                                        ? 'bg-white border-2 border-black text-black focus:shadow-[3px_3px_0px_#000]'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                }`}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={`text-xs font-black uppercase tracking-wider block mb-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                            Reference Solution Code
                        </label>
                        <div className={isBento ? 'border-2 border-black rounded-xl overflow-hidden shadow-[2px_2px_0px_#000]' : 'border border-[#2e2924] rounded-xl overflow-hidden'}>
                            <CompilerQuestion
                                language={question.compilerConfig?.language || 'javascript'}
                                allowedLanguages={question.compilerConfig?.allowedLanguages}
                                initialCode={question.compilerConfig?.referenceCode}
                                onChange={(code) => onChange({
                                    ...question,
                                    compilerConfig: {
                                        ...(question.compilerConfig || { language: 'javascript', initialCode: '', allowedLanguages: ['javascript'] }),
                                        referenceCode: code
                                    }
                                })}
                                readOnly={false}
                                className="h-64"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Points and Explanation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Points */}
                <div className="space-y-1">
                    <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        isBento ? 'text-black' : 'text-[#a8a29e]'
                    }`}>
                        <Star className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                        <span>Points</span>
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            min="1"
                            value={question.points}
                            onChange={e => onChange({ ...question, points: parseInt(e.target.value) || 0 })}
                            className={`w-full rounded-xl px-3.5 py-2.5 font-black text-center focus:outline-none ${
                                isBento
                                    ? 'bg-white border-2 border-black text-black focus:shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                            }`}
                        />
                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black pointer-events-none ${isBento ? 'text-gray-500' : 'text-[#78716c]'}`}>
                            pts
                        </span>
                    </div>
                </div>

                {/* Explanation */}
                <div className="sm:col-span-2 space-y-1">
                    <label className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        isBento ? 'text-black' : 'text-[#a8a29e]'
                    }`}>
                        <Lightbulb className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                        <span>Explanation & Solution Hint</span>
                    </label>
                    <input
                        placeholder="Why this answer is correct (supports LaTeX $...$)"
                        value={question.explanation || ''}
                        onChange={e => onChange({ ...question, explanation: e.target.value })}
                        className={`w-full rounded-xl px-3.5 py-2.5 font-semibold text-sm focus:outline-none ${
                            isBento
                                ? 'bg-white border-2 border-black text-black placeholder-gray-400 focus:shadow-[3px_3px_0px_#000]'
                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder-[#78716c] focus:border-[#bef264]'
                        }`}
                    />
                </div>
            </div>

            {/* Explanation Math Preview */}
            {question.explanation && (question.explanation.includes('$') || question.explanation.includes('\\(') || question.explanation.includes('\\[')) && (
                <div className={`p-3 rounded-xl text-xs space-y-1 ${
                    isBento
                        ? 'bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                        : 'bg-[#1e1b13] border border-[#fde047]/35 text-[#f5f3ec]'
                }`}>
                    <div className={`font-black flex items-center gap-1.5 uppercase text-[10px] tracking-wider ${isBento ? 'text-black' : 'text-[#fde047]'}`}>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Explanation Formula Preview:</span>
                    </div>
                    <div className="pl-1 font-medium">
                        <MathRenderer text={question.explanation} className={isBento ? 'text-black font-semibold' : 'text-[#f5f3ec]'} />
                    </div>
                </div>
            )}

            {/* Bottom Save / Cancel Action Bar */}
            <div className="flex items-center gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className={`flex-1 py-3 rounded-xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer ${
                        isBento
                            ? 'bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-gray-100 active:translate-x-0.5 active:translate-y-0.5'
                            : 'bg-[#0e0d0b] text-[#d6d0c7] border border-[#2e2924] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                    }`}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    className={`flex-1 py-3 rounded-xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        isBento
                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                            : 'bg-[#bef264] text-[#0a0908] border border-[#bef264] hover:bg-[#d2fa8a] shadow-[0_3px_0_#050504]'
                    }`}
                >
                    <Save className="w-4 h-4" />
                    <span>Save Question</span>
                </button>
            </div>
        </div>
    );
};

export default QuestionEditor;
