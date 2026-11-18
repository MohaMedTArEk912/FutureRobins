import type { ClassroomPlayer } from '../../types';

export const OPTION_SHAPES = ['▲', '◆', '●', '■'] as const;
export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export function getOptionThemeClass(idx: number, isBento: boolean, selected: boolean, locked: boolean) {
    if (isBento) {
        if (selected) {
            return 'bg-[#bef264] text-black border-[3px] border-black shadow-[4px_4px_0_#000] ring-2 ring-black/20';
        }
        if (locked) {
            return 'bg-slate-100 text-slate-500 border-2 border-black/30 cursor-not-allowed';
        }
        const accents = [
            'bg-white hover:bg-[#fee2e2] text-black border-2 border-black shadow-[3px_3px_0_#000]',
            'bg-white hover:bg-[#dbeafe] text-black border-2 border-black shadow-[3px_3px_0_#000]',
            'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[3px_3px_0_#000]',
            'bg-white hover:bg-[#dcfce7] text-black border-2 border-black shadow-[3px_3px_0_#000]'
        ];
        return accents[idx % 4];
    }

    if (selected) {
        return 'bg-indigo-600 text-white border-2 border-lime-300 shadow-lg shadow-indigo-500/30 ring-2 ring-lime-300/60';
    }
    if (locked) {
        return 'bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10 cursor-not-allowed opacity-70';
    }
    return 'bg-white dark:bg-white/[0.06] hover:bg-indigo-50 dark:hover:bg-white/12 text-slate-900 dark:text-white border border-slate-200 dark:border-white/15 hover:border-indigo-400 shadow-sm';
}

export function getRoleTag(player: ClassroomPlayer): string {
    if (player.isBot) return 'BOT';
    if (player.role === 'teacher' || player.role === 'admin') return 'TEACHER';
    if (player.isHost) return 'HOST';
    return 'STUDENT';
}

export function formatRoomTimeLeft(
    expiresAt?: string | null,
    nowMs: number = Date.now()
): { text: string; isUrgent: boolean; expired: boolean } | null {
    if (!expiresAt) return null;
    const expiryMs = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiryMs)) return null;
    const diffMs = expiryMs - nowMs;
    if (diffMs <= 0) {
        return { text: '00:00', isUrgent: true, expired: true };
    }
    const totalSec = Math.ceil(diffMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return {
        text: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
        isUrgent: totalSec <= 120,
        expired: false
    };
}
