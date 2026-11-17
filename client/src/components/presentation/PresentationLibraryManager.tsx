import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Download,
    Upload,
    FileJson,
    MonitorPlay,
    Trash2,
    Link2,
    Search,
    Layers,
    CheckSquare,
    Square,
    X,
    Check,
    Pencil
} from 'lucide-react';
import type {
    MotionPresentation,
    SkillTrack,
    UserData,
    ClassSummary,
    PresentationTheme
} from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import { SAMPLE_FULL_PRESENTATION } from '../../constants/samplePresentationJson';
import { getTeacherThemeStyles } from '../teacher/teacherTheme';
import { PresentationModePlayer } from './PresentationModePlayer';
import { PresentationVisualBoardModal } from './PresentationVisualBoardModal';

interface PresentationLibraryManagerProps {
    currentUser: UserData;
    skillTracks: SkillTrack[];
    classes?: ClassSummary[];
    isAdminView?: boolean;
    initialUploadTrackId?: string;
    initialUploadModuleId?: string;
    onChanged?: () => void;
}

export const PresentationLibraryManager: React.FC<PresentationLibraryManagerProps> = ({
    currentUser,
    skillTracks,
    classes = [],
    isAdminView = false,
    initialUploadTrackId = '',
    initialUploadModuleId = '',
    onChanged
}) => {
    const { theme } = useTheme();
    const styles = useMemo(() => getTeacherThemeStyles(theme), [theme]);
    const { showNotification } = useNotification();

    const [presentations, setPresentations] = useState<MotionPresentation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTrackId, setFilterTrackId] = useState('');

    // Simple Upload & Assign Form State
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [targetTrackId, setTargetTrackId] = useState(initialUploadTrackId);
    const [targetModuleIds, setTargetModuleIds] = useState<string[]>(
        initialUploadModuleId ? [initialUploadModuleId] : []
    );
    const [uploading, setUploading] = useState(false);

    // Preview, Re-assign & Update JSON State
    const [previewDeck, setPreviewDeck] = useState<MotionPresentation | null>(null);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [assignTrackId, setAssignTrackId] = useState('');
    const [assignModuleIds, setAssignModuleIds] = useState<string[]>([]);
    const [savingAssign, setSavingAssign] = useState(false);
    const [boardEditingDeck, setBoardEditingDeck] = useState<MotionPresentation | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadPresentations = useCallback(async () => {
        setLoading(true);
        try {
            const list = await api.getPresentations({}, currentUser.userId);
            setPresentations(Array.isArray(list) ? list : []);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to load presentations');
        } finally {
            setLoading(false);
        }
    }, [currentUser.userId, showNotification]);

    useEffect(() => {
        loadPresentations();
    }, [loadPresentations]);

    const trackMap = useMemo(
        () => new Map(skillTracks.map(t => [t.trackId, t])),
        [skillTracks]
    );

    const moduleLookup = useMemo(() => {
        const map = new Map<string, { title: string; trackTitle: string; order: number }>();
        skillTracks.forEach(t => {
            (t.modules || []).forEach((m, idx) => {
                map.set(m.moduleId, {
                    title: m.title,
                    trackTitle: t.title,
                    order: idx + 1
                });
            });
        });
        return map;
    }, [skillTracks]);

    const classMap = useMemo(
        () => new Map(classes.map(c => [c.clanId, c])),
        [classes]
    );

    const selectedUploadTrack = targetTrackId ? trackMap.get(targetTrackId) : undefined;
    const selectedAssignTrack = assignTrackId ? trackMap.get(assignTrackId) : undefined;

    const triggerJsonDownload = (payload: unknown, filename: string) => {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadSample = async () => {
        try {
            const sample = await api.getSamplePresentationJson();
            triggerJsonDownload(sample, 'sample-presentation.json');
        } catch {
            triggerJsonDownload(SAMPLE_FULL_PRESENTATION, 'sample-presentation.json');
        }
        showNotification('success', 'Sample JSON downloaded!');
    };

    const toggleModuleId = (
        id: string,
        current: string[],
        setter: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
        setter(current.includes(id) ? current.filter(m => m !== id) : [...current, id]);
    };

    const handleUploadAndSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile) {
            showNotification('warning', 'Please select a JSON presentation file first.');
            return;
        }

        setUploading(true);
        try {
            const rawUploadedText = uploadFile.name.toLowerCase().endsWith('.json')
                ? await uploadFile.text().catch(() => '')
                : '';
            const converted = await api.convertSlidesToMotion({
                file: uploadFile,
                title: uploadFile.name.replace(/\.[^.]+$/, '') || 'Uploaded Presentation',
                theme: styles.isBento ? 'bento' : 'dark-tech'
            }, currentUser.userId);

            const presData = converted.presentation;
            const jsonPayload = rawUploadedText.trim() || JSON.stringify(presData, null, 2);
            const saved = await api.savePresentation({
                title: presData.title || uploadFile.name.replace(/\.[^.]+$/, '') || 'Uploaded Presentation',
                description: presData.description || '',
                trackId: targetTrackId || null,
                moduleId: targetModuleIds[0] || null,
                moduleIds: targetModuleIds,
                theme: (presData.theme || (styles.isBento ? 'bento' : 'dark-tech')) as PresentationTheme,
                sourceFormat: (converted.sourceFormat as MotionPresentation['sourceFormat']) || 'json',
                rawJson: jsonPayload,
                slides: presData.slides || []
            }, currentUser.userId);

            showNotification(
                'success',
                `Saved "${saved.title}" to database${targetModuleIds.length > 0 ? ` & assigned to ${targetModuleIds.length} module(s)` : ''}!`
            );

            setUploadFile(null);
            setTargetModuleIds([]);
            await loadPresentations();
            onChanged?.();
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to upload presentation');
        } finally {
            setUploading(false);
        }
    };

    const openAssignDrawer = (deck: MotionPresentation) => {
        const id = deck.presentationId || '';
        if (assigningId === id) {
            setAssigningId(null);
            return;
        }
        setAssigningId(id);
        setAssignTrackId(deck.trackId || '');
        const existingModules = Array.isArray(deck.moduleIds) && deck.moduleIds.length > 0
            ? deck.moduleIds
            : (deck.moduleId ? [deck.moduleId] : []);
        setAssignModuleIds(existingModules);
    };

    const handleSaveAssignment = async (presentationId: string) => {
        setSavingAssign(true);
        try {
            await api.assignPresentation(presentationId, {
                trackId: assignTrackId || null,
                moduleId: assignModuleIds[0] || null,
                moduleIds: assignModuleIds
            }, currentUser.userId);
            showNotification('success', 'Module assignment updated!');
            setAssigningId(null);
            await loadPresentations();
            onChanged?.();
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to assign presentation');
        } finally {
            setSavingAssign(false);
        }
    };

    const openBoardEditor = (deck: MotionPresentation) => {
        setAssigningId(null);
        setBoardEditingDeck(deck);
    };

    const handleDelete = async (presentationId: string) => {
        try {
            await api.deletePresentation(presentationId, currentUser.userId);
            setConfirmDeleteId(null);
            showNotification('success', 'Presentation deleted.');
            await loadPresentations();
            onChanged?.();
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to delete presentation');
        }
    };

    const filteredPresentations = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return presentations.filter(p => {
            if (filterTrackId && p.trackId !== filterTrackId) return false;
            if (!q) return true;
            return (
                (p.title || '').toLowerCase().includes(q)
                || (p.creatorName || '').toLowerCase().includes(q)
            );
        });
    }, [presentations, filterTrackId, searchQuery]);

    return (
        <div className="space-y-6">
            {/* Inline Full Board Preview */}
            {previewDeck && (
                <div className={`p-4 sm:p-5 rounded-[2rem] space-y-3 ${styles.surfaceCard}`}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="font-black text-sm uppercase tracking-wider truncate">
                            Previewing: {previewDeck.title}
                        </div>
                        <button
                            type="button"
                            onClick={() => setPreviewDeck(null)}
                            className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer ${styles.dangerBtn}`}
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Close</span>
                        </button>
                    </div>
                    <PresentationModePlayer
                        key={`${previewDeck.presentationId || previewDeck.title}-${previewDeck.updatedAt || ''}-${previewDeck.slides?.length || 0}`}
                        embedded={true}
                        presentation={previewDeck}
                        clanId={previewDeck.clanId || undefined}
                        isTeacher={true}
                        userId={currentUser.userId}
                        userName={currentUser.name}
                        onClose={() => setPreviewDeck(null)}
                    />
                </div>
            )}

            {/* Simple Download Sample JSON + Upload Card */}
            <form onSubmit={handleUploadAndSave} className={`p-6 rounded-[2rem] space-y-5 ${styles.surfaceCard}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.pillPrimary}`}>
                            <FileJson className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black">Upload Presentation JSON</h2>
                            <p className={`text-xs font-medium ${styles.mutedText}`}>
                                Download the sample JSON, edit your slides, then upload and assign to a track &amp; session/module.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleDownloadSample}
                        className={`px-4 py-2.5 rounded-xl text-xs uppercase flex items-center gap-2 cursor-pointer shrink-0 ${styles.secondaryBtn}`}
                    >
                        <Download className="w-4 h-4 shrink-0" />
                        <span>Download Sample JSON</span>
                    </button>
                </div>

                {initialUploadTrackId && initialUploadModuleId && (
                    <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 flex-wrap text-xs font-bold ${styles.pillSuccess}`}>
                        <span>
                            Ready to upload slides for:{' '}
                            <span className="font-black">
                                {moduleLookup.get(initialUploadModuleId)?.trackTitle || 'Selected Track'}
                            </span>
                            {' '}&rarr;{' '}
                            <span className="font-black">
                                Session {moduleLookup.get(initialUploadModuleId)?.order || ''}: {moduleLookup.get(initialUploadModuleId)?.title || initialUploadModuleId}
                            </span>
                        </span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                    {/* Left: Dropzone */}
                    <label className={`h-full min-h-[140px] flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition ${
                        styles.isBento ? 'border-black bg-[#f8fafc] hover:bg-[#fef9c3]' : 'border-indigo-500/40 hover:bg-indigo-500/5'
                    }`}>
                        <Upload className="w-7 h-7 mx-auto mb-2" />
                        <div className="text-xs sm:text-sm font-black truncate max-w-full px-2">
                            {uploadFile ? uploadFile.name : 'Click to choose presentation file (.json)'}
                        </div>
                        <div className={`text-[11px] mt-1 font-medium ${styles.mutedText}`}>
                            Supports JSON, XML, PPTX, PDF, or TXT
                        </div>
                        <input
                            type="file"
                            accept=".json,.xml,.pptx,.pdf,.txt,.md"
                            className="hidden"
                            onChange={e => setUploadFile(e.target.files?.[0] || null)}
                        />
                    </label>

                    {/* Right: Track & Module Selector */}
                    <div className={`h-full min-h-[140px] p-5 rounded-2xl flex flex-col justify-center space-y-3 ${styles.subtleBox}`}>
                        <div>
                            <label className="block text-[11px] font-black uppercase mb-1.5">Assign to Track</label>
                            <select
                                value={targetTrackId}
                                onChange={e => {
                                    setTargetTrackId(e.target.value);
                                    setTargetModuleIds([]);
                                }}
                                className={`w-full p-2.5 rounded-xl text-xs font-bold ${styles.select}`}
                            >
                                <option value="">-- Optional: Select Track --</option>
                                {skillTracks.map(t => (
                                    <option key={t.trackId} value={t.trackId}>
                                        {t.icon || '🗺️'} {t.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedUploadTrack && (selectedUploadTrack.modules?.length || 0) > 0 && (
                            <div className="space-y-1.5">
                                <div className="text-[11px] font-black uppercase">
                                    Assign to Module / Session ({targetModuleIds.length} selected)
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                                    {selectedUploadTrack.modules.map((mod, idx) => {
                                        const checked = targetModuleIds.includes(mod.moduleId);
                                        return (
                                            <button
                                                key={mod.moduleId}
                                                type="button"
                                                onClick={() => toggleModuleId(mod.moduleId, targetModuleIds, setTargetModuleIds)}
                                                className={`p-2 rounded-xl text-left text-xs flex items-center gap-2 cursor-pointer transition ${
                                                    checked ? styles.navItemActive : styles.secondaryBtn
                                                }`}
                                            >
                                                {checked ? <CheckSquare className="w-3.5 h-3.5 shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                                                <span className="truncate font-bold">{idx + 1}. {mod.title}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={uploading}
                    className={`w-full py-3.5 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${styles.primaryBtn}`}
                >
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? 'Uploading Presentation...' : 'Upload & Add to Platform'}</span>
                </button>
            </form>

            {/* Presentations Library */}
            <section className={`p-4 sm:p-6 rounded-[1.75rem] sm:rounded-[2rem] space-y-4 ${styles.surfaceCard}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-base font-black uppercase tracking-tight">
                        {isAdminView ? 'All Platform Presentations' : 'Presentations'} ({filteredPresentations.length})
                    </h2>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto">
                        <div className="relative w-full sm:w-auto sm:min-w-[200px]">
                            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${styles.mutedText}`} />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search presentations..."
                                className={`w-full pl-8 pr-3 py-2 rounded-xl text-xs font-bold ${styles.input}`}
                            />
                        </div>
                        <select
                            value={filterTrackId}
                            onChange={e => setFilterTrackId(e.target.value)}
                            aria-label="Filter by track"
                            className={`w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold ${styles.select}`}
                        >
                            <option value="">All Tracks</option>
                            {skillTracks.map(t => (
                                <option key={t.trackId} value={t.trackId}>{t.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="py-10 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                    </div>
                ) : filteredPresentations.length === 0 ? (
                    <div className={`p-8 rounded-2xl text-center ${styles.subtleBox}`}>
                        <Layers className="w-8 h-8 mx-auto mb-2 opacity-60" />
                        <p className={`text-xs sm:text-sm font-bold ${styles.mutedText}`}>
                            No presentations uploaded yet. Download the sample JSON above and upload your first deck!
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                        {filteredPresentations.map(deck => {
                            const deckId = deck.presentationId || deck.title;
                            const assignedTrack = deck.trackId ? trackMap.get(deck.trackId) : undefined;
                            const linkedModuleIds = Array.from(
                                new Set([deck.moduleId, ...(deck.moduleIds || [])].filter((x): x is string => Boolean(x)))
                            );
                            const linkedClass = deck.clanId ? classMap.get(deck.clanId) : undefined;
                            const canManage = isAdminView || deck.createdBy === currentUser.userId;
                            const isAssignOpen = Boolean(deck.presentationId && assigningId === deck.presentationId);
                            const isBoardEditing = Boolean(deck.presentationId && boardEditingDeck?.presentationId === deck.presentationId);
                            const isDeleteConfirm = Boolean(deck.presentationId && confirmDeleteId === deck.presentationId);

                            return (
                                <div key={deckId} className={`p-4 rounded-2xl space-y-3 min-w-0 ${styles.subtleBox}`}>
                                    <div className="flex flex-col gap-2.5 min-w-0">
                                        <div className="flex items-start justify-between gap-2 min-w-0">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-black text-sm sm:text-base break-words leading-snug">{deck.title}</h3>
                                                <div className={`text-[11px] font-semibold mt-0.5 ${styles.mutedText}`}>
                                                    {deck.slides?.length || 0} slides • {deck.creatorName ? `by ${deck.creatorName}` : 'Teacher'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewDeck(deck)}
                                                className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer ${styles.primaryBtn}`}
                                            >
                                                <MonitorPlay className="w-3.5 h-3.5" />
                                                <span>Present</span>
                                            </button>
                                            {canManage && deck.presentationId && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => openAssignDrawer(deck)}
                                                        className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer ${styles.secondaryBtn}`}
                                                        title="Assign to module"
                                                    >
                                                        <Link2 className="w-3.5 h-3.5" />
                                                        <span>Assign</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openBoardEditor(deck)}
                                                        className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer ${
                                                            isBoardEditing ? styles.primaryBtn : styles.secondaryBtn
                                                        }`}
                                                        title="Open visual slide board & JSON editor"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        <span>Update JSON</span>
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => triggerJsonDownload({
                                                    title: deck.title,
                                                    description: deck.description,
                                                    theme: deck.theme,
                                                    slides: deck.slides
                                                }, `${(deck.title || 'presentation').toLowerCase().replace(/\s+/g, '-')}.json`)}
                                                className={`p-1.5 rounded-xl cursor-pointer ${styles.secondaryBtn}`}
                                                title="Download JSON"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                            </button>
                                            {canManage && deck.presentationId && (
                                                isDeleteConfirm ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(deck.presentationId!)}
                                                            className={`px-2 py-1.5 rounded-xl text-[11px] cursor-pointer ${styles.dangerBtn}`}
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmDeleteId(null)}
                                                            className={`px-2 py-1.5 rounded-xl text-[11px] cursor-pointer ${styles.secondaryBtn}`}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDeleteId(deck.presentationId!)}
                                                        className={`p-1.5 rounded-xl cursor-pointer ${styles.dangerBtn}`}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {assignedTrack && (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${styles.pillSuccess}`}>
                                                {assignedTrack.title}
                                            </span>
                                        )}
                                        {linkedModuleIds.map(mId => {
                                            const meta = moduleLookup.get(mId);
                                            return (
                                                <span key={mId} className={`px-2 py-0.5 rounded-full text-[10px] font-black ${styles.pillPrimary}`}>
                                                    {meta ? `Session ${meta.order}: ${meta.title}` : mId}
                                                </span>
                                            );
                                        })}
                                        {linkedClass && (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${styles.pillNeutral}`}>
                                                [{linkedClass.tag}]
                                            </span>
                                        )}
                                    </div>

                                    {isAssignOpen && deck.presentationId && (
                                        <div className={`p-3 rounded-xl space-y-2.5 border-t ${styles.divider} ${styles.surfaceCard}`}>
                                            <select
                                                value={assignTrackId}
                                                onChange={e => {
                                                    setAssignTrackId(e.target.value);
                                                    setAssignModuleIds([]);
                                                }}
                                                className={`w-full p-2 rounded-lg text-xs font-bold ${styles.select}`}
                                            >
                                                <option value="">-- No Specific Track --</option>
                                                {skillTracks.map(t => (
                                                    <option key={t.trackId} value={t.trackId}>{t.title}</option>
                                                ))}
                                            </select>

                                            {selectedAssignTrack && (selectedAssignTrack.modules?.length || 0) > 0 && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
                                                    {selectedAssignTrack.modules.map((mod, idx) => {
                                                        const checked = assignModuleIds.includes(mod.moduleId);
                                                        return (
                                                            <button
                                                                key={mod.moduleId}
                                                                type="button"
                                                                onClick={() => toggleModuleId(mod.moduleId, assignModuleIds, setAssignModuleIds)}
                                                                className={`p-2 rounded-lg text-left text-[11px] flex items-center gap-1.5 cursor-pointer ${
                                                                    checked ? styles.navItemActive : styles.subtleBox
                                                                }`}
                                                            >
                                                                {checked ? <CheckSquare className="w-3 h-3 shrink-0" /> : <Square className="w-3 h-3 shrink-0 opacity-60" />}
                                                                <span className="truncate font-bold">{idx + 1}. {mod.title}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setAssigningId(null)}
                                                    className={`px-3 py-1 rounded-lg text-xs cursor-pointer ${styles.secondaryBtn}`}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={savingAssign}
                                                    onClick={() => handleSaveAssignment(deck.presentationId!)}
                                                    className={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 cursor-pointer ${styles.successBtn}`}
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                    <span>{savingAssign ? 'Saving...' : 'Save'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Interactive Visual Slide Board & Raw JSON Studio Modal */}
            {boardEditingDeck && (
                <PresentationVisualBoardModal
                    deck={boardEditingDeck}
                    userId={currentUser.userId}
                    userName={currentUser.name || 'Teacher'}
                    onClose={() => setBoardEditingDeck(null)}
                    savePresentation={(payload) => api.savePresentation(payload, currentUser.userId)}
                    onSaved={async () => {
                        await loadPresentations();
                        onChanged?.();
                    }}
                />
            )}
        </div>
    );
};

export default PresentationLibraryManager;
