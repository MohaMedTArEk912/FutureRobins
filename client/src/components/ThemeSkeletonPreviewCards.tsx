import React from 'react';
import { Check, Moon, LayoutGrid } from 'lucide-react';
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
        id: 'dark',
        title: 'Noir Studio',
        arTitle: 'نوار ستوديو (دارك)',
        subtitle: 'Solid matte obsidian with interactive geometric snake grid & high-contrast accents',
        arSubtitle: 'أسود مطفي صلب مع خلفية هندسية تفاعلية وتباين عالي مريح للعين',
        tag: 'Solid & Geometric',
        arTag: 'صلب وهندسي',
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
        <div className="grid w-full shrink-0 gap-2.5 md:grid-cols-2 md:gap-4">
            {THEMES.map((item) => {
                const isSelected = currentTheme === item.id;
                const Icon = item.icon;
                const isCardDark = item.id === 'dark';

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
                        className={`relative group flex min-w-0 cursor-pointer select-none flex-col justify-between rounded-2xl text-start transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bef264] p-3 md:p-4 [@media(max-height:400px)]:py-1.5 ${
                            isSelected
                                ? currentTheme === 'bento'
                                    ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                                    : 'bg-[#1c1917] text-[#f5f3ec] border-2 border-[#bef264] shadow-[0_14px_34px_-10px_rgba(190,242,100,0.18)]'
                                : currentTheme === 'bento'
                                    ? 'bg-white/80 hover:bg-white text-black border-2 border-black/60 shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5'
                                    : 'bg-[#141210] hover:bg-[#1c1917] text-[#f5f3ec] border border-[#f5f3ec]/10 hover:border-[#f5f3ec]/22 hover:shadow-md hover:-translate-y-0.5'
                        }`}
                    >
                        <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-2.5 md:block">
                            {/* Header Info */}
                            <div className="flex min-w-0 items-center justify-between gap-1.5 md:mb-2.5">
                                <div className="flex min-w-0 items-center gap-2">
                                    <div className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                                        isCardDark
                                            ? 'bg-[#1c1917] text-[#bef264] border border-[#bef264]/35'
                                            : 'bg-[#fde047] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
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
                                    ? currentTheme === 'bento'
                                        ? 'border-black bg-[#bef264] text-black'
                                        : 'border-[#bef264] bg-[#bef264] text-[#0a0908]'
                                    : currentTheme === 'bento'
                                        ? 'border-black/30'
                                        : 'border-[#f5f3ec]/25'}`}>
                                    {isSelected && <Check className="size-3.5 stroke-[3]" />}
                                </span>
                            </div>

                            {/* Visual Wireframe Skeleton */}
                            <div aria-hidden="true" className={`w-full overflow-hidden rounded-xl transition-all p-1 md:mb-2.5 md:p-2 [@media(max-height:400px)]:md:mb-0 ${
                                isCardDark
                                    ? 'bg-[#0a0908] border border-[#f5f3ec]/14 shadow-inner'
                                    : 'bg-[#f5f3ec] border-2 border-black shadow-[2px_2px_0px_#000]'
                            }`}>
                                {/* Mini Navbar */}
                                <div className={`h-6 rounded-lg px-2 items-center justify-between mb-2 hidden md:flex [@media(max-height:400px)]:md:hidden ${
                                    isCardDark
                                        ? 'bg-[#141210] border border-[#f5f3ec]/10'
                                        : 'bg-white border-1.5 border-black shadow-[1.5px_1.5px_0px_#000]'
                                }`}>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2.5 h-2.5 rounded-md ${
                                            isCardDark
                                                ? 'bg-[#bef264]'
                                                : 'bg-[#fde047] border border-black'
                                        }`} />
                                        <div className={`w-10 h-1.5 rounded-full ${
                                            isCardDark ? 'bg-[#f5f3ec]/70' : 'bg-black'
                                        }`} />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className={`w-4 h-1.5 rounded-full ${isCardDark ? 'bg-[#f5f3ec]/25' : 'bg-slate-200'}`} />
                                        <div className={`w-4 h-1.5 rounded-full ${isCardDark ? 'bg-[#f5f3ec]/25' : 'bg-slate-200'}`} />
                                    </div>
                                </div>

                                {/* Mini Hero Card */}
                                <div className={`rounded-md p-1 md:rounded-xl md:p-2 ${
                                    isCardDark
                                        ? 'bg-[#141210] border border-[#f5f3ec]/12 shadow-[inset_0_1px_0_rgba(255,248,235,0.08)]'
                                        : 'bg-[#bef264] border-1.5 border-black shadow-[2px_2px_0px_#000]'
                                }`}>
                                    <div className="mb-1 hidden items-center justify-between md:flex">
                                        <div className={`w-8 h-2 rounded-full ${
                                            isCardDark ? 'bg-[#fde047]' : 'bg-black'
                                        }`} />
                                        <div className={`w-3 h-3 rounded-full ${
                                            isCardDark ? 'bg-[#fb7185]' : 'bg-[#fde047] border border-black'
                                        }`} />
                                    </div>
                                    <div className={`w-3/4 rounded-full mb-1 h-1.5 md:h-2 ${
                                        isCardDark ? 'bg-[#f5f3ec]/90' : 'bg-slate-800'
                                    }`} />
                                    <div className={`w-1/2 rounded-full h-1 md:mb-2 md:h-1.5 ${
                                        isCardDark ? 'bg-[#a8a29e]/50' : 'bg-slate-400'
                                    }`} />

                                    {/* Miniature Button */}
                                    <div className={`w-16 h-4 rounded-md items-center justify-center text-[8px] font-black hidden md:flex [@media(max-height:400px)]:md:hidden ${
                                        isCardDark
                                            ? 'bg-[#bef264] text-[#0a0908]'
                                            : 'bg-[#fde047] text-black border border-black shadow-[1px_1px_0px_#000]'
                                    }`}>
                                        Start Quiz
                                    </div>
                                </div>

                                {/* Mini Stats 2-Card Row */}
                                <div className="mt-2 hidden md:grid [@media(max-height:560px)]:md:hidden grid-cols-2 gap-1.5">
                                    <div className={`p-1.5 rounded-lg ${
                                        isCardDark
                                            ? 'bg-[#111518] border border-[#bae6fd]/30'
                                            : 'bg-[#bae6fd] border-1.5 border-black shadow-[1px_1px_0px_#000]'
                                    }`}>
                                        <div className={`w-6 h-1 rounded-full mb-1 ${isCardDark ? 'bg-[#f5f3ec]/30' : 'bg-slate-400'}`} />
                                        <div className={`w-8 h-2 rounded-full ${isCardDark ? 'bg-[#bae6fd]' : 'bg-black'}`} />
                                    </div>
                                    <div className={`p-1.5 rounded-lg ${
                                        isCardDark
                                            ? 'bg-[#181510] border border-[#fde047]/30'
                                            : 'bg-[#fde047] border-1.5 border-black shadow-[1px_1px_0px_#000]'
                                    }`}>
                                        <div className={`w-6 h-1 rounded-full mb-1 ${isCardDark ? 'bg-[#f5f3ec]/30' : 'bg-slate-400'}`} />
                                        <div className={`w-8 h-2 rounded-full ${isCardDark ? 'bg-[#fde047]' : 'bg-black'}`} />
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
