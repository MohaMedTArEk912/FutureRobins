// Lightweight deduplicated lazy-chunk prefetcher so spatial page transitions
// animate instantly on frame 0 without waiting on a Suspense spinner.

const prefetched = new Set<string>();

const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
    '/': () => import('../pages/DashboardPage'),
    '/dashboard': () => import('../pages/DashboardPage'),
    '/quizzes': () => import('../pages/DashboardPage'),
    '/tracks': () => import('../pages/SkillTracksPage'),
    '/tournaments': () => import('../pages/TournamentsPage'),
    '/leaderboard': () => import('../pages/LeaderboardPage'),
    '/daily': () => import('../pages/DailyChallengePage'),
    '/live-arena': () => import('../pages/ClassroomPage'),
    '/classroom': () => import('../pages/ClassroomPage'),
    '/clans': () => import('../pages/ClassPage'),
    '/classes': () => import('../pages/ClassPage'),
    '/shop': () => import('../pages/ShopPage'),
    '/social': () => import('../pages/SocialPage'),
    '/analytics': () => import('../pages/AnalyticsPage'),
    '/profile': () => import('../pages/ProfilePage'),
};

export function prefetchRoute(path: string): void {
    const normalized = path.split('?')[0].replace(/\/+$/, '') || '/';
    const loader = ROUTE_LOADERS[normalized];
    if (!loader || prefetched.has(normalized)) return;
    prefetched.add(normalized);
    loader().catch(() => {
        prefetched.delete(normalized);
    });
}

export function prefetchPrimaryRoutes(paths: string[]): void {
    const run = () => {
        for (const p of paths) {
            prefetchRoute(p);
        }
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (typeof ric === 'function') {
        ric(run, { timeout: 2500 });
    } else {
        window.setTimeout(run, 1400);
    }
}
