import type { AvatarConfig } from '../../types';
import type { DashItemKind } from './bentoArcadeTypes';
import { bentoArcadeAudio } from './bentoArcadeAudio';
import { drawThirdPersonAvatar } from './paperDash3dAvatar';

type DeckSide = 'floor' | 'ceiling';
type EnemyKind = 'hoverbot' | 'inkspiker' | 'lasergate' | 'block';

interface TrackSegment {
    id: number;
    zStart: number;
    zEnd: number;
    deck: DeckSide;
    lanes: [boolean, boolean, boolean];
    hazardLip: [boolean, boolean, boolean];
    color: string;
    boostLane: number | null;
    springLane: number | null;
    portalGate: boolean;
}

interface Dash3DEnemy {
    id: number;
    kind: EnemyKind;
    deck: DeckSide;
    lane: number; // -1..1 float for HoverBot patrol
    baseLane: number;
    z: number;
    yOffset: number; // 0 = deck surface, >0 = elevated
    patrolDir: number;
    patrolSpeed: number;
    smashed: boolean;
    nearMissed: boolean;
}

interface Dash3DCollectible {
    id: number;
    deck: DeckSide;
    lane: number;
    x: number;
    y: number;
    z: number;
    kind: 'coin' | DashItemKind;
    collected: boolean;
}

interface Dash3DParticle {
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

interface Dash3DPopup {
    x: number;
    y: number;
    text: string;
    bg: string;
    life: number;
    maxLife: number;
}

export interface Dash3DTelemetry {
    distanceMeters: number;
    coinsCollected: number;
    hasShield: boolean;
    speedMultiplier: number;
    gravityInverted: boolean;
    ultCharge: number;
    ultActiveSec: number;
    inventoryItems: DashItemKind[];
    activeDashBuffs: {
        magnetSec: number;
        rocketSec: number;
        slowmoSec: number;
    };
    enemiesDefeated: number;
    nearMissCount: number;
    score: number;
    runXpDelta: number;
    comboAdd: number;
}

export interface Dash3DUpdateResult {
    gameOver: boolean;
    deathReason: 'fall' | 'obstacle' | 'enemy' | null;
    xpEarned: number;
    xpLabel?: string;
    xpColor?: string;
    scoreAdded: number;
    comboIncrement: number;
    shakeMs: number;
    shakeMag: number;
}

const INK_BLACK = '#000000';
const WHITE = '#ffffff';
const LIME = '#bef264';
const YELLOW = '#fde047';
const SKY = '#bae6fd';
const PEACH = '#fed7aa';
const CORAL = '#fb7185';
const PURPLE = '#c084fc';

const DECK_HEIGHT = 9.6;
const LANE_SPACING = 2.25;
const MAX_Z = 116;
const PLAYER_Z = 10.5;
const SEG_LEN = 10.2;
const CAM_ELEVATION = 4.65;
const CAM_DIST_BASE = 9.2;
const CAM_PITCH_BASE = 0.215;
const FLIP_DURATION_MS = 420;
const FALL_DEATH_DURATION_MS = 760;
const TRACK_COLORS = [SKY, PEACH, LIME, '#fbcfe8', '#fde68a'];

export class PaperDash3DEngine {
    private avatarConfig: Partial<AvatarConfig> | null = null;
    private width = 800;
    private height = 600;

    private nextId = 1;
    private worldZ = 0;
    private baseSpeed = 23;
    private speed = 23;
    private distanceMeters = 0;
    private coinsCollected = 0;
    private enemiesDefeated = 0;
    private nearMissCount = 0;

    // Player lane & physics
    private targetLane = 0; // -1, 0, 1
    private playerLaneX = 0;
    private laneTilt = 0;
    private deck: DeckSide = 'floor';
    private playerY = 0; // world Y (0 at floor, DECK_HEIGHT at overhead ceiling)
    private playerVy = 0;
    private onDeck = true;
    private jumpsLeft = 2;
    private slideMs = 0;
    private flipCooldownMs = 0;
    private runPhase = 0;
    private hitFlashMs = 0;
    private shockwaveRingMs = 0;

    // Camera & enhanced flip / abyss fall states
    private cameraRoll = 0;
    private cameraY = CAM_ELEVATION;
    private flipAnimMs = 0;
    private flipFromRoll = 0;
    private flipToRoll = 0;
    private awaitingFlipLand = false;
    private flipStreakParticlesAcc = 0;
    private fallDeathMs = 0;
    private forceSolidPairs = 0;

    // Buffs, Items & ULT
    private hasShield = false;
    private inventoryItems: DashItemKind[] = [];
    private magnetMs = 0;
    private rocketMs = 0;
    private slowmoMs = 0;
    private ultCharge = 0; // 0..100
    private ultMs = 0;
    private invertedBonusAcc = 0;

    // Cached per-frame camera projection trig (computed once per frame instead of 600+ times)
    private pCamZ = PLAYER_Z - CAM_DIST_BASE;
    private pFocal = 380;
    private pCamX = 0;
    private pScreenCy = 300;
    private pCosR = 1;
    private pSinR = 0;
    private pCosP = Math.cos(CAM_PITCH_BASE);
    private pSinP = Math.sin(CAM_PITCH_BASE);

    // Entities
    private segments: TrackSegment[] = [];
    private enemies: Dash3DEnemy[] = [];
    private collectibles: Dash3DCollectible[] = [];
    private spawnCursorZ = 0;
    private particles: Dash3DParticle[] = [];
    private popups: Dash3DPopup[] = [];

    public setAvatarConfig(avatar?: Partial<AvatarConfig> | null) {
        this.avatarConfig = avatar ?? null;
    }

    public resize(width: number, height: number) {
        this.width = Math.max(320, width);
        this.height = Math.max(240, height);
    }

    public reset(width: number, height: number) {
        this.resize(width, height);
        this.nextId = 1;
        this.worldZ = 0;
        this.baseSpeed = width < 640 ? 20.5 : 23.5;
        this.speed = this.baseSpeed;
        this.distanceMeters = 0;
        this.coinsCollected = 0;
        this.enemiesDefeated = 0;
        this.nearMissCount = 0;

        this.targetLane = 0;
        this.playerLaneX = 0;
        this.laneTilt = 0;
        this.deck = 'floor';
        this.playerY = 0;
        this.playerVy = 0;
        this.onDeck = true;
        this.jumpsLeft = 2;
        this.slideMs = 0;
        this.flipCooldownMs = 0;
        this.runPhase = 0;
        this.hitFlashMs = 0;
        this.shockwaveRingMs = 0;

        this.cameraRoll = 0;
        this.cameraY = CAM_ELEVATION;
        this.flipAnimMs = 0;
        this.flipFromRoll = 0;
        this.flipToRoll = 0;
        this.awaitingFlipLand = false;
        this.flipStreakParticlesAcc = 0;
        this.fallDeathMs = 0;
        this.forceSolidPairs = 0;

        this.hasShield = false;
        this.inventoryItems = [];
        this.magnetMs = 0;
        this.rocketMs = 0;
        this.slowmoMs = 0;
        this.ultCharge = 20;
        this.ultMs = 0;
        this.invertedBonusAcc = 0;

        this.segments = [];
        this.enemies = [];
        this.collectibles = [];
        this.particles = [];
        this.popups = [];
        this.spawnCursorZ = 0;

        // Safe starter runway on both floor and overhead upside-down track
        for (let i = 0; i < 4; i++) {
            this.pushSegmentPair(true);
        }
        while (this.spawnCursorZ < MAX_Z + 20) {
            this.pushSegmentPair(false);
        }
    }

    public moveLane(delta: -1 | 1) {
        if (this.fallDeathMs > 0) return;
        const effectiveDelta = this.deck === 'ceiling' ? (-delta as -1 | 1) : delta;
        const next = Math.max(-1, Math.min(1, this.targetLane + effectiveDelta));
        if (next !== this.targetLane) {
            this.targetLane = next;
            this.laneTilt = delta * 1.1;
            bentoArcadeAudio.playPaddleBounce();
        }
    }

    public jump() {
        if (this.fallDeathMs > 0 || this.jumpsLeft <= 0) return;
        const isDouble = !this.onDeck;
        const dir = this.deck === 'floor' ? 1 : -1;
        this.playerVy = dir * (isDouble ? 14.2 : 15.8);
        this.onDeck = false;
        this.slideMs = 0;
        this.jumpsLeft -= 1;
        bentoArcadeAudio.playJump(isDouble);
        const feet = this.project(this.playerLaneX, this.playerY, PLAYER_Z);
        this.spawnScreenParticles(
            feet ? feet.sx : this.width / 2,
            feet ? feet.sy : this.height * 0.78,
            isDouble ? SKY : WHITE,
            isDouble ? 8 : 5
        );
    }

    public slideOrDrop() {
        if (this.fallDeathMs > 0) return;
        const dir = this.deck === 'floor' ? 1 : -1;
        if (!this.onDeck) {
            this.playerVy = -dir * 26;
            bentoArcadeAudio.playSlam();
            return;
        }
        if (this.slideMs <= 0) {
            this.slideMs = 560;
            bentoArcadeAudio.playSlam();
        }
    }

    public flipGravity() {
        if (this.fallDeathMs > 0 || this.flipCooldownMs > 0) return;
        this.deck = this.deck === 'floor' ? 'ceiling' : 'floor';
        this.onDeck = false;
        this.jumpsLeft = 1;
        this.slideMs = 0;
        this.flipCooldownMs = 280;
        this.flipFromRoll = this.cameraRoll;
        this.flipToRoll = this.deck === 'ceiling' ? Math.PI : 0;
        this.flipAnimMs = FLIP_DURATION_MS;
        this.awaitingFlipLand = true;
        const dir = this.deck === 'floor' ? -1 : 1;
        this.playerVy = dir * 19.5;
        bentoArcadeAudio.playGravityFlip(this.deck === 'ceiling');
        const feet = this.project(this.playerLaneX, this.playerY, PLAYER_Z);
        this.spawnScreenParticles(
            feet ? feet.sx : this.width / 2,
            feet ? feet.sy : this.height * 0.68,
            this.deck === 'ceiling' ? PURPLE : SKY,
            14
        );
        this.spawnPopup(
            this.deck === 'ceiling' ? '⇅ GRAVITY FLIP 1.5×!' : '⇅ FLOOR TRACK!',
            this.deck === 'ceiling' ? PURPLE : SKY
        );
    }

    public useItem(slotIndex = 0) {
        if (this.fallDeathMs > 0 || this.inventoryItems.length === 0) return;
        const idx = slotIndex >= 0 && slotIndex < this.inventoryItems.length ? slotIndex : 0;
        const kind = this.inventoryItems[idx];
        this.inventoryItems.splice(idx, 1);
        this.applyItemEffect(kind);
    }

    private applyItemEffect(kind: DashItemKind) {
        bentoArcadeAudio.playItemUse(kind);
        const feet = this.project(this.playerLaneX, this.playerY, PLAYER_Z);
        const px = feet ? feet.sx : this.width / 2;
        const py = feet ? feet.sy - 20 : this.height * 0.72;

        if (kind === 'magnet') {
            this.magnetMs = 6500;
            this.spawnPopup('🧲 COIN MAGNET!', YELLOW);
        } else if (kind === 'shield') {
            this.hasShield = true;
            this.spawnPopup('🛡️ PAPER SHIELD!', SKY);
        } else if (kind === 'rocket') {
            this.rocketMs = 4200;
            this.spawnPopup('🚀 NITRO ROCKET!', PEACH);
        } else if (kind === 'slowmo') {
            this.slowmoMs = 5200;
            this.spawnPopup('⏱️ SLOW-MO!', PURPLE);
        } else if (kind === 'shockwave') {
            this.shockwaveRingMs = 480;
            let cleared = 0;
            for (const e of this.enemies) {
                if (!e.smashed && e.z > PLAYER_Z - 2 && e.z < PLAYER_Z + 56) {
                    e.smashed = true;
                    cleared += 1;
                    this.enemiesDefeated += 1;
                    this.ultCharge = Math.min(100, this.ultCharge + 8);
                }
            }
            this.spawnScreenParticles(px, py, LIME, 16);
            this.spawnPopup(cleared > 0 ? `⚡ SHOCKWAVE ×${cleared}!` : '⚡ SHOCKWAVE!', LIME);
        }
    }

    public activateUlt() {
        if (this.fallDeathMs > 0 || this.ultMs > 0 || this.ultCharge < 100) return;
        this.ultCharge = 0;
        this.ultMs = 6000;
        bentoArcadeAudio.playUltActivate();
        const feet = this.project(this.playerLaneX, this.playerY, PLAYER_Z);
        this.spawnScreenParticles(feet ? feet.sx : this.width / 2, feet ? feet.sy - 20 : this.height * 0.72, YELLOW, 20);
        this.spawnPopup('⚡ OVERDRIVE 2×!', LIME);
    }

    public getTelemetry(): Omit<Dash3DTelemetry, 'score' | 'runXpDelta' | 'comboAdd'> {
        return {
            distanceMeters: Math.floor(this.distanceMeters),
            coinsCollected: this.coinsCollected,
            hasShield: this.hasShield,
            speedMultiplier: Number((this.speed / this.baseSpeed).toFixed(1)),
            gravityInverted: this.deck === 'ceiling',
            ultCharge: Math.floor(this.ultCharge),
            ultActiveSec: Math.ceil(this.ultMs / 1000),
            inventoryItems: [...this.inventoryItems],
            activeDashBuffs: {
                magnetSec: Math.ceil(this.magnetMs / 1000),
                rocketSec: Math.ceil(this.rocketMs / 1000),
                slowmoSec: Math.ceil(this.slowmoMs / 1000),
            },
            enemiesDefeated: this.enemiesDefeated,
            nearMissCount: this.nearMissCount,
        };
    }

    private pushSegmentPair(isSafeStarter: boolean) {
        const zStart = this.spawnCursorZ;
        const zEnd = zStart + SEG_LEN;
        const color = TRACK_COLORS[(this.nextId >> 1) % TRACK_COLORS.length];

        let floorLanes: [boolean, boolean, boolean] = [true, true, true];
        let ceilLanes: [boolean, boolean, boolean] = [true, true, true];
        let hasPortal = false;

        if (!isSafeStarter && this.forceSolidPairs > 0) {
            this.forceSolidPairs -= 1;
        } else if (!isSafeStarter) {
            const roll = Math.random();
            if (roll < 0.16) {
                const missing = Math.floor(Math.random() * 3);
                floorLanes = [missing !== 0, missing !== 1, missing !== 2];
            } else if (roll < 0.28) {
                const keep = Math.floor(Math.random() * 3);
                floorLanes = [keep === 0, keep === 1, keep === 2];
                hasPortal = Math.random() < 0.45;
            } else if (roll < 0.38) {
                const keep = Math.floor(Math.random() * 3);
                ceilLanes = [keep === 0, keep === 1, keep === 2];
                hasPortal = Math.random() < 0.45;
            } else if (roll < 0.48) {
                hasPortal = true;
            }
        }

        if (hasPortal) {
            floorLanes = [true, true, true];
            ceilLanes = [true, true, true];
            this.forceSolidPairs = 1;
        }

        const prevFloor = this.segments.length >= 2 ? this.segments[this.segments.length - 2] : undefined;
        const prevCeil = this.segments.length >= 1 ? this.segments[this.segments.length - 1] : undefined;
        if (prevFloor && prevFloor.deck === 'floor') {
            for (let i = 0; i < 3; i++) {
                if (prevFloor.lanes[i] && !floorLanes[i]) {
                    prevFloor.hazardLip[i] = true;
                }
            }
        }
        if (prevCeil && prevCeil.deck === 'ceiling') {
            for (let i = 0; i < 3; i++) {
                if (prevCeil.lanes[i] && !ceilLanes[i]) {
                    prevCeil.hazardLip[i] = true;
                }
            }
        }

        const boostLane = !isSafeStarter && Math.random() < 0.22 ? Math.floor(Math.random() * 3) : null;
        const springLane =
            !isSafeStarter && boostLane === null && Math.random() < 0.18 ? Math.floor(Math.random() * 3) : null;

        this.segments.push({
            id: this.nextId++,
            zStart,
            zEnd,
            deck: 'floor',
            lanes: floorLanes,
            hazardLip: [false, false, false],
            color,
            boostLane: boostLane !== null && floorLanes[boostLane] ? boostLane - 1 : null,
            springLane: springLane !== null && floorLanes[springLane] ? springLane - 1 : null,
            portalGate: hasPortal,
        });

        this.segments.push({
            id: this.nextId++,
            zStart,
            zEnd,
            deck: 'ceiling',
            lanes: ceilLanes,
            hazardLip: [false, false, false],
            color: color === PEACH ? SKY : color,
            boostLane:
                !isSafeStarter && Math.random() < 0.2
                    ? (() => {
                          const l = Math.floor(Math.random() * 3);
                          return ceilLanes[l] ? l - 1 : null;
                      })()
                    : null,
            springLane: null,
            portalGate: false,
        });

        if (!isSafeStarter) {
            this.populateSegmentEntities(zStart, zEnd, floorLanes, ceilLanes, hasPortal);
        } else {
            this.collectibles.push({
                id: this.nextId++,
                deck: 'floor',
                lane: 0,
                x: 0,
                y: 0.7,
                z: zStart + SEG_LEN * 0.5,
                kind: 'coin',
                collected: false,
            });
        }

        this.spawnCursorZ = zEnd;
    }

    private populateSegmentEntities(
        zStart: number,
        zEnd: number,
        floorLanes: [boolean, boolean, boolean],
        ceilLanes: [boolean, boolean, boolean],
        hasPortal: boolean
    ) {
        const midZ = (zStart + zEnd) * 0.5;
        const validFloor = [0, 1, 2].filter((i) => floorLanes[i]).map((i) => i - 1);
        const validCeil = [0, 1, 2].filter((i) => ceilLanes[i]).map((i) => i - 1);

        if (validFloor.length > 0 && Math.random() < 0.72) {
            const lane = validFloor[Math.floor(Math.random() * validFloor.length)];
            for (let k = 0; k < 3; k++) {
                this.collectibles.push({
                    id: this.nextId++,
                    deck: 'floor',
                    lane,
                    x: lane * LANE_SPACING,
                    y: 0.75,
                    z: zStart + 2 + k * 2.5,
                    kind: 'coin',
                    collected: false,
                });
            }
        }
        if (validCeil.length > 0 && Math.random() < 0.78) {
            const lane = validCeil[Math.floor(Math.random() * validCeil.length)];
            for (let k = 0; k < 3; k++) {
                this.collectibles.push({
                    id: this.nextId++,
                    deck: 'ceiling',
                    lane,
                    x: lane * LANE_SPACING,
                    y: DECK_HEIGHT - 0.75,
                    z: zStart + 2 + k * 2.5,
                    kind: 'coin',
                    collected: false,
                });
            }
        }

        if (Math.random() < 0.24) {
            const items: DashItemKind[] = ['magnet', 'shield', 'rocket', 'shockwave', 'slowmo'];
            const kind = items[Math.floor(Math.random() * items.length)];
            const onCeil = Math.random() < 0.45 && validCeil.length > 0;
            const pool = onCeil ? validCeil : validFloor;
            if (pool.length > 0) {
                const lane = pool[Math.floor(Math.random() * pool.length)];
                this.collectibles.push({
                    id: this.nextId++,
                    deck: onCeil ? 'ceiling' : 'floor',
                    lane,
                    x: lane * LANE_SPACING,
                    y: onCeil ? DECK_HEIGHT - 0.85 : 0.85,
                    z: midZ + 1.5,
                    kind,
                    collected: false,
                });
            }
        }

        if (hasPortal) return;

        if (validFloor.length > 0 && Math.random() < 0.68) {
            const lane = validFloor[Math.floor(Math.random() * validFloor.length)];
            const roll = Math.random();
            const kind: EnemyKind =
                roll < 0.28 ? 'hoverbot' : roll < 0.54 ? 'inkspiker' : roll < 0.78 ? 'lasergate' : 'block';
            this.enemies.push({
                id: this.nextId++,
                kind,
                deck: 'floor',
                lane,
                baseLane: lane,
                z: midZ,
                yOffset: kind === 'lasergate' && Math.random() < 0.5 ? 1.15 : 0,
                patrolDir: Math.random() < 0.5 ? 1 : -1,
                patrolSpeed: 1.15,
                smashed: false,
                nearMissed: false,
            });
        }

        if (validCeil.length > 0 && Math.random() < 0.62) {
            const lane = validCeil[Math.floor(Math.random() * validCeil.length)];
            const roll = Math.random();
            const kind: EnemyKind =
                roll < 0.34 ? 'hoverbot' : roll < 0.64 ? 'inkspiker' : roll < 0.85 ? 'lasergate' : 'block';
            this.enemies.push({
                id: this.nextId++,
                kind,
                deck: 'ceiling',
                lane,
                baseLane: lane,
                z: midZ + 1.2,
                yOffset: kind === 'lasergate' && Math.random() < 0.5 ? 1.15 : 0,
                patrolDir: Math.random() < 0.5 ? 1 : -1,
                patrolSpeed: 1.15,
                smashed: false,
                nearMissed: false,
            });
        }
    }

    public update(dtSec: number): Dash3DUpdateResult {
        const dtMs = dtSec * 1000;
        let xpEarned = 0;
        let xpLabel: string | undefined;
        let xpColor = LIME;
        let scoreAdded = 0;
        let comboIncrement = 0;
        let shakeMs = 0;
        let shakeMag = 0;

        if (this.magnetMs > 0) this.magnetMs = Math.max(0, this.magnetMs - dtMs);
        if (this.rocketMs > 0) this.rocketMs = Math.max(0, this.rocketMs - dtMs);
        if (this.slowmoMs > 0) this.slowmoMs = Math.max(0, this.slowmoMs - dtMs);
        if (this.ultMs > 0) this.ultMs = Math.max(0, this.ultMs - dtMs);
        if (this.slideMs > 0) this.slideMs = Math.max(0, this.slideMs - dtMs);
        if (this.flipCooldownMs > 0) this.flipCooldownMs = Math.max(0, this.flipCooldownMs - dtMs);
        if (this.hitFlashMs > 0) this.hitFlashMs = Math.max(0, this.hitFlashMs - dtMs);
        if (this.shockwaveRingMs > 0) this.shockwaveRingMs = Math.max(0, this.shockwaveRingMs - dtMs);

        // Abyss fall sequence
        if (this.fallDeathMs > 0) {
            this.fallDeathMs += dtMs;
            const brakeDz = this.speed * dtSec * 0.16;
            this.worldZ += brakeDz;
            this.runPhase += dtSec * 22;

            const gravDir = this.deck === 'floor' ? -1 : 1;
            this.playerVy += gravDir * 52 * dtSec;
            this.playerY += this.playerVy * dtSec;

            for (const seg of this.segments) {
                seg.zStart -= brakeDz;
                seg.zEnd -= brakeDz;
            }
            for (const c of this.collectibles) c.z -= brakeDz;
            for (const e of this.enemies) e.z -= brakeDz;
            this.spawnCursorZ -= brakeDz;

            if (Math.random() < 0.7) {
                const feet = this.project(this.playerLaneX, this.playerY, PLAYER_Z);
                if (feet) {
                    this.particles.push({
                        x: feet.sx + (Math.random() - 0.5) * 44,
                        y: feet.sy - 20,
                        vx: (Math.random() - 0.5) * 40,
                        vy: -240 - Math.random() * 140,
                        size: 4 + Math.random() * 4,
                        color: Math.random() < 0.5 ? WHITE : CORAL,
                        rot: Math.random() * Math.PI,
                        vRot: (Math.random() - 0.5) * 8,
                        life: 0,
                        maxLife: 320,
                    });
                }
            }
            this.updateParticlesAndPopups(dtSec, dtMs);

            if (this.fallDeathMs >= FALL_DEATH_DURATION_MS) {
                return {
                    gameOver: true,
                    deathReason: 'fall',
                    xpEarned: 0,
                    scoreAdded: 0,
                    comboIncrement: 0,
                    shakeMs: 280,
                    shakeMag: 9,
                };
            }
            return {
                gameOver: false,
                deathReason: null,
                xpEarned: 0,
                scoreAdded: 0,
                comboIncrement: 0,
                shakeMs: 55,
                shakeMag: 3.5,
            };
        }

        // Speed & distance
        const ramp = Math.min(20, this.distanceMeters * 0.022);
        const slowFactor = this.slowmoMs > 0 ? 0.55 : 1;
        const boostFactor = this.ultMs > 0 ? 1.48 : this.rocketMs > 0 ? 1.55 : 1;
        this.speed = (this.baseSpeed + ramp) * slowFactor * boostFactor;

        const dz = this.speed * dtSec;
        this.worldZ += dz;
        this.distanceMeters += dz * 0.65;

        const deckMult = this.deck === 'ceiling' ? 1.5 : 1;
        const ultMult = this.ultMs > 0 ? 2 : 1;
        scoreAdded += dz * 2.4 * deckMult * ultMult;

        if (this.deck === 'ceiling') {
            this.ultCharge = Math.min(100, this.ultCharge + 4 * dtSec);
            this.invertedBonusAcc += dtSec;
            if (this.invertedBonusAcc >= 2.5) {
                this.invertedBonusAcc = 0;
                xpEarned += 6;
                xpLabel = 'INVERTED';
                xpColor = PURPLE;
            }
        }

        // Smooth lane X & tilt
        const targetX = this.targetLane * LANE_SPACING;
        this.playerLaneX += (targetX - this.playerLaneX) * Math.min(1, dtSec * 15);
        this.laneTilt += (0 - this.laneTilt) * Math.min(1, dtSec * 10);
        this.runPhase += dtSec * (this.speed * 0.65);

        // Smooth S-curve camera roll (0 on floor, PI on overhead ceiling) & elevated Subway cam height
        const targetRoll = this.deck === 'ceiling' ? Math.PI : 0;
        if (this.flipAnimMs > 0) {
            this.flipAnimMs = Math.max(0, this.flipAnimMs - dtMs);
            const u = 1 - this.flipAnimMs / FLIP_DURATION_MS;
            const ease = u * u * (3 - 2 * u);
            this.cameraRoll = this.flipFromRoll + (this.flipToRoll - this.flipFromRoll) * ease;

            this.flipStreakParticlesAcc += dtSec * 32;
            while (this.flipStreakParticlesAcc >= 1) {
                this.flipStreakParticlesAcc -= 1;
                const side = Math.random() < 0.5 ? 0.08 + Math.random() * 0.14 : 0.78 + Math.random() * 0.14;
                this.particles.push({
                    x: this.width * side,
                    y: this.height * (0.25 + Math.random() * 0.5),
                    vx: (Math.random() - 0.5) * 30,
                    vy: this.deck === 'ceiling' ? 280 : -280,
                    size: 5 + Math.random() * 4,
                    color: Math.random() < 0.5 ? PURPLE : SKY,
                    rot: 0,
                    vRot: 0,
                    life: 0,
                    maxLife: 240,
                });
            }
        } else {
            this.cameraRoll += (targetRoll - this.cameraRoll) * Math.min(1, dtSec * 12);
        }

        const jumpFromDeck =
            this.deck === 'floor' ? Math.max(0, this.playerY) : Math.max(0, DECK_HEIGHT - this.playerY);
        const targetCamY =
            this.deck === 'ceiling'
                ? DECK_HEIGHT - CAM_ELEVATION - jumpFromDeck * 0.22
                : CAM_ELEVATION + jumpFromDeck * 0.22;
        this.cameraY += (targetCamY - this.cameraY) * Math.min(1, dtSec * (this.flipAnimMs > 0 ? 12 : 8));

        // Vertical gravity
        const gravDir = this.deck === 'floor' ? -1 : 1;
        const gravAccel = this.awaitingFlipLand ? 62 : 42;
        this.playerVy += gravDir * gravAccel * dtSec;
        this.playerY += this.playerVy * dtSec;

        // Scroll segments & generate ahead
        for (const seg of this.segments) {
            seg.zStart -= dz;
            seg.zEnd -= dz;
        }
        this.segments = this.segments.filter((s) => s.zEnd > -15);
        this.spawnCursorZ -= dz;
        while (this.spawnCursorZ < MAX_Z + 25) {
            this.pushSegmentPair(false);
        }

        const currentLaneIdx = Math.max(0, Math.min(2, Math.round(this.playerLaneX / LANE_SPACING) + 1));
        const activeSeg = this.segments.find(
            (s) => s.deck === this.deck && s.zStart <= PLAYER_Z && s.zEnd >= PLAYER_Z
        );
        const hasFloorUnder = Boolean(activeSeg && activeSeg.lanes[currentLaneIdx]);

        // Portal gate auto-flip check
        if (activeSeg && activeSeg.portalGate && Math.abs((activeSeg.zStart + activeSeg.zEnd) * 0.5 - PLAYER_Z) < 1.2) {
            activeSeg.portalGate = false;
            this.flipGravity();
            xpEarned += 10;
            xpLabel = 'PORTAL FLIP';
            xpColor = PURPLE;
        }

        const onFlipTouchdown = () => {
            if (!this.awaitingFlipLand) return;
            this.awaitingFlipLand = false;
            bentoArcadeAudio.playFlipLand();
            shakeMs = Math.max(shakeMs, 95);
            shakeMag = Math.max(shakeMag, 3.5);
            const feetP = this.project(this.playerLaneX, this.playerY, PLAYER_Z);
            this.spawnScreenParticles(
                feetP ? feetP.sx : this.width / 2,
                feetP ? feetP.sy : this.height * 0.72,
                this.deck === 'ceiling' ? PURPLE : SKY,
                10
            );
        };

        if (this.deck === 'floor') {
            if (hasFloorUnder && this.playerY <= 0 && this.playerVy <= 0) {
                this.playerY = 0;
                this.playerVy = 0;
                this.onDeck = true;
                this.jumpsLeft = 2;
                onFlipTouchdown();
            } else {
                this.onDeck = false;
            }
            if (this.playerY < -1.15) {
                if (this.hasShield || this.rocketMs > 0 || this.ultMs > 0) {
                    this.playerY = 0.6;
                    this.playerVy = 18.5;
                    this.jumpsLeft = 2;
                    this.awaitingFlipLand = false;
                    if (this.rocketMs <= 0 && this.ultMs <= 0) {
                        this.hasShield = false;
                        bentoArcadeAudio.playShieldBreak();
                    }
                    this.spawnPopup('🛡️ SHIELD RESCUE!', SKY);
                } else {
                    this.fallDeathMs = 1;
                    bentoArcadeAudio.playAbyssFall();
                    this.spawnPopup('⚠️ FELL INTO VOID!', CORAL);
                    return {
                        gameOver: false,
                        deathReason: null,
                        xpEarned,
                        xpLabel,
                        xpColor,
                        scoreAdded,
                        comboIncrement,
                        shakeMs: 180,
                        shakeMag: 6,
                    };
                }
            }
        } else {
            if (hasFloorUnder && this.playerY >= DECK_HEIGHT && this.playerVy >= 0) {
                this.playerY = DECK_HEIGHT;
                this.playerVy = 0;
                this.onDeck = true;
                this.jumpsLeft = 2;
                onFlipTouchdown();
            } else {
                this.onDeck = false;
            }
            if (this.playerY > DECK_HEIGHT + 1.15) {
                if (this.hasShield || this.rocketMs > 0 || this.ultMs > 0) {
                    this.playerY = DECK_HEIGHT - 0.6;
                    this.playerVy = -18.5;
                    this.jumpsLeft = 2;
                    this.awaitingFlipLand = false;
                    if (this.rocketMs <= 0 && this.ultMs <= 0) {
                        this.hasShield = false;
                        bentoArcadeAudio.playShieldBreak();
                    }
                    this.spawnPopup('🛡️ SHIELD RESCUE!', SKY);
                } else {
                    this.fallDeathMs = 1;
                    bentoArcadeAudio.playAbyssFall();
                    this.spawnPopup('⚠️ FELL INTO VOID!', CORAL);
                    return {
                        gameOver: false,
                        deathReason: null,
                        xpEarned,
                        xpLabel,
                        xpColor,
                        scoreAdded,
                        comboIncrement,
                        shakeMs: 180,
                        shakeMag: 6,
                    };
                }
            }
        }

        // Boost strips & springs
        if (activeSeg && this.onDeck) {
            const laneOffset = currentLaneIdx - 1;
            if (activeSeg.boostLane === laneOffset) {
                activeSeg.boostLane = null;
                this.ultCharge = Math.min(100, this.ultCharge + 6);
                xpEarned += 5;
                xpLabel = 'BOOST';
                xpColor = LIME;
                bentoArcadeAudio.playSpring();
            }
            if (activeSeg.springLane === laneOffset) {
                activeSeg.springLane = null;
                this.playerVy = (this.deck === 'floor' ? 1 : -1) * 20.5;
                this.onDeck = false;
                this.jumpsLeft = 2;
                bentoArcadeAudio.playSpring();
            }
        }

        // Collectibles + Magnet / Ult pull
        const magnetActive = this.magnetMs > 0 || this.ultMs > 0;
        for (const c of this.collectibles) {
            if (c.collected) continue;
            c.z -= dz;
            if (magnetActive && c.z < PLAYER_Z + 22 && c.z > PLAYER_Z - 4 && c.deck === this.deck) {
                c.x += (this.playerLaneX - c.x) * Math.min(1, dtSec * 12);
                const targetY = this.deck === 'floor' ? this.playerY + 0.72 : this.playerY - 0.72;
                c.y += (targetY - c.y) * Math.min(1, dtSec * 12);
            }

            const distZ = Math.abs(c.z - PLAYER_Z);
            const distX = Math.abs(c.x - this.playerLaneX);
            const playerCenterY = this.deck === 'floor' ? this.playerY + 0.8 : this.playerY - 0.8;
            const distY = Math.abs(c.y - playerCenterY);

            if (distZ < 1.55 && distX < 1.25 && distY < 1.55) {
                c.collected = true;
                const feet = this.project(this.playerLaneX, this.playerY, PLAYER_Z);
                if (c.kind === 'coin') {
                    this.coinsCollected += 1;
                    this.ultCharge = Math.min(100, this.ultCharge + 3);
                    comboIncrement += 1;
                    scoreAdded += 18 * deckMult * ultMult;
                    xpEarned += 4 * ultMult;
                    bentoArcadeAudio.playCoin(1);
                    this.spawnScreenParticles(
                        feet ? feet.sx : this.width / 2,
                        feet ? feet.sy - 20 : this.height * 0.72,
                        YELLOW,
                        4
                    );
                } else {
                    bentoArcadeAudio.playItemPickup();
                    this.ultCharge = Math.min(100, this.ultCharge + 8);
                    xpEarned += 10;
                    xpLabel = c.kind.toUpperCase();
                    xpColor = SKY;
                    if (this.inventoryItems.length < 2) {
                        this.inventoryItems.push(c.kind);
                        this.spawnPopup(`GOT ${c.kind.toUpperCase()} [E]`, SKY);
                    } else {
                        this.applyItemEffect(c.kind);
                    }
                }
            }
        }
        this.collectibles = this.collectibles.filter((c) => !c.collected && c.z > -6);

        // Enemies & Obstacles
        const invuln = this.rocketMs > 0 || this.ultMs > 0;
        const playerHeightFromDeck =
            this.deck === 'floor' ? this.playerY : DECK_HEIGHT - this.playerY;

        for (const e of this.enemies) {
            if (e.smashed) continue;
            const enemySpeed = e.kind === 'inkspiker' && e.z < 46 ? dz * 1.32 : dz;
            e.z -= enemySpeed;

            if (e.kind === 'hoverbot') {
                e.lane += e.patrolDir * e.patrolSpeed * dtSec;
                if (e.lane > 1) {
                    e.lane = 1;
                    e.patrolDir = -1;
                } else if (e.lane < -1) {
                    e.lane = -1;
                    e.patrolDir = 1;
                }
            }

            if (e.deck !== this.deck) continue;

            const ex = e.lane * LANE_SPACING;
            const distZ = Math.abs(e.z - PLAYER_Z);
            const distX = Math.abs(ex - this.playerLaneX);

            const clearsLaser =
                e.kind === 'lasergate' &&
                ((e.yOffset > 0.5 && this.slideMs > 0) || (e.yOffset < 0.5 && playerHeightFromDeck > 1.25));
            const jumpedOver = e.kind !== 'lasergate' && playerHeightFromDeck > 1.35;

            if (distZ < 1.35 && distX < 0.92 && !clearsLaser && !jumpedOver) {
                if (invuln) {
                    e.smashed = true;
                    this.enemiesDefeated += 1;
                    comboIncrement += 1;
                    scoreAdded += 45 * ultMult;
                    xpEarned += 14 * ultMult;
                    xpLabel = 'SMASH';
                    xpColor = LIME;
                    shakeMs = 130;
                    shakeMag = 5;
                    bentoArcadeAudio.playEnemySmash();
                    const feet = this.project(this.playerLaneX, this.playerY, PLAYER_Z);
                    this.spawnScreenParticles(
                        feet ? feet.sx : this.width / 2,
                        feet ? feet.sy - 20 : this.height * 0.72,
                        CORAL,
                        12
                    );
                } else if (this.hasShield) {
                    e.smashed = true;
                    this.hasShield = false;
                    this.hitFlashMs = 700;
                    shakeMs = 200;
                    shakeMag = 7;
                    bentoArcadeAudio.playShieldBreak();
                    this.spawnPopup('🛡️ SHIELD SAVED!', SKY);
                    const feet = this.project(this.playerLaneX, this.playerY, PLAYER_Z);
                    this.spawnScreenParticles(
                        feet ? feet.sx : this.width / 2,
                        feet ? feet.sy - 20 : this.height * 0.72,
                        SKY,
                        14
                    );
                } else {
                    bentoArcadeAudio.playGameOver();
                    return {
                        gameOver: true,
                        deathReason: e.kind === 'hoverbot' || e.kind === 'inkspiker' ? 'enemy' : 'obstacle',
                        xpEarned,
                        scoreAdded,
                        comboIncrement: 0,
                        shakeMs: 320,
                        shakeMag: 10,
                    };
                }
            } else if (!e.nearMissed && e.z < PLAYER_Z - 0.5 && e.z > PLAYER_Z - 2.6 && distX < 2.2) {
                e.nearMissed = true;
                this.nearMissCount += 1;
                this.ultCharge = Math.min(100, this.ultCharge + 15);
                xpEarned += 8;
                xpLabel = 'CLOSE CALL';
                xpColor = YELLOW;
                bentoArcadeAudio.playNearMiss();
            }
        }
        this.enemies = this.enemies.filter((e) => !e.smashed && e.z > -6);

        this.updateParticlesAndPopups(dtSec, dtMs);

        return {
            gameOver: false,
            deathReason: null,
            xpEarned,
            xpLabel,
            xpColor,
            scoreAdded,
            comboIncrement,
            shakeMs,
            shakeMag,
        };
    }

    private updateParticlesAndPopups(dtSec: number, dtMs: number) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life += dtMs;
            if (p.life >= p.maxLife) {
                this.particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dtSec;
            p.y += p.vy * dtSec;
            p.vy += 420 * dtSec;
            p.rot += p.vRot * dtSec;
        }
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const pop = this.popups[i];
            pop.life += dtMs;
            pop.y -= 28 * dtSec;
            if (pop.life >= pop.maxLife) {
                this.popups.splice(i, 1);
            }
        }
    }

    private beginFrameProjection() {
        const flipU = this.flipAnimMs > 0 ? 1 - this.flipAnimMs / FLIP_DURATION_MS : 0;
        const flipPull = this.flipAnimMs > 0 ? Math.sin(flipU * Math.PI) * 1.45 : 0;
        const speedPull = this.ultMs > 0 || this.rocketMs > 0 ? 1.05 : 0;
        this.pCamZ = PLAYER_Z - (CAM_DIST_BASE + flipPull + speedPull);
        const isPortrait = this.height > this.width * 1.08;
        this.pFocal = isPortrait
            ? Math.min(this.width * 0.82, this.height * 0.56)
            : Math.min(this.width, this.height) * 0.63;
        this.pScreenCy = isPortrait ? this.height * 0.44 : this.height * 0.5;
        this.pCamX = this.playerLaneX * 0.38;
        const fallRatio = this.fallDeathMs > 0 ? Math.min(1, this.fallDeathMs / FALL_DEATH_DURATION_MS) : 0;
        this.pCosR = Math.cos(this.cameraRoll);
        this.pSinR = Math.sin(this.cameraRoll);
        const rollPitchDamp = 1 - 0.5 * Math.abs(this.pSinR);
        const pitch = CAM_PITCH_BASE * rollPitchDamp + fallRatio * 0.3;
        this.pCosP = Math.cos(pitch);
        this.pSinP = Math.sin(pitch);
    }

    private project(wx: number, wy: number, wz: number): { sx: number; sy: number; scale: number } | null {
        const dz = wz - this.pCamZ;
        if (dz <= 0.5) return null;

        const dx = wx - this.pCamX;
        const dy = wy - this.cameraY;

        const rx = dx * this.pCosR - dy * this.pSinR;
        const ry = dx * this.pSinR + dy * this.pCosR;

        const cy = ry * this.pCosP + dz * this.pSinP;
        const cz = dz * this.pCosP - ry * this.pSinP;
        if (cz <= 0.5) return null;

        const scale = this.pFocal / cz;
        return {
            sx: this.width * 0.5 + rx * scale,
            sy: this.pScreenCy - cy * scale,
            scale,
        };
    }

    public render(ctx: CanvasRenderingContext2D, width: number, height: number) {
        this.resize(width, height);
        this.beginFrameProjection();

        // Seamless Bento dot-matrix paper background with NO horizontal horizon line
        if (this.ultMs > 0) {
            ctx.fillStyle = 'rgba(253, 224, 71, 0.14)';
            ctx.fillRect(0, 0, width, height);
        }

        // Segments are spawned in ascending zStart order; iterate in reverse for O(N) far-to-near draw
        const isBelowActiveDeck =
            this.fallDeathMs > 0 || (this.deck === 'floor' ? this.playerY < -0.2 : this.playerY > DECK_HEIGHT + 0.2);

        const activeNearSegs: TrackSegment[] = [];
        for (let i = this.segments.length - 1; i >= 0; i--) {
            const seg = this.segments[i];
            if (seg.zEnd < 1 || seg.zStart > MAX_Z) continue;
            if (seg.deck !== this.deck || !isBelowActiveDeck || seg.zStart >= PLAYER_Z - 0.6) {
                this.drawTrackSegment3D(ctx, seg);
            } else {
                activeNearSegs.push(seg);
            }
        }

        // Collect all 3D props (enemies + collectibles + player) and painter-sort far-to-near
        type DrawItem = { z: number; draw: () => void };
        const drawList: DrawItem[] = [];

        for (const c of this.collectibles) {
            if (c.collected || c.z < 1 || c.z > MAX_Z) continue;
            drawList.push({ z: c.z, draw: () => this.drawCollectible3D(ctx, c) });
        }
        for (const e of this.enemies) {
            if (e.smashed || e.z < 1 || e.z > MAX_Z) continue;
            drawList.push({ z: e.z, draw: () => this.drawEnemy3D(ctx, e) });
        }
        drawList.push({ z: PLAYER_Z, draw: () => this.drawPlayer3D(ctx) });

        drawList.sort((a, b) => b.z - a.z);
        for (const item of drawList) item.draw();

        for (const seg of activeNearSegs) {
            this.drawTrackSegment3D(ctx, seg);
        }

        if (this.shockwaveRingMs > 0) {
            const p = 1 - this.shockwaveRingMs / 480;
            ctx.save();
            ctx.beginPath();
            ctx.arc(width / 2, height * 0.68, p * Math.max(width, height) * 0.65, 0, Math.PI * 2);
            ctx.strokeStyle = LIME;
            ctx.lineWidth = 10 * (1 - p);
            ctx.stroke();
            ctx.strokeStyle = INK_BLACK;
            ctx.lineWidth = 3 * (1 - p);
            ctx.stroke();
            ctx.restore();
        }

        if (this.flipAnimMs > 0) {
            const p = Math.sin((1 - this.flipAnimMs / FLIP_DURATION_MS) * Math.PI);
            ctx.save();
            ctx.strokeStyle = this.deck === 'ceiling' ? PURPLE : '#38bdf8';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.65 * p;
            for (let i = 0; i < 10; i++) {
                const side = i < 5 ? width * (0.04 + i * 0.03) : width * (0.82 + (i - 5) * 0.035);
                const y0 = ((this.worldZ * 18 + i * 95) % (height + 120)) - 60;
                ctx.beginPath();
                ctx.moveTo(side, y0);
                ctx.lineTo(side, y0 + 58);
                ctx.stroke();
            }
            ctx.restore();
        }

        if (this.fallDeathMs > 0) {
            const fallP = Math.min(1, this.fallDeathMs / FALL_DEATH_DURATION_MS);
            ctx.save();
            ctx.strokeStyle = INK_BLACK;
            ctx.lineWidth = 2.4;
            ctx.globalAlpha = 0.55;
            for (let i = 0; i < 12; i++) {
                const sx = width * (0.1 + ((i * 73) % 80) / 100);
                const sy = height - ((fallP * 540 + i * 70) % (height + 80));
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx, sy + 46);
                ctx.stroke();
            }
            ctx.strokeStyle = CORAL;
            ctx.lineWidth = 10;
            ctx.globalAlpha = 0.35 + fallP * 0.4;
            ctx.strokeRect(5, 5, width - 10, height - 10);
            ctx.restore();
        }

        if (this.ultMs > 0 || this.rocketMs > 0) {
            ctx.save();
            ctx.strokeStyle = this.ultMs > 0 ? INK_BLACK : '#f97316';
            ctx.lineWidth = 2.5;
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2 + this.worldZ * 0.05;
                const r1 = Math.min(width, height) * 0.36;
                const r2 = Math.min(width, height) * 0.56;
                ctx.beginPath();
                ctx.moveTo(width / 2 + Math.cos(angle) * r1, height * 0.52 + Math.sin(angle) * r1);
                ctx.lineTo(width / 2 + Math.cos(angle) * r2, height * 0.52 + Math.sin(angle) * r2);
                ctx.stroke();
            }
            ctx.restore();
        }

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

        const isCompact = width < 640;
        for (const pop of this.popups) {
            const t = pop.life / pop.maxLife;
            const alpha = t < 0.72 ? 1 : (1 - t) / 0.28;
            ctx.save();
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.font = `900 ${isCompact ? 10 : 11}px ui-monospace, SFMono-Regular, Menlo, monospace`;
            const tw = ctx.measureText(pop.text).width;
            const bw = tw + (isCompact ? 11 : 14);
            const bh = isCompact ? 20 : 22;
            const clampedX = Math.max(bw / 2 + 8, Math.min(width - bw / 2 - 8, pop.x));
            ctx.fillStyle = INK_BLACK;
            ctx.fillRect(clampedX - bw / 2 + 2.5, pop.y - bh / 2 + 2.5, bw, bh);
            ctx.fillStyle = pop.bg;
            ctx.fillRect(clampedX - bw / 2, pop.y - bh / 2, bw, bh);
            ctx.strokeStyle = INK_BLACK;
            ctx.lineWidth = 2;
            ctx.strokeRect(clampedX - bw / 2, pop.y - bh / 2, bw, bh);
            ctx.fillStyle = INK_BLACK;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pop.text, clampedX, pop.y + 0.5);
            ctx.restore();
        }
    }

    private drawTrackSegment3D(ctx: CanvasRenderingContext2D, seg: TrackSegment) {
        const isFloor = seg.deck === 'floor';
        const ySurf = isFloor ? 0 : DECK_HEIGHT;
        const yUnder = isFloor ? -0.48 : DECK_HEIGHT + 0.48;
        const z1 = Math.max(1.5, seg.zStart + 0.06);
        const z2 = Math.min(MAX_Z, seg.zEnd - 0.06);
        if (z2 <= z1) return;

        const isActiveDeck = seg.deck === this.deck;
        const camX = this.pCamX;
        const drawDetails = z1 < 68;
        const prevAlpha = ctx.globalAlpha;
        if (!isActiveDeck) ctx.globalAlpha = 0.78;

        for (let i = 0; i < 3; i++) {
            const laneCenter = (i - 1) * LANE_SPACING;
            const halfW = LANE_SPACING * 0.46;

            if (!seg.lanes[i]) {
                if (!isActiveDeck || !drawDetails) continue;
                const v1 = this.project(laneCenter - halfW, ySurf, z1);
                const v2 = this.project(laneCenter + halfW, ySurf, z1);
                const v3 = this.project(laneCenter + halfW, ySurf, z2);
                const v4 = this.project(laneCenter - halfW, ySurf, z2);
                if (!v1 || !v2 || !v3 || !v4) continue;

                ctx.beginPath();
                ctx.moveTo(v1.sx, v1.sy);
                ctx.lineTo(v2.sx, v2.sy);
                ctx.lineTo(v3.sx, v3.sy);
                ctx.lineTo(v4.sx, v4.sy);
                ctx.closePath();
                ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
                ctx.fill();
                ctx.strokeStyle = CORAL;
                ctx.lineWidth = Math.max(1.2, Math.min(2.6, v1.scale * 0.045));
                ctx.stroke();

                const d1 = this.project(laneCenter - halfW, ySurf + (isFloor ? -3.2 : 3.2), z1);
                const d2 = this.project(laneCenter + halfW, ySurf + (isFloor ? -3.2 : 3.2), z1);
                if (d1 && d2) {
                    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
                    ctx.lineWidth = Math.max(1, v1.scale * 0.03);
                    ctx.beginPath();
                    ctx.moveTo(v1.sx, v1.sy);
                    ctx.lineTo(d1.sx, d1.sy);
                    ctx.moveTo(v2.sx, v2.sy);
                    ctx.lineTo(d2.sx, d2.sy);
                    ctx.stroke();
                }
                continue;
            }

            const p1 = this.project(laneCenter - halfW, ySurf, z1);
            const p2 = this.project(laneCenter + halfW, ySurf, z1);
            const p3 = this.project(laneCenter + halfW, ySurf, z2);
            const p4 = this.project(laneCenter - halfW, ySurf, z2);
            if (!p1 || !p2 || !p3 || !p4) continue;

            const strokeW = Math.max(1, Math.min(2.6, p1.scale * 0.04));

            if (drawDetails) {
                const u1 = this.project(laneCenter - halfW, yUnder, z1);
                const u2 = this.project(laneCenter + halfW, yUnder, z1);
                const u3 = this.project(laneCenter + halfW, yUnder, z2);
                const u4 = this.project(laneCenter - halfW, yUnder, z2);
                if (u1 && u2 && u3 && u4) {
                    if (laneCenter < camX - 0.15) {
                        ctx.beginPath();
                        ctx.moveTo(p2.sx, p2.sy);
                        ctx.lineTo(p3.sx, p3.sy);
                        ctx.lineTo(u3.sx, u3.sy);
                        ctx.lineTo(u2.sx, u2.sy);
                        ctx.closePath();
                        ctx.fillStyle = '#64748b';
                        ctx.fill();
                        ctx.strokeStyle = INK_BLACK;
                        ctx.lineWidth = strokeW;
                        ctx.stroke();
                    } else if (laneCenter > camX + 0.15) {
                        ctx.beginPath();
                        ctx.moveTo(p1.sx, p1.sy);
                        ctx.lineTo(p4.sx, p4.sy);
                        ctx.lineTo(u4.sx, u4.sy);
                        ctx.lineTo(u1.sx, u1.sy);
                        ctx.closePath();
                        ctx.fillStyle = '#64748b';
                        ctx.fill();
                        ctx.strokeStyle = INK_BLACK;
                        ctx.lineWidth = strokeW;
                        ctx.stroke();
                    }

                    ctx.beginPath();
                    ctx.moveTo(p1.sx, p1.sy);
                    ctx.lineTo(p2.sx, p2.sy);
                    ctx.lineTo(u2.sx, u2.sy);
                    ctx.lineTo(u1.sx, u1.sy);
                    ctx.closePath();
                    ctx.fillStyle = '#475569';
                    ctx.fill();
                    ctx.strokeStyle = INK_BLACK;
                    ctx.lineWidth = strokeW;
                    ctx.stroke();
                }
            }

            ctx.beginPath();
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p2.sx, p2.sy);
            ctx.lineTo(p3.sx, p3.sy);
            ctx.lineTo(p4.sx, p4.sy);
            ctx.closePath();

            let fill = seg.color;
            if (seg.boostLane === i - 1) fill = LIME;
            else if (seg.springLane === i - 1) fill = YELLOW;
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.strokeStyle = INK_BLACK;
            ctx.lineWidth = strokeW;
            ctx.stroke();

            if (seg.hazardLip[i] && drawDetails) {
                const wzStart = Math.max(z1, z2 - 0.95);
                const h1 = this.project(laneCenter - halfW, ySurf, wzStart);
                const h2 = this.project(laneCenter + halfW, ySurf, wzStart);
                if (h1 && h2) {
                    ctx.beginPath();
                    ctx.moveTo(h1.sx, h1.sy);
                    ctx.lineTo(h2.sx, h2.sy);
                    ctx.lineTo(p3.sx, p3.sy);
                    ctx.lineTo(p4.sx, p4.sy);
                    ctx.closePath();
                    ctx.fillStyle = YELLOW;
                    ctx.fill();
                    ctx.strokeStyle = INK_BLACK;
                    ctx.lineWidth = strokeW;
                    ctx.stroke();

                    for (let t = 0; t < 3; t++) {
                        const lx = laneCenter - halfW * 0.6 + t * halfW * 0.6;
                        const a = this.project(lx, ySurf, wzStart + 0.15);
                        const b = this.project(lx + halfW * 0.25, ySurf, z2 - 0.12);
                        if (a && b) {
                            ctx.beginPath();
                            ctx.moveTo(a.sx, a.sy);
                            ctx.lineTo(b.sx, b.sy);
                            ctx.strokeStyle = INK_BLACK;
                            ctx.lineWidth = Math.max(1.5, strokeW * 1.4);
                            ctx.stroke();
                        }
                    }
                }
            }

            if (i === 1 && drawDetails) {
                const c1 = this.project(0, ySurf, z1 + 0.8);
                const c2 = this.project(0, ySurf, z2 - 0.8);
                if (c1 && c2) {
                    ctx.beginPath();
                    ctx.moveTo(c1.sx, c1.sy);
                    ctx.lineTo(c2.sx, c2.sy);
                    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
                    ctx.lineWidth = Math.max(1, c1.scale * 0.04);
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = prevAlpha;

        // Twin-pillar 3D Gravity Portal Gate spanning Floor to Overhead Ceiling Track
        if (seg.portalGate) {
            const zMid = (z1 + z2) * 0.5;
            const span = LANE_SPACING * 1.45;
            const leftBot = this.project(-span, 0, zMid);
            const rightBot = this.project(span, 0, zMid);
            const leftTop = this.project(-span, DECK_HEIGHT, zMid);
            const rightTop = this.project(span, DECK_HEIGHT, zMid);
            const centerMid = this.project(0, DECK_HEIGHT * 0.5, zMid);
            if (leftBot && rightBot && leftTop && rightTop) {
                ctx.save();

                ctx.beginPath();
                ctx.moveTo(leftBot.sx, leftBot.sy);
                ctx.lineTo(leftTop.sx, leftTop.sy);
                ctx.lineTo(rightTop.sx, rightTop.sy);
                ctx.lineTo(rightBot.sx, rightBot.sy);
                ctx.closePath();
                ctx.fillStyle = 'rgba(192, 132, 252, 0.2)';
                ctx.fill();

                const pillarW = Math.max(4, leftBot.scale * 0.16);
                ctx.strokeStyle = INK_BLACK;
                ctx.lineWidth = pillarW + 3;
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(leftBot.sx, leftBot.sy);
                ctx.lineTo(leftTop.sx, leftTop.sy);
                ctx.moveTo(rightBot.sx, rightBot.sy);
                ctx.lineTo(rightTop.sx, rightTop.sy);
                ctx.stroke();

                ctx.strokeStyle = PURPLE;
                ctx.lineWidth = pillarW;
                ctx.stroke();

                ctx.strokeStyle = SKY;
                ctx.lineWidth = Math.max(2, pillarW * 0.45);
                ctx.beginPath();
                ctx.moveTo(leftTop.sx, leftTop.sy);
                ctx.lineTo(rightTop.sx, rightTop.sy);
                ctx.moveTo(leftBot.sx, leftBot.sy);
                ctx.lineTo(rightBot.sx, rightBot.sy);
                ctx.stroke();

                if (centerMid) {
                    const pulse = 1 + Math.sin(this.worldZ * 0.45) * 0.2;
                    const dSize = Math.max(8, centerMid.scale * 0.58 * pulse);
                    ctx.beginPath();
                    ctx.moveTo(centerMid.sx, centerMid.sy - dSize);
                    ctx.lineTo(centerMid.sx + dSize, centerMid.sy);
                    ctx.lineTo(centerMid.sx, centerMid.sy + dSize);
                    ctx.lineTo(centerMid.sx - dSize, centerMid.sy);
                    ctx.closePath();
                    ctx.fillStyle = PURPLE;
                    ctx.fill();
                    ctx.strokeStyle = INK_BLACK;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                ctx.restore();
            }
        }
    }

    private drawCollectible3D(ctx: CanvasRenderingContext2D, c: Dash3DCollectible) {
        const bob = Math.sin(this.worldZ * 0.35 + c.id) * 0.16;
        const proj = this.project(c.x, c.y + bob, c.z);
        if (!proj) return;
        const size = Math.max(8, proj.scale * 0.52);

        ctx.save();
        ctx.translate(proj.sx, proj.sy);
        ctx.lineWidth = Math.max(1.5, size * 0.1);
        ctx.strokeStyle = INK_BLACK;

        if (c.kind === 'coin') {
            ctx.fillStyle = INK_BLACK;
            ctx.fillRect(-size * 0.35 + 2, -size * 0.5 + 2, size * 0.7, size);
            ctx.fillStyle = YELLOW;
            ctx.fillRect(-size * 0.35, -size * 0.5, size * 0.7, size);
            ctx.strokeRect(-size * 0.35, -size * 0.5, size * 0.7, size);
        } else {
            const boxSize = size * 1.35;
            const colorMap: Record<DashItemKind, string> = {
                magnet: YELLOW,
                shield: SKY,
                rocket: PEACH,
                shockwave: LIME,
                slowmo: PURPLE,
            };
            const glyphMap: Record<DashItemKind, string> = {
                magnet: 'M',
                shield: 'S',
                rocket: 'R',
                shockwave: '⚡',
                slowmo: 'T',
            };
            ctx.fillStyle = INK_BLACK;
            ctx.fillRect(-boxSize / 2 + 2.5, -boxSize / 2 + 2.5, boxSize, boxSize);
            ctx.fillStyle = colorMap[c.kind];
            ctx.fillRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);
            ctx.strokeRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);

            ctx.fillStyle = INK_BLACK;
            ctx.font = `900 ${Math.max(9, Math.round(boxSize * 0.55))}px ui-monospace, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(glyphMap[c.kind], 0, 1);
        }
        ctx.restore();
    }

    private drawEnemy3D(ctx: CanvasRenderingContext2D, e: Dash3DEnemy) {
        const dir = e.deck === 'floor' ? 1 : -1;
        const baseY = e.deck === 'floor' ? 0 : DECK_HEIGHT;
        const centerY = baseY + dir * (0.68 + e.yOffset);
        const ex = e.lane * LANE_SPACING;
        const proj = this.project(ex, centerY, e.z);
        if (!proj) return;

        const s = Math.max(10, proj.scale * 1.05);
        ctx.save();
        ctx.translate(proj.sx, proj.sy);
        ctx.strokeStyle = INK_BLACK;
        ctx.lineWidth = Math.max(1.5, s * 0.08);

        if (e.kind === 'hoverbot') {
            ctx.fillStyle = '#334155';
            ctx.fillRect(-s * 0.55, -s * 0.35, s * 1.1, s * 0.7);
            ctx.strokeRect(-s * 0.55, -s * 0.35, s * 1.1, s * 0.7);
            ctx.fillStyle = CORAL;
            ctx.fillRect(-s * 0.36, -s * 0.12, s * 0.72, s * 0.24);
            ctx.strokeRect(-s * 0.36, -s * 0.12, s * 0.72, s * 0.24);
        } else if (e.kind === 'inkspiker') {
            ctx.fillStyle = CORAL;
            ctx.beginPath();
            ctx.moveTo(0, -s * 0.65);
            ctx.lineTo(s * 0.55, s * 0.45);
            ctx.lineTo(-s * 0.55, s * 0.45);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = INK_BLACK;
            ctx.fillRect(-s * 0.2, 0, s * 0.4, s * 0.16);
        } else if (e.kind === 'lasergate') {
            ctx.fillStyle = CORAL;
            ctx.fillRect(-s * 0.95, -s * 0.18, s * 1.9, s * 0.36);
            ctx.strokeRect(-s * 0.95, -s * 0.18, s * 1.9, s * 0.36);
            ctx.fillStyle = YELLOW;
            ctx.fillRect(-s * 0.85, -s * 0.06, s * 1.7, s * 0.12);
        } else {
            ctx.fillStyle = INK_BLACK;
            ctx.fillRect(-s * 0.45 + 3, -s * 0.45 + 3, s * 0.9, s * 0.9);
            ctx.fillStyle = CORAL;
            ctx.fillRect(-s * 0.45, -s * 0.45, s * 0.9, s * 0.9);
            ctx.strokeRect(-s * 0.45, -s * 0.45, s * 0.9, s * 0.9);
            ctx.fillStyle = INK_BLACK;
            ctx.font = `900 ${Math.max(10, Math.round(s * 0.6))}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', 0, 1);
        }
        ctx.restore();
    }

    private drawPlayer3D(ctx: CanvasRenderingContext2D) {
        const feetProj = this.project(this.playerLaneX, this.playerY, PLAYER_Z);
        if (!feetProj) return;
        const shadowY = this.deck === 'floor' ? 0 : DECK_HEIGHT;
        const shadowProj = this.project(this.playerLaneX, shadowY, PLAYER_Z);
        const isFalling = this.fallDeathMs > 0;
        const fallProgress = isFalling ? Math.min(1, this.fallDeathMs / FALL_DEATH_DURATION_MS) : 0;

        if (shadowProj && !isFalling) {
            const heightOff =
                this.deck === 'floor' ? Math.max(0, this.playerY) : Math.max(0, DECK_HEIGHT - this.playerY);
            const r = Math.max(8, shadowProj.scale * 0.52 * Math.max(0.45, 1 - heightOff * 0.12));
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(shadowProj.sx, shadowProj.sy, r, r * 0.36, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.32)';
            ctx.fill();

            if (!this.onDeck && (this.flipAnimMs > 0 || this.awaitingFlipLand)) {
                ctx.strokeStyle = this.deck === 'ceiling' ? PURPLE : '#38bdf8';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([5, 4]);
                ctx.beginPath();
                ctx.ellipse(shadowProj.sx, shadowProj.sy, r * 1.45, r * 0.54, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.beginPath();
                ctx.moveTo(feetProj.sx, feetProj.sy);
                ctx.lineTo(shadowProj.sx, shadowProj.sy);
                ctx.strokeStyle = this.deck === 'ceiling' ? 'rgba(192, 132, 252, 0.55)' : 'rgba(56, 189, 248, 0.55)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            ctx.restore();
        }

        const scaleBase = Math.max(0.54, Math.min(1.12, feetProj.scale * 0.0182));
        const scale = isFalling ? scaleBase * (1 - fallProgress * 0.42) : scaleBase;
        const jumpHeight =
            this.deck === 'floor' ? Math.max(0, this.playerY * 14) : Math.max(0, (DECK_HEIGHT - this.playerY) * 14);
        const flipProgress =
            this.flipAnimMs > 0 || this.awaitingFlipLand
                ? Math.min(0.95, 1 - this.flipAnimMs / FLIP_DURATION_MS)
                : 0;

        drawThirdPersonAvatar(ctx, this.avatarConfig, feetProj.sx, feetProj.sy, scale, {
            runPhase: this.runPhase,
            laneTilt: this.laneTilt,
            jumpHeight,
            sliding: this.slideMs > 0,
            gravityInverted: this.deck === 'ceiling',
            hasShield: this.hasShield,
            rocketActive: this.rocketMs > 0,
            ultActive: this.ultMs > 0,
            hitFlashMs: this.hitFlashMs,
            flipProgress,
            falling: isFalling,
            fallProgress,
        });
    }

    private spawnScreenParticles(x: number, y: number, color: string, count = 8) {
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
                maxLife: 380 + Math.random() * 260,
            });
        }
    }

    private spawnPopup(text: string, bg = LIME) {
        const isCompact = this.width < 640;
        const toastX = this.width - (isCompact ? 74 : 108);
        const toastY = (isCompact ? 40 : 54) + Math.min(3, this.popups.length) * (isCompact ? 24 : 28);
        this.popups.push({ x: toastX, y: toastY, text, bg, life: 0, maxLife: 900 });
    }
}
