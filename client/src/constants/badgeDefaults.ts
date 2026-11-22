export const BADGE_CRITERIA_TYPES = [
    { value: 'total_attempts', label: 'Total Attempts' },
    { value: 'total_score', label: 'Total Score' },
    { value: 'streak', label: 'Login Streak' },
    { value: 'level', label: 'User Level' },
    { value: 'perfect_score', label: 'Perfect Score' },
    { value: 'speed_demon', label: 'Speed Demon' },
    { value: 'quiz_completion', label: 'Quiz Completion' },
    { value: 'exam_pass', label: 'Exam Pass' },
    { value: 'tournament_win', label: 'Tournament Win' },
    { value: 'track_completion', label: 'Track Completion' },
    { value: 'track_started', label: 'Roadmap Enrolled' },
    { value: 'track_modules', label: 'Modules Completed' },
    { value: 'clans', label: 'Class Member' },
    { value: 'clan_contribution', label: 'Class XP Contribution' },
    { value: 'challenges', label: 'Duels Played' },
    { value: 'challenge_wins', label: 'Duels Won' },
    { value: 'friend_count', label: 'Friend Count' },
    { value: 'manual', label: 'Manual (Admin Only)' }
] as const;

export const BADGE_RARITY_COLORS = {
    mythic: 'bg-rose-600 dark:bg-[#fb7185]',
    legendary: 'bg-amber-500 dark:bg-[#fde047]',
    epic: 'bg-orange-600 dark:bg-[#fb923c]',
    rare: 'bg-teal-600 dark:bg-[#5eead4]',
    common: 'bg-sky-600 dark:bg-[#bae6fd]',
    default: 'bg-sky-600 dark:bg-[#bae6fd]'
} as const;

