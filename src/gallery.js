// Gallery (title menu): browse every animation, play the soundtrack, and test the sound effects.
import { drawText } from './font.js';
import { VIEW_W, VIEW_H } from './arena.js';
import { CHARACTER } from './character.js';
import { audio } from './audio.js';

const GOLD = '#f0b84a';
const TEXT = '#f2ebe0';
const DIM = '#a89ab0';
const PINK = '#ff3df0';
const TABS = ['ANIMATIONS', 'MUSIC', 'SOUNDS'];

const ANIM_NAMES = {
    idle: 'IDLE', walk: 'WALK', run: 'RUN', fall: 'JUMP / FALL', attack: 'ATTACK',
    hurt: 'HURT', death: 'DEATH', jump: 'JUMP'
};

const TRACKS = [
    { label: 'TWILIGHT VALE', sub: 'TITLE THEME', play: () => audio.startBGM() },
    { label: 'THE BLIGHTED MASK', sub: 'BOSS - PHASE I', play: () => audio.startBattleBGM() },
    { label: 'ECLIPSE FURY', sub: 'BOSS - PHASE II', play: () => { audio.startBattleBGM(); audio.setIntensity(2); } },
    { label: 'PURIFIED', sub: 'VICTORY JINGLE', play: () => audio.playStinger('victory'), oneShot: true },
    { label: 'SPIRIT CONSUMED', sub: 'DEFEAT JINGLE', play: () => audio.playStinger('defeat'), oneShot: true }
];

const SOUNDS = [
    ['SLASH', () => audio.playSlash(1)],
    ['FINISHER', () => audio.playSlash(1.36)],
    ['HIT', () => audio.playHit(false)],
    ['CRITICAL HIT', () => audio.playHit(true)],
    ['JUMP', () => audio.playJump()],
    ['DASH', () => audio.playDash()],
    ['PERFECT DODGE', () => audio.perfectDodge()],
    ['FOXFIRE', () => audio.playFoxfire()],
    ['LAND (SOFT)', () => audio.landSoft()],
    ['LAND (HEAVY)', () => audio.landHeavy()],
    ['SLAM DIVE', () => audio.slamDive()],
    ['SLAM IMPACT', () => audio.slamImpact()],
    ['SLAM HIT', () => audio.slamHit()],
    ['BOSS CHARGE', () => audio.bossCharge(0.55)],
    ['BOSS ORBS', () => audio.bossOrbs()],
    ['BOSS RISE', () => audio.bossRise()],
    ['BOSS SLAM', () => audio.bossSlam()],
    ['CLAW SWIPE', () => audio.clawSwipe()],
    ['CLAW IMPACT', () => audio.clawImpact()],
    ['BOSS GROWL', () => audio.bossGrowl(0.45)],
    ['BOSS SWEEP', () => audio.bossSweep()],
    ['PILLAR RUMBLE', () => audio.pillarRumble()],
    ['PILLAR ERUPT', () => audio.pillarErupt()],
    ['MASK CRACK', () => audio.bossHurt(true)],
    ['BOSS ROAR', () => audio.bossRoar(1.4, 1)],
    ['MASK SHATTER', () => audio.bossShatter()]
];

export class Gallery {
    constructor() {
        this.tab = 0;
        this.sel = [0, 0, 0];
        this.time = 0;
        this.playing = -1;
        this.musicChanged = false;
        this.flash = 0;
        this.press = 'ENTER';
    }

    open() {
        this.tab = 0;
        this.time = 0;
        this.playing = -1;
        this.musicChanged = false;
    }

    // Back to the title theme if a track was played
    close(game) {
        if (this.musicChanged && game.audioStarted) {
            audio.stopBGM();
            audio.startBGM();
        }
        this.playing = -1;
        this.musicChanged = false;
    }

    animations(game) {
        const list = Object.keys(CHARACTER.sheets)
            .filter((k) => game.assets.character[k])
            .map((k) => ({ label: ANIM_NAMES[k] || k.toUpperCase(), key: k }));
        list.push({ label: 'BOSS MASK', boss: true });
        return list;
    }

    items(game) {
        if (this.tab === 0) return this.animations(game);
        if (this.tab === 1) return TRACKS;
        return SOUNDS.map(([label]) => ({ label }));
    }

    // Returns 'close' when the player backs out
    update(dt, input, game) {
        this.time += dt;
        this.flash = Math.max(0, this.flash - dt);
        if (input.back) return 'close';
        if (input.menuLeft) this.tab = (this.tab + TABS.length - 1) % TABS.length;
        if (input.menuRight) this.tab = (this.tab + 1) % TABS.length;
        const n = this.items(game).length;
        if (input.menuUp || input.wheel < 0) { this.sel[this.tab] = (this.sel[this.tab] + n - 1) % n; this.time = 0; }
        if (input.menuDown || input.wheel > 0) { this.sel[this.tab] = (this.sel[this.tab] + 1) % n; this.time = 0; }
        if (input.confirm) this.activate(game);
        if (input.tap) this.handleTap(input.tap, game);
        return null;
    }

    // Touch: tap a tab, tap a row to select it (tap it again to play), or tap the preview to play
    handleTap(tap, game) {
        const tabW = 120;
        const x0 = VIEW_W / 2 - (tabW * TABS.length) / 2;
        if (tap.y >= 34 && tap.y <= 58) {
            const i = Math.floor((tap.x - x0) / tabW);
            if (i >= 0 && i < TABS.length) this.tab = i;
            return;
        }
        if (tap.x >= 250 && tap.y >= 66 && tap.y <= 304) {
            this.activate(game);
            return;
        }
        const items = this.items(game);
        const sel = this.sel[this.tab];
        const first = Math.max(0, Math.min(sel - 7, items.length - 15));
        const i = first + Math.floor((tap.y - 66) / 16);
        if (tap.x < 240 && tap.y >= 66 && i < Math.min(items.length, first + 15)) {
            if (i === sel) this.activate(game);
            else {
                this.sel[this.tab] = i;
                this.time = 0;
            }
        }
    }

    activate(game) {
        const i = this.sel[this.tab];
        this.flash = 0.15;
        if (this.tab === 0) {
            this.time = 0; // replay from the first frame
        } else if (this.tab === 1) {
            const track = TRACKS[i];
            audio.stopBGM();
            this.musicChanged = true;
            if (this.playing === i && !track.oneShot) {
                this.playing = -1; // second press stops it
            } else {
                track.play();
                this.playing = track.oneShot ? -1 : i;
            }
        } else {
            SOUNDS[i][1]();
        }
    }

    render(ctx, game) {
        ctx.fillStyle = 'rgba(14,8,20,0.82)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        drawText(ctx, 'GALLERY', VIEW_W / 2, 14, { scale: 2, color: GOLD, align: 'center', outline: true });

        // tabs
        const tabW = 120;
        const x0 = VIEW_W / 2 - (tabW * TABS.length) / 2;
        TABS.forEach((t, i) => {
            const x = x0 + i * tabW;
            const on = i === this.tab;
            ctx.fillStyle = on ? '#4a2f3c' : '#2a1a2e';
            ctx.fillRect(x + 2, 38, tabW - 4, 16);
            if (on) {
                ctx.fillStyle = GOLD;
                ctx.fillRect(x + 2, 53, tabW - 4, 1);
            }
            drawText(ctx, t, x + tabW / 2, 43, { color: on ? GOLD : DIM, align: 'center' });
        });

        // list
        const items = this.items(game);
        const sel = this.sel[this.tab];
        const listX = 24;
        const listY = 70;
        const rows = 15;
        const first = Math.max(0, Math.min(sel - 7, items.length - rows));
        items.slice(first, first + rows).forEach((it, k) => {
            const i = first + k;
            const y = listY + k * 16;
            const on = i === sel;
            if (on) {
                ctx.fillStyle = 'rgba(240,184,74,0.18)';
                ctx.fillRect(listX - 6, y - 4, 210, 15);
                drawText(ctx, '>', listX - 4, y, { color: GOLD });
            }
            const playing = this.tab === 1 && this.playing === i;
            drawText(ctx, it.label, listX + 8, y, { color: playing ? PINK : on ? GOLD : TEXT });
            if (playing && Math.floor(this.time * 3) % 2 === 0) drawText(ctx, '*', listX + 196, y, { color: PINK });
        });

        // preview panel
        const px = 250;
        const py = 66;
        const pw = VIEW_W - px - 16;
        const ph = 238;
        ctx.fillStyle = '#1e1224';
        ctx.fillRect(px, py, pw, ph);
        ctx.fillStyle = '#4a2f3c';
        ctx.fillRect(px, py, pw, 1);
        ctx.fillRect(px, py + ph - 1, pw, 1);
        if (this.tab === 0) this.renderAnimation(ctx, game, items[sel], px, py, pw, ph);
        else if (this.tab === 1) this.renderTrack(ctx, TRACKS[sel], px, py, pw, ph);
        else this.renderSound(ctx, SOUNDS[sel][0], px, py, pw, ph);

        this.press = game.touch.enabled ? 'TAP' : 'ENTER'; // word used in the preview hints
        const hint = game.touch.enabled
            ? 'TAP A TAB OR ITEM   TAP THE PREVIEW TO ' + (this.tab === 0 ? 'REPLAY' : 'PLAY')
            : 'A/D TAB   W/S SELECT   ENTER OR CLICK ' + (this.tab === 0 ? 'REPLAY' : 'PLAY') + '   ESC BACK';
        drawText(ctx, hint, VIEW_W / 2, VIEW_H - 22, { color: DIM, align: 'center' });
    }

    renderAnimation(ctx, game, item, px, py, pw, ph) {
        const cx = px + pw / 2;
        const groundY = py + ph - 40;
        ctx.fillStyle = '#3a2a30';
        ctx.fillRect(px + 20, groundY, pw - 40, 2);
        if (item.boss) {
            const s = game.boss.sprites;
            const seq = [s.mask, s.maskCharge, s.mask, s.cracked, s.crackedCharge, s.cracked];
            const names = ['NORMAL', 'CHARGING', 'NORMAL', 'CRACKED (PHASE II)', 'CRACKED CHARGING', 'CRACKED (PHASE II)'];
            const i = Math.floor(this.time * 1.2) % seq.length;
            const img = seq[i];
            ctx.drawImage(img, Math.round(cx - img.width), groundY - img.height * 2 - 8, img.width * 2, img.height * 2);
            ctx.drawImage(s.hand, Math.round(cx - img.width - 70), groundY - 70, s.hand.width * 2, s.hand.height * 2);
            drawText(ctx, names[i], cx, py + 10, { color: TEXT, align: 'center' });
            return;
        }
        const def = CHARACTER.sheets[item.key];
        const img = game.assets.character[item.key];
        const fw = Math.round(CHARACTER.frameW * CHARACTER.scale);
        const fh = Math.round(CHARACTER.frameH * CHARACTER.scale);
        const fps = def.fps || 8;
        const frame = Math.floor(this.time * fps) % def.frames;
        const scale = 3;
        ctx.drawImage(img, frame * fw, 0, fw, fh, Math.round(cx - (fw * scale) / 2), groundY - fh * scale + 6, fw * scale, fh * scale);
        drawText(ctx, item.label, cx, py + 10, { color: TEXT, align: 'center' });
        drawText(ctx, `FRAME ${frame + 1}/${def.frames}   ${fps} FPS`, cx, py + ph - 24, { color: DIM, align: 'center' });
    }

    renderTrack(ctx, track, px, py, pw, ph) {
        const cx = px + pw / 2;
        const playing = this.playing === this.sel[1];
        drawText(ctx, track.label, cx, py + 40, { scale: 2, color: GOLD, align: 'center' });
        drawText(ctx, track.sub, cx, py + 64, { color: DIM, align: 'center' });
        drawText(ctx, 'MUSIC BY Spian45', cx, py + 82, { color: TEXT, align: 'center' });
        // little equaliser while playing
        const bars = 16;
        for (let i = 0; i < bars; i++) {
            const hgt = playing ? 6 + Math.round(Math.abs(Math.sin(this.time * (3 + i * 0.7) + i)) * 40) : 3;
            ctx.fillStyle = i % 2 ? '#c050ff' : PINK;
            ctx.fillRect(cx - bars * 5 + i * 10, py + 170 - hgt, 6, hgt);
        }
        const hint = (track.oneShot ? 'ENTER TO PLAY THE JINGLE' : playing ? 'NOW PLAYING - ENTER TO STOP' : 'ENTER TO PLAY').replace('ENTER', this.press);
        drawText(ctx, hint, cx, py + 196, { color: playing ? PINK : DIM, align: 'center' });
    }

    renderSound(ctx, label, px, py, pw, ph) {
        const cx = px + pw / 2;
        drawText(ctx, label, cx, py + 70, { scale: 2, color: GOLD, align: 'center' });
        // speaker icon that pulses on play
        const s = this.flash > 0 ? 2 : 0;
        ctx.fillStyle = this.flash > 0 ? PINK : TEXT;
        ctx.fillRect(cx - 14, py + 120, 8, 12);
        for (let i = 0; i < 6; i++) ctx.fillRect(cx - 6 + i, py + 120 - i - s, 1, 12 + i * 2 + s * 2);
        if (this.flash > 0) {
            ctx.fillRect(cx + 8, py + 122, 2, 8);
            ctx.fillRect(cx + 13, py + 118, 2, 16);
        }
        drawText(ctx, this.press + ' TO PLAY', cx, py + 170, { color: DIM, align: 'center' });
    }
}
