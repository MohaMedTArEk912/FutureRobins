import React from 'react';

export interface BrandIconProps {
    className?: string;
}

/** Crisp multi-tone lightning bolt (replaces ⚡) */
export const BoltSvg: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path
            d="M13.6 2.2 4.9 13.1c-.45.56-.05 1.4.67 1.4h5.13l-1.3 7.3c-.14.77.82 1.24 1.32.64l8.38-10.94c.44-.57.03-1.4-.68-1.4h-4.96l1.46-7.27c.15-.76-.81-1.24-1.32-.63Z"
            fill="#F97316"
            stroke="#0F172A"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <path
            d="M12.95 4.4 6.75 12.6h4.7l-.9 5.5 5.95-7.8h-4.4l.85-5.9Z"
            fill="#FACC15"
        />
    </svg>
);

/** Crisp layered flame (replaces 🔥) */
export const FlameSvg: React.FC<BrandIconProps> = ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path
            d="M12.7 2.2c.6 3.1-1.1 5.1-2.5 6.6-.9.95-1.5 1.9-1.5 3.1 0 .6.2 1.15.55 1.6-.8-.6-1.45-1.6-1.45-2.95 0-.8.2-1.55.5-2.25C6.1 10.1 4.8 12.5 4.8 15c0 4 3.2 7 7.2 7s7.2-3 7.2-7.1c0-3.3-1.95-6.25-4.35-8.9-.8-.88-1.55-2.1-2.15-3.8Z"
            fill="#F97316"
            stroke="#0F172A"
            strokeWidth="1.4"
            strokeLinejoin="round"
        />
        <path
            d="M12.1 10.6c1.9 1.6 3.5 3.4 3.5 5.6 0 2.2-1.6 3.9-3.6 3.9s-3.6-1.7-3.6-3.9c0-1.5.75-2.6 1.75-3.65.45 1 1.25 1.45 1.95 1.45.55 0 .9-.35.95-.95.05-.7-.35-1.55-.95-2.45Z"
            fill="#FDE047"
        />
    </svg>
);

/** Crisp neo-retro gamepad controller (replaces 🎮) */
export const GamepadSvg: React.FC<BrandIconProps> = ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path
            d="M6.8 6.5h10.4c2.15 0 3.95 1.55 4.3 3.67l.72 4.33c.34 2.02-1.22 3.85-3.27 3.85-1.12 0-2.16-.56-2.78-1.49l-.85-1.28a1.4 1.4 0 0 0-1.16-.63H9.84c-.47 0-.9.23-1.16.63l-.85 1.28a3.34 3.34 0 0 1-2.78 1.49c-2.05 0-3.61-1.83-3.27-3.85l.72-4.33C2.85 8.05 4.65 6.5 6.8 6.5Z"
            fill="#38BDF8"
            stroke="#0F172A"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <path
            d="M7.75 9.6v3.6M5.95 11.4h3.6"
            stroke="#0F172A"
            strokeWidth="1.8"
            strokeLinecap="round"
        />
        <circle cx="15.8" cy="10.2" r="1.1" fill="#FDE047" stroke="#0F172A" strokeWidth="0.9" />
        <circle cx="17.8" cy="12" r="1.1" fill="#FB7185" stroke="#0F172A" strokeWidth="0.9" />
        <circle cx="15.8" cy="13.7" r="1.1" fill="#BEF264" stroke="#0F172A" strokeWidth="0.9" />
        <circle cx="13.8" cy="12" r="1.1" fill="#FFFFFF" stroke="#0F172A" strokeWidth="0.9" />
    </svg>
);

/** Crisp metallic gold coin (replaces 🪙) */
export const CoinSvg: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="9.2" fill="#FACC15" stroke="#0F172A" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="6.4" fill="#F59E0B" stroke="#FEF08A" strokeWidth="1.2" />
        <path d="M12 8.2v7.6M9.8 10.6c0-1 .95-1.6 2.2-1.6s2.2.6 2.2 1.5c0 1.8-4.4 1.1-4.4 3 0 .95.95 1.55 2.2 1.55s2.2-.6 2.2-1.55" stroke="#FEF9C3" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

/** Crisp championship trophy (replaces 🏆) */
export const TrophySvg: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path
            d="M6.5 4.5h11v4.7c0 3.1-2.46 5.6-5.5 5.6s-5.5-2.5-5.5-5.6V4.5Z"
            fill="#FACC15"
            stroke="#0F172A"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <path d="M6.5 6.5H4a1.5 1.5 0 0 0-1.5 1.5v.8a3.2 3.2 0 0 0 3.2 3.2h.8M17.5 6.5H20a1.5 1.5 0 0 1 1.5 1.5v.8a3.2 3.2 0 0 1-3.2 3.2h-.8" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 14.8v3.4M8.2 20.5h7.6l-.8-2.3H9l-.8 2.3Z" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
);

/** Crisp 4-point sparkles (replaces ✨) */
export const SparkleSvg: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path
            d="M11 3 12.9 8.6 18.5 10.5 12.9 12.4 11 18 9.1 12.4 3.5 10.5 9.1 8.6 11 3Z"
            fill="#FDE047"
            stroke="#0F172A"
            strokeWidth="1.4"
            strokeLinejoin="round"
        />
        <path
            d="M18.5 14 19.3 16.4 21.7 17.2 19.3 18 18.5 20.4 17.7 18 15.3 17.2 17.7 16.4 18.5 14Z"
            fill="#38BDF8"
            stroke="#0F172A"
            strokeWidth="1.1"
            strokeLinejoin="round"
        />
    </svg>
);

/** Crisp bullseye target (replaces 🎯) */
export const TargetSvg: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="9" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="5.6" fill="#FB7185" stroke="#0F172A" strokeWidth="1.2" />
        <circle cx="12" cy="12" r="2.3" fill="#FDE047" stroke="#0F172A" strokeWidth="1.1" />
    </svg>
);

/** Crisp glowing lightbulb (replaces 💡) */
export const BulbSvg: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path
            d="M12 3a6.5 6.5 0 0 0-4.1 11.55c.72.58 1.1 1.4 1.1 2.25v.2h6v-.2c0-.85.38-1.67 1.1-2.25A6.5 6.5 0 0 0 12 3Z"
            fill="#FDE047"
            stroke="#0F172A"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <path d="M9.4 19.3h5.2M10.4 21.3h3.2" stroke="#0F172A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

/** Crisp wrapped reward gift box (replaces 🎁) */
export const GiftSvg: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <rect x="4" y="10.5" width="16" height="10" rx="2" fill="#FB7185" stroke="#0F172A" strokeWidth="1.5" />
        <rect x="3" y="7" width="18" height="4" rx="1.2" fill="#FDE047" stroke="#0F172A" strokeWidth="1.5" />
        <path d="M12 7v13.5" stroke="#0F172A" strokeWidth="1.6" />
        <path d="M12 7C10.2 7 7.5 6.2 7.5 4.6c0-1.1.9-1.8 1.9-1.8 1.5 0 2.6 2.1 2.6 4.2Zm0 0c1.8 0 4.5-.8 4.5-2.4 0-1.1-.9-1.8-1.9-1.8-1.5 0-2.6 2.1-2.6 4.2Z" fill="#BEF264" stroke="#0F172A" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
);

/** Crisp time-freeze hourglass (replaces ⏳) */
export const HourglassSvg: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path d="M6.5 3.5h11M6.5 20.5h11" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />
        <path
            d="M8 3.5v3.2c0 2 1.8 3.7 4 5.3-2.2 1.6-4 3.3-4 5.3v3.2h8v-3.2c0-2-1.8-3.7-4-5.3 2.2-1.6 4-3.3 4-5.3V3.5H8Z"
            fill="#67E8F9"
            stroke="#0F172A"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
    </svg>
);

/** Crisp armored shield (replaces 🛡️) */
export const ShieldSvg: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path
            d="M12 2.8 4.8 5.8v5.5c0 4.7 3.1 8.4 7.2 9.9 4.1-1.5 7.2-5.2 7.2-9.9V5.8L12 2.8Z"
            fill="#38BDF8"
            stroke="#0F172A"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <path d="M12 5.4v13.1c2.8-1.2 4.8-3.9 4.8-7.2V7.2L12 5.4Z" fill="#BAE6FD" opacity="0.7" />
    </svg>
);

/** Crisp crossed duel swords (replaces ⚔️) */
export const SwordsSvg: React.FC<BrandIconProps> = ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path d="m4.5 4.5 10.8 10.8M19.5 4.5 8.7 15.3" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round" />
        <path d="m4.5 4.5 10.8 10.8M19.5 4.5 8.7 15.3" stroke="#F8FAFC" strokeWidth="1.2" strokeLinecap="round" />
        <path d="m14.2 18.2 4-4M5.8 14.2l4 4M16.8 16.8l2.7 2.7M7.2 16.8l-2.7 2.7" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

/** Crisp royal gold crown (replaces 👑) */
export const CrownSvg: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path
            d="M3.5 17.5 2.5 8l5 3.6L12 5.5l4.5 6.1 5-3.6-1 9.5H3.5Z"
            fill="#FACC15"
            stroke="#0F172A"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <rect x="4" y="17.5" width="16" height="2.4" rx="1" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.3" />
    </svg>
);

/** Crisp star (replaces 🌟 / ⭐) */
export const StarSvg: React.FC<BrandIconProps> = ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path
            d="m12 2.8 2.8 5.65 6.2.9-4.5 4.38 1.06 6.17L12 17l-5.56 2.9L7.5 13.73 3 9.35l6.2-.9L12 2.8Z"
            fill="#FDE047"
            stroke="#0F172A"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
    </svg>
);
