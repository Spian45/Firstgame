// Tiny procedural pixel-art rasterizer: shapes are filled per-pixel on a palette grid
// (no anti-aliasing), then shaded and outlined automatically. Used to build the boss sprites.
export class PixelGrid {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.px = new Array(w * h).fill(null);
    }

    get(x, y) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
        return this.px[y * this.w + x];
    }

    set(x, y, c) {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        this.px[y * this.w + x] = c;
    }

    rect(x, y, w, h, c) {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    }

    ellipse(cx, cy, rx, ry, c) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
            for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
                const dx = (x - cx) / rx;
                const dy = (y - cy) / ry;
                if (dx * dx + dy * dy <= 1) this.set(x, y, c);
            }
        }
    }

    tri(ax, ay, bx, by, cx, cy, c) {
        const minX = Math.floor(Math.min(ax, bx, cx));
        const maxX = Math.ceil(Math.max(ax, bx, cx));
        const minY = Math.floor(Math.min(ay, by, cy));
        const maxY = Math.ceil(Math.max(ay, by, cy));
        const edge = (x0, y0, x1, y1, x, y) => (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
        const area = edge(ax, ay, bx, by, cx, cy);
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const w0 = edge(bx, by, cx, cy, x, y);
                const w1 = edge(cx, cy, ax, ay, x, y);
                const w2 = edge(ax, ay, bx, by, x, y);
                if (area > 0 ? (w0 >= 0 && w1 >= 0 && w2 >= 0) : (w0 <= 0 && w1 <= 0 && w2 <= 0)) this.set(x, y, c);
            }
        }
    }

    line(x0, y0, x1, y1, c, thick = 1) {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= steps; i++) {
            const x = Math.round(x0 + ((x1 - x0) * i) / steps);
            const y = Math.round(y0 + ((y1 - y0) * i) / steps);
            this.rect(x, y, thick, thick, c);
        }
    }

    // Copy the left half onto the right half (horizontal symmetry)
    mirror() {
        const half = Math.floor(this.w / 2);
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < half; x++) {
                this.px[y * this.w + (this.w - 1 - x)] = this.px[y * this.w + x];
            }
        }
    }

    // Pixels of colour `from` whose neighbour at (dx,dy) is empty / not `from` become `to`
    shade(from, to, dx, dy) {
        const out = this.px.slice();
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (this.get(x, y) !== from) continue;
                const n = this.get(x + dx, y + dy);
                if (n === null || n === 'K') out[y * this.w + x] = to;
            }
        }
        this.px = out;
    }

    outline(c = 'K') {
        const out = this.px.slice();
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (this.get(x, y) !== null) continue;
                if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) {
                    out[y * this.w + x] = c;
                }
            }
        }
        this.px = out;
    }

    clone() {
        const g = new PixelGrid(this.w, this.h);
        g.px = this.px.slice();
        return g;
    }

    // palette: { key: '#rrggbb' }. override(key) lets you recolour everything (e.g. hit flash)
    toCanvas(palette, override = null) {
        const canvas = document.createElement('canvas');
        canvas.width = this.w;
        canvas.height = this.h;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(this.w, this.h);
        for (let i = 0; i < this.px.length; i++) {
            const key = this.px[i];
            if (key === null) continue;
            const hex = override ? override(key) : palette[key];
            if (!hex) continue;
            const v = parseInt(hex.slice(1), 16);
            img.data[i * 4] = (v >> 16) & 255;
            img.data[i * 4 + 1] = (v >> 8) & 255;
            img.data[i * 4 + 2] = v & 255;
            img.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        return canvas;
    }
}
