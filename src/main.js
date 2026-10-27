// Boss Arena preview - main loop, camera, combat resolution and game states.
import { audio } from './audio.js';
import { InputManager } from './input.js';
import { loadAll } from './assets.js';
import { Arena, VIEW_W, VIEW_H, ARENA_W } from './arena.js';
import { Player, SLAM_DAMAGE, COUNTER_MULT } from './player.js';
import { Boss } from './boss.js';
import { FX } from './fx.js';
import { HUD, renderLoading } from './hud.js';
import { Foxfire, overlap } from './projectiles.js';
import { Debug } from './debug.js';
import { TitleScreen } from './title.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('game');
        this.canvas.width = VIEW_W;
        this.canvas.height = VIEW_H;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.input = new InputManager();
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

        const startAudio = () => {
            if (this.audioStarted) return;
            this.audioStarted = true;
            audio.init();
            if (this.state === 'title') {
                audio.startBGM();
            } else {
                audio.startBattleBGM();
                if (this.boss && this.boss.phase === 2) audio.setIntensity(2);
            }
        };
        window.addEventListener('keydown', startAudio);
        window.addEventListener('mousedown', startAudio);
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
        this.player = new Player(140, this.assets.character);
        this.boss = new Boss(this.assets.world.portal);
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
        this.endTimer = 0;
        this.paused = false;
        this.hud.bannerData = null;
        this.hud.banner(this.boss.name, this.boss.title, 3.2);
        audio.setIntensity(1);
    }

    // --- menus ---
    startFight() {
        audio.resume();
        this.reset();
        if (this.audioStarted) {
            audio.stopBGM();
            audio.startBattleBGM();
        }
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

    toggleDisplay() {
        this.displayMode = this.displayMode === 'fill' ? 'pixel' : 'fill';
        try {
            localStorage.setItem('ren.display', this.displayMode);
        } catch (e) { /* storage unavailable: setting lasts this session */ }
        this.fitToWindow();
    }

    // --- hooks used by entities ---
    shake(amount, time) {
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
        this.update(Math.min(1 / 30, raw) * this.debug.timeScale * slow);
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

        if (input.pause) {
            this.paused = !this.paused;
            if (this.paused) audio.pause();
            else audio.resume();
        }
        if (this.paused) {
            if (input.restart) this.startFight();
            else if (input.quit) this.toTitle();
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
        this.player.update(dt, input, this.arena, this.fx, this.shots, (x, y, vx, vy) => new Foxfire(x, y, vx, vy));
        const frozen = this.debug.enabled && this.debug.freezeBoss && this.boss.state !== 'dying';
        if (!frozen) this.boss.update(dt, this);

        for (const s of this.shots) s.update(dt, this);
        for (const s of this.enemyShots) s.update(dt, this);
        this.shots = this.shots.filter((s) => !s.dead);
        this.enemyShots = this.enemyShots.filter((s) => !s.dead);

        this.resolveMelee();
        this.resolveSlam();
        if (this.player.perfectDodged) {
            this.player.perfectDodged = false;
            this.slowmo = 0.45;
            this.flashScreen('#9ee7ff', 0.25);
            this.shake(2, 0.1);
        }

        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;

        // Camera follows the player, nudged toward the boss so both stay framed
        const focus = this.player.x * 0.7 + this.boss.x * 0.3;
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
        this.debug.renderWorld(ctx, this);
        ctx.restore();
        ctx.restore();

        // Vignette: thin stepped dark bands on the screen edges
        ctx.fillStyle = 'rgba(14,8,20,0.14)';
        for (let i = 0; i < 2; i++) {
            const d = 3 + i * 4;
            ctx.fillRect(0, 0, d, VIEW_H);
            ctx.fillRect(VIEW_W - d, 0, d, VIEW_H);
            ctx.fillRect(0, 0, VIEW_W, Math.round(d / 2));
        }

        if (this.flash) {
            ctx.globalAlpha = Math.max(0, this.flash.t / this.flash.max) * 0.5;
            ctx.fillStyle = this.flash.color;
            ctx.fillRect(0, 0, VIEW_W, VIEW_H);
            ctx.globalAlpha = 1;
        }

        this.hud.render(ctx, this);
        this.debug.renderOverlay(ctx, this);
        if (this.paused) this.hud.renderPause(ctx);
        if (this.state === 'gameover' && this.endTimer > 1.6) this.hud.renderEnd(ctx, this, false); // let the collapse play first
        if (this.state === 'victory' && this.endTimer > 1.2) this.hud.renderEnd(ctx, this, true);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game().init();
});
