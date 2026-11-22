class NoirSnakeAudio {
    private ctx: AudioContext | null = null;
    private muted = false;

    public setMuted(muted: boolean) {
        this.muted = muted;
    }

    public isMuted(): boolean {
        return this.muted;
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

    private playTone(
        freq: number,
        durationSec: number,
        type: OscillatorType = 'triangle',
        gainPeak = 0.08,
        delaySec = 0,
        endFreq?: number
    ) {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime + delaySec;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq !== undefined) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationSec);
        }

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + durationSec + 0.02);
    }

    public playEat(combo = 1) {
        const pitchBoost = Math.min(260, (combo - 1) * 45);
        this.playTone(440 + pitchBoost, 0.09, 'triangle', 0.075, 0, 620 + pitchBoost);
    }

    public playOvercharge() {
        this.playTone(587.33, 0.09, 'square', 0.05, 0);
        this.playTone(880, 0.14, 'triangle', 0.07, 0.06, 1174.66);
    }

    public playTakedown() {
        this.playTone(220, 0.12, 'sawtooth', 0.06, 0, 110);
        this.playTone(523.25, 0.12, 'triangle', 0.07, 0.05);
        this.playTone(783.99, 0.18, 'triangle', 0.07, 0.11);
    }

    public playLevelUp() {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((n, idx) => {
            this.playTone(n, 0.16, 'triangle', 0.075, idx * 0.065);
        });
    }

    public playGameOver() {
        this.playTone(240, 0.18, 'sawtooth', 0.065, 0, 150);
        this.playTone(150, 0.28, 'sawtooth', 0.06, 0.14, 72);
    }

    public playStart() {
        this.playTone(330, 0.08, 'triangle', 0.06, 0);
        this.playTone(493.88, 0.12, 'triangle', 0.065, 0.06);
    }

    public playWeaponPickup() {
        this.playTone(523.25, 0.07, 'square', 0.045, 0);
        this.playTone(783.99, 0.09, 'triangle', 0.065, 0.055);
        this.playTone(1046.5, 0.12, 'triangle', 0.065, 0.11);
    }

    public playWeaponRailgun() {
        this.playTone(980, 0.2, 'sawtooth', 0.075, 0, 140);
        this.playTone(320, 0.24, 'square', 0.055, 0.02, 70);
    }

    public playWeaponNova() {
        this.playTone(190, 0.28, 'sawtooth', 0.08, 0, 52);
        this.playTone(420, 0.18, 'triangle', 0.065, 0.03, 120);
        this.playTone(840, 0.14, 'sine', 0.045, 0.08, 220);
    }

    public playWeaponBolt() {
        this.playTone(760, 0.12, 'triangle', 0.07, 0, 1320);
        this.playTone(480, 0.16, 'sawtooth', 0.05, 0.03, 210);
    }

    public playBoostOverheat() {
        this.playTone(300, 0.16, 'sawtooth', 0.055, 0, 120);
        this.playTone(170, 0.22, 'triangle', 0.05, 0.08, 85);
    }

    public playBoostReady() {
        this.playTone(660, 0.06, 'triangle', 0.045, 0);
        this.playTone(990, 0.08, 'triangle', 0.05, 0.055);
    }

    public playLockdownWarning() {
        this.playTone(880, 0.08, 'square', 0.05, 0);
        this.playTone(660, 0.08, 'square', 0.05, 0.09);
        this.playTone(880, 0.1, 'square', 0.055, 0.18);
    }

    public playLockdownArm() {
        this.playTone(165, 0.16, 'sawtooth', 0.065, 0, 82);
        this.playTone(110, 0.14, 'square', 0.045, 0.04, 65);
    }

    public playSectorShiftWarning(step = 3) {
        const freq = step === 1 ? 987.77 : step === 2 ? 880 : 783.99;
        this.playTone(freq, 0.07, 'square', 0.045, 0);
        this.playTone(freq * 1.5, 0.09, 'triangle', 0.05, 0.04);
    }

    public playSectorMorph() {
        this.playTone(220, 0.28, 'sawtooth', 0.08, 0, 88);
        this.playTone(440, 0.22, 'triangle', 0.07, 0.03, 1760);
        this.playTone(880, 0.18, 'sine', 0.05, 0.08, 220);
    }
}

export const noirSnakeAudio = new NoirSnakeAudio();
