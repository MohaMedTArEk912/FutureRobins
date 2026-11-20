import React from 'react';
import { Check, Sun, Moon, LayoutGrid } from 'lucide-react';
import { useTheme, type AppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface ThemePreviewOption {
    id: AppTheme;
    title: string;
    arTitle: string;
    subtitle: string;
    arSubtitle: string;
    tag: string;
    arTag: string;
    icon: React.ComponentType<{ className?: string }>;
}

const THEMES: ThemePreviewOption[] = [
    {
        id: 'light',
        title: 'Modern Light',
        arTitle: 'الوضع الفاتح (لايت)',
        subtitle: 'Clean daylight aesthetic with vibrant indigo accents',
        arSubtitle: 'شكل نهاري مريح للعين بألوان نيلي رايقة وواضحة',
        tag: 'Clean & Crisp',
        arTag: 'هادي ومريح',
        icon: Sun
    },
    {
        id: 'dark',
        title: 'Cyber Dark',
        arTitle: 'الوضع الليلي (دارك)',
        subtitle: 'Deep slate night palette with glowing indicators',
        arSubtitle: 'خلفية غامقة مريحة للمذاكرة بالليل وإضاءة هادية',
        tag: 'Focus & Contrast',
        arTag: 'تركيز بالليل',
        icon: Moon
    },
    {
        id: 'bento',
        title: 'Neo-Brutalist',
        arTitle: 'بينتو العصري (Bento)',
        subtitle: 'Playful pop palette with bold borders & hard shadows',
        arSubtitle: 'تصميم مميز بحدود واضحة وألوان مبهجة وحية',
        tag: 'Pop & Bold',
        arTag: 'جريء ومميز',
        icon: LayoutGrid
    }
];

interface ThemeSkeletonPreviewCardsProps {
    onThemeSelect: (theme: AppTheme) => void;
}

const ThemeSkeletonPreviewCards: React.FC<ThemeSkeletonPreviewCardsProps> = ({ onThemeSelect }) => {
    const { theme: currentTheme } = useTheme();
    const { tx } = useLanguage();

    return (
        <div className="grid w-full shrink-0 gap-2 md:grid-cols-3 md:gap-3">
            {THEMES.map((item) => {
                const isSelected = currentTheme === item.id;
                const Icon = item.icon;

                return (
                    <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => onThemeSelect(item.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onThemeSelect(item.id);
                            }
                        }}
                        className={`relative group flex min-w-0 cursor-pointer select-none flex-col justify-between rounded-2xl text-start transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 p-2.5 md:p-3.5 [@media(max-height:400px)]:py-1.5 ${
                            isSelected
                                ? currentTheme === 'bento'
                                    ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                                    : 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white border-2 border-indigo-600 dark:border-indigo-500 shadow-xl dark:shadow-indigo-500/10'
                                : currentTheme === 'bento'
                                    ? 'bg-white/80 hover:bg-white text-black border-2 border-black/60 shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5'
                                    : 'bg-slate-50/80 hover:bg-white dark:bg-white/[0.03] dark:hover:bg-white/[0.07] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
                        }`}
                    >
                        <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-2.5 md:block">
                            {/* Header Info */}
                            <div className="flex min-w-0 items-center justify-between gap-1.5 md:mb-2.5">
                                <div className="flex min-w-0 items-center gap-2">
                                    <div className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                                        item.id === 'bento'
                                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                            : item.id === 'dark'
                                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                                : 'bg-indigo-100 text-indigo-600 border border-indigo-200'
                                    }`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black tracking-tight leading-tight">
                                            {tx(item.title, item.arTitle)}
                                        </h4>
                                        <span className="text-[10px] uppercase font-bold opacity-70 tracking-wider block leading-tight [@media(max-height:350px)]:hidden">
                                            {tx(item.tag, item.arTag)}
                                        </span>
                                    </div>
                                </div>

                                <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${isSelected
                                    ? currentTheme === 'bento' ? 'border-black bg-[#bef264] text-black' : 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-slate-300 dark:border-white/25'}`}>
                                    {isSelected && <Check className="size-3.5 stroke-[3]" />}
                                </span>
                            </div>

                            {/* Visual Wireframe Skeleton */}
                            <div aria-hidden="true" className={`w-full overflow-hidden rounded-xl transition-all p-1 md:mb-2.5 md:p-2 [@media(max-height:400px)]:md:mb-0 ${
                                item.id === 'light'
                                    ? 'bg-[#f8fafc] border border-slate-200 shadow-inner'
                                    : item.id === 'dark'
                                        ? 'bg-[#080c16] border border-white/10 shadow-inner'
                                        : 'bg-[#f5f3ec] border-2 border-black shadow-[2px_2px_0px_#000]'
                            }`}>
                                {/* Mini Navbar */}
                                <div className={`h-6 rounded-lg px-2 items-center justify-between mb-2 hidden md:flex [@media(max-height:400px)]:md:hidden ${
                                    item.id === 'light'
                                        ? 'bg-white border border-slate-200/80 shadow-xs'
                                        : item.id === 'dark'
                                            ? 'bg-[#0f1526] border border-white/10'
                                            : 'bg-white border-1.5 border-black shadow-[1.5px_1.5px_0px_#000]'
                                }`}>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2.5 h-2.5 rounded-md ${
                                            item.id === 'bento' ? 'bg-[#fde047] border border-black' : 'bg-indigo-600'
                                        }`} />
                                        <div className={`w-10 h-1.5 rounded-full ${
                                            item.id === 'dark' ? 'bg-white/40' : item.id === 'bento' ? 'bg-black' : 'bg-slate-300'
                                        }`} />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className={`w-4 h-1.5 rounded-full ${item.id === 'dark' ? 'bg-white/20' : 'bg-slate-200'}`} />
                                        <div className={`w-4 h-1.5 rounded-full ${item.id === 'dark' ? 'bg-white/20' : 'bg-slate-200'}`} />
                                    </div>
                                </div>

                                {/* Mini Hero Card */}
                                <div className={`rounded-md p-1 md:rounded-xl md:p-2 ${
                                    item.id === 'light'
                                        ? 'bg-white border border-slate-200/80 shadow-xs'
                                        : item.id === 'dark'
                                            ? 'bg-[#0f1526] border border-indigo-500/30 shadow-sm'
                                            : 'bg-[#bef264] border-1.5 border-black shadow-[2px_2px_0px_#000]'
                                }`}>
                                    <div className="mb-1 hidden items-center justify-between md:flex">
                                        <div className={`w-8 h-2 rounded-full ${
                                            item.id === 'bento' ? 'bg-black' : 'bg-indigo-500'
                                        }`} />
                                        <div className={`w-3 h-3 rounded-full ${
                                            item.id === 'bento' ? 'bg-[#fde047] border border-black' : 'bg-emerald-500'
                                        }`} />
                                    </div>
                                    <div className={`w-3/4 rounded-full mb-1 h-1.5 md:h-2 ${
                                        item.id === 'dark' ? 'bg-white/80' : 'bg-slate-800'
                                    }`} />
                                    <div className={`w-1/2 rounded-full h-1 md:mb-2 md:h-1.5 ${
                                        item.id === 'dark' ? 'bg-white/40' : 'bg-slate-400'
                                    }`} />

                                    {/* Miniature Button */}
                                    <div className={`w-16 h-4 rounded-md items-center justify-center text-[8px] font-bold hidden md:flex [@media(max-height:400px)]:md:hidden ${
                                        item.id === 'light'
                                            ? 'bg-indigo-600 text-white'
                                            : item.id === 'dark'
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-[#fde047] text-black border border-black shadow-[1px_1px_0px_#000]'
                                    }`}>
                                        Start Quiz
                                    </div>
                                </div>

                                {/* Mini Stats 2-Card Row */}
                                <div className="mt-2 hidden md:grid [@media(max-height:560px)]:md:hidden grid-cols-2 gap-1.5">
                                    <div className={`p-1.5 rounded-lg ${
                                        item.id === 'light'
                                            ? 'bg-white border border-slate-200/80'
                                            : item.id === 'dark'
                                                ? 'bg-[#0f1526] border border-white/5'
                                                : 'bg-[#bae6fd] border-1.5 border-black shadow-[1px_1px_0px_#000]'
                                    }`}>
                                        <div className={`w-6 h-1 rounded-full mb-1 ${item.id === 'dark' ? 'bg-white/30' : 'bg-slate-400'}`} />
                                        <div className={`w-8 h-2 rounded-full ${item.id === 'bento' ? 'bg-black' : 'bg-indigo-500'}`} />
                                    </div>
                                    <div className={`p-1.5 rounded-lg ${
                                        item.id === 'light'
                                            ? 'bg-white border border-slate-200/80'
                                            : item.id === 'dark'
                                                ? 'bg-[#0f1526] border border-white/5'
                                                : 'bg-[#fde047] border-1.5 border-black shadow-[1px_1px_0px_#000]'
                                    }`}>
                                        <div className={`w-6 h-1 rounded-full mb-1 ${item.id === 'dark' ? 'bg-white/30' : 'bg-slate-400'}`} />
                                        <div className={`w-8 h-2 rounded-full ${item.id === 'bento' ? 'bg-black' : 'bg-emerald-500'}`} />
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs opacity-75 font-medium leading-relaxed hidden md:block [@media(max-height:400px)]:md:hidden">
                                {tx(item.subtitle, item.arSubtitle)}
                            </p>
                        </div>

                    </div>
                );
            })}
        </div>
    );
};

export default ThemeSkeletonPreviewCards;
