import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Check, ArrowRight, Sparkles, X } from 'lucide-react';
import { useLanguage, type AppLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export const PlatformLanguageModal: React.FC = () => {
    const {
        language,
        isLanguageModalOpen,
        needsAccountSelection,
        closeLanguageModal,
        setLanguage,
        confirmLanguageChoice
    } = useLanguage();
    const { isBento } = useTheme();
    const [selectedChoice, setSelectedChoice] = useState<AppLanguage>(language);
    const [saving, setSaving] = useState(false);
    const initialLangRef = useRef<AppLanguage>(language);

    useEffect(() => {
        if (isLanguageModalOpen) {
            initialLangRef.current = language;
            setSelectedChoice(language);
        }
    }, [isLanguageModalOpen, language]);

    if (!isLanguageModalOpen || typeof document === 'undefined') return null;

    const handlePreviewPick = async (choice: AppLanguage) => {
        setSelectedChoice(choice);
        // Live preview without permanently locking until user hits Confirm
        await setLanguage(choice, false);
    };

    const handleCancel = async () => {
        if (language !== initialLangRef.current) {
            await setLanguage(initialLangRef.current, false);
        }
        closeLanguageModal();
    };

    const handleConfirm = async () => {
        setSaving(true);
        try {
            await confirmLanguageChoice(selectedChoice);
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[260] flex items-center justify-center p-3 sm:p-6 bg-black/50 dark:bg-black/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
            onClick={() => {
                if (!needsAccountSelection) handleCancel();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Choose Platform Language"
                onClick={(e) => e.stopPropagation()}
                className={`relative w-full max-w-2xl p-5 sm:p-8 rounded-3xl transition-all animate-in zoom-in-95 duration-200 my-auto ${
                    isBento
                        ? 'bg-white text-black border-[3px] border-black shadow-[8px_8px_0px_#000]'
                        : 'bg-white dark:bg-[#0c101c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-2xl'
                }`}
            >
                {!needsAccountSelection && (
                    <button
                        type="button"
                        onClick={handleCancel}
                        className={`btn-unstyled absolute top-4 end-4 p-2 rounded-xl cursor-pointer transition-all ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047]'
                                : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
                        }`}
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}

                {/* Bilingual Header */}
                <div className="text-center max-w-xl mx-auto mb-6">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-3 select-none">
                        <span className={`px-3 py-1 rounded-full flex items-center gap-1.5 ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                        }`}>
                            <Globe className="w-3.5 h-3.5" />
                            <span>لغة المنصة • Platform Language</span>
                        </span>
                    </div>

                    <h2 className="text-xl sm:text-3xl font-black tracking-tight mb-2">
                        {selectedChoice === 'ar-EG'
                            ? 'أهلاً بيك! اختار لغة المنصة'
                            : 'Choose Your Platform Language'}
                    </h2>
                    <p className={`text-xs sm:text-sm font-semibold leading-relaxed ${
                        isBento ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                        {selectedChoice === 'ar-EG'
                            ? 'اختار اللغة اللي تريحك للشغل والمذاكرة. تقدر تغيرها في أي وقت من البروفايل.'
                            : 'Select Egyptian Arabic or English for menus, quizzes, classes & settings. You can change this anytime from your Profile.'}
                    </p>
                </div>

                {/* Language Option Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {/* Egyptian Arabic Card */}
                    <button
                        type="button"
                        onClick={() => handlePreviewPick('ar-EG')}
                        dir="rtl"
                        className={`btn-unstyled group relative flex flex-col items-start justify-between p-5 rounded-2xl text-right transition-all cursor-pointer ${
                            selectedChoice === 'ar-EG'
                                ? (isBento
                                    ? 'bg-[#bef264] text-black border-[3px] border-black shadow-[5px_5px_0px_#000] -translate-y-0.5'
                                    : 'bg-indigo-50 dark:bg-indigo-600/20 border-2 border-indigo-500 shadow-lg ring-2 ring-indigo-500/20')
                                : (isBento
                                    ? 'bg-neutral-50 hover:bg-[#fef9c3] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10')
                        }`}
                    >
                        <div className="w-full flex items-center justify-between gap-2 mb-3">
                            <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-black ${
                                isBento ? 'bg-white text-black border-2 border-black' : 'bg-white dark:bg-black/30 text-slate-900 dark:text-white'
                            }`}>
                                <span className="text-base leading-none">🇪🇬</span>
                                <span>مصري • RTL</span>
                            </span>
                            {selectedChoice === 'ar-EG' && (
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                    isBento ? 'bg-black text-[#bef264]' : 'bg-indigo-600 text-white'
                                }`}>
                                    <Check className="w-3.5 h-3.5" />
                                </span>
                            )}
                        </div>

                        <div className="w-full space-y-1.5">
                            <div className="text-lg font-black">العربية المصرية</div>
                            <p className={`text-xs font-semibold leading-relaxed ${
                                selectedChoice === 'ar-EG' && isBento ? 'text-black/80' : 'text-slate-600 dark:text-slate-400'
                            }`}>
                                واجهة سهلة بالعامية المصرية لكل القوائم والكويزات والكلاسات مع دعم كامل للكتابة من اليمين لليسار، والأكواد بتفضل بالإنجليزي.
                            </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 w-full flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10">لوحة التحكم</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10">كويزات</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10">كلاساتك</span>
                        </div>
                    </button>

                    {/* English Card */}
                    <button
                        type="button"
                        onClick={() => handlePreviewPick('en')}
                        dir="ltr"
                        className={`btn-unstyled group relative flex flex-col items-start justify-between p-5 rounded-2xl text-left transition-all cursor-pointer ${
                            selectedChoice === 'en'
                                ? (isBento
                                    ? 'bg-[#bae6fd] text-black border-[3px] border-black shadow-[5px_5px_0px_#000] -translate-y-0.5'
                                    : 'bg-indigo-50 dark:bg-indigo-600/20 border-2 border-indigo-500 shadow-lg ring-2 ring-indigo-500/20')
                                : (isBento
                                    ? 'bg-neutral-50 hover:bg-[#fef9c3] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10')
                        }`}
                    >
                        <div className="w-full flex items-center justify-between gap-2 mb-3">
                            <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-black ${
                                isBento ? 'bg-white text-black border-2 border-black' : 'bg-white dark:bg-black/30 text-slate-900 dark:text-white'
                            }`}>
                                <span className="text-base leading-none">🇺🇸</span>
                                <span>English • LTR</span>
                            </span>
                            {selectedChoice === 'en' && (
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                    isBento ? 'bg-black text-[#bae6fd]' : 'bg-indigo-600 text-white'
                                }`}>
                                    <Check className="w-3.5 h-3.5" />
                                </span>
                            )}
                        </div>

                        <div className="w-full space-y-1.5">
                            <div className="text-lg font-black">English</div>
                            <p className={`text-xs font-semibold leading-relaxed ${
                                selectedChoice === 'en' && isBento ? 'text-black/80' : 'text-slate-600 dark:text-slate-400'
                            }`}>
                                Standard left-to-right developer UI for navigation tabs, live classrooms, leaderboards, study flashcards, and analytics.
                            </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 w-full flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10">Dashboard</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10">Quizzes</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10">Classes</span>
                        </div>
                    </button>
                </div>

                {/* Confirm Footer */}
                <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t ${
                    isBento ? 'border-black/15' : 'border-slate-200/80 dark:border-white/10'
                }`}>
                    <div className={`flex items-center gap-2 text-xs font-bold ${
                        isBento ? 'text-black/75' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>
                            {selectedChoice === 'ar-EG'
                                ? 'الاختيار الحالي: العربية المصرية (تقدر تغيرها من البروفايل)'
                                : 'Active Selection: English (Changeable anytime in Profile)'}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={saving}
                        className={`btn-unstyled w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60 ${
                            isBento
                                ? 'bg-[#fde047] hover:bg-[#facc15] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:-translate-y-0.5'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                        }`}
                    >
                        <span>
                            {saving
                                ? (selectedChoice === 'ar-EG' ? 'جاري الحفظ...' : 'Saving...')
                                : (selectedChoice === 'ar-EG' ? 'حفظ اللغة والمتابعة' : 'Confirm & Continue')}
                        </span>
                        <ArrowRight className={`w-4 h-4 ${selectedChoice === 'ar-EG' ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PlatformLanguageModal;
