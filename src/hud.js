// Pixel HUD drawn directly on the low-res canvas: player frame, boss bar, combo, banners and menus.
import { drawText, textWidth } from './font.js';
import { VIEW_W, VIEW_H } from './arena.js';
import { CHARACTER } from './character.js';

export const CREDITS = 'Created by Spian45 and Charlotte_B';

// Gameplay controls, shared by the pause menu and the title screen
export const CONTROL_ROWS = [
    ['MOVE', 'A D / ARROWS'],
    ['WALK (HOLD)', 'C'],
    ['JUMP (x2)', 'W / SPACE'],
    ['DROP DOWN', 'S + JUMP'],
    ['SLAM (IN AIR)', 'S'],
    ['DASH', 'SHIFT / L'],
    ['ATTACK', 'J / Z / L-CLICK'],
    ['FOXFIRE', 'K / X / R-CLICK'],
    ['DEBUG MODE', 'F3 / `']
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

        // Player frame
        panel(ctx, 8, 8, 30, 30);
        if (this.portrait) ctx.drawImage(this.portrait, 11, 11, 24, 24);
        else { ctx.fillStyle = C.hp; ctx.fillRect(11, 11, 24, 24); }
        drawText(ctx, CHARACTER.name, 44, 9, { color: C.text });
        drawText(ctx, `${Math.ceil(p.health)}`, 150, 9, { color: C.dim, align: 'right' });
        bar(ctx, 44, 19, 106, 6, p.health / p.maxHealth, this.hpTrail, C.hp, C.hpLight, C.hpDark, 10);
        bar(ctx, 44, 29, 80, 4, p.mana / p.maxMana, 0, C.mp, C.mpLight, C.mpDark, 4);
        // foxfire charges (25 mana each)
        const charges = Math.floor(p.mana / 25);
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = C.ink;
            ctx.fillRect(128 + i * 6, 28, 5, 6);
            ctx.fillStyle = i < charges ? C.mpLight : '#2a2238';
            ctx.fillRect(129 + i * 6, 29, 3, 4);
        }

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

        // Controls hint for the first seconds
        if (game.elapsed < 9 && game.state === 'fight') {
            ctx.globalAlpha = Math.min(1, (9 - game.elapsed) / 1.5);
            drawText(ctx, 'A/D MOVE  C WALK  W/SPACE JUMP x2  S(AIR) SLAM  SHIFT DASH  J ATTACK  K FOXFIRE  ESC PAUSE', VIEW_W / 2, 48, { color: C.dim, align: 'center', outline: true });
            drawText(ctx, CREDITS, 12, VIEW_H - 46, { color: C.gold, outline: true });
            ctx.globalAlpha = 1;
        }
        if (!game.audioStarted) {
            const on = Math.floor(this.time * 2) % 2 === 0;
            if (on) drawText(ctx, 'PRESS ANY KEY FOR SOUND', VIEW_W - 8, VIEW_H - 46, { color: C.dim, align: 'right', outline: true });
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

    renderPause(ctx) {
        ctx.fillStyle = 'rgba(14,8,20,0.72)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        const w = 260;
        const h = 224;
        const x = (VIEW_W - w) / 2;
        const y = 80;
        panel(ctx, x, y, w, h);
        drawText(ctx, 'PAUSED', VIEW_W / 2, y + 12, { scale: 2, color: C.gold, align: 'center' });
        const rows = [...CONTROL_ROWS, ['RESTART', 'R'], ['QUIT TO TITLE', 'Q'], ['RESUME', 'ESC / P']];
        rows.forEach(([a, b], i) => {
            drawText(ctx, a, x + 16, y + 40 + i * 14, { color: C.text });
            drawText(ctx, b, x + w - 16, y + 40 + i * 14, { color: C.dim, align: 'right' });
        });
        drawText(ctx, CREDITS, VIEW_W / 2, y + h + 12, { color: C.gold, align: 'center', outline: true });
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

        if (Math.floor(this.time * 2.5) % 2 === 0) {
            const label = victory ? 'R FIGHT AGAIN   Q TITLE' : 'R RETRY   Q TITLE';
            drawText(ctx, label, VIEW_W / 2, 250, { scale: 2, color: C.text, align: 'center', outline: true });
        }
        drawText(ctx, CREDITS, VIEW_W / 2, 300, { color: C.gold, align: 'center', outline: true });
    }
}

export function renderLoading(ctx, progress) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(ctx, 'LOADING', VIEW_W / 2, 160, { scale: 2, color: C.text, align: 'center' });
    bar(ctx, VIEW_W / 2 - 80, 186, 160, 6, progress, 0, C.boss, C.bossLight, C.bossDark, 8);
    drawText(ctx, CREDITS, VIEW_W / 2, VIEW_H - 30, { color: C.gold, align: 'center' });
}

export { textWidth };
