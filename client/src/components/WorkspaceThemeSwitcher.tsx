import React, { useMemo } from 'react';
import { Sun, Moon, LayoutGrid } from 'lucide-react';
import { useTheme, type AppTheme } from '../context/ThemeContext';
import { getTeacherThemeStyles } from './teacher/teacherTheme';

interface WorkspaceThemeSwitcherProps {
    label?: string;
    className?: string;
}

const THEME_OPTIONS: { id: AppTheme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'bento', label: 'Bento', icon: LayoutGrid }
];

export const WorkspaceThemeSwitcher: React.FC<WorkspaceThemeSwitcherProps> = ({
    label = 'Workspace Theme',
    className = ''
}) => {
    const { theme, setTheme } = useTheme();
    const styles = useMemo(() => getTeacherThemeStyles(theme), [theme]);

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <div className={`text-[10px] uppercase tracking-widest px-1 ${styles.sidebarSectionLabel}`}>
                    {label}
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
                            <span>{opt.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default WorkspaceThemeSwitcher;
