import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext.tsx';
import { useOptionalAuth } from '../context/AuthContext.tsx';
import { useOptionalLanguage } from '../context/LanguageContext.tsx';
import { getStoredMascotGender, getStoredAvatarConfig, type MascotGender } from '../utils/authPreferenceCookies';
import { hasCustomizedAvatar, syncAvatarWithGender } from '../utils/avatarGenderSync';
import { RobinCharactersSvg, type RobinMascotVariant } from './mascots/RobinCharactersSvg';
import { BuddyAvatar } from './buddy/BuddyAvatar';

export interface AnimatedCharacterProps {
    isEmailFocused: boolean;
    isPasswordFocused: boolean;
    showPassword?: boolean;
    gender?: MascotGender;
    compact?: boolean;
    className?: string;
}

export const AnimatedCharacter: React.FC<AnimatedCharacterProps> = ({
    isEmailFocused,
    isPasswordFocused,
    showPassword = false,
    gender,
    compact = false,
    className = ''
}) => {
    const { isBento } = useTheme();
    const auth = useOptionalAuth();
    const langCtx = useOptionalLanguage();
    const isArabic = langCtx?.isArabic ?? false;

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isBlinking, setIsBlinking] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const targetPosRef = useRef({ x: 0, y: 0 });
    const currentPosRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef<number>(0);

    const resolvedGender: MascotGender =
        gender ?? auth?.currentUser?.avatar?.gender ?? getStoredMascotGender();

    const candidateAvatar = auth?.currentUser?.avatar ?? getStoredAvatarConfig();
    const hasCustomAvatar = hasCustomizedAvatar(candidateAvatar);
    const syncedCustomAvatar = hasCustomAvatar
        ? syncAvatarWithGender(candidateAvatar, resolvedGender)
        : null;

    const variant: RobinMascotVariant = isBento
        ? resolvedGender === 'female'
            ? 'bento-girl'
            : 'lewis'
        : resolvedGender === 'female'
            ? 'franny'
            : 'wilbur';

    // Single smooth 60fps requestAnimationFrame loop converging toward cursor target
    const startRafLoop = useCallback(() => {
        if (rafRef.current) return;
        const tick = () => {
            const target = targetPosRef.current;
            const current = currentPosRef.current;
            const lerp = 0.12;
            const nextX = current.x + (target.x - current.x) * lerp;
            const nextY = current.y + (target.y - current.y) * lerp;

            if (Math.abs(target.x - nextX) < 0.01 && Math.abs(target.y - nextY) < 0.01) {
                currentPosRef.current = { ...target };
                setMousePos(currentPosRef.current);
                rafRef.current = 0;
                return;
            }

            currentPosRef.current = { x: nextX, y: nextY };
            setMousePos(currentPosRef.current);
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current || isPasswordFocused) return;
            const rect = containerRef.current.getBoundingClientRect();

            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxRadius = 5.2;

            let px = 0;
            let py = 0;
            if (distance > 0) {
                const normalizedDist = Math.min(distance / 240, 1);
                const easedDist = 1 - Math.pow(1 - normalizedDist, 3);
                px = (dx / distance) * easedDist * maxRadius;
                py = (dy / distance) * easedDist * maxRadius;
            }

            targetPosRef.current = { x: px, y: py };
            startRafLoop();
        };

        const handleMouseLeave = () => {
            targetPosRef.current = { x: 0, y: 0 };
            startRafLoop();
        };

        if (isPasswordFocused) {
            targetPosRef.current = { x: 0, y: 0 };
            startRafLoop();
        }

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        document.addEventListener('mouseleave', handleMouseLeave);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = 0;
            }
        };
    }, [isPasswordFocused, startRafLoop]);

    // Natural blink interval with smooth curtain transition
    useEffect(() => {
        let resetTimer: ReturnType<typeof setTimeout> | undefined;
        const blinkInterval = setInterval(() => {
            if (!isPasswordFocused && Math.random() > 0.25) {
                setIsBlinking(true);
                resetTimer = setTimeout(() => setIsBlinking(false), 160);
            }
        }, 3800);
        return () => {
            clearInterval(blinkInterval);
            if (resetTimer) clearTimeout(resetTimer);
        };
    }, [isPasswordFocused]);

    // Derived character reaction flags
    const lookDown = isEmailFocused && !isPasswordFocused;
    const hideEyes = isPasswordFocused;
    const peekEyes = isPasswordFocused && showPassword;

    const statusCopy = isArabic
        ? peekEyes
            ? 'نظرة سريعة فقط!'
            : hideEyes
                ? 'لا تقلق، لا أنظر!'
                : lookDown
                    ? 'جاري مراجعة الإيميل...'
                    : 'واصل التقدّم!'
        : peekEyes
            ? 'Just one quick peek!'
            : hideEyes
                ? 'Eyes covered. Safe & sound!'
                : lookDown
                    ? 'Scanning coordinates...'
                    : 'Keep moving forward!';

    const characterLabel = syncedCustomAvatar
        ? (auth?.currentUser?.name?.split(' ')[0]?.toUpperCase() || (isArabic ? 'رفيقك' : 'YOUR BUDDY'))
        : variant === 'wilbur'
            ? 'WILBUR'
            : variant === 'lewis'
                ? 'LEWIS'
                : variant === 'franny'
                    ? 'FRANNY'
                    : 'INVENTOR ROBIN';

    return (
        <div
            ref={containerRef}
            className={`relative flex flex-col items-center justify-center w-full h-full ${
                compact ? 'p-0' : 'pt-2 pb-1'
            } ${className}`}
        >
            <div
                key={syncedCustomAvatar ? `custom-${resolvedGender}` : variant}
                className={`relative flex items-center justify-center animate-in fade-in zoom-in-95 duration-300 ${
                    compact ? 'w-full h-full' : 'w-[244px] h-[244px] sm:w-[272px] sm:h-[272px]'
                }`}
                style={{
                    animation: compact ? undefined : 'robinFloat 4.6s ease-in-out infinite'
                }}
            >
                {syncedCustomAvatar ? (
                    <BuddyAvatar
                        avatar={syncedCustomAvatar}
                        gender={resolvedGender}
                        moodOverride={peekEyes ? 'excited' : hideEyes ? 'cool' : lookDown ? 'neutral' : syncedCustomAvatar.mood}
                        eyeOffset={mousePos}
                        isBlinking={isBlinking}
                        hideEyes={hideEyes}
                        peekEyes={peekEyes}
                        lookDown={lookDown}
                        size={compact ? 'md' : 'xl'}
                        animated={!compact}
                        className={compact ? 'w-full h-full' : '!w-[216px] !h-[216px] sm:!w-[236px] sm:!h-[236px]'}
                    />
                ) : (
                    <RobinCharactersSvg
                        variant={variant}
                        eyeOffset={mousePos}
                        isBlinking={isBlinking}
                        lookDown={lookDown}
                        hideEyes={hideEyes}
                        peekEyes={peekEyes}
                    />
                )}
            </div>

            {!compact && (
                <div
                    className={`mt-1 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide transition-all duration-300 ${
                        isBento
                            ? 'bg-[#fde047] text-black border-[2.5px] border-black shadow-[3px_3px_0px_#000]'
                            : 'bg-[#0b1628]/90 text-[#67e8f9] border border-[#00e5ff]/35 shadow-lg shadow-black/40 backdrop-blur-md'
                    }`}
                >
                    <span
                        className={`w-2 h-2 rounded-full ${
                            isBento
                                ? 'bg-black'
                                : hideEyes
                                    ? 'bg-[#fde047]'
                                    : 'bg-[#00e5ff] animate-pulse'
                        }`}
                    />
                    <span className="uppercase opacity-75 text-[10px] tracking-widest">{characterLabel}</span>
                    <span className="opacity-40">•</span>
                    <span>{statusCopy}</span>
                </div>
            )}

            <style>{`
                @keyframes robinFloat {
                    0%, 100% { transform: translate3d(0px, 0px, 0); }
                    50% { transform: translate3d(0px, -4px, 0); }
                }
            `}</style>
        </div>
    );
};

export default AnimatedCharacter;
