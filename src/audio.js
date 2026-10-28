// Web Audio API Procedural Synthesizer for SFX; music is delegated to music.js
import { music } from './music.js';

class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterVolume = 0.5;
        this.sfxVolume = 0.6;
        this.bgmVolume = 0.35;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Play a sharp blade slash sound
    playSlash(pitch = 1.0) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600 * pitch, now);
        osc.frequency.exponentialRampToValueAtTime(80 * pitch, now + 0.12);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.Q.setValueAtTime(3, now);

        gain.gain.setValueAtTime(0.4 * this.sfxVolume * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);

        // Add swift white noise whoosh
        this.playNoise(0.08, 1200, 0.18 * this.sfxVolume);
    }

    // Impact punch/slice hit
    playHit(isCrit = false) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = isCrit ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(isCrit ? 320 : 180, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + (isCrit ? 0.25 : 0.15));

        gain.gain.setValueAtTime((isCrit ? 0.6 : 0.4) * this.sfxVolume * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.25 : 0.15));

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.26);

        if (isCrit) {
            this.playChime(880, 0.3);
        }
    }

    // Dash whoosh sound
    playDash() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);

        gain.gain.setValueAtTime(0.3 * this.sfxVolume * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.21);
    }

    // Foxfire magic shoot
    playFoxfire() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);

        gain.gain.setValueAtTime(0.35 * this.sfxVolume * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.23);
    }

    // Jump sound
    playJump() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);

        gain.gain.setValueAtTime(0.25 * this.sfxVolume * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    // Dialogue typewriter click
    playDialogueBlip(pitch = 1.0) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime((400 + Math.random() * 80) * pitch, now);

        gain.gain.setValueAtTime(0.12 * this.sfxVolume * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    // Chime sound for quest completion / cleansing
    playChime(freq = 660, duration = 0.5) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.3 * this.sfxVolume * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.05);
    }

    playNoise(duration, cutoff = 1000, volume = 0.1) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        whiteNoise.start();
    }

    // Soft footstep-like landing after a short drop
    landSoft() {
        this.sweepTone('sine', 140, 70, 0.07, 0.12);
        this.sweepNoise('lowpass', 900, 250, 0.08, 0.1);
    }

    // Heavy landing after a high fall: thud + dirt crunch + a few gravel ticks
    landHeavy() {
        this.sweepTone('sine', 150, 42, 0.22, 0.4);
        this.sweepNoise('lowpass', 1600, 160, 0.26, 0.28);
        for (let i = 0; i < 3; i++) {
            this.sweepNoise('bandpass', 1400 + Math.random() * 1200, 600, 0.05, 0.08, 0.04 + Math.random() * 0.12);
        }
    }

    // Perfect dodge: reversed whoosh + rising shimmer + bright chime
    perfectDodge() {
        this.sweepNoise('bandpass', 600, 3200, 0.22, 0.18, 0, 0.18);
        this.sweepTone('sine', 900, 2400, 0.2, 0.1);
        this.sweepTone('triangle', 1800, 3600, 0.15, 0.05, 0.05);
        this.playChime(1568, 0.5);
    }

    // Slam: wind-up whoosh as she drops
    slamDive() {
        this.sweepNoise('bandpass', 500, 2600, 0.28, 0.18, 0, 0.12);
        this.sweepTone('sine', 300, 900, 0.12, 0.08);
    }

    // Slam hitting the ground: boom + crunch + spirit chime
    slamImpact() {
        this.sweepTone('sine', 160, 32, 0.4, 0.6);
        this.sweepNoise('lowpass', 2200, 140, 0.35, 0.35);
        this.sweepTone('triangle', 880, 660, 0.25, 0.06, 0.02);
        for (let i = 0; i < 4; i++) {
            this.sweepNoise('bandpass', 1300 + Math.random() * 1400, 500, 0.05, 0.09, 0.05 + Math.random() * 0.15);
        }
    }

    // Slam landing on the boss's head
    slamHit() {
        this.sweepTone('square', 700, 140, 0.18, 0.14);
        this.sweepNoise('bandpass', 3000, 700, 0.18, 0.18);
        this.playChime(1318, 0.3);
    }

    // ---- Boss sound effects
    // Building blocks: a swept oscillator and a swept-filter noise burst.
    sweepTone(type, f0, f1, dur, vol, delay = 0) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(vol * this.sfxVolume * this.masterVolume, t + Math.min(0.02, dur / 4));
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    sweepNoise(filterType, f0, f1, dur, vol, delay = 0, attack = 0.01) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + delay;
        const buffer = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = filterType;
        filter.Q.setValueAtTime(filterType === 'bandpass' ? 2 : 0.7, t);
        filter.frequency.setValueAtTime(f0, t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(vol * this.sfxVolume * this.masterVolume, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        src.start(t);
    }

    // Ominous rising whine while the boss charges an attack (eyes flashing)
    bossCharge(dur = 0.5) {
        this.sweepTone('sawtooth', 110, 520, dur, 0.1);
        this.sweepTone('sine', 220, 1040, dur, 0.08);
        this.sweepNoise('bandpass', 400, 2400, dur, 0.06, 0, dur * 0.8);
    }

    // Blight orb volley: dark zap
    bossOrbs() {
        this.sweepTone('square', 900, 140, 0.28, 0.16);
        this.sweepTone('sawtooth', 300, 60, 0.35, 0.14);
        this.sweepNoise('bandpass', 2600, 500, 0.25, 0.14);
    }

    // Mask rising into the air before the slam
    bossRise() {
        this.sweepNoise('bandpass', 250, 1400, 0.7, 0.16, 0, 0.5);
        this.sweepTone('sine', 60, 140, 0.7, 0.14);
    }

    // Mask crashing into the ground: boom, rumble, crumbling rocks
    bossSlam() {
        this.sweepTone('sine', 95, 28, 0.7, 0.75);
        this.sweepTone('triangle', 180, 40, 0.35, 0.3);
        this.sweepNoise('lowpass', 900, 120, 0.9, 0.45);
        for (let i = 0; i < 7; i++) {
            this.sweepNoise('bandpass', 900 + Math.random() * 1600, 400, 0.06, 0.12, 0.12 + Math.random() * 0.45);
        }
    }

    // Claw diving through the air
    clawSwipe() {
        this.sweepNoise('bandpass', 3000, 500, 0.2, 0.2);
        this.sweepTone('sawtooth', 700, 200, 0.16, 0.06);
    }

    // Claw hitting the ground: thud + dirt crunch + claw scrape
    clawImpact() {
        this.sweepTone('sine', 130, 40, 0.28, 0.5);
        this.sweepNoise('lowpass', 1200, 150, 0.3, 0.32);
        this.sweepNoise('highpass', 3500, 2200, 0.14, 0.14, 0.03);
        this.sweepNoise('bandpass', 2400, 900, 0.18, 0.1, 0.06);
    }

    // Low beastly growl before the sweep
    bossGrowl(dur = 0.45) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(75, t);
        osc.frequency.linearRampToValueAtTime(95, t + dur);
        lfo.frequency.setValueAtTime(28, t);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, t);
        const vol = 0.3 * this.sfxVolume * this.masterVolume;
        lfoGain.gain.setValueAtTime(vol * 0.5, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.08);
        gain.gain.setValueAtTime(vol, t + dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        lfo.start(t);
        osc.stop(t + dur + 0.05);
        lfo.stop(t + dur + 0.05);
    }

    // Roaring rush across the arena
    bossSweep() {
        this.sweepNoise('bandpass', 350, 1800, 0.25, 0.3);
        this.sweepNoise('bandpass', 1800, 300, 0.4, 0.25, 0.22);
        this.sweepTone('sawtooth', 90, 55, 0.6, 0.12);
    }

    // Boss hitting the arena wall at the end of a sweep
    bossThud() {
        this.sweepTone('sine', 110, 35, 0.3, 0.4);
        this.sweepNoise('lowpass', 700, 120, 0.3, 0.25);
    }

    // Ground rumbling under the pillar warning markers
    pillarRumble() {
        this.sweepNoise('lowpass', 120, 260, 0.9, 0.35, 0, 0.7);
        this.sweepTone('sine', 40, 55, 0.9, 0.2);
    }

    // A blight pillar bursting out of the ground
    pillarErupt() {
        this.sweepNoise('bandpass', 500, 2600, 0.45, 0.22);
        this.sweepNoise('lowpass', 600, 100, 0.6, 0.22);
        this.sweepTone('sine', 80, 30, 0.4, 0.3);
    }

    // Mask taking a hit: brittle porcelain crack
    bossHurt(big = false) {
        this.sweepTone('square', big ? 1500 : 1900, big ? 600 : 900, 0.06, big ? 0.14 : 0.09);
        this.sweepNoise('highpass', 5000, 2500, 0.07, big ? 0.16 : 0.1);
    }

    // Phase change / intro: deep distorted roar
    bossRoar(dur = 1.3, volume = 1) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const vol = 0.32 * volume * this.sfxVolume * this.masterVolume;
        const out = this.ctx.createGain();
        out.gain.setValueAtTime(0.0001, t);
        out.gain.linearRampToValueAtTime(vol, t + 0.15);
        out.gain.setValueAtTime(vol, t + dur * 0.6);
        out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        out.connect(this.ctx.destination);
        // two detuned saws through vowel-like formant filters
        for (const [f, d] of [[105, -12], [108, 12]]) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(f, t);
            osc.frequency.linearRampToValueAtTime(f * 1.25, t + dur * 0.3);
            osc.frequency.exponentialRampToValueAtTime(f * 0.6, t + dur);
            osc.detune.setValueAtTime(d, t);
            for (const formant of [550, 1100]) {
                const bp = this.ctx.createBiquadFilter();
                bp.type = 'bandpass';
                bp.Q.setValueAtTime(4, t);
                bp.frequency.setValueAtTime(formant, t);
                bp.frequency.linearRampToValueAtTime(formant * 0.7, t + dur);
                osc.connect(bp);
                bp.connect(out);
            }
            osc.start(t);
            osc.stop(t + dur + 0.05);
        }
        this.sweepNoise('bandpass', 800, 300, dur, 0.18 * volume);
    }

    // Mask shattering on defeat
    bossShatter() {
        this.sweepTone('sine', 80, 25, 0.8, 0.6);
        this.sweepNoise('highpass', 6000, 2000, 0.6, 0.25);
        for (let i = 0; i < 12; i++) {
            const f = 1800 + Math.random() * 3500;
            this.sweepTone('sine', f, f * 0.92, 0.25, 0.07, Math.random() * 0.5);
        }
    }

    // ---- Music (composed procedural themes live in music.js)
    // Settings menu levels, 0-10 each (7 = the original mix)
    setLevels(musicLevel, sfxLevel) {
        this.bgmVolume = 0.05 * musicLevel;
        this.sfxVolume = 0.085 * sfxLevel;
        music.setVolume(this.musicVolume);
    }

    get musicVolume() {
        return this.bgmVolume * this.masterVolume * 2.2;
    }

    // Title screen theme: "Twilight Vale"
    startBGM() {
        if (!this.ctx) return;
        music.start(this.ctx, 'title', this.musicVolume);
    }

    // Boss theme: "The Blighted Mask"
    startBattleBGM() {
        if (!this.ctx) return;
        music.start(this.ctx, 'boss', this.musicVolume);
    }

    // 1 = phase 1, 2 = phase 2 (key change, faster, fuller)
    setIntensity(level) {
        music.setIntensity(level);
    }

    stopBGM() {
        music.stop();
    }

    // Freeze all sound (music and effects) while the game is paused; resume picks up seamlessly
    pause() {
        if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    // 'victory' | 'defeat' jingle
    playStinger(name) {
        if (!this.ctx) return;
        music.stinger(this.ctx, name, this.musicVolume);
    }
}

export const audio = new AudioManager();
