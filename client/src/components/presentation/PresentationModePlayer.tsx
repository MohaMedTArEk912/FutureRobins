import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, ChevronLeft, ChevronRight, Maximize2, Minimize2, Sparkles, CheckCircle2,
    XCircle, Radio, HelpCircle, Eye, Users, Award, Code2, Lightbulb,
    Check, PenTool, MousePointer, Crosshair, Eraser, Undo2, ThumbsUp, Hand
} from 'lucide-react';
import type { MotionPresentation, MotionSlide, PresentationTheme } from '../../types';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import { sounds } from '../../lib/soundEffects';

interface DrawStroke {
    id: string;
    color: string;
    width: number;
    points: { x: number; y: number }[];
}

interface PresentationModePlayerProps {
    presentation: MotionPresentation;
    clanId?: string;
    isTeacher: boolean;
    userId: string;
    userName: string;
    embedded?: boolean;
    isSessionFinished?: boolean;
    onFinishSession?: () => Promise<void> | void;
    onClose?: () => void;
}

const THEME_STYLES: Record<PresentationTheme, {
    bg: string;
    card: string;
    accent: string;
    badge: string;
    muted: string;
    optionBg: string;
}> = {
    'dark-tech': {
        bg: 'bg-[#0a0908] text-[#f5f3ec]',
        card: 'bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-2xl',
        accent: 'bg-indigo-500',
        badge: 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30',
        muted: 'text-slate-300',
        optionBg: 'bg-white/[0.06] hover:bg-white/[0.12] border-white/15'
    },
    'bento': {
        bg: 'bg-[#fefce8] text-black',
        card: 'bg-white border-2 border-black shadow-[4px_4px_0px_#000]',
        accent: 'bg-[#bef264]',
        badge: 'bg-[#fde047] text-black border-2 border-black',
        muted: 'text-slate-700',
        optionBg: 'bg-white hover:bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000]'
    },
    'editorial': {
        bg: 'bg-[#f8f6f1] text-slate-900',
        card: 'bg-white border border-slate-200 shadow-xl',
        accent: 'bg-slate-900',
        badge: 'bg-slate-900 text-white',
        muted: 'text-slate-600',
        optionBg: 'bg-slate-50 hover:bg-slate-100 border border-slate-300'
    },
    'neon': {
        bg: 'bg-[#0a0908] text-cyan-50',
        card: 'bg-[#0b1324]/90 border border-cyan-400/30 shadow-[0_0_40px_rgba(34,211,238,0.12)]',
        accent: 'bg-cyan-400',
        badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40',
        muted: 'text-cyan-100/80',
        optionBg: 'bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-400/30'
    }
};

const PEN_COLORS = ['#fde047', '#38bdf8', '#fb7185', '#4ade80'];

const getMotionClass = (motion: MotionSlide['motion']) => {
    switch (motion) {
        case 'slide-left':
            return 'animate-in fade-in slide-in-from-right-8 duration-500';
        case 'zoom-in':
            return 'animate-in fade-in zoom-in-95 duration-500';
        case 'pop':
            return 'animate-in fade-in zoom-in-90 duration-300';
        case 'flip':
            return 'animate-in fade-in slide-in-from-top-6 duration-500';
        case 'stagger':
            return 'animate-in fade-in slide-in-from-bottom-6 duration-500';
        default:
            return 'animate-in fade-in slide-in-from-bottom-4 duration-500';
    }
};

export const PresentationModePlayer: React.FC<PresentationModePlayerProps> = ({
    presentation,
    clanId,
    isTeacher,
    userId,
    userName,
    embedded = true,
    isSessionFinished,
    onFinishSession,
    onClose
}) => {
    const { socket, connected } = useSocket();
    const { isBento } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);

    const slides = presentation.slides && presentation.slides.length > 0
        ? presentation.slides
        : [{
            id: 'empty_1',
            layout: 'hero' as const,
            motion: 'fade-up' as const,
            title: presentation.title,
            subtitle: 'No slides added yet'
        }];

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
    const [revealedCheckups, setRevealedCheckups] = useState<Record<string, boolean>>({});
    const [liveResponses, setLiveResponses] = useState<Record<string, Record<string, { userName: string; optionIndex: number }>>>({});
    const [finishingSession, setFinishingSession] = useState(false);

    // Unified Live + Interactive Teaching Board Mode
    const isLiveClass = Boolean(clanId && connected);
    const [boardTool, setBoardTool] = useState<'pointer' | 'pen' | 'laser'>('pointer');
    const [penColor, setPenColor] = useState(PEN_COLORS[0]);
    const [strokesBySlide, setStrokesBySlide] = useState<Record<string, DrawStroke[]>>({});
    const [activeStroke, setActiveStroke] = useState<DrawStroke | null>(null);
    const [laserPos, setLaserPos] = useState<{ x: number; y: number; active: boolean }>({ x: 50, y: 50, active: false });
    const [highlightedElements, setHighlightedElements] = useState<Record<string, string>>({});
    const [reactions, setReactions] = useState<{ got_it: number; question: number; lastLabel?: string }>({ got_it: 0, question: 0 });

    const currentSlide = slides[Math.min(currentIndex, slides.length - 1)];
    const resolvedTheme: PresentationTheme = isBento
        ? 'bento'
        : (presentation.theme || 'dark-tech');
    const themeStyle = THEME_STYLES[resolvedTheme] || THEME_STYLES['dark-tech'];
    const isLightSurface = resolvedTheme === 'bento' || resolvedTheme === 'editorial';
    const isLastSlide = currentIndex === slides.length - 1;
    const deckKey = presentation.presentationId || presentation.title;

    useEffect(() => {
        if (!socket || !deckKey) return;

        socket.emit('join_presentation', {
            presentationId: deckKey,
            clanId,
            role: isTeacher ? 'teacher' : 'student'
        });

        const handleSlideSynced = (payload: { presentationId: string; slideIndex: number; revealedCheckups?: Record<string, boolean> }) => {
            if (payload.presentationId === deckKey && !isTeacher) {
                setCurrentIndex(Math.max(0, Math.min(payload.slideIndex, slides.length - 1)));
                if (payload.revealedCheckups) setRevealedCheckups(payload.revealedCheckups);
            }
        };

        const handleCheckupResponse = (payload: { slideId: string; userId: string; userName: string; optionIndex: number }) => {
            setLiveResponses(prev => ({
                ...prev,
                [payload.slideId]: {
                    ...(prev[payload.slideId] || {}),
                    [payload.userId]: { userName: payload.userName, optionIndex: payload.optionIndex }
                }
            }));
        };

        const handleCheckupRevealed = (payload: { slideId: string; revealed: boolean }) => {
            setRevealedCheckups(prev => ({ ...prev, [payload.slideId]: payload.revealed }));
        };

        const handleStrokeAdded = ({ slideId, stroke }: { slideId: string; stroke: DrawStroke }) => {
            if (!isTeacher) {
                setStrokesBySlide(prev => ({
                    ...prev,
                    [slideId]: [...(prev[slideId] || []), stroke]
                }));
            }
        };

        const handleBoardCleared = ({ slideId }: { slideId: string }) => {
            if (!isTeacher) {
                setStrokesBySlide(prev => ({ ...prev, [slideId]: [] }));
            }
        };

        const handleElementHighlighted = ({ slideId, elementId }: { slideId: string; elementId: string }) => {
            setHighlightedElements(prev => ({ ...prev, [slideId]: elementId }));
        };

        const handleLaserSynced = (pos: { x: number; y: number; active: boolean }) => {
            if (!isTeacher) setLaserPos(pos);
        };

        const handleReaction = (payload: { userName: string; type: 'got_it' | 'question' }) => {
            setReactions(prev => ({
                got_it: payload.type === 'got_it' ? prev.got_it + 1 : prev.got_it,
                question: payload.type === 'question' ? prev.question + 1 : prev.question,
                lastLabel: `${payload.userName} ${payload.type === 'got_it' ? '👍 Got it!' : '✋ Has a question'}`
            }));
        };

        socket.on('presentation_slide_synced', handleSlideSynced);
        socket.on('presentation_checkup_response', handleCheckupResponse);
        socket.on('presentation_checkup_revealed', handleCheckupRevealed);
        socket.on('presentation_stroke_added', handleStrokeAdded);
        socket.on('presentation_board_cleared', handleBoardCleared);
        socket.on('presentation_element_highlighted', handleElementHighlighted);
        socket.on('presentation_laser_synced', handleLaserSynced);
        socket.on('presentation_reaction_received', handleReaction);

        return () => {
            socket.emit('leave_presentation', {
                presentationId: deckKey,
                clanId,
                role: isTeacher ? 'teacher' : 'student'
            });
            socket.off('presentation_slide_synced', handleSlideSynced);
            socket.off('presentation_checkup_response', handleCheckupResponse);
            socket.off('presentation_checkup_revealed', handleCheckupRevealed);
            socket.off('presentation_stroke_added', handleStrokeAdded);
            socket.off('presentation_board_cleared', handleBoardCleared);
            socket.off('presentation_element_highlighted', handleElementHighlighted);
            socket.off('presentation_laser_synced', handleLaserSynced);
            socket.off('presentation_reaction_received', handleReaction);
        };
    }, [socket, deckKey, clanId, isTeacher, slides.length]);

    const goToSlide = useCallback((nextIdx: number) => {
        const clamped = Math.max(0, Math.min(nextIdx, slides.length - 1));
        setCurrentIndex(clamped);
        sounds.playClick();
        if (isTeacher && isLiveClass && socket && deckKey) {
            socket.emit('presentation_sync_slide', {
                presentationId: deckKey,
                clanId,
                slideIndex: clamped,
                revealedCheckups
            });
        }
    }, [slides.length, isTeacher, isLiveClass, socket, deckKey, clanId, revealedCheckups]);

    const toggleFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await containerRef.current?.requestFullscreen();
                setIsFullscreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullscreen(false);
            }
        } catch {
            // ignore fullscreen errors
        }
    }, []);

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const targetTag = (e.target as HTMLElement)?.tagName;
            if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') return;
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                goToSlide(currentIndex + 1);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goToSlide(currentIndex - 1);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [currentIndex, goToSlide]);

    const getNormalizedCoords = (e: React.PointerEvent<HTMLDivElement>) => {
        const rect = stageRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
        return {
            x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
            y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
        };
    };

    const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isTeacher || boardTool !== 'pen') return;
        const pt = getNormalizedCoords(e);
        setActiveStroke({
            id: `stroke_${Date.now()}`,
            color: penColor,
            width: 3,
            points: [pt]
        });
    };

    const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (boardTool === 'laser' && isTeacher) {
            const pt = getNormalizedCoords(e);
            const nextLaser = { x: pt.x, y: pt.y, active: true };
            setLaserPos(nextLaser);
            if (isLiveClass && socket && deckKey) {
                socket.emit('presentation_laser_move', { presentationId: deckKey, clanId, ...nextLaser });
            }
            return;
        }
        if (boardTool === 'pen' && activeStroke && isTeacher) {
            const pt = getNormalizedCoords(e);
            setActiveStroke(prev => prev ? { ...prev, points: [...prev.points, pt] } : null);
        }
    };

    const handleStagePointerUp = () => {
        if (boardTool === 'pen' && activeStroke && isTeacher) {
            if (activeStroke.points.length > 1) {
                setStrokesBySlide(prev => ({
                    ...prev,
                    [currentSlide.id]: [...(prev[currentSlide.id] || []), activeStroke]
                }));
                if (isLiveClass && socket && deckKey) {
                    socket.emit('presentation_draw_stroke', {
                        presentationId: deckKey,
                        clanId,
                        slideId: currentSlide.id,
                        stroke: activeStroke
                    });
                }
            }
            setActiveStroke(null);
        }
    };

    const handleStagePointerLeave = () => {
        if (boardTool === 'laser' && isTeacher) {
            const off = { x: laserPos.x, y: laserPos.y, active: false };
            setLaserPos(off);
            if (isLiveClass && socket && deckKey) {
                socket.emit('presentation_laser_move', { presentationId: deckKey, clanId, ...off });
            }
        }
        handleStagePointerUp();
    };

    const handleUndoStroke = () => {
        setStrokesBySlide(prev => {
            const list = prev[currentSlide.id] || [];
            return { ...prev, [currentSlide.id]: list.slice(0, -1) };
        });
    };

    const handleClearBoard = () => {
        setStrokesBySlide(prev => ({ ...prev, [currentSlide.id]: [] }));
        if (isLiveClass && socket && deckKey) {
            socket.emit('presentation_clear_board', { presentationId: deckKey, clanId, slideId: currentSlide.id });
        }
    };

    const handleHighlightElement = (elementId: string) => {
        setHighlightedElements(prev => ({ ...prev, [currentSlide.id]: elementId }));
        sounds.playClick();
        if (isTeacher && isLiveClass && socket && deckKey) {
            socket.emit('presentation_highlight_element', {
                presentationId: deckKey,
                clanId,
                slideId: currentSlide.id,
                elementId
            });
        }
    };

    const handleSelectOption = (slide: MotionSlide, optionIndex: number) => {
        setSelectedAnswers(prev => ({ ...prev, [slide.id]: optionIndex }));
        if (!isLiveClass) {
            setRevealedCheckups(prev => ({ ...prev, [slide.id]: true }));
        }
        if (socket && deckKey) {
            socket.emit('presentation_submit_checkup', {
                presentationId: deckKey,
                clanId,
                slideId: slide.id,
                userId,
                userName,
                optionIndex
            });
        }
        if (slide.checkupQuestion && optionIndex === slide.checkupQuestion.correctAnswer) {
            sounds.playPowerUp();
        } else {
            sounds.playClick();
        }
    };

    const handleRevealCheckup = (slideId: string) => {
        const nextVal = !revealedCheckups[slideId];
        setRevealedCheckups(prev => ({ ...prev, [slideId]: nextVal }));
        if (isTeacher && socket && deckKey) {
            socket.emit('presentation_reveal_checkup', {
                presentationId: deckKey,
                clanId,
                slideId,
                revealed: nextVal
            });
        }
    };

    const sendReaction = (type: 'got_it' | 'question') => {
        sounds.playClick();
        if (socket && deckKey) {
            socket.emit('presentation_reaction', {
                presentationId: deckKey,
                clanId,
                userId,
                userName,
                type
            });
        } else {
            setReactions(prev => ({
                got_it: type === 'got_it' ? prev.got_it + 1 : prev.got_it,
                question: type === 'question' ? prev.question + 1 : prev.question,
                lastLabel: `${userName} ${type === 'got_it' ? '👍 Got it!' : '✋ Has a question'}`
            }));
        }
    };

    const handleFinishClick = async () => {
        if (!onFinishSession) return;
        setFinishingSession(true);
        try {
            await onFinishSession();
        } finally {
            setFinishingSession(false);
        }
    };

    const slideResponses = liveResponses[currentSlide.id] || {};
    const totalResponders = Object.keys(slideResponses).length;
    const currentStrokes = strokesBySlide[currentSlide.id] || [];
    const activeHighlightId = highlightedElements[currentSlide.id];

    const renderVisualBlock = (slide: MotionSlide) => {
        const vb = slide.visualBlock;
        if (!vb) return null;

        if (vb.kind === 'page-structure' && vb.sections?.length) {
            const selectedSection = vb.sections.find(s => s.id === activeHighlightId) || vb.sections.find(s => s.highlight) || vb.sections[0];
            return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start mt-4">
                    <div className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">
                            Interactive Page Blueprint (Click a section)
                        </div>
                        {vb.sections.map((sec, idx) => {
                            const isActive = selectedSection?.id === sec.id;
                            return (
                                <button
                                    key={sec.id}
                                    type="button"
                                    onClick={() => handleHighlightElement(sec.id)}
                                    className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 border-2 ${
                                        isActive
                                            ? isBento
                                                ? 'bg-[#fde047] text-black border-black shadow-[4px_4px_0px_#000] scale-[1.01]'
                                                : 'bg-amber-400 text-black border-black shadow-[4px_4px_0px_#000] scale-[1.01]'
                                            : isBento
                                                ? 'bg-white text-black border-black hover:bg-[#fef9c3] shadow-[2px_2px_0px_#000]'
                                                : isLightSurface
                                                    ? 'bg-white text-slate-900 border-slate-300 hover:border-indigo-400'
                                                    : 'bg-white/[0.05] text-white border-white/15 hover:border-white/35'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                            isActive ? 'bg-black text-white' : themeStyle.badge
                                        }`}>
                                            {idx + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="font-black text-sm truncate">{sec.label}</div>
                                            {sec.tag && <div className="text-[10px] font-mono opacity-75">{sec.tag}</div>}
                                        </div>
                                    </div>
                                    {sec.highlight && (
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                            isActive ? 'bg-black text-amber-300' : 'bg-emerald-500/20 text-emerald-400'
                                        }`}>
                                            Focus
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {selectedSection && (
                        <div className={`p-5 rounded-2xl space-y-3 ${
                            isBento
                                ? 'bg-[#f8fafc] border-2 border-black shadow-[3px_3px_0px_#000] text-black'
                                : isLightSurface
                                    ? 'bg-slate-50 border border-slate-200 text-slate-900'
                                    : 'bg-black/25 border border-current/15'
                        }`}>
                            <div className="flex items-center justify-between gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black ${themeStyle.badge}`}>
                                    {selectedSection.tag || selectedSection.label}
                                </span>
                                <span className="text-[10px] font-black uppercase opacity-60">Section Inspector</span>
                            </div>
                            <h4 className="text-lg font-black">{selectedSection.label}</h4>
                            {selectedSection.description && (
                                <p className={`text-xs sm:text-sm leading-relaxed ${themeStyle.muted}`}>
                                    {selectedSection.description}
                                </p>
                            )}
                            {selectedSection.code && (
                                <pre className="p-3.5 rounded-xl bg-[#090d16] text-emerald-300 text-xs font-mono overflow-x-auto border border-white/10">
                                    <code>{selectedSection.code}</code>
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        if (vb.kind === 'split-cards') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <button
                        type="button"
                        onClick={() => handleHighlightElement('left_half')}
                        className={`text-left p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between min-h-[155px] ${
                            activeHighlightId === 'left_half'
                                ? isBento
                                    ? 'bg-[#fde047] text-black border-black shadow-[5px_5px_0px_#000]'
                                    : isLightSurface
                                        ? 'bg-indigo-50 text-slate-900 border-indigo-600 ring-2 ring-indigo-500'
                                        : 'bg-indigo-600/30 text-white border-amber-400 ring-2 ring-amber-400'
                                : isBento
                                    ? 'bg-[#f8fafc] text-black border-black hover:bg-[#fef9c3] shadow-[4px_4px_0px_#000]'
                                    : isLightSurface
                                        ? 'bg-white text-slate-900 border-slate-300 hover:border-indigo-400 shadow-sm'
                                        : 'bg-white/[0.06] text-white border-white/20 hover:border-white/40'
                        }`}
                    >
                        <div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${themeStyle.badge}`}>
                                {vb.leftCard?.tag || 'Left Half (50%)'}
                            </span>
                            <h4 className="text-lg sm:text-xl font-black mt-2.5">{vb.leftCard?.title || 'Main Feature Card'}</h4>
                            <p className={`text-xs sm:text-sm mt-1.5 leading-relaxed ${themeStyle.muted}`}>
                                {vb.leftCard?.body}
                            </p>
                        </div>
                        <div className="text-[10px] font-mono font-bold opacity-75 mt-3">Heading + Paragraph Card</div>
                    </button>

                    <div className="grid grid-rows-2 gap-3.5">
                        {(vb.rightCards || []).map((rc, i) => {
                            const elId = `right_card_${i}`;
                            const isHl = activeHighlightId === elId;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => handleHighlightElement(elId)}
                                    className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                        isHl
                                            ? isBento
                                                ? 'bg-[#bef264] text-black border-black shadow-[5px_5px_0px_#000]'
                                                : isLightSurface
                                                    ? 'bg-emerald-50 text-slate-900 border-emerald-600 ring-2 ring-emerald-500'
                                                    : 'bg-emerald-500/25 text-white border-amber-400 ring-2 ring-amber-400'
                                            : isBento
                                                ? 'bg-[#ffedd5] text-black border-black hover:bg-[#fef9c3] shadow-[4px_4px_0px_#000]'
                                                : isLightSurface
                                                    ? 'bg-slate-50 text-slate-900 border-slate-300 hover:border-indigo-400 shadow-sm'
                                                    : 'bg-indigo-500/15 text-white border-white/20 hover:border-white/40'
                                    }`}
                                >
                                    <div>
                                        <div className="font-black text-sm">{rc.title}</div>
                                        {rc.subtitle && <div className="text-xs opacity-75 mt-0.5">{rc.subtitle}</div>}
                                    </div>
                                    {rc.badge && (
                                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 ${themeStyle.badge}`}>
                                            {rc.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        }

        if (vb.kind === 'footer-anatomy') {
            return (
                <div className={`space-y-3 mt-4 p-4 rounded-2xl ${
                    isBento
                        ? 'bg-[#f8fafc] border-2 border-black shadow-[3px_3px_0px_#000]'
                        : isLightSurface
                            ? 'bg-slate-50 border border-slate-200'
                            : 'bg-black/20 border border-current/15'
                }`}>
                    <button
                        type="button"
                        onClick={() => handleHighlightElement('footer_part_1')}
                        className={`w-full p-4 rounded-xl border-2 flex items-center justify-between gap-4 flex-wrap cursor-pointer transition ${
                            activeHighlightId === 'footer_part_1'
                                ? isBento
                                    ? 'bg-[#fde047] text-black border-black shadow-[3px_3px_0px_#000]'
                                    : isLightSurface
                                        ? 'bg-amber-100 text-slate-900 border-amber-500'
                                        : 'bg-amber-400/20 text-white border-amber-400'
                                : isBento
                                    ? 'bg-white text-black border-black hover:bg-[#fef9c3] shadow-[2px_2px_0px_#000]'
                                    : isLightSurface
                                        ? 'bg-white text-slate-900 border-slate-300 hover:border-indigo-400'
                                        : 'bg-white/[0.04] text-white border-white/20 hover:border-white/40'
                        }`}
                    >
                        <span className="font-black text-sm">
                            Part 1: {vb.topNav?.brand || 'Brand Logo'}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                            {(vb.topNav?.links || []).map((lnk, i) => (
                                <span key={i} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${themeStyle.badge}`}>
                                    {lnk}
                                </span>
                            ))}
                        </div>
                    </button>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {(vb.columns || []).map((col, idx) => {
                            const colId = `footer_col_${idx}`;
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleHighlightElement(colId)}
                                    className={`text-left p-4 rounded-xl border-2 cursor-pointer transition ${
                                        activeHighlightId === colId
                                            ? isBento
                                                ? 'bg-[#bef264] text-black border-black shadow-[3px_3px_0px_#000]'
                                                : isLightSurface
                                                    ? 'bg-emerald-100 text-slate-900 border-emerald-600'
                                                    : 'bg-emerald-500/20 text-white border-emerald-400'
                                            : isBento
                                                ? 'bg-white text-black border-black hover:bg-[#e0f2fe] shadow-[2px_2px_0px_#000]'
                                                : isLightSurface
                                                    ? 'bg-white text-slate-900 border-slate-300 hover:border-indigo-400'
                                                    : 'bg-white/[0.04] text-white border-white/20 hover:border-white/40'
                                    }`}
                                >
                                    <div className="text-[10px] font-black uppercase tracking-wider opacity-75">
                                        Part 2 • Column {idx + 1}
                                    </div>
                                    <div className="font-black text-sm mt-1">{col.title}</div>
                                    <ul className="mt-2 space-y-1 text-xs opacity-90 font-medium">
                                        {col.items.map((it, ii) => (
                                            <li key={ii}>• {it}</li>
                                        ))}
                                    </ul>
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div
            ref={containerRef}
            className={`flex flex-col w-full min-w-0 ${themeStyle.bg} select-none overflow-hidden ${
                isFullscreen
                    ? 'fixed inset-0 z-[10050] h-dvh w-full rounded-none border-0'
                    : embedded
                        ? isBento
                            ? 'rounded-2xl border-2 border-black min-h-[460px] sm:min-h-[540px]'
                            : isLightSurface
                                ? 'rounded-2xl border border-slate-200 shadow-sm min-h-[460px] sm:min-h-[540px]'
                                : 'rounded-2xl border border-white/15 min-h-[460px] sm:min-h-[540px]'
                        : 'fixed inset-0 z-[10050] h-dvh w-full'
            }`}
        >
            {/* Top Bar + Unified Teaching Board Toolbar */}
            <div className={`px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-2.5 flex-wrap lg:flex-nowrap shrink-0 ${
                isBento
                    ? 'bg-white text-black border-b-2 border-black'
                    : isLightSurface
                        ? 'bg-white text-slate-900 border-b border-slate-200'
                        : 'border-b border-white/15'
            }`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0 ${themeStyle.badge}`}>
                        Teaching Board
                    </span>
                    <h2 className="font-black text-sm truncate min-w-0">{presentation.title}</h2>
                    {isLiveClass && (
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                                isBento
                                    ? 'bg-[#fecaca] text-black border border-black'
                                    : 'bg-rose-500/20 text-rose-500 border border-rose-500/40'
                            }`}
                        >
                            <Radio className="w-3 h-3 animate-pulse" />
                            <span>Live Sync</span>
                        </span>
                    )}
                </div>

                {/* Teacher Interactive Board Tools */}
                {isTeacher && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl flex-wrap ${
                        isBento
                            ? 'bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000]'
                            : isLightSurface
                                ? 'bg-slate-100 border border-slate-200 text-slate-800'
                                : 'bg-black/20 border border-current/10'
                    }`}>
                        <button
                            type="button"
                            onClick={() => setBoardTool('pointer')}
                            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                                boardTool === 'pointer'
                                    ? isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-indigo-600 text-white'
                                    : isBento ? 'text-black hover:bg-white/80' : isLightSurface ? 'text-slate-700 hover:bg-white' : 'text-slate-200 hover:bg-white/10'
                            }`}
                            title="Interactive Pointer (Click Wireframes)"
                        >
                            <MousePointer className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setBoardTool('pen')}
                            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                                boardTool === 'pen'
                                    ? isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-amber-400 text-black'
                                    : isBento ? 'text-black hover:bg-white/80' : isLightSurface ? 'text-slate-700 hover:bg-white' : 'text-slate-200 hover:bg-white/10'
                            }`}
                            title="Draw on Board"
                        >
                            <PenTool className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setBoardTool('laser')}
                            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                                boardTool === 'laser'
                                    ? isBento ? 'bg-[#fecaca] text-black border border-black' : 'bg-rose-500 text-white'
                                    : isBento ? 'text-black hover:bg-white/80' : isLightSurface ? 'text-slate-700 hover:bg-white' : 'text-slate-200 hover:bg-white/10'
                            }`}
                            title="Laser Pointer"
                        >
                            <Crosshair className="w-3.5 h-3.5" />
                        </button>

                        {boardTool === 'pen' && (
                            <div className="flex items-center gap-1 pl-1 border-l border-current/15">
                                {PEN_COLORS.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setPenColor(c)}
                                        style={{ backgroundColor: c }}
                                        className={`w-4 h-4 rounded-full cursor-pointer border border-black/30 ${penColor === c ? 'ring-2 ring-black dark:ring-white scale-110' : 'opacity-75'}`}
                                    />
                                ))}
                            </div>
                        )}

                        {currentStrokes.length > 0 && (
                            <>
                                <button type="button" onClick={handleUndoStroke} className="p-1.5 rounded-lg opacity-75 hover:opacity-100 cursor-pointer" title="Undo Stroke">
                                    <Undo2 className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" onClick={handleClearBoard} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/20 cursor-pointer" title="Clear Drawings">
                                    <Eraser className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                    {isTeacher ? (
                        (reactions.got_it > 0 || reactions.question > 0) && (
                            <span className={`hidden md:inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                                isBento ? 'bg-[#e0f2fe] text-black border border-black' : isLightSurface ? 'bg-slate-100 text-slate-800' : 'bg-white/10'
                            }`}>
                                <span>👍 {reactions.got_it}</span>
                                <span>✋ {reactions.question}</span>
                            </span>
                        )
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => sendReaction('got_it')}
                                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 cursor-pointer ${
                                    isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500'
                                }`}
                            >
                                <ThumbsUp className="w-3 h-3" /> Got it
                            </button>
                            <button
                                type="button"
                                onClick={() => sendReaction('question')}
                                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 cursor-pointer ${
                                    isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-500'
                                }`}
                            >
                                <Hand className="w-3 h-3" /> Question
                            </button>
                        </div>
                    )}

                    <span className="text-xs font-mono font-bold opacity-80 px-1">
                        {currentIndex + 1}/{slides.length}
                    </span>

                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        className={`p-2 rounded-xl transition cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black hover:bg-[#f1f5f9]'
                                : isLightSurface ? 'bg-slate-100 hover:bg-slate-200 text-slate-800' : 'bg-white/10 hover:bg-white/20'
                        }`}
                        title="Projector Fullscreen"
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>

                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className={`p-2 rounded-xl transition cursor-pointer ${
                                isBento
                                    ? 'bg-[#fecaca] text-black border-2 border-black'
                                    : 'bg-rose-500/20 hover:bg-rose-500/40 text-rose-400'
                            }`}
                            title="Exit"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1 bg-current/10 shrink-0">
                <div
                    className={`h-full ${themeStyle.accent} transition-all duration-300`}
                    style={{ width: `${((currentIndex + 1) / slides.length) * 100}%` }}
                />
            </div>

            {/* Main Board Stage + Optional Speaker Notes */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
                <main className="flex-1 flex flex-col p-2.5 sm:p-5 lg:p-6 overflow-y-auto">
                    <div
                        ref={stageRef}
                        onPointerDown={handleStagePointerDown}
                        onPointerMove={handleStagePointerMove}
                        onPointerUp={handleStagePointerUp}
                        onPointerLeave={handleStagePointerLeave}
                        className={`relative w-full max-w-5xl mx-auto my-auto rounded-2xl sm:rounded-[2rem] p-4 sm:p-7 ${themeStyle.card} ${getMotionClass(currentSlide.motion)} ${
                            boardTool === 'pen' ? 'cursor-crosshair touch-none' : boardTool === 'laser' ? 'cursor-none' : ''
                        }`}
                    >
                        <svg
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            className="absolute inset-0 w-full h-full pointer-events-none z-20 rounded-[2rem]"
                        >
                            {[...currentStrokes, ...(activeStroke ? [activeStroke] : [])].map(st => {
                                if (st.points.length < 2) return null;
                                const d = st.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
                                return (
                                    <path
                                        key={st.id}
                                        d={d}
                                        fill="none"
                                        stroke={st.color}
                                        strokeWidth={0.55}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        opacity={0.9}
                                    />
                                );
                            })}
                        </svg>

                        {laserPos.active && (
                            <div
                                className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-rose-500 shadow-[0_0_16px_6px_rgba(244,63,94,0.8)] pointer-events-none z-30 transition-transform duration-75"
                                style={{ left: `${laserPos.x}%`, top: `${laserPos.y}%` }}
                            />
                        )}

                        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap relative z-10">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${themeStyle.badge}`}>
                                {currentSlide.layout === 'checkup' ? (
                                    <><HelpCircle className="w-3.5 h-3.5" /> Check-Up Question</>
                                ) : currentSlide.layout === 'code' ? (
                                    <><Code2 className="w-3.5 h-3.5" /> Code Lab</>
                                ) : (
                                    <><Sparkles className="w-3.5 h-3.5" /> {currentSlide.layout.toUpperCase()} • {currentSlide.motion}</>
                                )}
                            </span>
                            {currentSlide.subtitle && (
                                <span className={`text-xs sm:text-sm font-bold ${themeStyle.muted}`}>
                                    {currentSlide.subtitle}
                                </span>
                            )}
                        </div>

                        {currentSlide.layout === 'hero' && (
                            <div className="text-center py-4 sm:py-8 space-y-4 sm:space-y-5 relative z-10">
                                <h1 className="text-2xl sm:text-5xl font-black tracking-tight leading-tight">
                                    {currentSlide.title}
                                </h1>
                                {currentSlide.body && (
                                    <p className={`text-base sm:text-lg max-w-2xl mx-auto leading-relaxed ${themeStyle.muted}`}>
                                        {currentSlide.body}
                                    </p>
                                )}
                                {currentSlide.bullets && currentSlide.bullets.length > 0 && (
                                    <div className="flex flex-wrap justify-center gap-2.5 pt-2">
                                        {currentSlide.bullets.map((b, i) => (
                                            <span key={i} className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold ${themeStyle.badge}`}>
                                                {b}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {currentSlide.layout === 'checkup' && currentSlide.checkupQuestion && (
                            <div className="space-y-5 relative z-10">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                                            {currentSlide.checkupQuestion.question}
                                        </h2>
                                        <p className={`text-xs sm:text-sm mt-1 ${themeStyle.muted}`}>
                                            {currentSlide.title} • {currentSlide.checkupQuestion.points || 10} pts
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {totalResponders > 0 && (
                                            <span className={`px-3 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 ${themeStyle.badge}`}>
                                                <Users className="w-3.5 h-3.5" />
                                                {totalResponders} answered
                                            </span>
                                        )}
                                        {isTeacher && (
                                            <button
                                                type="button"
                                                onClick={() => handleRevealCheckup(currentSlide.id)}
                                                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span>{revealedCheckups[currentSlide.id] ? 'Hide Answer' : 'Reveal Answer'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    {currentSlide.checkupQuestion.options.map((opt, idx) => {
                                        const isSelected = selectedAnswers[currentSlide.id] === idx;
                                        const isCorrect = idx === currentSlide.checkupQuestion!.correctAnswer;
                                        const isRevealed = Boolean(revealedCheckups[currentSlide.id]);
                                        const votesForOpt = Object.values(slideResponses).filter(r => r.optionIndex === idx).length;
                                        const votePct = totalResponders > 0 ? Math.round((votesForOpt / totalResponders) * 100) : 0;

                                        let stateClass = themeStyle.optionBg;
                                        if (isRevealed) {
                                            if (isCorrect) stateClass = isLightSurface ? 'bg-[#bef264] border-2 border-black text-black' : 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300';
                                            else if (isSelected) stateClass = isLightSurface ? 'bg-[#fecaca] border-2 border-black text-black' : 'bg-rose-500/20 border-2 border-rose-400 text-rose-300';
                                        } else if (isSelected) {
                                            stateClass = isLightSurface ? 'bg-[#e0f2fe] border-2 border-black text-black' : 'bg-indigo-500/30 border-2 border-indigo-400';
                                        }

                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleSelectOption(currentSlide, idx)}
                                                className={`relative overflow-hidden text-left p-4 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 ${stateClass}`}
                                            >
                                                {totalResponders > 0 && isTeacher && (
                                                    <div
                                                        className="absolute inset-y-0 left-0 bg-current/10 pointer-events-none transition-all duration-300"
                                                        style={{ width: `${votePct}%` }}
                                                    />
                                                )}
                                                <div className="relative z-10 flex items-center gap-3 min-w-0">
                                                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                                        isBento ? 'bg-[#fde047] text-black border border-black' : isLightSurface ? 'bg-slate-200 text-slate-900' : 'bg-white/15 text-white'
                                                    }`}>
                                                        {String.fromCharCode(65 + idx)}
                                                    </span>
                                                    <span className="font-bold text-sm sm:text-base">{opt}</span>
                                                </div>
                                                <div className="relative z-10 flex items-center gap-2 shrink-0">
                                                    {totalResponders > 0 && isTeacher && (
                                                        <span className="text-xs font-mono font-black opacity-85">{votePct}%</span>
                                                    )}
                                                    {isRevealed && isCorrect && <CheckCircle2 className={`w-5 h-5 ${isLightSurface ? 'text-emerald-700' : 'text-emerald-400'}`} />}
                                                    {isRevealed && !isCorrect && isSelected && <XCircle className={`w-5 h-5 ${isLightSurface ? 'text-rose-700' : 'text-rose-400'}`} />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {revealedCheckups[currentSlide.id] && currentSlide.checkupQuestion.explanation && (
                                    <div className={`p-4 rounded-2xl text-sm leading-relaxed animate-in fade-in duration-300 ${
                                        isBento
                                            ? 'bg-[#e0f2fe] border-2 border-black text-black shadow-[3px_3px_0px_#000]'
                                            : isLightSurface
                                                ? 'bg-emerald-50 border border-emerald-300 text-emerald-950'
                                                : 'bg-emerald-500/15 border border-emerald-400/30 text-white'
                                    }`}>
                                        <span className={`font-black uppercase text-xs tracking-wider block mb-1 ${
                                            isBento ? 'text-black' : isLightSurface ? 'text-emerald-800' : 'text-emerald-400'
                                        }`}>
                                            Explanation
                                        </span>
                                        {currentSlide.checkupQuestion.explanation}
                                    </div>
                                )}
                            </div>
                        )}

                        {currentSlide.layout !== 'hero' && currentSlide.layout !== 'checkup' && (
                            <div className="space-y-4 relative z-10">
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                                    {currentSlide.title}
                                </h2>

                                {currentSlide.body && (
                                    <p className={`text-sm sm:text-base leading-relaxed ${themeStyle.muted}`}>
                                        {currentSlide.body}
                                    </p>
                                )}

                                {renderVisualBlock(currentSlide)}

                                {(currentSlide.bullets?.length || currentSlide.codeSnippet?.code) ? (
                                    <div className={currentSlide.codeSnippet?.code && currentSlide.bullets?.length
                                        ? 'grid grid-cols-1 lg:grid-cols-2 gap-5 items-start pt-2'
                                        : 'space-y-4 pt-1'
                                    }>
                                        {currentSlide.bullets && currentSlide.bullets.length > 0 && (
                                            <ul className="space-y-2.5">
                                                {currentSlide.bullets.map((bullet, idx) => (
                                                    <li
                                                        key={idx}
                                                        style={{ animationDelay: `${idx * 80}ms` }}
                                                        className={`flex items-start gap-3 p-3.5 rounded-2xl animate-in fade-in slide-in-from-left-4 duration-300 fill-mode-both ${
                                                            isBento
                                                                ? 'bg-[#f8fafc] border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                                                                : isLightSurface
                                                                    ? 'bg-slate-50 border border-slate-200 text-slate-900'
                                                                    : 'bg-white/[0.05] border border-white/15 text-white'
                                                        }`}
                                                    >
                                                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 mt-0.5 ${themeStyle.badge}`}>
                                                            {idx + 1}
                                                        </span>
                                                        <span className="text-xs sm:text-sm font-bold leading-snug">{bullet}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {currentSlide.codeSnippet?.code && (
                                            <div className={`rounded-2xl overflow-hidden bg-[#090d16] text-emerald-300 ${
                                                isBento ? 'border-2 border-black shadow-[4px_4px_0px_#000]' : 'border border-white/15 shadow-inner'
                                            }`}>
                                                <div className={`px-4 py-2 border-b flex items-center justify-between text-[11px] font-mono uppercase tracking-wider font-black ${
                                                    isBento
                                                        ? 'bg-[#18181b] border-black text-[#bef264]'
                                                        : 'bg-slate-900 border-white/10 text-slate-300'
                                                }`}>
                                                    <span>{currentSlide.codeSnippet.language || 'code'}</span>
                                                    <Code2 className="w-3.5 h-3.5" />
                                                </div>
                                                <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                                                    <code>{currentSlide.codeSnippet.code}</code>
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {currentSlide.callout && (
                            <div className={`mt-5 p-3.5 rounded-2xl flex items-start gap-3 relative z-10 ${themeStyle.badge}`}>
                                <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                                <p className="text-xs sm:text-sm font-bold leading-snug">{currentSlide.callout}</p>
                            </div>
                        )}

                        {isLastSlide && isTeacher && onFinishSession && (
                            <div className="mt-6 pt-5 border-t border-current/15 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
                                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                                    <Award className={`w-5 h-5 ${isBento ? 'text-black' : 'text-amber-400'}`} />
                                    <span>
                                        {isSessionFinished
                                            ? 'Session is marked as finished ✓'
                                            : 'Finished presenting? Unlock this session’s homework for students!'}
                                    </span>
                                </div>
                                {!isSessionFinished && (
                                    <button
                                        type="button"
                                        disabled={finishingSession}
                                        onClick={handleFinishClick}
                                        className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50 ${
                                            isBento
                                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg'
                                        }`}
                                    >
                                        <Check className="w-4 h-4 stroke-[3]" />
                                        <span>{finishingSession ? 'Finishing...' : 'Finish Session & Unlock Homework'}</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <footer className={`px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 shrink-0 ${
                isBento
                    ? 'bg-white text-black border-t-2 border-black'
                    : isLightSurface
                        ? 'bg-white text-slate-900 border-t border-slate-200'
                        : 'border-t border-current/10'
            }`}>
                <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => goToSlide(currentIndex - 1)}
                    className={`px-3 sm:px-4 py-2 rounded-xl disabled:opacity-35 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                        isBento
                            ? 'bg-white hover:bg-[#f1f5f9] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                            : isLightSurface
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                                : 'bg-white/10 hover:bg-white/20'
                    }`}
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Prev</span>
                </button>

                <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0 max-w-md py-1">
                    {slides.map((s, idx) => (
                        <button
                            key={s.id + idx}
                            type="button"
                            onClick={() => goToSlide(idx)}
                            title={`${idx + 1}. ${s.title}`}
                            className={`h-2.5 rounded-full transition-all shrink-0 cursor-pointer ${
                                idx === currentIndex
                                    ? isBento ? 'w-7 sm:w-8 bg-black' : 'w-7 sm:w-8 bg-amber-400'
                                    : s.layout === 'checkup'
                                        ? 'w-2.5 bg-emerald-500/80 hover:bg-emerald-500'
                                        : s.visualBlock
                                            ? 'w-2.5 bg-sky-500/80 hover:bg-sky-500'
                                            : isBento ? 'w-2.5 bg-black/25 hover:bg-black/50' : 'w-2.5 bg-current/25 hover:bg-current/50'
                            }`}
                        />
                    ))}
                </div>

                <button
                    type="button"
                    disabled={isLastSlide}
                    onClick={() => goToSlide(currentIndex + 1)}
                    className={`px-3 sm:px-4 py-2 rounded-xl disabled:opacity-35 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                        isBento
                            ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                </button>
            </footer>
        </div>
    );
};

export default PresentationModePlayer;
