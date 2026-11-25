import React, { useEffect, useState } from 'react';
import type { AvatarConfig } from '../../types';
import Avatar from '../Avatar';
import { RobinCharactersSvg, type RobinMascotVariant } from '../mascots/RobinCharactersSvg';
import { useOptionalAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
    getStoredAvatarConfig,
    getStoredMascotGender,
    type MascotGender,
} from '../../utils/authPreferenceCookies';
import { hasCustomizedAvatar, syncAvatarWithGender } from '../../utils/avatarGenderSync';

export interface BuddyAvatarProps {
    avatar?: Partial<AvatarConfig> | null;
    gender?: MascotGender;
    moodOverride?: 'happy' | 'excited' | 'cool' | 'neutral';
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    eyeOffset?: { x: number; y: number };
    isBlinking?: boolean;
    hideEyes?: boolean;
    peekEyes?: boolean;
    lookDown?: boolean;
    animated?: boolean;
    className?: string;
}

const WRAPPER_SIZE_CLASSES: Record<NonNullable<BuddyAvatarProps['size']>, string> = {
    xs: 'w-8 h-8',
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-48 h-48 sm:w-56 sm:h-56',
};

const INNER_AVATAR_SIZE: Record<NonNullable<BuddyAvatarProps['size']>, 'sm' | 'md' | 'lg' | 'xl' | '2xl'> = {
    xs: 'sm',
    sm: 'md',
    md: 'lg',
    lg: 'xl',
    xl: '2xl',
};

export const BuddyAvatar: React.FC<BuddyAvatarProps> = ({
    avatar,
    gender,
    moodOverride,
    size = 'md',
    eyeOffset,
    isBlinking,
    hideEyes = false,
    peekEyes = false,
    lookDown = false,
    animated = false,
    className = '',
}) => {
    const auth = useOptionalAuth();
    const { isBento } = useTheme();
    const [autoBlink, setAutoBlink] = useState(false);

    useEffect(() => {
        if (!animated || isBlinking !== undefined || hideEyes) return;
        let resetTimer: ReturnType<typeof setTimeout> | undefined;
        const interval = setInterval(() => {
            if (Math.random() > 0.22) {
                setAutoBlink(true);
                resetTimer = setTimeout(() => setAutoBlink(false), 150);
            }
        }, 3600);
        return () => {
            clearInterval(interval);
            if (resetTimer) clearTimeout(resetTimer);
        };
    }, [animated, isBlinking, hideEyes]);

    const resolvedBlinking = isBlinking ?? autoBlink;

    const storedAvatar = getStoredAvatarConfig();
    const candidateAvatar = avatar ?? auth?.currentUser?.avatar ?? storedAvatar;

    const effectiveGender: MascotGender =
        gender ??
        (candidateAvatar?.gender === 'female' || candidateAvatar?.gender === 'male'
            ? candidateAvatar.gender
            : undefined) ??
        auth?.currentUser?.avatar?.gender ??
        getStoredMascotGender();

    const useCustom = hasCustomizedAvatar(candidateAvatar);
    const resolvedConfig: AvatarConfig | null = useCustom
        ? {
              ...syncAvatarWithGender(candidateAvatar, effectiveGender),
              ...(moodOverride ? { mood: moodOverride } : {}),
          }
        : null;

    const variant: RobinMascotVariant = isBento
        ? effectiveGender === 'female'
            ? 'bento-girl'
            : 'lewis'
        : effectiveGender === 'female'
            ? 'franny'
            : 'wilbur';

    return (
        <div
            className={`relative inline-flex items-center justify-center shrink-0 select-none ${WRAPPER_SIZE_CLASSES[size]} ${
                animated ? 'transition-transform duration-300' : ''
            } ${className}`}
            style={
                animated
                    ? { animation: 'buddyFloatSoft 3.6s ease-in-out infinite' }
                    : undefined
            }
        >
            {resolvedConfig ? (
                <Avatar
                    config={resolvedConfig}
                    size={INNER_AVATAR_SIZE[size]}
                    eyeOffset={eyeOffset}
                    isBlinking={resolvedBlinking}
                    lookDown={lookDown}
                    hideEyes={hideEyes}
                    peekEyes={peekEyes}
                    animated={animated}
                    transparentBg={isBento}
                    className="!w-full !h-full"
                />
            ) : (
                <div className="w-full h-full">
                    <RobinCharactersSvg
                        variant={variant}
                        eyeOffset={eyeOffset ?? { x: 0, y: lookDown ? 2.5 : 0 }}
                        isBlinking={resolvedBlinking}
                        lookDown={lookDown}
                        hideEyes={hideEyes}
                        peekEyes={peekEyes}
                    />
                </div>
            )}

            <style>{`
                @keyframes buddyFloatSoft {
                    0%, 100% { transform: translate3d(0px, 0px, 0); }
                    50% { transform: translate3d(0px, -3px, 0); }
                }
            `}</style>
        </div>
    );
};

export default BuddyAvatar;
