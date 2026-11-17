import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Gamepad2,
    ArrowRight,
    ArrowLeft,
    Users,
    RefreshCw,
    Radio,
    Rocket,
    KeyRound
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import LivePlayerController from '../components/multiplayer/LivePlayerController';
import LiveHostMode from '../components/multiplayer/LiveHostMode';
import ClassroomQuizPicker from '../components/multiplayer/ClassroomQuizPicker';
import { HostParticipatesControl } from '../components/multiplayer/ClassroomArenaShared';
import type { Quiz, ClassroomMode, ClassroomLobbySummary } from '../types';

export const ClassroomPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const pinParam = searchParams.get('pin') || '';
    const navigate = useNavigate();
    const { isBento } = useTheme();
    const { availableQuizzes, skillTracks } = useData();
    const { currentUser } = useAuth();

    const isInsideTeacherShell = currentUser?.role === 'teacher';

    const [teacherView, setTeacherView] = useState<'host' | 'join'>(pinParam ? 'join' : 'host');
    const [isPlayerOpen, setIsPlayerOpen] = useState(Boolean(pinParam));
    const [selectedPin, setSelectedPin] = useState(pinParam);
    const [hostQuiz, setHostQuiz] = useState<Quiz | null>(null);
    const [hostMode, setHostMode] = useState<ClassroomMode>('turn_based');
    const [hostParticipates, setHostParticipates] = useState(true);
    const [enteredPin, setEnteredPin] = useState('');

    const [activeRooms, setActiveRooms] = useState<ClassroomLobbySummary[]>([]);
    const [loadingRooms, setLoadingRooms] = useState(false);

    useEffect(() => {
        if (pinParam) {
            setSelectedPin(pinParam);
            setIsPlayerOpen(true);
            setTeacherView('join');
        }
    }, [pinParam]);

    const fetchActiveRooms = useCallback(async () => {
        setLoadingRooms(true);
        try {
            const res = await api.listActiveClassroomRooms();
            setActiveRooms(res.rooms || []);
        } catch {
            // Keep existing list silently if offline
        } finally {
            setLoadingRooms(false);
        }
    }, []);

    useEffect(() => {
        fetchActiveRooms();
        const timer = setInterval(fetchActiveRooms, 6000);
        return () => clearInterval(timer);
    }, [fetchActiveRooms]);

    const handleJoinWithPin = (e: React.FormEvent) => {
        e.preventDefault();
        if (enteredPin.trim().length >= 4) {
            setSelectedPin(enteredPin.trim());
            setIsPlayerOpen(true);
        }
    };

    const cardClass = isBento
        ? 'bg-white text-black border-[3px] border-black shadow-[5px_5px_0_#000]'
        : 'bg-white dark:bg-[#111322]/90 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-xl backdrop-blur-xl';

    const modeSelectorBlock = (compactMode = false) => (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Session Mode
                </span>
                <HostParticipatesControl
                    checked={hostParticipates}
                    onChange={setHostParticipates}
                    isBento={isBento}
                    label={isInsideTeacherShell ? 'Teacher plays & scores' : 'Host plays & scores'}
                />
            </div>

            <div className={`grid grid-cols-1 ${compactMode ? 'sm:grid-cols-2' : 'md:grid-cols-2'} gap-2`}>
                <button
                    type="button"
                    onClick={() => setHostMode('turn_based')}
                    className={`btn-unstyled p-2.5 rounded-xl text-left transition cursor-pointer ${
                        hostMode === 'turn_based'
                            ? isBento
                                ? 'bg-[#bef264] border-2 border-black shadow-[2px_2px_0_#000] text-black'
                                : 'bg-indigo-600/15 border-2 border-indigo-500 text-slate-900 dark:text-white'
                            : isBento
                                ? 'bg-slate-50 border-2 border-black/25 hover:border-black text-black'
                                : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                    }`}
                >
                    <div className="text-xs font-black">🎯 Mode 1: Turn-Based Duel</div>
                    <div className="text-[10px] opacity-75 leading-tight mt-0.5">
                        Student &amp; teacher take turns answering each question with live scores
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setHostMode('simultaneous')}
                    className={`btn-unstyled p-2.5 rounded-xl text-left transition cursor-pointer ${
                        hostMode === 'simultaneous'
                            ? isBento
                                ? 'bg-[#bae6fd] border-2 border-black shadow-[2px_2px_0_#000] text-black'
                                : 'bg-indigo-600/15 border-2 border-indigo-500 text-slate-900 dark:text-white'
                            : isBento
                                ? 'bg-slate-50 border-2 border-black/25 hover:border-black text-black'
                                : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                    }`}
                >
                    <div className="text-xs font-black">⚡ Mode 2: Everyone Answers</div>
                    <div className="text-[10px] opacity-75 leading-tight mt-0.5">
                        Each answers alone → loading until all submit → full reveal
                    </div>
                </button>
            </div>
        </div>
    );

    const joinAndOpenRoomsBlock = (
        <div className="space-y-3 flex flex-col justify-between h-full">
            <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isBento
                            ? 'bg-[#fde047] text-black border-2 border-black'
                            : 'bg-amber-500/15 text-amber-500'
                    }`}>
                        <Gamepad2 className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <h2 className="text-sm sm:text-base font-black uppercase tracking-tight leading-none">
                            Join Live Room
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Enter a 6-digit PIN or click any open room below
                        </p>
                    </div>
                </div>

                <form onSubmit={handleJoinWithPin} className="space-y-2.5">
                    <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-Digit PIN..."
                        value={enteredPin}
                        onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                        className={`w-full py-2.5 px-3 rounded-xl text-center text-lg font-mono font-black tracking-widest transition-all ${
                            isBento
                                ? 'bg-white text-black border-2 border-black focus:bg-[#fef9c3] focus:outline-none'
                                : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                        }`}
                    />

                    <button
                        type="submit"
                        disabled={enteredPin.trim().length < 4}
                        className={`btn-unstyled w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition ${
                            isBento
                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0_#000] active:translate-y-0.5 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 disabled:shadow-none disabled:cursor-not-allowed'
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                    >
                        <span>Join Room</span>
                        <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                </form>
            </div>

            <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-2 flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
                    <span>Open Live Rooms ({activeRooms.length})</span>
                    <button
                        type="button"
                        onClick={fetchActiveRooms}
                        disabled={loadingRooms}
                        className="btn-unstyled p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer bg-transparent border-0"
                        title="Refresh Active Rooms"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {activeRooms.length === 0 ? (
                    <div className={`p-3 rounded-xl text-center text-[11px] font-semibold flex-1 flex items-center justify-center ${
                        isBento ? 'bg-slate-50 border border-black/20 text-slate-500' : 'bg-slate-50 dark:bg-white/5 text-slate-400'
                    }`}>
                        No live rooms active right now.
                    </div>
                ) : (
                    <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
                        {activeRooms.map(r => (
                            <div
                                key={r.pin}
                                className={`p-2 rounded-xl flex items-center justify-between gap-2 ${
                                    isBento
                                        ? 'bg-[#f8fafc] border border-black/30'
                                        : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                                }`}
                            >
                                <div className="min-w-0">
                                    <div className="text-xs font-black truncate">{r.quizTitle}</div>
                                    <div className="text-[10px] opacity-75 font-bold truncate">
                                        PIN {r.pin} • {r.hostName} • {r.mode === 'simultaneous' ? 'All Submit' : 'Turns'} • {r.playerCount} active
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPin(r.pin);
                                        setIsPlayerOpen(true);
                                    }}
                                    className={`btn-unstyled px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shrink-0 cursor-pointer ${
                                        isBento
                                            ? 'bg-[#bae6fd] text-black border border-black'
                                            : 'bg-indigo-600 text-white'
                                    }`}
                                >
                                    <span>Join</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // =========================================================================
    // 1. TEACHER STUDIO DEDICATED LAYOUT (Full-width host workspace next to sidebar)
    // =========================================================================
    if (isInsideTeacherShell) {
        return (
            <div className="w-full flex-1 min-h-0 flex flex-col gap-3 pb-2 pr-1">
                {/* Compact Studio Header with Host / Join Switcher */}
                <div className={`p-3.5 sm:p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 ${cardClass}`}>
                    <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isBento
                                    ? 'bg-[#93c5fd] text-black border border-black'
                                    : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30'
                            }`}>
                                Teacher Live Studio
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isBento
                                    ? 'bg-[#bef264] text-black border border-black'
                                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            }`}>
                                <Radio className="w-3 h-3 animate-pulse" />
                                <span>Live Ready</span>
                            </span>
                        </div>
                        <h1 className="text-xl font-black uppercase tracking-tight leading-tight">
                            Live Classroom Arena
                        </h1>
                    </div>

                    {/* Teacher View Switcher: Full-Width Host vs Join Existing PIN */}
                    <div className={`inline-flex p-1 rounded-xl gap-1 shrink-0 self-start md:self-center ${
                        isBento
                            ? 'bg-slate-100 border-2 border-black'
                            : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                    }`}>
                        <button
                            type="button"
                            onClick={() => setTeacherView('host')}
                            className={`btn-unstyled px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition ${
                                teacherView === 'host'
                                    ? isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                        : 'bg-indigo-600 text-white shadow'
                                    : 'opacity-70 hover:opacity-100 bg-transparent border-0'
                            }`}
                        >
                            <Rocket className="w-3.5 h-3.5" />
                            <span>Launch Live Quiz</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setTeacherView('join')}
                            className={`btn-unstyled px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition ${
                                teacherView === 'join'
                                    ? isBento
                                        ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                        : 'bg-indigo-600 text-white shadow'
                                    : 'opacity-70 hover:opacity-100 bg-transparent border-0'
                            }`}
                        >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Join PIN ({activeRooms.length})</span>
                        </button>
                    </div>
                </div>

                {/* Main Spacious Panel for Teacher */}
                {teacherView === 'host' ? (
                    <div className={`p-4 sm:p-5 rounded-2xl flex-1 min-h-0 flex flex-col gap-4 ${cardClass}`}>
                        {modeSelectorBlock(false)}

                        <div className="border-t border-black/10 dark:border-white/10 pt-3 flex-1 min-h-0 flex flex-col">
                            <ClassroomQuizPicker
                                skillTracks={skillTracks}
                                quizzes={availableQuizzes}
                                onLaunchQuiz={(quiz) => setHostQuiz(quiz)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className={`p-5 rounded-2xl flex-1 min-h-0 flex flex-col w-full ${cardClass}`}>
                        {joinAndOpenRoomsBlock}
                    </div>
                )}

                {isPlayerOpen && (
                    <LivePlayerController
                        initialPin={selectedPin}
                        onClose={() => {
                            setIsPlayerOpen(false);
                            setSelectedPin('');
                            fetchActiveRooms();
                        }}
                        onBack={() => {
                            setIsPlayerOpen(false);
                            setSelectedPin('');
                        }}
                    />
                )}

                {hostQuiz && (
                    <LiveHostMode
                        quiz={hostQuiz}
                        initialMode={hostMode}
                        initialHostParticipates={hostParticipates}
                        onClose={() => {
                            setHostQuiz(null);
                            fetchActiveRooms();
                        }}
                    />
                )}
            </div>
        );
    }

    // =========================================================================
    // 2. STUDENT / STANDALONE ARENA LAYOUT (Join PIN primary + 2-Step Host)
    // =========================================================================
    return (
        <div className={`min-h-dvh lg:h-dvh lg:overflow-hidden py-4 px-4 sm:px-6 max-w-6xl mx-auto flex flex-col gap-3 ${
            isBento ? 'bg-transparent text-black' : 'text-slate-900 dark:text-white'
        }`}>
            <div className={`p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 ${cardClass}`}>
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isBento
                                ? 'bg-[#93c5fd] text-black border border-black'
                                : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30'
                        }`}>
                            Interactive Multiplayer
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isBento
                                ? 'bg-[#bef264] text-black border border-black'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        }`}>
                            <Radio className="w-3 h-3 animate-pulse" />
                            <span>Live Ready</span>
                        </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none pt-0.5">
                        Live Classroom Arena
                    </h1>
                    <p className={`text-xs leading-snug ${isBento ? 'text-slate-700 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                        Join a live teacher session with your 6-digit PIN or launch a turn-based / simultaneous peer challenge!
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className={`btn-unstyled shrink-0 self-start sm:self-center flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition active:scale-95 ${
                        isBento
                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0_#000]'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200'
                    }`}
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
                <div className={`lg:col-span-5 p-4 sm:p-5 rounded-2xl flex flex-col min-h-0 ${cardClass}`}>
                    {joinAndOpenRoomsBlock}
                </div>

                <div className={`lg:col-span-7 p-4 sm:p-5 rounded-2xl flex flex-col gap-3 min-h-0 ${cardClass}`}>
                    <div className="flex items-center gap-2.5 shrink-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isBento
                                ? 'bg-[#93c5fd] text-black border-2 border-black'
                                : 'bg-indigo-500/15 text-indigo-500'
                        }`}>
                            <Users className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black uppercase tracking-tight leading-none">
                                Host a Peer Duel
                            </h2>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Choose your mode, then pick a Track &amp; Quiz Category
                            </p>
                        </div>
                    </div>

                    {modeSelectorBlock(true)}

                    <div className="border-t border-black/10 dark:border-white/10 pt-2.5 flex-1 min-h-0 flex flex-col">
                        <ClassroomQuizPicker
                            skillTracks={skillTracks}
                            quizzes={availableQuizzes}
                            onLaunchQuiz={(quiz) => setHostQuiz(quiz)}
                            compact
                        />
                    </div>
                </div>
            </div>

            {isPlayerOpen && (
                <LivePlayerController
                    initialPin={selectedPin}
                    onClose={() => {
                        setIsPlayerOpen(false);
                        setSelectedPin('');
                        fetchActiveRooms();
                    }}
                    onBack={() => {
                        setIsPlayerOpen(false);
                        setSelectedPin('');
                    }}
                />
            )}

            {hostQuiz && (
                <LiveHostMode
                    quiz={hostQuiz}
                    initialMode={hostMode}
                    initialHostParticipates={hostParticipates}
                    onClose={() => {
                        setHostQuiz(null);
                        fetchActiveRooms();
                    }}
                />
            )}
        </div>
    );
};

export default ClassroomPage;
