import React, { useEffect, useState } from 'react';
import type { AvatarConfig } from '../../types';
import Avatar from '../Avatar';
import { DEFAULT_AVATAR_CONFIG } from '../../constants/avatarDefaults';
import { getStoredAvatarConfig, getStoredMascotGender } from '../../utils/authPreferenceCookies';
import { syncAvatarWithGender } from '../../utils/avatarGenderSync';

export type BuddyAction =
    | 'idle'
    | 'walk'
    | 'patrol_hop'
    | 'zoom_dash'
    | 'wave'
    | 'dance'
    | 'backflip_spin'
    | 'orbit_float'
    | 'edge_peek'
    | 'nap_zzz'
    | 'comic_shake'
    | 'dragging'
    | 'sleep_bed'
    | 'play_football'
    | 'skateboard'
    | 'study_desk'
    | 'gaming_console'
    | 'guitar_rock'
    | 'jetpack_fly';

export interface FullBodyBuddyProps {
    avatar?: Partial<AvatarConfig> | null;
    moodOverride?: 'happy' | 'excited' | 'cool' | 'neutral';
    action: BuddyAction;
    facing?: 'left' | 'right';
    eyeOffset?: { x: number; y: number };
    className?: string;
}

const DEFAULT_TOP_COLORS: Record<string, string> = {
    shirt: '#3b82f6',
    hoodie: '#4f46e5',
    blazer: '#1e293b',
    dress: '#ec4899',
    tshirt: '#10b981',
    jacket: '#334155',
    sweater: '#f59e0b',
    tank: '#0ea5e9',
    jersey: '#ef4444',
    varsity: '#6366f1',
    kimono: '#be185d',
    astronaut: '#f8fafc',
};

function darkenHex(hex: string, amount = -28): string {
    const clean = (hex || '#3b82f6').replace('#', '');
    if (clean.length !== 6) return hex;
    const num = parseInt(clean, 16);
    const clamp = (v: number) => Math.max(0, Math.min(255, v));
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0xff) + amount);
    const b = clamp((num & 0xff) + amount);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const FullBodyBuddy: React.FC<FullBodyBuddyProps> = ({
    avatar,
    moodOverride,
    action,
    facing = 'right',
    eyeOffset,
    className = '',
}) => {
    const [isBlinking, setIsBlinking] = useState(false);

    const isSleeping = action === 'nap_zzz' || action === 'sleep_bed';

    useEffect(() => {
        if (isSleeping) return;
        let resetTimer: ReturnType<typeof setTimeout> | undefined;
        const interval = setInterval(() => {
            if (Math.random() > 0.22) {
                setIsBlinking(true);
                resetTimer = setTimeout(() => setIsBlinking(false), 150);
            }
        }, 3500);
        return () => {
            clearInterval(interval);
            if (resetTimer) clearTimeout(resetTimer);
        };
    }, [isSleeping]);

    const stored = getStoredAvatarConfig();
    const rawAvatar = avatar ?? stored ?? DEFAULT_AVATAR_CONFIG;
    const gender = rawAvatar.gender ?? getStoredMascotGender();
    const resolvedConfig: AvatarConfig = {
        ...syncAvatarWithGender(rawAvatar, gender),
        ...(moodOverride ? { mood: moodOverride } : {}),
    };

    const skinColor = resolvedConfig.skinColor || '#F5D0C5';
    const clothing: string = resolvedConfig.clothing || 'shirt';
    const topColor = resolvedConfig.outfitColor || DEFAULT_TOP_COLORS[clothing] || '#3b82f6';
    const topShade = darkenHex(topColor, -30);
    const bottoms: string = resolvedConfig.bottoms || 'jeans';
    const bottomsColor = resolvedConfig.bottomsColor || '#1e293b';
    const shoes: string = resolvedConfig.shoes || 'sneakers';
    const shoesColor = resolvedConfig.shoesColor || '#ef4444';
    const accessory = resolvedConfig.accessory || 'none';
    const sleeveColor = clothing === 'tank' ? skinColor : clothing === 'varsity' ? '#f8fafc' : topColor;
    const isFemale = resolvedConfig.gender === 'female';

    const isAirborne =
        action === 'backflip_spin' ||
        action === 'orbit_float' ||
        action === 'patrol_hop' ||
        action === 'dragging' ||
        action === 'jetpack_fly';

    const bodyWrapperAnim =
        action === 'walk'
            ? 'buddyWalkBounce 0.45s ease-in-out infinite'
            : action === 'patrol_hop'
            ? 'buddyHopBounce 0.55s ease-in-out infinite'
            : action === 'zoom_dash'
            ? 'buddyDashLean 0.28s ease-in-out infinite'
            : action === 'dance'
            ? 'buddyDanceBody 0.5s ease-in-out infinite'
            : action === 'backflip_spin'
            ? 'buddySomersault 0.9s ease-in-out infinite'
            : action === 'orbit_float' || action === 'jetpack_fly'
            ? 'buddyHoverFloat 1.6s ease-in-out infinite'
            : action === 'comic_shake'
            ? 'buddyComicShake 0.4s ease-in-out infinite'
            : action === 'nap_zzz'
            ? 'buddyNapBob 2.4s ease-in-out infinite'
            : action === 'dragging'
            ? 'buddyDragTilt 0.5s ease-in-out infinite'
            : action === 'skateboard'
            ? 'buddySkateCrouch 0.7s ease-in-out infinite'
            : action === 'play_football'
            ? 'buddySoccerBounce 0.55s ease-in-out infinite'
            : action === 'guitar_rock'
            ? 'buddyRockGroove 0.48s ease-in-out infinite'
            : 'buddyIdleBreath 3.2s ease-in-out infinite';

    const leftArmAnim =
        action === 'walk' || action === 'patrol_hop'
            ? 'buddySwingFwd 0.45s ease-in-out infinite'
            : action === 'zoom_dash'
            ? 'buddySwingFastFwd 0.24s ease-in-out infinite'
            : action === 'dance'
            ? 'buddyDanceArmL 0.5s ease-in-out infinite'
            : action === 'dragging'
            ? 'buddyFlailL 0.35s ease-in-out infinite'
            : action === 'orbit_float' || action === 'comic_shake' || action === 'jetpack_fly'
            ? 'buddyRaiseArmL 0.6s ease-in-out infinite'
            : action === 'study_desk'
            ? 'buddyTypeL 0.28s ease-in-out infinite'
            : action === 'gaming_console'
            ? 'buddyHoldPadL 0.35s ease-in-out infinite'
            : action === 'skateboard'
            ? 'buddyBalanceL 0.7s ease-in-out infinite'
            : undefined;

    const rightArmAnim =
        action === 'walk' || action === 'patrol_hop'
            ? 'buddySwingBwd 0.45s ease-in-out infinite'
            : action === 'zoom_dash'
            ? 'buddySwingFastBwd 0.24s ease-in-out infinite'
            : action === 'wave'
            ? 'buddyWaveHi 0.42s ease-in-out infinite'
            : action === 'dance'
            ? 'buddyDanceArmR 0.5s ease-in-out infinite'
            : action === 'dragging'
            ? 'buddyFlailR 0.35s ease-in-out infinite'
            : action === 'orbit_float' || action === 'comic_shake' || action === 'jetpack_fly'
            ? 'buddyRaiseArmR 0.6s ease-in-out infinite'
            : action === 'study_desk'
            ? 'buddyTypeR 0.28s ease-in-out infinite'
            : action === 'gaming_console'
            ? 'buddyHoldPadR 0.35s ease-in-out infinite'
            : action === 'guitar_rock'
            ? 'buddyStrumR 0.26s ease-in-out infinite'
            : action === 'skateboard'
            ? 'buddyBalanceR 0.7s ease-in-out infinite'
            : undefined;

    const leftLegAnim =
        action === 'walk' || action === 'patrol_hop'
            ? 'buddyLegBwd 0.45s ease-in-out infinite'
            : action === 'zoom_dash'
            ? 'buddyLegFastBwd 0.24s ease-in-out infinite'
            : action === 'dance'
            ? 'buddyDanceLegL 0.5s ease-in-out infinite'
            : action === 'dragging'
            ? 'buddyKickL 0.32s ease-in-out infinite'
            : undefined;

    const rightLegAnim =
        action === 'walk' || action === 'patrol_hop'
            ? 'buddyLegFwd 0.45s ease-in-out infinite'
            : action === 'zoom_dash'
            ? 'buddyLegFastFwd 0.24s ease-in-out infinite'
            : action === 'dance'
            ? 'buddyDanceLegR 0.5s ease-in-out infinite'
            : action === 'dragging'
            ? 'buddyKickR 0.32s ease-in-out infinite'
            : action === 'play_football'
            ? 'buddyKickBall 0.55s ease-in-out infinite'
            : undefined;

    const headLook = eyeOffset ?? (facing === 'left' ? { x: -2.2, y: 0 } : { x: 2.2, y: 0 });

    const renderShoe = (isRight: boolean) => {
        const x = isRight ? 61 : 38;
        if (shoes === 'boots') {
            return (
                <g>
                    <rect x={x + 2} y="73" width="17" height="10" rx="2" fill={shoesColor} stroke="#0f172a" strokeWidth="2" />
                    <path d={`M${x},81 H${x + 21} C${x + 24},81 ${x + 25},85 ${x + 24},89 H${x} C${x - 2},89 ${x - 2},83 ${x},81 Z`} fill={darkenHex(shoesColor, -22)} stroke="#0f172a" strokeWidth="2" />
                </g>
            );
        }
        if (shoes === 'high_tops') {
            return (
                <g>
                    <rect x={x + 2} y="74" width="16" height="9" rx="2" fill={shoesColor} stroke="#0f172a" strokeWidth="2" />
                    <path d={`M${x},81 H${x + 20} C${x + 24},81 ${x + 25},85 ${x + 24},88 H${x} C${x - 2},88 ${x - 2},83 ${x},81 Z`} fill={shoesColor} stroke="#0f172a" strokeWidth="2" />
                    <rect x={x} y="85" width="24" height="3.5" rx="1.5" fill="#ffffff" />
                </g>
            );
        }
        if (shoes === 'cleats') {
            return (
                <g>
                    <path d={`M${x},80 H${x + 20} C${x + 24},80 ${x + 25},84 ${x + 24},87 H${x} Z`} fill={shoesColor} stroke="#0f172a" strokeWidth="2" />
                    <circle cx={x + 4} cy="89" r="1.8" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
                    <circle cx={x + 12} cy="89" r="1.8" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
                    <circle cx={x + 20} cy="89" r="1.8" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
                </g>
            );
        }
        if (shoes === 'slides') {
            return (
                <g>
                    <rect x={x} y="83" width="23" height="5" rx="2.5" fill={shoesColor} stroke="#0f172a" strokeWidth="2" />
                    <rect x={x + 5} y="79" width="12" height="5" rx="2" fill={darkenHex(shoesColor, -25)} stroke="#0f172a" strokeWidth="1.6" />
                </g>
            );
        }
        if (shoes === 'loafers') {
            return (
                <g>
                    <path d={`M${x},81 H${x + 20} C${x + 24},81 ${x + 25},85 ${x + 24},88 H${x} C${x - 2},88 ${x - 2},83 ${x},81 Z`} fill={shoesColor} stroke="#0f172a" strokeWidth="2" />
                    <rect x={x + 7} y="81" width="8" height="2.5" rx="1" fill="#fde047" />
                </g>
            );
        }
        return (
            <g>
                <path
                    d={`M${x},80 H${x + 19} C${x + 23},80 ${x + 25},84 ${x + 24},88 H${x} C${x - 2},88 ${x - 2},82 ${x},80 Z`}
                    fill={shoesColor}
                    stroke="#0f172a"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                />
                <rect x={x} y="85" width="24" height="3.5" rx="1.5" fill="#ffffff" />
            </g>
        );
    };

    const renderLeg = (isRight: boolean) => {
        const x = isRight ? 64 : 41;
        const isSkirtOrDress = clothing === 'dress' || bottoms === 'skirt';
        const isShorts = bottoms === 'shorts';

        return (
            <g>
                {isSkirtOrDress || isShorts ? (
                    <>
                        <rect x={x} y="54" width="15" height="30" rx="7" fill={skinColor} stroke="#0f172a" strokeWidth="2.2" />
                        {isShorts && (
                            <rect x={x - 1} y="53" width="17" height="16" rx="4" fill={bottomsColor} stroke="#0f172a" strokeWidth="2.2" />
                        )}
                    </>
                ) : (
                    <>
                        <rect x={x} y="54" width="15" height="30" rx={bottoms === 'joggers' ? 8 : 5} fill={bottomsColor} stroke="#0f172a" strokeWidth="2.2" />
                        {bottoms === 'cargo' && (
                            <rect x={isRight ? x + 9 : x - 2} y="64" width="7" height="9" rx="2" fill={darkenHex(bottomsColor, 18)} stroke="#0f172a" strokeWidth="1.5" />
                        )}
                        {bottoms === 'joggers' && (
                            <rect x={x + 1} y="77" width="13" height="5" rx="2" fill={darkenHex(bottomsColor, -24)} />
                        )}
                    </>
                )}
                {renderShoe(isRight)}
            </g>
        );
    };

    // --- DEDICATED FULL-ASSET SCENE: COZY SLEEPING BED ---
    if (action === 'sleep_bed') {
        return (
            <div
                className={`relative w-[136px] h-[118px] select-none pointer-events-none ${className}`}
                style={{ filter: 'drop-shadow(0 8px 14px rgba(0, 0, 0, 0.35))' }}
            >
                <span className="absolute -top-2 right-4 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500 text-white animate-bounce shadow z-30">
                    Zzz 💤
                </span>
                <span className="absolute top-2 right-12 text-xs font-black text-indigo-300 animate-pulse z-30">
                    z
                </span>

                {/* Wooden Bed Frame & Fluffy Pillow */}
                <svg viewBox="0 0 160 110" className="absolute inset-0 w-full h-full overflow-visible">
                    {/* Ground shadow */}
                    <ellipse cx="80" cy="102" rx="68" ry="6" fill="rgba(0,0,0,0.32)" />
                    {/* Headboard & Footboard */}
                    <rect x="8" y="28" width="12" height="72" rx="4" fill="#92400e" stroke="#0f172a" strokeWidth="2.5" />
                    <rect x="140" y="52" width="10" height="48" rx="4" fill="#92400e" stroke="#0f172a" strokeWidth="2.5" />
                    {/* Mattress */}
                    <rect x="18" y="64" width="124" height="22" rx="6" fill="#f8fafc" stroke="#0f172a" strokeWidth="2.5" />
                    {/* Bed Base */}
                    <rect x="14" y="82" width="132" height="12" rx="3" fill="#b45309" stroke="#0f172a" strokeWidth="2.5" />
                    {/* Fluffy Pillow */}
                    <ellipse cx="38" cy="59" rx="18" ry="10" fill="#ffffff" stroke="#0f172a" strokeWidth="2.2" transform="rotate(-10 38 59)" />
                </svg>

                {/* Reclined Head on Pillow */}
                <div
                    className="absolute left-[14px] top-[14px] w-[60px] h-[58px] z-10"
                    style={{ transform: 'rotate(-58deg)', animation: 'buddyNapBob 2.6s ease-in-out infinite' }}
                >
                    <Avatar
                        config={resolvedConfig}
                        bareHead
                        isBlinking={true}
                        lookDown={true}
                        className="w-full h-full"
                    />
                </div>

                {/* Cozy Blanket Tucked Over Body */}
                <svg viewBox="0 0 160 110" className="absolute inset-0 w-full h-full overflow-visible z-20">
                    <path
                        d="M52,58 Q96,46 142,60 L142,84 L50,84 Q44,70 52,58 Z"
                        fill={topColor}
                        stroke="#0f172a"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                    />
                    <path d="M54,68 Q96,58 140,68" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.55" />
                    <path d="M54,77 Q96,68 140,77" fill="none" stroke="#fde047" strokeWidth="2.5" opacity="0.7" />
                    {/* Blanket cuff */}
                    <path d="M50,56 Q58,69 52,84" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
                </svg>

                <style>{`
                    @keyframes buddyNapBob {
                        0%, 100% { transform: rotate(-58deg) translateY(0px); }
                        50% { transform: rotate(-55deg) translateY(2px); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div
            className={`relative w-[92px] h-[132px] select-none pointer-events-none ${className}`}
            style={{ filter: 'drop-shadow(0 8px 14px rgba(0, 0, 0, 0.35))' }}
        >
            {/* Ground Contact Shadow */}
            <div
                className={`absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-black/35 blur-[2px] transition-all duration-300 ${
                    isAirborne ? 'w-9 h-2 opacity-30 scale-75' : 'w-14 h-2.5 opacity-60 scale-100'
                }`}
            />

            {/* Speed lines when zooming or skateboarding */}
            {(action === 'zoom_dash' || action === 'skateboard') && (
                <div
                    className={`absolute top-14 flex flex-col gap-2 opacity-85 ${
                        facing === 'right' ? '-left-6' : '-right-6'
                    }`}
                >
                    <span className="w-6 h-0.5 rounded-full bg-[#bef264] animate-pulse" />
                    <span className="w-8 h-0.5 rounded-full bg-[#38bdf8] animate-pulse" />
                    <span className="w-5 h-0.5 rounded-full bg-[#fde047] animate-pulse" />
                </div>
            )}

            {/* Sparkles & Musical Notes */}
            {(action === 'wave' || action === 'dance') && (
                <span className="absolute -top-1 right-1 text-sm animate-bounce">✨</span>
            )}
            {action === 'guitar_rock' && (
                <>
                    <span className="absolute -top-2 right-0 text-sm font-black text-[#fde047] animate-bounce">♫</span>
                    <span className="absolute top-3 -left-2 text-xs font-black text-[#38bdf8] animate-pulse">♪</span>
                </>
            )}
            {action === 'gaming_console' && (
                <span className="absolute -top-1 left-0 text-xs font-black text-[#bef264] animate-bounce">🎮✨</span>
            )}
            {action === 'nap_zzz' && (
                <span className="absolute -top-2 right-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500 text-white animate-pulse shadow">
                    Zzz
                </span>
            )}

            {/* Flippable Full-Body Rig */}
            <div
                className="relative w-full h-full flex flex-col items-center"
                style={{
                    transform: `${facing === 'left' ? 'scaleX(-1) ' : ''}${
                        action === 'edge_peek' ? 'rotate(18deg) translateX(-10px)' : ''
                    }`,
                    transition: 'transform 240ms ease-out',
                }}
            >
                <div
                    className="relative w-full h-full flex flex-col items-center"
                    style={{
                        animation: bodyWrapperAnim,
                        transformOrigin: '46px 74px',
                    }}
                >
                    {/* Jetpack Thruster Behind Body */}
                    {action === 'jetpack_fly' && (
                        <svg viewBox="0 0 120 110" className="absolute inset-0 w-full h-full overflow-visible z-0">
                            <rect x="20" y="42" width="16" height="32" rx="6" fill="#64748b" stroke="#0f172a" strokeWidth="2" />
                            <rect x="23" y="47" width="10" height="8" rx="2" fill="#38bdf8" />
                            {/* Flickering flame cone */}
                            <path
                                d="M22,74 L28,98 L34,74 Z"
                                fill="#f97316"
                                style={{ animation: 'buddyFlame 0.16s ease-in-out infinite', transformOrigin: '28px 74px' }}
                            />
                            <path
                                d="M24,74 L28,90 L32,74 Z"
                                fill="#fde047"
                                style={{ animation: 'buddyFlame 0.14s ease-in-out infinite', transformOrigin: '28px 74px' }}
                            />
                        </svg>
                    )}

                    {/* Backpack Behind Shoulders if equipped */}
                    {accessory === 'backpack' && (
                        <svg viewBox="0 0 120 110" className="absolute top-[42px] w-[86px] h-[76px] overflow-visible z-0">
                            <rect x="28" y="14" width="64" height="44" rx="12" fill="#dc2626" stroke="#0f172a" strokeWidth="2.2" />
                        </svg>
                    )}

                    {/* 1. Animated Bare Head */}
                    <div className="relative z-20 w-[74px] h-[72px] -mb-[14px]">
                        <Avatar
                            config={resolvedConfig}
                            bareHead
                            eyeOffset={headLook}
                            isBlinking={action === 'nap_zzz' ? true : isBlinking}
                            lookDown={action === 'nap_zzz' || action === 'study_desk' || action === 'gaming_console'}
                            animated={action === 'idle'}
                            className="w-full h-full"
                        />
                    </div>

                    {/* 2. Articulated Torso, Arms, Bottoms, Shoes & Scene Props */}
                    <svg
                        viewBox="0 0 120 112"
                        xmlns="http://www.w3.org/2000/svg"
                        className="relative z-10 w-[88px] h-[78px] overflow-visible"
                    >
                        {/* Neck */}
                        <rect x="52" y="0" width="16" height="14" rx="6" fill={skinColor} stroke="#0f172a" strokeWidth="2" />

                        {/* Left Leg & Shoe */}
                        <g
                            style={{
                                transformOrigin: '49px 56px',
                                animation: leftLegAnim,
                                transform: action === 'nap_zzz' ? 'rotate(-55deg) translateY(4px)' : undefined,
                            }}
                        >
                            {renderLeg(false)}
                        </g>

                        {/* Right Leg & Shoe */}
                        <g
                            style={{
                                transformOrigin: '71px 56px',
                                animation: rightLegAnim,
                                transform: action === 'nap_zzz' ? 'rotate(-50deg) translateY(4px)' : undefined,
                            }}
                        >
                            {renderLeg(true)}
                        </g>

                        {/* Left Arm */}
                        <g
                            style={{
                                transformOrigin: '38px 18px',
                                animation: leftArmAnim,
                                transform:
                                    action === 'nap_zzz'
                                        ? 'rotate(-16deg)'
                                        : action === 'guitar_rock'
                                        ? 'rotate(-42deg)'
                                        : undefined,
                            }}
                        >
                            <rect x="25" y="14" width="13" height="30" rx="6.5" fill={sleeveColor} stroke="#0f172a" strokeWidth="2.2" />
                            <circle cx="31.5" cy="46" r="6" fill={skinColor} stroke="#0f172a" strokeWidth="2" />
                        </g>

                        {/* Torso / Outfit */}
                        <g stroke="#0f172a" strokeWidth="2.2" strokeLinejoin="round">
                            {clothing === 'dress' || bottoms === 'skirt' ? (
                                <path
                                    d="M40,44 Q60,40 80,44 L89,66 Q60,72 31,66 Z"
                                    fill={clothing === 'dress' ? topColor : bottomsColor}
                                />
                            ) : null}

                            {clothing === 'dress' ? (
                                <path d="M40,12 Q60,8 80,12 L84,50 L36,50 Z" fill={topColor} />
                            ) : (
                                <rect
                                    x={isFemale ? '41' : '38'}
                                    y="11"
                                    width={isFemale ? '38' : '44'}
                                    height="48"
                                    rx="13"
                                    fill={topColor}
                                />
                            )}

                            {/* Outfit Details */}
                            {clothing === 'shirt' && (
                                <>
                                    <path d="M51,11 L60,21 L69,11" fill="#ffffff" />
                                    <circle cx="60" cy="30" r="1.8" fill="#ffffff" stroke="none" />
                                    <circle cx="60" cy="40" r="1.8" fill="#ffffff" stroke="none" />
                                </>
                            )}
                            {clothing === 'hoodie' && (
                                <>
                                    <path d="M48,12 Q60,22 72,12" fill="none" stroke="#ffffff" strokeWidth="2.5" />
                                    <rect x="47" y="40" width="26" height="14" rx="5" fill={topShade} />
                                </>
                            )}
                            {clothing === 'blazer' && (
                                <>
                                    <path d="M51,11 L60,30 L69,11 Z" fill="#ffffff" />
                                    <path d="M58,15 L62,15 L61,28 L59,28 Z" fill="#ef4444" stroke="none" />
                                </>
                            )}
                            {clothing === 'jersey' && (
                                <>
                                    <path d="M49,11 Q60,20 71,11" fill="none" stroke="#fde047" strokeWidth="2.6" />
                                    <rect x="44" y="26" width="32" height="5" fill="#ffffff" stroke="none" opacity="0.85" />
                                    <text x="60" y="44" textAnchor="middle" fontSize="13" fontWeight="900" fill="#ffffff" stroke="none">
                                        10
                                    </text>
                                </>
                            )}
                            {clothing === 'varsity' && (
                                <>
                                    <line x1="60" y1="13" x2="60" y2="57" stroke="#ffffff" strokeWidth="2.2" />
                                    <rect x="40" y="53" width="40" height="5" rx="2" fill="#f8fafc" />
                                </>
                            )}
                            {clothing === 'kimono' && (
                                <>
                                    <path d="M45,12 L64,40 M75,12 L56,40" stroke="#fde047" strokeWidth="2.5" />
                                    <rect x="39" y="38" width="42" height="8" rx="2" fill="#f59e0b" />
                                </>
                            )}
                            {clothing === 'astronaut' && (
                                <>
                                    <rect x="47" y="24" width="26" height="16" rx="4" fill="#cbd5e1" />
                                    <circle cx="54" cy="32" r="3" fill="#ef4444" stroke="none" />
                                    <rect x="60" y="29" width="9" height="6" rx="1.5" fill="#38bdf8" stroke="none" />
                                </>
                            )}
                            {(clothing === 'tshirt' || clothing === 'sweater' || clothing === 'jacket') && (
                                <path d="M50,11 Q60,19 70,11" fill="none" stroke="#ffffff" strokeWidth="2.2" opacity="0.8" />
                            )}

                            {/* Scarf / Backpack Straps */}
                            {accessory === 'scarf' && (
                                <>
                                    <rect x="45" y="7" width="30" height="10" rx="5" fill="#ef4444" />
                                    <path d="M62,14 L70,38 L61,40 L56,16 Z" fill="#dc2626" />
                                </>
                            )}
                            {accessory === 'backpack' && (
                                <>
                                    <line x1="45" y1="12" x2="43" y2="48" stroke="#991b1b" strokeWidth="4" strokeLinecap="round" />
                                    <line x1="75" y1="12" x2="77" y2="48" stroke="#991b1b" strokeWidth="4" strokeLinecap="round" />
                                </>
                            )}
                        </g>

                        {/* SCENE ASSET: Electric Guitar */}
                        {action === 'guitar_rock' && (
                            <g transform="translate(8, 12) rotate(-24 60 40)">
                                <path d="M36,36 C28,28 24,42 30,52 C38,60 54,54 52,42 C50,34 42,30 36,36 Z" fill="#ef4444" stroke="#0f172a" strokeWidth="2.2" />
                                <rect x="48" y="34" width="38" height="6" rx="2" fill="#78350f" stroke="#0f172a" strokeWidth="1.8" />
                                <rect x="84" y="31" width="10" height="11" rx="2" fill="#0f172a" />
                                <circle cx="40" cy="44" r="4" fill="#ffffff" />
                            </g>
                        )}

                        {/* Right Arm */}
                        <g
                            style={{
                                transformOrigin: '82px 18px',
                                animation: rightArmAnim,
                                transform: action === 'nap_zzz' ? 'rotate(16deg)' : undefined,
                            }}
                        >
                            <rect x="82" y="14" width="13" height="30" rx="6.5" fill={sleeveColor} stroke="#0f172a" strokeWidth="2.2" />
                            <circle cx="88.5" cy="46" r="6" fill={skinColor} stroke="#0f172a" strokeWidth="2" />
                        </g>

                        {/* SCENE ASSET: Gaming Controller */}
                        {action === 'gaming_console' && (
                            <g style={{ animation: 'buddyPadShake 0.25s ease-in-out infinite', transformOrigin: '60px 44px' }}>
                                <rect x="41" y="36" width="38" height="18" rx="9" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
                                <circle cx="50" cy="45" r="3" fill="#38bdf8" />
                                <circle cx="70" cy="43" r="2" fill="#ef4444" />
                                <circle cx="74" cy="46" r="2" fill="#bef264" />
                            </g>
                        )}

                        {/* SCENE ASSET: Study Desk + Glowing Laptop + Coffee */}
                        {action === 'study_desk' && (
                            <g transform="translate(0, 12)">
                                <rect x="14" y="46" width="92" height="8" rx="3" fill="#b45309" stroke="#0f172a" strokeWidth="2" />
                                {/* Laptop */}
                                <polygon points="34,46 42,24 78,24 84,46" fill="#334155" stroke="#0f172a" strokeWidth="2" />
                                <polygon points="44,27 76,27 80,43 39,43" fill="#38bdf8" />
                                {/* Coffee mug */}
                                <rect x="88" y="34" width="11" height="12" rx="2" fill="#fde047" stroke="#0f172a" strokeWidth="1.8" />
                            </g>
                        )}

                        {/* SCENE ASSET: Bouncing Football / Soccer Ball */}
                        {action === 'play_football' && (
                            <g
                                style={{
                                    animation: 'buddyBallBounce 0.55s ease-in-out infinite',
                                    transformOrigin: '98px 80px',
                                }}
                            >
                                <circle cx="98" cy="78" r="12" fill="#ffffff" stroke="#0f172a" strokeWidth="2.2" />
                                <polygon points="98,72 103,76 101,82 95,82 93,76" fill="#0f172a" />
                                <line x1="98" y1="72" x2="98" y2="66" stroke="#0f172a" strokeWidth="1.5" />
                                <line x1="103" y1="76" x2="109" y2="74" stroke="#0f172a" strokeWidth="1.5" />
                                <line x1="93" y1="76" x2="87" y2="74" stroke="#0f172a" strokeWidth="1.5" />
                            </g>
                        )}

                        {/* SCENE ASSET: Skateboard Under Sneakers */}
                        {action === 'skateboard' && (
                            <g transform="translate(0, 6)">
                                <path d="M16,84 Q60,88 104,84 L108,80 Q112,83 106,89 Q60,93 14,89 Q8,83 12,80 Z" fill="#f97316" stroke="#0f172a" strokeWidth="2" />
                                <g style={{ animation: 'buddyWheelSpin 0.4s linear infinite', transformOrigin: '32px 94px' }}>
                                    <circle cx="32" cy="94" r="5" fill="#bef264" stroke="#0f172a" strokeWidth="2" />
                                </g>
                                <g style={{ animation: 'buddyWheelSpin 0.4s linear infinite', transformOrigin: '88px 94px' }}>
                                    <circle cx="88" cy="94" r="5" fill="#bef264" stroke="#0f172a" strokeWidth="2" />
                                </g>
                            </g>
                        )}
                    </svg>
                </div>
            </div>

            <style>{`
                @keyframes buddyIdleBreath {
                    0%, 100% { transform: translateY(0) scaleY(1); }
                    50% { transform: translateY(-2px) scaleY(1.015); }
                }
                @keyframes buddyWalkBounce {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-5px) rotate(1.5deg); }
                }
                @keyframes buddyHopBounce {
                    0%, 100% { transform: translateY(0) scaleY(0.97); }
                    45% { transform: translateY(-16px) scaleY(1.04); }
                }
                @keyframes buddyDashLean {
                    0%, 100% { transform: translateY(0) rotate(12deg) skewX(-6deg); }
                    50% { transform: translateY(-4px) rotate(15deg) skewX(-8deg); }
                }
                @keyframes buddyDanceBody {
                    0%, 100% { transform: translateY(0) rotate(-5deg); }
                    50% { transform: translateY(-7px) rotate(5deg); }
                }
                @keyframes buddySomersault {
                    0% { transform: translateY(0) rotate(0deg); }
                    45% { transform: translateY(-28px) rotate(180deg) scale(1.06); }
                    100% { transform: translateY(0) rotate(360deg); }
                }
                @keyframes buddyHoverFloat {
                    0%, 100% { transform: translate(0, -4px) rotate(-4deg); }
                    50% { transform: translate(6px, -16px) rotate(5deg); }
                }
                @keyframes buddyComicShake {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(-10deg) scale(1.04); }
                    75% { transform: rotate(10deg) scale(1.04); }
                }
                @keyframes buddyNapBob {
                    0%, 100% { transform: translateY(10px) rotate(-2deg); }
                    50% { transform: translateY(12px) rotate(2deg); }
                }
                @keyframes buddyDragTilt {
                    0%, 100% { transform: rotate(-7deg); }
                    50% { transform: rotate(7deg); }
                }
                @keyframes buddySkateCrouch {
                    0%, 100% { transform: translateY(-3px) rotate(-3deg); }
                    50% { transform: translateY(-6px) rotate(3deg); }
                }
                @keyframes buddySoccerBounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                @keyframes buddyRockGroove {
                    0%, 100% { transform: rotate(-4deg) translateY(0); }
                    50% { transform: rotate(4deg) translateY(-4px); }
                }
                @keyframes buddySwingFwd {
                    0%, 100% { transform: rotate(-28deg); }
                    50% { transform: rotate(28deg); }
                }
                @keyframes buddySwingBwd {
                    0%, 100% { transform: rotate(28deg); }
                    50% { transform: rotate(-28deg); }
                }
                @keyframes buddySwingFastFwd {
                    0%, 100% { transform: rotate(-48deg); }
                    50% { transform: rotate(45deg); }
                }
                @keyframes buddySwingFastBwd {
                    0%, 100% { transform: rotate(45deg); }
                    50% { transform: rotate(-48deg); }
                }
                @keyframes buddyLegFwd {
                    0%, 100% { transform: rotate(26deg); }
                    50% { transform: rotate(-26deg); }
                }
                @keyframes buddyLegBwd {
                    0%, 100% { transform: rotate(-26deg); }
                    50% { transform: rotate(26deg); }
                }
                @keyframes buddyLegFastFwd {
                    0%, 100% { transform: rotate(42deg); }
                    50% { transform: rotate(-38deg); }
                }
                @keyframes buddyLegFastBwd {
                    0%, 100% { transform: rotate(-38deg); }
                    50% { transform: rotate(42deg); }
                }
                @keyframes buddyWaveHi {
                    0%, 100% { transform: rotate(-135deg); }
                    50% { transform: rotate(-165deg); }
                }
                @keyframes buddyDanceArmL {
                    0%, 100% { transform: rotate(130deg); }
                    50% { transform: rotate(65deg); }
                }
                @keyframes buddyDanceArmR {
                    0%, 100% { transform: rotate(-65deg); }
                    50% { transform: rotate(-130deg); }
                }
                @keyframes buddyDanceLegL {
                    0%, 100% { transform: rotate(12deg); }
                    50% { transform: rotate(-14deg); }
                }
                @keyframes buddyDanceLegR {
                    0%, 100% { transform: rotate(-14deg); }
                    50% { transform: rotate(12deg); }
                }
                @keyframes buddyFlailL {
                    0%, 100% { transform: rotate(110deg); }
                    50% { transform: rotate(150deg); }
                }
                @keyframes buddyFlailR {
                    0%, 100% { transform: rotate(-150deg); }
                    50% { transform: rotate(-110deg); }
                }
                @keyframes buddyRaiseArmL {
                    0%, 100% { transform: rotate(95deg); }
                    50% { transform: rotate(125deg); }
                }
                @keyframes buddyRaiseArmR {
                    0%, 100% { transform: rotate(-125deg); }
                    50% { transform: rotate(-95deg); }
                }
                @keyframes buddyKickL {
                    0%, 100% { transform: rotate(-24deg); }
                    50% { transform: rotate(24deg); }
                }
                @keyframes buddyKickR {
                    0%, 100% { transform: rotate(24deg); }
                    50% { transform: rotate(-24deg); }
                }
                @keyframes buddyKickBall {
                    0%, 100% { transform: rotate(0deg); }
                    45% { transform: rotate(-42deg); }
                }
                @keyframes buddyBallBounce {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    50% { transform: translate(8px, -34px) rotate(180deg); }
                }
                @keyframes buddyWheelSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes buddyTypeL {
                    0%, 100% { transform: rotate(-40deg); }
                    50% { transform: rotate(-56deg); }
                }
                @keyframes buddyTypeR {
                    0%, 100% { transform: rotate(56deg); }
                    50% { transform: rotate(40deg); }
                }
                @keyframes buddyHoldPadL {
                    0%, 100% { transform: rotate(-38deg); }
                    50% { transform: rotate(-44deg); }
                }
                @keyframes buddyHoldPadR {
                    0%, 100% { transform: rotate(44deg); }
                    50% { transform: rotate(38deg); }
                }
                @keyframes buddyPadShake {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-2px); }
                }
                @keyframes buddyStrumR {
                    0%, 100% { transform: rotate(32deg); }
                    50% { transform: rotate(62deg); }
                }
                @keyframes buddyBalanceL {
                    0%, 100% { transform: rotate(55deg); }
                    50% { transform: rotate(75deg); }
                }
                @keyframes buddyBalanceR {
                    0%, 100% { transform: rotate(-75deg); }
                    50% { transform: rotate(-55deg); }
                }
                @keyframes buddyFlame {
                    0%, 100% { transform: scaleY(0.85); opacity: 0.85; }
                    50% { transform: scaleY(1.25); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default FullBodyBuddy;
