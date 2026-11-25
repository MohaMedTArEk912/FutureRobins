import type { AvatarConfig } from '../../types';
import { DEFAULT_AVATAR_CONFIG } from '../../constants/avatarDefaults';
import { syncAvatarWithGender } from '../../utils/avatarGenderSync';

export interface ThirdPersonAvatarState {
    runPhase: number;
    laneTilt: number;
    jumpHeight: number;
    sliding: boolean;
    gravityInverted: boolean;
    hasShield: boolean;
    rocketActive: boolean;
    ultActive: boolean;
    hitFlashMs: number;
    flipProgress?: number;
    falling?: boolean;
    fallProgress?: number;
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

function drawRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
}

function darken(hex: string, amount = -26): string {
    const clean = (hex || '#3b82f6').replace('#', '');
    if (clean.length !== 6) return hex;
    const num = parseInt(clean, 16);
    const clamp = (v: number) => Math.max(0, Math.min(255, v));
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0xff) + amount);
    const b = clamp((num & 0xff) + amount);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

let cachedAvatarInput: Partial<AvatarConfig> | null | undefined;
let cachedResolvedAvatar: ReturnType<typeof syncAvatarWithGender> | null = null;
let cachedTopShade = '#1d4ed8';

/**
 * Renders the player's customized Avatar from a crisp Neo-Brutalist 3rd-person
 * chase perspective with stride animations, lane banking, items, and Ult aura.
 */
export function drawThirdPersonAvatar(
    ctx: CanvasRenderingContext2D,
    avatar: Partial<AvatarConfig> | null | undefined,
    x: number,
    y: number,
    scale: number,
    state: ThirdPersonAvatarState
): void {
    if (!cachedResolvedAvatar || cachedAvatarInput !== avatar) {
        cachedAvatarInput = avatar;
        cachedResolvedAvatar = syncAvatarWithGender(
            avatar || DEFAULT_AVATAR_CONFIG,
            avatar?.gender === 'female' ? 'female' : 'male'
        );
        const topCol =
            cachedResolvedAvatar.outfitColor ||
            DEFAULT_TOP_COLORS[cachedResolvedAvatar.clothing || 'shirt'] ||
            '#3b82f6';
        cachedTopShade = darken(topCol, -30);
    }
    const resolved = cachedResolvedAvatar;

    const skinColor = resolved.skinColor || '#F5D0C5';
    const hairColor = resolved.hairColor || '#4A3728';
    const hairStyle = resolved.hairStyle || 'short';
    const clothing: string = resolved.clothing || 'shirt';
    const topColor = resolved.outfitColor || DEFAULT_TOP_COLORS[clothing] || '#3b82f6';
    const topShade = cachedTopShade;
    const bottoms: string = resolved.bottoms || 'jeans';
    const bottomsColor = resolved.bottomsColor || '#1e293b';
    const shoesColor = resolved.shoesColor || '#ef4444';
    const accessory = resolved.accessory || 'none';
    const sleeveColor = clothing === 'tank' ? skinColor : clothing === 'varsity' ? '#f8fafc' : topColor;

    const stride = Math.sin(state.runPhase);
    const strideAbs = Math.abs(stride);
    const airborne = state.jumpHeight > 4;
    const flipProgress = state.flipProgress ?? 0;
    const isFlipping = flipProgress > 0 && flipProgress < 1;
    const isFalling = Boolean(state.falling);
    const fallProgress = state.fallProgress ?? 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    if (isFalling && fallProgress > 0.78) {
        ctx.globalAlpha = Math.max(0.25, 1 - (fallProgress - 0.78) / 0.22);
    } else if (state.hitFlashMs > 0 && Math.floor(state.hitFlashMs / 60) % 2 === 0) {
        ctx.globalAlpha = 0.55;
    }

    // Orbiting Anti-Gravity Energy Rings during Flip
    if (isFlipping) {
        ctx.save();
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(0, -44, 34, 14, flipProgress * Math.PI * 1.4, 0, Math.PI * 2);
        ctx.strokeStyle = '#c084fc';
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(0, -44, 28, 11, -flipProgress * Math.PI * 1.8, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();
        ctx.restore();
    }

    // Overdrive Nova ULT Aura
    if (state.ultActive) {
        const pulse = 1 + Math.sin(state.runPhase * 1.8) * 0.08;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, -40, 34 * pulse, 46 * pulse, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(190, 242, 100, 0.28)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fde047';
        ctx.stroke();
        ctx.restore();
    }

    // Paper Shield Bubble
    if (state.hasShield) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, -40, 31, 43, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(186, 230, 253, 0.25)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#38bdf8';
        ctx.setLineDash([7, 4]);
        ctx.stroke();
        ctx.restore();
    }

    // Apply banking tilt, slide crouch, mid-flip 360 somersault, or fall wobble
    const crouchScaleY = state.sliding ? 0.62 : 1;
    const crouchShiftY = state.sliding ? 12 : 0;
    const bobY = airborne || isFlipping || isFalling ? -3 : -strideAbs * 4;
    ctx.translate(0, crouchShiftY + bobY);

    if (isFalling) {
        ctx.rotate(Math.sin(fallProgress * 14) * 0.28);
    } else if (isFlipping) {
        ctx.translate(0, -42);
        ctx.rotate(flipProgress * Math.PI * 2);
        ctx.scale(1, 0.85);
        ctx.translate(0, 42);
    } else {
        ctx.rotate(state.laneTilt * 0.24);
    }
    ctx.scale(state.sliding ? 1.12 : 1, crouchScaleY);

    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#000000';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // --- 1. LEGS & SHOES (Back-view 3D stride depth) ---
    const fastKick = Math.sin(state.runPhase * 2.8);
    const leftLegSwing = isFalling ? fastKick * 0.72 : isFlipping ? -0.68 : airborne ? -0.45 : stride * 0.55;
    const rightLegSwing = isFalling ? -fastKick * 0.72 : isFlipping ? -0.52 : airborne ? 0.35 : -stride * 0.55;
    const isSkirtOrDress = clothing === 'dress' || bottoms === 'skirt';

    const drawRunnerLeg = (offsetX: number, swing: number) => {
        ctx.save();
        ctx.translate(offsetX, -28);
        const legLen = 22;
        const footY = legLen + swing * 7;
        const legScale = 1 - swing * 0.14;
        ctx.scale(legScale, 1);

        // Leg / Pants
        drawRoundRect(ctx, -5.5, 0, 11, Math.max(12, footY - 4), 4.5);
        ctx.fillStyle = isSkirtOrDress || bottoms === 'shorts' ? skinColor : bottomsColor;
        ctx.fill();
        ctx.stroke();

        if (bottoms === 'shorts' && !isSkirtOrDress) {
            drawRoundRect(ctx, -6, 0, 12, 10, 3);
            ctx.fillStyle = bottomsColor;
            ctx.fill();
            ctx.stroke();
        }

        // Shoe sole + upper (visible from behind!)
        drawRoundRect(ctx, -6.5, Math.max(10, footY - 7), 13, 10, 4);
        ctx.fillStyle = shoesColor;
        ctx.fill();
        ctx.stroke();

        // Crisp white sneaker heel stripe
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-5, Math.max(10, footY - 1), 10, 2.5);
        ctx.restore();
    };

    if (leftLegSwing < rightLegSwing) {
        drawRunnerLeg(-8, leftLegSwing);
        drawRunnerLeg(8, rightLegSwing);
    } else {
        drawRunnerLeg(8, rightLegSwing);
        drawRunnerLeg(-8, leftLegSwing);
    }

    // --- 2. PUMPING ARMS ---
    const drawRunnerArm = (offsetX: number, angle: number) => {
        ctx.save();
        ctx.translate(offsetX, -56);
        ctx.rotate(angle);
        drawRoundRect(ctx, -4.5, 0, 9, 22, 4.5);
        ctx.fillStyle = sleeveColor;
        ctx.fill();
        ctx.stroke();
        // Hand
        ctx.beginPath();
        ctx.arc(0, 23, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = skinColor;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    };

    if (isFalling) {
        const flail = Math.sin(state.runPhase * 2.6) * 0.35;
        drawRunnerArm(-17, -Math.PI * 0.88 + flail);
        drawRunnerArm(17, Math.PI * 0.88 - flail);
    } else if (isFlipping) {
        drawRunnerArm(-16, 0.38);
        drawRunnerArm(16, -0.38);
    } else {
        drawRunnerArm(-17, -stride * 0.315);
        drawRunnerArm(17, stride * 0.315);
    }

    // --- 3. TORSO / BACK OF OUTFIT ---
    if (clothing === 'dress' || bottoms === 'skirt') {
        ctx.beginPath();
        ctx.moveTo(-13, -34);
        ctx.lineTo(13, -34);
        ctx.lineTo(19, -18);
        ctx.lineTo(-19, -18);
        ctx.closePath();
        ctx.fillStyle = clothing === 'dress' ? topColor : bottomsColor;
        ctx.fill();
        ctx.stroke();
    }

    drawRoundRect(ctx, -15, -59, 30, 32, 9);
    ctx.fillStyle = topColor;
    ctx.fill();
    ctx.stroke();

    // Outfit back details (hoodie hood, jersey number, varsity stripe, etc.)
    if (clothing === 'hoodie') {
        drawRoundRect(ctx, -11, -60, 22, 11, 5);
        ctx.fillStyle = topShade;
        ctx.fill();
        ctx.stroke();
    } else if (clothing === 'jersey') {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('10', 0, -40);
    } else if (clothing === 'varsity') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-13, -33, 26, 4);
    } else if (clothing === 'kimono') {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-15, -39, 30, 6);
        ctx.strokeRect(-15, -39, 30, 6);
    }

    // Scarf / Backpack / Rocket Jet Thrusters
    if (accessory === 'scarf') {
        drawRoundRect(ctx, -12, -62, 24, 7, 3.5);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(2, -56);
        ctx.lineTo(10, -41 + stride * 3);
        ctx.lineTo(3, -40 + stride * 3);
        ctx.closePath();
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        ctx.stroke();
    }

    if (accessory === 'backpack') {
        drawRoundRect(ctx, -12, -55, 24, 23, 6);
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        ctx.stroke();
        drawRoundRect(ctx, -8, -44, 16, 9, 3);
        ctx.fillStyle = '#b91c1c';
        ctx.fill();
        ctx.stroke();
    }

    if (state.rocketActive) {
        drawRoundRect(ctx, -12, -55, 9, 21, 4);
        ctx.fillStyle = '#64748b';
        ctx.fill();
        ctx.stroke();
        drawRoundRect(ctx, 3, -55, 9, 21, 4);
        ctx.fillStyle = '#64748b';
        ctx.fill();
        ctx.stroke();

        const flameLen = 14 + Math.random() * 10;
        [-7.5, 7.5].forEach((fx) => {
            ctx.beginPath();
            ctx.moveTo(fx - 4, -34);
            ctx.lineTo(fx, -34 + flameLen);
            ctx.lineTo(fx + 4, -34);
            ctx.closePath();
            ctx.fillStyle = '#f97316';
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(fx - 2, -34);
            ctx.lineTo(fx, -34 + flameLen * 0.65);
            ctx.lineTo(fx + 2, -34);
            ctx.closePath();
            ctx.fillStyle = '#fde047';
            ctx.fill();
        });
    }

    // --- 4. HEAD, HAIR & BACK/TOP ACCESSORIES ---
    // Neck
    drawRoundRect(ctx, -5, -66, 10, 9, 3);
    ctx.fillStyle = skinColor;
    ctx.fill();
    ctx.stroke();

    // Ears
    ctx.beginPath();
    ctx.arc(-15, -76, 4.2, 0, Math.PI * 2);
    ctx.arc(15, -76, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = skinColor;
    ctx.fill();
    ctx.stroke();

    // Head base
    ctx.beginPath();
    ctx.arc(0, -78, 15.5, 0, Math.PI * 2);
    ctx.fillStyle = skinColor;
    ctx.fill();
    ctx.stroke();

    // Back-of-head hair coverage
    ctx.save();
    ctx.beginPath();
    if (hairStyle === 'long' || hairStyle === 'wavy' || hairStyle === 'braids') {
        drawRoundRect(ctx, -16.5, -94, 33, 36, 14);
    } else if (hairStyle === 'afro') {
        ctx.arc(0, -82, 20.5, 0, Math.PI * 2);
    } else if (hairStyle === 'mohawk') {
        drawRoundRect(ctx, -4, -101, 8, 22, 4);
    } else if (hairStyle === 'bob') {
        drawRoundRect(ctx, -16.5, -94, 33, 25, 13);
    } else {
        ctx.arc(0, -80, 15.8, Math.PI * 0.88, Math.PI * 2.12);
    }
    ctx.fillStyle = hairColor;
    ctx.fill();
    ctx.stroke();

    // Ponytail / Bun detail
    if (hairStyle === 'ponytail') {
        ctx.beginPath();
        ctx.ellipse(2, -72, 6, 11, 0.25, 0, Math.PI * 2);
        ctx.fillStyle = hairColor;
        ctx.fill();
        ctx.stroke();
    } else if (hairStyle === 'bun') {
        ctx.beginPath();
        ctx.arc(0, -96, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = hairColor;
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();

    // Top Accessories visible from 3rd-person view
    if (accessory === 'cap') {
        ctx.beginPath();
        ctx.arc(0, -83, 16, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.stroke();
        drawRoundRect(ctx, -14, -84, 28, 4.5, 2);
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        ctx.stroke();
    } else if (accessory === 'beanie') {
        ctx.beginPath();
        ctx.arc(0, -83, 16, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = '#0d9488';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -100, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.stroke();
    } else if (accessory === 'crown') {
        ctx.beginPath();
        ctx.moveTo(-12, -91);
        ctx.lineTo(-10, -104);
        ctx.lineTo(-4, -96);
        ctx.lineTo(0, -107);
        ctx.lineTo(4, -96);
        ctx.lineTo(10, -104);
        ctx.lineTo(12, -91);
        ctx.closePath();
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.stroke();
    } else if (accessory === 'halo') {
        ctx.beginPath();
        ctx.ellipse(0, -104, 13, 3.5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.4;
    } else if (accessory === 'headphones') {
        ctx.beginPath();
        ctx.arc(0, -79, 17.5, Math.PI, 0);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = '#000000';
        drawRoundRect(ctx, -19, -84, 6, 13, 3);
        ctx.fillStyle = '#4f46e5';
        ctx.fill();
        ctx.stroke();
        drawRoundRect(ctx, 13, -84, 6, 13, 3);
        ctx.fillStyle = '#4f46e5';
        ctx.fill();
        ctx.stroke();
    } else if (accessory === 'wizard_hat') {
        ctx.beginPath();
        ctx.ellipse(0, -90, 21, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#3b0764';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-13, -90);
        ctx.lineTo(0, -118);
        ctx.lineTo(13, -90);
        ctx.closePath();
        ctx.fillStyle = '#134e4a';
        ctx.fill();
        ctx.stroke();
    } else if (accessory === 'cat_ears') {
        ctx.beginPath();
        ctx.moveTo(-14, -89);
        ctx.lineTo(-12, -104);
        ctx.lineTo(-4, -93);
        ctx.closePath();
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(14, -89);
        ctx.lineTo(12, -104);
        ctx.lineTo(4, -93);
        ctx.closePath();
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.stroke();
    } else if (accessory === 'bandana') {
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(-15.5, -88, 31, 6);
        ctx.strokeRect(-15.5, -88, 31, 6);
        ctx.beginPath();
        ctx.moveTo(0, -85);
        ctx.lineTo(10, -76);
        ctx.lineTo(4, -73);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (accessory === 'flower_crown') {
        [-10, 0, 10].forEach((fx, i) => {
            ctx.beginPath();
            ctx.arc(fx, -92, 4, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? '#f472b6' : i === 1 ? '#fde047' : '#a78bfa';
            ctx.fill();
            ctx.stroke();
        });
    }

    // Panic '!' Neo-Brutalist badge when plummeting into void
    if (isFalling) {
        drawRoundRect(ctx, -10, -126, 20, 18, 4);
        ctx.fillStyle = '#fb7185';
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.font = '900 13px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, -116.5);
    }

    ctx.restore();
}
