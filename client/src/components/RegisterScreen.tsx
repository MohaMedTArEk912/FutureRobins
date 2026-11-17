import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Mail,
    Lock,
    User,
    Eye,
    EyeOff,
    KeyRound,
    RefreshCw,
    CheckCircle2,
    ExternalLink,
    ArrowLeft,
    ShieldCheck
} from 'lucide-react';
import ThemeToggle from './ThemeToggle.tsx';
import TransparentLogo from './TransparentLogo.tsx';
import { AmbientBackground } from './AmbientBackground';
import { AnimatedCharacter } from './AnimatedCharacter.tsx';
import { api, type UserData } from '../lib/api';
import { useTheme } from '../context/ThemeContext';

interface RegisterScreenProps {
    onVerified: (user: UserData, token: string) => void;
    onSwitchToLogin: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onVerified, onSwitchToLogin }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { isBento } = useTheme();

    const [step, setStep] = useState<'details' | 'verify'>('details');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [otp, setOtp] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRedirectVerifying, setIsRedirectVerifying] = useState(false);
    const [alreadyVerified, setAlreadyVerified] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    // Focus states for the mascot "living" feel
    const [isEmailFocused, setIsEmailFocused] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);

    const autoVerifyAttemptedRef = useRef<string | null>(null);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handleVerificationResponse = useCallback((res: {
        user?: UserData;
        token?: string;
        alreadyVerified?: boolean;
        message?: string;
    }) => {
        if (res.user && res.token) {
            setInfo('Email verified! Signing you in...');
            onVerified(res.user, res.token);
            return;
        }
        if (res.alreadyVerified) {
            setAlreadyVerified(true);
            setInfo(res.message || 'Your email is already verified! Please sign in to continue.');
            return;
        }
        setError('Verification succeeded without a session token. Please sign in.');
    }, [onVerified]);

    // Auto-verify when user opens the redirect verification link from their inbox
    useEffect(() => {
        const paramEmail = (searchParams.get('email') || '').trim().toLowerCase();
        const paramToken = (searchParams.get('token') || '').trim();
        const paramOtp = (searchParams.get('otp') || searchParams.get('code') || '').trim();

        if (!paramToken && !(paramEmail && paramOtp)) return;

        const key = `${paramEmail}:${paramToken || paramOtp}`;
        if (autoVerifyAttemptedRef.current === key) return;
        autoVerifyAttemptedRef.current = key;

        if (paramEmail) setEmail(paramEmail);
        if (paramOtp && !paramToken) setOtp(paramOtp.replace(/\D/g, '').slice(0, 6));

        setStep('verify');
        setError(null);
        setInfo('Verifying your email link...');
        setIsRedirectVerifying(true);

        api.verifyRegistration({
            email: paramEmail,
            ...(paramToken ? { token: paramToken } : { otp: paramOtp })
        })
            .then((res) => {
                handleVerificationResponse(res);
            })
            .catch((err) => {
                setInfo(null);
                setError(err instanceof Error ? err.message : 'Email link verification failed. You can enter your 6-digit OTP code or resend.');
            })
            .finally(() => {
                setIsRedirectVerifying(false);
            });
    }, [searchParams, handleVerificationResponse]);

    const dispatchVerificationEmail = async () => {
        const normalizedEmail = email.toLowerCase().trim();
        const trimmedName = name.trim();

        if (!trimmedName || trimmedName.length < 2) {
            setError('Full name must be at least 2 characters');
            return;
        }
        if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setError('Please provide a valid email address');
            return;
        }
        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        setError(null);
        setInfo(null);
        setPreviewUrl(null);
        setIsSubmitting(true);

        try {
            const userId = normalizedEmail.replace(/[^a-z0-9]/g, '_');
            const res = await api.requestRegistrationVerification({
                userId,
                name: trimmedName,
                email: normalizedEmail,
                password
            });
            setEmail(res.email || normalizedEmail);
            setStep('verify');
            setOtp('');
            setAlreadyVerified(false);
            if (res.previewUrl) setPreviewUrl(res.previewUrl);
            setResendCooldown(60);
            setInfo(res.message || `We sent a 6-digit OTP code and verification link to ${res.email || normalizedEmail}.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send verification email');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRequestSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await dispatchVerificationEmail();
    };

    const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanedOtp = otp.replace(/\D/g, '').trim();
        if (cleanedOtp.length !== 6) {
            setError('Please enter the 6-digit verification code sent to your email.');
            return;
        }

        setError(null);
        setIsSubmitting(true);
        try {
            const res = await api.verifyRegistration({
                email: email.toLowerCase().trim(),
                otp: cleanedOtp
            });
            handleVerificationResponse(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed. Please check the code and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = `w-full pl-11 pr-4 py-2.5 rounded-2xl text-sm font-medium transition-all focus:outline-none ${
        isBento
            ? 'bg-white border-2 border-black text-black placeholder-slate-400 focus:ring-2 focus:ring-black/15 shadow-[2px_2px_0_#000]'
            : 'bg-white dark:bg-[#0f1422] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15 shadow-sm'
    } disabled:opacity-60`;

    const primaryBtnClass = isBento
        ? 'btn-unstyled w-full py-3 rounded-2xl font-black text-sm tracking-wide flex justify-center items-center gap-2 cursor-pointer border-2 border-black bg-[#bef264] text-black shadow-[3px_3px_0_#000] hover:translate-y-[-1px] active:translate-y-[1px] transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 disabled:shadow-none disabled:cursor-not-allowed'
        : 'w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-bold text-sm transition-all shadow-md shadow-indigo-600/20 active:scale-[0.985] disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer';

    const labelClass = `block text-xs ml-1 mb-1 transition-colors ${
        isBento
            ? 'font-black uppercase tracking-wider text-black'
            : 'font-semibold text-slate-700 dark:text-slate-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400'
    }`;

    return (
        <div className="min-h-dvh bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex relative overflow-x-hidden selection:bg-indigo-500/25">
            {/* Ambient Background */}
            <AmbientBackground />

            {/* Top Left Clickable Logo / Back to Home */}
            <div className="absolute top-5 left-5 z-50 mt-safe ml-safe">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className={`btn-unstyled flex items-center gap-2 p-2 rounded-xl transition-all cursor-pointer active:scale-95 ${
                        isBento
                            ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0_#000]'
                            : 'bg-white/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                    title="Return to Home"
                    aria-label="Return to Home"
                >
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs bg-indigo-600 text-white">
                        Q
                    </div>
                    <span className="text-xs font-bold hidden sm:inline">Home</span>
                </button>
            </div>

            {/* Theme Toggle - Floating */}
            <div className="absolute top-5 right-5 z-50 mt-safe mr-safe">
                <ThemeToggle />
            </div>

            {/* Left Column - Mascot & Branding (Hidden on Mobile) */}
            <div className="hidden lg:flex flex-col flex-[1.05] relative z-10 bg-slate-100/40 dark:bg-white/[0.02] backdrop-blur-xl border-r border-slate-200/80 dark:border-white/[0.06] items-center justify-center p-8 login-mascot-col">
                <div className="w-full max-w-md flex flex-col items-center">
                    <div className="w-[260px] xl:w-[320px] h-[260px] xl:h-[320px] flex items-center justify-center mb-4 mascot-card-wrapper transition-all">
                        <AnimatedCharacter
                            isEmailFocused={isEmailFocused || step === 'verify'}
                            isPasswordFocused={isPasswordFocused}
                            showPassword={showPassword}
                        />
                    </div>

                    <div className="text-center space-y-2">
                        <h1 className="text-3xl xl:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            {step === 'verify' ? (
                                <>Verify your <span className="bento-highlight">inbox</span></>
                            ) : (
                                <>Join the <span className="bento-highlight">ranks</span></>
                            )}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm xl:text-base max-w-sm mx-auto">
                            {step === 'verify'
                                ? 'Confirm your email via 6-digit OTP or the verification redirect link to activate your account.'
                                : 'Create your learner profile and confirm your email address to start climbing.'}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 select-none">
                            <span className="bento-badge-tag bg-[#fde047] text-black -rotate-1">&ldquo;NEW COHORT&rdquo;</span>
                            <span className="bento-badge-tag bg-[#8b5cf6] text-white rotate-1">&ldquo;OTP OR LINK&rdquo;</span>
                            <span className="bento-badge-tag bg-[#bef264] text-black -rotate-1">&ldquo;DUEL LIVE&rdquo;</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column - Form */}
            <div className="flex-1 flex flex-col justify-center items-center p-5 sm:p-8 relative z-10 w-full animate-in fade-in duration-500">
                <div className="w-full max-w-md space-y-4">
                    {/* Mobile Logo & Heading */}
                    <div className="lg:hidden text-center pt-6">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="btn-unstyled w-14 h-14 mx-auto mb-2 relative flex items-center justify-center cursor-pointer active:scale-95 transition-transform bg-transparent border-0 p-0"
                            aria-label="Return to Home"
                        >
                            <TransparentLogo src="/icon.png" className="w-full h-full object-contain" threshold={40} />
                        </button>
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            {step === 'verify' ? 'Verify Your Email' : 'Create Account'}
                        </h1>
                    </div>

                    {/* Step Indicator + Heading */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full ${
                                isBento
                                    ? 'bg-[#bae6fd] text-black border-2 border-black font-black uppercase'
                                    : 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-500/30'
                            }`}>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{step === 'verify' ? 'Step 2 of 2 • Email Verification' : 'Step 1 of 2 • Account Info'}</span>
                            </span>
                        </div>
                        <div className="hidden lg:block">
                            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                {step === 'verify' ? 'Verify Your Email' : 'Create Account'}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                {step === 'verify'
                                    ? 'Enter the 6-digit OTP code or open the link we emailed you.'
                                    : 'We will verify that your email works before creating your account.'}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className={`p-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold animate-shake ${
                            isBento
                                ? 'bg-rose-100 border-2 border-black text-rose-800 shadow-[2px_2px_0_#000]'
                                : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400'
                        }`}>
                            <div className="w-2 h-2 shrink-0 rounded-full bg-rose-500 animate-pulse" />
                            <span>{error}</span>
                        </div>
                    )}

                    {info && (
                        <div className={`p-3 rounded-2xl flex items-start gap-2.5 text-xs font-semibold ${
                            isBento
                                ? 'bg-emerald-100 border-2 border-black text-black shadow-[2px_2px_0_#000]'
                                : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        }`}>
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                            <div className="space-y-1">
                                <span>{info}</span>
                                {previewUrl && (
                                    <div>
                                        <a
                                            href={previewUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 underline font-bold text-indigo-700 dark:text-indigo-300"
                                        >
                                            <span>Open Ethereal Test Inbox Preview</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'details' ? (
                        <form onSubmit={handleRequestSubmit} className="space-y-3.5">
                            <div className="group">
                                <label className={labelClass}>Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Alex Mercer"
                                        disabled={isSubmitting}
                                        className={inputClass}
                                        autoComplete="name"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label className={labelClass}>Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onFocus={() => setIsEmailFocused(true)}
                                        onBlur={() => setIsEmailFocused(false)}
                                        placeholder="alex.dev@quizplatform.com"
                                        disabled={isSubmitting}
                                        className={inputClass}
                                        autoComplete="email"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label className={labelClass}>Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setIsPasswordFocused(true)}
                                        onBlur={() => setIsPasswordFocused(false)}
                                        placeholder="At least 6 characters"
                                        disabled={isSubmitting}
                                        className={`${inputClass} pr-11`}
                                        autoComplete="new-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={isSubmitting}
                                        className="btn-unstyled absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors p-1 bg-transparent border-0"
                                        title={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" disabled={isSubmitting} className={`${primaryBtnClass} mt-1`}>
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Sending Verification Email...</span>
                                    </>
                                ) : (
                                    <span>Verify Email &amp; Continue</span>
                                )}
                            </button>
                        </form>
                    ) : alreadyVerified ? (
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={onSwitchToLogin}
                                className={primaryBtnClass}
                            >
                                <span>Proceed to Sign In</span>
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleVerifyOtpSubmit} className="space-y-3.5">
                            <div className={`p-3 rounded-2xl text-xs flex items-center justify-between gap-2 ${
                                isBento
                                    ? 'bg-[#fef08a] border-2 border-black text-black font-bold'
                                    : 'bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                            }`}>
                                <div className="truncate">
                                    <span className="opacity-75">Sent to: </span>
                                    <strong className="font-bold">{email || 'your email'}</strong>
                                </div>
                                {name && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStep('details');
                                            setError(null);
                                            setInfo(null);
                                        }}
                                        className="btn-unstyled inline-flex items-center gap-1 text-xs font-bold underline shrink-0 bg-transparent border-0 cursor-pointer"
                                    >
                                        <ArrowLeft className="w-3 h-3" />
                                        <span>Edit</span>
                                    </button>
                                )}
                            </div>

                            {isRedirectVerifying ? (
                                <div className="py-6 flex flex-col items-center justify-center gap-2 text-sm font-bold">
                                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                                    <span>Confirming your verification link...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="group">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className={`${labelClass} mb-0`}>6-Digit OTP Code</label>
                                            {name && password && (
                                                <button
                                                    type="button"
                                                    onClick={dispatchVerificationEmail}
                                                    disabled={isSubmitting || resendCooldown > 0}
                                                    className="btn-unstyled text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-0 cursor-pointer"
                                                >
                                                    <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                maxLength={6}
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                placeholder="• • • • • •"
                                                disabled={isSubmitting}
                                                className={`${inputClass} text-center tracking-[0.45em] font-mono text-base font-extrabold`}
                                                required
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 ml-1">
                                            Tip: You can enter the 6-digit code above <strong>or</strong> click the redirect button directly inside the email.
                                        </p>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting || otp.length !== 6}
                                        className={primaryBtnClass}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                <span>Verifying &amp; Creating Account...</span>
                                            </>
                                        ) : (
                                            <span>Verify &amp; Create Account</span>
                                        )}
                                    </button>
                                </>
                            )}
                        </form>
                    )}

                    <div className="relative py-0.5">
                        <div className="w-full border-t border-slate-200 dark:border-white/[0.08]" />
                    </div>

                    <p className="text-center text-slate-500 dark:text-slate-400 font-medium text-xs">
                        Already have an account?{' '}
                        <button
                            type="button"
                            onClick={onSwitchToLogin}
                            className="btn-unstyled text-indigo-600 dark:text-indigo-400 hover:underline font-semibold ml-1 cursor-pointer bg-transparent border-0"
                        >
                            Sign In
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterScreen;
