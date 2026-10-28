// Boss Arena preview - main loop, camera, combat resolution and game states.
import { audio } from './audio.js';
import { InputManager } from './input.js';
import { loadAll } from './assets.js';
import { Arena, VIEW_W, VIEW_H, ARENA_W } from './arena.js';
import { Player, SLAM_DAMAGE, COUNTER_MULT } from './player.js';
import { Boss } from './boss.js';
import { FX } from './fx.js';
import { HUD, renderLoading, PAUSE_ITEMS, PAUSE_MENU, PAUSE_TIP_COUNT } from './hud.js';
import { Foxfire, overlap } from './projectiles.js';
import { Debug } from './debug.js';
import { TitleScreen } from './title.js';
import { TouchControls } from './touch.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, loadDifficulty, saveDifficulty } from './difficulty.js';
import { loadSettings, saveSettings } from './settings.js';

// Player input while a cutscene holds Ren in place
const IDLE_INPUT = { left: false, right: false, down: false, jump: false, jumpHeld: false, dash: false, attack: false, skill: false, walk: false, slam: false };
// ...and while she walks into the arena at the start of a fight
const WALK_IN_INPUT = { ...IDLE_INPUT, right: true, walk: true };
const ENTER_FROM = -24; // off the left edge
const ENTER_TO = 130;   // where she stops before the boss appears

class Game {
    constructor() {
        this.canvas = document.getElementById('game');
        this.canvas.width = VIEW_W;
        this.canvas.height = VIEW_H;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.input = new InputManager(this.canvas);
        this.difficulty = loadDifficulty();
        this.settings = loadSettings();
        this.touch = new TouchControls(this.input, this.canvas, () => this.settings);
        audio.setLevels(this.settings.music, this.settings.sfx);
        this.audioStarted = false;
        this.paused = false;
        this.debug = new Debug();
        this.title = new TitleScreen();
        this.state = 'title';
        this.displayMode = 'fill';
        try {
            if (localStorage.getItem('ren.display') === 'pixel') this.displayMode = 'pixel';
        } catch (e) { /* storage unavailable: keep default */ }

        this.fitToWindow();
        window.addEventListener('resize', () => this.fitToWindow());
        document.addEventListener('fullscreenchange', () => this.fitToWindow());

        const startAudio = () => {
            if (this.audioStarted) return;
            this.audioStarted = true;
            audio.init();
            if (this.state === 'title') {
                audio.startBGM();
            } else if (this.boss.state !== 'intro' || this.boss.introDone.roar) {
                audio.startBattleBGM();
                if (this.boss && this.boss.phase === 2) audio.setIntensity(2);
            }
        };
        window.addEventListener('keydown', startAudio);
        window.addEventListener('mousedown', startAudio);
        window.addEventListener('touchend', startAudio); // browsers unlock sound on a finger lift
    }

    // Which on-screen touch buttons fit the current screen
    touchLayout() {
        if (this.state === 'title') return this.title.page === 'menu' ? 'none' : 'page';
        if (this.state === 'gameover' || this.state === 'victory') {
            return this.endTimer > (this.state === 'gameover' ? 1.6 : 1.2) ? 'end' : 'none';
        }
        if (this.paused) return this.inPauseSettings ? 'page' : 'none'; // the pause menu's own options take taps
        return 'fight';
    }

    // 'fill': scale to fill the window (pixels may be a hair uneven).
    // 'pixel': whole-number upscaling only, so every pixel is exactly square (can leave a border).
    fitToWindow() {
        const fit = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
        const scale = this.displayMode === 'pixel' && fit >= 1 ? Math.floor(fit) : fit;
        this.canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
        this.canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
    }

    async init() {
        renderLoading(this.ctx, 0);
        const assets = await loadAll((p) => renderLoading(this.ctx, p));
        this.assets = assets;
        this.hud = new HUD(assets.character.portrait);
        this.reset();
        this.state = 'title';
        this.hud.bannerData = null;
        window.game = this; // handy for poking at state from the dev console
        this.last = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    reset() {
        this.arena = new Arena(this.assets.world);
        this.fx = new FX();
        // Ren starts off-screen and walks into the arena before the boss rises
        this.player = new Player(ENTER_FROM, this.assets.character);
        this.player.minX = ENTER_FROM;
        this.entering = true;
        this.boss = new Boss(this.assets.world.portal, this.difficulty);
        const diff = DIFFICULTIES[this.difficulty];
        this.player.damageTaken = diff.damage;
        this.player.regen = diff.regen;
        this.player.regenDelay = diff.regenDelay;
        this.shots = [];       // player projectiles
        this.enemyShots = [];  // boss projectiles + hazards
        this.camX = 0;
        this.shakeAmt = 0;
        this.shakeTime = 0;
        this.flash = null;
        this.hitstopTimer = 0;
        this.slowmo = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.bestCombo = 0;
        this.hitsTaken = 0;
        this.elapsed = 0;
        this.state = 'fight';
        this.inPauseSettings = false;
        this.endTimer = 0;
        this.paused = false;
        this.hud.bannerData = null; // the boss shows its name banner when it roars at the end of its intro
        audio.setIntensity(1);
    }

    // --- menus ---
    // The title theme fades out; the arena stays quiet (just the rumble) until the boss roars
    startFight() {
        audio.resume();
        this.reset();
        if (this.audioStarted) audio.stopBGM();
        // on a phone, go fullscreen (asked for on this tap's lift: browsers only allow it inside a touch)
        if (this.touch.enabled && this.settings.autoFullscreen) this.touch.wantFullscreen = true;
    }

    // Pause menu: W/S or hover to pick, Enter / click / tap to choose; R and Q still work directly
    updatePause(input, dt) {
        // SETTINGS opens the same Settings / Keybinds pages as the title screen; backing out of
        // Settings (its page returns to 'menu') lands back on the pause menu
        if (this.inPauseSettings) {
            this.title.time += dt;
            if (this.title.page === 'settings') this.title.updateSettings(input, this);
            else if (this.title.page === 'keybinds') this.title.updateKeybinds(input);
            if (this.title.page === 'menu') this.inPauseSettings = false;
            return;
        }
        const n = PAUSE_ITEMS.length;
        const { x, w, y0, step } = PAUSE_MENU;
        const row = (p) => (p.x >= x && p.x <= x + w ? Math.floor((p.y - y0 + 6) / step) : -1);
        if (input.menuUp) this.pauseSel = (this.pauseSel + n - 1) % n;
        if (input.menuDown) this.pauseSel = (this.pauseSel + 1) % n;
        if (input.mouse.moved) {
            const i = row({ x: input.mouse.gx, y: input.mouse.gy });
            if (i >= 0 && i < n) this.pauseSel = i;
        }
        let pick = input.confirm ? PAUSE_ITEMS[this.pauseSel][1] : null;
        if (input.tap) {
            const i = row(input.tap);
            if (i >= 0 && i < n) { this.pauseSel = i; pick = PAUSE_ITEMS[i][1]; }
        }
        if (input.isPressed('KeyR')) pick = 'restart'; // not input.restart: Enter chooses the highlighted option here
        if (input.quit) pick = 'quit';
        if (pick === 'resume') { this.paused = false; audio.resume(); }
        else if (pick === 'settings') {
            this.inPauseSettings = true;
            this.title.page = 'settings';
            this.title.setSel = 0;
        }
        else if (pick === 'restart') this.startFight();
        else if (pick === 'quit') this.toTitle();
    }

    // Jump past the whole opening: Ren in place, islands up, boss straight to its roar
    skipOpening() {
        this.finishEntrance();
        this.arena.finishRise();
        this.boss.skipIntro();
    }

    // Ren is in place: restore the left wall and let the boss intro begin
    finishEntrance() {
        if (!this.entering) return;
        this.entering = false;
        this.player.x = Math.max(this.player.x, ENTER_TO);
        this.player.minX = 10;
    }

    onBossRoar() {
        if (this.audioStarted) audio.startBattleBGM();
    }

    toTitle() {
        audio.resume();
        this.reset();
        this.state = 'title';
        this.hud.bannerData = null;
        this.title.page = 'menu';
        this.title.selected = 0;
        if (this.audioStarted) {
            audio.stopBGM();
            audio.startBGM();
        }
    }

    // Step to the next difficulty (dir 1) or the previous one (dir -1); takes effect on the next fight
    cycleDifficulty(dir = 1) {
        const i = DIFFICULTY_ORDER.indexOf(this.difficulty);
        this.difficulty = DIFFICULTY_ORDER[(i + dir + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length];
        saveDifficulty(this.difficulty);
    }

    // Settings menu changed something: apply the volumes now and remember everything
    applySettings() {
        audio.setLevels(this.settings.music, this.settings.sfx);
        this.touch.applySize();
        saveSettings(this.settings);
    }

    toggleDisplay() {
        this.displayMode = this.displayMode === 'fill' ? 'pixel' : 'fill';
        try {
            localStorage.setItem('ren.display', this.displayMode);
        } catch (e) { /* storage unavailable: setting lasts this session */ }
        this.fitToWindow();
    }

    // --- hooks used by entities ---
    shake(amount, time) {
        if (!this.settings.shake) return;
        if (amount >= this.shakeAmt || this.shakeTime <= 0) {
            this.shakeAmt = amount;
            this.shakeTime = time;
        }
    }

    hitstop(time) {
        this.hitstopTimer = Math.max(this.hitstopTimer, time);
    }

    flashScreen(color, time) {
        this.flash = { color, t: time, max: time };
    }

    banner(title, subtitle) {
        this.hud.banner(title, subtitle, 2.6);
        audio.setIntensity(2);
    }

    onPlayerHit() {
        this.debug.log(`REN -${this.player.lastDamage}`, '#fb923c');
        this.hitsTaken++;
        this.combo = 0;
        this.shake(4, 0.2);
        this.hitstop(0.06);
        this.flashScreen('#d0283e', 0.12);
    }

    onBossDefeated() {
        this.enemyShots = [];
        audio.stopBGM();
        this.hud.banner('PURIFIED', 'THE BLIGHT RECEDES', 2.4);
    }

    loop(now) {
        const raw = (now - this.last) / 1000;
        this.last = now;
        this.debug.trackFps(raw);
        this.debug.handleInput(this.input, this);
        // perfect-dodge slow motion runs on real time
        const slow = this.slowmo > 0 ? 0.3 : 1;
        this.slowmo = Math.max(0, (this.slowmo || 0) - raw);
        // debug can halt the simulation (still drawing) and advance it one frame at a time
        if (this.debug.shouldStep()) this.update(Math.min(1 / 30, raw) * this.debug.timeScale * slow);
        this.touch.layout = this.touchLayout();
        this.render();
        this.input.update();
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        const input = this.input;

        if (this.state === 'title') {
            this.title.update(dt, input, this);
            return;
        }

        if (this.state !== 'fight') {
            this.hud.update(dt, this);
            this.fx.update(dt, this.camX);
            this.arena.update(dt, this.boss.phase === 2 && this.boss.state !== 'dying' && !this.boss.dead ? 1 : 0);
            if (this.state === 'gameover') this.player.update(dt, input, this.arena, this.fx, this.shots, () => null);
            this.endTimer += dt;
            const ready = this.endTimer > (this.state === 'gameover' ? 1.6 : 0.8);
            if (ready && input.restart) this.startFight();
            else if (ready && input.quit) this.toTitle();
            return;
        }

        // (Esc / P inside the pause menu's settings pages means "back", handled by those pages)
        if (input.pause && !(this.paused && this.inPauseSettings)) {
            this.paused = !this.paused;
            if (this.paused) {
                audio.pause();
                this.pauseSel = 0;
                this.pauseTip = Math.floor(Math.random() * PAUSE_TIP_COUNT);
            } else {
                audio.resume();
            }
            return;
        }
        if (this.paused) {
            this.updatePause(input, dt);
            return;
        }

        if (this.flash) {
            this.flash.t -= dt;
            if (this.flash.t <= 0) this.flash = null;
        }
        if (this.shakeTime > 0) this.shakeTime -= dt;

        if (this.hitstopTimer > 0) {
            this.hitstopTimer -= dt;
            return;
        }

        this.elapsed += dt;
        this.arena.update(dt, this.boss.phase === 2 && this.boss.state !== 'dying' && !this.boss.dead ? 1 : 0);
        // Opening: Ren walks in, stops, then the boss rises while she holds still.
        // Enter / Space / attack skips straight to the boss's roar.
        const intro = this.boss.state === 'intro';
        if (intro && input.confirm) this.skipOpening();
        if (this.entering && this.player.x >= ENTER_TO) this.finishEntrance();
        const playerInput = this.entering ? WALK_IN_INPUT : intro ? IDLE_INPUT : input;
        this.player.update(dt, playerInput, this.arena, this.fx, this.shots, (x, y, vx, vy) => new Foxfire(x, y, vx, vy));
        const frozen = this.debug.enabled && this.debug.freezeBoss && this.boss.state !== 'dying';
        if (!frozen && !this.entering) this.boss.update(dt, this);

        for (const s of this.shots) s.update(dt, this);
        for (const s of this.enemyShots) s.update(dt, this);
        this.shots = this.shots.filter((s) => !s.dead);
        this.enemyShots = this.enemyShots.filter((s) => !s.dead);

        this.resolveMelee();
        this.resolveSlam();
        if (this.player.perfectDodged) {
            this.player.perfectDodged = false;
            // on a phone, a double buzz you can feel instead of reading a "PERFECT" popup
            if (this.touch.enabled && navigator.vibrate) navigator.vibrate([25, 40, 45]);
            this.slowmo = 0.45;
            this.flashScreen('#9ee7ff', 0.25);
            this.shake(2, 0.1);
        }

        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;

        // Camera follows the player, nudged toward the boss so both stay framed
        const bossWeight = intro ? 0.55 : 0.3; // lean toward the rift during the intro
        const focus = this.player.x * (1 - bossWeight) + this.boss.x * bossWeight;
        const target = Math.max(0, Math.min(ARENA_W - VIEW_W, focus - VIEW_W / 2));
        this.camX += (target - this.camX) * Math.min(1, dt * 5);

        this.fx.update(dt, this.camX);
        this.hud.update(dt, this);

        if (this.player.dead) {
            this.state = 'gameover';
            this.endTimer = 0;
            this.flashScreen('#d0283e', 0.4);
            audio.stopBGM();
            audio.playStinger('defeat');
        } else if (this.boss.dead) {
            this.state = 'victory';
            this.endTimer = 0;
            audio.playStinger('victory');
        }
    }

    resolveMelee() {
        const box = this.player.attackBox;
        if (!box || !this.boss || this.boss.dead) return;
        if (!overlap(box, this.boss.hurtbox)) return;

        this.player.attackHit = true;
        const counter = this.player.counterTimer > 0;
        if (counter) this.player.counterTimer = 0;
        const landed = this.boss.takeDamage(Math.round(box.damage * (counter ? COUNTER_MULT : 1)), this, true);
        if (landed && counter) {
            this.fx.number(this.player.x, this.player.y - 70, 'COUNTER!', '#fff27a', true);
            this.fx.ring(this.boss.x, this.boss.y, '#fff27a', 34, 0.3);
        }
        const hx = this.player.x + this.player.facing * (box.w - 6);
        const hy = this.player.y - 26;
        if (!landed) return;

        this.combo++;
        this.comboTimer = 2.2;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.player.mana = Math.min(this.player.maxMana, this.player.mana + (box.finisher ? 14 : 6));
        this.shake(box.shake, box.finisher ? 0.2 : 0.1);
        this.hitstop(box.finisher ? 0.08 : 0.04);
        this.fx.burst(hx, hy, box.finisher ? 16 : 8, box.finisher ? ['#fff27a', '#f0b84a', '#ffffff'] : ['#ffffff', '#ffd0a0'], { speed: 150, life: 0.3, gravity: 200 });
        if (box.finisher) this.fx.ring(hx, hy, '#fff27a', 20, 0.2);
    }

    // Down-slam: hitting the boss from above bounces Ren off its head; hitting the ground shakes the screen
    resolveSlam() {
        const p = this.player;
        if (p.slamLanded) {
            p.slamLanded = false;
            this.shake(4, 0.18);
        }
        const box = p.slamBox;
        if (!box || !this.boss || this.boss.dead || !overlap(box, this.boss.hurtbox)) return;

        const landed = this.boss.takeDamage(SLAM_DAMAGE, this, true);
        p.onSlamHit();
        if (!landed) return;
        audio.slamHit();
        this.combo++;
        this.comboTimer = 2.2;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        p.mana = Math.min(p.maxMana, p.mana + 10);
        this.shake(5, 0.2);
        this.hitstop(0.08);
        this.fx.burst(p.x, p.y, 16, ['#9ee7ff', '#ffffff', '#fff27a'], { speed: 170, life: 0.35, gravity: 220 });
        this.fx.ring(p.x, p.y, '#9ee7ff', 24, 0.25);
    }

    render() {
        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;

        if (this.state === 'title') {
            this.title.render(ctx, this);
            this.touch.render(ctx);
            this.debug.renderOverlay(ctx, this);
            return;
        }

        let sx = 0;
        let sy = 0;
        if (this.shakeTime > 0 && !this.paused) {
            sx = Math.round((Math.random() * 2 - 1) * this.shakeAmt);
            sy = Math.round((Math.random() * 2 - 1) * this.shakeAmt);
        }

        ctx.save();
        ctx.translate(sx, sy);
        this.arena.renderBackground(ctx, this.camX);

        ctx.save();
        ctx.translate(-Math.round(this.camX), 0);
        this.arena.renderWorld(ctx);
        this.boss.renderShadow(ctx);
        this.player.renderShadow(ctx);
        for (const s of this.enemyShots) if (s.warn !== undefined) s.render(ctx);
        this.boss.render(ctx);
        this.player.render(ctx);
        for (const s of this.shots) s.render(ctx);
        for (const s of this.enemyShots) if (s.warn === undefined) s.render(ctx);
        this.fx.render(ctx);
        this.arena.renderLights(ctx);
        this.fx.renderLeaves(ctx);
        this.arena.renderForeground(ctx);
        this.boss.renderRift(ctx);
        this.debug.renderWorld(ctx, this);
        ctx.restore();
        ctx.restore();

        if (this.flash) {
            ctx.globalAlpha = Math.max(0, this.flash.t / this.flash.max) * 0.5;
            ctx.fillStyle = this.flash.color;
            ctx.fillRect(0, 0, VIEW_W, VIEW_H);
            ctx.globalAlpha = 1;
        }

        if (!this.debug.hidesHud) this.hud.render(ctx, this);
        this.debug.renderOverlay(ctx, this);
        if (this.paused && this.inPauseSettings) {
            const touch = this.touch.enabled;
            this.title.backHint = touch ? 'TAP BACK' : 'ESC BACK';
            if (this.title.page === 'keybinds') this.title.renderKeybinds(ctx, this);
            else this.title.renderSettings(ctx, this, touch);
        } else if (this.paused) {
            this.hud.renderPause(ctx, this, this.pauseSel, this.pauseTip, this.touch.enabled);
        }
        if (this.state === 'gameover' && this.endTimer > 1.6) this.hud.renderEnd(ctx, this, false); // let the collapse play first
        if (this.state === 'victory' && this.endTimer > 1.2) this.hud.renderEnd(ctx, this, true);
        this.touch.render(ctx);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game().init();
});
