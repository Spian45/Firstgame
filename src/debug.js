// Debug mode (F3 or `). A mouse-driven panel on the right with four tabs (GAME, REN, BOSS, VIEW), plus
// hitbox / state overlays, an event log, a frame-time graph, time controls (speed, halt, single-step)
// and cheats. Every button can be clicked; most also have a key, shown on the button.
import { drawText, textWidth } from './font.js';
import { VIEW_W, ARENA_W, GROUND_Y } from './arena.js';
import { DIFFICULTIES } from './difficulty.js';

const SPEEDS = [0.1, 0.25, 0.5, 1, 2];
const TABS = ['GAME', 'REN', 'BOSS', 'VIEW'];
const PANEL_X = VIEW_W - 186;
const PANEL_Y = 40;
const PANEL_W = 182;
const BTN_W = 86;
const BTN_H = 12;
const LOG_SIZE = 7;

const C = {
    bg: 'rgba(10,6,16,0.86)',
    accent: '#fde047',
    text: '#e2e8f0',
    dim: '#94a3b8',
    btn: '#1e1b2e',
    btnHover: '#33304a',
    on: '#166534',
    onText: '#86efac',
    warn: '#f87171'
};

// Boss attacks the BOSS tab can force: [state, label, key, key code, phase-2 only]
const ATTACKS = [
    ['orbs', 'ORBS', '1', 'Digit1'],
    ['slam', 'SLAM', '2', 'Digit2'],
    ['claws', 'CLAWS', '3', 'Digit3'],
    ['sweep', 'SWEEP', '4', 'Digit4'],
    ['pillars', 'PILLARS', '5', 'Digit5', true],
    ['rain', 'RAIN', '7', 'Digit7'],
    ['spiral', 'SPIRAL', '8', 'Digit8'],
    ['clap', 'CLAP', '-', 'Minus']
];

export class Debug {
    constructor() {
        this.enabled = false;   // debug mode (cheats and overlays active)
        this.panelOpen = false; // the clickable panel is showing
        this.tab = 0;
        // cheats
        this.god = false;
        this.infMana = false;
        this.noCooldown = false;
        this.oneHit = false;
        this.teleport = false;
        // boss
        this.freezeBoss = false;
        this.lockAttack = null; // repeat this attack every time the boss is free
        // view
        this.hitboxes = true;
        this.info = true;
        this.showLog = true;
        this.graph = true;
        this.hideHud = false;
        this.cursor = false;
        // time
        this.speed = 3; // index into SPEEDS (1x)
        this.halted = false;
        this.stepQueued = false;

        this.fps = 60;
        this.frameTimes = [];
        this.events = [];
        this.message = '';
        this.messageTimer = 0;
        this.prevBossState = '';
        this.hover = null;
        this.buttons = [];
    }

    get timeScale() {
        return this.enabled ? SPEEDS[this.speed] : 1;
    }

    get hidesHud() {
        return this.enabled && this.hideHud;
    }

    // Main loop asks before each update: false while halted, except for one queued single step
    shouldStep() {
        if (!this.enabled || !this.halted) return true;
        if (!this.stepQueued) return false;
        this.stepQueued = false;
        return true;
    }

    note(text) {
        this.message = text;
        this.messageTimer = 1.6;
    }

    log(text, color = C.text) {
        if (!this.enabled) return;
        this.events.unshift({ text, color, t: 0 });
        this.events.length = Math.min(this.events.length, LOG_SIZE);
    }

    trackFps(rawDt) {
        if (rawDt > 0) this.fps += (1 / rawDt - this.fps) * 0.05;
        this.frameTimes.push(rawDt * 1000);
        if (this.frameTimes.length > 80) this.frameTimes.shift();
        this.messageTimer = Math.max(0, this.messageTimer - rawDt);
        for (const e of this.events) e.t += rawDt;
    }

    // --- buttons -------------------------------------------------------------------------------

    // The current tab's buttons: { label, key?, code?, on?(), act(), w? (in columns), disabled?() }
    tabButtons(game) {
        const p = game.player;
        const boss = game.boss;
        const toggle = (prop, label, key, code) => ({
            label, key, code, on: () => this[prop],
            act: () => { this[prop] = !this[prop]; this.note(`${label} ${this[prop] ? 'ON' : 'OFF'}`); }
        });
        switch (TABS[this.tab]) {
            case 'GAME': return [
                ...SPEEDS.map((s, i) => ({
                    label: `${s}X`, small: true, clean: true, on: () => this.speed === i,
                    act: () => { this.speed = i; this.note(`SPEED ${s}X`); }
                })),
                { label: 'SLOWER', key: '[', code: 'BracketLeft', clean: true, act: () => this.setSpeed(-1) },
                { label: 'FASTER', key: ']', code: 'BracketRight', clean: true, act: () => this.setSpeed(1) },
                { ...toggle('halted', 'HALT', ',', 'Comma'), clean: true },
                { label: 'STEP', key: '.', code: 'Period', clean: true, act: () => { this.halted = true; this.stepQueued = true; } },
                { label: 'RESTART', clean: true, act: () => { game.startFight(); this.note('FIGHT RESTARTED'); } },
                { label: 'SKIP INTRO', key: 'N', code: 'KeyN', disabled: () => boss.state !== 'intro', act: () => game.skipOpening() },
                {
                    label: `DIFF ${DIFFICULTIES[game.difficulty].label}`,
                    act: () => { game.cycleDifficulty(1); game.startFight(); this.note(`DIFFICULTY ${DIFFICULTIES[game.difficulty].label} - RESTARTED`); }
                },
                { label: 'CLEAR SHOTS', act: () => { game.enemyShots = []; this.note('BOSS SHOTS CLEARED'); } },
                { label: 'DEBUG OFF', key: 'SH+F3', clean: true, act: () => this.toggle() }
            ];
            case 'REN': return [
                toggle('god', 'GOD MODE', 'G', 'KeyG'),
                toggle('infMana', 'INF MANA', 'M', 'KeyM'),
                toggle('noCooldown', 'NO DASH CD', null, null),
                toggle('oneHit', 'ONE-HIT KO', 'O', 'KeyO'),
                { label: 'REFILL', key: '0', code: 'Digit0', act: () => { p.health = p.maxHealth; p.mana = p.maxMana; this.note('REFILLED'); } },
                { label: 'HP TO 1', act: () => { p.health = 1; this.note('REN AT 1 HP'); } },
                toggle('teleport', 'TELEPORT', 'V', 'KeyV'),
                { label: 'REVIVE', disabled: () => !p.dead, act: () => this.revive(game) }
            ];
            case 'BOSS': return [
                ...ATTACKS.map(([state, label, key, code, phase2]) => ({
                    label, key, code, on: () => this.lockAttack === state,
                    disabled: () => (phase2 && boss.phase === 1) || boss.dead,
                    act: () => this.forceAttack(game, state)
                })),
                {
                    label: this.lockAttack ? `LOCK ${this.lockAttack.toUpperCase()}` : 'LOCK: OFF', on: () => !!this.lockAttack,
                    act: () => { this.lockAttack = this.lockAttack ? null : boss.lastAttack || 'orbs'; this.note(this.lockAttack ? `REPEATING ${this.lockAttack.toUpperCase()}` : 'ATTACK LOCK OFF'); }
                },
                toggle('freezeBoss', 'FREEZE AI', 'F', 'KeyF'),
                { label: 'PHASE 2', key: '6', code: 'Digit6', disabled: () => boss.phase === 2 || !boss.targetable, act: () => this.toPhase2(game) },
                { label: 'KILL', key: '9', code: 'Digit9', disabled: () => boss.dead || boss.state === 'dying', act: () => this.killBoss(game) },
                { label: 'HEAL BOSS', key: 'B', code: 'KeyB', act: () => { boss.health = boss.maxHealth; boss.displayHealth = boss.maxHealth; this.note('BOSS HEALED'); } },
                { label: 'BOSS 10%', act: () => { boss.health = Math.max(1, Math.round(boss.maxHealth * 0.1)); if (boss.phase === 1) boss.phase = 2; this.note('BOSS AT 10%'); } }
            ];
            default: return [
                toggle('hitboxes', 'HITBOXES', 'H', 'KeyH'),
                toggle('info', 'STATE INFO', 'I', 'KeyI'),
                toggle('showLog', 'EVENT LOG', null, null),
                toggle('graph', 'FRAME GRAPH', null, null),
                toggle('hideHud', 'HIDE HUD', 'U', 'KeyU'),
                toggle('cursor', 'CURSOR XY', null, null)
            ];
        }
    }

    run(btn) {
        btn.act();
    }

    // Main menu's DEBUG MODE option: debug as a whole on or off. Off suspends every cheat; the choices
    // are kept and come back when it is switched on again.
    toggle() {
        this.enabled = !this.enabled;
        this.panelOpen = this.enabled;
        this.note(this.enabled ? 'DEBUG MODE ON  (F3 SHOWS / HIDES THE PANEL)' : 'DEBUG MODE OFF');
    }

    // F3 / `: show or hide the panel. Hiding it keeps every cheat and setting running.
    togglePanel() {
        if (!this.enabled) {
            this.enabled = true;
            this.panelOpen = true;
            this.note('DEBUG MODE ON  (F3 SHOWS / HIDES THE PANEL)');
            return;
        }
        this.panelOpen = !this.panelOpen;
        this.note(this.panelOpen ? 'DEBUG PANEL SHOWN' : 'DEBUG PANEL HIDDEN - CHEATS STILL ON');
    }

    setSpeed(dir) {
        this.speed = Math.max(0, Math.min(SPEEDS.length - 1, this.speed + dir));
        this.note(`SPEED ${SPEEDS[this.speed]}X`);
    }

    forceAttack(game, state) {
        const boss = game.boss;
        if (boss.state === 'intro') game.skipOpening();
        if (!boss.targetable && boss.state !== 'intro') { this.note('BOSS IS BUSY'); return; }
        if (state === 'pillars' && boss.phase === 1) { this.note('PILLARS ARE PHASE 2 ONLY'); return; }
        boss.nextAttack(state);
        if (this.lockAttack) this.lockAttack = state;
        this.note(`FORCED ${state.toUpperCase()}`);
    }

    toPhase2(game) {
        const boss = game.boss;
        if (boss.phase === 2 || !boss.targetable) return;
        boss.health = Math.floor(boss.maxHealth * 0.5);
        boss.enterPhase2(game);
    }

    killBoss(game) {
        game.skipOpening();
        const boss = game.boss;
        if (boss.dead || boss.state === 'dying') return;
        if (boss.state === 'intro' || boss.state === 'phase') boss.state = 'hover';
        if (boss.phase === 1) boss.phase = 2; // skip the phase-change cutscene
        boss.health = 1;
        boss.takeDamage(1, game, false);
        this.note('BOSS KILLED');
    }

    revive(game) {
        const p = game.player;
        p.dead = false;
        p.health = p.maxHealth;
        p.state = 'idle';
        p.invuln = 1;
        if (game.state === 'gameover') game.state = 'fight';
        this.note('REN REVIVED');
    }

    // Lay the current tab's buttons out in two columns (speed buttons share one row of five)
    layout(game) {
        const list = this.tabButtons(game);
        let y = PANEL_Y + 30;
        let col = 0;
        let smallX = PANEL_X + 4;
        for (const b of list) {
            if (b.small) {
                b.x = smallX;
                b.y = y;
                b.w = 33;
                smallX += 35;
                if (smallX > PANEL_X + PANEL_W - 30) { y += BTN_H + 3; smallX = PANEL_X + 4; }
                continue;
            }
            b.x = PANEL_X + 4 + col * (BTN_W + 2);
            b.y = y;
            b.w = BTN_W;
            col++;
            if (col === 2) { col = 0; y += BTN_H + 3; }
        }
        this.buttonsBottom = y + (col ? BTN_H + 3 : 0);
        this.buttons = list;
    }

    inside(b, x, y) {
        return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + BTN_H;
    }

    // --- per-frame -----------------------------------------------------------------------------

    handleInput(input, game) {
        // F3 shows / hides the panel; Shift+F3 switches debug mode off entirely (cheats suspended)
        if (input.debugToggle) {
            if (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) {
                if (this.enabled) this.toggle();
            } else {
                this.togglePanel();
            }
        }
        if (!this.enabled) {
            game.player.god = false; // suspended while debug mode is off
            return;
        }
        if (game.state === 'title') return;

        const pressed = (code) => input.isPressed(code);
        const p = game.player;
        const boss = game.boss;

        // keyboard: tab-independent, every button with a key works from any tab
        if (pressed('KeyT')) this.speed = this.speed === 3 ? 1 : 3;
        for (let t = 0; t < TABS.length; t++) {
            const saved = this.tab;
            this.tab = t;
            const list = this.tabButtons(game);
            this.tab = saved;
            for (const b of list) {
                if (b.code && pressed(b.code) && !(b.disabled && b.disabled())) this.run(b);
            }
        }

        // mouse: hover, click buttons and tabs, click-to-teleport
        this.layout(game);
        const mx = input.mouse.gx;
        const my = input.mouse.gy;
        this.hover = this.buttons.find((b) => this.inside(b, mx, my)) || null;
        const click = input.mouse.leftPressed;
        const overPanel = this.panelOpen && mx >= PANEL_X && mx < PANEL_X + PANEL_W && my >= PANEL_Y && my < (this.panelBottom || PANEL_Y + 200);
        if (click && overPanel) {
            if (my >= PANEL_Y + 14 && my < PANEL_Y + 26) {
                this.tab = Math.max(0, Math.min(TABS.length - 1, Math.floor((mx - PANEL_X - 4) / 44)));
            } else if (this.hover && !(this.hover.disabled && this.hover.disabled())) {
                this.run(this.hover);
            }
            input.consumeClick();
        } else if (click && this.teleport && game.state === 'fight') {
            p.x = Math.max(10, Math.min(ARENA_W - 10, mx + game.camX));
            p.y = Math.min(GROUND_Y, my);
            p.vx = 0;
            p.vy = 0;
            input.consumeClick();
        }

        // cheats that hold every frame
        p.god = this.god;
        if (this.infMana) p.mana = p.maxMana;
        if (this.noCooldown) p.dashCooldown = 0;

        // log each new boss attack; keep a locked attack repeating
        if (boss.state !== this.prevBossState) {
            if (!['hover', 'intro'].includes(boss.state)) this.log(`BOSS ${boss.state.toUpperCase()}`, '#e879f9');
            this.prevBossState = boss.state;
        }
        if (this.lockAttack && boss.state === 'hover' && boss.timer < 0.3 && boss.targetable) {
            if (this.lockAttack !== 'pillars' || boss.phase === 2) boss.nextAttack(this.lockAttack);
        }
    }

    // --- drawing -------------------------------------------------------------------------------

    renderWorld(ctx, game) {
        if (!this.enabled) return;
        if (this.cursor && game.state !== 'title') {
            ctx.fillStyle = 'rgba(253,224,71,0.35)';
            ctx.fillRect(0, Math.round(game.input.mouse.gy), ARENA_W, 1);
            ctx.fillRect(Math.round(game.input.mouse.gx + game.camX), 0, 1, 400);
        }
        if (!this.hitboxes) return;
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
        if (p.dodgeTimer > 0) drawText(ctx, 'DODGE', p.x, p.y - 62, { color: '#9ee7ff', align: 'center', outline: true });

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
            drawText(ctx, this.message, VIEW_W / 2, 64, { color: C.accent, align: 'center', outline: true });
        }
        if (!this.enabled) return;
        if (game.state === 'title') {
            drawText(ctx, 'DEBUG ON - START A FIGHT TO USE THE PANEL', 8, 8, { color: C.accent, outline: true });
            return;
        }
        if (this.halted) drawText(ctx, 'HALTED  -  . TO STEP   , TO RESUME', VIEW_W / 2, 76, { color: C.warn, align: 'center', outline: true });

        // panel hidden: a small tag in the corner so it's clear debug (and which cheats) are still on
        if (!this.panelOpen) {
            const flags = [this.god && 'GOD', this.infMana && 'MANA', this.oneHit && '1HIT', this.freezeBoss && 'FROZEN',
                this.lockAttack && 'LOCK', SPEEDS[this.speed] !== 1 && `${SPEEDS[this.speed]}X`].filter(Boolean);
            const label = `DEBUG${flags.length ? '  ' + flags.join(' ') : ''}  (F3 SHOW  SHIFT+F3 OFF)`;
            ctx.fillStyle = C.bg;
            ctx.fillRect(VIEW_W - textWidth(label) - 12, 40, textWidth(label) + 8, 11);
            drawText(ctx, label, VIEW_W - 8, 42, { color: C.accent, align: 'right', shadow: null });
            return;
        }

        this.layout(game);
        const x = PANEL_X;
        const y = PANEL_Y;
        const p = game.player;
        const b = game.boss;

        // body is drawn last-known height first, then sized to its content
        const lines = this.info ? [
            `FPS ${Math.round(this.fps)}  SPEED ${SPEEDS[this.speed]}X  ${DIFFICULTIES[game.difficulty].label}`,
            `REN ${p.state.toUpperCase()}  ${Math.round(p.x)},${Math.round(p.y)}`,
            `VEL ${Math.round(p.vx)},${Math.round(p.vy)}  IFR ${p.invuln.toFixed(2)}`,
            `HP ${Math.ceil(p.health)}  MP ${Math.floor(p.mana)}  ${p.regenerating ? 'REGEN' : 'SAFE ' + Math.min(p.sinceHit, p.regenDelay).toFixed(1)}`,
            `BOSS ${b.state.toUpperCase()}${b.sub ? ':' + b.sub.toUpperCase() : ''}`,
            `HP ${b.health}/${b.maxHealth}  PH ${b.phase}  T ${Math.max(0, b.timer).toFixed(2)}`,
            `SHOTS ${game.shots.length}/${game.enemyShots.length}  FX ${game.fx.particles.length}`
        ] : [];
        let cy = this.buttonsBottom + 4;
        const infoY = cy;
        cy += lines.length * 9 + (lines.length ? 4 : 0);
        const logY = cy;
        if (this.showLog) cy += 10 + Math.max(1, this.events.length) * 9;
        const graphY = cy;
        if (this.graph) cy += 26;
        this.panelBottom = cy + 2;

        ctx.fillStyle = C.bg;
        ctx.fillRect(x, y, PANEL_W, this.panelBottom - y);
        ctx.fillStyle = C.accent;
        ctx.fillRect(x, y, PANEL_W, 1);
        drawText(ctx, 'DEBUG', x + 5, y + 4, { color: C.accent, shadow: null });
        const flags = [this.god && 'GOD', this.freezeBoss && 'FROZEN', this.halted && 'HALT', this.oneHit && '1HIT'].filter(Boolean);
        if (flags.length) drawText(ctx, flags.join(' '), x + PANEL_W - 5, y + 4, { color: C.warn, align: 'right', shadow: null });

        // tabs
        TABS.forEach((t, i) => {
            const tx = x + 4 + i * 44;
            const on = i === this.tab;
            ctx.fillStyle = on ? '#3b2f5c' : C.btn;
            ctx.fillRect(tx, y + 14, 42, 12);
            if (on) { ctx.fillStyle = C.accent; ctx.fillRect(tx, y + 25, 42, 1); }
            drawText(ctx, t, tx + 21, y + 17, { color: on ? C.accent : C.dim, align: 'center', shadow: null });
        });

        // buttons
        for (const btn of this.buttons) {
            const disabled = btn.disabled && btn.disabled();
            const on = btn.on && btn.on();
            ctx.fillStyle = on ? C.on : btn === this.hover && !disabled ? C.btnHover : C.btn;
            ctx.fillRect(btn.x, btn.y, btn.w, BTN_H);
            const color = disabled ? '#4b5563' : on ? C.onText : C.text;
            drawText(ctx, btn.label, btn.x + 3, btn.y + 3, { color, shadow: null });
            if (btn.key) drawText(ctx, btn.key, btn.x + btn.w - 3, btn.y + 3, { color: disabled ? '#4b5563' : C.dim, align: 'right', shadow: null });
        }

        lines.forEach((line, i) => drawText(ctx, line, x + 5, infoY + i * 9, { color: C.text, shadow: null }));

        if (this.showLog) {
            drawText(ctx, 'EVENTS', x + 5, logY, { color: C.accent, shadow: null });
            if (!this.events.length) drawText(ctx, '-', x + 5, logY + 10, { color: C.dim, shadow: null });
            this.events.forEach((e, i) => {
                drawText(ctx, e.text, x + 5, logY + 10 + i * 9, { color: e.t > 4 ? C.dim : e.color, shadow: null });
            });
        }

        // frame time bars: green under 17ms (60fps), yellow under 34ms, red above
        if (this.graph) {
            const gx = x + 5;
            const gy = graphY + 22;
            ctx.fillStyle = '#334155';
            ctx.fillRect(gx, gy - 8, 2 * 80, 1); // 16.7ms line
            this.frameTimes.forEach((ms, i) => {
                const h = Math.min(22, Math.round(ms / 2));
                ctx.fillStyle = ms < 17.5 ? '#4ade80' : ms < 34 ? '#facc15' : '#f87171';
                ctx.fillRect(gx + i * 2, gy - h, 1, h);
            });
            drawText(ctx, `${(this.frameTimes[this.frameTimes.length - 1] || 0).toFixed(1)}MS`, x + PANEL_W - 5, graphY, { color: C.dim, align: 'right', shadow: null });
        }

        if (this.cursor) {
            const mx = Math.round(game.input.mouse.gx);
            const my = Math.round(game.input.mouse.gy);
            drawText(ctx, `${mx + Math.round(game.camX)},${my}`, mx + 6, my + 6, { color: C.accent, outline: true });
        }
    }
}
