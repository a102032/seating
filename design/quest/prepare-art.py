"""Turn the teacher's Flow pictures (design/quest/flow) into the Quest's pieces for the app.

    python3 -m venv /tmp/qv && /tmp/qv/bin/pip install vtracer pillow numpy
    /tmp/qv/bin/python -I design/quest/prepare-art.py design/quest/flow <out folder>

What it makes, and why each step is there (design/quest/STYLE.md has the story):
- The dragon's poses and the knight, cut out of Flow's white and traced to SVG, so they stay sharp on a 4K board.
  The white is flooded in from the edges, and white the drawing encloses (under a wing, between legs) goes too.
  The cut is pulled in two pixels, or the JPEG's soft edge against white traces as a pale halo on the parchment.
  Each picture is flattened to a few exact colours first: traced as it comes, JPEG noise makes hundreds of shapes.
- The guard pose has Flow's chest taken out (it is drawn with outlines and wood grain, unlike the app's), so the
  app's own chest goes under the paw.
- The sleeping dragon came out with a green belly and yellow spikes; it is recoloured to match the other poses.
- The landmarks are line art: the darker the ink, the more solid, so they sit on the parchment in the map's own ink.
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
import vtracer
from PIL import Image

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
RNG = np.random.default_rng(2)
MAP_INK = np.array([0x8A, 0x5A, 0x2B])


def flood(mask, seeds):
    """Every pixel of `mask` joined to one of `seeds`."""
    h, w = mask.shape
    out = np.zeros((h, w), bool)
    q = deque()
    for y, x in seeds:
        if mask[y, x] and not out[y, x]:
            out[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out


def cutout(a):
    """What is the picture, not Flow's white background."""
    h, w, _ = a.shape
    near = a.min(axis=2) > 225  # the JPEG leaves the white a little noisy
    edge = [(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)]
    bg = flood(near, edge)
    # White the drawing encloses is background too; small white bits (an eye's shine) stay.
    white = (a.min(axis=2) > 232) & ~bg
    seen = np.zeros((h, w), bool)
    for y0, x0 in zip(*np.nonzero(white)):
        if seen[y0, x0]:
            continue
        comp = flood(white, [(y0, x0)])
        seen |= comp
        if comp.sum() > 600:
            bg |= comp
    keep = ~bg
    for _ in range(2):  # the pale halo
        k = keep.copy()
        k[1:, :] &= keep[:-1, :]
        k[:-1, :] &= keep[1:, :]
        k[:, 1:] &= keep[:, :-1]
        k[:, :-1] &= keep[:, 1:]
        keep = k
    return keep


def kmeans(x, k, iters=25):
    c = x[RNG.choice(len(x), k, replace=False)].astype(float)
    for _ in range(iters):
        lab = ((x[:, None, :] - c[None]) ** 2).sum(-1).argmin(1)
        for j in range(k):
            if (lab == j).any():
                c[j] = x[lab == j].mean(0)
    return c


def flatten(a, keep, k):
    """The picture in `k` exact colours, and which colour each pixel took."""
    px = a[keep]
    cent = kmeans(px[RNG.choice(len(px), min(30000, len(px)), replace=False)], k)
    lab = ((a[..., None, :] - cent[None, None]) ** 2).sum(-1).argmin(-1)
    return cent, lab


def save(name, rgb, keep):
    ys, xs = np.nonzero(keep)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    rgba = np.dstack([rgb, np.where(keep, 255, 0)]).astype(np.uint8)
    Image.fromarray(rgba).crop(box).save(OUT / f'{name}.png')
    vtracer.convert_image_to_svg_py(str(OUT / f'{name}.png'), str(OUT / f'{name}.svg'), colormode='color',
                                    mode='spline', filter_speckle=8, color_precision=8, layer_difference=4,
                                    corner_threshold=60, path_precision=2)
    svg = (OUT / f'{name}.svg').read_text()
    print(f'{name}: {box[2] - box[0]}x{box[3] - box[1]}, {svg.count("<path")} shapes, {len(svg) // 1024} KB')


def nearest(cent, colour):
    return int(((cent - np.array(colour)) ** 2).sum(1).argmin())


for name, file in [('dragon-guard', 'dragon-guard-chest.jpg'), ('dragon-holding-key', 'dragon-holding-key.jpg'),
                   ('dragon-palm-up', 'dragon-palm-up.jpg'),
                   ('dragon-out-of-puff', 'dragon-out-of-puff.jpg'), ('dragon-asleep', 'dragon-asleep.jpg'),
                   ('knight', 'knight.webp')]:
    im = Image.open(SRC / file).convert('RGB')
    a = np.asarray(im).astype(int)
    keep = cutout(a)
    if name == 'dragon-guard':
        # Flow's chest: everything in its box below the paw, and its brown between the claws.
        hsv = np.asarray(im.convert('HSV')).astype(float)
        hh, ss, vv = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
        box = np.zeros(keep.shape, bool)
        box[468:735, 765:1095] = True
        keep &= ~(box & (((hh > 10) & (hh < 52) & (vv < 0.72)) | (ss < 0.22)))
        keep[528:735, 765:1095] = False
        # Bits of the chest's lid left between the claws: anything no longer joined to the dragon goes.
        ys, xs = np.nonzero(keep)
        mid = len(ys) // 2
        keep = flood(keep, [(ys[mid], xs[mid])]) | (keep & ~box)
    cent, lab = flatten(a, keep, 10)
    rgb = cent[lab]
    if name == 'dragon-asleep':
        # Its spikes orange and the belly's light green yellow; the head, at the left, keeps its gold horns and green chin.
        yy, xx = np.mgrid[0:lab.shape[0], 0:lab.shape[1]]
        rgb[(lab == nearest(cent, (0xCF, 0xB7, 0x5B))) & (xx > 520)] = (0xE3, 0x97, 0x3A)
        rgb[(lab == nearest(cent, (0x7B, 0xAD, 0x75))) & (yy > 385) & (xx > 520)] = (0xE6, 0xC4, 0x5A)
    save(name, rgb, keep)

# The landmarks, one picture each, in the map's ink.
ink = np.asarray(Image.open(SRC / 'landmarks.jpg').convert('L')).astype(float)
alpha = np.clip((235 - ink) / 170, 0, 1)
for name, (x0, y0, x1, y1) in {'castle': (60, 20, 380, 350), 'forest': (480, 60, 840, 330),
                               'hills': (930, 80, 1320, 270), 'bridge': (810, 280, 1120, 470),
                               'windmill': (100, 400, 340, 720), 'signpost': (570, 440, 810, 720),
                               'mountain-cave': (980, 440, 1330, 720)}.items():
    al = alpha[y0:y1, x0:x1]
    ys, xs = np.nonzero(al > 0.05)
    al = al[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(np.dstack([np.broadcast_to(MAP_INK, al.shape + (3,)), al * 255]).astype(np.uint8)).save(
        OUT / f'landmark-{name}.png')
    print(f'landmark-{name}: {al.shape[1]}x{al.shape[0]}')

# What the app loads (public/quest): the pieces Our Quest shows, as WebP. The traced SVGs are 100 to 300 KB of paths
# a weak board redraws as the map slides in; a WebP twice the size it is shown at is 4 to 50 KB and stays sharp.
for name, width in [('dragon-asleep', 900), ('knight', 560)] + [(f'landmark-{n}', 0) for n in
                    ('castle', 'forest', 'hills', 'bridge', 'mountain-cave', 'windmill', 'signpost')]:
    im = Image.open(OUT / f'{name}.png').convert('RGBA')
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT / f'{name}.webp', 'WEBP', quality=88, method=6)
