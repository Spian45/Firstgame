// Title artwork: a pixel painting of the Twilight Vale - sunset sky and moon, snowy peaks, the realm's
// castle on its cliff with a waterfall, a mirror lake, pine woods and a spirit tree.
// Static layers are painted once from a fixed seed; stars, clouds, water, windows, foxfire and petals
// animate on top.
import { VIEW_W, VIEW_H } from './arena.js';

const W = VIEW_W;
const H = VIEW_H;
const SKY = ['#120a24', '#24123e', '#3e1c58', '#642868', '#94386e', '#c8546a', '#ec8a5e', '#f8c070'];
const SUN = { x: 210, y: 208 };      // sunset glow sits behind the far peaks
const MOON = { x: 600, y: 46, r: 17 };
const CASTLE_BASE = 162;
const FALL_X = 490;      // waterfall centre: pours from an outlet under the castle wall
const FALL_TOP = CASTLE_BASE + 3;
const FALL_BOTTOM = 258; // hidden behind the valley trees from about here
const FALL_STREAK = Array.from({ length: 16 }, (_, i) => ({ sp: 0.8 + ((i * 7) % 5) * 0.1, off: (i * 5) % 12 }));

// Waterfall width at height y: a narrow spout that fans out as it drops, edges wavering over time
function fallSpan(y, t) {
    const u = (y - FALL_TOP) / (FALL_BOTTOM - FALL_TOP);
    const hw = 1.5 + u * u * 4;
    return {
        left: Math.round(FALL_X - hw + Math.sin(y * 0.45 + t * 7) * 0.6),
        right: Math.round(FALL_X + hw + Math.sin(y * 0.5 - t * 6) * 0.6)
    };
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

function rng(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeCanvas(w = W, h = H) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

// Entry of a palette ramp at f (0..1), ordered-dithered between neighbouring steps
function ramp(colors, f, x, y) {
    const p = Math.max(0, Math.min(1, f)) * (colors.length - 1);
    const i = Math.floor(p);
    return colors[Math.min(colors.length - 1, p - i > BAYER[(y & 3) * 4 + (x & 3)] ? i + 1 : i)];
}

function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function disk(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) {
        const hw = Math.floor(Math.sqrt(r * r - y * y));
        ctx.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
    }
}

// Midpoint-displacement skyline: one height per column
function ridge(r, base, amp, rough) {
    const n = 1024;
    const a = new Float32Array(n + 1);
    a[0] = r() * 2 - 1;
    a[n] = r() * 2 - 1;
    for (let step = n, d = 1; step > 1; step /= 2, d *= rough) {
        for (let i = step / 2; i < n; i += step) a[i] = (a[i - step / 2] + a[i + step / 2]) / 2 + (r() * 2 - 1) * d;
    }
    return Array.from({ length: W }, (_, x) => Math.round(base + a[Math.floor((x / W) * n)] * amp));
}

// Sky brightness: darker overhead, warm toward the horizon and the sunset glow
function skyF(x, y) {
    return y / 215 + 0.42 * Math.exp(-(((x - SUN.x) / 150) ** 2 + ((y - SUN.y) / 60) ** 2));
}

// Slope faces the sunset (lit) when it climbs away from the sun; judged over a few columns so
// small bumps don't stripe the light
function facesSun(h, x) {
    const a = h[Math.max(0, x - 3)];
    const b = h[Math.min(W - 1, x + 3)];
    return x > SUN.x ? b <= a : a <= b;
}

// Tiered pine with ragged bough tips, lit on its sunset side
function pine(ctx, r, x, yb, h, dark, lit) {
    const tiers = h < 10 ? 2 : h < 26 ? 3 : 4;
    const tierH = h / tiers;
    for (let k = 0; k < h; k++) {
        const tier = Math.floor(k / tierH);
        const within = (k - tier * tierH) / tierH;
        const maxW = h * 0.3 * (0.5 + (0.5 * (tier + 1)) / tiers);
        const hw = Math.round(maxW * (tier === 0 ? within : 0.45 + 0.55 * within)) + (r() < 0.25 ? 1 : 0);
        px(ctx, x - hw, yb - h + k, hw * 2 + 1, 1, dark);
        if (hw > 0 && k % 2 === 0) px(ctx, x - hw, yb - h + k, 1, 1, lit);
    }
    px(ctx, x, yb, 1, 2, dark);
}

export class TitleArt {
    constructor() {
        const r = rng(45);
        this.windows = [];
        this.sky = makeCanvas();
        this.back = makeCanvas();
        this.front = makeCanvas();
        this.clouds = makeCanvas(W * 2, 140);
        this.paintSky(this.sky.getContext('2d'));
        this.paintClouds(this.clouds.getContext('2d'), r);
        this.paintBack(this.back.getContext('2d'), r);
        this.paintFront(this.front.getContext('2d'), r);

        this.stars = Array.from({ length: 110 }, () => ({
            x: Math.floor(r() * W), y: Math.floor(r() * 150), ph: r() * 6.28, sp: 0.6 + r() * 2, big: r() < 0.08
        })).filter(s => Math.hypot(s.x - MOON.x, s.y - MOON.y) > MOON.r + 8);
        // sparkles on the water, kept inside the lake's oval (with a margin from the shore)
        this.glints = Array.from({ length: 34 }, () => {
            const y = 266 + Math.floor(r() * 26);
            const half = 170 * Math.sqrt(Math.max(0, 1 - ((y - 280) / 19) ** 2)) - 8;
            const len = 2 + Math.floor(r() * 4);
            return { x: Math.round(290 - half + r() * Math.max(0, 2 * half - len)), y, len, ph: r() * 6.28, sp: 1 + r() * 2 };
        });
        this.wisps = Array.from({ length: 16 }, () => ({
            x: r() * W, y: 190 + r() * 130, ph: r() * 6.28, sp: 0.4 + r() * 0.6
        }));
        this.petals = Array.from({ length: 22 }, () => ({
            x: 560 + r() * 80, y: 180 + r() * 40, off: r() * 300, sp: 10 + r() * 10, ph: r() * 6.28
        }));
    }

    paintSky(ctx) {
        const img = ctx.createImageData(W, H);
        const rgb = SKY.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const c = ramp(rgb, skyF(x, y), x, y);
                const i = (y * W + x) * 4;
                img.data[i] = c[0];
                img.data[i + 1] = c[1];
                img.data[i + 2] = c[2];
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);

        // Moon: dithered halo, pale disk shaded toward the lower left, a few craters
        const { x: mx, y: my, r: mr } = MOON;
        for (let y = my - mr - 12; y <= my + mr + 12; y++) {
            for (let x = mx - mr - 12; x <= mx + mr + 12; x++) {
                const d = Math.hypot(x - mx, y - my);
                if (d <= mr || d > mr + 12) continue;
                const g = 1 - (d - mr) / 12;
                if (g * g > BAYER[(y & 3) * 4 + (x & 3)]) px(ctx, x, y, 1, 1, g > 0.55 ? '#6a5288' : '#3a2a5e');
            }
        }
        disk(ctx, mx, my, mr, '#f8ead0');
        for (let y = -mr; y <= mr; y++) {
            for (let x = -mr; x <= mr; x++) {
                if (x * x + y * y > mr * mr) continue;
                const shade = ((y - x) / mr + 0.4) * 0.6;
                if (shade > BAYER[((y + 64) & 3) * 4 + ((x + 64) & 3)]) px(ctx, mx + x, my + y, 1, 1, '#e2cbb8');
            }
        }
        disk(ctx, mx - 5, my - 4, 3, '#e8d4bc');
        disk(ctx, mx + 6, my + 5, 2, '#dcc4b0');
        disk(ctx, mx + 2, my - 9, 1, '#e8d4bc');
    }

    paintClouds(ctx, r) {
        const tones = ['#4a2462', '#7a346e', '#b44e74', '#e6806c', '#f6b070'];
        for (let n = 0; n < 9; n++) {
            const cx = Math.floor(r() * W * 2);
            const cy = 20 + Math.floor(r() * 110);
            const len = 70 + Math.floor(r() * 130);
            const th = 3 + Math.floor(r() * 6);
            const warm = cy / 140; // low clouds catch more sunset
            for (let i = 0; i < len; i++) {
                const u = i / len;
                const t = Math.round(th * Math.sin(Math.PI * u) ** 0.6 + (r() < 0.3 ? 1 : 0));
                const x = (cx + i) % (W * 2);
                for (let k = -t; k <= Math.floor(t / 2); k++) {
                    const v = (k + t) / (t * 1.5 + 0.01); // 0 top .. 1 underside
                    px(ctx, x, cy + k, 1, 1, ramp(tones, v * 0.6 + warm * 0.45, x, cy + k));
                }
            }
        }
    }

    paintBack(ctx, r) {
        // Far snowy range: a few great peaks over a rolling base, roughened with fine noise
        const roll = ridge(r, 198, 22, 0.55);
        const detail = ridge(r, 0, 14, 0.72);
        const snowEdge = ridge(r, 0, 4, 0.6);
        const peaks = [[96, 134, 1.0], [190, 124, 0.85], [292, 140, 1.1], [372, 116, 0.8]];
        const far = roll.map((h, x) => Math.round(Math.min(h, ...peaks.map(([p, top, s]) => top + Math.abs(x - p) * s + Math.abs(detail[x]) * 0.8))));
        for (let x = 0; x < W; x++) {
            const h = far[x];
            px(ctx, x, h, 1, H - h, '#5a2e6e');
            if (facesSun(far, x)) px(ctx, x, h, 1, 2, '#b06488');
            if (h < 158 + snowEdge[x]) {
                const depth = 158 + snowEdge[x] - h;
                for (let y = h; y < h + depth; y++) {
                    px(ctx, x, y, 1, 1, facesSun(far, x) ? ramp(['#f0c8d8', '#c48aac'], (y - h) / depth, x, y) : ramp(['#a87aa8', '#7a4a88'], (y - h) / depth, x, y));
                }
            }
        }
        // Evening mist pooled in the far valleys
        for (let y = 196; y < 236; y++) {
            for (let x = 0; x < W; x++) {
                if (y >= far[x] && ((y - 196) / 40) * 0.8 > BAYER[(y & 3) * 4 + (x & 3)]) px(ctx, x, y, 1, 1, '#7a3e78');
            }
        }

        // Mid hills
        const mid = ridge(r, 220, 20, 0.5);
        for (let x = 0; x < W; x++) {
            for (let y = mid[x]; y < 262; y++) px(ctx, x, y, 1, 1, ramp(['#5a2e6a', '#40225a', '#30184a'], (y - mid[x]) / 34, x, y));
            if (facesSun(mid, x)) px(ctx, x, mid[x], 1, 1, '#8a4478');
        }
        // Clusters of small pines along the hill crests
        for (let c = 0; c < 9; c++) {
            const cx = Math.floor(r() * 410);
            for (let x = cx; x < cx + 20 + r() * 30; x += 3 + Math.floor(r() * 4)) pine(ctx, r, x, mid[x] + 2, 6 + Math.floor(r() * 7), '#36204e', '#5a3066');
        }

        // The castle cliff: a rock spur rising out of the vale on the right, with ragged rock edges
        let jag = 0;
        const cliff = (x) => {
            jag = Math.max(-3, Math.min(3, jag + (r() < 0.5 ? -1 : 1) * (r() < 0.6 ? 1 : 0)));
            if (x < 470) return Math.round(252 - (90 * (x - 425)) / 45 + jag);
            if (x <= 578) return CASTLE_BASE + (r() < 0.15 ? 1 : 0);
            return Math.round(CASTLE_BASE + ((x - 578) / 62) ** 1.6 * 74 + jag);
        };
        const tops = [];
        for (let x = 425; x < W; x++) {
            const top = cliff(x);
            tops[x] = top;
            for (let y = top; y < H; y++) {
                const strata = (y + Math.floor(x / 11) * 3 + (x % 7 === 0 ? 1 : 0)) % 10 === 0;
                px(ctx, x, y, 1, 1, strata ? '#24143c' : ramp(['#4a2a60', '#2e1a44', '#24143a'], (x - 425) / 160 + (y - top) / 140, x, y));
            }
            px(ctx, x, top, 1, x < 470 ? 2 : 1, x < 470 ? '#9a527e' : '#6a3a6a');
        }
        // Moss and shrubs clinging to the rock
        for (let i = 0; i < 26; i++) {
            const x = 430 + Math.floor(r() * 200);
            const y = tops[x] + 3 + Math.floor(r() * 50);
            px(ctx, x, y, 2 + Math.floor(r() * 4), 1, '#3a2a4a');
            px(ctx, x, y - 1, 2, 1, '#5a3a5a');
        }
        // Dark wet rock around the waterfall's path, and the stone outlet it pours from
        for (let y = FALL_TOP; y < FALL_BOTTOM; y++) {
            const { left, right } = fallSpan(y, 0);
            for (let x = left - 3; x <= right + 3; x++) {
                const edge = Math.min(Math.abs(x - left + 1), Math.abs(x - right - 1));
                if (edge < 3 && (3 - edge) / 3 > BAYER[(y & 3) * 4 + (x & 3)]) px(ctx, x, y, 1, 1, '#1e1030');
            }
        }
        this.paintCastle(ctx);
        px(ctx, FALL_X - 4, FALL_TOP - 4, 9, 4, '#3a2a48');
        px(ctx, FALL_X - 3, FALL_TOP - 3, 7, 3, '#0a0610');
        px(ctx, FALL_X - 4, FALL_TOP - 5, 9, 1, '#5a4a66');
    }

    paintCastle(ctx) {
        const b = CASTLE_BASE;
        const wall = '#20112e';
        const lit = '#3e2456';
        const roof = '#4a2458';
        const roofLit = '#8a3e6e';
        const block = (x, top, w) => {
            px(ctx, x, top, w, b - top, wall);
            px(ctx, x, top, 1, b - top, lit);
        };
        const crenels = (x, top, w) => {
            for (let i = x; i < x + w - 1; i += 3) px(ctx, i, top - 2, 2, 2, wall);
        };
        const tower = (x, w, h, roofH) => {
            const top = b - h;
            block(x, top, w);
            const cx = x + Math.floor(w / 2);
            if (roofH) {
                for (let k = 0; k <= roofH; k++) {
                    const hw = Math.round((k / roofH) * (w / 2 + 1));
                    px(ctx, cx - hw, top - roofH + k, hw * 2 + 1, 1, roof);
                    px(ctx, cx - hw, top - roofH + k, 1, 1, roofLit);
                }
                px(ctx, cx, top - roofH - 5, 1, 5, wall);
                px(ctx, cx + 1, top - roofH - 5, 3, 1, '#c0303a');
                px(ctx, cx + 1, top - roofH - 4, 2, 1, '#c0303a');
            } else {
                crenels(x, top, w);
            }
            for (let wy = top + 6; wy < b - 6; wy += 9) {
                px(ctx, cx, wy, 1, 2, '#ffd27a');
                this.windows.push({ x: cx, y: wy });
            }
        };
        block(478, b - 12, 90);
        crenels(478, b - 12, 90);
        px(ctx, 520, b - 7, 5, 7, '#0e0816'); // gate
        tower(480, 8, 30, 9);
        tower(494, 10, 44, 12);
        tower(506, 22, 56, 0);
        tower(515, 6, 82, 14);
        tower(530, 10, 48, 12);
        tower(552, 8, 32, 9);
    }

    paintFront(ctx, r) {
        // Valley floor with a fringe of small pines
        // Low mist bank in front of the hills
        for (let y = 236; y < 256; y++) {
            for (let x = 0; x < 470; x++) {
                const m = 1 - Math.abs(y - 247) / 10;
                if (m * 0.55 > BAYER[(y & 3) * 4 + (x & 3)] && Math.sin(x * 0.03 + y * 0.2) > -0.4) px(ctx, x, y, 1, 1, '#6a3a72');
            }
        }
        const vale = ridge(r, 254, 5, 0.5);
        for (let x = 0; x < W; x++) {
            for (let y = vale[x]; y < 300; y++) px(ctx, x, y, 1, 1, ramp(['#341c4c', '#2a1640', '#1e1032'], (y - vale[x]) / 40, x, y));
        }
        for (let x = 2; x < W; x += 3 + Math.floor(r() * 6)) {
            // leave a clearing where the waterfall lands so no tree stands in front of it
            if (r() < 0.7 && Math.abs(x - FALL_X) > 16) pine(ctx, r, x, vale[x] + 2, 7 + Math.floor(r() * 8), '#22123a', '#3c2254');
        }

        // Stream winding from the waterfall's pool down to the lake
        for (let i = 0; i <= 60; i++) {
            const u = i / 60;
            const x = Math.round(FALL_X - 6 - u * 46 + Math.sin(u * 7) * 3);
            const y = Math.round(FALL_BOTTOM + 1 + u * 11);
            px(ctx, x, y, 3, 1, u < 0.5 ? '#86a0d0' : '#e6806c');
            px(ctx, x, y, 1, 1, '#1a0e28');
        }

        // Mirror lake reflecting the sunset. The far shore follows the lake's curve: each row's newly
        // exposed edge gets a dark bank pixel with a thin bright line of reflected sky just under it.
        let prevL = Infinity;
        let prevR = -Infinity;
        for (let y = 262; y < 299; y++) {
            const e = 1 - ((y - 280) / 19) ** 2;
            if (e <= 0) continue;
            const wob = Math.round(Math.sin(y * 0.7) * 3);
            const left = Math.round(290 - 190 * Math.sqrt(e)) + wob;
            const right = Math.round(290 + 180 * Math.sqrt(e)) - wob;
            for (let x = left; x <= right; x++) {
                const mirrorY = 215 - (y - 262) * 3;
                const shore = x < prevL || x > prevR; // nothing of the lake above this pixel
                const under = x === prevL || x === prevR || (y === 263 && x > left && x < right);
                let c = ramp(SKY, skyF(x, mirrorY) - 0.1 - (y - 262) / 120, x, y);
                if (shore) c = '#1a0e28';
                else if (under && (x * 7 + y) % 3) c = '#f6c48a';
                px(ctx, x, y, 1, 1, c);
            }
            px(ctx, left, y, 1, 1, '#1a0e28');
            px(ctx, right, y, 1, 1, '#1a0e28');
            prevL = Math.min(prevL, left);
            prevR = Math.max(prevR, right);
        }

        // Near woods: tall pines framing the left (behind the menu) and a stand on the right
        const near = ridge(r, 304, 5, 0.5);
        for (let x = 0; x < W; x++) px(ctx, x, near[x], 1, H - near[x], '#180c26');
        for (let x = 0; x < 150; x += 9 + Math.floor(r() * 10)) pine(ctx, r, x, near[x] + 4, 36 + Math.floor(r() * 40), '#140a20', '#2c1840');
        for (let x = 478; x < 560; x += 9 + Math.floor(r() * 10)) pine(ctx, r, x, near[x] + 4, 18 + Math.floor(r() * 18), '#140a20', '#2c1840');

        // Foreground bank: tall grass and reeds catching the sunset on their tips, mossy rocks,
        // and glowing spirit flowers
        const ground = ridge(r, 326, 5, 0.5);
        for (let x = 0; x < W; x++) {
            px(ctx, x, ground[x], 1, H - ground[x], '#100818');
            const blade = 2 + Math.floor(r() * (x > 140 && x < 520 ? 7 : 14));
            if (r() < 0.6) {
                px(ctx, x, ground[x] - blade, 1, blade, '#1c0f28');
                px(ctx, x, ground[x] - blade, 1, 1, r() < 0.5 ? '#5a2e5a' : '#3a2048');
            }
        }
        for (let i = 0; i < 7; i++) {
            const x = 20 + Math.floor(r() * 600);
            const w = 8 + Math.floor(r() * 12);
            const top = ground[x] - 3 - Math.floor(r() * 4);
            for (let k = 0; k < w; k++) {
                const h = Math.round(Math.sin((k / w) * Math.PI) * (ground[x] - top + 4));
                px(ctx, x + k, ground[x] + 4 - h, 1, h, '#22142e');
                px(ctx, x + k, ground[x] + 4 - h, 1, 1, k < w / 2 ? '#4a3058' : '#2e1c3c');
            }
        }
        this.flowers = Array.from({ length: 14 }, () => {
            const x = 10 + Math.floor(r() * 620);
            const y = ground[x] - 2 - Math.floor(r() * 4);
            px(ctx, x, y + 1, 1, ground[x] - y, '#1c2a28');
            return { x, y, ph: r() * 6.28 };
        });
        for (let y = 340; y < H; y++) {
            for (let x = 0; x < W; x++) if ((y - 340) / 20 > BAYER[(y & 3) * 4 + (x & 3)]) px(ctx, x, y, 1, 1, '#08040e');
        }

        this.paintTree(ctx, r, ground);
    }

    // Spirit tree in blossom on the right bank
    paintTree(ctx, r, ground) {
        const base = ground[608];
        const crown = 236;
        for (let y = base; y > crown; y--) {
            const u = (base - y) / (base - crown);
            const w = Math.round(14 - u * 7);
            const x = Math.round(608 - Math.sin(u * 2.4) * 7 - w / 2); // gentle lean and curve
            px(ctx, x, y, w, 1, '#2a1424');
            px(ctx, x, y, 2, 1, '#4a2838');
            if ((y * 7) % 13 === 0) px(ctx, x + 3, y, w - 5, 1, '#1e0e1a');
        }
        px(ctx, 596, base - 3, 26, 3, '#2a1424');
        px(ctx, 594, base - 1, 30, 1, '#2a1424');
        for (const [x0, y0, x1, y1] of [[604, 244, 568, 214], [606, 240, 638, 212], [602, 238, 590, 200], [604, 246, 584, 236]]) {
            for (let i = 0; i <= 30; i++) px(ctx, Math.round(x0 + ((x1 - x0) * i) / 30), Math.round(y0 + ((y1 - y0) * i) / 30), 2, 2, '#2a1424');
        }
        // Canopy: one scalloped mass of blossom clumps, lit from the upper left, dark underneath
        const blobs = Array.from({ length: 40 }, () => {
            const a = r() * Math.PI * 2;
            const d = Math.sqrt(r());
            return { x: Math.round(600 + Math.cos(a) * d * 58), y: Math.round(204 + Math.sin(a) * d * 32), r: 8 + Math.floor(r() * 8) };
        });
        const blossom = ['#ffc0dc', '#f07aac', '#c84a88', '#8a2a62', '#5a1a48'];
        for (let y = 154; y < 256; y++) {
            for (let x = 510; x < W; x++) {
                // solid core so no sky shows through between the clumps
                let inside = ((x - 600) / 52) ** 2 + ((y - 206) / 28) ** 2 <= 1;
                let lit = 0;
                for (const b of blobs) {
                    const dx = x - b.x;
                    const dy = y - b.y;
                    if (dx * dx + dy * dy <= b.r * b.r) {
                        inside = true;
                        lit = Math.max(lit, 1 - Math.hypot(dx + b.r * 0.4, dy + b.r * 0.4) / (b.r * 1.3)); // each clump lit on its top left
                    }
                }
                if (!inside) continue;
                const f = 0.5 + (y - 204) / 55 + (x - 600) / 260 - lit * 0.25;
                px(ctx, x, y, 1, 1, ramp(blossom, f, x, y));
            }
        }
        for (let i = 0; i < 30; i++) {
            const b = blobs[Math.floor(r() * blobs.length)];
            px(ctx, b.x - 2 - Math.floor(r() * 3), b.y - 3 - Math.floor(r() * 3), 1, 1, '#fff0f6');
        }
    }

    render(ctx, t) {
        ctx.drawImage(this.sky, 0, 0);

        for (const s of this.stars) {
            const b = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
            if (b < 0.25) continue;
            px(ctx, s.x, s.y, 1, 1, b > 0.7 ? '#fff6e0' : '#b8a0d0');
            if (s.big && b > 0.6) {
                px(ctx, s.x - 1, s.y, 3, 1, '#b8a0d0');
                px(ctx, s.x, s.y - 1, 1, 3, '#b8a0d0');
                px(ctx, s.x, s.y, 1, 1, '#ffffff');
            }
        }
        // Shooting star every 9 seconds
        const sp = (t % 9) / 0.7;
        if (sp < 1) {
            const sx = Math.round(140 + sp * 120);
            const sy = Math.round(20 + sp * 40);
            for (let i = 0; i < 10; i++) px(ctx, sx - i * 2, sy - i, 2, 1, i < 3 ? '#ffffff' : '#9ee7ff');
        }

        const off = Math.floor(t * 4) % (W * 2);
        ctx.drawImage(this.clouds, -off, 40);
        ctx.drawImage(this.clouds, W * 2 - off, 40);

        ctx.drawImage(this.back, 0, 0);

        // Castle windows flicker like candlelight
        for (const [i, w] of this.windows.entries()) {
            if (Math.sin(t * 3 + i * 1.7) > 0.6) px(ctx, w.x, w.y, 1, 2, '#f0a040');
        }
        // Waterfall pouring from the castle's outlet down the rock face: it widens as it falls, its edges
        // waver, and streaks of foam slide down at different speeds per column
        const drop = Math.floor(t * 80);
        for (let y = FALL_TOP; y < FALL_BOTTOM; y++) {
            const { left, right } = fallSpan(y, t);
            for (let x = left; x <= right; x++) {
                const k = (((y - drop * FALL_STREAK[x & 15].sp + FALL_STREAK[x & 15].off) % 12) + 12) % 12;
                let c = k < 2 ? '#ffffff' : k < 6 ? '#c8e4f6' : '#86a0d0';
                if (x === left || x === right) c = '#5a6aa8';
                px(ctx, x, y, 1, 1, c);
            }
        }
        // Lip of white water spilling over the outlet
        px(ctx, FALL_X - 2, FALL_TOP, 5, 1, '#ffffff');
        if (Math.floor(t * 8) % 2) px(ctx, FALL_X - 1, FALL_TOP + 1, 3, 1, '#e8f4ff');

        ctx.drawImage(this.front, 0, 0);

        // Spray churning where the fall plunges behind the trees, and mist drifting up from it
        for (let i = 0; i < 14; i++) {
            const a = t * 3 + i * 1.9;
            const x = Math.round(FALL_X + Math.sin(a * 1.3 + i) * (3 + (i % 5)));
            const y = Math.round(FALL_BOTTOM - 8 - Math.abs(Math.sin(a)) * 4);
            px(ctx, x, y, 1, 1, i % 3 ? '#e8f4ff' : '#ffffff');
        }
        for (let i = 0; i < 12; i++) {
            const life = (t * 0.35 + i / 12) % 1;
            const x = Math.round(FALL_X + Math.sin(i * 2.7 + t * 0.8) * (4 + life * 10));
            const y = Math.round(FALL_BOTTOM - 10 - life * 22);
            if (life < 0.75 || i % 2) px(ctx, x, y, life < 0.4 ? 2 : 1, 1, life < 0.5 ? '#c8b8dc' : '#8a6aa0');
        }

        for (const g of this.glints) {
            if (Math.sin(t * g.sp + g.ph) > 0.75) px(ctx, g.x, g.y, g.len, 1, '#ffe8b0');
        }

        // Spirit flowers pulse softly in the grass
        for (const f of this.flowers) {
            const on = Math.sin(t * 1.8 + f.ph) > 0;
            px(ctx, f.x, f.y, 1, 1, on ? '#e0fbff' : '#9ee7ff');
            if (on) {
                px(ctx, f.x - 1, f.y, 1, 1, '#38bdf8');
                px(ctx, f.x + 1, f.y, 1, 1, '#38bdf8');
            }
        }

        // Foxfire wisps drifting over the vale
        for (const w of this.wisps) {
            const x = Math.round((w.x + t * 6 * w.sp + Math.sin(t * w.sp + w.ph) * 18) % (W + 20)) - 10;
            const y = Math.round(w.y + Math.sin(t * 0.9 * w.sp + w.ph * 2) * 9);
            const on = Math.sin(t * 2.5 + w.ph) > -0.3;
            px(ctx, x, y, 1, 1, on ? '#e0fbff' : '#9ee7ff');
            if (on) {
                px(ctx, x - 1, y, 3, 1, '#38bdf8');
                px(ctx, x, y - 1, 1, 3, '#38bdf8');
                px(ctx, x, y, 1, 1, '#e0fbff');
            }
        }
        // Blossom petals blowing off the spirit tree
        for (const p of this.petals) {
            const d = (t * p.sp + p.off) % 260;
            const x = Math.round(p.x - d);
            const y = Math.round(p.y + d * 0.45 + Math.sin(t * 2 + p.ph) * 3);
            if (y < H) px(ctx, x, y, d % 40 < 20 ? 2 : 1, 1, '#ff9ac8');
        }

        // Darken the left side so the menu reads
        const g = ctx.createLinearGradient(0, 0, 330, 0);
        g.addColorStop(0, 'rgba(10,6,18,0.6)');
        g.addColorStop(1, 'rgba(10,6,18,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 330, H);
    }
}
