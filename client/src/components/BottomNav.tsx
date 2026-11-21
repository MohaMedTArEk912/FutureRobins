import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavArrangement } from '../context/NavArrangementContext';
import { prefetchRoute } from '../lib/routePrefetch';

export const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser } = useAuth();
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const { bottomNavItems } = useNavArrangement();

    const isGuest = !currentUser || currentUser.userId === 'guest' || !currentUser.email;

    if (currentUser?.role === 'teacher') {
        return null;
    }

    const navItems = [
        ...bottomNavItems.map(item => ({
            path: item.path,
            label: item.shortLabel || item.label,
            icon: item.icon,
            isActive: item.path === '/'
                ? (location.pathname === '/' || location.pathname === '/dashboard')
                : (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
        })),
        currentUser?.role === 'admin' && !bottomNavItems.some(i => i.path === '/admin')
            ? {
                path: '/admin',
                label: tx('Admin', 'الإدارة'),
                icon: Shield,
                isActive: location.pathname === '/admin'
            }
            : {
                path: isGuest ? '/login' : '/profile',
                label: isGuest ? tx('Sign In', 'دخول') : tx('Profile', 'حسابي'),
                icon: User,
                isActive: location.pathname === '/profile' || location.pathname === '/login' || location.pathname === '/register'
            }
    ];

    return (
        <nav
            data-snake-wall="bottom"
            aria-label={tx('Mobile Bottom Navigation', 'شريط التنقل السفلي')}
            className={`fixed bottom-0 left-0 right-0 z-40 xl:hidden pb-safe border-t transition-colors ${
                isBento
                    ? 'bg-white border-t-2 border-black shadow-[0_-2px_0px_#000]'
                    : 'bg-white/90 dark:bg-[#11100e] backdrop-blur-xl dark:backdrop-blur-none border-slate-200/80 dark:border-[#2b2722] shadow-lg'
            }`}
        >
            <div className="max-w-md mx-auto px-2 py-1 flex items-center justify-around">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = item.isActive;

                    return (
                        <button
                            key={item.path}
                            type="button"
                            onClick={() => navigate(item.path)}
                            onMouseEnter={() => prefetchRoute(item.path)}
                            onTouchStart={() => prefetchRoute(item.path)}
                            aria-label={tx(`Navigate to ${item.label}`, `الانتقال إلى ${item.label}`)}
                            className={`flex flex-col items-center justify-center min-h-[44px] min-w-[54px] py-1 px-2 rounded-xl transition-all cursor-pointer relative touch-target active:scale-95 ${
                                isBento
                                    ? (active
                                        ? 'bg-[#bef264] text-black border-2 border-black font-black shadow-[1.5px_1.5px_0px_#000]'
                                        : 'text-black hover:bg-[#fef9c3] font-bold')
                                    : (active
                                        ? 'text-indigo-600 dark:text-[#bef264] font-bold'
                                        : 'text-slate-500 dark:text-[#a8a29e] hover:text-slate-800 dark:hover:text-[#f5f3ec] font-medium')
                            }`}
                        >
                            <Icon
                                className={`w-5 h-5 transition-transform ${
                                    active ? 'scale-110' : ''
                                } ${isBento ? 'stroke-[2.5]' : ''}`}
                            />
                            <span className="text-[10px] tracking-tight mt-0.5 leading-none">
                                {item.label}
                            </span>
                            {!isBento && active && (
                                <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-[#bef264]" />
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
