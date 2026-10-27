"""Turn hi-res Spriterrific art into crisp game-resolution pixel art.

Steps: key out the chroma matte -> median/ink-preserving downscale -> saturation and
contrast boost -> k-means palette -> hard alpha -> 1px hue-shifted dark outline.
--style v3 adds hue-shifted ramps, lone-pixel cleanup and rim light. Pure Python (no Pillow needed).

    python tools/pixelize.py anchor IN.png OUT.png [--height 64] [--colors 16] [--style v2|v3]
    python tools/pixelize.py sheets idle/manifest.json,walk/manifest.json,run/manifest.json OUT_DIR [--ground fall]
"""
import argparse
import random
import struct
import zlib

# ---------- PNG io ----------
def load_png(path):
    data = open(path, 'rb').read()
    pos, idat = 8, b''
    while pos < len(data):
        length, = struct.unpack('>I', data[pos:pos + 4])
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        if kind == b'IHDR':
            w, h, depth, ctype = struct.unpack('>IIBB', body[:10])
            assert depth == 8 and ctype in (2, 6), f'unsupported PNG {path}'
        elif kind == b'IDAT':
            idat += body
        pos += 12 + length
    bpp = 4 if ctype == 6 else 3
    raw = zlib.decompress(idat)
    stride = w * bpp
    prev = bytearray(stride)
    pixels = []
    i = 0
    for _ in range(h):
        f = raw[i]
        i += 1
        line = bytearray(raw[i:i + stride])
        i += stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        prev = line
        row = []
        for x in range(w):
            o = x * bpp
            row.append((line[o], line[o + 1], line[o + 2], line[o + 3] if bpp == 4 else 255))
        pixels.append(row)
    return pixels


def save_png(path, pixels):
    h, w = len(pixels), len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for p in row:
            raw += bytes(p if len(p) == 4 else (*p, 255))

    def chunk(kind, body):
        return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)


# ---------- processing ----------
def is_matte(p):
    r, g, b, a = p
    return a < 128 or (g > 120 and g > r * 1.35 and g > b * 1.35)


def opaque_bbox(img, x0=0, y0=0, x1=None, y1=None, min_count=1):
    """Bounding box of non-matte pixels. Rows/columns with fewer than min_count opaque
    pixels are ignored, so stray specks don't stretch the box."""
    x1 = len(img[0]) if x1 is None else x1
    y1 = len(img) if y1 is None else y1
    rows, cols = {}, {}
    for y in range(y0, y1):
        row = img[y]
        for x in range(x0, x1):
            if not is_matte(row[x]):
                rows[y] = rows.get(y, 0) + 1
                cols[x] = cols.get(x, 0) + 1
    ys = [y for y, n in rows.items() if n >= min_count]
    xs = [x for x, n in cols.items() if n >= min_count]
    if not xs or not ys:
        return None
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def luma(p):
    return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]


def downscale(img, box, scale, out_w, out_h, ox, oy, clip=None):
    """Area-sample `box` of img into an out_w x out_h grid; (ox, oy) is where box's top-left lands.

    Each output pixel takes the per-channel median of its block (crisp, no blended shades), except
    when enough of the block is dark ink (eyes, line work) - then the ink wins, so features survive.
    """
    bx0, by0, bx1, by1 = box
    cx0, cy0, cx1, cy1 = clip or box
    by0c, by1c, bx0c, bx1c = max(by0, cy0), min(by1, cy1), max(bx0, cx0), min(bx1, cx1)
    out = [[None] * out_w for _ in range(out_h)]
    inv = 1 / scale
    for ty in range(out_h):
        sy0 = by0 + (ty - oy) * inv
        for tx in range(out_w):
            sx0 = bx0 + (tx - ox) * inv
            n = 0
            px = []
            for yy in range(int(sy0), int(sy0 + inv + 0.999)):
                for xx in range(int(sx0), int(sx0 + inv + 0.999)):
                    n += 1
                    if by0c <= yy < by1c and bx0c <= xx < bx1c:
                        p = img[yy][xx]
                        if not is_matte(p):
                            px.append(p)
            if not n or len(px) / n < 0.45:
                continue
            dark = [p for p in px if luma(p) < 72]
            pool = dark if len(dark) >= len(px) * 0.16 else px
            out[ty][tx] = tuple(sorted(q[c] for q in pool)[len(pool) // 2] for c in range(3))
    return out


def stylize(grid, sat=1.3, contrast=1.15):
    """Push saturation and contrast toward the punchy GandalfHardcore palette."""
    import colorsys
    for row in grid:
        for x, p in enumerate(row):
            if not p:
                continue
            h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in p))
            s = min(1, s * sat)
            l = min(1, max(0, (l - 0.5) * contrast + 0.5))
            row[x] = tuple(int(c * 255) for c in colorsys.hls_to_rgb(h, l, s))
    return grid


def kmeans_palette(grids, k, iters=10, seed=7):
    colors = [p for grid in grids for row in grid for p in row if p]
    rnd = random.Random(seed)
    sample = colors if len(colors) < 6000 else rnd.sample(colors, 6000)
    centers = rnd.sample(sample, min(k, len(sample)))
    for _ in range(iters):
        buckets = [[] for _ in centers]
        for c in sample:
            buckets[nearest(c, centers)].append(c)
        centers = [tuple(sum(ch) // len(bk) for ch in zip(*bk)) if bk else centers[i] for i, bk in enumerate(buckets)]
    return centers


def nearest(c, centers):
    best, bi = 1 << 30, 0
    for i, q in enumerate(centers):
        d = (c[0] - q[0]) ** 2 * 3 + (c[1] - q[1]) ** 2 * 4 + (c[2] - q[2]) ** 2 * 2
        if d < best:
            best, bi = d, i
    return bi


def outline_color(p):
    """Dark, hue-shifted (toward red/purple) version of a neighbouring colour."""
    r, g, b = p
    return (int(r * 0.32 + 18), int(g * 0.2 + 8), int(b * 0.28 + 16))


def shift_hue(h, target, t):
    """Move hue h toward target by fraction t along the shortest way round the wheel."""
    d = (target - h + 0.5) % 1 - 0.5
    return (h + d * t) % 1


def hue_shift_palette(palette):
    """Classic pixel-art ramps: shadows lean red/purple, highlights lean warm yellow."""
    import colorsys
    out = []
    for p in palette:
        h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in p))
        if l < 0.45:
            t = min(0.6, (0.45 - l) * 1.6)
            if 0.15 < h < 0.55:   # greens/cyans: shadows lean teal-blue, not purple (purple greys them)
                h, s = shift_hue(h, 0.5, t * 0.6), min(1, s * (1 + t * 0.8))
            else:
                h, s = shift_hue(h, 0.97, t), min(1, s * (1 + t * 0.5))
        elif l > 0.6:
            t = min(0.5, (l - 0.6) * 1.4)
            h = shift_hue(h, 0.12, t)
        out.append(tuple(int(c * 255) for c in colorsys.hls_to_rgb(h, l, s)))
    return out


def lighten(p, amount=0.11):
    import colorsys
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in p))
    h = shift_hue(h, 0.12, 0.25)
    return tuple(int(c * 255) for c in colorsys.hls_to_rgb(h, min(0.95, l + amount), s))


NEIGH4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
NEIGH8 = NEIGH4 + ((1, 1), (-1, -1), (1, -1), (-1, 1))


def despeckle(idx, palette):
    """Replace lone pixels (no same-colour neighbour) with their dominant neighbour colour.
    Dark ink pixels (eyes, line work) are kept."""
    h, w = len(idx), len(idx[0])
    out = [row[:] for row in idx]
    for y in range(h):
        for x in range(w):
            i = idx[y][x]
            if i is None or luma(palette[i]) < 72:
                continue
            counts = {}
            for dx, dy in NEIGH8:
                if 0 <= y + dy < h and 0 <= x + dx < w and idx[y + dy][x + dx] is not None:
                    j = idx[y + dy][x + dx]
                    counts[j] = counts.get(j, 0) + 1
            if counts.get(i, 0) == 0 and counts:
                j, c = max(counts.items(), key=lambda kv: kv[1])
                if c >= 3:
                    out[y][x] = j
    return out


def finish(grid, palette, style='v2'):
    """Quantize and add a coloured dark outline.
    style 'v2': plain (the approved look). 'v3': also hue-shifted ramps, lone-pixel cleanup, rim light."""
    v3 = style == 'v3'
    if v3:
        palette = hue_shift_palette(palette)
    h, w = len(grid), len(grid[0])
    idx = [[nearest(p, palette) if p else None for p in row] for row in grid]
    if v3:
        idx = despeckle(idx, palette)
    filled = lambda x, y: 0 <= y < h and 0 <= x < w and idx[y][x] is not None
    out = []
    for y in range(h):
        row = []
        for x in range(w):
            i = idx[y][x]
            if i is not None:
                p = palette[i]
                if v3 and not filled(x, y - 1) and luma(p) >= 72:
                    p = lighten(p)
                row.append((*p, 255))
                continue
            neigh = [palette[idx[y + dy][x + dx]] for dx, dy in NEIGH4 if filled(x + dx, y + dy)]
            if neigh:
                row.append((*outline_color(min(neigh, key=luma)), 255))
            else:
                row.append((0, 0, 0, 0))
        out.append(row)
    return out


def pixelize_single(src, height, colors, style='v2'):
    img = load_png(src)
    box = opaque_bbox(img)
    scale = (height - 2) / (box[3] - box[1])
    w = int((box[2] - box[0]) * scale) + 4
    grid = stylize(downscale(img, box, scale, w, height, 2, 1))
    return finish(grid, kmeans_palette([grid], colors), style)


def pixelize_sheets(manifests, height, colors, style='v2', ground_actions=()):
    """Convert several Spriterrific action sheets with ONE scale, palette and frame box.

    manifests: list of manifest.json paths. Scale is set so the first action's median frame
    stands `height` px tall (pass idle first). Frames of `ground_actions` (airborne poses drawn
    high in their cells) are shifted down so their lowest pixel sits on the shared ground line.
    Returns {action: (frames, meta)}.
    """
    import json
    import os
    actions = []
    for mpath in manifests:
        m = json.load(open(mpath))
        img = load_png(os.path.join(os.path.dirname(mpath), m['spritesheet']))
        cells = []
        for i in range(m['frames']):
            cx, cy = (i % m['columns']) * m['frameWidth'], (i // m['columns']) * m['frameHeight']
            cells.append((cx, cy, opaque_bbox(img, cx, cy, cx + m['frameWidth'], cy + m['frameHeight'], min_count=4)))
        actions.append((m, img, cells))

    # Ground line = lowest foot among the grounded actions; shift airborne frames onto it.
    # cells become (cx, cy, bbox shifted into ground-aligned space, shift)
    ground = max(b[3] - cy for m, _, cells in actions if m['action'] not in ground_actions for _, cy, b in cells)
    for k, (m, img, cells) in enumerate(actions):
        moved = []
        for cx, cy, b in cells:
            dy = ground - (b[3] - cy) if m['action'] in ground_actions else 0
            moved.append((cx, cy, (b[0], b[1] + dy, b[2], b[3] + dy), dy))
        actions[k] = (m, img, moved)

    # Shared scale from the first action's median standing height
    first = sorted(b[3] - b[1] for _, _, b, _ in actions[0][2])
    scale = (height - 2) / first[len(first) // 2]

    # Union box in cell-local coordinates across every frame of every action
    ux0 = min(b[0] - cx for _, _, cells in actions for cx, cy, b, _ in cells)
    uy0 = min(b[1] - cy for _, _, cells in actions for cx, cy, b, _ in cells)
    ux1 = max(b[2] - cx for _, _, cells in actions for cx, cy, b, _ in cells)
    uy1 = max(b[3] - cy for _, _, cells in actions for cx, cy, b, _ in cells)
    out_w = int((ux1 - ux0) * scale) + 4
    out_h = int((uy1 - uy0) * scale) + 3

    grids = {}
    for m, img, cells in actions:
        fw, fh = m['frameWidth'], m['frameHeight']
        grids[m['action']] = [
            stylize(downscale(img, (cx + ux0, cy + uy0 - dy, cx + ux1, cy + uy1 - dy), scale, out_w, out_h, 2, 1,
                              clip=(cx, cy, cx + fw, cy + fh)))
            for cx, cy, _, dy in cells]
    palette = kmeans_palette([g for gs in grids.values() for g in gs], colors)

    finished = {a: [finish(g, palette, style) for g in gs] for a, gs in grids.items()}
    bottom = max(y for fs in finished.values() for f in fs for y, row in enumerate(f) if any(p[3] for p in row))
    anchor_x = int((actions[0][0]['anchor']['x'] - ux0) * scale) + 2
    result = {}
    for m, _, _ in actions:
        meta = {'frameW': out_w, 'frameH': out_h, 'frames': m['frames'], 'fps': m['fps'],
                'anchorX': anchor_x, 'anchorY': bottom + 1}
        result[m['action']] = (finished[m['action']], meta)
    return result


def strip(frames):
    """Lay frames side by side in one row."""
    return [sum((f[y] for f in frames), []) for y in range(len(frames[0]))]


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['anchor', 'sheets'])
    ap.add_argument('src', help='anchor: input PNG. sheets: comma-separated manifest.json paths (idle first)')
    ap.add_argument('dst', help='anchor: output PNG. sheets: output folder')
    ap.add_argument('--height', type=int, default=64)
    ap.add_argument('--colors', type=int, default=16)
    ap.add_argument('--style', choices=['v2', 'v3'], default='v2')
    ap.add_argument('--prefix', default='ren')
    ap.add_argument('--ground', default='', help='sheets: comma-separated airborne actions to pin to the ground line')
    a = ap.parse_args()
    if a.mode == 'anchor':
        out = pixelize_single(a.src, a.height, a.colors, a.style)
        save_png(a.dst, out)
        print(f'saved {a.dst} {len(out[0])}x{len(out)}')
    else:
        import json
        import os
        os.makedirs(a.dst, exist_ok=True)
        metas = {}
        for action, (frames, meta) in pixelize_sheets(a.src.split(','), a.height, a.colors, a.style,
                                                       [g for g in a.ground.split(',') if g]).items():
            path = os.path.join(a.dst, f'{a.prefix}_{action}.png')
            save_png(path, strip(frames))
            metas[action] = meta
            print(f'saved {path} {meta}')
        json.dump(metas, open(os.path.join(a.dst, f'{a.prefix}_sheets.json'), 'w'), indent=2)
