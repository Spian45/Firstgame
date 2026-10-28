// Title menu: painted Twilight Vale backdrop and a pixel menu.
import { drawText, textWidth } from './font.js';
import { DIFFICULTIES } from './difficulty.js';
import { VIEW_W, VIEW_H, ARENA_W } from './arena.js';
import { controlRows, TOUCH_ROWS, sprite, FLAME_A, FLAME_B, ornatePanel } from './hud.js';
import { BIND_ACTIONS, RESERVED_KEYS, keyName } from './input.js';
import { audio } from './audio.js';
import { Gallery } from './gallery.js';
import { TitleArt } from './titleart.js';

const GOLD = '#f0b84a';
const TEXT = '#f2ebe0';
const DIM = '#a89ab0';
const PINK = '#ff3df0';

// Newest version first. Each change is [tag, text]: tag is NEW, CHANGED or FIXED (keep text under ~48 characters)
const CHANGELOG = [
    {
        version: 'V0.2',
        name: 'TWILIGHT UPDATE',
        date: '28 OCT 2026',
        changes: [
            ['NEW', 'DIFFICULTY - EASY NORMAL AND HARD'],
            ['NEW', 'HARD BOSS MOVES - BLIGHT RAIN SPIRAL CLAP'],
            ['NEW', 'HEALTH REGEN AFTER A FEW SECONDS UNHIT'],
            ['NEW', 'DEBUG PANEL - TABS CHEATS TIME CONTROLS'],
            ['NEW', 'MENUS WORK WITH THE MOUSE AND WHEEL'],
            ['NEW', 'TOUCH SCREEN CONTROLS FOR PHONES AND TABLETS'],
            ['NEW', 'BOSS INTRO - IT RISES OUT OF THE GROUND'],
            ['NEW', 'ENTER SPACE OR J SKIPS THE BOSS INTRO'],
            ['NEW', 'DOUBLE TAP LEFT OR RIGHT TO DASH'],
            ['NEW', 'PAINTED TITLE SCREEN OF THE TWILIGHT VALE'],
            ['NEW', 'THIS CHANGELOG'],
            ['CHANGED', 'DASH USES A FORWARD LUNGE POSE'],
            ['CHANGED', 'RUN PLAYS AT 24 FPS IN GAMEPLAY'],
            ['CHANGED', 'GALLERY SHOWS ANIMATIONS AT 12 FPS'],
            ['CHANGED', 'HURT ANIMATION TRIMMED TO THE USED FRAMES'],
            ['CHANGED', 'NEW HEALTH AND MANA PLATE WITH ICONS'],
            ['CHANGED', 'MAIN MENU REDESIGN WITH FOXFIRE CURSOR'],
            ['NEW', 'SETTINGS - DISPLAY VOLUME AND SCREEN SHAKE'],
            ['NEW', 'HEAVY NEW BOSS THEME - GUITARS AND CHOIR'],
            ['NEW', 'REN WALKS INTO THE ARENA BEFORE THE BOSS'],
            ['NEW', 'KEYBINDS - CHOOSE YOUR OWN KEYS IN SETTINGS'],
            ['FIXED', 'CLAWS FOLLOW YOU ONTO PLATFORMS'],
            ['FIXED', 'PILLARS REACH THE TOP OF THE SCREEN'],
            ['NEW', 'ISLANDS RISE FROM THE GROUND WHEN THE BOSS WAKES'],
            ['NEW', 'DEBUG MODE SWITCH ON THE MAIN MENU'],
            ['CHANGED', 'F3 HIDES THE DEBUG PANEL - CHEATS STAY ON'],
            ['NEW', 'SETTINGS IN THE PAUSE MENU'],
            ['FIXED', 'NO STRAY SPIKES HANGING UNDER PLATFORMS'],
            ['CHANGED', 'BOSS MUSIC STARTS WHEN THE BOSS ROARS'],
            ['CHANGED', 'PAUSE MENU REDESIGN WITH STATS AND TIPS'],
            ['CHANGED', 'CREDITS PAGE REDESIGN'],
            ['FIXED', 'NO MORE DARK STRIP DOWN THE SCREEN EDGES'],
            ['CHANGED', 'CREATOR CREDIT ONLY ON THE CREDITS PAGE'],
            ['FIXED', 'BIRDS NO LONGER FLY BACKWARD'],
            ['FIXED', 'NO HAIR STUCK ON HER HAND WHILE DASHING']
        ]
    },
    {
        version: 'V0.1',
        name: 'FIRST DEMO',
        date: '17 SEP 2026',
        changes: [
            ['NEW', 'BOSS FIGHT AGAINST LORD KAGETORA'],
            ['NEW', 'RUN JUMP DASH SLAM COMBO AND FOXFIRE'],
            ['NEW', 'GALLERY OF ANIMATIONS MUSIC AND SOUNDS']
        ]
    }
];
const TAG_COLORS = { NEW: '#7ee08a', CHANGED: GOLD, FIXED: '#9ee7ff' };

// Changelog panel geometry, shared by drawing and touch hit tests
const LOG = { w: 460, h: 292, rowH: 14, listTop: 84 };
LOG.x = (VIEW_W - LOG.w) / 2;
LOG.y = (VIEW_H - LOG.h) / 2;
LOG.rows = Math.floor((LOG.h - LOG.listTop - 30) / LOG.rowH);
const LOG_TAB_W = 56;

// Credits page role cards: [role, name, accent colour]
const CREDIT_ROLES = [
    ['WORLD', 'Charlotte_B', '#7ee08a'],
    ['MUSIC', 'Spian45', '#c050ff'],
    ['REN ANIMATION', 'Charlotte_B', '#ff8ac0'],
    ['TESTERS', 'Gzet', '#9ee7ff']
];

// Settings page geometry (shared by drawing and mouse/touch hit tests)
const SET = { w: 360, h: 220 };
SET.x = (VIEW_W - SET.w) / 2;
SET.y = (VIEW_H - SET.h) / 2;
SET.y0 = SET.y + 48;
SET.step = 24;
const PIPS_W = 98;

// Keybinds page geometry: one row per action plus RESET at the bottom
const KB = { w: 380, h: 276 };
KB.x = (VIEW_W - KB.w) / 2;
KB.y = (VIEW_H - KB.h) / 2;
KB.y0 = KB.y + 44;
KB.step = 21;

// One-line blurb under the menu for each difficulty
const DIFF_DESC = { easy: 'GENTLE BOSS AND FAST REGEN', normal: 'THE FIGHT AS INTENDED', hard: 'NEW BOSS MOVES - NO MERCY' };

// Main menu plate: position, first row and row spacing (shared by drawing and mouse/touch hit tests)
const MENU = { x: 46, y: 150, w: 228, y0: 164, step: 16 };

// Small pixel arrow for the changelog scroll bar: dir -1 points up, 1 points down
function arrowGlyph(ctx, x, y, dir, color, bright) {
    ctx.fillStyle = color;
    for (let i = 0; i < 4; i++) {
        const row = dir < 0 ? i : 3 - i;
        ctx.fillRect(x + 3 - i, y + row, i * 2 + 1, 1);
    }
    if (bright && color === GOLD) {
        ctx.fillStyle = '#fff6e0';
        ctx.fillRect(x + 3, y + (dir < 0 ? 0 : 3), 1, 1);
    }
}

// Ren stands still on the title screen
const NO_INPUT = { left: false, right: false, down: false, jump: false, jumpHeld: false, dash: false, attack: false, skill: false, walk: false };

export class TitleScreen {
    constructor() {
        this.selected = 0;
        this.page = 'menu'; // menu | settings | controls | changelog | credits | gallery
        this.time = 0;
        this.gallery = new Gallery();
        this.art = new TitleArt();
        this.logVersion = 0;
        this.logScroll = 0;
    }

    items(game) {
        return [
            { label: 'START', desc: 'FACE LORD KAGETORA', action: () => game.startFight() },
            { label: `DIFFICULTY: ${DIFFICULTIES[game.difficulty].label}`, desc: DIFF_DESC[game.difficulty], action: () => game.cycleDifficulty(1), cycle: (d) => game.cycleDifficulty(d), color: DIFFICULTIES[game.difficulty].color },
            { label: 'GALLERY', desc: 'ANIMATIONS MUSIC AND SOUNDS', action: () => { this.page = 'gallery'; this.gallery.open(); } },
            { label: 'SETTINGS', desc: 'DISPLAY SOUND AND SCREEN SHAKE', action: () => { this.page = 'settings'; this.setSel = 0; } },
            { label: 'CONTROLS', desc: 'KEYS AND BUTTONS', action: () => { this.page = 'controls'; } },
            {
                label: `DEBUG MODE: ${game.debug.enabled ? 'ON' : 'OFF'}`, desc: 'CHEATS AND TOOLS FOR TESTING',
                action: () => game.debug.toggle(), cycle: () => game.debug.toggle(), color: game.debug.enabled ? '#7ee08a' : '#a89ab0'
            },
            { label: 'CHANGELOG', desc: 'WHAT IS NEW IN EACH VERSION', action: () => { this.page = 'changelog'; this.logVersion = 0; this.logScroll = 0; } },
            { label: 'CREDITS', desc: 'THE PEOPLE BEHIND THE GAME', action: () => { this.page = 'credits'; } }
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
        if (this.page === 'changelog') return this.updateChangelog(input);
        if (this.page === 'settings') return this.updateSettings(input, game);
        if (this.page === 'keybinds') return this.updateKeybinds(input);
        if (this.page !== 'menu') {
            if (input.back || input.confirm) this.page = 'menu';
            return;
        }
        const items = this.items(game);
        if (input.menuUp) this.selected = (this.selected + items.length - 1) % items.length;
        if (input.menuDown) this.selected = (this.selected + 1) % items.length;
        if (input.confirm) items[this.selected].action();
        const item = items[this.selected];
        if (item.cycle && input.menuLeft) item.cycle(-1);
        if (item.cycle && input.menuRight) item.cycle(1);
        // Mouse: hovering highlights an option. Click or tap picks it.
        const row = (p) => (p.x >= MENU.x && p.x <= MENU.x + MENU.w ? Math.floor((p.y - MENU.y0 + 4) / MENU.step) : -1);
        if (input.mouse.moved) {
            const i = row({ x: input.mouse.gx, y: input.mouse.gy });
            if (i >= 0 && i < items.length) this.selected = i;
        }
        if (input.tap) {
            const i = row(input.tap);
            if (i >= 0 && i < items.length) {
                this.selected = i;
                items[i].action();
            }
        }
    }

    // Rows of the settings page. Volume rows have a `level` key into game.settings (0-10).
    settingsRows(game) {
        const s = game.settings;
        const fill = game.displayMode === 'fill';
        return [
            {
                label: 'DISPLAY', value: fill ? 'FILL SCREEN' : 'PIXEL PERFECT', change: () => game.toggleDisplay(),
                desc: fill ? 'STRETCH THE GAME TO FILL THE WINDOW' : 'SHARP SQUARE PIXELS - MAY LEAVE A BORDER'
            },
            { label: 'MUSIC', level: 'music', desc: 'MUSIC VOLUME' },
            { label: 'SOUND FX', level: 'sfx', desc: 'SOUND EFFECT VOLUME' },
            {
                label: 'SCREEN SHAKE', value: s.shake ? 'ON' : 'OFF', change: () => { s.shake = !s.shake; },
                desc: 'SHAKE THE SCREEN ON BIG HITS'
            },
            {
                label: 'KEYBINDS', value: 'CHANGE >', change: () => { this.page = 'keybinds'; this.kbSel = 0; this.kbWaiting = false; },
                desc: 'CHOOSE YOUR OWN KEYS'
            }
        ];
    }

    // W/S pick a row, A/D or Enter change it, mouse hover picks and clicks change (click a volume pip to set it)
    updateSettings(input, game) {
        const rows = this.settingsRows(game);
        const n = rows.length;
        if (input.back) { this.page = 'menu'; return; }
        if (input.menuUp) this.setSel = (this.setSel + n - 1) % n;
        if (input.menuDown) this.setSel = (this.setSel + 1) % n;
        const hit = (p) => {
            const i = Math.floor((p.y - SET.y0 + 5) / SET.step);
            return p.x >= SET.x && p.x <= SET.x + SET.w && i >= 0 && i < n ? i : -1;
        };
        if (input.mouse.moved) {
            const i = hit({ x: input.mouse.gx, y: input.mouse.gy });
            if (i >= 0) this.setSel = i;
        }
        const row = rows[this.setSel];
        let changed = false;
        const step = (d) => {
            if (row.level) game.settings[row.level] = Math.max(0, Math.min(10, game.settings[row.level] + d));
            else row.change();
            changed = true;
        };
        if (input.menuLeft) step(-1);
        if (input.menuRight || input.confirm) step(1);
        if (input.tap) {
            const i = hit(input.tap);
            if (i >= 0) {
                this.setSel = i;
                const r = rows[i];
                const pipX = SET.x + SET.w - 20 - PIPS_W;
                if (r.level && input.tap.x >= pipX - 4) {
                    game.settings[r.level] = Math.max(0, Math.min(10, Math.round((input.tap.x - pipX) / 10 + 0.5)));
                } else if (r.level) {
                    game.settings[r.level] = game.settings[r.level] >= 10 ? 0 : game.settings[r.level] + 1;
                } else {
                    r.change();
                }
                changed = true;
            }
        }
        if (changed) {
            game.applySettings();
            if (rows[this.setSel].level === 'sfx') audio.playSlash(1); // let them hear the new level
        }
    }

    // Pick an action, press Enter (or click it), then press the new key. Esc cancels; the last row resets all.
    updateKeybinds(input) {
        const n = BIND_ACTIONS.length + 1;
        if (this.kbWaiting) {
            if (input.isPressed('Escape')) { this.kbWaiting = false; return; }
            const code = input.lastKey;
            if (code && !RESERVED_KEYS.includes(code)) {
                input.rebind(BIND_ACTIONS[this.kbSel][0], code);
                this.kbWaiting = false;
                this.kbFlash = 0.5;
                audio.playChime(880, 0.15);
            }
            return;
        }
        this.kbFlash = Math.max(0, (this.kbFlash || 0) - 1 / 60);
        if (input.back) { this.page = 'settings'; return; }
        if (input.menuUp) this.kbSel = (this.kbSel + n - 1) % n;
        if (input.menuDown) this.kbSel = (this.kbSel + 1) % n;
        const hit = (p) => {
            const i = Math.floor((p.y - KB.y0 + 5) / KB.step);
            return p.x >= KB.x && p.x <= KB.x + KB.w && i >= 0 && i < n ? i : -1;
        };
        if (input.mouse.moved) {
            const i = hit({ x: input.mouse.gx, y: input.mouse.gy });
            if (i >= 0) this.kbSel = i;
        }
        let choose = input.isPressed('Enter');
        if (input.tap) {
            const i = hit(input.tap);
            if (i >= 0) { this.kbSel = i; choose = true; }
        }
        if (!choose) return;
        if (this.kbSel < BIND_ACTIONS.length) {
            this.kbWaiting = true;
        } else {
            input.resetKeys();
            this.kbFlash = 0.5;
            audio.playChime(660, 0.15);
        }
    }

    renderKeybinds(ctx, game) {
        const input = game.input;
        const hint = this.kbWaiting ? 'PRESS THE NEW KEY   ESC CANCELS' : 'W/S PICK   ENTER OR CLICK TO CHANGE   ESC BACK';
        const { x, w } = this.panel(ctx, 'KEYBINDS', KB.h, KB.w, hint);
        const t = this.time;
        const rows = [...BIND_ACTIONS.map(([a, label]) => ({ action: a, label })), { label: 'RESET TO DEFAULTS' }];
        rows.forEach((r, i) => {
            const y = KB.y0 + i * KB.step;
            const sel = i === this.kbSel;
            if (sel) {
                ctx.fillStyle = 'rgba(240,184,74,0.14)';
                ctx.fillRect(x + 8, y - 5, w - 16, 17);
                ctx.fillStyle = GOLD;
                ctx.fillRect(x + 8, y - 5, 1, 17);
            }
            if (!r.action) {
                drawText(ctx, r.label, VIEW_W / 2, y, { color: sel ? GOLD : '#c8a0d8', align: 'center' });
                return;
            }
            drawText(ctx, r.label, x + 20, y, { color: sel ? GOLD : TEXT });
            // keycap for the bound key; blinking while waiting for a new one
            const waiting = sel && this.kbWaiting;
            const name = waiting ? (Math.floor(t * 3) % 2 ? '...' : '') : keyName(input.binds[r.action]);
            const capW = Math.max(36, textWidth(name || '...') + 12);
            const cx = x + w - 20 - capW;
            ctx.fillStyle = waiting ? GOLD : '#6a4a2a';
            ctx.fillRect(cx - 1, y - 4, capW + 2, 15);
            ctx.fillStyle = waiting ? '#4a2f3c' : sel && this.kbFlash > 0 ? '#3a5a3a' : '#1e1224';
            ctx.fillRect(cx, y - 3, capW, 13);
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(cx, y - 3, capW, 1);
            drawText(ctx, name, cx + capW / 2, y, { color: waiting ? GOLD : TEXT, align: 'center' });
            // the fixed extras (arrows, space...) shown dimmed beside it
            const extras = input.codes(r.action).slice(1).filter((c) => !c.startsWith('Touch')).map(keyName);
            if (extras.length) drawText(ctx, '+ ' + extras.join(' '), cx - 8, y, { color: '#6a5a78', align: 'right' });
        });
    }

    // A/D (or tapping a tab) switches version, W/S (or the arrows) scrolls the list
    updateChangelog(input) {
        const n = CHANGELOG.length;
        const maxScroll = Math.max(0, CHANGELOG[this.logVersion].changes.length - LOG.rows);
        const pickVersion = (v) => { this.logVersion = (v + n) % n; this.logScroll = 0; };
        if (input.back || input.confirm) this.page = 'menu';
        if (input.menuLeft) pickVersion(this.logVersion - 1);
        if (input.menuRight) pickVersion(this.logVersion + 1);
        if (input.menuUp || input.wheel < 0) this.logScroll = Math.max(0, this.logScroll - 1);
        if (input.menuDown || input.wheel > 0) this.logScroll = Math.min(maxScroll, this.logScroll + 1);
        const tap = input.tap;
        if (!tap) return;
        const tabY = LOG.y + 34;
        if (tap.y >= tabY - 4 && tap.y <= tabY + 16) {
            const i = Math.floor((tap.x - (LOG.x + 16)) / LOG_TAB_W);
            if (i >= 0 && i < n) pickVersion(i);
        } else if (tap.x >= LOG.x + LOG.w - 40 && tap.x <= LOG.x + LOG.w) {
            const mid = LOG.y + LOG.listTop + (LOG.rows * LOG.rowH) / 2;
            this.logScroll = tap.y < mid ? Math.max(0, this.logScroll - 3) : Math.min(maxScroll, this.logScroll + 3);
        }
    }

    render(ctx, game) {
        const t = this.time;
        this.art.render(ctx, t);

        const touch = game.touch.enabled;
        this.backHint = touch ? 'TAP BACK' : 'ESC / ENTER BACK';
        if (this.page === 'gallery') return this.gallery.render(ctx, game);
        if (this.page === 'controls') return this.renderControls(ctx, game, touch);
        if (this.page === 'changelog') return this.renderChangelog(ctx, touch);
        if (this.page === 'credits') return this.renderCredits(ctx);
        if (this.page === 'settings') return this.renderSettings(ctx, game, touch);
        if (this.page === 'keybinds') return this.renderKeybinds(ctx, game);

        this.renderTitle(ctx, t);

        // Menu: ornate plate, foxfire cursor on the picked option, and a line describing it
        const items = this.items(game);
        const { x: mx, y: my, w: mw } = MENU;
        const mh = 30 + items.length * MENU.step + 22;
        ornatePanel(ctx, mx, my, mw, mh);
        items.forEach((item, i) => {
            const y = MENU.y0 + i * MENU.step;
            const sel = i === this.selected;
            const tx = sel ? 74 : 70;
            if (sel) {
                ctx.fillStyle = 'rgba(240,184,74,0.12)';
                ctx.fillRect(mx + 6, y - 4, mw - 12, 15);
                ctx.fillStyle = 'rgba(240,184,74,0.22)';
                ctx.fillRect(mx + 6, y - 4, 60, 15);
                ctx.fillStyle = GOLD;
                ctx.fillRect(mx + 6, y - 4, 1, 15);
                // foxfire cursor, drawn at double size and bobbing
                const f = Math.floor(t * 8) % 2;
                ctx.save();
                ctx.translate(58, y - 5 + (Math.floor(t * 4) % 2));
                ctx.scale(2, 2);
                sprite(ctx, f ? FLAME_A : FLAME_B, 0, 0, { X: '#38bdf8', h: '#9ee7ff', c: '#ffffff', o: '#0c2a40' });
                ctx.restore();
            }
            if (item.color) {
                // "DIFFICULTY:" in the usual colour, the level in its own colour
                const head = item.label.slice(0, item.label.indexOf(':') + 1);
                drawText(ctx, head, tx, y, { color: sel ? GOLD : TEXT, outline: true });
                drawText(ctx, item.label.slice(head.length), tx + textWidth(head), y, { color: item.color, outline: true });
                if (sel && !touch) drawText(ctx, '< >', mx + mw - 10, y, { color: DIM, align: 'right', outline: true });
            } else {
                drawText(ctx, item.label, tx, y, { color: sel ? GOLD : '#d8cfc4', outline: true });
            }
        });
        const descY = MENU.y0 + items.length * MENU.step + 4;
        ctx.fillStyle = '#4a2f3c';
        ctx.fillRect(mx + 10, descY - 3, mw - 20, 1);
        drawText(ctx, items[this.selected].desc || '', mx + mw / 2, descY + 3, { color: '#c8a0d8', align: 'center' });

        drawText(ctx, touch ? 'TAP AN OPTION' : 'W/S OR MOUSE SELECT   ENTER OR CLICK CONFIRM', 52, VIEW_H - 22, { color: DIM, outline: true });
        drawText(ctx, `${CHANGELOG[0].version} DEMO`, VIEW_W - 10, VIEW_H - 22, { color: DIM, align: 'right', outline: true });
        if (!game.audioStarted && Math.floor(t * 2) % 2 === 0) {
            drawText(ctx, touch ? 'TAP FOR SOUND' : 'PRESS ANY KEY FOR SOUND', VIEW_W - 12, 12, { color: DIM, align: 'right', outline: true });
        }
    }

    // Title in two-tone gold with a plum drop shadow and a shimmer that sweeps across every few seconds,
    // the subtitle on a notched ribbon, and a small DEMO tag
    renderTitle(ctx, t) {
        const text = 'UNITED REALM';
        const tx = 64;
        const ty = 58;
        drawText(ctx, text, tx + 3, ty + 4, { scale: 6, color: '#3a1a3e', shadow: null });
        drawText(ctx, text, tx, ty, { scale: 6, color: '#e8a838', outline: true });
        const band = (y0, y1, x0, x1, color) => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x0, y0, x1 - x0, y1 - y0);
            ctx.clip();
            drawText(ctx, text, tx, ty, { scale: 6, color, shadow: null });
            ctx.restore();
        };
        band(ty, ty + 18, 0, VIEW_W, '#ffd67a');       // bright upper half
        band(ty, ty + 6, 0, VIEW_W, '#fff2c0');        // top highlight row
        band(ty + 30, ty + 42, 0, VIEW_W, '#c0782a');  // deeper amber base
        const sweep = (t % 4.5) / 1.2;
        if (sweep < 1) {
            const sx = tx - 30 + sweep * 480;
            band(ty, ty + 42, sx, sx + 12, '#fffbe8');
        }

        // ribbon behind the subtitle, with notched tails
        const rx = 52;
        const ry = 104;
        const rw = 352;
        ctx.fillStyle = '#140c1c';
        ctx.fillRect(rx - 1, ry - 1, rw + 2, 22);
        ctx.fillStyle = '#4a1d4a';
        ctx.fillRect(rx, ry, rw, 20);
        ctx.fillStyle = '#6a2a5e';
        ctx.fillRect(rx, ry, rw, 2);
        ctx.fillStyle = GOLD;
        ctx.fillRect(rx, ry + 2, rw, 1);
        ctx.fillRect(rx, ry + 17, rw, 1);
        for (const [ex, dir] of [[rx, -1], [rx + rw, 1]]) {
            for (let k = 0; k < 10; k++) {
                const notch = Math.abs(k - 4.5) < 2 ? 3 : 0;
                ctx.fillStyle = '#3a1438';
                ctx.fillRect(dir < 0 ? ex - 10 + notch : ex, ry + 1 + k * 2, 10 - notch, 2);
            }
        }
        drawText(ctx, 'SPIRIT OF THE TWILIGHT VALE', rx + rw / 2, ry + 4, { scale: 2, color: TEXT, align: 'center', outline: true });

        // DEMO tag
        ctx.fillStyle = '#140c1c';
        ctx.fillRect(65, 131, 44, 13);
        ctx.fillStyle = PINK;
        ctx.fillRect(66, 132, 42, 11);
        ctx.fillStyle = '#ffd6ff';
        ctx.fillRect(66, 132, 42, 1);
        drawText(ctx, 'DEMO', 87, 134, { color: '#2b0a2e', align: 'center', shadow: null });
    }

    panel(ctx, title, h, w = 300, hint = this.backHint) {
        const x = Math.round((VIEW_W - w) / 2);
        const y = Math.round((VIEW_H - h) / 2);
        ctx.fillStyle = 'rgba(14,8,20,0.55)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H); // dim the painting behind the page
        ornatePanel(ctx, x, y, w, h);
        drawText(ctx, title, VIEW_W / 2, y + 12, { scale: 2, color: GOLD, align: 'center', outline: true });
        drawText(ctx, hint, VIEW_W / 2, y + h - 16, { color: DIM, align: 'center' });
        return { x, y, w };
    }

    renderControls(ctx, game, touch) {
        const rows = touch ? TOUCH_ROWS : controlRows(game.input);
        const { x, y, w } = this.panel(ctx, 'CONTROLS', 40 + rows.length * 14 + 30);
        rows.forEach(([a, b], i) => {
            drawText(ctx, a, x + 18, y + 40 + i * 14, { color: TEXT });
            drawText(ctx, b, x + w - 18, y + 40 + i * 14, { color: DIM, align: 'right' });
        });
    }

    // Version tabs along the top, the picked version's name and date, then its changes as tagged rows
    renderChangelog(ctx, touch) {
        const hint = touch ? 'TAP A VERSION   TAP ARROWS TO SCROLL' : 'A/D OR CLICK VERSION   W/S OR WHEEL SCROLL';
        const { x, y, w } = this.panel(ctx, 'CHANGELOG', LOG.h, LOG.w, hint);
        const tabY = y + 34;
        CHANGELOG.forEach((u, i) => {
            const tx = x + 16 + i * LOG_TAB_W;
            const on = i === this.logVersion;
            ctx.fillStyle = on ? '#4a2f3c' : '#1e1224';
            ctx.fillRect(tx, tabY - 4, LOG_TAB_W - 6, 15);
            if (on) {
                ctx.fillStyle = GOLD;
                ctx.fillRect(tx, tabY + 10, LOG_TAB_W - 6, 1);
            }
            drawText(ctx, u.version, tx + (LOG_TAB_W - 6) / 2, tabY, { color: on ? GOLD : DIM, align: 'center' });
        });

        const u = CHANGELOG[this.logVersion];
        drawText(ctx, u.name, x + 16, y + 60, { color: TEXT });
        drawText(ctx, u.date, x + w - 16, y + 60, { color: DIM, align: 'right' });
        ctx.fillStyle = '#4a2f3c';
        ctx.fillRect(x + 16, y + 72, w - 32, 1);

        const listY = y + LOG.listTop;
        u.changes.slice(this.logScroll, this.logScroll + LOG.rows).forEach(([tag, text], i) => {
            const ry = listY + i * LOG.rowH;
            ctx.fillStyle = TAG_COLORS[tag] || DIM;
            ctx.fillRect(x + 16, ry - 2, 52, 11);
            drawText(ctx, tag, x + 42, ry, { color: '#140c1c', align: 'center' });
            drawText(ctx, text, x + 78, ry, { color: TEXT });
        });

        // Scroll arrows and position when the list is longer than the panel
        const extra = u.changes.length - LOG.rows;
        if (extra > 0) {
            const ax = x + w - 22;
            const blink = Math.floor(this.time * 3) % 2 === 0;
            arrowGlyph(ctx, ax, listY + 2, -1, this.logScroll > 0 ? GOLD : '#4a2f3c', blink);
            arrowGlyph(ctx, ax, listY + LOG.rows * LOG.rowH - 10, 1, this.logScroll < extra ? GOLD : '#4a2f3c', blink);
            const trackY = listY + 14;
            const trackH = LOG.rows * LOG.rowH - 30;
            ctx.fillStyle = '#1e1224';
            ctx.fillRect(ax + 3, trackY, 1, trackH);
            ctx.fillStyle = GOLD;
            ctx.fillRect(ax + 2, trackY + Math.round((trackH - 6) * (this.logScroll / extra)), 3, 6);
        }
    }

    renderSettings(ctx, game, touch) {
        const rows = this.settingsRows(game);
        const hint = touch ? 'TAP A SETTING TO CHANGE IT' : 'W/S PICK   A/D OR CLICK CHANGE   ESC BACK';
        const { x, w } = this.panel(ctx, 'SETTINGS', SET.h, SET.w, hint);
        const t = this.time;
        rows.forEach((r, i) => {
            const y = SET.y0 + i * SET.step;
            const sel = i === this.setSel;
            if (sel) {
                ctx.fillStyle = 'rgba(240,184,74,0.14)';
                ctx.fillRect(x + 8, y - 5, w - 16, 17);
                ctx.fillStyle = GOLD;
                ctx.fillRect(x + 8, y - 5, 1, 17);
                const f = Math.floor(t * 8) % 2;
                sprite(ctx, f ? FLAME_A : FLAME_B, x + 13, y - 1, { X: '#38bdf8', h: '#9ee7ff', c: '#ffffff', o: '#0c2a40' });
            }
            drawText(ctx, r.label, x + 24, y, { color: sel ? GOLD : TEXT });
            const right = x + w - 20;
            if (r.level) {
                // ten pips, lit up to the level; the number sits to their left
                const level = game.settings[r.level];
                const px0 = right - PIPS_W;
                for (let k = 0; k < 10; k++) {
                    const on = k < level;
                    ctx.fillStyle = '#140c1c';
                    ctx.fillRect(px0 + k * 10 - 1, y - 1, 9, 9);
                    ctx.fillStyle = on ? (k < 7 ? '#38bdf8' : k < 9 ? '#9ee7ff' : '#ffffff') : '#2a2238';
                    ctx.fillRect(px0 + k * 10, y, 7, 7);
                    if (on) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(px0 + k * 10, y, 7, 1); }
                }
                drawText(ctx, level === 0 ? 'OFF' : `${level}`, px0 - 8, y, { color: level === 0 ? DIM : TEXT, align: 'right' });
            } else {
                const val = r.value;
                drawText(ctx, val, right, y, { color: sel ? '#ffd67a' : '#c8a0d8', align: 'right' });
                if (sel && !touch) {
                    drawText(ctx, '<', right - textWidth(val) - 8, y, { color: DIM, align: 'right' });
                }
            }
        });
        const descY = SET.y0 + rows.length * SET.step + 4;
        ctx.fillStyle = '#4a2f3c';
        ctx.fillRect(x + 14, descY - 4, w - 28, 1);
        drawText(ctx, rows[this.setSel].desc, VIEW_W / 2, descY + 2, { color: '#c8a0d8', align: 'center' });
    }

    // A billing line for the creators, role cards in a grid, and a thank-you with foxfire flames
    renderCredits(ctx) {
        const t = this.time;
        const { x, y, w } = this.panel(ctx, 'CREDITS', 232, 420);
        drawText(ctx, 'A GAME BY', VIEW_W / 2, y + 38, { color: DIM, align: 'center' });
        drawText(ctx, 'Spian45  AND  Charlotte_B', VIEW_W / 2, y + 50, { scale: 2, color: GOLD, align: 'center', outline: true });

        const cardW = 186;
        const cardH = 40;
        CREDIT_ROLES.forEach(([role, name, color], i) => {
            const cx = x + 16 + (i % 2) * (cardW + 16);
            const cy = y + 80 + Math.floor(i / 2) * (cardH + 10);
            ctx.fillStyle = '#1e1224';
            ctx.fillRect(cx, cy, cardW, cardH);
            ctx.fillStyle = color;
            ctx.fillRect(cx, cy, 2, cardH);
            ctx.fillStyle = '#4a2f3c';
            ctx.fillRect(cx + 2, cy, cardW - 2, 1);
            ctx.fillRect(cx + 2, cy + cardH - 1, cardW - 2, 1);
            drawText(ctx, role, cx + 10, cy + 7, { color });
            drawText(ctx, name, cx + 10, cy + 19, { scale: 2, color: TEXT, outline: true });
        });

        // thank-you line between two flickering foxfire flames
        const ty = y + 190;
        const msg = 'THANK YOU FOR PLAYING';
        drawText(ctx, msg, VIEW_W / 2, ty, { color: '#ffd67a', align: 'center', outline: true });
        const half = textWidth(msg) / 2;
        for (const [fx, k] of [[VIEW_W / 2 - half - 14, 0], [VIEW_W / 2 + half + 8, 1]]) {
            const f = Math.floor(t * 8 + k) % 2;
            ctx.save();
            ctx.translate(Math.round(fx), ty - 6 + (Math.floor(t * 4 + k) % 2));
            ctx.scale(2, 2);
            sprite(ctx, f ? FLAME_A : FLAME_B, 0, 0, { X: '#38bdf8', h: '#9ee7ff', c: '#ffffff', o: '#0c2a40' });
            ctx.restore();
        }
    }
}
