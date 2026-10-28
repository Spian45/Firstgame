// Pixel HUD drawn directly on the low-res canvas: player frame, boss bar, combo, banners and menus.
import { drawText, textWidth } from './font.js';
import { VIEW_W, VIEW_H } from './arena.js';
import { CHARACTER } from './character.js';
import { DIFFICULTIES } from './difficulty.js';
import { keyName } from './input.js';

export const CREDITS = 'Created by Spian45 and Charlotte_B';

// Gameplay controls for the pause menu and the title screen, showing the player's current key bindings
export function controlRows(input) {
    const k = (action) => keyName(input.binds[action]);
    return [
        ['MOVE', `${k('left')} ${k('right')} / ARROWS`],
        ['WALK (HOLD)', k('walk')],
        ['JUMP (x2)', `${k('jump')} / SPACE`],
        ['DROP DOWN', `${k('down')} + JUMP`],
        ['SLAM (IN AIR)', k('down')],
        ['DASH', `${k('dash')} / DOUBLE TAP`],
        ['ATTACK', `${k('attack')} / L-CLICK`],
        ['FOXFIRE', `${k('skill')} / R-CLICK`],
        ['DEBUG MODE', 'F3 / `']
    ];
}

// The same controls on a touch screen's on-screen buttons
export const TOUCH_ROWS = [
    ['MOVE', 'LEFT / RIGHT PAD'],
    ['JUMP (x2)', 'JUMP'],
    ['DROP DOWN', 'DOWN + JUMP'],
    ['SLAM (IN AIR)', 'DOWN'],
    ['DASH', 'DASH / DOUBLE TAP PAD'],
    ['ATTACK', 'HIT'],
    ['FOXFIRE', 'FIRE'],
    ['PAUSE', 'II']
];

const C = {
    ink: '#140c1c',
    frame: '#4a2f3c',
    frameLight: '#c9a26b',
    panel: '#2a1a2e',
    hp: '#d0283e',
    hpLight: '#ff6b6b',
    hpDark: '#7c1631',
    mp: '#2f8fd8',
    mpLight: '#9ee7ff',
    mpDark: '#18406e',
    boss: '#a52ad0',
    bossLight: '#ff3df0',
    bossDark: '#4a1466',
    trail: '#f2ebe0',
    gold: '#f0b84a',
    text: '#f2ebe0',
    dim: '#a89ab0'
};

// Bevelled pixel panel
function panel(ctx, x, y, w, h) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 1, y, w + 2, h);
    ctx.fillRect(x, y - 1, w, h + 2);
    ctx.fillStyle = C.frame;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.panel;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = C.frameLight;
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, h - 2);
    // gold corner studs
    ctx.fillStyle = C.gold;
    for (const [cx, cy] of [[x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2]]) ctx.fillRect(cx, cy, 2, 2);
}

function bar(ctx, x, y, w, h, ratio, trailRatio, col, light, dark, segments = 0) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#1e1224';
    ctx.fillRect(x, y, w, h);
    if (trailRatio > ratio) {
        ctx.fillStyle = C.trail;
        ctx.fillRect(x, y, Math.round(w * trailRatio), h);
    }
    const fw = Math.round(w * Math.max(0, ratio));
    ctx.fillStyle = dark;
    ctx.fillRect(x, y, fw, h);
    ctx.fillStyle = col;
    ctx.fillRect(x, y, fw, h - 1);
    ctx.fillStyle = light;
    ctx.fillRect(x, y, fw, 1);
    if (segments) {
        ctx.fillStyle = 'rgba(20,12,28,0.55)';
        for (let i = 1; i < segments; i++) ctx.fillRect(x + Math.round((w * i) / segments), y, 1, h);
    }
}

// Tiny pixel icons: each character picks a colour from the palette passed to sprite(); '.' is empty
const HEART = [
    '.oo.oo.',
    'oXhoXXo',
    'oXXXXXo',
    'oXXXXXo',
    '.oXXXo.',
    '..oXo..',
    '...o...'
];
const FLAME_A = [
    '.o...',
    'oho..',
    'ohXo.',
    'oXhXo',
    'oXcXo',
    'oXcXo',
    '.ooo.'
];
const FLAME_B = [
    '...o.',
    '..oho',
    '.oXho',
    'oXhXo',
    'oXcXo',
    'oXcXo',
    '.ooo.'
];
const PIP = [
    '..o..',
    '.oho.',
    'oXhXo',
    'oXXXo',
    '.ooo.'
];

export { FLAME_A, FLAME_B };

export function sprite(ctx, rows, x, y, colors) {
    rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
            const c = colors[row[i]];
            if (!c) continue;
            ctx.fillStyle = c;
            ctx.fillRect(x + i, y + j, 1, 1);
        }
    });
}

// Bar with an ink frame, three-tone fill (light top row, main, dark bottom row), a white damage trail,
// segment ticks, and a highlight glint that sweeps across every few seconds
function fancyBar(ctx, x, y, w, h, ratio, trail, [light, main, dark], segments, t) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#1e1224';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#2a1a36';
    ctx.fillRect(x, y, w, 1);
    if (trail > ratio) {
        ctx.fillStyle = C.trail;
        ctx.fillRect(x, y, Math.round(w * trail), h);
    }
    const fw = Math.round(w * Math.max(0, Math.min(1, ratio)));
    if (fw > 0) {
        ctx.fillStyle = main;
        ctx.fillRect(x, y, fw, h);
        ctx.fillStyle = light;
        ctx.fillRect(x, y, fw, 1);
        ctx.fillStyle = dark;
        ctx.fillRect(x, y + h - 1, fw, 1);
        // glint
        const gx = Math.round(((t * 0.35) % 1.6) * w);
        if (gx < fw - 2) {
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillRect(x + gx, y + 1, 2, h - 2);
            ctx.fillRect(x + gx + 2, y + 1, 1, Math.max(1, h - 3));
        }
        ctx.fillStyle = light;
        ctx.fillRect(x + fw - 1, y, 1, h - 1); // bright leading edge
    }
    ctx.fillStyle = 'rgba(20,12,28,0.6)';
    for (let i = 1; i < segments; i++) ctx.fillRect(x + Math.round((w * i) / segments), y + 1, 1, h - 1);
}

// Dark plate with a gold double border and corner flourishes
export function ornatePanel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(14,8,20,0.8)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.gold;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x + 3, y + 3, w - 6, 1);
    ctx.fillRect(x + 3, y + h - 4, w - 6, 1);
    ctx.fillRect(x + 3, y + 3, 1, h - 6);
    ctx.fillRect(x + w - 4, y + 3, 1, h - 6);
    // corners: an L of gold with a bright stud
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
        ctx.fillStyle = C.gold;
        for (let i = 0; i < 7; i++) {
            ctx.fillRect(cx + sx * i, cy + sy, 1, 1);
            ctx.fillRect(cx + sx, cy + sy * i, 1, 1);
        }
        ctx.fillStyle = '#fff2b0';
        ctx.fillRect(cx + sx * 2, cy + sy * 2, 1, 1);
    }
    // top centre crest: a small fox-ear pair
    const mx = Math.round(x + w / 2);
    ctx.fillStyle = '#140c1c';
    ctx.fillRect(mx - 8, y - 4, 17, 5);
    ctx.fillStyle = C.gold;
    for (let k = 0; k < 4; k++) {
        ctx.fillRect(mx - 7 + k, y - 3 + (3 - k), 1, k + 1);
        ctx.fillRect(mx + 7 - k, y - 3 + (3 - k), 1, k + 1);
    }
    ctx.fillStyle = '#ff3df0';
    ctx.fillRect(mx, y - 2, 1, 2);
}

// Pause menu options ([label, action]) and their layout, shared with main.js for input
export const PAUSE_ITEMS = [['RESUME', 'resume'], ['SETTINGS', 'settings'], ['RESTART', 'restart'], ['QUIT TO TITLE', 'quit']];
export const PAUSE_MENU = { x: 24, w: 232, y0: 116, step: 24 };

// One is picked at random each time the game is paused
const PAUSE_TIPS = [
    ['DASH THROUGH AN ATTACK AS IT LANDS', 'FOR A PERFECT DODGE AND A COUNTER BONUS'],
    ['SLAM ONTO THE MASK FROM ABOVE', 'TO BOUNCE OFF AND STRIKE AGAIN'],
    ['THE BOSS IS DAZED AFTER ITS SLAM', 'YOUR HITS DEAL 1.5X DAMAGE THEN'],
    ['STAY UNHIT FOR A FEW SECONDS', 'AND YOUR HEALTH SLOWLY COMES BACK'],
    ['FOXFIRE HOMES IN ON THE MASK', 'EACH CAST COSTS 25 MANA']
];
export const PAUSE_TIP_COUNT = PAUSE_TIPS.length;

export class HUD {
    constructor(portrait) {
        this.portrait = portrait;
        this.hpTrail = 1;
        this.mpShown = 0;
        this.comboPop = 0;
        this.lastCombo = 0;
        this.bannerData = null;
        this.time = 0;
    }

    banner(title, subtitle, duration = 3) {
        this.bannerData = { title, subtitle, t: 0, duration };
    }

    update(dt, game) {
        this.time += dt;
        const p = game.player;
        const hp = p.health / p.maxHealth;
        if (this.hpTrail > hp) this.hpTrail = Math.max(hp, this.hpTrail - dt * 0.4);
        else this.hpTrail = hp;
        if (game.combo !== this.lastCombo && game.combo > 1) this.comboPop = 0.15;
        this.lastCombo = game.combo;
        this.comboPop = Math.max(0, this.comboPop - dt);
        if (this.bannerData) {
            this.bannerData.t += dt;
            if (this.bannerData.t > this.bannerData.duration) this.bannerData = null;
        }
    }

    render(ctx, game) {
        const p = game.player;

        this.renderVitals(ctx, game);

        // Combo counter
        if (game.combo > 1) {
            const s = this.comboPop > 0 ? 3 : 2;
            drawText(ctx, `${game.combo}`, VIEW_W - 44, 14 - (s - 2) * 3, { scale: s, color: C.gold, align: 'right', outline: true });
            drawText(ctx, 'HITS', VIEW_W - 12, 22, { color: C.text, align: 'right', outline: true });
        }

        // Boss bar
        const b = game.boss;
        if (b && b.state !== 'intro' && !b.dead) {
            const w = 300;
            const x = Math.round((VIEW_W - w) / 2);
            const y = VIEW_H - 22;
            drawText(ctx, b.name, x, y - 11, { color: C.text, outline: true });
            drawText(ctx, b.phase === 1 ? 'PHASE I' : 'PHASE II', x + w, y - 11, { color: b.phase === 1 ? C.dim : C.bossLight, align: 'right', outline: true });
            bar(ctx, x, y, w, 7, b.health / b.maxHealth, b.displayHealth / b.maxHealth, C.boss, C.bossLight, C.bossDark);
            // phase threshold notch
            ctx.fillStyle = C.gold;
            ctx.fillRect(x + w / 2, y - 2, 1, 11);
            // end caps
            ctx.fillStyle = C.gold;
            ctx.fillRect(x - 4, y + 1, 2, 5);
            ctx.fillRect(x + w + 2, y + 1, 2, 5);
        }

        if (this.bannerData) this.renderBanner(ctx);

        // Keyboard controls hint for the first seconds (touch players see the buttons instead)
        if (game.elapsed < 9 && game.state === 'fight' && !game.touch.enabled) {
            ctx.globalAlpha = Math.min(1, (9 - game.elapsed) / 1.5);
            const k = (a) => keyName(game.input.binds[a]);
            const hint = `${k('left')}/${k('right')} MOVE  ${k('walk')} WALK  ${k('jump')}/SPACE JUMP x2  ${k('down')}(AIR) SLAM  ${k('dash')} DASH  ${k('attack')} ATTACK  ${k('skill')} FOXFIRE  ESC PAUSE`;
            drawText(ctx, hint, VIEW_W / 2, 48, { color: C.dim, align: 'center', outline: true });
            ctx.globalAlpha = 1;
        }
        if (!game.audioStarted) {
            const on = Math.floor(this.time * 2) % 2 === 0;
            if (on) drawText(ctx, game.touch.enabled ? 'TAP FOR SOUND' : 'PRESS ANY KEY FOR SOUND', VIEW_W - 8, VIEW_H - 46, { color: C.dim, align: 'right', outline: true });
        }
    }

    // Ren's vitals: a dark gold-trimmed plate holding her name, a beating heart beside a three-tone health
    // bar, and a foxfire flame beside a shimmering mana bar with flame-shaped charge pips
    renderVitals(ctx, game) {
        const p = game.player;
        const t = this.time;
        const x = 6;
        const y = 5;
        const w = 168;
        const h = 38;
        const hp = p.health / p.maxHealth;
        const low = hp < 0.3 && !p.dead;

        // plate with clipped corners and gold trim, ornament studs on the trim
        ctx.fillStyle = 'rgba(20,12,28,0.78)';
        ctx.fillRect(x + 2, y, w - 4, h);
        ctx.fillRect(x, y + 2, w, h - 4);
        ctx.fillStyle = C.gold;
        ctx.fillRect(x + 2, y, w - 4, 1);
        ctx.fillRect(x + 2, y + h - 1, w - 4, 1);
        ctx.fillStyle = C.gold;
        for (const sx of [x + 1, x + w - 2]) {
            ctx.fillRect(sx, y + 1, 1, 1);
            ctx.fillRect(sx, y + h - 2, 1, 1);
        }
        // small gold diamond set into the bottom trim
        const cx = x + w / 2;
        ctx.fillStyle = C.gold;
        ctx.fillRect(cx - 2, y + h - 1, 4, 1);
        ctx.fillRect(cx - 1, y + h - 2, 2, 3);
        ctx.fillStyle = '#fff2b0';
        ctx.fillRect(cx - 1, y + h - 1, 1, 1);

        // name, then the difficulty as a little coloured tag, health numbers on the right
        drawText(ctx, CHARACTER.name, x + 6, y + 4, { color: C.gold, outline: true });
        const diff = DIFFICULTIES[game.difficulty];
        const tagW = textWidth(diff.label) + 5;
        ctx.fillStyle = diff.color;
        ctx.fillRect(x + 28, y + 3, tagW, 9);
        drawText(ctx, diff.label, x + 31, y + 4, { color: C.ink, shadow: null });
        drawText(ctx, `${Math.ceil(p.health)}/${p.maxHealth}`, x + w - 6, y + 4, { color: low && Math.floor(t * 6) % 2 ? C.hpLight : C.dim, align: 'right' });

        // heart: beats faster as health drops, flashes when low
        const beatRate = low ? 7 : 2 + (1 - hp) * 3;
        const beat = Math.sin(t * beatRate * Math.PI) > 0.7 ? 1 : 0;
        sprite(ctx, HEART, x + 5, y + 15 - beat, { X: low && beat ? C.hpLight : C.hp, h: '#ffd0d0', o: C.ink });

        // health bar
        const bx = x + 16;
        const bw = w - 22;
        fancyBar(ctx, bx, y + 15, bw, 7, hp, this.hpTrail, ['#ff8a8a', '#d0283e', '#7c1631'], 10, t);
        if (low && Math.floor(t * 6) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,107,107,0.35)';
            ctx.fillRect(bx, y + 15, Math.round(bw * hp), 7);
        }
        // regen: a green sparkle riding the bar's end, plus a rising "+"
        if (p.regenerating) {
            const ex = bx + Math.round(bw * hp);
            ctx.fillStyle = Math.floor(t * 8) % 2 ? '#bbf7d0' : '#7ee08a';
            ctx.fillRect(ex - 1, y + 15, 2, 7);
            const rise = (t * 1.5) % 1;
            if (rise < 0.8) drawText(ctx, '+', ex + 2, y + 13 - Math.round(rise * 6), { color: '#7ee08a', outline: true });
        }

        // foxfire flame icon flickers; mana bar shimmers
        const flick = Math.floor(t * 8) % 2;
        sprite(ctx, flick ? FLAME_A : FLAME_B, x + 6, y + 25, { X: C.mp, h: C.mpLight, c: '#ffffff', o: C.ink });
        const mw = bw - 30;
        fancyBar(ctx, bx, y + 27, mw, 5, p.mana / p.maxMana, 0, [C.mpLight, C.mp, C.mpDark], 4, t * 1.3);

        // foxfire charges (25 mana each) as little flames; ready ones flicker
        const charges = Math.floor(p.mana / 25);
        for (let i = 0; i < 4; i++) {
            const px = bx + mw + 6 + i * 7;
            const ready = i < charges;
            const lit = ready && (Math.floor(t * 6 + i) % 3 !== 0);
            sprite(ctx, PIP, px, y + 26, ready
                ? { X: lit ? C.mpLight : C.mp, h: '#ffffff', o: C.ink }
                : { X: '#2a2238', h: '#3a3050', o: C.ink });
        }
    }

    renderBanner(ctx) {
        const { title, subtitle, t, duration } = this.bannerData;
        const inT = Math.min(1, t / 0.35);
        const outT = Math.min(1, Math.max(0, (duration - t) / 0.35));
        const k = Math.min(inT, outT);
        const y = 120;
        const bandW = Math.round(VIEW_W * k);
        ctx.fillStyle = 'rgba(20,12,28,0.78)';
        ctx.fillRect(Math.round((VIEW_W - bandW) / 2), y - 8, bandW, 44);
        ctx.fillStyle = C.gold;
        ctx.fillRect(Math.round((VIEW_W - bandW) / 2), y - 9, bandW, 1);
        ctx.fillRect(Math.round((VIEW_W - bandW) / 2), y + 36, bandW, 1);
        if (k < 1) return;
        const shown = Math.min(title.length, Math.floor((t - 0.35) * 30));
        drawText(ctx, title.slice(0, shown), VIEW_W / 2, y, { scale: 3, color: C.text, align: 'center', outline: true });
        if (shown >= title.length) {
            drawText(ctx, subtitle, VIEW_W / 2, y + 26, { color: C.bossLight, align: 'center', outline: true });
        }
    }

    // Pause: a left plate with the options (foxfire cursor) and this fight's stats so far, a right plate
    // with the controls and a rotating tip
    renderPause(ctx, game, sel, tip, touch) {
        const t = this.time;
        ctx.fillStyle = 'rgba(10,6,18,0.74)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);

        const { x, w, y0, step } = PAUSE_MENU;
        const y = 50;
        ornatePanel(ctx, x, y, w, 258);
        drawText(ctx, 'PAUSED', x + w / 2, y + 14, { scale: 3, color: C.gold, align: 'center', outline: true });
        drawText(ctx, 'THE BLIGHT WAITS...', x + w / 2, y + 42, { color: '#c8a0d8', align: 'center' });

        PAUSE_ITEMS.forEach(([label], i) => {
            const iy = y0 + i * step;
            const on = i === sel;
            if (on) {
                ctx.fillStyle = 'rgba(240,184,74,0.14)';
                ctx.fillRect(x + 8, iy - 6, w - 16, 19);
                ctx.fillStyle = C.gold;
                ctx.fillRect(x + 8, iy - 6, 1, 19);
                ctx.save();
                ctx.translate(x + 16, iy - 5 + (Math.floor(t * 4) % 2));
                ctx.scale(2, 2);
                sprite(ctx, Math.floor(t * 8) % 2 ? FLAME_A : FLAME_B, 0, 0, { X: '#38bdf8', h: '#9ee7ff', c: '#ffffff', o: '#0c2a40' });
                ctx.restore();
            }
            drawText(ctx, label, x + (on ? 34 : 30), iy, { scale: 1, color: on ? C.gold : '#d8cfc4', outline: true });
        });

        // this fight so far
        const sy = y0 + PAUSE_ITEMS.length * step + 6;
        ctx.fillStyle = '#4a2f3c';
        ctx.fillRect(x + 12, sy - 6, w - 24, 1);
        const b = game.boss;
        const mins = Math.floor(game.elapsed / 60);
        const secs = Math.floor(game.elapsed % 60).toString().padStart(2, '0');
        const diff = DIFFICULTIES[game.difficulty];
        const stats = [
            ['DIFFICULTY', diff.label, diff.color],
            ['TIME', `${mins}:${secs}`, C.text],
            ['BEST COMBO', `${game.bestCombo}`, C.text],
            ['HITS TAKEN', `${game.hitsTaken}`, C.text],
            ['BOSS HP', `${Math.round((b.health / b.maxHealth) * 100)}%`, C.bossLight]
        ];
        stats.forEach(([a, v, color], i) => {
            drawText(ctx, a, x + 16, sy + i * 11, { color: C.dim });
            drawText(ctx, v, x + w - 16, sy + i * 11, { color, align: 'right' });
        });

        // controls and a tip
        const rx = x + w + 14;
        const rw = VIEW_W - rx - 24;
        ornatePanel(ctx, rx, y, rw, 258);
        drawText(ctx, 'CONTROLS', rx + rw / 2, y + 14, { scale: 2, color: C.gold, align: 'center', outline: true });
        const rows = touch ? TOUCH_ROWS : controlRows(game.input);
        rows.forEach(([a, v], i) => {
            const ry = y + 42 + i * 14;
            if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rx + 10, ry - 3, rw - 20, 13); }
            drawText(ctx, a, rx + 16, ry, { color: C.text });
            drawText(ctx, v, rx + rw - 16, ry, { color: '#9ee7ff', align: 'right' });
        });
        const ty = y + 200;
        ctx.fillStyle = '#4a2f3c';
        ctx.fillRect(rx + 12, ty - 6, rw - 24, 1);
        drawText(ctx, 'TIP', rx + 16, ty, { color: C.gold });
        PAUSE_TIPS[tip % PAUSE_TIPS.length].forEach((line, i) => drawText(ctx, line, rx + 16, ty + 12 + i * 11, { color: '#c8a0d8' }));

        const hint = touch ? 'TAP AN OPTION' : 'W/S OR MOUSE PICK   ENTER OR CLICK CONFIRM   ESC RESUME';
        drawText(ctx, hint, VIEW_W / 2, VIEW_H - 30, { color: C.dim, align: 'center', outline: true });
    }

    renderEnd(ctx, game, victory) {
        ctx.fillStyle = victory ? 'rgba(40,24,16,0.6)' : 'rgba(30,6,14,0.7)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        const title = victory ? 'BLIGHT PURIFIED' : 'SPIRIT CONSUMED';
        drawText(ctx, title, VIEW_W / 2, 100, { scale: 4, color: victory ? C.gold : C.hp, align: 'center', outline: true });
        const sub = victory ? 'LORD KAGETORA HAS BEEN CLEANSED' : 'THE BLIGHT HAS OVERWHELMED YOU';
        drawText(ctx, sub, VIEW_W / 2, 140, { color: C.text, align: 'center', outline: true });

        const mins = Math.floor(game.elapsed / 60);
        const secs = Math.floor(game.elapsed % 60).toString().padStart(2, '0');
        const stats = [
            ['DIFFICULTY', DIFFICULTIES[game.difficulty].label],
            ['TIME', `${mins}:${secs}`],
            ['BEST COMBO', `${game.bestCombo}`],
            ['HITS TAKEN', `${game.hitsTaken}`]
        ];
        if (!victory) stats.push(['BOSS HP LEFT', `${Math.round((game.boss.health / game.boss.maxHealth) * 100)}%`]);
        const w = 200;
        const x = (VIEW_W - w) / 2;
        panel(ctx, x, 162, w, 18 + stats.length * 13);
        stats.forEach(([a, b], i) => {
            drawText(ctx, a, x + 12, 172 + i * 13, { color: C.dim });
            drawText(ctx, b, x + w - 12, 172 + i * 13, { color: C.text, align: 'right' });
        });

        if (!game.touch.enabled && Math.floor(this.time * 2.5) % 2 === 0) {
            const label = victory ? 'R FIGHT AGAIN   Q TITLE' : 'R RETRY   Q TITLE';
            drawText(ctx, label, VIEW_W / 2, 250, { scale: 2, color: C.text, align: 'center', outline: true });
        }
    }
}

export function renderLoading(ctx, progress) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(ctx, 'LOADING', VIEW_W / 2, 160, { scale: 2, color: C.text, align: 'center' });
    bar(ctx, VIEW_W / 2 - 80, 186, 160, 6, progress, 0, C.boss, C.bossLight, C.bossDark, 8);
}

export { textWidth };
