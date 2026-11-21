import {
    ALL_DIRS,
    DIR_VECTORS,
    OPPOSITE_DIR,
    computeRunLevelProgress,
    pointKey,
    type Direction,
    type FloatingPopup,
    type FoodNode,
    type GridPoint,
    type HudSnapshot,
    type HunterSnake,
    type LevelPulseRing,
    type ParticleBurst,
    type SnakeGameMode
} from './noirSnakeTypes';
import {
    computeHuntEscalation,
    createHunterSnake,
    decideHunterDirection,
    getHunterTickInterval
} from './noirSnakeAI';
import { noirSnakeAudio } from './noirSnakeAudio';

export interface NoirSnakeEngineCallbacks {
    onHudUpdate: (hud: HudSnapshot) => void;
    onGameOver: (hud: HudSnapshot) => void;
}

const NOIR_BG = '#0a0908';
const GRID_LINE = 'rgba(245, 243, 236, 0.045)';
const GRID_MAJOR = 'rgba(245, 243, 236, 0.09)';
const CROSSHAIR = 'rgba(245, 243, 236, 0.22)';
const PLAYER_LIME = '#bef264';
const PLAYER_BOOST = '#bae6fd';
const GOLD_ACCENT = '#fde047';
const ROSE_ACCENT = '#fb7185';

export class NoirSnakeEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private callbacks: NoirSnakeEngineCallbacks;

    private rafId: number | null = null;
    private lastFrameTime = 0;
    private width = 800;
    private height = 600;
    private dpr = 1;
    private cellSize = 38;
    private bottomSafeInset = 0;

    // Game state
    private mode: SnakeGameMode = 'hunt';
    private status: 'menu' | 'playing' | 'paused' | 'gameover' = 'menu';
    private pauseReason: 'manual' | 'resize' | 'blur' | null = null;
    private deathReason: 'hunter' | 'self' | 'border' | null = null;

    // Player snake
    private playerSegments: GridPoint[] = [];
    private playerPrevSegments: GridPoint[] = [];
    private playerDir: Direction = 'RIGHT';
    private dirQueue: Direction[] = [];
    private pendingGrowth = 0;
    private playerTickAcc = 0;
    private playerBaseTickMs = 112;

    // Boost (Hunt mode)
    private boostEnergy = 100;
    private boostRequested = false;
    private isBoosting = false;

    // Camera (world pixel coordinates of screen center)
    private camX = 0;
    private camY = 0;

    // Bounded Harvest board geometry
    private boardCols = 24;
    private boardRows = 16;
    private boardOriginX = 0;
    private boardOriginY = 0;
    private harvestFoodEatenCount = 0;

    // Entities
    private hunters: HunterSnake[] = [];
    private foods: FoodNode[] = [];
    private popups: FloatingPopup[] = [];
    private particles: ParticleBurst[] = [];
    private pulseRings: LevelPulseRing[] = [];
    private nextEntityId = 1;

    // Scoring, Combo & XP
    private score = 0;
    private elapsedMs = 0;
    private survivalXpAccMs = 0;
    private hunterSpawnAccMs = 0;
    private lastGrazeAtMs = -5000;
    private runXp = 0;
    private runLevel = 1;
    private takedowns = 0;
    private threatLevel = 1;
    private levelUpNotice: { level: number; timestamp: number } | null = null;

    // Harvest combo
    private comboCount = 0;
    private comboExpiresAt = 0;
    private readonly COMBO_WINDOW_MS = 4800;

    // Menu ambient demo snake
    private demoSegments: GridPoint[] = [];
    private demoPrevSegments: GridPoint[] = [];
    private demoDir: Direction = 'RIGHT';
    private demoTickAcc = 0;

    // HUD throttling
    private lastHudEmitMs = 0;
    private screenShakeMs = 0;
    private screenShakeMag = 0;

    constructor(canvas: HTMLCanvasElement, callbacks: NoirSnakeEngineCallbacks) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
            throw new Error('Could not initialize 2D canvas context');
        }
        this.ctx = ctx;
        this.callbacks = callbacks;

        this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, 0);
        this.initMenuDemoSnake();
    }

    public startLoop() {
        if (this.rafId !== null) return;
        this.lastFrameTime = performance.now();
        const tick = (now: number) => {
            const rawDt = now - this.lastFrameTime;
            this.lastFrameTime = now;
            const dt = Math.min(50, Math.max(0, rawDt));

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

    public resize(cssWidth: number, cssHeight: number, bottomSafeInset = 0) {
        const w = Math.max(280, Math.floor(cssWidth));
        const h = Math.max(280, Math.floor(cssHeight));
        const prevW = this.width;
        const prevH = this.height;

        this.width = w;
        this.height = h;
        this.bottomSafeInset = Math.max(0, bottomSafeInset);
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        this.canvas.width = Math.floor(w * this.dpr);
        this.canvas.height = Math.floor(h * this.dpr);
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;

        const minDim = Math.min(w, h);
        this.cellSize = minDim < 440 ? 24 : minDim < 680 ? 32 : 44;

        const sizeChangedSignificantly = Math.abs(prevW - w) > 28 || Math.abs(prevH - h) > 28;
        if (this.status === 'playing' && this.mode === 'harvest' && sizeChangedSignificantly) {
            this.pause('resize');
        }

        this.recalculateHarvestBoard();
    }

    private recalculateHarvestBoard() {
        const padX = this.width < 520 ? 12 : 24;
        const padTop = this.width < 520 ? 12 : 20;
        const padBottom = (this.width < 520 ? 12 : 20) + this.bottomSafeInset;

        const availW = Math.max(this.cellSize * 12, this.width - padX * 2);
        const availH = Math.max(this.cellSize * 12, this.height - padTop - padBottom);

        this.boardCols = Math.max(12, Math.floor(availW / this.cellSize));
        this.boardRows = Math.max(12, Math.floor(availH / this.cellSize));

        const boardPxW = this.boardCols * this.cellSize;
        const boardPxH = this.boardRows * this.cellSize;
        this.boardOriginX = Math.floor((this.width - boardPxW) / 2);
        this.boardOriginY = Math.floor(padTop + (availH - boardPxH) / 2);
    }

    private initMenuDemoSnake() {
        this.demoSegments = [
            { x: 2, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 0 },
            { x: -1, y: 0 },
            { x: -2, y: 0 },
            { x: -3, y: 0 },
            { x: -4, y: 0 }
        ];
        this.demoPrevSegments = this.demoSegments.map((s) => ({ ...s }));
        this.demoDir = 'RIGHT';
        this.camX = 0;
        this.camY = 0;
    }

    public setMenuMode() {
        this.status = 'menu';
        this.pauseReason = null;
        this.deathReason = null;
        this.boostRequested = false;
        this.isBoosting = false;
        this.initMenuDemoSnake();
        this.emitHud(true);
    }

    public startRun(mode: SnakeGameMode) {
        this.mode = mode;
        this.status = 'playing';
        this.pauseReason = null;
        this.deathReason = null;
        this.score = 0;
        this.elapsedMs = 0;
        this.survivalXpAccMs = 0;
        this.hunterSpawnAccMs = 2400; // First hunter arrives quickly (~2s)
        this.lastGrazeAtMs = -5000;
        this.runXp = 0;
        this.runLevel = 1;
        this.takedowns = 0;
        this.threatLevel = 1;
        this.levelUpNotice = null;
        this.boostEnergy = 100;
        this.boostRequested = false;
        this.isBoosting = false;
        this.comboCount = 0;
        this.comboExpiresAt = 0;
        this.harvestFoodEatenCount = 0;
        this.hunters = [];
        this.foods = [];
        this.popups = [];
        this.particles = [];
        this.pulseRings = [];
        this.dirQueue = [];
        this.pendingGrowth = 0;
        this.playerTickAcc = 0;
        this.screenShakeMs = 0;

        this.recalculateHarvestBoard();

        if (mode === 'hunt') {
            this.playerBaseTickMs = 108;
            this.playerDir = 'RIGHT';
            this.playerSegments = [
                { x: 0, y: 0 },
                { x: -1, y: 0 },
                { x: -2, y: 0 },
                { x: -3, y: 0 },
                { x: -4, y: 0 }
            ];
            this.playerPrevSegments = this.playerSegments.map((s) => ({ ...s }));
            this.camX = 0;
            this.camY = 0;
            this.maintainHuntFoodField(performance.now());
            // Spawn initial Tier-1 seeker hunter immediately just outside camera
            this.spawnHunter();
        } else {
            this.playerBaseTickMs = 122;
            const cx = Math.floor(this.boardCols / 2);
            const cy = Math.floor(this.boardRows / 2);
            this.playerDir = 'RIGHT';
            this.playerSegments = [
                { x: cx, y: cy },
                { x: cx - 1, y: cy },
                { x: cx - 2, y: cy },
                { x: cx - 3, y: cy }
            ];
            this.playerPrevSegments = this.playerSegments.map((s) => ({ ...s }));
            this.spawnHarvestFood('standard', performance.now());
        }

        noirSnakeAudio.playStart();
        this.emitHud(true);
    }

    public pause(reason: 'manual' | 'resize' | 'blur' = 'manual') {
        if (this.status !== 'playing') return;
        this.status = 'paused';
        this.pauseReason = reason;
        this.boostRequested = false;
        this.isBoosting = false;
        this.emitHud(true);
    }

    public resume() {
        if (this.status !== 'paused') return;
        // If Harvest mode was paused due to viewport resize, ensure player is still safely inside board
        if (this.mode === 'harvest' && this.pauseReason === 'resize') {
            this.recalculateHarvestBoard();
            const outOfBounds = this.playerSegments.some(
                (s) => s.x < 0 || s.x >= this.boardCols || s.y < 0 || s.y >= this.boardRows
            );
            if (outOfBounds) {
                // Re-center cleanly preserving score/XP/level so resize never unfairly kills the player
                const cx = Math.floor(this.boardCols / 2);
                const cy = Math.floor(this.boardRows / 2);
                const len = Math.min(this.playerSegments.length, Math.max(4, this.boardCols - 4));
                this.playerSegments = Array.from({ length: len }, (_, i) => ({
                    x: Math.max(1, cx - i),
                    y: cy
                }));
                this.playerPrevSegments = this.playerSegments.map((s) => ({ ...s }));
                this.playerDir = 'RIGHT';
                this.dirQueue = [];
                this.foods = this.foods.filter(
                    (f) => f.x >= 0 && f.x < this.boardCols && f.y >= 0 && f.y < this.boardRows
                );
                if (!this.foods.some((f) => f.kind === 'standard')) {
                    this.spawnHarvestFood('standard', performance.now());
                }
            }
        }
        this.status = 'playing';
        this.pauseReason = null;
        this.lastFrameTime = performance.now();
        this.emitHud(true);
    }

    public queueDirection(dir: Direction) {
        if (this.status !== 'playing') return;
        const lastPlanned = this.dirQueue.length > 0 ? this.dirQueue[this.dirQueue.length - 1] : this.playerDir;
        if (dir === lastPlanned || dir === OPPOSITE_DIR[lastPlanned]) return;
        if (this.dirQueue.length < 2) {
            this.dirQueue.push(dir);
        } else {
            this.dirQueue[1] = dir;
        }
    }

    public setBoost(active: boolean) {
        this.boostRequested = active;
    }

    public getSnapshot(): HudSnapshot {
        const prog = computeRunLevelProgress(this.runXp);
        const now = performance.now();
        const comboActive = this.comboCount > 0 && now < this.comboExpiresAt;
        const comboTimeRatio = comboActive
            ? Math.max(0, Math.min(1, (this.comboExpiresAt - now) / this.COMBO_WINDOW_MS))
            : 0;
        const comboMultiplier = this.getComboMultiplier(comboActive ? this.comboCount : 0);

        return {
            mode: this.mode,
            status: this.status,
            score: Math.floor(this.score),
            elapsedSeconds: Math.floor(this.elapsedMs / 1000),
            length: this.playerSegments.length,
            runXp: Math.floor(this.runXp),
            runLevel: prog.level,
            runLevelXp: prog.currentLevelXp,
            runLevelNextXp: prog.nextLevelXp,
            threatLevel: this.threatLevel,
            huntersAlive: this.hunters.length,
            takedowns: this.takedowns,
            boostEnergy: Math.round(this.boostEnergy),
            isBoosting: this.isBoosting,
            comboCount: comboActive ? this.comboCount : 0,
            comboMultiplier,
            comboTimeRatio,
            levelUpNotice: this.levelUpNotice,
            deathReason: this.deathReason,
            pauseReason: this.pauseReason
        };
    }

    private emitHud(force = false) {
        const now = performance.now();
        if (!force && now - this.lastHudEmitMs < 90) return;
        this.lastHudEmitMs = now;
        this.callbacks.onHudUpdate(this.getSnapshot());
    }

    private getComboMultiplier(count: number): number {
        if (count >= 6) return 3;
        if (count >= 4) return 2.5;
        if (count >= 2) return 2;
        if (count >= 1) return 1.5;
        return 1;
    }

    private awardRunXp(amount: number, worldX: number, worldY: number, labelPrefix?: string, color = PLAYER_LIME) {
        if (amount <= 0) return;
        const prevLevel = this.runLevel;
        this.runXp += amount;
        const nextProg = computeRunLevelProgress(this.runXp);

        const text = labelPrefix ? `${labelPrefix} +${Math.round(amount)} XP` : `+${Math.round(amount)} XP`;
        this.spawnPopup(worldX, worldY, text, color);

        if (nextProg.level > prevLevel) {
            this.runLevel = nextProg.level;
            const now = performance.now();
            this.levelUpNotice = { level: this.runLevel, timestamp: now };
            noirSnakeAudio.playLevelUp();

            const head = this.playerSegments[0];
            if (head) {
                const pos = this.gridToWorldCenter(head.x, head.y);
                this.pulseRings.push({
                    id: this.nextEntityId++,
                    worldX: pos.x,
                    worldY: pos.y,
                    createdAt: now,
                    duration: 750,
                    color: GOLD_ACCENT,
                    label: `LV.${this.runLevel}`
                });
                this.spawnBurst(pos.x, pos.y, GOLD_ACCENT, 14);
            }
            // Refill a burst of Boost energy on Level Up in Hunt mode!
            if (this.mode === 'hunt') {
                this.boostEnergy = Math.min(100, this.boostEnergy + 35);
            }
        }
    }

    private spawnPopup(worldX: number, worldY: number, text: string, color: string) {
        this.popups.push({
            id: this.nextEntityId++,
            worldX,
            worldY,
            text,
            color,
            createdAt: performance.now(),
            duration: 900
        });
    }

    private spawnBurst(worldX: number, worldY: number, color: string, count = 10) {
        const now = performance.now();
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
            const speed = 55 + Math.random() * 145;
            this.particles.push({
                id: this.nextEntityId++,
                worldX,
                worldY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 4,
                color,
                createdAt: now,
                duration: 380 + Math.random() * 240
            });
        }
    }

    private gridToWorldCenter(gx: number, gy: number): { x: number; y: number } {
        return {
            x: (gx + 0.5) * this.cellSize,
            y: (gy + 0.5) * this.cellSize
        };
    }

    private update(dt: number, now: number) {
        // Decay particles, popups, rings regardless of game over
        this.updateEffects(dt, now);

        if (this.status === 'menu') {
            this.updateMenuDemo(dt);
            return;
        }

        if (this.status !== 'playing') {
            return;
        }

        this.elapsedMs += dt;
        if (this.screenShakeMs > 0) {
            this.screenShakeMs = Math.max(0, this.screenShakeMs - dt);
        }

        // Expire temporary food nodes (overcharge / hunter debris)
        this.foods = this.foods.filter((f) => f.expiresAt === null || now < f.expiresAt);

        // Expire combo if window elapsed
        if (this.comboCount > 0 && now >= this.comboExpiresAt) {
            this.comboCount = 0;
        }

        // Hunt mode boost energy management
        if (this.mode === 'hunt') {
            if (this.boostRequested && this.boostEnergy > 4) {
                this.isBoosting = true;
                this.boostEnergy = Math.max(0, this.boostEnergy - (dt / 1000) * 34);
                if (this.boostEnergy <= 1) {
                    this.isBoosting = false;
                }
            } else {
                this.isBoosting = false;
                this.boostEnergy = Math.min(100, this.boostEnergy + (dt / 1000) * 9.5);
            }
        }

        // Player tick speed
        const currentTickInterval = this.getPlayerTickInterval();
        this.playerTickAcc += dt;
        while (this.playerTickAcc >= currentTickInterval && this.status === 'playing') {
            this.playerTickAcc -= currentTickInterval;
            this.stepPlayer(now);
        }

        if (this.status !== 'playing') return;

        // Mode-specific updates
        if (this.mode === 'hunt') {
            this.updateHuntMode(dt, now);
        } else {
            this.updateHarvestMode(now);
        }

        this.emitHud(false);
    }

    private getPlayerTickInterval(): number {
        if (this.mode === 'hunt') {
            const levelSpeedup = Math.min(16, (this.runLevel - 1) * 1.8);
            const normal = Math.max(88, this.playerBaseTickMs - levelSpeedup);
            return this.isBoosting ? Math.max(64, normal * 0.68) : normal;
        }
        // Harvest mode accelerates gently with each level up
        const levelSpeedup = Math.min(44, (this.runLevel - 1) * 4.5);
        return Math.max(74, this.playerBaseTickMs - levelSpeedup);
    }

    private updateMenuDemo(dt: number) {
        const tickMs = 135;
        this.demoTickAcc += dt;
        if (this.demoTickAcc >= tickMs) {
            this.demoTickAcc -= tickMs;
            this.demoPrevSegments = this.demoSegments.map((s) => ({ ...s }));
            const head = this.demoSegments[0];
            if (Math.random() < 0.22) {
                const choices = ALL_DIRS.filter((d) => d !== OPPOSITE_DIR[this.demoDir]);
                this.demoDir = choices[Math.floor(Math.random() * choices.length)];
            }
            const vec = DIR_VECTORS[this.demoDir];
            const nextHead = { x: head.x + vec.x, y: head.y + vec.y };
            this.demoSegments = [nextHead, ...this.demoSegments.slice(0, -1)];
        }

        const head = this.demoSegments[0];
        const prev = this.demoPrevSegments[0] || head;
        const alpha = Math.min(1, this.demoTickAcc / tickMs);
        const hx = (prev.x + (head.x - prev.x) * alpha + 0.5) * this.cellSize;
        const hy = (prev.y + (head.y - prev.y) * alpha + 0.5) * this.cellSize;
        const lerp = 1 - Math.exp(-3.5 * (dt / 1000));
        this.camX += (hx - this.camX) * lerp;
        this.camY += (hy - this.camY) * lerp;
    }

    private updateEffects(dt: number, now: number) {
        const dtSec = dt / 1000;
        this.popups = this.popups.filter((p) => now - p.createdAt < p.duration);
        this.pulseRings = this.pulseRings.filter((r) => now - r.createdAt < r.duration);
        this.particles = this.particles.filter((p) => {
            p.worldX += p.vx * dtSec;
            p.worldY += p.vy * dtSec;
            p.vx *= 0.94;
            p.vy *= 0.94;
            return now - p.createdAt < p.duration;
        });
    }

    private stepPlayer(now: number) {
        if (this.dirQueue.length > 0) {
            const nextDir = this.dirQueue.shift()!;
            if (nextDir !== OPPOSITE_DIR[this.playerDir]) {
                this.playerDir = nextDir;
            }
        }

        this.playerPrevSegments = this.playerSegments.map((s) => ({ ...s }));
        const head = this.playerSegments[0];
        const vec = DIR_VECTORS[this.playerDir];
        const nextHead: GridPoint = { x: head.x + vec.x, y: head.y + vec.y };

        // 1. Border collision check (Harvest mode only; Hunt mode is infinite!)
        if (this.mode === 'harvest') {
            if (
                nextHead.x < 0 ||
                nextHead.x >= this.boardCols ||
                nextHead.y < 0 ||
                nextHead.y >= this.boardRows
            ) {
                this.triggerGameOver('border');
                return;
            }
        }

        // 2. Self collision check (ignore tail tip if not growing this tick)
        const checkBodyLen = this.pendingGrowth > 0 ? this.playerSegments.length : this.playerSegments.length - 1;
        for (let i = 0; i < checkBodyLen; i++) {
            const seg = this.playerSegments[i];
            if (seg.x === nextHead.x && seg.y === nextHead.y) {
                this.triggerGameOver('self');
                return;
            }
        }

        // 3. Hunter body/head collision check (Hunt mode)
        if (this.mode === 'hunt') {
            for (const hunter of this.hunters) {
                for (const hSeg of hunter.segments) {
                    if (hSeg.x === nextHead.x && hSeg.y === nextHead.y) {
                        this.triggerGameOver('hunter');
                        return;
                    }
                }
            }
        }

        // Advance player segments
        if (this.pendingGrowth > 0) {
            this.playerSegments = [nextHead, ...this.playerSegments];
            this.playerPrevSegments = [head, ...this.playerPrevSegments];
            this.pendingGrowth -= 1;
        } else {
            this.playerSegments = [nextHead, ...this.playerSegments.slice(0, -1)];
        }

        // 4. Food pickup check
        const foodIdx = this.foods.findIndex((f) => f.x === nextHead.x && f.y === nextHead.y);
        if (foodIdx !== -1) {
            const eaten = this.foods[foodIdx];
            this.foods.splice(foodIdx, 1);
            this.handleFoodEaten(eaten, now);
        }

        // 5. Hunt mode close-call graze bonus (near a hunter head without colliding!)
        if (this.mode === 'hunt' && now - this.lastGrazeAtMs > 2500) {
            const grazed = this.hunters.some((h) => {
                const hh = h.segments[0];
                const dist = Math.abs(hh.x - nextHead.x) + Math.abs(hh.y - nextHead.y);
                return dist === 1;
            });
            if (grazed) {
                this.lastGrazeAtMs = now;
                this.score += 35;
                const pos = this.gridToWorldCenter(nextHead.x, nextHead.y);
                this.awardRunXp(15, pos.x, pos.y - 12, 'GRAZE', PLAYER_BOOST);
            }
        }
    }

    private handleFoodEaten(food: FoodNode, now: number) {
        const pos = this.gridToWorldCenter(food.x, food.y);

        if (this.mode === 'harvest') {
            this.harvestFoodEatenCount += 1;
            if (now < this.comboExpiresAt) {
                this.comboCount += 1;
            } else {
                this.comboCount = 1;
            }
            this.comboExpiresAt = now + this.COMBO_WINDOW_MS;
            const mult = this.getComboMultiplier(this.comboCount);

            this.pendingGrowth += 1;
            const xpGain = Math.round(food.xpValue * mult);
            const scoreGain = Math.round(food.scoreValue * mult);
            this.score += scoreGain;

            const burstColor = food.kind === 'overcharge' ? GOLD_ACCENT : PLAYER_LIME;
            this.spawnBurst(pos.x, pos.y, burstColor, food.kind === 'overcharge' ? 14 : 9);
            if (food.kind === 'overcharge') {
                noirSnakeAudio.playOvercharge();
            } else {
                noirSnakeAudio.playEat(this.comboCount);
            }

            const prefix = mult > 1 ? `×${mult}` : undefined;
            this.awardRunXp(xpGain, pos.x, pos.y, prefix, burstColor);

            // Milestone XP bonus every 10 segments grown
            const nextLen = this.playerSegments.length + this.pendingGrowth;
            if (nextLen % 10 === 0) {
                this.awardRunXp(35, pos.x, pos.y - 20, `LEN ${nextLen}`, GOLD_ACCENT);
            }

            // Ensure standard food always stays present + spawn golden overcharge every 4 foods
            if (food.kind === 'standard') {
                this.spawnHarvestFood('standard', now);
                if (this.harvestFoodEatenCount % 4 === 0 && !this.foods.some((f) => f.kind === 'overcharge')) {
                    this.spawnHarvestFood('overcharge', now);
                }
            }
        } else {
            // Hunt Mode pickup: cap player body at 18 so you stay agile against smart hunter packs
            if (this.playerSegments.length + this.pendingGrowth < 18) {
                this.pendingGrowth += 1;
            }
            this.score += food.scoreValue;
            const boostRefill = food.kind === 'overcharge' ? 38 : food.kind === 'debris' ? 28 : 20;
            this.boostEnergy = Math.min(100, this.boostEnergy + boostRefill);

            const color = food.kind === 'standard' ? PLAYER_LIME : GOLD_ACCENT;
            this.spawnBurst(pos.x, pos.y, color, food.kind === 'standard' ? 8 : 12);
            if (food.kind === 'standard') {
                noirSnakeAudio.playEat(1);
            } else {
                noirSnakeAudio.playOvercharge();
            }
            this.awardRunXp(food.xpValue, pos.x, pos.y, food.kind === 'debris' ? 'DEBRIS' : undefined, color);
        }
    }

    private updateHuntMode(dt: number, now: number) {
        const elapsedSec = this.elapsedMs / 1000;
        const escalation = computeHuntEscalation(elapsedSec, this.runLevel);
        this.threatLevel = escalation.threatLevel;

        // Smooth camera follow tracking interpolated player head + slight forward look-ahead
        const head = this.playerSegments[0];
        const prev = this.playerPrevSegments[0] || head;
        const alpha = Math.min(1, this.playerTickAcc / this.getPlayerTickInterval());
        const interpX = prev.x + (head.x - prev.x) * alpha;
        const interpY = prev.y + (head.y - prev.y) * alpha;
        const dirVec = DIR_VECTORS[this.playerDir];

        const targetCamX = (interpX + 0.5 + dirVec.x * 1.25) * this.cellSize;
        const targetCamY = (interpY + 0.5 + dirVec.y * 1.25) * this.cellSize;
        const camLerp = 1 - Math.exp(-9.2 * (dt / 1000));
        this.camX += (targetCamX - this.camX) * camLerp;
        this.camY += (targetCamY - this.camY) * camLerp;

        // Survival passive XP + Score every 1 second
        this.survivalXpAccMs += dt;
        if (this.survivalXpAccMs >= 1000) {
            this.survivalXpAccMs -= 1000;
            const passiveXp = 4 + this.threatLevel * 2;
            this.score += 10 + this.threatLevel * 5;
            const prevLevel = this.runLevel;
            this.runXp += passiveXp;
            const nextProg = computeRunLevelProgress(this.runXp);
            if (nextProg.level > prevLevel) {
                this.runLevel = nextProg.level;
                this.levelUpNotice = { level: this.runLevel, timestamp: now };
                noirSnakeAudio.playLevelUp();
                const hPos = this.gridToWorldCenter(head.x, head.y);
                this.pulseRings.push({
                    id: this.nextEntityId++,
                    worldX: hPos.x,
                    worldY: hPos.y,
                    createdAt: now,
                    duration: 750,
                    color: GOLD_ACCENT,
                    label: `LV.${this.runLevel}`
                });
                this.boostEnergy = Math.min(100, this.boostEnergy + 35);
            }
        }

        // Maintain nearby infinite-world food nodes
        this.maintainHuntFoodField(now);

        // Spawn escalating hunter waves up to dynamic maxHunters
        this.hunterSpawnAccMs += dt;
        if (this.hunters.length < escalation.maxHunters && this.hunterSpawnAccMs >= escalation.spawnCooldownMs) {
            this.hunterSpawnAccMs = 0;
            this.spawnHunter();
        }

        // Step each hunter snake on its own speed tick
        const deadHunterIds = new Set<number>();
        for (const hunter of this.hunters) {
            if (deadHunterIds.has(hunter.id)) continue;
            hunter.spawnAge += dt;
            // Continuously tighten hunter speed slightly as threat escalates
            hunter.tickInterval = getHunterTickInterval(hunter.tier, this.threatLevel);
            hunter.tickAccumulator += dt;

            // Despawn hunters that fell wildly far behind (> 48 cells) so they re-ambush closer!
            const hHead = hunter.segments[0];
            const distFromPlayer = Math.abs(hHead.x - head.x) + Math.abs(hHead.y - head.y);
            if (distFromPlayer > 52) {
                deadHunterIds.add(hunter.id);
                continue;
            }

            while (hunter.tickAccumulator >= hunter.tickInterval && this.status === 'playing' && !deadHunterIds.has(hunter.id)) {
                hunter.tickAccumulator -= hunter.tickInterval;
                this.stepHunter(hunter, deadHunterIds, now);
            }
        }

        if (deadHunterIds.size > 0) {
            this.hunters = this.hunters.filter((h) => !deadHunterIds.has(h.id));
        }
    }

    private stepHunter(hunter: HunterSnake, deadHunterIds: Set<number>, now: number) {
        const aliveHunters = this.hunters.filter((h) => !deadHunterIds.has(h.id));
        const nextDir = decideHunterDirection({
            hunter,
            playerSegments: this.playerSegments,
            playerDir: this.playerDir,
            allHunters: aliveHunters
        });

        hunter.dir = nextDir;
        hunter.prevSegments = hunter.segments.map((s) => ({ ...s }));
        const head = hunter.segments[0];
        const vec = DIR_VECTORS[nextDir];
        const nextHead: GridPoint = { x: head.x + vec.x, y: head.y + vec.y };

        // Check if hunter strikes the PLAYER'S HEAD -> Game Over!
        const playerHead = this.playerSegments[0];
        if (nextHead.x === playerHead.x && nextHead.y === playerHead.y) {
            hunter.segments = [nextHead, ...hunter.segments.slice(0, -1)];
            this.triggerGameOver('hunter');
            return;
        }

        // Check if hunter crashes into PLAYER'S BODY -> TAKEDOWN! Hunter shatters into golden XP debris!
        for (let i = 1; i < this.playerSegments.length; i++) {
            const pSeg = this.playerSegments[i];
            if (pSeg.x === nextHead.x && pSeg.y === nextHead.y) {
                this.shatterHunter(hunter, deadHunterIds, now, true);
                return;
            }
        }

        // Check if hunter crashes into ANOTHER HUNTER'S body/head -> Takedown collateral shatter!
        for (const other of aliveHunters) {
            const startIdx = other.id === hunter.id ? 1 : 0;
            for (let i = startIdx; i < other.segments.length - 1; i++) {
                const oSeg = other.segments[i];
                if (oSeg.x === nextHead.x && oSeg.y === nextHead.y) {
                    this.shatterHunter(hunter, deadHunterIds, now, true);
                    return;
                }
            }
        }

        hunter.segments = [nextHead, ...hunter.segments.slice(0, -1)];
    }

    private shatterHunter(hunter: HunterSnake, deadHunterIds: Set<number>, now: number, creditPlayer: boolean) {
        deadHunterIds.add(hunter.id);
        const head = hunter.segments[0];
        const pos = this.gridToWorldCenter(head.x, head.y);

        this.spawnBurst(pos.x, pos.y, hunter.accent, 16);
        this.screenShakeMs = 150;
        this.screenShakeMag = 5;

        // Drop up to 3 collectible golden debris XP orbs along the shattered hunter's body
        const stride = Math.max(1, Math.floor(hunter.segments.length / 3));
        let dropped = 0;
        for (let i = 0; i < hunter.segments.length && dropped < 3; i += stride) {
            const seg = hunter.segments[i];
            if (!this.foods.some((f) => f.x === seg.x && f.y === seg.y)) {
                this.foods.push({
                    id: this.nextEntityId++,
                    x: seg.x,
                    y: seg.y,
                    kind: 'debris',
                    xpValue: 22,
                    scoreValue: 45,
                    createdAt: now,
                    expiresAt: now + 12000
                });
                dropped += 1;
            }
        }

        if (creditPlayer) {
            this.takedowns += 1;
            const bonusXp = 50 + hunter.tier * 15;
            this.score += 120 + hunter.tier * 40;
            noirSnakeAudio.playTakedown();
            this.awardRunXp(bonusXp, pos.x, pos.y, 'TAKEDOWN', GOLD_ACCENT);
        }
    }

    private spawnHunter() {
        const playerHead = this.playerSegments[0];
        if (!playerHead) return;

        const occupied = new Set<string>();
        for (const s of this.playerSegments) occupied.add(pointKey(s.x, s.y));
        for (const h of this.hunters) {
            for (const s of h.segments) occupied.add(pointKey(s.x, s.y));
        }

        const halfCols = Math.ceil(this.width / this.cellSize / 2);
        const halfRows = Math.ceil(this.height / this.cellSize / 2);

        const created = createHunterSnake({
            id: this.nextEntityId++,
            playerHead,
            viewportHalfCols: halfCols,
            viewportHalfRows: halfRows,
            threatLevel: this.threatLevel,
            existingHunters: this.hunters,
            occupied
        });

        if (created) {
            this.hunters.push(created);
        }
    }

    private maintainHuntFoodField(now: number) {
        const head = this.playerSegments[0];
        if (!head) return;

        // Cull distant food nodes far behind the player
        this.foods = this.foods.filter((f) => {
            const dist = Math.abs(f.x - head.x) + Math.abs(f.y - head.y);
            return dist <= 34;
        });

        const desiredCount = 14;
        if (this.foods.length >= desiredCount) return;

        const occupied = new Set<string>();
        for (const s of this.playerSegments) occupied.add(pointKey(s.x, s.y));
        for (const f of this.foods) occupied.add(pointKey(f.x, f.y));
        for (const h of this.hunters) {
            for (const s of h.segments) occupied.add(pointKey(s.x, s.y));
        }

        const radius = 20;
        let safety = 0;
        while (this.foods.length < desiredCount && safety < 50) {
            safety += 1;
            const ox = Math.floor((Math.random() * 2 - 1) * radius);
            const oy = Math.floor((Math.random() * 2 - 1) * radius);
            if (Math.abs(ox) + Math.abs(oy) < 3) continue;
            const fx = head.x + ox;
            const fy = head.y + oy;
            const key = pointKey(fx, fy);
            if (occupied.has(key)) continue;

            occupied.add(key);
            const isOvercharge = Math.random() < 0.14;
            this.foods.push({
                id: this.nextEntityId++,
                x: fx,
                y: fy,
                kind: isOvercharge ? 'overcharge' : 'standard',
                xpValue: isOvercharge ? 45 : 20,
                scoreValue: isOvercharge ? 90 : 30,
                createdAt: now,
                expiresAt: isOvercharge ? now + 11000 : null
            });
        }
    }

    private updateHarvestMode(now: number) {
        if (!this.foods.some((f) => f.kind === 'standard')) {
            this.spawnHarvestFood('standard', now);
        }
    }

    private spawnHarvestFood(kind: 'standard' | 'overcharge', now: number) {
        const occupied = new Set<string>();
        for (const s of this.playerSegments) occupied.add(pointKey(s.x, s.y));
        for (const f of this.foods) occupied.add(pointKey(f.x, f.y));

        const freeCells: GridPoint[] = [];
        for (let y = 0; y < this.boardRows; y++) {
            for (let x = 0; x < this.boardCols; x++) {
                if (!occupied.has(pointKey(x, y))) {
                    freeCells.push({ x, y });
                }
            }
        }
        if (freeCells.length === 0) return;
        const pick = freeCells[Math.floor(Math.random() * freeCells.length)];
        this.foods.push({
            id: this.nextEntityId++,
            x: pick.x,
            y: pick.y,
            kind,
            xpValue: kind === 'overcharge' ? 45 : 16,
            scoreValue: kind === 'overcharge' ? 100 : 25,
            createdAt: now,
            expiresAt: kind === 'overcharge' ? now + 7200 : null
        });
    }

    private triggerGameOver(reason: 'hunter' | 'self' | 'border') {
        this.status = 'gameover';
        this.deathReason = reason;
        this.boostRequested = false;
        this.isBoosting = false;
        this.screenShakeMs = 240;
        this.screenShakeMag = 8;

        const head = this.playerSegments[0];
        if (head) {
            const pos = this.gridToWorldCenter(head.x, head.y);
            this.spawnBurst(pos.x, pos.y, ROSE_ACCENT, 22);
        }

        noirSnakeAudio.playGameOver();
        const snap = this.getSnapshot();
        this.callbacks.onHudUpdate(snap);
        this.callbacks.onGameOver(snap);
    }

    // -------------------------------------------------------------------------
    // RENDERING (Pure Flat Geometric Noir Studio — Zero Gradients, Zero Purple)
    // -------------------------------------------------------------------------

    private render(now: number) {
        const ctx = this.ctx;
        ctx.save();
        ctx.scale(this.dpr, this.dpr);

        // Solid matte obsidian stage
        ctx.fillStyle = NOIR_BG;
        ctx.fillRect(0, 0, this.width, this.height);

        // Micro screen shake on takedown / crash
        if (this.screenShakeMs > 0) {
            const ratio = this.screenShakeMs / 240;
            const sx = (Math.random() * 2 - 1) * this.screenShakeMag * ratio;
            const sy = (Math.random() * 2 - 1) * this.screenShakeMag * ratio;
            ctx.translate(sx, sy);
        }

        if (this.status === 'menu') {
            this.renderInfiniteGrid(this.camX, this.camY, false);
            const alpha = Math.min(1, this.demoTickAcc / 135);
            ctx.save();
            ctx.translate(this.width / 2 - this.camX, this.height / 2 - this.camY);
            this.drawSnakeEntity(
                this.demoSegments,
                this.demoPrevSegments,
                alpha,
                this.demoDir,
                'rgba(190, 242, 100, 0.55)',
                'rgba(190, 242, 100, 0.72)',
                false
            );
            ctx.restore();
            ctx.restore();
            return;
        }

        if (this.mode === 'hunt') {
            this.renderHuntScene(now);
        } else {
            this.renderHarvestScene(now);
        }

        ctx.restore();
    }

    private renderInfiniteGrid(camX: number, camY: number, showSectorCoords: boolean) {
        const ctx = this.ctx;
        const cell = this.cellSize;
        const leftWorld = camX - this.width / 2;
        const topWorld = camY - this.height / 2;

        const firstCol = Math.floor(leftWorld / cell) - 1;
        const lastCol = Math.ceil((leftWorld + this.width) / cell) + 1;
        const firstRow = Math.floor(topWorld / cell) - 1;
        const lastRow = Math.ceil((topWorld + this.height) / cell) + 1;

        ctx.lineWidth = 1;

        for (let c = firstCol; c <= lastCol; c++) {
            const sx = Math.round(c * cell - leftWorld) + 0.5;
            ctx.strokeStyle = c % 2 === 0 ? GRID_MAJOR : GRID_LINE;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, this.height);
            ctx.stroke();
        }

        for (let r = firstRow; r <= lastRow; r++) {
            const sy = Math.round(r * cell - topWorld) + 0.5;
            ctx.strokeStyle = r % 2 === 0 ? GRID_MAJOR : GRID_LINE;
            ctx.beginPath();
            ctx.moveTo(0, sy);
            ctx.lineTo(this.width, sy);
            ctx.stroke();
        }

        // Architectural crosshairs every 2 cells (exact match to NoirGeometricSnakeCanvas)
        ctx.strokeStyle = CROSSHAIR;
        ctx.lineWidth = 1;
        for (let c = firstCol; c <= lastCol; c++) {
            if (c % 2 !== 0) continue;
            const sx = Math.round(c * cell - leftWorld) + 0.5;
            for (let r = firstRow; r <= lastRow; r++) {
                if (r % 2 !== 0) continue;
                const sy = Math.round(r * cell - topWorld) + 0.5;
                ctx.beginPath();
                ctx.moveTo(sx - 4, sy);
                ctx.lineTo(sx + 4, sy);
                ctx.moveTo(sx, sy - 4);
                ctx.lineTo(sx, sy + 4);
                ctx.stroke();

                if (showSectorCoords && c % 8 === 0 && r % 8 === 0) {
                    ctx.fillStyle = 'rgba(245, 243, 236, 0.16)';
                    ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
                    ctx.fillText(`${c >= 0 ? '+' : ''}${c},${r >= 0 ? '+' : ''}${r}`, sx + 6, sy + 11);
                }
            }
        }
    }

    private renderHuntScene(now: number) {
        const ctx = this.ctx;
        this.renderInfiniteGrid(this.camX, this.camY, true);

        ctx.save();
        ctx.translate(this.width / 2 - this.camX, this.height / 2 - this.camY);

        // Draw foods
        for (const f of this.foods) {
            this.drawFoodNode(f, now);
        }

        // Draw level-up geometric pulse rings
        this.drawPulseRings(now);

        // Draw AI Hunter Snakes
        for (const hunter of this.hunters) {
            const hAlpha = Math.min(1, hunter.tickAccumulator / hunter.tickInterval);
            this.drawSnakeEntity(
                hunter.segments,
                hunter.prevSegments,
                hAlpha,
                hunter.dir,
                hunter.accent,
                hunter.headColor,
                true,
                hunter.tier
            );
        }

        // Draw Player Snake
        const pAlpha = Math.min(1, this.playerTickAcc / this.getPlayerTickInterval());
        const playerColor = this.isBoosting ? PLAYER_BOOST : PLAYER_LIME;
        this.drawSnakeEntity(
            this.playerSegments,
            this.playerPrevSegments,
            pAlpha,
            this.playerDir,
            playerColor,
            playerColor,
            false
        );

        // Draw particles & floating XP popups in world space
        this.drawParticles(now);
        this.drawPopups(now);

        ctx.restore();

        // Screen-space off-screen Hunter directional chevrons
        this.drawOffscreenHunterIndicators(now);

        // Screen-space Tactical Corner Radar Minimap (top-right inside canvas, safe from mobile D-pad)
        this.drawHuntRadar(now);
    }

    private renderHarvestScene(now: number) {
        const ctx = this.ctx;
        const cell = this.cellSize;
        const ox = this.boardOriginX;
        const oy = this.boardOriginY;
        const bw = this.boardCols * cell;
        const bh = this.boardRows * cell;

        // Subtle muted outer frame fill
        ctx.fillStyle = '#070605';
        ctx.fillRect(0, 0, this.width, this.height);

        // Playable arena obsidian surface
        ctx.fillStyle = NOIR_BG;
        ctx.fillRect(ox, oy, bw, bh);

        // Arena grid lines (matching Noir Studio 2-cell major spacing)
        ctx.lineWidth = 1;
        for (let c = 0; c <= this.boardCols; c++) {
            const sx = ox + c * cell + 0.5;
            ctx.strokeStyle = c % 2 === 0 ? GRID_MAJOR : GRID_LINE;
            ctx.beginPath();
            ctx.moveTo(sx, oy);
            ctx.lineTo(sx, oy + bh);
            ctx.stroke();
        }
        for (let r = 0; r <= this.boardRows; r++) {
            const sy = oy + r * cell + 0.5;
            ctx.strokeStyle = r % 2 === 0 ? GRID_MAJOR : GRID_LINE;
            ctx.beginPath();
            ctx.moveTo(ox, sy);
            ctx.lineTo(ox + bw, sy);
            ctx.stroke();
        }

        // Crosshairs every 2 cells inside bounded Harvest grid
        ctx.strokeStyle = CROSSHAIR;
        for (let c = 0; c <= this.boardCols; c += 2) {
            const sx = ox + c * cell + 0.5;
            for (let r = 0; r <= this.boardRows; r += 2) {
                const sy = oy + r * cell + 0.5;
                ctx.beginPath();
                ctx.moveTo(sx - 4, sy);
                ctx.lineTo(sx + 4, sy);
                ctx.moveTo(sx, sy - 4);
                ctx.lineTo(sx, sy + 4);
                ctx.stroke();
            }
        }

        // Proximity wall warning detection
        const head = this.playerSegments[0];
        const nearWall =
            head &&
            (head.x <= 1 ||
                head.x >= this.boardCols - 2 ||
                head.y <= 1 ||
                head.y >= this.boardRows - 2);

        // Crisp Noir Studio Border Rail
        ctx.strokeStyle = nearWall ? 'rgba(251, 113, 133, 0.72)' : '#2e2924';
        ctx.lineWidth = 2;
        ctx.strokeRect(ox - 1, oy - 1, bw + 2, bh + 2);

        // Corner architectural L-brackets
        const brk = 14;
        ctx.strokeStyle = nearWall ? ROSE_ACCENT : PLAYER_LIME;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(ox - 1, oy + brk);
        ctx.lineTo(ox - 1, oy - 1);
        ctx.lineTo(ox + brk, oy - 1);
        // Top-right
        ctx.moveTo(ox + bw - brk, oy - 1);
        ctx.lineTo(ox + bw + 1, oy - 1);
        ctx.lineTo(ox + bw + 1, oy + brk);
        // Bottom-left
        ctx.moveTo(ox - 1, oy + bh - brk);
        ctx.lineTo(ox - 1, oy + bh + 1);
        ctx.lineTo(ox + brk, oy + bh + 1);
        // Bottom-right
        ctx.moveTo(ox + bw - brk, oy + bh + 1);
        ctx.lineTo(ox + bw + 1, oy + bh + 1);
        ctx.lineTo(ox + bw + 1, oy + bh - brk);
        ctx.stroke();

        // Draw entities in board-local coordinates
        ctx.save();
        ctx.translate(ox, oy);

        for (const f of this.foods) {
            this.drawFoodNode(f, now);
        }

        this.drawPulseRings(now);

        const pAlpha = Math.min(1, this.playerTickAcc / this.getPlayerTickInterval());
        this.drawSnakeEntity(
            this.playerSegments,
            this.playerPrevSegments,
            pAlpha,
            this.playerDir,
            PLAYER_LIME,
            PLAYER_LIME,
            false
        );

        this.drawParticles(now);
        this.drawPopups(now);

        ctx.restore();
    }

    private drawFoodNode(food: FoodNode, now: number) {
        const ctx = this.ctx;
        const cx = (food.x + 0.5) * this.cellSize;
        const cy = (food.y + 0.5) * this.cellSize;
        const pulse = 1 + Math.sin(now * 0.007 + food.id) * 0.1;

        if (food.kind === 'overcharge' || food.kind === 'debris') {
            const size = this.cellSize * (food.kind === 'overcharge' ? 0.36 : 0.28) * pulse;
            ctx.save();
            ctx.translate(cx, cy);

            // Countdown arc for timed nodes
            if (food.expiresAt !== null) {
                const totalLife = food.expiresAt - food.createdAt;
                const remaining = Math.max(0, (food.expiresAt - now) / totalLife);
                ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, this.cellSize * 0.44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
                ctx.stroke();
            }

            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = GOLD_ACCENT;
            ctx.fillRect(-size, -size, size * 2, size * 2);
            ctx.fillStyle = NOIR_BG;
            ctx.fillRect(-size * 0.42, -size * 0.42, size * 0.84, size * 0.84);
            ctx.restore();
            return;
        }

        // Standard Noir Lime geometric diamond + inner core
        const r = this.cellSize * 0.27 * pulse;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = 'rgba(190, 242, 100, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-r * 1.28, -r * 1.28, r * 2.56, r * 2.56);

        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = PLAYER_LIME;
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.fillStyle = NOIR_BG;
        ctx.fillRect(-r * 0.38, -r * 0.38, r * 0.76, r * 0.76);
        ctx.restore();
    }

    private drawSnakeEntity(
        segments: GridPoint[],
        prevSegments: GridPoint[],
        alpha: number,
        dir: Direction,
        accent: string,
        headColor: string,
        isHunter: boolean,
        hunterTier?: number
    ) {
        if (segments.length === 0) return;
        const ctx = this.ctx;
        const cell = this.cellSize;

        // Compute smoothly interpolated center coordinates
        const points: { x: number; y: number }[] = segments.map((seg, i) => {
            const prev = prevSegments[i] || seg;
            // Guard against huge jump (e.g. teleport/reset)
            if (Math.abs(seg.x - prev.x) > 2 || Math.abs(seg.y - prev.y) > 2) {
                return { x: (seg.x + 0.5) * cell, y: (seg.y + 0.5) * cell };
            }
            return {
                x: (prev.x + (seg.x - prev.x) * alpha + 0.5) * cell,
                y: (prev.y + (seg.y - prev.y) * alpha + 0.5) * cell
            };
        });

        // 1. Crisp orthogonal spine connector
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.globalAlpha = isHunter ? 0.52 : 0.6;
        ctx.lineWidth = Math.max(2, cell * 0.12);
        ctx.lineJoin = 'miter';
        ctx.lineCap = 'square';
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
            if (i === 0) ctx.moveTo(points[i].x, points[i].y);
            else ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.restore();

        // 2. Geometric body nodes (tail -> neck)
        for (let i = points.length - 1; i >= 1; i--) {
            const p = points[i];
            const taper = Math.max(0.46, 1 - (i / Math.max(8, points.length)) * 0.42);
            const size = cell * 0.58 * taper;
            const half = size / 2;

            ctx.fillStyle = '#141210';
            ctx.fillRect(p.x - half, p.y - half, size, size);

            ctx.strokeStyle = accent;
            ctx.globalAlpha = Math.max(0.32, 0.92 - (i / (points.length + 2)) * 0.5);
            ctx.lineWidth = 1.75;
            ctx.strokeRect(p.x - half, p.y - half, size, size);

            // Inner geometric dot for Tier 2 & 3 hunters
            if (isHunter && hunterTier && hunterTier >= 2 && i % 2 === 1) {
                ctx.fillStyle = accent;
                const inner = Math.max(2.5, size * 0.28);
                ctx.fillRect(p.x - inner / 2, p.y - inner / 2, inner, inner);
            }
        }

        // 3. Solid architectural head with directional chevron
        ctx.globalAlpha = 1;
        const head = points[0];
        const headSize = cell * 0.68;
        const hHalf = headSize / 2;

        ctx.fillStyle = headColor;
        ctx.fillRect(head.x - hHalf, head.y - hHalf, headSize, headSize);

        // Crisp dark outline on Tier 3 gold-headed hunters
        if (isHunter && hunterTier === 3) {
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2;
            ctx.strokeRect(head.x - hHalf - 1, head.y - hHalf - 1, headSize + 2, headSize + 2);
        }

        // Directional chevron inside head
        ctx.save();
        ctx.translate(head.x, head.y);
        const angle =
            dir === 'RIGHT' ? 0 : dir === 'DOWN' ? Math.PI / 2 : dir === 'LEFT' ? Math.PI : -Math.PI / 2;
        ctx.rotate(angle);
        ctx.strokeStyle = NOIR_BG;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'square';
        const c = headSize * 0.2;
        ctx.beginPath();
        ctx.moveTo(-c * 0.6, -c);
        ctx.lineTo(c * 0.8, 0);
        ctx.lineTo(-c * 0.6, c);
        ctx.stroke();
        ctx.restore();
    }

    private drawPulseRings(now: number) {
        const ctx = this.ctx;
        for (const ring of this.pulseRings) {
            const t = (now - ring.createdAt) / ring.duration;
            if (t < 0 || t > 1) continue;
            const eased = 1 - Math.pow(1 - t, 3);
            const half = this.cellSize * (0.6 + eased * 4.2);

            ctx.save();
            ctx.strokeStyle = ring.color;
            ctx.globalAlpha = (1 - t) * 0.85;
            ctx.lineWidth = 2.5 * (1 - t * 0.5);
            ctx.strokeRect(ring.worldX - half, ring.worldY - half, half * 2, half * 2);
            ctx.restore();
        }
    }

    private drawParticles(now: number) {
        const ctx = this.ctx;
        for (const p of this.particles) {
            const t = (now - p.createdAt) / p.duration;
            if (t < 0 || t > 1) continue;
            ctx.save();
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.worldX - p.size / 2, p.worldY - p.size / 2, p.size, p.size);
            ctx.restore();
        }
    }

    private drawPopups(now: number) {
        const ctx = this.ctx;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '800 11px ui-monospace, SFMono-Regular, Menlo, monospace';
        for (const pop of this.popups) {
            const t = (now - pop.createdAt) / pop.duration;
            if (t < 0 || t > 1) continue;
            const rise = t * 28;
            ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
            ctx.fillStyle = NOIR_BG;
            ctx.fillText(pop.text, pop.worldX + 1, pop.worldY - rise + 1);
            ctx.fillStyle = pop.color;
            ctx.fillText(pop.text, pop.worldX, pop.worldY - rise);
        }
        ctx.restore();
    }

    private drawOffscreenHunterIndicators(now: number) {
        const ctx = this.ctx;
        const margin = 18;
        const pulse = 0.72 + Math.sin(now * 0.01) * 0.28;

        for (const hunter of this.hunters) {
            const hh = hunter.segments[0];
            const sx = (hh.x + 0.5) * this.cellSize - this.camX + this.width / 2;
            const sy = (hh.y + 0.5) * this.cellSize - this.camY + this.height / 2;

            if (sx >= 10 && sx <= this.width - 10 && sy >= 10 && sy <= this.height - 10) {
                continue; // Already visible on screen
            }

            const cx = this.width / 2;
            const cy = this.height / 2;
            const angle = Math.atan2(sy - cy, sx - cx);

            const clampedX = Math.max(margin, Math.min(this.width - margin, sx));
            const clampedY = Math.max(margin, Math.min(this.height - margin - this.bottomSafeInset, sy));

            ctx.save();
            ctx.translate(clampedX, clampedY);
            ctx.rotate(angle);
            ctx.globalAlpha = pulse;
            ctx.fillStyle = hunter.accent;
            ctx.beginPath();
            ctx.moveTo(9, 0);
            ctx.lineTo(-5, -6);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-5, 6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    private drawHuntRadar(now: number) {
        const ctx = this.ctx;
        const head = this.playerSegments[0];
        if (!head) return;

        const size = this.width < 520 ? 74 : 96;
        const pad = this.width < 520 ? 10 : 16;
        const rx = this.width - size - pad;
        const ry = pad;
        const radarRadiusCells = 28;
        const scale = (size / 2 - 6) / radarRadiusCells;
        const centerX = rx + size / 2;
        const centerY = ry + size / 2;

        ctx.save();
        // Flat Noir radar frame
        ctx.fillStyle = 'rgba(10, 9, 8, 0.86)';
        ctx.fillRect(rx, ry, size, size);
        ctx.strokeStyle = '#2e2924';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx, ry, size, size);

        // Crosshair axes
        ctx.strokeStyle = 'rgba(245, 243, 236, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, ry + 4);
        ctx.lineTo(centerX, ry + size - 4);
        ctx.moveTo(rx + 4, centerY);
        ctx.lineTo(rx + size - 4, centerY);
        ctx.stroke();

        // Nearby food blips
        for (const f of this.foods) {
            const dx = f.x - head.x;
            const dy = f.y - head.y;
            if (Math.abs(dx) > radarRadiusCells || Math.abs(dy) > radarRadiusCells) continue;
            ctx.fillStyle = f.kind === 'standard' ? 'rgba(190, 242, 100, 0.55)' : GOLD_ACCENT;
            ctx.fillRect(centerX + dx * scale - 1, centerY + dy * scale - 1, 2, 2);
        }

        // Hunter blips
        const blink = 0.75 + Math.sin(now * 0.012) * 0.25;
        for (const h of this.hunters) {
            const hh = h.segments[0];
            const dx = Math.max(-radarRadiusCells, Math.min(radarRadiusCells, hh.x - head.x));
            const dy = Math.max(-radarRadiusCells, Math.min(radarRadiusCells, hh.y - head.y));
            ctx.fillStyle = h.accent;
            ctx.globalAlpha = blink;
            const dot = h.tier === 3 ? 4.5 : 3.5;
            ctx.fillRect(centerX + dx * scale - dot / 2, centerY + dy * scale - dot / 2, dot, dot);
        }

        // Player center square
        ctx.globalAlpha = 1;
        ctx.fillStyle = PLAYER_LIME;
        ctx.fillRect(centerX - 2.5, centerY - 2.5, 5, 5);

        // Tiny coordinate label under radar
        ctx.fillStyle = 'rgba(245, 243, 236, 0.45)';
        ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(
            `X:${head.x >= 0 ? '+' : ''}${head.x} Y:${head.y >= 0 ? '+' : ''}${head.y}`,
            rx + size,
            ry + size + 12
        );
        ctx.restore();
    }
}
