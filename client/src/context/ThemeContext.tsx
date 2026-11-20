/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import ThemeSelectionModal from '../components/ThemeSelectionModal';

export type AppTheme = 'light' | 'dark' | 'bento';

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
        // Check localStorage then sessionStorage
        try {
            const saved = localStorage.getItem('theme') || sessionStorage.getItem('theme');
            if (saved === 'bento' || saved === 'dark' || saved === 'light') {
                return saved;
            }
        } catch {
            // Storage access safeguard
        }
        // Check system preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        // Apply theme to document
        const root = document.documentElement;
        if (theme === 'bento') {
            root.setAttribute('data-layout', 'bento');
            root.setAttribute('data-theme', 'bento');
            root.classList.remove('dark');
            root.classList.add('bento');
        } else if (theme === 'dark') {
            root.removeAttribute('data-layout');
            root.setAttribute('data-theme', 'dark');
            root.classList.remove('bento');
            root.classList.add('dark');
        } else {
            root.removeAttribute('data-layout');
            root.setAttribute('data-theme', 'light');
            root.classList.remove('dark', 'bento');
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
