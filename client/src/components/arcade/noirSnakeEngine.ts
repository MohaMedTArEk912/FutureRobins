import {
    ALL_DIRS,
    DIR_VECTORS,
    OPPOSITE_DIR,
    WEAPON_META,
    HARVEST_SHAPES,
    computeRunLevelProgress,
    pointKey,
    type ContainmentAlert,
    type ContainmentWall,
    type Direction,
    type EscapePatternKind,
    type FloatingPopup,
    type FoodNode,
    type GridPoint,
    type HarvestShapeId,
    type HarvestShapeMeta,
    type HudSnapshot,
    type HunterSnake,
    type LevelPulseRing,
    type ParticleBurst,
    type SnakeGameMode,
    type WeaponBeamEffect,
    type WeaponDrop,
    type WeaponKind,
    type WeaponProjectile
} from './noirSnakeTypes';
import {
    buildContainmentWallCells,
    computeHuntEscalation,
    createAmbushHunterSnake,
    createHunterSnake,
    decideHunterDirection,
    evaluateEscapePattern,
    getHunterTickInterval,
    type PlayerStepRecord
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
    private deathReason: 'hunter' | 'self' | 'border' | 'wall' | null = null;

    // Player snake
    private playerSegments: GridPoint[] = [];
    private playerPrevSegments: GridPoint[] = [];
    private playerDir: Direction = 'RIGHT';
    private dirQueue: Direction[] = [];
    private pendingGrowth = 0;
    private playerTickAcc = 0;
    private playerBaseTickMs = 112;

    // Boost & Cooldown (Hunt mode)
    private boostEnergy = 100;
    private boostRequested = false;
    private isBoosting = false;
    private boostCooldownMs = 0;
    private boostCooldownMaxMs = 0;
    private boostOverheated = false;
    private readonly BOOST_RELEASE_COOLDOWN_MS = 1800;
    private readonly BOOST_OVERHEAT_COOLDOWN_MS = 4500;
    private readonly BOOST_MIN_START_ENERGY = 20;

    // Camera (world pixel coordinates of screen center)
    private camX = 0;
    private camY = 0;

    // Bounded Harvest board geometry & dynamic morphing shapes
    private boardCols = 24;
    private boardRows = 16;
    private harvestFoodEatenCount = 0;
    private harvestNormalCellSize = 38;
    private harvestMasterCellSize = 26;
    private harvestNormalCols = 18;
    private harvestNormalRows = 12;
    private harvestNormMinX = 3;
    private harvestNormMaxX = 20;
    private harvestNormMinY = 2;
    private harvestNormMaxY = 13;
    private harvestShape: HarvestShapeMeta = HARVEST_SHAPES.standard;
    private harvestNextShape: HarvestShapeMeta = HARVEST_SHAPES.diamond;
    private harvestShapeDurationMs = 26000;
    private harvestShapeRemainingMs = 26000;
    private harvestIsShiftWarning = false;
    private harvestLastWarningBeepStep = 0;
    private harvestRenderZoom = 1.42;
    private harvestTargetZoom = 1.42;
    private harvestCamCenterX = 0;
    private harvestCamCenterY = 0;
    private harvestMorphFlashMs = 0;

    // Entities
    private hunters: HunterSnake[] = [];
    private foods: FoodNode[] = [];
    private weaponDrops: WeaponDrop[] = [];
    private heldWeapon: WeaponKind | null = null;
    private weaponBeams: WeaponBeamEffect[] = [];
    private projectiles: WeaponProjectile[] = [];
    private containmentWalls: ContainmentWall[] = [];
    private popups: FloatingPopup[] = [];
    private particles: ParticleBurst[] = [];
    private pulseRings: LevelPulseRing[] = [];
    private nextEntityId = 1;

    // Anti-escape & Defect Detection (Hunt mode)
    private playerStepHistory: PlayerStepRecord[] = [];
    private straightSteps = 0;
    private boostStraightSteps = 0;
    private lastRecordedDir: Direction = 'RIGHT';
    private escapeRisk = 0; // 0..100
    private containmentCooldownMs = 0;
    private containmentAlert: ContainmentAlert | null = null;
    private recentManualPauses: number[] = [];
    private pendingPausePenalty = false;

    // Scoring, Combo & XP
    private score = 0;
    private elapsedMs = 0;
    private survivalXpAccMs = 0;
    private hunterSpawnAccMs = 0;
    private weaponSpawnAccMs = 0;
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
        const nextInset = Math.max(0, Math.floor(bottomSafeInset));
        const nextDpr = Math.min(window.devicePixelRatio || 1, 2);

        if (
            w === this.width &&
            h === this.height &&
            nextInset === this.bottomSafeInset &&
            nextDpr === this.dpr
        ) {
            return;
        }

        const prevW = this.width;
        const prevH = this.height;
        const insetChanged = nextInset !== this.bottomSafeInset;
        const prevBoardCols = this.boardCols;
        const prevBoardRows = this.boardRows;

        this.width = w;
        this.height = h;
        this.bottomSafeInset = nextInset;
        this.dpr = nextDpr;

        const targetPxW = Math.floor(w * this.dpr);
        const targetPxH = Math.floor(h * this.dpr);
        if (this.canvas.width !== targetPxW || this.canvas.height !== targetPxH) {
            this.canvas.width = targetPxW;
            this.canvas.height = targetPxH;
            this.canvas.style.width = `${w}px`;
            this.canvas.style.height = `${h}px`;
        }

        const minDim = Math.min(w, h);
        this.cellSize = minDim < 440 ? 24 : minDim < 680 ? 32 : 44;

        const sizeChangedSignificantly = Math.abs(prevW - w) > 64 || Math.abs(prevH - h) > 96;
        if (this.status === 'playing' && this.mode === 'harvest' && this.elapsedMs > 600 && sizeChangedSignificantly) {
            this.pause('resize');
        }

        this.recalculateHarvestBoard(insetChanged);

        // If the Harvest grid resized mid-run (e.g. toggling the mobile D-pad), re-center active
        // snake & food coordinates so closing/opening the pad never leaves food or snake off-grid.
        if (
            this.mode === 'harvest' &&
            (this.status === 'playing' || this.status === 'paused') &&
            (this.boardCols !== prevBoardCols || this.boardRows !== prevBoardRows)
        ) {
            const dx = Math.floor((this.boardCols - prevBoardCols) / 2);
            const dy = Math.floor((this.boardRows - prevBoardRows) / 2);
            if (dx !== 0 || dy !== 0) {
                const shiftPoint = (pt: GridPoint) => ({
                    x: Math.max(0, Math.min(this.boardCols - 1, pt.x + dx)),
                    y: Math.max(0, Math.min(this.boardRows - 1, pt.y + dy))
                });
                this.playerSegments = this.playerSegments.map(shiftPoint);
                this.playerPrevSegments = this.playerPrevSegments.map(shiftPoint);
                this.foods = this.foods
                    .map((f) => ({ ...f, ...shiftPoint(f) }))
                    .filter((f) => this.isHarvestCellWalkable(f.x, f.y));
                if (this.foods.length === 0) {
                    this.spawnHarvestFood('standard', performance.now());
                }
            }
        }
    }

    private recalculateHarvestBoard(snapZoom = false) {
        const padX = this.width < 520 ? 12 : 24;
        const padTop = this.width < 520 ? 12 : 20;
        const padBottom = (this.width < 520 ? 12 : 20) + this.bottomSafeInset;

        const availW = Math.max(280, this.width - padX * 2);
        const availH = Math.max(240, this.height - padTop - padBottom);

        const minDim = Math.min(this.width, this.height);
        const baseCell = minDim < 440 ? 24 : minDim < 680 ? 32 : 44;
        const megaCell = Math.max(14, Math.floor(baseCell * 0.70));
        this.harvestNormalCellSize = baseCell;
        this.harvestMasterCellSize = megaCell;

        // Master grid dimensions (used for full coordinates & megagrid expansion)
        this.boardCols = Math.max(18, Math.floor(availW / megaCell));
        this.boardRows = Math.max(14, Math.floor(availH / megaCell));

        // When in Harvest mode, master cell size is megaCell
        if (this.mode === 'harvest') {
            this.cellSize = megaCell;
        }

        // Normal shape dimensions centered within master grid
        this.harvestNormalCols = Math.max(12, Math.min(this.boardCols - 2, Math.floor(availW / baseCell)));
        this.harvestNormalRows = Math.max(10, Math.min(this.boardRows - 2, Math.floor(availH / baseCell)));

        this.harvestNormMinX = Math.floor((this.boardCols - this.harvestNormalCols) / 2);
        this.harvestNormMaxX = this.harvestNormMinX + this.harvestNormalCols - 1;
        this.harvestNormMinY = Math.floor((this.boardRows - this.harvestNormalRows) / 2);
        this.harvestNormMaxY = this.harvestNormMinY + this.harvestNormalRows - 1;

        this.updateHarvestTargetZoom();
        if (snapZoom) {
            this.harvestRenderZoom = this.harvestTargetZoom;
        }
        const targetCenter = this.getHarvestShapeTargetCenter();
        this.harvestCamCenterX = targetCenter.x;
        this.harvestCamCenterY = targetCenter.y;
    }

    private getHarvestShapeTargetCenter(): { x: number; y: number } {
        const cell = this.cellSize;
        if (this.harvestShape.id === 'megagrid') {
            return {
                x: (this.boardCols * cell) / 2,
                y: (this.boardRows * cell) / 2
            };
        }
        return {
            x: ((this.harvestNormMinX + this.harvestNormMaxX + 1) * cell) / 2,
            y: ((this.harvestNormMinY + this.harvestNormMaxY + 1) * cell) / 2
        };
    }

    private updateHarvestTargetZoom() {
        const normalRatio = this.harvestNormalCellSize / this.harvestMasterCellSize;
        if (this.harvestShape.id === 'megagrid') {
            this.harvestTargetZoom = 1.0;
        } else if (this.harvestShape.id === 'letterbox') {
            this.harvestTargetZoom = normalRatio * 1.08;
        } else {
            this.harvestTargetZoom = normalRatio;
        }
    }

    public isHarvestCellWalkable(x: number, y: number, shape = this.harvestShape): boolean {
        if (x < 0 || x >= this.boardCols || y < 0 || y >= this.boardRows) {
            return false;
        }

        if (shape.id === 'megagrid') {
            return true;
        }

        // All non-megagrid shapes are bounded inside normal sub-arena
        if (
            x < this.harvestNormMinX ||
            x > this.harvestNormMaxX ||
            y < this.harvestNormMinY ||
            y > this.harvestNormMaxY
        ) {
            return false;
        }

        const lx = x - this.harvestNormMinX;
        const ly = y - this.harvestNormMinY;
        const cols = this.harvestNormalCols;
        const rows = this.harvestNormalRows;

        switch (shape.id) {
            case 'standard':
                return true;

            case 'cross': {
                const cutW = Math.max(2, Math.floor(cols * 0.28));
                const cutH = Math.max(2, Math.floor(rows * 0.28));
                const inLeft = lx < cutW;
                const inRight = lx >= cols - cutW;
                const inTop = ly < cutH;
                const inBottom = ly >= rows - cutH;
                if ((inLeft || inRight) && (inTop || inBottom)) {
                    return false;
                }
                return true;
            }

            case 'donut': {
                const centerW = Math.max(2, Math.floor(cols * 0.38));
                const centerH = Math.max(2, Math.floor(rows * 0.38));
                const startX = Math.floor((cols - centerW) / 2);
                const startY = Math.floor((rows - centerH) / 2);
                if (lx >= startX && lx < startX + centerW && ly >= startY && ly < startY + centerH) {
                    return false;
                }
                return true;
            }

            case 'letterbox': {
                const slitH = Math.max(5, Math.floor(rows * 0.44));
                const startY = Math.floor((rows - slitH) / 2);
                if (ly < startY || ly >= startY + slitH) {
                    return false;
                }
                return true;
            }

            case 'trench': {
                const barW = Math.max(2, Math.floor(cols * 0.22));
                const startX = Math.floor((cols - barW) / 2);
                if (lx >= startX && lx < startX + barW) {
                    const isTopBridge = ly >= 2 && ly <= 4;
                    const midY = Math.floor(rows / 2);
                    const isMidBridge = ly >= midY - 1 && ly <= midY + 1;
                    const isBottomBridge = ly >= rows - 5 && ly <= rows - 3;
                    if (!isTopBridge && !isMidBridge && !isBottomBridge) {
                        return false;
                    }
                }
                return true;
            }

            case 'pillars': {
                const pW = Math.max(2, Math.floor(cols * 0.15));
                const pH = Math.max(2, Math.floor(rows * 0.15));
                const p1X = Math.floor(cols * 0.25 - pW / 2);
                const p1Y = Math.floor(rows * 0.25 - pH / 2);
                const p2X = Math.floor(cols * 0.75 - pW / 2);
                const p2Y = Math.floor(rows * 0.25 - pH / 2);
                const p3X = Math.floor(cols * 0.25 - pW / 2);
                const p3Y = Math.floor(rows * 0.75 - pH / 2);
                const p4X = Math.floor(cols * 0.75 - pW / 2);
                const p4Y = Math.floor(rows * 0.75 - pH / 2);

                if (
                    (lx >= p1X && lx < p1X + pW && ly >= p1Y && ly < p1Y + pH) ||
                    (lx >= p2X && lx < p2X + pW && ly >= p2Y && ly < p2Y + pH) ||
                    (lx >= p3X && lx < p3X + pW && ly >= p3Y && ly < p3Y + pH) ||
                    (lx >= p4X && lx < p4X + pW && ly >= p4Y && ly < p4Y + pH)
                ) {
                    return false;
                }
                return true;
            }

            case 'diamond': {
                const chamfer = Math.max(2, Math.floor(Math.min(cols, rows) * 0.28));
                if (lx + ly < chamfer) return false;
                if ((cols - 1 - lx) + ly < chamfer) return false;
                if (lx + (rows - 1 - ly) < chamfer) return false;
                if ((cols - 1 - lx) + (rows - 1 - ly) < chamfer) return false;
                return true;
            }

            case 'hourglass': {
                const midY = (rows - 1) / 2;
                const distRatio = Math.abs(ly - midY) / Math.max(1, midY);
                const pinchW = Math.floor(cols * 0.32 * (1 - distRatio));
                if (lx < pinchW || lx >= cols - pinchW) {
                    return false;
                }
                return true;
            }

            case 'letter-s': {
                const barH = Math.max(3, Math.floor(rows * 0.22));
                const midBarY = Math.floor((rows - barH) / 2);
                const botBarY = rows - barH;
                const chuteW = Math.max(3, Math.floor(cols * 0.30));

                // Upper left void (under top bar, left of right chute)
                if (lx < cols - chuteW && ly >= barH && ly < midBarY) {
                    return false;
                }
                // Lower right void (under middle bar, right of left chute)
                if (lx >= chuteW && ly >= midBarY + barH && ly < botBarY) {
                    return false;
                }
                return true;
            }

            case 'letter-h': {
                const colW = Math.max(3, Math.floor(cols * 0.28));
                const bridgeH = Math.max(3, Math.floor(rows * 0.28));
                const bridgeY = Math.floor((rows - bridgeH) / 2);

                // Cut out top-center and bottom-center between the twin columns
                if (lx >= colW && lx < cols - colW) {
                    if (ly < bridgeY || ly >= bridgeY + bridgeH) {
                        return false;
                    }
                }
                return true;
            }

            case 'letter-c': {
                const spineW = Math.max(3, Math.floor(cols * 0.28));
                const armH = Math.max(3, Math.floor(rows * 0.28));

                // Open eastern bay cutout
                if (lx >= spineW && ly >= armH && ly < rows - armH) {
                    return false;
                }
                return true;
            }

            case 'letter-t': {
                const roofH = Math.max(3, Math.floor(rows * 0.30));
                const stemW = Math.max(4, Math.floor(cols * 0.34));
                const stemX = Math.floor((cols - stemW) / 2);

                // Cut out bottom-left and bottom-right void quadrants
                if (ly >= roofH && (lx < stemX || lx >= stemX + stemW)) {
                    return false;
                }
                return true;
            }

            case 'letter-x': {
                const diag1Dist = Math.abs(lx / cols - ly / rows);
                const diag2Dist = Math.abs(lx / cols - (1 - ly / rows));
                // Walkable if within either diagonal corridor band
                if (diag1Dist <= 0.24 || diag2Dist <= 0.24) {
                    return true;
                }
                return false;
            }

            default:
                return true;
        }
    }

    private getHarvestShapeDuration(shape: HarvestShapeMeta): number {
        const levelReductionSec = Math.min(6, (this.runLevel - 1) * 0.8);
        const durationSec = Math.max(8, shape.baseDurationSec - levelReductionSec);
        return Math.round(durationSec * 1000);
    }

    private pickNextHarvestShape(excludeId?: HarvestShapeId): HarvestShapeMeta {
        let pool: HarvestShapeId[];
        if (this.runLevel <= 1) {
            pool = ['standard', 'diamond', 'letter-t', 'letter-c', 'pillars', 'cross'];
        } else if (this.runLevel === 2) {
            pool = ['cross', 'donut', 'letter-h', 'letter-c', 'diamond', 'pillars', 'megagrid'];
        } else {
            pool = [
                'cross',
                'donut',
                'letter-s',
                'letter-h',
                'letter-t',
                'letter-x',
                'letterbox',
                'trench',
                'pillars',
                'diamond',
                'hourglass',
                'megagrid'
            ];
        }
        const filtered = pool.filter((id) => id !== excludeId);
        const candidateList = filtered.length > 0 ? filtered : pool;
        const chosenId = candidateList[Math.floor(Math.random() * candidateList.length)];
        return HARVEST_SHAPES[chosenId];
    }

    private initHarvestShapeSystem() {
        this.harvestShape = HARVEST_SHAPES.standard;
        this.harvestNextShape = this.pickNextHarvestShape('standard');
        this.harvestShapeDurationMs = this.getHarvestShapeDuration(this.harvestShape);
        this.harvestShapeRemainingMs = this.harvestShapeDurationMs;
        this.harvestIsShiftWarning = false;
        this.harvestLastWarningBeepStep = 0;
        this.updateHarvestTargetZoom();
        this.harvestRenderZoom = this.harvestTargetZoom;
        const targetCenter = this.getHarvestShapeTargetCenter();
        this.harvestCamCenterX = targetCenter.x;
        this.harvestCamCenterY = targetCenter.y;
        this.harvestMorphFlashMs = 0;
    }

    private transitionHarvestShape(nextShape: HarvestShapeMeta, now: number) {
        this.harvestShape = nextShape;
        this.harvestNextShape = this.pickNextHarvestShape(nextShape.id);
        this.harvestShapeDurationMs = this.getHarvestShapeDuration(this.harvestShape);
        this.harvestShapeRemainingMs = this.harvestShapeDurationMs;
        this.harvestIsShiftWarning = false;
        this.harvestLastWarningBeepStep = 0;
        this.updateHarvestTargetZoom();
        this.harvestMorphFlashMs = 450;
        this.screenShakeMs = 280;
        this.screenShakeMag = 6;

        noirSnakeAudio.playSectorMorph();

        const head = this.playerSegments[0];
        if (head) {
            const pos = this.gridToWorldCenter(head.x, head.y);
            this.pulseRings.push({
                id: this.nextEntityId++,
                worldX: pos.x,
                worldY: pos.y,
                createdAt: now,
                duration: 850,
                color: nextShape.accentColor,
                label: nextShape.name
            });
            this.spawnBurst(pos.x, pos.y, nextShape.accentColor, 18);
        }

        // Safety safeguards: ensure player and foods are in walkable cells
        this.ensurePlayerInSafeCells();

        for (const food of this.foods) {
            if (!this.isHarvestCellWalkable(food.x, food.y)) {
                const safeCell = this.findNearestWalkableCell(food.x, food.y);
                if (safeCell) {
                    food.x = safeCell.x;
                    food.y = safeCell.y;
                }
            }
        }

        this.emitHud(true);
    }

    private ensurePlayerInSafeCells() {
        const head = this.playerSegments[0];
        if (!head) return;

        let headWasRelocated = false;
        if (!this.isHarvestCellWalkable(head.x, head.y)) {
            const safeHead = this.findNearestWalkableCell(head.x, head.y);
            if (safeHead) {
                head.x = safeHead.x;
                head.y = safeHead.y;
                headWasRelocated = true;
            }
        }

        for (let i = 1; i < this.playerSegments.length; i++) {
            const seg = this.playerSegments[i];
            if (!this.isHarvestCellWalkable(seg.x, seg.y)) {
                const safeCell = this.findNearestWalkableCell(seg.x, seg.y);
                if (safeCell) {
                    seg.x = safeCell.x;
                    seg.y = safeCell.y;
                }
            }
        }

        if (headWasRelocated) {
            const vec = DIR_VECTORS[this.playerDir];
            if (!this.isHarvestCellWalkable(head.x + vec.x, head.y + vec.y)) {
                for (const d of ALL_DIRS) {
                    const testVec = DIR_VECTORS[d];
                    if (this.isHarvestCellWalkable(head.x + testVec.x, head.y + testVec.y)) {
                        this.playerDir = d;
                        break;
                    }
                }
            }
            const pos = this.gridToWorldCenter(head.x, head.y);
            this.spawnPopup(pos.x, pos.y, 'WARP SAFEGUARD', '#bef264');
        }
    }

    private findNearestWalkableCell(startX: number, startY: number): GridPoint | null {
        const visited = new Set<string>();
        const queue: GridPoint[] = [{ x: startX, y: startY }];
        visited.add(pointKey(startX, startY));

        while (queue.length > 0) {
            const curr = queue.shift()!;
            if (this.isHarvestCellWalkable(curr.x, curr.y)) {
                return curr;
            }
            for (const dir of ALL_DIRS) {
                const vec = DIR_VECTORS[dir];
                const nx = curr.x + vec.x;
                const ny = curr.y + vec.y;
                const key = pointKey(nx, ny);
                if (!visited.has(key) && nx >= 0 && nx < this.boardCols && ny >= 0 && ny < this.boardRows) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny });
                }
            }
        }
        return null;
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
        this.boostCooldownMs = 0;
        this.boostCooldownMaxMs = 0;
        this.boostOverheated = false;
        this.weaponDrops = [];
        this.heldWeapon = null;
        this.weaponBeams = [];
        this.projectiles = [];
        this.containmentWalls = [];
        this.playerStepHistory = [];
        this.straightSteps = 0;
        this.boostStraightSteps = 0;
        this.escapeRisk = 0;
        this.containmentCooldownMs = 0;
        this.containmentAlert = null;
        this.recentManualPauses = [];
        this.pendingPausePenalty = false;
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
        this.weaponSpawnAccMs = 9500; // First field weapon drops ~5s into the run
        this.lastGrazeAtMs = -5000;
        this.runXp = 0;
        this.runLevel = 1;
        this.takedowns = 0;
        this.threatLevel = 1;
        this.levelUpNotice = null;
        this.boostEnergy = 100;
        this.boostRequested = false;
        this.isBoosting = false;
        this.boostCooldownMs = 0;
        this.boostCooldownMaxMs = 0;
        this.boostOverheated = false;
        this.comboCount = 0;
        this.comboExpiresAt = 0;
        this.harvestFoodEatenCount = 0;
        this.hunters = [];
        this.foods = [];
        this.weaponDrops = [];
        this.heldWeapon = null;
        this.weaponBeams = [];
        this.projectiles = [];
        this.containmentWalls = [];
        this.playerStepHistory = [];
        this.straightSteps = 0;
        this.boostStraightSteps = 0;
        this.lastRecordedDir = 'RIGHT';
        this.escapeRisk = 0;
        this.containmentCooldownMs = 3000; // Grace window at run start before first lockdown can fire
        this.containmentAlert = null;
        this.recentManualPauses = [];
        this.pendingPausePenalty = false;
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
            this.recalculateHarvestBoard();
            this.initHarvestShapeSystem();
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
        if (reason === 'manual' && this.mode === 'hunt') {
            const now = performance.now();
            this.recentManualPauses = this.recentManualPauses.filter((t) => now - t < 10000);
            this.recentManualPauses.push(now);
            if (this.recentManualPauses.length >= 4) {
                this.pendingPausePenalty = true;
                this.recentManualPauses = [];
            }
        }
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

    /**
     * Fires the player's currently held one-time weapon (Hunt mode only).
     * Strictly single-use: consumes the weapon immediately upon firing.
     */
    public fireWeapon(): boolean {
        if (this.status !== 'playing' || this.mode !== 'hunt' || !this.heldWeapon) {
            return false;
        }
        const head = this.playerSegments[0];
        if (!head) return false;

        const weapon = this.heldWeapon;
        this.heldWeapon = null; // One-time use: consume immediately
        const now = performance.now();
        const headWorld = this.gridToWorldCenter(head.x, head.y);
        const vec = DIR_VECTORS[this.playerDir];

        if (weapon === 'railgun') {
            const rangeCells = 18;
            const endGridX = head.x + vec.x * rangeCells;
            const endGridY = head.y + vec.y * rangeCells;
            const endWorld = this.gridToWorldCenter(endGridX, endGridY);

            this.weaponBeams.push({
                id: this.nextEntityId++,
                startX: headWorld.x,
                startY: headWorld.y,
                endX: endWorld.x,
                endY: endWorld.y,
                color: WEAPON_META.railgun.color,
                createdAt: now,
                duration: 380
            });

            const deadIds = new Set<number>();
            for (const hunter of this.hunters) {
                const hit = hunter.segments.some((seg) => {
                    const dx = seg.x - head.x;
                    const dy = seg.y - head.y;
                    const forward = dx * vec.x + dy * vec.y;
                    const perp = Math.abs(dx * vec.y - dy * vec.x);
                    return forward >= 0 && forward <= rangeCells && perp <= 1;
                });
                if (hit) {
                    this.shatterHunter(hunter, deadIds, now, true, 'RAIL KILL', true, head);
                }
            }
            const breachedRail = this.breachContainmentWalls((cell) => {
                const dx = cell.x - head.x;
                const dy = cell.y - head.y;
                const forward = dx * vec.x + dy * vec.y;
                const perp = Math.abs(dx * vec.y - dy * vec.x);
                return forward >= 0 && forward <= rangeCells && perp <= 1;
            });
            if (deadIds.size > 0) {
                this.hunters = this.hunters.filter((h) => !deadIds.has(h.id));
                if (deadIds.size >= 2) {
                    const multiXp = deadIds.size * 35;
                    this.score += deadIds.size * 90;
                    this.awardRunXp(multiXp, headWorld.x, headWorld.y - 22, `MULTI ×${deadIds.size}`, GOLD_ACCENT);
                }
            } else if (breachedRail > 0) {
                this.spawnPopup(headWorld.x, headWorld.y - 12, 'WALL BREACHED', WEAPON_META.railgun.color);
            } else {
                this.spawnPopup(headWorld.x, headWorld.y - 12, 'RAIL FIRED', WEAPON_META.railgun.color);
            }

            this.spawnBurst(headWorld.x + vec.x * this.cellSize * 0.6, headWorld.y + vec.y * this.cellSize * 0.6, WEAPON_META.railgun.color, 12);
            this.screenShakeMs = 200;
            this.screenShakeMag = 7;
            noirSnakeAudio.playWeaponRailgun();
        } else if (weapon === 'nova') {
            const radiusCells = 8.2;
            const deadIds = new Set<number>();
            for (const hunter of this.hunters) {
                const hit = hunter.segments.some(
                    (seg) => Math.hypot(seg.x - head.x, seg.y - head.y) <= radiusCells
                );
                if (hit) {
                    this.shatterHunter(hunter, deadIds, now, true, 'NOVA KILL', true, head);
                }
            }
            const breachedNova = this.breachContainmentWalls(
                (cell) => Math.hypot(cell.x - head.x, cell.y - head.y) <= radiusCells
            );
            if (deadIds.size > 0) {
                this.hunters = this.hunters.filter((h) => !deadIds.has(h.id));
                if (deadIds.size >= 2) {
                    const multiXp = deadIds.size * 35;
                    this.score += deadIds.size * 90;
                    this.awardRunXp(multiXp, headWorld.x, headWorld.y - 22, `NOVA ×${deadIds.size}`, GOLD_ACCENT);
                }
            } else if (breachedNova > 0) {
                this.spawnPopup(headWorld.x, headWorld.y - 12, 'WALL SHATTERED', WEAPON_META.nova.color);
            } else {
                this.spawnPopup(headWorld.x, headWorld.y - 12, 'EMP NOVA', WEAPON_META.nova.color);
            }

            this.pulseRings.push(
                {
                    id: this.nextEntityId++,
                    worldX: headWorld.x,
                    worldY: headWorld.y,
                    createdAt: now,
                    duration: 540,
                    color: GOLD_ACCENT,
                    maxRadiusCells: 8.2
                },
                {
                    id: this.nextEntityId++,
                    worldX: headWorld.x,
                    worldY: headWorld.y,
                    createdAt: now,
                    duration: 420,
                    color: ROSE_ACCENT,
                    maxRadiusCells: 5.8
                }
            );
            this.spawnBurst(headWorld.x, headWorld.y, GOLD_ACCENT, 22);
            this.screenShakeMs = 220;
            this.screenShakeMag = 7.5;
            noirSnakeAudio.playWeaponNova();
        } else {
            // 'bolt' — High-velocity piercing Plasma Lance projectile
            const startX = headWorld.x + vec.x * this.cellSize * 0.45;
            const startY = headWorld.y + vec.y * this.cellSize * 0.45;
            this.projectiles.push({
                id: this.nextEntityId++,
                worldX: startX,
                worldY: startY,
                dir: this.playerDir,
                speedCellsPerSec: 30,
                remainingCells: 24,
                color: WEAPON_META.bolt.color,
                hitHunterIds: new Set<number>(),
                trail: [{ x: startX, y: startY }]
            });
            this.spawnBurst(startX, startY, WEAPON_META.bolt.color, 10);
            this.screenShakeMs = 110;
            this.screenShakeMag = 4;
            noirSnakeAudio.playWeaponBolt();
        }

        this.emitHud(true);
        return true;
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
            boostCooldownSec: this.boostCooldownMs > 0 ? Math.ceil(this.boostCooldownMs / 100) / 10 : 0,
            boostCooldownRatio:
                this.boostCooldownMs > 0 && this.boostCooldownMaxMs > 0
                    ? Math.max(0, Math.min(1, this.boostCooldownMs / this.boostCooldownMaxMs))
                    : 0,
            boostOverheated: this.boostOverheated,
            heldWeapon: this.heldWeapon,
            weaponDropsOnMap: this.weaponDrops.length,
            escapeRisk: Math.round(this.escapeRisk),
            containmentAlert: this.containmentAlert,
            comboCount: comboActive ? this.comboCount : 0,
            comboMultiplier,
            comboTimeRatio,
            harvestShape: this.harvestShape,
            harvestNextShape: this.harvestNextShape,
            harvestShapeRemainingSec: Math.max(0, Math.ceil(this.harvestShapeRemainingMs / 100) / 10),
            harvestShapeDurationSec: Math.round(this.harvestShapeDurationMs / 1000),
            harvestIsShiftWarning: this.harvestIsShiftWarning,
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
            // In Harvest mode, level-up accelerates sector shift!
            if (this.mode === 'harvest' && this.harvestShapeRemainingMs > 4200) {
                this.harvestShapeRemainingMs = 4000;
                this.harvestIsShiftWarning = true;
            }
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
            // Refill Boost energy & shave active cooldown on Level Up in Hunt mode!
            if (this.mode === 'hunt') {
                this.boostEnergy = Math.min(100, this.boostEnergy + 30);
                if (this.boostCooldownMs > 0) {
                    this.boostCooldownMs = Math.max(0, this.boostCooldownMs - 1500);
                    if (this.boostCooldownMs === 0) {
                        this.boostOverheated = false;
                        this.boostCooldownMaxMs = 0;
                    }
                }
            }
        }
    }

    private triggerBoostOverheat() {
        this.isBoosting = false;
        this.boostEnergy = 0;
        this.boostCooldownMs = this.BOOST_OVERHEAT_COOLDOWN_MS;
        this.boostCooldownMaxMs = this.BOOST_OVERHEAT_COOLDOWN_MS;
        this.boostOverheated = true;
        noirSnakeAudio.playBoostOverheat();
        const head = this.playerSegments[0];
        if (head) {
            const pos = this.gridToWorldCenter(head.x, head.y);
            this.spawnPopup(pos.x, pos.y - 14, 'OVERHEAT', ROSE_ACCENT);
            this.spawnBurst(pos.x, pos.y, ROSE_ACCENT, 8);
        }
        this.emitHud(true);
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

        // Hunt mode boost energy + cooldown / overheat management
        if (this.mode === 'hunt') {
            if (this.boostCooldownMs > 0) {
                this.boostCooldownMs = Math.max(0, this.boostCooldownMs - dt);
                if (this.boostOverheated) {
                    // Steadily recover partial energy during overheat lockout so boost is usable on unlock
                    this.boostEnergy = Math.min(45, this.boostEnergy + (dt / 1000) * 10);
                }
                if (this.boostCooldownMs === 0) {
                    this.boostOverheated = false;
                    this.boostCooldownMaxMs = 0;
                    noirSnakeAudio.playBoostReady();
                    this.emitHud(true);
                }
            }

            const canStartBoost = this.boostCooldownMs <= 0 && this.boostEnergy >= this.BOOST_MIN_START_ENERGY;
            const canSustainBoost = this.isBoosting && this.boostCooldownMs <= 0 && this.boostEnergy > 0;

            if (this.boostRequested && (canStartBoost || canSustainBoost)) {
                this.isBoosting = true;
                this.boostEnergy = Math.max(0, this.boostEnergy - (dt / 1000) * 40);
                if (this.boostEnergy <= 0.5) {
                    this.triggerBoostOverheat();
                }
            } else {
                if (this.isBoosting && this.boostCooldownMs <= 0) {
                    // Stopping a boost triggers a brief tactical cooldown before re-ignition
                    this.boostCooldownMs = this.BOOST_RELEASE_COOLDOWN_MS;
                    this.boostCooldownMaxMs = this.BOOST_RELEASE_COOLDOWN_MS;
                    this.boostOverheated = false;
                    this.emitHud(true);
                }
                this.isBoosting = false;
                if (this.boostCooldownMs <= 0) {
                    this.boostEnergy = Math.min(100, this.boostEnergy + (dt / 1000) * 11);
                }
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
            this.updateHarvestMode(dt, now);
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
        this.weaponBeams = this.weaponBeams.filter((b) => now - b.createdAt < b.duration);
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
            if (!this.isHarvestCellWalkable(nextHead.x, nextHead.y)) {
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

        // 2b. Armed Containment Wall collision check (Hunt mode — deadly even while boosting!)
        if (this.mode === 'hunt' && this.containmentWalls.length > 0) {
            for (const wall of this.containmentWalls) {
                if (now < wall.armAt) continue; // Fair telegraph window: still materializing
                if (wall.cells.some((c) => c.x === nextHead.x && c.y === nextHead.y)) {
                    this.triggerGameOver('wall');
                    return;
                }
            }
        }

        // 3. Hunter combat / collision check (Hunt mode)
        // Player can actively KILL hunters by slicing their body/tail OR boost-ramming any segment (even head-on)!
        // Only an unboosted head-to-head collision is fatal to the player.
        if (this.mode === 'hunt') {
            const killedHunters = new Set<number>();
            let hitFatalHunterHead = false;

            for (const hunter of this.hunters) {
                for (let i = 0; i < hunter.segments.length; i++) {
                    const hSeg = hunter.segments[i];
                    if (hSeg.x === nextHead.x && hSeg.y === nextHead.y) {
                        if (this.isBoosting || i >= 1) {
                            killedHunters.add(hunter.id);
                        } else {
                            hitFatalHunterHead = true;
                        }
                        break;
                    }
                }
            }

            if (hitFatalHunterHead && !this.isBoosting) {
                this.triggerGameOver('hunter');
                return;
            }

            if (killedHunters.size > 0) {
                const deadIds = new Set<number>();
                const killLabel = this.isBoosting ? 'BOOST KILL' : 'SLICE KILL';
                for (const hunter of this.hunters) {
                    if (killedHunters.has(hunter.id)) {
                        this.shatterHunter(hunter, deadIds, now, true, killLabel, true, nextHead);
                    }
                }
                this.hunters = this.hunters.filter((h) => !deadIds.has(h.id));
                if (this.isBoosting) {
                    this.boostEnergy = Math.max(0, this.boostEnergy - 20);
                    if (this.boostEnergy <= 0.5) {
                        this.triggerBoostOverheat();
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

        // 4b. One-time dropped weapon pickup check (Hunt mode)
        if (this.mode === 'hunt') {
            const dropIdx = this.weaponDrops.findIndex((w) => w.x === nextHead.x && w.y === nextHead.y);
            if (dropIdx !== -1) {
                const drop = this.weaponDrops[dropIdx];
                this.weaponDrops.splice(dropIdx, 1);
                const hadWeapon = this.heldWeapon !== null;
                this.heldWeapon = drop.kind;
                const meta = WEAPON_META[drop.kind];
                const pos = this.gridToWorldCenter(drop.x, drop.y);
                noirSnakeAudio.playWeaponPickup();
                this.spawnBurst(pos.x, pos.y, meta.color, 14);
                this.pulseRings.push({
                    id: this.nextEntityId++,
                    worldX: pos.x,
                    worldY: pos.y,
                    createdAt: now,
                    duration: 480,
                    color: meta.color,
                    maxRadiusCells: 2.5
                });
                if (hadWeapon) {
                    this.score += 50;
                    this.awardRunXp(25, pos.x, pos.y, `${meta.shortTag} [1×]`, meta.color);
                } else {
                    this.score += 35;
                    this.spawnPopup(pos.x, pos.y - 6, `${meta.name} [1×]`, meta.color);
                }
                this.emitHud(true);
            }
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

        // 6. Anti-Escape & Defect Detection telemetry (Hunt mode)
        if (this.mode === 'hunt') {
            if (this.playerDir === this.lastRecordedDir) {
                this.straightSteps += 1;
                this.boostStraightSteps = this.isBoosting
                    ? this.boostStraightSteps + 1
                    : Math.max(0, this.boostStraightSteps - 1);
            } else {
                this.straightSteps = 1;
                this.boostStraightSteps = this.isBoosting ? 1 : 0;
                this.lastRecordedDir = this.playerDir;
            }

            this.playerStepHistory.push({
                x: nextHead.x,
                y: nextHead.y,
                dir: this.playerDir,
                boosting: this.isBoosting
            });
            if (this.playerStepHistory.length > 30) {
                this.playerStepHistory.shift();
            }

            const evaluation = evaluateEscapePattern({
                history: this.playerStepHistory,
                straightSteps: this.straightSteps,
                boostStraightSteps: this.boostStraightSteps
            });

            this.escapeRisk = Math.max(0, Math.min(100, this.escapeRisk + evaluation.riskDelta));

            if (
                this.containmentCooldownMs <= 0 &&
                evaluation.detectedPattern !== null &&
                this.escapeRisk >= 68
            ) {
                this.deployContainmentLockdown(
                    evaluation.detectedPattern,
                    now,
                    evaluation.diagonalSign,
                    evaluation.loopCenter
                );
                this.escapeRisk = 16;
                this.straightSteps = 0;
                this.boostStraightSteps = 0;
                this.containmentCooldownMs = Math.max(4600, 7200 - this.threatLevel * 280);
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
            const boostRefill = food.kind === 'overcharge' ? 30 : food.kind === 'debris' ? 20 : 14;
            this.boostEnergy = Math.min(100, this.boostEnergy + boostRefill);
            if (this.boostCooldownMs > 0) {
                const cdShave = food.kind === 'overcharge' ? 900 : food.kind === 'debris' ? 500 : 350;
                this.boostCooldownMs = Math.max(0, this.boostCooldownMs - cdShave);
                if (this.boostCooldownMs === 0) {
                    this.boostOverheated = false;
                    this.boostCooldownMaxMs = 0;
                    noirSnakeAudio.playBoostReady();
                }
            }

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
                this.boostEnergy = Math.min(100, this.boostEnergy + 30);
                if (this.boostCooldownMs > 0) {
                    this.boostCooldownMs = Math.max(0, this.boostCooldownMs - 1500);
                    if (this.boostCooldownMs === 0) {
                        this.boostOverheated = false;
                        this.boostCooldownMaxMs = 0;
                    }
                }
            }
        }

        // Maintain nearby infinite-world food nodes, weapon drops, and anti-escape containment walls
        this.maintainHuntFoodField(now);
        this.maintainHuntWeaponDrops(dt, now);
        this.maintainContainmentWalls(dt, now);

        // Advance active plasma lance projectiles
        this.updateProjectiles(dt, now);

        // Spawn escalating hunter waves up to dynamic maxHunters
        this.hunterSpawnAccMs += dt;
        if (this.hunters.length < escalation.maxHunters && this.hunterSpawnAccMs >= escalation.spawnCooldownMs) {
            this.hunterSpawnAccMs = 0;
            this.spawnHunter();
        }

        // Step each hunter snake on its own speed tick
        const armedWallKeys = this.getArmedWallKeySet(now);
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
                this.stepHunter(hunter, deadHunterIds, now, armedWallKeys);
            }
        }

        if (deadHunterIds.size > 0) {
            this.hunters = this.hunters.filter((h) => !deadHunterIds.has(h.id));
        }
    }

    private stepHunter(
        hunter: HunterSnake,
        deadHunterIds: Set<number>,
        now: number,
        armedWallKeys: Set<string>
    ) {
        const aliveHunters = this.hunters.filter((h) => !deadHunterIds.has(h.id));
        const nextDir = decideHunterDirection({
            hunter,
            playerSegments: this.playerSegments,
            playerDir: this.playerDir,
            allHunters: aliveHunters,
            blockedWallKeys: armedWallKeys
        });

        hunter.dir = nextDir;
        hunter.prevSegments = hunter.segments.map((s) => ({ ...s }));
        const head = hunter.segments[0];
        const vec = DIR_VECTORS[nextDir];
        const nextHead: GridPoint = { x: head.x + vec.x, y: head.y + vec.y };

        // Check if hunter strikes the PLAYER'S HEAD -> Boost Strike kills hunter; unboosted is Game Over!
        const playerHead = this.playerSegments[0];
        if (nextHead.x === playerHead.x && nextHead.y === playerHead.y) {
            if (this.isBoosting) {
                this.shatterHunter(hunter, deadHunterIds, now, true, 'BOOST KILL', true, playerHead);
                this.boostEnergy = Math.max(0, this.boostEnergy - 20);
                if (this.boostEnergy <= 0.5) {
                    this.triggerBoostOverheat();
                }
                return;
            }
            hunter.segments = [nextHead, ...hunter.segments.slice(0, -1)];
            this.triggerGameOver('hunter');
            return;
        }

        // Check if hunter crashes into an armed Containment Wall -> WALL TRAP takedown!
        if (armedWallKeys.has(pointKey(nextHead.x, nextHead.y))) {
            this.shatterHunter(hunter, deadHunterIds, now, true, 'WALL TRAP', true, playerHead);
            return;
        }

        // Check if hunter crashes into PLAYER'S BODY -> TAKEDOWN! Hunter shatters into golden XP debris!
        for (let i = 1; i < this.playerSegments.length; i++) {
            const pSeg = this.playerSegments[i];
            if (pSeg.x === nextHead.x && pSeg.y === nextHead.y) {
                this.shatterHunter(hunter, deadHunterIds, now, true, 'TAIL TRAP', true, playerHead);
                return;
            }
        }

        // Check if hunter crashes into ANOTHER HUNTER'S body/head -> Takedown collateral shatter!
        for (const other of aliveHunters) {
            const startIdx = other.id === hunter.id ? 1 : 0;
            for (let i = startIdx; i < other.segments.length - 1; i++) {
                const oSeg = other.segments[i];
                if (oSeg.x === nextHead.x && oSeg.y === nextHead.y) {
                    this.shatterHunter(hunter, deadHunterIds, now, true, 'TAKEDOWN', true, playerHead);
                    return;
                }
            }
        }

        hunter.segments = [nextHead, ...hunter.segments.slice(0, -1)];
    }

    private shatterHunter(
        hunter: HunterSnake,
        deadHunterIds: Set<number>,
        now: number,
        creditPlayer: boolean,
        killLabel = 'TAKEDOWN',
        allowWeaponDrop = true,
        avoidCell?: GridPoint
    ) {
        deadHunterIds.add(hunter.id);
        const head = hunter.segments[0];
        const pos = this.gridToWorldCenter(head.x, head.y);

        this.spawnBurst(pos.x, pos.y, hunter.accent, 16);
        this.screenShakeMs = Math.max(this.screenShakeMs, 150);
        this.screenShakeMag = Math.max(this.screenShakeMag, 5);

        let weaponDropCell: GridPoint | null = null;
        if (creditPlayer) {
            this.takedowns += 1;
            this.escapeRisk = Math.max(0, this.escapeRisk - 28);
            const bonusXp = 50 + hunter.tier * 15;
            this.score += 120 + hunter.tier * 40;
            noirSnakeAudio.playTakedown();
            this.awardRunXp(bonusXp, pos.x, pos.y, killLabel, GOLD_ACCENT);

            // Chance to drop a one-time weapon from the defeated hunter (guaranteed on first kill if unarmed!)
            if (allowWeaponDrop && this.weaponDrops.length < 2) {
                const guaranteedFirst =
                    this.takedowns === 1 && this.heldWeapon === null && this.weaponDrops.length === 0;
                if (guaranteedFirst || Math.random() < 0.45) {
                    const candidate =
                        hunter.segments.find(
                            (seg) =>
                                (!avoidCell || seg.x !== avoidCell.x || seg.y !== avoidCell.y) &&
                                !this.weaponDrops.some((w) => w.x === seg.x && w.y === seg.y)
                        ) || head;
                    if (!this.weaponDrops.some((w) => w.x === candidate.x && w.y === candidate.y)) {
                        this.spawnWeaponDropAt(candidate.x, candidate.y, now, true);
                        weaponDropCell = candidate;
                    }
                }
            }
        }

        // Drop up to 3 collectible golden debris XP orbs along the shattered hunter's body
        const stride = Math.max(1, Math.floor(hunter.segments.length / 3));
        let dropped = 0;
        for (let i = 0; i < hunter.segments.length && dropped < 3; i += stride) {
            const seg = hunter.segments[i];
            if (weaponDropCell && seg.x === weaponDropCell.x && seg.y === weaponDropCell.y) continue;
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
    }

    private pickRandomWeaponKind(): WeaponKind {
        const pool: WeaponKind[] = ['railgun', 'nova', 'bolt'];
        if (this.heldWeapon) {
            const others = pool.filter((k) => k !== this.heldWeapon);
            return others[Math.floor(Math.random() * others.length)];
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    private spawnWeaponDropAt(x: number, y: number, now: number, announce = false) {
        const kind = this.pickRandomWeaponKind();
        const meta = WEAPON_META[kind];
        this.weaponDrops.push({
            id: this.nextEntityId++,
            x,
            y,
            kind,
            createdAt: now,
            expiresAt: now + 28000
        });
        const pos = this.gridToWorldCenter(x, y);
        this.pulseRings.push({
            id: this.nextEntityId++,
            worldX: pos.x,
            worldY: pos.y,
            createdAt: now,
            duration: 550,
            color: meta.color,
            maxRadiusCells: 2.2
        });
        if (announce) {
            this.spawnPopup(pos.x, pos.y - 16, `DROP: ${meta.shortTag}`, meta.color);
        }
    }

    private maintainHuntWeaponDrops(dt: number, now: number) {
        const head = this.playerSegments[0];
        if (!head) return;

        // Expire old or very distant drops
        this.weaponDrops = this.weaponDrops.filter((w) => {
            if (now >= w.expiresAt) return false;
            const dist = Math.abs(w.x - head.x) + Math.abs(w.y - head.y);
            return dist <= 42;
        });

        this.weaponSpawnAccMs += dt;
        const spawnIntervalMs = 14500;
        if (this.weaponDrops.length >= 2 || this.weaponSpawnAccMs < spawnIntervalMs) {
            return;
        }

        const occupied = new Set<string>();
        for (const s of this.playerSegments) occupied.add(pointKey(s.x, s.y));
        for (const f of this.foods) occupied.add(pointKey(f.x, f.y));
        for (const w of this.weaponDrops) occupied.add(pointKey(w.x, w.y));
        for (const h of this.hunters) {
            for (const s of h.segments) occupied.add(pointKey(s.x, s.y));
        }
        for (const cw of this.containmentWalls) {
            for (const c of cw.cells) occupied.add(pointKey(c.x, c.y));
        }

        const dirVec = DIR_VECTORS[this.playerDir];
        for (let attempt = 0; attempt < 30; attempt++) {
            // Bias slightly in front of player's heading so supply drops feel discoverable
            const ox = Math.floor((Math.random() * 2 - 1) * 14) + dirVec.x * 4;
            const oy = Math.floor((Math.random() * 2 - 1) * 14) + dirVec.y * 4;
            const dist = Math.abs(ox) + Math.abs(oy);
            if (dist < 6 || dist > 18) continue;
            const wx = head.x + ox;
            const wy = head.y + oy;
            if (occupied.has(pointKey(wx, wy))) continue;

            this.weaponSpawnAccMs = 0;
            this.spawnWeaponDropAt(wx, wy, now, true);
            break;
        }
    }

    private updateProjectiles(dt: number, now: number) {
        if (this.projectiles.length === 0) return;
        const dtSec = dt / 1000;
        const deadIds = new Set<number>();
        const head = this.playerSegments[0];

        this.projectiles = this.projectiles.filter((proj) => {
            const vec = DIR_VECTORS[proj.dir];
            const stepCells = proj.speedCellsPerSec * dtSec;
            proj.worldX += vec.x * stepCells * this.cellSize;
            proj.worldY += vec.y * stepCells * this.cellSize;
            proj.remainingCells -= stepCells;

            // Gentle magnetic lock toward hunters slightly off-axis ahead of the lance
            let steerX = 0;
            let steerY = 0;
            let bestForward = Infinity;
            for (const hunter of this.hunters) {
                if (deadIds.has(hunter.id) || proj.hitHunterIds.has(hunter.id)) continue;
                const hPos = this.gridToWorldCenter(hunter.segments[0].x, hunter.segments[0].y);
                const dx = (hPos.x - proj.worldX) / this.cellSize;
                const dy = (hPos.y - proj.worldY) / this.cellSize;
                const forward = dx * vec.x + dy * vec.y;
                const perp = dx * -vec.y + dy * vec.x;
                if (forward > 0 && forward < 9 && Math.abs(perp) <= 2.4 && forward < bestForward) {
                    bestForward = forward;
                    const pull = Math.sign(perp) * Math.min(Math.abs(perp), stepCells * 0.42) * this.cellSize;
                    steerX = -vec.y * pull;
                    steerY = vec.x * pull;
                }
            }
            proj.worldX += steerX;
            proj.worldY += steerY;

            proj.trail.push({ x: proj.worldX, y: proj.worldY });
            if (proj.trail.length > 9) {
                proj.trail.shift();
            }

            // Check impact against every alive hunter segment (pierces multiple hunters!)
            const hitRadiusPx = this.cellSize * 1.25;
            for (const hunter of this.hunters) {
                if (deadIds.has(hunter.id) || proj.hitHunterIds.has(hunter.id)) continue;
                const struck = hunter.segments.some((seg) => {
                    const sPos = this.gridToWorldCenter(seg.x, seg.y);
                    return Math.hypot(sPos.x - proj.worldX, sPos.y - proj.worldY) <= hitRadiusPx;
                });
                if (struck) {
                    proj.hitHunterIds.add(hunter.id);
                    this.shatterHunter(hunter, deadIds, now, true, 'LANCE KILL', true, head);
                }
            }

            // Plasma lance also breaches containment wall blocks along its path!
            this.breachContainmentWalls((cell) => {
                const cPos = this.gridToWorldCenter(cell.x, cell.y);
                return Math.hypot(cPos.x - proj.worldX, cPos.y - proj.worldY) <= this.cellSize * 1.1;
            });

            return proj.remainingCells > 0;
        });

        if (deadIds.size > 0) {
            this.hunters = this.hunters.filter((h) => !deadIds.has(h.id));
        }
    }

    private getArmedWallKeySet(now: number): Set<string> {
        const keys = new Set<string>();
        for (const wall of this.containmentWalls) {
            if (now < wall.armAt) continue;
            for (const c of wall.cells) {
                keys.add(pointKey(c.x, c.y));
            }
        }
        return keys;
    }

    private breachContainmentWalls(predicate: (cell: GridPoint) => boolean): number {
        let removedCount = 0;
        for (const wall of this.containmentWalls) {
            const kept: GridPoint[] = [];
            for (const cell of wall.cells) {
                if (predicate(cell)) {
                    removedCount += 1;
                    const pos = this.gridToWorldCenter(cell.x, cell.y);
                    this.spawnBurst(pos.x, pos.y, ROSE_ACCENT, 5);
                } else {
                    kept.push(cell);
                }
            }
            wall.cells = kept;
        }
        if (removedCount > 0) {
            this.containmentWalls = this.containmentWalls.filter((w) => w.cells.length > 0);
        }
        return removedCount;
    }

    private maintainContainmentWalls(dt: number, now: number) {
        if (this.containmentCooldownMs > 0) {
            this.containmentCooldownMs = Math.max(0, this.containmentCooldownMs - dt);
        }

        // Trigger anti-pause-spam penalty right after resuming from repeated rapid pauses
        if (this.pendingPausePenalty) {
            this.pendingPausePenalty = false;
            this.deployContainmentLockdown('pause-abuse', now);
            this.containmentCooldownMs = 5500;
        }

        const head = this.playerSegments[0];
        if (!head || this.containmentWalls.length === 0) return;

        this.containmentWalls = this.containmentWalls.filter((wall) => {
            if (now >= wall.expiresAt || wall.cells.length === 0) return false;
            if (now >= wall.armAt && !wall.armedSoundPlayed) {
                wall.armedSoundPlayed = true;
                noirSnakeAudio.playLockdownArm();
            }
            // Keep wall if any cell is within 48 Manhattan cells of player
            return wall.cells.some((c) => Math.abs(c.x - head.x) + Math.abs(c.y - head.y) <= 48);
        });
    }

    private deployContainmentLockdown(
        pattern: EscapePatternKind,
        now: number,
        diagonalSign?: { dx: number; dy: number },
        loopCenter?: GridPoint
    ) {
        const head = this.playerSegments[0];
        if (!head) return;

        const occupied = new Set<string>();
        for (const s of this.playerSegments) occupied.add(pointKey(s.x, s.y));
        for (const h of this.hunters) {
            for (const s of h.segments) occupied.add(pointKey(s.x, s.y));
        }
        for (const w of this.containmentWalls) {
            for (const c of w.cells) occupied.add(pointKey(c.x, c.y));
        }

        const wallCells = buildContainmentWallCells({
            pattern,
            playerHead: head,
            playerDir: this.playerDir,
            occupied,
            diagonalSign,
            loopCenter
        });

        if (wallCells.length > 0) {
            const telegraphMs = pattern === 'straight-boost' ? 580 : 650;
            this.containmentWalls.push({
                id: this.nextEntityId++,
                cells: wallCells,
                pattern,
                createdAt: now,
                armAt: now + telegraphMs,
                expiresAt: now + 12500,
                armedSoundPlayed: false
            });
            // Keep at most 3 simultaneous walls so the grid stays readable
            if (this.containmentWalls.length > 3) {
                this.containmentWalls.shift();
            }
            for (const c of wallCells) {
                occupied.add(pointKey(c.x, c.y));
            }
            // Visual pulse at wall center
            const mid = wallCells[Math.floor(wallCells.length / 2)];
            const midWorld = this.gridToWorldCenter(mid.x, mid.y);
            this.pulseRings.push({
                id: this.nextEntityId++,
                worldX: midWorld.x,
                worldY: midWorld.y,
                createdAt: now,
                duration: 600,
                color: ROSE_ACCENT,
                maxRadiusCells: 3.4
            });
        }

        // Simultaneously deploy an Ambush Interceptor Hunter Snake flanking the wall's escape lane!
        if (this.hunters.length < 9) {
            const firstSign: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
            const ambush = createAmbushHunterSnake({
                id: this.nextEntityId++,
                playerHead: head,
                playerDir: this.playerDir,
                threatLevel: this.threatLevel,
                occupied,
                preferFlankSign: firstSign
            });
            if (ambush) {
                this.hunters.push(ambush);
                for (const s of ambush.segments) occupied.add(pointKey(s.x, s.y));
            }

            // On high-threat straight-boost escapes, deploy a second pincer snake on the opposite wing!
            if (pattern === 'straight-boost' && this.threatLevel >= 3 && this.hunters.length < 9) {
                const secondAmbush = createAmbushHunterSnake({
                    id: this.nextEntityId++,
                    playerHead: head,
                    playerDir: this.playerDir,
                    threatLevel: this.threatLevel,
                    occupied,
                    preferFlankSign: (firstSign * -1) as 1 | -1
                });
                if (secondAmbush) {
                    this.hunters.push(secondAmbush);
                }
            }
        }

        const alertCopy: Record<EscapePatternKind, { title: string; arTitle: string }> = {
            'straight-boost': {
                title: 'BOOST ESCAPE DETECTED — WALL + AMBUSH',
                arTitle: 'تم رصد هروب بالاندفاع — جدار + كمين'
            },
            'straight-run': {
                title: 'ESCAPE LINE BLOCKED — INTERCEPTING',
                arTitle: 'تم إغلاق مسار الهروب — اعتراض نشط'
            },
            'diagonal-kite': {
                title: 'ZIG-ZAG KITE DETECTED — CORNER SEALED',
                arTitle: 'تم رصد مراوغة متكررة — إغلاق الزاوية'
            },
            'loop-stall': {
                title: 'LOOP STALLING DETECTED — CAGE DEPLOYED',
                arTitle: 'تم رصد الدوران المستمر — نشر قفص احتواء'
            },
            'pause-abuse': {
                title: 'DEFECT GUARD — PAUSE ABUSE PENALTY',
                arTitle: 'حماية الغش — عقوبة تكرار الإيقاف'
            }
        };

        this.containmentAlert = {
            pattern,
            title: alertCopy[pattern].title,
            arTitle: alertCopy[pattern].arTitle,
            timestamp: now
        };

        const headPos = this.gridToWorldCenter(head.x, head.y);
        this.spawnPopup(headPos.x, headPos.y - 18, 'LOCKDOWN!', ROSE_ACCENT);
        this.screenShakeMs = Math.max(this.screenShakeMs, 140);
        this.screenShakeMag = Math.max(this.screenShakeMag, 4.5);
        noirSnakeAudio.playLockdownWarning();
        this.emitHud(true);
    }

    private spawnHunter() {
        const playerHead = this.playerSegments[0];
        if (!playerHead) return;

        const occupied = new Set<string>();
        for (const s of this.playerSegments) occupied.add(pointKey(s.x, s.y));
        for (const h of this.hunters) {
            for (const s of h.segments) occupied.add(pointKey(s.x, s.y));
        }
        for (const w of this.containmentWalls) {
            for (const c of w.cells) occupied.add(pointKey(c.x, c.y));
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
        for (const w of this.containmentWalls) {
            for (const c of w.cells) occupied.add(pointKey(c.x, c.y));
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

    private updateHarvestMode(dt: number, now: number) {
        if (this.harvestMorphFlashMs > 0) {
            this.harvestMorphFlashMs = Math.max(0, this.harvestMorphFlashMs - dt);
        }

        // Smooth camera zoom & active sector center interpolation
        const zoomLerp = 1 - Math.exp(-6.5 * (dt / 1000));
        this.harvestRenderZoom += (this.harvestTargetZoom - this.harvestRenderZoom) * zoomLerp;

        const targetCenter = this.getHarvestShapeTargetCenter();
        const camLerp = 1 - Math.exp(-8 * (dt / 1000));
        this.harvestCamCenterX += (targetCenter.x - this.harvestCamCenterX) * camLerp;
        this.harvestCamCenterY += (targetCenter.y - this.harvestCamCenterY) * camLerp;

        // Countdown active shape timer
        this.harvestShapeRemainingMs = Math.max(0, this.harvestShapeRemainingMs - dt);

        if (this.harvestShapeRemainingMs <= 4000) {
            this.harvestIsShiftWarning = true;
            const remainingSec = Math.max(1, Math.ceil(this.harvestShapeRemainingMs / 1000));
            if (remainingSec <= 3 && this.harvestLastWarningBeepStep !== remainingSec) {
                this.harvestLastWarningBeepStep = remainingSec;
                noirSnakeAudio.playSectorShiftWarning(remainingSec);
                const arenaCenter = this.gridToWorldCenter(
                    Math.floor(this.boardCols / 2),
                    Math.floor(this.boardRows / 2)
                );
                this.pulseRings.push({
                    id: this.nextEntityId++,
                    worldX: arenaCenter.x,
                    worldY: arenaCenter.y,
                    createdAt: now,
                    duration: 480,
                    color: this.harvestNextShape.accentColor,
                    label: `SHIFT ${remainingSec}s`
                });
            }
        } else {
            this.harvestIsShiftWarning = false;
        }

        // Trigger shape transition when timer expires
        if (this.harvestShapeRemainingMs <= 0) {
            this.transitionHarvestShape(this.harvestNextShape, now);
        }

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
                if (this.isHarvestCellWalkable(x, y) && !occupied.has(pointKey(x, y))) {
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

    private triggerGameOver(reason: 'hunter' | 'self' | 'border' | 'wall') {
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

        // Draw collectible one-time dropped weapons
        for (const w of this.weaponDrops) {
            this.drawWeaponDrop(w, now);
        }

        // Draw anti-escape Containment Walls (telegraph blueprint -> solid armored barrier)
        this.drawContainmentWalls(now);

        // Draw level-up & EMP Nova geometric pulse rings
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

        // Draw armed weapon reticle around player head when holding a one-time weapon
        if (this.heldWeapon) {
            this.drawArmedPlayerIndicator(pAlpha, now);
        }

        // Draw micro boost cooldown bar right beneath player head while cooling down
        if (this.boostCooldownMs > 0) {
            this.drawBoostCooldownIndicator(pAlpha);
        }

        // Draw active railgun beams & piercing plasma lances
        this.drawWeaponBeams(now);
        this.drawProjectiles();

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
        const bw = this.boardCols * cell;
        const bh = this.boardRows * cell;
        const padTop = this.width < 520 ? 10 : 20;
        const padBottom = (this.width < 520 ? 10 : 20) + this.bottomSafeInset;
        const availH = Math.max(240, this.height - padTop - padBottom);

        // Subtle dark outer frame fill
        ctx.fillStyle = '#060504';
        ctx.fillRect(0, 0, this.width, this.height);

        // Smooth camera centering on the active sector's true geometric center
        const screenCenterX = this.width / 2;
        const screenCenterY = padTop + availH / 2;
        const targetCenter = this.getHarvestShapeTargetCenter();
        const camX = this.harvestCamCenterX || targetCenter.x;
        const camY = this.harvestCamCenterY || targetCenter.y;

        ctx.save();
        ctx.translate(screenCenterX, screenCenterY);
        ctx.scale(this.harvestRenderZoom, this.harvestRenderZoom);
        ctx.translate(-camX, -camY);

        const activeMinX = this.harvestShape.id === 'megagrid' ? 0 : this.harvestNormMinX;
        const activeMaxX = this.harvestShape.id === 'megagrid' ? this.boardCols - 1 : this.harvestNormMaxX;
        const activeMinY = this.harvestShape.id === 'megagrid' ? 0 : this.harvestNormMinY;
        const activeMaxY = this.harvestShape.id === 'megagrid' ? this.boardRows - 1 : this.harvestNormMaxY;

        // 1. Batched Playable Arena Floor, Grid Lines, Crosshairs & Void Hatches
        // (Replaces ~1,400 per-tile draw calls/frame with ~6 batched paths for locked 60fps on mobile)
        const walkableFloorPath = new Path2D();
        const gridPath = new Path2D();
        const crosshairPath = new Path2D();
        const voidFillPath = new Path2D();
        const voidHatchPath = new Path2D();
        const dangerTiles: Array<{ x: number; y: number; px: number; py: number }> = [];

        for (let y = activeMinY; y <= activeMaxY; y++) {
            for (let x = activeMinX; x <= activeMaxX; x++) {
                const isWalkable = this.isHarvestCellWalkable(x, y);
                const px = x * cell;
                const py = y * cell;

                if (isWalkable) {
                    walkableFloorPath.rect(px, py, cell, cell);
                    gridPath.rect(px + 0.5, py + 0.5, cell - 1, cell - 1);

                    if ((x - activeMinX) % 2 === 0 && (y - activeMinY) % 2 === 0) {
                        crosshairPath.moveTo(px - 3, py);
                        crosshairPath.lineTo(px + 3, py);
                        crosshairPath.moveTo(px, py - 3);
                        crosshairPath.lineTo(px, py + 3);
                    }

                    if (this.harvestIsShiftWarning && !this.isHarvestCellWalkable(x, y, this.harvestNextShape)) {
                        dangerTiles.push({ x, y, px, py });
                    }
                } else {
                    voidFillPath.rect(px, py, cell, cell);
                    voidHatchPath.moveTo(px, py + cell);
                    voidHatchPath.lineTo(px + cell, py);
                }
            }
        }

        ctx.fillStyle = NOIR_BG;
        ctx.fill(walkableFloorPath);

        ctx.fillStyle = '#050404';
        ctx.fill(voidFillPath);

        ctx.strokeStyle = GRID_LINE;
        ctx.lineWidth = 1;
        ctx.stroke(gridPath);

        ctx.strokeStyle = CROSSHAIR;
        ctx.lineWidth = 1;
        ctx.stroke(crosshairPath);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.stroke(voidHatchPath);

        // Shift telegraph overlay (only active during the final warning seconds)
        if (dangerTiles.length > 0) {
            const pulse = 0.35 + 0.25 * Math.sin(now * 0.012);
            const dangerFillPath = new Path2D();
            const dangerCrossPath = new Path2D();
            for (let i = 0; i < dangerTiles.length; i++) {
                const { px, py } = dangerTiles[i];
                dangerFillPath.rect(px, py, cell, cell);
                dangerCrossPath.moveTo(px, py);
                dangerCrossPath.lineTo(px + cell, py + cell);
                dangerCrossPath.moveTo(px, py + cell);
                dangerCrossPath.lineTo(px + cell, py);
            }
            ctx.fillStyle = `rgba(251, 113, 133, ${(pulse * 0.38).toFixed(3)})`;
            ctx.fill(dangerFillPath);
            ctx.strokeStyle = `rgba(251, 113, 133, ${pulse.toFixed(3)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke(dangerCrossPath);
        }

        // 2. Batched Active Shape Perimeter Rails & Head Proximity Warnings
        const head = this.playerSegments[0];
        const shapeAccent = this.harvestShape.accentColor;
        const normalRailPath = new Path2D();
        const alertRailPath = new Path2D();

        for (let y = activeMinY; y <= activeMaxY; y++) {
            for (let x = activeMinX; x <= activeMaxX; x++) {
                if (!this.isHarvestCellWalkable(x, y)) continue;

                const px = x * cell;
                const py = y * cell;
                const isNearHead = head && Math.abs(head.x - x) <= 1 && Math.abs(head.y - y) <= 1;
                const targetPath = isNearHead ? alertRailPath : normalRailPath;

                if (!this.isHarvestCellWalkable(x, y - 1)) {
                    targetPath.moveTo(px, py + 0.5);
                    targetPath.lineTo(px + cell, py + 0.5);
                }
                if (!this.isHarvestCellWalkable(x, y + 1)) {
                    targetPath.moveTo(px, py + cell - 0.5);
                    targetPath.lineTo(px + cell, py + cell - 0.5);
                }
                if (!this.isHarvestCellWalkable(x - 1, y)) {
                    targetPath.moveTo(px + 0.5, py);
                    targetPath.lineTo(px + 0.5, py + cell);
                }
                if (!this.isHarvestCellWalkable(x + 1, y)) {
                    targetPath.moveTo(px + cell - 0.5, py);
                    targetPath.lineTo(px + cell - 0.5, py + cell);
                }
            }
        }

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = shapeAccent;
        ctx.stroke(normalRailPath);
        ctx.strokeStyle = ROSE_ACCENT;
        ctx.stroke(alertRailPath);

        // Corner architectural brackets on active sector outer envelope
        const envLeft = activeMinX * cell;
        const envTop = activeMinY * cell;
        const envRight = (activeMaxX + 1) * cell;
        const envBottom = (activeMaxY + 1) * cell;
        const brk = 12;
        ctx.strokeStyle = shapeAccent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(envLeft - 2, envTop + brk);
        ctx.lineTo(envLeft - 2, envTop - 2);
        ctx.lineTo(envLeft + brk, envTop - 2);
        // Top-right
        ctx.moveTo(envRight - brk, envTop - 2);
        ctx.lineTo(envRight + 2, envTop - 2);
        ctx.lineTo(envRight + 2, envTop + brk);
        // Bottom-left
        ctx.moveTo(envLeft - 2, envBottom - brk);
        ctx.lineTo(envLeft - 2, envBottom + 2);
        ctx.lineTo(envLeft + brk, envBottom + 2);
        // Bottom-right
        ctx.moveTo(envRight - brk, envBottom + 2);
        ctx.lineTo(envRight + 2, envBottom + 2);
        ctx.lineTo(envRight + 2, envBottom - brk);
        ctx.stroke();

        // 3. Draw Entities in Arena Local Coordinates
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

        // 4. In-Arena Sector Shift Warning Telegraph Overlay
        if (this.harvestIsShiftWarning) {
            const remainingSec = Math.max(0, this.harvestShapeRemainingMs / 1000);
            const warningText = `SECTOR SHIFT IN ${remainingSec.toFixed(1)}s`;
            const nextText = `NEXT: ${this.harvestNextShape.name} [${this.harvestNextShape.difficulty.toUpperCase()}]`;

            ctx.save();
            ctx.font = '900 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const activeW = envRight - envLeft;
            const bannerY = envTop + 12;
            const bannerW = Math.min(activeW - 16, 280);
            const bannerH = 34;
            const bannerX = camX - bannerW / 2;

            ctx.fillStyle = 'rgba(10, 9, 8, 0.90)';
            ctx.strokeStyle = this.harvestNextShape.accentColor;
            ctx.lineWidth = 1.5;

            ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
            ctx.strokeRect(bannerX, bannerY, bannerW, bannerH);

            ctx.fillStyle = this.harvestNextShape.accentColor;
            ctx.fillText(warningText, camX, bannerY + 11);

            ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
            ctx.fillStyle = '#f5f3ec';
            ctx.fillText(nextText, camX, bannerY + 23);

            ctx.restore();
        }

        // 5. Morph Visual Flash Burst
        if (this.harvestMorphFlashMs > 0) {
            const flashRatio = this.harvestMorphFlashMs / 450;
            ctx.fillStyle = this.harvestShape.accentColor;
            ctx.globalAlpha = flashRatio * 0.28;
            ctx.fillRect(0, 0, bw, bh);
            ctx.globalAlpha = 1.0;
        }

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

    private drawContainmentWalls(now: number) {
        if (this.containmentWalls.length === 0) return;
        const ctx = this.ctx;
        const cell = this.cellSize;

        for (const wall of this.containmentWalls) {
            const isArmed = now >= wall.armAt;
            const remainingMs = wall.expiresAt - now;
            const fadeOut = remainingMs < 1400 ? Math.max(0.15, remainingMs / 1400) : 1;

            ctx.save();
            if (!isArmed) {
                // Fair flashing telegraph blueprint before barrier snaps solid
                const blink = 0.45 + Math.sin(now * 0.032) * 0.4;
                const progress = Math.max(0, Math.min(1, (now - wall.createdAt) / Math.max(1, wall.armAt - wall.createdAt)));
                ctx.globalAlpha = blink;
                ctx.setLineDash([4, 3]);
                ctx.strokeStyle = progress > 0.72 ? ROSE_ACCENT : GOLD_ACCENT;
                ctx.lineWidth = 2;

                for (const c of wall.cells) {
                    const x = c.x * cell + 2;
                    const y = c.y * cell + 2;
                    const s = cell - 4;
                    ctx.fillStyle = 'rgba(251, 113, 133, 0.12)';
                    ctx.fillRect(x, y, s, s);
                    ctx.strokeRect(x, y, s, s);
                }

                // Crisp LOCKING label over middle wall segment
                const mid = wall.cells[Math.floor(wall.cells.length / 2)];
                if (mid) {
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 0.95;
                    ctx.font = '900 9px ui-monospace, SFMono-Regular, Menlo, monospace';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = GOLD_ACCENT;
                    ctx.fillText('LOCKING', (mid.x + 0.5) * cell, mid.y * cell - 4);
                }
            } else {
                // Solid deadly Noir armored containment wall with diagonal hazard stripes
                ctx.globalAlpha = fadeOut;
                for (const c of wall.cells) {
                    const x = c.x * cell + 1.5;
                    const y = c.y * cell + 1.5;
                    const s = cell - 3;

                    ctx.fillStyle = '#2a1418';
                    ctx.fillRect(x, y, s, s);

                    // Crisp diagonal hazard stripe inside block
                    ctx.strokeStyle = 'rgba(251, 113, 133, 0.45)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x + 3, y + s - 3);
                    ctx.lineTo(x + s - 3, y + 3);
                    ctx.stroke();

                    // Armored crimson outer frame
                    ctx.strokeStyle = ROSE_ACCENT;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, s, s);

                    // Inner core rivet dot
                    ctx.fillStyle = ROSE_ACCENT;
                    ctx.fillRect(x + s / 2 - 2, y + s / 2 - 2, 4, 4);
                }
            }
            ctx.restore();
        }
    }

    private drawWeaponDrop(drop: WeaponDrop, now: number) {
        const ctx = this.ctx;
        const cx = (drop.x + 0.5) * this.cellSize;
        const cy = (drop.y + 0.5) * this.cellSize;
        const meta = WEAPON_META[drop.kind];
        const pulse = 1 + Math.sin(now * 0.009 + drop.id) * 0.08;
        const box = this.cellSize * 0.42 * pulse;

        ctx.save();
        ctx.translate(cx, cy);

        // Countdown timer arc around drop
        const totalLife = Math.max(1, drop.expiresAt - drop.createdAt);
        const remaining = Math.max(0, (drop.expiresAt - now) / totalLife);
        ctx.strokeStyle = meta.color;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.cellSize * 0.56, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
        ctx.stroke();

        // Tactical crate square with bold Noir border
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#141210';
        ctx.fillRect(-box, -box, box * 2, box * 2);
        ctx.strokeStyle = meta.color;
        ctx.lineWidth = 2.2;
        ctx.strokeRect(-box, -box, box * 2, box * 2);

        // Inner geometric emblem per weapon type
        ctx.strokeStyle = meta.color;
        ctx.fillStyle = meta.color;
        ctx.lineWidth = 2;
        if (drop.kind === 'railgun') {
            // Piercing horizontal beam bars
            ctx.fillRect(-box * 0.62, -2, box * 1.24, 4);
            ctx.fillStyle = '#f5f3ec';
            ctx.fillRect(-box * 0.46, -0.8, box * 0.92, 1.6);
        } else if (drop.kind === 'nova') {
            // Concentric shockwave diamond
            ctx.save();
            ctx.rotate(Math.PI / 4);
            const r = box * 0.52;
            ctx.strokeRect(-r, -r, r * 2, r * 2);
            ctx.fillRect(-r * 0.38, -r * 0.38, r * 0.76, r * 0.76);
            ctx.restore();
        } else {
            // Plasma lance chevron arrow
            ctx.beginPath();
            ctx.moveTo(box * 0.58, 0);
            ctx.lineTo(-box * 0.38, -box * 0.44);
            ctx.lineTo(-box * 0.12, 0);
            ctx.lineTo(-box * 0.38, box * 0.44);
            ctx.closePath();
            ctx.fill();
        }

        // Crisp micro monospace label below crate
        ctx.font = '900 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = NOIR_BG;
        ctx.fillText(`${meta.shortTag} 1×`, 1, this.cellSize * 0.8 + 1);
        ctx.fillStyle = meta.color;
        ctx.fillText(`${meta.shortTag} 1×`, 0, this.cellSize * 0.8);

        ctx.restore();
    }

    private drawArmedPlayerIndicator(alpha: number, now: number) {
        if (!this.heldWeapon || this.playerSegments.length === 0) return;
        const ctx = this.ctx;
        const meta = WEAPON_META[this.heldWeapon];
        const seg = this.playerSegments[0];
        const prev = this.playerPrevSegments[0] || seg;
        const hx = (prev.x + (seg.x - prev.x) * alpha + 0.5) * this.cellSize;
        const hy = (prev.y + (seg.y - prev.y) * alpha + 0.5) * this.cellSize;
        const pulse = 0.72 + Math.sin(now * 0.014) * 0.28;
        const half = this.cellSize * 0.52;
        const tick = this.cellSize * 0.18;

        ctx.save();
        ctx.translate(hx, hy);
        ctx.strokeStyle = meta.color;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 2;

        // 4 crisp corner target brackets around player head
        ctx.beginPath();
        ctx.moveTo(-half, -half + tick);
        ctx.lineTo(-half, -half);
        ctx.lineTo(-half + tick, -half);

        ctx.moveTo(half - tick, -half);
        ctx.lineTo(half, -half);
        ctx.lineTo(half, -half + tick);

        ctx.moveTo(-half, half - tick);
        ctx.lineTo(-half, half);
        ctx.lineTo(-half + tick, half);

        ctx.moveTo(half - tick, half);
        ctx.lineTo(half, half);
        ctx.lineTo(half, half - tick);
        ctx.stroke();

        // Forward aim sightline pip for directional weapons (Rail Beam / Plasma Lance)
        if (this.heldWeapon === 'railgun' || this.heldWeapon === 'bolt') {
            const vec = DIR_VECTORS[this.playerDir];
            const aimX = vec.x * this.cellSize * 1.15;
            const aimY = vec.y * this.cellSize * 1.15;
            ctx.fillStyle = meta.color;
            ctx.fillRect(aimX - 3, aimY - 3, 6, 6);
        }

        ctx.restore();
    }

    private drawBoostCooldownIndicator(alpha: number) {
        if (this.boostCooldownMs <= 0 || this.boostCooldownMaxMs <= 0 || this.playerSegments.length === 0) return;
        const ctx = this.ctx;
        const seg = this.playerSegments[0];
        const prev = this.playerPrevSegments[0] || seg;
        const hx = (prev.x + (seg.x - prev.x) * alpha + 0.5) * this.cellSize;
        const hy = (prev.y + (seg.y - prev.y) * alpha + 0.5) * this.cellSize;
        const ratio = Math.max(0, Math.min(1, this.boostCooldownMs / this.boostCooldownMaxMs));

        const barW = Math.max(22, this.cellSize * 0.85);
        const barH = 3.5;
        const bx = hx - barW / 2;
        const by = hy + this.cellSize * 0.52;

        ctx.save();
        ctx.fillStyle = '#0a0908';
        ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#2e2924';
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = this.boostOverheated ? ROSE_ACCENT : GOLD_ACCENT;
        ctx.fillRect(bx, by, barW * ratio, barH);
        ctx.restore();
    }

    private drawWeaponBeams(now: number) {
        if (this.weaponBeams.length === 0) return;
        const ctx = this.ctx;

        for (const beam of this.weaponBeams) {
            const t = (now - beam.createdAt) / beam.duration;
            if (t < 0 || t > 1) continue;
            const fade = 1 - t;

            ctx.save();
            ctx.lineCap = 'square';

            // Outer corridor glow rail (flat solid opacity)
            ctx.strokeStyle = beam.color;
            ctx.globalAlpha = fade * 0.32;
            ctx.lineWidth = this.cellSize * (1.8 - t * 0.7);
            ctx.beginPath();
            ctx.moveTo(beam.startX, beam.startY);
            ctx.lineTo(beam.endX, beam.endY);
            ctx.stroke();

            // Main Noir laser body
            ctx.globalAlpha = fade * 0.92;
            ctx.lineWidth = this.cellSize * (0.56 - t * 0.28);
            ctx.beginPath();
            ctx.moveTo(beam.startX, beam.startY);
            ctx.lineTo(beam.endX, beam.endY);
            ctx.stroke();

            // Crisp ivory center rail
            ctx.strokeStyle = '#f5f3ec';
            ctx.globalAlpha = fade;
            ctx.lineWidth = Math.max(2, this.cellSize * (0.18 - t * 0.1));
            ctx.beginPath();
            ctx.moveTo(beam.startX, beam.startY);
            ctx.lineTo(beam.endX, beam.endY);
            ctx.stroke();

            ctx.restore();
        }
    }

    private drawProjectiles() {
        if (this.projectiles.length === 0) return;
        const ctx = this.ctx;

        for (const proj of this.projectiles) {
            ctx.save();

            // Geometric afterimage trail
            if (proj.trail.length > 1) {
                ctx.strokeStyle = proj.color;
                ctx.lineWidth = Math.max(3, this.cellSize * 0.2);
                ctx.lineCap = 'square';
                ctx.globalAlpha = 0.55;
                ctx.beginPath();
                for (let i = 0; i < proj.trail.length; i++) {
                    const pt = proj.trail[i];
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
            }

            // Sharp diamond-tipped vector lance head
            const angle =
                proj.dir === 'RIGHT'
                    ? 0
                    : proj.dir === 'DOWN'
                        ? Math.PI / 2
                        : proj.dir === 'LEFT'
                            ? Math.PI
                            : -Math.PI / 2;
            const len = this.cellSize * 0.64;
            const wid = this.cellSize * 0.3;

            ctx.translate(proj.worldX, proj.worldY);
            ctx.rotate(angle);
            ctx.globalAlpha = 1;
            ctx.fillStyle = proj.color;
            ctx.beginPath();
            ctx.moveTo(len, 0);
            ctx.lineTo(-len * 0.45, -wid);
            ctx.lineTo(-len * 0.2, 0);
            ctx.lineTo(-len * 0.45, wid);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#f5f3ec';
            ctx.fillRect(-2, -2, len * 0.55, 4);

            ctx.restore();
        }
    }

    private drawPulseRings(now: number) {
        const ctx = this.ctx;
        for (const ring of this.pulseRings) {
            const t = (now - ring.createdAt) / ring.duration;
            if (t < 0 || t > 1) continue;
            const eased = 1 - Math.pow(1 - t, 3);
            const maxCells = ring.maxRadiusCells ?? 4.2;
            const half = this.cellSize * (0.6 + eased * maxCells);

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

        // Off-screen dropped weapon beacons when player is unarmed
        if (this.heldWeapon === null) {
            for (const drop of this.weaponDrops) {
                const sx = (drop.x + 0.5) * this.cellSize - this.camX + this.width / 2;
                const sy = (drop.y + 0.5) * this.cellSize - this.camY + this.height / 2;
                if (sx >= 14 && sx <= this.width - 14 && sy >= 14 && sy <= this.height - 14) {
                    continue;
                }
                const clampedX = Math.max(margin, Math.min(this.width - margin, sx));
                const clampedY = Math.max(margin, Math.min(this.height - margin - this.bottomSafeInset, sy));
                const meta = WEAPON_META[drop.kind];

                ctx.save();
                ctx.translate(clampedX, clampedY);
                ctx.rotate(Math.PI / 4);
                ctx.globalAlpha = pulse;
                ctx.fillStyle = '#141210';
                ctx.fillRect(-6, -6, 12, 12);
                ctx.strokeStyle = meta.color;
                ctx.lineWidth = 2;
                ctx.strokeRect(-6, -6, 12, 12);
                ctx.fillStyle = meta.color;
                ctx.fillRect(-2.5, -2.5, 5, 5);
                ctx.restore();
            }
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

        // Containment Wall blips on radar
        for (const wall of this.containmentWalls) {
            const armed = now >= wall.armAt;
            ctx.fillStyle = armed ? ROSE_ACCENT : GOLD_ACCENT;
            ctx.globalAlpha = armed ? 0.92 : 0.6;
            for (const c of wall.cells) {
                const dx = c.x - head.x;
                const dy = c.y - head.y;
                if (Math.abs(dx) > radarRadiusCells || Math.abs(dy) > radarRadiusCells) continue;
                ctx.fillRect(centerX + dx * scale - 1.5, centerY + dy * scale - 1.5, 3, 3);
            }
        }
        ctx.globalAlpha = 1;

        // Dropped weapon cross blips on radar
        const blink = 0.75 + Math.sin(now * 0.012) * 0.25;
        for (const w of this.weaponDrops) {
            const dx = Math.max(-radarRadiusCells, Math.min(radarRadiusCells, w.x - head.x));
            const dy = Math.max(-radarRadiusCells, Math.min(radarRadiusCells, w.y - head.y));
            const wx = centerX + dx * scale;
            const wy = centerY + dy * scale;
            ctx.strokeStyle = WEAPON_META[w.kind].color;
            ctx.globalAlpha = 0.95;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(wx - 3.5, wy);
            ctx.lineTo(wx + 3.5, wy);
            ctx.moveTo(wx, wy - 3.5);
            ctx.lineTo(wx, wy + 3.5);
            ctx.stroke();
        }

        // Hunter blips
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
