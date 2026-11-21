import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, X, Sparkles, Award, Target, Trophy } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface LoginPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    redirectPath?: string;
}

export const LoginPromptModal: React.FC<LoginPromptModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    redirectPath
}) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const navigate = useNavigate();

    if (!isOpen) return null;

    const resolvedTitle = title ?? tx("Let's Log In", 'يلا نسجل دخول');
    const resolvedDescription = description ?? tx(
        'Create an account or log in to start quiz attempts, track your progress, earn certificates, and climb the leaderboard.',
        'اعمل حساب أو سجل دخول عشان تبدأ تحل الكويزات، تتابع مستواك، تاخد شهادات وتطلع في الترتيب.'
    );

    const handleLogin = () => {
        if (redirectPath) {
            sessionStorage.setItem('redirectAfterLogin', redirectPath);
        }
        onClose();
        navigate('/login');
    };

    const handleRegister = () => {
        if (redirectPath) {
            sessionStorage.setItem('redirectAfterLogin', redirectPath);
        }
        onClose();
        navigate('/register');
    };

    return (
        <div className="app-dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 dark:bg-black/45 backdrop-blur-md animate-in fade-in duration-200">
            {/* Modal backdrop click */}
            <div className="fixed inset-0 -z-10" onClick={onClose} />

            <div className={`app-dialog-panel app-dialog-panel--padded relative w-full max-w-md p-6 sm:p-8 overflow-hidden transition-all ${
                isBento
                    ? 'bg-white text-black border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000]'
                    : 'bg-white dark:bg-[#161411] border border-gray-200 dark:border-[#f5f3ec]/12 rounded-2xl shadow-2xl dark:shadow-[0_24px_64px_rgba(0,0,0,0.88)]'
            }`}>
                {/* Background glow decoration (light mode only — Noir Studio stays crisp & glare-free) */}
                {!isBento && (
                    <div className="dark:hidden">
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                    </div>
                )}

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className={`absolute top-5 right-5 p-2 rounded-lg transition-colors cursor-pointer ${
                        isBento
                            ? 'border-2 border-black bg-white hover:bg-[#fed7aa] text-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                            : 'text-gray-400 hover:text-gray-600 dark:text-[#a8a29e] dark:hover:text-[#f5f3ec] hover:bg-gray-100 dark:bg-[#f5f3ec]/6 dark:hover:bg-[#f5f3ec]/12'
                    }`}
                    title="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Icon Header */}
                <div className="flex items-center gap-3 mb-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        isBento
                            ? 'bg-[#bef264] border-2 border-black text-black shadow-[3px_3px_0px_#000]'
                            : 'bg-indigo-600 dark:bg-[#bef264] text-white dark:text-[#0a0908] shadow-lg shadow-indigo-500/25 dark:shadow-[0_8px_22px_-6px_rgba(190,242,100,0.3)]'
                    }`}>
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className={`text-xl sm:text-2xl font-black ${isBento ? 'text-black' : 'text-gray-900 dark:text-[#f5f3ec]'}`}>
                            {resolvedTitle}
                        </h3>
                        <p className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black/70' : 'text-indigo-600 dark:text-[#fde047]'}`}>
                            {tx('Unlock Full Experience', 'افتح كل المميزات')}
                        </p>
                    </div>
                </div>

                <p className={`text-sm leading-relaxed mb-6 font-medium ${isBento ? 'text-gray-700' : 'text-gray-600 dark:text-[#b5aea4]'}`}>
                    {resolvedDescription}
                </p>

                {/* Value Props */}
                <div className={`space-y-3 mb-6 p-4 rounded-2xl text-xs ${
                    isBento
                        ? 'bg-[#f5f3ec] border-2 border-black shadow-[2px_2px_0px_#000] text-black font-bold'
                        : 'bg-gray-50 dark:bg-[#1c1917]/80 border border-gray-100 dark:border-[#f5f3ec]/10 text-gray-700 dark:text-[#d6d0c7]'
                }`}>
                    <div className="flex items-center gap-2.5">
                        <Target className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-indigo-500 dark:text-[#bae6fd]'}`} />
                        <span>{tx('Take interactive quizzes & exam simulations', 'حل كويزات تفاعلية وامتحانات تجريبية')}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <Award className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-emerald-500 dark:text-[#bef264]'}`} />
                        <span>{tx('Solve Question Pools 100% and earn Certificates', 'خلص بنوك الأسئلة 100% واكسب شهادات')}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <Trophy className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-amber-500 dark:text-[#fde047]'}`} />
                        <span>{tx('Climb rank tiers & preserve daily streak', 'ارفع مستواك وحافظ على الستريك اليومي')}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5">
                    <button
                        type="button"
                        onClick={handleLogin}
                        className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            isBento
                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                : 'bg-indigo-600 hover:bg-indigo-500 dark:bg-[#bef264] dark:hover:bg-[#d2fa8a] text-white dark:text-[#0a0908] shadow-lg shadow-indigo-500/25 dark:shadow-[0_10px_28px_-6px_rgba(190,242,100,0.32)] hover:scale-[1.01] active:scale-[0.98]'
                        }`}
                    >
                        <LogIn className="w-4 h-4" />
                        <span>{tx('Log In', 'تسجيل الدخول')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleRegister}
                        className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            isBento
                                ? 'bg-[#fde047] hover:bg-[#facc15] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                : 'bg-gray-100 dark:bg-[#1c1917] hover:bg-gray-200 dark:hover:bg-[#24201c] text-gray-900 dark:text-[#f5f3ec] border border-gray-200 dark:border-[#f5f3ec]/14'
                        }`}
                    >
                        <UserPlus className={`w-4 h-4 ${isBento ? 'text-black' : 'text-teal-500 dark:text-[#fde047]'}`} />
                        <span>{tx('Create Free Account', 'إنشاء حساب مجاني')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className={`w-full py-2 text-xs font-bold transition-colors text-center cursor-pointer ${
                            isBento ? 'text-gray-600 hover:text-black' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                        {tx('Continue Browsing as Guest', 'كمل تصفح كزائر')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPromptModal;
