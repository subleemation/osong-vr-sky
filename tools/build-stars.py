"""Builds the star photo layer from NASA SVS Deep Star Maps 2020 (starmap_2020_8k.exr).

The star map is the whole sky photographed from Gaia/Hipparcos/Tycho data, stars and Milky Way together, in
equatorial coordinates (0h RA at the centre, RA increasing to the left), like milkyway_2020_*.exr. The Milky Way
already comes from assets/milkyway_4k.jpg, so here only the point-like stars are kept: a grey opening (a minimum
then maximum filter a few pixels wide) estimates the smooth background, and the stars are what stands above it.
An asinh stretch keeps faint stars visible without blowing out the bright ones; the shader thins them out again
by sky brightness. Outputs (equirectangular, same layout as milkyway_4k.jpg):
  assets/stars_8k_0.jpg, assets/stars_8k_1.jpg   8192x4096 split into two 4096x4096 halves (u < 0.5, u >= 0.5)
  assets/stars_4k.jpg                            4096x2048 for phones (2x2 blocks keep half of their peak so
                                                 small stars do not fade when shrunk)

usage: pip install openexr numpy pillow scipy
       python3 tools/build-stars.py starmap_2020_8k.exr
source: https://svs.gsfc.nasa.gov/4851 (NASA/GSFC Scientific Visualization Studio; Gaia DR2: ESA/Gaia/DPAC)
"""
import os
import sys

import numpy as np
import OpenEXR
from PIL import Image
from scipy import ndimage

src = sys.argv[1]
outdir = os.path.join(os.path.dirname(__file__), '..', 'assets')
rgb = OpenEXR.File(src).channels()['RGB'].pixels.astype(np.float32)
lum = rgb.mean(axis=2)

bg = ndimage.grey_opening(lum, size=(7, 7), mode='wrap')
bg = ndimage.gaussian_filter(bg, 1.5, mode='wrap')
star = np.clip(lum - bg, 0, None)

top = np.percentile(star, 99.997)  # the brightest few hundred stars reach white
soft = 0.025
v = np.arcsinh(np.clip(star / top, 0, None) / soft) / np.arcsinh(1 / soft)
v = np.clip(v, 0, 1)
# star colour from the photo, pulled halfway to white (the eye sees star colours only faintly)
ratio = rgb / np.maximum(lum, 1e-6)[..., None]
ratio = 1 + (np.clip(ratio, 0.4, 1.8) - 1) * 0.5
img = np.clip(v[..., None] * ratio / ratio.max(axis=2, keepdims=True), 0, 1)
img8 = (img * 255 + 0.5).astype(np.uint8)

h, w = img8.shape[:2]
for i in range(2):
    p = os.path.join(outdir, 'stars_8k_%d.jpg' % i)
    Image.fromarray(img8[:, i * w // 2:(i + 1) * w // 2]).save(p, quality=88, optimize=True)
    print(p, os.path.getsize(p) // 1024, 'KB')
blk = img.reshape(h // 2, 2, w // 2, 2, 3)
small = 0.5 * blk.mean(axis=(1, 3)) + 0.5 * blk.max(axis=(1, 3))
p = os.path.join(outdir, 'stars_4k.jpg')
Image.fromarray((np.clip(small, 0, 1) * 255 + 0.5).astype(np.uint8)).save(p, quality=88, optimize=True)
print(p, os.path.getsize(p) // 1024, 'KB')
