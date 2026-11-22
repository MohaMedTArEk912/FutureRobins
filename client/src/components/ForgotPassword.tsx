import { useState, useEffect, useCallback } from 'react';
import { Mail, Lock, ArrowLeft, Eye, EyeOff, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { AmbientBackground } from './AmbientBackground';
import { AuthThemeButton } from './common/AuthThemeButton';

interface ForgotPasswordProps {
    onBack: () => void;
    onSuccess: () => void;
}

interface PasswordStrength {
    score: number;
    label: string;
    color: string;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack, onSuccess }) => {
    const { isBento } = useTheme();
    const { isArabic, tx } = useLanguage();
    const [step, setStep] = useState<'email' | 'reset'>('email');
    const [email, setEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const paramEmail = params.get('email');
        const paramCode = params.get('code');
        if (paramEmail) setEmail(paramEmail.trim());
        if (paramEmail && paramCode) {
            setVerificationCode(paramCode.trim());
            setStep('reset');
            setSuccess(tx('Verification link detected. Enter your new password below.', 'تم التحقق من الرابط. اكتب كلمة السر الجديدة تحت.'));
        }
    }, [tx]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const dispatchResetEmail = async () => {
        setError(null);
        setSuccess(null);
        setPreviewUrl(null);
        if (!isValidEmail(email)) {
            setError(tx('Please enter a valid email address', 'لو سمحت اكتب إيميل صحيح'));
            return;
        }
        setLoading(true);
        try {
            const res = await api.forgotPassword(email);
            setSuccess(
                res.message ||
                    tx(
                        `A 6-digit verification code was sent to ${email}. Check your inbox or spam folder.`,
                        `بعتنالك كود من 6 أرقام على ${email}. شوف صندوق الوارد أو الـ Spam.`
                    )
            );
            if (res.previewUrl) setPreviewUrl(res.previewUrl);
            setResendCooldown(60);
            setStep('reset');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };
    const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
    const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);

    // Email validation
    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Password strength checker
    const checkPasswordStrength = useCallback((password: string): PasswordStrength => {
        if (password.length === 0) {
            return { score: 0, label: '', color: '' };
        }
        
        let score = 0;
        
        // Length check
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;
        
        // Contains lowercase
        if (/[a-z]/.test(password)) score += 1;
        
        // Contains uppercase
        if (/[A-Z]/.test(password)) score += 1;
        
        // Contains number
        if (/\d/.test(password)) score += 1;
        
        // Contains special character
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

        if (score <= 2) {
            return { score, label: tx('Weak', 'ضعيفة'), color: isBento ? 'text-red-600 font-black' : 'text-red-500 dark:text-red-400' };
        } else if (score <= 4) {
            return { score, label: tx('Medium', 'متوسطة'), color: isBento ? 'text-amber-600 font-black' : 'text-yellow-500 dark:text-yellow-400' };
        } else {
            return { score, label: tx('Strong', 'قوية'), color: isBento ? 'text-green-700 font-black' : 'text-green-500 dark:text-green-400' };
        }
    }, [isBento, tx]);

    // Update password strength when password changes
    useEffect(() => {
        if (newPassword) {
            setPasswordStrength(checkPasswordStrength(newPassword));
        } else {
            setPasswordStrength(null);
        }
    }, [newPassword, checkPasswordStrength]);

    // Check if passwords match
    useEffect(() => {
        if (confirmPassword) {
            setPasswordsMatch(newPassword === confirmPassword);
        } else {
            setPasswordsMatch(null);
        }
    }, [newPassword, confirmPassword]);

    const handleVerifyEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!isValidEmail(email)) {
            setError(tx('Please enter a valid email address', 'لو سمحت اكتب إيميل صحيح'));
            return;
        }

        setLoading(true);

        try {
            const res = await api.forgotPassword(email);
            setSuccess(
                res.message ||
                    tx(
                        `A 6-digit verification code was sent to ${email}. Check your inbox or spam folder.`,
                        `بعتنالك كود من 6 أرقام على ${email}. شوف صندوق الوارد أو الـ Spam.`
                    )
            );
            if (res && res.previewUrl) setPreviewUrl(res.previewUrl);
            setResendCooldown(60);
            setStep('reset');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (newPassword.length < 6) {
            setError(tx('Password must be at least 6 characters long', 'كلمة السر لازم تكون 6 حروف على الأقل'));
            return;
        }

        if (passwordStrength && passwordStrength.score <= 2) {
            setError(tx('Please choose a stronger password', 'اختار كلمة سر أقوى شوية'));
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(tx('Passwords do not match', 'كلمتي السر مش متطابقين'));
            return;
        }

        setLoading(true);

        try {
            await api.resetPassword(email, newPassword, verificationCode);
            setSuccess(tx('Password reset successfully! Redirecting to login...', 'اتغيرت كلمة السر بنجاح! بنحولك لتسجيل الدخول...'));
            setTimeout(() => {
                onSuccess();
            }, 2000);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const fieldLabelClass = `block text-xs ms-0.5 mb-1.5 ${
        isBento ? 'font-black uppercase tracking-wider text-black' : 'font-semibold text-slate-700 dark:text-slate-300'
    }`;

    const fieldIconClass = `w-4 h-4 pointer-events-none transition-colors ${
        isBento ? 'text-black' : 'text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400'
    }`;

    const eyeToggleClass = `btn-unstyled absolute end-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors cursor-pointer ${
        isBento ? 'text-slate-700 hover:text-black hover:bg-slate-100' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
    }`;

    const submitBtnClass = `btn-unstyled w-full py-3 px-5 rounded-xl font-black text-sm sm:text-base tracking-wide transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
        isBento
            ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[4px_4px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000] disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0'
            : 'bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 text-white hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none'
    }`;

    const getInputClass = (spacingClass: string, matchState: boolean | null = null) => {
        if (isBento) {
            const borderColor =
                matchState === null ? 'border-black' :
                matchState ? 'border-green-600' : 'border-red-600';
            return `w-full ${spacingClass} text-sm rounded-xl transition-all border-2 ${borderColor} bg-white text-black font-semibold placeholder:font-medium placeholder-slate-400 shadow-[3px_3px_0px_#000] focus:outline-none focus:shadow-[4px_4px_0px_#000]`;
        }
        const borderColor =
            matchState === null
                ? 'border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-400 hover:border-slate-300 dark:hover:border-white/20'
                : matchState
                    ? 'border-green-500 dark:border-green-500 focus:border-green-500'
                    : 'border-red-500 dark:border-red-500 focus:border-red-500';
        return `w-full ${spacingClass} text-sm rounded-xl transition-all border-2 ${borderColor} focus:outline-none focus:ring-4 focus:ring-indigo-500/10 bg-white dark:bg-[#0a0908]/70 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500`;
    };

    const renderSpinnerLabel = (label: string) => (
        <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {label}
        </span>
    );

    return (
        <div className={`min-h-dvh flex items-center justify-center p-3 pt-16 sm:p-5 relative overflow-x-hidden transition-colors duration-300 p-safe ${
            isBento
                ? 'bg-[#f5f3ec]'
                : 'bg-slate-50 dark:bg-[#0a0908]'
        }`}>
            {/* Ambient Background */}
            <AmbientBackground />

            {/* Top End Change Theme */}
            <AuthThemeButton />

            <div className={`forgot-password-card relative z-10 w-full max-w-4xl overflow-hidden grid grid-cols-1 md:grid-cols-12 transition-all duration-300 ${
                isBento
                    ? 'bg-white border-[3px] border-black rounded-3xl shadow-[8px_8px_0px_#000]'
                    : 'bg-white/95 dark:bg-[#141210]/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/90 dark:border-white/10'
            }`}>
                {/* Left Identity & Progress Column */}
                <div className={`md:col-span-5 p-5 sm:p-6 md:p-7 flex flex-col justify-between gap-4 md:gap-6 ${
                    isBento
                        ? 'bg-[#faf8f1] border-b-[3px] md:border-b-0 md:border-e-[3px] border-black'
                        : 'bg-slate-50/90 dark:bg-white/[0.025] border-b md:border-b-0 md:border-e border-slate-200/80 dark:border-white/[0.08]'
                }`}>
                    <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={onBack}
                            className={`btn-unstyled inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all duration-150 cursor-pointer ${
                                isBento
                                    ? 'bg-white hover:bg-[#fde047] text-black font-black border-2 border-black shadow-[2.5px_2.5px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3.5px_3.5px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
                                    : 'bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold border border-slate-200 dark:border-white/10'
                            }`}
                        >
                            <ArrowLeft className={`w-3.5 h-3.5 shrink-0 ${isArabic ? 'rotate-180' : ''}`} />
                            <span>{tx('Back to Login', 'رجوع للدخول')}</span>
                        </button>

                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider ${
                            isBento
                                ? `border-2 border-black font-black shadow-[2px_2px_0px_#000] ${step === 'email' ? 'bg-[#bae6fd] text-black' : 'bg-[#bef264] text-black'}`
                                : 'border border-indigo-200 dark:border-indigo-500/25 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold'
                        }`}>
                            {step === 'email' ? tx('Step 1 of 2', 'خطوة 1 من 2') : tx('Step 2 of 2', 'خطوة 2 من 2')}
                        </span>
                    </div>

                    <div className="flex md:flex-col items-center md:items-start gap-3.5 md:gap-4">
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-2xl flex items-center justify-center ${
                            isBento
                                ? 'bg-[#fde047] text-black border-[2.5px] border-black shadow-[4px_4px_0px_#000]'
                                : 'bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/25 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        }`}>
                            {step === 'email' ? <Mail className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                        </div>
                        <div className="min-w-0">
                            <h1 className={`text-xl sm:text-2xl md:text-[1.75rem] font-black tracking-tight leading-tight ${
                                isBento
                                    ? 'text-black'
                                    : 'text-indigo-600 dark:text-[#f5f3ec]'
                            }`}>
                                {step === 'email' ? tx('Forgot Password', 'نسيت كلمة السر') : tx('Reset Password', 'تغيير كلمة السر')}
                            </h1>
                            <p className={`text-xs sm:text-sm leading-snug mt-1 ${isBento ? 'text-slate-700 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                                {step === 'email'
                                    ? tx('Verify your account email to receive a 6-digit recovery code.', 'اكتب إيميلك عشان نبعتلك كود استرجاع من 6 أرقام.')
                                    : tx('Enter the code from your email and choose a new password.', 'اكتب الكود اللي وصلك واختار كلمة سر جديدة.')}
                            </p>
                        </div>
                    </div>

                    {/* Desktop 2-Step Tracker */}
                    <div className="hidden md:flex flex-col gap-2.5">
                        <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 transition-all ${
                            isBento
                                ? step === 'email'
                                    ? 'bg-[#fde047] border-black text-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#bef264] border-black text-black shadow-[2.5px_2.5px_0px_#000]'
                                : step === 'email'
                                    ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-500/40 text-indigo-900 dark:text-indigo-200'
                                    : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                        }`}>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black'
                                    : step === 'reset'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-indigo-600 text-white'
                            }`}>
                                {step === 'reset' ? <CheckCircle2 className="w-3.5 h-3.5" /> : '1'}
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-black leading-tight">{tx('Verify Email', 'تأكيد الإيميل')}</div>
                                <div className={`text-[11px] truncate ${isBento ? 'text-black/80 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {step === 'reset' && email ? email : tx('Send 6-digit code', 'إرسال كود من 6 أرقام')}
                                </div>
                            </div>
                        </div>

                        <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 transition-all ${
                            isBento
                                ? step === 'reset'
                                    ? 'bg-[#bae6fd] border-black text-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-white border-dashed border-black/30 text-slate-500'
                                : step === 'reset'
                                    ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-500/40 text-indigo-900 dark:text-indigo-200'
                                    : 'bg-white/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500'
                        }`}>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                isBento
                                    ? `border-2 ${step === 'reset' ? 'bg-white text-black border-black' : 'bg-slate-100 text-slate-400 border-black/25'}`
                                    : step === 'reset'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                            }`}>
                                2
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-black leading-tight">{tx('New Password', 'كلمة السر الجديدة')}</div>
                                <div className={`text-[11px] truncate ${isBento ? (step === 'reset' ? 'text-black/80 font-bold' : 'text-slate-400 font-semibold') : 'text-slate-500 dark:text-slate-400'}`}>
                                    {tx('Set & confirm password', 'اكتب وأكد كلمة السر')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Form Column */}
                <div className="md:col-span-7 p-5 sm:p-6 md:p-7 flex flex-col justify-center">
                    {error && (
                        <div className={`mb-4 px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm animate-in slide-in-from-top-2 ${
                            isBento
                                ? 'bg-[#fee2e2] border-2 border-black text-black font-bold shadow-[3px_3px_0px_#000]'
                                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                        }`}>
                            <XCircle className="w-4 h-4 shrink-0" />
                            <span className="font-semibold leading-snug">{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className={`mb-4 px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm animate-in slide-in-from-top-2 ${
                            isBento
                                ? 'bg-[#dcfce7] border-2 border-black text-black font-bold shadow-[3px_3px_0px_#000]'
                                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                        }`}>
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span className="font-semibold leading-snug">{success}</span>
                        </div>
                    )}

                    {step === 'email' ? (
                        <form onSubmit={handleVerifyEmail} className="space-y-4">
                            <div>
                                <label className={fieldLabelClass}>{tx('Email Address', 'البريد الإلكتروني')}</label>
                                <div className="relative group">
                                    <Mail className={`absolute start-3.5 top-1/2 -translate-y-1/2 ${fieldIconClass}`} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="alex.dev@quizplatform.com"
                                        className={getInputClass('ps-11 pe-4 py-3')}
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !isValidEmail(email)}
                                className={submitBtnClass}
                            >
                                {loading ? renderSpinnerLabel(tx('Verifying...', 'جاري التحقق...')) : tx('Verify Email', 'إرسال كود التحقق')}
                            </button>

                            <p className={`text-[11px] text-center ${isBento ? 'text-slate-600 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                                {tx('Check your inbox or spam folder after submitting your email.', 'بعد الإرسال، راجع صندوق الوارد أو الرسائل غير المرغوب فيها (Spam).')}
                            </p>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-3.5">
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <label className={`block text-xs ms-0.5 ${isBento ? 'font-black uppercase tracking-wider text-black' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                                        {tx('6-Digit Verification Code', 'كود التحقق (6 أرقام)')}
                                    </label>
                                    <div className="flex items-center gap-3 text-xs font-bold shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStep('email');
                                                setError(null);
                                                setSuccess(null);
                                            }}
                                            className={`btn-unstyled transition-colors cursor-pointer underline underline-offset-2 ${isBento ? 'text-slate-600 hover:text-black' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                                        >
                                            {tx('Change Email', 'تغيير الإيميل')}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={loading || resendCooldown > 0}
                                            onClick={dispatchResetEmail}
                                            className={`btn-unstyled transition-colors underline underline-offset-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${isBento ? 'text-indigo-700 hover:text-black' : 'text-indigo-600 dark:text-teal-400 hover:text-indigo-700'}`}
                                        >
                                            {resendCooldown > 0
                                                ? tx(`Resend in ${resendCooldown}s`, `إعادة إرسال بعد ${resendCooldown}ث`)
                                                : tx('Resend Code', 'ابعت الكود تاني')}
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.trim())}
                                    placeholder="000000"
                                    className={`w-full px-4 py-2.5 rounded-xl tracking-[0.3em] font-mono text-center text-base font-black transition-all ${
                                        isBento
                                            ? 'border-2 border-black bg-white text-black placeholder:tracking-widest placeholder-slate-300 shadow-[3px_3px_0px_#000] focus:outline-none focus:shadow-[4px_4px_0px_#000]'
                                            : 'border-2 border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 bg-white dark:bg-[#0a0908]/70 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600'
                                    }`}
                                    required
                                />
                                {previewUrl && (
                                    <div className="mt-1.5 text-xs text-center">
                                        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-bold">
                                            {tx('Open Dev Test Email Preview →', 'فتح معاينة الإيميل التجريبية →')}
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={fieldLabelClass}>{tx('New Password', 'كلمة السر الجديدة')}</label>
                                    <div className="relative group">
                                        <Lock className={`absolute start-3 top-1/2 -translate-y-1/2 ${fieldIconClass}`} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder={tx('New password', 'كلمة السر الجديدة')}
                                            className={getInputClass('ps-9 pe-10 py-2.5')}
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className={eyeToggleClass}
                                            aria-label={showPassword ? tx('Hide password', 'إخفاء كلمة السر') : tx('Show password', 'إظهار كلمة السر')}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className={fieldLabelClass}>{tx('Confirm Password', 'تأكيد كلمة السر')}</label>
                                    <div className="relative group">
                                        <Lock className={`absolute start-3 top-1/2 -translate-y-1/2 ${fieldIconClass}`} />
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder={tx('Confirm password', 'أكّد كلمة السر')}
                                            className={getInputClass('ps-9 pe-10 py-2.5', passwordsMatch)}
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className={eyeToggleClass}
                                            aria-label={showConfirmPassword ? tx('Hide password', 'إخفاء كلمة السر') : tx('Show password', 'إظهار كلمة السر')}
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Compact Password Strength & Match Status */}
                            {(passwordStrength?.label || passwordsMatch !== null) && (
                                <div className={`p-2.5 rounded-xl border-2 ${
                                    isBento
                                        ? 'bg-[#faf8f1] border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10'
                                }`}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        {passwordStrength?.label && (
                                            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                                                <span className={`text-[11px] uppercase tracking-wider shrink-0 ${isBento ? 'font-black text-black' : 'font-semibold text-slate-600 dark:text-slate-400'}`}>
                                                    {tx('Strength:', 'القوة:')} <span className={passwordStrength.color}>{passwordStrength.label}</span>
                                                </span>
                                                <div className={`flex-1 rounded-full h-2 overflow-hidden ${isBento ? 'bg-white border border-black' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                                    <div
                                                        className={`h-full transition-all duration-300 ${
                                                            passwordStrength.score <= 2 ? 'bg-red-500' :
                                                            passwordStrength.score <= 4 ? 'bg-yellow-400' :
                                                            'bg-[#bef264]'
                                                        }`}
                                                        style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {passwordsMatch !== null && (
                                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold shrink-0 ${
                                                passwordsMatch
                                                    ? (isBento ? 'text-green-700' : 'text-green-600 dark:text-green-400')
                                                    : (isBento ? 'text-red-600' : 'text-red-600 dark:text-red-400')
                                            }`}>
                                                {passwordsMatch ? (
                                                    <>
                                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{tx('Passwords match', 'متطابقين')}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{tx('Do not match', 'مش متطابقين')}</span>
                                                    </>
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    {passwordStrength?.label && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
                                            {[
                                                { ok: newPassword.length >= 8, label: tx('8+ chars', '8+ حروف') },
                                                { ok: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword), label: tx('Aa case', 'كبير وصغير') },
                                                { ok: /\d/.test(newPassword), label: tx('Number', 'رقم') },
                                                { ok: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword), label: tx('Symbol', 'رمز') },
                                            ].map((rule) => (
                                                <span
                                                    key={rule.label}
                                                    className={`inline-flex items-center gap-1 text-[11px] ${
                                                        rule.ok
                                                            ? (isBento ? 'text-green-700 font-black' : 'text-green-600 dark:text-green-400 font-semibold')
                                                            : (isBento ? 'text-slate-500 font-semibold' : 'text-slate-400 dark:text-slate-500')
                                                    }`}
                                                >
                                                    {rule.ok ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
                                                    <span>{rule.label}</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !passwordsMatch || (passwordStrength !== null && passwordStrength.score <= 2)}
                                className={submitBtnClass}
                            >
                                {loading ? renderSpinnerLabel(tx('Resetting...', 'جاري التغيير...')) : tx('Reset Password', 'تغيير كلمة السر')}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
