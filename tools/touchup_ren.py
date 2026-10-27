"""Hand-pixelled face details for the converted Ren base image (facing right, 45x64).

    python tools/touchup_ren.py IN.png OUT.png
"""
import sys

from pixelize import load_png, save_png

# (x, y): colour. Eye is 2x3: lash line, iris with highlight, lower iris; plus a blush pixel.
FACE = {
    (36, 15): '2c1418', (37, 15): '2c1418',
    (36, 16): '6b2a16', (37, 16): 'fff4dc',
    (36, 17): 'c0622a', (37, 17): '8a3a1e',
    (38, 18): 'f0a08c',
}

img = load_png(sys.argv[1])
for (x, y), hexc in FACE.items():
    img[y][x] = (int(hexc[0:2], 16), int(hexc[2:4], 16), int(hexc[4:6], 16), 255)
save_png(sys.argv[2], img)
print('saved', sys.argv[2])
