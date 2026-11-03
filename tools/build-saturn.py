# Saturn photo for the telescope scene: Hubble, 24 Feb 2009, rings nearly edge-on as they are in 2026.
# Source: https://esahubble.org/images/heic0904a/ (large JPEG). Credit: NASA, ESA and the Hubble Heritage Team (STScI/AURA), CC BY 4.0
# usage: python3 tools/build-saturn.py heic0904a.jpg assets/saturn.webp
import sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(float) / 255
m = a.max(2)
ys, xs = np.where(m > 0.08)
pad = 40
a = a[max(0, ys.min() - pad):ys.max() + pad, max(0, xs.min() - pad):xs.max() + pad]
m = a.max(2)
# black sky -> transparent: opacity from brightness, colour un-premultiplied
t = np.clip((m - 0.02) / 0.12, 0, 1)
alpha = t * t * (3 - 2 * t)
# colour chosen so that laying it over black gives back the original pixel
rgb = np.clip(a / np.maximum(alpha, 1e-3)[..., None], 0, 1)
img = Image.fromarray((np.dstack([rgb, alpha]) * 255).round().astype('uint8'), 'RGBA')
w = 1024
img = img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
img.save(out, 'WEBP', quality=88, method=6)
print(out, img.size)
