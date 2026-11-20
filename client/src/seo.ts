export const SITE_NAME = 'Quiz Platform';
export const SOCIAL_IMAGE_ALT = 'Quiz Platform — Practice computer science';
export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;

export const PUBLIC_PAGES = {
    '/': {
        title: 'Computer Science Quizzes & Coding Practice | Quiz Platform',
        description: 'Practice computer science and programming with interactive quizzes, guided skill tracks, study flashcards, and daily coding challenges.'
    },
    '/tracks': {
        title: 'Programming Skill Tracks | Quiz Platform',
        description: 'Explore guided learning paths for programming and computer science. Build your skills step by step with quizzes and interactive skill trees.'
    },
    '/study': {
        title: 'Computer Science Flashcards | Quiz Platform',
        description: 'Review programming syntax and computer science concepts with flashcards and short study notes.'
    },
    '/leaderboard': {
        title: 'Global Quiz Leaderboard | Quiz Platform',
        description: 'See how Quiz Platform players rank by quiz performance and track your place on the global leaderboard.'
    },
    '/tournaments': {
        title: 'Live Quiz Tournaments | Quiz Platform',
        description: 'Browse upcoming and live quiz tournaments, compete with other players, and earn rewards.'
    },
    '/live-arena': {
        title: 'Live Multiplayer Quiz Arena | Quiz Platform',
        description: 'Host a live quiz or join with a room PIN. Play turn-based duels or answer questions at the same time.'
    }
};

export type PublicPath = keyof typeof PUBLIC_PAGES;

export const PUBLIC_ALIASES: Readonly<Record<string, PublicPath>> = {
    '/dashboard': '/',
    '/quizzes': '/',
    '/study-cards': '/study',
    '/classroom': '/live-arena'
};

export function getPublicPath(pathname: string): PublicPath | undefined {
    const path = pathname.replace(/\/+$/, '').toLowerCase() || '/';
    if (Object.prototype.hasOwnProperty.call(PUBLIC_ALIASES, path)) return PUBLIC_ALIASES[path];
    if (Object.prototype.hasOwnProperty.call(PUBLIC_PAGES, path)) return path as PublicPath;
}
