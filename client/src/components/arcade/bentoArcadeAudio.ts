class BentoArcadeAudio {
    private ctx: AudioContext | null = null;
    private muted = false;

    public setMuted(muted: boolean) {
        this.muted = muted;
    }

    private ensureContext(): AudioContext | null {
        if (this.muted || typeof window === 'undefined') return null;
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtx) return null;
            try {
                this.ctx = new AudioCtx();
            } catch {
                return null;
            }
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    private tone(
        freq: number,
        durationSec: number,
        type: OscillatorType = 'triangle',
        peak = 0.08,
        delay = 0,
        endFreq?: number
    ) {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq !== undefined) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationSec);
        }
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(peak, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + durationSec + 0.02);
    }

    public playStart() {
        this.tone(392, 0.08, 'triangle', 0.07, 0);
        this.tone(523.25, 0.11, 'triangle', 0.075, 0.06);
    }

    public playPaddleBounce() {
        this.tone(260, 0.065, 'square', 0.045, 0, 340);
    }

    public playBrickHit() {
        this.tone(320, 0.055, 'triangle', 0.06, 0, 240);
    }

    public playBrickBreak(combo = 1) {
        const boost = Math.min(340, (combo - 1) * 42);
        this.tone(420 + boost, 0.09, 'square', 0.05, 0, 640 + boost);
    }

    public playPowerup() {
        this.tone(587.33, 0.08, 'triangle', 0.07, 0);
        this.tone(880, 0.12, 'triangle', 0.075, 0.055);
    }

    public playWaveClear() {
        [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => {
            this.tone(n, 0.14, 'triangle', 0.075, i * 0.06);
        });
    }

    public playJump(isDouble = false) {
        if (isDouble) {
            this.tone(460, 0.11, 'triangle', 0.07, 0, 740);
        } else {
            this.tone(310, 0.095, 'triangle', 0.07, 0, 540);
        }
    }

    public playSpring() {
        this.tone(360, 0.16, 'triangle', 0.08, 0, 920);
    }

    public playSlam() {
        this.tone(240, 0.09, 'sawtooth', 0.06, 0, 95);
    }

    public playCoin(streak = 1) {
        const boost = Math.min(280, (streak - 1) * 35);
        this.tone(720 + boost, 0.07, 'triangle', 0.065, 0, 980 + boost);
    }

    public playShieldBreak() {
        this.tone(480, 0.14, 'sawtooth', 0.06, 0, 180);
    }

    public playLevelUp() {
        [587.33, 739.99, 880, 1174.66].forEach((n, i) => {
            this.tone(n, 0.15, 'triangle', 0.075, i * 0.06);
        });
    }

    public playLifeLost() {
        this.tone(260, 0.15, 'sawtooth', 0.065, 0, 130);
    }

    public playGameOver() {
        this.tone(260, 0.18, 'sawtooth', 0.065, 0, 140);
        this.tone(140, 0.28, 'sawtooth', 0.06, 0.14, 72);
    }

    public playGravityFlip(inverted: boolean) {
        if (inverted) {
            this.tone(240, 0.2, 'sawtooth', 0.055, 0, 820);
            this.tone(360, 0.18, 'triangle', 0.07, 0.02, 920);
            this.tone(760, 0.15, 'sine', 0.05, 0.06, 1240);
        } else {
            this.tone(820, 0.2, 'sawtooth', 0.055, 0, 240);
            this.tone(620, 0.18, 'triangle', 0.07, 0.02, 220);
            this.tone(980, 0.14, 'sine', 0.045, 0.05, 380);
        }
    }

    public playFlipLand() {
        this.tone(155, 0.09, 'triangle', 0.085, 0, 68);
        this.tone(620, 0.045, 'square', 0.04, 0.01, 420);
    }

    public playAbyssFall() {
        this.tone(660, 0.52, 'triangle', 0.075, 0, 95);
        this.tone(480, 0.45, 'sine', 0.055, 0.1, 75);
    }

    public playItemPickup() {
        this.tone(660, 0.07, 'triangle', 0.07, 0);
        this.tone(990, 0.11, 'triangle', 0.075, 0.05);
    }

    public playItemUse(kind: string) {
        if (kind === 'shockwave') {
            this.tone(180, 0.22, 'sawtooth', 0.08, 0, 720);
            this.tone(920, 0.16, 'triangle', 0.06, 0.05, 220);
        } else if (kind === 'rocket') {
            this.tone(240, 0.24, 'sawtooth', 0.065, 0, 860);
        } else if (kind === 'slowmo') {
            this.tone(720, 0.22, 'sine', 0.07, 0, 260);
        } else {
            this.tone(523.25, 0.09, 'triangle', 0.07, 0, 783.99);
        }
    }

    public playUltActivate() {
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            this.tone(freq, 0.16, 'sawtooth', 0.055, i * 0.045, freq * 1.12);
        });
    }

    public playEnemySmash() {
        this.tone(220, 0.1, 'square', 0.065, 0, 520);
        this.tone(440, 0.08, 'triangle', 0.06, 0.03, 180);
    }

    public playNearMiss() {
        this.tone(880, 0.07, 'sine', 0.06, 0, 1320);
    }
}

export const bentoArcadeAudio = new BentoArcadeAudio();
