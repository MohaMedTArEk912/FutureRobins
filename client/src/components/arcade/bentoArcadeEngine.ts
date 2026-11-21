import {
    computeBentoRunLevel,
    type BentoGameMode,
    type BentoHudSnapshot,
    type BentoPowerupKind
} from './bentoArcadeTypes';
import { bentoArcadeAudio } from './bentoArcadeAudio';

export interface BentoArcadeCallbacks {
    onHudUpdate: (hud: BentoHudSnapshot) => void;
    onGameOver: (hud: BentoHudSnapshot) => void;
}

const PAPER_BG = '#f5f3ec';
const INK_BLACK = '#000000';
const WHITE = '#ffffff';
const LIME = '#bef264';
const YELLOW = '#fde047';
const SKY = '#bae6fd';
const PEACH = '#fed7aa';
const CORAL = '#fb7185';
const CORAL_SOFT = '#fda4af';

// --- BENTO SMASH ENTITIES ---
interface SmashBrick {
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    hp: number;
    maxHp: number;
    color: string;
    glyph: 'bars' | 'badge' | 'xp' | 'plain';
    hitFlashMs: number;
}

interface SmashBall {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    attached: boolean;
}

interface SmashPowerup {
    id: number;
    x: number;
    y: number;
    vy: number;
    w: number;
    h: number;
    kind: BentoPowerupKind;
}

// --- PAPER DASH ENTITIES ---
interface DashPlatform {
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    hasSpring: boolean;
    springX: number; // relative to platform x
}

interface DashObstacle {
    id: number;
    x: number;
    y: number;
    size: number;
    aerial: boolean;
    smashed: boolean;
}

interface DashCoin {
    id: number;
    x: number;
    y: number;
    size: number;
    kind: 'coin' | 'shield';
    collected: boolean;
}

// --- SHARED FX ---
interface BentoParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rot: number;
    vRot: number;
    life: number;
    maxLife: number;
}

interface BentoPopup {
    x: number;
    y: number;
    text: string;
    bg: string;
    life: number;
    maxLife: number;
}

function drawRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawBrutalBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    shadowOffset = 4,
    borderWidth = 2.5
) {
    // Hard solid offset shadow
    if (shadowOffset > 0) {
        drawRoundedRectPath(ctx, x + shadowOffset, y + shadowOffset, w, h, r);
        ctx.fillStyle = INK_BLACK;
        ctx.fill();
    }
    // Main flat fill + crisp black border
    drawRoundedRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = INK_BLACK;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
}

export class BentoArcadeEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private callbacks: BentoArcadeCallbacks;
    private dotPattern: CanvasPattern | null = null;
    private dotPatternDpr = 0;
    private canvasTopOffset = 0;

    private rafId: number | null = null;
    private lastFrameTime = 0;
    private width = 800;
    private height = 600;
    private dpr = 1;
    private bottomControlInset = 0;

    // Lifecycle
    private mode: BentoGameMode = 'smash';
    private status: 'menu' | 'playing' | 'paused' | 'gameover' = 'menu';
    private pauseReason: 'manual' | 'resize' | 'blur' | null = null;
    private deathReason: 'lives' | 'fall' | 'obstacle' | null = null;

    // Shared Score, XP, Level, FX
    private score = 0;
    private elapsedMs = 0;
    private runXp = 0;
    private runLevel = 1;
    private comboCount = 0;
    private comboTimerMs = 0;
    private levelUpNotice: { level: number; timestamp: number } | null = null;
    private particles: BentoParticle[] = [];
    private popups: BentoPopup[] = [];
    private shakeMs = 0;
    private shakeMag = 0;
    private nextId = 1;
    private lastHudEmitMs = 0;

    // --- SMASH STATE ---
    private arenaX = 20;
    private arenaY = 16;
    private arenaW = 760;
    private arenaH = 540;
    private paddleX = 340;
    private paddleY = 500;
    private paddleBaseW = 128;
    private paddleW = 128;
    private paddleH = 18;
    private paddleMoveLeft = false;
    private paddleMoveRight = false;
    private smashBalls: SmashBall[] = [];
    private smashBricks: SmashBrick[] = [];
    private smashPowerups: SmashPowerup[] = [];
    private smashWave = 1;
    private smashLives = 3;
    private wideBuffMs = 0;
    private heavyBuffMs = 0;
    private smashRowDriftDir = 1;

    // --- DASH STATE ---
    private dashScrollX = 0;
    private dashSpeed = 300;
    private dashDistancePx = 0;
    private dashLastMilestoneMeters = 0;
    private dashCoinsCollected = 0;
    private dashHasShield = false;
    private mascotX = 130;
    private mascotY = 260;
    private mascotVy = 0;
    private mascotSize = 40;
    private mascotOnGround = false;
    private mascotJumpsLeft = 2;
    private mascotSquashX = 1;
    private mascotSquashY = 1;
    private mascotSlamming = false;
    private dashPlatforms: DashPlatform[] = [];
    private dashObstacles: DashObstacle[] = [];
    private dashCoins: DashCoin[] = [];
    private dashSpawnEdgeX = 0;

    constructor(canvas: HTMLCanvasElement, callbacks: BentoArcadeCallbacks) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Failed to acquire 2D canvas context');
        this.ctx = ctx;
        this.callbacks = callbacks;

        this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, 0);
    }

    public startLoop() {
        if (this.rafId !== null) return;
        this.lastFrameTime = performance.now();
        const tick = (now: number) => {
            const rawDt = now - this.lastFrameTime;
            this.lastFrameTime = now;
            const dt = Math.min(40, Math.max(0, rawDt));

            this.update(dt, now);
            this.render(now);

            this.rafId = window.requestAnimationFrame(tick);
        };
        this.rafId = window.requestAnimationFrame(tick);
    }

    public destroy() {
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    public resize(cssW: number, cssH: number, bottomControlInset = 0) {
        const w = Math.max(280, Math.floor(cssW));
        const h = Math.max(280, Math.floor(cssH));
        const prevW = this.width;
        const prevH = this.height;

        this.width = w;
        this.height = h;
        this.bottomControlInset = Math.max(0, bottomControlInset);
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        this.canvas.width = Math.floor(w * this.dpr);
        this.canvas.height = Math.floor(h * this.dpr);
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;

        this.canvasTopOffset = this.canvas.parentElement?.offsetTop || 0;
        this.ensureDotPattern();
        this.computeSmashArenaLayout();

        const bigShift = Math.abs(prevW - w) > 64 || Math.abs(prevH - h) > 96;
        if (this.status === 'playing' && this.elapsedMs > 600 && bigShift) {
            this.pause('resize');
        }
    }

    private computeSmashArenaLayout() {
        const isNarrow = this.width < 560;
        const padX = isNarrow ? 10 : 28;
        const padTop = isNarrow ? 10 : 20;
        // Leave clean breathing room at bottom so the 6px black border/shadow and thumb drag space
        // are NEVER clipped by iOS Safari's bottom toolbar or home indicator.
        const padBottom = isNarrow
            ? (this.mode === 'dash' ? 12 + this.bottomControlInset : 22)
            : (22 + (this.mode === 'dash' ? this.bottomControlInset : 0));

        // Reserve 6px extra width/height for the Neo-Brutalist offset shadow so all 4 edges stay inside screen
        const maxArenaW = Math.min(880, this.width - padX * 2 - 6);
        const maxArenaH = Math.max(260, this.height - padTop - padBottom - 6);

        this.arenaW = Math.max(250, Math.floor(maxArenaW));
        this.arenaH = Math.floor(maxArenaH);
        this.arenaX = Math.max(8, Math.floor((this.width - this.arenaW - 4) / 2));
        this.arenaY = Math.floor(padTop);

        this.paddleBaseW = isNarrow
            ? Math.max(84, Math.min(126, Math.round(this.arenaW * 0.25)))
            : Math.max(88, Math.min(138, Math.round(this.arenaW * 0.18)));
        this.paddleW = this.wideBuffMs > 0 ? Math.min(this.arenaW * 0.42, this.paddleBaseW * 1.45) : this.paddleBaseW;
        this.paddleH = isNarrow ? 16 : 19;
        // Keep the paddle slightly elevated on mobile so thumbs can slide beneath it comfortably
        this.paddleY = this.arenaY + this.arenaH - (isNarrow ? 44 : 38);
        this.paddleX = Math.max(
            this.arenaX + 10,
            Math.min(this.arenaX + this.arenaW - this.paddleW - 10, this.paddleX)
        );
    }

    public setMenuMode() {
        this.status = 'menu';
        this.pauseReason = null;
        this.deathReason = null;
        this.paddleMoveLeft = false;
        this.paddleMoveRight = false;
        this.emitHud(true);
    }

    public startRun(mode: BentoGameMode) {
        this.mode = mode;
        this.status = 'playing';
        this.pauseReason = null;
        this.deathReason = null;
        this.score = 0;
        this.elapsedMs = 0;
        this.runXp = 0;
        this.runLevel = 1;
        this.comboCount = 0;
        this.comboTimerMs = 0;
        this.levelUpNotice = null;
        this.particles = [];
        this.popups = [];
        this.shakeMs = 0;
        this.paddleMoveLeft = false;
        this.paddleMoveRight = false;

        this.computeSmashArenaLayout();

        if (mode === 'smash') {
            this.initSmashRun();
        } else {
            this.initDashRun();
        }

        bentoArcadeAudio.playStart();
        this.emitHud(true);
    }

    public pause(reason: 'manual' | 'resize' | 'blur' = 'manual') {
        if (this.status !== 'playing') return;
        this.status = 'paused';
        this.pauseReason = reason;
        this.paddleMoveLeft = false;
        this.paddleMoveRight = false;
        this.emitHud(true);
    }

    public resume() {
        if (this.status !== 'paused') return;
        this.computeSmashArenaLayout();
        if (this.mode === 'smash') {
            this.paddleX = Math.max(
                this.arenaX + 10,
                Math.min(this.arenaX + this.arenaW - this.paddleW - 10, this.paddleX)
            );
        }
        this.status = 'playing';
        this.pauseReason = null;
        this.lastFrameTime = performance.now();
        this.emitHud(true);
    }

    // --- INPUT CONTROLS ---

    public setPaddleKeys(left: boolean, right: boolean) {
        this.paddleMoveLeft = left;
        this.paddleMoveRight = right;
    }

    public setPaddlePointerX(canvasClientX: number) {
        if (this.status !== 'playing' || this.mode !== 'smash') return;
        const target = canvasClientX - this.paddleW / 2;
        this.paddleX = Math.max(
            this.arenaX + 10,
            Math.min(this.arenaX + this.arenaW - this.paddleW - 10, target)
        );
    }

    public launchSmashBall() {
        if (this.status !== 'playing' || this.mode !== 'smash') return;
        let launched = false;
        const speed = this.getSmashBallSpeed();
        for (const ball of this.smashBalls) {
            if (ball.attached) {
                ball.attached = false;
                const spread = (Math.random() - 0.5) * 0.5;
                ball.vx = Math.sin(spread) * speed;
                ball.vy = -Math.cos(spread) * speed;
                launched = true;
            }
        }
        if (launched) {
            bentoArcadeAudio.playPaddleBounce();
            this.emitHud(true);
        }
    }

    public triggerDashJump() {
        if (this.status !== 'playing' || this.mode !== 'dash') return;
        if (this.mascotJumpsLeft <= 0) return;

        const isDouble = !this.mascotOnGround;
        this.mascotVy = isDouble ? -590 : -650;
        this.mascotOnGround = false;
        this.mascotSlamming = false;
        this.mascotJumpsLeft -= 1;
        this.mascotSquashX = 0.78;
        this.mascotSquashY = 1.28;

        bentoArcadeAudio.playJump(isDouble);
        this.spawnParticles(
            this.mascotX + this.mascotSize / 2,
            this.mascotY + this.mascotSize,
            isDouble ? SKY : WHITE,
            isDouble ? 8 : 5
        );
    }

    public triggerDashSlam() {
        if (this.status !== 'playing' || this.mode !== 'dash') return;
        if (this.mascotOnGround || this.mascotSlamming) return;
        this.mascotSlamming = true;
        this.mascotVy = Math.max(this.mascotVy, 860);
        this.mascotSquashX = 0.72;
        this.mascotSquashY = 1.35;
        bentoArcadeAudio.playSlam();
    }

    public getSnapshot(): BentoHudSnapshot {
        const prog = computeBentoRunLevel(this.runXp);
        return {
            mode: this.mode,
            status: this.status,
            score: Math.floor(this.score),
            elapsedSeconds: Math.floor(this.elapsedMs / 1000),
            runXp: Math.floor(this.runXp),
            runLevel: prog.level,
            runLevelXp: prog.currentLevelXp,
            runLevelNextXp: prog.nextLevelXp,
            wave: this.smashWave,
            lives: this.smashLives,
            bricksRemaining: this.smashBricks.length,
            waitingForLaunch: this.smashBalls.some((b) => b.attached),
            activeBuffs: {
                wideSec: Math.ceil(this.wideBuffMs / 1000),
                heavySec: Math.ceil(this.heavyBuffMs / 1000)
            },
            distanceMeters: Math.floor(this.dashDistancePx / 18),
            coinsCollected: this.dashCoinsCollected,
            hasShield: this.dashHasShield,
            speedMultiplier: Number((this.dashSpeed / 300).toFixed(1)),
            comboCount: this.comboCount,
            comboMultiplier: this.getComboMultiplier(this.comboCount),
            levelUpNotice: this.levelUpNotice,
            deathReason: this.deathReason,
            pauseReason: this.pauseReason
        };
    }

    private emitHud(force = false) {
        const now = performance.now();
        if (!force && now - this.lastHudEmitMs < 85) return;
        this.lastHudEmitMs = now;
        this.callbacks.onHudUpdate(this.getSnapshot());
    }

    private getComboMultiplier(count: number): number {
        if (count >= 8) return 3;
        if (count >= 5) return 2.5;
        if (count >= 3) return 2;
        if (count >= 2) return 1.5;
        return 1;
    }

    private awardXp(amount: number, x: number, y: number, labelPrefix?: string, badgeBg = LIME) {
        if (amount <= 0) return;
        const prevLv = this.runLevel;
        this.runXp += amount;
        const prog = computeBentoRunLevel(this.runXp);

        const text = labelPrefix ? `${labelPrefix} +${Math.round(amount)} XP` : `+${Math.round(amount)} XP`;
        this.popups.push({
            x,
            y,
            text,
            bg: badgeBg,
            life: 0,
            maxLife: 850
        });

        if (prog.level > prevLv) {
            this.runLevel = prog.level;
            this.levelUpNotice = { level: this.runLevel, timestamp: performance.now() };
            bentoArcadeAudio.playLevelUp();
            this.spawnParticles(x, y, YELLOW, 14);
        }
    }

    private spawnParticles(x: number, y: number, color: string, count = 8) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 70 + Math.random() * 190;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                size: 5 + Math.random() * 6,
                color,
                rot: Math.random() * Math.PI,
                vRot: (Math.random() - 0.5) * 10,
                life: 0,
                maxLife: 380 + Math.random() * 260
            });
        }
    }

    private triggerShake(ms: number, mag: number) {
        this.shakeMs = Math.max(this.shakeMs, ms);
        this.shakeMag = Math.max(this.shakeMag, mag);
    }

    // =========================================================================
    // MODE 1: 02 BENTO SMASH (STICKER-SLAM BRICK BREAKER)
    // =========================================================================

    private initSmashRun() {
        this.smashWave = 1;
        this.smashLives = 3;
        this.wideBuffMs = 0;
        this.heavyBuffMs = 0;
        this.smashPowerups = [];
        this.paddleW = this.paddleBaseW;
        this.paddleX = this.arenaX + (this.arenaW - this.paddleW) / 2;
        this.resetSmashBallOnPaddle();
        this.buildSmashWave(1);
    }

    private getSmashBallSpeed(): number {
        const base = this.width < 560 ? 370 : 450;
        return Math.min(680, base + (this.smashWave - 1) * 28 + (this.runLevel - 1) * 10);
    }

    private resetSmashBallOnPaddle() {
        const r = this.width < 560 ? 9 : 11;
        this.smashBalls = [
            {
                x: this.paddleX + this.paddleW / 2,
                y: this.paddleY - r - 3,
                vx: 0,
                vy: 0,
                r,
                attached: true
            }
        ];
    }

    private buildSmashWave(wave: number) {
        this.smashBricks = [];
        const cols = this.arenaW < 420 ? 5 : this.arenaW < 640 ? 6 : 8;
        const rows = Math.min(6, 3 + Math.floor((wave + 1) / 2));
        const padX = this.arenaW < 420 ? 12 : 20;
        const gap = this.arenaW < 420 ? 7 : 10;
        const brickW = Math.floor((this.arenaW - padX * 2 - gap * (cols - 1)) / cols);
        const brickH = this.arenaH < 440 ? 24 : 30;
        const startX = this.arenaX + Math.floor((this.arenaW - (brickW * cols + gap * (cols - 1))) / 2);
        const startY = this.arenaY + (this.arenaH < 440 ? 18 : 26);

        const palette = [SKY, LIME, YELLOW, PEACH, WHITE];
        const pattern = (wave - 1) % 4; // 0=full, 1=checker/arch, 2=twin towers, 3=fortress

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Skip decorative gaps on non-full wave patterns
                if (pattern === 1 && r === rows - 1 && (c === 0 || c === cols - 1)) continue;
                if (pattern === 2 && (c === Math.floor(cols / 2) || (cols % 2 === 0 && c === cols / 2 - 1)) && r > 0) {
                    continue;
                }
                if (pattern === 3 && (r + c) % 2 === 1 && r === rows - 1) continue;

                const isArmored = (r === 0 && wave >= 2) || (r === 1 && c % 3 === 1 && wave >= 3) || (r === 0 && c === Math.floor(cols / 2));
                const isXpVault = !isArmored && ((r + c + wave) % 7 === 0);

                let color = palette[(r * 2 + c) % palette.length];
                let glyph: SmashBrick['glyph'] = c % 2 === 0 ? 'bars' : 'plain';
                let hp = 1;

                if (isArmored) {
                    color = CORAL_SOFT;
                    glyph = 'badge';
                    hp = 2;
                } else if (isXpVault) {
                    color = YELLOW;
                    glyph = 'xp';
                    hp = 1;
                }

                this.smashBricks.push({
                    id: this.nextId++,
                    x: startX + c * (brickW + gap),
                    y: startY + r * (brickH + gap),
                    w: brickW,
                    h: brickH,
                    hp,
                    maxHp: hp,
                    color,
                    glyph,
                    hitFlashMs: 0
                });
            }
        }
    }

    private updateSmash(dt: number) {
        const dtSec = dt / 1000;

        // Buff timers
        if (this.wideBuffMs > 0) {
            this.wideBuffMs = Math.max(0, this.wideBuffMs - dt);
            const targetW = this.wideBuffMs > 0 ? Math.min(this.arenaW * 0.36, this.paddleBaseW * 1.45) : this.paddleBaseW;
            const diff = targetW - this.paddleW;
            this.paddleW = targetW;
            this.paddleX = Math.max(
                this.arenaX + 10,
                Math.min(this.arenaX + this.arenaW - this.paddleW - 10, this.paddleX - diff / 2)
            );
        }
        if (this.heavyBuffMs > 0) {
            this.heavyBuffMs = Math.max(0, this.heavyBuffMs - dt);
        }

        // Keyboard paddle movement
        const paddleSpeed = Math.max(460, this.arenaW * 0.85);
        if (this.paddleMoveLeft) {
            this.paddleX -= paddleSpeed * dtSec;
        }
        if (this.paddleMoveRight) {
            this.paddleX += paddleSpeed * dtSec;
        }
        this.paddleX = Math.max(
            this.arenaX + 10,
            Math.min(this.arenaX + this.arenaW - this.paddleW - 10, this.paddleX)
        );

        // Gentle horizontal wave drift on Wave 4+
        if (this.smashWave >= 4 && this.smashBricks.length > 0) {
            const drift = 24 * dtSec * this.smashRowDriftDir;
            let hitWall = false;
            for (const b of this.smashBricks) {
                b.x += drift;
                if (b.x <= this.arenaX + 10 || b.x + b.w >= this.arenaX + this.arenaW - 10) {
                    hitWall = true;
                }
            }
            if (hitWall) this.smashRowDriftDir *= -1;
        }

        for (const b of this.smashBricks) {
            if (b.hitFlashMs > 0) b.hitFlashMs = Math.max(0, b.hitFlashMs - dt);
        }

        // Update falling sticker powerups
        const nextPowerups: SmashPowerup[] = [];
        for (const p of this.smashPowerups) {
            p.y += p.vy * dtSec;
            // Paddle catch check
            const caught =
                p.x + p.w >= this.paddleX &&
                p.x <= this.paddleX + this.paddleW &&
                p.y + p.h >= this.paddleY &&
                p.y <= this.paddleY + this.paddleH + 8;

            if (caught) {
                this.applySmashPowerup(p);
                continue;
            }
            if (p.y < this.arenaY + this.arenaH + 20) {
                nextPowerups.push(p);
            }
        }
        this.smashPowerups = nextPowerups;

        // Update balls
        const survivingBalls: SmashBall[] = [];
        for (const ball of this.smashBalls) {
            if (ball.attached) {
                ball.x = this.paddleX + this.paddleW / 2;
                ball.y = this.paddleY - ball.r - 3;
                survivingBalls.push(ball);
                continue;
            }

            ball.x += ball.vx * dtSec;
            ball.y += ball.vy * dtSec;

            // Wall bounces
            if (ball.x - ball.r <= this.arenaX + 4) {
                ball.x = this.arenaX + 4 + ball.r;
                ball.vx = Math.abs(ball.vx);
                bentoArcadeAudio.playBrickHit();
            } else if (ball.x + ball.r >= this.arenaX + this.arenaW - 4) {
                ball.x = this.arenaX + this.arenaW - 4 - ball.r;
                ball.vx = -Math.abs(ball.vx);
                bentoArcadeAudio.playBrickHit();
            }

            if (ball.y - ball.r <= this.arenaY + 4) {
                ball.y = this.arenaY + 4 + ball.r;
                ball.vy = Math.abs(ball.vy);
                bentoArcadeAudio.playBrickHit();
            }

            // Paddle bounce
            if (
                ball.vy > 0 &&
                ball.y + ball.r >= this.paddleY &&
                ball.y - ball.r <= this.paddleY + this.paddleH &&
                ball.x + ball.r >= this.paddleX &&
                ball.x - ball.r <= this.paddleX + this.paddleW
            ) {
                const hitOffset = ((ball.x - (this.paddleX + this.paddleW / 2)) / (this.paddleW / 2));
                const clamped = Math.max(-0.88, Math.min(0.88, hitOffset));
                const speed = this.getSmashBallSpeed();
                const bounceAngle = clamped * (Math.PI * 0.37); // max ~66 deg
                ball.vx = Math.sin(bounceAngle) * speed;
                ball.vy = -Math.abs(Math.cos(bounceAngle) * speed);
                ball.y = this.paddleY - ball.r - 1;

                // Reset streak combo when ball returns to paddle
                this.comboCount = 0;
                bentoArcadeAudio.playPaddleBounce();
                this.spawnParticles(ball.x, this.paddleY, LIME, 4);
            }

            // Brick collisions
            for (let i = this.smashBricks.length - 1; i >= 0; i--) {
                const brick = this.smashBricks[i];
                const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
                const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
                const dx = ball.x - closestX;
                const dy = ball.y - closestY;

                if (dx * dx + dy * dy <= ball.r * ball.r) {
                    const isHeavy = this.heavyBuffMs > 0;
                    // Reflect unless heavy ball rips through 1-HP brick!
                    if (!(isHeavy && brick.hp <= 1)) {
                        const overlapLeft = ball.x + ball.r - brick.x;
                        const overlapRight = brick.x + brick.w - (ball.x - ball.r);
                        const overlapTop = ball.y + ball.r - brick.y;
                        const overlapBottom = brick.y + brick.h - (ball.y - ball.r);
                        const minOverlapX = Math.min(overlapLeft, overlapRight);
                        const minOverlapY = Math.min(overlapTop, overlapBottom);
                        if (minOverlapX < minOverlapY) {
                            ball.vx = -ball.vx;
                        } else {
                            ball.vy = -ball.vy;
                        }
                        // Prevent nearly flat infinite horizontal traps
                        if (Math.abs(ball.vy) < 90) {
                            ball.vy = ball.vy >= 0 ? 120 : -120;
                        }
                    }

                    brick.hp -= isHeavy ? 2 : 1;
                    brick.hitFlashMs = 110;

                    if (brick.hp <= 0) {
                        this.smashBricks.splice(i, 1);
                        this.comboCount += 1;
                        const mult = this.getComboMultiplier(this.comboCount);
                        const baseScore = brick.maxHp > 1 ? 80 : brick.glyph === 'xp' ? 95 : 40;
                        const baseXp = brick.glyph === 'xp' ? 26 : brick.maxHp > 1 ? 18 : 10;

                        this.score += Math.round(baseScore * mult);
                        this.awardXp(
                            Math.round(baseXp * mult),
                            brick.x + brick.w / 2,
                            brick.y + brick.h / 2,
                            mult > 1 ? `×${mult}` : undefined,
                            brick.glyph === 'xp' ? YELLOW : LIME
                        );
                        bentoArcadeAudio.playBrickBreak(this.comboCount);
                        this.spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 9);
                        this.triggerShake(90, 3.5);

                        // Chance to drop a Bento sticker capsule
                        const dropChance = brick.glyph === 'xp' ? 0.55 : brick.maxHp > 1 ? 0.36 : 0.16;
                        if (Math.random() < dropChance) {
                            this.spawnSmashPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2);
                        }
                    } else {
                        bentoArcadeAudio.playBrickHit();
                        this.spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, WHITE, 4);
                    }
                    break;
                }
            }

            // Bottom out check
            if (ball.y - ball.r <= this.arenaY + this.arenaH + 14) {
                survivingBalls.push(ball);
            }
        }

        this.smashBalls = survivingBalls;

        // Lost all balls -> lose a life
        if (this.smashBalls.length === 0) {
            this.smashLives -= 1;
            this.comboCount = 0;
            this.triggerShake(200, 7);
            if (this.smashLives <= 0) {
                this.triggerGameOver('lives');
                return;
            }
            bentoArcadeAudio.playLifeLost();
            this.resetSmashBallOnPaddle();
            this.emitHud(true);
            return;
        }

        // Wave cleared!
        if (this.smashBricks.length === 0) {
            this.smashWave += 1;
            this.score += 250 * this.smashWave;
            bentoArcadeAudio.playWaveClear();
            this.awardXp(
                100,
                this.arenaX + this.arenaW / 2,
                this.arenaY + this.arenaH * 0.4,
                `WAVE ${this.smashWave - 1} CLEAR`,
                YELLOW
            );
            this.smashPowerups = [];
            this.buildSmashWave(this.smashWave);
            this.resetSmashBallOnPaddle();
            this.emitHud(true);
        }
    }

    private spawnSmashPowerup(cx: number, cy: number) {
        const roll = Math.random();
        let kind: BentoPowerupKind = 'xp';
        if (roll < 0.32) kind = 'xp';
        else if (roll < 0.58) kind = 'wide';
        else if (roll < 0.82) kind = 'multi';
        else kind = 'heavy';

        const w = 54;
        const h = 24;
        this.smashPowerups.push({
            id: this.nextId++,
            x: cx - w / 2,
            y: cy - h / 2,
            vy: 155,
            w,
            h,
            kind
        });
    }

    private applySmashPowerup(p: SmashPowerup) {
        bentoArcadeAudio.playPowerup();
        const cx = p.x + p.w / 2;
        const cy = this.paddleY - 12;

        if (p.kind === 'xp') {
            this.score += 120;
            this.awardXp(45, cx, cy, 'BONUS', LIME);
        } else if (p.kind === 'wide') {
            this.wideBuffMs = 12000;
            this.popups.push({ x: cx, y: cy, text: 'WIDE PADDLE!', bg: SKY, life: 0, maxLife: 900 });
        } else if (p.kind === 'heavy') {
            this.heavyBuffMs = 7000;
            this.popups.push({ x: cx, y: cy, text: 'SMASH BALL!', bg: PEACH, life: 0, maxLife: 900 });
        } else if (p.kind === 'multi') {
            const source = this.smashBalls.find((b) => !b.attached) || this.smashBalls[0];
            if (source && this.smashBalls.length < 4) {
                const speed = this.getSmashBallSpeed();
                const baseAngle = Math.atan2(source.vy || -speed, source.vx || 100);
                [-0.35, 0.35].forEach((offset) => {
                    if (this.smashBalls.length >= 4) return;
                    const a = baseAngle + offset;
                    this.smashBalls.push({
                        x: source.x,
                        y: source.y,
                        vx: Math.cos(a) * speed,
                        vy: Math.min(-140, Math.sin(a) * speed),
                        r: source.r,
                        attached: false
                    });
                });
            }
            this.popups.push({ x: cx, y: cy, text: 'MULTI-BALL!', bg: YELLOW, life: 0, maxLife: 900 });
        }
        this.spawnParticles(cx, this.paddleY, YELLOW, 10);
    }

    // =========================================================================
    // MODE 2: 04 PAPER DASH (BENTO CARD ENDLESS RUNNER)
    // =========================================================================

    private initDashRun() {
        const isPhone = this.width < 520;
        this.dashScrollX = 0;
        this.dashSpeed = isPhone ? 240 : this.width < 768 ? 275 : 320;
        this.dashDistancePx = 0;
        this.dashLastMilestoneMeters = 0;
        this.dashCoinsCollected = 0;
        this.dashHasShield = false;
        this.mascotSize = isPhone ? 32 : this.width < 768 ? 36 : 42;
        this.mascotX = Math.max(52, Math.min(165, Math.floor(this.width * 0.2)));

        const playHeight = Math.max(260, this.height - this.bottomControlInset);
        const startGroundY = Math.floor(playHeight * 0.68);
        this.mascotY = startGroundY - this.mascotSize;
        this.mascotVy = 0;
        this.mascotOnGround = true;
        this.mascotJumpsLeft = 2;
        this.mascotSquashX = 1;
        this.mascotSquashY = 1;
        this.mascotSlamming = false;

        this.dashPlatforms = [
            {
                id: this.nextId++,
                x: 20,
                y: startGroundY,
                w: Math.max(isPhone ? 280 : 360, Math.floor(this.width * 0.68)),
                h: 26,
                color: WHITE,
                hasSpring: false,
                springX: 0
            }
        ];
        this.dashObstacles = [];
        this.dashCoins = [];
        this.dashSpawnEdgeX = this.dashPlatforms[0].x + this.dashPlatforms[0].w;

        // Pre-populate upcoming cards across screen
        while (this.dashSpawnEdgeX < this.width + 480) {
            this.spawnNextDashSegment();
        }
    }

    private spawnNextDashSegment() {
        const playHeight = Math.max(300, this.height - this.bottomControlInset);
        const minY = Math.floor(playHeight * 0.34);
        const maxY = Math.floor(playHeight * 0.78);
        const lastPlat = this.dashPlatforms[this.dashPlatforms.length - 1];
        const prevY = lastPlat ? lastPlat.y : Math.floor(playHeight * 0.68);

        // Guaranteed fair jumpable horizontal gap scaled with current speed
        const speedFactor = this.dashSpeed / 300;
        const gap = Math.floor((68 + Math.random() * 88) * Math.min(1.45, speedFactor));
        const deltaY = Math.floor((Math.random() * 2 - 1) * 95);
        const nextY = Math.max(minY, Math.min(maxY, prevY + deltaY));
        const platW = Math.floor(135 + Math.random() * 190);
        const platColors = [WHITE, SKY, WHITE, PEACH, YELLOW];
        const color = platColors[Math.floor(Math.random() * platColors.length)];

        const platX = this.dashSpawnEdgeX + gap;
        const hasSpring = platW >= 170 && Math.random() < 0.2;
        const springX = hasSpring ? platW - 58 : 0;

        this.dashPlatforms.push({
            id: this.nextId++,
            x: platX,
            y: nextY,
            w: platW,
            h: 24,
            color,
            hasSpring,
            springX
        });

        // Coin arc across the gap between platforms!
        if (Math.random() < 0.72) {
            const coinCount = 3;
            const arcTopY = Math.min(prevY, nextY) - 66;
            for (let i = 0; i < coinCount; i++) {
                const t = (i + 1) / (coinCount + 1);
                const cx = this.dashSpawnEdgeX + gap * t;
                const arch = Math.sin(t * Math.PI);
                const cy = Math.min(prevY, nextY) - 26 - arch * 54;
                this.dashCoins.push({
                    id: this.nextId++,
                    x: cx,
                    y: Math.max(46, Math.min(arcTopY + 34, cy)),
                    size: 18,
                    kind: 'coin',
                    collected: false
                });
            }
        }

        // Place coral '!' obstacle on spacious platforms (never crowding edges or spring!)
        const distMeters = this.dashDistancePx / 18;
        const obsChance = Math.min(0.68, 0.34 + distMeters * 0.0012);
        if (platW >= 190 && !hasSpring && Math.random() < obsChance) {
            const obsSize = this.width < 560 ? 30 : 36;
            const obsX = platX + Math.floor(platW * 0.45 + (Math.random() - 0.5) * (platW * 0.25));
            this.dashObstacles.push({
                id: this.nextId++,
                x: obsX,
                y: nextY - obsSize,
                size: obsSize,
                aerial: false,
                smashed: false
            });
            // Rewarding high coin right over the obstacle!
            this.dashCoins.push({
                id: this.nextId++,
                x: obsX + obsSize / 2,
                y: nextY - obsSize - 46,
                size: 18,
                kind: 'coin',
                collected: false
            });
        } else if (platW >= 150) {
            // Line of XP coins or occasional Shield sticker on platform
            const spawnShield = !this.dashHasShield && distMeters > 45 && Math.random() < 0.12;
            if (spawnShield) {
                this.dashCoins.push({
                    id: this.nextId++,
                    x: platX + platW * 0.5,
                    y: nextY - 38,
                    size: 22,
                    kind: 'shield',
                    collected: false
                });
            } else {
                const count = Math.random() < 0.5 ? 2 : 3;
                for (let i = 0; i < count; i++) {
                    this.dashCoins.push({
                        id: this.nextId++,
                        x: platX + 44 + i * 34,
                        y: nextY - 30,
                        size: 18,
                        kind: 'coin',
                        collected: false
                    });
                }
            }
        }

        // Occasional aerial '!' drone at higher speeds (always avoidable!)
        if (distMeters > 90 && Math.random() < 0.22) {
            this.dashObstacles.push({
                id: this.nextId++,
                x: platX + platW * 0.65,
                y: Math.max(54, nextY - 122),
                size: 30,
                aerial: true,
                smashed: false
            });
        }

        this.dashSpawnEdgeX = platX + platW;
    }

    private updateDash(dt: number) {
        const dtSec = dt / 1000;

        // Gentle speed acceleration with distance + run level
        const distMeters = this.dashDistancePx / 18;
        const targetSpeed = Math.min(540, (this.width < 560 ? 275 : 320) + distMeters * 0.35 + (this.runLevel - 1) * 14);
        this.dashSpeed += (targetSpeed - this.dashSpeed) * Math.min(1, dtSec * 2.5);

        const moveDx = this.dashSpeed * dtSec;
        this.dashScrollX += moveDx;
        this.dashDistancePx += moveDx;
        this.score += moveDx * 0.15;

        // Combo decay window
        if (this.comboCount > 0) {
            this.comboTimerMs -= dt;
            if (this.comboTimerMs <= 0) {
                this.comboCount = 0;
            }
        }

        // Passive distance XP milestone every 25m
        const currentMeters = Math.floor(this.dashDistancePx / 18);
        if (currentMeters >= this.dashLastMilestoneMeters + 25) {
            this.dashLastMilestoneMeters = Math.floor(currentMeters / 25) * 25;
            this.awardXp(
                18 + Math.min(20, this.runLevel * 2),
                this.mascotX + this.mascotSize / 2,
                this.mascotY - 10,
                `${this.dashLastMilestoneMeters}M`,
                SKY
            );
        }

        // Shift world entities left
        this.dashSpawnEdgeX -= moveDx;
        for (const p of this.dashPlatforms) p.x -= moveDx;
        for (const o of this.dashObstacles) o.x -= moveDx;
        for (const c of this.dashCoins) c.x -= moveDx;

        // Cull passed entities & generate ahead
        this.dashPlatforms = this.dashPlatforms.filter((p) => p.x + p.w > -120);
        this.dashObstacles = this.dashObstacles.filter((o) => !o.smashed && o.x + o.size > -80);
        this.dashCoins = this.dashCoins.filter((c) => !c.collected && c.x + c.size > -80);
        while (this.dashSpawnEdgeX < this.width + 480) {
            this.spawnNextDashSegment();
        }

        // Mascot vertical physics
        const prevBottom = this.mascotY + this.mascotSize;
        const gravity = this.mascotSlamming ? 3200 : 1720;
        this.mascotVy += gravity * dtSec;
        this.mascotY += this.mascotVy * dtSec;
        this.mascotOnGround = false;

        // Smooth squash-and-stretch recovery
        this.mascotSquashX += (1 - this.mascotSquashX) * Math.min(1, dtSec * 14);
        this.mascotSquashY += (1 - this.mascotSquashY) * Math.min(1, dtSec * 14);

        // One-way platform landing collision
        const mLeft = this.mascotX + 4;
        const mRight = this.mascotX + this.mascotSize - 4;
        const mBottom = this.mascotY + this.mascotSize;

        if (this.mascotVy >= 0) {
            for (const p of this.dashPlatforms) {
                if (mRight > p.x && mLeft < p.x + p.w) {
                    if (prevBottom <= p.y + 10 && mBottom >= p.y) {
                        this.mascotY = p.y - this.mascotSize;
                        const wasSlamming = this.mascotSlamming;
                        this.mascotVy = 0;
                        this.mascotOnGround = true;
                        this.mascotJumpsLeft = 2;
                        this.mascotSlamming = false;

                        if (wasSlamming) {
                            this.mascotSquashX = 1.32;
                            this.mascotSquashY = 0.72;
                            this.triggerShake(90, 4);
                            this.spawnParticles(this.mascotX + this.mascotSize / 2, p.y, WHITE, 8);
                        } else if (prevBottom < p.y - 2) {
                            this.mascotSquashX = 1.18;
                            this.mascotSquashY = 0.84;
                        }

                        // Check spring launch strip
                        if (p.hasSpring) {
                            const sx = p.x + p.springX;
                            if (mRight >= sx && mLeft <= sx + 44) {
                                this.mascotVy = -820;
                                this.mascotOnGround = false;
                                this.mascotJumpsLeft = 2;
                                this.mascotSquashX = 0.7;
                                this.mascotSquashY = 1.38;
                                bentoArcadeAudio.playSpring();
                                this.spawnParticles(sx + 22, p.y, LIME, 10);
                                this.awardXp(15, sx + 22, p.y - 16, 'BOOST', LIME);
                            }
                        }
                        break;
                    }
                }
            }
        }

        // Coin & Shield pickups
        const mCx = this.mascotX + this.mascotSize / 2;
        const mCy = this.mascotY + this.mascotSize / 2;
        for (const c of this.dashCoins) {
            if (c.collected) continue;
            const dx = mCx - c.x;
            const dy = mCy - c.y;
            const hitR = this.mascotSize * 0.56 + c.size * 0.52;
            if (dx * dx + dy * dy <= hitR * hitR) {
                c.collected = true;
                if (c.kind === 'shield') {
                    this.dashHasShield = true;
                    bentoArcadeAudio.playPowerup();
                    this.popups.push({ x: c.x, y: c.y - 10, text: 'SHIELD!', bg: SKY, life: 0, maxLife: 900 });
                    this.spawnParticles(c.x, c.y, SKY, 10);
                } else {
                    this.dashCoinsCollected += 1;
                    this.comboCount += 1;
                    this.comboTimerMs = 2600;
                    const mult = this.getComboMultiplier(this.comboCount);
                    this.score += Math.round(35 * mult);
                    bentoArcadeAudio.playCoin(this.comboCount);
                    this.awardXp(
                        Math.round(12 * mult),
                        c.x,
                        c.y - 8,
                        mult > 1 ? `×${mult}` : undefined,
                        YELLOW
                    );
                    this.spawnParticles(c.x, c.y, YELLOW, 6);
                }
            }
        }

        // Obstacle collisions (forgiving 5px inner hitbox so near-misses feel awesome!)
        const hitPad = 6;
        for (const o of this.dashObstacles) {
            if (o.smashed) continue;
            const hit =
                this.mascotX + this.mascotSize - hitPad > o.x + 3 &&
                this.mascotX + hitPad < o.x + o.size - 3 &&
                this.mascotY + this.mascotSize - hitPad > o.y + 3 &&
                this.mascotY + hitPad < o.y + o.size - 3;

            if (hit) {
                if (this.dashHasShield || this.mascotSlamming) {
                    o.smashed = true;
                    if (!this.mascotSlamming) {
                        this.dashHasShield = false;
                    } else {
                        // Slamming directly onto an obstacle bounces you up heroically!
                        this.mascotVy = -520;
                        this.mascotSlamming = false;
                        this.mascotJumpsLeft = 1;
                    }
                    bentoArcadeAudio.playShieldBreak();
                    this.triggerShake(150, 6);
                    this.spawnParticles(o.x + o.size / 2, o.y + o.size / 2, CORAL, 14);
                    this.awardXp(35, o.x + o.size / 2, o.y, 'SMASHED!', CORAL_SOFT);
                } else {
                    this.triggerGameOver('obstacle');
                    return;
                }
            }
        }

        // Fell below bottom edge -> Game Over
        if (this.mascotY > this.height + 36) {
            this.triggerGameOver('fall');
        }
    }

    private triggerGameOver(reason: 'lives' | 'fall' | 'obstacle') {
        this.status = 'gameover';
        this.deathReason = reason;
        this.paddleMoveLeft = false;
        this.paddleMoveRight = false;
        this.triggerShake(240, 8);
        bentoArcadeAudio.playGameOver();

        const snap = this.getSnapshot();
        this.callbacks.onHudUpdate(snap);
        this.callbacks.onGameOver(snap);
    }

    private update(dt: number, now: number) {
        void now;
        const dtSec = dt / 1000;

        if (this.shakeMs > 0) this.shakeMs = Math.max(0, this.shakeMs - dt);

        // Update particles & floating badges
        this.particles = this.particles.filter((p) => {
            p.life += dt;
            p.x += p.vx * dtSec;
            p.y += p.vy * dtSec;
            p.vy += 420 * dtSec;
            p.rot += p.vRot * dtSec;
            return p.life < p.maxLife;
        });

        this.popups = this.popups.filter((pop) => {
            pop.life += dt;
            pop.y -= 36 * dtSec;
            return pop.life < pop.maxLife;
        });

        if (this.status !== 'playing') return;

        this.elapsedMs += dt;
        if (this.mode === 'smash') {
            this.updateSmash(dt);
        } else {
            this.updateDash(dt);
        }

        this.emitHud(false);
    }

    // =========================================================================
    // RENDERING (Authentic Neo-Brutalist Bento Paper + Thick Black Borders)
    // =========================================================================

    /**
     * Builds a cached 24x24 dot-matrix tile matching the exact site Bento background:
     * #f5f3ec paper with a solid #000000 circle (r = 1.25) centered at (12, 12).
     */
    private ensureDotPattern() {
        if (this.dotPattern && this.dotPatternDpr === this.dpr) return;
        const tileSize = 24;
        const off = document.createElement('canvas');
        off.width = Math.round(tileSize * this.dpr);
        off.height = Math.round(tileSize * this.dpr);
        const octx = off.getContext('2d');
        if (!octx) return;

        octx.scale(this.dpr, this.dpr);
        octx.fillStyle = PAPER_BG;
        octx.fillRect(0, 0, tileSize, tileSize);
        octx.fillStyle = INK_BLACK;
        octx.beginPath();
        octx.arc(12, 12, 1.25, 0, Math.PI * 2);
        octx.fill();

        const pattern = this.ctx.createPattern(off, 'repeat');
        if (pattern && typeof DOMMatrix !== 'undefined' && pattern.setTransform) {
            pattern.setTransform(new DOMMatrix().scale(1 / this.dpr, 1 / this.dpr));
        }
        this.dotPattern = pattern;
        this.dotPatternDpr = this.dpr;
    }

    private render(now: number) {
        const ctx = this.ctx;
        ctx.save();
        ctx.scale(this.dpr, this.dpr);

        // 1. Exact Site Bento Paper Background (#f5f3ec + solid #000 r=1.25 dot matrix every 24px)
        const dotStep = 24;
        const dotOffsetX = this.mode === 'dash' && this.status !== 'menu' ? -(this.dashScrollX % dotStep) : 0;
        const dotOffsetY = -((this.canvasTopOffset % dotStep) + dotStep) % dotStep;

        if (this.dotPattern) {
            ctx.save();
            ctx.translate(dotOffsetX, dotOffsetY);
            ctx.fillStyle = this.dotPattern;
            ctx.fillRect(-dotOffsetX - dotStep, -dotOffsetY - dotStep, this.width + dotStep * 2, this.height + dotStep * 2);
            ctx.restore();
        } else {
            ctx.fillStyle = PAPER_BG;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = INK_BLACK;
            for (let x = dotOffsetX + 12; x < this.width + dotStep; x += dotStep) {
                for (let y = dotOffsetY + 12; y < this.height + dotStep; y += dotStep) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1.25, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Micro screen shake
        if (this.shakeMs > 0) {
            const ratio = this.shakeMs / 240;
            ctx.translate(
                (Math.random() * 2 - 1) * this.shakeMag * ratio,
                (Math.random() * 2 - 1) * this.shakeMag * ratio
            );
        }

        if (this.status === 'menu') {
            this.renderMenuBackdrop(now);
            ctx.restore();
            return;
        }

        if (this.mode === 'smash') {
            this.renderSmashScene();
        } else {
            this.renderDashScene(now);
        }

        this.renderParticlesAndPopups();
        ctx.restore();
    }

    private renderMenuBackdrop(now: number) {
        const ctx = this.ctx;
        // Subtle joyful drifting Bento geometric stickers kept comfortably inside all four corners
        const bob1 = Math.sin(now * 0.002) * 8;
        const bob2 = Math.cos(now * 0.0024) * 10;
        drawBrutalBox(ctx, 34, 42 + bob1, 56, 36, 10, YELLOW, 4, 2.5);
        drawBrutalBox(ctx, Math.max(34, this.width - 102), 52 + bob2, 62, 34, 10, SKY, 4, 2.5);
        drawBrutalBox(ctx, 42, Math.max(42, this.height - 88) + bob2, 46, 46, 12, LIME, 4, 2.5);
        drawBrutalBox(ctx, Math.max(42, this.width - 96), Math.max(42, this.height - 92) + bob1, 50, 42, 10, PEACH, 4, 2.5);
    }

    private renderSmashScene() {
        const ctx = this.ctx;

        // Framed Neo-Brutalist Arena Box
        drawBrutalBox(ctx, this.arenaX, this.arenaY, this.arenaW, this.arenaH, 16, '#faf8f2', 6, 3);

        // Clip inside arena for crisp rendering
        ctx.save();
        drawRoundedRectPath(ctx, this.arenaX + 2, this.arenaY + 2, this.arenaW - 4, this.arenaH - 4, 14);
        ctx.clip();

        // Subtle matching 24px circular dot grid inside the Smash arena
        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
        for (let x = this.arenaX + 18; x < this.arenaX + this.arenaW; x += 24) {
            for (let y = this.arenaY + 18; y < this.arenaY + this.arenaH; y += 24) {
                ctx.beginPath();
                ctx.arc(x, y, 1.1, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Bricks (Bento UI Widget Cards)
        for (const brick of this.smashBricks) {
            const fill = brick.hitFlashMs > 0 ? WHITE : brick.color;
            drawBrutalBox(ctx, brick.x, brick.y, brick.w, brick.h, 7, fill, 3, 2.5);

            // Mini KPI widget glyphs matching the concept art!
            if (brick.glyph === 'bars' && brick.w >= 46) {
                const bx = brick.x + brick.w - 20;
                const by = brick.y + brick.h - 6;
                ctx.fillStyle = INK_BLACK;
                ctx.fillRect(bx, by - 5, 3, 5);
                ctx.fillRect(bx + 5, by - 9, 3, 9);
                ctx.fillRect(bx + 10, by - 13, 3, 13);
            } else if (brick.glyph === 'badge') {
                // Armored 2-HP badge or crack line when hp === 1
                const cx = brick.x + brick.w - 14;
                const cy = brick.y + brick.h / 2;
                ctx.fillStyle = INK_BLACK;
                if (brick.hp >= 2) {
                    ctx.beginPath();
                    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = YELLOW;
                    ctx.beginPath();
                    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Visible zig-zag crack showing 1 HP left!
                    ctx.strokeStyle = INK_BLACK;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(brick.x + brick.w * 0.45, brick.y + 3);
                    ctx.lineTo(brick.x + brick.w * 0.52, brick.y + brick.h * 0.48);
                    ctx.lineTo(brick.x + brick.w * 0.44, brick.y + brick.h - 3);
                    ctx.stroke();
                }
            } else if (brick.glyph === 'xp') {
                ctx.fillStyle = INK_BLACK;
                ctx.font = '900 10px ui-monospace, SFMono-Regular, Menlo, monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('+XP', brick.x + brick.w / 2, brick.y + brick.h / 2 + 0.5);
            }
        }

        // Falling Sticker Capsules
        for (const p of this.smashPowerups) {
            const colorMap: Record<BentoPowerupKind, string> = {
                xp: LIME,
                wide: SKY,
                multi: YELLOW,
                heavy: PEACH
            };
            const labelMap: Record<BentoPowerupKind, string> = {
                xp: '+XP',
                wide: 'WIDE',
                multi: '2×',
                heavy: 'SMASH'
            };
            drawBrutalBox(ctx, p.x, p.y, p.w, p.h, 12, colorMap[p.kind], 3, 2);
            ctx.fillStyle = INK_BLACK;
            ctx.font = '900 10px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelMap[p.kind], p.x + p.w / 2, p.y + p.h / 2 + 0.5);
        }

        // Chunky Bento Paddle
        const paddleFill = this.wideBuffMs > 0 ? SKY : LIME;
        drawBrutalBox(ctx, this.paddleX, this.paddleY, this.paddleW, this.paddleH, 9, paddleFill, 4, 3);
        // Inner tactile grip notch on paddle
        ctx.fillStyle = INK_BLACK;
        ctx.fillRect(this.paddleX + this.paddleW / 2 - 14, this.paddleY + this.paddleH / 2 - 1.5, 28, 3);

        // Balls
        for (const ball of this.smashBalls) {
            const ballFill = this.heavyBuffMs > 0 ? CORAL : YELLOW;
            // Hard black offset shadow
            ctx.beginPath();
            ctx.arc(ball.x + 3, ball.y + 3, ball.r, 0, Math.PI * 2);
            ctx.fillStyle = INK_BLACK;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
            ctx.fillStyle = ballFill;
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = INK_BLACK;
            ctx.stroke();

            // Launch prompt line when attached
            if (ball.attached) {
                ctx.save();
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(ball.x, ball.y - ball.r - 4);
                ctx.lineTo(ball.x, ball.y - ball.r - 46);
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.restore();
    }

    private renderDashScene(now: number) {
        const ctx = this.ctx;

        // Floating Bento Card Platforms
        for (const p of this.dashPlatforms) {
            drawBrutalBox(ctx, p.x, p.y, p.w, p.h, 8, p.color, 5, 3);

            // Subtle Bento card header dots on wider cards
            if (p.w >= 160) {
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                ctx.fillRect(p.x + 12, p.y + 9, 6, 6);
                ctx.fillRect(p.x + 22, p.y + 9, 20, 6);
            }

            // Lime spring jump strip
            if (p.hasSpring) {
                const sx = p.x + p.springX;
                drawBrutalBox(ctx, sx, p.y - 7, 44, 10, 4, LIME, 2, 2);
            }
        }

        // XP Coins & Shield Stickers
        for (const c of this.dashCoins) {
            if (c.collected) continue;
            const bob = Math.sin(now * 0.006 + c.id) * 4;
            const cy = c.y + bob;
            if (c.kind === 'shield') {
                drawBrutalBox(ctx, c.x - c.size / 2, cy - c.size / 2, c.size, c.size, 6, SKY, 3, 2.5);
                ctx.fillStyle = INK_BLACK;
                ctx.font = '900 11px ui-monospace, SFMono-Regular, Menlo, monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('S', c.x, cy + 0.5);
            } else {
                const w = c.size * 0.78;
                const h = c.size * 1.05;
                drawBrutalBox(ctx, c.x - w / 2, cy - h / 2, w, h, 4, YELLOW, 3, 2.5);
            }
        }

        // Coral '!' Alert Obstacles
        for (const o of this.dashObstacles) {
            if (o.smashed) continue;
            const bob = o.aerial ? Math.sin(now * 0.008 + o.id) * 5 : 0;
            const oy = o.y + bob;
            drawBrutalBox(ctx, o.x, oy, o.size, o.size, 7, CORAL, 4, 3);
            ctx.fillStyle = INK_BLACK;
            ctx.font = `900 ${Math.round(o.size * 0.62)}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', o.x + o.size / 2, oy + o.size / 2 + 1);
        }

        // Expressive Lime Square Mascot (Straight from Vision Board!)
        const s = this.mascotSize;
        const drawW = s * this.mascotSquashX;
        const drawH = s * this.mascotSquashY;
        const drawX = this.mascotX + (s - drawW) / 2;
        const drawY = this.mascotY + (s - drawH);

        // Speed motion lines behind mascot
        ctx.strokeStyle = INK_BLACK;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        const lineJitter = Math.sin(now * 0.02) * 3;
        ctx.beginPath();
        ctx.moveTo(drawX - 10, drawY + drawH * 0.35);
        ctx.lineTo(drawX - 28 - lineJitter, drawY + drawH * 0.35);
        ctx.moveTo(drawX - 8, drawY + drawH * 0.62);
        ctx.lineTo(drawX - 22 + lineJitter, drawY + drawH * 0.62);
        ctx.stroke();

        // Shield halo frame if active
        if (this.dashHasShield) {
            drawRoundedRectPath(ctx, drawX - 6, drawY - 6, drawW + 12, drawH + 12, 12);
            ctx.strokeStyle = SKY;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.strokeStyle = INK_BLACK;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Animated blocky little legs!
        const legPhase = this.mascotOnGround ? Math.sin(now * 0.022) : 0.7;
        ctx.strokeStyle = INK_BLACK;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        const hipY = drawY + drawH - 1;
        // Back leg
        ctx.beginPath();
        ctx.moveTo(drawX + drawW * 0.34, hipY);
        ctx.lineTo(drawX + drawW * 0.34 - legPhase * 8, hipY + 9);
        ctx.stroke();
        // Front leg
        ctx.beginPath();
        ctx.moveTo(drawX + drawW * 0.68, hipY);
        ctx.lineTo(drawX + drawW * 0.68 + legPhase * 8, hipY + 9);
        ctx.stroke();

        // Mascot tilted slightly forward when mid-air!
        ctx.save();
        const cx = drawX + drawW / 2;
        const cy = drawY + drawH / 2;
        ctx.translate(cx, cy);
        const tilt = this.mascotOnGround ? 0 : Math.max(-0.22, Math.min(0.24, this.mascotVy * 0.00032));
        ctx.rotate(tilt);

        drawBrutalBox(ctx, -drawW / 2, -drawH / 2, drawW, drawH, 7, LIME, 4, 3);

        // Crisp dot eyes tracking movement
        const eyeOffsetY = this.mascotVy < -120 ? -3 : this.mascotVy > 220 ? 3 : 0;
        ctx.fillStyle = INK_BLACK;
        ctx.beginPath();
        ctx.arc(drawW * 0.08, -2 + eyeOffsetY, 3, 0, Math.PI * 2);
        ctx.arc(drawW * 0.28, -2 + eyeOffsetY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    private renderParticlesAndPopups() {
        const ctx = this.ctx;

        // Flat geometric Neo-Brutalist square confetti particles
        for (const p of this.particles) {
            const alpha = Math.max(0, 1 - p.life / p.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.strokeStyle = INK_BLACK;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        }

        // Crisp sticker pill popups
        for (const pop of this.popups) {
            const t = pop.life / pop.maxLife;
            const alpha = t < 0.72 ? 1 : (1 - t) / 0.28;
            ctx.save();
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.font = '900 11px ui-monospace, SFMono-Regular, Menlo, monospace';
            const tw = ctx.measureText(pop.text).width;
            const bw = tw + 14;
            const bh = 20;
            drawBrutalBox(ctx, pop.x - bw / 2, pop.y - bh / 2, bw, bh, 6, pop.bg, 2, 2);
            ctx.fillStyle = INK_BLACK;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pop.text, pop.x, pop.y + 0.5);
            ctx.restore();
        }
    }
}
