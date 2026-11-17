import React, { useMemo, useState } from 'react';
import {
    Compass,
    Award,
    CheckCircle2,
    BookOpen,
    Play,
    Search,
    Layers
} from 'lucide-react';
import type { Quiz, SkillTrack } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { getTeacherThemeStyles } from './teacherTheme';
import {
    groupQuizzesForTrack,
    type TrackAssessmentKind
} from '../../utils/trackQuizUtils';

export type { TrackAssessmentKind };
type ArrangeViewTab = 'all' | 'sessions' | 'exam' | 'quiz' | 'homework';

interface TeacherTrackQuizBrowserProps {
    skillTracks: SkillTrack[];
    quizzes: Quiz[];
    initialTrackId?: string | null;
    onSelectQuiz: (quiz: Quiz) => void;
}

export const TeacherTrackQuizBrowser: React.FC<TeacherTrackQuizBrowserProps> = ({
    skillTracks,
    quizzes,
    initialTrackId,
    onSelectQuiz
}) => {
    const { theme } = useTheme();
    const styles = useMemo(() => getTeacherThemeStyles(theme), [theme]);

    const [selectedTrackId, setSelectedTrackId] = useState<string>(() => {
        if (initialTrackId && skillTracks.some(t => t.trackId === initialTrackId)) {
            return initialTrackId;
        }
        return skillTracks[0]?.trackId || '';
    });
    const [arrangeTab, setArrangeTab] = useState<ArrangeViewTab>('all');
    const [searchQuery, setSearchQuery] = useState('');

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

    const trackData = useMemo(
        () => groupQuizzesForTrack(selectedTrack, quizzes, searchQuery),
        [selectedTrack, quizzes, searchQuery]
    );

    const kindBadgeStyle = (kind: TrackAssessmentKind) => {
        if (kind === 'exam') return styles.pillDanger;
        if (kind === 'homework') return styles.pillWarning;
        return styles.pillPrimary;
    };

    const kindLabel = (kind: TrackAssessmentKind) => {
        if (kind === 'exam') return 'Exam';
        if (kind === 'homework') return 'Homework';
        return 'Quiz';
    };

    const renderAssessmentCard = (item: { quiz: Quiz; sessionLabel?: string }, kind: TrackAssessmentKind) => (
        <div
            key={`${kind}_${item.quiz.id || item.quiz._id}`}
            className={`p-4 rounded-2xl flex items-center justify-between gap-3 ${styles.subtleBox}`}
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${kindBadgeStyle(kind)}`}>
                        {kindLabel(kind)}
                    </span>
                    <span className={`text-[10px] font-bold ${styles.mutedText}`}>
                        {item.quiz.questions?.length || 0} Qs • {item.quiz.timeLimit || 15}m
                    </span>
                </div>
                <div className="font-black text-sm truncate mt-1">{item.quiz.title}</div>
                {item.sessionLabel && (
                    <div className={`text-[11px] font-semibold truncate mt-0.5 ${styles.mutedText}`}>
                        {item.sessionLabel}
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => onSelectQuiz(item.quiz)}
                className={`px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0 cursor-pointer ${styles.primaryBtn}`}
            >
                <Play className="w-3 h-3 fill-current" />
                <span>Preview</span>
            </button>
        </div>
    );

    if (skillTracks.length === 0) {
        return (
            <div className={`p-10 rounded-[2rem] text-center ${styles.surfaceCard}`}>
                <Compass className="w-12 h-12 mx-auto mb-3 opacity-60" />
                <p className={`text-sm font-bold ${styles.mutedText}`}>No curriculum tracks available yet.</p>
            </div>
        );
    }

    return (
        <section className="space-y-6">
            {/* Step 1: Choose Curriculum Track */}
            <div className={`p-4 sm:p-5 rounded-[1.75rem] sm:rounded-[2rem] space-y-4 ${styles.surfaceCard}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${styles.pillPrimary}`}>
                            Step 1 • Select Track
                        </span>
                        <h2 className="text-lg font-black mt-1">Choose a Curriculum Track</h2>
                    </div>

                    <div className="relative w-full sm:w-auto sm:min-w-[240px]">
                        <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${styles.mutedText}`} />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Filter sessions, exams, quizzes, homework..."
                            className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-bold ${styles.input}`}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {skillTracks.map(track => {
                        const isSelected = track.trackId === effectiveTrackId;
                        return (
                            <button
                                key={track.trackId}
                                type="button"
                                onClick={() => setSelectedTrackId(track.trackId)}
                                className={`p-4 rounded-2xl text-left transition-all cursor-pointer space-y-2 ${
                                    isSelected ? styles.navItemActive : styles.subtleBox
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xl">{track.icon || '🗺️'}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                        isSelected ? styles.navBadgeActive : styles.pillNeutral
                                    }`}>
                                        {track.modules?.length || 0} Sessions
                                    </span>
                                </div>
                                <div className="font-black text-sm leading-snug line-clamp-2">{track.title}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Step 2: Organized View (Sessions / Exam / Quiz / Homework) */}
            {selectedTrack && (
                <div className="space-y-5">
                    {/* Filter Tabs + Summary Counts */}
                    <div className={`p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 ${styles.surfaceCard}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                            {([
                                { id: 'all' as const, label: `All Organized (${trackData.totalCount})`, icon: Layers },
                                { id: 'sessions' as const, label: `Sessions (${trackData.sessions.length})`, icon: Compass },
                                { id: 'exam' as const, label: `Exams (${trackData.exams.length})`, icon: Award },
                                { id: 'quiz' as const, label: `Quizzes (${trackData.quizzes.length})`, icon: CheckCircle2 },
                                { id: 'homework' as const, label: `Homework (${trackData.homework.length})`, icon: BookOpen }
                            ]).map(tab => {
                                const Icon = tab.icon;
                                const active = arrangeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setArrangeTab(tab.id)}
                                        className={`px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition ${
                                            active ? styles.navItemActive : styles.navItemIdle
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5 shrink-0" />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECTION A: SESSIONS BREAKDOWN */}
                    {(arrangeTab === 'all' || arrangeTab === 'sessions') && (
                        <section className={`p-5 sm:p-6 rounded-[2rem] space-y-4 ${styles.surfaceCard}`}>
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                    <Compass className="w-4 h-4" />
                                    <span>Sessions Roadmap &amp; Assessments ({trackData.sessions.length})</span>
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {trackData.sessions.map(sess => (
                                    <div key={sess.module.moduleId} className={`p-4 rounded-2xl space-y-3 ${styles.subtleBox}`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${styles.pillNeutral}`}>
                                                    Session {sess.order}
                                                </span>
                                                <h4 className="font-black text-sm sm:text-base mt-1 truncate">
                                                    {sess.module.title}
                                                </h4>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                                sess.items.length > 0 ? styles.pillSuccess : styles.pillWarning
                                            }`}>
                                                {sess.items.length} Linked
                                            </span>
                                        </div>

                                        {sess.items.length > 0 ? (
                                            <div className="space-y-2">
                                                {sess.items.map(({ quiz, kind }) => (
                                                    <div
                                                        key={quiz.id || quiz._id}
                                                        className={`p-2.5 rounded-xl flex items-center justify-between gap-2 ${styles.surfaceCard}`}
                                                    >
                                                        <div className="min-w-0 flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${kindBadgeStyle(kind)}`}>
                                                                {kindLabel(kind)}
                                                            </span>
                                                            <span className="font-bold text-xs truncate">{quiz.title}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => onSelectQuiz(quiz)}
                                                            className={`px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 shrink-0 cursor-pointer ${styles.primaryBtn}`}
                                                        >
                                                            <Play className="w-3 h-3 fill-current" />
                                                            <span>Preview</span>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className={`text-xs font-medium ${styles.mutedText}`}>
                                                No quiz/homework directly linked to this session yet.
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* SECTION B: EXAMS */}
                    {(arrangeTab === 'all' || arrangeTab === 'exam') && (
                        <section className={`p-5 sm:p-6 rounded-[2rem] space-y-4 ${styles.surfaceCard}`}>
                            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                <Award className="w-4 h-4" />
                                <span>Exams ({trackData.exams.length})</span>
                            </h3>
                            {trackData.exams.length === 0 ? (
                                <p className={`text-xs font-medium ${styles.mutedText}`}>No exams found for this track.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {trackData.exams.map(item => renderAssessmentCard(item, 'exam'))}
                                </div>
                            )}
                        </section>
                    )}

                    {/* SECTION C: SESSION QUIZZES */}
                    {(arrangeTab === 'all' || arrangeTab === 'quiz') && (
                        <section className={`p-5 sm:p-6 rounded-[2rem] space-y-4 ${styles.surfaceCard}`}>
                            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Session Quizzes ({trackData.quizzes.length})</span>
                            </h3>
                            {trackData.quizzes.length === 0 ? (
                                <p className={`text-xs font-medium ${styles.mutedText}`}>No session quizzes found for this track.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {trackData.quizzes.map(item => renderAssessmentCard(item, 'quiz'))}
                                </div>
                            )}
                        </section>
                    )}

                    {/* SECTION D: HOMEWORK */}
                    {(arrangeTab === 'all' || arrangeTab === 'homework') && (
                        <section className={`p-5 sm:p-6 rounded-[2rem] space-y-4 ${styles.surfaceCard}`}>
                            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                <span>Homework ({trackData.homework.length})</span>
                            </h3>
                            {trackData.homework.length === 0 ? (
                                <p className={`text-xs font-medium ${styles.mutedText}`}>No homework tasks found for this track.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {trackData.homework.map(item => renderAssessmentCard(item, 'homework'))}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            )}
        </section>
    );
};

export default TeacherTrackQuizBrowser;
