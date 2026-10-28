// Touch screen support: on-screen buttons for phones and tablets (menu buttons also take mouse clicks).
// Shown from the start on touch-first devices (coarse pointer), or as soon as anyone touches the screen;
// hidden again when a keyboard key is pressed. Each button holds down a keyboard key, so the rest of the
// game reads touch exactly like the keyboard. Taps that miss every button land in input.tap for menus.
import { VIEW_W } from './arena.js';
import { drawText } from './font.js';

const GOLD = '#f0b84a';
const TEXT = '#f2ebe0';

// Round buttons: { x, y, r }. Wide buttons: { x, y, w, h } (x, y = centre). slide: a finger can slide
// between these without lifting (the movement pad).
const LAYOUTS = {
    fight: [
        { code: 'ArrowLeft', x: 40, y: 298, r: 22, icon: 'left', slide: true },
        { code: 'ArrowRight', x: 102, y: 298, r: 22, icon: 'right', slide: true },
        { code: 'ArrowDown', x: 71, y: 336, r: 15, icon: 'down', slide: true },
        { code: 'Space', x: 598, y: 302, r: 24, label: 'JUMP' },
        { code: 'TouchAttack', x: 543, y: 322, r: 20, label: 'HIT' },
        { code: 'TouchDash', x: 549, y: 266, r: 17, label: 'DASH' },
        { code: 'TouchSkill', x: 604, y: 246, r: 17, label: 'FIRE' },
        { code: 'Escape', x: VIEW_W / 2, y: 52, r: 11, label: 'II' }
    ],
    end: [
        { code: 'KeyR', x: 256, y: 284, w: 108, h: 24, label: 'RETRY' },
        { code: 'KeyQ', x: 384, y: 284, w: 108, h: 24, label: 'TITLE' }
    ],
    page: [
        { code: 'Escape', x: 34, y: 18, w: 52, h: 20, label: 'BACK' }
    ]
};

export class TouchControls {
    constructor(input, canvas) {
        this.input = input;
        this.canvas = canvas;
        this.enabled = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        this.layout = 'none';
        this.fingers = new Map(); // touch id -> button held (null for a tap that missed every button)

        // passive: false so preventDefault can stop scrolling, zooming and the emulated mouse clicks
        const opts = { passive: false };
        window.addEventListener('touchstart', (e) => this.onStart(e), opts);
        window.addEventListener('touchmove', (e) => this.onMove(e), opts);
        window.addEventListener('touchend', (e) => this.onEnd(e), opts);
        window.addEventListener('touchcancel', (e) => this.onEnd(e), opts);
        window.addEventListener('keydown', () => { this.enabled = false; });

        // Mouse: the menu buttons (BACK, RESUME, RETRY...) are clickable too. The fight pad is touch-only.
        this.mouseHeld = null;
        window.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || !this.menuLayout) return;
            const b = this.hit(this.toGame(e));
            if (!b) return;
            this.mouseHeld = b;
            this.input.press(b.code);
        });
        window.addEventListener('mouseup', () => {
            if (this.mouseHeld) this.input.release(this.mouseHeld.code);
            this.mouseHeld = null;
        });
    }

    // Menu-style button sets work with a mouse as well as touch
    get menuLayout() {
        return this.layout !== 'fight' && this.layout !== 'none';
    }

    get buttons() {
        return LAYOUTS[this.layout] || [];
    }

    toGame(t) {
        const r = this.canvas.getBoundingClientRect();
        return { x: ((t.clientX - r.left) / r.width) * this.canvas.width, y: ((t.clientY - r.top) / r.height) * this.canvas.height };
    }

    // Generous hit areas: thumbs are bigger than the drawn buttons
    hit(p) {
        return this.buttons.find((b) => (b.w
            ? Math.abs(p.x - b.x) <= b.w / 2 + 4 && Math.abs(p.y - b.y) <= b.h / 2 + 4
            : Math.hypot(p.x - b.x, p.y - b.y) <= b.r * 1.3)) || null;
    }

    onStart(e) {
        e.preventDefault();
        this.enabled = true;
        for (const t of e.changedTouches) {
            const p = this.toGame(t);
            const b = this.hit(p);
            this.fingers.set(t.identifier, b);
            if (b) this.input.press(b.code);
            else this.input.tap = p;
        }
    }

    onMove(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            const old = this.fingers.get(t.identifier);
            if (!old || !old.slide) continue;
            const b = this.hit(this.toGame(t));
            if (b === old || (b && !b.slide)) continue;
            this.input.release(old.code);
            this.fingers.set(t.identifier, b);
            if (b) this.input.press(b.code);
        }
    }

    onEnd(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            const b = this.fingers.get(t.identifier);
            if (b) this.input.release(b.code);
            this.fingers.delete(t.identifier);
        }
    }

    render(ctx) {
        if (!this.enabled && !this.menuLayout) return;
        const held = new Set(this.fingers.values());
        held.add(this.mouseHeld);
        for (const b of this.buttons) {
            const on = held.has(b);
            ctx.globalAlpha = on ? 0.85 : 0.5;
            if (b.w) {
                const x = Math.round(b.x - b.w / 2);
                const y = Math.round(b.y - b.h / 2);
                ctx.fillStyle = GOLD;
                ctx.fillRect(x - 1, y - 1, b.w + 2, b.h + 2);
                ctx.fillStyle = on ? '#4a2f3c' : '#140c1c';
                ctx.fillRect(x, y, b.w, b.h);
                ctx.globalAlpha = 1;
                drawText(ctx, b.label, b.x, y + Math.round(b.h / 2) - 3, { color: on ? GOLD : TEXT, align: 'center' });
                continue;
            }
            disk(ctx, b.x, b.y, b.r, on ? GOLD : TEXT);
            disk(ctx, b.x, b.y, b.r - 1, on ? '#4a2f3c' : '#140c1c');
            ctx.globalAlpha = on ? 1 : 0.8;
            if (b.icon) arrow(ctx, b.x, b.y, b.icon, on ? GOLD : TEXT);
            else drawText(ctx, b.label, b.x, b.y - 3, { color: on ? GOLD : TEXT, align: 'center' });
        }
        ctx.globalAlpha = 1;
    }
}

function disk(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) {
        const hw = Math.round(Math.sqrt(r * r - y * y));
        ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1);
    }
}

// Pixel triangle pointing left, right or down
function arrow(ctx, cx, cy, dir, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 6; i++) {
        const len = 1 + i * 2;
        if (dir === 'down') ctx.fillRect(Math.round(cx - len / 2), Math.round(cy + 3 - i), len, 1);
        else ctx.fillRect(Math.round(cx + (dir === 'left' ? -3 + i : 3 - i)), Math.round(cy - len / 2), 1, len);
    }
}
