import type { AvatarConfig } from '../types';
import { DEFAULT_AVATAR_CONFIG } from '../constants/avatarDefaults';
import type { MascotGender } from './authPreferenceCookies';

const MALE_ONLY_HAIR = new Set(['fade', 'quiff', 'spiky', 'afro']);
const FEMALE_ONLY_HAIR = new Set(['long', 'ponytail', 'bob', 'wavy', 'bun', 'braids', 'pixie']);

/**
 * Detects whether the user has a saved custom avatar beyond bare gender-only defaults.
 */
export function hasCustomizedAvatar(avatar?: Partial<AvatarConfig> | null): boolean {
    if (!avatar || typeof avatar !== 'object') return false;

    const keys = Object.keys(avatar).filter((k) => {
        const val = avatar[k as keyof AvatarConfig];
        return val !== undefined && val !== null && val !== '';
    });

    if (keys.length === 0) return false;
    // Bare `{ gender: 'male' | 'female' }` without other customization is not custom
    if (keys.length === 1 && keys[0] === 'gender') return false;

    const comparableKeys: Array<keyof Omit<AvatarConfig, 'gender'>> = [
        'skinColor',
        'hairStyle',
        'hairColor',
        'accessory',
        'backgroundColor',
        'mood',
        'clothing',
        'outfitColor',
        'bottoms',
        'bottomsColor',
        'shoes',
        'shoesColor',
        'frame',
    ];

    const hasDifference = comparableKeys.some((key) => {
        const val = avatar[key];
        return val !== undefined && val !== DEFAULT_AVATAR_CONFIG[key];
    });

    if (hasDifference) return true;
    return keys.length >= 3;
}

/**
 * Synchronizes an AvatarConfig when gender changes, preserving compatible traits
 * while adapting gender-locked hair styles, clothing, and bottoms.
 */
export function syncAvatarWithGender(
    avatar: Partial<AvatarConfig> | undefined | null,
    nextGender: MascotGender
): AvatarConfig {
    const base: AvatarConfig = {
        ...DEFAULT_AVATAR_CONFIG,
        ...(avatar || {}),
        gender: nextGender,
        clothing: (avatar?.clothing || DEFAULT_AVATAR_CONFIG.clothing) as AvatarConfig['clothing'],
        outfitColor: avatar?.outfitColor || DEFAULT_AVATAR_CONFIG.outfitColor,
        bottoms: (avatar?.bottoms || DEFAULT_AVATAR_CONFIG.bottoms) as AvatarConfig['bottoms'],
        bottomsColor: avatar?.bottomsColor || DEFAULT_AVATAR_CONFIG.bottomsColor,
        shoes: (avatar?.shoes || DEFAULT_AVATAR_CONFIG.shoes) as AvatarConfig['shoes'],
        shoesColor: avatar?.shoesColor || DEFAULT_AVATAR_CONFIG.shoesColor,
        frame: (avatar?.frame || DEFAULT_AVATAR_CONFIG.frame) as AvatarConfig['frame'],
        mood: (avatar?.mood || DEFAULT_AVATAR_CONFIG.mood) as AvatarConfig['mood'],
    };

    let clothing = base.clothing;
    if (nextGender === 'male' && clothing === 'dress') {
        clothing = 'shirt';
    }

    let bottoms = base.bottoms;
    if (nextGender === 'male' && bottoms === 'skirt') {
        bottoms = 'jeans';
    }

    let hairStyle = base.hairStyle || DEFAULT_AVATAR_CONFIG.hairStyle;
    if (nextGender === 'male' && FEMALE_ONLY_HAIR.has(hairStyle)) {
        hairStyle = 'short';
    } else if (nextGender === 'female' && MALE_ONLY_HAIR.has(hairStyle)) {
        hairStyle = 'wavy';
    }

    return {
        ...base,
        gender: nextGender,
        clothing,
        bottoms,
        hairStyle,
    };
}
