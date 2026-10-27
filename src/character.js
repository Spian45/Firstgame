// Playable character definition.
// Swap the sheets / sizes here to drop in a different character without touching player logic.
//
// sheets: horizontal strips, one per animation (optional per-sheet anchorX if the body sits
// elsewhere in that sheet's frames). poses: what to show for the non-looping states - either
// [sheet, frame], a frame range { sheet, from, to, fps, hold }, or a frame list
// { sheet, frames: [...], fps, hold } (hold = stop on the last frame).
// slashFx: draw the sword arc in code (for sheets that don't have it painted in).

// Original hi-res Ren sheets (128px frames, shrunk to half size in-game)
const REN_ORIGINAL = {
    name: 'REN',
    portrait: 'assets/sprites/portrait_ren.png',

    // Source frame size in the sprite sheets, and the scale it is drawn at in the 640x360 world.
    frameW: 128,
    frameH: 128,
    scale: 0.5,

    // Pixel inside the (unscaled) frame that sits on the ground, horizontally centred on the body.
    anchorX: 64,
    anchorY: 127,

    sheets: {
        idle: { src: 'assets/sprites/player_idle.png', frames: 4, fps: 6 },
        run: { src: 'assets/sprites/player_run.png', frames: 8, fps: 13 },
        jump: { src: 'assets/sprites/player_jump.png', frames: 2, fps: 0 },
        attack: { src: 'assets/sprites/player_attack.png', frames: 4, fps: 0 }
    },
    poses: {
        jump: ['jump', 0],
        fall: ['jump', 1],
        hurt: ['jump', 0],
        attack: [['attack', 0], ['attack', 1], ['attack', 2], ['attack', 3]]
    },
    slashFx: false,

    // Physics body size in world pixels
    bodyW: 14,
    bodyH: 46
};

// Pixel Ren: Spriterrific animations converted to game-res pixel art
// (tools/pixelize.py sheets ... -> assets/sprites/ren_pixel/, see ren_sheets.json)
const PIXEL = 'assets/sprites/ren_pixel/';
const REN_PIXEL = {
    ...REN_ORIGINAL,
    frameW: 74,
    frameH: 65,
    scale: 1,
    anchorX: 43,
    anchorY: 64,
    sheets: {
        idle: { src: PIXEL + 'ren_idle.png', frames: 10, fps: 6 },
        walk: { src: PIXEL + 'ren_walk.png', frames: 12, fps: 12 },
        run: { src: PIXEL + 'ren_run.png', frames: 15, fps: 24 },
        // full jump arc: 0-1 stand, 2 crouch, 3-4 rise, 5-9 airborne, 10-12 landing
        // per-frame anchor: standing/landing frames use their measured foot position, airborne frames 36
        fall: { src: PIXEL + 'ren_fall.png', frames: 13, fps: 12, anchorX: [43, 42, 39, 36, 36, 36, 36, 36, 36, 36, 38, 35, 35] },
        // 0-4 stance, 5-9 wind-up, 10-19 punch extended, 20-24 recover
        attack: { src: PIXEL + 'ren_attack.png', frames: 25, fps: 24 },
        // 2-9 side-view flinch (10-12 turn to camera: unused)
        hurt: { src: PIXEL + 'ren_hurt.png', frames: 13, fps: 12 },
        // 2-12 stagger, kneel, fall onto her side
        death: { src: PIXEL + 'ren_death.png', frames: 13, fps: 12 }
    },
    poses: {
        jump: { sheet: 'fall', from: 3, to: 4, fps: 8, hold: true },
        fall: { sheet: 'fall', from: 5, to: 9, fps: 10 },
        // landing + stand-up: far fall = deep kneel, rise through the half-kneel (borrowed from the death
        // anim, played in reverse), then straighten; short drop = light dip then straighten
        land: { sheet: 'fall', frames: [10, 11, 12, ['death', 6, 38], ['death', 5, 39], 2, 1, 0], fps: 14, hold: true },
        landSoft: { sheet: 'fall', frames: [2, 1, 0], fps: 12, hold: true },
        // pull the fist back to stance: a few key frames at 12fps to match the other choppy pixel anims
        recover: { sheet: 'attack', frames: [16, 19, 22, 24], fps: 12, hold: true },
        // short drops: light airborne frames with feet under her (far drops use 'fall')
        drop: { sheet: 'fall', frames: [4, 3], fps: 8, hold: true },
        flip: ['fall', 10], // tucked crouch, spun by the double-jump somersault
        slam: ['fall', 10, 38], // tucked knees-down dive
        hurt: { sheet: 'hurt', from: 2, to: 9, fps: 28, hold: true },
        death: { sheet: 'death', from: 2, to: 12, fps: 9, hold: true }
    },
    // attack sheet frames per combo hit, spread over that hit's duration
    attackFrames: [[9, 10, 11], [8, 10, 12], [6, 8, 10, 11, 12, 13]],
    slashFx: true
};

// Add ?char=original to the URL to play as the original Ren
const useOriginal = new URLSearchParams(window.location.search).get('char') === 'original';

export const CHARACTER = useOriginal ? REN_ORIGINAL : REN_PIXEL;
