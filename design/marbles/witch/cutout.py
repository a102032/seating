# The witch from the teacher's JPG: the white round her flood-filled from the edges and made see-through,
# its soft edge kept, so white inside her (none much) stays. Out: a WebP.
import sys
from PIL import Image, ImageFilter
import numpy as np
from collections import deque
src, out, width = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.int16)
h, w, _ = a.shape
# How far each pixel is from white.
d = 765 - a.sum(axis=2)
bg = np.zeros((h, w), bool)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if d[y, x] < 60: bg[y, x] = True; q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if d[y, x] < 60 and not bg[y, x]: bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and d[ny, nx] < 60:
            bg[ny, nx] = True; q.append((ny, nx))
alpha = np.where(bg, 0, 255).astype(np.uint8)
# A soft edge: pixels next to the background fade by how white they are.
edge = np.asarray(Image.fromarray(alpha).filter(ImageFilter.MinFilter(3))) < 255
soft = np.clip(d * 255 / 160, 0, 255).astype(np.uint8)
alpha = np.where(edge & ~bg, np.minimum(alpha, soft), alpha)
rgba = np.dstack([np.asarray(im), alpha])
img = Image.fromarray(rgba, 'RGBA')
img = img.crop(img.getbbox())
img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
img.save(out, 'WEBP', quality=88, method=6)
print(img.size)
