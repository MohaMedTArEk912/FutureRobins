import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, EyeOff, Mail, User as UserIcon, Lock, Check, AlertCircle, Sliders, Globe, Download, RefreshCw, Smartphone, Palette } from 'lucide-react';
import type { UserData } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { pwaUpdater, type PwaUpdateState } from '../lib/pwaUpdater.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useNavArrangement } from '../context/NavArrangementContext';

interface UserSettingsProps {
    user: UserData;
    onClose?: () => void;
    onUpdate: (updatedUser: UserData) => void;
    embedded?: boolean;
}

const UserSettings: React.FC<UserSettingsProps> = ({ user, onClose, onUpdate, embedded = false }) => {
    const { isBento, theme, openThemeModal } = useTheme();
    const { language, setLanguage, tx } = useLanguage();
    const { openCustomizer, config } = useNavArrangement();
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingLang, setIsSavingLang] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [pwaState, setPwaState] = useState<PwaUpdateState>(() => pwaUpdater.getState());
    const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle' | 'up_to_date' | 'update_found' | 'offline'>('idle');
    const [installHint, setInstallHint] = useState<'none' | 'ios' | 'browser_menu'>('none');

    useEffect(() => {
        pwaUpdater.init();
        return pwaUpdater.subscribe(setPwaState);
    }, []);

    const handleDownloadApp = async () => {
        setInstallHint('none');
        const outcome = await pwaUpdater.promptInstall();
        if (outcome === 'ios') {
            setInstallHint('ios');
        } else if (outcome === 'unavailable') {
            setInstallHint('browser_menu');
        }
    };

    const handleCheckUpdates = async () => {
        if (!navigator.onLine) {
            setUpdateCheckStatus('offline');
            return;
        }
        setUpdateCheckStatus('idle');
        const hasUpdate = await pwaUpdater.checkForUpdates();
        setUpdateCheckStatus(hasUpdate ? 'update_found' : 'up_to_date');
    };

    useEffect(() => {
        setName(user.name || '');
        setEmail(user.email || '');
    }, [user.name, user.email]);

    const handleLanguageSelect = async (nextLang: 'en' | 'ar-EG') => {
        if (nextLang === language && user.preferredLanguage === nextLang) return;
        setIsSavingLang(true);
        setNotification(null);
        try {
            await setLanguage(nextLang);
            onUpdate({ ...user, preferredLanguage: nextLang });
            setNotification({
                type: 'success',
                message: nextLang === 'ar-EG'
                    ? 'تم تحويل لغة المنصة للعربية المصرية بنجاح!'
                    : 'Platform language switched to English!'
            });
        } catch (err) {
            console.error('Failed to update language:', err);
            setNotification({
                type: 'error',
                message: tx('Could not update language preference.', 'مقدرناش نحفظ اختيار اللغة، جرب تاني.')
            });
        } finally {
            setIsSavingLang(false);
        }
    };

    const hasChanges = Boolean(
        name.trim() !== (user.name || '').trim() ||
        email.trim().toLowerCase() !== (user.email || '').trim().toLowerCase() ||
        currentPassword.length > 0 ||
        newPassword.length > 0 ||
        confirmPassword.length > 0
    );

    const handleCancel = () => {
        setName(user.name || '');
        setEmail(user.email || '');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setNotification(null);
        if (!embedded && onClose) {
            onClose();
        }
    };

    const handleSave = async () => {
        // Validation
        if (!name.trim()) {
            setNotification({ type: 'error', message: tx('Name cannot be empty', 'الاسم ما ينفعش يكون فاضي') });
            return;
        }

        if (!email.trim()) {
            setNotification({ type: 'error', message: tx('Email cannot be empty', 'الإيميل ما ينفعش يكون فاضي') });
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setNotification({ type: 'error', message: tx('Please enter a valid email address', 'لو سمحت اكتب إيميل صحيح') });
            return;
        }

        // Password validation if changing password
        if (newPassword || confirmPassword) {
            if (!currentPassword) {
                setNotification({ type: 'error', message: tx('Please enter your current password to change it', 'اكتب كلمة السر الحالية الأول عشان تغيرها') });
                return;
            }

            if (newPassword !== confirmPassword) {
                setNotification({ type: 'error', message: tx('New passwords do not match', 'كلمة السر الجديدة والتأكيد مش متطابقين') });
                return;
            }

            if (newPassword.length < 6) {
                setNotification({ type: 'error', message: tx('New password must be at least 6 characters long', 'كلمة السر الجديدة لازم تكون 6 حروف على الأقل') });
                return;
            }
        }

        setIsLoading(true);
        setNotification(null);

        try {
            // Update basic info (name, email)
            const updatedUser = {
                ...user,
                name: name.trim(),
                email: email.toLowerCase().trim()
            };

            await api.updateUser(user.userId, {
                name: updatedUser.name,
                email: updatedUser.email
            });

            // If password is being changed
            if (newPassword) {
                await api.changePassword(user.email, currentPassword, newPassword);
            }

            setNotification({ type: 'success', message: tx('Settings updated successfully!', 'اتحفظت الإعدادات بنجاح!') });

            // Update parent component
            onUpdate(updatedUser);

            // Close after a short delay to show success message if modal
            if (!embedded && onClose) {
                setTimeout(() => {
                    onClose();
                }, 1500);
            }
        } catch (error) {
            console.error('Update error:', error);
            const message = error instanceof Error ? error.message : tx('Failed to update settings. Please try again.', 'حصلت مشكلة في حفظ الإعدادات، جرب تاني.');
            setNotification({
                type: 'error',
                message
            });
        } finally {
            setIsLoading(false);
        }
    };

    const alertBanner = notification && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            isBento
                ? notification.type === 'success'
                    ? 'bg-[#dcfce7] border-2 border-black text-black font-bold shadow-[3px_3px_0px_#000]'
                    : 'bg-[#fee2e2] border-2 border-black text-black font-bold shadow-[3px_3px_0px_#000]'
                : notification.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400'
        } animate-in slide-in-from-top-2`}>
            {notification.type === 'success' ? <Check className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span className="font-bold text-sm">{notification.message}</span>
        </div>
    );

    const roleLabel = user.role === 'teacher'
        ? tx('Teacher', 'مدرس')
        : user.role === 'admin'
            ? tx('Admin', 'أدمن')
            : user.role === 'student'
                ? tx('Student', 'طالب')
                : tx('Account', 'حساب');

    const profileInfoSection = (
        <div className="space-y-4">
            <div>
                <h3 className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                    isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                }`}>
                    <UserIcon className={`w-4 h-4 ${isBento ? 'text-black' : 'text-teal-600 dark:text-teal-400'}`} /> {tx('Profile Info', 'بيانات الحساب')}
                </h3>
                <p className={`text-xs font-bold mt-1 truncate ${isBento ? 'text-gray-600' : 'text-gray-500'}`}>
                    {tx('Update your display name and primary email address', 'حدث اسم العرض والبريد الإلكتروني الأساسي لحسابك')}
                </p>
            </div>

            <div className="space-y-3.5">
                <div>
                    <label className="sr-only">{tx('Full Name', 'الاسم بالكامل')}</label>
                    <div className="relative">
                        <UserIcon className={`absolute start-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isBento ? 'text-black' : 'text-gray-400 dark:text-gray-500'}`} />
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={`w-full h-12 ps-12 pe-4 rounded-xl font-medium transition-all ${
                                isBento
                                    ? 'border-2 border-black bg-white text-black placeholder-gray-500 shadow-[2px_2px_0px_#000] focus:outline-none'
                                    : 'bg-gray-50 dark:bg-[#0e0d0b] border border-gray-200 dark:border-[#f5f3ec]/14 focus:border-teal-500 dark:focus:border-[#bef264] focus:outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500'
                            }`}
                            placeholder={tx('Full Name', 'الاسم بالكامل')}
                        />
                    </div>
                </div>
                <div>
                    <label className="sr-only">{tx('Email Address', 'البريد الإلكتروني')}</label>
                    <div className="relative">
                        <Mail className={`absolute start-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isBento ? 'text-black' : 'text-gray-400 dark:text-gray-500'}`} />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`w-full h-12 ps-12 pe-4 rounded-xl font-medium transition-all ${
                                isBento
                                    ? 'border-2 border-black bg-white text-black placeholder-gray-500 shadow-[2px_2px_0px_#000] focus:outline-none'
                                    : 'bg-gray-50 dark:bg-[#0e0d0b] border border-gray-200 dark:border-[#f5f3ec]/14 focus:border-teal-500 dark:focus:border-[#bef264] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600'
                            }`}
                            placeholder={tx('Email Address', 'البريد الإلكتروني')}
                        />
                    </div>
                </div>
                <div className={`w-full h-11 sm:h-12 px-3 sm:px-4 rounded-xl flex items-center justify-between gap-2 ${
                    isBento
                        ? 'border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000]'
                        : 'bg-gray-50 dark:bg-[#0e0d0b] border border-gray-200 dark:border-[#f5f3ec]/14 text-gray-700 dark:text-gray-300'
                }`}>
                    <span className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <Check className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${isBento ? 'text-black' : 'text-emerald-500 dark:text-[#bef264]'}`} />
                        <span className="text-xs sm:text-sm font-medium truncate">
                            {tx('Account Status', 'حالة الحساب')}
                        </span>
                    </span>
                    <span className={`px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 ${
                        isBento
                            ? 'bg-[#bef264] text-black border border-black'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-[#bef264] border border-emerald-500/25 dark:border-[#bef264]/30'
                    }`}>
                        {roleLabel} • {tx('Verified', 'موثق')}
                    </span>
                </div>
            </div>
        </div>
    );

    const compactThemeLabel = theme === 'bento'
        ? tx('Bento', 'بينتو')
        : tx('Noir Studio', 'نوار ستوديو');

    const appearanceSection = (
        <section className={`space-y-2.5 sm:space-y-3 border-t pt-4 sm:pt-5 ${isBento ? 'border-black/20' : 'border-gray-200 dark:border-white/5'}`}>
            <div className="flex items-center justify-between gap-2">
                <h3 className={`flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider truncate ${isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'}`}>
                    <Palette className={`size-3.5 sm:size-4 shrink-0 ${isBento ? 'text-black' : 'text-indigo-600 dark:text-indigo-400'}`} />
                    <span className="truncate">{tx('Appearance & Theme', 'المظهر والثيم')}</span>
                </h3>
                <span className={`text-[10px] sm:text-[11px] font-black px-2 sm:px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                    isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                }`}>
                    {compactThemeLabel}
                </span>
            </div>
            <p className={`text-[11px] sm:text-xs leading-snug ${isBento ? 'text-gray-700 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                {tx(
                    'Switch between Noir Studio dark mode and Neo-Brutalist Bento.',
                    'بدّل بين ثيم نوار ستوديو الداكن وثيم بينتو العصري.'
                )}
            </p>
            <button
                type="button"
                onClick={openThemeModal}
                className={`btn-unstyled w-full h-11 px-3 sm:px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-between gap-2 transition-all cursor-pointer active:scale-[0.99] ${
                    isBento
                        ? 'border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000] hover:bg-[#fef9c3]'
                        : 'border border-gray-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-[#f5f3ec] dark:hover:bg-white/10'
                }`}
            >
                <span className="flex items-center gap-2 min-w-0">
                    <Palette className="w-4 h-4 shrink-0" />
                    <span className="sm:hidden truncate">{tx('Choose Theme', 'اختار الثيم')}</span>
                    <span className="hidden sm:inline truncate">{tx('Choose Platform Theme', 'اختار ثيم المنصة')}</span>
                </span>
                <span className={`text-[11px] sm:text-xs font-black whitespace-nowrap shrink-0 ${isBento ? 'text-black/75' : 'text-indigo-600 dark:text-[#fde047]'}`}>
                    {compactThemeLabel} →
                </span>
            </button>
        </section>
    );

    const languageSection = (
        <div className={`pt-4 sm:pt-5 space-y-2.5 sm:space-y-3 border-t ${isBento ? 'border-black/20' : 'border-gray-200 dark:border-white/5'}`}>
            <div className="flex items-center justify-between gap-2">
                <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 truncate ${
                    isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                }`}>
                    <Globe className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isBento ? 'text-black' : 'text-indigo-600 dark:text-indigo-400'}`} /> {tx('Platform Language', 'لغة المنصة')}
                </h3>
                <span className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                    isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                }`}>
                    {language === 'ar-EG' ? 'العربية (مصري)' : 'English'}
                </span>
            </div>
            <p className={`text-[11px] sm:text-xs leading-snug ${isBento ? 'text-gray-700 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                {tx(
                    'Switch all menus, buttons, and platform pages between English and Egyptian Arabic.',
                    'حوّل كل القوائم والأزرار وصفحات المنصة بين العربية المصرية والإنجليزية.'
                )}
            </p>
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    aria-pressed={language === 'ar-EG'}
                    disabled={isSavingLang}
                    onClick={() => void handleLanguageSelect('ar-EG')}
                    className={`btn-unstyled h-11 sm:h-12 px-2.5 sm:px-3 rounded-xl text-start transition-all cursor-pointer flex items-center justify-between gap-1.5 min-w-0 disabled:opacity-60 ${
                        language === 'ar-EG'
                            ? (isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-indigo-600 dark:bg-[#bef264] text-white dark:text-[#0a0908] shadow-md')
                            : (isBento
                                ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10')
                    }`}
                >
                    <span className="flex items-center gap-2 min-w-0">
                        <span className="text-base leading-none shrink-0">🇪🇬</span>
                        <span className="min-w-0">
                            <span className="block text-xs font-black truncate">العربية (مصري)</span>
                            <span className={`block text-[10px] font-semibold truncate ${
                                language === 'ar-EG' ? (isBento ? 'text-black/75' : 'text-white/80 dark:text-[#0a0908]/75') : 'text-gray-500 dark:text-[#a8a29e]'
                            }`}>
                                واجهة RTL
                            </span>
                        </span>
                    </span>
                    {language === 'ar-EG' && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>

                <button
                    type="button"
                    aria-pressed={language === 'en'}
                    disabled={isSavingLang}
                    onClick={() => void handleLanguageSelect('en')}
                    className={`btn-unstyled h-11 sm:h-12 px-2.5 sm:px-3 rounded-xl text-start transition-all cursor-pointer flex items-center justify-between gap-1.5 min-w-0 disabled:opacity-60 ${
                        language === 'en'
                            ? (isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-indigo-600 dark:bg-[#bef264] text-white dark:text-[#0a0908] shadow-md')
                            : (isBento
                                ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10')
                    }`}
                >
                    <span className="flex items-center gap-2 min-w-0">
                        <span className="text-base leading-none shrink-0">🇺🇸</span>
                        <span className="min-w-0">
                            <span className="block text-xs font-black truncate">English</span>
                            <span className={`block text-[10px] font-semibold truncate ${
                                language === 'en' ? (isBento ? 'text-black/75' : 'text-white/80 dark:text-[#0a0908]/75') : 'text-gray-500 dark:text-[#a8a29e]'
                            }`}>
                                Default LTR
                            </span>
                        </span>
                    </span>
                    {language === 'en' && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
            </div>
        </div>
    );

    const appAndUpdatesSection = (
        <div className={`pt-5 space-y-3 border-t ${isBento ? 'border-black/20' : 'border-gray-200 dark:border-white/5'}`}>
            <div className="flex items-center justify-between gap-2">
                <h3 className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                    isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                }`}>
                    <Smartphone className={`w-4 h-4 ${isBento ? 'text-black' : 'text-indigo-600 dark:text-indigo-400'}`} />
                    {tx('App & Updates', 'التطبيق والتحديثات')}
                </h3>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    pwaState.isInstalled
                        ? isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                        : isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                }`}>
                    {pwaState.isInstalled ? tx('Installed', 'متثبت') : tx('PWA Ready', 'تطبيق ويب')}
                </span>
            </div>
            <p className={`text-xs min-h-[32px] leading-relaxed ${isBento ? 'text-gray-700 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                {tx(
                    'Install the desktop or mobile web app for instant access and check for latest releases.',
                    'ثبّت تطبيق المنصة على جهازك للوصول السريع وافحص أحدث التحديثات.'
                )}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
                <button
                    type="button"
                    onClick={handleDownloadApp}
                    disabled={pwaState.isInstalled}
                    className={`btn-unstyled h-12 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 disabled:cursor-default ${
                        pwaState.isInstalled
                            ? isBento
                                ? 'bg-slate-100 text-black border-2 border-black/40'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10'
                            : isBento
                                ? 'bg-[#fde047] hover:bg-[#facc15] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                    }`}
                >
                    <Download className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                        {pwaState.isInstalled
                            ? tx('App Installed', 'التطبيق متثبت')
                            : tx('Download App', 'تنزيل التطبيق')}
                    </span>
                </button>

                {pwaState.needRefresh ? (
                    <button
                        type="button"
                        onClick={() => void pwaUpdater.updateApp()}
                        className={`btn-unstyled h-12 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                            isBento
                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                        }`}
                    >
                        <RefreshCw className="w-4 h-4 shrink-0" />
                        <span className="truncate">{tx('Install Update', 'تثبيت التحديث')}</span>
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleCheckUpdates}
                        disabled={pwaState.checking}
                        className={`btn-unstyled h-12 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 ${
                            isBento
                                ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10'
                        }`}
                    >
                        <RefreshCw className={`w-4 h-4 shrink-0 ${pwaState.checking ? 'animate-spin' : ''}`} />
                        <span className="truncate">
                            {pwaState.checking
                                ? tx('Checking...', 'بيدور على تحديث...')
                                : tx('Check for Updates', 'فحص التحديثات')}
                        </span>
                    </button>
                )}
            </div>

            {updateCheckStatus !== 'idle' && (
                <div className={`px-3 py-2 rounded-xl text-[11px] font-bold flex items-center justify-between gap-2 ${
                    updateCheckStatus === 'update_found'
                        ? isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                        : updateCheckStatus === 'offline'
                            ? isBento ? 'bg-[#fecdd3] text-black border border-black' : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                            : isBento ? 'bg-white text-black border border-black/30' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                }`}>
                    <span>
                        {updateCheckStatus === 'update_found'
                            ? tx('A new version is ready! Click "Install Update" above.', 'في نسخة جديدة جاهزة! اضغط "تثبيت التحديث" فوق.')
                            : updateCheckStatus === 'offline'
                                ? tx('You are offline. Connect to the internet to check for updates.', 'أنت غير متصل بالإنترنت. اتصل بالنت لفحص التحديثات.')
                                : tx('You are on the latest version.', 'أنت على أحدث إصدار.')}
                    </span>
                    {pwaState.lastChecked && (
                        <span className="text-[10px] opacity-70 shrink-0 font-mono">
                            {pwaState.lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
            )}

            {installHint !== 'none' && (
                <div className={`px-3 py-2 rounded-xl text-[11px] font-semibold ${
                    isBento ? 'bg-[#fef9c3] text-black border border-black' : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                }`}>
                    {installHint === 'ios'
                        ? tx(
                            'On iPhone/iPad: tap the Share button in Safari, then choose "Add to Home Screen".',
                            'على iPhone/iPad: اضغط زرار المشاركة في Safari وبعدين اختار "إضافة إلى الشاشة الرئيسية".'
                        )
                        : tx(
                            'If the prompt did not appear, open your browser menu (⋮) and choose "Install App" or "Add to Home Screen".',
                            'لو نافذة التثبيت مظهرتش، افتح قائمة المتصفح (⋮) واختار "تثبيت التطبيق" أو "إضافة للشاشة الرئيسية".'
                        )}
                </div>
            )}
        </div>
    );

    const navCustomizationSection = (
        <div className={`pt-5 space-y-3 border-t ${isBento ? 'border-black/20' : 'border-gray-200 dark:border-white/5'}`}>
            <div className="flex items-center justify-between">
                <h3 className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                    isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                }`}>
                    <Sliders className={`w-4 h-4 ${isBento ? 'text-black' : 'text-indigo-600 dark:text-indigo-400'}`} /> {tx('Navigation & Tabs', 'شريط التنقل والأقسام')}
                </h3>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                }`}>
                    {tx(`${config.primaryPaths.length} Pinned`, `${config.primaryPaths.length} متثبتين`)}
                </span>
            </div>
            <p className={`text-xs min-h-[32px] leading-relaxed ${isBento ? 'text-gray-700 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                {tx(
                    'Customize your top navigation pill, reorder buttons, choose curated presets, and sync with mobile.',
                    'رتب أزرار الشريط العلوي زي ما تحب واختار الترتيب الجاهز اللي يريحك مع المزامنة للموبايل.'
                )}
            </p>
            <button
                type="button"
                onClick={() => {
                    if (onClose) onClose();
                    openCustomizer();
                }}
                className={`btn-unstyled w-full h-12 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isBento
                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                        : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-[#bef264] dark:hover:bg-[#d2fa8a] text-white dark:text-[#0a0908] shadow-md shadow-indigo-600/20 dark:shadow-[0_10px_24px_-8px_rgba(190,242,100,0.35)] active:scale-[0.99]'
                }`}
            >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>{tx('Arrange Navigation Tabs & Layout', 'ترتيب أقسام شريط التنقل')}</span>
            </button>
        </div>
    );

    const securitySection = (
        <div className="space-y-4">
            <div>
                <h3 className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                    isBento ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                }`}>
                    <Lock className={`w-4 h-4 ${isBento ? 'text-black' : 'text-teal-600 dark:text-teal-400'}`} /> {tx('Security', 'الأمان وكلمة السر')}
                </h3>
                <p className={`text-xs font-bold mt-1 truncate ${isBento ? 'text-gray-600' : 'text-gray-500'}`}>
                    {tx('Leave blank to keep current password', 'سيبه فاضي لو مش عايز تغير كلمة السر الحالية')}
                </p>
            </div>

            <div className="space-y-3.5">
                <div className="relative">
                    <Lock className={`absolute start-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isBento ? 'text-black' : 'text-gray-400 dark:text-gray-500'}`} />
                    <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={`w-full h-12 ps-12 pe-12 rounded-xl font-medium transition-all ${
                            isBento
                                ? 'border-2 border-black bg-white text-black placeholder-gray-500 shadow-[2px_2px_0px_#000] focus:outline-none'
                                : 'bg-gray-50 dark:bg-[#0e0d0b] border border-gray-200 dark:border-[#f5f3ec]/14 focus:border-teal-500 dark:focus:border-[#bef264] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600'
                        }`}
                        placeholder={tx('Current Password', 'كلمة السر الحالية')}
                    />
                    <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className={`absolute end-4 top-1/2 transform -translate-y-1/2 ${isBento ? 'text-black' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>

                <div className="relative">
                    <Lock className={`absolute start-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isBento ? 'text-black' : 'text-gray-400 dark:text-gray-500'}`} />
                    <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={`w-full h-12 ps-12 pe-12 rounded-xl font-medium transition-all ${
                            isBento
                                ? 'border-2 border-black bg-white text-black placeholder-gray-500 shadow-[2px_2px_0px_#000] focus:outline-none'
                                : 'bg-gray-50 dark:bg-[#0e0d0b] border border-gray-200 dark:border-[#f5f3ec]/14 focus:border-teal-500 dark:focus:border-[#bef264] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600'
                        }`}
                        placeholder={tx('New Password', 'كلمة السر الجديدة')}
                    />
                    <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className={`absolute end-4 top-1/2 transform -translate-y-1/2 ${isBento ? 'text-black' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>

                <div className="relative">
                    <Lock className={`absolute start-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isBento ? 'text-black' : 'text-gray-400 dark:text-gray-500'}`} />
                    <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full h-12 ps-12 pe-12 rounded-xl font-medium transition-all ${
                            isBento
                                ? 'border-2 border-black bg-white text-black placeholder-gray-500 shadow-[2px_2px_0px_#000] focus:outline-none'
                                : 'bg-gray-50 dark:bg-[#0e0d0b] border border-gray-200 dark:border-[#f5f3ec]/14 focus:border-teal-500 dark:focus:border-[#bef264] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600'
                        }`}
                        placeholder={tx('Confirm New Password', 'تأكيد كلمة السر الجديدة')}
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className={`absolute end-4 top-1/2 transform -translate-y-1/2 ${isBento ? 'text-black' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );

    const actionButtons = hasChanges && (
        <div className="flex gap-4 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className={`flex-1 px-4 py-3 rounded-xl font-black transition-all disabled:opacity-50 cursor-pointer ${
                    isBento
                        ? 'bg-white hover:bg-gray-100 text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                        : 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
                {tx('Cancel', 'إلغاء')}
            </button>
            <button
                type="button"
                onClick={handleSave}
                disabled={isLoading}
                className={`btn-unstyled flex-1 px-4 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${
                    isBento
                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                        : 'bg-teal-600 dark:bg-[#bef264] hover:bg-teal-500 dark:hover:bg-[#d2fa8a] text-white dark:text-[#0a0908] shadow-lg shadow-teal-500/20 dark:shadow-[0_10px_26px_-8px_rgba(190,242,100,0.35)]'
                }`}
            >
                {isLoading ? (
                    <>
                        <div className={`w-4 h-4 border-2 rounded-full animate-spin ${isBento ? 'border-black/30 border-t-black' : 'border-white/30 border-t-white'}`} />
                        <span>{tx('Saving...', 'جاري الحفظ...')}</span>
                    </>
                ) : (
                    <>
                        <Check className="w-4 h-4 shrink-0" />
                        <span>{tx('Save Changes', 'حفظ التغييرات')}</span>
                    </>
                )}
            </button>
        </div>
    );

    if (embedded) {
        return (
            <div className={`w-full rounded-[1.75rem] sm:rounded-[2rem] overflow-hidden ${
                isBento
                    ? 'bg-white text-black border-[2.5px] border-black shadow-[4px_4px_0px_#000]'
                    : 'bg-white dark:bg-[#141210] border border-gray-200 dark:border-white/10 shadow-sm'
            }`}>
                {/* Embedded Section Header */}
                <div className={`px-6 sm:px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isBento ? 'bg-[#fefce8] border-b-[2.5px] border-black' : 'bg-gray-50/60 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10'
                }`}>
                    <div>
                        <h2 className={`text-xl sm:text-2xl font-black ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                            {tx('Account Settings', 'إعدادات الحساب')}
                        </h2>
                        <p className={`text-xs sm:text-sm mt-0.5 ${isBento ? 'text-gray-700 font-bold' : 'text-gray-500 dark:text-gray-400 font-medium'}`}>
                            {tx('Manage your personal details, appearance, language, and account security', 'عدل بياناتك وشكل المنصة ولغتها وإعدادات الأمان')}
                        </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase self-start sm:self-center ${
                        isBento ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                    }`}>
                        {roleLabel}
                    </span>
                </div>

                <div className="p-6 sm:p-8">
                    {alertBanner}

                    {/* Symmetrical Half-and-Half Split Grid (3 matched rows per column) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                        {/* Left Column: Profile Info (3 rows) + Platform Language (2 buttons) + Appearance & Theme (1 button) */}
                        <div className={`p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-6 h-full ${
                            isBento
                                ? 'bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10'
                        }`}>
                            {profileInfoSection}
                            {languageSection}
                            {appearanceSection}
                        </div>

                        {/* Right Column: Security (3 rows) + App & Updates (2 buttons) + Navigation & Tabs (1 button) */}
                        <div className={`p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-6 h-full ${
                            isBento
                                ? 'bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10'
                        }`}>
                            {securitySection}
                            {appAndUpdatesSection}
                            {navCustomizationSection}
                        </div>
                    </div>

                    {actionButtons}
                </div>
            </div>
        );
    }

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="app-dialog-overlay fixed inset-0 z-[9999] flex items-center justify-center p-4 !bg-transparent !border-0 !shadow-none animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="modal-backdrop absolute inset-0 bg-black/50 dark:bg-black/65 backdrop-blur-md transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                onClick={(e) => e.stopPropagation()}
                className={`app-dialog-panel relative z-10 max-w-md w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 ${
                    isBento
                        ? 'bg-white text-black border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000]'
                        : 'bg-white dark:bg-[#141210] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl'
                }`}
            >
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className={`btn-unstyled absolute top-6 end-6 transition-all z-20 cursor-pointer ${
                            isBento
                                ? 'p-1.5 rounded-lg border-2 border-black bg-white hover:bg-[#fed7aa] text-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                        aria-label={tx('Close settings', 'قفل الإعدادات')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
                <div className="app-dialog-panel-content p-8">
                    <div className="mb-8">
                        <h2 className={`text-2xl font-black mb-1 ${isBento ? 'text-black' : 'text-gray-900 dark:text-white'}`}>
                            {tx('Account Settings', 'إعدادات الحساب')}
                        </h2>
                        <p className={`text-sm ${isBento ? 'text-gray-700 font-bold' : 'text-gray-500 dark:text-gray-400 font-medium'}`}>
                            {tx('Manage your personal details, appearance, language, and account security', 'عدل بياناتك وشكل المنصة ولغتها وإعدادات الأمان')}
                        </p>
                    </div>
                    {alertBanner}
                    <div className="space-y-6">
                        {profileInfoSection}
                        {appearanceSection}
                        {languageSection}
                        {appAndUpdatesSection}
                        {navCustomizationSection}
                        <div className={`pt-6 border-t ${isBento ? 'border-black' : 'border-gray-200 dark:border-white/5'}`}>
                            {securitySection}
                        </div>
                        {actionButtons}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default UserSettings;
