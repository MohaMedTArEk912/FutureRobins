import type { NavigateFunction } from 'react-router-dom';

/**
 * Safely returns to the previous in-app route without getting trapped when
 * `window.history.length > 1` holds an external or `about:blank` entry
 * (common in mobile device simulators, iframes, direct links, and PWAs).
 */
export function navigateBackSafely(
    navigate: NavigateFunction,
    fallbackPath = '/'
): void {
    if (typeof window === 'undefined') {
        navigate(fallbackPath);
        return;
    }

    const state = window.history.state as { idx?: unknown } | null;
    const historyIdx = typeof state?.idx === 'number' ? state.idx : 0;

    if (historyIdx > 0) {
        const beforeHref = window.location.href;
        navigate(-1);
        window.setTimeout(() => {
            if (window.location.href === beforeHref) {
                navigate(fallbackPath, { replace: true });
            }
        }, 140);
    } else {
        navigate(fallbackPath, { replace: true });
    }
}
