/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTheme } from './ThemeContext';

export type SecretGameId = 'noir-snake' | 'bento-arcade';
export type SecretGamePhase = 'idle' | 'entering' | 'active' | 'exiting';

interface SecretGameContextValue {
    activeGame: SecretGameId | null;
    phase: SecretGamePhase;
    isChromeHidden: boolean;
    launchNoirSnake: () => void;
    launchBentoArcade: () => void;
    exitSecretGame: () => void;
}

const SecretGameContext = createContext<SecretGameContextValue>({
    activeGame: null,
    phase: 'idle',
    isChromeHidden: false,
    launchNoirSnake: () => {},
    launchBentoArcade: () => {},
    exitSecretGame: () => {}
});

export const useSecretGame = () => useContext(SecretGameContext);

const ARCADE_ENTER_MS = 820;
const ARCADE_EXIT_MS = 720;

export const SecretGameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { theme } = useTheme();
    const [activeGame, setActiveGame] = useState<SecretGameId | null>(null);
    const [phase, setPhase] = useState<SecretGamePhase>('idle');
    const savedScrollYRef = useRef<number>(0);
    const timerRef = useRef<number | null>(null);

    const clearPendingTimer = () => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const restoreBodyScroll = useCallback(() => {
        const body = document.body;
        const html = document.documentElement;
        html.style.overflow = '';
        body.style.overflow = '';
        body.style.overscrollBehavior = '';
        html.style.overscrollBehavior = '';
        body.style.touchAction = '';
        const y = savedScrollYRef.current;
        if (y > 0) {
            window.requestAnimationFrame(() => {
                window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
            });
        }
    }, []);

    const lockBodyScroll = useCallback(() => {
        savedScrollYRef.current = window.scrollY || window.pageYOffset || 0;
        const body = document.body;
        const html = document.documentElement;
        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';
        html.style.overscrollBehavior = 'none';
        body.style.touchAction = 'none';
    }, []);

    const launchGame = useCallback(
        (id: SecretGameId) => {
            if (phase === 'entering' || phase === 'active') return;
            clearPendingTimer();
            lockBodyScroll();
            setActiveGame(id);
            setPhase('entering');

            timerRef.current = window.setTimeout(() => {
                setPhase('active');
                timerRef.current = null;
            }, ARCADE_ENTER_MS);
        },
        [phase, lockBodyScroll]
    );

    const launchNoirSnake = useCallback(() => {
        // Strictly Dark Mode (Noir Studio) only
        if (theme !== 'dark') return;
        launchGame('noir-snake');
    }, [theme, launchGame]);

    const launchBentoArcade = useCallback(() => {
        // Strictly Neo-Brutalist Bento theme only
        if (theme !== 'bento') return;
        launchGame('bento-arcade');
    }, [theme, launchGame]);

    const exitSecretGame = useCallback(() => {
        if (phase === 'idle' || phase === 'exiting') return;
        clearPendingTimer();
        setPhase('exiting');

        timerRef.current = window.setTimeout(() => {
            setActiveGame(null);
            setPhase('idle');
            restoreBodyScroll();
            timerRef.current = null;
        }, ARCADE_EXIT_MS);
    }, [phase, restoreBodyScroll]);

    // Safety guard: immediately close the active secret game if the user switches to the other theme
    useEffect(() => {
        const mismatch =
            (activeGame === 'noir-snake' && theme !== 'dark') ||
            (activeGame === 'bento-arcade' && theme !== 'bento');
        if (mismatch) {
            clearPendingTimer();
            const rafId = window.requestAnimationFrame(() => {
                setActiveGame(null);
                setPhase('idle');
                restoreBodyScroll();
            });
            return () => window.cancelAnimationFrame(rafId);
        }
    }, [theme, activeGame, restoreBodyScroll]);

    useEffect(() => {
        return () => {
            clearPendingTimer();
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.overscrollBehavior = '';
            document.documentElement.style.overscrollBehavior = '';
            document.body.style.touchAction = '';
        };
    }, []);

    const isChromeHidden = phase === 'entering' || phase === 'active';

    return (
        <SecretGameContext.Provider
            value={{
                activeGame,
                phase,
                isChromeHidden,
                launchNoirSnake,
                launchBentoArcade,
                exitSecretGame
            }}
        >
            {children}
        </SecretGameContext.Provider>
    );
};
