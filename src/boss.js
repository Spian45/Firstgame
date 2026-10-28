// LORD KAGETORA - the Blighted Kitsune Mask.
// A floating corrupted fox mask with spectral claws and shadow tails. Two phases.
import { audio } from './audio.js';
import { PixelGrid } from './pixelart.js';
import { ARENA_W, GROUND_Y } from './arena.js';
import { BlightOrb, Shockwave, Pillar, Meteor, overlap } from './projectiles.js';
import { DIFFICULTIES } from './difficulty.js';

const PALETTE = {
    K: '#1a0f1f', W: '#f2ebe0', w: '#c8bdb8', s: '#8d7f8f',
    R: '#d0283e', r: '#7c1631', G: '#f0b84a', g: '#9a6a28',
    E: '#ff3df0', e: '#ffffff', p: '#6b2fa0', P: '#2b1640'
};

const MASK_W = 72;
const MASK_H = 68;

// Top of the first floor at or below y at column x: a one-way platform or the ground
function surfaceBelow(arena, x, y) {
    let best = GROUND_Y;
    for (const s of arena.surfaces) {
        if (x > s.x && x < s.x + s.w && s.y >= y && s.y < best) best = s.y;
    }
    return best;
}

// Intro: the ground cracks, claws burst out, the mask rises from the rift and roars, then the fight starts
const INTRO_X = 500;
const INTRO_TIME = 4.2;
const INTRO_ROAR = 2.8;
const DIRT = ['#c8b090', '#8a7058', '#5a4636'];

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
    constructor(portalImg, difficulty = 'normal') {
        this.sprites = buildSprites();
        this.portal = portalImg;
        this.name = 'LORD KAGETORA';
        this.title = 'THE BLIGHTED MASK';

        const diff = DIFFICULTIES[difficulty];
        this.pace = diff.pace;           // scales the rest between attacks
        this.hardMoves = diff.hardMoves; // blight rain, spiral and claw clap join the rotation
        this.maxHealth = Math.round(640 * diff.bossHp);
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;
        this.phase = 1;

        this.x = INTRO_X;
        this.y = GROUND_Y + 70; // buried: rises out of the ground during the intro
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
        this.introAlpha = 1;
        this.introT = 0;
        this.introDone = {};
        this.crackW = 0; // width of the rift in the ground (closes after the intro)
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
        const oneHit = game.debug.enabled && game.debug.oneHit ? 50 : 1;
        const dmg = Math.round(amount * (stunned ? 1.5 : 1) * oneHit);
        this.health = Math.max(0, this.health - dmg);
        game.debug.log(`BOSS -${dmg}${stunned ? ' STUN' : ''}`, '#f87171');
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
            case 'rain': this.updateRain(dt, game); break;
            case 'spiral': this.updateSpiral(dt, game); break;
            case 'clap': this.updateClap(dt, game); break;
            case 'phase': this.updatePhase(dt, game); break;
            case 'dying': this.updateDying(dt, game); break;
        }

        this.updateHands(dt, game);
        if (this.state !== 'intro') this.crackW = Math.max(0, this.crackW - dt * 25);

        // Ambient blight embers
        if (!this.dead && this.y < GROUND_Y && Math.random() < 0.5) {
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
        return h.mode === 'strike' || h.mode === 'clap' ? { x: h.x - 12, y: h.y - 12, w: 24, h: 24 } : null;
    }

    nextAttack(forced = null) {
        const pool = this.phase === 1
            ? ['orbs', 'slam', 'claws', 'sweep', 'orbs']
            : ['orbs', 'slam', 'claws', 'sweep', 'pillars', 'pillars'];
        if (this.hardMoves) pool.push('rain', 'clap', ...(this.phase === 2 ? ['spiral', 'spiral'] : ['spiral']));
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
            case 'orbs': this.timer = 0.55; this.volleys = (this.phase === 1 ? 1 : 2) + (this.hardMoves ? 1 : 0); audio.bossCharge(0.55); break;
            case 'slam': this.timer = 0.75; audio.bossRise(); break;
            case 'claws': this.clawStrikes = this.phase === 1 ? 2 : 4; this.timer = 0.2; break;
            case 'sweep':
                this.sweepPasses = this.phase === 1 ? 1 : 2;
                this.sweepFrom = this.x < ARENA_W / 2 ? -1 : 1;
                this.timer = 0.75;
                break;
            case 'pillars': this.timer = 0.5; audio.bossCharge(0.5); break;
            case 'rain': this.timer = 0.7; audio.bossRise(); break;
            case 'spiral': this.timer = 0.6; this.spinAngle = 0; this.spinShot = 0; audio.bossCharge(0.6); break;
            case 'clap': this.timer = 0.15; this.claps = this.phase === 1 ? 1 : 2; break;
        }
    }

    toHover(time) {
        this.state = 'hover';
        this.sub = '';
        this.charge = false;
        this.timer = time !== undefined ? time : (this.phase === 1 ? 1.1 : 0.7) * this.pace;
    }

    // Hard: Blight Rain. Rises high, then meteors rain across the arena in two sweeps; one always
    // targets Ren and the rest leave gaps to dodge through
    updateRain(dt, game) {
        this.timer -= dt;
        if (this.sub === 'windup') {
            this.moveTo(ARENA_W / 2, 60, 3, dt);
            this.charge = true;
            if (this.timer <= 0) {
                this.charge = false;
                const p = game.player;
                const waves = this.phase === 1 ? 1 : 2;
                for (let w = 0; w < waves; w++) {
                    const gapX = 40 + Math.random() * (ARENA_W - 80); // a safe gap in each wave
                    for (let x = 24 + Math.random() * 30; x < ARENA_W - 16; x += 58) {
                        if (Math.abs(x - gapX) < 40) continue;
                        game.enemyShots.push(new Meteor(x, w * 1.1 + Math.random() * 0.5));
                    }
                    game.enemyShots.push(new Meteor(p.x, w * 1.1 + 0.25));
                }
                audio.bossOrbs();
                game.fx.ring(this.x, this.y, '#ff3df0', 40, 0.4);
                this.sub = 'recover';
                this.timer = this.phase === 1 ? 1.8 : 2.8;
            }
        } else {
            this.moveTo(ARENA_W / 2, 70 + Math.sin(this.t * 2) * 6, 2, dt);
            if (this.timer <= 0) this.toHover();
        }
    }

    // Hard: Spiral. Hovers in the middle and spins out arms of orbs (3 arms, 4 in phase 2)
    updateSpiral(dt, game) {
        this.moveTo(ARENA_W / 2, 130, 3, dt);
        this.timer -= dt;
        if (this.sub === 'windup') {
            this.charge = true;
            if (Math.random() < 0.6) game.fx.burst(this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 60, 1, ['#ff3df0'], { speed: 10, gravity: 0, life: 0.3 });
            if (this.timer <= 0) { this.sub = 'spin'; this.timer = 2.2; this.charge = false; }
        } else if (this.sub === 'spin') {
            const arms = this.phase === 1 ? 3 : 4;
            const dir = this.phase === 1 ? 1 : -1;
            this.spinAngle += dt * 1.9 * dir;
            this.spinShot -= dt;
            if (this.spinShot <= 0) {
                this.spinShot = 0.16;
                for (let i = 0; i < arms; i++) {
                    const a = this.spinAngle + (i / arms) * Math.PI * 2;
                    game.enemyShots.push(new BlightOrb(this.x, this.y + 4, Math.cos(a) * 105, Math.sin(a) * 105, 8));
                }
                audio.playChime(880 + Math.random() * 120, 0.05);
            }
            if (this.timer <= 0) { this.sub = 'recover'; this.timer = 0.5; }
        } else if (this.timer <= 0) {
            this.toHover();
        }
    }

    // Hard: Claw Clap. Both claws appear either side of Ren at body height, flash, then slam together;
    // jump over them or dash through at the right moment
    updateClap(dt, game) {
        this.moveTo(this.x, 110 + Math.sin(this.t * 2) * 6, 2, dt);
        const [l, r] = this.hands;
        if (this.sub === 'windup') {
            this.timer -= dt;
            if (this.timer > 0) return;
            if (this.claps <= 0) { this.toHover(); return; }
            this.clapX = Math.max(60, Math.min(ARENA_W - 60, game.player.x));
            this.clapY = Math.min(GROUND_Y, game.player.y) - 22; // at Ren's body height, on a platform too
            for (const h of this.hands) { h.mode = 'clapAim'; h.vy = 0; }
            this.sub = 'aim';
            this.timer = this.phase === 1 ? 0.6 : 0.45;
            audio.bossGrowl(0.4);
        } else if (this.sub === 'aim') {
            this.timer -= dt;
            const k = Math.min(1, dt * 10);
            for (const h of this.hands) {
                h.x += (this.clapX + h.side * 100 - h.x) * k;
                h.y += (this.clapY - h.y) * k;
            }
            if (this.timer <= 0) {
                this.sub = 'go';
                for (const h of this.hands) h.mode = 'clap';
                audio.clawSwipe();
            }
        } else if (this.sub === 'go') {
            for (const h of this.hands) h.x -= h.side * 560 * dt;
            if (r.x - l.x <= 16) {
                l.x = this.clapX - 8;
                r.x = this.clapX + 8;
                for (const h of this.hands) { h.mode = 'rest'; h.timer = 0.35; }
                game.shake(5, 0.2);
                audio.clawImpact();
                game.fx.burst(this.clapX, this.clapY, 16, ['#ff3df0', '#ffffff', '#8d2fd0'], { speed: 160, gravity: 0, life: 0.35 });
                game.fx.ring(this.clapX, this.clapY, '#ff3df0', 24, 0.25);
                this.claps--;
                this.sub = 'windup';
                this.timer = 0.55;
            }
        }
    }

    updateIntro(dt, game) {
        const t = (this.introT += dt);
        const once = (key, at) => t >= at && !this.introDone[key] && (this.introDone[key] = true);
        const fx = game.fx;

        // 1. Rumble: a glowing rift tears open in the ground, pebbles jump, the shaking builds
        if (once('rumble', 0.05)) audio.pillarRumble();
        if (t < 1.1) {
            this.crackW = (t / 1.1) * 50;
            game.shake(1 + t * 2, 0.08);
            if (Math.random() < t * 0.7) fx.burst(INTRO_X + (Math.random() - 0.5) * this.crackW, GROUND_Y - 2, 2, DIRT, { speed: 50, up: 90, gravity: 420, life: 0.5, size: 1 });
        } else {
            this.crackW = Math.min(80, 50 + (t - 1.1) * 40);
        }
        if (Math.random() < 0.8) fx.embers(INTRO_X + (Math.random() - 0.5) * this.crackW, GROUND_Y - 4, 2, ['#ff3df0', '#8d2fd0', '#1a0f1f'], 14);

        // the summoning tears the floating islands up out of the earth one by one: the ground cracks and
        // spits dust, the island bursts out with a thud and a spray of rock, then rises shedding pebbles
        const arena = game.arena;
        if (once('islands', 0.15)) arena.startRise();
        arena.platforms.forEach((p, i) => {
            const mid = p.x + p.w / 2;
            if (arena.rumble(i) > 0) {
                game.shake(1.5, 0.06);
                if (Math.random() < 0.5) fx.burst(p.x + p.w * (0.15 + Math.random() * 0.7), GROUND_Y - 3, 1, DIRT, { speed: 30, up: 90, gravity: 420, life: 0.4, size: 1 });
                if (Math.random() < 0.3) fx.embers(mid + (Math.random() - 0.5) * p.w * 0.6, GROUND_Y - 3, 1, ['#ff3df0', '#c050ff'], 10);
            }
            if (arena.riseProgress(i) > 0 && !this.introDone[`burst${i}`]) {
                this.introDone[`burst${i}`] = true;
                game.shake(4, 0.25);
                audio.bossThud();
                fx.burst(mid, GROUND_Y - 4, 26, DIRT, { speed: 170, up: 160, gravity: 420, life: 0.8 });
                fx.burst(mid, GROUND_Y - 4, 10, ['#5a4636', '#3a2c22'], { speed: 120, up: 200, gravity: 500, life: 1, size: 2 });
                fx.ring(mid, GROUND_Y - 4, '#c050ff', Math.round(p.w * 0.45), 0.35);
            }
            const u = arena.riseProgress(i);
            if (u > 0 && u < 0.85 && Math.random() < 0.6) {
                const bottom = p.y + arena.platformOffset(i) + 20 + p.depth;
                fx.burst(p.x + p.w * (0.2 + Math.random() * 0.6), bottom, 1, DIRT, { speed: 15, up: 0, gravity: 500, life: 0.7, size: 1 });
            }
        });

        // 2. The claws burst out first and grip the edges of the rift, prying it open
        if (once('hands', 1.1)) {
            for (const h of this.hands) {
                h.mode = 'intro';
                h.x = INTRO_X + h.side * 28;
                h.y = GROUND_Y + 24;
                h.vy = -380; // punches up about 45px, then slams down onto the lip
                fx.burst(h.x, GROUND_Y - 2, 16, DIRT, { speed: 140, up: 160, gravity: 420, life: 0.7 });
            }
            game.shake(5, 0.3);
            audio.pillarErupt();
        }
        for (const h of this.hands) {
            if (h.mode !== 'intro') continue;
            h.vy += 1500 * dt;
            h.y += h.vy * dt;
            if (h.vy > 0 && h.y >= GROUND_Y - 10) {
                if (h.vy > 150) audio.clawImpact();
                h.y = GROUND_Y - 10;
                h.vy = 0;
            }
            h.x += (INTRO_X + h.side * 48 - h.x) * Math.min(1, dt * 3);
        }

        // 3. The mask rises out of the rift, shedding dirt
        if (once('rise', 1.5)) audio.bossRise();
        if (t >= 1.5 && t < INTRO_ROAR) {
            const u = Math.min(1, (t - 1.5) / (INTRO_ROAR - 1.5));
            this.y = GROUND_Y + 70 - (1 - (1 - u) ** 3) * 110;
            game.shake(2, 0.08);
            if (Math.random() < 0.6) fx.burst(INTRO_X + (Math.random() - 0.5) * 50, GROUND_Y - 2, 2, DIRT, { speed: 70, up: 60, gravity: 420, life: 0.5, size: 1 });
        }

        // 4. Roar: eyes blaze, shockwave rings, its name appears, and it lifts into the air
        if (once('roar', INTRO_ROAR)) {
            this.charge = true;
            for (const h of this.hands) h.mode = 'idle';
            audio.bossRoar(1.4, 1);
            game.shake(7, 0.9);
            game.flashScreen('#ff3df0', 0.25);
            fx.ring(this.x, this.y - 10, '#ff3df0', 60, 0.5);
            fx.ring(this.x, this.y - 10, '#ffffff', 34, 0.35);
            fx.burst(this.x, this.y - 10, 30, ['#ff3df0', '#8d2fd0', '#ffffff'], { speed: 200, gravity: 0, life: 0.6 });
            game.hud.banner(this.name, this.title, 3.2);
            game.onBossRoar(); // the battle theme kicks in on the roar
        }
        if (t >= INTRO_ROAR) this.moveTo(INTRO_X, 150, 2.2, dt);
        if (t >= INTRO_ROAR + 0.6) this.charge = false;
        if (t >= INTRO_TIME) this.toHover(0.6);
    }

    // Jump the intro ahead to the roar (player pressed a confirm key)
    skipIntro() {
        if (this.state !== 'intro' || this.introT >= INTRO_ROAR) return;
        for (const key of ['rumble', 'hands', 'rise', 'islands']) this.introDone[key] = true;
        for (let i = 0; i < 12; i++) this.introDone[`burst${i}`] = true; // islands are put in place, no bursts
        this.introT = INTRO_ROAR;
        this.y = GROUND_Y - 40;
        this.crackW = 80;
        for (const h of this.hands) {
            h.mode = 'idle';
            h.x = INTRO_X + h.side * 48;
            h.y = GROUND_Y - 10;
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
                // hover above Ren at whatever height she is (a platform is no hiding place)
                const k = Math.min(1, dt * 8);
                h.x += (p.x - h.x) * k;
                h.y += (Math.min(GROUND_Y, p.y) - 120 - h.y) * k;
                h.landY = surfaceBelow(game.arena, h.x, h.y + 13);
                h.timer -= dt;
                if (h.timer <= 0) { h.mode = 'strike'; h.vy = 200; audio.clawSwipe(); }
            } else if (h.mode === 'strike') {
                h.vy += 2600 * dt;
                h.y += h.vy * dt;
                if (overlap(this.handHitbox(h), p.hitbox)) {
                    if (p.takeDamage(16, Math.sign(p.x - h.x || 1) * 180, game.fx)) game.onPlayerHit();
                }
                // slams into the first floor under it: a platform or the ground
                if (h.y >= h.landY - 12) {
                    h.y = h.landY - 12;
                    h.mode = 'rest';
                    h.timer = 0.3;
                    game.shake(3, 0.12);
                    audio.clawImpact();
                    game.fx.burst(h.x, h.landY - 2, 10, ['#c8b090', '#8a7058', '#ff3df0'], { speed: 110, up: 80, life: 0.45 });
                }
            } else if (h.mode === 'clap') {
                // moved by updateClap; hurts while the claws rush together
                if (overlap(this.handHitbox(h), p.hitbox)) {
                    if (p.takeDamage(16, h.side * -180, game.fx)) game.onPlayerHit();
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

    // The rift the boss rises from: a jagged dark tear across the grass with blight glowing inside and
    // light leaking up out of it. Drawn over the foreground grass so it reads.
    renderRift(ctx) {
        const w = Math.round(this.crackW);
        if (w < 2 || this.dead) return;
        const x0 = Math.round(INTRO_X - w / 2);
        const glow = Math.floor(this.t * 10) % 2;
        const top = GROUND_Y - 4;
        if (this.state === 'intro') {
            // thin flickering shafts of blight light leaking up through the tear
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 2; i < w - 2; i += 3) {
                const h = Math.round((6 + ((i * 13) % 17)) * (0.6 + 0.4 * Math.sin(this.t * 8 + i)));
                ctx.fillStyle = (i * 7) % 5 < 2 ? 'rgba(255,61,240,0.35)' : 'rgba(141,47,208,0.3)';
                ctx.fillRect(x0 + i, top - h, 1, h);
            }
            ctx.restore();
        }
        for (let i = 0; i < w; i++) {
            const edge = Math.min(i, w - 1 - i);
            const d = Math.min(Math.floor(edge / 2) + 1, 4 + ((i * 7) % 3));
            ctx.fillStyle = '#0a0510';
            ctx.fillRect(x0 + i, top + 2 - Math.floor(d / 2), 1, d + 2);
            if (d > 2 && (i + glow) % 2 === 0) {
                ctx.fillStyle = (i * 5) % 7 < 3 ? '#ff3df0' : '#8d2fd0';
                ctx.fillRect(x0 + i, top + 2, 1, 1 + (i % 2));
            }
        }
        // broken turf flung up along the lips of the rift
        ctx.fillStyle = '#5a4636';
        ctx.fillRect(x0 - 3, top, 3, 2);
        ctx.fillRect(x0 + w, top, 3, 2);
    }

    renderShadow(ctx) {
        if (this.dead) return;
        if (this.y > GROUND_Y - 30) return; // still in (or just out of) the ground
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
                // warning line on the floor the claw will hit
                const on = Math.floor(this.t * 14) % 2;
                ctx.fillStyle = on ? '#ff3df0' : '#7c1631';
                ctx.fillRect(Math.round(hand.x - 12), (hand.landY || GROUND_Y) - 2, 24, 2);
            }
        }
    }

    render(ctx) {
        if (this.dead) return;
        const s = this.sprites;
        ctx.save();
        // While emerging, only the part above the ground line shows
        const emerging = this.state === 'intro';
        if (emerging) {
            ctx.beginPath();
            ctx.rect(this.x - 200, GROUND_Y - 400, 400, 400);
            ctx.clip();
        }

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

        // Claws stay hidden until they burst out of the ground
        if (emerging && !this.introDone.hands) return;
        for (const h of this.hands) {
            const warning = h.mode === 'aim' || h.mode === 'clapAim';
            const img = flashing ? s.handFlash : (warning && Math.floor(this.t * 14) % 2 === 0) ? s.handWarn : s.hand;
            ctx.save();
            if (emerging) {
                ctx.beginPath();
                ctx.rect(h.x - 40, GROUND_Y - 400, 80, 400);
                ctx.clip();
            }
            ctx.translate(Math.round(h.x), Math.round(h.y));
            const strikeDown = h.mode === 'aim' || h.mode === 'strike' || h.mode === 'rest';
            if (strikeDown) ctx.rotate(Math.PI / 2);
            else if (h.mode === 'intro') ctx.rotate(-Math.PI / 2); // reaching up out of the rift
            else if (h.mode === 'clapAim' || h.mode === 'clap') ctx.scale(-h.side, 1); // claws facing each other
            else ctx.scale(h.side, 1);
            ctx.drawImage(img, -15, -13);
            ctx.restore();
        }
    }
}
