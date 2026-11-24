import React, { useId } from 'react';

export type RobinMascotVariant = 'wilbur' | 'lewis' | 'franny' | 'bento-girl';

export interface RobinCharactersSvgProps {
    variant: RobinMascotVariant;
    eyeOffset: { x: number; y: number };
    isBlinking: boolean;
    lookDown: boolean;
    hideEyes: boolean;
    peekEyes: boolean;
}

const MEDALLION_CX = 120;
const MEDALLION_CY = 128;
const MEDALLION_R = 92;

interface EyePairProps {
    idPrefix: string;
    leftX: number;
    rightX: number;
    eyeY: number;
    irisColor: string;
    irisHighlight: string;
    lidColor: string;
    lookX: number;
    lookY: number;
    isBlinking: boolean;
    peekEyes: boolean;
    hideEyes: boolean;
    hasLashes?: boolean;
    strokeColor?: string;
    strokeWidth?: number;
}

const CharacterEyes: React.FC<EyePairProps> = ({
    idPrefix,
    leftX,
    rightX,
    eyeY,
    irisColor,
    irisHighlight,
    lidColor,
    lookX,
    lookY,
    isBlinking,
    peekEyes,
    hideEyes,
    hasLashes = false,
    strokeColor = '#3a241b',
    strokeWidth = 0
}) => {
    const leftCovered = hideEyes;
    const rightCovered = hideEyes && !peekEyes;

    const renderSingleEye = (cx: number, isCovered: boolean, isLeft: boolean) => {
        const clipId = `${idPrefix}-eye-${isLeft ? 'l' : 'r'}`;
        const blinkActive = isBlinking && !isCovered;

        return (
            <g>
                <defs>
                    <clipPath id={clipId}>
                        <ellipse cx={cx} cy={eyeY} rx={12.5} ry={13.8} />
                    </clipPath>
                </defs>

                {/* Soft under-eye socket shadow */}
                <ellipse cx={cx} cy={eyeY + 1.5} rx={13.5} ry={14.5} fill="#b97b5d" opacity="0.18" />

                {/* Eye Sclera */}
                <ellipse
                    cx={cx}
                    cy={eyeY}
                    rx={12.5}
                    ry={13.8}
                    fill="#fcfdff"
                    stroke={strokeWidth > 0 ? strokeColor : 'none'}
                    strokeWidth={strokeWidth}
                />

                {/* Clipped Iris + Pupil (60fps smooth RAF position, zero CSS transition lag) */}
                <g clipPath={`url(#${clipId})`}>
                    <g style={{ transform: `translate3d(${lookX}px, ${lookY}px, 0)` }}>
                        <circle cx={cx} cy={eyeY + 0.5} r={7.4} fill={irisColor} />
                        <circle cx={cx} cy={eyeY + 2} r={5.4} fill={irisHighlight} opacity="0.35" />
                        <circle cx={cx} cy={eyeY + 0.5} r={4.1} fill="#090d16" />
                        <circle cx={cx - 2.4} cy={eyeY - 2.3} r={2.4} fill="#ffffff" />
                        <circle cx={cx + 2.4} cy={eyeY + 2.3} r={1.1} fill="#ffffff" opacity="0.9" />
                    </g>

                    {/* Soft spherical upper-lid ambient shadow inside sclera */}
                    <ellipse cx={cx} cy={eyeY - 12.5} rx={14} ry={7} fill="#1e293b" opacity="0.14" />

                    {/* Animated Blink Eyelid Curtain */}
                    <rect
                        x={cx - 14}
                        y={eyeY - 15}
                        width={28}
                        height={30}
                        fill={lidColor}
                        style={{
                            transform: `scaleY(${blinkActive ? 1 : 0})`,
                            transformOrigin: `${cx}px ${eyeY - 14}px`,
                            transition: 'transform 115ms ease-in-out'
                        }}
                    />
                </g>

                {/* Smooth Upper Lash / Lid Accent */}
                <path
                    d={`M ${cx - 12.4} ${eyeY - 3.5} Q ${cx} ${hasLashes ? eyeY - 15.8 : eyeY - 14.2} ${cx + 12.4} ${eyeY - 3.5}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={hasLashes ? 2.5 : 1.7}
                    strokeLinecap="round"
                    opacity={hasLashes ? 0.92 : 0.45}
                />
                {hasLashes && (
                    <path
                        d={
                            isLeft
                                ? `M ${cx - 12} ${eyeY - 4} Q ${cx - 15} ${eyeY - 6.5} ${cx - 16.5} ${eyeY - 9.5}`
                                : `M ${cx + 12} ${eyeY - 4} Q ${cx + 15} ${eyeY - 6.5} ${cx + 16.5} ${eyeY - 9.5}`
                        }
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={2.3}
                        strokeLinecap="round"
                    />
                )}
            </g>
        );
    };

    return (
        <g>
            {renderSingleEye(leftX, leftCovered, true)}
            {renderSingleEye(rightX, rightCovered, false)}
        </g>
    );
};

interface ArmsOverlayProps {
    idPrefix: string;
    hideEyes: boolean;
    peekEyes: boolean;
    skinLight: string;
    skinMid: string;
    skinShadow: string;
    sleeveColor: string;
    sleeveShade: string;
    strokeColor?: string;
    strokeWidth?: number;
    leftEyeX: number;
    rightEyeX: number;
    eyeY: number;
}

const ArmsOverlay: React.FC<ArmsOverlayProps> = ({
    idPrefix,
    hideEyes,
    peekEyes,
    skinLight,
    skinMid,
    skinShadow,
    sleeveColor,
    sleeveShade,
    strokeColor = 'none',
    strokeWidth = 0,
    leftEyeX,
    rightEyeX,
    eyeY
}) => {
    const gradL = `${idPrefix}-arm-skin-l`;
    const gradR = `${idPrefix}-arm-skin-r`;
    const armClipId = `${idPrefix}-arm-clip`;

    // Anchor lower shoulder/elbow pivots inside the medallion so arms sweep cleanly along natural shoulder arcs
    const leftShoulderX = 56;
    const rightShoulderX = 184;
    const shoulderY = 212;

    // Offsets so hands align cleanly over each character's eye coordinates
    const leftTargetDx = leftEyeX - 99;
    const rightTargetDx = rightEyeX - 141;
    const eyeDy = eyeY - 105;

    const armTransition = 'transform 480ms cubic-bezier(0.22, 1.12, 0.36, 1), opacity 220ms ease-out';

    const leftTransform = hideEyes
        ? `translate3d(${leftShoulderX + leftTargetDx}px, ${shoulderY + eyeDy}px, 0) rotate(${peekEyes ? -1 : 0}deg) scale(1)`
        : `translate3d(${leftShoulderX - 10}px, ${shoulderY + 58}px, 0) rotate(-36deg) scale(0.9)`;

    // When peeking (password revealed), sweep right arm smoothly outward & down away from the face/chin
    const rightTransform = hideEyes
        ? peekEyes
            ? `translate3d(${rightShoulderX + 8}px, ${shoulderY + 42}px, 0) rotate(24deg) scale(0.97)`
            : `translate3d(${rightShoulderX + rightTargetDx}px, ${shoulderY + eyeDy}px, 0) rotate(0deg) scale(1)`
        : `translate3d(${rightShoulderX + 10}px, ${shoulderY + 58}px, 0) rotate(36deg) scale(0.9)`;

    return (
        <g pointerEvents="none" clipPath={`url(#${armClipId})`}>
            <defs>
                {/* Unclipped above y=128 (face/eyes), clipped cleanly to lower medallion arc below y=128 */}
                <clipPath id={armClipId}>
                    <path d={`M 0 0 H 240 V ${MEDALLION_CY} H ${MEDALLION_CX + MEDALLION_R} A ${MEDALLION_R} ${MEDALLION_R} 0 0 1 ${MEDALLION_CX - MEDALLION_R} ${MEDALLION_CY} H 0 Z`} />
                </clipPath>
                <linearGradient id={gradL} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={skinLight} />
                    <stop offset="60%" stopColor={skinMid} />
                    <stop offset="100%" stopColor={skinShadow} />
                </linearGradient>
                <linearGradient id={gradR} x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={skinLight} />
                    <stop offset="60%" stopColor={skinMid} />
                    <stop offset="100%" stopColor={skinShadow} />
                </linearGradient>
            </defs>

            {/* Left Articulated Arm, Sleeve & Sculpted Hand (Shoulder pivot at local 0,0; palm lands at +43, -107) */}
            <g
                style={{
                    opacity: hideEyes ? 1 : 0,
                    transform: leftTransform,
                    transition: armTransition
                }}
            >
                {/* Soft Shadow Behind Raised Palm */}
                <ellipse cx="44" cy="-102" rx="18" ry="18" fill="#090d16" opacity={hideEyes ? 0.14 : 0} />

                {/* Upper Sleeve Emerging from Shoulder */}
                <path
                    d="M -12 8 C -10 -12, -2 -28, 7 -40 L 31 -32 C 26 -14, 22 2, 16 14 Z"
                    fill={sleeveColor}
                    stroke={strokeWidth > 0 ? strokeColor : 'none'}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                />
                <path
                    d="M 15 -36 C 12 -18, 9 -4, 4 10"
                    fill="none"
                    stroke={sleeveShade}
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity="0.55"
                />

                {/* Smooth Forearm Leading up to Wrist */}
                <path
                    d="M 9 -36 C 16 -56, 22 -74, 28 -90 L 49 -84 C 46 -64, 38 -46, 28 -30 Z"
                    fill={`url(#${gradL})`}
                    stroke={strokeWidth > 0 ? strokeColor : 'none'}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                />

                {/* Articulated Palm, Fingers & Curved Thumb Covering Left Eye (center ~ 43, -107) */}
                <path
                    d="M 27 -94 C 24 -107, 27 -117, 32 -117 C 34.5 -117, 36 -115, 36.5 -113 C 37.5 -119, 41.5 -121, 44.5 -119 C 46 -118, 46.5 -115.5, 46.5 -114 C 48 -118.5, 52 -118.5, 54.5 -115 C 56 -113, 56 -109, 55.5 -105 C 59 -106, 62 -103, 60.5 -98 C 58.5 -91.5, 53.5 -86, 48 -84 L 31 -85 C 28 -87.5, 27.5 -90.5, 27 -94 Z"
                    fill={`url(#${gradL})`}
                    stroke={strokeWidth > 0 ? strokeColor : 'none'}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                />
                {/* Soft Finger Contour Creases */}
                <path
                    d="M 35.5 -112 L 35 -101 M 42.5 -114 L 42 -101 M 49.5 -112 L 49 -101"
                    stroke={skinShadow}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    opacity={0.75}
                />
            </g>

            {/* Right Articulated Arm, Sleeve & Sculpted Hand (Mirrored shoulder pivot 0,0; palm lands at -43, -107) */}
            <g
                style={{
                    opacity: hideEyes ? 1 : 0,
                    transform: rightTransform,
                    transition: armTransition
                }}
            >
                <ellipse cx="-44" cy="-102" rx="18" ry="18" fill="#090d16" opacity={hideEyes && !peekEyes ? 0.14 : 0} />

                <path
                    d="M 12 8 C 10 -12, 2 -28, -7 -40 L -31 -32 C -26 -14, -22 2, -16 14 Z"
                    fill={sleeveColor}
                    stroke={strokeWidth > 0 ? strokeColor : 'none'}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                />
                <path
                    d="M -15 -36 C -12 -18, -9 -4, -4 10"
                    fill="none"
                    stroke={sleeveShade}
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity="0.55"
                />

                <path
                    d="M -9 -36 C -16 -56, -22 -74, -28 -90 L -49 -84 C -46 -64, -38 -46, -28 -30 Z"
                    fill={`url(#${gradR})`}
                    stroke={strokeWidth > 0 ? strokeColor : 'none'}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                />

                <path
                    d="M -27 -94 C -24 -107, -27 -117, -32 -117 C -34.5 -117, -36 -115, -36.5 -113 C -37.5 -119, -41.5 -121, -44.5 -119 C -46 -118, -46.5 -115.5, -46.5 -114 C -48 -118.5, -52 -118.5, -54.5 -115 C -56 -113, -56 -109, -55.5 -105 C -59 -106, -62 -103, -60.5 -98 C -58.5 -91.5, -53.5 -86, -48 -84 L -31 -85 C -28 -87.5, -27.5 -90.5, -27 -94 Z"
                    fill={`url(#${gradR})`}
                    stroke={strokeWidth > 0 ? strokeColor : 'none'}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                />
                <path
                    d="M -35.5 -112 L -35 -101 M -42.5 -114 L -42 -101 M -49.5 -112 L -49 -101"
                    stroke={skinShadow}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    opacity={0.75}
                />
            </g>
        </g>
    );
};

export const RobinCharactersSvg: React.FC<RobinCharactersSvgProps> = ({
    variant,
    eyeOffset,
    isBlinking,
    lookDown,
    hideEyes,
    peekEyes
}) => {
    const rawId = useId();
    const idPrefix = `${variant}-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    // When peeking, uncovered right eye glances playfully up-right if cursor isn't actively offsetting it
    const baseLookX = peekEyes ? (Math.abs(eyeOffset.x) > 0.4 ? eyeOffset.x : 2.3) : eyeOffset.x;
    const baseLookY = peekEyes ? (Math.abs(eyeOffset.y) > 0.4 ? eyeOffset.y : 1.0) : eyeOffset.y;

    const lookX = lookDown ? 0 : Math.max(-5, Math.min(5, baseLookX));
    const lookY = lookDown ? 4 : Math.max(-3.2, Math.min(3.2, baseLookY));

    const headShiftX = lookDown ? 0 : baseLookX * 0.42;
    const headShiftY = (lookDown ? 2.2 : baseLookY * 0.3) + (peekEyes ? -1 : 0);
    const headTilt = lookDown ? 0 : (peekEyes ? 3.5 : baseLookX * 0.55);

    const headStyle: React.CSSProperties = {
        transform: `translate3d(${headShiftX}px, ${headShiftY}px, 0) rotate(${headTilt}deg)`,
        transformOrigin: '120px 132px',
        transition: lookDown || peekEyes ? 'transform 260ms ease-out' : undefined
    };

    const medallionClipId = `${idPrefix}-medallion`;
    const browLift = peekEyes ? -2.8 : 0;

    if (variant === 'wilbur') {
        return (
            <svg viewBox="0 0 240 240" className="w-full h-full select-none overflow-visible" aria-hidden="true">
                <defs>
                    <clipPath id={medallionClipId}>
                        <circle cx={MEDALLION_CX} cy={MEDALLION_CY} r={MEDALLION_R} />
                    </clipPath>
                    <radialGradient id={`${idPrefix}-bg`} cx="45%" cy="35%" r="70%">
                        <stop offset="0%" stopColor="#163b5c" />
                        <stop offset="65%" stopColor="#0b1d36" />
                        <stop offset="100%" stopColor="#071122" />
                    </radialGradient>
                    <radialGradient id={`${idPrefix}-skin`} cx="45%" cy="38%" r="68%">
                        <stop offset="0%" stopColor="#ffe5d2" />
                        <stop offset="62%" stopColor="#f4c5a7" />
                        <stop offset="100%" stopColor="#dc9c7b" />
                    </radialGradient>
                    <linearGradient id={`${idPrefix}-hair`} x1="15%" y1="0%" x2="85%" y2="100%">
                        <stop offset="0%" stopColor="#263449" />
                        <stop offset="48%" stopColor="#111827" />
                        <stop offset="100%" stopColor="#040812" />
                    </linearGradient>
                    <linearGradient id={`${idPrefix}-tee`} x1="20%" y1="0%" x2="80%" y2="100%">
                        <stop offset="0%" stopColor="#1e3a8a" />
                        <stop offset="55%" stopColor="#172554" />
                        <stop offset="100%" stopColor="#0b132b" />
                    </linearGradient>
                    <linearGradient id={`${idPrefix}-bolt`} x1="15%" y1="0%" x2="85%" y2="100%">
                        <stop offset="0%" stopColor="#fef9c3" />
                        <stop offset="55%" stopColor="#fde047" />
                        <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                </defs>

                <circle cx={MEDALLION_CX} cy={MEDALLION_CY} r={MEDALLION_R} fill={`url(#${idPrefix}-bg)`} />

                <g clipPath={`url(#${medallionClipId})`}>
                    <path
                        d="M 40 232 C 42 182, 74 163, 120 163 C 166 163, 198 182, 200 232 Z"
                        fill={`url(#${idPrefix}-tee)`}
                    />
                    <path
                        d="M 46 218 C 52 182, 78 165, 120 165 C 162 165, 188 182, 194 218"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.8"
                        strokeOpacity="0.28"
                    />
                    <path
                        d="M 98 164 Q 120 179 142 164"
                        fill="none"
                        stroke="#091124"
                        strokeWidth="6.5"
                        strokeLinecap="round"
                    />
                    <circle cx="120" cy="197" r="19" fill="#22d3ee" />
                    <circle cx="120" cy="197" r="19" fill="none" stroke="#a5f3fc" strokeWidth="1.5" opacity="0.65" />
                    <path
                        d="M 134 181 L 111 197 H 121 L 107 214 L 132 196 H 121 Z"
                        fill={`url(#${idPrefix}-bolt)`}
                    />
                    <rect x="108" y="145" width="24" height="24" rx="10" fill={`url(#${idPrefix}-skin)`} />
                    <ellipse cx="120" cy="155" rx="12" ry="5" fill="#c7876a" opacity="0.55" />
                </g>

                <circle
                    cx={MEDALLION_CX}
                    cy={MEDALLION_CY}
                    r={MEDALLION_R}
                    fill="none"
                    stroke="#00e5ff"
                    strokeOpacity="0.35"
                    strokeWidth="2"
                />

                <g style={headStyle}>
                    <ellipse cx="72" cy="107" rx="8.5" ry="12" fill="#eab99c" />
                    <path d="M 70 102 C 67 105, 67 111, 71 113" fill="none" stroke="#c9896b" strokeWidth="1.8" strokeLinecap="round" />
                    <ellipse cx="168" cy="107" rx="8.5" ry="12" fill="#eab99c" />
                    <path d="M 170 102 C 173 105, 173 111, 169 113" fill="none" stroke="#c9896b" strokeWidth="1.8" strokeLinecap="round" />

                    <path
                        d="M 74 90 C 74 58, 166 58, 166 90 C 166 127, 145 156, 120 156 C 95 156, 74 127, 74 90 Z"
                        fill={`url(#${idPrefix}-skin)`}
                    />

                    <ellipse cx="89" cy="119" rx="9" ry="5.5" fill="#fb7185" opacity="0.16" />
                    <ellipse cx="151" cy="119" rx="9" ry="5.5" fill="#fb7185" opacity="0.16" />

                    <path
                        d="M 72 99 C 68 70, 82 37, 111 31 C 117 16, 127 5, 138 4 C 132 16, 139 27, 150 34 C 168 44, 173 71, 168 99 C 165 82, 158 69, 144 65 C 127 60, 102 61, 87 69 C 78 74, 75 84, 72 99 Z"
                        fill={`url(#${idPrefix}-hair)`}
                    />
                    <path
                        d="M 96 47 Q 120 27 145 45"
                        fill="none"
                        stroke="#475569"
                        strokeWidth="4"
                        strokeLinecap="round"
                        opacity="0.55"
                    />
                    <path
                        d="M 116 24 Q 127 13 133 9"
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        opacity="0.5"
                    />

                    <CharacterEyes
                        idPrefix={idPrefix}
                        leftX={99}
                        rightX={141}
                        eyeY={104}
                        irisColor="#5d361d"
                        irisHighlight="#8c5432"
                        lidColor="#f4c5a7"
                        lookX={lookX}
                        lookY={lookY}
                        isBlinking={isBlinking}
                        peekEyes={peekEyes}
                        hideEyes={hideEyes}
                        strokeColor="#3b2217"
                    />

                    <path
                        d={`M 85 ${86 + browLift} C 93 80, 104 80, 112 ${85 + browLift}`}
                        fill="none"
                        stroke="#111827"
                        strokeWidth="4.2"
                        strokeLinecap="round"
                    />
                    <path
                        d={`M 129 ${84 + browLift} C 137 77, 148 77, 156 ${84 + browLift}`}
                        fill="none"
                        stroke="#111827"
                        strokeWidth="4.2"
                        strokeLinecap="round"
                    />

                    <path d="M 119 106 C 119 112, 118 117, 118 120" fill="none" stroke="#fff3eb" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
                    <path d="M 114.5 121.5 Q 120 125.5 125.5 121.5" fill="none" stroke="#c88a6d" strokeWidth="2.4" strokeLinecap="round" />

                    <path
                        d={lookDown ? 'M 109 135 Q 121 139 133 134' : 'M 106 135 C 117 141, 130 139, 138 131'}
                        fill="none"
                        stroke="#9e5642"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                    />
                    <path d="M 117 141 Q 122 143 127 141" fill="none" stroke="#d5997d" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                </g>

                <ArmsOverlay
                    idPrefix={idPrefix}
                    hideEyes={hideEyes}
                    peekEyes={peekEyes}
                    skinLight="#ffe5d2"
                    skinMid="#f4c5a7"
                    skinShadow="#cf9070"
                    sleeveColor="#172554"
                    sleeveShade="#0b132b"
                    leftEyeX={99}
                    rightEyeX={141}
                    eyeY={104}
                />
            </svg>
        );
    }

    if (variant === 'lewis') {
        return (
            <svg viewBox="0 0 240 240" className="w-full h-full select-none overflow-visible" aria-hidden="true">
                <defs>
                    <clipPath id={medallionClipId}>
                        <circle cx={MEDALLION_CX} cy={MEDALLION_CY} r={MEDALLION_R} />
                    </clipPath>
                    <linearGradient id={`${idPrefix}-hair`} x1="20%" y1="0%" x2="80%" y2="100%">
                        <stop offset="0%" stopColor="#fef9c3" />
                        <stop offset="48%" stopColor="#fde047" />
                        <stop offset="100%" stopColor="#eab308" />
                    </linearGradient>
                    <radialGradient id={`${idPrefix}-skin`} cx="45%" cy="38%" r="65%">
                        <stop offset="0%" stopColor="#ffe7d9" />
                        <stop offset="70%" stopColor="#fad4be" />
                        <stop offset="100%" stopColor="#ebae90" />
                    </radialGradient>
                </defs>

                <circle cx={MEDALLION_CX} cy={MEDALLION_CY} r={MEDALLION_R} fill="#e0f2fe" />

                <g clipPath={`url(#${medallionClipId})`}>
                    <rect x="35" y="206" width="170" height="24" fill="#ef4444" stroke="#000000" strokeWidth="2.8" />
                    <path
                        d="M 42 212 C 44 177, 74 163, 120 163 C 166 163, 196 177, 198 212 Z"
                        fill="#ffffff"
                        stroke="#000000"
                        strokeWidth="2.8"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M 78 166 L 103 163 L 120 184 L 137 163 L 162 166 L 166 212 L 74 212 Z"
                        fill="#2563eb"
                        stroke="#000000"
                        strokeWidth="2.8"
                        strokeLinejoin="round"
                    />
                    <path d="M 148 167 L 156 210 L 164 210 L 160 167 Z" fill="#1d4ed8" />
                    <polygon points="103,163 120,183 111,158" fill="#ffffff" stroke="#000000" strokeWidth="2.2" strokeLinejoin="round" />
                    <polygon points="137,163 120,183 129,158" fill="#ffffff" stroke="#000000" strokeWidth="2.2" strokeLinejoin="round" />
                    <rect x="109" y="146" width="22" height="20" rx="8" fill="#fad4be" stroke="#000000" strokeWidth="2.5" />
                    <ellipse cx="120" cy="154" rx="10" ry="4" fill="#d99b82" opacity="0.6" />
                </g>

                <circle cx={MEDALLION_CX} cy={MEDALLION_CY} r={MEDALLION_R} fill="none" stroke="#000000" strokeWidth="3" />

                <g style={headStyle}>
                    <path
                        d="M 73 95 C 67 74, 70 50, 81 53 C 77 32, 85 16, 96 36 C 98 13, 108 5, 114 31 C 120 7, 131 6, 134 32 C 141 11, 153 16, 151 39 C 163 23, 173 36, 166 56 C 176 55, 173 78, 166 95 Z"
                        fill={`url(#${idPrefix}-hair)`}
                        stroke="#000000"
                        strokeWidth="2.8"
                        strokeLinejoin="round"
                    />

                    <circle cx="72" cy="110" r="9.5" fill="#fad4be" stroke="#000000" strokeWidth="2.6" />
                    <circle cx="168" cy="110" r="9.5" fill="#fad4be" stroke="#000000" strokeWidth="2.6" />

                    <path
                        d="M 75 93 C 75 65, 165 65, 165 93 C 165 131, 146 153, 120 153 C 94 153, 75 131, 75 93 Z"
                        fill={`url(#${idPrefix}-skin)`}
                        stroke="#000000"
                        strokeWidth="2.8"
                    />

                    <path
                        d="M 76 88 Q 97 70 119 76 Q 141 68 164 88 L 164 60 L 76 60 Z"
                        fill={`url(#${idPrefix}-hair)`}
                    />
                    <path
                        d="M 77 87 Q 97 70 119 76 Q 141 68 163 87"
                        fill="none"
                        stroke="#000000"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                    />
                    <path d="M 74 92 C 74 79, 77 67, 81 53" fill="none" stroke="#000000" strokeWidth="2.8" strokeLinecap="round" />
                    <path d="M 166 92 C 166 79, 164 67, 166 56" fill="none" stroke="#000000" strokeWidth="2.8" strokeLinecap="round" />
                    <path
                        d="M 92 50 Q 107 26 117 44 Q 126 22 135 44 Q 146 28 154 50"
                        fill="none"
                        stroke="#fefce8"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        opacity="0.9"
                    />

                    <ellipse cx="90" cy="122" rx="7" ry="4" fill="#fb7185" opacity="0.22" />
                    <ellipse cx="150" cy="122" rx="7" ry="4" fill="#fb7185" opacity="0.22" />

                    <CharacterEyes
                        idPrefix={idPrefix}
                        leftX={98}
                        rightX={142}
                        eyeY={108}
                        irisColor="#2563eb"
                        irisHighlight="#60a5fa"
                        lidColor="#fad4be"
                        lookX={lookX}
                        lookY={lookY}
                        isBlinking={isBlinking}
                        peekEyes={peekEyes}
                        hideEyes={hideEyes}
                        strokeColor="#000000"
                        strokeWidth={1.8}
                    />

                    <g>
                        <circle cx="98" cy="108" r="18" fill="#ffffff" fillOpacity="0.14" stroke="#111827" strokeWidth="2.3" />
                        <circle cx="142" cy="108" r="18" fill="#ffffff" fillOpacity="0.14" stroke="#111827" strokeWidth="2.3" />
                        <path d="M 88 99 L 94 94 M 132 99 L 138 94" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
                        <path d="M 116 107 Q 120 103 124 107" fill="none" stroke="#111827" strokeWidth="2.3" strokeLinecap="round" />
                        <path d="M 80 106 L 75 104 M 160 106 L 165 104" stroke="#111827" strokeWidth="2.3" strokeLinecap="round" />
                    </g>

                    <path d={`M 87 ${85 + browLift} Q 98 80 109 ${85 + browLift}`} fill="none" stroke="#a16207" strokeWidth="2.8" strokeLinecap="round" />
                    <path d={`M 131 ${85 + browLift} Q 142 80 153 ${85 + browLift}`} fill="none" stroke="#a16207" strokeWidth="2.8" strokeLinecap="round" />

                    <path d="M 116 121 Q 120 124.5 124 121" fill="none" stroke="#d99b82" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M 103 132 Q 120 143 137 132" fill="#ffffff" stroke="#000000" strokeWidth="2.3" strokeLinecap="round" />
                </g>

                <ArmsOverlay
                    idPrefix={idPrefix}
                    hideEyes={hideEyes}
                    peekEyes={peekEyes}
                    skinLight="#ffe7d9"
                    skinMid="#fad4be"
                    skinShadow="#d99b82"
                    sleeveColor="#ffffff"
                    sleeveShade="#cbd5e1"
                    strokeColor="#000000"
                    strokeWidth={2.5}
                    leftEyeX={98}
                    rightEyeX={142}
                    eyeY={108}
                />
            </svg>
        );
    }

    if (variant === 'franny') {
        return (
            <svg viewBox="0 0 240 240" className="w-full h-full select-none overflow-visible" aria-hidden="true">
                <defs>
                    <clipPath id={medallionClipId}>
                        <circle cx={MEDALLION_CX} cy={MEDALLION_CY} r={MEDALLION_R} />
                    </clipPath>
                    <radialGradient id={`${idPrefix}-bg`} cx="45%" cy="35%" r="70%">
                        <stop offset="0%" stopColor="#3c1324" />
                        <stop offset="65%" stopColor="#1b0d18" />
                        <stop offset="100%" stopColor="#09070d" />
                    </radialGradient>
                    <radialGradient id={`${idPrefix}-skin`} cx="45%" cy="38%" r="68%">
                        <stop offset="0%" stopColor="#ffe7d6" />
                        <stop offset="65%" stopColor="#f5cbb2" />
                        <stop offset="100%" stopColor="#dda080" />
                    </radialGradient>
                    <linearGradient id={`${idPrefix}-hair`} x1="15%" y1="0%" x2="85%" y2="100%">
                        <stop offset="0%" stopColor="#263449" />
                        <stop offset="50%" stopColor="#0f172a" />
                        <stop offset="100%" stopColor="#030712" />
                    </linearGradient>
                    <linearGradient id={`${idPrefix}-tunic`} x1="20%" y1="0%" x2="80%" y2="100%">
                        <stop offset="0%" stopColor="#1e293b" />
                        <stop offset="60%" stopColor="#111827" />
                        <stop offset="100%" stopColor="#080d1a" />
                    </linearGradient>
                    <linearGradient id={`${idPrefix}-crimson`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="55%" stopColor="#dc2626" />
                        <stop offset="100%" stopColor="#991b1b" />
                    </linearGradient>
                </defs>

                <circle cx={MEDALLION_CX} cy={MEDALLION_CY} r={MEDALLION_R} fill={`url(#${idPrefix}-bg)`} />

                <g clipPath={`url(#${medallionClipId})`}>
                    <path
                        d="M 48 232 C 52 184, 78 166, 120 166 C 162 166, 188 184, 192 232 Z"
                        fill={`url(#${idPrefix}-tunic)`}
                    />
                    <path
                        d="M 86 167 Q 120 198 154 167 L 138 154 L 102 154 Z"
                        fill={`url(#${idPrefix}-crimson)`}
                    />
                    <rect x="74" y="207" width="92" height="7.5" rx="3.75" fill="#fbbf24" />
                    <path d="M 82 209 H 158" stroke="#fef3c7" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />

                    <rect x="108" y="142" width="24" height="22" rx="8" fill={`url(#${idPrefix}-skin)`} />
                    <ellipse cx="120" cy="148" rx="12" ry="4" fill="#c7876a" opacity="0.5" />
                    <path d="M 105 148 Q 120 156 135 148 L 136 168 Q 120 174 104 168 Z" fill={`url(#${idPrefix}-crimson)`} />
                </g>

                <circle cx={MEDALLION_CX} cy={MEDALLION_CY} r={MEDALLION_R} fill="none" stroke="#f43f5e" strokeOpacity="0.35" strokeWidth="2" />

                <g style={headStyle}>
                    <circle cx="71" cy="70" r="18.5" fill={`url(#${idPrefix}-hair)`} />
                    <path d="M 66 84 C 58 95, 50 106, 47 112 L 60 115 C 66 105, 70 96, 73 89 Z" fill={`url(#${idPrefix}-crimson)`} />
                    <path d="M 75 88 C 75 99, 75 110, 77 118 L 88 113 C 86 103, 84 94, 83 86 Z" fill="#be123c" />
                    <circle cx="76" cy="83" r="5.5" fill="#fb7185" />

                    <ellipse cx="74" cy="109" rx="7.5" ry="11" fill="#eab99c" />
                    <ellipse cx="166" cy="109" rx="7.5" ry="11" fill="#eab99c" />

                    <path
                        d="M 75 93 C 75 63, 165 63, 165 93 C 165 127, 144 152, 120 152 C 96 152, 75 127, 75 93 Z"
                        fill={`url(#${idPrefix}-skin)`}
                    />
                    <ellipse cx="90" cy="121" rx="8.5" ry="4.8" fill="#fb7185" opacity="0.22" />
                    <ellipse cx="150" cy="121" rx="8.5" ry="4.8" fill="#fb7185" opacity="0.22" />

                    <path
                        d="M 73 99 C 69 71, 84 44, 107 38 C 109 21, 120 9, 129 7 C 132 18, 144 30, 158 44 C 170 58, 170 84, 165 99 C 161 81, 149 66, 120 66 C 95 66, 80 78, 73 99 Z"
                        fill={`url(#${idPrefix}-hair)`}
                    />
                    <path d="M 118 22 Q 133 35 147 50" fill="none" stroke="#475569" strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />

                    <CharacterEyes
                        idPrefix={idPrefix}
                        leftX={99}
                        rightX={141}
                        eyeY={105}
                        irisColor="#6b3e26"
                        irisHighlight="#9a5c3a"
                        lidColor="#f5cbb2"
                        lookX={lookX}
                        lookY={lookY}
                        isBlinking={isBlinking}
                        peekEyes={peekEyes}
                        hideEyes={hideEyes}
                        hasLashes={true}
                        strokeColor="#1e1522"
                    />

                    <path d={`M 85 ${86 + browLift} Q 99 79 112 ${85 + browLift}`} fill="none" stroke="#0f172a" strokeWidth="3.4" strokeLinecap="round" />
                    <path d={`M 128 ${85 + browLift} Q 141 78 155 ${86 + browLift}`} fill="none" stroke="#0f172a" strokeWidth="3.4" strokeLinecap="round" />

                    <path d="M 119 108 L 118 119" fill="none" stroke="#fff3eb" strokeWidth="2.2" strokeLinecap="round" opacity="0.5" />
                    <path d="M 115.5 120.5 Q 120 124 124.5 120.5" fill="none" stroke="#c88a6d" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M 106 133 Q 120 142 135 132" fill="none" stroke="#be123c" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 115 139 Q 120 142 126 139" fill="none" stroke="#fb7185" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
                </g>

                <ArmsOverlay
                    idPrefix={idPrefix}
                    hideEyes={hideEyes}
                    peekEyes={peekEyes}
                    skinLight="#ffe7d6"
                    skinMid="#f5cbb2"
                    skinShadow="#cf9070"
                    sleeveColor="#111827"
                    sleeveShade="#030712"
                    leftEyeX={99}
                    rightEyeX={141}
                    eyeY={105}
                />
            </svg>
        );
    }

    // variant === 'bento-girl' (Young Franny / Inventor Robin)
    return (
        <svg viewBox="0 0 240 240" className="w-full h-full select-none overflow-visible" aria-hidden="true">
            <defs>
                <clipPath id={medallionClipId}>
                    <circle cx={MEDALLION_CX} cy={MEDALLION_CY} r={MEDALLION_R} />
                </clipPath>
                <linearGradient id={`${idPrefix}-hair`} x1="15%" y1="0%" x2="85%" y2="100%">
                    <stop offset="0%" stopColor="#fde68a" />
                    <stop offset="50%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <radialGradient id={`${idPrefix}-skin`} cx="45%" cy="38%" r="65%">
                    <stop offset="0%" stopColor="#ffeadc" />
                    <stop offset="70%" stopColor="#fde3d3" />
                    <stop offset="100%" stopColor="#eec1a8" />
                </radialGradient>
            </defs>

            <circle cx={MEDALLION_CX} cy={MEDALLION_CY} r={MEDALLION_R} fill="#fef9c3" />

            <g clipPath={`url(#${medallionClipId})`}>
                <path
                    d="M 46 226 C 48 182, 76 166, 120 166 C 164 166, 192 182, 194 226 Z"
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth="2.8"
                    strokeLinejoin="round"
                />
                <path
                    d="M 78 167 L 103 165 L 120 185 L 137 165 L 162 167 L 166 226 L 74 226 Z"
                    fill="#38bdf8"
                    stroke="#000000"
                    strokeWidth="2.8"
                    strokeLinejoin="round"
                />
                <path d="M 148 168 L 156 223 L 164 223 L 160 168 Z" fill="#0ea5e9" opacity="0.65" />

                <circle cx="145" cy="195" r="9.5" fill="#fde047" stroke="#000000" strokeWidth="2.2" />
                <path d="M 147 189 L 141 195 H 145 L 143 201 L 150 194 H 146 Z" fill="#000000" />

                <polygon points="103,165 120,184 111,159" fill="#ffffff" stroke="#000000" strokeWidth="2.2" strokeLinejoin="round" />
                <polygon points="137,165 120,184 129,159" fill="#ffffff" stroke="#000000" strokeWidth="2.2" strokeLinejoin="round" />

                <rect x="109" y="146" width="22" height="22" rx="8" fill="#fde3d3" stroke="#000000" strokeWidth="2.4" />
                <ellipse cx="120" cy="153" rx="10" ry="3.8" fill="#d99b82" opacity="0.55" />
            </g>

            <circle cx={MEDALLION_CX} cy={MEDALLION_CY} r={MEDALLION_R} fill="none" stroke="#000000" strokeWidth="3" />

            <g style={headStyle}>
                <path
                    d="M 70 72 C 46 66, 36 88, 44 112 C 49 124, 58 130, 68 122 C 62 114, 61 102, 68 92 Z"
                    fill={`url(#${idPrefix}-hair)`}
                    stroke="#000000"
                    strokeWidth="2.8"
                    strokeLinejoin="round"
                />
                <path d="M 52 84 Q 44 100 54 115" fill="none" stroke="#fefce8" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />

                <path
                    d="M 67 118 C 65 62, 88 37, 120 37 C 152 37, 175 62, 173 118 C 176 135, 165 144, 152 142 L 88 142 C 75 144, 64 135, 67 118 Z"
                    fill={`url(#${idPrefix}-hair)`}
                    stroke="#000000"
                    strokeWidth="2.8"
                    strokeLinejoin="round"
                />

                <circle cx="72" cy="112" r="9" fill="#fde3d3" stroke="#000000" strokeWidth="2.5" />
                <circle cx="168" cy="112" r="9" fill="#fde3d3" stroke="#000000" strokeWidth="2.5" />

                <path
                    d="M 76 96 C 76 66, 164 66, 164 96 C 164 132, 146 154, 120 154 C 94 154, 76 132, 76 96 Z"
                    fill={`url(#${idPrefix}-skin)`}
                    stroke="#000000"
                    strokeWidth="2.8"
                />

                <path
                    d="M 76 92 C 77 62, 99 45, 120 45 C 141 45, 163 62, 164 92 C 154 80, 145 78, 138 84 C 131 74, 125 71, 120 71 C 115 71, 108 75, 102 84 C 95 78, 85 80, 76 92 Z"
                    fill={`url(#${idPrefix}-hair)`}
                />
                <path
                    d="M 77 91 C 86 80, 95 78, 102 84 C 108 75, 115 71, 120 71 C 125 71, 131 74, 138 84 C 145 78, 154 80, 163 91"
                    fill="none"
                    stroke="#000000"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path d="M 92 59 Q 120 49 148 59" fill="none" stroke="#fefce8" strokeWidth="3.2" strokeLinecap="round" opacity="0.9" />

                <g transform="translate(151, 46) rotate(18)">
                    <path d="M 0 0 C -8 -8, -16 -12, -21 -9 C -22 -2, -20 6, -15 11 C -9 9, -4 5, 0 0 Z" fill="#fb7185" stroke="#000000" strokeWidth="2.6" strokeLinejoin="round" />
                    <path d="M 0 0 C 8 -8, 16 -12, 21 -9 C 22 -2, 20 6, 15 11 C 9 9, 4 5, 0 0 Z" fill="#fb7185" stroke="#000000" strokeWidth="2.6" strokeLinejoin="round" />
                    <path d="M -13 0 H -4 M 4 0 H 13" stroke="#be123c" strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
                    <circle cx="0" cy="0" r="5.5" fill="#f43f5e" stroke="#000000" strokeWidth="2.5" />
                </g>

                <ellipse cx="90" cy="123" rx="7.5" ry="4.5" fill="#fda4af" opacity="0.85" />
                <ellipse cx="150" cy="123" rx="7.5" ry="4.5" fill="#fda4af" opacity="0.85" />

                <CharacterEyes
                    idPrefix={idPrefix}
                    leftX={98}
                    rightX={142}
                    eyeY={108}
                    irisColor="#0d9488"
                    irisHighlight="#2dd4bf"
                    lidColor="#fde3d3"
                    lookX={lookX}
                    lookY={lookY}
                    isBlinking={isBlinking}
                    peekEyes={peekEyes}
                    hideEyes={hideEyes}
                    hasLashes={true}
                    strokeColor="#000000"
                    strokeWidth={1.8}
                />

                <path d={`M 86 ${88 + browLift} Q 98 83 110 ${88 + browLift}`} fill="none" stroke="#000000" strokeWidth="2.6" strokeLinecap="round" />
                <path d={`M 130 ${88 + browLift} Q 142 83 154 ${88 + browLift}`} fill="none" stroke="#000000" strokeWidth="2.6" strokeLinecap="round" />

                <path d="M 117 121 Q 120 124 123 121" fill="none" stroke="#d99b82" strokeWidth="2" strokeLinecap="round" />
                <path d="M 105 133 Q 120 143 135 133" fill="none" stroke="#000000" strokeWidth="2.6" strokeLinecap="round" />
            </g>

            <ArmsOverlay
                idPrefix={idPrefix}
                hideEyes={hideEyes}
                peekEyes={peekEyes}
                skinLight="#ffeadc"
                skinMid="#fde3d3"
                skinShadow="#d99b82"
                sleeveColor="#ffffff"
                sleeveShade="#cbd5e1"
                strokeColor="#000000"
                strokeWidth={2.5}
                leftEyeX={98}
                rightEyeX={142}
                eyeY={108}
            />
        </svg>
    );
};

export default RobinCharactersSvg;
