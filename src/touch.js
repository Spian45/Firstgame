// Touch screen support for phones and tablets (menu buttons also take mouse clicks).
// Shown from the start on touch-first devices (coarse pointer), or as soon as anyone touches the screen;
// hidden again when a keyboard key is pressed. Every control holds down a keyboard key, so the rest of the
// game reads touch exactly like the keyboard.
//
// Fight controls are an HTML overlay sized in real screen pixels (not game pixels), so they stay
// thumb-sized however small the game is drawn, and sit out in the side bars on wide phones:
//   left half of the screen: a floating joystick - put a thumb down anywhere and slide; pull down to slam/drop
//   bottom right: JUMP, HIT, DASH, FIRE with generous hit areas      top right: pause
// Menu buttons (BACK, RETRY...) are still drawn on the canvas; taps that miss them land in input.tap.
import { drawText } from './font.js';

const GOLD = '#f0b84a';
const TEXT = '#f2ebe0';

// Canvas-drawn menu buttons: { x, y, w, h } in game pixels (x, y = centre)
const LAYOUTS = {
    end: [
        { code: 'KeyR', x: 256, y: 284, w: 108, h: 24, label: 'RETRY' },
        { code: 'KeyQ', x: 384, y: 284, w: 108, h: 24, label: 'TITLE' }
    ],
    page: [
        { code: 'Escape', x: 34, y: 18, w: 52, h: 20, label: 'BACK' }
    ]
};

// Overlay fight buttons. right / bottom / d are in units of the button size (see SIZES).
const FIGHT_BUTTONS = [
    { code: 'Space', label: 'JUMP', right: 0, bottom: 0, d: 1.25 },
    { code: 'TouchAttack', label: 'HIT', right: 1.45, bottom: 0.05, d: 1.05 },
    { code: 'TouchDash', label: 'DASH', right: 1.3, bottom: 1.25, d: 0.9 },
    { code: 'TouchSkill', label: 'FIRE', right: 0.1, bottom: 1.5, d: 0.9 }
];
export const TOUCH_SIZES = { small: 52, medium: 66, large: 82 }; // base button size in CSS px
const MARGIN = 14;     // px from the screen edges (plus the phone's safe area)
const STICK_DEAD = 12; // px of slide before left / right counts
const STICK_DOWN = 26; // px of downward pull for down (slam / drop through)
const STICK_MAX = 40;  // how far the knob can travel from its anchor

export class TouchControls {
    constructor(input, canvas, settings) {
        this.input = input;
        this.canvas = canvas;
        this.settings = settings; // () => game.settings
        this.enabled = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        this.layout = 'none';
        this.fingers = new Map(); // touch id -> { button } | { stick } | { tap }
        this.stick = null;        // the joystick finger: anchor, current point, keys it holds
        this.wantFullscreen = false;
        this.buildOverlay();

        // passive: false so preventDefault can stop scrolling, zooming and the emulated mouse clicks
        const opts = { passive: false };
        window.addEventListener('touchstart', (e) => this.onStart(e), opts);
        window.addEventListener('touchmove', (e) => this.onMove(e), opts);
        window.addEventListener('touchend', (e) => this.onEnd(e), opts);
        window.addEventListener('touchcancel', (e) => this.onEnd(e), opts);
        window.addEventListener('keydown', () => { this.enabled = false; });

        // Mouse: the menu buttons (BACK, RETRY...) are clickable too. The fight controls are touch-only.
        this.mouseHeld = null;
        window.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || !this.menuLayout) return;
            const b = this.hitCanvas(this.toGame(e));
            if (!b) return;
            this.mouseHeld = b;
            this.input.press(b.code);
        });
        window.addEventListener('mouseup', () => {
            if (this.mouseHeld) this.input.release(this.mouseHeld.code);
            this.mouseHeld = null;
        });
    }

    // ------------------------------------------------------------------ overlay

    buildOverlay() {
        const ui = document.createElement('div');
        ui.id = 'touch-ui';
        document.body.appendChild(ui);
        this.ui = ui;

        this.stickBase = el(ui, 'touch-stick');
        this.stickKnob = el(this.stickBase, 'touch-knob');
        this.stickHint = el(ui, 'touch-hint');
        this.stickHint.textContent = '< MOVE >';

        this.buttons = FIGHT_BUTTONS.map((b) => {
            const node = el(ui, 'touch-btn');
            node.textContent = b.label;
            return { ...b, node };
        });
        this.pauseBtn = { code: 'Escape', node: el(ui, 'touch-btn touch-pause') };
        this.pauseBtn.node.textContent = 'II';
        this.applySize();
    }

    // Lay the buttons out for the chosen size (Settings > TOUCH BUTTONS)
    applySize() {
        const s = TOUCH_SIZES[this.settings().touchSize] || TOUCH_SIZES.medium;
        this.size = s;
        for (const b of this.buttons) {
            const d = Math.round(b.d * s);
            Object.assign(b.node.style, {
                width: `${d}px`,
                height: `${d}px`,
                right: `calc(${MARGIN + Math.round(b.right * s)}px + env(safe-area-inset-right))`,
                bottom: `calc(${MARGIN + Math.round(b.bottom * s)}px + env(safe-area-inset-bottom))`,
                fontSize: `${Math.round(d * 0.22)}px`
            });
        }
        const p = Math.round(s * 0.6);
        Object.assign(this.pauseBtn.node.style, { width: `${p}px`, height: `${p}px`, fontSize: `${Math.round(p * 0.3)}px` });
        const base = STICK_MAX * 2 + 24;
        Object.assign(this.stickBase.style, { width: `${base}px`, height: `${base}px` });
    }

    get fightActive() {
        return this.enabled && this.layout === 'fight';
    }

    // Menu-style button sets work with a mouse as well as touch
    get menuLayout() {
        return this.layout !== 'fight' && this.layout !== 'none';
    }

    // Closest overlay button within reach of a screen point (hit area 30% bigger than the drawn circle)
    hitOverlay(x, y) {
        let best = null;
        let bestD = Infinity;
        for (const b of [...this.buttons, this.pauseBtn]) {
            const r = b.node.getBoundingClientRect();
            const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
            if (d <= (r.width / 2) * 1.3 && d < bestD) {
                best = b;
                bestD = d;
            }
        }
        return best;
    }

    // Joystick: which of left / right / down the current pull means, and press / release to match
    updateStick() {
        const s = this.stick;
        const dx = s.x - s.ax;
        const dy = s.y - s.ay;
        const want = new Set();
        if (dx < -STICK_DEAD) want.add('ArrowLeft');
        if (dx > STICK_DEAD) want.add('ArrowRight');
        if (dy > STICK_DOWN) want.add('ArrowDown');
        for (const code of s.held) if (!want.has(code)) this.input.release(code);
        for (const code of want) if (!s.held.has(code)) { this.input.press(code); buzz(); }
        s.held = want;
    }

    // ------------------------------------------------------------------ canvas menu buttons

    get canvasButtons() {
        return LAYOUTS[this.layout] || [];
    }

    toGame(t) {
        const r = this.canvas.getBoundingClientRect();
        return { x: ((t.clientX - r.left) / r.width) * this.canvas.width, y: ((t.clientY - r.top) / r.height) * this.canvas.height };
    }

    hitCanvas(p) {
        return this.canvasButtons.find((b) => Math.abs(p.x - b.x) <= b.w / 2 + 4 && Math.abs(p.y - b.y) <= b.h / 2 + 4) || null;
    }

    // ------------------------------------------------------------------ touch events

    onStart(e) {
        e.preventDefault();
        this.enabled = true;
        for (const t of e.changedTouches) {
            if (this.fightActive) {
                const b = this.hitOverlay(t.clientX, t.clientY);
                if (b) {
                    this.fingers.set(t.identifier, { button: b });
                    this.input.press(b.code);
                    buzz();
                } else if (t.clientX < window.innerWidth * 0.5 && !this.stick) {
                    this.stick = { id: t.identifier, ax: t.clientX, ay: t.clientY, x: t.clientX, y: t.clientY, held: new Set() };
                    this.fingers.set(t.identifier, { stick: true });
                }
                continue;
            }
            const p = this.toGame(t);
            const b = this.hitCanvas(p);
            this.fingers.set(t.identifier, b ? { button: b } : { tap: true });
            if (b) this.input.press(b.code);
            else this.input.tap = p;
        }
    }

    onMove(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (!this.stick || t.identifier !== this.stick.id) continue;
            const s = this.stick;
            s.x = t.clientX;
            s.y = t.clientY;
            // drag the anchor along if the thumb goes past the knob's reach, so it never feels stuck
            const dx = s.x - s.ax;
            const dy = s.y - s.ay;
            const dist = Math.hypot(dx, dy);
            if (dist > STICK_MAX * 1.6) {
                const k = (dist - STICK_MAX * 1.6) / dist;
                s.ax += dx * k;
                s.ay += dy * k;
            }
            this.updateStick();
        }
    }

    onEnd(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            const f = this.fingers.get(t.identifier);
            if (f && f.button) this.input.release(f.button.code);
            if (f && f.stick && this.stick) {
                for (const code of this.stick.held) this.input.release(code);
                this.stick = null;
            }
            this.fingers.delete(t.identifier);
        }
        // fullscreen has to be asked for inside a touch event: do it on the lift after START
        if (this.wantFullscreen) {
            this.wantFullscreen = false;
            enterFullscreen();
        }
    }

    // ------------------------------------------------------------------ drawing

    render(ctx) {
        this.renderOverlay();
        if (!this.menuLayout) return;
        for (const b of this.canvasButtons) {
            const on = this.mouseHeld === b || [...this.fingers.values()].some((f) => f.button === b);
            const x = Math.round(b.x - b.w / 2);
            const y = Math.round(b.y - b.h / 2);
            ctx.globalAlpha = on ? 0.85 : 0.5;
            ctx.fillStyle = GOLD;
            ctx.fillRect(x - 1, y - 1, b.w + 2, b.h + 2);
            ctx.fillStyle = on ? '#4a2f3c' : '#140c1c';
            ctx.fillRect(x, y, b.w, b.h);
            ctx.globalAlpha = 1;
            drawText(ctx, b.label, b.x, y + Math.round(b.h / 2) - 3, { color: on ? GOLD : TEXT, align: 'center' });
        }
    }

    // Show / hide the overlay and light up whatever is held
    renderOverlay() {
        const show = this.fightActive;
        this.ui.style.display = show ? 'block' : 'none';
        if (!show) return;
        const held = new Set([...this.fingers.values()].map((f) => f.button).filter(Boolean));
        for (const b of [...this.buttons, this.pauseBtn]) b.node.classList.toggle('on', held.has(b));
        const s = this.stick;
        this.stickBase.style.display = s ? 'block' : 'none';
        this.stickHint.style.display = s ? 'none' : 'block';
        if (s) {
            const half = this.stickBase.offsetWidth / 2;
            this.stickBase.style.left = `${s.ax - half}px`;
            this.stickBase.style.top = `${s.ay - half}px`;
            const dx = s.x - s.ax;
            const dy = s.y - s.ay;
            const d = Math.hypot(dx, dy);
            const k = d > STICK_MAX ? STICK_MAX / d : 1;
            this.stickKnob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        }
    }
}

function el(parent, className) {
    const node = document.createElement('div');
    node.className = className;
    parent.appendChild(node);
    return node;
}

// A tiny tap of vibration on press, where the phone supports it
function buzz() {
    if (navigator.vibrate) navigator.vibrate(8);
}

// Fill the screen (hides the address and status bars) and keep it sideways where the browser allows
function enterFullscreen() {
    const doc = document.documentElement;
    if (document.fullscreenElement || !doc.requestFullscreen) return;
    doc.requestFullscreen({ navigationUI: 'hide' })
        .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}))
        .catch(() => {});
}
