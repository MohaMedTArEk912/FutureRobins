import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, User as UserIcon, RefreshCw } from 'lucide-react';
import { useOptionalAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';

interface DemoRoleSwitchButtonProps {
    variant?: 'navbar' | 'navbar-mobile' | 'drawer' | 'sidebar' | 'sidebar-collapsed';
    onAfterSwitch?: () => void;
}

const DEFAULT_STUDENT_NAME = 'Alex Demo (Explorer)';
const DEFAULT_TEACHER_NAME = 'Prof. Demo (Educator)';

export const DemoRoleSwitchButton: React.FC<DemoRoleSwitchButtonProps> = ({
    variant = 'navbar',
    onAfterSwitch
}) => {
    const auth = useOptionalAuth();
    const currentUser = auth?.currentUser ?? null;
    const demoLogin = auth?.demoLogin;
    const { language, tx } = useLanguage();
    const { isBento } = useTheme();
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    const [switching, setSwitching] = useState(false);

    const isDemoAccount =
        currentUser?.userId === 'demo_student' || currentUser?.userId === 'demo_teacher';

    if (!isDemoAccount || !demoLogin) {
        return null;
    }

    const isDemoTeacher = currentUser?.userId === 'demo_teacher';
    const nextRole: 'student' | 'teacher' = isDemoTeacher ? 'student' : 'teacher';

    const handleSwitch = async () => {
        if (switching) return;
        setSwitching(true);
        try {
            let savedName: string | undefined;
            try {
                savedName = sessionStorage.getItem('demoVisitorName')?.trim() || undefined;
            } catch {
                savedName = undefined;
            }
            const currentCustomName =
                currentUser?.name &&
                currentUser.name !== DEFAULT_STUDENT_NAME &&
                currentUser.name !== DEFAULT_TEACHER_NAME
                    ? currentUser.name
                    : undefined;

            await demoLogin({
                role: nextRole,
                preferredLanguage: language,
                name: savedName || currentCustomName
            });
            onAfterSwitch?.();
            navigate('/', { replace: true });
            showNotification(
                'info',
                nextRole === 'teacher'
                    ? tx('Switched to Teacher Studio Demo view.', 'تم التحويل إلى عرض استوديو المدرس التجريبي.')
                    : tx('Switched to Student Demo view.', 'تم التحويل إلى عرض الطالب التجريبي.')
            );
        } catch (err) {
            console.error('Switch demo role error:', err);
            showNotification(
                'error',
                tx('Could not switch demo view. Please try again.', 'مقدرناش نبدل الوضع دلوقتي، جرب تاني.')
            );
        } finally {
            setSwitching(false);
        }
    };

    const Icon = switching ? RefreshCw : isDemoTeacher ? UserIcon : GraduationCap;
    const iconAnim = switching ? 'animate-spin' : '';

    if (variant === 'navbar-mobile') {
        const shortLabel = switching
            ? '...'
            : isDemoTeacher
              ? tx('Student', 'طالب')
              : tx('Teacher', 'مدرس');
        return (
            <button
                type="button"
                disabled={switching}
                onClick={() => void handleSwitch()}
                title={
                    isDemoTeacher
                        ? tx('Switch to Student View', 'التبديل لوضع الطالب')
                        : tx('Switch to Teacher Studio', 'التبديل لاستوديو المدرس')
                }
                aria-label={
                    isDemoTeacher
                        ? tx('Switch to Student View', 'التبديل لوضع الطالب')
                        : tx('Switch to Teacher Studio', 'التبديل لاستوديو المدرس')
                }
                className={`btn-unstyled h-9 px-2.5 rounded-xl flex items-center gap-1 text-[11px] font-black transition-all cursor-pointer active:scale-95 disabled:opacity-60 shrink-0 ${
                    isBento
                        ? 'bg-[#fde047] hover:bg-[#facc15] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                        : 'bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                }`}
            >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${iconAnim} ${isBento ? 'stroke-[2.5]' : ''}`} />
                <span>{shortLabel}</span>
            </button>
        );
    }

    if (variant === 'sidebar-collapsed') {
        return (
            <button
                type="button"
                disabled={switching}
                onClick={() => void handleSwitch()}
                title={
                    isDemoTeacher
                        ? tx('Switch to Student View', 'التبديل لوضع الطالب')
                        : tx('Switch to Teacher Studio', 'التبديل لاستوديو المدرس')
                }
                aria-label={
                    isDemoTeacher
                        ? tx('Switch to Student View', 'التبديل لوضع الطالب')
                        : tx('Switch to Teacher Studio', 'التبديل لاستوديو المدرس')
                }
                className={`btn-unstyled w-full py-2 rounded-xl flex items-center justify-center cursor-pointer transition-all disabled:opacity-60 ${
                    isBento
                        ? 'bg-[#fde047] hover:bg-[#facc15] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
            >
                <Icon className={`w-4 h-4 shrink-0 ${iconAnim}`} />
            </button>
        );
    }

    if (variant === 'drawer' || variant === 'sidebar') {
        const fullLabel = switching
            ? tx('Switching view...', 'بنبدل الوضع...')
            : isDemoTeacher
              ? tx('Switch to Student View', 'التبديل لوضع الطالب')
              : tx('Switch to Teacher Studio', 'التبديل لاستوديو المدرس');
        return (
            <button
                type="button"
                disabled={switching}
                onClick={() => void handleSwitch()}
                className={`btn-unstyled w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60 ${
                    isBento
                        ? 'bg-[#fde047] hover:bg-[#facc15] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                }`}
            >
                <Icon className={`w-4 h-4 shrink-0 ${iconAnim} ${isBento ? 'stroke-[2.5]' : ''}`} />
                <span className="truncate">{fullLabel}</span>
            </button>
        );
    }

    // Default: desktop 'navbar'
    const navLabel = switching
        ? tx('Switching...', 'بنبدل...')
        : isDemoTeacher
          ? tx('Student View', 'عرض الطالب')
          : tx('Teacher Studio', 'استوديو المدرس');

    return (
        <button
            type="button"
            disabled={switching}
            onClick={() => void handleSwitch()}
            title={
                isDemoTeacher
                    ? tx('Switch demo to Student view', 'التبديل إلى حساب الطالب التجريبي')
                    : tx('Switch demo to Teacher Studio view', 'التبديل إلى استوديو المدرس التجريبي')
            }
            className={`btn-unstyled h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-black transition-all cursor-pointer active:scale-95 disabled:opacity-60 shrink-0 ${
                isBento
                    ? 'bg-[#fde047] hover:bg-[#facc15] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                    : 'bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
            }`}
        >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${iconAnim} ${isBento ? 'stroke-[2.5]' : ''}`} />
            <span className="whitespace-nowrap">{navLabel}</span>
        </button>
    );
};

export default DemoRoleSwitchButton;
