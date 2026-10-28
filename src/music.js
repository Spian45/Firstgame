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

// Shared by the power chord and chug: stacked saws -> drive -> waveshaper -> cab-like filters
function distGuitar(m, t, midi, dur, vel, { intervals, peak, decay, sustain, release, cutoff }) {
    const { ctx } = m;
    const g = envGain(ctx, t, peak * vel, 0.004, decay, sustain, release, dur);
    const pre = ctx.createGain();
    pre.gain.value = 3;
    const ws = ctx.createWaveShaper();
    ws.curve = m.distCurve;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t);
    lp.Q.value = 1.2;
    const stop = t + dur + release + 0.1;
    for (const iv of intervals) {
        osc(ctx, 'sawtooth', midiFreq(midi + iv), t, stop, -7).connect(pre);
        osc(ctx, 'sawtooth', midiFreq(midi + iv), t, stop, 7).connect(pre);
    }
    pre.connect(ws).connect(hp).connect(lp).connect(g);
    m.out(g, 0.12);
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

    // ---- metal section (boss theme)

    // Distorted power chord (root, fifth, octave) through a waveshaper: the open, ringing guitar
    power(m, t, midi, dur, vel) {
        distGuitar(m, t, midi, dur, vel, { intervals: [0, 7, 12], peak: 0.06, decay: 0.25, sustain: 0.7, release: 0.18, cutoff: 3400 });
    },
    // Palm-muted chug: short, dark, tight
    chug(m, t, midi, dur, vel) {
        distGuitar(m, t, midi, Math.min(dur, 0.09), vel, { intervals: [0, 7], peak: 0.07, decay: 0.08, sustain: 0.25, release: 0.04, cutoff: 1300 });
    },
    // Screaming distorted lead with vibrato (the boss melody)
    shred(m, t, midi, dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.05 * vel, 0.008, 0.1, 0.8, 0.12, dur);
        const pre = ctx.createGain();
        pre.gain.value = 2.5;
        const ws = ctx.createWaveShaper();
        ws.curve = m.distCurve;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(4200, t);
        const o = osc(ctx, 'sawtooth', midiFreq(midi), t, t + dur + 0.2);
        const o2 = osc(ctx, 'square', midiFreq(midi), t, t + dur + 0.2, 9);
        const lfo = osc(ctx, 'sine', 6.5, t, t + dur + 0.2);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(midiFreq(midi) * 0.014, t + Math.min(0.3, dur));
        lfo.connect(depth);
        depth.connect(o.frequency);
        depth.connect(o2.frequency);
        o.connect(pre);
        o2.connect(pre);
        pre.connect(ws).connect(f).connect(g);
        m.out(g, 0.35);
    },
    // Dark "aah" choir: detuned saws through two vowel formants, slow swell
    choir(m, t, midi, dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.045 * vel, 0.35, 0.3, 0.85, 0.9, dur);
        const mix = ctx.createGain();
        for (const [freq, q, amt] of [[650, 6, 1], [1080, 7, 0.6], [2500, 8, 0.25]]) {
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(freq, t);
            bp.Q.setValueAtTime(q, t);
            const a = ctx.createGain();
            a.gain.value = amt * 3;
            mix.connect(bp).connect(a).connect(g);
        }
        for (const d of [-12, 0, 11]) {
            const o = osc(ctx, 'sawtooth', midiFreq(midi), t, t + dur + 1.2, d);
            const lfo = osc(ctx, 'sine', 4.8 + d * 0.02, t, t + dur + 1.2);
            const depth = ctx.createGain();
            depth.gain.value = midiFreq(midi) * 0.006;
            lfo.connect(depth).connect(o.frequency);
            o.connect(mix);
        }
        m.out(g, 0.8);
    },
    // Brass/orchestra hit: wide saws with a fast filter fall
    hit(m, t, midi, dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.07 * vel, 0.004, 0.3, 0.15, 0.3, 0.05);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(5000, t);
        f.frequency.exponentialRampToValueAtTime(500, t + 0.35);
        for (const d of [-14, 0, 14]) osc(ctx, 'sawtooth', midiFreq(midi), t, t + 0.6, d).connect(f);
        osc(ctx, 'sawtooth', midiFreq(midi - 12), t, t + 0.6).connect(f);
        f.connect(g);
        m.out(g, 0.5);
    },
    // Sub drop: a deep sine sweeping down, for section hits
    drop(m, t, _midi, _dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.45 * vel, 0.005, 0.9, 0.01, 0.2, 0.01);
        const o = osc(ctx, 'sine', 90, t, t + 1.3);
        o.frequency.exponentialRampToValueAtTime(28, t + 1);
        o.connect(g);
        m.out(g, 0);
    },
    // Noise riser sweeping up into the next section
    riser(m, t, _midi, dur, vel) {
        const { ctx } = m;
        const src = ctx.createBufferSource();
        src.buffer = m._noise;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 2;
        f.frequency.setValueAtTime(300, t);
        f.frequency.exponentialRampToValueAtTime(7000, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16 * vel, t + dur);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
        src.connect(f).connect(g);
        m.out(g, 0.4);
        src.start(t);
        src.stop(t + dur + 0.1);
    },
    // Tight double-kick: shorter and punchier than the main kick
    dkick(m, t, _midi, _dur, vel) {
        const { ctx } = m;
        const g = envGain(ctx, t, 0.4 * vel, 0.001, 0.11, 0.01, 0.03, 0.01);
        const o = osc(ctx, 'sine', 170, t, t + 0.18);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.08);
        o.connect(g);
        m.out(g, 0);
        m.noise(t, 0.012, 'highpass', 3000, 0.08 * vel, 0); // beater click
    },
    // Fat metal snare: noise crack plus body
    msnare(m, t, _midi, _dur, vel) {
        m.noise(t, 0.2, 'bandpass', 2200, 0.38 * vel, 0.35);
        m.noise(t, 0.08, 'highpass', 6000, 0.12 * vel, 0.1);
        const { ctx } = m;
        const g = envGain(ctx, t, 0.16 * vel, 0.002, 0.1, 0.01, 0.03, 0.01);
        const o = osc(ctx, 'triangle', 230, t, t + 0.14);
        o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
        o.connect(g);
        m.out(g, 0.25);
    },
    ride(m, t, _midi, _dur, vel) {
        m.noise(t, 0.25, 'highpass', 8000, 0.06 * vel, 0.2);
        const { ctx } = m;
        const g = envGain(ctx, t, 0.02 * vel, 0.001, 0.3, 0.1, 0.2, 0.01);
        osc(ctx, 'square', 5400, t, t + 0.5).connect(g);
        m.out(g, 0.2);
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

// "The Blighted Mask": boss theme in a heavy-metal-meets-choir style. D minor with phrygian (Eb) and
// harmonic-minor (C#) colour. A 2-bar build-up plays once (it starts on the boss's roar), then a
// 36-bar loop (~51s): RIFF -> THEME -> BREAKDOWN -> BRIDGE -> CLIMAX. Phase 2 transposes up a semitone,
// speeds up and adds double kick, octave-doubled leads and more orchestra hits.
// Section roots are guitar-register midi notes (38 = D2); chords are built from them.

// Triad over a root: D and A minor-ish keys are minor, the borrowed chords major, C# diminished
function triad(root) {
    const pc = ((root % 12) + 12) % 12;
    if (pc === 2) return [root, root + 3, root + 7];          // D minor
    if (pc === 1) return [root, root + 3, root + 6];          // C# diminished
    return [root, root + 4, root + 7];                        // Bb C A Eb Ab major
}

// Melodies: one entry per bar, [step, midi, length in steps]
const RIFF_HOOK = [ // bars 5-8 of the riff, from the second time round
    [[0, 74, 2], [2, 74, 2], [4, 77, 2], [6, 74, 2], [8, 79, 2], [10, 77, 2], [12, 75, 4]],
    [[0, 74, 2], [2, 74, 2], [4, 77, 2], [6, 74, 2], [8, 81, 4], [12, 80, 4]],
    [[0, 75, 4], [4, 79, 4], [8, 82, 4], [12, 79, 4]],
    [[0, 81, 8], [8, 73, 8]]
];
const THEME = [
    [[0, 74, 4], [4, 77, 4], [8, 81, 6], [14, 80, 2]],
    [[0, 82, 8], [8, 81, 4], [12, 77, 4]],
    [[0, 79, 4], [4, 76, 4], [8, 72, 4], [12, 76, 4]],
    [[0, 77, 6], [6, 76, 2], [8, 73, 8]],
    [[0, 74, 2], [2, 77, 2], [4, 81, 4], [8, 86, 6], [14, 84, 2]],
    [[0, 82, 4], [4, 86, 4], [8, 89, 8]],
    [[0, 87, 4], [4, 86, 4], [8, 82, 4], [12, 79, 4]],
    [[0, 85, 8], [8, 81, 4], [12, 76, 4]]
];
const CLIMAX = [
    [[0, 86, 2], [2, 85, 2], [4, 86, 2], [6, 81, 2], [8, 77, 2], [10, 81, 2], [12, 74, 4]],
    [[0, 82, 2], [2, 81, 2], [4, 82, 2], [6, 77, 2], [8, 74, 2], [10, 77, 2], [12, 70, 4]],
    [[0, 79, 2], [2, 77, 2], [4, 79, 2], [6, 76, 2], [8, 72, 2], [10, 76, 2], [12, 79, 4]],
    [[0, 81, 6], [6, 80, 2], [8, 81, 8]],
    [[0, 86, 4], [4, 89, 4], [8, 93, 6], [14, 91, 2]],
    [[0, 91, 4], [4, 87, 4], [8, 82, 8]],
    [[0, 89, 4], [4, 88, 4], [8, 85, 8]],
    [[0, 86, 12], [12, 81, 4]]
];

// Guitar patterns, one character per 16th: P power chord, C palm-muted chug, . rest
const RIFF = 'P.CCC.CCP.CCC.P.';
const RIFF_OFFSET = [0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 1, 0]; // the 2nd and 3rd stabs hit F and Eb
const BREAK = 'C..C..C.C...C.C.';

const BOSS = {
    bpm: 168,
    intro: { name: 'intro', roots: [38, 38] },
    loop: [
        { name: 'riff', roots: [38, 38, 34, 36, 38, 38, 39, 33] },
        { name: 'theme', roots: [38, 34, 36, 33, 38, 34, 39, 37] },
        { name: 'break', roots: [38, 39, 38, 32] },
        { name: 'bridge', roots: [34, 36, 38, 38, 34, 36, 39, 33] },
        { name: 'climax', roots: [38, 34, 36, 33, 38, 39, 37, 38] }
    ],

    // Which section and bar a global bar number falls in
    locate(bar) {
        if (bar < this.intro.roots.length) return { sec: this.intro, i: bar, pass: 0 };
        const len = this.loop.reduce((n, s) => n + s.roots.length, 0);
        let b = bar - this.intro.roots.length;
        const pass = Math.floor(b / len);
        b %= len;
        for (const sec of this.loop) {
            if (b < sec.roots.length) return { sec, i: b, pass };
            b -= sec.roots.length;
        }
        return { sec: this.loop[0], i: 0, pass };
    },

    step(m, step, t) {
        const s = step % 16;
        const { sec, i, pass } = this.locate(Math.floor(step / 16));
        const hot = m.intensity > 1;
        const key = hot ? 1 : 0;
        const root = sec.roots[i] + key;
        const chord = triad(sec.roots[i]).map((n) => n + key);
        const last = i === sec.roots.length - 1;
        const sd = m.stepDur;
        const P = (name, midi, len, vel) => m.play(name, t, midi, sd * len, vel);
        const lead = (bars, vel = 1, bar = i) => {
            for (const [ms, midi, len] of bars[bar] || []) {
                if (ms !== s) continue;
                P('shred', midi + key, len * 0.95, vel);
                if (hot) P('shred', midi + key - 12, len * 0.95, vel * 0.5); // octave doubling in phase 2
            }
        };
        const choirChord = (len, vel) => { for (const n of chord) P('choir', n + 24, len, vel); };

        switch (sec.name) {
            case 'intro': {
                // orchestra hit and sub drop on the roar, taiko pulse, then a snare roll and riser into the riff
                if (i === 0 && s === 0) {
                    P('hit', root + 24, 4, 1);
                    P('drop', 0, 0, 1);
                    P('crash', 0, 0, 1);
                    P('power', root, 16, 0.9);
                    choirChord(32, 0.9);
                }
                if (i === 0 && [0, 6, 8, 12, 14].includes(s)) P('taiko', 0, 0, 1);
                if (i === 1) {
                    if (s === 0) P('riser', 0, 16, 1);
                    if (s % 2 === 0 || s >= 12) P('msnare', 0, 0, 0.35 + s * 0.04);
                    if (s % 4 === 0) P('taiko', 0, 0, 0.8);
                }
                break;
            }
            case 'riff': {
                const ch = RIFF[s];
                if (ch === 'C') P('chug', root, 1, 0.9);
                if (ch === 'P') P('power', root + RIFF_OFFSET[s], 2, 1);
                if (ch !== '.') P('dkick', 0, 0, ch === 'P' ? 1 : 0.8);
                else if (hot) P('dkick', 0, 0, 0.6);
                if (s === 4 || s === 12) P('msnare', 0, 0, 1);
                if (s % 2 === 0) P('hat', 0, 0, s % 4 === 0 ? 0.9 : 0.5);
                if (s === 0 && i % 4 === 0) { P('crash', 0, 0, 1); choirChord(64, 0.55); }
                if (i >= 4 && (pass > 0 || hot)) lead(RIFF_HOOK, 1, i - 4);
                if (last && s >= 12) P('msnare', 0, 0, 0.6 + (s - 12) * 0.12);
                break;
            }
            case 'theme': {
                // ringing power chords with a gallop at the end of each bar
                if (s === 0) P('power', root, 8, 1);
                if (s === 8) P('power', root, 4, 0.9);
                if (s >= 12) P('chug', root, 1, s === 12 ? 1 : 0.8);
                if ([0, 3, 6, 8, 10, 11, 14].includes(s) || (hot && s % 2 === 1)) P('dkick', 0, 0, 0.9);
                if (s === 4 || s === 12) P('msnare', 0, 0, 1);
                if (s % 2 === 0) P('ride', 0, 0, s % 4 === 0 ? 1 : 0.6);
                if (s === 0 && i % 4 === 0) P('crash', 0, 0, 1);
                if (s === 0) choirChord(16, 0.4);
                if (hot && s === 0) P('hit', root + 24, 2, 0.6);
                lead(THEME);
                if (last && s >= 12) P('msnare', 0, 0, 0.7);
                break;
            }
            case 'break': {
                // half-time breakdown: heavy syncopated chugs with gaps, one snare per bar, ominous bells
                if (BREAK[s] === 'C') { P('chug', root, 1, 1); P('dkick', 0, 0, 1); }
                if (s === 8) P('msnare', 0, 0, 1);
                if (s === 0) P('crash', 0, 0, 0.8);
                if (i === 0 && s === 0) { P('drop', 0, 0, 1); P('hit', root + 24, 4, 1); choirChord(64, 0.7); }
                if (s % 4 === 0) P('bell', chord[(s / 4) % 3] + 36, 4, 0.45);
                if (last && s >= 8) P('msnare', 0, 0, 0.4 + (s - 8) * 0.07);
                break;
            }
            case 'bridge': {
                // the choir takes the lead over held power chords; double kick swells under it
                if (s === 0) P('power', root, 16, 0.75);
                if (s === 8) P('power', root + 7, 8, 0.55);
                P('dkick', 0, 0, 0.3 + i * 0.06);
                if (s === 4 || s === 12) P('msnare', 0, 0, 0.85);
                if (s === 0) { choirChord(16, 0.85); P('choir', chord[0] + 12, 16, 0.6); }
                if (s % 2 === 0) {
                    const arp = [chord[0], chord[1], chord[2], chord[0] + 12, chord[2], chord[1], chord[0], chord[1]];
                    P('bell', arp[s / 2] + 36, 2, 0.35);
                }
                if (hot) lead(THEME, 0.8);
                if (last) {
                    if (s === 0) P('riser', 0, 16, 1);
                    if (s >= 8) P('msnare', 0, 0, 0.4 + (s - 8) * 0.08);
                }
                break;
            }
            case 'climax': {
                // blast beat, tremolo-picked guitar, orchestra hits, the fastest lead
                P('dkick', 0, 0, 0.75);
                if (s % 2 === 1) P('msnare', 0, 0, 0.6);
                if (s % 4 === 0) P('ride', 0, 0, 1);
                if (s === 0) { P('crash', 0, 0, 0.9); P('hit', chord[0] + 24, 2, 0.8); choirChord(16, 0.5); }
                if (s === 0 || s === 8) P('power', root, 8, 0.85);
                else P('chug', root, 1, 0.65);
                lead(CLIMAX);
                break;
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
        // soft-clip curve for the guitars and lead
        this.distCurve = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) {
            const x = (i / 1023) * 2 - 1;
            this.distCurve[i] = Math.tanh(x * 6) * 0.9;
        }
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

    // Change the playing song's volume smoothly (settings menu)
    setVolume(volume) {
        if (!this.bus || !this.ctx) return;
        for (const g of [this.bus.dry, this.bus.wet]) g.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
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
