import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Sparkles, Wand2, FileJson, CheckCircle2, Plus, Trash2, Send,
    BookOpen, ClipboardList, Brain, AlertTriangle, Copy, Download, Rocket, SlidersHorizontal, Upload
} from 'lucide-react';
import type {
    Clan,
    UserData,
    MotionPresentation,
    GeneratedSlideQuestion,
    TeacherAiToolkitResponse,
    ClassSessionStatus,
    ClassStudentAnalyticsItem,
    ClassWeakTopicItem
} from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import { TRAVELO_PART2_DECK } from '../../constants/traveloSlideDeck';
import { getTeacherThemeStyles } from '../teacher/teacherTheme';

interface TeacherAiToolsSectionProps {
    clan: Clan;
    user: UserData;
    initialTool?: 'question_gen' | 'coach' | 'lesson_rubric';
    coachPrefill?: {
        students: ClassStudentAnalyticsItem[];
        weakTopics: ClassWeakTopicItem[];
    } | null;
    onQuizPublished?: () => void;
}

export const TeacherAiToolsSection: React.FC<TeacherAiToolsSectionProps> = ({
    clan,
    user,
    initialTool = 'question_gen',
    coachPrefill = null,
    onQuizPublished
}) => {
    const { theme } = useTheme();
    const styles = useMemo(() => getTeacherThemeStyles(theme), [theme]);
    const { showNotification } = useNotification();

    const [activeTool, setActiveTool] = useState<'question_gen' | 'coach' | 'lesson_rubric'>(initialTool);
    const [savedDecks, setSavedDecks] = useState<MotionPresentation[]>([]);
    const [sessions, setSessions] = useState<ClassSessionStatus[]>([]);

    // Minimal Slide Source State (text hidden unless custom/expanded)
    const [selectedDeckId, setSelectedDeckId] = useState<string>('travelo_demo');
    const [selectedDeckSummary, setSelectedDeckSummary] = useState<string>(
        `${TRAVELO_PART2_DECK.title} (${TRAVELO_PART2_DECK.slides.length} slides)`
    );
    const [slidesJsonText, setSlidesJsonText] = useState<string>(() => JSON.stringify(TRAVELO_PART2_DECK, null, 2));
    const [showSourceEditor, setShowSourceEditor] = useState(false);

    // Essential Question Generator Controls (+ optional collapsed advanced toggle)
    const [count, setCount] = useState(6);
    const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced' | 'mixed'>('intermediate');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [pedagogyMode, setPedagogyMode] = useState<'balanced_bloom' | 'concept_check' | 'code_debugging' | 'exam_rigor'>('balanced_bloom');
    const [language, setLanguage] = useState<'en' | 'ar' | 'bilingual'>('en');
    const [includeTextQuestions, setIncludeTextQuestions] = useState(false);
    const [focusTopics, setFocusTopics] = useState('');
    const [generatingQuestions, setGeneratingQuestions] = useState(false);

    // Generated Quiz Draft & Publish State
    const [quizTitle, setQuizTitle] = useState('');
    const [quizDesc, setQuizDesc] = useState('');
    const [questions, setQuestions] = useState<GeneratedSlideQuestion[]>([]);
    const [targetModuleId, setTargetModuleId] = useState('');
    const [passingScore, setPassingScore] = useState(70);
    const [timeLimit, setTimeLimit] = useState(15);
    const [attachAsHomework, setAttachAsHomework] = useState(true);
    const [publishingQuiz, setPublishingQuiz] = useState(false);

    // Coach & Lesson/Rubric Toolkit State
    const [coachGoal, setCoachGoal] = useState('');
    const [toolkitMode, setToolkitMode] = useState<'lesson_plan' | 'homework_rubric'>('lesson_plan');
    const [runningToolkit, setRunningToolkit] = useState(false);
    const [coachResult, setCoachResult] = useState<TeacherAiToolkitResponse['data'] | null>(null);
    const [scriptResult, setScriptResult] = useState<TeacherAiToolkitResponse['data'] | null>(null);
    const [coachStudents, setCoachStudents] = useState<ClassStudentAnalyticsItem[]>(coachPrefill?.students || []);
    const [coachWeakTopics, setCoachWeakTopics] = useState<ClassWeakTopicItem[]>(coachPrefill?.weakTopics || []);

    useEffect(() => {
        setActiveTool(initialTool);
    }, [initialTool]);

    useEffect(() => {
        if (coachPrefill) {
            setCoachStudents(coachPrefill.students);
            setCoachWeakTopics(coachPrefill.weakTopics);
        }
    }, [coachPrefill]);

    const loadContext = useCallback(async () => {
        try {
            const [decks, hwStatus] = await Promise.all([
                api.getPresentations({ clanId: clan.clanId }, user.userId).catch(() => []),
                api.getClassHomeworkStatus(clan.clanId, user.userId).catch(() => null)
            ]);
            const deckList = Array.isArray(decks) ? decks : [];
            setSavedDecks(deckList);
            if (hwStatus?.sessions) {
                setSessions(hwStatus.sessions);
                if (hwStatus.sessions.length > 0 && !targetModuleId) {
                    const nextSess = hwStatus.sessions.find(s => !s.isFinished) || hwStatus.sessions[0];
                    setTargetModuleId(nextSess.moduleId);
                }
            }
        } catch {
            // Non-blocking context load
        }
    }, [clan.clanId, user.userId, targetModuleId]);

    useEffect(() => {
        loadContext();
    }, [loadContext]);

    const handleSelectDeckSource = async (deckId: string) => {
        setSelectedDeckId(deckId);
        if (deckId === 'travelo_demo') {
            setSlidesJsonText(JSON.stringify(TRAVELO_PART2_DECK, null, 2));
            setSelectedDeckSummary(`${TRAVELO_PART2_DECK.title} (${TRAVELO_PART2_DECK.slides.length} slides)`);
            setShowSourceEditor(false);
            return;
        }
        if (deckId === 'custom') {
            setSelectedDeckSummary('Custom pasted text or JSON');
            setShowSourceEditor(true);
            return;
        }
        try {
            const full = await api.getPresentation(deckId, user.userId);
            setSlidesJsonText(JSON.stringify({
                title: full.title,
                description: full.description,
                theme: full.theme,
                slides: full.slides
            }, null, 2));
            setSelectedDeckSummary(`${full.title} (${full.slides?.length || 0} slides)`);
            setShowSourceEditor(false);
        } catch {
            showNotification('error', 'Failed to load slide deck');
        }
    };

    const handleUploadSlidesFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            setSelectedDeckId('custom');
            setSlidesJsonText(text);
            setSelectedDeckSummary(`Uploaded: ${file.name}`);
            showNotification('success', `Loaded ${file.name}`);
        } catch {
            showNotification('error', 'Could not read file');
        }
    };

    const parsePayloadOrText = () => {
        const trimmed = slidesJsonText.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return { slidesPayload: JSON.parse(trimmed) };
            } catch {
                return { slideText: trimmed };
            }
        }
        if (trimmed.startsWith('<')) {
            return { slidesPayload: trimmed };
        }
        return { slideText: trimmed };
    };

    const handleGenerateQuestions = async () => {
        if (!slidesJsonText.trim()) {
            showNotification('error', 'Select a slide deck or upload/paste content first');
            return;
        }
        setGeneratingQuestions(true);
        try {
            const sourcePayload = parsePayloadOrText();
            const res = await api.generateQuestionsFromSlides(
                clan.clanId,
                {
                    ...sourcePayload,
                    count,
                    difficulty,
                    pedagogyMode,
                    language,
                    questionTypes: includeTextQuestions ? ['multiple-choice', 'text'] : ['multiple-choice'],
                    focusTopics: focusTopics.trim() || undefined
                },
                user.userId
            );
            setQuizTitle(res.suggestedTitle);
            setQuizDesc(res.suggestedDescription);
            setQuestions(res.questions || []);
            showNotification('success', `Generated ${res.questions.length} questions!`);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to generate questions');
        } finally {
            setGeneratingQuestions(false);
        }
    };

    const updateQuestion = (index: number, patch: Partial<GeneratedSlideQuestion>) => {
        setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
    };

    const handlePublishQuiz = async () => {
        if (!quizTitle.trim() || questions.length === 0) {
            showNotification('error', 'Enter a quiz title and at least 1 question');
            return;
        }
        setPublishingQuiz(true);
        try {
            const res = await api.publishGeneratedQuizToClass(
                clan.clanId,
                {
                    title: quizTitle.trim(),
                    description: quizDesc.trim() || quizTitle.trim(),
                    category: 'Class Homework',
                    difficulty: difficulty === 'mixed' ? 'medium' : difficulty === 'beginner' ? 'easy' : difficulty === 'advanced' ? 'hard' : 'medium',
                    passingScore,
                    timeLimit,
                    moduleId: targetModuleId || undefined,
                    attachAsHomework: attachAsHomework && Boolean(targetModuleId),
                    questions
                },
                user.userId
            );
            showNotification('success', res.message);
            if (onQuizPublished) onQuizPublished();
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to publish quiz');
        } finally {
            setPublishingQuiz(false);
        }
    };

    const handleDownloadQuizJson = () => {
        const exportObj = {
            title: quizTitle || 'Generated Class Quiz',
            description: quizDesc,
            passingScore,
            timeLimit,
            questions
        };
        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(quizTitle || 'slide-quiz').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleRunCoach = async () => {
        setRunningToolkit(true);
        try {
            let studentsData = coachStudents;
            let topicsData = coachWeakTopics;
            if (studentsData.length === 0) {
                const analytics = await api.getClassAnalyticsAndLogs(clan.clanId, user.userId);
                studentsData = analytics.students;
                topicsData = analytics.weakTopics;
                setCoachStudents(studentsData);
                setCoachWeakTopics(topicsData);
            }

            const compactStudents = studentsData.map(s => ({
                name: s.name,
                avgScore: s.avgScore,
                homeworkCompletionRate: s.homeworkCompletionRate,
                riskLevel: s.riskLevel,
                recentTrend: s.recentTrend,
                weakTopics: s.weakTopics.slice(0, 3)
            }));

            const res = await api.runTeacherAiToolkit(
                clan.clanId,
                {
                    mode: 'class_coach',
                    customGoal: coachGoal.trim() || undefined,
                    studentSummaries: compactStudents,
                    weakTopics: topicsData
                },
                user.userId
            );
            setCoachResult(res.data);
            showNotification('success', 'Coaching plan ready!');
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to run Coach');
        } finally {
            setRunningToolkit(false);
        }
    };

    const handleRunLessonOrRubric = async () => {
        setRunningToolkit(true);
        try {
            const sourcePayload = parsePayloadOrText();
            const res = await api.runTeacherAiToolkit(
                clan.clanId,
                {
                    mode: toolkitMode,
                    ...sourcePayload,
                    customGoal: coachGoal.trim() || undefined
                },
                user.userId
            );
            setScriptResult(res.data);
            showNotification('success', toolkitMode === 'lesson_plan' ? 'Lesson script ready!' : 'Homework rubric ready!');
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to generate guide');
        } finally {
            setRunningToolkit(false);
        }
    };

    const handleSendInterventionAlert = async (studentName: string, draftMsg: string) => {
        const student = coachStudents.find(s => s.name === studentName);
        if (!student || !sessions[0]) {
            navigator.clipboard?.writeText(draftMsg);
            showNotification('success', 'Draft message copied!');
            return;
        }
        try {
            const targetMod = sessions.find(s => s.isFinished) || sessions[0];
            await api.sendHomeworkAlert(
                clan.clanId,
                { moduleId: targetMod.moduleId, targetUserIds: [student.userId], message: draftMsg },
                user.userId
            );
            showNotification('success', `Alert sent to ${student.name}!`);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Could not send alert');
        }
    };

    return (
        <div className="space-y-5">
            {/* Compact Header + Minimal 3-Tool Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${styles.pillPrimary}`}>
                        <Brain className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-black uppercase tracking-tight">AI Studio</h2>
                        <p className={`text-xs font-medium ${styles.mutedText}`}>
                            Create quizzes, get class insights, or draft lesson guides from your slides.
                        </p>
                    </div>
                </div>

                <div className={`inline-flex flex-wrap gap-1.5 p-1 rounded-2xl ${styles.subtleBox}`}>
                    {([
                        { id: 'question_gen' as const, label: 'Quiz Generator', icon: Sparkles },
                        { id: 'coach' as const, label: 'Class Coach', icon: Wand2 },
                        { id: 'lesson_rubric' as const, label: 'Lesson Guide', icon: ClipboardList }
                    ]).map(tab => {
                        const Icon = tab.icon;
                        const active = activeTool === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTool(tab.id)}
                                className={`px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${
                                    active ? styles.navItemActive : styles.navItemIdle
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Minimal Source Bar (Quiz Generator & Lesson Guide) */}
            {activeTool !== 'coach' && (
                <div className={`p-4 rounded-2xl space-y-3 ${styles.subtleBox}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <FileJson className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-wider opacity-70">Slide Deck Source</div>
                                <div className="text-xs font-black truncate">{selectedDeckSummary}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <select
                                value={selectedDeckId}
                                onChange={e => handleSelectDeckSource(e.target.value)}
                                aria-label="Choose slide deck source"
                                className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${styles.select}`}
                            >
                                <option value="travelo_demo">Sample: {TRAVELO_PART2_DECK.title}</option>
                                {savedDecks.map(d => (
                                    <option key={d.presentationId || d.title} value={d.presentationId}>
                                        {d.title} ({d.slides?.length || 0} slides)
                                    </option>
                                ))}
                                <option value="custom">Custom Notes / JSON</option>
                            </select>

                            <label className={`px-3 py-2 rounded-xl text-xs uppercase flex items-center gap-1.5 cursor-pointer ${styles.secondaryBtn}`}>
                                <Upload className="w-3.5 h-3.5" />
                                <span>Upload File</span>
                                <input type="file" accept=".json,.xml,.txt,.md" className="hidden" onChange={handleUploadSlidesFile} />
                            </label>

                            <button
                                type="button"
                                onClick={() => setShowSourceEditor(v => !v)}
                                className={`px-3 py-2 rounded-xl text-xs uppercase cursor-pointer ${styles.secondaryBtn}`}
                            >
                                {showSourceEditor ? 'Hide Text' : 'Edit Notes'}
                            </button>
                        </div>
                    </div>

                    {showSourceEditor && (
                        <textarea
                            rows={5}
                            value={slidesJsonText}
                            onChange={e => {
                                setSelectedDeckId('custom');
                                setSelectedDeckSummary('Custom pasted text or JSON');
                                setSlidesJsonText(e.target.value);
                            }}
                            placeholder="Paste presentation JSON, XML, or plain lesson notes..."
                            className={`w-full p-3 rounded-xl font-mono text-xs ${styles.input}`}
                        />
                    )}
                </div>
            )}

            {/* TOOL 1: MINIMAL QUIZ GENERATOR */}
            {activeTool === 'question_gen' && (
                <div className="space-y-5">
                    <div className={`p-4 rounded-2xl space-y-3 ${styles.subtleBox}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                            <div>
                                <label className="block text-[10px] font-black uppercase mb-1">Difficulty</label>
                                <select
                                    value={difficulty}
                                    onChange={e => setDifficulty(e.target.value as typeof difficulty)}
                                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold ${styles.select}`}
                                >
                                    <option value="beginner">Beginner</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                    <option value="mixed">Mixed</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase mb-1">Questions</label>
                                <select
                                    value={count}
                                    onChange={e => setCount(Number(e.target.value))}
                                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold ${styles.select}`}
                                >
                                    {[3, 5, 6, 8, 10, 12].map(n => (
                                        <option key={n} value={n}>{n} Questions</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(v => !v)}
                                    className={`px-3 py-2.5 rounded-xl text-xs uppercase flex items-center gap-1.5 cursor-pointer shrink-0 ${styles.secondaryBtn}`}
                                    title="Optional settings"
                                >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                    <span>Options</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={generatingQuestions}
                                    onClick={handleGenerateQuestions}
                                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap ${styles.primaryBtn}`}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>{generatingQuestions ? 'Generating...' : 'Generate Quiz'}</span>
                                </button>
                            </div>
                        </div>

                        {showAdvanced && (
                            <div className={`pt-3 border-t ${styles.divider} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center`}>
                                <select
                                    value={pedagogyMode}
                                    onChange={e => setPedagogyMode(e.target.value as typeof pedagogyMode)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold ${styles.select}`}
                                    aria-label="Pedagogy mode"
                                >
                                    <option value="balanced_bloom">Balanced Mix</option>
                                    <option value="code_debugging">Code Debugging</option>
                                    <option value="concept_check">Concept Check</option>
                                    <option value="exam_rigor">Exam Rigor</option>
                                </select>

                                <select
                                    value={language}
                                    onChange={e => setLanguage(e.target.value as typeof language)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold ${styles.select}`}
                                    aria-label="Language"
                                >
                                    <option value="en">English</option>
                                    <option value="bilingual">EN + Arabic</option>
                                    <option value="ar">Arabic</option>
                                </select>

                                <input
                                    value={focusTopics}
                                    onChange={e => setFocusTopics(e.target.value)}
                                    placeholder="Focus topic (optional)..."
                                    className={`px-3 py-2 rounded-xl text-xs font-medium ${styles.input}`}
                                />

                                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={includeTextQuestions}
                                        onChange={e => setIncludeTextQuestions(e.target.checked)}
                                        className="w-4 h-4 rounded accent-indigo-600"
                                    />
                                    <span>Include short answer</span>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Generated Questions Review & Publish */}
                    {questions.length > 0 && (
                        <div className={`p-5 rounded-2xl space-y-4 ${styles.subtleBox}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${styles.pillSuccess}`}>
                                    {questions.length} Questions Ready
                                </span>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setQuestions(prev => [
                                            ...prev,
                                            {
                                                id: prev.length + 1,
                                                type: 'multiple-choice',
                                                question: 'New question',
                                                options: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
                                                correctAnswer: 0,
                                                explanation: 'Explanation for the correct answer.',
                                                points: 10
                                            }
                                        ])}
                                        className={`px-3 py-1.5 rounded-xl text-xs uppercase flex items-center gap-1 cursor-pointer ${styles.secondaryBtn}`}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDownloadQuizJson}
                                        className={`px-3 py-1.5 rounded-xl text-xs uppercase flex items-center gap-1 cursor-pointer ${styles.secondaryBtn}`}
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>JSON</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {questions.map((q, qIdx) => (
                                    <div key={qIdx} className={`p-4 rounded-2xl space-y-2.5 ${styles.surfaceCard}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${styles.pillPrimary}`}>
                                                Q{qIdx + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qIdx))}
                                                className={`p-1.5 rounded-lg cursor-pointer ${styles.dangerBtn}`}
                                                title="Remove question"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <input
                                            value={q.question}
                                            onChange={e => updateQuestion(qIdx, { question: e.target.value })}
                                            className={`w-full p-2.5 rounded-xl text-xs sm:text-sm font-bold ${styles.input}`}
                                        />

                                        {q.type === 'multiple-choice' ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {q.options.map((opt, optIdx) => {
                                                    const isRight = Number(q.correctAnswer) === optIdx;
                                                    return (
                                                        <div key={optIdx} className={`flex items-center gap-2 p-2 rounded-xl ${
                                                            isRight ? styles.navItemActive : styles.subtleBox
                                                        }`}>
                                                            <input
                                                                type="radio"
                                                                name={`correct_${qIdx}`}
                                                                checked={isRight}
                                                                onChange={() => updateQuestion(qIdx, { correctAnswer: optIdx })}
                                                                className="accent-indigo-600 cursor-pointer shrink-0"
                                                                title="Correct answer"
                                                            />
                                                            <input
                                                                value={opt}
                                                                onChange={e => {
                                                                    const nextOpts = [...q.options];
                                                                    nextOpts[optIdx] = e.target.value;
                                                                    updateQuestion(qIdx, { options: nextOpts });
                                                                }}
                                                                className="flex-1 min-w-0 text-xs font-bold bg-transparent focus:outline-none"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <input
                                                value={String(q.correctAnswer)}
                                                onChange={e => updateQuestion(qIdx, { correctAnswer: e.target.value })}
                                                placeholder="Expected answer..."
                                                className={`w-full p-2.5 rounded-xl text-xs font-bold ${styles.input}`}
                                            />
                                        )}

                                        <input
                                            value={q.explanation}
                                            onChange={e => updateQuestion(qIdx, { explanation: e.target.value })}
                                            placeholder="Explanation..."
                                            className={`w-full p-2 rounded-xl text-xs ${styles.input}`}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Minimal Publish Bar */}
                            <div className={`p-4 rounded-2xl space-y-3 ${styles.surfaceCard}`}>
                                <div className="text-xs font-black uppercase flex items-center gap-1.5">
                                    <Rocket className="w-4 h-4" />
                                    <span>Publish to Class</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                    <input
                                        value={quizTitle}
                                        onChange={e => setQuizTitle(e.target.value)}
                                        placeholder="Quiz Title..."
                                        className={`sm:col-span-2 px-3 py-2 rounded-xl text-xs font-bold ${styles.input}`}
                                    />
                                    <select
                                        value={targetModuleId}
                                        onChange={e => setTargetModuleId(e.target.value)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold ${styles.select}`}
                                    >
                                        <option value="">-- Optional Session --</option>
                                        {sessions.map(s => (
                                            <option key={s.moduleId} value={s.moduleId}>{s.title}</option>
                                        ))}
                                    </select>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min={10}
                                            max={100}
                                            value={passingScore}
                                            onChange={e => setPassingScore(Number(e.target.value))}
                                            className={`w-1/2 px-2.5 py-2 rounded-xl text-xs font-bold ${styles.input}`}
                                            title="Passing %"
                                        />
                                        <input
                                            type="number"
                                            min={0}
                                            max={120}
                                            value={timeLimit}
                                            onChange={e => setTimeLimit(Number(e.target.value))}
                                            className={`w-1/2 px-2.5 py-2 rounded-xl text-xs font-bold ${styles.input}`}
                                            title="Time limit (min)"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={attachAsHomework}
                                            onChange={e => setAttachAsHomework(e.target.checked)}
                                            className="w-4 h-4 rounded accent-indigo-600"
                                        />
                                        <span>Attach to session &amp; notify class</span>
                                    </label>
                                    <button
                                        type="button"
                                        disabled={publishingQuiz}
                                        onClick={handlePublishQuiz}
                                        className={`px-5 py-2.5 rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${styles.primaryBtn}`}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>{publishingQuiz ? 'Publishing...' : 'Publish Quiz'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TOOL 2: MINIMAL CLASS COACH */}
            {activeTool === 'coach' && (
                <div className="space-y-4">
                    <div className={`p-4 rounded-2xl flex flex-col sm:flex-row gap-2.5 ${styles.subtleBox}`}>
                        <input
                            value={coachGoal}
                            onChange={e => setCoachGoal(e.target.value)}
                            placeholder="Ask Coach: e.g. Who needs help right now and what should we review?"
                            className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs font-bold ${styles.input}`}
                        />
                        <button
                            type="button"
                            disabled={runningToolkit}
                            onClick={handleRunCoach}
                            className={`px-5 py-2.5 rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap ${styles.primaryBtn}`}
                        >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>{runningToolkit ? 'Analyzing...' : 'Analyze Class'}</span>
                        </button>
                    </div>

                    {coachResult && (
                        <div className="space-y-4">
                            {coachResult.headline && (
                                <div className={`p-4 rounded-2xl font-black text-sm ${styles.subtleBox}`}>
                                    {coachResult.headline}
                                </div>
                            )}

                            {coachResult.reteachTopics && coachResult.reteachTopics.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {coachResult.reteachTopics.map((rt, i) => (
                                        <div key={i} className={`p-4 rounded-2xl space-y-1.5 ${styles.subtleBox}`}>
                                            <div className="font-black text-xs flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                                <span>{rt.topic}</span>
                                            </div>
                                            <p className={`text-xs ${styles.mutedText}`}>{rt.whyStudentsStruggle}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {coachResult.studentInterventions && coachResult.studentInterventions.length > 0 && (
                                <div className="space-y-2">
                                    {coachResult.studentInterventions.map((si, i) => (
                                        <div key={i} className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${styles.subtleBox}`}>
                                            <div className="space-y-1 min-w-0">
                                                <div className="font-black text-xs">{si.studentName} &bull; <span className={styles.mutedText}>{si.statusSummary}</span></div>
                                                <div className="text-xs">{si.recommendedAction}</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleSendInterventionAlert(si.studentName, si.draftMessage)}
                                                className={`px-3.5 py-2 rounded-xl text-xs uppercase flex items-center gap-1.5 shrink-0 cursor-pointer ${styles.secondaryBtn}`}
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                <span>Send Alert</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TOOL 3: MINIMAL LESSON GUIDE */}
            {activeTool === 'lesson_rubric' && (
                <div className="space-y-4">
                    <div className={`p-4 rounded-2xl flex flex-wrap items-center gap-2 ${styles.subtleBox}`}>
                        <button
                            type="button"
                            onClick={() => setToolkitMode('lesson_plan')}
                            className={`px-3.5 py-2 rounded-xl text-xs uppercase cursor-pointer ${
                                toolkitMode === 'lesson_plan' ? styles.navItemActive : styles.secondaryBtn
                            }`}
                        >
                            Teaching Script
                        </button>
                        <button
                            type="button"
                            onClick={() => setToolkitMode('homework_rubric')}
                            className={`px-3.5 py-2 rounded-xl text-xs uppercase cursor-pointer ${
                                toolkitMode === 'homework_rubric' ? styles.navItemActive : styles.secondaryBtn
                            }`}
                        >
                            Homework Rubric
                        </button>
                        <input
                            value={coachGoal}
                            onChange={e => setCoachGoal(e.target.value)}
                            placeholder="Optional focus or duration..."
                            className={`flex-1 min-w-[180px] px-3 py-2 rounded-xl text-xs font-bold ${styles.input}`}
                        />
                        <button
                            type="button"
                            disabled={runningToolkit}
                            onClick={handleRunLessonOrRubric}
                            className={`px-4 py-2 rounded-xl text-xs uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${styles.primaryBtn}`}
                        >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{runningToolkit ? 'Generating...' : 'Generate'}</span>
                        </button>
                    </div>

                    {scriptResult && (
                        <div className={`p-5 rounded-2xl space-y-4 ${styles.subtleBox}`}>
                            {toolkitMode === 'lesson_plan' && scriptResult.lessonTitle && (
                                <>
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="text-base font-black">{scriptResult.lessonTitle}</h3>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${styles.pillPrimary}`}>
                                            {scriptResult.estimatedMinutes || 45} mins
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {(scriptResult.segments || []).map((seg, i) => (
                                            <div key={i} className={`p-3 rounded-xl space-y-1 ${styles.surfaceCard}`}>
                                                <div className="font-black text-xs flex justify-between">
                                                    <span>{seg.phase}</span>
                                                    <span>{seg.minutes}m</span>
                                                </div>
                                                <p className={`text-xs ${styles.mutedText}`}>{seg.teacherMoves}</p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {toolkitMode === 'homework_rubric' && scriptResult.assignmentTitle && (
                                <>
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="text-base font-black">{scriptResult.assignmentTitle}</h3>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard?.writeText(
                                                    `${scriptResult.assignmentTitle}\n\n${scriptResult.objective}\n\nChecklist:\n${(scriptResult.checklist || []).map(c => `- [ ] ${c}`).join('\n')}`
                                                );
                                                showNotification('success', 'Copied homework brief!');
                                            }}
                                            className={`px-3 py-1.5 rounded-xl text-xs uppercase flex items-center gap-1 cursor-pointer ${styles.secondaryBtn}`}
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Copy</span>
                                        </button>
                                    </div>
                                    <p className={`text-xs ${styles.mutedText}`}>{scriptResult.objective}</p>
                                    <div className="space-y-1.5">
                                        {(scriptResult.checklist || []).map((item, idx) => (
                                            <div key={idx} className="text-xs flex items-center gap-2 font-medium">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TeacherAiToolsSection;
