// Pixel particles, floating damage numbers, afterimages and hit sparks.
// Everything is drawn as integer-aligned squares to keep the chunky pixel look.
import { drawText } from './font.js';

export class FX {
    constructor() {
        this.particles = [];
        this.texts = [];
        this.afterimages = [];
        this.rings = [];
        this.leaves = [];
        for (let i = 0; i < 26; i++) this.leaves.push(this.makeLeaf(true));
    }

    makeLeaf(randomY) {
        const palette = ['#d9822b', '#b5562a', '#e8b04a', '#8e3b2a'];
        return {
            x: Math.random() * 900 - 60,
            y: randomY ? Math.random() * 320 : -10,
            vx: -12 - Math.random() * 18,
            vy: 14 + Math.random() * 16,
            sway: Math.random() * 6.28,
            color: palette[(Math.random() * palette.length) | 0],
            size: Math.random() < 0.3 ? 2 : 1
        };
    }

    burst(x, y, count, colors, { speed = 120, life = 0.45, gravity = 260, size = 2, up = 0 } = {}) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = speed * (0.35 + Math.random() * 0.65);
            this.particles.push({
                x, y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s - up,
                life: life * (0.6 + Math.random() * 0.4),
                max: life,
                color: colors[(Math.random() * colors.length) | 0],
                size: Math.random() < 0.3 ? size + 1 : size,
                gravity
            });
        }
    }

    // Drifting embers that rise (used for blight / flames)
    embers(x, y, count, colors, spread = 6) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * spread * 2,
                y: y + (Math.random() - 0.5) * spread,
                vx: (Math.random() - 0.5) * 20,
                vy: -20 - Math.random() * 40,
                life: 0.5 + Math.random() * 0.5,
                max: 1,
                color: colors[(Math.random() * colors.length) | 0],
                size: Math.random() < 0.25 ? 2 : 1,
                gravity: -10
            });
        }
    }

    ring(x, y, color, maxR = 28, life = 0.3) {
        this.rings.push({ x, y, color, r: 2, maxR, life, max: life });
    }

    number(x, y, value, color = '#ffffff', big = false) {
        this.texts.push({
            text: String(value),
            x: x + (Math.random() - 0.5) * 10,
            y,
            vy: -70,
            life: 0.75,
            max: 0.75,
            color,
            scale: big ? 2 : 1
        });
    }

    afterimage(img, sx, sy, sw, sh, dx, dy, facing, tint = 0.5) {
        this.afterimages.push({ img, sx, sy, sw, sh, dx, dy, facing, life: 0.22, max: 0.22, tint });
    }

    update(dt, camX) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            p.vy += p.gravity * dt;
            p.vx *= 0.98;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.life -= dt;
            if (t.life <= 0) { this.texts.splice(i, 1); continue; }
            t.vy += 140 * dt;
            t.y += t.vy * dt;
        }
        for (let i = this.afterimages.length - 1; i >= 0; i--) {
            const a = this.afterimages[i];
            a.life -= dt;
            if (a.life <= 0) this.afterimages.splice(i, 1);
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.life -= dt;
            r.r = r.maxR * (1 - r.life / r.max);
            if (r.life <= 0) this.rings.splice(i, 1);
        }
        for (const l of this.leaves) {
            l.sway += dt * 2.5;
            l.x += (l.vx + Math.sin(l.sway) * 14) * dt;
            l.y += l.vy * dt;
            if (l.y > 330 || l.x < camX - 40) Object.assign(l, this.makeLeaf(false), { x: camX + Math.random() * 700 });
        }
    }

    renderLeaves(ctx) {
        for (const l of this.leaves) {
            ctx.fillStyle = l.color;
            ctx.fillRect(Math.round(l.x), Math.round(l.y), l.size + 1, l.size);
        }
    }

    render(ctx) {
        for (const a of this.afterimages) {
            ctx.save();
            ctx.globalAlpha = (a.life / a.max) * a.tint;
            ctx.translate(Math.round(a.dx), Math.round(a.dy));
            ctx.scale(a.facing, 1);
            ctx.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, -a.sw / 2, -a.sh, a.sw, a.sh);
            ctx.restore();
        }

        for (const r of this.rings) {
            ctx.fillStyle = r.color;
            ctx.globalAlpha = Math.max(0, r.life / r.max);
            const steps = 16;
            for (let i = 0; i < steps; i++) {
                const a = (i / steps) * Math.PI * 2;
                ctx.fillRect(Math.round(r.x + Math.cos(a) * r.r) - 1, Math.round(r.y + Math.sin(a) * r.r) - 1, 2, 2);
            }
            ctx.globalAlpha = 1;
        }

        for (const p of this.particles) {
            ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
        ctx.globalAlpha = 1;

        for (const t of this.texts) {
            ctx.globalAlpha = Math.min(1, t.life / 0.25);
            drawText(ctx, t.text, t.x, t.y, { scale: t.scale, color: t.color, align: 'center', outline: true });
        }
        ctx.globalAlpha = 1;
    }
}
