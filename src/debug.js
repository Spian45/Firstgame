// Debug mode (toggle with F3 or `): hitboxes, live state readout and cheat keys.
import { drawText } from './font.js';
import { VIEW_W, ARENA_W, GROUND_Y } from './arena.js';

const ATTACK_KEYS = {
    Digit1: 'orbs',
    Digit2: 'slam',
    Digit3: 'claws',
    Digit4: 'sweep',
    Digit5: 'pillars'
};

const HELP = [
    'G  GOD MODE',
    'F  FREEZE BOSS AI',
    'T  SLOW MOTION',
    'H  HITBOXES',
    '1-5  FORCE ATTACK',
    '6  SKIP TO PHASE 2',
    '9  KILL BOSS',
    '0  REFILL HP / MP'
];

export class Debug {
    constructor() {
        this.enabled = false;
        this.god = false;
        this.freezeBoss = false;
        this.slowmo = false;
        this.hitboxes = true;
        this.fps = 60;
        this.message = '';
        this.messageTimer = 0;
    }

    // Time multiplier applied to the simulation
    get timeScale() {
        return this.enabled && this.slowmo ? 0.25 : 1;
    }

    note(text) {
        this.message = text;
        this.messageTimer = 1.6;
    }

    trackFps(rawDt) {
        if (rawDt > 0) this.fps += (1 / rawDt - this.fps) * 0.05;
        this.messageTimer = Math.max(0, this.messageTimer - rawDt);
    }

    handleInput(input, game) {
        if (input.debugToggle) {
            this.enabled = !this.enabled;
            this.note(this.enabled ? 'DEBUG ON' : 'DEBUG OFF');
        }
        if (!this.enabled) {
            game.player.god = false;
            return;
        }
        if (game.state === 'title') return;

        const boss = game.boss;
        const pressed = (code) => input.isPressed(code);

        if (pressed('KeyG')) { this.god = !this.god; this.note(`GOD MODE ${this.god ? 'ON' : 'OFF'}`); }
        if (pressed('KeyF')) { this.freezeBoss = !this.freezeBoss; this.note(`BOSS AI ${this.freezeBoss ? 'FROZEN' : 'RUNNING'}`); }
        if (pressed('KeyT')) { this.slowmo = !this.slowmo; this.note(`SLOW MOTION ${this.slowmo ? 'ON' : 'OFF'}`); }
        if (pressed('KeyH')) { this.hitboxes = !this.hitboxes; this.note(`HITBOXES ${this.hitboxes ? 'ON' : 'OFF'}`); }

        const busy = !boss.targetable && boss.state !== 'intro';
        for (const [code, attack] of Object.entries(ATTACK_KEYS)) {
            if (!pressed(code)) continue;
            if (busy || (attack === 'pillars' && boss.phase === 1)) {
                this.note(attack === 'pillars' ? 'PILLARS ARE PHASE 2 ONLY' : 'BOSS IS BUSY');
                continue;
            }
            boss.introAlpha = 1;
            boss.nextAttack(attack);
            this.note(`FORCED ${attack.toUpperCase()}`);
        }

        if (pressed('Digit6') && boss.phase === 1 && !busy) {
            boss.introAlpha = 1;
            boss.health = Math.floor(boss.maxHealth * 0.5);
            boss.enterPhase2(game);
        }
        if (pressed('Digit9') && !boss.dead && boss.state !== 'dying') {
            if (boss.state === 'intro' || boss.state === 'phase') { boss.introAlpha = 1; boss.state = 'hover'; }
            if (boss.phase === 1) boss.phase = 2; // skip the phase-change cutscene
            boss.health = 1;
            boss.takeDamage(1, game, false);
            this.note('BOSS KILLED');
        }
        if (pressed('Digit0')) {
            game.player.health = game.player.maxHealth;
            game.player.mana = game.player.maxMana;
            this.note('REFILLED');
        }

        game.player.god = this.god;
    }

    renderWorld(ctx, game) {
        if (!this.enabled || !this.hitboxes) return;
        const box = (b, color) => {
            if (!b) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.strokeRect(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5, Math.round(b.w) - 1, Math.round(b.h) - 1);
        };

        // Standable surfaces
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(0, GROUND_Y, ARENA_W, 1);
        for (const s of game.arena.surfaces) ctx.fillRect(Math.round(s.x), s.y, s.w, 1);

        const p = game.player;
        box(p.hitbox, this.god ? '#fde047' : '#4ade80');
        box(p.attackBox, '#facc15');
        box(p.slamBox, '#22d3ee');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 2);

        const b = game.boss;
        if (!b.dead) {
            box(b.hurtbox, b.targetable ? '#f87171' : '#64748b');
            for (const h of b.hands) {
                box(b.handHitbox(h), '#fb923c');
                ctx.fillStyle = '#fb923c';
                ctx.fillRect(Math.round(h.x), Math.round(h.y), 1, 1);
            }
            drawText(ctx, `${b.state}${b.sub ? ':' + b.sub : ''}`, b.x, b.y - 52, { color: '#f87171', align: 'center', outline: true });
        }

        for (const s of game.shots) box(s.hitbox, '#38bdf8');
        for (const s of game.enemyShots) box(s.hitbox, '#e879f9');
    }

    renderOverlay(ctx, game) {
        if (this.messageTimer > 0) {
            drawText(ctx, this.message, VIEW_W / 2, 64, { color: '#fde047', align: 'center', outline: true });
        }
        if (!this.enabled || game.state !== 'fight') return;

        const p = game.player;
        const b = game.boss;
        const lines = [
            `FPS ${Math.round(this.fps)}`,
            `STATE ${game.state.toUpperCase()}${game.paused ? ' (PAUSED)' : ''}`,
            `TIME ${game.elapsed.toFixed(1)}S`,
            '',
            `PLAYER ${p.state.toUpperCase()}`,
            `POS ${Math.round(p.x)},${Math.round(p.y)}`,
            `VEL ${Math.round(p.vx)},${Math.round(p.vy)}`,
            `HP ${Math.ceil(p.health)}  MP ${Math.floor(p.mana)}`,
            `IFRAMES ${p.invuln.toFixed(2)}`,
            '',
            `BOSS ${b.state.toUpperCase()}${b.sub ? ':' + b.sub.toUpperCase() : ''}`,
            `HP ${b.health}/${b.maxHealth}  PH ${b.phase}`,
            `TIMER ${Math.max(0, b.timer).toFixed(2)}`,
            `SHOTS ${game.shots.length}/${game.enemyShots.length}`,
            `PARTICLES ${game.fx.particles.length}`
        ];
        const flags = [this.god && 'GOD', this.freezeBoss && 'FROZEN', this.slowmo && 'SLOW'].filter(Boolean);

        const x = VIEW_W - 150;
        const y = 44;
        const h = (lines.length + HELP.length + 3) * 9 + 8;
        ctx.fillStyle = 'rgba(10,6,16,0.78)';
        ctx.fillRect(x, y, 142, h);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(x, y, 142, 1);
        drawText(ctx, 'DEBUG', x + 5, y + 4, { color: '#fde047', shadow: null });
        if (flags.length) drawText(ctx, flags.join(' '), x + 137, y + 4, { color: '#f87171', align: 'right', shadow: null });
        lines.forEach((line, i) => drawText(ctx, line, x + 5, y + 16 + i * 9, { color: '#e2e8f0', shadow: null }));
        const hy = y + 16 + (lines.length + 1) * 9;
        HELP.forEach((line, i) => drawText(ctx, line, x + 5, hy + i * 9, { color: '#94a3b8', shadow: null }));
    }
}
