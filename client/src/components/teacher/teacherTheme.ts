import type { AppTheme } from '../../context/ThemeContext';

export type TeacherSectionId =
    | 'overview'
    | 'my_classes'
    | 'sessions'
    | 'presentations'
    | 'board_studio'
    | 'analytics'
    | 'ai_studio'
    | 'students'
    | 'chat'
    | 'library';

export interface TeacherThemeStyles {
    theme: AppTheme;
    isBento: boolean;
    isDark: boolean;
    pageShell: string;
    sidebarShell: string;
    sidebarHeaderBorder: string;
    sidebarSwitcherBox: string;
    sidebarSectionLabel: string;
    navItemActive: string;
    navItemIdle: string;
    navBadgeActive: string;
    navBadgeIdle: string;
    surfaceCard: string;
    subtleBox: string;
    heroBanner: string;
    sectionHeaderCard: string;
    input: string;
    select: string;
    primaryBtn: string;
    secondaryBtn: string;
    dangerBtn: string;
    successBtn: string;
    mutedText: string;
    divider: string;
    pillPrimary: string;
    pillSuccess: string;
    pillWarning: string;
    pillDanger: string;
    pillNeutral: string;
    kpiTile: (accent: 'neutral' | 'indigo' | 'emerald' | 'amber' | 'violet') => string;
    themeSwitcherBox: string;
    themeOptionActive: string;
    themeOptionIdle: string;
    mobileTopBar: string;
}

export function getTeacherThemeStyles(theme: AppTheme): TeacherThemeStyles {
    const isBento = theme === 'bento';
    const isDark = theme === 'dark';

    if (isBento) {
        return {
            theme,
            isBento: true,
            isDark: false,
            pageShell: 'bg-transparent text-black',
            sidebarShell: 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]',
            sidebarHeaderBorder: 'border-b-2 border-black',
            sidebarSwitcherBox: 'bg-[#fef9c3] border-2 border-black shadow-[3px_3px_0px_#000]',
            sidebarSectionLabel: 'text-black/70 font-black',
            navItemActive: 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black',
            navItemIdle: 'text-black/80 hover:text-black hover:bg-[#f1f5f9] border-2 border-transparent hover:border-black/20 font-bold',
            navBadgeActive: 'bg-white text-black border border-black',
            navBadgeIdle: 'bg-[#e0f2fe] text-black border border-black',
            surfaceCard: 'bg-white text-black border-[3px] border-black shadow-[5px_5px_0px_#000]',
            subtleBox: 'bg-[#f8fafc] text-black border-2 border-black shadow-[2px_2px_0px_#000]',
            heroBanner: 'bg-[#fde047] text-black border-[3px] border-black shadow-[6px_6px_0px_#000]',
            sectionHeaderCard: 'bg-white text-black border-[3px] border-black shadow-[4px_4px_0px_#000]',
            input: 'bg-white text-black placeholder:text-slate-500 border-2 border-black focus:outline-none focus:ring-2 focus:ring-black/20',
            select: 'bg-white text-black border-2 border-black focus:outline-none focus:ring-2 focus:ring-black/20',
            primaryBtn: 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-y-0.5 font-black',
            secondaryBtn: 'bg-white hover:bg-[#f1f5f9] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black',
            dangerBtn: 'bg-[#fecaca] hover:bg-[#fca5a5] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black',
            successBtn: 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black',
            mutedText: 'text-slate-800',
            divider: 'border-black/15',
            pillPrimary: 'bg-[#e0f2fe] text-black border border-black',
            pillSuccess: 'bg-[#bef264] text-black border border-black',
            pillWarning: 'bg-[#fef08a] text-black border border-black',
            pillDanger: 'bg-[#fecaca] text-black border border-black',
            pillNeutral: 'bg-white text-black border border-black',
            kpiTile: (accent) => {
                const bgMap: Record<typeof accent, string> = {
                    neutral: 'bg-white',
                    indigo: 'bg-[#e0f2fe]',
                    emerald: 'bg-[#bef264]',
                    amber: 'bg-[#fef9c3]',
                    violet: 'bg-[#f3e8ff]'
                };
                return `${bgMap[accent]} text-black border-2 border-black shadow-[3px_3px_0px_#000]`;
            },
            themeSwitcherBox: 'bg-[#f8fafc] border-2 border-black',
            themeOptionActive: 'bg-[#fde047] text-black border-2 border-black shadow-[1px_1px_0px_#000] font-black',
            themeOptionIdle: 'text-black/70 hover:text-black font-bold border-2 border-transparent',
            mobileTopBar: 'bg-white text-black border-2 border-black shadow-[4px_4px_0px_#000]'
        };
    }

    if (isDark) {
        return {
            theme,
            isBento: false,
            isDark: true,
            pageShell: 'bg-[#090d16] text-white',
            sidebarShell: 'bg-[#111626]/95 text-white border border-white/10 shadow-2xl backdrop-blur-xl',
            sidebarHeaderBorder: 'border-b border-white/10',
            sidebarSwitcherBox: 'bg-white/[0.04] border border-white/10',
            sidebarSectionLabel: 'text-slate-400 font-extrabold',
            navItemActive: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/40 font-bold',
            navItemIdle: 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent font-semibold',
            navBadgeActive: 'bg-white/20 text-white',
            navBadgeIdle: 'bg-white/10 text-slate-300',
            surfaceCard: 'bg-[#131829]/95 text-white border border-white/10 shadow-2xl backdrop-blur-md',
            subtleBox: 'bg-white/[0.04] text-white border border-white/10',
            heroBanner: 'bg-gradient-to-br from-indigo-600/20 via-[#151b30] to-violet-600/15 text-white border border-indigo-400/25 shadow-2xl',
            sectionHeaderCard: 'bg-[#131829]/90 text-white border border-white/10 shadow-lg',
            input: 'bg-[#0b0f1b] text-white placeholder:text-slate-500 border border-white/15 focus:outline-none focus:border-indigo-400',
            select: 'bg-[#0b0f1b] text-white border border-white/15 focus:outline-none focus:border-indigo-400',
            primaryBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/20 font-bold',
            secondaryBtn: 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-100 border border-white/10 font-semibold',
            dangerBtn: 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold',
            successBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 font-bold',
            mutedText: 'text-slate-300',
            divider: 'border-white/10',
            pillPrimary: 'bg-indigo-500/15 text-indigo-300 border border-indigo-400/25',
            pillSuccess: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25',
            pillWarning: 'bg-amber-500/15 text-amber-300 border border-amber-400/25',
            pillDanger: 'bg-rose-500/15 text-rose-300 border border-rose-400/25',
            pillNeutral: 'bg-white/10 text-slate-300 border border-white/10',
            kpiTile: () => 'bg-[#0c1120]/80 text-white border border-white/10',
            themeSwitcherBox: 'bg-[#0b0f1b] border border-white/10',
            themeOptionActive: 'bg-indigo-600 text-white shadow-sm font-bold',
            themeOptionIdle: 'text-slate-400 hover:text-white font-semibold',
            mobileTopBar: 'bg-[#111626]/95 text-white border border-white/10 shadow-lg backdrop-blur-md'
        };
    }

    // Light Theme (Clean Crisp Studio)
    return {
        theme,
        isBento: false,
        isDark: false,
        pageShell: 'bg-slate-50 text-slate-900',
        sidebarShell: 'bg-white text-slate-900 border border-slate-200/90 shadow-xl shadow-slate-200/50',
        sidebarHeaderBorder: 'border-b border-slate-200/80',
        sidebarSwitcherBox: 'bg-slate-50 border border-slate-200',
        sidebarSectionLabel: 'text-slate-400 font-extrabold',
        navItemActive: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border border-indigo-600 font-bold',
        navItemIdle: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-semibold',
        navBadgeActive: 'bg-white/20 text-white',
        navBadgeIdle: 'bg-slate-200/80 text-slate-700',
        surfaceCard: 'bg-white text-slate-900 border border-slate-200/90 shadow-sm',
        subtleBox: 'bg-slate-50 text-slate-900 border border-slate-200/80',
        heroBanner: 'bg-gradient-to-br from-indigo-50 via-white to-violet-50 text-slate-900 border border-indigo-200/80 shadow-lg shadow-indigo-500/5',
        sectionHeaderCard: 'bg-white text-slate-900 border border-slate-200/90 shadow-sm',
        input: 'bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white',
        select: 'bg-slate-50 text-slate-900 border border-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white',
        primaryBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 font-bold',
        secondaryBtn: 'bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 font-semibold',
        dangerBtn: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold',
        successBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/15 font-bold',
        mutedText: 'text-slate-600',
        divider: 'border-slate-200/80',
        pillPrimary: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
        pillSuccess: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        pillWarning: 'bg-amber-50 text-amber-700 border border-amber-200',
        pillDanger: 'bg-rose-50 text-rose-700 border border-rose-200',
        pillNeutral: 'bg-slate-100 text-slate-700 border border-slate-200',
        kpiTile: () => 'bg-white/90 text-slate-900 border border-slate-200/80 shadow-xs',
        themeSwitcherBox: 'bg-slate-100 border border-slate-200',
        themeOptionActive: 'bg-white text-indigo-600 shadow-sm border border-slate-200 font-bold',
        themeOptionIdle: 'text-slate-500 hover:text-slate-900 font-semibold border border-transparent',
        mobileTopBar: 'bg-white text-slate-900 border border-slate-200/90 shadow-sm'
    };
}
