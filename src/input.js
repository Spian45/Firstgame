// Input Manager supporting Keyboard and Mouse
const DOUBLE_TAP_MS = 250; // max gap between two taps of A/D (or arrows) to count as a dash

// Rebindable actions: the first key is the player's choice (KEYBINDS page), the rest are fixed extras
// (arrows, Space, mouse buttons are always on). Touch buttons press the Touch* codes.
export const BIND_ACTIONS = [
    ['left', 'MOVE LEFT'],
    ['right', 'MOVE RIGHT'],
    ['jump', 'JUMP'],
    ['down', 'DOWN / SLAM'],
    ['dash', 'DASH'],
    ['attack', 'ATTACK'],
    ['skill', 'FOXFIRE'],
    ['walk', 'WALK (HOLD)']
];
export const DEFAULT_KEYS = { left: 'KeyA', right: 'KeyD', jump: 'KeyW', down: 'KeyS', dash: 'ShiftLeft', attack: 'KeyJ', skill: 'KeyK', walk: 'KeyC' };
const EXTRA_KEYS = {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    jump: ['ArrowUp', 'Space'],
    down: ['ArrowDown'],
    dash: ['ShiftRight', 'TouchDash'],
    attack: ['TouchAttack'],
    skill: ['TouchSkill'],
    walk: []
};
// Keys that can't be bound (pause, menus, debug)
export const RESERVED_KEYS = ['Escape', 'KeyP', 'Enter', 'Backspace', 'F3', 'Backquote', 'Tab'];

// Readable name for a key code, for menus and hints
export function keyName(code) {
    if (!code) return '-';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6).toUpperCase();
    if (code.startsWith('Arrow')) return code.slice(5).toUpperCase();
    const names = {
        ShiftLeft: 'SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'CTRL', ControlRight: 'R-CTRL', AltLeft: 'ALT', AltRight: 'R-ALT',
        Space: 'SPACE', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Minus: '-', Equal: '=',
        BracketLeft: '[', BracketRight: ']', CapsLock: 'CAPS'
    };
    return names[code] || code.toUpperCase();
}

function loadKeys() {
    try {
        const saved = JSON.parse(localStorage.getItem('ren.keys') || '{}');
        return { ...DEFAULT_KEYS, ...saved };
    } catch (e) {
        return { ...DEFAULT_KEYS };
    }
}

export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.binds = loadKeys();
        this.lastKey = null; // code of a key pressed since the last frame (the KEYBINDS page listens for it)
        this.keys = {};
        this.pressed = {}; // keys that went down since the last frame (survives taps shorter than a frame)
        this.lastTap = { side: null, time: 0 };
        this.tap = null; // game-space point tapped or clicked since the last frame (not on a touch button)
        this.wheel = 0;  // mouse wheel since the last frame: -1 up, 1 down
        this.mouse = {
            x: 0,
            y: 0,
            leftDown: false,
            leftPressed: false,
            rightDown: false,
            rightPressed: false,
            gx: -1, // pointer position in game pixels (640x360)
            gy: -1,
            moved: false // moved since the last frame (menus follow the pointer only then)
        };

        window.addEventListener('keydown', (e) => {
            // Prevent default scrolling for game keys
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3'].includes(e.code)) {
                e.preventDefault();
            }
            if (!e.repeat) {
                this.pressed[e.code] = true;
                this.lastKey = e.code;
                this.checkDoubleTap(e.code);
            }
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        window.addEventListener('mousedown', (e) => {
            this.trackPointer(e);
            if (e.button === 0) {
                this.mouse.leftDown = true;
                this.mouse.leftPressed = true;
                this.tap = { x: this.mouse.gx, y: this.mouse.gy }; // a click picks menu items like a tap
            } else if (e.button === 2) {
                e.preventDefault();
                this.mouse.rightDown = true;
                this.mouse.rightPressed = true;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.leftDown = false;
            if (e.button === 2) this.mouse.rightDown = false;
        });

        window.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('wheel', (e) => {
            this.wheel = Math.sign(e.deltaY); // menus scroll one row per notch
        });

        window.addEventListener('mousemove', (e) => {
            this.trackPointer(e);
            this.mouse.moved = true;
        });
    }

    trackPointer(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        if (!this.canvas) return;
        const r = this.canvas.getBoundingClientRect();
        this.mouse.gx = ((e.clientX - r.left) / r.width) * this.canvas.width;
        this.mouse.gy = ((e.clientY - r.top) / r.height) * this.canvas.height;
    }

    // Debug panel swallowed this click: don't let it also attack or pick a menu item
    consumeClick() {
        this.mouse.leftPressed = false;
        this.tap = null;
    }

    // All keys for an action: the player's binding first, then the fixed extras
    codes(action) {
        return [this.binds[action], ...EXTRA_KEYS[action]];
    }

    // Bind `action` to `code`. If another action already uses that key, it takes this action's old key (swap).
    rebind(action, code) {
        const old = this.binds[action];
        for (const [other] of BIND_ACTIONS) {
            if (other !== action && this.binds[other] === code) this.binds[other] = old;
        }
        this.binds[action] = code;
        this.saveKeys();
    }

    resetKeys() {
        this.binds = { ...DEFAULT_KEYS };
        this.saveKeys();
    }

    saveKeys() {
        try {
            localStorage.setItem('ren.keys', JSON.stringify(this.binds));
        } catch (e) { /* storage unavailable: binds last this session */ }
    }

    anyDown(action) {
        return this.codes(action).some((c) => this.keys[c]);
    }

    anyPressed(action) {
        return this.codes(action).some((c) => this.pressed[c]);
    }

    // Double-tapping a direction dashes that way: flags a virtual 'DashLeft' / 'DashRight' press
    checkDoubleTap(code) {
        const side = this.codes('left').includes(code) ? 'Left' : this.codes('right').includes(code) ? 'Right' : null;
        if (!side) return;
        const now = performance.now();
        if (this.lastTap.side === side && now - this.lastTap.time < DOUBLE_TAP_MS) {
            this.pressed['Dash' + side] = true;
            this.lastTap.side = null; // a third tap starts a new pair instead of dashing again
        } else {
            this.lastTap.side = side;
            this.lastTap.time = now;
        }
    }

    // On-screen touch buttons act exactly like holding the matching keyboard key
    press(code) {
        if (!this.keys[code]) {
            this.pressed[code] = true;
            this.checkDoubleTap(code);
        }
        this.keys[code] = true;
    }

    release(code) {
        this.keys[code] = false;
    }

    update() {
        this.pressed = {};
        this.lastKey = null;
        this.tap = null;
        this.wheel = 0;
        this.mouse.moved = false;
        this.mouse.leftPressed = false;
        this.mouse.rightPressed = false;
    }

    isDown(code) {
        return !!this.keys[code];
    }

    isPressed(code) {
        return !!this.pressed[code];
    }

    // Gameplay getters (follow the player's key bindings)
    get left() {
        return this.anyDown('left');
    }

    get right() {
        return this.anyDown('right');
    }

    get up() {
        return this.anyDown('jump');
    }

    get down() {
        return this.anyDown('down');
    }

    get jump() {
        return this.anyPressed('jump');
    }

    get jumpHeld() {
        return this.anyDown('jump');
    }

    get dash() {
        return this.anyPressed('dash') || this.isPressed('DashLeft') || this.isPressed('DashRight');
    }

    get attack() {
        return this.anyPressed('attack') || this.mouse.leftPressed;
    }

    get skill() {
        return this.anyPressed('skill') || this.mouse.rightPressed;
    }

    get pause() {
        return this.isPressed('Escape') || this.isPressed('KeyP');
    }

    get restart() {
        return this.isPressed('KeyR') || this.isPressed('Enter');
    }

    // Menu navigation: the jump / down / left / right bindings plus arrows
    get menuUp() {
        return this.anyPressed('jump') && !this.isPressed('Space');
    }

    get menuDown() {
        return this.anyPressed('down');
    }

    get menuLeft() {
        return this.anyPressed('left');
    }

    get menuRight() {
        return this.anyPressed('right');
    }

    get confirm() {
        return this.isPressed('Enter') || this.isPressed('Space') || this.anyPressed('attack');
    }

    get back() {
        return this.isPressed('Escape') || this.isPressed('Backspace');
    }

    get quit() {
        return this.isPressed('KeyQ');
    }

    // Down tap: slam attack while airborne
    get slam() {
        return this.anyPressed('down');
    }

    get walk() {
        return this.anyDown('walk');
    }

    get debugToggle() {
        return this.isPressed('F3') || this.isPressed('Backquote');
    }

    get interact() {
        return this.isPressed('KeyE') || this.isPressed('Enter') || this.isPressed('Space');
    }
}
