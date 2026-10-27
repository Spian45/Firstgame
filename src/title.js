// Title menu: live arena backdrop, idle Ren, the boss mask looming, and a pixel menu.
import { drawText } from './font.js';
import { VIEW_W, VIEW_H, ARENA_W, pixelGlow } from './arena.js';
import { CREDITS, CONTROL_ROWS } from './hud.js';
import { Gallery } from './gallery.js';

const GOLD = '#f0b84a';
const TEXT = '#f2ebe0';
const DIM = '#a89ab0';
const PINK = '#ff3df0';

// Ren stands still on the title screen
const NO_INPUT = { left: false, right: false, down: false, jump: false, jumpHeld: false, dash: false, attack: false, skill: false, walk: false };

export class TitleScreen {
    constructor() {
        this.selected = 0;
        this.page = 'menu'; // menu | controls | credits | gallery
        this.time = 0;
        this.gallery = new Gallery();
    }

    items(game) {
        return [
            { label: 'START', action: () => game.startFight() },
            { label: 'GALLERY', action: () => { this.page = 'gallery'; this.gallery.open(); } },
            { label: `DISPLAY: ${game.displayMode === 'fill' ? 'FILL SCREEN' : 'PIXEL PERFECT'}`, action: () => game.toggleDisplay() },
            { label: 'CONTROLS', action: () => { this.page = 'controls'; } },
            { label: 'CREDITS', action: () => { this.page = 'credits'; } }
        ];
    }

    update(dt, input, game) {
        this.time += dt;
        // Slow drifting camera over the arena
        game.camX = (ARENA_W - VIEW_W) * (0.5 + 0.5 * Math.sin(this.time * 0.15));
        game.arena.update(dt, 0);
        game.fx.update(dt, game.camX);
        game.player.update(dt, NO_INPUT, game.arena, game.fx, [], () => null);

        if (this.page === 'gallery') {
            if (this.gallery.update(dt, input, game) === 'close') {
                this.gallery.close(game);
                this.page = 'menu';
            }
            return;
        }
        if (this.page !== 'menu') {
            if (input.back || input.confirm) this.page = 'menu';
            return;
        }
        const items = this.items(game);
        if (input.menuUp) this.selected = (this.selected + items.length - 1) % items.length;
        if (input.menuDown) this.selected = (this.selected + 1) % items.length;
        if (input.confirm) items[this.selected].action();
    }

    render(ctx, game) {
        const t = this.time;
        game.arena.renderBackground(ctx, game.camX);

        ctx.save();
        ctx.translate(-Math.round(game.camX), 0);
        game.arena.renderWorld(ctx);
        game.player.renderShadow(ctx);
        game.player.render(ctx);
        game.arena.renderLights(ctx);
        game.fx.renderLeaves(ctx);
        game.arena.renderForeground(ctx);
        ctx.restore();

        // Darken the scene so the menu reads
        ctx.fillStyle = 'rgba(14,8,20,0.45)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);

        // The boss mask looming behind the title
        const boss = game.boss;
        const bx = Math.round(VIEW_W - 100);
        const by = Math.round(120 + Math.sin(t * 1.6) * 5);
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.globalCompositeOperation = 'lighter';
        pixelGlow(ctx, bx, by, 60, 'rgba(160,40,200,0.05)', 5);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.9;
        if (boss.portal) {
            const f = Math.floor(t * 12) % 10;
            ctx.drawImage(boss.portal, f * 64, 0, 64, 64, bx - 54, by - 70, 64, 64);
            ctx.drawImage(boss.portal, ((f + 5) % 10) * 64, 0, 64, 64, bx - 10, by - 70, 64, 64);
        }
        const blink = Math.floor(t * 2) % 7 === 0;
        ctx.drawImage(blink ? boss.sprites.maskCharge : boss.sprites.mask, bx - 36, by - 38);
        ctx.restore();

        if (this.page === 'gallery') return this.gallery.render(ctx, game);
        if (this.page === 'controls') return this.renderControls(ctx);
        if (this.page === 'credits') return this.renderCredits(ctx);

        // Title
        drawText(ctx, 'UNITED REALM', 64, 58, { scale: 6, color: GOLD, outline: true });
        drawText(ctx, 'SPIRIT OF THE TWILIGHT VALE', 66, 110, { scale: 2, color: TEXT, outline: true });
        drawText(ctx, '- DEMO -', 68, 132, { color: PINK, outline: true });

        // Menu
        const items = this.items(game);
        items.forEach((item, i) => {
            const y = 176 + i * 20;
            const sel = i === this.selected;
            if (sel) {
                ctx.fillStyle = 'rgba(240,184,74,0.18)';
                ctx.fillRect(56, y - 4, 200, 16);
                if (Math.floor(t * 3) % 2 === 0) drawText(ctx, '>', 62, y, { color: GOLD, outline: true });
            }
            drawText(ctx, item.label, 76, y, { color: sel ? GOLD : TEXT, outline: true });
        });

        drawText(ctx, 'W/S SELECT   ENTER CONFIRM', 64, VIEW_H - 40, { color: DIM, outline: true });
        drawText(ctx, CREDITS, VIEW_W / 2, VIEW_H - 18, { color: GOLD, align: 'center', outline: true });
        if (!game.audioStarted && Math.floor(t * 2) % 2 === 0) {
            drawText(ctx, 'PRESS ANY KEY FOR SOUND', VIEW_W - 12, 12, { color: DIM, align: 'right', outline: true });
        }
    }

    panel(ctx, title, h) {
        const w = 300;
        const x = (VIEW_W - w) / 2;
        const y = (VIEW_H - h) / 2;
        ctx.fillStyle = '#140c1c';
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = '#2a1a2e';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = GOLD;
        ctx.fillRect(x, y, w, 1);
        ctx.fillRect(x, y + h - 1, w, 1);
        drawText(ctx, title, VIEW_W / 2, y + 12, { scale: 2, color: GOLD, align: 'center' });
        drawText(ctx, 'ESC / ENTER BACK', VIEW_W / 2, y + h - 16, { color: DIM, align: 'center' });
        return { x, y, w };
    }

    renderControls(ctx) {
        const { x, y, w } = this.panel(ctx, 'CONTROLS', 40 + CONTROL_ROWS.length * 14 + 30);
        CONTROL_ROWS.forEach(([a, b], i) => {
            drawText(ctx, a, x + 18, y + 40 + i * 14, { color: TEXT });
            drawText(ctx, b, x + w - 18, y + 40 + i * 14, { color: DIM, align: 'right' });
        });
    }

    renderCredits(ctx) {
        const { y } = this.panel(ctx, 'CREDITS', 186);
        const lines = [
            [CREDITS, GOLD],
            ['', TEXT],
            ['WORLD  Charlotte_B', TEXT],
            ['MUSIC  Spian45', TEXT],
            ['REN ANIMATION  SPRITERRIFIC', TEXT],
            ['TESTERS  Muh. Gibran', TEXT]
        ];
        lines.forEach(([line, color], i) => drawText(ctx, line, VIEW_W / 2, y + 44 + i * 16, { color, align: 'center' }));
    }
}
