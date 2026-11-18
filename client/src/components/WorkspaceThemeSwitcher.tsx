import React, { useMemo } from 'react';
import { Sun, Moon, LayoutGrid } from 'lucide-react';
import { useTheme, type AppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getTeacherThemeStyles } from './teacher/teacherTheme';

interface WorkspaceThemeSwitcherProps {
    label?: string;
    className?: string;
}

const THEME_OPTIONS: { id: AppTheme; label: string; arLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'light', label: 'Light', arLabel: 'فاتح', icon: Sun },
    { id: 'dark', label: 'Dark', arLabel: 'غامق', icon: Moon },
    { id: 'bento', label: 'Bento', arLabel: 'بينتو', icon: LayoutGrid }
];

export const WorkspaceThemeSwitcher: React.FC<WorkspaceThemeSwitcherProps> = ({
    label,
    className = ''
}) => {
    const { theme, setTheme } = useTheme();
    const { tx } = useLanguage();
    const resolvedLabel = label ?? tx('Workspace Theme', 'ثيم المنصة');
    const styles = useMemo(() => getTeacherThemeStyles(theme), [theme]);

    return (
        <div className={`space-y-1.5 ${className}`}>
            {resolvedLabel && (
                <div className={`text-[10px] uppercase tracking-widest px-1 ${styles.sidebarSectionLabel}`}>
                    {resolvedLabel}
                </div>
            )}
            <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl ${styles.themeSwitcherBox}`}>
                {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = theme === opt.id;
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTheme(opt.id)}
                            aria-pressed={active}
                            className={`py-1.5 px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                active ? styles.themeOptionActive : styles.themeOptionIdle
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span>{tx(opt.label, opt.arLabel)}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default WorkspaceThemeSwitcher;
