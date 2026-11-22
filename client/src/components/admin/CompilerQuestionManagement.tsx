import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import type { CompilerQuestion } from '../../types';
import Modal from '../common/Modal';
import { useTheme } from '../../context/ThemeContext';
import ConfirmDialog from '../ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import { Plus, Edit2, Trash2, RefreshCw, Code2, Save, X, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Upload, Download } from 'lucide-react';

interface CompilerQuestionManagementProps {
    adminId: string;
}

/**
 * Admin component for managing compiler questions used in daily challenges.
 * Provides CRUD operations and bulk upload functionality.
 */
const CompilerQuestionManagement: React.FC<CompilerQuestionManagementProps> = ({ adminId }) => {
    const { isBento } = useTheme();
    const { confirm, confirmState, handleCancel } = useConfirm();
    const [questions, setQuestions] = useState<CompilerQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Import modal state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importJson, setImportJson] = useState('');
    const [importPreview, setImportPreview] = useState<Partial<CompilerQuestion>[]>([]);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const initialForm = {
        title: '',
        description: '',
        referenceCode: '',
        language: 'javascript',
        difficulty: 'medium',
        category: 'general',
        hints: [] as string[],
        rewardCoins: 100,
        rewardXP: 150,
        isActive: true
    };
    const [form, setForm] = useState(initialForm);
    const [hintInput, setHintInput] = useState('');

    /**
     * Fetch all compiler questions from the API
     */
    const loadQuestions = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getCompilerQuestionsAdmin(adminId);
            setQuestions(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load questions';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [adminId]);

    useEffect(() => {
        loadQuestions();
    }, [loadQuestions]);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /**
     * Create a new compiler question
     */
    const handleCreate = async () => {
        if (!form.title || !form.description || !form.referenceCode) {
            setError('Title, description, and reference code are required');
            return;
        }

        try {
            await api.createCompilerQuestion({
                title: form.title,
                description: form.description,
                referenceCode: form.referenceCode,
                language: form.language,
                difficulty: form.difficulty,
                category: form.category,
                hints: form.hints,
                rewardCoins: form.rewardCoins,
                rewardXP: form.rewardXP
            }, adminId);

            setSuccess('Question created successfully');
            setShowCreate(false);
            setForm(initialForm);
            loadQuestions();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create question');
        }
    };

    /**
     * Update an existing compiler question
     */
    const handleUpdate = async (id: string) => {
        try {
            await api.updateCompilerQuestion(id, form, adminId);
            setSuccess('Question updated successfully');
            setEditingId(null);
            loadQuestions();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to update question');
        }
    };

    /**
     * Delete a compiler question
     */
    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: 'Delete Question',
            message: 'Are you sure you want to permanently delete this compiler question? This action cannot be undone.',
            confirmText: 'Delete',
            type: 'danger'
        });
        if (!confirmed) return;

        try {
            await api.deleteCompilerQuestion(id, adminId);
            setSuccess('Question deleted successfully');
            loadQuestions();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to delete question');
        }
    };

    /**
     * Start editing a question
     */
    const startEdit = (q: CompilerQuestion) => {
        setEditingId(q.questionId);
        setForm({
            title: q.title,
            description: q.description,
            referenceCode: q.referenceCode || '',
            language: q.language,
            difficulty: q.difficulty,
            category: q.category,
            hints: q.hints || [],
            rewardCoins: q.rewardCoins,
            rewardXP: q.rewardXP,
            isActive: q.isActive
        });
    };

    /**
     * Add a hint to the form
     */
    const addHint = () => {
        if (hintInput.trim()) {
            setForm(prev => ({ ...prev, hints: [...prev.hints, hintInput.trim()] }));
            setHintInput('');
        }
    };

    /**
     * Remove a hint from the form
     */
    const removeHint = (index: number) => {
        setForm(prev => ({ ...prev, hints: prev.hints.filter((_, i) => i !== index) }));
    };

    /**
     * Clear notifications after 3 seconds
     */
    useEffect(() => {
        if (success) {
            const t = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(t);
        }
    }, [success]);

    useEffect(() => {
        if (error) {
            const t = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(t);
        }
    }, [error]);

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
            case 'hard': return 'bg-red-500/10 border-red-500/20 text-red-400';
            default: return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
        }
    };

    // ===== JSON Import/Export =====
    const handleDownloadSampleJson = () => {
        const a = document.createElement('a');
        a.href = '/samples/compiler-questions-sample.json';
        a.download = 'compiler-questions-sample.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setSuccess('Sample JSON downloaded');
        setShowMenu(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            setImportJson(text);
            try {
                const parsed = JSON.parse(text);
                setImportPreview(Array.isArray(parsed) ? parsed : [parsed]);
            } catch { setImportPreview([]); }
        };
        reader.readAsText(file);
        if (e.target) e.target.value = '';
        setShowImportModal(true);
        setShowMenu(false);
    };

    const handleImportSubmit = async () => {
        if (importPreview.length === 0) { setError('No valid questions to import'); return; }
        let count = 0;
        for (const q of importPreview) {
            try {
                await api.createCompilerQuestion({
                    title: q.title || 'Untitled', description: q.description || '', referenceCode: q.referenceCode || '',
                    language: q.language || 'javascript', difficulty: q.difficulty || 'medium', category: q.category || 'general',
                    hints: q.hints || [], rewardCoins: q.rewardCoins || 100, rewardXP: q.rewardXP || 150
                }, adminId);
                count++;
            } catch (err) { console.error('Import error:', err); }
        }
        setSuccess(`Imported ${count} question(s)`);
        setShowImportModal(false); setImportJson(''); setImportPreview([]);
        loadQuestions();
    };

    return (
        <div className="p-6 bg-transparent min-h-screen">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                            <Code2 className="w-7 h-7 text-orange-500" />
                            Compiler Questions
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage coding challenges for daily challenges</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={loadQuestions} className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors" title="Refresh">
                            <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        {/* Import/Export Menu */}
                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setShowMenu(!showMenu)} className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                Import/Export <ChevronDown className="w-4 h-4" />
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#141210] border border-gray-200 dark:border-[#f5f3ec]/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                    <button onClick={handleDownloadSampleJson} className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 font-medium text-sm flex items-center gap-3">
                                        <Download className="w-4 h-4 text-teal-500" /> Download Sample JSON
                                    </button>
                                    <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 font-medium text-sm flex items-center gap-3 border-t border-gray-100 dark:border-[#f5f3ec]/10">
                                        <Upload className="w-4 h-4 text-indigo-500" /> Import from JSON
                                    </button>
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} accept=".json" onChange={handleFileUpload} className="hidden" />
                        </div>
                        <button onClick={() => { setShowCreate(true); setForm(initialForm); }} className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center gap-2 transition-all">
                            <Plus className="w-4 h-4" /> Add Question
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                {error && (
                    <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        {success}
                    </div>
                )}

                {/* Import Modal */}
                <Modal
                    isOpen={showImportModal}
                    onClose={() => { setShowImportModal(false); setImportJson(''); setImportPreview([]); }}
                    title="Import Questions"
                    description="Paste JSON or upload a file to bulk import compiler questions"
                    maxWidth="max-w-2xl"
                    icon={<Upload className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />}
                    footer={
                        <>
                            <button
                                onClick={() => { setShowImportModal(false); setImportJson(''); setImportPreview([]); }}
                                className={`flex-1 py-3 rounded-xl font-bold transition-colors cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec]'
                                        : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                                }`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImportSubmit}
                                disabled={importPreview.length === 0}
                                className={`flex-1 py-3 rounded-xl font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                    isBento
                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] font-mono'
                                        : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                }`}
                            >
                                Import {importPreview.length} Question(s)
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <textarea
                            value={importJson}
                            onChange={e => { setImportJson(e.target.value); try { const p = JSON.parse(e.target.value); setImportPreview(Array.isArray(p) ? p : [p]); } catch { setImportPreview([]); } }}
                            placeholder='Paste JSON array here, e.g.:\n[\n  { "title": "...", "description": "...", ... }\n]'
                            className={`w-full h-48 font-mono text-sm p-4 rounded-xl outline-none resize-none ${
                                isBento
                                    ? 'bg-[#f5f3ec] text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                    : 'bg-[#0e0d0b] text-[#bef264] border border-[#2e2924] focus:border-[#bef264] placeholder:text-[#78716c]'
                            }`}
                        />
                        {importPreview.length > 0 && (
                            <div className={`p-4 rounded-xl ${
                                isBento
                                    ? 'bg-[#bef264]/35 border-2 border-black text-black'
                                    : 'bg-[#1c2317] border border-[#bef264]/35'
                            }`}>
                                <p className={`font-bold text-sm mb-2 ${isBento ? 'text-black' : 'text-[#bef264]'}`}>
                                    ✓ {importPreview.length} valid question(s) detected:
                                </p>
                                <ul className={`space-y-1 text-sm max-h-32 overflow-y-auto custom-scrollbar ${isBento ? 'text-neutral-800' : 'text-[#d6d0c7]'}`}>
                                    {importPreview.slice(0, 5).map((q, i) => (
                                        <li key={i} className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${isBento ? 'bg-black' : 'bg-[#bef264]'}`} />
                                            {q.title || 'Untitled'} ({q.difficulty || 'medium'})
                                        </li>
                                    ))}
                                    {importPreview.length > 5 && <li className="opacity-70 italic pl-3">...and {importPreview.length - 5} more</li>}
                                </ul>
                            </div>
                        )}
                        {importJson && importPreview.length === 0 && (
                            <div className={`p-4 rounded-xl ${
                                isBento
                                    ? 'bg-[#fecdd3] border-2 border-black text-black'
                                    : 'bg-[#251317] border border-[#fb7185]/35 text-[#fda4af]'
                            }`}>
                                <p className="font-bold text-sm">⚠️ Invalid JSON format. Please check your input.</p>
                            </div>
                        )}
                    </div>
                </Modal>

                {/* Create/Edit Form Modal */}
                <Modal
                    isOpen={showCreate || !!editingId}
                    onClose={() => { setShowCreate(false); setEditingId(null); }}
                    title={editingId ? 'Edit Challenge' : 'New Challenge'}
                    description={editingId ? 'Update existing compiler question details' : 'Create a new coding challenge for users'}
                    maxWidth="max-w-3xl"
                    footer={
                        <>
                            <button
                                onClick={() => { setShowCreate(false); setEditingId(null); }}
                                className={`px-6 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec]'
                                        : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                                }`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
                                className={`px-8 py-2.5 rounded-xl font-black flex items-center gap-2 active:scale-95 transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                }`}
                            >
                                <Save className="w-4 h-4" />
                                {editingId ? 'Save Changes' : 'Create Challenge'}
                            </button>
                        </>
                    }
                >
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                    Challenge Title <span className={isBento ? 'text-red-600' : 'text-[#fb7185]'}>*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                                    className={`w-full p-4 rounded-xl focus:outline-none transition-all font-medium text-lg ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder-[#78716c] focus:border-[#bef264]'
                                    }`}
                                    placeholder="e.g., Reverse a Linked List"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                    Description (Markdown supported) <span className={isBento ? 'text-red-600' : 'text-[#fb7185]'}>*</span>
                                </label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                                    rows={5}
                                    className={`w-full p-4 rounded-xl focus:outline-none transition-all resize-y min-h-[120px] ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder-[#78716c] focus:border-[#bef264]'
                                    }`}
                                    placeholder="Describe the problem, input/output format, and constraints..."
                                />
                            </div>

                            <div className="col-span-2">
                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                    Reference Solution <span className={isBento ? 'text-red-600' : 'text-[#fb7185]'}>*</span>
                                </label>
                                <div className="relative">
                                    <div className={`absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-mono pointer-events-none ${
                                        isBento
                                            ? 'bg-[#fde047] text-black border border-black font-bold'
                                            : 'bg-[#1a1714] border border-[#2e2924] text-[#fde047]'
                                    }`}>
                                        {form.language}
                                    </div>
                                    <textarea
                                        value={form.referenceCode}
                                        onChange={(e) => setForm(prev => ({ ...prev, referenceCode: e.target.value }))}
                                        rows={8}
                                        className={`w-full p-4 rounded-xl font-mono text-sm focus:outline-none transition-all resize-y min-h-[200px] ${
                                            isBento
                                                ? 'bg-[#f5f3ec] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#bef264] focus:border-[#bef264]'
                                        }`}
                                        placeholder="// Paste the complete working solution here..."
                                        spellCheck={false}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Language</label>
                                <div className="relative">
                                    <select
                                        value={form.language}
                                        onChange={(e) => setForm(prev => ({ ...prev, language: e.target.value }))}
                                        className={`w-full p-3 pl-4 pr-10 rounded-xl appearance-none focus:outline-none cursor-pointer font-medium ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                        }`}
                                    >
                                        <option value="javascript">JavaScript (Node.js)</option>
                                        <option value="typescript">TypeScript</option>
                                        <option value="python">Python 3</option>
                                        <option value="java">Java</option>
                                        <option value="cpp">C++</option>
                                        <option value="csharp">C#</option>
                                    </select>
                                    <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isBento ? 'text-black' : 'text-[#a8a29e]'}`} />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Difficulty</label>
                                <div className="relative">
                                    <select
                                        value={form.difficulty}
                                        onChange={(e) => setForm(prev => ({ ...prev, difficulty: e.target.value }))}
                                        className={`w-full p-3 pl-4 pr-10 rounded-xl appearance-none focus:outline-none cursor-pointer font-medium ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                        }`}
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                    <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isBento ? 'text-black' : 'text-[#a8a29e]'}`} />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Category</label>
                                <input
                                    type="text"
                                    value={form.category}
                                    onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                                    className={`w-full p-3 rounded-xl focus:outline-none font-medium ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                    }`}
                                    placeholder="e.g., Arrays, DP"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Coins Reward</label>
                                    <input
                                        type="number"
                                        value={form.rewardCoins}
                                        onChange={(e) => setForm(prev => ({ ...prev, rewardCoins: parseInt(e.target.value) || 0 }))}
                                        className={`w-full p-3 rounded-xl focus:outline-none font-bold ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                        }`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>XP Reward</label>
                                    <input
                                        type="number"
                                        value={form.rewardXP}
                                        onChange={(e) => setForm(prev => ({ ...prev, rewardXP: parseInt(e.target.value) || 0 }))}
                                        className={`w-full p-3 rounded-xl focus:outline-none font-bold ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                        }`}
                                    />
                                </div>
                            </div>

                            {/* Hints */}
                            <div className="col-span-1 md:col-span-2">
                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Hints</label>
                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        value={hintInput}
                                        onChange={(e) => setHintInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHint())}
                                        className={`flex-1 p-3 rounded-xl focus:outline-none ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                        }`}
                                        placeholder="Type a hint and press Enter..."
                                    />
                                    <button
                                        type="button"
                                        onClick={addHint}
                                        className={`px-4 rounded-xl transition-colors cursor-pointer ${
                                            isBento
                                                ? 'bg-[#fde047] hover:bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#1a1714] border border-[#2e2924] hover:border-[#bef264]/60 text-[#bef264]'
                                        }`}
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                                {form.hints.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {form.hints.map((hint, idx) => (
                                            <div key={idx} className={`flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg text-sm group ${
                                                isBento
                                                    ? 'bg-[#bae6fd] border border-black text-black font-bold'
                                                    : 'bg-[#151e24] border border-[#bae6fd]/30 text-[#bae6fd]'
                                            }`}>
                                                <span className="max-w-[200px] truncate">{hint}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeHint(idx)}
                                                    className="p-0.5 rounded-full hover:bg-black/15 dark:hover:bg-white/10 cursor-pointer"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>

                {/* Questions List */}
                {loading ? (
                    <div className="text-center py-12">
                        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">Loading questions...</p>
                    </div>
                ) : questions.length === 0 ? (
                    <div className="bg-white dark:bg-[#141210] rounded-2xl border border-gray-200 dark:border-white/10 p-12 text-center">
                        <Code2 className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-500 dark:text-gray-400 mb-2">No Questions Yet</h3>
                        <p className="text-gray-400 dark:text-gray-500 mb-4">Create your first compiler question to get started.</p>
                        <button
                            onClick={() => { setShowCreate(true); setForm(initialForm); }}
                            className="px-6 py-2 rounded-xl bg-orange-500 text-white font-bold inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add First Question
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {questions.map((q) => (
                            <div
                                key={q.questionId}
                                className="bg-white dark:bg-[#141210] rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden"
                            >
                                <div className="p-5 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                                        {q.difficulty.charAt(0).toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${getDifficultyColor(q.difficulty)}`}>
                                                {q.difficulty}
                                            </span>
                                            <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                                {q.language}
                                            </span>
                                            <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">
                                                {q.category}
                                            </span>
                                            {!q.isActive && (
                                                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-red-500/10 border border-red-500/20 text-red-400">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-white truncate">{q.title}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{q.description}</p>
                                    </div>

                                    {/* Stats */}
                                    {q.stats && (
                                        <div className="hidden md:flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                            <div className="text-center">
                                                <div className="font-bold text-gray-900 dark:text-white">{q.stats.totalSubmissions || 0}</div>
                                                <div className="text-xs">Submissions</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="font-bold text-emerald-500">{q.stats.passRate?.toFixed(0) || 0}%</div>
                                                <div className="text-xs">Pass Rate</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setExpandedId(expandedId === q.questionId ? null : q.questionId)}
                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                        >
                                            {expandedId === q.questionId ? (
                                                <ChevronUp className="w-5 h-5 text-gray-500" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-500" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => startEdit(q)}
                                            className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-500 transition-colors"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(q.questionId)}
                                            className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedId === q.questionId && (
                                    <div className="px-5 pb-5 pt-0 border-t border-gray-100 dark:border-white/5">
                                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="font-bold text-gray-500 dark:text-gray-400">Rewards:</span>
                                                <span className="ml-2 text-gray-900 dark:text-white">{q.rewardCoins} coins, {q.rewardXP} XP</span>
                                            </div>
                                            <div>
                                                <span className="font-bold text-gray-500 dark:text-gray-400">Usage:</span>
                                                <span className="ml-2 text-gray-900 dark:text-white">{q.usageCount || 0} times used</span>
                                            </div>
                                        </div>
                                        {q.hints && q.hints.length > 0 && (
                                            <div className="mt-3">
                                                <span className="font-bold text-gray-500 dark:text-gray-400 text-sm">Hints:</span>
                                                <ul className="mt-1 list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                                                    {q.hints.map((hint, idx) => (
                                                        <li key={idx}>{hint}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <div className="mt-3">
                                            <span className="font-bold text-gray-500 dark:text-gray-400 text-sm">Reference Code:</span>
                                            <pre className="mt-1 p-3 rounded-xl bg-gray-50 dark:bg-[#0a0908] border border-gray-200 dark:border-white/10 text-sm font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                                                {q.referenceCode}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {confirmState.isOpen && (
                <ConfirmDialog
                    title={confirmState.title}
                    message={confirmState.message}
                    confirmText={confirmState.confirmText}
                    cancelText={confirmState.cancelText}
                    type={confirmState.type}
                    onConfirm={confirmState.onConfirm}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
};

export default CompilerQuestionManagement;
