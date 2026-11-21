import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { AmbientBackground } from './AmbientBackground';

const PageLoader: React.FC = () => {
    const { isBento, isDark } = useTheme();

    return (
        <div
            role="status"
            aria-label="Loading"
            className={`flex items-center justify-center min-h-dvh transition-colors relative overflow-hidden ${
                isBento
                    ? 'bg-transparent'
                    : isDark
                        ? 'bg-[#0a0908]'
                        : 'bg-[#f8fafc]'
            }`}
        >
            <AmbientBackground />
            <div
                className={`relative z-10 h-9 w-9 rounded-full animate-spin ${
                    isBento
                        ? 'border-[3px] border-black/15 border-t-black'
                        : isDark
                            ? 'border-[2.5px] border-[#f5f3ec]/15 border-t-[#bef264]'
                            : 'border-[2.5px] border-slate-900/12 border-t-slate-900'
                }`}
            />
        </div>
    );
};

export default PageLoader;
