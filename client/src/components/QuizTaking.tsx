import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { Clock, CheckCircle, XCircle, Target, Zap, Shield, Lightbulb, ArrowLeft, ShoppingBag, Coins, Keyboard, WifiOff, Globe, List, Flag, Sparkles, RotateCcw, RefreshCw, AlertCircle, Plus, Link2, ListOrdered, Code, Type } from 'lucide-react';
import type { Quiz, Question, UserData, QuizResult, AttemptAnswers, PoolProgressData, IntegrityTelemetry, IntegrityTelemetryEvent } from '../types';
import { api } from '../lib/api';
import { AmbientBackground } from './AmbientBackground';
import { MathRenderer } from './common/MathRenderer';
import { KeyboardShortcutsModal } from './common/KeyboardShortcutsModal';
import { QuestionTranslatorBar } from './common/QuestionTranslatorBar';
import { translateQuestion, translateText, getLanguageByCode, isRTL, type TranslatedQuestionData } from '../lib/translationService';
import { sounds } from '../lib/soundEffects';
import MediaPromptPlayer from './common/MediaPromptPlayer';
import OrderingQuestion from './question-types/OrderingQuestion';
import MatchingQuestion from './question-types/MatchingQuestion';
import { generateShuffledIndices as buildShuffledIndices } from '../utils/shuffle';
import CodeOutputQuestion from './question-types/CodeOutputQuestion';
import TextQuestion from './question-types/TextQuestion';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { evaluateTextAnswer } from '../lib/stringSimilarity';

const CompilerQuestion = React.lazy(() => import('./question-types/CompilerQuestion'));

type AnswerValue = string | number | string[] | Record<string, string>;

const isQuestionAnswerComplete = (q: Question | undefined, ans: unknown): boolean => {
    if (!q || ans === undefined || ans === null) return false;
    if (q.type === 'matching') {
        const pairCount =
            q.matchingPairs?.length ||
            (typeof q.correctAnswer === 'object' && q.correctAnswer !== null
                ? Object.keys(q.correctAnswer).length
                : 0);
        return typeof ans === 'object' && !Array.isArray(ans) && Object.keys(ans).length >= pairCount;
    }
    if (q.type === 'text') {
        return typeof ans === 'string' && ans.trim().length > 0;
    }
    if (q.type === 'ordering') {
        return Array.isArray(ans) && ans.length > 0;
    }
    if (q.isCompiler || q.type === 'compiler') {
        return typeof ans === 'string' && ans.trim().length > 0;
    }
    return true;
};

interface QuizTakingProps {
    quiz: Quiz;
    user: UserData;
    onComplete: (result: QuizResult) => void;
    onBack: () => void;
    onProgress?: (score: number, currentQuestionIndex: number) => void;
    powerUps?: { type: string; quantity: number }[];
    onPowerUpUsed?: (type: string) => void;
    hidePowerUps?: boolean;
    embedded?: boolean;
    mustAnswerCorrectly?: boolean;
    countUpTimer?: boolean;
    delayedValidation?: boolean;
    onUserUpdate?: (updates: Partial<UserData>) => void;
    poolProgress?: PoolProgressData;
}

type SavedQuizState = {
    quizId: string;
    currentQuestion: number;
    answers: Record<number, AnswerValue>;
    timeLeft: number;
    lastUpdated: number;
    questionOrder?: number[];
    submittedQuestions?: Record<number, boolean>;
    submittedAnswers?: Record<number, AnswerValue>;
    questionCorrectness?: Record<number, boolean>;
};

const QuizTaking: React.FC<QuizTakingProps> = ({
    quiz,
    user,
    onComplete,
    onBack,
    onProgress,
    powerUps,
    onPowerUpUsed,
    hidePowerUps,
    embedded,
    mustAnswerCorrectly,
    countUpTimer = false,
    delayedValidation = false,
    onUserUpdate,
    poolProgress
}) => {
    const { theme, isBento } = useTheme();
    const { tx } = useLanguage();

    const getQuestionTypeLabel = useCallback((qObj: Question) => {
        if (qObj.isCompiler) return 'Coding';
        switch (qObj.type) {
            case 'text': return 'Text Fill';
            case 'matching': return 'Matching';
            case 'ordering': return 'Ordering';
            case 'code-output': return 'Code Output';
            default: return 'Multiple Choice';
        }
    }, []);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
    const [timeLeft, setTimeLeft] = useState(countUpTimer ? 0 : quiz.timeLimit * 60);
    const startTimeRef = useRef(Date.now());

    // PowerUp / Shop States
    const [showShop, setShowShop] = useState(false);
    const [localCoins, setLocalCoins] = useState(user.coins || 0);
    const [localPowerUps, setLocalPowerUps] = useState(powerUps || []);
    const [hiddenOptions, setHiddenOptions] = useState<Record<number, number[]>>({}); // actualIndex -> [originalOptionsToHide]
    const [revealedPowerUpClues, setRevealedPowerUpClues] = useState<Record<number, { type: string; title: string; text: string; code?: string }[]>>({});
    const [activePowerUpAnimation, setActivePowerUpAnimation] = useState<string | null>(null);

    // --- TRANSLATION STATES ---
    const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
        try {
            return localStorage.getItem('quiz_pref_lang') || 'original';
        } catch {
            return 'original';
        }
    });
    const [isTranslated, setIsTranslated] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('quiz_pref_lang');
            return Boolean(saved && saved !== 'original');
        } catch {
            return false;
        }
    });
    const [autoTranslate, setAutoTranslate] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('quiz_pref_auto_trans');
            return saved !== 'false';
        } catch {
            return true;
        }
    });
    const [isTranslating, setIsTranslating] = useState(false);
    const [translatedCache, setTranslatedCache] = useState<Record<number, Record<string, TranslatedQuestionData>>>({});


    // --- INTEGRITY & TELEMETRY TRACKING ---
    const tabSwitchesRef = useRef(0);
    const focusLossRef = useRef(0);
    const copyPasteRef = useRef(0);
    const fullscreenExitsRef = useRef(0);
    const rapidGuessesRef = useRef(0);
    const timePerQuestionRef = useRef<Record<number, number>>({});
    const telemetryEventsRef = useRef<IntegrityTelemetryEvent[]>([]);
    const questionStartTimeRef = useRef(Date.now());
    const lastSubmitTimeRef = useRef(0);
    const [isFullscreenActive, setIsFullscreenActive] = useState(false);
    const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);

    // Event listeners for window/tab focus & clipboard integrity
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                tabSwitchesRef.current += 1;
                telemetryEventsRef.current.push({
                    type: 'tab_hidden',
                    timestamp: new Date().toISOString(),
                    questionIndex: currentQuestion
                });
            }
        };

        const handleBlur = () => {
            focusLossRef.current += 1;
            telemetryEventsRef.current.push({
                type: 'window_blur',
                timestamp: new Date().toISOString(),
                questionIndex: currentQuestion
            });
        };

        const handleCopy = () => {
            copyPasteRef.current += 1;
            telemetryEventsRef.current.push({
                type: 'copy_attempt',
                timestamp: new Date().toISOString(),
                questionIndex: currentQuestion
            });
        };

        const handlePaste = () => {
            copyPasteRef.current += 1;
            telemetryEventsRef.current.push({
                type: 'paste_attempt',
                timestamp: new Date().toISOString(),
                questionIndex: currentQuestion
            });
        };

        const handleFullscreenChange = () => {
            const inFs = Boolean(document.fullscreenElement);
            setIsFullscreenActive(inFs);
            if (!inFs && (quiz.requireFullscreen || quiz.isProctored)) {
                fullscreenExitsRef.current += 1;
                telemetryEventsRef.current.push({
                    type: 'fullscreen_exit',
                    timestamp: new Date().toISOString(),
                    questionIndex: currentQuestion,
                    details: 'Exited Fullscreen Proctoring Mode'
                });
                setShowFullscreenWarning(true);
            }
        };

        const handleContextMenu = (e: MouseEvent) => {
            if (quiz.disableCopyPaste !== false) {
                e.preventDefault();
                telemetryEventsRef.current.push({
                    type: 'context_menu',
                    timestamp: new Date().toISOString(),
                    questionIndex: currentQuestion,
                    details: 'Context menu / right click blocked'
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('copy', handleCopy);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('contextmenu', handleContextMenu);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('paste', handlePaste);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [currentQuestion, quiz.requireFullscreen, quiz.isProctored, quiz.disableCopyPaste]);

    const enterFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                setIsFullscreenActive(true);
                setShowFullscreenWarning(false);
            }
        } catch (err) {
            console.warn('Fullscreen request denied:', err);
        }
    };

    // Question timing tracker
    useEffect(() => {
        const now = Date.now();
        const elapsed = Math.max(1, Math.round((now - questionStartTimeRef.current) / 1000));
        const prevQ = currentQuestion > 0 ? currentQuestion - 1 : 0;
        timePerQuestionRef.current[prevQ] = (timePerQuestionRef.current[prevQ] || 0) + elapsed;
        questionStartTimeRef.current = now;
    }, [currentQuestion]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [shakeError, setShakeError] = useState(false);
    const [isMobileDevice, setIsMobileDevice] = useState(false);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    // --- 3D FLIPPING PAPER CLUE STATE ---
    const [isClueFlipped, setIsClueFlipped] = useState(false);
    const [inlineClue, setInlineClue] = useState<string>('');
    const inlineClueRef = useRef(inlineClue);
    useEffect(() => {
        inlineClueRef.current = inlineClue;
    }, [inlineClue]);
    const [inlineClueLevel, setInlineClueLevel] = useState<number>(1);
    const [inlineClueHistory, setInlineClueHistory] = useState<string[]>([]);
    const [isInlineClueLoading, setIsInlineClueLoading] = useState(false);
    const clueTranslationsRef = useRef<Record<string, Record<string, string>>>({});

    // --- AI COACH QUOTA & COIN TOP-UP STATES ---
    const [aiCoachUsesLeft, setAiCoachUsesLeft] = useState<number>(() => {
        try {
            const saved = sessionStorage.getItem(`quiz_ai_hints_${quiz.id}_${user.userId}`);
            if (saved !== null) {
                const parsed = parseInt(saved, 10);
                if (!isNaN(parsed) && parsed >= 0) return parsed;
            }
        } catch {
            // Ignore storage access errors (e.g. private browsing mode)
        }
        return 3; // 3 starter hints per quiz attempt
    });

    useEffect(() => {
        try {
            sessionStorage.setItem(`quiz_ai_hints_${quiz.id}_${user.userId}`, String(aiCoachUsesLeft));
        } catch {
            // Ignore storage quota / security errors
        }
    }, [aiCoachUsesLeft, quiz.id, user.userId]);

    // Track highest unlocked clue level per question (actualIndex -> level)
    const [unlockedClues, setUnlockedClues] = useState<Record<number, number>>(() => {
        try {
            const saved = sessionStorage.getItem(`quiz_unlocked_clues_${quiz.id}_${user.userId}`);
            if (saved) return JSON.parse(saved);
        } catch {
            // Ignore storage read or JSON parse errors
        }
        return {};
    });

    useEffect(() => {
        try {
            sessionStorage.setItem(`quiz_unlocked_clues_${quiz.id}_${user.userId}`, JSON.stringify(unlockedClues));
        } catch {
            // Ignore storage write / quota errors
        }
    }, [unlockedClues, quiz.id, user.userId]);

    // Cache generated clues per question to avoid re-fetching and ensure free re-flipping
    const cachedCluesRef = useRef<Record<number, { clue: string; level: number; history: string[] }>>({});

    const [showAICoachBuyModal, setShowAICoachBuyModal] = useState(false);
    const [isPurchasingHint, setIsPurchasingHint] = useState<string | null>(null);
    const [purchaseFeedback, setPurchaseFeedback] = useState<string | null>(null);

    // Online/Offline status listener
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const checkMobile = () => {
            const isSmallWidth = window.innerWidth < 768;
            const isSmallHeight = window.innerHeight < 500;
            setIsMobileDevice(isSmallWidth || isSmallHeight);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Delayed Validation / Retry Mode State
    const [retryMode, setRetryMode] = useState(false);
    const [wrongQuestionIndices, setWrongQuestionIndices] = useState<number[]>([]); 
    
    // Review Mode / Immediate Feedback States
    const [questionSubmitted, setQuestionSubmitted] = useState(false);
    const [isCurrentAnswerCorrect, setIsCurrentAnswerCorrect] = useState(false);
    const [submittedQuestions, setSubmittedQuestions] = useState<Record<number, boolean>>({});
    const [submittedAnswers, setSubmittedAnswers] = useState<Record<number, AnswerValue>>({});
    const [questionCorrectness, setQuestionCorrectness] = useState<Record<number, boolean>>({});
    const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
    const [showQuestionMenu, setShowQuestionMenu] = useState(false);
    const [unsubmittedWarning, setUnsubmittedWarning] = useState<string | null>(null);
    const [visitedActualIndices, setVisitedActualIndices] = useState<Record<number, boolean>>({});
    const [hasAttemptedFinish, setHasAttemptedFinish] = useState(false);

    const quizIdentifier = quiz.id || quiz._id || quiz.title;
    const storageKey = `quiz_progress_${user.userId}_${quizIdentifier}`;

    const isUnlimitedTime = (quiz.timeLimit === 0 && !countUpTimer);
    const isReviewMode = quiz.reviewMode !== false && !delayedValidation;

    // --- LOGIC: Forced Shuffling (questions and options are always shuffled) ---
    const generateShuffledIndices = useCallback((length: number) => {
        return buildShuffledIndices(length);
    }, []);

    const [questionOrder, setQuestionOrder] = useState<number[]>(() => {
        const len = quiz.questions ? quiz.questions.length : 0;
        return generateShuffledIndices(len);
    });

    const [optionsOrder, setOptionsOrder] = useState<Record<number, number[]>>({});

    useEffect(() => {
        if (!quiz.questions || quiz.questions.length === 0) return;
        const newOptionsOrder: Record<number, number[]> = {};
        quiz.questions.forEach((q, index) => {
            if (q.options && q.options.length > 0) {
                newOptionsOrder[index] = generateShuffledIndices(q.options.length);
            }
        });
        setOptionsOrder(newOptionsOrder);
        setQuestionOrder(prev => prev.length === quiz.questions.length ? prev : generateShuffledIndices(quiz.questions.length));
    }, [quiz.questions, generateShuffledIndices]);

    // Update local states if props change
    useEffect(() => {
        const mapped = powerUps?.map(p => ({
            ...p,
            type: p.type === 'time_freeze' ? 'time' : p.type
        })) || [];
        setLocalPowerUps(mapped);
    }, [powerUps]);
    useEffect(() => { setLocalCoins(user.coins || 0); }, [user.coins]);

    // --- LOGIC: Restore Saved State ---
    const initialSavedState = useMemo(() => {
        const saved = sessionStorage.getItem(storageKey);
        if (!saved) return null;
        try {
            const parsed = JSON.parse(saved);
            if (parsed.quizId === quizIdentifier) {
                return parsed as SavedQuizState;
            }
        } catch (e) {
            console.error("Failed to parse saved state", e);
        }
        return null;
    }, [quizIdentifier, storageKey]);

    const [showResumePrompt, setShowResumePrompt] = useState(Boolean(initialSavedState) && !embedded);
    const [savedState, setSavedState] = useState<SavedQuizState | null>(initialSavedState);

    useEffect(() => {
        startTimeRef.current = Date.now();
    }, [quizIdentifier]);

    useEffect(() => {
        if (showResumePrompt || isSubmitting || embedded || countUpTimer) return;
        const state: SavedQuizState = {
            quizId: quizIdentifier,
            currentQuestion,
            answers,
            timeLeft,
            lastUpdated: Date.now(),
            questionOrder,
            submittedQuestions,
            submittedAnswers,
            questionCorrectness
        };
        sessionStorage.setItem(storageKey, JSON.stringify(state));
    }, [currentQuestion, answers, timeLeft, quizIdentifier, storageKey, showResumePrompt, isSubmitting, questionOrder, embedded, countUpTimer, submittedQuestions, submittedAnswers, questionCorrectness]);

    const handleResume = () => {
        if (savedState) {
            setCurrentQuestion(savedState.currentQuestion);
            setAnswers(savedState.answers);
            setTimeLeft(savedState.timeLeft);
            if (savedState.questionOrder && savedState.questionOrder.length === quiz.questions.length) {
                setQuestionOrder(savedState.questionOrder);
            } else {
                setQuestionOrder(generateShuffledIndices(quiz.questions.length));
            }
            if (savedState.submittedQuestions) {
                setSubmittedQuestions(savedState.submittedQuestions);
            }
            if (savedState.submittedAnswers) {
                setSubmittedAnswers(savedState.submittedAnswers);
            }
            if (savedState.questionCorrectness) {
                setQuestionCorrectness(savedState.questionCorrectness);
            }
        }
        resetQuestionState(savedState?.currentQuestion ?? 0);
        setShowResumePrompt(false);
    };

    const handleStartNew = () => {
        const len = quiz.questions.length;
        setQuestionOrder(generateShuffledIndices(len));
        const freshOptionsOrder: Record<number, number[]> = {};
        quiz.questions.forEach((q, index) => {
            if (q.options && q.options.length > 0) {
                freshOptionsOrder[index] = generateShuffledIndices(q.options.length);
            }
        });
        setOptionsOrder(freshOptionsOrder);
        sessionStorage.removeItem(storageKey);
        setSavedState(null);
        setSubmittedAnswers({});
        setVisitedActualIndices({});
        setHasAttemptedFinish(false);
        setUnsubmittedWarning(null);
        setShowResumePrompt(false);
        resetQuestionState();
    };

    const getActualQuestionIndex = useCallback((targetIndex = currentQuestion) => {
        if (retryMode) {
            const wrongIndex = wrongQuestionIndices[targetIndex]; 
            return questionOrder[wrongIndex];
        }
        return questionOrder[targetIndex];
    }, [currentQuestion, questionOrder, retryMode, wrongQuestionIndices]);


    // Helper for checking correctness across all question types
    const checkComplexAnswer = useCallback((q: Question | { type?: string; isCompiler?: boolean; compilerConfig?: { referenceCode?: string }; correctAnswer?: unknown; orderingItems?: string[]; matchingPairs?: { left: string; right: string }[]; options?: string[] }, ans: unknown): boolean => {
        if (ans === undefined || ans === null) return false;

        // 1. Compiler Questions
        if (q.isCompiler || q.type === 'compiler') {
            if (q.compilerConfig?.referenceCode && ans) {
                const norm = (s: string) => s.replace(/\s+/g, '').trim();
                return norm(String(ans)) === norm(q.compilerConfig.referenceCode);
            }
            return false;
        }

        // 2. Ordering Questions
        if (q.type === 'ordering') {
            const expectedOrder = q.orderingItems || (Array.isArray(q.correctAnswer) ? q.correctAnswer : q.options);
            if (Array.isArray(expectedOrder) && Array.isArray(ans)) {
                if (ans.length !== expectedOrder.length) return false;
                return ans.every((item, i) => String(item).trim() === String(expectedOrder[i]).trim());
            }
            return false;
        }

        // 3. Matching Pairs Questions
        if (q.type === 'matching') {
            if (q.matchingPairs && Array.isArray(q.matchingPairs) && typeof ans === 'object' && ans !== null) {
                const userMatches = ans as Record<string, string>;
                const answeredKeys = Object.keys(userMatches);
                if (answeredKeys.length !== q.matchingPairs.length) return false;
                return q.matchingPairs.every(pair => userMatches[pair.left]?.trim() === pair.right?.trim());
            }
            if (typeof q.correctAnswer === 'object' && q.correctAnswer !== null && typeof ans === 'object' && ans !== null) {
                const correctObj = q.correctAnswer as Record<string, string>;
                const userObj = ans as Record<string, string>;
                const correctKeys = Object.keys(correctObj);
                if (Object.keys(userObj).length !== correctKeys.length) return false;
                return correctKeys.every(k => userObj[k]?.trim() === correctObj[k]?.trim());
            }
            return false;
        }

        // 4. Code Output Questions
        if (q.type === 'code-output') {
            if (q.options && q.options.length > 0) {
                if (typeof ans === 'number') {
                    return ans === Number(q.correctAnswer) || String(q.options[ans]).trim() === String(q.correctAnswer).trim();
                }
                const cleanAns = String(ans).trim();
                const cleanCorrect = String(q.correctAnswer).trim();
                if (cleanAns === cleanCorrect) return true;
                if (typeof q.correctAnswer === 'number' && q.options[q.correctAnswer] && cleanAns === q.options[q.correctAnswer].trim()) {
                    return true;
                }
                return false;
            }
            return String(ans).trim() === String(q.correctAnswer).trim();
        }

        // 5. Short Answer / Text Questions (70%+ fuzzy matching)
        if (q.type === 'text') {
            if (q.correctAnswer === undefined || q.correctAnswer === null) return false;
            const evalResult = evaluateTextAnswer(ans, q.correctAnswer, 0.70);
            return evalResult.isPassed;
        }

        // 6. Multiple Choice / Default Fallback
        if (Array.isArray(q.correctAnswer) && Array.isArray(ans)) {
            return JSON.stringify(q.correctAnswer) === JSON.stringify(ans);
        }
        if (typeof q.correctAnswer === 'number' && (typeof ans === 'number' || !isNaN(Number(ans)))) {
            return Number(ans) === q.correctAnswer;
        }
        if (Array.isArray(q.options) && typeof q.correctAnswer === 'string' && typeof ans === 'number') {
            return q.options[ans]?.trim() === q.correctAnswer.trim();
        }
        return ans === q.correctAnswer;
    }, []);

    const resetQuestionState = useCallback((targetIndex = currentQuestion) => {
        setShakeError(false);
        setIsClueFlipped(false);
        const actualIdx = getActualQuestionIndex(targetIndex);
        const cached = cachedCluesRef.current[actualIdx];
        if (cached) {
            setInlineClue(cached.clue);
            setInlineClueLevel(cached.level);
            setInlineClueHistory(cached.history);
        } else {
            setInlineClue('');
            setInlineClueLevel(1);
            setInlineClueHistory([]);
        }
        setIsInlineClueLoading(false);
        const hasAnswer = answers[actualIdx] !== undefined;
        const isSubmitted = Boolean(hasAnswer && submittedQuestions[actualIdx]);
        setQuestionSubmitted(isSubmitted);
        if (quiz.reviewMode !== false) {
            if (isSubmitted) {
                const q = quiz.questions[actualIdx];
                const isCorrect = questionCorrectness[actualIdx] !== undefined
                    ? questionCorrectness[actualIdx]
                    : (q ? checkComplexAnswer(q, answers[actualIdx]) : false);
                setIsCurrentAnswerCorrect(isCorrect);
            } else {
                setIsCurrentAnswerCorrect(false);
            }
        } else {
            setIsCurrentAnswerCorrect(false);
        }
    }, [currentQuestion, quiz.reviewMode, getActualQuestionIndex, answers, submittedQuestions, questionCorrectness, quiz.questions, checkComplexAnswer]);

    // Automatically keep questionSubmitted and isCurrentAnswerCorrect in sync whenever currentQuestion changes
    useEffect(() => {
        setShakeError(false);
        setIsClueFlipped(false);
        const actualIdx = getActualQuestionIndex(currentQuestion);
        const cached = cachedCluesRef.current[actualIdx];
        if (cached) {
            setInlineClue(cached.clue);
            setInlineClueLevel(cached.level);
            setInlineClueHistory(cached.history);
        } else {
            setInlineClue('');
            setInlineClueLevel(1);
            setInlineClueHistory([]);
        }
        setIsInlineClueLoading(false);

        const hasAnswer = answers[actualIdx] !== undefined;
        const isSubmitted = Boolean(hasAnswer && submittedQuestions[actualIdx]);
        setQuestionSubmitted(isSubmitted);
        if (quiz.reviewMode !== false) {
            if (isSubmitted) {
                const q = quiz.questions[actualIdx];
                const isCorrect = questionCorrectness[actualIdx] !== undefined 
                    ? questionCorrectness[actualIdx] 
                    : (q ? checkComplexAnswer(q, answers[actualIdx]) : false);
                setIsCurrentAnswerCorrect(isCorrect);
            } else {
                setIsCurrentAnswerCorrect(false);
            }
        } else {
            setIsCurrentAnswerCorrect(false);
        }
    }, [currentQuestion, answers, submittedQuestions, questionCorrectness, quiz.reviewMode, quiz.questions, getActualQuestionIndex, checkComplexAnswer]);

    const isLastQuestion = retryMode
        ? currentQuestion === wrongQuestionIndices.length - 1
        : currentQuestion === quiz.questions.length - 1;

    const goToQuestion = useCallback((questionPosition: number) => {
        if (isSubmitting) return;
        const leavingActualIdx = getActualQuestionIndex(currentQuestion);
        if (leavingActualIdx !== undefined) {
            setVisitedActualIndices(prev => (prev[leavingActualIdx] ? prev : { ...prev, [leavingActualIdx]: true }));
        }
        setCurrentQuestion(questionPosition);
        resetQuestionState(questionPosition);
        setShowQuestionMenu(false);
    }, [isSubmitting, resetQuestionState, getActualQuestionIndex, currentQuestion]);

    const activePositions = useMemo(() => {
        const count = retryMode ? wrongQuestionIndices.length : quiz.questions.length;
        return Array.from({ length: count }, (_, pos) => pos);
    }, [retryMode, wrongQuestionIndices.length, quiz.questions.length]);

    const incompletePositions = useMemo(() => {
        return activePositions.filter(pos => {
            const actualIdx = getActualQuestionIndex(pos);
            const qObj = quiz.questions[actualIdx];
            if (!qObj) return false;
            const complete = isQuestionAnswerComplete(qObj, answers[actualIdx]);
            if (!complete) return true;
            // Review Mode requires explicit per-question check/submit; Quiz Mode allows direct selection
            if (isReviewMode && !submittedQuestions[actualIdx]) return true;
            return false;
        });
    }, [activePositions, getActualQuestionIndex, quiz.questions, answers, isReviewMode, submittedQuestions]);

    const allQuestionsSubmitted = incompletePositions.length === 0;

    const redAlertActualSet = useMemo(() => {
        const set = new Set<number>();
        for (const pos of incompletePositions) {
            const actualIdx = getActualQuestionIndex(pos);
            if (hasAttemptedFinish || (visitedActualIndices[actualIdx] && pos !== currentQuestion)) {
                set.add(actualIdx);
            }
        }
        return set;
    }, [incompletePositions, getActualQuestionIndex, hasAttemptedFinish, visitedActualIndices, currentQuestion]);

    useEffect(() => {
        if (allQuestionsSubmitted && unsubmittedWarning) {
            setUnsubmittedWarning(null);
        }
    }, [allQuestionsSubmitted, unsubmittedWarning]);

    const handleQuizComplete = useCallback((isTimeUp = false) => {
        if (isSubmitting) return;

        // If manual submission (not auto-timeout), verify all questions are answered (and submitted in Review Mode)
        if (!isTimeUp && !allQuestionsSubmitted) {
            setHasAttemptedFinish(true);
            setShakeError(true);
            setTimeout(() => setShakeError(false), 500);
            sounds.playIncorrect();

            const count = incompletePositions.length;
            const msg = isReviewMode
                ? tx(
                    `${count} question${count > 1 ? 's' : ''} not submitted yet — tap a red number to finish`,
                    `في ${count} سؤال متسلمش لسه — اضغط على الرقم الأحمر للإجابة`
                )
                : tx(
                    `${count} unanswered question${count > 1 ? 's' : ''} — tap a red number to answer`,
                    `في ${count} سؤال بدون إجابة — اضغط على الرقم الأحمر للإجابة`
                );
            setUnsubmittedWarning(msg);
            setShowQuestionMenu(true);
            return;
        }

        if (delayedValidation) {
            const wrongs: number[] = [];
            questionOrder.forEach((actualIndex, orderIdx) => {
                const q = quiz.questions[actualIndex];
                const ans = answers[actualIndex];
                const isCorrect = checkComplexAnswer(q, ans);
                if (!isCorrect) {
                    wrongs.push(orderIdx);
                }
            });

            if (wrongs.length > 0) {
                const newCorrectCount = quiz.questions.length - wrongs.length;
                if (onProgress) {
                    let currentScore = 0;
                    quiz.questions.forEach((qObj, idx) => {
                        const currentAns = answers[idx];
                        if (currentAns !== undefined && checkComplexAnswer(qObj, currentAns)) {
                            currentScore += qObj.points;
                        }
                    });
                    onProgress(currentScore, newCorrectCount);
                }
                setRetryMode(true);
                setWrongQuestionIndices(wrongs);
                setCurrentQuestion(0);
                setShakeError(true);
                setTimeout(() => setShakeError(false), 500);
                return;
            }
        }

        setIsSubmitting(true);
        sessionStorage.removeItem(storageKey);
        const endTime = Date.now();
        const duration = countUpTimer ? timeLeft : Math.floor((endTime - startTimeRef.current) / 1000);

        let score = 0;
        const detailedAnswers: AttemptAnswers = {};

        quiz.questions.forEach((q, idx) => {
            const ans = answers[idx];
            const isCorrect = checkComplexAnswer(q, ans);
            if (isCorrect) score += q.points;
            detailedAnswers[idx] = {
                selected: ans,
                isCorrect,
                type: q.type || 'multiple-choice'
            };
        });

        const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);
        const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

        // Finalize timing for the last question
        const now = Date.now();
        const elapsedFinal = Math.max(1, Math.round((now - questionStartTimeRef.current) / 1000));
        timePerQuestionRef.current[currentQuestion] = (timePerQuestionRef.current[currentQuestion] || 0) + elapsedFinal;

        // Calculate Exam Integrity Score
        const tabDeduction = Math.min(40, tabSwitchesRef.current * 10);
        const blurDeduction = Math.min(20, focusLossRef.current * 5);
        const copyPasteDeduction = Math.min(30, copyPasteRef.current * 15);
        const fullscreenDeduction = Math.min(30, fullscreenExitsRef.current * 15);
        const rapidGuessDeduction = Math.min(20, rapidGuessesRef.current * 5);
        const totalDeduction = tabDeduction + blurDeduction + copyPasteDeduction + fullscreenDeduction + rapidGuessDeduction;
        const integrityScore = Math.max(0, Math.min(100, 100 - totalDeduction));

        const telemetry: IntegrityTelemetry = {
            tabSwitches: tabSwitchesRef.current,
            focusLossCount: focusLossRef.current,
            copyPasteAttempts: copyPasteRef.current,
            fullscreenExits: fullscreenExitsRef.current,
            rapidGuesses: rapidGuessesRef.current,
            timePerQuestion: timePerQuestionRef.current,
            events: telemetryEventsRef.current,
            integrityScore
        };

        if (percentage >= (quiz.passingScore ?? 70)) {
            sounds.playLevelUp();
        }

        onComplete({
            score,
            totalQuestions: quiz.questions.length,
            percentage,
            timeTaken: duration,
            answers: detailedAnswers,
            passed: percentage >= (quiz.passingScore ?? 70),
            reviewStatus: 'completed',
            powerUpsUsed: [],
            telemetry
        });

    }, [answers, delayedValidation, isSubmitting, onComplete, onProgress, questionOrder, quiz.questions, quiz.passingScore, storageKey, timeLeft, countUpTimer, checkComplexAnswer, currentQuestion, allQuestionsSubmitted, incompletePositions.length, isReviewMode, tx]);

    const nextQuestion = useCallback(() => {
        if (isSubmitting) return;
        const leavingActualIdx = getActualQuestionIndex(currentQuestion);
        if (leavingActualIdx !== undefined) {
            setVisitedActualIndices(prev => (prev[leavingActualIdx] ? prev : { ...prev, [leavingActualIdx]: true }));
        }
        if (!isLastQuestion) {
            setCurrentQuestion(c => c + 1);
            resetQuestionState(currentQuestion + 1);
        } else {
            handleQuizComplete(false);
        }
    }, [isSubmitting, isLastQuestion, handleQuizComplete, currentQuestion, resetQuestionState, getActualQuestionIndex]);

    const previousQuestion = useCallback(() => {
        if (isSubmitting || currentQuestion <= 0) return;
        const leavingActualIdx = getActualQuestionIndex(currentQuestion);
        if (leavingActualIdx !== undefined) {
            setVisitedActualIndices(prev => (prev[leavingActualIdx] ? prev : { ...prev, [leavingActualIdx]: true }));
        }
        setCurrentQuestion(c => c - 1);
        resetQuestionState(currentQuestion - 1);
    }, [isSubmitting, currentQuestion, resetQuestionState, getActualQuestionIndex]);

    const toggleCurrentQuestionFlag = useCallback(() => {
        const actualIndex = getActualQuestionIndex();
        setFlaggedQuestions(prev => ({ ...prev, [actualIndex]: !prev[actualIndex] }));
    }, [getActualQuestionIndex]);

    // Handlers for Question Translation
    const handleSelectLanguage = useCallback((langCode: string) => {
        setSelectedLanguage(langCode);
        try {
            localStorage.setItem('quiz_pref_lang', langCode);
        } catch {
            // Ignore storage access errors
        }

        if (langCode === 'original') {
            setIsTranslated(false);
        } else {
            setIsTranslated(true);
        }
    }, []);

    const handleToggleOriginal = useCallback(() => {
        setIsTranslated((prev) => !prev);
    }, []);

    const handleToggleAutoTranslate = useCallback(() => {
        setAutoTranslate((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('quiz_pref_auto_trans', String(next));
            } catch {
                // Ignore storage access errors
            }
            return next;
        });
    }, []);

    // Translate question when question index or language changes
    useEffect(() => {
        const actualIdx = getActualQuestionIndex();
        const currentQ = quiz.questions[actualIdx];
        if (!currentQ || selectedLanguage === 'original' || !isTranslated) return;

        if (translatedCache[actualIdx]?.[selectedLanguage]) return;

        let isCancelled = false;
        setIsTranslating(true);

        translateQuestion(currentQ, selectedLanguage)
            .then((data) => {
                if (!isCancelled) {
                    setTranslatedCache((prev) => ({
                        ...prev,
                        [actualIdx]: {
                            ...(prev[actualIdx] || {}),
                            [selectedLanguage]: data
                        }
                    }));
                }
            })
            .catch((err) => {
                console.warn('[Translate] Error translating question:', err);
            })
            .finally(() => {
                if (!isCancelled) {
                    setIsTranslating(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [currentQuestion, selectedLanguage, isTranslated, getActualQuestionIndex, quiz.questions, translatedCache]);

    // --- 3D Paper Inline Clue Logic ---
    const fetchInlineClue = useCallback(async (targetLevel = 1) => {
        const actualIdx = getActualQuestionIndex();
        const currentQ = quiz.questions[actualIdx];
        if (!currentQ) return;

        setIsInlineClueLoading(true);
        try {
            const isNonEn = isTranslated && selectedLanguage !== 'original';
            const langInfo = isNonEn ? getLanguageByCode(selectedLanguage) : null;

            const res = await api.getAICoachHint({
                question: currentQ.question,
                options: currentQ.options,
                category: quiz.category || currentQ.part || '',
                studentAnswer: answers[actualIdx] ? String(answers[actualIdx]) : undefined,
                targetLang: isNonEn ? selectedLanguage : undefined,
                targetLangName: langInfo ? langInfo.name : undefined,
                correctAnswer: currentQ.correctAnswer,
                clueLevel: targetLevel,
                previousHints: inlineClueHistory
            });

            if (res.hint) {
                const hint = res.hint;
                setInlineClue(hint);
                setInlineClueLevel(targetLevel);
                const nextHistory = inlineClueHistory.includes(hint) ? inlineClueHistory : [...inlineClueHistory, hint];
                setInlineClueHistory(nextHistory);

                // Cache clue for this question so returning to it is instant and free
                cachedCluesRef.current[actualIdx] = {
                    clue: hint,
                    level: targetLevel,
                    history: nextHistory
                };

                const cacheKey = `${actualIdx}_${targetLevel}`;
                const currentLangKey = isNonEn ? selectedLanguage : 'original';
                clueTranslationsRef.current[cacheKey] = {
                    ...(clueTranslationsRef.current[cacheKey] || {}),
                    [currentLangKey]: hint
                };
            }
        } catch (err) {
            console.error('Failed to get clue:', err);
            const fallbackHint = '💡 Focus on the fundamental rules of this topic and eliminate options that contradict core principles.';
            setInlineClue(fallbackHint);
            cachedCluesRef.current[actualIdx] = {
                clue: fallbackHint,
                level: targetLevel,
                history: [fallbackHint]
            };
        } finally {
            setIsInlineClueLoading(false);
        }
    }, [getActualQuestionIndex, quiz.questions, quiz.category, answers, isTranslated, selectedLanguage, inlineClueHistory]);

    const flipToClue = useCallback(() => {
        const actualIdx = getActualQuestionIndex();

        // If currently flipped to clue, flipping back to question is always free and allowed!
        if (isClueFlipped) {
            setIsClueFlipped(false);
            return;
        }

        // We want to flip to clue. Check if already unlocked on this question:
        const isAlreadyUnlocked = (unlockedClues[actualIdx] || 0) >= 1;

        if (!isAlreadyUnlocked) {
            if (aiCoachUsesLeft <= 0) {
                sounds.playClick();
                setShowAICoachBuyModal(true);
                return;
            }

            // Deduct 1 hint from quota and record question as unlocked at level 1
            setAiCoachUsesLeft(prev => Math.max(0, prev - 1));
            setUnlockedClues(prev => ({ ...prev, [actualIdx]: 1 }));
        }

        // Check if we already have a cached clue for this question
        const cached = cachedCluesRef.current[actualIdx];
        if (cached) {
            setInlineClue(cached.clue);
            setInlineClueLevel(cached.level);
            setInlineClueHistory(cached.history);
        }

        setIsClueFlipped(true);

        if (!cached && !inlineClue) {
            fetchInlineClue(1);
        }
    }, [isClueFlipped, getActualQuestionIndex, unlockedClues, aiCoachUsesLeft, inlineClue, fetchInlineClue]);

    const handleNextInlineClue = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const actualIdx = getActualQuestionIndex();
        const nextLevel = inlineClueLevel + 1;
        const isAlreadyUnlocked = (unlockedClues[actualIdx] || 0) >= nextLevel;

        if (!isAlreadyUnlocked) {
            if (aiCoachUsesLeft <= 0) {
                sounds.playClick();
                setShowAICoachBuyModal(true);
                return;
            }

            // Deduct 1 hint and mark nextLevel as unlocked
            setAiCoachUsesLeft(prev => Math.max(0, prev - 1));
            setUnlockedClues(prev => ({ ...prev, [actualIdx]: nextLevel }));
        }

        fetchInlineClue(nextLevel);
    }, [getActualQuestionIndex, inlineClueLevel, unlockedClues, aiCoachUsesLeft, fetchInlineClue]);

    const handleBuyAICoachHints = async (hintsToAdd: number, cost: number, itemId: string) => {
        if (localCoins < cost) return;
        setIsPurchasingHint(itemId);

        const newCoins = localCoins - cost;
        setLocalCoins(newCoins);
        setAiCoachUsesLeft(prev => prev + hintsToAdd);
        sounds.playPowerUp();

        try {
            const res = await api.purchaseItem(itemId, user.userId);
            if (res && typeof res.coins === 'number') {
                setLocalCoins(res.coins);
                onUserUpdate?.({ coins: res.coins });
            } else {
                onUserUpdate?.({ coins: newCoins });
            }
            setPurchaseFeedback(`+${hintsToAdd} hints added to AI Coach!`);
            setTimeout(() => setPurchaseFeedback(null), 2500);
        } catch (err) {
            console.warn('API purchase failed, maintained local balance:', err);
            onUserUpdate?.({ coins: newCoins });
            setPurchaseFeedback(`+${hintsToAdd} hints added!`);
            setTimeout(() => setPurchaseFeedback(null), 2500);
        } finally {
            setIsPurchasingHint(null);
        }
    };

    const getClueLevelTitle = useCallback((level: number) => {
        const titles = [
            'Level 1: Core Concept',
            'Level 2: Mechanism & Behavior',
            'Level 3: Elimination Clue',
            'Level 4: Deep Insight',
            'Level 5: Socratic Riddle'
        ];
        return titles[level - 1] || `Clue Level ${level}`;
    }, []);

    // Translate clue synchronously when language or translation mode is toggled via QuestionTranslatorBar
    useEffect(() => {
        const currentClue = inlineClueRef.current;
        if (!currentClue || isInlineClueLoading) return;
        const actualIdx = getActualQuestionIndex();
        const cacheKey = `${actualIdx}_${inlineClueLevel}`;
        const target = (isTranslated && selectedLanguage !== 'original') ? selectedLanguage : 'original';

        if (clueTranslationsRef.current[cacheKey]?.[target]) {
            setInlineClue(clueTranslationsRef.current[cacheKey][target]);
            return;
        }

        if (target === 'original') {
            if (clueTranslationsRef.current[cacheKey]?.['original']) {
                setInlineClue(clueTranslationsRef.current[cacheKey]['original']);
            }
            return;
        }

        let isCancelled = false;
        translateText(currentClue, target)
            .then(translated => {
                if (!isCancelled && translated) {
                    setInlineClue(translated);
                    clueTranslationsRef.current[cacheKey] = {
                        ...(clueTranslationsRef.current[cacheKey] || {}),
                        [target]: translated
                    };
                }
            })
            .catch(err => {
                console.warn('[Translate Clue] Error translating clue:', err);
            });

        return () => {
            isCancelled = true;
        };
    }, [selectedLanguage, isTranslated, getActualQuestionIndex, inlineClueLevel, isInlineClueLoading]);

    const handleAnswer = useCallback((answer: string | number | string[] | Record<string, string>) => {
        if (isSubmitting) return;

        const actualIndex = getActualQuestionIndex();
        // Lock answer if already submitted in review mode
        if (isReviewMode && submittedQuestions[actualIndex]) return;
        const q = quiz.questions[actualIndex];

        // Rapid Guessing Detection (< 1.8 seconds on questions with text)
        const elapsedOnQ = (Date.now() - questionStartTimeRef.current) / 1000;
        if (elapsedOnQ < 1.8 && (q.question?.length || 0) > 25) {
            rapidGuessesRef.current += 1;
            telemetryEventsRef.current.push({
                type: 'rapid_guess',
                timestamp: new Date().toISOString(),
                questionIndex: currentQuestion,
                details: `Fast answer in ${elapsedOnQ.toFixed(1)}s`
            });
        }

        // Strict Mode Check
        if (mustAnswerCorrectly && !delayedValidation) {
            if (!checkComplexAnswer(q, answer)) {
                setShakeError(true);
                setTimeout(() => setShakeError(false), 400);
                return;
            }
        }

        const newAnswers = { ...answers, [actualIndex]: answer };
        setAnswers(newAnswers);

        if (onProgress) {
            let currentScore = 0;
            let answered = 0;
            let correctCount = 0;
            quiz.questions.forEach((qObj, idx) => {
                const currentAns = newAnswers[idx];
                if (currentAns !== undefined) {
                    answered++;
                    const isCorrect = checkComplexAnswer(qObj, currentAns);
                    if (isCorrect) {
                        currentScore += qObj.points;
                        correctCount++;
                    }
                }
            });
            const progressIndex = delayedValidation ? correctCount : answered;
            onProgress(currentScore, progressIndex);
        }
    }, [isSubmitting, getActualQuestionIndex, quiz.questions, mustAnswerCorrectly, delayedValidation, answers, onProgress, checkComplexAnswer, currentQuestion, isReviewMode, submittedQuestions]);


    const submitQuestion = useCallback(() => {
        const actualIndex = getActualQuestionIndex();
        // In review mode, do not allow re-submitting an already submitted question
        if (quiz.reviewMode !== false && submittedQuestions[actualIndex]) return;

        lastSubmitTimeRef.current = Date.now();
        const q = quiz.questions[actualIndex];
        const answer = answers[actualIndex];
        if (answer === undefined) return;
        if (q.type === 'matching') {
            const pairCount = q.matchingPairs?.length || (typeof q.correctAnswer === 'object' && q.correctAnswer !== null ? Object.keys(q.correctAnswer).length : 0);
            if (typeof answer !== 'object' || Object.keys(answer).length < pairCount) return;
        }

        const isCorrect = checkComplexAnswer(q, answer);
        if (quiz.reviewMode !== false) {
            setIsCurrentAnswerCorrect(isCorrect);
            if (isCorrect) {
                sounds.playCorrect();
            } else {
                sounds.playIncorrect();
            }
        } else {
            // Quiz Mode: play a gentle submit click without revealing correctness
            sounds.playClick();
        }

        setQuestionSubmitted(true);
        setSubmittedQuestions(prev => ({ ...prev, [actualIndex]: true }));
        setSubmittedAnswers(prev => ({ ...prev, [actualIndex]: answer }));
        setQuestionCorrectness(prev => ({ ...prev, [actualIndex]: isCorrect }));
        setIsClueFlipped(false);
        setUnsubmittedWarning(null);

        if (onProgress) {
            let currentScore = 0;
            let answered = 0;
            let correctCount = 0;
            quiz.questions.forEach((qObj, idx) => {
                const isCurrent = idx === actualIndex;
                const currentAns = isCurrent ? answer : answers[idx];
                const isAnsSubmitted = isCurrent ? true : submittedQuestions[idx];
                if (currentAns !== undefined) {
                    if (isAnsSubmitted) {
                        answered++;
                        const isCorrect = checkComplexAnswer(qObj, currentAns);
                        if (isCorrect) {
                            currentScore += qObj.points;
                            correctCount++;
                        }
                    }
                }
            });
            const progressIndex = delayedValidation ? correctCount : answered;
            onProgress(currentScore, progressIndex);
        }
    }, [answers, getActualQuestionIndex, quiz.questions, submittedQuestions, onProgress, checkComplexAnswer, delayedValidation, quiz.reviewMode]);


    // --- Keyboard Shortcuts ---
    useEffect(() => {
        if (showResumePrompt || isSubmitting || showShop) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const isTextarea = document.activeElement?.tagName === 'TEXTAREA';
            if (isTextarea) return;

            const isInputFocused = document.activeElement?.tagName === 'INPUT';

            if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
                if (isInputFocused) return;
                e.preventDefault();
                setShowKeyboardShortcuts(prev => !prev);
                return;
            }

            const actualIndex = getActualQuestionIndex();
            const q = quiz.questions[actualIndex];
            
            // Allow Enter to advance or submit
            if (e.key === 'Enter') {
                if (Date.now() - lastSubmitTimeRef.current < 600) {
                    e.preventDefault();
                    return;
                }

                const isAlreadySubmitted = Boolean(isReviewMode && submittedQuestions[actualIndex]);
                if (isInputFocused && (!isReviewMode || !isAlreadySubmitted)) return; // Let TextQuestion handle Enter on input

                e.preventDefault();
                if (isReviewMode) {
                    if (!isAlreadySubmitted) {
                        if (!isQuestionAnswerComplete(q, answers[actualIndex])) {
                            setShakeError(true);
                            setTimeout(() => setShakeError(false), 400);
                            return;
                        }
                        submitQuestion();
                    } else if (allQuestionsSubmitted && (isLastQuestion || hasAttemptedFinish)) {
                        handleQuizComplete(false);
                    } else if (!isLastQuestion) {
                        nextQuestion();
                    } else {
                        handleQuizComplete(false);
                    }
                } else {
                    if (isLastQuestion) {
                        handleQuizComplete(false);
                    } else {
                        nextQuestion();
                    }
                }
                return;
            }

            if (e.key === 'ArrowLeft') {
                if (isInputFocused) return;
                e.preventDefault();
                previousQuestion();
                return;
            }

            if (e.key === 'ArrowRight') {
                if (isInputFocused) return;
                e.preventDefault();
                nextQuestion();
                return;
            }

            if (isInputFocused) return;

            // Keyboard option selection (1-N or A-N) dynamically based on number of options
            const isCurrentLocked = Boolean(quiz.reviewMode !== false && !delayedValidation && (submittedQuestions[actualIndex] || questionSubmitted));
            if (q && q.options && !q.isCompiler && !isCurrentLocked) {
                const currentOptions = optionsOrder[actualIndex] || [];
                let selectedVisualIndex = -1;

                if (e.key.length === 1 && e.key >= '1' && e.key <= '9') {
                    const numIndex = parseInt(e.key) - 1;
                    if (numIndex >= 0 && numIndex < currentOptions.length) {
                        selectedVisualIndex = numIndex;
                    }
                } else if (e.key.length === 1 && /^[a-z]$/i.test(e.key)) {
                    const letterIndex = e.key.toLowerCase().charCodeAt(0) - 97;
                    if (letterIndex >= 0 && letterIndex < currentOptions.length) {
                        selectedVisualIndex = letterIndex;
                    }
                }

                if (selectedVisualIndex >= 0 && selectedVisualIndex < currentOptions.length) {
                    const originalIndex = currentOptions[selectedVisualIndex];
                    const hiddenOpts = hiddenOptions[actualIndex] || [];
                    if (!hiddenOpts.includes(originalIndex)) {
                        handleAnswer(originalIndex);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showResumePrompt, isSubmitting, showShop, getActualQuestionIndex, quiz.questions, quiz.reviewMode, delayedValidation, isReviewMode, answers, questionSubmitted, submittedQuestions, allQuestionsSubmitted, hasAttemptedFinish, isLastQuestion, nextQuestion, previousQuestion, optionsOrder, hiddenOptions, handleAnswer, submitQuestion, handleQuizComplete]);


    // --- Power-up Application Logic ---
    const applyPowerUp = useCallback((type: string) => {
        sounds.playPowerUp();
        setActivePowerUpAnimation(type);
        setTimeout(() => setActivePowerUpAnimation(null), 1500);

        const actualIdx = getActualQuestionIndex();
        const q = quiz.questions[actualIdx];

        if (type === 'hint' && q && q.options && q.correctAnswer !== undefined) {
            // Pick 2 random wrong options to hide
            const wrongIndices = q.options
                .map((_, i) => i)
                .filter(i => i !== q.correctAnswer);
            
            // Shuffle and pick up to 2
            for (let i = wrongIndices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [wrongIndices[i], wrongIndices[j]] = [wrongIndices[j], wrongIndices[i]];
            }
            const toHide = wrongIndices.slice(0, Math.min(2, wrongIndices.length));
            setHiddenOptions(prev => ({ ...prev, [actualIdx]: [...(prev[actualIdx] || []), ...toHide] }));
        }
        else if (type === 'auto_pair' && q && q.type === 'matching' && q.matchingPairs?.length) {
            const currentMatches = (answers[actualIdx] && typeof answers[actualIdx] === 'object' && !Array.isArray(answers[actualIdx]))
                ? (answers[actualIdx] as Record<string, string>)
                : {};
            const existingCount = (revealedPowerUpClues[actualIdx] || []).filter(c => c.type === 'auto_pair').length;
            const unrevealedPair = q.matchingPairs.find(p => currentMatches[p.left] !== p.right) || q.matchingPairs[existingCount % q.matchingPairs.length];
            if (unrevealedPair) {
                setRevealedPowerUpClues(prev => ({
                    ...prev,
                    [actualIdx]: [
                        ...(prev[actualIdx] || []),
                        {
                            type: 'auto_pair',
                            title: tx('Auto-Match Pair', 'توصيلة مضمونة'),
                            text: `${unrevealedPair.left}  ⟶  ${unrevealedPair.right}`
                        }
                    ]
                }));
            }
        }
        else if (type === 'lock_step' && q && q.type === 'ordering') {
            const expectedOrder = q.orderingItems || q.options || [];
            const usedCount = (revealedPowerUpClues[actualIdx] || []).filter(c => c.type === 'lock_step').length;
            const stepIdx = Math.min(usedCount, Math.max(0, expectedOrder.length - 1));
            if (expectedOrder[stepIdx]) {
                setRevealedPowerUpClues(prev => ({
                    ...prev,
                    [actualIdx]: [
                        ...(prev[actualIdx] || []),
                        {
                            type: 'lock_step',
                            title: tx(`Order Anchor (#${stepIdx + 1})`, `ترتيب مؤكد (#${stepIdx + 1})`),
                            text: tx(`Position ${stepIdx + 1}: "${expectedOrder[stepIdx]}"`, `الخطوة رقم ${stepIdx + 1}: "${expectedOrder[stepIdx]}"`)
                        }
                    ]
                }));
            }
        }
        else if (type === 'letter_reveal' && q) {
            if (q.type === 'code-output' && q.options && q.options.length > 2 && typeof q.correctAnswer === 'number') {
                const wrongIndices = q.options.map((_, i) => i).filter(i => i !== q.correctAnswer);
                const toHide = wrongIndices.slice(0, Math.min(2, wrongIndices.length));
                setHiddenOptions(prev => ({ ...prev, [actualIdx]: [...(prev[actualIdx] || []), ...toHide] }));
            } else {
                const ansStr = String(q.correctAnswer ?? '').trim();
                const previewLen = Math.min(2, Math.max(1, Math.floor(ansStr.length / 3)));
                const masked = ansStr
                    ? `${ansStr.slice(0, previewLen)}${' _'.repeat(Math.max(0, Math.min(10, ansStr.length - previewLen)))} (${ansStr.length} ${tx('chars', 'حرف')})`
                    : tx('Check the question carefully!', 'راجع السؤال كويس!');
                setRevealedPowerUpClues(prev => ({
                    ...prev,
                    [actualIdx]: [
                        ...(prev[actualIdx] || []),
                        {
                            type: 'letter_reveal',
                            title: tx('Answer Clue', 'تلميح الإجابة'),
                            text: masked
                        }
                    ]
                }));
            }
        }
        else if (type === 'code_hint' && q) {
            const refCode = q.compilerConfig?.referenceCode || q.explanation || '';
            const lines = refCode.split('\n').filter(Boolean);
            const snippet = lines.slice(0, Math.max(2, Math.ceil(lines.length * 0.45))).join('\n');
            setRevealedPowerUpClues(prev => ({
                ...prev,
                [actualIdx]: [
                    ...(prev[actualIdx] || []),
                    {
                        type: 'code_hint',
                        title: tx('Starter Code Snippet', 'كود مساعد للبداية'),
                        text: snippet ? '' : (q.explanation || tx('Break the problem into small steps.', 'قسّم المسألة لخطوات صغيرة.')),
                        code: snippet || undefined
                    }
                ]
            }));
        }
        else if (type === 'time') {
            setTimeLeft(prev => countUpTimer ? prev : prev + 30); // Add 30s to countdown
        }
        else if (type === 'skip') {
            // Auto complete as correct across all question types
            let skipAns: AnswerValue = "SKIPPED";
            if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
                skipAns = q.correctAnswer as AnswerValue;
                handleAnswer(skipAns);
            } else if (q.isCompiler && q.compilerConfig?.referenceCode) {
                skipAns = q.compilerConfig.referenceCode;
                handleAnswer(q.compilerConfig.referenceCode);
            } else if (q.type === 'ordering' && (q.orderingItems || q.options)) {
                skipAns = q.orderingItems || q.options || [];
                handleAnswer(q.orderingItems || q.options || []);
            } else if (q.type === 'matching' && q.matchingPairs) {
                const autoMatches: Record<string, string> = {};
                q.matchingPairs.forEach(p => { autoMatches[p.left] = p.right; });
                skipAns = autoMatches;
                handleAnswer(autoMatches);
            } else {
                handleAnswer("SKIPPED");
            }
            setSubmittedQuestions(prev => ({ ...prev, [actualIdx]: true }));
            setSubmittedAnswers(prev => ({ ...prev, [actualIdx]: skipAns }));
            setQuestionCorrectness(prev => ({ ...prev, [actualIdx]: true }));
            // Auto-advance
            setTimeout(() => nextQuestion(), 600);
        }
    }, [getActualQuestionIndex, quiz.questions, countUpTimer, handleAnswer, nextQuestion, answers, revealedPowerUpClues, tx]);


    const handleUseOwnedItem = (type: string) => {
        const itemIdx = localPowerUps.findIndex(p => p.type === type);
        if (itemIdx >= 0 && localPowerUps[itemIdx].quantity > 0) {
            // Update local state temporarily
            const newPowerups = [...localPowerUps];
            newPowerups[itemIdx] = { ...newPowerups[itemIdx], quantity: newPowerups[itemIdx].quantity - 1 };
            setLocalPowerUps(newPowerups);
            
            // Notify parent
            if (onPowerUpUsed) onPowerUpUsed(type);
            
            applyPowerUp(type);
        }
    };

    const handleBuyItem = async (_type: string, cost: number, itemId: string) => {
        if (localCoins < cost) return;
        setLocalCoins(prev => prev - cost);
        try {
            const res = await api.purchaseItem(itemId, user.userId);
            
            const mappedPowerUps = res.powerUps?.map((p: { type: string; quantity: number }) => ({
                ...p,
                type: p.type === 'time_freeze' ? 'time' : p.type
            })) || [];
            setLocalPowerUps(mappedPowerUps);
            
            if (onUserUpdate) {
                onUserUpdate({
                    coins: res.coins,
                    inventory: res.inventory,
                    powerUps: res.powerUps,
                    unlockedItems: res.unlockedItems
                });
            }
        } catch (e) {
            console.error("Purchase failed", e);
            setLocalCoins(prev => prev + cost); // Revert
        }
    };

    // --- Timer Tick ---
    useEffect(() => {
        if (showResumePrompt || isSubmitting || isUnlimitedTime) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (countUpTimer) return prev + 1;
                if (prev <= 1) {
                    handleQuizComplete(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [countUpTimer, isSubmitting, isUnlimitedTime, showResumePrompt, handleQuizComplete]);



    // --- RENDER ---
    const actualIndex = getActualQuestionIndex();
    const q = quiz.questions[actualIndex];
    if (!q) return <div className="p-8 text-center text-gray-500">Loading...</div>;

    const activeTranslation = (isTranslated && selectedLanguage !== 'original' && translatedCache[actualIndex]?.[selectedLanguage]) || null;
    const isCurrentRtl = Boolean(isTranslated && selectedLanguage !== 'original' && isRTL(selectedLanguage));
    const displayQuestionText = activeTranslation?.question || q.question;
    const displayExplanationText = activeTranslation?.explanation || q.explanation;


    const currentOptions = optionsOrder[actualIndex] || [];
    const progressPercentage = retryMode
        ? (wrongQuestionIndices.length > 0 ? ((currentQuestion + 1) / wrongQuestionIndices.length) * 100 : 0)
        : (quiz.questions.length > 0 ? ((currentQuestion + 1) / quiz.questions.length) * 100 : 0);

    const hiddenOptsForCurrent = hiddenOptions[actualIndex] || [];
    const currentAnswer = answers[actualIndex];
    const isMatchingQuestion = q.type === 'matching';
    const matchingPairCount = isMatchingQuestion
        ? q.matchingPairs?.length || (typeof q.correctAnswer === 'object' && q.correctAnswer !== null ? Object.keys(q.correctAnswer).length : 0)
        : 0;
    const hasCompleteAnswer = currentAnswer !== undefined && currentAnswer !== null && (
        !isMatchingQuestion || (typeof currentAnswer === 'object' && Object.keys(currentAnswer).length >= matchingPairCount)
    ) && (
        q.type !== 'text' || (typeof currentAnswer === 'string' && currentAnswer.trim().length > 0)
    );

    const isCurrentQuestionSubmitted = Boolean(
        hasCompleteAnswer && submittedQuestions[actualIndex]
    );

    const isReviewModeSubmitted = Boolean(
        isReviewMode &&
        isCurrentQuestionSubmitted
    );

    const isEffectiveCorrect = isReviewModeSubmitted
        ? (questionCorrectness[actualIndex] !== undefined
            ? questionCorrectness[actualIndex]
            : (isCurrentAnswerCorrect || checkComplexAnswer(q, currentAnswer)))
        : false;

    // Helper functions for UI
    const getPowerUpIcon = (type: string, sizeClass = "w-4 h-4") => {
        switch (type) {
            case 'hint': return <Lightbulb className={sizeClass} />;
            case 'time': return <Clock className={sizeClass} />;
            case 'skip': return <Target className={sizeClass} />;
            case 'shield': return <Shield className={sizeClass} />;
            case 'auto_pair': return <Link2 className={sizeClass} />;
            case 'lock_step': return <ListOrdered className={sizeClass} />;
            case 'letter_reveal': return <Type className={sizeClass} />;
            case 'code_hint': return <Code className={sizeClass} />;
            default: return <Zap className={sizeClass} />;
        }
    };

    const currentQuestionType: 'compiler' | 'ordering' | 'matching' | 'code-output' | 'text' | 'multiple-choice' =
        q.isCompiler || q.type === 'compiler'
            ? 'compiler'
            : q.type === 'ordering'
                ? 'ordering'
                : q.type === 'matching'
                    ? 'matching'
                    : q.type === 'code-output'
                        ? 'code-output'
                        : q.type === 'text'
                            ? 'text'
                            : 'multiple-choice';

    const isPowerUpRelevantForType = (powerUpType: string, qType: typeof currentQuestionType) => {
        if (powerUpType === 'skip') return true;
        if (powerUpType === 'time') return !countUpTimer && !isUnlimitedTime;
        if (powerUpType === 'hint') return qType === 'multiple-choice' && Boolean(q.options && q.options.length > 2);
        if (powerUpType === 'auto_pair') return qType === 'matching';
        if (powerUpType === 'lock_step') return qType === 'ordering';
        if (powerUpType === 'letter_reveal') return qType === 'text' || qType === 'code-output';
        if (powerUpType === 'code_hint') return qType === 'compiler';
        return false;
    };

    const currentQuestionTypeLabel = (() => {
        switch (currentQuestionType) {
            case 'matching': return tx('Matching', 'توصيل');
            case 'ordering': return tx('Ordering', 'ترتيب');
            case 'text': return tx('Short Answer', 'إجابة نصية');
            case 'code-output': return tx('Code Output', 'مخرجات الكود');
            case 'compiler': return tx('Code Compiler', 'كتابة كود');
            default: return tx('Multiple Choice', 'اختيار من متعدد');
        }
    })();

    return (
        <div className={`w-full transition-colors flex flex-col font-sans relative ${embedded
            ? 'h-full bg-transparent'
            : isBento
                ? 'h-dvh bg-[#f5f3ec] p-0 sm:p-3 md:p-4 overflow-hidden'
                : 'h-dvh bg-[#0a0908] p-0 sm:p-3 md:p-4 overflow-hidden'
            } ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
            
            {!embedded && <AmbientBackground />}

            {/* Animations defined globally */}
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 15px currentColor; }
                    50% { box-shadow: 0 0 30px currentColor; }
                }
                @keyframes powerup-fly {
                    0% { transform: scale(0.5) translateY(50px); opacity: 0; }
                    20% { transform: scale(1.5) translateY(-20px); opacity: 1; }
                    80% { transform: scale(1.2) translateY(-40px); opacity: 1; }
                    100% { transform: scale(2) translateY(-100px); opacity: 0; }
                }
                .powerup-animation {
                    animation: powerup-fly 1.5s ease-out forwards;
                }
                @keyframes shake {
                    0%,100% { transform: translateX(0); }
                    25% { transform: translateX(-8px); }
                    75% { transform: translateX(8px); }
                }
                .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
                
                /* Hide scrollbar for cleaner look */
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                @keyframes screen-glow-in {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                .animate-glow-in {
                    animation: screen-glow-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes quiz-red-alert {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); transform: scale(1); }
                    50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); transform: scale(1.06); }
                }
                .animate-quiz-red-alert {
                    animation: quiz-red-alert 1.25s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
            `}</style>

            {/* Screen-wide Correct/Incorrect Glow Overlay */}
            {questionSubmitted && !delayedValidation && isReviewMode && (
                <div 
                    className={`fixed inset-0 pointer-events-none z-40 animate-glow-in ${
                        isCurrentAnswerCorrect 
                            ? 'bg-green-500/[0.02] dark:bg-green-500/[0.01] shadow-[inset_0_0_80px_rgba(34,197,94,0.15)] dark:shadow-[inset_0_0_120px_rgba(34,197,94,0.12)] border-[8px] border-green-500/10 dark:border-green-500/5' 
                            : 'bg-red-500/[0.02] dark:bg-red-500/[0.01] shadow-[inset_0_0_80px_rgba(239,68,68,0.15)] dark:shadow-[inset_0_0_120px_rgba(239,68,68,0.12)] border-[8px] border-red-500/10 dark:border-red-500/5'
                    }`}
                />
            )}



            {/* Proctored Exam Fullscreen Warning / Entry Banner */}
            {(quiz.requireFullscreen || quiz.isProctored) && !isFullscreenActive && !(user?.role === 'admin' || user?.isAdmin) && (
                <div className="bg-red-600 text-white px-4 py-2 text-xs font-black uppercase tracking-wider flex items-center justify-between gap-3 z-40 shadow-lg animate-pulse">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-amber-300" />
                        <span>🔒 Proctored Exam Mode — Fullscreen is required for this assessment.</span>
                    </div>
                    <button
                        type="button"
                        onClick={enterFullscreen}
                        className="px-3 py-1 bg-white text-indigo-900 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-white/90 transition shadow cursor-pointer"
                    >
                        Enter Fullscreen
                    </button>
                </div>
            )}

            {/* Fullscreen Exit Warning Modal */}
            {showFullscreenWarning && !(user?.role === 'admin' || user?.isAdmin) && (
                <div className="app-dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className={`app-dialog-panel app-dialog-panel--padded rounded-2xl p-6 sm:p-8 max-w-md w-full space-y-4 text-center ${
                        isBento
                            ? 'bg-white text-black border-[3px] border-black shadow-[8px_8px_0px_#000]'
                            : 'bg-[#141210] text-[#f5f3ec] border-2 border-[#fb7185] shadow-[0_8px_0_#050504]'
                    }`}>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
                            isBento
                                ? 'bg-[#fecdd3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#fb7185]/15 text-[#fb7185] border border-[#fb7185]/35'
                        }`}>
                            <Shield className="w-8 h-8" />
                        </div>
                        <h3 className={`text-xl font-black uppercase tracking-tight ${isBento ? 'text-black' : 'text-[#fb7185]'}`}>
                            Security Alert: Fullscreen Exit
                        </h3>
                        <p className={`text-xs leading-relaxed font-medium ${isBento ? 'text-slate-700' : 'text-[#d6d0c7]'}`}>
                            You exited fullscreen mode. This event has been recorded in the exam security audit log. Please return to fullscreen immediately to avoid penalties.
                        </p>
                        <button
                            type="button"
                            onClick={enterFullscreen}
                            className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-[#ff6b6b] hover:bg-[#ff5252] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#fb7185] hover:bg-[#fda4af] text-[#0a0908] shadow-[0_3px_0_#050504]'
                            }`}
                        >
                            Return to Fullscreen
                        </button>
                    </div>
                </div>
            )}

            {/* Power-up Screen Overlay Animation */}
            {activePowerUpAnimation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className={`text-6xl powerup-animation drop-shadow-2xl`}>
                        {activePowerUpAnimation === 'hint' && '💡'}
                        {activePowerUpAnimation === 'skip' && '⏭️'}
                        {activePowerUpAnimation === 'time' && '⏳'}
                    </div>
                </div>
            )}

            {/* --- ELEVATED QUIZ BOARD CONTAINER (Edge-to-edge on mobile, crisp Bento/Noir card on sm+) --- */}
            <div className={`w-full max-w-7xl 2xl:max-w-[1536px] mx-auto flex-1 min-h-0 flex flex-col rounded-none sm:rounded-3xl overflow-hidden relative z-10 transition-all ${
                isBento
                    ? 'border-0 sm:border-[3px] border-black bg-white sm:shadow-[8px_8px_0px_#000]'
                    : 'border-0 sm:border-[1.5px] border-[#2e2924] bg-[#141210] sm:shadow-[0_12px_0_#050504]'
            }`}>
                {/* --- TOP BAR (Inside Card Header) --- */}
                {!embedded && (
                    <header className={`sticky top-0 flex-none h-13 sm:h-16 landscape:h-12 lg:landscape:h-16 flex items-center justify-between gap-2 px-3 sm:px-6 z-30 ${
                        isBento
                            ? 'bg-white border-b-[2.5px] border-black'
                            : 'bg-[#141210] border-b border-[#2e2924]'
                    }`}>
                    <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
                        <button
                            type="button"
                            aria-label="Go back"
                            onClick={onBack}
                            className={`flex items-center justify-center p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047] active:translate-y-0.5'
                                    : 'bg-[#1c1917] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2e2924] hover:border-[#bef264]'
                            }`}
                        >
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider truncate max-w-[155px] sm:max-w-xs px-2.5 py-1 rounded-lg ${
                                isBento
                                    ? 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'text-[#bef264] bg-[#192211] border border-[#bef264]/40'
                            }`}>
                                {retryMode ? '⚠ Retry' : quiz.title}
                            </span>
                            {(user?.role === 'admin' || user?.isAdmin) && (
                                <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shrink-0 ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/40'
                                }`}>
                                    <span>🛡️</span> Admin
                                </span>
                            )}
                            {poolProgress && (
                                <span className={`hidden md:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg font-tabular shrink-0 ${
                                    isBento
                                        ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#111c22] text-[#bae6fd] border border-[#bae6fd]/40'
                                }`}>
                                    Bank: {poolProgress.seenCount}/{poolProgress.totalCount} ({poolProgress.percentage}%)
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {/* Shop Button */}
                        {!hidePowerUps && (
                            <button
                                onClick={() => setShowShop(true)}
                                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-white hover:bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5'
                                        : 'bg-[#1c1917] hover:bg-[#231e0f] text-[#fde047] border border-[#fde047]/35'
                                }`}
                            >
                                <ShoppingBag className="w-4 h-4" />
                                <span className="hidden sm:inline">{tx('Store', 'المتجر')}</span>
                            </button>
                        )}
                        
                        {/* Timer */}
                        {(() => {
                            const urgent = !countUpTimer && timeLeft < 30 && !isUnlimitedTime;
                            return (
                                <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-tabular font-black border transition-all ${
                                    urgent
                                        ? isBento
                                            ? 'bg-[#fda4af] border-2 border-black text-black shadow-[2px_2px_0px_#000] animate-pulse'
                                            : 'bg-[#2a1418] border-[#fb7185]/60 text-[#fb7185] animate-pulse'
                                        : isBento
                                            ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#0e0d0b] border-[#2e2924] text-[#f5f3ec]'
                                    }`}>
                                    <Clock className={`w-3.5 h-3.5 ${urgent ? 'animate-spin' : isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                    <span className="tabular-nums text-xs sm:text-sm">
                                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                </header>
            )}

            {/* --- HORIZONTAL SPLIT LAYOUT --- */}
            <div className={`flex-1 min-h-0 flex flex-col landscape:flex-row lg:flex-row w-full ${embedded ? '' : 'z-10'} overflow-y-auto landscape:overflow-hidden lg:overflow-hidden`}>
                {/* --- LEFT SIDE: Question Context --- */}
                <div className={`w-full shrink-0 landscape:shrink lg:shrink ${
                    isMatchingQuestion
                        ? 'landscape:w-[38%] lg:w-[38%] xl:w-[35%]'
                        : 'landscape:w-1/2 lg:w-1/2'
                } h-auto landscape:h-full lg:h-full flex flex-col ${
                    isBento
                        ? 'bg-white border-b-2 landscape:border-b-0 landscape:border-r-[2.5px] lg:border-r-[2.5px] border-black'
                        : 'bg-[#141210] border-b landscape:border-b-0 landscape:border-r lg:border-r border-[#2e2924]'
                } relative z-20 landscape:sticky landscape:top-0 lg:sticky lg:top-0 landscape:overflow-y-auto lg:overflow-y-auto no-scrollbar`}>
                    
                    <div className="w-full flex flex-col flex-1">
                        {/* Progress & Action Header (Clean 2-row stack on mobile so NOTHING overlaps, single row on sm+) */}
                        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 sm:px-6 lg:px-7 pt-3 pb-2">
                            {/* Row 1 (mobile): Question Counter + Progress % */}
                            <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider ${isBento ? 'text-black/65' : 'text-[#a8a29e]'}`}>
                                        {tx('Question', 'سؤال')}
                                    </span>
                                    <span className={`font-tabular text-sm sm:text-base font-black ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                        {currentQuestion + 1} / {quiz.questions.length}
                                    </span>
                                </div>
                                <div className={`sm:hidden font-tabular font-black text-xs px-2 py-0.5 rounded-md ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border border-black'
                                        : 'bg-[#192211] text-[#bef264] border border-[#bef264]/40'
                                }`}>
                                    {Math.round(progressPercentage)}%
                                </div>
                            </div>

                            {/* Row 2 (mobile) / Right Side (sm+): AI Coach + Flag + Jump Menu + Desktop % */}
                            <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 w-full sm:w-auto">
                                {/* AI Coach Button Group (Quota & Coin Top-up) */}
                                <div className="inline-flex items-center shrink-0">
                                    <button
                                        type="button"
                                        onClick={flipToClue}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                                            isClueFlipped
                                                ? isBento
                                                    ? 'rounded-xl bg-[#fdba74] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'rounded-xl bg-[#fde047] text-[#0a0908]'
                                                : isBento
                                                    ? 'rounded-l-xl bg-white hover:bg-[#fef9c3] text-black border-2 border-black border-r-0 shadow-[2px_2px_0px_#000] active:translate-y-0.5'
                                                    : 'rounded-l-xl bg-[#1c1917] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2e2924] border-r-0'
                                        }`}
                                        title={
                                            isClueFlipped
                                                ? 'Flip back to question'
                                                : `Get AI clue (${aiCoachUsesLeft} hint${aiCoachUsesLeft === 1 ? '' : 's'} remaining)`
                                        }
                                    >
                                        <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isClueFlipped ? 'text-black rotate-12' : isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                        <span className="text-[11px] sm:text-xs font-black">{isClueFlipped ? tx('Question', 'السؤال') : tx('AI Coach', 'مساعد')}</span>
                                        {!isClueFlipped && (
                                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none ${
                                                aiCoachUsesLeft > 0
                                                    ? isBento
                                                        ? 'bg-[#fdba74] text-black border border-black'
                                                        : 'bg-[#192211] text-[#bef264] border border-[#bef264]/40'
                                                    : isBento
                                                        ? 'bg-[#fda4af] text-black border border-black animate-pulse'
                                                        : 'bg-[#2a1418] text-[#fb7185] border border-[#fb7185]/45 animate-pulse'
                                            }`}>
                                                {aiCoachUsesLeft}
                                            </span>
                                        )}
                                    </button>
                                    {!isClueFlipped && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                sounds.playClick();
                                                setShowAICoachBuyModal(true);
                                            }}
                                            className={`flex items-center gap-0.5 px-2 py-1.5 rounded-r-xl text-xs font-black transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                                                isBento
                                                    ? 'bg-[#fde047] hover:bg-[#facc15] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5'
                                                    : 'bg-[#231e0f] hover:bg-[#2e2713] text-[#fde047] border border-[#fde047]/40'
                                            }`}
                                            title="Add more AI hints with coins"
                                        >
                                            <Coins className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                                            <span className="text-[10px] font-black">+</span>
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                    {/* Flag Button */}
                                    <button
                                        type="button"
                                        onClick={toggleCurrentQuestionFlag}
                                        aria-label={flaggedQuestions[actualIndex] ? 'Remove question flag' : 'Flag question for review'}
                                        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                                            flaggedQuestions[actualIndex]
                                                ? isBento
                                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5'
                                                    : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/55'
                                                : isBento
                                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fef9c3] active:translate-y-0.5'
                                                    : 'bg-[#1c1917] hover:bg-[#24201c] text-[#a8a29e] hover:text-[#f5f3ec] border border-[#2e2924]'
                                        }`}
                                        title={flaggedQuestions[actualIndex] ? 'Question is flagged' : 'Flag question'}
                                    >
                                        <Flag className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${
                                            flaggedQuestions[actualIndex]
                                                ? isBento ? 'fill-black text-black' : 'fill-[#fde047] text-[#fde047]'
                                                : isBento ? 'text-black' : 'text-[#a8a29e]'
                                        }`} />
                                        <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider">
                                            {flaggedQuestions[actualIndex] ? tx('Flagged', 'مميز') : tx('Flag', 'تمييز')}
                                        </span>
                                    </button>

                                    {/* Questions Menu Button */}
                                    <button
                                        type="button"
                                        onClick={() => setShowQuestionMenu(prev => !prev)}
                                        aria-expanded={showQuestionMenu}
                                        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer whitespace-nowrap ${
                                            redAlertActualSet.size > 0
                                                ? isBento
                                                    ? 'bg-[#fecdd3] text-black border-2 border-red-600 shadow-[2px_2px_0px_#dc2626] animate-quiz-red-alert'
                                                    : 'bg-[#2a1418] text-[#fb7185] border-[#fb7185] animate-quiz-red-alert'
                                                : isBento
                                                    ? 'bg-white text-black border-2 border-black hover:bg-[#bae6fd] shadow-[2px_2px_0px_#000]'
                                                    : 'bg-[#1c1917] hover:bg-[#24201c] text-[#f5f3ec] border-[#2e2924] hover:border-[#bef264]'
                                        }`}
                                    >
                                        <List className="w-4 h-4 shrink-0" />
                                        <span className="hidden sm:inline">{tx('Questions', 'الأسئلة')}</span>
                                        {redAlertActualSet.size > 0 && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none bg-red-600 text-white">
                                                <span className="relative flex h-1.5 w-1.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
                                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                                                </span>
                                                {redAlertActualSet.size}
                                            </span>
                                        )}
                                    </button>

                                    <div className={`hidden sm:block font-tabular font-black text-xs sm:text-sm ${isBento ? 'text-black' : 'text-[#bef264]'}`}>
                                        {Math.round(progressPercentage)}%
                                    </div>
                                </div>
                            </div>
                            {showQuestionMenu && (
                                <div className={`absolute right-3 left-3 sm:left-auto sm:right-6 lg:right-7 top-full mt-1.5 z-50 sm:w-72 rounded-2xl p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[5px_5px_0px_#000]'
                                        : 'bg-[#141210] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504] text-[#f5f3ec]'
                                }`}>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-xs font-black uppercase tracking-wider">
                                            {tx('Jump to question', 'انتقل لسؤال')}
                                        </span>
                                        <span className={`text-[10px] font-bold ${isBento ? 'text-black/65' : 'text-[#a8a29e]'}`}>
                                            {activePositions.length - incompletePositions.length}/{activePositions.length} {tx('done', 'تم')} · {Object.values(flaggedQuestions).filter(Boolean).length} {tx('flagged', 'مميز')}
                                        </span>
                                    </div>

                                    {redAlertActualSet.size > 0 && (
                                        <div className={`mb-2.5 p-2 rounded-xl flex items-center justify-between gap-2 text-[11px] font-black ${
                                            isBento
                                                ? 'bg-[#fecdd3] text-black border-2 border-red-600'
                                                : 'bg-[#2a1418] text-[#fda4af] border border-[#fb7185]/60'
                                        }`}>
                                            <span className="flex items-center gap-1.5 min-w-0 truncate">
                                                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 animate-pulse" />
                                                <span className="truncate">
                                                    {tx(
                                                        `${redAlertActualSet.size} missed — tap red`,
                                                        `${redAlertActualSet.size} ناقص — اضغط الأحمر`
                                                    )}
                                                </span>
                                            </span>
                                            {incompletePositions.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => goToQuestion(incompletePositions[0])}
                                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 cursor-pointer transition-all ${
                                                        isBento
                                                            ? 'bg-red-600 text-white border border-black hover:bg-red-700'
                                                            : 'bg-[#fb7185] text-[#0a0908] hover:bg-[#fda4af]'
                                                    }`}
                                                >
                                                    {tx(`Go Q${incompletePositions[0] + 1} →`, `روح س${incompletePositions[0] + 1} →`)}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1">
                                        {activePositions.map((position) => {
                                            const menuActualIndex = getActualQuestionIndex(position);
                                            const qObj = quiz.questions[menuActualIndex];
                                            const isMenuComplete = isQuestionAnswerComplete(qObj, answers[menuActualIndex]);
                                            const isFlagged = flaggedQuestions[menuActualIndex];
                                            const isMenuSub = Boolean(isMenuComplete && submittedQuestions[menuActualIndex]);
                                            const showReviewColors = isReviewMode && isMenuSub;
                                            const isMenuCorrect = showReviewColors ? questionCorrectness[menuActualIndex] : undefined;
                                            const isRedAlert = redAlertActualSet.has(menuActualIndex);
                                            const isCurrent = position === currentQuestion;

                                            return (
                                                <button
                                                    type="button"
                                                    key={menuActualIndex}
                                                    onClick={() => goToQuestion(position)}
                                                    className={`relative h-9 rounded-lg text-xs font-black border-2 cursor-pointer transition-all ${
                                                        isCurrent
                                                            ? isBento
                                                                ? 'bg-[#bef264] !text-black border-black shadow-[2px_2px_0px_#000]'
                                                                : 'bg-[#bef264] text-[#0a0908] border-[#bef264]'
                                                            : isRedAlert
                                                                ? isBento
                                                                    ? 'bg-[#fecdd3] !text-black border-red-600 ring-2 ring-red-500/60 shadow-[2px_2px_0px_#dc2626] animate-quiz-red-alert'
                                                                    : 'bg-[#2a1418] text-[#fb7185] border-[#fb7185] ring-2 ring-red-500/40 animate-quiz-red-alert'
                                                                : showReviewColors
                                                                    ? isMenuCorrect
                                                                        ? isBento
                                                                            ? 'bg-[#dcfce7] !text-black border-black hover:bg-[#bbf7d0]'
                                                                            : 'bg-[#192211] text-[#bef264] border-[#bef264]/60'
                                                                        : isBento
                                                                            ? 'bg-[#fecdd3] !text-black border-black hover:bg-[#fda4af]'
                                                                            : 'bg-[#2a1418] text-[#fb7185] border-[#fb7185]/60'
                                                                    : isMenuSub || (!isReviewMode && isMenuComplete)
                                                                        ? isBento
                                                                            ? 'bg-[#bae6fd] !text-black border-black font-black hover:bg-[#7dd3fc]'
                                                                            : 'bg-[#111c22] text-[#bae6fd] border-[#bae6fd]/55 hover:border-[#bae6fd]'
                                                                        : isBento
                                                                            ? 'bg-[#faf8f2] !text-black border-black hover:bg-[#fef9c3]'
                                                                            : 'bg-[#1c1917] text-[#a8a29e] border-[#2e2924] hover:border-[#bef264]/60 hover:text-[#f5f3ec]'
                                                    }`}
                                                >
                                                    {position + 1}
                                                    {isRedAlert && (
                                                        <span className="absolute -left-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                                                            <span className="relative inline-flex items-center justify-center rounded-full h-3.5 w-3.5 bg-red-600 text-[9px] font-black text-white border border-black/30">
                                                                !
                                                            </span>
                                                        </span>
                                                    )}
                                                    {showReviewColors ? (
                                                        <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isMenuCorrect ? (isBento ? 'bg-black' : 'bg-[#bef264]') : (isBento ? 'bg-black' : 'bg-[#fb7185]')}`} />
                                                    ) : (isMenuSub || (!isReviewMode && isMenuComplete)) ? (
                                                        <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isBento ? 'bg-black' : 'bg-[#bae6fd]'}`} />
                                                    ) : null}
                                                    {isFlagged && <Flag className={`absolute -right-1.5 -top-1.5 w-3.5 h-3.5 ${isBento ? 'text-black fill-[#fde047]' : 'text-[#fde047] fill-[#fde047]'}`} />}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {allQuestionsSubmitted && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowQuestionMenu(false);
                                                handleQuizComplete(false);
                                            }}
                                            disabled={isSubmitting}
                                            className={`mt-2.5 w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                                isBento
                                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                            }`}
                                        >
                                            <span>{tx('Submit Quiz Now', 'تسليم الكويز دلوقتي')}</span>
                                            <CheckCircle className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Progress Bar Line */}
                        <div className={`px-3.5 sm:px-6 lg:px-7 pb-2.5 sm:pb-4 border-b ${isBento ? 'border-black/15' : 'border-[#2e2924]'}`}>
                            <div className={`w-full rounded-full overflow-hidden flex ${
                                isBento
                                    ? 'h-2.5 bg-[#faf8f2] border-2 border-black'
                                    : 'h-1.5 bg-[#0e0d0b] border border-[#2e2924]'
                            }`}>
                                <div className={`h-full rounded-full transition-all duration-300 ${isBento ? 'bg-[#bef264]' : 'bg-[#bef264]'}`} style={{ width: `${progressPercentage}%` }}></div>
                            </div>
                        </div>

                        {/* Real-time Language & Translation Toolbar */}
                        <div className="px-3.5 sm:px-6 lg:px-7 pt-2.5 sm:pt-3.5">
                            <QuestionTranslatorBar
                                currentLanguage={selectedLanguage}
                                isTranslating={isTranslating}
                                isTranslated={isTranslated && selectedLanguage !== 'original'}
                                autoTranslate={autoTranslate}
                                onSelectLanguage={handleSelectLanguage}
                                onToggleOriginal={handleToggleOriginal}
                                onToggleAutoTranslate={handleToggleAutoTranslate}
                            />
                        </div>

                        {/* Question Content */}
                        <div
                            dir={isCurrentRtl ? 'rtl' : 'ltr'}
                            className={`flex-1 landscape:overflow-y-auto px-3.5 sm:px-6 lg:px-7 pb-3 sm:pb-7 flex flex-col pt-3 sm:pt-5 landscape:pt-3 lg:landscape:pt-5 no-scrollbar ${shakeError ? 'animate-shake' : ''}`}>
                            
                            {/* Translated Indicator Badge */}
                            {isTranslated && selectedLanguage !== 'original' && (
                                <div className={`flex items-center gap-1.5 text-xs font-bold mb-2 ${isBento ? 'text-black' : 'text-[#bef264]'}`}>
                                    <Globe className="w-3.5 h-3.5 shrink-0" />
                                    <span>Translated to {getLanguageByCode(selectedLanguage).name} ({getLanguageByCode(selectedLanguage).nativeName})</span>
                                </div>
                            )}

                            {/* 3D Flipping Question / Clue Card (Compact natural height on mobile so options appear immediately!) */}
                            <div className="perspective-1000 mb-3 sm:mb-6 w-full">
                                <div
                                    className={`preserve-3d paper-flip-spring relative w-full ${
                                        isClueFlipped ? 'paper-flipped' : ''
                                    }`}
                                >
                                    {/* FRONT FACE: Question Prompt Box */}
                                    <div className={`backface-hidden w-full ${isClueFlipped ? 'min-h-[240px]' : 'min-h-0'} sm:min-h-[220px] lg:min-h-[260px] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 flex flex-col ${
                                        isReviewModeSubmitted ? 'justify-start' : 'justify-between'
                                    } transition-all overflow-hidden relative ${
                                        theme === 'bento'
                                            ? 'border-[3px] border-black bg-white shadow-[5px_5px_0px_#000] text-black'
                                            : 'border-[1.5px] border-[#2e2924] bg-[#0e0d0b] shadow-[0_5px_0_#050504] text-[#f5f3ec]'
                                    } ${isClueFlipped ? 'pointer-events-none' : ''}`}>
                                        {!isReviewModeSubmitted ? (
                                            <div className="flex flex-col h-full justify-between gap-3 sm:gap-4">
                                                {/* Themed Meta Header inside Question Box */}
                                                <div className={`flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 shrink-0 ${
                                                    theme === 'bento'
                                                        ? 'border-b-2 border-black'
                                                        : 'border-b border-[#2e2924]'
                                                } ${isCurrentRtl ? 'flex-row-reverse' : ''}`}>
                                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                                        <span className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                                            theme === 'bento'
                                                                ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/40'
                                                        }`}>
                                                            {theme === 'dark' && <span className="w-1.5 h-1.5 rounded-full bg-[#bef264] animate-pulse" />}
                                                            Q{currentQuestion + 1}
                                                        </span>
                                                        <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider ${
                                                            theme === 'bento'
                                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                : 'bg-[#192211] text-[#bef264] border border-[#bef264]/40'
                                                        }`}>
                                                            {q.points || 10} PTS
                                                        </span>
                                                    </div>
                                                    <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${
                                                        theme === 'bento'
                                                            ? 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                            : 'bg-[#111c22] text-[#bae6fd] border border-[#bae6fd]/40'
                                                    }`}>
                                                        {getQuestionTypeLabel(q)}
                                                    </span>
                                                </div>

                                                {/* Question Prompt Text */}
                                                <div className="flex-1 flex items-center py-1 sm:py-3">
                                                    <h2 className={`text-lg sm:text-2xl lg:text-3xl font-black tracking-tight leading-snug lg:leading-normal w-full ${
                                                        theme === 'bento'
                                                            ? 'text-black'
                                                            : 'text-[#f5f3ec]'
                                                    } ${isCurrentRtl ? 'text-right' : 'text-left'}`}>
                                                        <MathRenderer text={displayQuestionText} dir={isCurrentRtl ? 'rtl' : 'ltr'} />
                                                    </h2>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col h-full justify-between gap-3 animate-in fade-in duration-300">
                                                {/* Minimized Question Prompt */}
                                                <div className={`pb-2.5 shrink-0 ${
                                                    theme === 'bento'
                                                        ? 'border-b-[2.5px] border-black'
                                                        : 'border-b border-[#2e2924]'
                                                } ${isCurrentRtl ? 'text-right' : 'text-left'}`}>
                                                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">
                                                        <span className={theme === 'bento' ? 'text-black font-black' : 'text-[#bef264] font-black'}>
                                                            Question {currentQuestion + 1} • {getQuestionTypeLabel(q)}
                                                        </span>
                                                    </div>
                                                    <h3 className={`text-sm sm:text-base font-extrabold leading-snug ${
                                                        theme === 'bento' ? 'text-black' : 'text-[#f5f3ec]'
                                                    }`}>
                                                        <MathRenderer text={displayQuestionText} dir={isCurrentRtl ? 'rtl' : 'ltr'} />
                                                    </h3>
                                                </div>

                                                {/* Explanation & Result Block */}
                                                <div className={`flex-1 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all flex flex-col justify-between ${
                                                    theme === 'bento'
                                                        ? isEffectiveCorrect
                                                            ? 'bg-[#dcfce7] border-[2.5px] border-black shadow-[3px_3px_0px_#000] text-black'
                                                            : 'bg-[#fecdd3] border-[2.5px] border-black shadow-[3px_3px_0px_#000] text-black'
                                                        : isEffectiveCorrect
                                                            ? 'bg-[#192211] border border-[#bef264]/45 text-[#f5f3ec]'
                                                            : 'bg-[#2a1418] border border-[#fb7185]/45 text-[#f5f3ec]'
                                                }`}>
                                                    <div className="flex items-center gap-2.5 sm:gap-3 mb-2 shrink-0">
                                                        <div className={`p-1.5 sm:p-2 rounded-xl shrink-0 ${
                                                            theme === 'bento'
                                                                ? isEffectiveCorrect
                                                                    ? 'bg-[#bef264] text-black border-2 border-black font-black'
                                                                    : 'bg-[#fda4af] text-black border-2 border-black font-black'
                                                                : isEffectiveCorrect ? 'bg-[#bef264] text-[#0a0908]' : 'bg-[#fb7185] text-[#0a0908]'
                                                        }`}>
                                                            {isEffectiveCorrect ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5"/> : <XCircle className="w-4 h-4 sm:w-5 sm:h-5"/>}
                                                        </div>
                                                        <h4 className="text-sm sm:text-lg font-black tracking-tight text-inherit">
                                                            {isEffectiveCorrect ? 'Excellent! Correct Answer' : 'Incorrect Answer'}
                                                        </h4>
                                                    </div>

                                                    {displayExplanationText ? (
                                                        <div className={`pt-2.5 border-t ${
                                                            theme === 'bento' ? 'border-black/20' : 'border-[#2e2924]'
                                                        } overflow-y-auto no-scrollbar`}>
                                                            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest opacity-80 mb-1.5">
                                                                <Lightbulb className={`w-3.5 h-3.5 ${theme === 'bento' ? 'text-black' : 'text-[#fde047]'}`}/>
                                                                <span>Explanation</span>
                                                            </div>
                                                            <MathRenderer text={displayExplanationText} className={`text-xs sm:text-sm leading-relaxed font-bold opacity-90 ${isCurrentRtl ? 'text-right' : 'text-left'}`} />
                                                        </div>
                                                    ) : (
                                                        <div className={`pt-2 border-t text-xs italic ${theme === 'bento' ? 'border-black/15 text-black/60' : 'border-[#2e2924] text-[#a8a29e]'}`}>
                                                            No explanation provided for this question.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* BACK FACE: Revealed Socratic Clue Card (Themed for Bento & Noir Dark) */}
                                    <div className={`backface-hidden rotate-y-180 absolute inset-0 w-full h-full rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col justify-between transition-all overflow-hidden ${
                                        theme === 'bento'
                                            ? 'border-[3px] border-black bg-[#fff7ed] text-black shadow-[5px_5px_0px_#000]'
                                            : 'border-[1.5px] border-[#2e2924] bg-[#141210] text-[#f5f3ec] shadow-[0_5px_0_#050504]'
                                    } ${!isClueFlipped ? 'pointer-events-none' : ''}`}>
                                        {/* Top row: Badges & Action Buttons (wraps cleanly on mobile) */}
                                        <div className={`flex flex-wrap items-center justify-between gap-2 shrink-0 pb-2.5 ${
                                            theme === 'bento' ? 'border-b-2 border-black/20' : 'border-b border-[#2e2924]'
                                        }`} onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider truncate ${
                                                    theme === 'bento'
                                                        ? 'bg-[#fdba74] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                                        : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/40'
                                                }`}>
                                                    {getClueLevelTitle(inlineClueLevel)}
                                                </span>
                                                <div className="hidden sm:flex items-center gap-1 shrink-0">
                                                    {[1, 2, 3, 4].map(lvl => (
                                                        <div
                                                            key={lvl}
                                                            className={`w-2 h-2 rounded-full transition-all ${
                                                                theme === 'bento'
                                                                    ? lvl <= inlineClueLevel ? 'bg-black border border-black' : 'bg-white border border-black'
                                                                    : lvl <= inlineClueLevel ? 'bg-[#bef264]' : 'bg-[#2e2924]'
                                                            }`}
                                                        />
                                                    ))}
                                                </div>

                                                {/* Hints Remaining Badge & Coin Top-up */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black whitespace-nowrap ${
                                                        isBento
                                                            ? 'bg-white text-black border border-black'
                                                            : 'bg-[#1c1917] text-[#a8a29e] border border-[#2e2924]'
                                                    }`}>
                                                        {aiCoachUsesLeft} left
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            sounds.playClick();
                                                            setShowAICoachBuyModal(true);
                                                        }}
                                                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black cursor-pointer transition-all active:translate-y-0.5 whitespace-nowrap ${
                                                            isBento
                                                                ? 'bg-[#fde047] hover:bg-[#facc15] text-black border border-black'
                                                                : 'bg-[#231e0f] hover:bg-[#2e2713] text-[#fde047] border border-[#fde047]/35'
                                                        }`}
                                                        title="Add more AI hints with coins"
                                                    >
                                                        <Coins className={`w-2.5 h-2.5 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                                                        <span>+</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={handleNextInlineClue}
                                                    disabled={isInlineClueLoading}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider active:translate-y-0.5 cursor-pointer disabled:opacity-50 transition-all whitespace-nowrap ${
                                                        theme === 'bento'
                                                            ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                                            : 'bg-[#1c1917] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2e2924]'
                                                    }`}
                                                    title="Get a different clue from a new angle"
                                                >
                                                    <RefreshCw className={`w-3 h-3 ${isInlineClueLoading ? 'animate-spin' : ''}`} />
                                                    <span className="hidden sm:inline">Another Clue</span>
                                                    <span className="sm:hidden">Next</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={flipToClue}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider active:translate-y-0.5 cursor-pointer transition-all whitespace-nowrap ${
                                                        theme === 'bento'
                                                            ? 'bg-[#fed7aa] hover:bg-[#fdba74] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                                            : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                                    }`}
                                                    title="Return to Question"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    <span>Flip</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Clue Content */}
                                        <div className="flex-1 flex items-center py-2.5 sm:py-3 overflow-y-auto no-scrollbar">
                                            {isInlineClueLoading ? (
                                                <div className={`flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-pulse ${isBento ? 'text-black' : 'text-[#bef264]'}`}>
                                                    <Sparkles className="w-4 h-4 animate-spin shrink-0" />
                                                    <span>Consulting AI Coach for a spoiler-free pointer...</span>
                                                </div>
                                            ) : (
                                                <p className={`text-sm sm:text-base md:text-lg font-bold sm:font-extrabold leading-relaxed ${
                                                    theme === 'bento' ? 'text-black' : 'text-[#f5f3ec]'
                                                }`}>
                                                    {inlineClue || '💡 Think about the distinguishing behavior and rules that set this concept apart.'}
                                                </p>
                                            )}
                                        </div>

                                        {/* Bottom row */}
                                        <div className={`flex items-center justify-between pt-2 text-[11px] sm:text-xs font-bold shrink-0 ${
                                            theme === 'bento'
                                                ? 'border-t-2 border-black/15 text-black/70'
                                                : 'border-t border-[#2e2924] text-[#a8a29e]'
                                        }`}>
                                            <span className="flex items-center gap-1">
                                                🔒 Zero-Spoiler<span className="hidden sm:inline"> Guaranteed</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={flipToClue}
                                                className={`font-black cursor-pointer hover:underline ${isBento ? 'text-black' : 'text-[#bef264]'}`}
                                            >
                                                <span className="hidden sm:inline">Return to Question</span>
                                                <span className="sm:hidden">Question</span> ↩
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Image */}
                            {q.imageUrl && (
                                <img
                                    src={q.imageUrl}
                                    alt="Reference"
                                    loading="lazy"
                                    decoding="async"
                                    className={`w-full rounded-2xl mb-8 object-cover max-h-64 ${isBento ? 'border-2 border-black shadow-[3px_3px_0px_#000]' : 'shadow-lg border border-gray-100 dark:border-[#f5f3ec]/10'}`}
                                />
                            )}

                            {/* Audio / Video Question Prompt */}
                            {(q.audioUrl || q.videoUrl) && (
                                <MediaPromptPlayer
                                    audioUrl={q.audioUrl}
                                    videoUrl={q.videoUrl}
                                    videoTimestamp={q.videoTimestamp}
                                />
                            )}

                            {/* Code Snippet Preview */}
                            {q.codeSnippet && q.type !== 'code-output' && (
                                <div className={`rounded-2xl overflow-hidden mb-4 sm:mb-6 ${
                                    isBento
                                        ? 'bg-[#faf8f2] border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-[#0e0d0b] border border-[#2e2924]'
                                }`}>
                                    <div className={`flex items-center gap-2 px-3.5 py-2.5 border-b ${isBento ? 'border-black bg-white' : 'border-[#2e2924] bg-[#141210]'}`}>
                                        <div className="w-2.5 h-2.5 rounded-full bg-[#fb7185] border border-black/20"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-[#fde047] border border-black/20"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-[#bef264] border border-black/20"></div>
                                    </div>
                                    <pre className={`p-3.5 sm:p-5 font-mono text-xs sm:text-sm lg:text-base whitespace-pre-wrap font-medium overflow-x-auto leading-relaxed ${
                                        isBento ? 'text-black' : 'text-[#bef264]'
                                    }`}>
                                        {q.codeSnippet}
                                    </pre>
                                </div>
                            )}
                            
                            {/* Helpful instructions for matching questions */}
                            {isMatchingQuestion && !isReviewModeSubmitted && (
                                <div className={`mt-2 sm:mt-4 p-3 sm:p-4 rounded-2xl border transition-all ${
                                    isBento
                                        ? 'bg-[#fef9c3] border-2 border-black text-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-[#192211] border-[#bef264]/35 text-[#f5f3ec]'
                                }`}>
                                    <div className="flex items-start gap-2.5 text-xs font-bold leading-relaxed">
                                        <span className="text-base select-none">💡</span>
                                        <div>
                                            <span className="font-black uppercase tracking-wider block mb-0.5">How to match:</span>
                                            <span>Click a term in <strong className="font-black">Column A</strong>, then click its corresponding definition in <strong className="font-black">Column B</strong>. Click "Linked" to disconnect a pair.</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>

                {/* --- RIGHT SIDE: Answer Options --- */}
                <div className={`w-full shrink-0 landscape:shrink lg:shrink ${
                    isMatchingQuestion
                        ? 'landscape:w-[62%] lg:w-[62%] xl:w-[65%]'
                        : 'landscape:w-1/2 lg:w-1/2'
                } h-auto landscape:h-full lg:h-full flex flex-col ${
                    isBento 
                        ? 'bg-[#f5f3ec]' 
                        : 'bg-[#0a0908]'
                } relative z-10 landscape:overflow-y-auto lg:overflow-y-auto no-scrollbar`}>
                    <div
                        role="radiogroup"
                        aria-label={`Options for Question ${currentQuestion + 1}`}
                        className="flex-1 w-full px-3.5 sm:px-6 lg:px-7 py-3 sm:py-6 flex flex-col justify-start gap-2.5 sm:gap-3.5 no-scrollbar"
                    >
                        {(revealedPowerUpClues[actualIndex] || []).length > 0 && (
                            <div className="space-y-2">
                                {(revealedPowerUpClues[actualIndex] || []).map((clue, cIdx) => (
                                    <div
                                        key={`${clue.type}-${cIdx}`}
                                        className={`p-3 rounded-2xl text-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
                                            isBento
                                                ? 'bg-[#fef9c3] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                                : 'bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[10px] mb-1">
                                            {getPowerUpIcon(clue.type, 'w-3.5 h-3.5')}
                                            <span>{clue.title}</span>
                                        </div>
                                        {clue.text && <div className="font-bold leading-snug">{clue.text}</div>}
                                        {clue.code && (
                                            <pre className="mt-1.5 p-2.5 rounded-xl bg-slate-900 text-lime-300 font-mono text-[11px] overflow-x-auto">
                                                <code>{clue.code}</code>
                                            </pre>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {q.isCompiler ? (
                            <Suspense fallback={<div className="animate-spin w-8 h-8 border-4 border-indigo-500 rounded-full border-t-transparent mx-auto"></div>}>
                                <div className={`h-[400px] rounded-2xl overflow-hidden ${
                                    theme === 'bento'
                                        ? 'border-[2.5px] border-black shadow-[4px_4px_0px_#000] bg-white'
                                        : theme === 'dark'
                                            ? 'border border-indigo-500/30 bg-[#070a12] shadow-2xl'
                                            : 'border border-slate-200 bg-white shadow-lg'
                                }`}>
                                    <CompilerQuestion
                                        initialCode={q.compilerConfig?.initialCode}
                                        language={q.compilerConfig?.language || 'javascript'}
                                        onChange={(code) => handleAnswer(code)}
                                        readOnly={isSubmitting || isReviewModeSubmitted}
                                    />
                                </div>
                            </Suspense>
                        ) : q.type === 'ordering' ? (
                            <OrderingQuestion
                                items={activeTranslation?.orderingItems || q.orderingItems || q.options || []}
                                correctOrder={q.orderingItems || q.options}
                                submitted={isReviewModeSubmitted}
                                onChange={(ordered) => handleAnswer(ordered)}
                                readOnly={isSubmitting || isReviewModeSubmitted}
                            />
                        ) : q.type === 'matching' ? (
                            <MatchingQuestion
                                pairs={activeTranslation?.matchingPairs || q.matchingPairs || []}
                                submitted={isReviewModeSubmitted}
                                onChange={(matches) => handleAnswer(matches)}
                                readOnly={isSubmitting || isReviewModeSubmitted}
                            />
                        ) : q.type === 'code-output' ? (
                            <CodeOutputQuestion
                                codeSnippet={q.codeSnippet}
                                options={activeTranslation?.options || q.options}
                                optionOrder={optionsOrder[actualIndex]}
                                correctAnswer={q.correctAnswer as string | number}
                                submitted={isReviewModeSubmitted}
                                userAnswer={answers[actualIndex] as string | number | undefined}
                                onChange={(val) => handleAnswer(val)}
                                readOnly={isSubmitting || isReviewModeSubmitted}
                            />
                        ) : q.type === 'text' ? (
                            <TextQuestion
                                value={typeof answers[actualIndex] === 'string' ? answers[actualIndex] as string : (answers[actualIndex] !== undefined ? String(answers[actualIndex]) : '')}
                                correctAnswer={q.correctAnswer}
                                submitted={isReviewModeSubmitted}
                                isCorrect={isEffectiveCorrect}
                                onChange={(val) => handleAnswer(val)}
                                onSubmit={isReviewMode ? submitQuestion : () => nextQuestion()}
                                hideSubmitButton={true}
                                readOnly={isSubmitting || isReviewModeSubmitted}
                            />
                        ) : (
                            currentOptions.map((originalIndex, visualIndex) => {
                                // If user used a hint to hide this
                                if (hiddenOptsForCurrent.includes(originalIndex)) return null;

                                const rawOption = q.options![originalIndex];
                                const option = (activeTranslation?.options && activeTranslation.options[originalIndex] !== undefined)
                                    ? activeTranslation.options[originalIndex]
                                    : rawOption;
                                const isSelected = answers[actualIndex] === originalIndex;
                                const isCorrectOption = originalIndex === q.correctAnswer;
                                const showCorrect = isReviewModeSubmitted && !isEffectiveCorrect && isCorrectOption;
                                const showWrong = isReviewModeSubmitted && !isEffectiveCorrect && isSelected;
                                const showSuccess = isReviewModeSubmitted && isEffectiveCorrect && isSelected;

                                const letters = ['A', 'B', 'C', 'D', 'E'];
                                const label = letters[visualIndex] || (visualIndex + 1);

                                // Dynamic classes based on state and theme (Pure Bento + Noir Studio)
                                const baseClass = theme === 'bento'
                                    ? "group relative flex items-center p-3 sm:p-4 min-h-[48px] sm:min-h-[54px] rounded-2xl cursor-pointer transition-all duration-150 w-full text-left font-bold border-[2.5px] border-black focus-visible:outline-none select-none"
                                    : "group relative flex items-center p-3 sm:p-4 min-h-[48px] sm:min-h-[54px] rounded-2xl cursor-pointer transition-all duration-200 w-full text-left border-[1.5px] border-[#2e2924] shadow-[0_3px_0_#050504] font-semibold focus-visible:ring-2 focus-visible:ring-[#bef264] focus-visible:outline-none select-none";
                                
                                let stateClass = theme === 'bento'
                                    ? "bg-white text-black shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000]"
                                    : "bg-[#141210] hover:bg-[#1c1917] hover:border-[#bef264]/60 text-[#f5f3ec] hover:-translate-y-0.5 active:translate-y-0";
                                
                                let textClass = theme === 'bento' ? "text-black font-bold" : "text-[#f5f3ec] font-semibold";
                                let badgeClass = theme === 'bento'
                                    ? "bg-[#faf8f2] text-black border-2 border-black font-black"
                                    : "bg-[#0e0d0b] text-[#a8a29e] border border-[#2e2924] group-hover:bg-[#bef264] group-hover:text-[#0a0908] group-hover:border-[#bef264] font-black transition-all";
                                
                                if (showSuccess) {
                                    stateClass = theme === 'bento'
                                        ? "bg-[#bef264] text-black border-[2.5px] border-black shadow-[4px_4px_0px_#000] scale-[1.01] z-10"
                                        : "bg-[#192211] border-[#bef264] text-[#bef264] shadow-[0_4px_0_#050504] scale-[1.01] z-10";
                                    badgeClass = theme === 'bento' ? "bg-white text-black border-2 border-black font-black" : "bg-[#bef264] text-[#0a0908] font-black";
                                    textClass = theme === 'bento' ? "text-black font-black" : "text-[#bef264] font-bold";
                                } else if (showWrong) {
                                    stateClass = theme === 'bento'
                                        ? "bg-[#fda4af] text-black border-[2.5px] border-black shadow-[4px_4px_0px_#000] scale-[1.01] z-10"
                                        : "bg-[#2a1418] border-[#fb7185] text-[#fda4af] shadow-[0_4px_0_#050504] scale-[1.01] z-10";
                                    badgeClass = theme === 'bento' ? "bg-white text-black border-2 border-black font-black" : "bg-[#fb7185] text-[#0a0908] font-black";
                                    textClass = theme === 'bento' ? "text-black font-black" : "text-[#fda4af] font-bold";
                                } else if (showCorrect) {
                                    stateClass = theme === 'bento'
                                        ? "bg-[#bef264] text-black border-[2.5px] border-black shadow-[3px_3px_0px_#000]"
                                        : "bg-[#192211] border-[#bef264]/70 text-[#bef264]";
                                    badgeClass = theme === 'bento' ? "bg-white text-black border-2 border-black font-black" : "bg-[#bef264] text-[#0a0908] font-black";
                                    textClass = theme === 'bento' ? "text-black font-black" : "text-[#bef264] font-bold";
                                } else if (isSelected) {
                                    stateClass = theme === 'bento'
                                        ? "bg-[#fde047] text-black border-[2.5px] border-black shadow-[4px_4px_0px_#000] scale-[1.01] z-10"
                                        : "bg-[#192211] border-[#bef264] text-[#f5f3ec] shadow-[0_4px_0_#050504] scale-[1.01] z-10";
                                    badgeClass = theme === 'bento' ? "bg-black text-white border-2 border-black font-black" : "bg-[#bef264] text-[#0a0908] border border-[#bef264] font-black";
                                    textClass = theme === 'bento' ? "text-black font-black" : "text-[#f5f3ec] font-bold";
                                }

                                return (
                                    <button
                                        key={originalIndex}
                                        role="radio"
                                        aria-checked={isSelected}
                                        aria-label={`Option ${label}: ${option}`}
                                        tabIndex={0}
                                        onClick={() => handleAnswer(originalIndex)}
                                        disabled={isSubmitting || isReviewModeSubmitted}
                                        className={`${baseClass} ${stateClass} disabled:opacity-75 disabled:cursor-default`}>
                                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-extrabold text-sm mr-3 sm:mr-4 transition-colors shrink-0 ${badgeClass} font-tabular`}>
                                            {showSuccess || showCorrect ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : showWrong ? <XCircle className="w-4 h-4 sm:w-5 sm:h-5"/> : label}
                                        </div>
                                        <MathRenderer text={option} className={`flex-1 text-sm sm:text-base text-left leading-relaxed ${textClass}`} dir={isCurrentRtl ? 'auto' : undefined} />
                                        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                                            <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isBento ? 'bg-black/10 text-black border border-black/20' : 'bg-black/5 dark:bg-white/10 text-slate-400'}`}>
                                                {visualIndex + 1}
                                            </kbd>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Screen Reader Live Announcements */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                Question {currentQuestion + 1} of {quiz.questions.length}: {q.question}
            </div>

            {/* Bottom Action Footer (Compact, thumb-friendly & safe-area aware on mobile) */}
            <div className={`sticky bottom-0 flex-none px-3 sm:px-6 pt-2.5 sm:pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] z-20 w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pointer-events-auto ${
                isBento
                    ? 'bg-white border-t-[2.5px] border-black'
                    : 'bg-[#141210] border-t border-[#2e2924]'
            }`}>
                {!isMobileDevice && (
                    <div className={`hidden lg:flex font-medium items-center gap-2 px-3.5 py-2 rounded-xl text-xs ${
                        isBento
                            ? 'bg-slate-100 text-black border-2 border-black font-bold'
                            : 'text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5'
                    }`}>
                        {q && q.options && !q.isCompiler && (!q.type || q.type === 'multiple-choice') && (
                            <>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-tabular ${isBento ? 'border border-black bg-white text-black' : 'border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'}`}>1-{q.options.length}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isBento ? 'border border-black bg-white text-black' : 'border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'}`}>A-{String.fromCharCode(65 + q.options.length - 1)}</span> 
                                <span>select,</span> 
                            </>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isBento ? 'border border-black bg-white text-black' : 'border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'}`}>←</span> <span>back,</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isBento ? 'border border-black bg-white text-black' : 'border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'}`}>Enter ↵</span> <span>advance</span>
                        <button
                            type="button"
                            onClick={() => setShowKeyboardShortcuts(true)}
                            className={`ml-2 text-xs font-bold flex items-center gap-1 cursor-pointer hover:underline ${
                                isBento ? 'text-black font-black' : 'text-[#bef264]'
                            }`}
                        >
                            <Keyboard className="w-3.5 h-3.5" />
                            <span>Shortcuts</span>
                        </button>
                    </div>
                )}

                {/* Offline Warning Pill */}
                {!isOnline && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                        isBento
                            ? 'bg-[#fde047] border-2 border-black text-black'
                            : 'bg-[#231e0f] border border-[#fde047]/35 text-[#fde047]'
                    }`}>
                        <WifiOff className="w-3.5 h-3.5" />
                        <span>Offline</span>
                    </div>
                )}
                
                {/* Unsubmitted / Missing Question Alert Banner */}
                {unsubmittedWarning && (
                    <div className={`absolute -top-13 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-2 z-30 animate-in fade-in slide-in-from-bottom-2 max-w-[94%] ${
                        isBento
                            ? 'bg-[#fecdd3] text-black border-2 border-red-600 shadow-[3px_3px_0px_#dc2626]'
                            : 'bg-[#2a1418] text-[#fda4af] border border-[#fb7185] shadow-lg'
                    }`}>
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-500 animate-pulse" />
                        <span className="truncate">{unsubmittedWarning}</span>
                        {incompletePositions.length > 0 && (
                            <button
                                type="button"
                                onClick={() => goToQuestion(incompletePositions[0])}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 cursor-pointer ${
                                    isBento
                                        ? 'bg-red-600 text-white border border-black'
                                        : 'bg-[#fb7185] text-[#0a0908]'
                                }`}
                            >
                                {tx(`Q${incompletePositions[0] + 1} →`, `س${incompletePositions[0] + 1} →`)}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setUnsubmittedWarning(null)}
                            className="ml-0.5 font-black hover:opacity-70 cursor-pointer text-sm leading-none shrink-0"
                            aria-label="Dismiss warning"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Answer Feedback Pill (Review Mode only) */}
                {isReviewMode && isReviewModeSubmitted && (
                    <div className={`transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 z-10 ${
                        isMatchingQuestion
                            ? 'landscape:absolute landscape:left-[38%] landscape:-translate-x-1/2 lg:absolute lg:left-[38%] xl:left-[35%] lg:-translate-x-1/2'
                            : 'landscape:absolute landscape:left-1/2 landscape:-translate-x-1/2 lg:absolute lg:left-1/2 lg:-translate-x-1/2 sm:absolute sm:left-1/2 sm:-translate-x-1/2'
                    } flex items-center justify-center pointer-events-none`}>
                        <div className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl pointer-events-auto ${
                            isEffectiveCorrect
                                ? isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#bef264] text-[#0a0908] border border-[#bef264]'
                                : isBento
                                    ? 'bg-[#fecdd3] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#fb7185] text-[#0a0908] border border-[#fb7185]'
                        }`} role="status" aria-live="assertive">
                            {isEffectiveCorrect ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-current" /> : <XCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-current" />}
                            <span className="font-black text-xs sm:text-sm whitespace-nowrap">
                                {isEffectiveCorrect ? tx('Correct answer!', 'إجابة صحيحة!') : tx('Not quite. Check the highlighted answer.', 'مش دي الصح — شوف الإجابة المتعلمة.')}
                            </span>
                        </div>
                    </div>
                )}

                {(() => {
                    const nextMissedPos = incompletePositions.find(pos => pos !== currentQuestion);
                    const directSubmitReady = allQuestionsSubmitted && !isLastQuestion;

                    return (
                        <div className="flex w-full sm:w-auto items-center gap-2 sm:gap-2.5 pointer-events-auto">
                            {/* Previous Question Button */}
                            <button
                                type="button"
                                onClick={previousQuestion}
                                disabled={currentQuestion === 0 || isSubmitting}
                                className={`min-h-[42px] px-3 sm:px-4 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#fef9c3] active:translate-y-0.5 disabled:opacity-40'
                                        : 'bg-[#1c1917] hover:bg-[#24201c] disabled:opacity-40 text-[#f5f3ec] border border-[#2e2924]'
                                }`}
                            >
                                <span>←</span>
                                <span className="sm:hidden">{tx('Prev', 'سابق')}</span>
                                <span className="hidden sm:inline">{tx('Previous', 'السابق')}</span>
                            </button>

                            {/* Unified Review Mode (Submit -> same button becomes Next/Finish) vs Direct Quiz Mode (Next -> Finish) */}
                            {isReviewMode ? (
                                !isCurrentQuestionSubmitted ? (
                                    <button
                                        type="button"
                                        onClick={submitQuestion}
                                        disabled={!hasCompleteAnswer || isSubmitting}
                                        className={`flex-1 sm:flex-none min-h-[42px] px-3.5 sm:px-6 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                            isBento
                                                ? 'bg-[#fde047] hover:bg-[#facc15] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-y-0.5 disabled:opacity-40'
                                                : 'bg-[#fde047] hover:bg-[#fef08a] disabled:opacity-40 text-[#0a0908] shadow-[0_3px_0_#050504]'
                                        }`}
                                    >
                                        <span className="sm:hidden">{tx('Submit', 'تسليم')}</span>
                                        <span className="hidden sm:inline">{tx('Submit Answer', 'تسليم الإجابة')}</span>
                                        <CheckCircle className="w-4 h-4 shrink-0" />
                                    </button>
                                ) : !isLastQuestion ? (
                                    <button
                                        type="button"
                                        onClick={nextQuestion}
                                        disabled={isSubmitting}
                                        className={`flex-1 sm:flex-none min-h-[42px] px-3.5 sm:px-6 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                            directSubmitReady
                                                ? isBento
                                                    ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-[#1c1917] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2e2924]'
                                                : isBento
                                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-y-0.5'
                                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                                        }`}
                                    >
                                        <span className="sm:hidden">{tx('Next', 'التالي')}</span>
                                        <span className="hidden sm:inline">{tx('Next Question', 'السؤال الجاي')}</span>
                                        <span>→</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleQuizComplete(false)}
                                        disabled={isSubmitting}
                                        className={`flex-1 sm:flex-none min-h-[42px] px-4 sm:px-6 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                            allQuestionsSubmitted
                                                ? isBento
                                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-y-0.5'
                                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                                                : isBento
                                                    ? 'bg-[#fecdd3] hover:bg-[#fda4af] text-black border-2 border-red-600 shadow-[3px_3px_0px_#dc2626]'
                                                    : 'bg-[#fb7185] hover:bg-[#fda4af] text-[#0a0908] shadow-[0_3px_0_#050504]'
                                        }`}
                                    >
                                        <span>
                                            {isSubmitting
                                                ? tx('Submitting...', 'جاري التسليم...')
                                                : allQuestionsSubmitted
                                                    ? tx('Finish Quiz', 'إنهاء الكويز')
                                                    : tx(`Finish (${incompletePositions.length} left)`, `إنهاء (${incompletePositions.length} متبقي)`)}
                                        </span>
                                        <Target className="w-4 h-4 shrink-0" />
                                    </button>
                                )
                            ) : !isLastQuestion ? (
                                <button
                                    type="button"
                                    onClick={nextQuestion}
                                    disabled={isSubmitting}
                                    className={`flex-1 sm:flex-none min-h-[42px] px-3.5 sm:px-6 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                        directSubmitReady
                                            ? isBento
                                                ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#1c1917] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2e2924]'
                                            : isBento
                                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-y-0.5'
                                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                                    }`}
                                >
                                    <span className="sm:hidden">{tx('Next', 'التالي')}</span>
                                    <span className="hidden sm:inline">{tx('Next Question', 'السؤال الجاي')}</span>
                                    <span>→</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleQuizComplete(false)}
                                    disabled={isSubmitting}
                                    className={`flex-1 sm:flex-none min-h-[42px] px-4 sm:px-6 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                        allQuestionsSubmitted
                                            ? isBento
                                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-y-0.5'
                                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                                            : isBento
                                                ? 'bg-[#fecdd3] hover:bg-[#fda4af] text-black border-2 border-red-600 shadow-[3px_3px_0px_#dc2626]'
                                                : 'bg-[#fb7185] hover:bg-[#fda4af] text-[#0a0908] shadow-[0_3px_0_#050504]'
                                    }`}
                                >
                                    <span>
                                        {isSubmitting
                                            ? tx('Submitting...', 'جاري التسليم...')
                                            : allQuestionsSubmitted
                                                ? tx('Submit Quiz', 'تسليم الكويز')
                                                : tx(`Submit (${incompletePositions.length} left)`, `تسليم (${incompletePositions.length} ناقص)`)}
                                    </span>
                                    <Target className="w-4 h-4 shrink-0" />
                                </button>
                            )}

                            {/* Direct Submit Quiz Button when all questions are ready (from ANY question without returning to last!) */}
                            {directSubmitReady && (
                                <button
                                    type="button"
                                    onClick={() => handleQuizComplete(false)}
                                    disabled={isSubmitting}
                                    title={tx('All questions complete! Submit directly now.', 'كل الأسئلة خلصت! سلّم مباشرة دلوقتي.')}
                                    className={`flex-1 sm:flex-none min-h-[42px] px-3.5 sm:px-5 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap animate-in fade-in zoom-in-95 ${
                                        isBento
                                            ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-y-0.5'
                                            : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                                    }`}
                                >
                                    <span className="sm:hidden">{tx('Submit Quiz', 'تسليم')}</span>
                                    <span className="hidden sm:inline">{tx('Submit Quiz', 'تسليم الكويز')}</span>
                                    <CheckCircle className="w-4 h-4 shrink-0" />
                                </button>
                            )}

                            {/* Quick Next Missed Jump Button when fixing forgotten questions */}
                            {hasAttemptedFinish && !allQuestionsSubmitted && !isLastQuestion && nextMissedPos !== undefined && (
                                <button
                                    type="button"
                                    onClick={() => goToQuestion(nextMissedPos)}
                                    disabled={isSubmitting}
                                    className={`min-h-[42px] px-3 sm:px-4 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0 animate-quiz-red-alert ${
                                        isBento
                                            ? 'bg-[#fecdd3] hover:bg-[#fda4af] text-black border-2 border-red-600 shadow-[2px_2px_0px_#dc2626]'
                                            : 'bg-[#2a1418] hover:bg-[#3a1b20] text-[#fb7185] border border-[#fb7185]'
                                    }`}
                                >
                                    <span>{tx(`Missed Q${nextMissedPos + 1} →`, `س${nextMissedPos + 1} ناقص →`)}</span>
                                </button>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div> {/* End ELEVATED QUIZ BOARD CONTAINER */}

            {/* --- SHOP OVERLAY (Feature 9) --- */}
            {showShop && (
                <div className={`app-dialog-overlay app-dialog-overlay--edge fixed inset-0 z-[100] flex items-center justify-end transition-all animate-in fade-in ${
                    isBento ? 'bg-black/60' : 'bg-[#050504]/80'
                }`}>
                    <div className={`app-dialog-panel app-dialog-panel--structured w-full max-w-md h-full sm:h-auto flex flex-col animate-in slide-in-from-right sm:slide-in-from-bottom-8 ${
                        isBento
                            ? 'bg-white border-[3px] border-black sm:rounded-2xl shadow-[8px_8px_0px_#000]'
                            : 'bg-[#141210] text-[#f5f3ec] sm:rounded-2xl border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504]'
                    }`}>
                        
                        {/* Shop Header */}
                        <div className={`app-dialog-header p-6 flex justify-between items-center ${
                            isBento
                                ? 'bg-[#fde047] border-b-[2.5px] border-black'
                                : 'border-b border-[#2e2924] bg-[#1a1714]'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                    isBento
                                        ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                                        : 'bg-[#fde047]/15 border border-[#fde047]/35 text-[#fde047]'
                                }`}>
                                    <ShoppingBag className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className={`text-xl font-black leading-none ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>Item Shop</h2>
                                    <p className={`text-xs font-bold mt-1 ${isBento ? 'text-black/70' : 'text-[#a8a29e]'}`}>Mid-Quiz Boosters</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowShop(false)}
                                className={`p-2 rounded-xl transition shrink-0 cursor-pointer ${
                                    isBento
                                        ? 'border-2 border-black bg-white text-black hover:bg-[#fed7aa] shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                        : 'bg-[#1c1917] border border-[#2e2924] hover:border-[#bef264] text-[#a8a29e] hover:text-[#f5f3ec]'
                                }`}
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Balance */}
                        <div className="p-6 pb-4 text-center">
                            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl ${
                                isBento
                                    ? 'bg-[#fef08a] border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#1e1b13] border border-[#fde047]/35'
                            }`}>
                                <Coins className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                                <span className={`text-3xl font-black ${isBento ? 'text-black' : 'text-[#fde047]'}`}>{localCoins}</span>
                            </div>
                        </div>

                        {/* Owned Inventory Quick Access inside Store (Filtered by Question Type) */}
                        {localPowerUps.some(p => p.quantity > 0 && isPowerUpRelevantForType(p.type, currentQuestionType)) && (
                            <div className={`px-6 pb-4 border-b ${isBento ? 'border-black' : 'border-[#2e2924]'}`}>
                                <div className={`text-xs font-black uppercase tracking-wider mb-2 text-start ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                    {tx('Your Inventory', 'أدواتك الجاهزة')}
                                </div>
                                <div className="flex gap-2 flex-wrap justify-start">
                                    {localPowerUps.map(p => p.quantity > 0 && isPowerUpRelevantForType(p.type, currentQuestionType) && (
                                        <button
                                            key={p.type}
                                            onClick={() => {
                                                handleUseOwnedItem(p.type);
                                                setShowShop(false);
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                                                isBento
                                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                                    : 'bg-[#bef264] text-[#0a0908] hover:bg-[#d2fa8a]'
                                            }`}
                                            title={`Use ${p.type}`}
                                        >
                                            {getPowerUpIcon(p.type, "w-3.5 h-3.5")}
                                            <span className="capitalize">{p.type.replace('_', ' ')}</span>
                                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${isBento ? 'bg-black text-white' : 'bg-[#0a0908] text-[#bef264]'}`}>{p.quantity}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Shop Items List (Filtered by Current Question Type) */}
                        <div className={`app-dialog-body app-dialog-body-spaced flex flex-col gap-3.5 ${isBento ? 'bg-white' : 'bg-transparent'}`}>
                            <div className="flex items-center justify-between gap-2">
                                <span className={`text-[11px] font-black uppercase tracking-wider ${isBento ? 'text-black/70' : 'text-[#a8a29e]'}`}>
                                    {tx('Items for this question type:', 'أدوات مناسبة لنوع السؤال ده:')}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-[#bae6fd]/15 text-[#bae6fd] border border-[#bae6fd]/35'
                                }`}>
                                    {currentQuestionTypeLabel}
                                </span>
                            </div>
                            {[
                                { type: 'hint', apiId: 'smart-hint', name: tx('50/50 Hint', 'حذف إجابتين (50/50)'), desc: tx('Disables two wrong answers to boost your chances.', 'بيشيل إجابتين غلط عشان يسهل الاختيار.'), price: 75, icon: 'hint' },
                                { type: 'auto_pair', apiId: 'auto-pair', name: tx('Auto-Match Pair', 'توصيلة مضمونة'), desc: tx('Reveals one guaranteed correct pair for this Matching question.', 'بيكشفلك توصيلة صح مضمونة في سؤال التوصيل.'), price: 80, icon: 'auto_pair' },
                                { type: 'lock_step', apiId: 'order-lock', name: tx('Order Anchor', 'تثبيت خطوة'), desc: tx('Reveals the exact position of the next step in this Ordering question.', 'بيقولك مكان الخطوة الصح في سؤال الترتيب.'), price: 80, icon: 'lock_step' },
                                { type: 'letter_reveal', apiId: 'letter-reveal', name: tx('Answer Clue', 'تلميح الإجابة'), desc: tx('Reveals starting characters and length for Text / Code Output.', 'بيظهرلك أول حروف وطول الإجابة الصح.'), price: 65, icon: 'letter_reveal' },
                                { type: 'code_hint', apiId: 'code-hint', name: tx('Starter Snippet', 'كود مساعد للبداية'), desc: tx('Reveals a helpful starter snippet for this Compiler challenge.', 'بيظهرلك جزء من الكود كبداية للمسألة.'), price: 90, icon: 'code_hint' },
                                { type: 'skip', apiId: 'skip-question', name: tx('Skip Pass', 'تخطي السؤال'), desc: tx('Automatically marks current question correct and advances.', 'بيعدي السؤال ده ويحسبه صح تلقائياً.'), price: 150, icon: 'skip' },
                                { type: 'time', apiId: 'time-freeze', name: tx('Time Boost', 'وقت إضافي (+30 ث)'), desc: tx('Add 30 extra seconds to the clock!', 'بيزود 30 ثانية زيادة على المؤقت!'), price: 100, icon: 'time' }
                            ]
                                .filter(item => isPowerUpRelevantForType(item.type, currentQuestionType))
                                .map(item => {
                                const ownedQuantity = localPowerUps.find(p => p.type === item.type)?.quantity || 0;
                                const canAfford = localCoins >= item.price;
                                const apiId = item.apiId;

                                return (
                                    <div key={item.type} className={`flex flex-row items-center gap-4 p-4 rounded-2xl relative overflow-hidden transition-all ${
                                        isBento
                                            ? 'bg-[#f5f3ec] border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000]'
                                            : 'bg-[#1a1714] border border-[#2e2924] group hover:border-[#bef264]/60'
                                    }`}>
                                        
                                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                                            isBento
                                                ? 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#fde047] group-hover:border-[#fde047]/50'
                                        }`}>
                                            {getPowerUpIcon(item.icon, "w-7 h-7")}
                                        </div>
                                        
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h3 className={`font-black text-base leading-tight mb-0.5 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>{item.name}</h3>
                                                {ownedQuantity > 0 && (
                                                    <span className={`px-2 py-0.5 rounded-lg font-black text-[10px] uppercase tracking-wider ${
                                                        isBento
                                                            ? 'bg-[#bef264] text-black border border-black shadow-[1px_1px_0px_#000]'
                                                            : 'bg-[#bef264]/15 text-[#bef264] border border-[#bef264]/35'
                                                    }`}>
                                                        Owned: {ownedQuantity}
                                                    </span>
                                                )}
                                            </div>
                                            <div className={`text-xs pr-2 leading-relaxed ${isBento ? 'text-gray-700 font-medium' : 'text-[#a8a29e]'}`}>{item.desc}</div>
                                            
                                            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                                                <span className={`font-black flex items-center gap-1.5 text-sm ${
                                                    isBento
                                                        ? 'text-black'
                                                        : canAfford ? 'text-[#fde047]' : 'text-[#78716c]'
                                                }`}>
                                                    <Coins className={`w-4 h-4 ${isBento ? 'text-yellow-500 fill-yellow-400' : 'text-[#fde047]'}`}/> {item.price}
                                                </span>
                                                <div className="flex gap-2 ml-auto">
                                                    {ownedQuantity > 0 && (
                                                        <button 
                                                            onClick={() => {
                                                                handleUseOwnedItem(item.type);
                                                                setShowShop(false);
                                                            }}
                                                            className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                                                isBento
                                                                    ? 'bg-[#bae6fd] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                    : 'bg-[#bae6fd] hover:bg-[#e0f2fe] text-[#0a0908]'
                                                            }`}
                                                        >
                                                            Use
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => {
                                                            handleBuyItem(item.type, item.price, apiId);
                                                        }}
                                                        disabled={!canAfford}
                                                        className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                                            isBento
                                                                ? canAfford
                                                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                    : 'bg-gray-200 text-gray-400 border-2 border-gray-300 cursor-not-allowed'
                                                                : canAfford
                                                                    ? 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                                                    : 'bg-[#0e0d0b] text-[#78716c] border border-[#2e2924] cursor-not-allowed'
                                                        }`}
                                                    >
                                                        Buy
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* AI Coach Hints Top-Up Modal */}
            {showAICoachBuyModal && (
                <div 
                    className={`app-dialog-overlay fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200 ${
                        isBento ? 'bg-black/60 backdrop-blur-sm' : 'bg-[#050504]/82'
                    }`}
                    onClick={() => setShowAICoachBuyModal(false)}
                >
                    <div 
                        className={`app-dialog-panel app-dialog-panel--structured max-w-md w-full rounded-2xl overflow-hidden transition-all flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 ${
                            isBento
                                ? 'bg-white border-[3px] border-black shadow-[8px_8px_0px_#000] text-black'
                                : 'bg-[#141210] border-[1.5px] border-[#2e2924] text-[#f5f3ec] shadow-[0_8px_0_#050504]'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className={`app-dialog-header p-6 pb-4 flex items-center justify-between border-b ${
                            isBento 
                                ? 'border-b-[2.5px] border-black bg-[#fef08a]' 
                                : 'border-[#2e2924] bg-[#1a1714]'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${
                                    isBento
                                        ? 'bg-[#bef264] border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                                        : 'bg-[#fde047]/15 border border-[#fde047]/35 text-[#fde047]'
                                }`}>
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className={`text-xl font-black leading-tight ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>AI Coach Hints</h2>
                                    <p className={`text-xs font-bold mt-0.5 ${
                                        isBento ? 'text-slate-700' : 'text-[#a8a29e]'
                                    }`}>
                                        Socratic pointers • 0 spoilers
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAICoachBuyModal(false)}
                                className={`p-2 rounded-xl transition-all cursor-pointer ${
                                    isBento
                                        ? 'border-2 border-black bg-white text-black hover:bg-[#fed7aa] shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                        : 'bg-[#1c1917] border border-[#2e2924] hover:border-[#bef264] text-[#a8a29e] hover:text-[#f5f3ec]'
                                }`}
                                aria-label="Close modal"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Balance & Status Banner */}
                        <div className={`app-dialog-toolbar p-5 pb-4 flex flex-col items-center justify-center gap-2 border-b ${
                            isBento
                                ? 'bg-white border-b-2 border-black'
                                : 'bg-[#161411] border-[#2e2924]'
                        }`}>
                            <div className="flex items-center gap-3 w-full justify-between px-1">
                                <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl ${
                                    isBento
                                        ? 'bg-[#fdba74] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#bae6fd]/12 text-[#bae6fd] border border-[#bae6fd]/35'
                                }`}>
                                    <Sparkles className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} />
                                    <span className="text-xs font-black">
                                        {aiCoachUsesLeft} hint{aiCoachUsesLeft === 1 ? '' : 's'} remaining
                                    </span>
                                </div>

                                <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl ${
                                    isBento
                                        ? 'bg-[#fef08a] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#fde047]/12 text-[#fde047] border border-[#fde047]/35'
                                }`}>
                                    <Coins className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                                    <span className="text-xs font-black">{localCoins} Coins</span>
                                </div>
                            </div>

                            {purchaseFeedback && (
                                <div className={`w-full text-center py-1.5 px-3 rounded-lg text-xs font-black animate-in fade-in slide-in-from-top-1 ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black'
                                        : 'bg-[#bef264]/15 text-[#bef264] border border-[#bef264]/35'
                                }`}>
                                    🎉 {purchaseFeedback}
                                </div>
                            )}
                        </div>

                        {/* Hint Packs */}
                        <div className="app-dialog-body app-dialog-body-spaced p-5 pt-3 overflow-y-auto no-scrollbar flex flex-col gap-3">
                            <div className={`text-[11px] font-black uppercase tracking-wider ${
                                isBento ? 'text-black' : 'text-[#fde047]'
                            }`}>
                                Select a Hint Pack
                            </div>

                            {[
                                {
                                    id: 'ai-coach-1',
                                    hints: 1,
                                    price: 25,
                                    title: '+1 AI Coach Hint',
                                    desc: 'Ideal for getting unstuck on the current question',
                                    badge: null
                                },
                                {
                                    id: 'ai-coach-3',
                                    hints: 3,
                                    price: 60,
                                    title: '+3 Hints Bundle',
                                    desc: 'Great value for multi-level progressive clues',
                                    badge: 'Save 15 Coins'
                                },
                                {
                                    id: 'ai-coach-5',
                                    hints: 5,
                                    price: 95,
                                    title: '+5 Hints Master Pack',
                                    desc: 'Maximum guidance across tricky problem sets',
                                    badge: 'Best Value • Save 30'
                                }
                            ].map((pack) => {
                                const canAfford = localCoins >= pack.price;
                                const isBusy = isPurchasingHint === pack.id;

                                return (
                                    <div
                                        key={pack.id}
                                        className={`p-4 rounded-2xl transition-all relative flex flex-col justify-between gap-3 ${
                                            isBento
                                                ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000]'
                                                : 'bg-[#1a1714] border border-[#2e2924] hover:border-[#bef264]/60'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                                                    isBento
                                                        ? 'bg-[#bae6fd] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                                        : 'bg-[#bae6fd]/15 text-[#bae6fd] border border-[#bae6fd]/35'
                                                }`}>
                                                    +{pack.hints}
                                                </div>
                                                <div>
                                                    <h3 className={`font-black text-sm sm:text-base leading-snug ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                                        {pack.title}
                                                    </h3>
                                                    <p className={`text-xs mt-0.5 ${
                                                        isBento ? 'text-slate-600' : 'text-[#a8a29e]'
                                                    }`}>
                                                        {pack.desc}
                                                    </p>
                                                </div>
                                            </div>

                                            {pack.badge && (
                                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${
                                                    isBento
                                                        ? 'bg-[#fef08a] text-black border border-black shadow-[1px_1px_0px_#000]'
                                                        : 'bg-[#fde047]/15 text-[#fde047] border border-[#fde047]/35'
                                                }`}>
                                                    {pack.badge}
                                                </span>
                                            )}
                                        </div>

                                        <div className={`flex items-center justify-between pt-2 border-t ${
                                            isBento ? 'border-black/15' : 'border-[#2e2924]'
                                        }`}>
                                            <div className={`flex items-center gap-1.5 font-black text-sm ${isBento ? 'text-black' : 'text-[#fde047]'}`}>
                                                <Coins className={`w-4 h-4 ${isBento ? 'text-yellow-500' : 'text-[#fde047]'}`} />
                                                <span>{pack.price} Coins</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleBuyAICoachHints(pack.hints, pack.price, pack.id)}
                                                disabled={!canAfford || Boolean(isPurchasingHint)}
                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 active:translate-y-0.5 ${
                                                    isBento
                                                        ? canAfford
                                                            ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                            : 'bg-gray-200 text-gray-400 border-2 border-gray-400'
                                                        : canAfford
                                                            ? 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_2px_0_#050504]'
                                                            : 'bg-[#0e0d0b] text-[#78716c] border border-[#2e2924]'
                                                }`}
                                            >
                                                {isBusy ? (
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                ) : canAfford ? (
                                                    <>
                                                        <Plus className="w-3.5 h-3.5" />
                                                        <span>Get Pack</span>
                                                    </>
                                                ) : (
                                                    <span>Need {pack.price - localCoins} more</span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer Help */}
                        <div className={`app-dialog-footer p-4 text-center text-xs font-bold border-t ${
                            isBento
                                ? 'bg-white border-t-2 border-black text-slate-600'
                                : 'bg-[#11100e] border-[#2e2924] text-[#a8a29e]'
                        }`}>
                            💡 Hints already unlocked on a question can be viewed again for free.
                        </div>
                    </div>
                </div>
            )}

            {/* Resume Prompt Modal */}
            {showResumePrompt && (
                <div className={`app-dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-4 ${
                    isBento ? 'bg-black/60 backdrop-blur-sm' : 'bg-[#050504]/82'
                }`}>
                    <div className={`app-dialog-panel app-dialog-panel--padded p-8 max-w-md w-full animate-in fade-in zoom-in duration-200 ${
                        isBento
                            ? 'bg-white border-[3px] border-black rounded-2xl shadow-[8px_8px_0px_#000] text-black'
                            : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] rounded-2xl shadow-[0_8px_0_#050504]'
                    }`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className={`p-3 rounded-2xl ${
                                isBento
                                    ? 'bg-[#fde047] border-2 border-black shadow-[3px_3px_0px_#000] text-black'
                                    : 'bg-[#fde047]/15 border border-[#fde047]/35 text-[#fde047]'
                            }`}>
                                <Clock className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className={`text-xl font-black ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>Resume Quiz?</h3>
                                <p className={`text-sm mt-0.5 ${isBento ? 'text-gray-600 font-medium' : 'text-[#a8a29e]'}`}>
                                    Unfinished attempt from {savedState ? new Date(savedState.lastUpdated).toLocaleDateString() : ''}
                                </p>
                            </div>
                        </div>

                        <p className={`mb-8 text-sm leading-relaxed ${isBento ? 'text-gray-700 font-medium' : 'text-[#d6d0c7]'}`}>
                            Continue where you left off, or start a fresh attempt from the beginning.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={handleStartNew}
                                className={`flex-1 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-white hover:bg-[#fee2e2] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                        : 'text-[#d6d0c7] bg-[#1c1917] border border-[#2e2924] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                                }`}
                            >
                                Start Over
                            </button>
                            <button
                                onClick={handleResume}
                                className={`flex-1 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                        : 'text-[#0a0908] bg-[#bef264] hover:bg-[#d2fa8a] shadow-[0_3px_0_#050504]'
                                }`}
                            >
                                Resume
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyboard Shortcuts Help Modal */}
            <KeyboardShortcutsModal
                isOpen={showKeyboardShortcuts}
                onClose={() => setShowKeyboardShortcuts(false)}
            />
        </div>
    );
};

export default QuizTaking;
