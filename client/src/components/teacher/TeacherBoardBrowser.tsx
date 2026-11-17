import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    MonitorPlay,
    Compass,
    Search,
    Upload,
    CheckCircle2,
    AlertTriangle,
    Layers,
    ArrowLeft,
    Plus,
    Sparkles
} from 'lucide-react';
import type { MotionPresentation, SkillTrack, SkillModule, UserData } from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { TRAVELO_PART2_DECK } from '../../constants/traveloSlideDeck';
import { PresentationModePlayer } from '../presentation/PresentationModePlayer';
import { getTeacherThemeStyles } from './teacherTheme';

type BoardFilterTab = 'all' | 'has_slides' | 'missing_slides';

interface TeacherBoardBrowserProps {
    user: UserData;
    skillTracks: SkillTrack[];
    initialTrackId?: string | null;
    selectedClassId?: string;
    onUploadForModule: (trackId: string, moduleId: string) => void;
}

export const TeacherBoardBrowser: React.FC<TeacherBoardBrowserProps> = ({
    user,
    skillTracks,
    initialTrackId,
    selectedClassId,
    onUploadForModule
}) => {
    const { theme } = useTheme();
    const styles = useMemo(() => getTeacherThemeStyles(theme), [theme]);

    const [presentations, setPresentations] = useState<MotionPresentation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrackId, setSelectedTrackId] = useState<string>(() => {
        if (initialTrackId && skillTracks.some(t => t.trackId === initialTrackId)) {
            return initialTrackId;
        }
        return skillTracks[0]?.trackId || '';
    });
    const [filterTab, setFilterTab] = useState<BoardFilterTab>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeLaunch, setActiveLaunch] = useState<{
        deck: MotionPresentation;
        moduleTitle?: string;
    } | null>(null);

    const loadPresentations = useCallback(async () => {
        setLoading(true);
        try {
            const list = await api.getPresentations({}, user.userId);
            setPresentations(Array.isArray(list) ? list : []);
        } catch {
            setPresentations([]);
        } finally {
            setLoading(false);
        }
    }, [user.userId]);

    useEffect(() => {
        loadPresentations();
    }, [loadPresentations]);

    const effectiveTrackId = useMemo(() => {
        if (selectedTrackId && skillTracks.some(t => t.trackId === selectedTrackId)) {
            return selectedTrackId;
        }
        if (initialTrackId && skillTracks.some(t => t.trackId === initialTrackId)) {
            return initialTrackId;
        }
        return skillTracks[0]?.trackId || '';
    }, [selectedTrackId, initialTrackId, skillTracks]);

    const selectedTrack = useMemo(
        () => skillTracks.find(t => t.trackId === effectiveTrackId) || null,
        [skillTracks, effectiveTrackId]
    );

    const modulesWithDecks = useMemo(() => {
        if (!selectedTrack) return [];
        const modules = selectedTrack.modules || [];

        return modules.map((mod: SkillModule, idx: number) => {
            const linkedDecks = presentations.filter((deck) => {
                const modMatch = deck.moduleId === mod.moduleId || Boolean(deck.moduleIds?.includes(mod.moduleId));
                if (!modMatch) return false;
                if (deck.trackId && deck.trackId !== selectedTrack.trackId) return false;
                return true;
            });

            return {
                module: mod,
                order: idx + 1,
                decks: linkedDecks
            };
        });
    }, [selectedTrack, presentations]);

    const summary = useMemo(() => {
        const total = modulesWithDecks.length;
        const withSlides = modulesWithDecks.filter(item => item.decks.length > 0).length;
        const missingSlides = total - withSlides;
        const deckCount = modulesWithDecks.reduce((acc, item) => acc + item.decks.length, 0);
        return { total, withSlides, missingSlides, deckCount };
    }, [modulesWithDecks]);

    const filteredModules = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return modulesWithDecks.filter(item => {
            if (filterTab === 'has_slides' && item.decks.length === 0) return false;
            if (filterTab === 'missing_slides' && item.decks.length > 0) return false;
            if (!q) return true;
            const inModule = `${item.module.title} ${item.module.description || ''}`.toLowerCase().includes(q);
            const inDecks = item.decks.some(d => `${d.title} ${d.description || ''}`.toLowerCase().includes(q));
            return inModule || inDecks;
        });
    }, [modulesWithDecks, filterTab, searchQuery]);

    // If a deck is launched on the board, render the Interactive Board Player with a clean Back bar
    if (activeLaunch) {
        return (
            <section className="space-y-4">
                <div className={`p-4 rounded-2xl flex items-center justify-between flex-wrap gap-3 ${styles.surfaceCard}`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={() => setActiveLaunch(null)}
                            className={`px-3.5 py-2 rounded-xl text-xs uppercase flex items-center gap-1.5 cursor-pointer shrink-0 ${styles.secondaryBtn}`}
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>All Modules</span>
                        </button>
                        <div className="min-w-0">
                            {activeLaunch.moduleTitle && (
                                <div className={`text-[10px] font-black uppercase truncate ${styles.mutedText}`}>
                                    {selectedTrack?.title} &bull; {activeLaunch.moduleTitle}
                                </div>
                            )}
                            <h3 className="text-sm font-black truncate">{activeLaunch.deck.title}</h3>
                        </div>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${styles.pillSuccess}`}>
                        {activeLaunch.deck.slides?.length || 0} Interactive Slides
                    </span>
                </div>

                <PresentationModePlayer
                    key={`${activeLaunch.deck.presentationId || activeLaunch.deck.title}-${activeLaunch.deck.updatedAt || ''}-${activeLaunch.deck.slides?.length || 0}`}
                    embedded={true}
                    presentation={activeLaunch.deck}
                    clanId={selectedClassId || undefined}
                    isTeacher={true}
                    userId={user.userId}
                    userName={user.name}
                    onClose={() => setActiveLaunch(null)}
                />
            </section>
        );
    }

    return (
        <div className="space-y-6">
            {/* Track Chooser + Slide Coverage Strip (mirrors Quiz Browser layout) */}
            <div className={`p-5 sm:p-6 rounded-[2rem] space-y-4 ${styles.surfaceCard}`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${styles.pillPrimary}`}>
                                Interactive Teaching Board
                            </span>
                            {selectedTrack && (
                                <span className={`text-xs font-bold ${styles.mutedText}`}>
                                    {summary.withSlides}/{summary.total} Modules Ready &bull; {summary.deckCount} Slide Deck{summary.deckCount === 1 ? '' : 's'}
                                </span>
                            )}
                        </div>
                        <h2 className="text-lg font-black uppercase tracking-tight">
                            Choose a Track to Launch or Upload Module Slides
                        </h2>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
                        <select
                            value={effectiveTrackId}
                            onChange={(e) => setSelectedTrackId(e.target.value)}
                            aria-label="Choose track for teaching board"
                            className={`px-3.5 py-2.5 rounded-xl text-xs font-black cursor-pointer min-w-[240px] ${styles.select}`}
                        >
                            {skillTracks.length === 0 ? (
                                <option value="">No tracks available</option>
                            ) : (
                                skillTracks.map(track => (
                                    <option key={track.trackId} value={track.trackId}>
                                        {track.icon || '🗺️'} {track.title} ({track.modules?.length || 0} modules)
                                    </option>
                                ))
                            )}
                        </select>

                        <button
                            type="button"
                            onClick={() => setActiveLaunch({ deck: TRAVELO_PART2_DECK, moduleTitle: 'Practice Sample Deck' })}
                            className={`px-3.5 py-2.5 rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${styles.secondaryBtn}`}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Practice Sample Board</span>
                        </button>
                    </div>
                </div>

                {/* Filter Tabs & Search */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {([
                            { id: 'all' as const, label: `All Modules (${summary.total})` },
                            { id: 'has_slides' as const, label: `Has Slides (${summary.withSlides})` },
                            { id: 'missing_slides' as const, label: `Missing Slides (${summary.missingSlides})` }
                        ]).map(tab => {
                            const active = filterTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setFilterTab(tab.id)}
                                    className={`px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider cursor-pointer transition ${
                                        active ? styles.navItemActive : styles.navItemIdle
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative w-full md:w-72">
                        <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${styles.mutedText}`} />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search modules or slide decks..."
                            className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold ${styles.input}`}
                        />
                    </div>
                </div>
            </div>

            {/* Modules Grid */}
            {loading ? (
                <div className={`py-14 text-center rounded-[2rem] ${styles.surfaceCard}`}>
                    <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600 mx-auto" />
                </div>
            ) : !selectedTrack || filteredModules.length === 0 ? (
                <div className={`p-10 rounded-[2rem] text-center space-y-3 ${styles.surfaceCard}`}>
                    <Compass className={`w-10 h-10 mx-auto ${styles.mutedText}`} />
                    <h3 className="text-lg font-black uppercase tracking-tight">No Matching Modules</h3>
                    <p className={`text-xs max-w-md mx-auto font-medium ${styles.mutedText}`}>
                        {selectedTrack
                            ? 'Try clearing your search or switching the module filter tab above.'
                            : 'No curriculum tracks are loaded yet.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredModules.map(({ module: mod, order, decks }) => {
                        const hasSlides = decks.length > 0;

                        return (
                            <div
                                key={mod.moduleId}
                                className={`p-5 rounded-[1.75rem] flex flex-col justify-between gap-4 ${styles.surfaceCard}`}
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-black ${styles.pillNeutral}`}>
                                                Session {order}
                                            </span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${styles.pillPrimary}`}>
                                                {mod.type || 'lesson'}
                                            </span>
                                        </div>

                                        {hasSlides ? (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${styles.pillSuccess}`}>
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span>Has Slides ({decks.length})</span>
                                            </span>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${styles.pillWarning}`}>
                                                <AlertTriangle className="w-3 h-3" />
                                                <span>No Slides Yet</span>
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-base font-black tracking-tight">{mod.title}</h3>
                                        {mod.description && (
                                            <p className={`text-xs font-medium mt-1 line-clamp-2 ${styles.mutedText}`}>
                                                {mod.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {hasSlides ? (
                                    <div className="space-y-2">
                                        {decks.map((deck) => (
                                            <div
                                                key={deck.presentationId}
                                                className={`p-3 rounded-2xl flex items-center justify-between gap-3 ${styles.subtleBox}`}
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-xs font-black truncate">{deck.title}</div>
                                                    <div className={`text-[11px] font-bold flex items-center gap-1.5 mt-0.5 ${styles.mutedText}`}>
                                                        <Layers className="w-3 h-3 shrink-0" />
                                                        <span>{deck.slides?.length || 0} slides</span>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => setActiveLaunch({ deck, moduleTitle: `Session ${order}: ${mod.title}` })}
                                                    className={`px-3.5 py-2 rounded-xl text-xs uppercase flex items-center gap-1.5 cursor-pointer shrink-0 ${styles.primaryBtn}`}
                                                >
                                                    <MonitorPlay className="w-3.5 h-3.5" />
                                                    <span>Launch Board</span>
                                                </button>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={() => onUploadForModule(selectedTrack.trackId, mod.moduleId)}
                                            className={`w-full py-2 px-3 rounded-xl text-[11px] uppercase flex items-center justify-center gap-1.5 cursor-pointer ${styles.secondaryBtn}`}
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Upload Another Slide Deck for This Module</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className={`p-4 rounded-2xl space-y-3 ${styles.subtleBox}`}>
                                        <p className={`text-xs font-semibold leading-relaxed ${styles.mutedText}`}>
                                            No presentation slides uploaded for <span className="font-black">Session {order}</span> yet. Upload a Sample JSON deck to teach this module on the Interactive Board.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => onUploadForModule(selectedTrack.trackId, mod.moduleId)}
                                            className={`w-full py-2.5 px-4 rounded-xl text-xs uppercase flex items-center justify-center gap-2 cursor-pointer ${styles.primaryBtn}`}
                                        >
                                            <Upload className="w-3.5 h-3.5" />
                                            <span>Upload Slides for This Module &rarr;</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TeacherBoardBrowser;
