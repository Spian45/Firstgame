// Input Manager supporting Keyboard and Mouse
export class InputManager {
    constructor() {
        this.keys = {};
        this.pressed = {}; // keys that went down since the last frame (survives taps shorter than a frame)
        this.mouse = {
            x: 0,
            y: 0,
            leftDown: false,
            leftPressed: false,
            rightDown: false,
            rightPressed: false
        };

        window.addEventListener('keydown', (e) => {
            // Prevent default scrolling for game keys
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3'].includes(e.code)) {
                e.preventDefault();
            }
            if (!e.repeat) this.pressed[e.code] = true;
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.mouse.leftDown = true;
                this.mouse.leftPressed = true;
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

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
    }

    update() {
        this.pressed = {};
        this.mouse.leftPressed = false;
        this.mouse.rightPressed = false;
    }

    isDown(code) {
        return !!this.keys[code];
    }

    isPressed(code) {
        return !!this.pressed[code];
    }

    // Directional getters
    get left() {
        return this.isDown('KeyA') || this.isDown('ArrowLeft');
    }

    get right() {
        return this.isDown('KeyD') || this.isDown('ArrowRight');
    }

    get up() {
        return this.isDown('KeyW') || this.isDown('ArrowUp');
    }

    get down() {
        return this.isDown('KeyS') || this.isDown('ArrowDown');
    }

    get jump() {
        return this.isPressed('KeyW') || this.isPressed('ArrowUp') || this.isPressed('Space');
    }

    get jumpHeld() {
        return this.isDown('KeyW') || this.isDown('ArrowUp') || this.isDown('Space');
    }

    get dash() {
        return this.isPressed('ShiftLeft') || this.isPressed('ShiftRight') || this.isPressed('KeyL');
    }

    get attack() {
        return this.isPressed('KeyJ') || this.isPressed('KeyZ') || this.mouse.leftPressed;
    }

    get skill() {
        return this.isPressed('KeyK') || this.isPressed('KeyX') || this.mouse.rightPressed;
    }

    get pause() {
        return this.isPressed('Escape') || this.isPressed('KeyP');
    }

    get restart() {
        return this.isPressed('KeyR') || this.isPressed('Enter');
    }

    // Menu navigation
    get menuUp() {
        return this.isPressed('KeyW') || this.isPressed('ArrowUp');
    }

    get menuDown() {
        return this.isPressed('KeyS') || this.isPressed('ArrowDown');
    }

    get menuLeft() {
        return this.isPressed('KeyA') || this.isPressed('ArrowLeft');
    }

    get menuRight() {
        return this.isPressed('KeyD') || this.isPressed('ArrowRight');
    }

    get confirm() {
        return this.isPressed('Enter') || this.isPressed('Space') || this.isPressed('KeyJ');
    }

    get back() {
        return this.isPressed('Escape') || this.isPressed('Backspace');
    }

    get quit() {
        return this.isPressed('KeyQ');
    }

    // Down tap: slam attack while airborne
    get slam() {
        return this.isPressed('KeyS') || this.isPressed('ArrowDown');
    }

    get walk() {
        return this.isDown('KeyC');
    }

    get debugToggle() {
        return this.isPressed('F3') || this.isPressed('Backquote');
    }

    get interact() {
        return this.isPressed('KeyE') || this.isPressed('Enter') || this.isPressed('Space');
    }
}
