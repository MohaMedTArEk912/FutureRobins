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
import { AmbientBackground } from './AmbientBackground';
import { AnimatedCharacter } from './AnimatedCharacter.tsx';
import { api, type UserData } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { AuthThemeButton } from './common/AuthThemeButton';
import { getStoredMascotGender, setStoredMascotGender, type MascotGender } from '../utils/mascotGenderStorage';

interface RegisterScreenProps {
    onVerified: (user: UserData, token: string) => void;
    onSwitchToLogin: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onVerified, onSwitchToLogin }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { isBento } = useTheme();
    const { isArabic, tx } = useLanguage();

    const [step, setStep] = useState<'details' | 'verify'>('details');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [gender, setGender] = useState<MascotGender>(() => getStoredMascotGender());
    const [showPassword, setShowPassword] = useState(false);

    const handleGenderChange = (nextGender: MascotGender) => {
        setGender(nextGender);
        setStoredMascotGender(nextGender);
    };

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
            setInfo(tx('Email verified! Signing you in...', 'تم تأكيد الإيميل! بندخلك دلوقتي...'));
            onVerified(res.user, res.token);
            return;
        }
        if (res.alreadyVerified) {
            setAlreadyVerified(true);
            setInfo(res.message || tx('Your email is already verified! Please sign in to continue.', 'إيميلك متفعل أصلاً! سجل دخول عشان تكمل.'));
            return;
        }
        setError(tx('Verification succeeded without a session token. Please sign in.', 'التأكيد تم، سجل دخول دلوقتي عشان تكمل.'));
    }, [onVerified, tx]);

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
        setInfo(tx('Verifying your email link...', 'جاري التحقق من رابط الإيميل...'));
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
                setError(err instanceof Error ? err.message : tx('Email link verification failed. You can enter your 6-digit OTP code or resend.', 'الرابط منفعش، اكتب كود التفعيل الـ 6 أرقام أو ابعته تاني.'));
            })
            .finally(() => {
                setIsRedirectVerifying(false);
            });
    }, [searchParams, handleVerificationResponse, tx]);

    const dispatchVerificationEmail = async () => {
        const normalizedEmail = email.toLowerCase().trim();
        const trimmedName = name.trim();

        if (!trimmedName || trimmedName.length < 2) {
            setError(tx('Full name must be at least 2 characters', 'الاسم لازم يكون حرفين على الأقل'));
            return;
        }
        if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setError(tx('Please provide a valid email address', 'لو سمحت اكتب إيميل صحيح'));
            return;
        }
        if (!password || password.length < 6) {
            setError(tx('Password must be at least 6 characters long', 'كلمة السر لازم تكون 6 حروف على الأقل'));
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
                password,
                gender
            });
            setEmail(res.email || normalizedEmail);
            setStep('verify');
            setOtp('');
            setAlreadyVerified(false);
            if (res.previewUrl) setPreviewUrl(res.previewUrl);
            setResendCooldown(60);
            setInfo(
                res.message ||
                    tx(
                        `We sent a 6-digit OTP code and verification link to ${res.email || normalizedEmail}.`,
                        `بعتنالك كود تفعيل من 6 أرقام ورابط تأكيد على ${res.email || normalizedEmail}.`
                    )
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : tx('Could not send verification email', 'مقدرناش نبعت إيميل التحقق، جرب تاني'));
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
            setError(tx('Please enter the 6-digit verification code sent to your email.', 'اكتب الكود المكون من 6 أرقام اللي اتبعتلك على الإيميل.'));
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
            setError(err instanceof Error ? err.message : tx('Verification failed. Please check the code and try again.', 'التفعيل منفعش، اتأكد من الكود وجرب تاني.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = `w-full ps-11 pe-4 py-3 text-sm font-medium disabled:opacity-50 transition-all ${
        isBento
            ? 'bg-white border-[2.5px] border-black rounded-xl text-black placeholder-gray-500 focus:outline-none focus:shadow-[4px_4px_0px_#000] shadow-[2px_2px_0px_#000]'
            : 'bg-[#141210] border border-[#f5f3ec]/14 rounded-2xl text-[#f5f3ec] placeholder-[#78716c] focus:outline-none focus:border-[#bef264] focus:ring-3 focus:ring-[#bef264]/15 shadow-sm'
    }`;

    const primaryBtnClass = isBento
        ? 'btn-unstyled w-full py-3.5 bg-[#bef264] text-black rounded-xl border-[2.5px] border-black shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:shadow-[1px_1px_0px_#000] active:translate-y-0.5 font-black text-sm uppercase tracking-wider flex justify-center items-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed'
        : 'w-full py-3.5 bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] font-black text-sm rounded-2xl shadow-[0_10px_28px_-6px_rgba(190,242,100,0.35)] active:scale-[0.985] disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer transition-all';

    const labelClass = `block text-xs ms-1 mb-1.5 transition-colors ${
        isBento
            ? 'text-black font-black uppercase tracking-wider'
            : 'font-semibold text-[#d6d0c7] group-focus-within:text-[#bef264]'
    }`;

    const iconClass = `absolute start-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors ${
        isBento ? 'text-black' : 'text-[#888177] group-focus-within:text-[#bef264]'
    }`;

    return (
        <div className={`min-h-dvh flex relative overflow-hidden selection:bg-[#bef264]/28 ${
            isBento
                ? 'bg-[#f5f3ec] text-black'
                : 'bg-[#0a0908] text-[#f5f3ec]'
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

            {/* Top Start Back to Home */}
            <div className="absolute top-6 start-6 z-50 mt-safe ms-safe">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className={`btn-unstyled flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer active:scale-95 ${
                        isBento
                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047] font-black'
                            : 'bg-[#1c1917] border border-[#2e2924] hover:border-[#bef264]/60 hover:bg-[#24201c] text-[#f5f3ec] font-bold'
                    }`}
                    title={tx('Return to Home', 'الرجوع للرئيسية')}
                    aria-label={tx('Return to Home', 'الرجوع للرئيسية')}
                >
                    <ArrowLeft className={`w-4 h-4 shrink-0 ${isArabic ? 'rotate-180' : ''}`} />
                    <span className="text-xs hidden sm:inline">{tx('Home', 'الرئيسية')}</span>
                </button>
            </div>

            {/* Top End Change Theme */}
            <AuthThemeButton />

            {/* Left Column - Mascot & Branding (Matches LoginScreen 1:1) */}
            <div className={`hidden lg:flex flex-col flex-[1.2] relative z-10 items-center justify-center p-12 login-mascot-col ${
                isBento
                    ? 'bg-[#bef264] border-e-[3px] border-black'
                    : 'bg-transparent'
            }`}>
                {/* Bento decorative elements */}
                {isBento && (
                    <>
                        <div className="absolute top-8 left-8 w-12 h-12 bg-[#fde047] border-[2.5px] border-black rounded-xl shadow-[3px_3px_0px_#000] rotate-12 z-0" />
                        <div className="absolute top-16 right-12 w-8 h-8 bg-[#bae6fd] border-[2.5px] border-black rounded-full shadow-[2px_2px_0px_#000] z-0" />
                        <div className="absolute bottom-12 left-16 w-10 h-10 bg-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] rotate-45 z-0" />
                        <div className="absolute bottom-8 right-8 w-6 h-6 bg-[#fed7aa] border-[2px] border-black rounded-lg shadow-[2px_2px_0px_#000] -rotate-12 z-0" />
                        <div className="absolute top-1/3 left-6 w-4 h-4 bg-black rounded-full z-0" />
                        <div className="absolute bottom-1/3 right-10 w-3 h-3 bg-black rotate-45 z-0" />
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
                    <div className={`w-[340px] sm:w-[380px] h-[340px] sm:h-[380px] flex items-center justify-center mb-4 mascot-card-wrapper transition-all ${
                        isBento
                            ? 'bg-white rounded-[2rem] border-[3px] border-black shadow-[7px_7px_0px_#000] p-5 relative'
                            : ''
                    }`}>
                        <AnimatedCharacter
                            isEmailFocused={isEmailFocused || step === 'verify'}
                            isPasswordFocused={isPasswordFocused}
                            showPassword={showPassword}
                            gender={gender}
                        />
                    </div>

                    {/* Interactive Boy / Girl Character Switcher */}
                    <div className={`inline-flex items-center gap-1.5 p-1.5 rounded-2xl mb-5 ${
                        isBento
                            ? 'bg-white border-[2.5px] border-black shadow-[4px_4px_0px_#000]'
                            : 'bg-[#141210]/90 border border-[#2e2924] backdrop-blur-md'
                    }`}>
                        {(['male', 'female'] as const).map((g) => {
                            const active = gender === g;
                            const label = g === 'male'
                                ? (isBento ? tx('Boy (Lewis)', 'ولد (لويس)') : tx('Boy (Wilbur)', 'ولد (ويلبور)'))
                                : (isBento ? tx('Girl (Robin)', 'بنت (روبين)') : tx('Girl (Franny)', 'بنت (فراني)'));
                            return (
                                <button
                                    key={g}
                                    type="button"
                                    onClick={() => handleGenderChange(g)}
                                    className={`btn-unstyled px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                        active
                                            ? isBento
                                                ? g === 'male'
                                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : g === 'male'
                                                    ? 'bg-[#00e5ff] text-[#071122] shadow-sm'
                                                    : 'bg-[#f43f5e] text-white shadow-sm'
                                            : isBento
                                                ? 'text-black/70 hover:text-black border-2 border-transparent'
                                                : 'text-[#a8a29e] hover:text-[#f5f3ec]'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="text-center space-y-2">
                        <h1 className={`text-4xl font-extrabold tracking-tight ${
                            isBento ? 'text-black' : 'text-[#f5f3ec]'
                        }`}>
                            {step === 'verify' ? (
                                <>{tx('Verify your', 'أكّد')}{' '}<span className="bento-highlight">{tx('inbox', 'إيميلك')}</span></>
                            ) : (
                                <>{tx('Join the', 'انضم')}{' '}<span className="bento-highlight">{tx('ranks', 'للأبطال')}</span></>
                            )}
                        </h1>
                        <p className={`text-base max-w-sm mx-auto ${
                            isBento ? 'text-gray-800 font-semibold' : 'text-[#a8a29e]'
                        }`}>
                            {step === 'verify'
                                ? tx('Confirm your email via 6-digit OTP or the verification redirect link to activate your account.', 'أكد إيميلك بالكود الـ 6 أرقام أو رابط التفعيل عشان تفتح حسابك.')
                                : tx('Create your learner profile and confirm your email address to start climbing.', 'اعمل حسابك وأكد إيميلك عشان تبدأ تتعلم وتنافس مع زمايلك.')}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 select-none">
                            <span className="bento-badge-tag bg-[#fde047] text-black -rotate-1">&ldquo;{tx('NEW COHORT', 'دفعة جديدة')}&rdquo;</span>
                            <span className="bento-badge-tag bg-[#0d9488] text-white rotate-1">&ldquo;{tx('OTP OR LINK', 'كود أو رابط')}&rdquo;</span>
                            <span className="bento-badge-tag bg-[#bef264] text-black -rotate-1">&ldquo;{tx('DUEL LIVE', 'تحدي لايف')}&rdquo;</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column - Form (Exact LoginScreen 2-Half Layout) */}
            <div className={`flex-1 flex flex-col justify-center items-center p-6 lg:p-10 relative z-10 w-full animate-in fade-in duration-500 ${
                isBento ? 'bg-white' : ''
            }`}>
                <div
                    data-snake-wall="card"
                    className={`w-full max-w-md space-y-5 ${
                        isBento
                            ? ''
                            : 'bg-[#141210] border-[1.5px] border-[#2e2924] rounded-3xl p-6 sm:p-8 shadow-[0_6px_0_#050504]'
                    }`}
                >
                    {/* Mobile Mascot & Heading */}
                    <div className="lg:hidden text-center mb-2 pt-6">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className={`btn-unstyled w-24 h-24 mx-auto mb-2.5 rounded-2xl relative flex items-center justify-center cursor-pointer active:scale-95 transition-transform p-1.5 ${
                                isBento
                                    ? 'bg-[#bef264] border-[2.5px] border-black shadow-[4px_4px_0px_#000]'
                                    : 'bg-[#0b1628]/80 border border-[#00e5ff]/30'
                            }`}
                            aria-label={tx('Return to Home', 'الرجوع للرئيسية')}
                        >
                            <AnimatedCharacter
                                isEmailFocused={isEmailFocused || step === 'verify'}
                                isPasswordFocused={isPasswordFocused}
                                showPassword={showPassword}
                                gender={gender}
                                compact
                            />
                        </button>
                        <h1 className={`text-2xl font-extrabold tracking-tight ${
                            isBento ? 'text-black' : 'text-[#f5f3ec]'
                        }`}>
                            {step === 'verify' ? tx('Verify Your Email', 'تفعيل الإيميل') : tx('Create Account', 'إنشاء حساب جديد')}
                        </h1>
                    </div>

                    {/* Step Indicator + Heading */}
                    <div className="text-start space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full ${
                                isBento
                                    ? 'bg-[#bae6fd] text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#192211] text-[#bef264] font-black uppercase border border-[#bef264]/40'
                            }`}>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{step === 'verify' ? tx('Step 2 of 2 • Email Verification', 'خطوة 2 من 2 • تفعيل الإيميل') : tx('Step 1 of 2 • Account Info', 'خطوة 1 من 2 • بيانات الحساب')}</span>
                            </span>
                        </div>
                        <div className="hidden lg:block pt-1">
                            <h2 className={`text-3xl font-extrabold tracking-tight ${
                                isBento ? 'text-black' : 'text-[#f5f3ec]'
                            }`}>
                                {step === 'verify' ? tx('Verify Your Email', 'تفعيل الإيميل') : tx('Create Account', 'إنشاء حساب جديد')}
                            </h2>
                            <p className={`text-sm mt-1 ${
                                isBento ? 'text-gray-600 font-semibold' : 'text-[#a8a29e]'
                            }`}>
                                {step === 'verify'
                                    ? tx('Enter the 6-digit OTP code or open the link we emailed you.', 'اكتب الكود المكون من 6 أرقام أو افتح الرابط اللي بعتناه على إيميلك.')
                                    : tx('We will verify that your email works before creating your account.', 'هنتأكد إن إيميلك شغال الأول قبل ما نفعّل حسابك.')}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className={`p-3.5 flex items-center gap-2.5 text-xs font-semibold animate-shake ${
                            isBento
                                ? 'bg-[#fde047] text-black border-[2.5px] border-black rounded-xl shadow-[3px_3px_0px_#000] font-black'
                                : 'bg-[#2a1418] border border-[#fb7185]/45 text-[#fb7185] rounded-2xl'
                        }`}>
                            <div className={`w-1.5 h-1.5 shrink-0 rounded-full animate-pulse ${isBento ? 'bg-black' : 'bg-[#fb7185]'}`} />
                            <span>{error}</span>
                        </div>
                    )}

                    {info && (
                        <div className={`p-3.5 flex items-start gap-2.5 text-xs font-semibold ${
                            isBento
                                ? 'bg-[#dcfce7] border-[2.5px] border-black text-black rounded-xl shadow-[3px_3px_0px_#000] font-bold'
                                : 'bg-[#192211] border border-[#bef264]/40 text-[#bef264] rounded-2xl'
                        }`}>
                            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                            <div className="space-y-1">
                                <span>{info}</span>
                                {previewUrl && (
                                    <div>
                                        <a
                                            href={previewUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`inline-flex items-center gap-1 underline font-black ${isBento ? 'text-black' : 'text-[#fde047]'}`}
                                        >
                                            <span>{tx('Open Ethereal Test Inbox Preview', 'فتح معاينة الإيميل التجريبي')}</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'details' ? (
                        <form onSubmit={handleRequestSubmit} className="space-y-4">
                            <div>
                                <label className={labelClass}>{tx('Character Companion', 'الشخصية المرافقة')}</label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    {(['male', 'female'] as const).map((g) => {
                                        const active = gender === g;
                                        return (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => handleGenderChange(g)}
                                                disabled={isSubmitting}
                                                className={`btn-unstyled py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                                    active
                                                        ? isBento
                                                            ? g === 'male'
                                                                ? 'bg-[#fde047] text-black border-[2.5px] border-black shadow-[3px_3px_0px_#000]'
                                                                : 'bg-[#bae6fd] text-black border-[2.5px] border-black shadow-[3px_3px_0px_#000]'
                                                            : g === 'male'
                                                                ? 'bg-[#0b2538] text-[#67e8f9] border border-[#00e5ff]'
                                                                : 'bg-[#2a131d] text-[#fda4af] border border-[#f43f5e]'
                                                        : isBento
                                                            ? 'bg-white text-black/75 border-2 border-black/30 hover:border-black'
                                                            : 'bg-[#1a1714] text-[#a8a29e] border border-[#2e2924] hover:border-[#f5f3ec]/40'
                                                }`}
                                            >
                                                <span>{g === 'male' ? tx('Boy', 'ولد') : tx('Girl', 'بنت')}</span>
                                                <span className="opacity-65 text-[10px]">
                                                    ({g === 'male' ? (isBento ? 'Lewis' : 'Wilbur') : (isBento ? 'Robin' : 'Franny')})
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="group">
                                <label className={labelClass}>{tx('Full Name', 'الاسم بالكامل')}</label>
                                <div className="relative">
                                    <User className={iconClass} />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={tx('Alex Mercer', 'الاسم ثلاثي أو ثنائي')}
                                        disabled={isSubmitting}
                                        className={inputClass}
                                        autoComplete="name"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label className={labelClass}>{tx('Email Address', 'البريد الإلكتروني')}</label>
                                <div className="relative">
                                    <Mail className={iconClass} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onFocus={() => setIsEmailFocused(true)}
                                        onBlur={() => setIsEmailFocused(false)}
                                        placeholder="lewis@futurerobins.com"
                                        disabled={isSubmitting}
                                        className={inputClass}
                                        autoComplete="email"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label className={labelClass}>{tx('Password', 'كلمة السر')}</label>
                                <div className="relative">
                                    <Lock className={iconClass} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setIsPasswordFocused(true)}
                                        onBlur={() => setIsPasswordFocused(false)}
                                        placeholder={tx('At least 6 characters', 'على الأقل 6 حروف أو أرقام')}
                                        disabled={isSubmitting}
                                        className={`${inputClass} pe-11`}
                                        autoComplete="new-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={isSubmitting}
                                        className={`btn-unstyled absolute end-4 top-1/2 -translate-y-1/2 p-1 transition-colors bg-transparent border-0 ${
                                            isBento ? 'text-black hover:text-gray-600' : 'text-[#888177] hover:text-[#f5f3ec]'
                                        }`}
                                        title={showPassword ? tx('Hide password', 'إخفاء كلمة السر') : tx('Show password', 'إظهار كلمة السر')}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" disabled={isSubmitting} className={`${primaryBtnClass} mt-2`}>
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>{tx('Sending Verification Email...', 'بنبعتلك إيميل التحقق...')}</span>
                                    </>
                                ) : (
                                    <span>{isBento ? tx('⚡ VERIFY EMAIL & CONTINUE', '⚡ تحقق من الإيميل وكمل') : tx('Verify Email & Continue', 'تحقق من الإيميل وكمل')}</span>
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
                                <span>{tx('Proceed to Sign In', 'روح لتسجيل الدخول')}</span>
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                            <div className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
                                isBento
                                    ? 'bg-[#fef08a] border-2 border-black text-black font-bold shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#1c1917] border border-[#2e2924] text-[#d6d0c7]'
                            }`}>
                                <div className="truncate">
                                    <span className="opacity-75">{tx('Sent to: ', 'اتبعَت لـ: ')}</span>
                                    <strong className="font-bold ltr-isolate">{email || tx('your email', 'إيميلك')}</strong>
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
                                        <ArrowLeft className={`w-3 h-3 ${isArabic ? 'rotate-180' : ''}`} />
                                        <span>{tx('Edit', 'تعديل')}</span>
                                    </button>
                                )}
                            </div>

                            {isRedirectVerifying ? (
                                <div className="py-6 flex flex-col items-center justify-center gap-2 text-sm font-bold">
                                    <RefreshCw className={`w-6 h-6 animate-spin ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                    <span>{tx('Confirming your verification link...', 'بنتأكد من رابط التفعيل...')}</span>
                                </div>
                            ) : (
                                <>
                                    <div className="group">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className={`${labelClass} mb-0`}>{tx('6-Digit OTP Code', 'كود التفعيل (6 أرقام)')}</label>
                                            {name && password && (
                                                <button
                                                    type="button"
                                                    onClick={dispatchVerificationEmail}
                                                    disabled={isSubmitting || resendCooldown > 0}
                                                    className={`btn-unstyled text-xs font-black hover:underline disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-0 cursor-pointer ${
                                                        isBento ? 'text-black underline decoration-2 underline-offset-2' : 'text-[#fde047]'
                                                    }`}
                                                >
                                                    <span>
                                                        {resendCooldown > 0
                                                            ? tx(`Resend in ${resendCooldown}s`, `إعادة الإرسال بعد ${resendCooldown}ث`)
                                                            : tx('Resend Code', 'ابعت الكود تاني')}
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <KeyRound className={iconClass} />
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                maxLength={6}
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                placeholder="• • • • • •"
                                                disabled={isSubmitting}
                                                className={`${inputClass} text-center tracking-[0.45em] font-mono text-base font-extrabold ltr-isolate`}
                                                required
                                            />
                                        </div>
                                        <p className={`text-[11px] mt-1.5 ms-1 ${isBento ? 'text-gray-700 font-semibold' : 'text-[#a8a29e]'}`}>
                                            {tx('Tip: You can enter the 6-digit code above', 'تقدر تكتب الكود المكون من 6 أرقام فوق')}{' '}
                                            <strong>{tx('or', 'أو')}</strong>{' '}
                                            {tx('click the redirect button directly inside the email.', 'تضغط على زرار التفعيل مباشرة جوه الإيميل.')}
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
                                                <span>{tx('Verifying & Creating Account...', 'بنفعل الحساب ونجهزه...')}</span>
                                            </>
                                        ) : (
                                            <span>{isBento ? tx('⚡ VERIFY & CREATE ACCOUNT', '⚡ تفعيل وإنشاء الحساب') : tx('Verify & Create Account', 'تفعيل وإنشاء الحساب')}</span>
                                        )}
                                    </button>
                                </>
                            )}
                        </form>
                    )}

                    <div className="relative py-1">
                        <div className={`w-full ${isBento ? 'border-t-[2px] border-black' : 'border-t border-[#f5f3ec]/10'}`} />
                    </div>

                    <p className={`text-center font-medium text-xs ${
                        isBento ? 'text-gray-600' : 'text-[#a8a29e]'
                    }`}>
                        {tx('Already have an account?', 'عندك حساب أصلاً؟')}{' '}
                        <button
                            type="button"
                            onClick={onSwitchToLogin}
                            className={`btn-unstyled ms-1 cursor-pointer bg-transparent border-0 ${
                                isBento
                                    ? 'text-black underline decoration-2 underline-offset-2 font-black hover:no-underline'
                                    : 'text-[#bef264] font-semibold hover:underline'
                            }`}
                        >
                            {tx('Sign In', 'سجل دخول')}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterScreen;
