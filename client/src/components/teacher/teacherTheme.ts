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
                    violet: 'bg-[#ffedd5]'
                };
                return `${bgMap[accent]} text-black border-2 border-black shadow-[3px_3px_0px_#000]`;
            },
            themeSwitcherBox: 'bg-[#f8fafc] border-2 border-black',
            themeOptionActive: 'bg-[#fde047] text-black border-2 border-black shadow-[1px_1px_0px_#000] font-black',
            themeOptionIdle: 'text-black/70 hover:text-black font-bold border-2 border-transparent',
            mobileTopBar: 'bg-white text-black border-2 border-black shadow-[4px_4px_0px_#000]'
        };
    }

    return {
        theme,
        isBento: false,
        isDark: true,
        pageShell: 'bg-[#0a0908] text-[#f5f3ec]',
        sidebarShell: 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2b2722] shadow-[0_5px_0_#050504]',
        sidebarHeaderBorder: 'border-b border-[#2b2722]',
        sidebarSwitcherBox: 'bg-[#1c1917] border border-[#2f2a24]',
        sidebarSectionLabel: 'text-[#a8a29e] font-extrabold',
        navItemActive: 'bg-[#bef264] text-[#0a0908] shadow-[0_3px_0_#050504] border border-[#bef264] font-black',
        navItemIdle: 'text-[#b5aea4] hover:text-[#f5f3ec] hover:bg-[#1c1917] border border-transparent font-semibold',
        navBadgeActive: 'bg-[#0a0908]/15 text-[#0a0908] font-black',
        navBadgeIdle: 'bg-[#1c1917] text-[#d6d0c7] border border-[#2f2a24]',
        surfaceCard: 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2b2722] shadow-[0_4px_0_#050504]',
        subtleBox: 'bg-[#1c1917] text-[#f5f3ec] border border-[#2f2a24]',
        heroBanner: 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2b2722] border-t-[3px] border-t-[#fde047] shadow-[0_5px_0_#050504]',
        sectionHeaderCard: 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2b2722] shadow-[0_4px_0_#050504]',
        input: 'bg-[#0e0d0b] text-[#f5f3ec] placeholder:text-[#78716c] border border-[#2f2a24] focus:outline-none focus:border-[#bef264]',
        select: 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2f2a24] focus:outline-none focus:border-[#bef264]',
        primaryBtn: 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504] border border-[#bef264] font-black',
        secondaryBtn: 'bg-[#1c1917] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2f2a24] font-semibold',
        dangerBtn: 'bg-[#2a1418] hover:bg-[#381920] text-[#fda4af] border border-[#fb7185]/45 font-bold',
        successBtn: 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504] font-black',
        mutedText: 'text-[#b5aea4]',
        divider: 'border-[#2b2722]',
        pillPrimary: 'bg-[#111c22] text-[#bae6fd] border border-[#bae6fd]/40',
        pillSuccess: 'bg-[#192211] text-[#bef264] border border-[#bef264]/40',
        pillWarning: 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/40',
        pillDanger: 'bg-[#2a1418] text-[#fda4af] border border-[#fb7185]/40',
        pillNeutral: 'bg-[#1c1917] text-[#d6d0c7] border border-[#2f2a24]',
        kpiTile: (accent) => {
            const accentMap: Record<typeof accent, string> = {
                neutral: 'bg-[#141210] border-[#2b2722]',
                indigo: 'bg-[#141210] border-[#2b2722] border-t-[3px] border-t-[#bae6fd]',
                emerald: 'bg-[#141210] border-[#2b2722] border-t-[3px] border-t-[#bef264]',
                amber: 'bg-[#141210] border-[#2b2722] border-t-[3px] border-t-[#fde047]',
                violet: 'bg-[#141210] border-[#2b2722] border-t-[3px] border-t-[#fdba74]'
            };
            return `${accentMap[accent]} text-[#f5f3ec] border-[1.5px] shadow-[0_4px_0_#050504]`;
        },
        themeSwitcherBox: 'bg-[#0e0d0b] border border-[#2b2722]',
        themeOptionActive: 'bg-[#bef264] text-[#0a0908] font-black',
        themeOptionIdle: 'text-[#a8a29e] hover:text-[#f5f3ec] font-semibold',
        mobileTopBar: 'bg-[#11100e] text-[#f5f3ec] border-[1.5px] border-[#2b2722] shadow-[0_4px_0_#050504]'
    };
}
