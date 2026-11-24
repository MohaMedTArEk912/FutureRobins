export const SITE_NAME = 'Future Robins';
export const SOCIAL_IMAGE_ALT = 'Future Robins — Practice computer science & keep moving forward';
export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;

export const PUBLIC_PAGES = {
    '/': {
        title: 'Computer Science Quizzes & Coding Practice | Future Robins',
        description: 'Practice computer science and programming on Future Robins with interactive quizzes, guided skill tracks, live arenas, and daily coding challenges.'
    },
    '/tracks': {
        title: 'Programming Skill Tracks | Future Robins',
        description: 'Explore guided learning paths for programming and computer science on Future Robins. Build your skills step by step with quizzes and interactive skill trees.'
    },
    '/leaderboard': {
        title: 'Global Quiz Leaderboard | Future Robins',
        description: 'See how Future Robins learners rank by quiz performance and track your place on the global leaderboard.'
    },
    '/tournaments': {
        title: 'Live Quiz Tournaments | Future Robins',
        description: 'Browse upcoming and live quiz tournaments on Future Robins, compete with other players, and earn rewards.'
    },
    '/live-arena': {
        title: 'Live Multiplayer Quiz Arena | Future Robins',
        description: 'Host a live quiz on Future Robins or join with a room PIN. Play turn-based duels or answer questions at the same time.'
    }
};

export type PublicPath = keyof typeof PUBLIC_PAGES;

export const PUBLIC_ALIASES: Readonly<Record<string, PublicPath>> = {
    '/dashboard': '/',
    '/quizzes': '/',
    '/classroom': '/live-arena'
};

export function getPublicPath(pathname: string): PublicPath | undefined {
    const path = pathname.replace(/\/+$/, '').toLowerCase() || '/';
    if (Object.prototype.hasOwnProperty.call(PUBLIC_ALIASES, path)) return PUBLIC_ALIASES[path];
    if (Object.prototype.hasOwnProperty.call(PUBLIC_PAGES, path)) return path as PublicPath;
}
