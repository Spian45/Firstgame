// Procedural soundtrack: a small step sequencer + synth instruments, all Web Audio, no files.
// Songs are 16th-note step patterns; a look-ahead scheduler keeps timing tight even when frames drop.
//
//   music.play(ctx, 'title' | 'boss', volume)   music.stop()   music.setIntensity(1 | 2)
//   music.stinger(ctx, 'victory' | 'defeat', volume)

const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- instruments
// Each takes (m: Music, time, midi, duration in seconds, velocity 0..1)

function envGain(ctx, time, peak, attack, decay, sustainLevel, release, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(peak, time + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustainLevel), time + attack + decay);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sustainLevel), time + Math.max(attack + decay, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(attack + decay, dur) + release);
    return g;
}

function osc(ctx, type, freq, time, stop, detune = 0) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    o.detune.setValueAtTime(detune, time);
    o.start(time);
    o.stop(stop);
    return o;
}

const INSTRUMENTS = {
    // Warm detuned-saw pad through a soft lowpass
    pad(m, t, midi, dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.07 * vel, 0.6, 0.4, 0.8, 1.2, dur);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(900, t);
        for (const d of [-9, 9]) osc(ctx, 'sawtooth', midiFreq(midi), t, t + dur + 1.4, d).connect(f);
        f.connect(g);
        m.out(g, 0.5);
    },
    // Plucked koto: bright attack, quick filter close
    koto(m, t, midi, dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.16 * vel, 0.004, 0.25, 0.15, 0.35, 0.05);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(midiFreq(midi) * 6, t);
        f.frequency.exponentialRampToValueAtTime(midiFreq(midi) * 1.5, t + 0.3);
        osc(ctx, 'triangle', midiFreq(midi), t, t + 0.8).connect(f);
        osc(ctx, 'sawtooth', midiFreq(midi), t, t + 0.8, 4).connect(f);
        f.connect(g);
        m.out(g, 0.35);
    },
    // Glassy bell: sine + inharmonic partial, long ring
    bell(m, t, midi, dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.13 * vel, 0.005, 0.6, 0.35, 1.4, dur);
        osc(ctx, 'sine', midiFreq(midi), t, t + dur + 2).connect(g);
        const g2 = envGain(ctx, t, 0.04 * vel, 0.003, 0.25, 0.1, 0.4, 0.05);
        osc(ctx, 'sine', midiFreq(midi) * 2.76, t, t + 1).connect(g2);
        g2.connect(g);
        m.out(g, 0.6);
    },
    // Breathy flute: sine with delayed vibrato
    flute(m, t, midi, dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.1 * vel, 0.08, 0.2, 0.85, 0.3, dur);
        const o = osc(ctx, 'sine', midiFreq(midi), t, t + dur + 0.5);
        const lfo = osc(ctx, 'sine', 5.5, t, t + dur + 0.5);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(midiFreq(midi) * 0.012, t + 0.35);
        lfo.connect(depth).connect(o.frequency);
        o.connect(g);
        m.out(g, 0.5);
    },
    // Round sub bass (title)
    softBass(m, t, midi, dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.22 * vel, 0.02, 0.3, 0.6, 0.3, dur);
        osc(ctx, 'sine', midiFreq(midi), t, t + dur + 0.4).connect(g);
        osc(ctx, 'triangle', midiFreq(midi) * 2, t, t + dur + 0.4).connect(envGain(ctx, t, 0.3, 0.01, 0.1, 0.2, 0.2, dur)).connect(g);
        m.out(g, 0.1);
    },
    // Driving saw bass with filter "pluck" (boss)
    bass(m, t, midi, dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.2 * vel, 0.005, 0.12, 0.5, 0.06, dur);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.setValueAtTime(6, t);
        f.frequency.setValueAtTime(1400, t);
        f.frequency.exponentialRampToValueAtTime(220, t + 0.14);
        osc(ctx, 'sawtooth', midiFreq(midi), t, t + dur + 0.1).connect(f);
        osc(ctx, 'square', midiFreq(midi - 12), t, t + dur + 0.1).connect(f);
        f.connect(g);
        m.out(g, 0.05);
    },
    // Square lead with vibrato (boss melody)
    lead(m, t, midi, dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.075 * vel, 0.01, 0.1, 0.7, 0.12, dur);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(3200, t);
        const o = osc(ctx, 'square', midiFreq(midi), t, t + dur + 0.2);
        const o2 = osc(ctx, 'sawtooth', midiFreq(midi), t, t + dur + 0.2, 7);
        const lfo = osc(ctx, 'sine', 6, t, t + dur + 0.2);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(midiFreq(midi) * 0.01, t + Math.min(0.25, dur));
        lfo.connect(depth);
        depth.connect(o.frequency);
        depth.connect(o2.frequency);
        o.connect(f);
        o2.connect(f);
        f.connect(g);
        m.out(g, 0.4);
    },
    // Short brassy chord stab
    stab(m, t, midi, dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.05 * vel, 0.005, 0.15, 0.2, 0.1, 0.05);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(2600, t);
        f.frequency.exponentialRampToValueAtTime(600, t + 0.2);
        osc(ctx, 'sawtooth', midiFreq(midi), t, t + 0.4, -6).connect(f);
        osc(ctx, 'sawtooth', midiFreq(midi), t, t + 0.4, 6).connect(f);
        f.connect(g);
        m.out(g, 0.3);
    },

    // ---- drums (midi ignored)
    kick(m, t, _midi, _dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.55 * vel, 0.002, 0.25, 0.01, 0.05, 0.01);
        const o = osc(ctx, 'sine', 150, t, t + 0.35);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
        o.connect(g);
        m.out(g, 0);
    },
    taiko(m, t, _midi, _dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.5 * vel, 0.003, 0.4, 0.01, 0.1, 0.01);
        const o = osc(ctx, 'sine', 110, t, t + 0.6);
        o.frequency.exponentialRampToValueAtTime(55, t + 0.35);
        o.connect(g);
        m.out(g, 0.25);
        m.noise(t, 0.08, 'bandpass', 700, 0.18 * vel, 0.2);
    },
    snare(m, t, _midi, _dur, vel) {
        m.noise(t, 0.16, 'bandpass', 1800, 0.3 * vel, 0.2);
        const { ctx } = m;
        const g = envGain(ctx, t, 0.12 * vel, 0.002, 0.08, 0.01, 0.02, 0.01);
        osc(ctx, 'triangle', 190, t, t + 0.12).connect(g);
        m.out(g, 0.2);
    },
    hat(m, t, _midi, _dur, vel) {
        m.noise(t, 0.04, 'highpass', 7000, 0.12 * vel, 0.05);
    },
    shaker(m, t, _midi, _dur, vel) {
        m.noise(t, 0.07, 'highpass', 5000, 0.05 * vel, 0.3);
    },
    crash(m, t, _midi, _dur, vel) {
        m.noise(t, 1.2, 'highpass', 4000, 0.12 * vel, 0.4);
    }
};

// ---------------------------------------------------------------- songs
// chords: [root midi, third, fifth] per bar. Melody notes: [step, midi, length in steps].

const TITLE = {
    bpm: 76,
    bars: 8,
    chords: [[62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 61, 64], [62, 65, 69], [53, 57, 60], [60, 64, 67], [57, 61, 64]],
    melody: [
        [[0, 69, 6], [6, 72, 2], [8, 74, 8]],
        [[0, 77, 4], [4, 74, 4], [8, 70, 8]],
        [[0, 67, 6], [6, 70, 2], [8, 74, 6], [14, 72, 2]],
        [[0, 73, 12], [12, 69, 4]],
        [[0, 69, 6], [6, 72, 2], [8, 74, 8]],
        [[0, 77, 4], [4, 81, 4], [8, 79, 8]],
        [[0, 76, 6], [6, 74, 2], [8, 72, 8]],
        [[0, 73, 8], [8, 74, 8]]
    ],
    step(m, step, t) {
        const bar = Math.floor(step / 16) % this.bars;
        const pass = Math.floor(step / (16 * this.bars));
        const s = step % 16;
        const chord = this.chords[bar];
        const sd = m.stepDur;

        if (s === 0) {
            for (const n of chord) m.play('pad', t, n, sd * 16, 1);
            m.play('softBass', t, chord[0] - 24, sd * 7, 0.9);
        }
        if (s === 8) m.play('softBass', t, chord[0] - 24 + (bar % 2 ? 7 : 0), sd * 7, 0.7);

        // koto arpeggio in 8ths, up and back down
        if (s % 2 === 0) {
            const arp = [chord[0], chord[1], chord[2], chord[0] + 12, chord[2] + 12, chord[0] + 12, chord[2], chord[1]];
            m.play('koto', t, arp[s / 2], sd * 2, s === 0 ? 1 : 0.7);
        }
        // melody: bell on odd passes, breathy flute an octave down on even ones; first pass is intro
        if (pass > 0) {
            for (const [ms, midi, len] of this.melody[bar]) {
                if (ms !== s) continue;
                if (pass % 2 === 1) m.play('bell', t, midi, sd * len, 0.9);
                else m.play('flute', t, midi - 12, sd * len, 0.9);
            }
            if (s % 4 === 2) m.play('shaker', t, 0, 0, s === 10 ? 1 : 0.6);
        }
    }
};

const BOSS = {
    bpm: 150,
    bars: 8,
    chords: [[62, 65, 69], [58, 62, 65], [63, 67, 70], [60, 64, 67], [62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 61, 64]],
    melody: [
        [[0, 74, 3], [3, 77, 3], [6, 81, 4], [10, 79, 2], [12, 77, 4]],
        [[0, 74, 6], [6, 77, 2], [8, 82, 6], [14, 81, 2]],
        [[0, 79, 3], [3, 82, 3], [6, 87, 4], [10, 86, 2], [12, 82, 4]],
        [[0, 79, 6], [6, 76, 2], [8, 72, 8]],
        [[0, 74, 3], [3, 77, 3], [6, 81, 4], [10, 79, 2], [12, 77, 4]],
        [[0, 82, 3], [3, 81, 3], [6, 77, 4], [10, 74, 6]],
        [[0, 79, 4], [4, 82, 4], [8, 86, 4], [12, 84, 4]],
        [[0, 85, 8], [8, 81, 4], [12, 76, 4]]
    ],
    bassPattern: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 7, 10, 12],
    step(m, step, t) {
        const bar = Math.floor(step / 16) % this.bars;
        const pass = Math.floor(step / (16 * this.bars));
        const s = step % 16;
        const hot = m.intensity > 1;
        const key = hot ? 1 : 0; // phase 2 jumps up a semitone
        const chord = this.chords[bar].map((n) => n + key);
        const sd = m.stepDur;
        const fill = bar === 7;

        // drums
        if ([0, 6, 8, 11].includes(s) || (hot && s === 14)) m.play('kick', t, 0, 0, s === 0 ? 1 : 0.85);
        if (s === 4 || s === 12) m.play('snare', t, 0, 0, 1);
        if (fill && s >= 12) m.play('snare', t, 0, 0, 0.45 + (s - 12) * 0.15);
        if (hot ? true : s % 2 === 0) m.play('hat', t, 0, 0, s % 4 === 2 ? 1 : 0.55);
        if (s === 0 && bar % 2 === 0) m.play('taiko', t, 0, 0, 1);
        if (fill && [8, 10, 13].includes(s)) m.play('taiko', t, 0, 0, 0.8);
        if (s === 0 && bar === 0 && (pass > 0 || hot)) m.play('crash', t, 0, 0, 1);

        // driving bass
        m.play('bass', t, chord[0] - 24 + this.bassPattern[s], sd * 0.9, s % 4 === 0 ? 1 : 0.75);

        // chord stabs in phase 2
        if (hot && (s === 0 || s === 10)) for (const n of chord) m.play('stab', t, n, sd, 1);

        // lead melody (silent for the first four bars: drums + bass intro)
        if (pass > 0 || bar >= 4 || hot) {
            for (const [ms, midi, len] of this.melody[bar]) {
                if (ms !== s) continue;
                m.play('lead', t, midi + key, sd * len * 0.95, 1);
                if (hot) m.play('lead', t, midi + key - 12, sd * len * 0.95, 0.55); // octave doubling
            }
        }
    }
};

const SONGS = { title: TITLE, boss: BOSS };

// One-shot jingles: [time in beats, instrument, midi, length in beats, velocity]
const STINGERS = {
    victory: {
        bpm: 120,
        notes: [
            [0, 'crash', 0, 0, 1], [0, 'taiko', 0, 0, 1],
            [0, 'lead', 74, 0.5, 1], [0.5, 'lead', 78, 0.5, 1], [1, 'lead', 81, 0.5, 1], [1.5, 'lead', 86, 2.5, 1],
            [1.5, 'pad', 62, 4, 1], [1.5, 'pad', 66, 4, 1], [1.5, 'pad', 69, 4, 1],
            [1.5, 'bell', 86, 3, 1], [2, 'bell', 90, 3, 0.8], [2.5, 'bell', 93, 3, 0.7]
        ]
    },
    defeat: {
        bpm: 70,
        notes: [
            [0, 'taiko', 0, 0, 1],
            [0, 'pad', 50, 4, 1], [0, 'pad', 53, 4, 1], [0, 'pad', 57, 4, 1],
            [0, 'bell', 74, 1, 0.9], [1, 'bell', 72, 1, 0.8], [2, 'bell', 69, 1, 0.7], [3, 'bell', 62, 3, 0.8]
        ]
    }
};

// ---------------------------------------------------------------- engine
class Music {
    constructor() {
        this.ctx = null;
        this.bus = null;
        this.timer = null;
        this.intensity = 1;
        this.song = null;
    }

    get stepDur() {
        const bpm = this.song.bpm * (this.intensity > 1 && this.song === BOSS ? 1.07 : 1);
        return 60 / bpm / 4;
    }

    // Shared reverb (generated impulse) for a sense of space
    ensureFx(ctx) {
        if (this.reverb && this.ctx === ctx) return;
        this.ctx = ctx;
        const len = Math.floor(ctx.sampleRate * 2.2);
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const data = ir.getChannelData(c);
            for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        }
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = ir;
        this.reverbOut = ctx.createGain();
        this.reverbOut.gain.value = 0.6;
        this.reverb.connect(this.reverbOut);
        this.comp = ctx.createDynamicsCompressor();
        this.comp.threshold.value = -16;
        this.comp.ratio.value = 4;
        this.reverbOut.connect(this.comp);
        this.comp.connect(ctx.destination);
        this._noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = this._noise.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }

    newBus(volume) {
        const bus = this.ctx.createGain();
        bus.gain.value = volume;
        bus.connect(this.comp);
        const send = this.ctx.createGain();
        send.gain.value = volume;
        send.connect(this.reverb);
        return { dry: bus, wet: send };
    }

    // Route a voice into the current bus with a reverb send amount
    out(node, reverbAmount) {
        const bus = this.target;
        node.connect(bus.dry);
        if (reverbAmount > 0) {
            const s = this.ctx.createGain();
            s.gain.value = reverbAmount;
            node.connect(s).connect(bus.wet);
        }
    }

    noise(t, dur, filterType, freq, vol, reverbAmount) {
        const src = this.ctx.createBufferSource();
        src.buffer = this._noise;
        const f = this.ctx.createBiquadFilter();
        f.type = filterType;
        f.frequency.setValueAtTime(freq, t);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g);
        this.out(g, reverbAmount);
        src.start(t);
        src.stop(t + dur + 0.05);
    }

    play(name, t, midi, dur, vel) {
        INSTRUMENTS[name](this, t, midi, dur, vel);
    }

    start(ctx, name, volume) {
        this.stop();
        this.ensureFx(ctx);
        this.song = SONGS[name];
        this.intensity = 1;
        this.bus = this.newBus(volume);
        this.target = this.bus;
        this.stepIndex = 0;
        this.nextTime = ctx.currentTime + 0.1;
        // Look-ahead scheduler: queue notes ~120ms ahead on a 25ms tick
        this.timer = setInterval(() => {
            this.target = this.bus;
            while (this.nextTime < this.ctx.currentTime + 0.12) {
                this.song.step(this, this.stepIndex, this.nextTime);
                this.nextTime += this.stepDur;
                this.stepIndex++;
            }
        }, 25);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        if (this.bus) {
            const { dry, wet } = this.bus;
            const t = this.ctx.currentTime;
            for (const g of [dry, wet]) {
                g.gain.cancelScheduledValues(t);
                g.gain.setValueAtTime(g.gain.value, t);
                g.gain.linearRampToValueAtTime(0, t + 0.4);
            }
            setTimeout(() => { dry.disconnect(); wet.disconnect(); }, 2600);
            this.bus = null;
        }
    }

    setIntensity(level) {
        this.intensity = level;
    }

    stinger(ctx, name, volume) {
        this.ensureFx(ctx);
        const s = STINGERS[name];
        const beat = 60 / s.bpm;
        const bus = this.newBus(volume);
        this.target = bus;
        const t0 = ctx.currentTime + 0.05;
        for (const [at, inst, midi, len, vel] of s.notes) this.play(inst, t0 + at * beat, midi, len * beat, vel);
        this.target = this.bus;
        setTimeout(() => { bus.dry.disconnect(); bus.wet.disconnect(); }, 9000);
    }
}

export const music = new Music();
