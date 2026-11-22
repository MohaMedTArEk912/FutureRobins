import React from 'react';
import { Palette } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface AuthThemeButtonProps {
    className?: string;
}

export const AuthThemeButton: React.FC<AuthThemeButtonProps> = ({ className = '' }) => {
    const { isBento, theme, openThemeModal } = useTheme();
    const { tx } = useLanguage();

    return (
        <div className={`absolute top-3 end-3 sm:top-6 sm:end-6 z-50 mt-safe me-safe ${className}`}>
            <button
                type="button"
                onClick={openThemeModal}
                className={`btn-unstyled h-9 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl transition-all cursor-pointer active:scale-95 whitespace-nowrap ${
                    isBento
                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047] font-black'
                        : 'bg-[#1c1917] border border-[#2e2924] hover:border-[#bef264]/60 hover:bg-[#24201c] text-[#f5f3ec] font-bold'
                }`}
                title={tx('Change Theme', 'تغيير الثيم')}
                aria-label={tx('Change Theme', 'تغيير الثيم')}
            >
                <Palette className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                <span className="text-[11px] sm:hidden">
                    {theme === 'bento' ? tx('Bento', 'بينتو') : tx('Noir', 'نوار')}
                </span>
                <span className="text-xs hidden sm:inline">{tx('Change Theme', 'تغيير الثيم')}</span>
            </button>
        </div>
    );
};

export default AuthThemeButton;
