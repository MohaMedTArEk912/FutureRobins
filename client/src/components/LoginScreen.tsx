import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import TransparentLogo from './TransparentLogo.tsx';
import { AmbientBackground } from './AmbientBackground';
import { AnimatedCharacter } from './AnimatedCharacter.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';

interface LoginScreenProps {
    onLogin: (email: string, password: string) => Promise<void>;
    onSwitchToRegister: () => void;
    onSwitchToForgotPassword: () => void;
    onGoogleSignIn: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onSwitchToRegister, onSwitchToForgotPassword, onGoogleSignIn }) => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { isBento } = useTheme();
    const { tx } = useLanguage();

    // Focus states for the mascot "living" feel
    const [isEmailFocused, setIsEmailFocused] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (email.trim() && password.trim()) {
            setIsLoading(true);
            try {
                await onLogin(email, password);
            } catch (err) {
                const message = err instanceof Error ? err.message : tx('Login failed', 'فشل تسجيل الدخول');
                setError(message);
                setIsLoading(false);
            }
        } else {
            setError(tx('Please fill in all fields', 'لو سمحت املا كل البيانات المطلوبة'));
        }
    };

    return (
        <div className={`min-h-dvh text-slate-900 dark:text-[#f5f3ec] flex relative overflow-hidden selection:bg-indigo-500/25 dark:selection:bg-[#bef264]/28 ${
            isBento
                ? 'bg-[#f5f3ec]'
                : 'bg-slate-50 dark:bg-[#0a0908]'
        }`}>
            {/* Ambient Background - Shared across screens */}
            <AmbientBackground />

            {/* Bento-specific patterned background overlay */}
            {isBento && (
                <div 
                    className="fixed inset-0 pointer-events-none z-0" 
                    style={{
                        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='1.25' fill='%23000000'/%3E%3C/svg%3E\")",
                        backgroundSize: '24px 24px',
                        opacity: 0.12
                    }}
                    aria-hidden="true"
                />
            )}

            {/* Top Start Clickable Logo / Back to Home */}
            <div className="absolute top-6 start-6 z-50 mt-safe ms-safe">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className={`flex items-center gap-2 p-2 rounded-xl transition-all cursor-pointer active:scale-95 ${
                        isBento
                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047]'
                            : 'bg-white/80 dark:bg-[#1c1917] border border-slate-200/80 dark:border-[#f5f3ec]/12 hover:bg-white dark:hover:bg-[#24201c] text-slate-700 dark:text-[#f5f3ec]'
                    }`}
                    title={tx('Return to Home', 'الرجوع للرئيسية')}
                    aria-label={tx('Return to Home', 'الرجوع للرئيسية')}
                >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                        isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-indigo-600 dark:bg-[#bef264] text-white dark:text-[#0a0908]'
                    }`}>
                        Q
                    </div>
                    <span className="text-xs font-bold hidden sm:inline">{tx('Home', 'الرئيسية')}</span>
                </button>
            </div>

            {/* Left Column - Mascot & Branding (Hidden on Mobile) */}
            <div className={`hidden lg:flex flex-col flex-[1.2] relative z-10 items-center justify-center p-12 login-mascot-col ${
                isBento
                    ? 'bg-[#bef264] border-e-[3px] border-black'
                    : 'bg-slate-100/40 dark:bg-transparent backdrop-blur-xl dark:backdrop-blur-none border-e border-slate-200/80 dark:border-[#2b2722]'
            }`}>
                {/* Bento decorative elements */}
                {isBento && (
                    <>
                        {/* Floating geometric shapes */}
                        <div className="absolute top-8 left-8 w-12 h-12 bg-[#fde047] border-[2.5px] border-black rounded-xl shadow-[3px_3px_0px_#000] rotate-12 z-0" />
                        <div className="absolute top-16 right-12 w-8 h-8 bg-[#bae6fd] border-[2.5px] border-black rounded-full shadow-[2px_2px_0px_#000] z-0" />
                        <div className="absolute bottom-12 left-16 w-10 h-10 bg-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] rotate-45 z-0" />
                        <div className="absolute bottom-8 right-8 w-6 h-6 bg-[#fed7aa] border-[2px] border-black rounded-lg shadow-[2px_2px_0px_#000] -rotate-12 z-0" />
                        <div className="absolute top-1/3 left-6 w-4 h-4 bg-black rounded-full z-0" />
                        <div className="absolute bottom-1/3 right-10 w-3 h-3 bg-black rotate-45 z-0" />
                        
                        {/* Dotted pattern on bento left column */}
                        <div 
                            className="absolute inset-0 pointer-events-none" 
                            style={{
                                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='14' cy='14' r='1.5' fill='%23000000'/%3E%3C/svg%3E\")",
                                backgroundSize: '28px 28px',
                                opacity: 0.08
                            }}
                        />
                    </>
                )}

                <div className="w-full max-w-lg flex flex-col items-center relative z-10">
                    {/* Character/Mascot Container */}
                    <div className={`w-[340px] sm:w-[380px] h-[340px] sm:h-[380px] flex items-center justify-center mb-6 mascot-card-wrapper transition-all ${
                        isBento
                            ? 'bg-white rounded-[2rem] border-[3px] border-black shadow-[7px_7px_0px_#000] p-6 relative'
                            : ''
                    }`}>
                        <AnimatedCharacter 
                            isEmailFocused={isEmailFocused} 
                            isPasswordFocused={isPasswordFocused} 
                            showPassword={showPassword} 
                        />
                    </div>
                    
                    <div className="text-center space-y-2">
                        <h1 className={`text-4xl font-extrabold tracking-tight ${
                            isBento ? 'text-black' : 'text-slate-900 dark:text-white'
                        }`}>
                            {tx('Master your', 'احترف')}{' '}
                            <span className="bento-highlight">{tx('field', 'مجالك')}</span>
                        </h1>
                        <p className={`text-base max-w-sm mx-auto ${
                            isBento ? 'text-gray-800 font-semibold' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                            {tx(
                                'Jump into interactive quizzes, track knowledge progress, and compete on the leaderboard.',
                                'ابدأ الكويزات التفاعلية، تابع تقدمك في المسارات، ونافس على صدارة الترتيب.'
                            )}
                        </p>
                        {/* Neo-Brutalist Sticker Badges */}
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 select-none">
                            <span className="bento-badge-tag bg-[#fde047] text-black -rotate-1">{tx('"INTERACTIVE"', '"تفاعلي"')}</span>
                            <span className="bento-badge-tag bg-[#0d9488] text-white rotate-1">{tx('"TRACK XP"', '"تابع نقاطك"')}</span>
                            <span className="bento-badge-tag bg-[#bef264] text-black -rotate-1">{tx('"LEADERBOARD"', '"المتصدرين"')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column - Form */}
            <div className={`flex-1 flex flex-col justify-center items-center p-6 lg:p-10 relative z-10 w-full animate-in fade-in duration-500 ${
                isBento ? 'bg-white' : ''
            }`}>
                <div
                    data-snake-wall="card"
                    className={`w-full max-w-md space-y-6 ${
                        isBento
                            ? ''
                            : 'bg-white dark:bg-[#141210] border border-slate-200 dark:border-[1.5px] dark:border-[#2e2924] rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-[0_6px_0_#050504]'
                    }`}
                >
                    {/* Mobile Logo & Heading (Visible only when Mascot is hidden) */}
                    <div className="lg:hidden text-center mb-4">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="w-16 h-16 mx-auto mb-3 relative flex items-center justify-center cursor-pointer active:scale-95 transition-transform bg-transparent border-0 p-0"
                            aria-label={tx('Return to Home', 'الرجوع للرئيسية')}
                        >
                            <TransparentLogo src="/icon.png" className="w-full h-full object-contain" threshold={40} />
                        </button>
                        <h1 className={`text-2xl font-extrabold tracking-tight ${
                            isBento ? 'text-black' : 'text-slate-900 dark:text-white'
                        }`}>
                            {tx('Welcome Back', 'أهلاً بيك تاني')}
                        </h1>
                    </div>

                    <div className="text-start space-y-1.5 hidden lg:block">
                        <h2 className={`text-3xl font-extrabold tracking-tight ${
                            isBento ? 'text-black' : 'text-slate-900 dark:text-white'
                        }`}>{tx('Sign In', 'تسجيل الدخول')}</h2>
                        <p className={`text-sm ${
                            isBento ? 'text-gray-600 font-semibold' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                            {tx('Enter your credentials to access your roadmaps.', 'اكتب بياناتك عشان تفتح حسابك ومساراتك.')}
                        </p>
                    </div>

                    {error && (
                        <div className={`p-3.5 flex items-center gap-2.5 text-xs font-semibold animate-shake ${
                            isBento
                                ? 'bg-[#fde047] text-black border-[2.5px] border-black rounded-xl shadow-[3px_3px_0px_#000] font-black'
                                : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl'
                        }`}>
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isBento ? 'bg-black' : 'bg-rose-500'}`} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5 group">
                            <label className={`block text-xs font-semibold ms-1 transition-colors ${
                                isBento
                                    ? 'text-black font-black uppercase tracking-wider'
                                    : 'text-slate-700 dark:text-slate-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400'
                            }`}>
                                {tx('Email Address', 'البريد الإلكتروني')}
                            </label>
                            <div className="relative">
                                <Mail className={`absolute start-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors ${
                                    isBento ? 'text-black' : 'text-slate-400 group-focus-within:text-indigo-500'
                                }`} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onFocus={() => setIsEmailFocused(true)}
                                    onBlur={() => setIsEmailFocused(false)}
                                    placeholder="alex.dev@quizplatform.com"
                                    disabled={isLoading}
                                    className={`w-full ps-11 pe-4 py-3 text-sm font-medium disabled:opacity-50 transition-all ${
                                        isBento
                                            ? 'bg-white border-[2.5px] border-black rounded-xl text-black placeholder-gray-500 focus:outline-none focus:shadow-[4px_4px_0px_#000] shadow-[2px_2px_0px_#000]'
                                            : 'bg-white dark:bg-[#141210] border border-slate-200 dark:border-[#f5f3ec]/14 rounded-2xl text-slate-900 dark:text-[#f5f3ec] placeholder-slate-400 dark:placeholder-[#78716c] focus:outline-none focus:border-indigo-500 dark:focus:border-[#bef264] focus:ring-3 focus:ring-indigo-500/15 dark:focus:ring-[#bef264]/15 shadow-sm'
                                    }`}
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 group">
                            <label className={`block text-xs font-semibold ms-1 transition-colors ${
                                isBento
                                    ? 'text-black font-black uppercase tracking-wider'
                                    : 'text-slate-700 dark:text-[#d6d0c7] group-focus-within:text-indigo-600 dark:group-focus-within:text-[#bef264]'
                            }`}>
                                {tx('Password', 'كلمة السر')}
                            </label>
                            <div className="relative">
                                <Lock className={`absolute start-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors ${
                                    isBento ? 'text-black' : 'text-slate-400 dark:text-[#888177] group-focus-within:text-indigo-500 dark:group-focus-within:text-[#bef264]'
                                }`} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onFocus={() => setIsPasswordFocused(true)}
                                    onBlur={() => setIsPasswordFocused(false)}
                                    placeholder="••••••••"
                                    disabled={isLoading}
                                    className={`w-full ps-11 pe-11 py-3 text-sm font-medium disabled:opacity-50 transition-all ${
                                        isBento
                                            ? 'bg-white border-[2.5px] border-black rounded-xl text-black placeholder-gray-500 focus:outline-none focus:shadow-[4px_4px_0px_#000] shadow-[2px_2px_0px_#000]'
                                            : 'bg-white dark:bg-[#141210] border border-slate-200 dark:border-[#f5f3ec]/14 rounded-2xl text-slate-900 dark:text-[#f5f3ec] placeholder-slate-400 dark:placeholder-[#78716c] focus:outline-none focus:border-indigo-500 dark:focus:border-[#bef264] focus:ring-3 focus:ring-indigo-500/15 dark:focus:ring-[#bef264]/15 shadow-sm'
                                    }`}
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={isLoading}
                                    className={`absolute end-4 top-1/2 -translate-y-1/2 p-1 transition-colors ${
                                        isBento ? 'text-black hover:text-gray-600' : 'text-slate-400 dark:text-[#888177] hover:text-indigo-500 dark:hover:text-[#f5f3ec]'
                                    }`}
                                    title={showPassword ? tx('Hide password', 'إخفاء كلمة السر') : tx('Show password', 'إظهار كلمة السر')}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-0.5 pt-1">
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <div className="relative w-4 h-4">
                                    <input type="checkbox" className="peer sr-only" />
                                    <div className={`w-4 h-4 transition-all ${
                                        isBento
                                            ? 'rounded-md border-[2px] border-black bg-white peer-checked:bg-[#bef264] peer-checked:border-black'
                                            : 'rounded-md border border-slate-300 dark:border-[#f5f3ec]/25 bg-white dark:bg-[#141210] peer-checked:bg-indigo-600 dark:peer-checked:bg-[#bef264] peer-checked:border-indigo-600 dark:peer-checked:border-[#bef264]'
                                    }`} />
                                    <svg className={`absolute inset-0 w-4 h-4 scale-0 peer-checked:scale-100 transition-transform p-0.5 ${
                                        isBento ? 'text-black' : 'text-white dark:text-[#0a0908]'
                                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <span className={`text-xs font-medium ${
                                    isBento ? 'text-black font-semibold' : 'text-slate-600 dark:text-[#b5aea4]'
                                }`}>{tx('Remember me', 'افتكرني')}</span>
                            </label>
                            <button
                                type="button"
                                onClick={onSwitchToForgotPassword}
                                disabled={isLoading}
                                className={`text-xs font-semibold transition-all ${
                                    isBento ? 'text-black underline decoration-2 underline-offset-2 hover:no-underline' : 'text-indigo-600 dark:text-[#fde047] hover:underline'
                                }`}
                            >
                                {tx('Forgot password?', 'نسيت كلمة السر؟')}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-3.5 font-bold text-sm transition-all flex justify-center items-center gap-2 cursor-pointer mt-2 ${
                                isBento
                                    ? 'bg-[#bef264] text-black rounded-xl border-[2.5px] border-black shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:shadow-[1px_1px_0px_#000] active:translate-y-0.5 font-black text-base uppercase tracking-wider disabled:opacity-50'
                                    : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-[#bef264] dark:hover:bg-[#d2fa8a] text-white dark:text-[#0a0908] dark:font-black rounded-2xl shadow-md shadow-indigo-600/20 dark:shadow-[0_10px_28px_-6px_rgba(190,242,100,0.35)] active:scale-[0.985] disabled:opacity-50'
                            }`}
                        >
                            {isLoading ? (
                                <svg className={`animate-spin h-5 w-5 ${isBento ? 'text-black' : 'text-white dark:text-[#0a0908]'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <span>{isBento ? tx('⚡ SIGN IN', '⚡ تسجيل الدخول') : tx('Sign In', 'تسجيل الدخول')}</span>
                            )}
                        </button>
                    </form>

                    <div className="relative py-1">
                        <div className="absolute inset-0 flex items-center">
                            <div className={`w-full ${
                                isBento ? 'border-t-[2px] border-black' : 'border-t border-slate-200 dark:border-[#f5f3ec]/10'
                            }`}></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className={`px-2 ${
                                isBento ? 'bg-white text-black font-bold' : 'bg-white dark:bg-[#141210] text-slate-400 dark:text-[#888177]'
                            }`}>{tx('or continue with', 'أو كمل باستخدام')}</span>
                        </div>
                    </div>

                    <div>
                        <button
                            type="button"
                            onClick={onGoogleSignIn}
                            className={`w-full flex items-center justify-center gap-2.5 py-2.5 font-semibold text-xs active:scale-95 transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-white rounded-xl border-[2.5px] border-black shadow-[3px_3px_0px_#000] text-black font-bold hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5'
                                    : 'glass-card rounded-2xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span>{tx('Continue with Google', 'تسجيل الدخول باستخدام Google')}</span>
                        </button>
                    </div>

                    <p className={`text-center font-medium text-xs ${
                        isBento ? 'text-gray-600' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                        {tx("Don't have an account yet?", 'لسه معندكش حساب؟')}{' '}
                        <button
                            onClick={onSwitchToRegister}
                            className={`font-semibold ms-1 cursor-pointer ${
                                isBento ? 'text-black underline decoration-2 underline-offset-2 font-black hover:no-underline' : 'text-indigo-600 dark:text-[#bef264] hover:underline'
                            }`}
                        >
                            {tx('Sign up for free', 'اعمل حساب مجاني')}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
