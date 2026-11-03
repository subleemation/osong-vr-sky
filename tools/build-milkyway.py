"""Builds assets/milkyway_4k.jpg from NASA SVS Deep Star Maps 2020 (milkyway_2020_4k.exr).

The EXR is the Milky Way without the bright Hipparcos/Tycho stars, in equatorial coordinates,
0h RA at the centre with RA increasing to the left. We stretch the linear HDR values with an
asinh curve so the faint outer band stays visible while the core does not clip.

usage: pip install openexr numpy pillow
       python3 tools/build-milkyway.py milkyway_2020_4k.exr
source: https://svs.gsfc.nasa.gov/4851 (NASA/GSFC Scientific Visualization Studio, public domain)
"""
import os
import sys

import numpy as np
import OpenEXR
from PIL import Image, ImageFilter

src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'milkyway_4k.jpg')
rgb = OpenEXR.File(src).channels()['RGB'].pixels.astype(np.float32)

lum = rgb.mean(axis=2)
floor = np.percentile(lum, 35)      # dark sky between the dust clouds stays black
top = np.percentile(lum, 99.85)    # brightest star clouds in Sagittarius / Cygnus
x = np.clip((rgb - floor) / (top - floor), 0, None)
soft = 0.22
img = np.arcsinh(x / soft) / np.arcsinh(1 / soft)
# keep a little of the natural colour but pull it toward neutral; the eye sees the Milky Way nearly grey
grey = img.mean(axis=2, keepdims=True)
img = grey + (img - grey) * 0.45
img = np.clip(img, 0, 1) ** 1.15
Image.fromarray((img * 255 + 0.5).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)).save(out, quality=86, optimize=True, progressive=True)
print(out, os.path.getsize(out) // 1024, 'KB')
