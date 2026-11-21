import React, { useState } from 'react';
import {
    Sparkles, Upload, FileCode, Code2, Plus, Trash2, ArrowUp, ArrowDown,
    HelpCircle, Play, Save, Copy, Download, CheckCircle2, Layers
} from 'lucide-react';
import type {
    MotionPresentation,
    MotionSlide,
    SlideLayout,
    SlideMotion,
    PresentationTheme
} from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import { TRAVELO_PART2_DECK } from '../../constants/traveloSlideDeck';
import { SAMPLE_FULL_PRESENTATION } from '../../constants/samplePresentationJson';

interface MotionSlideStudioPanelProps {
    initialPresentation?: MotionPresentation | null;
    defaultTitle: string;
    trackId?: string | null;
    moduleId?: string | null;
    clanId?: string | null;
    userId: string;
    onSaved: (saved: MotionPresentation, launchAfterSave?: boolean) => void;
}

const buildDefaultSlide = (layout: SlideLayout = 'bullets', index = 0): MotionSlide => ({
    id: `slide_${Date.now()}_${index}`,
    order: index,
    layout,
    motion: layout === 'checkup' ? 'pop' : layout === 'hero' ? 'zoom-in' : 'fade-up',
    title: layout === 'checkup' ? 'Session Check-Up' : `Slide ${index + 1}`,
    subtitle: '',
    body: '',
    bullets: layout === 'checkup' ? [] : ['Key point 1', 'Key point 2'],
    callout: '',
    speakerNotes: '',
    durationSeconds: 45,
    ...(layout === 'checkup'
        ? {
            checkupQuestion: {
                question: 'Which statement is correct?',
                options: ['Option A', 'Option B', 'Option C', 'Option D'],
                correctAnswer: 0,
                explanation: '',
                points: 10
            }
        }
        : {})
});

export const MotionSlideStudioPanel: React.FC<MotionSlideStudioPanelProps> = ({
    initialPresentation,
    defaultTitle,
    trackId,
    moduleId,
    clanId,
    userId,
    onSaved
}) => {
    const { isBento } = useTheme();
    const { showNotification } = useNotification();

    const [activeTab, setActiveTab] = useState<'convert' | 'editor' | 'data'>(
        initialPresentation?.slides?.length ? 'editor' : 'convert'
    );

    const [deck, setDeck] = useState<MotionPresentation>(() => initialPresentation || {
        title: defaultTitle,
        description: '',
        trackId: trackId || null,
        moduleId: moduleId || null,
        clanId: clanId || null,
        theme: 'dark-tech',
        sourceFormat: 'manual',
        slides: [buildDefaultSlide('hero', 0), buildDefaultSlide('checkup', 1)]
    });

    const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);
    const [convertMode, setConvertMode] = useState<'file' | 'text' | 'json_xml'>('text');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [rawText, setRawText] = useState('');
    const [rawPayload, setRawPayload] = useState(() => JSON.stringify(TRAVELO_PART2_DECK, null, 2));
    const [slideCount, setSlideCount] = useState(7);
    const [checkupCount, setCheckupCount] = useState(2);
    const [isConverting, setIsConverting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [dataFormat, setDataFormat] = useState<'json' | 'xml'>('json');
    const [xmlPreview, setXmlPreview] = useState(initialPresentation?.xml || '');

    const currentSlide = deck.slides[selectedSlideIdx] || deck.slides[0];

    const handleLoadTraveloExample = () => {
        setDeck({
            ...TRAVELO_PART2_DECK,
            presentationId: deck.presentationId,
            trackId: trackId || deck.trackId || null,
            moduleId: moduleId || deck.moduleId || null,
            clanId: clanId || deck.clanId || null
        });
        setSelectedSlideIdx(0);
        setActiveTab('editor');
        showNotification('success', 'Loaded Travelo Project (Part 2) interactive JSON deck!');
    };

    const handleConvert = async () => {
        setIsConverting(true);
        try {
            const res = await api.convertSlidesToMotion({
                file: convertMode === 'file' ? selectedFile : null,
                title: deck.title || defaultTitle,
                rawText: convertMode === 'text' ? rawText : undefined,
                rawPayload: convertMode === 'json_xml' ? rawPayload : undefined,
                theme: deck.theme,
                slideCount,
                checkupCount
            }, userId);

            setDeck(prev => ({
                ...prev,
                title: res.presentation.title || prev.title,
                description: res.presentation.description || prev.description,
                theme: res.presentation.theme || prev.theme,
                sourceFormat: (res.sourceFormat as MotionPresentation['sourceFormat']) || 'ai_slides',
                slides: res.presentation.slides || []
            }));
            setXmlPreview(res.xml || '');
            setSelectedSlideIdx(0);
            setActiveTab('editor');
            showNotification(
                'success',
                res.usedAi
                    ? `Converted into ${res.presentation.slides.length} AI Motion Slides + Check-Ups!`
                    : `Converted into ${res.presentation.slides.length} Motion Slides!`
            );
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Conversion failed');
        } finally {
            setIsConverting(false);
        }
    };

    const updateSlide = (idx: number, patch: Partial<MotionSlide>) => {
        setDeck(prev => {
            const next = [...prev.slides];
            next[idx] = { ...next[idx], ...patch };
            return { ...prev, slides: next };
        });
    };

    const addSlide = (layout: SlideLayout) => {
        setDeck(prev => {
            const next = [...prev.slides, buildDefaultSlide(layout, prev.slides.length)];
            setSelectedSlideIdx(next.length - 1);
            return { ...prev, slides: next };
        });
    };

    const moveSlide = (idx: number, dir: -1 | 1) => {
        const target = idx + dir;
        if (target < 0 || target >= deck.slides.length) return;
        setDeck(prev => {
            const next = [...prev.slides];
            [next[idx], next[target]] = [next[target], next[idx]];
            return { ...prev, slides: next };
        });
        setSelectedSlideIdx(target);
    };

    const removeSlide = (idx: number) => {
        if (deck.slides.length <= 1) return;
        setDeck(prev => ({
            ...prev,
            slides: prev.slides.filter((_, i) => i !== idx)
        }));
        setSelectedSlideIdx(Math.max(0, idx - 1));
    };

    const handleSave = async (launchAfterSave = false, forceNew = false) => {
        setIsSaving(true);
        try {
            const combinedModuleIds = Array.from(
                new Set([
                    ...(Array.isArray(deck.moduleIds) ? deck.moduleIds : []),
                    ...(moduleId ? [moduleId] : []),
                    ...(deck.moduleId ? [deck.moduleId] : [])
                ].filter((m): m is string => Boolean(m)))
            );
            const resolvedModuleId = moduleId || deck.moduleId || combinedModuleIds[0] || null;
            const serializedJson = JSON.stringify({
                title: deck.title,
                description: deck.description || '',
                theme: deck.theme || 'dark-tech',
                slides: deck.slides || []
            }, null, 2);

            const payload: MotionPresentation = {
                ...deck,
                presentationId: forceNew ? undefined : deck.presentationId,
                trackId: trackId || deck.trackId || null,
                moduleId: resolvedModuleId,
                moduleIds: combinedModuleIds,
                clanId: clanId || deck.clanId || null,
                rawJson: serializedJson
            };
            const saved = await api.savePresentation(payload, userId);
            setDeck(saved);
            if (saved.xml) setXmlPreview(saved.xml);
            showNotification('success', forceNew ? 'Saved as a new presentation for this module!' : 'Presentation & Board updated!');
            onSaved(saved, launchAfterSave);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to save presentation');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadSampleJson = () => {
        const blob = new Blob([JSON.stringify(SAMPLE_FULL_PRESENTATION, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample-presentation.json';
        a.click();
        URL.revokeObjectURL(url);
        showNotification('success', 'Downloaded sample presentation JSON!');
    };

    const handleApplyJsonOrXml = async () => {
        try {
            const res = await api.convertSlidesToMotion({
                title: deck.title || defaultTitle,
                rawPayload: dataFormat === 'json'
                    ? JSON.stringify({ title: deck.title, description: deck.description, theme: deck.theme, slides: deck.slides }, null, 2)
                    : xmlPreview
            }, userId);
            setDeck(prev => ({ ...prev, ...res.presentation }));
            setXmlPreview(res.xml);
            showNotification('success', 'Applied structured slide data!');
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Invalid data format');
        }
    };

    const exportString = dataFormat === 'json'
        ? JSON.stringify({ title: deck.title, description: deck.description, theme: deck.theme, slides: deck.slides }, null, 2)
        : (xmlPreview || '<presentation title="Session"><slide layout="hero" motion="zoom-in"><title>Hello</title></slide></presentation>');

    const handleDownload = () => {
        const blob = new Blob([exportString], { type: dataFormat === 'json' ? 'application/json' : 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(deck.title || 'motion-slides').toLowerCase().replace(/\s+/g, '-')}.${dataFormat}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className={`rounded-3xl overflow-hidden ${
            isBento
                ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                : 'bg-white dark:bg-[#11131f] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 shadow-xl'
        }`}>
            {/* Top Controls: Title, Theme, Preset, Sub-tabs */}
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-gray-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 dark:bg-white/[0.02]">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0 sm:min-w-[240px]">
                    <input
                        value={deck.title}
                        onChange={e => setDeck(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Presentation title..."
                        className={`px-3.5 py-2 rounded-xl text-sm font-bold flex-1 min-w-[140px] ${
                            isBento
                                ? 'bg-white border-2 border-black text-black'
                                : 'bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10'
                        }`}
                    />
                    <select
                        value={deck.theme}
                        onChange={e => setDeck(prev => ({ ...prev, theme: e.target.value as PresentationTheme }))}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase ${
                            isBento
                                ? 'bg-white border-2 border-black text-black'
                                : 'bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10'
                        }`}
                    >
                        <option value="dark-tech">Dark Tech</option>
                        <option value="bento">Neo-Bento</option>
                        <option value="editorial">Editorial</option>
                        <option value="neon">Neon Cyber</option>
                    </select>
                    <button
                        type="button"
                        onClick={handleLoadTraveloExample}
                        className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                            isBento ? 'bg-[#fde047] text-black border-2 border-black' : 'bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25'
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Load Example</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadSampleJson}
                        className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                            isBento ? 'bg-[#e0f2fe] text-black border-2 border-black' : 'bg-sky-500/15 text-sky-500 border border-sky-500/30 hover:bg-sky-500/25'
                        }`}
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Sample JSON</span>
                    </button>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap w-full lg:w-auto">
                    {([
                        { id: 'convert', label: 'Convert Slides', icon: Upload },
                        { id: 'editor', label: `Slide Editor (${deck.slides.length})`, icon: Layers },
                        { id: 'data', label: 'JSON / XML', icon: FileCode }
                    ] as const).map(t => {
                        const Icon = t.icon;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setActiveTab(t.id)}
                                className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition ${
                                    activeTab === t.id
                                        ? isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-indigo-600 text-white'
                                        : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-75'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{t.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6">
                {activeTab === 'convert' && (
                    <div className="max-w-3xl mx-auto space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {([
                                { id: 'text', label: 'Paste Slide Text / Outline' },
                                { id: 'file', label: 'Upload PDF / PPTX / JSON / XML' },
                                { id: 'json_xml', label: 'Import Raw JSON / XML' }
                            ] as const).map(m => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setConvertMode(m.id)}
                                    className={`p-3 rounded-2xl text-xs font-black transition cursor-pointer ${
                                        convertMode === m.id
                                            ? isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-indigo-600/15 text-indigo-500 border-2 border-indigo-500'
                                            : 'bg-gray-100 dark:bg-white/5 border-2 border-transparent opacity-75'
                                    }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        {convertMode === 'file' && (
                            <label className={`block p-5 sm:p-8 rounded-3xl border-2 border-dashed text-center cursor-pointer transition ${
                                isBento ? 'border-black bg-slate-50 hover:bg-[#fef9c3]' : 'border-indigo-500/40 hover:bg-indigo-500/5'
                            }`}>
                                <Upload className="w-10 h-10 mx-auto mb-3 text-indigo-500" />
                                <p className="text-sm font-black">
                                    {selectedFile ? selectedFile.name : 'Click to upload PDF, PPTX, TXT, MD, JSON, or XML slides'}
                                </p>
                                <input
                                    type="file"
                                    accept=".pdf,.pptx,.txt,.md,.json,.xml"
                                    className="hidden"
                                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                />
                            </label>
                        )}

                        {convertMode === 'text' && (
                            <textarea
                                rows={8}
                                value={rawText}
                                onChange={e => setRawText(e.target.value)}
                                placeholder="Paste your lecture slide text here (e.g. Travelo Project Part 2 slides)..."
                                className="w-full p-4 rounded-2xl text-sm font-medium bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                            />
                        )}

                        {convertMode === 'json_xml' && (
                            <textarea
                                rows={10}
                                value={rawPayload}
                                onChange={e => setRawPayload(e.target.value)}
                                placeholder="Paste Motion Slide JSON or <presentation> XML here..."
                                className="w-full p-4 rounded-2xl text-xs font-mono bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10"
                            />
                        )}

                        {convertMode !== 'json_xml' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
                                        Target Motion Slides
                                    </label>
                                    <input
                                        type="number"
                                        min={4}
                                        max={15}
                                        value={slideCount}
                                        onChange={e => setSlideCount(Number(e.target.value) || 7)}
                                        className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
                                        Auto Check-Up Questions
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={5}
                                        value={checkupCount}
                                        onChange={e => setCheckupCount(Number(e.target.value) || 0)}
                                        className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            disabled={isConverting}
                            onClick={handleConvert}
                            className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[4px_4px_0px_#000]'
                                    : 'bg-indigo-600 text-white shadow-lg'
                            }`}
                        >
                            <Sparkles className="w-4 h-4" />
                            <span>{isConverting ? 'Converting to Motion Slides...' : 'Convert to Motion Slides'}</span>
                        </button>
                    </div>
                )}

                {activeTab === 'editor' && (
                    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => addSlide('bullets')}
                                    className="flex-1 py-2 px-3 rounded-xl text-xs font-black bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25 flex items-center justify-center gap-1 cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Slide
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addSlide('checkup')}
                                    className="flex-1 py-2 px-3 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 flex items-center justify-center gap-1 cursor-pointer"
                                >
                                    <HelpCircle className="w-3.5 h-3.5" /> Check-Up
                                </button>
                            </div>

                            <div className="space-y-1.5 max-h-[220px] lg:max-h-[460px] overflow-y-auto pr-1">
                                {deck.slides.map((s, idx) => (
                                    <div
                                        key={s.id + idx}
                                        onClick={() => setSelectedSlideIdx(idx)}
                                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                                            selectedSlideIdx === idx
                                                ? isBento
                                                    ? 'bg-[#bef264] text-black border-2 border-black'
                                                    : 'bg-indigo-600/15 border-indigo-500 text-indigo-400'
                                                : 'bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/10'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-black uppercase opacity-70">
                                                #{idx + 1} • {s.layout} • {s.motion}
                                            </div>
                                            <div className="text-xs font-bold truncate">{s.title}</div>
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                                            <button type="button" onClick={() => moveSlide(idx, -1)} className="p-1 opacity-60 hover:opacity-100 cursor-pointer"><ArrowUp className="w-3 h-3" /></button>
                                            <button type="button" onClick={() => moveSlide(idx, 1)} className="p-1 opacity-60 hover:opacity-100 cursor-pointer"><ArrowDown className="w-3 h-3" /></button>
                                            <button type="button" onClick={() => removeSlide(idx)} className="p-1 text-rose-500 opacity-70 hover:opacity-100 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {currentSlide && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">Layout</label>
                                        <select
                                            value={currentSlide.layout}
                                            onChange={e => {
                                                const layout = e.target.value as SlideLayout;
                                                updateSlide(selectedSlideIdx, {
                                                    layout,
                                                    ...(layout === 'checkup' && !currentSlide.checkupQuestion
                                                        ? {
                                                            checkupQuestion: {
                                                                question: 'Check-Up Question',
                                                                options: ['Option A', 'Option B', 'Option C', 'Option D'],
                                                                correctAnswer: 0,
                                                                explanation: '',
                                                                points: 10
                                                            }
                                                        }
                                                        : {})
                                                });
                                            }}
                                            className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                                        >
                                            <option value="hero">Hero Title</option>
                                            <option value="bullets">Bullets List</option>
                                            <option value="wireframe">Interactive Wireframe</option>
                                            <option value="split">Split Content</option>
                                            <option value="code">Code Lab</option>
                                            <option value="checkup">Check-Up Question</option>
                                            <option value="homework">Homework Brief</option>
                                            <option value="summary">Summary / Wrap-Up</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">Motion Animation</label>
                                        <select
                                            value={currentSlide.motion}
                                            onChange={e => updateSlide(selectedSlideIdx, { motion: e.target.value as SlideMotion })}
                                            className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                                        >
                                            <option value="fade-up">Fade Up</option>
                                            <option value="slide-left">Slide Left</option>
                                            <option value="zoom-in">Zoom In</option>
                                            <option value="stagger">Stagger Reveal</option>
                                            <option value="pop">Pop In</option>
                                            <option value="flip">Flip / Drop</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">Duration (sec)</label>
                                        <input
                                            type="number"
                                            min={10}
                                            value={currentSlide.durationSeconds || 45}
                                            onChange={e => updateSlide(selectedSlideIdx, { durationSeconds: Number(e.target.value) || 45 })}
                                            className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">Slide Title</label>
                                        <input
                                            value={currentSlide.title}
                                            onChange={e => updateSlide(selectedSlideIdx, { title: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl text-sm font-bold bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider mb-1">Subtitle</label>
                                        <input
                                            value={currentSlide.subtitle || ''}
                                            onChange={e => updateSlide(selectedSlideIdx, { subtitle: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl text-sm font-bold bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                                        />
                                    </div>
                                </div>

                                {currentSlide.layout === 'checkup' && currentSlide.checkupQuestion ? (
                                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-black uppercase text-emerald-500">
                                            <HelpCircle className="w-4 h-4" />
                                            <span>Interactive Check-Up Question</span>
                                        </div>
                                        <input
                                            value={currentSlide.checkupQuestion.question}
                                            onChange={e => updateSlide(selectedSlideIdx, {
                                                checkupQuestion: { ...currentSlide.checkupQuestion!, question: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 rounded-xl text-sm font-bold bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10"
                                        />
                                        <div className="space-y-2">
                                            {currentSlide.checkupQuestion.options.map((opt, oIdx) => (
                                                <div key={oIdx} className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateSlide(selectedSlideIdx, {
                                                            checkupQuestion: { ...currentSlide.checkupQuestion!, correctAnswer: oIdx }
                                                        })}
                                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black cursor-pointer ${
                                                            currentSlide.checkupQuestion!.correctAnswer === oIdx
                                                                ? 'bg-emerald-500 text-white'
                                                                : 'bg-black/10 dark:bg-white/10'
                                                        }`}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                    <input
                                                        value={opt}
                                                        onChange={e => {
                                                            const nextOpts = [...currentSlide.checkupQuestion!.options];
                                                            nextOpts[oIdx] = e.target.value;
                                                            updateSlide(selectedSlideIdx, {
                                                                checkupQuestion: { ...currentSlide.checkupQuestion!, options: nextOpts }
                                                            });
                                                        }}
                                                        className="flex-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <input
                                            value={currentSlide.checkupQuestion.explanation || ''}
                                            onChange={e => updateSlide(selectedSlideIdx, {
                                                checkupQuestion: { ...currentSlide.checkupQuestion!, explanation: e.target.value }
                                            })}
                                            placeholder="Explanation shown when revealed..."
                                            className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider mb-1">Body Paragraph</label>
                                            <textarea
                                                rows={2}
                                                value={currentSlide.body || ''}
                                                onChange={e => updateSlide(selectedSlideIdx, { body: e.target.value })}
                                                className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider mb-1">Bullet Points (one per line)</label>
                                            <textarea
                                                rows={3}
                                                value={(currentSlide.bullets || []).join('\n')}
                                                onChange={e => updateSlide(selectedSlideIdx, {
                                                    bullets: e.target.value.split('\n').map(l => l.trim()).filter(Boolean)
                                                })}
                                                className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    <Code2 className="w-3 h-3" /> Code Lang
                                                </label>
                                                <input
                                                    value={currentSlide.codeSnippet?.language || 'html'}
                                                    onChange={e => updateSlide(selectedSlideIdx, {
                                                        codeSnippet: {
                                                            language: e.target.value,
                                                            code: currentSlide.codeSnippet?.code || ''
                                                        }
                                                    })}
                                                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-wider mb-1">Optional Code Snippet</label>
                                                <textarea
                                                    rows={2}
                                                    value={currentSlide.codeSnippet?.code || ''}
                                                    onChange={e => updateSlide(selectedSlideIdx, {
                                                        codeSnippet: {
                                                            language: currentSlide.codeSnippet?.language || 'html',
                                                            code: e.target.value
                                                        }
                                                    })}
                                                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDataFormat('json')}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                                        dataFormat === 'json' ? 'bg-indigo-600 text-white' : 'bg-black/10 dark:bg-white/10'
                                    }`}
                                >
                                    JSON Data
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDataFormat('xml')}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                                        dataFormat === 'xml' ? 'bg-indigo-600 text-white' : 'bg-black/10 dark:bg-white/10'
                                    }`}
                                >
                                    XML Data
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(exportString);
                                        showNotification('success', `${dataFormat.toUpperCase()} copied!`);
                                    }}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-black/10 dark:bg-white/10 flex items-center gap-1 cursor-pointer"
                                >
                                    <Copy className="w-3.5 h-3.5" /> Copy
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-black/10 dark:bg-white/10 flex items-center gap-1 cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5" /> Download
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApplyJsonOrXml}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-white flex items-center gap-1 cursor-pointer"
                                >
                                    Apply Changes
                                </button>
                            </div>
                        </div>
                        <textarea
                            rows={14}
                            value={exportString}
                            onChange={e => {
                                if (dataFormat === 'xml') {
                                    setXmlPreview(e.target.value);
                                } else {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        setDeck(prev => ({ ...prev, ...parsed }));
                                    } catch {
                                        // wait for valid json
                                    }
                                }
                            }}
                            className="w-full p-4 rounded-2xl text-xs font-mono bg-[#0b0f1c] text-emerald-300 border border-white/10"
                        />
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-bold opacity-70">
                    {deck.slides.length} Motion Slide{deck.slides.length === 1 ? '' : 's'} • {deck.slides.filter(s => s.layout === 'checkup').length} Check-Up Question{deck.slides.filter(s => s.layout === 'checkup').length === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2.5 flex-wrap">
                    {deck.presentationId && (
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSave(false, true)}
                            className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                isBento
                                    ? 'bg-[#e0f2fe] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-900 dark:text-white'
                            }`}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Save as New Deck</span>
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSave(false)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Saving...' : 'Save Deck'}</span>
                    </button>
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSave(true)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-emerald-500 text-white shadow-lg'
                        }`}
                    >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Save &amp; Open Teaching Board</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MotionSlideStudioPanel;
