// Boss arena: "Ruined Shrine of the Autumn Vale"
// Built from the GandalfHardcore autumn background layers, floor tiles and decor sheets.
// The layout is deliberately asymmetric: nothing on the left mirrors the right.
export const VIEW_W = 640;
export const VIEW_H = 360;
export const ARENA_W = 768;
export const GROUND_Y = 312;

// Source rects inside the tile/decor sheets
const TILE_TOP = { sx: 32, sy: 192 };     // autumn grass top, middle piece
const TILE_FILL = { sx: 32, sy: 224 };    // autumn dirt fill, middle piece (also island earth)
const PLATFORM = { sx: 192, sy: 352, w: 96, h: 24 }; // 3 x 32px pieces: left cap, middle, right cap
const DECOR = {
    graveA: [197, 104, 23, 24],
    graveB: [229, 104, 21, 24],
    graveCross: [293, 101, 21, 27],
    rockBig: [196, 280, 88, 40],
    rockGrass: [132, 237, 52, 19],
    rockMed: [137, 210, 46, 14],
    grassClump: [97, 216, 28, 8],
    tuftA: [105, 155, 19, 5],
    tuftB: [132, 155, 23, 5],
    tuftC: [169, 155, 12, 5],
    bush: [3, 456, 57, 24],
    bushMed: [64, 463, 32, 17],
    bushSmall: [98, 464, 28, 16],
    leafPile: [161, 332, 93, 20],
    leafSmall: [163, 369, 56, 15],
    pumpkin: [362, 117, 14, 11],
    jackOLantern: [390, 113, 19, 15]
};
// Pine Trees.png: full autumn pines 93x192 (olive, red, orange) and a stump; Pine forest sheet: fallen log
const PINE = { olive: [97, 0, 93, 192], red: [225, 0, 93, 192], orange: [321, 0, 93, 192] };
const STUMP = [194, 8, 27, 24];
const LOG = [196, 144, 112, 32];
// Floor Tiles1: dark earth with hanging stalactites, used for the floating platforms' undersides
const STALACTITES = { sx: 224, sy: 296, w: 64, h: 32 };
// Platforms rising out of the ground at the start of a fight
const RUMBLE_TIME = 0.4;   // the ground cracks and glows this long before each island bursts out
const RISE_TIME = 1.4;     // seconds for one island to rise (with a small overshoot)
const RISE_STAGGER = 0.2;  // delay between neighbouring islands
const GARDEN = { urn: [35, 86, 27, 42] };

// Arena trees (world x, no parallax), in the gaps between torches so none stands behind one
const TREES = [
    { kind: 'red', x: -4 },
    { kind: 'olive', x: 190 },
    { kind: 'birch2', x: 452 },
    { kind: 'orange', x: 566 }
];

// Ground props, left to right: [kind, name, x, groundOffset]
const PROPS = [
    ['decor', 'bush', -8, 2],
    ['decor', 'graveCross', 56, 1],
    ['decor', 'graveA', 86, 1],
    ['decor', 'rockGrass', 108, 3],
    ['decor', 'tuftA', 18, 1],
    ['decor', 'jackOLantern', 168, 1],
    ['decor', 'pumpkin', 186, 1],
    ['decor', 'tuftC', 214, 1],
    ['decor', 'leafSmall', 222, 2],
    ['log', null, 290, 3],
    ['decor', 'tuftB', 312, 1],
    ['decor', 'bushMed', 398, 2],
    ['decor', 'rockBig', 424, 3],
    ['decor', 'grassClump', 470, 1],
    ['decor', 'graveB', 520, 1],
    ['decor', 'bushSmall', 552, 2],
    ['decor', 'leafPile', 590, 2],
    ['decor', 'tuftA', 600, 1],
    ['stump', null, 640, 2],
    ['garden', 'urn', 668, 1],
    ['decor', 'tuftB', 730, 1]
];
// Front undergrowth (darkened bushes in the dirt below the ground line)
const UNDERGROWTH = [['bush', 30], ['bushMed', 250], ['bush', 480], ['bushSmall', 700]];

const LEAF = ['#d9822b', '#b5562a', '#e8b04a', '#8e3b2a'];
const GRASS = ['#6b4a22', '#8a5f28', '#b07a32', '#c99a48'];

export class Arena {
    constructor(assets) {
        this.a = assets;
        this.time = 0;
        // Climbable but irregular: low left ledge (double jump), steps up to a wide high perch,
        // a mid-right stepping stone and a right ledge. Each island has its own shape and dressing.
        this.platforms = [
            { x: 52, y: 238, w: 96, depth: 30, slopeL: 1.3, slopeR: 0.7, deco: 'bush' },
            { x: 196, y: 186, w: 64, depth: 18, slopeL: 0.8, slopeR: 1.5, deco: 'mushrooms' },
            { x: 318, y: 150, w: 128, depth: 42, slopeL: 0.55, slopeR: 1.0, deco: 'rock' },
            { x: 492, y: 212, w: 64, depth: 24, slopeL: 1.2, slopeR: 0.8, deco: 'tufts' },
            { x: 590, y: 168, w: 96, depth: 34, slopeL: 1.0, slopeR: 0.55, deco: 'bushSmall' }
        ];
        this.torches = [
            { x: 150, frame: 0 },
            { x: 548, frame: 3 },
            { x: 330, y: 150, frame: 1 },
            { x: 434, y: 150, frame: 4 },
            { x: 676, y: 168, frame: 2 }
        ];
        // torches standing on a platform ride along with it
        for (const t of this.torches) {
            if (t.y !== undefined) t.plat = this.platforms.findIndex((p) => p.y === t.y);
        }
        // Platforms start buried and rise out of the ground when the boss is summoned (startRise),
        // then float with a gentle bob
        this.riseStart = null;
        this.campfire = { x: 258 };
        this.clouds = [
            { img: 'cloud6', x: 40, y: 18, speed: 3 },
            { img: 'cloud5', x: 420, y: 44, speed: 5 },
            { img: 'cloud4', x: 700, y: 26, speed: 4 }
        ];
        this.birds = [{ x: 500, y: 70, phase: 0 }, { x: 520, y: 78, phase: 1.3 }, { x: 488, y: 82, phase: 2.1 }];
        this.corruption = 0; // 0 = phase 1 dusk, 1 = phase 2 blood twilight

        // Fireflies drifting over the arena
        this.fireflies = [];
        for (let i = 0; i < 24; i++) {
            this.fireflies.push({
                x: Math.random() * ARENA_W,
                y: 110 + Math.random() * 190,
                phase: Math.random() * 6.28,
                speed: 0.4 + Math.random() * 0.6,
                blink: Math.random() * 6.28
            });
        }

        // Vines hanging from each island's underside (fixed layout, sway in render)
        this.vines = [];
        this.platforms.forEach((p, k) => {
            const spots = p.w > 96 ? [14, 52, p.w - 30] : p.w > 64 ? [12, p.w - 22] : [p.w - 18];
            spots.forEach((dx, i) => this.vines.push({
                x: p.x + dx,
                y: p.y + 22 + Math.floor(p.depth * 0.45),
                len: 6 + ((dx * 7 + i * 5 + k * 3) % 10),
                phase: dx * 0.3 + k,
                plat: k
            }));
        });

        // Foreground grass tufts along the front of the ground (irregular spacing)
        this.tufts = [];
        for (let x = 2; x < ARENA_W; x += 4 + ((x * 13) % 9)) {
            this.tufts.push({ x, h: 3 + ((x * 7) % 7), color: GRASS[(x * 3) % GRASS.length], phase: x * 0.17 });
        }
    }

    startRise() {
        if (this.riseStart === null) this.riseStart = this.time;
    }

    // Skip straight to every platform up and floating
    finishRise() {
        this.riseStart = this.time - 10;
    }

    // Seconds since island i burst out of the ground (negative while still buried / rumbling)
    sinceBreakout(i) {
        if (this.riseStart === null) return -99;
        return this.time - this.riseStart - i * RISE_STAGGER - RUMBLE_TIME;
    }

    // 0..1 while the ground above island i cracks and glows before it bursts out
    rumble(i) {
        const s = this.sinceBreakout(i);
        return s < 0 && s > -RUMBLE_TIME ? 1 + s / RUMBLE_TIME : 0;
    }

    // 0 = buried, 1 = fully risen. Islands go one after another, left to right.
    riseProgress(i) {
        return Math.max(0, Math.min(1, this.sinceBreakout(i) / RISE_TIME));
    }

    // Vertical offset of platform i from its resting height: deep underground, then a rise that
    // overshoots a little and settles back, then a slow float
    platformOffset(i) {
        if (i === undefined || i < 0) return 0;
        const p = this.platforms[i];
        const buried = GROUND_Y + 30 - p.y;
        const u = this.riseProgress(i);
        const k = u - 1;
        const e = 1 + 2.2 * k * k * k + 1.2 * k * k; // ease-out-back
        const bob = Math.sin(this.time * 1.1 + i * 1.7) * 1.5 * Math.min(1, u);
        return Math.round(buried * (1 - e) + bob);
    }

    // Sideways judder while an island tears free, dying out as it reaches the top
    platformShake(i) {
        const u = this.riseProgress(i);
        if (u <= 0 || u >= 0.9) return 0;
        return Math.round(Math.sin(this.time * 55 + i * 3) * (1 - u) * 1.6);
    }

    // Soft light-purple beam lifting island i: a wide faint glow, a narrower brighter band and a thin
    // white-lilac core, with streaks of light flowing upward. Fades in as the island breaks out and
    // fades away as it arrives.
    renderLiftBeam(ctx, p, i, u) {
        // the beam starts up inside the island's earth body (drawn before the island, so the island
        // covers its top) and pours out from under the stalactites without a visible edge
        const bottom = Math.round(p.y + this.platformOffset(i) + 22);
        const h = GROUND_Y - 2 - bottom;
        if (h < 3) return;
        const strength = Math.sin(Math.PI * Math.min(1, u * 1.15)); // 0 -> 1 -> 0 over the rise
        const cx = Math.round(p.x + p.w / 2);
        const w = Math.round(p.w * 0.5);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // layered glow, each band narrower and brighter
        for (const [scale, alpha, color] of [[1, 0.1, '200,170,255'], [0.62, 0.14, '214,190,255'], [0.28, 0.2, '240,228,255']]) {
            const bw = Math.max(2, Math.round(w * scale));
            ctx.fillStyle = `rgba(${color},${(alpha * strength).toFixed(3)})`;
            ctx.fillRect(cx - Math.round(bw / 2), bottom, bw, h);
        }
        // a 1px white core
        ctx.fillStyle = `rgba(255,250,255,${(0.35 * strength).toFixed(3)})`;
        ctx.fillRect(cx, bottom, 1, h);
        // streaks rising through the beam
        for (let k = 0; k < 7; k++) {
            const sx = cx - Math.round(w * 0.4) + ((k * 37 + i * 11) % Math.max(1, Math.round(w * 0.8)));
            const len = 6 + (k % 3) * 3;
            const sy = GROUND_Y - 2 - ((this.time * (110 + k * 15) + k * 29) % (h + len));
            const top = Math.max(bottom, Math.round(sy - len));
            const segH = Math.min(Math.round(sy), GROUND_Y - 2) - top;
            if (segH <= 0) continue;
            ctx.fillStyle = `rgba(245,235,255,${(0.45 * strength).toFixed(3)})`;
            ctx.fillRect(sx, top, 1, segH);
        }
        // where the beam meets the ground: a soft bright pool
        ctx.fillStyle = `rgba(230,210,255,${(0.25 * strength).toFixed(3)})`;
        ctx.fillRect(cx - Math.round(w * 0.6), GROUND_Y - 4, Math.round(w * 1.2), 2);
        ctx.fillRect(cx - Math.round(w * 0.4), GROUND_Y - 5, Math.round(w * 0.8), 1);
        ctx.restore();
    }

    // Ground under each island: a glowing crack while it rumbles, a crater after it leaves (fading),
    // and a column of blight light lifting it while it rises
    renderRiseEffects(ctx) {
        this.platforms.forEach((p, i) => {
            const x0 = Math.round(p.x + p.w * 0.1);
            const w = Math.round(p.w * 0.8);
            const r = this.rumble(i);
            const since = this.sinceBreakout(i);
            if (r > 0) {
                // crack spreading out from the middle, pink light flickering inside
                const half = Math.round((w / 2) * Math.min(1, r * 1.6));
                const cx = x0 + Math.round(w / 2);
                for (let x = cx - half; x < cx + half; x++) {
                    const d = 1 + ((x * 7) % 3);
                    ctx.fillStyle = '#0a0510';
                    ctx.fillRect(x, GROUND_Y - 3, 1, d + 1);
                    if ((x + Math.floor(this.time * 20)) % 3 === 0) {
                        ctx.fillStyle = r > 0.6 ? '#ffd6ff' : '#ff3df0';
                        ctx.fillRect(x, GROUND_Y - 2, 1, 1);
                    }
                }
            } else if (since >= 0 && since < RISE_TIME + 3) {
                // crater left behind, fading out
                const fade = Math.min(1, (RISE_TIME + 3 - since) / 2);
                ctx.globalAlpha = 0.85 * fade;
                ctx.fillStyle = '#0a0510';
                ctx.fillRect(x0 + 3, GROUND_Y - 4, w - 6, 3);
                ctx.fillRect(x0, GROUND_Y - 3, w, 2);
                ctx.fillStyle = '#5a4636';
                ctx.fillRect(x0 - 3, GROUND_Y - 5, 4, 2);
                ctx.fillRect(x0 + w - 1, GROUND_Y - 5, 4, 2);
                ctx.globalAlpha = 1;
            }
            const u = this.riseProgress(i);
            if (u > 0 && u < 1) this.renderLiftBeam(ctx, p, i, u);
        });
    }

    // Top surface of every standable surface: { x, w, y, oneWay }
    get surfaces() {
        // a platform still buried (or mostly) is not standable
        return this.platforms
            .map((p, i) => ({ x: p.x + 4, w: p.w - 8, y: p.y + this.platformOffset(i) + 4, oneWay: true }))
            .filter((s) => s.y < GROUND_Y - 8);
    }

    update(dt, targetCorruption) {
        this.time += dt;
        this.corruption += (targetCorruption - this.corruption) * Math.min(1, dt * 1.5);
        for (const c of this.clouds) {
            c.x -= c.speed * dt;
            if (c.x < -180) c.x = 820;
        }
        for (const b of this.birds) {
            b.x += 14 * dt; // the flock sprite faces right, so it flies right
            b.phase += dt * 8;
            if (b.x > 860) b.x = -40;
        }
        for (const f of this.fireflies) {
            f.phase += dt * f.speed;
            f.blink += dt * 2.2;
            f.x += Math.cos(f.phase * 1.3) * 10 * dt;
            f.y += Math.sin(f.phase * 1.7) * 7 * dt;
            if (f.x < 0) f.x += ARENA_W;
            if (f.x > ARENA_W) f.x -= ARENA_W;
        }
    }

    renderBackground(ctx, camX) {
        const a = this.a;
        const par = (f) => Math.round(-camX * f);

        if (a.sky) ctx.drawImage(a.sky, par(0.02), 0);
        else { ctx.fillStyle = '#e8c890'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }

        // Setting sun sinking behind the far hills
        if (a.sun) ctx.drawImage(a.sun, 470 + par(0.03), 92);

        for (const c of this.clouds) {
            const img = a[c.img];
            if (img) ctx.drawImage(img, Math.round(c.x + par(0.05)), c.y);
        }

        if (a.castle) ctx.drawImage(a.castle, 40 + par(0.06), 18);
        if (a.bg4) ctx.drawImage(a.bg4, par(0.1), 6);

        if (a.birds) {
            for (const b of this.birds) {
                const flap = Math.sin(b.phase) > 0 ? 0 : 1;
                ctx.drawImage(a.birds, Math.round(b.x + par(0.15)), Math.round(b.y + flap), 10, 10);
            }
        }

        if (a.bg3) ctx.drawImage(a.bg3, par(0.18), 20);
        if (a.bg2) ctx.drawImage(a.bg2, par(0.3), 30);
        if (a.bg1) ctx.drawImage(a.bg1, par(0.45), 40);

        // Dusk grade: multiply the scenery toward violet (phase 1) or blood red (phase 2)
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = lerpColor('#a28cc4', '#c06070', this.corruption);
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.restore();

        // Banded blight mist rolling over the tree line (stepped bands = pixel gradient)
        const mist = lerpColor('#3b1d5a', '#5a1030', this.corruption);
        for (let i = 0; i < 6; i++) {
            ctx.globalAlpha = 0.07 + i * 0.045;
            ctx.fillStyle = mist;
            ctx.fillRect(0, 228 + i * 14, VIEW_W, 14);
        }
        ctx.globalAlpha = 1;
    }

    renderWorld(ctx) {
        const a = this.a;
        this.renderTrees(ctx);

        // Ground props (behind the fighters)
        for (const [kind, name, x, off] of PROPS) {
            if (kind === 'decor') this.prop(ctx, name, x, GROUND_Y + off);
            else if (kind === 'garden') this.garden(ctx, name, x, GROUND_Y + off);
            else if (kind === 'log') this.sheetProp(ctx, a.forest, LOG, x, GROUND_Y + off);
            else if (kind === 'stump') this.sheetProp(ctx, a.pines, STUMP, x, GROUND_Y + off);
        }

        // A single weathered statue on the right
        if (a.statue) {
            ctx.save();
            ctx.translate(ARENA_W - 4, GROUND_Y - 62);
            ctx.scale(-1, 1);
            ctx.drawImage(a.statue, 0, 0);
            ctx.restore();
        }

        // Ground strip
        if (a.floor) {
            for (let x = 0; x < ARENA_W; x += 32) {
                ctx.drawImage(a.floor, TILE_TOP.sx, TILE_TOP.sy, 32, 32, x, GROUND_Y - 4, 32, 32);
                ctx.drawImage(a.floor, TILE_FILL.sx, TILE_FILL.sy, 32, 32, x, GROUND_Y + 28, 32, 32);
            }
            if (!this.islands) this.islands = this.platforms.map((p, i) => this.buildIsland(p, i));
            this.renderRiseEffects(ctx);
            // islands (with their vines) only show above the ground line while they rise out of it
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, -100, ARENA_W, GROUND_Y + 100 - 2);
            ctx.clip();
            this.renderVines(ctx);
            this.platforms.forEach((p, i) => {
                const isl = this.islands[i];
                ctx.drawImage(isl.canvas, p.x + this.platformShake(i), p.y + this.platformOffset(i) - isl.topPad);
            });
            ctx.restore();
        } else {
            ctx.fillStyle = '#2a1e18';
            ctx.fillRect(0, GROUND_Y, ARENA_W, VIEW_H - GROUND_Y);
        }

        // Animated campfire (5 x 8 grid of 32x32 frames)
        if (a.campfire) {
            const f = Math.floor(this.time * 12) % 40;
            ctx.drawImage(a.campfire, (f % 5) * 32, Math.floor(f / 5) * 32, 32, 32, this.campfire.x - 16, GROUND_Y - 31, 32, 32);
        }

        // Animated torches (Torch.png row 1 = standing torch, 6 frames of 32x32)
        if (a.torch) {
            const frameStep = Math.floor(this.time * 10);
            for (const t of this.torches) {
                const f = (frameStep + t.frame) % 6;
                if (t.plat !== undefined && this.platforms[t.plat].y + this.platformOffset(t.plat) > GROUND_Y - 30) continue; // still underground
                const baseY = (t.y !== undefined ? t.y + this.platformOffset(t.plat) + 4 : GROUND_Y);
                ctx.drawImage(a.torch, f * 32, 32, 32, 32, t.x - 16, baseY - 32, 32, 32);
            }
        }
    }

    // Floating earth island, unique per platform: grass ledge, earth body of its own depth with
    // lopsided, wobbly tapering sides, hanging stalactites, and its own dressing on top.
    // Built once into a canvas (with headroom above the ledge for the dressing).
    buildIsland(p, index) {
        const img = this.a.floor;
        const decor = this.a.decor;
        const { sx, sy, h } = PLATFORM;
        const st = STALACTITES;
        const topPad = 18;
        const bottom = topPad + h + p.depth;  // where the stalactite tips end
        const H = bottom + 2;
        const c = document.createElement('canvas');
        c.width = p.w;
        c.height = H;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        const out = { canvas: c, topPad };
        if (!img) return out;

        const inset = 5;
        // earth body between the ledge and the stalactite strip
        const stripY = bottom - st.h;
        for (let y = topPad + 12; y < stripY + 4; y += 32) {
            for (let x = inset; x < p.w - inset; x += 32) {
                const w = Math.min(32, p.w - inset - x);
                const hh = Math.min(32, stripY + 4 - y);
                g.drawImage(img, TILE_FILL.sx, TILE_FILL.sy, w, hh, x, y, w, hh);
            }
        }
        // stalactite strip, offset per island so the teeth don't line up
        const shift = (index * 23) % st.w;
        for (let x = inset - shift; x < p.w - inset; x += st.w) {
            const x0 = Math.max(inset, x);
            const w = Math.min(x + st.w, p.w - inset) - x0;
            if (w > 0) g.drawImage(img, st.sx + (x0 - x), st.sy, w, st.h, x0, stripY, w, st.h);
        }
        // carve lopsided, wobbly sides
        g.globalCompositeOperation = 'destination-out';
        const top = topPad + 20;
        for (let y = top; y < H; y++) {
            const d = y - top;
            const wobL = Math.round(Math.sin(y * 0.9 + index * 2.1) * 1.5);
            const wobR = Math.round(Math.sin(y * 0.7 + index * 3.7) * 1.5);
            const cutL = Math.max(0, inset + Math.floor(d * p.slopeL) + wobL);
            const cutR = Math.max(0, inset + Math.floor(d * p.slopeR) + wobR);
            g.fillRect(0, y, cutL, 1);
            g.fillRect(p.w - cutR, y, cutR, 1);
        }
        g.globalCompositeOperation = 'source-over';

        // grass ledge: left cap, repeated middle, right cap
        g.drawImage(img, sx, sy, 32, h, 0, topPad, 32, h);
        for (let x = 32; x < p.w - 32; x += 32) g.drawImage(img, sx + 32, sy, 32, h, x, topPad, 32, h);
        g.drawImage(img, sx + 64, sy, 32, h, p.w - 32, topPad, 32, h);

        // dressing on top (sits on the grass line ~3px below the ledge top)
        const ground = topPad + 3;
        const put = (name, x) => {
            const r = DECOR[name];
            if (decor && r) g.drawImage(decor, r[0], r[1], r[2], r[3], x, ground - r[3], r[2], r[3]);
        };
        if (p.deco === 'bush') { put('bushMed', p.w - 44); put('tuftC', 10); }
        if (p.deco === 'bushSmall') { put('bushSmall', 8); put('tuftA', p.w - 30); }
        if (p.deco === 'rock') { put('rockMed', 44); put('tuftB', 12); put('tuftC', p.w - 22); }
        if (p.deco === 'tufts') { put('tuftB', 6); put('tuftC', p.w - 18); }
        if (p.deco === 'mushrooms') {
            for (const [mx, tall] of [[p.w - 22, 3], [p.w - 17, 2], [p.w - 13, 4]]) {
                g.fillStyle = '#e8d8b0';
                g.fillRect(mx + 1, ground - tall, 1, tall);
                g.fillStyle = '#b8323a';
                g.fillRect(mx, ground - tall - 2, 3, 2);
                g.fillStyle = '#ffffff';
                g.fillRect(mx + 1, ground - tall - 2, 1, 1);
            }
            put('tuftA', 6);
        }

        return out;
    }

    // Trees drawn into a cached layer with a lighter version of the dusk grade, so they sit
    // between the graded background and the full-colour fighters
    renderTrees(ctx) {
        const key = Math.round(this.corruption * 20);
        if (!this.treeCanvas || this.treeKey !== key) {
            this.treeKey = key;
            // mask: all trees in one image (destination-in erases outside each drawn image, so cut once)
            if (!this.treeMask) {
                this.treeMask = document.createElement('canvas');
                this.treeMask.width = ARENA_W;
                this.treeMask.height = VIEW_H;
                const m = this.treeMask.getContext('2d');
                m.imageSmoothingEnabled = false;
                for (const t of TREES) this.drawTree(m, t);
            }
            this.treeCanvas = tinted(this.treeMask, lerpColor('#c8b8dc', '#d89090', this.corruption), this.treeCanvas);
        }
        ctx.drawImage(this.treeCanvas, 0, 0);
    }

    // Autumn vines dangling under the islands, swaying more toward the tips
    renderVines(ctx) {
        for (const v of this.vines) {
            for (let i = 0; i < v.len; i++) {
                const sway = Math.round(Math.sin(this.time * 1.6 + v.phase + i * 0.25) * (i / v.len) * 2.5);
                const x = v.x + sway;
                const y = v.y + this.platformOffset(v.plat) + i * 2;
                ctx.fillStyle = '#4a2f1c';
                ctx.fillRect(x, y, 1, 2);
                if (i % 3 === 1) {
                    ctx.fillStyle = LEAF[(i + Math.round(v.phase)) % LEAF.length];
                    ctx.fillRect(x + (i % 2 ? 1 : -2), y, 2, 2);
                }
            }
        }
    }

    // Additive light pools from the torches and campfire, drawn as stepped pixel discs
    renderLights(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const flicker = Math.floor(this.time * 12) % 2;
        for (const t of this.torches) {
            if (t.plat !== undefined && this.platforms[t.plat].y + this.platformOffset(t.plat) > GROUND_Y - 30) continue;
            const baseY = (t.y !== undefined ? t.y + this.platformOffset(t.plat) + 4 : GROUND_Y);
            pixelGlow(ctx, t.x, baseY - 26, 34 + flicker * 2, 'rgba(255,140,50,0.045)', 5);
        }
        if (this.a.campfire) pixelGlow(ctx, this.campfire.x, GROUND_Y - 24, 44 + flicker * 3, 'rgba(255,120,40,0.03)', 5);
        ctx.restore();
    }

    // In front of everything: dark undergrowth in the dirt, swaying grass, drifting fireflies
    renderForeground(ctx) {
        if (!this.undergrowth && this.a.decor) {
            // darkened copies of the bushes (built once)
            this.undergrowth = UNDERGROWTH.map(([name, x]) => {
                const r = DECOR[name];
                const m = document.createElement('canvas');
                m.width = r[2];
                m.height = r[3];
                m.getContext('2d').drawImage(this.a.decor, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
                return { img: tinted(m, '#5a4058'), x };
            });
        }
        for (const u of this.undergrowth || []) ctx.drawImage(u.img, u.x, VIEW_H - u.img.height + 4);

        for (const t of this.tufts) {
            if (Math.abs(t.x - this.campfire.x) < 20) continue; // keep the campfire's logs visible
            const sway = Math.round(Math.sin(this.time * 2 + t.phase));
            ctx.fillStyle = t.color;
            ctx.fillRect(t.x, GROUND_Y + 6 - t.h, 1, t.h);
            ctx.fillRect(t.x + 1 + sway, GROUND_Y + 6 - t.h - 1, 1, Math.max(2, t.h - 2));
            ctx.fillRect(t.x - 1 - sway, GROUND_Y + 6 - Math.floor(t.h / 2), 1, Math.floor(t.h / 2));
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const f of this.fireflies) {
            const glow = (Math.sin(f.blink) + 1) / 2;
            if (glow < 0.15) continue;
            const x = Math.round(f.x);
            const y = Math.round(f.y);
            ctx.fillStyle = `rgba(200,255,120,${(0.12 * glow).toFixed(3)})`;
            ctx.fillRect(x - 2, y - 1, 5, 3);
            ctx.fillRect(x - 1, y - 2, 3, 5);
            ctx.fillStyle = `rgba(240,255,170,${(0.9 * glow).toFixed(3)})`;
            ctx.fillRect(x, y, 1, 1);
        }
        ctx.restore();
    }

    prop(ctx, name, x, groundY) {
        const r = DECOR[name];
        if (!this.a.decor || !r) return;
        ctx.drawImage(this.a.decor, r[0], r[1], r[2], r[3], x, groundY - r[3], r[2], r[3]);
    }

    sheetProp(ctx, img, r, x, groundY) {
        if (!img) return;
        ctx.drawImage(img, r[0], r[1], r[2], r[3], x, groundY - r[3], r[2], r[3]);
    }

    drawTree(ctx, t) {
        const base = GROUND_Y + 2;
        if (PINE[t.kind]) {
            // two slices: the top-left corner of some cells holds a separate bare trunk sprite
            const [sx, sy, w, h] = PINE[t.kind];
            const y = base - h;
            if (!this.a.pines) return;
            ctx.drawImage(this.a.pines, sx + 30, sy, w - 30, 64, t.x + 30, y, w - 30, 64);
            ctx.drawImage(this.a.pines, sx, sy + 64, w, h - 64, t.x, y + 64, w, h - 64);
        } else if (this.a[t.kind]) {
            const img = this.a[t.kind];
            ctx.drawImage(img, t.x, base - img.height);
        }
    }

    garden(ctx, name, x, groundY) {
        const r = GARDEN[name];
        if (!this.a.garden || !r) return;
        ctx.drawImage(this.a.garden, r[0], r[1], r[2], r[3], x, groundY - r[3], r[2], r[3]);
    }
}

// Multiply an image by a colour, keeping its transparency. Reuses `into` if given.
function tinted(src, color, into) {
    const c = into || document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-over';
    return c;
}

// Concentric stepped discs (built from 2px rows), cheap fake light that stays pixelated
export function pixelGlow(ctx, cx, cy, radius, color, rings = 4) {
    ctx.fillStyle = color;
    for (let i = 1; i <= rings; i++) {
        const r = Math.round((radius * i) / rings);
        for (let dy = -r; dy < r; dy += 2) {
            const half = Math.round(Math.sqrt(r * r - (dy + 1) * (dy + 1)));
            ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2, 2);
        }
    }
}

export function lerpColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return `rgb(${r},${g},${bl})`;
}
