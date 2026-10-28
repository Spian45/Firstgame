// Projectiles and hazards. Each has update(dt, game) and render(ctx), and sets `dead` when finished.
import { audio } from './audio.js';
import { ARENA_W, GROUND_Y, VIEW_H } from './arena.js';

export function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Player skill: homing spirit flame
export class Foxfire {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = 1.8;
        this.damage = 12;
        this.dead = false;
        this.t = 0;
    }

    get hitbox() {
        return { x: this.x - 3, y: this.y - 3, w: 6, h: 6 };
    }

    update(dt, game) {
        this.t += dt;
        this.life -= dt;
        if (this.life <= 0) { this.dead = true; return; }

        const boss = game.boss;
        if (boss && boss.targetable && this.t > 0.12) {
            const ang = Math.atan2(boss.y - this.y, boss.x - this.x);
            this.vx += (Math.cos(ang) * 260 - this.vx) * Math.min(1, dt * 5);
            this.vy += (Math.sin(ang) * 260 - this.vy) * Math.min(1, dt * 5);
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (Math.random() < 0.6) game.fx.embers(this.x, this.y, 1, ['#9ee7ff', '#38bdf8'], 2);

        if (boss && boss.targetable && overlap(this.hitbox, boss.hurtbox)) {
            boss.takeDamage(this.damage, game, false);
            game.fx.burst(this.x, this.y, 8, ['#9ee7ff', '#ffffff', '#38bdf8'], { speed: 90, gravity: 0, life: 0.3 });
            this.dead = true;
        }
    }

    render(ctx) {
        const x = Math.round(this.x);
        const y = Math.round(this.y);
        const pulse = Math.floor(this.t * 16) % 2;
        ctx.fillStyle = '#0c4a6e';
        ctx.fillRect(x - 3, y - 2, 7, 5);
        ctx.fillRect(x - 2, y - 3, 5, 7);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x - 2, y - 2, 5, 5);
        ctx.fillStyle = pulse ? '#ffffff' : '#bae6fd';
        ctx.fillRect(x - 1, y - 1, 3, 3);
    }
}

// Boss: blight orb
export class BlightOrb {
    constructor(x, y, vx, vy, damage = 10) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.dead = false;
        this.t = 0;
    }

    get hitbox() {
        return { x: this.x - 4, y: this.y - 4, w: 8, h: 8 };
    }

    update(dt, game) {
        this.t += dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.x < -20 || this.x > ARENA_W + 20 || this.y < -40 || this.y > VIEW_H + 20) { this.dead = true; return; }
        if (this.y > GROUND_Y - 3) {
            this.dead = true;
            game.fx.burst(this.x, GROUND_Y - 2, 6, ['#ff3df0', '#5b2a86'], { speed: 60, life: 0.3, up: 40 });
            return;
        }
        if (Math.random() < 0.5) game.fx.embers(this.x, this.y, 1, ['#ff3df0', '#8d2fd0', '#3b1d5a'], 2);

        const p = game.player;
        if (overlap(this.hitbox, p.hitbox)) {
            // only pops when it actually hits; a perfectly dodged orb flies on through
            if (p.takeDamage(this.damage, Math.sign(this.vx || 1) * 120, game.fx)) {
                game.onPlayerHit();
                this.dead = true;
            }
        }
    }

    render(ctx) {
        const x = Math.round(this.x);
        const y = Math.round(this.y);
        const f = Math.floor(this.t * 12) % 2;
        ctx.fillStyle = '#1a0f1f';
        ctx.fillRect(x - 4, y - 3, 9, 7);
        ctx.fillRect(x - 3, y - 4, 7, 9);
        ctx.fillStyle = '#8d2fd0';
        ctx.fillRect(x - 3, y - 3, 7, 7);
        ctx.fillStyle = f ? '#ff3df0' : '#e070ff';
        ctx.fillRect(x - 2, y - 2, 5, 5);
        ctx.fillStyle = '#ffd6ff';
        ctx.fillRect(x - 1, y - 1, 2, 2);
    }
}

// Boss (hard): blight meteor. A blinking target mark on the ground first, then an orb drops from the sky onto it
export class Meteor {
    constructor(x, delay) {
        this.x = x;
        this.y = -16;
        this.warn = 0.55 + delay;
        this.vy = 0;
        this.dead = false;
        this.t = 0;
    }

    get hitbox() {
        return this.warn > 0 ? null : { x: this.x - 5, y: this.y - 5, w: 10, h: 10 };
    }

    update(dt, game) {
        this.t += dt;
        if (this.warn > 0) {
            this.warn -= dt;
            return;
        }
        this.vy = Math.min(420, this.vy + 900 * dt);
        this.y += this.vy * dt;
        if (Math.random() < 0.8) game.fx.embers(this.x, this.y - 6, 1, ['#ff3df0', '#8d2fd0', '#ffd6ff'], 3);
        if (this.y >= GROUND_Y - 4) {
            this.dead = true;
            game.shake(2, 0.08);
            game.fx.burst(this.x, GROUND_Y - 3, 10, ['#ff3df0', '#c050ff', '#ffd6ff'], { speed: 110, up: 80, life: 0.4 });
            game.fx.ring(this.x, GROUND_Y - 3, '#ff3df0', 14, 0.2);
            return;
        }
        const p = game.player;
        if (overlap(this.hitbox, p.hitbox)) {
            if (p.takeDamage(12, Math.sign(p.x - this.x || 1) * 120, game.fx)) {
                game.onPlayerHit();
                this.dead = true;
            }
        }
    }

    render(ctx) {
        const x = Math.round(this.x);
        if (this.warn > 0) {
            // ground target: two chevrons closing in, blinking faster as it nears impact
            const on = Math.floor(this.t * (this.warn < 0.3 ? 18 : 8)) % 2 === 0;
            const gap = 3 + Math.round(Math.min(1, this.warn / 0.6) * 6);
            ctx.fillStyle = on ? '#ff3df0' : '#8d2fd0';
            ctx.fillRect(x - gap - 3, GROUND_Y - 2, 3, 1);
            ctx.fillRect(x - gap - 1, GROUND_Y - 3, 1, 1);
            ctx.fillRect(x + gap, GROUND_Y - 2, 3, 1);
            ctx.fillRect(x + gap, GROUND_Y - 3, 1, 1);
            if (on) ctx.fillRect(x, GROUND_Y - 2, 1, 1);
            return;
        }
        const y = Math.round(this.y);
        ctx.fillStyle = '#8d2fd0';
        ctx.fillRect(x - 1, y - 14, 3, 10); // falling streak
        ctx.fillStyle = '#1a0f1f';
        ctx.fillRect(x - 5, y - 4, 11, 9);
        ctx.fillRect(x - 4, y - 5, 9, 11);
        ctx.fillStyle = '#c050ff';
        ctx.fillRect(x - 4, y - 4, 9, 9);
        ctx.fillStyle = Math.floor(this.t * 14) % 2 ? '#ff3df0' : '#ffd6ff';
        ctx.fillRect(x - 2, y - 2, 5, 5);
    }
}

// Boss: ground shockwave travelling along the floor
export class Shockwave {
    constructor(x, dir, speed) {
        this.x = x;
        this.dir = dir;
        this.speed = speed;
        this.dead = false;
        this.t = 0;
    }

    get hitbox() {
        return { x: this.x - 7, y: GROUND_Y - 16, w: 14, h: 16 };
    }

    update(dt, game) {
        this.t += dt;
        this.x += this.dir * this.speed * dt;
        if (this.x < -20 || this.x > ARENA_W + 20) { this.dead = true; return; }
        if (Math.random() < 0.8) game.fx.embers(this.x, GROUND_Y - 4, 1, ['#ff3df0', '#8d2fd0'], 6);
        const p = game.player;
        if (overlap(this.hitbox, p.hitbox)) {
            if (p.takeDamage(14, this.dir * 160, game.fx)) game.onPlayerHit();
        }
    }

    render(ctx) {
        const x = Math.round(this.x);
        const flick = Math.floor(this.t * 20) % 3;
        const heights = [6, 11, 16, 12, 8, 4];
        for (let i = 0; i < heights.length; i++) {
            const h = heights[(i + flick) % heights.length];
            const cx = x - this.dir * (i * 2) - 1;
            ctx.fillStyle = '#1a0f1f';
            ctx.fillRect(cx - 1, GROUND_Y - h - 1, 4, h + 1);
            ctx.fillStyle = i < 2 ? '#ff3df0' : '#8d2fd0';
            ctx.fillRect(cx, GROUND_Y - h, 2, h);
        }
        ctx.fillStyle = '#ffd6ff';
        ctx.fillRect(x - 1, GROUND_Y - 6, 2, 4);
    }
}

// Boss phase 2: a pulsing rune circle on the ground, then a purple blight-energy beam erupts
const PILLAR_H = GROUND_Y + 10; // reaches past the top of the screen: platforms are no shelter
const RISE_SPEED = 2600;         // px/s the beam shoots up
const PILLAR_ACTIVE = 0.7;

export class Pillar {
    constructor(x, delay) {
        this.x = x;
        this.warn = 0.9 + delay;
        this.active = PILLAR_ACTIVE;
        this.dead = false;
        this.t = 0;
        this.erupted = false;
        this.age = 0; // time since eruption
    }

    // Only dangerous once erupted
    get hitbox() {
        if (this.warn > 0) return null;
        const h = Math.min(PILLAR_H, this.age * RISE_SPEED); // only as tall as the beam has risen so far
        return { x: this.x - 13, y: GROUND_Y - h, w: 26, h };
    }

    update(dt, game) {
        this.t += dt;
        if (this.warn > 0) {
            this.warn -= dt;
            if (Math.random() < 0.35) game.fx.embers(this.x + (Math.random() - 0.5) * 24, GROUND_Y - 2, 1, ['#c050ff', '#ff3df0', '#ffd6ff'], 2);
            return;
        }
        if (!this.erupted) {
            this.erupted = true;
            game.shake(3, 0.15);
            audio.pillarErupt();
            game.fx.burst(this.x, GROUND_Y - 4, 18, ['#ff3df0', '#c050ff', '#ffd6ff', '#3b1d5a'], { speed: 160, up: 120, life: 0.5 });
            game.fx.ring(this.x, GROUND_Y - 4, '#c050ff', 30, 0.3);
        }
        this.age += dt;
        this.active -= dt;
        if (Math.random() < 0.8) game.fx.embers(this.x + (Math.random() - 0.5) * 20, GROUND_Y - Math.random() * PILLAR_H, 1, ['#ffd6ff', '#ff3df0', '#c050ff'], 3);
        if (this.active <= 0) { this.dead = true; return; }
        const p = game.player;
        if (overlap(this.hitbox, p.hitbox)) {
            if (p.takeDamage(18, Math.sign(p.x - this.x || 1) * 140, game.fx)) game.onPlayerHit();
        }
    }

    render(ctx) {
        const x = Math.round(this.x);
        if (this.warn > 0) return this.renderRune(ctx, x);

        // Beam rises out of the ground, then thins out over the last 0.2s
        const height = Math.round(Math.min(PILLAR_H, this.age * RISE_SPEED));
        const fade = Math.min(1, this.active / 0.2);
        const top = GROUND_Y - height;
        const t = this.t;

        // soft additive glow behind the beam
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(160,60,220,${(0.12 * fade).toFixed(3)})`;
        ctx.fillRect(x - 22, top, 44, height);
        ctx.fillStyle = `rgba(255,80,240,${(0.1 * fade).toFixed(3)})`;
        ctx.fillRect(x - 15, top, 30, height);
        ctx.restore();

        // layered body in 2px rows with a wavy, jagged edge
        const layers = [
            ['#2b1640', 1.0],
            ['#6b2fa0', 0.82],
            ['#c050ff', 0.58],
            ['#ff3df0', 0.34],
            [Math.floor(t * 20) % 2 ? '#ffd6ff' : '#ffffff', 0.14]
        ];
        for (let y = top; y < GROUND_Y; y += 2) {
            const k = (y - top) / Math.max(1, height);
            const wave = Math.sin(y * 0.16 + t * 26) * 2 + Math.sin(y * 0.05 - t * 9) * 1.5;
            const flare = k < 0.12 ? (0.12 - k) * 40 : 0; // crown flares at the top
            const base = (11 + wave + flare) * fade;
            for (const [color, scale] of layers) {
                const half = Math.max(1, Math.round(base * scale));
                ctx.fillStyle = color;
                ctx.fillRect(x - half, y, half * 2, 2);
            }
        }

        // crown sparks
        ctx.fillStyle = '#ffd6ff';
        for (let i = 0; i < 5; i++) {
            const a = t * 6 + i * 1.3;
            ctx.fillRect(Math.round(x + Math.cos(a) * 12 * fade), Math.round(top - 4 - Math.abs(Math.sin(a * 1.7)) * 8), 2, 2);
        }
        // scorched base
        ctx.fillStyle = '#ff3df0';
        ctx.fillRect(x - 16, GROUND_Y - 2, 32, 2);
    }

    // Ground rune: a flat ellipse of pixels with orbiting glyph dots, blinking faster before eruption
    renderRune(ctx, x) {
        const urgent = this.warn < 0.35;
        const on = Math.floor(this.t * (urgent ? 18 : 7)) % 2 === 0;
        const rx = 16;
        const ry = 4;
        const cy = GROUND_Y - 2;
        ctx.fillStyle = on ? '#ff3df0' : '#8d2fd0';
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            ctx.fillRect(Math.round(x + Math.cos(a) * rx) - 1, Math.round(cy + Math.sin(a) * ry), 2, 1);
        }
        ctx.fillStyle = '#ffd6ff';
        for (let i = 0; i < 4; i++) {
            const a = this.t * 3 + (i * Math.PI) / 2;
            ctx.fillRect(Math.round(x + Math.cos(a) * (rx - 5)) - 1, Math.round(cy + Math.sin(a) * (ry - 1)), 2, 1);
        }
        if (on) {
            ctx.fillStyle = urgent ? '#ffd6ff' : '#c050ff';
            ctx.fillRect(x - 1, cy - 1, 2, 2);
            ctx.fillRect(x - 1, cy - 12, 2, 7); // warning streak
        }
    }
}
