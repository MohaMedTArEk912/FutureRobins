import React, { useId, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Mail,
    Send,
    Sparkles,
    LifeBuoy,
    Loader2,
    AlertCircle,
    CheckCircle2,
    BellRing,
    ArrowUp,
    X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useSecretGame } from '../context/SecretGameContext';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import Modal from './common/Modal';

const Footer: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, isBento } = useTheme();
    const { launchNoirSnake, launchBentoArcade } = useSecretGame();
    const { showNotification } = useNotification();
    const { currentUser } = useAuth();
    const { tx } = useLanguage();

    const [emailInput, setEmailInput] = useState('');
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [isAlreadySubscribed, setIsAlreadySubscribed] = useState<boolean>(false);
    const [subscribedEmail, setSubscribedEmail] = useState<string>('');
    const [isUnsubscribing, setIsUnsubscribing] = useState(false);
    const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'faq' | 'support' | null>(null);

    const supportFormId = useId();

    // Support Form State
    const [supportEmail, setSupportEmail] = useState('');
    const [supportName, setSupportName] = useState('');
    const [supportCategory, setSupportCategory] = useState<'technical' | 'bug' | 'scoring' | 'account' | 'feature' | 'general'>('general');
    const [supportSubject, setSupportSubject] = useState('');
    const [supportMessage, setSupportMessage] = useState('');
    const [supportError, setSupportError] = useState('');
    const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

    // Auto-fill user credentials when opening support modal
    useEffect(() => {
        if (activeModal === 'support') {
            if (currentUser?.email && !supportEmail) {
                setSupportEmail(currentUser.email);
            }
            if (currentUser?.name && !supportName) {
                setSupportName(currentUser.name);
            }
        }
    }, [activeModal, currentUser, supportEmail, supportName]);

    // Check Weekly Challenges newsletter subscription status tied to the current authenticated user
    useEffect(() => {
        let isMounted = true;

        const checkSubscription = async () => {
            // Case 1: An authenticated user is logged in
            if (currentUser?.email || currentUser?.userId) {
                const targetEmail = currentUser?.email || '';
                try {
                    const status = await api.getNewsletterStatus(targetEmail, currentUser?.userId);
                    if (!isMounted) return;

                    if (status.subscribed) {
                        const verified = status.email || targetEmail;
                        setIsAlreadySubscribed(true);
                        setSubscribedEmail(verified);
                        localStorage.setItem('weekly_challenge_subscriber', JSON.stringify({
                            email: verified,
                            subscribed: true,
                            userId: currentUser?.userId
                        }));
                    } else {
                        setIsAlreadySubscribed(false);
                        setSubscribedEmail('');
                        localStorage.removeItem('weekly_challenge_subscriber');
                    }
                } catch {
                    // Offline / fallback: only use cached subscription if it strictly matches this logged-in user
                    if (!isMounted) return;
                    try {
                        const saved = localStorage.getItem('weekly_challenge_subscriber');
                        if (saved) {
                            const parsed = JSON.parse(saved);
                            if (parsed.subscribed && targetEmail && parsed.email?.toLowerCase() === targetEmail.toLowerCase()) {
                                setIsAlreadySubscribed(true);
                                setSubscribedEmail(parsed.email);
                                return;
                            }
                        }
                    } catch {
                        // ignore parse errors
                    }
                    setIsAlreadySubscribed(false);
                    setSubscribedEmail('');
                }
                return;
            }

            // Case 2: Visitor is NOT logged in (Guest or Logged Out)
            // Immediately purge any stale user subscription from localStorage to prevent leaking other accounts' emails
            localStorage.removeItem('weekly_challenge_subscriber');

            // Only recognize subscription if an anonymous visitor explicitly subscribed in the current browser session
            const anonSaved = sessionStorage.getItem('weekly_challenge_anon_subscriber');
            if (anonSaved) {
                try {
                    const parsed = JSON.parse(anonSaved);
                    if (parsed.subscribed && parsed.email) {
                        const status = await api.getNewsletterStatus(parsed.email);
                        if (!isMounted) return;
                        if (status.subscribed) {
                            setIsAlreadySubscribed(true);
                            setSubscribedEmail(status.email || parsed.email);
                            return;
                        } else {
                            sessionStorage.removeItem('weekly_challenge_anon_subscriber');
                        }
                    }
                } catch {
                    sessionStorage.removeItem('weekly_challenge_anon_subscriber');
                }
            }

            if (isMounted) {
                setIsAlreadySubscribed(false);
                setSubscribedEmail('');
            }
        };

        checkSubscription();

        return () => {
            isMounted = false;
        };
    }, [currentUser?.email, currentUser?.userId]);

    /**
     * Smoothly navigates to target path and scrolls the viewport to the top of the section/page.
     */
    const handleFooterNav = (path: string, targetId?: string) => {
        const isSamePath = location.pathname === path;

        if (targetId) {
            const el = document.getElementById(targetId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
        }

        if (isSamePath) {
            window.scrollTo({
                top: 0,
                left: 0,
                behavior: 'smooth'
            });
        } else {
            navigate(path);
            window.scrollTo({
                top: 0,
                left: 0,
                behavior: 'smooth'
            });

            // Extra safety tick after router re-renders destination view
            setTimeout(() => {
                if (targetId) {
                    const el = document.getElementById(targetId);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        return;
                    }
                }
                window.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: 'smooth'
                });
            }, 60);
        }
    };

    const handleSupportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSupportError('');
        const trimmedEmail = supportEmail.trim();
        const trimmedSubject = supportSubject.trim();
        const trimmedMessage = supportMessage.trim();

        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            const err = tx('Please provide a valid email address.', 'من فضلك اكتب بريد إلكتروني صحيح.');
            setSupportError(err);
            showNotification('error', err);
            return;
        }
        if (trimmedSubject.length < 3) {
            const err = tx('Subject must be at least 3 characters.', 'الموضوع لازم يكون 3 حروف على الأقل.');
            setSupportError(err);
            showNotification('error', err);
            return;
        }
        if (trimmedMessage.length < 5) {
            const err = tx('Please provide a description of your issue (at least 5 characters).', 'من فضلك اوصف المشكلة (5 حروف على الأقل).');
            setSupportError(err);
            showNotification('error', err);
            return;
        }

        setIsSubmittingSupport(true);
        try {
            const response = await api.submitSupportTicket({
                email: trimmedEmail,
                name: supportName.trim() || currentUser?.name || undefined,
                subject: trimmedSubject,
                category: supportCategory,
                message: trimmedMessage
            });

            showNotification(
                'success',
                response.message || tx(
                    `Ticket #${response.ticketId || ''} dispatched! We will reply within 24 hours.`,
                    `تم إرسال التذكرة #${response.ticketId || ''}! هنرد عليك خلال 24 ساعة.`
                )
            );
            setSupportSubject('');
            setSupportMessage('');
            setSupportError('');
            setActiveModal(null);
        } catch (error: unknown) {
            console.error('Failed to submit support ticket:', error);
            const err = error as Error;
            const msg = err.message || tx(
                'Failed to dispatch ticket. You can email us directly at mohaamedtariq12@gmail.com.',
                'فشل إرسال التذكرة. تقدر تراسلنا مباشرة على mohaamedtariq12@gmail.com.'
            );
            setSupportError(msg);
            showNotification('error', msg);
        } finally {
            setIsSubmittingSupport(false);
        }
    };

    const currentYear = new Date().getFullYear();

    const handleNewsletterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const email = emailInput.trim();
        if (!email || !email.includes('@')) {
            showNotification('error', tx('Please enter a valid email address.', 'من فضلك اكتب بريد إلكتروني صحيح.'));
            return;
        }

        setIsSubscribing(true);
        try {
            const res = await api.subscribeNewsletter(email, currentUser?.name);
            setIsAlreadySubscribed(true);
            setSubscribedEmail(email);
            if (currentUser) {
                localStorage.setItem('weekly_challenge_subscriber', JSON.stringify({
                    email,
                    subscribed: true,
                    userId: currentUser?.userId
                }));
            } else {
                sessionStorage.setItem('weekly_challenge_anon_subscriber', JSON.stringify({
                    email,
                    subscribed: true
                }));
            }
            setEmailInput('');
            showNotification('success', res.message || tx(
                '🎉 Subscribed! You will be notified automatically anytime challenges drop.',
                '🎉 تم الاشتراك! هيوصلك إشعار تلقائي أول ما تنزل تحديات جديدة.'
            ));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : tx('Failed to subscribe. Please try again.', 'فشل الاشتراك. حاول تاني.');
            showNotification('error', msg);
        } finally {
            setIsSubscribing(false);
        }
    };

    const handleUnsubscribe = async () => {
        const target = subscribedEmail || currentUser?.email;
        if (!target) {
            setIsAlreadySubscribed(false);
            setSubscribedEmail('');
            localStorage.removeItem('weekly_challenge_subscriber');
            sessionStorage.removeItem('weekly_challenge_anon_subscriber');
            return;
        }

        setIsUnsubscribing(true);
        try {
            const res = await api.unsubscribeNewsletter(target);
            setIsAlreadySubscribed(false);
            setSubscribedEmail('');
            localStorage.removeItem('weekly_challenge_subscriber');
            sessionStorage.removeItem('weekly_challenge_anon_subscriber');
            showNotification('success', res.message || tx(
                'You have unsubscribed from Weekly Challenges notifications.',
                'تم إلغاء اشتراكك في إشعارات التحديات الأسبوعية.'
            ));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : tx('Failed to unsubscribe.', 'فشل إلغاء الاشتراك.');
            showNotification('error', msg);
        } finally {
            setIsUnsubscribing(false);
        }
    };

    if (currentUser?.role === 'teacher') {
        return null;
    }

    return (
        <>
            <footer data-snake-wall="bottom" className={`noir-footer relative z-10 w-full mt-auto border-t transition-colors ${
                isBento
                    ? 'bg-white text-black border-t-[3px] border-black shadow-[0_-4px_0px_#000]'
                    : 'bg-slate-900 dark:bg-[#0e0d0b] text-slate-300 dark:text-[#b5aea4] border-slate-800 dark:border-[#2a2621]'
            }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24 md:pt-10 xl:pb-7">
                    {/* Main Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-7 lg:gap-8 pb-7">
                        {/* Brand Column (4 cols) */}
                        <div className="sm:col-span-2 lg:col-span-4 space-y-3.5">
                            <button
                                type="button"
                                onClick={() => handleFooterNav('/')}
                                className="logo-btn inline-flex items-center gap-2.5 group cursor-pointer text-start outline-none focus:outline-none border-0"
                                aria-label={tx('Quiz Platform Home', 'الصفحة الرئيسية لمنصة Quiz Platform')}
                            >
                                <div className="flex flex-col leading-tight">
                                    <span className={`text-base font-black tracking-tight ${
                                        isBento ? 'text-black font-mono' : 'text-white dark:text-[#f5f3ec]'
                                    }`}>
                                        Quiz Platform
                                    </span>
                                    <span className={`text-[10px] uppercase font-extrabold tracking-[0.14em] ${
                                        isBento ? 'text-black/65 font-mono' : 'text-indigo-400 dark:text-[#fde047]'
                                    }`}>
                                        {tx('CS Learning Engine', 'محرك تعلّم علوم الحاسب')}
                                    </span>
                                </div>
                            </button>

                            <p className={`text-xs leading-relaxed max-w-xs ${
                                isBento ? 'text-slate-700 font-medium' : 'text-slate-400 dark:text-[#9c958b]'
                            }`}>
                                {tx(
                                    'Gamified computer science arena for mastering algorithms, languages, and systems architecture.',
                                    'منصة تعليمية تفاعلية لإتقان الخوارزميات ولغات البرمجة وهندسة الأنظمة.'
                                )}
                            </p>

                            {/* Compact Action Strip */}
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveModal('support')}
                                    className={`logo-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                        isBento
                                            ? 'bg-[#bae6fd] text-black border-[1.5px] border-black shadow-[2px_2px_0px_#000] hover:bg-[#7dd3fc]'
                                            : 'bg-slate-800 hover:bg-slate-700 dark:bg-[#171512] dark:hover:bg-[#1f1c18] text-slate-200 dark:text-[#f5f3ec] border border-slate-700 dark:border-[#2e2924]'
                                    }`}
                                >
                                    <LifeBuoy className={`w-3 h-3 ${isBento ? 'text-black' : 'text-indigo-400 dark:text-[#bae6fd]'}`} />
                                    <span>{tx('Need Help?', 'محتاج مساعدة؟')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                    className={`logo-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                        isBento
                                            ? 'bg-[#f5f3ec] text-black border-[1.5px] border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047]'
                                            : 'bg-slate-800/70 hover:bg-slate-700 dark:bg-[#171512] dark:hover:bg-[#1f1c18] text-slate-300 dark:text-[#a8a29e] dark:hover:text-[#f5f3ec] border border-slate-700/80 dark:border-[#2e2924]'
                                    }`}
                                    aria-label={tx('Back to top', 'العودة للأعلى')}
                                >
                                    <ArrowUp className="w-3 h-3" />
                                    <span>{tx('Top', 'أعلى')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Explore Links (2 cols) */}
                        <div className="lg:col-span-2 space-y-2.5">
                            <h4 className={`text-[11px] font-black uppercase tracking-[0.14em] flex items-center gap-2 ${
                                isBento ? 'text-black font-mono' : 'text-white dark:text-[#f5f3ec]'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-[2px] shrink-0 ${
                                    isBento ? 'bg-black' : 'bg-indigo-400 dark:bg-[#bef264]'
                                }`} />
                                {tx('Explore', 'استكشف')}
                            </h4>
                            <ul className="space-y-1.5 text-xs">
                                {[
                                    { path: '/', label: tx('Home Dashboard', 'لوحة التحكم') },
                                    { path: '/tracks', label: tx('Skill Tracks', 'مسارات التعلم') },
                                    { path: '/tournaments', label: tx('Tournaments', 'البطولات') },
                                    { path: '/daily', label: tx('Daily Challenge', 'التحدي اليومي') }
                                ].map((item) => (
                                    <li key={item.path}>
                                        <button
                                            type="button"
                                            onClick={() => handleFooterNav(item.path)}
                                            className={`transition-colors text-start cursor-pointer outline-none focus:outline-none border-0 ${
                                                isBento
                                                    ? 'text-slate-700 hover:text-black font-semibold hover:underline'
                                                    : 'text-slate-400 dark:text-[#a8a29e] hover:text-white dark:hover:text-[#bef264]'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Community Links (2 cols) */}
                        <div className="lg:col-span-2 space-y-2.5">
                            <h4 className={`text-[11px] font-black uppercase tracking-[0.14em] flex items-center gap-2 ${
                                isBento ? 'text-black font-mono' : 'text-white dark:text-[#f5f3ec]'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-[2px] shrink-0 ${
                                    isBento ? 'bg-black' : 'bg-sky-400 dark:bg-[#bae6fd]'
                                }`} />
                                {tx('Community', 'المجتمع')}
                            </h4>
                            <ul className="space-y-1.5 text-xs">
                                {[
                                    { path: '/leaderboard', label: tx('Global Rankings', 'الترتيب العالمي') },
                                    { path: '/clans', label: tx('Clans & Guilds', 'الكلانات والفرق') },
                                    { path: '/social', label: tx('1v1 Live Duels', 'مواجهات 1 ضد 1') },
                                    { path: '/shop', label: tx('Power-Up Shop', 'متجر المساعدات') }
                                ].map((item) => (
                                    <li key={item.path}>
                                        <button
                                            type="button"
                                            onClick={() => handleFooterNav(item.path)}
                                            className={`transition-colors text-start cursor-pointer outline-none focus:outline-none border-0 ${
                                                isBento
                                                    ? 'text-slate-700 hover:text-black font-semibold hover:underline'
                                                    : 'text-slate-400 dark:text-[#a8a29e] hover:text-white dark:hover:text-[#bae6fd]'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Compact Weekly Challenge Alerts (4 cols) */}
                        <div className="sm:col-span-2 lg:col-span-4 space-y-2.5">
                            <h4 className={`text-[11px] font-black uppercase tracking-[0.14em] flex items-center gap-1.5 ${
                                isBento ? 'text-black font-mono' : 'text-white dark:text-[#f5f3ec]'
                            }`}>
                                <Sparkles className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-indigo-400 dark:text-[#fde047]'}`} />
                                {tx('Weekly Alerts', 'تنبيهات التحديات')}
                            </h4>

                            {isAlreadySubscribed ? (
                                <div className={`px-3 py-2.5 rounded-xl border transition-all animate-in fade-in duration-200 max-w-sm ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-slate-800/80 dark:bg-[#161411] border-slate-700 dark:border-[#2e2924]'
                                }`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                                isBento
                                                    ? 'bg-black text-[#bef264]'
                                                    : 'bg-indigo-500/20 dark:bg-[#bef264] text-indigo-300 dark:text-[#0a0908]'
                                            }`}>
                                                <BellRing className="w-3.5 h-3.5" />
                                            </span>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[11px] font-black uppercase tracking-wider ${
                                                        isBento ? 'text-black' : 'text-white dark:text-[#f5f3ec]'
                                                    }`}>
                                                        {tx('Alerts On', 'الإشعارات مفعّلة')}
                                                    </span>
                                                    <CheckCircle2 className={`w-3 h-3 shrink-0 ${
                                                        isBento ? 'text-black' : 'text-emerald-400 dark:text-[#bef264]'
                                                    }`} />
                                                </div>
                                                {subscribedEmail && (
                                                    <div className={`flex items-center gap-1 text-[11px] font-mono truncate ${
                                                        isBento ? 'text-black/75 font-bold' : 'text-slate-400 dark:text-[#a8a29e]'
                                                    }`}>
                                                        <Mail className="w-2.5 h-2.5 shrink-0 opacity-75" />
                                                        <span className="truncate">{subscribedEmail}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleUnsubscribe}
                                            disabled={isUnsubscribing}
                                            title={tx('Unsubscribe or change email', 'إلغاء الاشتراك أو تغيير الإيميل')}
                                            className={`logo-btn inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
                                                isBento
                                                    ? 'bg-white text-black border-[1.5px] border-black hover:bg-[#fecdd3]'
                                                    : 'bg-slate-900/80 dark:bg-[#0e0d0b] text-slate-300 dark:text-[#a8a29e] hover:text-rose-400 dark:hover:text-[#fb7185] border border-slate-700 dark:border-[#2e2924]'
                                            }`}
                                        >
                                            {isUnsubscribing ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <>
                                                    <X className="w-3 h-3" />
                                                    <span>{tx('Off', 'إيقاف')}</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2 max-w-sm">
                                    <p className={`text-xs leading-snug ${
                                        isBento ? 'text-slate-700 font-medium' : 'text-slate-400 dark:text-[#9c958b]'
                                    }`}>
                                        {tx(
                                            'Get notified when new challenges & tracks drop.',
                                            'استلم إشعار أول ما تنزل تحديات ومسارات جديدة.'
                                        )}
                                    </p>
                                    <form onSubmit={handleNewsletterSubmit}>
                                        <div className="relative">
                                            <input
                                                type="email"
                                                value={emailInput}
                                                onChange={(e) => setEmailInput(e.target.value)}
                                                placeholder={tx('Enter your email', 'اكتب بريدك الإلكتروني')}
                                                disabled={isSubscribing}
                                                className={`w-full h-9 ps-3 pe-10 rounded-xl text-xs outline-none transition-all ${
                                                    isBento
                                                        ? 'bg-white border-2 border-black text-black font-bold focus:ring-2 focus:ring-black placeholder:text-slate-400 disabled:opacity-50'
                                                        : 'bg-slate-800/80 dark:bg-[#161411] border border-slate-700 dark:border-[#2e2924] text-white dark:text-[#f5f3ec] placeholder:text-slate-500 dark:placeholder:text-[#78716c] focus:border-indigo-500 dark:focus:border-[#bef264] disabled:opacity-50'
                                                }`}
                                            />
                                            <button
                                                type="submit"
                                                disabled={isSubscribing || !emailInput.trim()}
                                                className={`absolute end-1 top-1 bottom-1 px-2.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                                    isBento
                                                        ? 'bg-[#bef264] text-black border border-black hover:bg-[#a3e635]'
                                                        : 'bg-indigo-600 hover:bg-indigo-500 dark:bg-[#bef264] dark:hover:bg-[#d2fa8a] text-white dark:text-[#0a0908]'
                                                }`}
                                                aria-label={tx('Subscribe', 'اشتراك')}
                                            >
                                                {isSubscribing ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Send className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Bar */}
                    <div className={`pt-5 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] ${
                        isBento
                            ? 'border-t-2 border-black text-slate-800 font-semibold'
                            : 'border-slate-800 dark:border-[#23201c] text-slate-400 dark:text-[#888177]'
                    }`}>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
                            <span>&copy; {currentYear} Quiz Platform</span>
                            <span className="opacity-40">·</span>
                            <span>
                                {tx('Made by', 'تطوير')}{' '}
                                <span className={`font-bold ${
                                    isBento ? 'text-black font-black underline decoration-2' : 'text-indigo-400 dark:text-[#fde047]'
                                }`}>
                                    Mohamed Tarek
                                </span>
                            </span>
                            <span className="hidden sm:inline opacity-40">·</span>
                            <span className="hidden sm:inline">{tx('All rights reserved.', 'جميع الحقوق محفوظة.')}</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5 font-semibold">
                            <button
                                type="button"
                                onClick={() => setActiveModal('privacy')}
                                className={`transition-colors cursor-pointer outline-none focus:outline-none border-0 ${
                                    isBento ? 'hover:text-black hover:underline' : 'hover:text-white dark:hover:text-[#bef264]'
                                }`}
                            >
                                {tx('Privacy', 'الخصوصية')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveModal('terms')}
                                className={`transition-colors cursor-pointer outline-none focus:outline-none border-0 ${
                                    isBento ? 'hover:text-black hover:underline' : 'hover:text-white dark:hover:text-[#bef264]'
                                }`}
                            >
                                {tx('Terms', 'الشروط')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveModal('support')}
                                className={`btn-unstyled transition-colors cursor-pointer inline-flex items-center gap-1 outline-none focus:outline-none !border-0 !shadow-none ${
                                    isBento ? 'hover:text-black hover:underline' : 'hover:text-white dark:hover:text-[#bae6fd]'
                                }`}
                            >
                                <LifeBuoy className={`w-3 h-3 ${isBento ? 'text-black' : 'text-indigo-400 dark:text-[#bae6fd]'}`} />
                                {tx('Support', 'الدعم الفني')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveModal('faq')}
                                className={`transition-colors cursor-pointer outline-none focus:outline-none border-0 ${
                                    isBento ? 'hover:text-black hover:underline' : 'hover:text-white dark:hover:text-[#bef264]'
                                }`}
                            >
                                {tx('FAQ', 'الأسئلة الشائعة')}
                            </button>
                            {theme === 'dark' && !isBento && (
                                <button
                                    type="button"
                                    onClick={launchNoirSnake}
                                    title="// 0xSNAKE"
                                    aria-label={tx('Launch secret Noir Snake Arcade', 'تشغيل لعبة الثعبان السرية')}
                                    className="btn-unstyled group inline-flex items-center justify-center w-6 h-6 rounded-md border border-[#2e2924] bg-[#141210]/80 text-[#78716c] hover:border-[#bef264] hover:text-[#bef264] hover:bg-[#192211] transition-all cursor-pointer opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-1 focus-visible:outline-[#bef264]"
                                >
                                    <svg
                                        viewBox="0 0 16 16"
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <rect x="2" y="10" width="3" height="3" stroke="currentColor" strokeWidth="1.2" />
                                        <rect x="6.5" y="10" width="3" height="3" stroke="currentColor" strokeWidth="1.2" />
                                        <rect x="6.5" y="5.5" width="3" height="3" stroke="currentColor" strokeWidth="1.2" />
                                        <rect
                                            x="11"
                                            y="5.5"
                                            width="3.2"
                                            height="3.2"
                                            fill="currentColor"
                                            className="group-hover:fill-[#bef264]"
                                        />
                                    </svg>
                                </button>
                            )}
                            {isBento && (
                                <button
                                    type="button"
                                    onClick={launchBentoArcade}
                                    title="BENTO // ARCADE"
                                    aria-label={tx('Launch secret Bento Arcade', 'تشغيل أركيد بينتو السري')}
                                    className="btn-unstyled group inline-flex items-center justify-center w-6 h-6 rounded-md border-2 border-black bg-white/80 hover:bg-[#fde047] shadow-[1.5px_1.5px_0px_#000] hover:shadow-[2.5px_2.5px_0px_#000] hover:-translate-y-0.5 transition-all cursor-pointer opacity-75 hover:opacity-100"
                                >
                                    <svg
                                        viewBox="0 0 16 16"
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <rect x="2" y="2" width="5" height="5" rx="1" fill="#bef264" stroke="#000" strokeWidth="1.4" />
                                        <rect x="9" y="2" width="5" height="5" rx="1" fill="#bae6fd" stroke="#000" strokeWidth="1.4" />
                                        <rect x="2" y="9" width="12" height="5" rx="1" fill="#fde047" stroke="#000" strokeWidth="1.4" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </footer>

            {/* Privacy Policy Modal */}
            <Modal
                isOpen={activeModal === 'privacy'}
                onClose={() => setActiveModal(null)}
                title={tx('Privacy Policy', 'سياسة الخصوصية')}
                maxWidth="max-w-xl"
            >
                <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    <p className="font-bold text-slate-900 dark:text-white">{tx(`Last updated: ${currentYear}`, `آخر تحديث: ${currentYear}`)}</p>
                    <p>
                        {tx(
                            'At Quiz Platform, your privacy is our core priority. We only collect the minimal information necessary to deliver our educational experience, track learning progress, and facilitate multiplayer challenges.',
                            'في Quiz Platform خصوصيتك أولوية أساسية. بنجمع فقط الحد الأدنى من البيانات اللازمة لتقديم التجربة التعليمية ومتابعة تقدمك وتشغيل التحديات الجماعية.'
                        )}
                    </p>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tx('1. Information We Collect', '1. البيانات اللي بنجمعها')}</h4>
                    <p>
                        {tx(
                            'We collect your username, email address, avatar selections, quiz completion statistics, and scores. We do not sell or share personal data with third-party advertisers.',
                            'بنجمع اسم المستخدم، البريد الإلكتروني، الأفاتار، وإحصائيات الكويزات والنقاط. مبنبيعش أو نشارك بياناتك الشخصية مع أي جهات إعلانية.'
                        )}
                    </p>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tx('2. How We Use Information', '2. إزاي بنستخدم البيانات')}</h4>
                    <p>
                        {tx(
                            'Your statistics are used to compute leaderboard ranks, award achievement badges, customize recommendation paths, and display verified completion certificates.',
                            'بنستخدم إحصائياتك لحساب ترتيب لوحة المتصدرين، ومنح الشارات، وتخصيص مسارات التعلم، وعرض شهادات الإتمام الموثقة.'
                        )}
                    </p>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tx('3. Security', '3. الأمان')}</h4>
                    <p>
                        {tx(
                            'All passwords are cryptographically hashed, and data transmissions are encrypted using standard TLS protocols.',
                            'كل كلمات المرور مشفرة بالكامل، ونقل البيانات بيتم عبر بروتوكولات TLS القياسية المؤمنة.'
                        )}
                    </p>
                </div>
            </Modal>

            {/* Terms of Service Modal */}
            <Modal
                isOpen={activeModal === 'terms'}
                onClose={() => setActiveModal(null)}
                title={tx('Terms of Service', 'شروط الاستخدام')}
                maxWidth="max-w-xl"
            >
                <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    <p className="font-bold text-slate-900 dark:text-white">{tx(`Effective Date: ${currentYear}`, `تاريخ السريان: ${currentYear}`)}</p>
                    <p>
                        {tx(
                            'By using Quiz Platform, you agree to treat fellow learners respectfully, refrain from automated bot scraping, and maintain fair play during competitive multiplayer tournaments and duels.',
                            'باستخدامك Quiz Platform بتوافق على احترام باقي المتعلمين، والامتناع عن استخدام البوتات أو السكربتات الآلية، والالتزام باللعب النظيف في البطولات والمواجهات.'
                        )}
                    </p>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tx('1. Fair Play & Academic Integrity', '1. اللعب النظيف والنزاهة')}</h4>
                    <p>
                        {tx(
                            'Users are encouraged to learn through active recall. The use of automated scripts to artificially manipulate leaderboard scores or tournament results is strictly prohibited.',
                            'بنشجع التعلم الحقيقي والممارسة. ممنوع تماماً استخدام أي سكربتات آلية للتلاعب بالنقاط أو نتائج البطولات.'
                        )}
                    </p>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tx('2. Account Responsibility', '2. مسؤولية الحساب')}</h4>
                    <p>
                        {tx(
                            'You are responsible for keeping your login credentials confidential. Notify support immediately if you suspect unauthorized account activity.',
                            'أنت مسؤول عن الحفاظ على سرية بيانات الدخول الخاصة بك. تواصل مع الدعم فوراً لو شكيت في أي نشاط غير مصرح به.'
                        )}
                    </p>
                </div>
            </Modal>

            {/* Support Modal */}
            <Modal
                isOpen={activeModal === 'support'}
                onClose={() => setActiveModal(null)}
                title={tx('Enterprise Support & Help Desk', 'الدعم الفني ومكتب المساعدة')}
                description={tx('Get fast assistance from our technical team', 'احصل على مساعدة سريعة من فريقنا التقني')}
                icon={<LifeBuoy className={`w-5 h-5 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />}
                maxWidth="max-w-xl"
                footer={(
                    <>
                        <button
                            type="button"
                            onClick={() => setActiveModal(null)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec] active:translate-x-0.5 active:translate-y-0.5'
                                    : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                            }`}
                        >
                            {tx('Cancel', 'إلغاء')}
                        </button>
                        <button
                            type="submit"
                            form={supportFormId}
                            disabled={isSubmittingSupport}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-2 ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] !text-black border-2 border-black shadow-[3.5px_3.5px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                            }`}
                        >
                            {isSubmittingSupport ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>{tx('Dispatching Ticket...', 'جاري إرسال التذكرة...')}</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5" />
                                    <span>{tx('Submit Support Ticket', 'إرسال تذكرة الدعم')}</span>
                                </>
                            )}
                        </button>
                    </>
                )}
            >
                <div className={`space-y-5 text-xs sm:text-sm leading-relaxed ${isBento ? 'text-black' : 'text-[#d6d0c7]'}`}>
                    <a
                        href="mailto:mohaamedtariq12@gmail.com"
                        className={`p-4 rounded-2xl transition-all flex items-center gap-3.5 ${
                            isBento
                                ? 'bg-[#fef08a] border-2 border-black shadow-[3px_3px_0px_#000] text-black hover:-translate-y-0.5'
                                : 'border border-[#2e2924] bg-[#1a1714] hover:border-[#bef264]/60 text-[#f5f3ec]'
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isBento ? 'bg-black text-[#bef264] border-2 border-black' : 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/35'
                        }`}>
                            <Mail className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-[10px] uppercase font-bold tracking-wider ${isBento ? 'text-black/70' : 'text-[#a8a29e]'}`}>
                                {tx('Direct Support Email', 'إيميل الدعم المباشر')}
                            </p>
                            <p className="font-extrabold text-sm">mohaamedtariq12@gmail.com</p>
                        </div>
                    </a>

                    <form id={supportFormId} onSubmit={handleSupportSubmit} className={`space-y-3.5 pt-2 border-t ${isBento ? 'border-black/20' : 'border-[#2e2924]'}`}>
                        {/* Category Selector Chips */}
                        <div>
                            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${isBento ? 'text-black' : 'text-[#d6d0c7]'}`}>
                                {tx('Inquiry Category', 'نوع الاستفسار')}
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {[
                                    { id: 'technical', label: tx('Technical Issue', 'مشكلة تقنية') },
                                    { id: 'bug', label: tx('Bug Report', 'تبليغ عن خطأ') },
                                    { id: 'scoring', label: tx('Quiz Scoring', 'حساب النقاط') },
                                    { id: 'account', label: tx('Account & Auth', 'الحساب والدخول') },
                                    { id: 'feature', label: tx('Feature Request', 'اقتراح ميزة') },
                                    { id: 'general', label: tx('General Inquiry', 'استفسار عام') },
                                ].map((cat) => (
                                    <button
                                        type="button"
                                        key={cat.id}
                                        onClick={() => setSupportCategory(cat.id as 'technical' | 'bug' | 'scoring' | 'account' | 'feature' | 'general')}
                                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer ${
                                            supportCategory === cat.id
                                                ? isBento
                                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-[#bef264] text-[#0a0908]'
                                                : isBento
                                                    ? 'bg-white text-black border border-black hover:bg-[#f5f3ec]'
                                                    : 'bg-[#1a1714] border border-[#2e2924] text-[#a8a29e] hover:border-[#bef264]/50 hover:text-[#f5f3ec]'
                                        }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Email & Name row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${isBento ? 'text-black' : 'text-[#d6d0c7]'}`}>
                                    {tx('Your Email Address *', 'بريدك الإلكتروني *')}
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={supportEmail}
                                    onChange={(e) => setSupportEmail(e.target.value)}
                                    placeholder="alex.dev@quizplatform.com"
                                    className={`w-full py-2.5 px-3.5 rounded-xl text-xs outline-none transition-all ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:border-black placeholder:text-neutral-500 font-medium'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder:text-[#78716c] focus:border-[#bef264]'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${isBento ? 'text-black' : 'text-[#d6d0c7]'}`}>
                                    {tx('Your Name (Optional)', 'اسمك (اختياري)')}
                                </label>
                                <input
                                    type="text"
                                    value={supportName}
                                    onChange={(e) => setSupportName(e.target.value)}
                                    placeholder={tx('Alex Dev', 'اسمك')}
                                    className={`w-full py-2.5 px-3.5 rounded-xl text-xs outline-none transition-all ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:border-black placeholder:text-neutral-500 font-medium'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder:text-[#78716c] focus:border-[#bef264]'
                                    }`}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${isBento ? 'text-black' : 'text-[#d6d0c7]'}`}>
                                {tx('Issue Subject *', 'عنوان المشكلة *')}
                            </label>
                            <input
                                type="text"
                                required
                                value={supportSubject}
                                onChange={(e) => setSupportSubject(e.target.value)}
                                placeholder={tx('Quiz question scoring, streak freeze, or bug report', 'مشكلة في حساب النقاط أو الـ Streak أو خطأ في سؤال')}
                                className={`w-full py-2.5 px-3.5 rounded-xl text-xs outline-none transition-all ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:border-black placeholder:text-neutral-500 font-medium'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder:text-[#78716c] focus:border-[#bef264]'
                                }`}
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className={`block text-[11px] font-bold uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#d6d0c7]'}`}>
                                    {tx('Description & Details *', 'الوصف والتفاصيل *')}
                                </label>
                                <span className={`text-[10px] ${supportMessage.length < 5 ? (isBento ? 'text-black font-bold' : 'text-[#fde047]') : (isBento ? 'text-black font-black' : 'text-[#bef264] font-bold')}`}>
                                    {supportMessage.length}/5000
                                </span>
                            </div>
                            <textarea
                                rows={4}
                                required
                                value={supportMessage}
                                onChange={(e) => setSupportMessage(e.target.value)}
                                placeholder={tx(
                                    'Please describe what happened, what you expected, and any steps to reproduce...',
                                    'احكي لنا إيه اللي حصل، واللي كنت متوقعه، وخطوات تكرار المشكلة...'
                                )}
                                className={`w-full py-2.5 px-3.5 rounded-xl text-xs outline-none transition-all resize-none ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:border-black placeholder:text-neutral-500 font-medium'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder:text-[#78716c] focus:border-[#bef264]'
                                }`}
                            />
                        </div>

                        {supportError && (
                            <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-in fade-in duration-150 ${
                                isBento
                                    ? 'bg-[#fecdd3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#251317] text-[#fda4af] border border-[#fb7185]/35'
                            }`}>
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{supportError}</span>
                            </div>
                        )}

                    </form>
                </div>
            </Modal>

            {/* FAQ Modal */}
            <Modal
                isOpen={activeModal === 'faq'}
                onClose={() => setActiveModal(null)}
                title={tx('Frequently Asked Questions', 'الأسئلة الشائعة')}
                maxWidth="max-w-xl"
            >
                <div className={`space-y-4 text-xs sm:text-sm leading-relaxed ${isBento ? 'text-neutral-800' : 'text-[#d6d0c7]'}`}>
                    <div>
                        <h4 className={`font-bold mb-1 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                            {tx('How do XP and Leveling work?', 'إزاي نظام النقاط (XP) والمستويات شغال؟')}
                        </h4>
                        <p>
                            {tx(
                                'Every completed quiz and daily challenge earns you XP based on accuracy and speed. Earning 1,000 XP advances you to the next Scholar tier!',
                                'كل كويز وتحدي يومي بتخلصه بيديك XP حسب الدقة والسرعة. كل 1,000 XP بيرقّيك للمستوى اللي بعده!'
                            )}
                        </p>
                    </div>
                    <div>
                        <h4 className={`font-bold mb-1 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                            {tx('Can I create and share my own quizzes?', 'هل أقدر أعمل وأشارك كويزاتي الخاصة؟')}
                        </h4>
                        <p>
                            {tx(
                                'Yes! Quiz creators and administrators can compose custom quiz tracks, code snippet tests, and share deep links with friends and study groups.',
                                'أيوه! المدرسين ومنشئي الكويزات يقدروا يعملوا مسارات وكويزات مخصصة واختبارات كود ويشاركوا الروابط مع الطلاب والأصدقاء.'
                            )}
                        </p>
                    </div>
                    <div>
                        <h4 className={`font-bold mb-1 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                            {tx('How do I get help or report a question bug?', 'إزاي أطلب مساعدة أو أبلّغ عن خطأ في سؤال؟')}
                        </h4>
                        <p>
                            {tx('Email us directly at', 'راسلنا مباشرة على')}{' '}
                            <a href="mailto:mohaamedtariq12@gmail.com" className={isBento ? 'text-black underline font-black' : 'text-[#bef264] underline font-semibold'}>mohaamedtariq12@gmail.com</a>.
                        </p>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default Footer;
