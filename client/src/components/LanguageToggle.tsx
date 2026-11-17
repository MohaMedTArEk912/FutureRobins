import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface LanguageToggleProps {
    compact?: boolean;
    className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ compact = false, className = '' }) => {
    const { isArabic, toggleLanguage, tx } = useLanguage();
    const { isBento } = useTheme();

    return (
        <button
            type="button"
            onClick={() => void toggleLanguage()}
            className={`btn-unstyled inline-flex items-center justify-center gap-1.5 rounded-xl font-black transition-all cursor-pointer active:scale-95 ${
                compact ? 'h-9 px-2.5 text-xs' : 'h-9 px-3 text-xs'
            } ${
                isBento
                    ? 'bg-white hover:bg-[#fef08a] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10'
            } ${className}`}
            title={tx('Switch to Egyptian Arabic (مصري)', 'Switch to English')}
            aria-label={tx('Switch language to Egyptian Arabic', 'تغيير اللغة إلى الإنجليزية')}
        >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">
                {isArabic ? 'EN' : 'مصري'}
            </span>
        </button>
    );
};

export default LanguageToggle;
