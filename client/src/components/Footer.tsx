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
    BellRing
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import Modal from './common/Modal';

const Footer: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isBento } = useTheme();
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
            <footer className={`w-full mt-auto border-t transition-colors ${
                isBento
                    ? 'bg-white text-black border-t-3 border-black shadow-[0_-4px_0px_#000]'
                    : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
                    {/* Top Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12 mb-12">
                        {/* Brand Column (5 cols) */}
                        <div className="lg:col-span-5 space-y-4">
                            {/* Clickable Logo with Scroll-Up */}
                            <button
                                type="button"
                                onClick={() => handleFooterNav('/')}
                                className="flex items-center gap-2.5 group cursor-pointer text-start outline-none focus:outline-none border-0"
                                aria-label={tx('Quiz Platform Home', 'الصفحة الرئيسية لمنصة Quiz Platform')}
                            >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base transition-transform group-hover:scale-105 ${
                                    isBento
                                        ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                }`}>
                                    Q
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-lg font-black tracking-tight ${
                                        isBento ? 'text-black font-mono' : 'text-white'
                                    }`}>
                                        Quiz Platform
                                    </span>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-500">
                                        {tx('CS Learning Engine', 'محرك تعلّم علوم الحاسب')}
                                    </span>
                                </div>
                            </button>

                            <p className={`text-xs sm:text-sm leading-relaxed max-w-sm ${
                                isBento ? 'text-slate-800 font-medium' : 'text-slate-400'
                            }`}>
                                {tx(
                                    'Next-generation gamified learning platform for computer science students, software engineers, and code enthusiasts. Master algorithms, languages, and architecture.',
                                    'منصة تعليمية تفاعلية حديثة لطلاب علوم الحاسب ومهندسي البرمجيات ومحبي الكود. اتقن الخوارزميات ولغات البرمجة وهندسة الأنظمة.'
                                )}
                            </p>

                        </div>

                        {/* Quick Links (2 cols) */}
                        <div className="lg:col-span-2 space-y-3">
                            <h4 className={`text-xs font-black uppercase tracking-wider ${
                                isBento ? 'text-black font-mono' : 'text-white'
                            }`}>
                                {tx('Explore', 'استكشف')}
                            </h4>
                            <ul className="space-y-2 text-xs">
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => handleFooterNav('/')}
                                        className="hover:text-indigo-400 transition-colors text-start cursor-pointer outline-none focus:outline-none border-0"
                                    >
                                        {tx('Home Dashboard', 'لوحة التحكم')}
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => handleFooterNav('/tracks')}
                                        className="hover:text-indigo-400 transition-colors text-start cursor-pointer outline-none focus:outline-none border-0"
                                    >
                                        {tx('Skill Tracks', 'مسارات التعلم')}
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => handleFooterNav('/study')}
                                        className="hover:text-indigo-400 transition-colors text-start cursor-pointer outline-none focus:outline-none border-0"
                                    >
                                        {tx('Study Flashcards', 'بطاقات المراجعة')}
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => handleFooterNav('/tournaments')}
                                        className="hover:text-indigo-400 transition-colors text-start cursor-pointer outline-none focus:outline-none border-0"
                                    >
                                        {tx('Tournaments', 'البطولات')}
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => handleFooterNav('/daily')}
                                        className="hover:text-indigo-400 transition-colors text-start cursor-pointer outline-none focus:outline-none border-0"
                                    >
                                        {tx('Daily Challenge', 'التحدي اليومي')}
                                    </button>
                                </li>
                            </ul>
                        </div>

                        {/* Community & Competition (2 cols) */}
                        <div className="lg:col-span-2 space-y-3">
                            <h4 className={`text-xs font-black uppercase tracking-wider ${
                                isBento ? 'text-black font-mono' : 'text-white'
                            }`}>
                                {tx('Community', 'المجتمع')}
                            </h4>
                            <ul className="space-y-2 text-xs">
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => handleFooterNav('/leaderboard')}
                                        className="hover:text-indigo-400 transition-colors text-start cursor-pointer outline-none focus:outline-none border-0"
                                    >
                                        {tx('Global Rankings', 'الترتيب العالمي')}
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => handleFooterNav('/clans')}
                                        className="hover:text-indigo-400 transition-colors text-start cursor-pointer outline-none focus:outline-none border-0"
                                    >
                                        {tx('Clans & Guilds', 'الكلانات والفرق')}
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => handleFooterNav('/social')}
                                        className="hover:text-indigo-400 transition-colors text-start cursor-pointer outline-none focus:outline-none border-0"
                                    >
                                        {tx('1v1 Live Duels', 'مواجهات 1 ضد 1')}
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => handleFooterNav('/shop')}
                                        className="hover:text-indigo-400 transition-colors text-start cursor-pointer outline-none focus:outline-none border-0"
                                    >
                                        {tx('Power-Up Shop', 'متجر المساعدات')}
                                    </button>
                                </li>
                            </ul>
                        </div>

                        {/* Newsletter & Updates (3 cols) */}
                        <div className="lg:col-span-3 space-y-3">
                            <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                isBento ? 'text-black font-mono' : 'text-white'
                            }`}>
                                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                {tx('Weekly Challenges', 'التحديات الأسبوعية')}
                            </h4>
                            {isAlreadySubscribed ? (
                                <div className={`p-4 rounded-2xl border transition-all animate-in fade-in duration-300 ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                }`}>
                                    <div className="flex items-start gap-2.5">
                                        <div className={`p-1.5 rounded-lg shrink-0 ${
                                            isBento ? 'bg-black text-white' : 'bg-emerald-500/20 text-emerald-400'
                                        }`}>
                                            <BellRing className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-white'}`}>
                                                    {tx('Notifications Active', 'الإشعارات شغالة')}
                                                </span>
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                            </div>
                                            <p className={`text-[11px] leading-relaxed mt-1 ${
                                                isBento ? 'text-black/80 font-semibold' : 'text-slate-300'
                                            }`}>
                                                {tx(
                                                    "You're subscribed! You'll be notified automatically anytime new algorithmic challenges and learning tracks drop.",
                                                    'أنت مشترك! هيوصلك إشعار تلقائي أول ما تنزل تحديات خوارزميات أو مسارات تعلم جديدة.'
                                                )}
                                            </p>
                                            {subscribedEmail && (
                                                <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold truncate max-w-full ${
                                                    isBento
                                                        ? 'bg-white text-black border border-black'
                                                        : 'bg-black/40 text-emerald-300 border border-emerald-500/20'
                                                }`}>
                                                    <Mail className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{subscribedEmail}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-2.5 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-[10px]">
                                        <span className={`font-semibold ${isBento ? 'text-black/60' : 'text-slate-400'}`}>
                                            {tx('VIP Challenge Alert', 'تنبيه التحديات المميز')}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleUnsubscribe}
                                            disabled={isUnsubscribing}
                                            className={`font-bold hover:underline transition-colors cursor-pointer ${
                                                isBento ? 'text-red-700' : 'text-rose-400'
                                            }`}
                                        >
                                            {isUnsubscribing ? tx('Updating...', 'جاري التحديث...') : tx('Unsubscribe / Change', 'إلغاء الاشتراك / تغيير')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className={`text-xs ${isBento ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                                        {tx(
                                            'Get notified when new algorithmic challenges and learning tracks drop.',
                                            'استلم إشعار أول ما تنزل تحديات خوارزميات ومسارات تعلم جديدة.'
                                        )}
                                    </p>
                                    <form onSubmit={handleNewsletterSubmit} className="space-y-2">
                                        <div className="relative">
                                            <input
                                                type="email"
                                                value={emailInput}
                                                onChange={(e) => setEmailInput(e.target.value)}
                                                placeholder={tx('Enter your email', 'اكتب بريدك الإلكتروني')}
                                                disabled={isSubscribing}
                                                className={`w-full py-2 ps-3 pe-9 rounded-xl text-xs outline-none transition-all ${
                                                    isBento
                                                        ? 'bg-white border-2 border-black text-black font-bold focus:ring-2 focus:ring-black placeholder:text-slate-400 disabled:opacity-50'
                                                        : 'bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50'
                                                }`}
                                            />
                                            <button
                                                type="submit"
                                                disabled={isSubscribing || !emailInput.trim()}
                                                className={`absolute end-1 top-1 bottom-1 px-2.5 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                                    isBento
                                                        ? 'bg-[#bef264] text-black border border-black hover:bg-[#a3e635]'
                                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                                }`}
                                                aria-label={tx('Subscribe', 'اشتراك')}
                                            >
                                                {isSubscribing ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Send className="w-3 h-3" />
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Bottom Row */}
                    <div className={`pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${
                        isBento
                            ? 'border-t-2 border-black text-slate-800'
                            : 'border-slate-800/80 text-slate-500'
                    }`}>
                        {/* Dynamic Copyright Year & Creator Credit */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                            <span>&copy; {currentYear} Quiz Platform.</span>
                            <span className="hidden sm:inline text-slate-500 dark:text-slate-600">•</span>
                            <span className="inline-flex items-center gap-1">
                                {tx('Made by', 'تطوير')} <span className={`font-bold ${isBento ? 'text-black font-black underline decoration-2' : 'text-indigo-400 font-semibold'}`}>Mohamed Tarek</span>
                            </span>
                            <span className="hidden sm:inline text-slate-500 dark:text-slate-600">•</span>
                            <span>{tx('All rights reserved.', 'جميع الحقوق محفوظة.')}</span>
                        </div>

                        {/* Legal & Help Modal Triggers */}
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-medium">
                            <button
                                type="button"
                                onClick={() => setActiveModal('privacy')}
                                className="hover:text-indigo-400 transition-colors cursor-pointer outline-none focus:outline-none border-0"
                            >
                                {tx('Privacy Policy', 'سياسة الخصوصية')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveModal('terms')}
                                className="hover:text-indigo-400 transition-colors cursor-pointer outline-none focus:outline-none border-0"
                            >
                                {tx('Terms of Service', 'شروط الاستخدام')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveModal('support')}
                                className="btn-unstyled hover:text-indigo-400 transition-colors cursor-pointer flex items-center gap-1 outline-none focus:outline-none !border-0 !shadow-none"
                            >
                                <LifeBuoy className="w-3.5 h-3.5 text-indigo-400" />
                                {tx('Support', 'الدعم الفني')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveModal('faq')}
                                className="hover:text-indigo-400 transition-colors cursor-pointer outline-none focus:outline-none border-0"
                            >
                                {tx('FAQ & Help', 'الأسئلة الشائعة')}
                            </button>
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
                icon={<LifeBuoy className="w-5 h-5 text-indigo-500" />}
                maxWidth="max-w-xl"
                footer={(
                    <>
                        <button
                            type="button"
                            onClick={() => setActiveModal(null)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-slate-100 active:translate-x-0.5 active:translate-y-0.5'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                        >
                            {tx('Cancel', 'إلغاء')}
                        </button>
                        <button
                            type="submit"
                            form={supportFormId}
                            disabled={isSubmittingSupport}
                            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-2 ${
                                isBento
                                    ? 'bg-[#8b5cf6] !text-white border-2 border-black shadow-[3.5px_3.5px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25'
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
                <div className="space-y-5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    <a
                        href="mailto:mohaamedtariq12@gmail.com"
                        className={`p-4 rounded-2xl transition-all flex items-center gap-3.5 ${
                            isBento
                                ? 'bg-[#fef08a] border-2 border-black shadow-[3px_3px_0px_#000] text-black hover:-translate-y-0.5'
                                : 'border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-indigo-500/40 text-slate-900 dark:text-white'
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isBento ? 'bg-black text-[#bef264] border-2 border-black' : 'bg-indigo-500/10 text-indigo-500'
                        }`}>
                            <Mail className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-[10px] uppercase font-bold tracking-wider ${isBento ? 'text-black/70' : 'text-slate-400'}`}>
                                {tx('Direct Support Email', 'إيميل الدعم المباشر')}
                            </p>
                            <p className="font-extrabold text-sm">mohaamedtariq12@gmail.com</p>
                        </div>
                    </a>

                    <form id={supportFormId} onSubmit={handleSupportSubmit} className="space-y-3.5 pt-2 border-t border-slate-200 dark:border-white/5">
                        {/* Category Selector Chips */}
                        <div>
                            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${isBento ? 'text-black' : 'text-slate-700 dark:text-slate-300'}`}>
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
                                                    : 'bg-indigo-600 text-white shadow-sm'
                                                : isBento
                                                    ? 'bg-white text-black border border-black hover:bg-slate-100'
                                                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
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
                                <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${isBento ? 'text-black' : 'text-slate-700 dark:text-slate-300'}`}>
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
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:border-black placeholder:text-neutral-400 font-medium'
                                            : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${isBento ? 'text-black' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {tx('Your Name (Optional)', 'اسمك (اختياري)')}
                                </label>
                                <input
                                    type="text"
                                    value={supportName}
                                    onChange={(e) => setSupportName(e.target.value)}
                                    placeholder={tx('Alex Dev', 'اسمك')}
                                    className={`w-full py-2.5 px-3.5 rounded-xl text-xs outline-none transition-all ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:border-black placeholder:text-neutral-400 font-medium'
                                            : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500'
                                    }`}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${isBento ? 'text-black' : 'text-slate-700 dark:text-slate-300'}`}>
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
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:border-black placeholder:text-neutral-400 font-medium'
                                        : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500'
                                }`}
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className={`block text-[11px] font-bold uppercase tracking-wider ${isBento ? 'text-black' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {tx('Description & Details *', 'الوصف والتفاصيل *')}
                                </label>
                                <span className={`text-[10px] ${supportMessage.length < 5 ? 'text-amber-500' : 'text-emerald-500 font-bold'}`}>
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
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:border-black placeholder:text-neutral-400 font-medium'
                                        : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500'
                                }`}
                            />
                        </div>

                        {supportError && (
                            <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-in fade-in duration-150 ${
                                isBento
                                    ? 'bg-[#fee2e2] text-red-900 border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
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
                <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1">
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
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1">
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
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                            {tx('How do I get help or report a question bug?', 'إزاي أطلب مساعدة أو أبلّغ عن خطأ في سؤال؟')}
                        </h4>
                        <p>
                            {tx('Email us directly at', 'راسلنا مباشرة على')}{' '}
                            <a href="mailto:mohaamedtariq12@gmail.com" className="text-indigo-500 underline font-semibold">mohaamedtariq12@gmail.com</a>.
                        </p>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default Footer;
