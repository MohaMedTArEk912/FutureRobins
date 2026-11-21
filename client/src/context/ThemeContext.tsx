/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import ThemeSelectionModal from '../components/ThemeSelectionModal';

export type AppTheme = 'dark' | 'bento';

interface ThemeContextType {
    theme: AppTheme;
    isDark: boolean;
    isBento: boolean;
    setTheme: (theme: AppTheme) => void;
    openThemeModal: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

    const [theme, setThemeState] = useState<AppTheme>(() => {
        // Check localStorage then sessionStorage; migrate legacy 'light' to Noir Studio ('dark')
        try {
            const saved = localStorage.getItem('theme') || sessionStorage.getItem('theme');
            if (saved === 'bento') {
                return 'bento';
            }
            if (saved === 'light') {
                localStorage.setItem('theme', 'dark');
                sessionStorage.setItem('theme', 'dark');
            }
        } catch {
            // Storage access safeguard
        }
        return 'dark';
    });

    useEffect(() => {
        // Apply theme to document (only Noir Studio dark or Neo-Brutalist bento)
        const root = document.documentElement;
        if (theme === 'bento') {
            root.setAttribute('data-layout', 'bento');
            root.setAttribute('data-theme', 'bento');
            root.classList.remove('dark');
            root.classList.add('bento');
        } else {
            root.removeAttribute('data-layout');
            root.setAttribute('data-theme', 'dark');
            root.classList.remove('bento');
            root.classList.add('dark');
        }
    }, [theme]);

    const setTheme = (nextTheme: AppTheme) => {
        setThemeState(nextTheme);
        try {
            localStorage.setItem('theme', nextTheme);
            sessionStorage.setItem('theme', nextTheme);
        } catch {
            // Storage access safeguard
        }
    };

    const openThemeModal = () => setIsThemeModalOpen(true);
    const closeThemeModal = () => setIsThemeModalOpen(false);

    const isDark = theme === 'dark';
    const isBento = theme === 'bento';

    return (
        <ThemeContext.Provider value={{
            theme,
            isDark,
            isBento,
            setTheme,
            openThemeModal
        }}>
            {children}
            <ThemeSelectionModal
                isOpen={isThemeModalOpen}
                onClose={closeThemeModal}
            />
        </ThemeContext.Provider>
    );
};
