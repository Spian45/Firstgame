// Player controller: run, double jump, i-frame dash, 3-hit combo, homing foxfire.
import { audio } from './audio.js';
import { CHARACTER } from './character.js';
import { ARENA_W, GROUND_Y } from './arena.js';

const FW = Math.round(CHARACTER.frameW * CHARACTER.scale);
const FH = Math.round(CHARACTER.frameH * CHARACTER.scale);
const AX = Math.round(CHARACTER.anchorX * CHARACTER.scale);
const AY = Math.round(CHARACTER.anchorY * CHARACTER.scale);

const FLIP_TIME = 0.32; // double-jump somersault duration
const HIGH_FALL = 90;   // px dropped from the highest point before it counts as a far fall
                        // (single jump ~60, stepping off a platform ~78, double jump to the ground ~100+)
const DODGE_WINDOW = 0.16;  // only the start of a dash protects: an attack landing in it = perfect dodge
const COUNTER_TIME = 1.5;   // after a perfect dodge, the next melee hit within this time deals bonus damage
export const COUNTER_MULT = 1.5;
const SLAM_STARTUP = 0.09; // hang in the air before the dive
const SLAM_SPEED = 620;     // dive speed (px/s)
export const SLAM_DAMAGE = 24;
const RECOVER_TIME = 0.34; // follow-through after the last attack before returning to idle

const COMBO = [
    { damage: 14, lunge: 70, duration: 0.22, frames: [0], reach: 34, shake: 1 },
    { damage: 18, lunge: 90, duration: 0.24, frames: [1], reach: 38, shake: 2 },
    { damage: 30, lunge: 140, duration: 0.34, frames: [2, 3], reach: 44, shake: 4 }
];

export class Player {
    constructor(x, sheets) {
        this.sheets = sheets;
        this.x = x;
        this.y = GROUND_Y;
        this.vx = 0;
        this.vy = 0;
        this.w = CHARACTER.bodyW;
        this.h = CHARACTER.bodyH;
        this.facing = 1;

        this.maxHealth = 100;
        this.health = 100;
        this.maxMana = 100;
        this.mana = 60;

        this.speed = 150;
        this.walkSpeed = 65;
        this.walking = false;
        this.landTimer = 0;
        this.landKind = 'soft'; // 'soft' (short drop) | 'far' (high fall) - picks the stand-up animation
        this.moveDir = 0;
        this.recoverTimer = 0;
        this.slamming = false;
        this.slamStartup = 0;
        this.dodgeTimer = 0;      // perfect-dodge window left on the current dash
        this.counterTimer = 0;    // counter-attack bonus left after a perfect dodge
        this.perfectDodged = false; // set on a perfect dodge, consumed by the game (slow-mo, flash)
        this.slamLanded = false; // set on ground impact, consumed by the game for screen shake
        this.apexY = GROUND_Y; // highest point (smallest y) of the current airtime
        this.flipTimer = 0;
        this.gravity = 900;
        this.jumpForce = -330;
        this.jumpsLeft = 2;
        this.grounded = true;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.dropThrough = 0;

        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.invuln = 0;
        this.hurtTimer = 0;

        this.attackTimer = 0;
        this.comboStep = 0;
        this.comboWindow = 0;
        this.attackHit = false;
        this.queuedAttack = false;

        this.state = 'idle';
        this.animTime = 0;
        this.afterTimer = 0;
        this.dead = false;
        this.hitsLanded = 0;

        // Set from the difficulty when a fight starts
        this.damageTaken = 1;   // multiplier on incoming damage
        this.regen = 0;         // health per second once out of danger
        this.regenDelay = 4;    // seconds without being hit before regen starts
        this.sinceHit = 0;
        this.lastDamage = 0;
        this.minX = 10; // left wall; lowered while she walks in from off-screen
    }

    get regenerating() {
        return this.regen > 0 && !this.dead && this.sinceHit >= this.regenDelay && this.health < this.maxHealth;
    }

    get hitbox() {
        return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
    }

    // Active melee hitbox for this frame, or null
    get attackBox() {
        if (this.attackTimer <= 0 || this.attackHit) return null;
        const c = COMBO[this.comboStep];
        const elapsed = c.duration - this.attackTimer;
        if (elapsed < 0.04 || elapsed > c.duration * 0.75) return null;
        const x = this.facing > 0 ? this.x : this.x - c.reach;
        return { x, y: this.y - 44, w: c.reach, h: 40, damage: c.damage, finisher: this.comboStep === 2, shake: c.shake };
    }

    // Active slam hitbox (under her feet while diving), or null
    get slamBox() {
        if (!this.slamming || this.slamStartup > 0) return null;
        return { x: this.x - 13, y: this.y - 26, w: 26, h: 32 };
    }

    takeDamage(amount, knockX, fx) {
        if (this.dead || this.god) return false;
        if (this.dodgeTimer > 0) {
            this.perfectDodge(fx);
            return false;
        }
        if (this.invuln > 0) return false;
        amount = Math.max(1, Math.round(amount * this.damageTaken));
        this.lastDamage = amount;
        this.sinceHit = 0;
        this.health = Math.max(0, this.health - amount);
        this.invuln = 0.9;
        this.hurtTimer = 0.28;
        this.attackTimer = 0;
        this.slamming = false;
        this.dashTimer = 0;
        this.vx = knockX;
        this.vy = -160;
        this.grounded = false;
        audio.playHit(false);
        if (fx) {
            fx.number(this.x, this.y - 54, amount, '#ff5a5a');
            fx.burst(this.x, this.y - 24, 10, ['#ff5a5a', '#ffffff', '#b8202e']);
        }
        if (this.health <= 0) {
            this.dead = true;
            this.state = 'dead';
            this.animTime = 0;
        }
        return true;
    }

    update(dt, input, arena, fx, projectiles, makeFoxfire) {
        if (this.dead) {
            this.animTime += dt;
            this.vy += this.gravity * dt;
            this.y = Math.min(GROUND_Y, this.y + this.vy * dt);
            this.vx *= 0.9;
            this.x += this.vx * dt;
            return;
        }

        this.invuln = Math.max(0, this.invuln - dt);
        this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
        this.counterTimer = Math.max(0, this.counterTimer - dt);
        this.dashCooldown = Math.max(0, this.dashCooldown - dt);
        this.comboWindow = Math.max(0, this.comboWindow - dt);
        this.coyote = Math.max(0, this.coyote - dt);
        this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
        this.dropThrough = Math.max(0, this.dropThrough - dt);
        this.mana = Math.min(this.maxMana, this.mana + 4 * dt);
        this.sinceHit += dt;
        if (this.regenerating) this.health = Math.min(this.maxHealth, this.health + this.regen * dt);

        if (input.jump) this.jumpBuffer = 0.12;
        if (this.flipTimer > 0) {
            this.flipTimer = Math.max(0, this.flipTimer - dt);
            fx.embers(this.x, this.y - 22, 1, ['#9ee7ff', '#38bdf8', '#ffffff'], 8);
        }
        if (input.attack) this.queuedAttack = true;

        if (input.slam && !this.grounded && !this.slamming && this.hurtTimer <= 0 && this.dashTimer <= 0) {
            this.startSlam(fx);
        }
        if (this.hurtTimer > 0 || this.dashTimer > 0 || this.attackTimer > 0 || this.grounded) this.flipTimer = 0;

        if (this.hurtTimer > 0) {
            this.hurtTimer -= dt;
            this.vx *= 0.92;
        } else if (this.slamming) {
            this.vx = 0;
            if (this.slamStartup > 0) {
                this.slamStartup -= dt;
                this.vy = 0;
            } else {
                this.vy = SLAM_SPEED;
                fx.embers(this.x, this.y - 30, 2, ['#9ee7ff', '#38bdf8', '#ffffff'], 6);
            }
        } else if (this.dashTimer > 0) {
            this.dashTimer -= dt;
            this.vx = this.facing * 340;
            this.vy = 0;
            this.afterTimer -= dt;
            if (this.afterTimer <= 0) {
                this.afterTimer = 0.035;
                const f = this.currentFrame();
                fx.afterimage(f.img, f.sx, 0, FW, FH, this.x - this.facing * (f.ax - FW / 2), this.y + (FH - AY), this.facing, 0.45);
            }
        } else if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            this.vx *= 0.82;
            if (this.attackTimer <= 0) {
                this.comboWindow = 0.3;
                if (CHARACTER.poses.recover) this.recoverTimer = RECOVER_TIME;
            }
        } else {
            let dir = 0;
            if (input.left) dir -= 1;
            if (input.right) dir += 1;
            this.walking = dir !== 0 && input.walk;
            this.moveDir = dir;
            if (dir !== 0) {
                this.recoverTimer = 0;
                this.landTimer = 0;
            }
            if (dir !== 0) {
                this.facing = dir;
                this.vx = dir * (this.walking ? this.walkSpeed : this.speed);
            } else {
                this.vx *= 0.6;
                if (Math.abs(this.vx) < 5) this.vx = 0;
            }

            if (this.jumpBuffer > 0) {
                if (input.down && this.grounded && this.onPlatform) {
                    this.dropThrough = 0.25;
                    this.grounded = false;
                    this.jumpBuffer = 0;
                } else if (this.grounded || this.coyote > 0 || this.jumpsLeft > 0) {
                    const firstJump = this.grounded || this.coyote > 0;
                    if (firstJump) this.jumpsLeft = 1;
                    else this.jumpsLeft--;
                    this.vy = firstJump ? this.jumpForce : this.jumpForce * 0.9;
                    this.grounded = false;
                    this.coyote = 0;
                    this.jumpBuffer = 0;
                    audio.playJump();
                    if (firstJump) {
                        fx.burst(this.x, this.y - 2, 6, ['#e8d8b0', '#b89870'], { speed: 60, gravity: 60, life: 0.3, size: 1 });
                    } else {
                        // Double jump: kick off a foxfire burst and somersault
                        this.flipTimer = FLIP_TIME;
                        this.apexY = this.y;
                        audio.playChime(1046, 0.25);
                        fx.ring(this.x, this.y - 2, '#9ee7ff', 18, 0.3);
                        fx.burst(this.x, this.y - 2, 14, ['#9ee7ff', '#38bdf8', '#ffffff'], { speed: 110, gravity: 260, life: 0.35, size: 1 });
                    }
                }
            }

            // Variable jump height
            if (!input.jumpHeld && this.vy < -120) this.vy = -120;

            if (input.dash && this.dashCooldown <= 0) {
                if (dir !== 0) this.facing = dir;
                this.dashTimer = 0.18;
                this.dashCooldown = 0.5;
                this.dodgeTimer = DODGE_WINDOW;
                this.queuedAttack = false;
                audio.playDash();
                fx.burst(this.x, this.y - 20, 8, ['#9ee7ff', '#ffffff'], { speed: 80, gravity: 0, life: 0.25, size: 1 });
            } else if (this.queuedAttack) {
                this.startAttack();
            } else if (input.skill && this.mana >= 25) {
                this.mana -= 25;
                audio.playFoxfire();
                for (let i = -1; i <= 1; i++) {
                    const ang = (this.facing > 0 ? 0 : Math.PI) + i * 0.45;
                    projectiles.push(makeFoxfire(this.x + this.facing * 12, this.y - 30, Math.cos(ang) * 200, Math.sin(ang) * 140 - 40));
                }
                fx.burst(this.x + this.facing * 12, this.y - 30, 10, ['#9ee7ff', '#38bdf8', '#ffffff'], { speed: 90, gravity: 0, life: 0.3 });
            }
        }
        this.queuedAttack = this.queuedAttack && this.attackTimer > 0;

        if (this.dashTimer <= 0 && !this.slamming) {
            this.vy = Math.min(this.vy + this.gravity * dt, 520);
        }

        const prevY = this.y;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.x = Math.max(this.minX, Math.min(ARENA_W - 10, this.x));

        // Ground and one-way platforms
        const wasGrounded = this.grounded;
        const fallSpeed = this.vy;
        this.grounded = false;
        this.onPlatform = false;
        if (this.y >= GROUND_Y) {
            this.y = GROUND_Y;
            this.vy = 0;
            this.grounded = true;
        } else if (this.vy >= 0 && this.dropThrough <= 0) {
            for (const s of arena.surfaces) {
                if (this.x > s.x && this.x < s.x + s.w && prevY <= s.y + 1 && this.y >= s.y) {
                    this.y = s.y;
                    this.vy = 0;
                    this.grounded = true;
                    this.onPlatform = true;
                    break;
                }
            }
        }
        if (this.grounded) {
            this.jumpsLeft = 1;
            if (!wasGrounded) this.land(this.y - this.apexY, fallSpeed, fx);
            this.apexY = this.y;
        } else {
            if (wasGrounded) this.apexY = Math.min(this.y, prevY);
            this.apexY = Math.min(this.apexY, this.y);
        }
        if (!this.grounded && wasGrounded && this.vy >= 0) {
            this.coyote = 0.08;
        }

        // State for animation
        const prevState = this.state;
        if (this.hurtTimer > 0) this.state = 'hurt';
        else if (this.slamming) this.state = 'slam';
        else if (this.dashTimer > 0) this.state = 'dash';
        else if (this.attackTimer > 0) this.state = 'attack';
        else if (!this.grounded && this.flipTimer > 0) this.state = 'flip';
        else if (!this.grounded && this.vy < 0) this.state = 'jump';
        else if (!this.grounded) this.state = this.y - this.apexY > HIGH_FALL ? 'fall' : 'drop';
        else if (this.recoverTimer > 0) this.state = 'recover';
        else if (this.landTimer > 0) this.state = 'land';
        else if (Math.abs(this.vx) > 10) this.state = this.walking ? 'walk' : 'run';
        else this.state = 'idle';
        this.landTimer = Math.max(0, this.landTimer - dt);
        this.recoverTimer = Math.max(0, this.recoverTimer - dt);
        if (!this.grounded || this.dashTimer > 0 || this.hurtTimer > 0) {
            this.recoverTimer = 0;
            this.landTimer = 0;
        }
        if (prevState !== this.state) this.animTime = 0;
        this.animTime += dt;
    }

    // Touchdown: a hard landing after a high fall (deep crouch, thud, big dust) or a soft step.
    // Either way she stands back up with an animation that plays until the player acts.
    land(dropped, fallSpeed, fx) {
        const dust = ['#c8b090', '#8a7058', '#e8d8b0'];
        const slam = this.slamming;
        const far = slam || dropped > HIGH_FALL;
        if (slam) {
            this.slamming = false;
            this.slamLanded = true;
            audio.slamImpact();
            fx.burst(this.x - 8, this.y - 1, 14, dust, { speed: 170, gravity: 380, life: 0.5, up: 70 });
            fx.burst(this.x + 8, this.y - 1, 14, dust, { speed: 170, gravity: 380, life: 0.5, up: 70 });
            fx.burst(this.x, this.y - 4, 10, ['#9ee7ff', '#38bdf8', '#ffffff'], { speed: 140, gravity: 200, life: 0.35 });
            fx.ring(this.x, this.y - 2, '#9ee7ff', 26, 0.3);
            fx.ring(this.x, this.y - 2, '#e8d8b0', 18, 0.22);
        } else if (far) {
            audio.landHeavy();
            fx.burst(this.x - 6, this.y - 1, 9, dust, { speed: 110, gravity: 320, life: 0.45, up: 50 });
            fx.burst(this.x + 6, this.y - 1, 9, dust, { speed: 110, gravity: 320, life: 0.45, up: 50 });
            fx.ring(this.x, this.y - 2, '#e8d8b0', 16, 0.22);
        } else if (dropped > 6 || fallSpeed > 120) {
            audio.landSoft();
            fx.burst(this.x, this.y - 1, 5, dust, { speed: 45, gravity: 120, life: 0.28, size: 1 });
        } else {
            return; // tiny step, no landing
        }
        const p = far ? CHARACTER.poses.land : (CHARACTER.poses.landSoft || CHARACTER.poses.land);
        if (!p || this.moveDir) return; // landing while holding a direction: keep running
        this.landKind = far ? 'far' : 'soft';
        // play the whole stand-up once (frame list / range length at its fps), single frames briefly
        const frames = Array.isArray(p) ? 1 : (p.frames ? p.frames.length : p.to - p.from + 1);
        this.landTimer = Array.isArray(p) ? 0.15 : frames / p.fps;
        this.animTime = 0;
    }

    // Dashed through an attack at the right moment: pass through it, refill some mana, reset the
    // dash and earn a counter-attack bonus
    perfectDodge(fx) {
        this.dodgeTimer = 0;
        this.invuln = Math.max(this.invuln, 0.5);
        this.dashCooldown = 0;
        this.counterTimer = COUNTER_TIME;
        this.mana = Math.min(this.maxMana, this.mana + 20);
        this.perfectDodged = true;
        audio.perfectDodge();
        fx.ring(this.x, this.y - 24, '#9ee7ff', 30, 0.35);
        fx.ring(this.x, this.y - 24, '#ffffff', 18, 0.25);
        fx.burst(this.x, this.y - 24, 18, ['#9ee7ff', '#ffffff', '#38bdf8'], { speed: 150, gravity: 0, life: 0.4 });
        fx.number(this.x, this.y - 64, 'PERFECT!', '#9ee7ff', true);
    }

    startSlam(fx) {
        this.slamming = true;
        this.slamStartup = SLAM_STARTUP;
        this.attackTimer = 0;
        this.flipTimer = 0;
        this.recoverTimer = 0;
        this.landTimer = 0;
        this.queuedAttack = false;
        audio.slamDive();
        fx.burst(this.x, this.y - 30, 8, ['#9ee7ff', '#ffffff'], { speed: 70, gravity: 0, life: 0.25, size: 1 });
    }

    // Slam connected with the boss: bounce off its head with a somersault, double jump restored
    onSlamHit() {
        this.slamming = false;
        this.vy = -330;
        this.jumpsLeft = 1;
        this.invuln = Math.max(this.invuln, 0.3);
        this.flipTimer = FLIP_TIME;
        this.apexY = this.y;
    }

    startAttack() {
        this.queuedAttack = false;
        this.recoverTimer = 0;
        this.landTimer = 0;
        this.comboStep = this.comboWindow > 0 ? (this.comboStep + 1) % 3 : 0;
        const c = COMBO[this.comboStep];
        this.attackTimer = c.duration;
        this.attackHit = false;
        this.vx = this.facing * c.lunge;
        audio.playSlash(1 + this.comboStep * 0.18);
    }

    currentFrame() {
        const s = CHARACTER.sheets;
        const poses = CHARACTER.poses;
        // anchorX: per-sheet number or per-frame array; ax overrides it for a single pose entry
        const pick = (key, index, ax) => {
            const i = index % s[key].frames;
            const a = ax !== undefined ? ax : Array.isArray(s[key].anchorX) ? s[key].anchorX[i] : s[key].anchorX;
            return { img: this.sheets[key], sx: i * FW, ax: a !== undefined ? Math.round(a * CHARACTER.scale) : AX };
        };
        const loop = (key) => pick(key, Math.floor(this.animTime * (s[key].playFps || s[key].fps)));
        // [sheet, frame] | { sheet, from, to, fps, hold } | { sheet, frames: [...], fps, hold }
        // frames entries are frame numbers of `sheet`, or [otherSheet, frame, anchorX?] to borrow a pose
        const pose = (p) => {
            if (Array.isArray(p)) return pick(...p);
            const step = Math.floor(this.animTime * p.fps);
            const list = p.frames;
            const span = list ? list.length : p.to - p.from + 1;
            const i = p.hold ? Math.min(step, span - 1) : step % span;
            if (!list) return pick(p.sheet, p.from + i);
            return Array.isArray(list[i]) ? pick(...list[i]) : pick(p.sheet, list[i]);
        };
        switch (this.state) {
            case 'walk':
                return s.walk ? loop('walk') : loop('run');
            case 'run':
                return loop('run');
            case 'dash':
                return poses.dash ? pose(poses.dash) : loop('run');
            case 'attack': {
                const c = COMBO[this.comboStep];
                const t = 1 - this.attackTimer / c.duration;
                if (CHARACTER.attackFrames) {
                    const list = CHARACTER.attackFrames[this.comboStep];
                    return pick('attack', list[Math.min(list.length - 1, Math.floor(t * list.length))]);
                }
                return pose(poses.attack[c.frames[Math.min(c.frames.length - 1, Math.floor(t * c.frames.length))]]);
            }
            case 'slam':
                return pose(poses.slam || poses.jump);
            case 'flip':
                return pose(poses.flip || poses.jump);
            case 'jump':
                return pose(poses.jump);
            case 'hurt':
                return pose(poses.hurt);
            case 'land':
                return pose(this.landKind === 'far' ? poses.land : (poses.landSoft || poses.land));
            case 'recover':
                return pose(poses.recover);
            case 'dead':
                return pose(poses.death || poses.fall);
            case 'fall':
                return pose(poses.fall);
            case 'drop':
                return pose(poses.drop || poses.fall);
            default:
                return loop('idle');
        }
    }

    // Pixel sword arc for sheets without a painted-in slash (yellow, red, cyan finisher)
    renderSlash(ctx) {
        const c = COMBO[this.comboStep];
        const t = 1 - this.attackTimer / c.duration;
        if (t > 0.85) return;
        const colors = [['#fff27a', '#f0b84a'], ['#ffd0a0', '#ff5a5a'], ['#e0fbff', '#38bdf8']][this.comboStep];
        const r = c.reach * 0.62;
        const cx = 6;
        const cy = -30;
        const start = -1.25;
        const sweep = 2.5 * Math.min(1, t * 2.2);
        const steps = 14;
        for (let i = 0; i <= steps; i++) {
            const a = start + (sweep * i) / steps;
            const fade = i / steps;
            const px = Math.round(cx + Math.cos(a) * r);
            const py = Math.round(cy + Math.sin(a) * r);
            ctx.fillStyle = colors[1];
            ctx.fillRect(px - 1, py - 1, 3, 3);
            if (fade > 0.35) {
                ctx.fillStyle = colors[0];
                ctx.fillRect(px, py, 2, 2);
            }
        }
    }

    render(ctx) {
        const f = this.currentFrame();
        if (!f.img) return;
        // Hit flicker (not once dead: invuln stops counting down then, which would hide her for good)
        if (!this.dead && this.invuln > 0 && this.dashTimer <= 0 && Math.floor(this.invuln * 20) % 2 === 0) return;

        ctx.save();
        ctx.translate(Math.round(this.x), Math.round(this.y));
        ctx.scale(this.facing, 1);
        if (this.state === 'dead' && !CHARACTER.poses.death) {
            ctx.rotate(-Math.PI / 2);
            ctx.translate(-10, 6);
        } else if (this.state === 'flip') {
            // Forward somersault in 8 chunky 45-degree steps (smooth rotation smears pixel art)
            const t = 1 - this.flipTimer / FLIP_TIME;
            const angle = (Math.floor(t * 8) / 8) * Math.PI * 2;
            ctx.translate(0, -22);
            ctx.rotate(angle);
            ctx.translate(0, 22);
        }
        ctx.drawImage(f.img, f.sx, 0, FW, FH, -f.ax, -AY, FW, FH);
        if (CHARACTER.slashFx && this.state === 'attack') this.renderSlash(ctx);
        ctx.restore();
        if (this.state === 'slam') this.renderSlamFx(ctx);
        if (this.counterTimer > 0 && Math.floor(this.counterTimer * 12) % 2 === 0) {
            ctx.fillStyle = '#9ee7ff';
            const x = Math.round(this.x);
            const y = Math.round(this.y);
            ctx.fillRect(x - 12, y - 50, 2, 2);
            ctx.fillRect(x + 11, y - 30, 2, 2);
            ctx.fillRect(x - 9, y - 14, 2, 2);
        }
    }

    // Cyan speed lines streaming above her and a chevron under her feet while diving
    renderSlamFx(ctx) {
        const x = Math.round(this.x);
        const y = Math.round(this.y);
        if (this.slamStartup > 0) {
            ctx.fillStyle = '#e0fbff';
            ctx.fillRect(x - 1, y - 72, 2, 4); // wind-up glint
            return;
        }
        const flick = Math.floor(performance.now() / 40) % 3;
        const lines = [[-9, 18], [-3, 30], [4, 24], [10, 14]];
        lines.forEach(([dx, len], i) => {
            const l = len - ((i + flick) % 3) * 4;
            ctx.fillStyle = i % 2 ? '#38bdf8' : '#9ee7ff';
            ctx.fillRect(x + dx, y - 64 - l, 2, l);
        });
        ctx.fillStyle = '#e0fbff';
        for (let i = 0; i < 6; i++) {
            ctx.fillRect(x - 7 + i, y + 1 + Math.floor(i / 2), 2, 2);
            ctx.fillRect(x + 6 - i, y + 1 + Math.floor(i / 2), 2, 2);
        }
    }

    renderShadow(ctx) {
        const h = Math.max(0, GROUND_Y - this.y);
        if (h > 70) return;
        const w = Math.max(6, 18 - h / 8);
        ctx.fillStyle = 'rgba(20,8,24,0.45)';
        ctx.fillRect(Math.round(this.x - w / 2), GROUND_Y - 1, Math.round(w), 2);
    }
}
