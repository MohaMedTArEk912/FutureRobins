import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Check,
    Plus,
    Trash2,
    ArrowUp,
    ArrowDown,
    Copy,
    Code2,
    Sparkles,
    Eye,
    FileJson,
    LayoutGrid,
    Upload,
    HelpCircle,
    ListChecks,
    MonitorPlay
} from 'lucide-react';
import type {
    MotionPresentation,
    MotionSlide,
    PresentationTheme,
    SlideLayout,
    SlideMotion,
    SlideCheckupQuestion
} from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import PresentationModePlayer from './PresentationModePlayer';

interface PresentationVisualBoardModalProps {
    deck: MotionPresentation;
    userId: string;
    userName: string;
    onClose: () => void;
    onSaved: (updatedDeck: MotionPresentation) => Promise<void> | void;
    savePresentation: (payload: MotionPresentation) => Promise<unknown>;
}

const SLIDE_LAYOUTS: SlideLayout[] = [
    'hero',
    'bullets',
    'split',
    'code',
    'comparison',
    'timeline',
    'wireframe',
    'live-preview',
    'checkup',
    'homework',
    'summary'
];

const SLIDE_MOTIONS: SlideMotion[] = [
    'fade-up',
    'slide-left',
    'zoom-in',
    'stagger',
    'pop',
    'flip'
];

const DECK_THEMES: { value: PresentationTheme; label: string }[] = [
    { value: 'dark-tech', label: 'Dark Tech' },
    { value: 'bento', label: 'Bento Brutal' },
    { value: 'editorial', label: 'Editorial Paper' },
    { value: 'neon', label: 'Neon Synth' }
];

const createNewSlide = (index: number): MotionSlide => ({
    id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    order: index + 1,
    layout: 'bullets',
    motion: 'fade-up',
    title: `New Slide ${index + 1}`,
    subtitle: '',
    body: '',
    bullets: ['Key concept point 1', 'Key concept point 2'],
    callout: '',
    speakerNotes: ''
});

const sanitizeSlidesOrder = (slides: MotionSlide[]): MotionSlide[] =>
    slides.map((s, idx) => ({
        ...s,
        id: s.id || `slide-${idx + 1}`,
        order: idx + 1
    }));

export const PresentationVisualBoardModal: React.FC<PresentationVisualBoardModalProps> = ({
    deck,
    userId,
    userName,
    onClose,
    onSaved,
    savePresentation
}) => {
    const { isBento } = useTheme();
    const { showNotification } = useNotification();

    const [editorMode, setEditorMode] = useState<'board' | 'json'>('board');
    const [title, setTitle] = useState(deck.title || 'Untitled Presentation');
    const [description, setDescription] = useState(deck.description || '');
    const [deckTheme, setDeckTheme] = useState<PresentationTheme>(deck.theme || 'dark-tech');
    const [slides, setSlides] = useState<MotionSlide[]>(() =>
        Array.isArray(deck.slides) && deck.slides.length > 0
            ? sanitizeSlidesOrder(deck.slides)
            : [createNewSlide(0)]
    );
    const [selectedIdx, setSelectedIdx] = useState(0);

    const [jsonDraft, setJsonDraft] = useState(() =>
        deck.rawJson && deck.rawJson.trim()
            ? deck.rawJson
            : JSON.stringify(
                  {
                      title: deck.title || '',
                      description: deck.description || '',
                      theme: deck.theme || 'dark-tech',
                      slides: deck.slides || []
                  },
                  null,
                  2
              )
    );
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showFullPlayerPreview, setShowFullPlayerPreview] = useState(false);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !showFullPlayerPreview) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose, showFullPlayerPreview]);

    const safeSelectedIdx = Math.min(selectedIdx, Math.max(0, slides.length - 1));
    const currentSlide = slides[safeSelectedIdx] || slides[0];

    const draftPresentation: MotionPresentation = useMemo(
        () => ({
            ...deck,
            title: title.trim() || deck.title,
            description,
            theme: deckTheme,
            slides: sanitizeSlidesOrder(slides)
        }),
        [deck, title, description, deckTheme, slides]
    );

    const syncBoardToJsonText = (
        nextTitle = title,
        nextDesc = description,
        nextTheme = deckTheme,
        nextSlides = slides
    ) => {
        setJsonDraft(
            JSON.stringify(
                {
                    title: nextTitle,
                    description: nextDesc,
                    theme: nextTheme,
                    slides: sanitizeSlidesOrder(nextSlides)
                },
                null,
                2
            )
        );
        setJsonError(null);
    };

    const handleSwitchMode = (target: 'board' | 'json') => {
        if (target === editorMode) return;
        if (target === 'json') {
            syncBoardToJsonText();
            setEditorMode('json');
            return;
        }

        // Switching from raw JSON -> Visual Board: parse and hydrate board state
        try {
            const parsed = JSON.parse(jsonDraft) as Record<string, unknown>;
            if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
                setJsonError('JSON must include a non-empty "slides" array.');
                return;
            }
            if (typeof parsed.title === 'string') setTitle(parsed.title);
            if (typeof parsed.description === 'string') setDescription(parsed.description);
            if (typeof parsed.theme === 'string') setDeckTheme(parsed.theme as PresentationTheme);
            setSlides(sanitizeSlidesOrder(parsed.slides as MotionSlide[]));
            setSelectedIdx(0);
            setJsonError(null);
            setEditorMode('board');
        } catch (err) {
            setJsonError(err instanceof Error ? err.message : 'Invalid JSON syntax.');
        }
    };

    const updateCurrentSlide = (patch: Partial<MotionSlide>) => {
        setSlides(prev =>
            prev.map((slide, idx) => (idx === safeSelectedIdx ? { ...slide, ...patch } : slide))
        );
    };

    const handleAddSlide = () => {
        const nextSlide = createNewSlide(safeSelectedIdx + 1);
        setSlides(prev => {
            const copy = [...prev];
            copy.splice(safeSelectedIdx + 1, 0, nextSlide);
            return sanitizeSlidesOrder(copy);
        });
        setSelectedIdx(safeSelectedIdx + 1);
    };

    const handleDuplicateSlide = (idx: number) => {
        const target = slides[idx];
        if (!target) return;
        const cloned: MotionSlide = {
            ...JSON.parse(JSON.stringify(target)),
            id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: `${target.title} (Copy)`
        };
        setSlides(prev => {
            const copy = [...prev];
            copy.splice(idx + 1, 0, cloned);
            return sanitizeSlidesOrder(copy);
        });
        setSelectedIdx(idx + 1);
    };

    const handleMoveSlide = (idx: number, dir: -1 | 1) => {
        const targetIdx = idx + dir;
        if (targetIdx < 0 || targetIdx >= slides.length) return;
        setSlides(prev => {
            const copy = [...prev];
            const [item] = copy.splice(idx, 1);
            copy.splice(targetIdx, 0, item);
            return sanitizeSlidesOrder(copy);
        });
        setSelectedIdx(targetIdx);
    };

    const handleDeleteSlide = (idx: number) => {
        if (slides.length <= 1) {
            showNotification('error', 'A presentation must have at least 1 slide.');
            return;
        }
        setSlides(prev => sanitizeSlidesOrder(prev.filter((_, i) => i !== idx)));
        setSelectedIdx(prev => Math.max(0, Math.min(prev, slides.length - 2)));
    };

    const handleReplaceJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as Record<string, unknown>;
            if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
                showNotification('error', 'Uploaded JSON must include a non-empty "slides" array.');
                return;
            }
            if (typeof parsed.title === 'string' && parsed.title.trim()) setTitle(parsed.title.trim());
            if (typeof parsed.description === 'string') setDescription(parsed.description);
            if (typeof parsed.theme === 'string') setDeckTheme(parsed.theme as PresentationTheme);
            setSlides(sanitizeSlidesOrder(parsed.slides as MotionSlide[]));
            setSelectedIdx(0);
            setJsonDraft(JSON.stringify(parsed, null, 2));
            setJsonError(null);
            showNotification('success', `Loaded "${file.name}" into the Visual Board & JSON editor!`);
        } catch {
            showNotification('error', 'Selected file does not contain valid JSON.');
        } finally {
            e.target.value = '';
        }
    };

    const handleSave = async () => {
        let finalTitle = title.trim() || deck.title;
        let finalDescription = description;
        let finalTheme = deckTheme;
        let finalSlides = sanitizeSlidesOrder(slides);
        let finalRawJson = '';

        if (editorMode === 'json') {
            try {
                const parsed = JSON.parse(jsonDraft) as Record<string, unknown>;
                if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
                    setJsonError('Presentation JSON must include a non-empty "slides" array.');
                    return;
                }
                finalTitle = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : finalTitle;
                finalDescription = typeof parsed.description === 'string' ? parsed.description : finalDescription;
                finalTheme = (typeof parsed.theme === 'string' ? parsed.theme : finalTheme) as PresentationTheme;
                finalSlides = sanitizeSlidesOrder(parsed.slides as MotionSlide[]);
                finalRawJson = jsonDraft;
            } catch (err) {
                setJsonError(err instanceof Error ? err.message : 'Invalid JSON syntax.');
                return;
            }
        } else {
            if (finalSlides.length === 0) {
                showNotification('error', 'Presentation must include at least 1 slide.');
                return;
            }
            finalRawJson = JSON.stringify(
                {
                    title: finalTitle,
                    description: finalDescription,
                    theme: finalTheme,
                    slides: finalSlides
                },
                null,
                2
            );
        }

        const payload: MotionPresentation = {
            presentationId: deck.presentationId,
            title: finalTitle,
            description: finalDescription,
            trackId: deck.trackId ?? null,
            moduleId: deck.moduleId ?? null,
            moduleIds: deck.moduleIds || (deck.moduleId ? [deck.moduleId] : []),
            theme: finalTheme,
            sourceFormat: 'json',
            rawJson: finalRawJson,
            slides: finalSlides
        };

        setSaving(true);
        try {
            await savePresentation(payload);
            showNotification('success', 'Presentation board & JSON saved!');
            await onSaved(payload);
            onClose();
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to update presentation.');
        } finally {
            setSaving(false);
        }
    };

    const currentBullets = currentSlide?.bullets || [];
    const currentCheckup = currentSlide?.checkupQuestion;

    const previewThemeBg =
        deckTheme === 'bento'
            ? 'bg-[#fefce8] text-black border-2 border-black'
            : deckTheme === 'editorial'
                ? 'bg-[#f8f6f1] text-slate-900 border border-slate-200'
                : deckTheme === 'neon'
                    ? 'bg-[#0b0417] text-white border border-rose-500/30'
                    : 'bg-[#070913] text-white border border-white/10';

    if (typeof document === 'undefined') return null;

    return createPortal(
        <>
            <div
                className="app-dialog-overlay fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 !bg-transparent !border-0 !shadow-none animate-in fade-in duration-150"
                onClick={onClose}
            >
                <div
                    className="modal-backdrop absolute inset-0 bg-black/55 dark:bg-black/70 backdrop-blur-md transition-opacity"
                    onClick={onClose}
                    aria-hidden="true"
                />

                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Presentation Visual Board & JSON Studio"
                    onClick={e => e.stopPropagation()}
                    className={`app-dialog-panel app-dialog-panel--structured relative z-10 w-full max-w-[1320px] h-[92dvh] rounded-3xl overflow-hidden flex flex-col ${
                        isBento
                            ? 'bg-white text-black border-[3px] border-black shadow-[8px_8px_0px_#000]'
                            : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504,0_24px_60px_rgba(0,0,0,0.78)]'
                    }`}
                >
                    {/* Studio Top Bar */}
                    <div
                        className={`app-dialog-header px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 ${
                            isBento
                                ? 'bg-[#fef08a] border-b-[2.5px] border-black'
                                : 'bg-[#1a1714] border-b border-[#2e2924]'
                        }`}
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/35'
                                }`}
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1 max-w-md">
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Presentation Title"
                                    className={`w-full px-3 py-1.5 rounded-xl text-sm font-black outline-none ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black'
                                            : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                    }`}
                                />
                            </div>
                            <select
                                value={deckTheme}
                                onChange={e => setDeckTheme(e.target.value as PresentationTheme)}
                                aria-label="Presentation theme"
                                className={`hidden sm:block px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer outline-none ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black'
                                        : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                }`}
                            >
                                {DECK_THEMES.map(t => (
                                    <option key={t.value} value={t.value}>
                                        Theme: {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Visual Board <-> Raw JSON Mode Switch */}
                            <div
                                className={`flex items-center p-1 rounded-xl ${
                                    isBento
                                        ? 'bg-white border-2 border-black'
                                        : 'bg-[#0e0d0b] border border-[#2e2924]'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => handleSwitchMode('board')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer transition-all ${
                                        editorMode === 'board'
                                            ? isBento
                                                ? 'bg-[#bef264] text-black border border-black'
                                                : 'bg-[#bef264] text-[#0a0908]'
                                            : isBento
                                                ? 'text-black/70 hover:text-black'
                                                : 'text-[#a8a29e] hover:text-[#f5f3ec]'
                                    }`}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    <span>Visual Board</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSwitchMode('json')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer transition-all ${
                                        editorMode === 'json'
                                            ? isBento
                                                ? 'bg-[#bae6fd] text-black border border-black'
                                                : 'bg-[#bef264] text-[#0a0908]'
                                            : isBento
                                                ? 'text-black/70 hover:text-black'
                                                : 'text-[#a8a29e] hover:text-[#f5f3ec]'
                                    }`}
                                >
                                    <FileJson className="w-3.5 h-3.5" />
                                    <span>Raw JSON</span>
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowFullPlayerPreview(true)}
                                className={`px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fed7aa]'
                                        : 'bg-[#141210] border border-[#2e2924] text-[#f5f3ec] hover:border-[#bef264]/50 hover:bg-[#24201c]'
                                }`}
                                title="Open interactive whiteboard preview before saving"
                            >
                                <MonitorPlay className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Full Preview</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#a3e635]'
                                        : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                }`}
                            >
                                <Check className="w-4 h-4" />
                                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close board studio"
                                className={`p-2 rounded-xl cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fecdd3]'
                                        : 'bg-[#141210] border border-[#2e2924] text-[#a8a29e] hover:text-[#f5f3ec] hover:border-[#bef264]/50'
                                }`}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Studio Body */}
                    {editorMode === 'json' ? (
                        <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-black uppercase tracking-wider">
                                    Raw Presentation JSON ({slides.length} slides)
                                </span>
                                <label
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer ${
                                        isBento
                                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/35 hover:bg-[#242e1e]'
                                    }`}
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Replace with .json File</span>
                                    <input type="file" accept=".json" className="hidden" onChange={handleReplaceJsonFile} />
                                </label>
                            </div>
                            {jsonError && (
                                <div className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
                                    isBento
                                        ? 'bg-[#fecdd3] border-2 border-black text-black'
                                        : 'bg-[#251317] border border-[#fb7185]/35 text-[#fda4af]'
                                }`}>
                                    {jsonError}
                                </div>
                            )}
                            <textarea
                                value={jsonDraft}
                                onChange={e => {
                                    setJsonDraft(e.target.value);
                                    setJsonError(null);
                                }}
                                spellCheck={false}
                                className={`flex-1 min-h-0 w-full p-4 rounded-2xl font-mono text-xs resize-none outline-none ${
                                    isBento
                                        ? 'bg-[#f5f3ec] text-black border-2 border-black'
                                        : 'bg-[#0e0d0b] text-[#bef264] border border-[#2e2924] focus:border-[#bef264]'
                                }`}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                            {/* Column 1: Slide Rail (See, Add, Reorder, Duplicate, Delete) */}
                            <aside
                                className={`lg:col-span-3 flex flex-col min-h-0 ${
                                    isBento
                                        ? 'bg-[#f5f3ec] border-b-2 lg:border-b-0 lg:border-r-2 border-black'
                                        : 'bg-[#11100e] border-b lg:border-b-0 lg:border-r border-[#2e2924]'
                                }`}
                            >
                                <div className={`p-3.5 flex items-center justify-between gap-2 shrink-0 border-b ${isBento ? 'border-black/20' : 'border-[#2e2924]'}`}>
                                    <span className="text-xs font-black uppercase tracking-wider">
                                        Slides ({slides.length})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleAddSlide}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1 cursor-pointer ${
                                            isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#a3e635]'
                                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                        }`}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Slide</span>
                                    </button>
                                </div>

                                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                                    {slides.map((s, idx) => {
                                        const isSelected = idx === safeSelectedIdx;
                                        return (
                                            <div
                                                key={s.id || idx}
                                                onClick={() => setSelectedIdx(idx)}
                                                className={`p-3 rounded-2xl cursor-pointer transition-all space-y-2 ${
                                                    isSelected
                                                        ? isBento
                                                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                                            : 'bg-[#1c2317] border-2 border-[#bef264] text-[#f5f3ec]'
                                                        : isBento
                                                            ? 'bg-white text-black border-2 border-black/40 hover:border-black'
                                                            : 'bg-[#1a1714] border border-[#2e2924] hover:border-[#bef264]/50 text-[#f5f3ec]'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-black uppercase opacity-70">
                                                                #{idx + 1}
                                                            </span>
                                                            <span
                                                                className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                                                    isBento
                                                                        ? 'bg-white border border-black text-black'
                                                                        : 'bg-[#24201c] border border-[#3a332c] text-[#fde047]'
                                                                }`}
                                                            >
                                                                {s.layout}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs font-black truncate mt-0.5">
                                                            {s.title || 'Untitled Slide'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    className="flex items-center justify-end gap-1"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveSlide(idx, -1)}
                                                        disabled={idx === 0}
                                                        title="Move Up"
                                                        className="p-1 rounded-lg hover:bg-black/15 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                                                    >
                                                        <ArrowUp className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveSlide(idx, 1)}
                                                        disabled={idx === slides.length - 1}
                                                        title="Move Down"
                                                        className="p-1 rounded-lg hover:bg-black/15 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                                                    >
                                                        <ArrowDown className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDuplicateSlide(idx)}
                                                        title="Duplicate Slide"
                                                        className="p-1 rounded-lg hover:bg-black/15 dark:hover:bg-white/10 cursor-pointer"
                                                    >
                                                        <Copy className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteSlide(idx)}
                                                        disabled={slides.length <= 1}
                                                        title="Delete Slide"
                                                        className="p-1 rounded-lg text-[#fb7185] hover:bg-[#fb7185]/15 disabled:opacity-30 cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </aside>

                            {/* Column 2: Slide Form Editor */}
                            <section className="lg:col-span-5 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-xs font-black uppercase tracking-wider">
                                        Editing Slide #{safeSelectedIdx + 1}
                                    </h3>
                                    <span className="text-[11px] font-bold opacity-65">
                                        Changes preview live on the right →
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase opacity-70 block mb-1">
                                            Layout
                                        </label>
                                        <select
                                            value={currentSlide?.layout || 'bullets'}
                                            onChange={e => updateCurrentSlide({ layout: e.target.value as SlideLayout })}
                                            className={`w-full px-3 py-2 rounded-xl text-xs font-bold cursor-pointer outline-none ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black'
                                                    : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                            }`}
                                        >
                                            {SLIDE_LAYOUTS.map(l => (
                                                <option key={l} value={l}>
                                                    {l}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase opacity-70 block mb-1">
                                            Motion Effect
                                        </label>
                                        <select
                                            value={currentSlide?.motion || 'fade-up'}
                                            onChange={e => updateCurrentSlide({ motion: e.target.value as SlideMotion })}
                                            className={`w-full px-3 py-2 rounded-xl text-xs font-bold cursor-pointer outline-none ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black'
                                                    : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                            }`}
                                        >
                                            {SLIDE_MOTIONS.map(m => (
                                                <option key={m} value={m}>
                                                    {m}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase opacity-70 block mb-1">
                                        Slide Title
                                    </label>
                                    <input
                                        type="text"
                                        value={currentSlide?.title || ''}
                                        onChange={e => updateCurrentSlide({ title: e.target.value })}
                                        className={`w-full px-3.5 py-2 rounded-xl text-sm font-bold outline-none ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black'
                                                : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                        }`}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase opacity-70 block mb-1">
                                        Subtitle
                                    </label>
                                    <input
                                        type="text"
                                        value={currentSlide?.subtitle || ''}
                                        onChange={e => updateCurrentSlide({ subtitle: e.target.value })}
                                        placeholder="Optional subtitle"
                                        className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold outline-none ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black'
                                                : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                        }`}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase opacity-70 block mb-1">
                                        Body Copy
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={currentSlide?.body || ''}
                                        onChange={e => updateCurrentSlide({ body: e.target.value })}
                                        placeholder="Main explanation paragraph for this slide..."
                                        className={`w-full px-3.5 py-2 rounded-xl text-xs font-medium outline-none ${
                                            isBento
                                                ? 'bg-white text-black border-2 border-black'
                                                : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                        }`}
                                    />
                                </div>

                                {/* Bullet Points Editor */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase opacity-70 flex items-center gap-1">
                                            <ListChecks className="w-3.5 h-3.5" /> Bullet Points ({currentBullets.length})
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateCurrentSlide({
                                                    bullets: [...currentBullets, `Point ${currentBullets.length + 1}`]
                                                })
                                            }
                                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer ${
                                                isBento
                                                    ? 'bg-[#bef264] text-black border border-black'
                                                    : 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/35 hover:bg-[#242e1e]'
                                            }`}
                                        >
                                            <Plus className="w-3 h-3" /> Add Bullet
                                        </button>
                                    </div>
                                    <div className="space-y-1.5">
                                        {currentBullets.map((bullet, bIdx) => (
                                            <div key={bIdx} className="flex items-center gap-1.5">
                                                <input
                                                    type="text"
                                                    value={bullet}
                                                    onChange={e => {
                                                        const next = [...currentBullets];
                                                        next[bIdx] = e.target.value;
                                                        updateCurrentSlide({ bullets: next });
                                                    }}
                                                    className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold outline-none ${
                                                        isBento
                                                            ? 'bg-white text-black border-2 border-black'
                                                            : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                                    }`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        updateCurrentSlide({
                                                            bullets: currentBullets.filter((_, i) => i !== bIdx)
                                                        })
                                                    }
                                                    className="p-1.5 rounded-lg text-[#fb7185] hover:bg-[#fb7185]/15 cursor-pointer"
                                                    aria-label="Remove bullet"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Code Snippet Editor */}
                                <div className={`space-y-2 pt-2 border-t ${isBento ? 'border-black/20' : 'border-[#2e2924]'}`}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase opacity-70 flex items-center gap-1">
                                            <Code2 className="w-3.5 h-3.5" /> Code Snippet
                                        </label>
                                        {currentSlide?.codeSnippet ? (
                                            <button
                                                type="button"
                                                onClick={() => updateCurrentSlide({ codeSnippet: undefined })}
                                                className="text-[10px] font-black uppercase text-[#fb7185] cursor-pointer hover:underline"
                                            >
                                                Remove Code
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateCurrentSlide({
                                                        codeSnippet: { language: 'html', code: '<div>Hello World</div>' }
                                                    })
                                                }
                                                className={`text-[10px] font-black uppercase cursor-pointer hover:underline ${isBento ? 'text-black' : 'text-[#bef264]'}`}
                                            >
                                                + Add Code Snippet
                                            </button>
                                        )}
                                    </div>
                                    {currentSlide?.codeSnippet && (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={currentSlide.codeSnippet.language}
                                                onChange={e =>
                                                    updateCurrentSlide({
                                                        codeSnippet: {
                                                            ...currentSlide.codeSnippet!,
                                                            language: e.target.value
                                                        }
                                                    })
                                                }
                                                placeholder="Language (html, css, js, python)"
                                                className={`w-full px-3 py-1.5 rounded-xl text-xs font-mono font-bold outline-none ${
                                                    isBento
                                                        ? 'bg-white text-black border-2 border-black'
                                                        : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                                }`}
                                            />
                                            <textarea
                                                rows={4}
                                                value={currentSlide.codeSnippet.code}
                                                onChange={e =>
                                                    updateCurrentSlide({
                                                        codeSnippet: {
                                                            ...currentSlide.codeSnippet!,
                                                            code: e.target.value
                                                        }
                                                    })
                                                }
                                                className={`w-full px-3 py-2 rounded-xl font-mono text-xs outline-none ${
                                                    isBento
                                                        ? 'bg-[#f5f3ec] text-black border-2 border-black'
                                                        : 'bg-[#0e0d0b] text-[#bef264] border border-[#2e2924] focus:border-[#bef264]'
                                                }`}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Callout & Notes */}
                                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t ${isBento ? 'border-black/20' : 'border-[#2e2924]'}`}>
                                    <div>
                                        <label className="text-[10px] font-black uppercase opacity-70 block mb-1">
                                            Callout Box
                                        </label>
                                        <input
                                            type="text"
                                            value={currentSlide?.callout || ''}
                                            onChange={e => updateCurrentSlide({ callout: e.target.value })}
                                            placeholder="Tip / key takeaway..."
                                            className={`w-full px-3 py-1.5 rounded-xl text-xs font-semibold outline-none ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black'
                                                    : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase opacity-70 block mb-1">
                                            Speaker Notes
                                        </label>
                                        <input
                                            type="text"
                                            value={currentSlide?.speakerNotes || ''}
                                            onChange={e => updateCurrentSlide({ speakerNotes: e.target.value })}
                                            placeholder="Private teacher reminder..."
                                            className={`w-full px-3 py-1.5 rounded-xl text-xs font-semibold outline-none ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black'
                                                    : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                            }`}
                                        />
                                    </div>
                                </div>

                                {/* Check-Up Poll Question Editor */}
                                <div className={`space-y-2 pt-2 border-t ${isBento ? 'border-black/20' : 'border-[#2e2924]'}`}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase opacity-70 flex items-center gap-1">
                                            <HelpCircle className="w-3.5 h-3.5" /> Live Check-Up Quiz
                                        </label>
                                        {currentCheckup ? (
                                            <button
                                                type="button"
                                                onClick={() => updateCurrentSlide({ checkupQuestion: undefined })}
                                                className="text-[10px] font-black uppercase text-[#fb7185] cursor-pointer hover:underline"
                                            >
                                                Remove Check-Up
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateCurrentSlide({
                                                        checkupQuestion: {
                                                            question: 'Quick Check: Which option is correct?',
                                                            options: ['Option A', 'Option B', 'Option C'],
                                                            correctAnswer: 0,
                                                            explanation: ''
                                                        }
                                                    })
                                                }
                                                className={`text-[10px] font-black uppercase cursor-pointer hover:underline ${isBento ? 'text-black' : 'text-[#bef264]'}`}
                                            >
                                                + Add Check-Up Poll
                                            </button>
                                        )}
                                    </div>
                                    {currentCheckup && (
                                        <div className={`space-y-2 p-3 rounded-xl border ${isBento ? 'bg-[#f5f3ec] border-black/25' : 'bg-[#1a1714] border-[#2e2924]'}`}>
                                            <input
                                                type="text"
                                                value={currentCheckup.question}
                                                onChange={e =>
                                                    updateCurrentSlide({
                                                        checkupQuestion: {
                                                            ...currentCheckup,
                                                            question: e.target.value
                                                        }
                                                    })
                                                }
                                                placeholder="Question prompt"
                                                className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold outline-none ${
                                                    isBento
                                                        ? 'bg-white text-black border-2 border-black'
                                                        : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                                }`}
                                            />
                                            <div className="space-y-1.5">
                                                {currentCheckup.options.map((opt, optIdx) => (
                                                    <div key={optIdx} className="flex items-center gap-1.5">
                                                        <input
                                                            type="radio"
                                                            name={`checkup-correct-${currentSlide.id}`}
                                                            checked={currentCheckup.correctAnswer === optIdx}
                                                            onChange={() =>
                                                                updateCurrentSlide({
                                                                    checkupQuestion: {
                                                                        ...currentCheckup,
                                                                        correctAnswer: optIdx
                                                                    }
                                                                })
                                                            }
                                                            title="Mark as correct option"
                                                            className={`cursor-pointer ${isBento ? 'accent-black' : 'accent-[#bef264]'}`}
                                                        />
                                                        <input
                                                            type="text"
                                                            value={opt}
                                                            onChange={e => {
                                                                const opts = [...currentCheckup.options];
                                                                opts[optIdx] = e.target.value;
                                                                updateCurrentSlide({
                                                                    checkupQuestion: {
                                                                        ...currentCheckup,
                                                                        options: opts
                                                                    }
                                                                });
                                                            }}
                                                            className={`flex-1 px-2.5 py-1 rounded-lg text-xs font-semibold outline-none ${
                                                                isBento
                                                                    ? 'bg-white text-black border border-black'
                                                                    : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924] focus:border-[#bef264]'
                                                            }`}
                                                        />
                                                        {currentCheckup.options.length > 2 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const opts = currentCheckup.options.filter((_, i) => i !== optIdx);
                                                                    const nextCorrect = Math.min(currentCheckup.correctAnswer, opts.length - 1);
                                                                    const updated: SlideCheckupQuestion = {
                                                                        ...currentCheckup,
                                                                        options: opts,
                                                                        correctAnswer: nextCorrect
                                                                    };
                                                                    updateCurrentSlide({ checkupQuestion: updated });
                                                                }}
                                                                className="p-1 text-[#fb7185] cursor-pointer"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        updateCurrentSlide({
                                                            checkupQuestion: {
                                                                ...currentCheckup,
                                                                options: [
                                                                    ...currentCheckup.options,
                                                                    `Option ${String.fromCharCode(65 + currentCheckup.options.length)}`
                                                                ]
                                                            }
                                                        })
                                                    }
                                                    className={`text-[10px] font-black uppercase cursor-pointer ${isBento ? 'text-black' : 'text-[#bef264]'}`}
                                                >
                                                    + Add Option
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Column 3: Live Visual Board Preview */}
                            <section
                                className={`lg:col-span-4 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3 ${
                                    isBento
                                        ? 'bg-[#f5f3ec] border-t-2 lg:border-t-0 lg:border-l-2 border-black'
                                        : 'bg-[#11100e] border-t lg:border-t-0 lg:border-l border-[#2e2924]'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                        <Eye className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                        Live Board Preview
                                    </span>
                                    <span className="text-[10px] font-black uppercase opacity-60">
                                        {currentSlide?.layout} • {currentSlide?.motion}
                                    </span>
                                </div>

                                <div className={`rounded-2xl p-5 flex-1 min-h-[280px] flex flex-col justify-between gap-4 ${previewThemeBg}`}>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#bef264]/20 border border-current/20">
                                                Slide {safeSelectedIdx + 1} / {slides.length}
                                            </span>
                                            <span className="text-[10px] font-mono opacity-70 uppercase">
                                                {deckTheme}
                                            </span>
                                        </div>

                                        <div>
                                            <h4 className="text-xl font-black leading-tight">
                                                {currentSlide?.title || 'Untitled Slide'}
                                            </h4>
                                            {currentSlide?.subtitle && (
                                                <p className="text-xs font-semibold opacity-75 mt-1">
                                                    {currentSlide.subtitle}
                                                </p>
                                            )}
                                        </div>

                                        {currentSlide?.body && (
                                            <p className="text-xs leading-relaxed opacity-90 whitespace-pre-line">
                                                {currentSlide.body}
                                            </p>
                                        )}

                                        {currentBullets.length > 0 && (
                                            <ul className="space-y-1.5 pt-1">
                                                {currentBullets.map((b, idx) => (
                                                    <li key={idx} className="text-xs font-semibold flex items-start gap-2">
                                                        <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#fde047]" />
                                                        <span>{b}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {currentSlide?.codeSnippet?.code && (
                                            <pre className="p-3 rounded-xl bg-[#0e0d0b] text-[#bef264] text-[11px] font-mono overflow-x-auto border border-[#2e2924]">
                                                <code>{currentSlide.codeSnippet.code}</code>
                                            </pre>
                                        )}

                                        {currentCheckup && (
                                            <div className="p-3 rounded-xl bg-black/20 border border-current/20 space-y-2">
                                                <div className="text-[11px] font-black">{currentCheckup.question}</div>
                                                <div className="space-y-1">
                                                    {currentCheckup.options.map((opt, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center justify-between ${
                                                                idx === currentCheckup.correctAnswer
                                                                    ? 'bg-[#bef264]/20 border border-[#bef264]'
                                                                    : 'bg-black/15'
                                                            }`}
                                                        >
                                                            <span>{opt}</span>
                                                            {idx === currentCheckup.correctAnswer && (
                                                                <Check className="w-3 h-3 text-[#bef264]" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {currentSlide?.callout && (
                                        <div className="p-3 rounded-xl bg-[#fde047]/20 border border-[#fde047]/40 text-xs font-bold">
                                            💡 {currentSlide.callout}
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>

            {showFullPlayerPreview && (
                <PresentationModePlayer
                    presentation={draftPresentation}
                    isTeacher={true}
                    userId={userId}
                    userName={userName}
                    onClose={() => setShowFullPlayerPreview(false)}
                />
            )}
        </>,
        document.body
    );
};

export default PresentationVisualBoardModal;
