// LORD KAGETORA - the Blighted Kitsune Mask.
// A floating corrupted fox mask with spectral claws and shadow tails. Two phases.
import { audio } from './audio.js';
import { PixelGrid } from './pixelart.js';
import { ARENA_W, GROUND_Y } from './arena.js';
import { BlightOrb, Shockwave, Pillar, overlap } from './projectiles.js';

const PALETTE = {
    K: '#1a0f1f', W: '#f2ebe0', w: '#c8bdb8', s: '#8d7f8f',
    R: '#d0283e', r: '#7c1631', G: '#f0b84a', g: '#9a6a28',
    E: '#ff3df0', e: '#ffffff', p: '#6b2fa0', P: '#2b1640'
};

const MASK_W = 72;
const MASK_H = 68;

function buildMaskGrid(cracked) {
    const g = new PixelGrid(MASK_W, MASK_H);
    // ears
    g.tri(6, 1, 9, 34, 30, 17, 'W');
    // cheek tufts
    g.tri(2, 46, 14, 32, 18, 52, 'W');
    g.tri(8, 55, 16, 40, 23, 57, 'W');
    // face + snout
    g.ellipse(35.5, 38, 26, 20, 'W');
    g.tri(21, 40, 35, 40, 35, 65, 'W');
    g.mirror();
    g.shade('W', 'w', 0, 3);
    g.shade('W', 'w', 3, 0);
    g.shade('w', 's', 0, 1);

    const both = (fn) => { fn((x) => x); fn((x) => MASK_W - 1 - x); };
    both((m) => {
        // inner ears
        g.tri(m(9), 7, m(12), 28, m(24), 18, 'R');
        g.tri(m(11), 12, m(13), 25, m(20), 19, 'r');
        // eyes
        g.tri(m(16), 31, m(31), 36, m(22), 39, 'K');
        g.tri(m(20), 33, m(29), 36, m(23), 37, 'E');
        g.set(m(25), 35, 'e');
        g.set(m(24), 35, 'e');
        // brow flames
        g.line(m(12), 25, m(28), 31, 'R');
        g.line(m(12), 26, m(28), 32, 'R');
        g.line(m(14), 23, m(20), 25, 'r');
        // whisker stripes
        g.line(m(9), 42, m(20), 44, 'R');
        g.line(m(10), 46, m(20), 47, 'R');
        g.line(m(12), 50, m(21), 50, 'r');
        // mouth
        g.line(m(27), 55, m(33), 58, 'r');
    });
    // forehead jewel
    for (let i = 0; i < 5; i++) {
        g.rect(35 - i, 14 + i, 2 + 2 * i, 1, 'G');
        g.rect(35 - i, 24 - i, 2 + 2 * i, 1, 'G');
    }
    g.rect(30, 19, 12, 1, 'G');
    g.rect(34, 17, 4, 5, 'g');
    g.rect(35, 18, 2, 3, 'R');
    // nose
    g.rect(32, 60, 8, 4, 'K');
    g.rect(33, 60, 2, 1, 's');

    if (cracked) {
        const crack = [[46, 12, 50, 23], [50, 23, 45, 31], [45, 31, 52, 41], [52, 41, 48, 52], [48, 52, 51, 58],
            [21, 43, 27, 51], [27, 51, 24, 58], [11, 9, 16, 18], [60, 30, 66, 36]];
        for (const [a, b, c, d] of crack) g.line(a, b, c, d, 'p');
        for (const [x, y] of [[50, 23], [45, 31], [52, 41], [27, 51], [48, 52]]) g.set(x, y, 'E');
    }
    g.outline('K');
    return g;
}

function buildHandGrid() {
    const g = new PixelGrid(30, 26);
    g.ellipse(11, 14, 9, 8, 'p');
    g.tri(15, 5, 29, 8, 17, 11, 'W');
    g.tri(16, 11, 29, 14, 16, 17, 'W');
    g.tri(15, 17, 28, 22, 17, 22, 'W');
    g.ellipse(16, 8, 3, 2, 'p');
    g.ellipse(17, 14, 3, 2, 'p');
    g.ellipse(16, 20, 3, 2, 'p');
    g.shade('p', 'P', 0, 2);
    g.shade('W', 'w', 0, 1);
    g.rect(8, 13, 3, 3, 'E');
    g.set(9, 14, 'e');
    g.outline('K');
    return g;
}

function buildSprites() {
    const mask = buildMaskGrid(false);
    const cracked = buildMaskGrid(true);
    const hand = buildHandGrid();
    const white = (k) => (k === 'K' ? '#ffd6ff' : '#ffffff');
    const charge = (k) => (k === 'E' || k === 'e' ? '#fff27a' : PALETTE[k]);
    const redHand = (k) => (k === 'p' ? '#d0283e' : k === 'P' ? '#7c1631' : PALETTE[k]);
    return {
        mask: mask.toCanvas(PALETTE),
        maskCharge: mask.toCanvas(PALETTE, charge),
        cracked: cracked.toCanvas(PALETTE),
        crackedCharge: cracked.toCanvas(PALETTE, charge),
        maskFlash: mask.toCanvas(PALETTE, white),
        hand: hand.toCanvas(PALETTE),
        handWarn: hand.toCanvas(PALETTE, redHand),
        handFlash: hand.toCanvas(PALETTE, white)
    };
}

export class Boss {
    constructor(portalImg) {
        this.sprites = buildSprites();
        this.portal = portalImg;
        this.name = 'LORD KAGETORA';
        this.title = 'THE BLIGHTED MASK';

        this.maxHealth = 640;
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;
        this.phase = 1;

        this.x = 500;
        this.y = GROUND_Y + 40;
        this.vx = 0;
        this.vy = 0;
        this.facing = -1;

        this.state = 'intro';
        this.sub = '';
        this.timer = 3.2;
        this.t = 0;
        this.flash = 0;
        this.charge = false;
        this.lastAttack = '';
        this.queue = [];
        this.sweepPasses = 0;

        this.hands = [
            { side: -1, x: 440, y: GROUND_Y, mode: 'idle', timer: 0, vy: 0 },
            { side: 1, x: 560, y: GROUND_Y, mode: 'idle', timer: 0, vy: 0 }
        ];
        this.activeHand = null;
        this.clawStrikes = 0;

        this.dead = false;
        this.deathTimer = 0;
        this.introAlpha = 0;
    }

    get targetable() {
        return !['intro', 'phase', 'dying'].includes(this.state) && !this.dead;
    }

    get hurtbox() {
        return { x: this.x - 26, y: this.y - 30, w: 52, h: 56 };
    }

    takeDamage(amount, game, melee) {
        if (!this.targetable) {
            game.fx.burst(this.x, this.y, 4, ['#c8bdb8', '#ffffff'], { speed: 60, life: 0.2 });
            return false;
        }
        const stunned = this.state === 'stunned';
        const dmg = Math.round(amount * (stunned ? 1.5 : 1));
        this.health = Math.max(0, this.health - dmg);
        this.flash = 0.08;
        game.fx.number(this.x + (Math.random() - 0.5) * 30, this.y - 34, dmg, stunned ? '#fff27a' : '#ffffff', stunned || dmg >= 30);
        game.fx.burst(this.x, this.y, melee ? 6 : 3, ['#ff3df0', '#ffffff', '#6b2fa0'], { speed: 110, life: 0.35 });
        audio.playHit(dmg >= 30 || stunned);
        audio.bossHurt(dmg >= 30 || stunned);

        if (this.phase === 1 && this.health <= this.maxHealth * 0.5) {
            this.enterPhase2(game);
        } else if (this.health <= 0) {
            this.state = 'dying';
            this.deathTimer = 2.6;
            this.hands.forEach((h) => (h.mode = 'idle'));
            game.onBossDefeated();
        }
        return true;
    }

    enterPhase2(game) {
        this.phase = 2;
        this.state = 'phase';
        this.timer = 2.2;
        this.charge = false;
        this.hands.forEach((h) => (h.mode = 'idle'));
        game.shake(6, 1.4);
        game.flashScreen('#ffffff', 0.25);
        game.banner('THE MASK SHATTERS', 'PHASE 2  -  ECLIPSE FURY');
        audio.bossRoar(1.6, 1);
        audio.sweepNoise('lowpass', 500, 80, 1.4, 0.3);
    }

    update(dt, game) {
        this.t += dt;
        this.flash = Math.max(0, this.flash - dt);
        this.displayHealth += (this.health - this.displayHealth) * Math.min(1, dt * 4);
        const p = game.player;
        if (this.state !== 'sweep') this.facing = p.x < this.x ? -1 : 1;

        switch (this.state) {
            case 'intro': this.updateIntro(dt, game); break;
            case 'hover': this.updateHover(dt, game); break;
            case 'orbs': this.updateOrbs(dt, game); break;
            case 'slam': this.updateSlam(dt, game); break;
            case 'stunned': this.updateStunned(dt, game); break;
            case 'claws': this.updateClaws(dt, game); break;
            case 'sweep': this.updateSweep(dt, game); break;
            case 'pillars': this.updatePillars(dt, game); break;
            case 'phase': this.updatePhase(dt, game); break;
            case 'dying': this.updateDying(dt, game); break;
        }

        this.updateHands(dt, game);

        // Ambient blight embers
        if (!this.dead && Math.random() < 0.5) {
            game.fx.embers(this.x + (Math.random() - 0.5) * 50, this.y - 20, 1, this.phase === 2 ? ['#ff3df0', '#ff5a5a', '#1a0f1f'] : ['#8d2fd0', '#ff3df0', '#1a0f1f'], 4);
        }

        // Body contact damage
        if (this.targetable && this.state !== 'stunned' && !p.slamming && overlap(this.hurtbox, p.hitbox)) {
            const dmg = this.state === 'sweep' && this.sub === 'charge' ? 20 : this.state === 'slam' && this.sub === 'fall' ? 24 : 10;
            if (p.takeDamage(dmg, Math.sign(p.x - this.x || 1) * 220, game.fx)) game.onPlayerHit();
        }
    }

    moveTo(tx, ty, rate, dt) {
        const k = Math.min(1, rate * dt);
        this.x += (tx - this.x) * k;
        this.y += (ty - this.y) * k;
    }

    // Damaging box of a claw mid-strike, or null
    handHitbox(h) {
        return h.mode === 'strike' ? { x: h.x - 12, y: h.y - 12, w: 24, h: 24 } : null;
    }

    nextAttack(forced = null) {
        const pool = this.phase === 1
            ? ['orbs', 'slam', 'claws', 'sweep', 'orbs']
            : ['orbs', 'slam', 'claws', 'sweep', 'pillars', 'pillars'];
        let pick = forced;
        if (forced) {
            this.hands.forEach((h) => (h.mode = 'idle'));
            this.activeHand = null;
            this.vy = 0;
        } else {
            do pick = pool[(Math.random() * pool.length) | 0]; while (pick === this.lastAttack);
        }
        this.lastAttack = pick;
        this.state = pick;
        this.sub = 'windup';
        this.charge = false;
        switch (pick) {
            case 'orbs': this.timer = 0.55; this.volleys = this.phase === 1 ? 1 : 2; audio.bossCharge(0.55); break;
            case 'slam': this.timer = 0.75; audio.bossRise(); break;
            case 'claws': this.clawStrikes = this.phase === 1 ? 2 : 4; this.timer = 0.2; break;
            case 'sweep':
                this.sweepPasses = this.phase === 1 ? 1 : 2;
                this.sweepFrom = this.x < ARENA_W / 2 ? -1 : 1;
                this.timer = 0.75;
                break;
            case 'pillars': this.timer = 0.5; audio.bossCharge(0.5); break;
        }
    }

    toHover(time) {
        this.state = 'hover';
        this.sub = '';
        this.charge = false;
        this.timer = time !== undefined ? time : (this.phase === 1 ? 1.1 : 0.7);
    }

    updateIntro(dt, game) {
        this.timer -= dt;
        const t = 1 - this.timer / 3.2;
        this.introAlpha = Math.min(1, t * 2);
        if (t > 0.25) this.moveTo(500, 150, 1.6, dt);
        if (!this.introRumble && t > 0.05) { this.introRumble = true; audio.pillarRumble(); }
        if (!this.introRoar && t > 0.55) { this.introRoar = true; audio.bossRoar(1.4, 0.8); }
        if (Math.random() < 0.8) game.fx.embers(500, GROUND_Y - 6, 2, ['#ff3df0', '#8d2fd0', '#1a0f1f'], 18);
        if (this.timer <= 0) {
            this.introAlpha = 1;
            this.toHover(0.6);
        }
    }

    updateHover(dt, game) {
        const p = game.player;
        const side = p.x < ARENA_W / 2 ? 1 : -1;
        const tx = Math.max(90, Math.min(ARENA_W - 90, p.x + side * 110));
        this.moveTo(tx, 140 + Math.sin(this.t * 2.2) * 8, 1.8, dt);
        this.timer -= dt;
        if (this.timer <= 0) this.nextAttack();
    }

    updateOrbs(dt, game) {
        const p = game.player;
        this.moveTo(this.x, 130 + Math.sin(this.t * 2.2) * 4, 2, dt);
        this.timer -= dt;
        if (this.sub === 'windup') {
            this.charge = true;
            if (Math.random() < 0.7) game.fx.burst(this.x + (Math.random() - 0.5) * 70, this.y + (Math.random() - 0.5) * 70, 1, ['#ff3df0'], { speed: 10, gravity: 0, life: 0.3 });
            if (this.timer <= 0) {
                this.charge = false;
                const count = this.phase === 1 ? 5 : 7;
                const speed = this.phase === 1 ? 125 : 150;
                const base = Math.atan2(p.y - 24 - this.y, p.x - this.x);
                for (let i = 0; i < count; i++) {
                    const a = base + (i - (count - 1) / 2) * 0.24;
                    game.enemyShots.push(new BlightOrb(this.x, this.y + 6, Math.cos(a) * speed, Math.sin(a) * speed));
                }
                audio.bossOrbs();
                game.fx.ring(this.x, this.y + 6, '#ff3df0', 26);
                this.volleys--;
                if (this.volleys > 0) { this.timer = 0.5; audio.bossCharge(0.45); } else { this.sub = 'recover'; this.timer = 0.6; }
            }
        } else if (this.timer <= 0) {
            this.toHover();
        }
    }

    updateSlam(dt, game) {
        const p = game.player;
        if (this.sub === 'windup') {
            // rise and track the player
            this.moveTo(p.x, 78, 4, dt);
            this.x = Math.max(40, Math.min(ARENA_W - 40, this.x));
            this.timer -= dt;
            if (this.timer <= 0) { this.sub = 'hang'; this.timer = 0.28; this.charge = true; audio.bossCharge(0.28); }
        } else if (this.sub === 'hang') {
            this.timer -= dt;
            if (this.timer <= 0) { this.sub = 'fall'; this.vy = 120; this.charge = false; }
        } else if (this.sub === 'fall') {
            this.vy += 2200 * dt;
            this.y += this.vy * dt;
            if (this.y >= GROUND_Y - 32) {
                this.y = GROUND_Y - 32;
                game.shake(7, 0.35);
                game.hitstop(0.05);
                audio.bossSlam();
                const speed = this.phase === 1 ? 210 : 260;
                game.enemyShots.push(new Shockwave(this.x - 20, -1, speed), new Shockwave(this.x + 20, 1, speed));
                game.fx.burst(this.x, GROUND_Y - 4, 22, ['#c8b090', '#8a7058', '#ff3df0', '#1a0f1f'], { speed: 180, up: 120, life: 0.6 });
                game.fx.ring(this.x, GROUND_Y - 10, '#ff3df0', 46, 0.4);
                if (this.phase === 2) {
                    for (let i = 0; i < 6; i++) {
                        const a = -Math.PI * (0.15 + 0.7 * (i / 5));
                        game.enemyShots.push(new BlightOrb(this.x, this.y - 10, Math.cos(a) * 120, Math.sin(a) * 120));
                    }
                }
                this.state = 'stunned';
                this.timer = this.phase === 1 ? 1.7 : 1.3;
            }
        }
    }

    updateStunned(dt, game) {
        this.timer -= dt;
        if (this.timer <= 0) this.toHover(0.8);
    }

    updateClaws(dt, game) {
        this.moveTo(this.x, 120 + Math.sin(this.t * 2.2) * 6, 2, dt);
        if (!this.activeHand) {
            this.timer -= dt;
            if (this.timer > 0) return;
            if (this.clawStrikes <= 0) { this.toHover(); return; }
            const hand = this.hands[this.clawStrikes % 2];
            hand.mode = 'aim';
            hand.timer = this.phase === 1 ? 0.6 : 0.42;
            this.activeHand = hand;
            this.clawStrikes--;
        }
    }

    updateSweep(dt, game) {
        const leftX = 50;
        const rightX = ARENA_W - 50;
        const lane = GROUND_Y - 40;
        if (this.sub === 'windup') {
            this.moveTo(this.sweepFrom < 0 ? leftX : rightX, lane, 4, dt);
            this.facing = -this.sweepFrom;
            this.timer -= dt;
            if (this.timer <= 0) { this.sub = 'warn'; this.timer = 0.45; this.charge = true; audio.bossGrowl(0.45); }
        } else if (this.sub === 'warn') {
            this.timer -= dt;
            this.x += Math.sin(this.t * 80) * 0.8;
            if (this.timer <= 0) {
                this.sub = 'charge';
                this.charge = false;
                this.vx = -this.sweepFrom * (this.phase === 1 ? 400 : 480);
                audio.bossSweep();
            }
        } else if (this.sub === 'charge') {
            this.x += this.vx * dt;
            this.y = lane + Math.sin(this.t * 10) * 2;
            game.fx.embers(this.x - Math.sign(this.vx) * 20, this.y + (Math.random() - 0.5) * 40, 2, ['#ff3df0', '#8d2fd0', '#1a0f1f'], 4);
            if ((this.vx > 0 && this.x >= rightX) || (this.vx < 0 && this.x <= leftX)) {
                this.x = this.vx > 0 ? rightX : leftX;
                game.shake(3, 0.15);
                audio.bossThud();
                this.sweepPasses--;
                if (this.sweepPasses > 0) {
                    this.sweepFrom = -this.sweepFrom;
                    this.sub = 'warn';
                    this.timer = 0.3;
                    this.charge = true;
                    audio.bossGrowl(0.3);
                } else {
                    this.sub = 'recover';
                    this.timer = 0.4;
                }
            }
        } else {
            this.timer -= dt;
            if (this.timer <= 0) this.toHover();
        }
    }

    updatePillars(dt, game) {
        this.moveTo(ARENA_W / 2, 90 + Math.sin(this.t * 2) * 4, 2, dt);
        this.timer -= dt;
        if (this.sub === 'windup') {
            this.charge = true;
            if (this.timer <= 0) {
                this.charge = false;
                const p = game.player;
                const xs = [p.x];
                const offset = Math.random() * 140;
                for (let x = 40 + offset; x < ARENA_W - 30; x += 140) {
                    if (Math.abs(x - p.x) > 50) xs.push(x);
                }
                xs.forEach((x, i) => game.enemyShots.push(new Pillar(x, i === 0 ? 0 : 0.15 + i * 0.08)));
                audio.pillarRumble();
                this.sub = 'recover';
                this.timer = 1.8;
            }
        } else if (this.timer <= 0) {
            this.toHover();
        }
    }

    updatePhase(dt, game) {
        this.moveTo(ARENA_W / 2, 140, 2, dt);
        this.timer -= dt;
        if (Math.random() < 0.9) game.fx.burst(this.x, this.y, 2, ['#ff3df0', '#ff5a5a', '#1a0f1f'], { speed: 160, gravity: 0, life: 0.5 });
        if (this.timer <= 0) {
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                game.enemyShots.push(new BlightOrb(this.x, this.y, Math.cos(a) * 110, Math.sin(a) * 110));
            }
            game.fx.ring(this.x, this.y, '#ff3df0', 60, 0.5);
            this.toHover(1.0);
        }
    }

    updateDying(dt, game) {
        this.deathTimer -= dt;
        this.x += Math.sin(this.t * 60) * 1.2;
        this.y += 6 * dt;
        if (Math.random() < 0.5) {
            game.fx.burst(this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 60, 8, ['#ff3df0', '#ffffff', '#f0b84a'], { speed: 120, life: 0.5 });
            audio.playHit(false);
        }
        if (this.deathTimer <= 0 && !this.dead) {
            this.dead = true;
            game.shake(8, 0.5);
            game.flashScreen('#ffffff', 0.5);
            game.fx.burst(this.x, this.y, 80, ['#ffffff', '#ffd0f5', '#f0b84a', '#ff3df0'], { speed: 260, life: 1.1, gravity: 120 });
            audio.bossShatter();
            audio.playChime(523.25, 2.5);
        }
    }

    updateHands(dt, game) {
        const p = game.player;
        for (const h of this.hands) {
            if (h.mode === 'idle') {
                const bob = Math.sin(this.t * 3 + h.side) * 5;
                const spread = this.state === 'stunned' ? 40 : 54;
                const k = Math.min(1, dt * 6);
                h.x += (this.x + h.side * spread - h.x) * k;
                h.y += (this.y + 16 + bob - h.y) * k;
            } else if (h.mode === 'aim') {
                const k = Math.min(1, dt * 8);
                h.x += (p.x - h.x) * k;
                h.y += (GROUND_Y - 120 - h.y) * k;
                h.timer -= dt;
                if (h.timer <= 0) { h.mode = 'strike'; h.vy = 200; audio.clawSwipe(); }
            } else if (h.mode === 'strike') {
                h.vy += 2600 * dt;
                h.y += h.vy * dt;
                if (overlap(this.handHitbox(h), p.hitbox)) {
                    if (p.takeDamage(16, Math.sign(p.x - h.x || 1) * 180, game.fx)) game.onPlayerHit();
                }
                if (h.y >= GROUND_Y - 12) {
                    h.y = GROUND_Y - 12;
                    h.mode = 'rest';
                    h.timer = 0.3;
                    game.shake(3, 0.12);
                    audio.clawImpact();
                    game.fx.burst(h.x, GROUND_Y - 2, 10, ['#c8b090', '#8a7058', '#ff3df0'], { speed: 110, up: 80, life: 0.45 });
                }
            } else if (h.mode === 'rest') {
                h.timer -= dt;
                if (h.timer <= 0) {
                    h.mode = 'idle';
                    if (this.activeHand === h) {
                        this.activeHand = null;
                        this.timer = 0.12;
                    }
                }
            }
        }
    }

    renderTails(ctx) {
        const count = this.phase === 1 ? 6 : 9;
        const segs = 10;
        const outline = [];
        const fill = [];
        for (let i = 0; i < count; i++) {
            const base = -Math.PI + (Math.PI * (i + 0.5)) / count;
            let px = this.x;
            let py = this.y + 4;
            for (let j = 0; j < segs; j++) {
                const wave = Math.sin(this.t * 2.6 + i * 0.9 + j * 0.45) * 0.32 * (j / segs);
                const a = base + wave;
                px += Math.cos(a) * 6;
                py += Math.sin(a) * 6;
                const size = Math.max(3, Math.round(10 - j * 0.7));
                const color = j >= segs - 1 ? '#ffd0f5' : j >= segs - 3 ? (this.phase === 2 ? '#ff5a5a' : '#c03aa0') : (j % 2 ? '#4a2470' : '#5b2a86');
                outline.push([px, py, size]);
                fill.push([px, py, size, color]);
            }
        }
        ctx.fillStyle = '#120a18';
        for (const [x, y, s] of outline) ctx.fillRect(Math.round(x - s / 2) - 1, Math.round(y - s / 2) - 1, s + 2, s + 2);
        for (const [x, y, s, c] of fill) {
            ctx.fillStyle = c;
            ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
        }
    }

    renderShadow(ctx) {
        if (this.dead) return;
        const h = GROUND_Y - this.y;
        const w = Math.max(16, Math.round(60 - h / 5));
        ctx.fillStyle = 'rgba(20,8,24,0.5)';
        ctx.fillRect(Math.round(this.x - w / 2), GROUND_Y - 1, w, 3);
        ctx.fillRect(Math.round(this.x - w / 2) + 3, GROUND_Y - 2, w - 6, 1);
        if (this.state === 'slam' && this.sub !== 'fall') {
            const on = Math.floor(this.t * 12) % 2;
            ctx.fillStyle = on ? '#ff3df0' : '#7c1631';
            ctx.fillRect(Math.round(this.x - 30), GROUND_Y - 2, 60, 2);
        }
        for (const hand of this.hands) {
            if (hand.mode === 'aim') {
                const on = Math.floor(this.t * 14) % 2;
                ctx.fillStyle = on ? '#ff3df0' : '#7c1631';
                ctx.fillRect(Math.round(hand.x - 12), GROUND_Y - 2, 24, 2);
            }
        }
    }

    render(ctx) {
        if (this.dead) return;
        const s = this.sprites;
        ctx.save();
        if (this.state === 'intro') ctx.globalAlpha = this.introAlpha;

        this.renderTails(ctx);

        // Blight flame "mane" from the portal sheet
        if (this.portal) {
            const f = Math.floor(this.t * 12) % 10;
            ctx.drawImage(this.portal, f * 64, 0, 64, 64, Math.round(this.x - 54), Math.round(this.y - 70), 64, 64);
            ctx.drawImage(this.portal, ((f + 5) % 10) * 64, 0, 64, 64, Math.round(this.x - 10), Math.round(this.y - 70), 64, 64);
        }

        const flashing = this.flash > 0;
        const blink = this.charge && Math.floor(this.t * 16) % 2 === 0;
        let maskImg = this.phase === 1 ? (blink ? s.maskCharge : s.mask) : (blink ? s.crackedCharge : s.cracked);
        if (flashing) maskImg = s.maskFlash;
        const tilt = this.state === 'stunned' ? Math.round(Math.sin(this.t * 6) * 2) : 0;
        ctx.drawImage(maskImg, Math.round(this.x - MASK_W / 2) + tilt, Math.round(this.y - 38));

        // Dizzy stars while stunned
        if (this.state === 'stunned') {
            for (let i = 0; i < 3; i++) {
                const a = this.t * 4 + (i * Math.PI * 2) / 3;
                const sx = Math.round(this.x + Math.cos(a) * 26);
                const sy = Math.round(this.y - 44 + Math.sin(a) * 5);
                ctx.fillStyle = '#fff27a';
                ctx.fillRect(sx - 1, sy, 3, 1);
                ctx.fillRect(sx, sy - 1, 1, 3);
            }
        }
        ctx.restore();

        if (this.state === 'intro' && this.introAlpha < 1) return;
        for (const h of this.hands) {
            const img = flashing ? s.handFlash : (h.mode === 'aim' && Math.floor(this.t * 14) % 2 === 0) ? s.handWarn : s.hand;
            ctx.save();
            ctx.translate(Math.round(h.x), Math.round(h.y));
            const strikeDown = h.mode === 'aim' || h.mode === 'strike' || h.mode === 'rest';
            if (strikeDown) ctx.rotate(Math.PI / 2);
            else ctx.scale(h.side, 1);
            ctx.drawImage(img, -15, -13);
            ctx.restore();
        }
    }
}
