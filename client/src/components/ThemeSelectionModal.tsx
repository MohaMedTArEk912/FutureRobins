import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, X } from 'lucide-react';
import { useTheme, type AppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import ThemeSkeletonPreviewCards from './ThemeSkeletonPreviewCards';

interface ThemeSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ThemeSelectionModal: React.FC<ThemeSelectionModalProps> = ({
    isOpen,
    onClose
}) => {
    const { theme, isBento, setTheme } = useTheme();
    const { isArabic, tx } = useLanguage();

    if (!isOpen) return null;

    const handleThemePick = (chosenTheme: AppTheme) => {
        setTheme(chosenTheme);
        onClose();
    };

    const handleConfirm = () => {
        handleThemePick(theme);
    };

    return createPortal(
        <div className="app-dialog-overlay fixed inset-0 z-[10030] flex justify-center animate-in fade-in duration-200">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="theme-selection-title"
                className={`app-dialog-panel relative my-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl p-4 animate-in zoom-in-95 duration-200 md:max-w-2xl md:gap-5 md:p-6 [@media(max-height:400px)]:gap-2.5 [@media(max-height:400px)]:p-3 ${
                    isBento
                        ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                        : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2b2722] shadow-[0_8px_0_#050504]'
                }`}
            >
                <header className="shrink-0 px-8 text-center">
                    <h2 id="theme-selection-title" className="text-xl font-black tracking-tight md:text-3xl">
                        {tx('Choose your theme', 'اختار الثيم اللي يناسبك')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={tx('Close theme picker', 'اقفل اختيار الثيم')}
                        className="absolute end-2 top-2 grid size-9 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-[#a8a29e] dark:hover:bg-[#f5f3ec]/10 dark:hover:text-[#f5f3ec] md:end-3 md:top-3"
                    >
                        <X aria-hidden="true" className="size-4" />
                    </button>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-[#b5aea4] md:text-sm [@media(max-height:400px)]:hidden">
                        {tx('You can change your theme anytime in Account Settings.', 'تقدر تغيّر الثيم في أي وقت من إعدادات الحساب.')}
                    </p>
                </header>

                <ThemeSkeletonPreviewCards onThemeSelect={handleThemePick} />

                <footer className="flex shrink-0 justify-end border-t border-slate-200/80 pt-3 dark:border-[#f5f3ec]/10 [@media(max-height:400px)]:pt-2">
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className={`flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all active:scale-95 md:w-auto ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2.5 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5'
                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_10px_28px_-6px_rgba(190,242,100,0.35)]'
                        }`}
                    >
                        <span>{tx('Confirm & Continue', 'تأكيد والمتابعة')}</span>
                        <ArrowRight className={`w-4 h-4 ${isArabic ? 'rotate-180' : ''}`} />
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default ThemeSelectionModal;
