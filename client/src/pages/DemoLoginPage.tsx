import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Zap,
    RefreshCw,
    AlertCircle,
    ArrowLeft,
    GraduationCap,
    Sparkles,
    User,
    ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, type AppLanguage } from '../context/LanguageContext';
import LanguageToggle from '../components/LanguageToggle';

const DEMO_VISITOR_NAME_KEY = 'demoVisitorName';

const DemoLoginPage: React.FC = () => {
    const { demoLogin } = useAuth();
    const { isBento, theme, setTheme, closeThemeModal } = useTheme();
    const { language, setLanguage, tx } = useLanguage();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const initialRole: 'student' | 'teacher' =
        searchParams.get('role') === 'teacher' ? 'teacher' : 'student';
    const rawTo = searchParams.get('to') || '/';
    const safeDestination = rawTo.startsWith('/') && !rawTo.startsWith('//') ? rawTo : '/';
    const langParam = searchParams.get('lang');
    const requestedLang: AppLanguage =
        langParam === 'ar-EG' || langParam === 'en' ? langParam : language;
    const urlNameParam = (searchParams.get('name') || '').trim().slice(0, 40);

    const [selectedRole, setSelectedRole] = useState<'student' | 'teacher'>(initialRole);
    const [visitorName, setVisitorName] = useState<string>(() => {
        if (urlNameParam) return urlNameParam;
        try {
            return sessionStorage.getItem(DEMO_VISITOR_NAME_KEY) || '';
        } catch {
            return '';
        }
    });
    const [validationError, setValidationError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [launching, setLaunching] = useState<boolean>(Boolean(urlNameParam));
    const [retryTick, setRetryTick] = useState(0);
    const autoLaunchedRef = useRef<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const launchDemo = useCallback(
        async (options: { role: 'student' | 'teacher'; customName?: string }) => {
            setError(null);
            setValidationError(null);
            setLaunching(true);

            try {
                // Ensure first-time theme onboarding modal doesn't cover the demo experience
                try {
                    if (!localStorage.getItem('theme')) {
                        setTheme(theme);
                    }
                } catch {
                    // ignore storage errors
                }
                closeThemeModal();

                if (langParam === 'ar-EG' || langParam === 'en') {
                    await setLanguage(langParam, false);
                }

                const cleanName = (options.customName || '').trim().slice(0, 40);
                try {
                    if (cleanName) {
                        sessionStorage.setItem(DEMO_VISITOR_NAME_KEY, cleanName);
                    } else {
                        sessionStorage.removeItem(DEMO_VISITOR_NAME_KEY);
                    }
                } catch {
                    // ignore storage errors
                }

                await demoLogin({
                    role: options.role,
                    preferredLanguage: requestedLang,
                    name: cleanName || undefined
                });

                sessionStorage.removeItem('suppressRedirectAfterLogin');
                sessionStorage.removeItem('redirectAfterLogin');
                navigate(safeDestination, { replace: true });
            } catch (err) {
                setLaunching(false);
                setError(
                    err instanceof Error
                        ? err.message
                        : tx(
                              'Could not launch live demo session. Please try again.',
                              'مقدرناش نفتح حساب الديمو دلوقتي، جرب تاني.'
                          )
                );
            }
        },
        [closeThemeModal, demoLogin, langParam, navigate, requestedLang, safeDestination, setLanguage, setTheme, theme, tx]
    );

    useEffect(() => {
        // Ensure first-time theme modal doesn't block the Demo Name prompt
        try {
            if (!localStorage.getItem('theme')) {
                setTheme(theme);
            }
        } catch {
            // ignore storage errors
        }
        closeThemeModal();
    }, [closeThemeModal, setTheme, theme]);

    // Auto-launch only when ?name=... is explicitly provided in the share link
    useEffect(() => {
        if (!urlNameParam) return;
        const runKey = `${initialRole}:${requestedLang}:${safeDestination}:${urlNameParam}:${retryTick}`;
        if (autoLaunchedRef.current === runKey) return;
        autoLaunchedRef.current = runKey;

        const timer = window.setTimeout(() => {
            void launchDemo({ role: initialRole, customName: urlNameParam });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [initialRole, launchDemo, requestedLang, retryTick, safeDestination, urlNameParam]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = visitorName.trim();
        if (!trimmed) {
            setValidationError(
                tx('Please enter your name so we can personalize your demo!', 'من فضلك اكتب اسمك عشان نخصصلك تجربة الديمو!')
            );
            inputRef.current?.focus();
            return;
        }
        void launchDemo({ role: selectedRole, customName: trimmed });
    };

    return (
        <div
            className={`min-h-dvh flex items-center justify-center p-4 ${
                isBento
                    ? 'bg-[#f5f3ec] text-black'
                    : 'bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-white'
            }`}
        >
            <div
                className={`w-full max-w-md p-6 sm:p-8 rounded-3xl space-y-5 relative ${
                    isBento
                        ? 'bg-white border-[3px] border-black shadow-[8px_8px_0px_#000]'
                        : 'bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 shadow-2xl'
                }`}
            >
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className={`btn-unstyled inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer px-2.5 py-1.5 rounded-xl transition-colors ${
                            isBento
                                ? 'text-black hover:bg-[#fef9c3] border border-black/20'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{tx('Login', 'الدخول')}</span>
                    </button>
                    <LanguageToggle compact />
                </div>

                <div className="text-center space-y-3">
                    <div
                        className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        }`}
                    >
                        {error ? (
                            <AlertCircle className="w-8 h-8" />
                        ) : launching ? (
                            selectedRole === 'teacher' ? (
                                <GraduationCap className="w-8 h-8 animate-bounce" />
                            ) : (
                                <Zap className="w-8 h-8 animate-pulse" />
                            )
                        ) : (
                            <Sparkles className="w-8 h-8" />
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#fde047] text-black border border-black">
                            <Sparkles className="w-3 h-3" />
                            <span>{tx('Live Interactive Demo', 'دخول الديمو المباشر')}</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                            {error
                                ? tx('Demo Launch Failed', 'مشكلة في تشغيل الديمو')
                                : launching
                                  ? selectedRole === 'teacher'
                                      ? tx('Opening Teacher Studio...', 'بنجهز استوديو المدرس...')
                                      : tx('Launching Your Demo...', 'بنجهزلك الديمو...')
                                  : tx("What's your name?", 'اسمك إيه؟')}
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                            {error
                                ? error
                                : launching
                                  ? tx(
                                        'Setting up tracks, quizzes, live classes, badges, and analytics with your name.',
                                        'بنجهز المسارات والكويزات والكلاسات والشارات والتحليلات باسمك.'
                                    )
                                  : tx(
                                        'Enter your name to personalize your interactive demo across quizzes, leaderboards, and classrooms.',
                                        'اكتب اسمك عشان يظهر جوا الكويزات والليدربورد والكلاسات خلال تجربتك للديمو.'
                                    )}
                        </p>
                    </div>
                </div>

                {error ? (
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                setError(null);
                                if (urlNameParam) {
                                    setRetryTick((t) => t + 1);
                                } else {
                                    void launchDemo({ role: selectedRole, customName: visitorName });
                                }
                            }}
                            className={`btn-unstyled flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{tx('Try Again', 'حاول تاني')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className={`btn-unstyled flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white'
                            }`}
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>{tx('Back to Login', 'رجوع للدخول')}</span>
                        </button>
                    </div>
                ) : launching ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 py-3">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{tx('Loading workspace...', 'جاري التحميل...')}</span>
                    </div>
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div className="space-y-1.5 text-start">
                            <label
                                htmlFor="demo-visitor-name"
                                className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300"
                            >
                                {tx('Your Display Name', 'الاسم اللي هيظهر في الديمو')}
                            </label>
                            <div className="relative">
                                <User className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    ref={inputRef}
                                    id="demo-visitor-name"
                                    type="text"
                                    autoFocus
                                    maxLength={40}
                                    value={visitorName}
                                    onChange={(e) => {
                                        setVisitorName(e.target.value);
                                        if (validationError) setValidationError(null);
                                    }}
                                    placeholder={tx('e.g. Omar, Sara...', 'مثلاً: عمر، سارة...')}
                                    className={`w-full ps-10 pe-3.5 py-3 text-sm font-bold outline-none transition-all ${
                                        isBento
                                            ? 'bg-[#f8f7f2] text-black rounded-xl border-2 border-black focus:bg-white focus:shadow-[3px_3px_0px_#000]'
                                            : 'bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-white/10 focus:border-indigo-500'
                                    }`}
                                />
                            </div>
                            {validationError && (
                                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                    {validationError}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5 text-start">
                            <span className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                {tx('Explore As', 'عايز تجرب كـ')}
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRole('student')}
                                    className={`btn-unstyled py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                        selectedRole === 'student'
                                            ? isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-indigo-600 text-white shadow-sm'
                                            : isBento
                                              ? 'bg-white text-black border-2 border-black/30 hover:border-black'
                                              : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-transparent'
                                    }`}
                                >
                                    <Zap className="w-3.5 h-3.5 shrink-0" />
                                    <span>{tx('Student', 'طالب')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedRole('teacher')}
                                    className={`btn-unstyled py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                        selectedRole === 'teacher'
                                            ? isBento
                                                ? 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-indigo-600 text-white shadow-sm'
                                            : isBento
                                              ? 'bg-white text-black border-2 border-black/30 hover:border-black'
                                              : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-transparent'
                                    }`}
                                >
                                    <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                                    <span>{tx('Teacher Studio', 'استوديو المدرس')}</span>
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={`btn-unstyled w-full py-3.5 px-4 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-[2.5px] border-black shadow-[4px_4px_0px_#000] active:translate-y-0.5'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25'
                            }`}
                        >
                            <span>{tx('Start Live Demo', 'ابدأ الديمو دلوقتي')}</span>
                            <ArrowRight className="w-4 h-4 shrink-0" />
                        </button>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => void launchDemo({ role: selectedRole })}
                                className={`btn-unstyled text-xs font-bold underline underline-offset-2 cursor-pointer ${
                                    isBento
                                        ? 'text-slate-600 hover:text-black'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                                }`}
                            >
                                {tx('Continue with default demo name', 'كمل بالاسم الافتراضي للديمو')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default DemoLoginPage;
