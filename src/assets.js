// Asset manifest + loader. World art is drawn 1:1; the character sheets are
// pre-shrunk once into crisp, hard-edged pixel sheets so they match the low-res world.
import { CHARACTER } from './character.js';

const BG = 'assets/world/GandalfHardcore Background layers/Autumn BG/';

export const WORLD_ASSETS = {
    sky: BG + 'GandalfHardcore Background layers_layer 5.png',
    bg4: BG + 'GandalfHardcore Background layers_layer 4.png',
    bg3: BG + 'GandalfHardcore Background layers_layer 3.png',
    bg2: BG + 'GandalfHardcore Background layers_layer 2.png',
    bg1: BG + 'GandalfHardcore Background layers_layer 1.png',
    castle: BG + 'Background Castle Autumn.png',
    floor: 'assets/world/Floor Tiles1.png',
    torch: 'assets/world/Torch.png',
    decor: 'assets/world/Decor.png',
    statue: 'assets/world/Angel Statue.png',
    portal: 'assets/world/GandalfHardcore Portal sheet.png',
    sun: 'assets/world/sun.png',
    cloud4: 'assets/world/cloud4.png',
    cloud5: 'assets/world/cloud5.png',
    cloud6: 'assets/world/cloud6.png',
    birds: 'assets/world/birds1.png',
    campfire: 'assets/world/Campfire sheet.png',
    pines: 'assets/world/Pine Trees.png',
    forest: 'assets/world/Pine forest sheet.png',
    birch1: 'assets/world/Birch1.png',
    birch2: 'assets/world/Birch2.png',
    garden: 'assets/world/Garden Decorations.png'
};

function loadImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn(`Failed to load ${src}`);
            resolve(null);
        };
        img.src = encodeURI(src);
    });
}

// Downscale with smoothing, then snap alpha to 0/255 so edges stay pixel-hard.
function shrinkSheet(img, scale) {
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3];
        if (a < 110) {
            px[i + 3] = 0;
        } else {
            px[i + 3] = 255;
        }
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
}

export async function loadAll(onProgress) {
    const world = {};
    const character = {};
    const entries = Object.entries(WORLD_ASSETS);
    const sheetEntries = Object.entries(CHARACTER.sheets);
    const total = entries.length + sheetEntries.length + 1;
    let done = 0;
    const tick = () => onProgress && onProgress(++done / total);

    await Promise.all(entries.map(async ([key, src]) => {
        world[key] = await loadImage(src);
        tick();
    }));

    await Promise.all(sheetEntries.map(async ([key, def]) => {
        const img = await loadImage(def.src);
        character[key] = img ? shrinkSheet(img, CHARACTER.scale) : null;
        tick();
    }));

    const portraitImg = await loadImage(CHARACTER.portrait);
    character.portrait = portraitImg ? shrinkSheet(portraitImg, 24 / portraitImg.width) : null;
    tick();

    return { world, character };
}
