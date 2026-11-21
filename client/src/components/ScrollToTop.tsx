import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop resets scroll cleanly on route transitions (instant on pathname change
 * so smooth vertical scrolling never conflicts with horizontal spatial page swaps,
 * while keeping smooth scrolling for in-page #hash anchors).
 */
const ScrollToTop: React.FC = () => {
    const { pathname, hash } = useLocation();

    useEffect(() => {
        if (hash) {
            const elementId = hash.replace('#', '');
            const target = document.getElementById(elementId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
        }

        window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'instant' as ScrollBehavior
        });
    }, [pathname, hash]);

    return null;
};

export default ScrollToTop;
