import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Zap, RefreshCw, AlertCircle, ArrowLeft, GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, type AppLanguage } from '../context/LanguageContext';

const DemoLoginPage: React.FC = () => {
    const { currentUser, demoLogin } = useAuth();
    const { isBento, theme, setTheme, closeThemeModal } = useTheme();
    const { language, setLanguage, tx } = useLanguage();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const roleParam: 'student' | 'teacher' = searchParams.get('role') === 'teacher' ? 'teacher' : 'student';
    const rawTo = searchParams.get('to') || '/';
    const safeDestination = rawTo.startsWith('/') && !rawTo.startsWith('//') ? rawTo : '/';
    const langParam = searchParams.get('lang');
    const requestedLang: AppLanguage =
        langParam === 'ar-EG' || langParam === 'en' ? langParam : language;

    const [error, setError] = useState<string | null>(null);
    const [retryTick, setRetryTick] = useState(0);
    const startedKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const runKey = `${roleParam}:${requestedLang}:${safeDestination}:${retryTick}`;
        if (startedKeyRef.current === runKey) return;
        startedKeyRef.current = runKey;

        let cancelled = false;

        const launchDemo = async () => {
            try {
                // Ensure first-time theme onboarding modal doesn't cover the instant demo view
                try {
                    if (!localStorage.getItem('theme')) {
                        setTheme(theme);
                    }
                } catch {
                    // ignore storage errors
                }
                closeThemeModal();

                const targetDemoId = roleParam === 'teacher' ? 'demo_teacher' : 'demo_student';
                if (currentUser?.userId === targetDemoId) {
                    sessionStorage.removeItem('suppressRedirectAfterLogin');
                    sessionStorage.removeItem('redirectAfterLogin');
                    navigate(safeDestination, { replace: true });
                    return;
                }

                if (langParam === 'ar-EG' || langParam === 'en') {
                    await setLanguage(langParam, false);
                }
                await demoLogin({ role: roleParam, preferredLanguage: requestedLang });
                if (cancelled) return;
                sessionStorage.removeItem('suppressRedirectAfterLogin');
                sessionStorage.removeItem('redirectAfterLogin');
                navigate(safeDestination, { replace: true });
            } catch (err) {
                if (cancelled) return;
                setError(
                    err instanceof Error
                        ? err.message
                        : tx('Could not launch live demo session. Please try again.', 'مقدرناش نفتح حساب الديمو دلوقتي، جرب تاني.')
                );
            }
        };

        const timer = window.setTimeout(() => {
            void launchDemo();
        }, 0);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [
        roleParam,
        requestedLang,
        langParam,
        safeDestination,
        retryTick,
        currentUser?.userId,
        demoLogin,
        navigate,
        theme,
        setTheme,
        closeThemeModal,
        setLanguage,
        tx
    ]);

    return (
        <div className={`min-h-dvh flex items-center justify-center p-4 ${
            isBento ? 'bg-[#f5f3ec] text-black' : 'bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-white'
        }`}>
            <div className={`w-full max-w-md p-6 sm:p-8 rounded-3xl text-center space-y-5 ${
                isBento
                    ? 'bg-white border-[3px] border-black shadow-[8px_8px_0px_#000]'
                    : 'bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 shadow-2xl'
            }`}>
                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${
                    isBento
                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                        : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                }`}>
                    {error ? (
                        <AlertCircle className="w-8 h-8" />
                    ) : roleParam === 'teacher' ? (
                        <GraduationCap className="w-8 h-8 animate-bounce" />
                    ) : (
                        <Zap className="w-8 h-8 animate-pulse" />
                    )}
                </div>

                <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#fde047] text-black border border-black">
                        <Sparkles className="w-3 h-3" />
                        <span>{tx('Live Demo Access', 'دخول الديمو المباشر')}</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                        {error
                            ? tx('Demo Launch Failed', 'مشكلة في تشغيل الديمو')
                            : roleParam === 'teacher'
                                ? tx('Opening Teacher Studio Demo...', 'بنجهز استوديو المدرس التجريبي...')
                                : tx('Launching Live Platform Demo...', 'بنجهزلك حساب العرض المباشر...')}
                    </h1>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                        {error
                            ? error
                            : tx(
                                'Signing into a pre-loaded demo account with tracks, quizzes, live classes, badges, and analytics unlocked.',
                                'بنسجل دخول تلقائي بحساب ديمو فيه المسارات والكويزات والكلاسات والشارات جاهزة للتجربة.'
                            )}
                    </p>
                </div>

                {!error ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 py-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{tx('Loading workspace...', 'جاري التحميل...')}</span>
                    </div>
                ) : (
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setError(null);
                                setRetryTick((t) => t + 1);
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
                )}
            </div>
        </div>
    );
};

export default DemoLoginPage;
