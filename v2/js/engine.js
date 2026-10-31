// Sky renderer. Draws one flat view or two lens-corrected VR views per frame.
// The app owns input, camera and UI state; everything it wants drawn is passed in render(opts).
var SkyEngine = function (canvas, glCanvas) {
  'use strict';
  var S = window.SKY, C = SkyCore, D2R = C.D2R, K = CONTENT;
  var ctx = canvas.getContext('2d');


  var SERIF = '"Nanum Myeongjo", "AppleMyungjo", "Batang", serif';
  var SANS = '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  var MONO = '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';

  // ---------- precompute ----------
  var NS = S.stars.length / 4;
  var SV = new Float32Array(NS * 3), SM = new Float32Array(NS), SB = new Uint8Array(NS);
  for (var i = 0; i < NS; i++) {
    var v = C.radec2vec(S.stars[4 * i], S.stars[4 * i + 1]);
    SV[3 * i] = v[0]; SV[3 * i + 1] = v[1]; SV[3 * i + 2] = v[2];
    SM[i] = S.stars[4 * i + 2];
    var bv = S.stars[4 * i + 3];
    SB[i] = bv < 0 ? 0 : bv < 0.3 ? 1 : bv < 0.6 ? 2 : bv < 0.9 ? 3 : bv < 1.3 ? 4 : 5;
  }
  // colour temperature, kept close to white: real stars only show a hint of colour to the eye
  var STAR_RGB = [[196, 212, 255], [222, 230, 255], [255, 250, 240], [255, 242, 214], [255, 224, 182], [255, 204, 160]];
  var sprites = STAR_RGB.map(function (c) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 128;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    var rgb = c.join(',');
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.16, 'rgba(255,255,255,1)');
    gr.addColorStop(0.26, 'rgba(' + rgb + ',1)');
    gr.addColorStop(0.36, 'rgba(' + rgb + ',0.4)');
    gr.addColorStop(0.55, 'rgba(' + rgb + ',0.08)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return cv;
  });
  var namedIdx = {};
  S.named.forEach(function (n) { namedIdx[n[0]] = n[1]; });
  var LINES = [];
  Object.keys(S.lines).forEach(function (id) {
    S.lines[id].forEach(function (seg) {
      var pts = [];
      for (var k = 0; k < seg.length; k += 2) pts.push(C.radec2vec(seg[k], seg[k + 1]));
      LINES.push({ id: id, pts: pts });
    });
  });
  var CONS = [], seen = {};
  S.cons.forEach(function (c) {
    if (seen[c.ko]) return; seen[c.ko] = 1;
    CONS.push({ id: c.id, ko: c.ko, rank: c.rank, v: C.radec2vec(c.ra, c.dec), info: K.CONS_INFO[c.id] || '', verts: [] });
  });
  // gaze picks a constellation by its nearest stick-figure star, so big ones like Pegasus respond anywhere on the figure
  CONS.forEach(function (c) {
    LINES.forEach(function (l) { if (l.id === c.id) c.verts = c.verts.concat(l.pts); });
  });
  var CONS_BY_ID = {};
  CONS.forEach(function (c) { CONS_BY_ID[c.id] = c; });
  // Milky Way as a cloud of sample points: each level of the contour data adds brightness.
  // A point is inside a level when a meridian from it to the north pole crosses that level's rings an odd number of times.
  var MWP = (function () {
    var STEP = 1.3, levels = S.mw.length, bins = [];
    for (var L = 0; L < levels; L++) {
      var b = []; for (var q = 0; q < 360; q++) b.push([]);
      S.mw[L].forEach(function (ring) {
        var n = ring.length / 2;
        for (var k = 0; k < n; k++) {
          var r1 = ring[2 * k], d1 = ring[2 * k + 1], r2 = ring[2 * ((k + 1) % n)], d2 = ring[2 * ((k + 1) % n) + 1];
          var dr = ((r2 - r1 + 540) % 360) - 180;
          var lo = Math.floor(Math.min(r1, r1 + dr)), hi = Math.floor(Math.max(r1, r1 + dr));
          var e = [r1, d1, dr, d2 - d1];
          for (var x = lo; x <= hi; x++) b[((x % 360) + 360) % 360].push(e);
        }
      });
      bins.push(b);
    }
    function inside(L, ra, dec) {
      var list = bins[L][Math.floor(ra) % 360], c = 0;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e[2] === 0) continue;
        var t = (((ra - e[0] + 540) % 360) - 180) / e[2];
        if (t < 0 || t >= 1) continue;
        if (e[1] + e[3] * t > dec) c++;
      }
      return c & 1;
    }
    var pts = [], lv = [];
    for (var dec = -88; dec <= 88; dec += STEP) {
      var dra = STEP / Math.max(0.05, Math.cos(dec * D2R));
      for (var ra = ((dec * 7.3) % dra + dra) % dra; ra < 360; ra += dra) {
        var n = 0;
        for (var L2 = 0; L2 < levels; L2++) n += inside(L2, ra, dec);
        if (n) { var v = C.radec2vec(ra, dec); pts.push(v[0], v[1], v[2]); lv.push(n); }
      }
    }
    return { v: new Float32Array(pts), lv: new Uint8Array(lv), step: STEP * D2R, levels: levels };
  })();
  var DSO = K.DSO.map(function (d) { return { name: d.name, text: d.text, v: C.radec2vec(d.ra, d.dec) }; });
  // constellation illustrations (Johan Meuris / Stellarium), loaded on first use and tinted warm
  var ART = window.FIGURE_ART || {};
  function artFor(id) {
    var A = ART[id]; if (!A) return null;
    if (A.ready) return A;
    if (!A.loading) {
      A.loading = true;
      var im = new Image();
      im.onload = function () {
        var cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
        var g = cv.getContext('2d');
        g.drawImage(im, 0, 0);
        // grey line work on black -> warm ivory with brightness as opacity, so the black background is truly transparent
        var d = g.getImageData(0, 0, cv.width, cv.height), px = d.data;
        for (var q = 0; q < px.length; q += 4) {
          var l = Math.max(px[q], px[q + 1], px[q + 2]) * px[q + 3] / 255;
          px[q] = 242; px[q + 1] = 224; px[q + 2] = 192; px[q + 3] = l;
        }
        g.putImageData(d, 0, 0);
        A.canvas = cv; setupArt(A, im.naturalWidth / A.size[0]); A.ready = true;
      };
      im.src = A.file;
    }
    return null;
  }
  // image pixels -> sky: an affine map onto the tangent plane fixed by the three anchor stars, sampled on a grid
  var ART_N = 10;
  function setupArt(A, scale) {
    var vs = A.anchors.map(function (a) { return C.radec2vec(a[2], a[3]); });
    var c = norm([vs[0][0] + vs[1][0] + vs[2][0], vs[0][1] + vs[1][1] + vs[2][1], vs[0][2] + vs[1][2] + vs[2][2]]);
    var e1 = norm(cross([0, 0, 1], c)); if (!isFinite(e1[0])) e1 = [1, 0, 0];
    var e2 = cross(c, e1);
    var T = vs.map(function (v) { var d = v[0] * c[0] + v[1] * c[1] + v[2] * c[2]; var t = [v[0] / d, v[1] / d, v[2] / d]; return [t[0] * e1[0] + t[1] * e1[1] + t[2] * e1[2], t[0] * e2[0] + t[1] * e2[1] + t[2] * e2[2]]; });
    var S = A.anchors.map(function (a) { return [a[0] * scale, a[1] * scale]; });
    var m = affine(S[0], S[1], S[2], T[0], T[1], T[2]);
    var W = A.canvas.width, H = A.canvas.height, grid = [];
    for (var j = 0; j <= ART_N; j++) for (var i = 0; i <= ART_N; i++) {
      var px = i / ART_N * W, py = j / ART_N * H;
      var X = m[0] * px + m[2] * py + m[4], Y = m[1] * px + m[3] * py + m[5];
      grid.push(norm([c[0] + X * e1[0] + Y * e2[0], c[1] + X * e1[1] + Y * e2[1], c[2] + X * e1[2] + Y * e2[2]]));
    }
    A.grid = grid; A.W = W; A.H = H;
  }
  // affine [a,b,c,d,e,f] (canvas order) taking s0,s1,s2 to d0,d1,d2
  function affine(s0, s1, s2, d0, d1, d2) {
    var x1 = s1[0] - s0[0], y1 = s1[1] - s0[1], x2 = s2[0] - s0[0], y2 = s2[1] - s0[1];
    var det = x1 * y2 - x2 * y1; if (Math.abs(det) < 1e-9) return null;
    var u1 = d1[0] - d0[0], v1 = d1[1] - d0[1], u2 = d2[0] - d0[0], v2 = d2[1] - d0[1];
    var a = (u1 * y2 - u2 * y1) / det, cc = (u2 * x1 - u1 * x2) / det;
    var b = (v1 * y2 - v2 * y1) / det, d = (v2 * x1 - v1 * x2) / det;
    return [a, b, cc, d, d0[0] - a * s0[0] - cc * s0[1], d0[1] - b * s0[0] - d * s0[1]];
  }

  // horizon silhouette: low tree line with a few blocks of buildings toward Osong station (north-east)
  // horizon silhouette, one height (degrees) every half degree of azimuth
  var TREE = new Float32Array(721);
  (function () {
    function noise(x) { // smooth 1D value noise
      var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
      function h(n) { var y = Math.sin(n * 127.1 + 311.7) * 43758.5453; return y - Math.floor(y); }
      return h(i) * (1 - u) + h(i + 1) * u;
    }
    for (var k = 0; k <= 720; k++) {
      var az = k / 2;
      // park trees: rounded crowns of different sizes
      TREE[k] = 0.9 + 0.7 * noise(az / 24) + 0.45 * noise(az / 7 + 11) + 0.35 * Math.sqrt(noise(az / 1.3 + 5)) + 0.12 * noise(az * 1.7);
    }
    TREE[720] = TREE[0];
  })();

  // ---------- helpers ----------
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function enuFromAltAz(alt, az) {
    var a = az * D2R, h = alt * D2R;
    return [Math.sin(a) * Math.cos(h), Math.cos(a) * Math.cos(h), Math.sin(h)];
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function setSpacing(px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  var wrapCache = {};
  function wrapLines(text, maxW, font) {
    var key = font + '|' + Math.round(maxW) + '|' + text;
    if (wrapCache[key]) return wrapCache[key];
    ctx.font = font;
    var words = text.split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; } else cur = test;
    }
    if (cur) lines.push(cur);
    return (wrapCache[key] = lines);
  }
  // auto-scroll position for an info card: wait, glide to the end, hold, then start over
  function scrollOffset(t, overflow, speed) {
    if (overflow <= 1) return 0;
    var wait = 2.6, hold = 3.2, run = overflow / speed, cycle = wait + run + hold + 0.6;
    var u = t % cycle;
    if (u < wait) return 0;
    if (u < wait + run) { var x = (u - wait) / run; return overflow * (0.85 * x + 0.15 * x * x * (3 - 2 * x)); }
    return u < wait + run + hold ? overflow : -1; // -1: fading back to the top
  }

  // ---------- per-frame shared state ----------
  var frame = null, cam = null, opts = null, now = 0;
  function computeFrame(minutes, camera) {
    var M = C.eqjToEnu(S, minutes);
    cam = camera;
    var rows = [cam.r, cam.u, cam.f], T = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++)
      T[a][b] = rows[a][0] * M[0][b] + rows[a][1] * M[1][b] + rows[a][2] * M[2][b];
    var sun = C.apply(M, C.radec2vec.apply(null, C.bodyRaDec(S, 'Sun', minutes)));
    var sunAlt = Math.asin(sun[2]) / D2R;
    var twiLim = sunAlt >= -6 ? 1.0 : sunAlt <= -18 ? 6.5 : 1.0 + (-6 - sunAlt) / 12 * 5.5;
    var bodies = [];
    ['Saturn', 'Uranus', 'Neptune', 'Jupiter', 'Mars', 'Venus', 'Mercury', 'Moon'].forEach(function (b) {
      var v = C.radec2vec.apply(null, C.bodyRaDec(S, b, minutes));
      var e = C.apply(M, v);
      if (e[2] > 0) bodies.push({ key: b, v: v, enu: e, mag: S.planets[b].mag });
    });
    frame = { M: M, T: T, sunEnu: sun, sunAlt: sunAlt, twiLim: twiLim, dark: clamp((-sunAlt - 10) / 8, 0, 1), bodies: bodies };
    return frame;
  }
  function toCam(v, out) {
    var T = frame.T;
    out[0] = T[0][0] * v[0] + T[0][1] * v[1] + T[0][2] * v[2];
    out[1] = T[1][0] * v[0] + T[1][1] * v[1] + T[1][2] * v[2];
    out[2] = T[2][0] * v[0] + T[2][1] * v[1] + T[2][2] * v[2];
    return out;
  }
  function enuToCam(e, out) {
    out[0] = e[0] * cam.r[0] + e[1] * cam.r[1] + e[2] * cam.r[2];
    out[1] = e[0] * cam.u[0] + e[1] * cam.u[1] + e[2] * cam.u[2];
    out[2] = e[0] * cam.f[0] + e[1] * cam.f[1] + e[2] * cam.f[2];
    return out;
  }
  function altOf(v) { var M = frame.M; return M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]; }

  // view: {cx, cy, f, R, k, clip:[x,y,w,h], vr, font}
  function proj(view, x, y, z, out) {
    if (z < 0.1) return false;
    var px = x / z * view.f, py = -y / z * view.f;
    if (view.k > 0) {
      var s = 1 / Math.sqrt(1 + view.k * (px * px + py * py) / (view.R * view.R));
      px *= s; py *= s;
    }
    out[0] = view.cx + px; out[1] = view.cy + py;
    return true;
  }
  function distortPlane(view, px, py, out) {
    if (view.k > 0) {
      var s = 1 / Math.sqrt(1 + view.k * (px * px + py * py) / (view.R * view.R));
      px *= s; py *= s;
    }
    out[0] = view.cx + px; out[1] = view.cy + py;
  }
  var P = [0, 0], CV = [0, 0, 0], CV2 = [0, 0, 0];

  // clip a camera-space polygon to z >= 0.1 and add it to the current path
  function polyCam(view, pts) {
    var out = [], n = pts.length;
    for (var k = 0; k < n; k++) {
      var a = pts[k], b = pts[(k + 1) % n], ina = a[2] >= 0.1, inb = b[2] >= 0.1;
      if (ina) out.push(a);
      if (ina !== inb) {
        var t = (0.1 - a[2]) / (b[2] - a[2]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.1]);
      }
    }
    if (out.length < 3) return;
    for (var j = 0; j < out.length; j++) {
      proj(view, out[j][0], out[j][1], out[j][2], P);
      if (j === 0) ctx.moveTo(P[0], P[1]); else ctx.lineTo(P[0], P[1]);
    }
    ctx.closePath();
  }
  // add an altitude band [a0, a1] (degrees) between azimuths z0..z1 to the current path, as small quads
  function bandPath(view, a0, a1, z0, z1, step, heights) {
    for (var az = z0; az < z1; az += step) {
      var b = Math.min(z1, az + step);
      var h0 = heights ? heights[Math.round(az * 2) % 720] : a1, h1 = heights ? heights[Math.round(b * 2) % 720] : a1;
      polyCam(view, [
        enuToCam(enuFromAltAz(a0, az), [0, 0, 0]), enuToCam(enuFromAltAz(a0, b), [0, 0, 0]),
        enuToCam(enuFromAltAz(h1, b), [0, 0, 0]), enuToCam(enuFromAltAz(h0, az), [0, 0, 0])
      ]);
    }
  }
  function segPath(view, a, b, sub) {
    var za = a[2], zb = b[2], ax = a[0], ay = a[1], bx = b[0], by = b[1];
    if (za < 0.1 && zb < 0.1) return;
    if (za < 0.1) { var t = (0.1 - za) / (zb - za); ax += (bx - ax) * t; ay += (by - ay) * t; za = 0.1; }
    else if (zb < 0.1) { var t2 = (0.1 - zb) / (za - zb); bx += (ax - bx) * t2; by += (ay - by) * t2; zb = 0.1; }
    var n = view.k > 0 ? sub : 1;
    for (var s = 0; s <= n; s++) {
      var u = s / n;
      proj(view, ax + (bx - ax) * u, ay + (by - ay) * u, za + (zb - za) * u, P);
      if (s === 0) ctx.moveTo(P[0], P[1]); else ctx.lineTo(P[0], P[1]);
    }
  }
  // stick-figure lines stop just short of each star, the way printed atlases draw them
  function consLinePath(view, pts, gapRad) {
    for (var k = 1; k < pts.length; k++) {
      var a = pts[k - 1], b = pts[k];
      var th = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
      var t = th > 0 ? Math.min(0.3, gapRad / th) : 0;
      var a2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      var b2 = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, b[2] + (a[2] - b[2]) * t];
      toCam(a2, CV); toCam(b2, CV2);
      segPath(view, CV, CV2, 6);
    }
  }

  // ---------- layers ----------
  function skyBase(view) {
    var t = clamp((-frame.sunAlt - 4) / 14, 0, 1);
    var top = [Math.round(30 - 25 * t), Math.round(44 - 37 * t), Math.round(78 - 64 * t)];
    if (!GL) { // with WebGL the base colour comes from the background layer
      ctx.fillStyle = 'rgb(' + top.join(',') + ')';
      ctx.fillRect(view.clip[0], view.clip[1], view.clip[2], view.clip[3]);
    }
    // brighter, slightly warm air toward the horizon (thicker atmosphere + town lights)
    if (GL) { twilight(view); return; }
    var bands = [[0, 3, 0.34], [3, 7, 0.24], [7, 12, 0.15], [12, 20, 0.09], [20, 32, 0.045]];
    var glow = 'rgba(' + Math.round(70 - 30 * t) + ',' + Math.round(72 - 34 * t) + ',' + Math.round(96 - 52 * t) + ',';
    for (var bi = 0; bi < bands.length; bi++) {
      ctx.beginPath(); bandPath(view, bands[bi][0], bands[bi][1], 0, 360, 10);
      ctx.fillStyle = glow + bands[bi][2] + ')'; ctx.fill();
    }
    // Cheongju and Osong light domes, east and north-east
    var dome = [[0, 4, 0.22], [4, 9, 0.12], [9, 16, 0.05]];
    for (var di = 0; di < dome.length; di++) {
      ctx.beginPath(); bandPath(view, dome[di][0], dome[di][1], 30, 120, 6);
      ctx.fillStyle = 'rgba(120,92,70,' + dome[di][2] * (0.4 + 0.6 * t) + ')'; ctx.fill();
    }
    twilight(view);
  }
  function twilight(view) {
    var glowA = frame.sunAlt > -4 ? 0.75 : frame.sunAlt < -18 ? 0 : 0.75 * (frame.sunAlt + 18) / 14;
    if (glowA > 0.01) {
      enuToCam(frame.sunEnu, CV);
      if (CV[2] > 0.12 && proj(view, CV[0], CV[1], CV[2], P)) {
        var rad = view.f * 2.3, g = ctx.createRadialGradient(P[0], P[1], 0, P[0], P[1], rad);
        g.addColorStop(0, 'rgba(236,140,86,' + glowA + ')');
        g.addColorStop(0.3, 'rgba(170,96,100,' + glowA * 0.42 + ')');
        g.addColorStop(1, 'rgba(40,46,110,0)');
        ctx.fillStyle = g;
        ctx.fillRect(view.clip[0], view.clip[1], view.clip[2], view.clip[3]);
      }
    }
  }

  var mwCanvas = document.createElement('canvas'), mwCtx = mwCanvas.getContext('2d');
  var HAS_FILTER = 'filter' in ctx && typeof ctx.filter === 'string';
  function milkyWay(view, limit) {
    var a = frame.dark * (limit >= 6 ? 1 : limit >= 4.5 ? 0.55 : 0.16);
    if (a < 0.02) return;
    // splat the sample points onto a canvas at 1/7 size, then scale it up: the softness comes for free
    var sc = 1 / 7, w = Math.ceil(view.clip[2] * sc), h = Math.ceil(view.clip[3] * sc);
    if (mwCanvas.width !== w || mwCanvas.height !== h) { mwCanvas.width = w; mwCanvas.height = h; }
    var cx = (view.cx - view.clip[0]) * sc, cy = (view.cy - view.clip[1]) * sc, f = view.f * sc, R2 = view.R * view.R * sc * sc;
    mwCtx.setTransform(1, 0, 0, 1, 0, 0);
    mwCtx.clearRect(0, 0, w, h);
    var T = frame.T, V = MWP.v, LV = MWP.lv, n = LV.length, base = MWP.step * f * 2.1;
    for (var lev = 1; lev <= MWP.levels; lev++) {
      mwCtx.fillStyle = 'rgba(214,216,232,' + (0.09 + 0.015 * lev) + ')';
      for (var i = 0; i < n; i++) {
        if (LV[i] < lev) continue;
        var x = V[3 * i], y = V[3 * i + 1], z = V[3 * i + 2];
        var cz = T[2][0] * x + T[2][1] * y + T[2][2] * z;
        if (cz < 0.15) continue;
        var px = (T[0][0] * x + T[0][1] * y + T[0][2] * z) / cz * f, py = -(T[1][0] * x + T[1][1] * y + T[1][2] * z) / cz * f;
        var s = base / cz;
        if (view.k > 0) { var kk = 1 / Math.sqrt(1 + view.k * (px * px + py * py) / R2); px *= kk; py *= kk; s *= kk; }
        px += cx; py += cy;
        if (px < -s || py < -s || px > w + s || py > h + s) continue;
        mwCtx.fillRect(px - s / 2, py - s / 2, s, s);
      }
    }
    ctx.save();
    ctx.globalAlpha = a * 0.5; ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    if (HAS_FILTER) ctx.filter = 'blur(' + Math.round(6 / sc * 0.35) + 'px)';
    ctx.drawImage(mwCanvas, 0, 0, w, h, view.clip[0], view.clip[1], w / sc, h / sc);
    ctx.restore();
  }

  function drawFigure(view, id, p, alpha) {
    var A = artFor(id); if (!A) return;
    var a = alpha * clamp(p, 0, 1); if (a < 0.01) return;
    var N = ART_N, sp = [], ok = [];
    for (var k = 0; k < A.grid.length; k++) {
      toCam(A.grid[k], CV);
      ok[k] = proj(view, CV[0], CV[1], CV[2], P);
      sp[k] = [P[0], P[1]];
    }
    if (GL && GL.hasArt) { // WebGL: one seamless mesh in the sky layer
      var tris = [];
      for (var gj = 0; gj < N; gj++) for (var gi = 0; gi < N; gi++) {
        var q00 = gj * (N + 1) + gi, q10 = q00 + 1, q01 = q00 + N + 1, q11 = q01 + 1;
        if (!(ok[q00] && ok[q10] && ok[q01] && ok[q11])) continue;
        var u0 = gi / N, u1 = (gi + 1) / N, v0 = gj / N, v1 = (gj + 1) / N;
        tris.push(sp[q00][0], sp[q00][1], u0, v0, sp[q10][0], sp[q10][1], u1, v0, sp[q01][0], sp[q01][1], u0, v1,
                  sp[q10][0], sp[q10][1], u1, v0, sp[q11][0], sp[q11][1], u1, v1, sp[q01][0], sp[q01][1], u0, v1);
      }
      if (tris.length) artQueue.push({ key: id, img: A.canvas, tris: new Float32Array(tris), alpha: a * (view.vr ? 1.4 : 0.62), clip: view.clip });
      return;
    }
    var cw = A.W / N, ch = A.H / N, cl = view.clip;
    // draw the mesh opaque into a scratch layer (overlapping edges then look seamless), then lay it on once
    var pw = Math.ceil(cl[2] * DPR), ph = Math.ceil(cl[3] * DPR);
    if (artLayer.width !== pw || artLayer.height !== ph) { artLayer.width = pw; artLayer.height = ph; }
    var main = ctx; ctx = artCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, pw, ph);
    artOff = [cl[0], cl[1]];
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var i00 = j * (N + 1) + i, i10 = i00 + 1, i01 = i00 + N + 1, i11 = i01 + 1;
      var s00 = [i * cw, j * ch], s10 = [(i + 1) * cw, j * ch], s01 = [i * cw, (j + 1) * ch], s11 = [(i + 1) * cw, (j + 1) * ch];
      if (ok[i00] && ok[i10] && ok[i01]) artTri(A, s00, s10, s01, sp[i00], sp[i10], sp[i01], i * cw, j * ch, cw, ch);
      if (ok[i10] && ok[i11] && ok[i01]) artTri(A, s10, s11, s01, sp[i10], sp[i11], sp[i01], i * cw, j * ch, cw, ch);
    }
    ctx = main;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(1, a * (view.vr ? 1.4 : 0.62));
    ctx.drawImage(artLayer, Math.round(cl[0] * DPR), Math.round(cl[1] * DPR));
    ctx.restore();
  }
  var artLayer = document.createElement('canvas'), artCtx = artLayer.getContext('2d'), artOff = [0, 0];
  function artTri(A, s0, s1, s2, d0, d1, d2, sx, sy, sw, sh) {
    var m = affine(s0, s1, s2, d0, d1, d2); if (!m) return;
    // grow the clip triangle by half a pixel so neighbouring cells meet without hairline gaps
    var cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    function g(d) { var dx = d[0] - cx, dy = d[1] - cy, l = Math.hypot(dx, dy) || 1; return [d[0] + dx / l * 0.6, d[1] + dy / l * 0.6]; }
    var a = g(d0), b = g(d1), c = g(d2);
    ctx.save();
    var ox = artOff[0], oy = artOff[1];
    ctx.setTransform(DPR, 0, 0, DPR, -ox * DPR, -oy * DPR);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.clip();
    ctx.setTransform(DPR * m[0], DPR * m[1], DPR * m[2], DPR * m[3], DPR * (m[4] - ox), DPR * (m[5] - oy));
    ctx.drawImage(A.canvas, Math.max(0, sx - 2), Math.max(0, sy - 2), sw + 4, sh + 4, Math.max(0, sx - 2), Math.max(0, sy - 2), sw + 4, sh + 4);
    ctx.restore();
  }

  function stars(view, limit) {
    var M = frame.M, T = frame.T, cl = view.clip;
    var sizeK = clamp(Math.sqrt(view.f / 400), 0.8, 2) * (view.vr ? 1.25 : 1);
    var tw = now / 1000;
    for (var i = 0; i < NS; i++) {
      var m = SM[i];
      if (m > limit + 0.3) continue;
      var x = SV[3 * i], y = SV[3 * i + 1], z = SV[3 * i + 2];
      var up = M[2][0] * x + M[2][1] * y + M[2][2] * z;
      if (up <= 0) continue;
      var cz = T[2][0] * x + T[2][1] * y + T[2][2] * z;
      if (cz < 0.1) continue;
      proj(view, T[0][0] * x + T[0][1] * y + T[0][2] * z, T[1][0] * x + T[1][1] * y + T[1][2] * z, cz, P);
      if (P[0] < cl[0] - 24 || P[0] > cl[0] + cl[2] + 24 || P[1] < cl[1] - 24 || P[1] > cl[1] + cl[3] + 24) continue;
      var mEff = m + 0.22 * (1 / Math.max(up, 0.05) - 1); // extinction near the horizon
      var vis = limit - mEff;
      if (vis < -0.3) continue;
      var alpha = clamp(0.5 + vis * 0.3, 0.4, 1);
      if (up < 0.26) alpha *= 1 - 0.38 * (1 - up / 0.26) * (0.5 + 0.5 * Math.sin(tw * 6.3 + i * 1.71)); // scintillation
      var d = (3.0 + 2.1 * Math.max(0, limit + 0.8 - mEff)) * sizeK;
      var col = up < 0.12 ? Math.min(5, SB[i] + 1) : SB[i];
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprites[col], P[0] - d / 2, P[1] - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
  }

  // planets look like steady stars to the eye: a point of light, no outline shapes
  var BODY_SPRITE = { Saturn: 3, Jupiter: 2, Mars: 5, Venus: 2, Mercury: 3, Moon: 2, Uranus: 0, Neptune: 0 };
  function drawBody(view, b) {
    toCam(b.v, CV);
    if (!proj(view, CV[0], CV[1], CV[2], P)) return;
    var sizeK = clamp(Math.sqrt(view.f / 400), 0.8, 2) * (view.vr ? 1.25 : 1);
    var faint = b.mag > 5;
    var d = faint ? 4.2 * sizeK : (3.0 + 2.1 * Math.max(0, 5.4 - b.mag)) * sizeK;
    ctx.globalAlpha = faint ? 0.6 : 1;
    ctx.drawImage(sprites[BODY_SPRITE[b.key] || 2], P[0] - d / 2, P[1] - d / 2, d, d);
    ctx.globalAlpha = 1;
  }

  function ground(view) {
    // tree line and buildings first, so they cut stars right at the horizon
    ctx.beginPath(); bandPath(view, -0.5, 0, 0, 360, 0.5, TREE);
    ctx.fillStyle = '#05070b'; ctx.fill();
    // the ground itself: every screen point whose ray points below the horizon
    var fU = cam.f[2], rU = cam.r[2], uU = cam.u[2], L = view.f * 8;
    var poly = [[-L, -L], [L, -L], [L, L], [-L, L]], out = [];
    function U(p) { return fU + (p[0] / view.f) * rU - (p[1] / view.f) * uU; }
    for (var k = 0; k < 4; k++) {
      var a = poly[k], b = poly[(k + 1) % 4], ua = U(a), ub = U(b);
      if (ua < 0) out.push(a);
      if ((ua < 0) !== (ub < 0)) { var t = ua / (ua - ub); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    if (out.length < 3) return;
    ctx.beginPath();
    var steps = view.k > 0 ? 40 : 1;
    for (var i = 0; i < out.length; i++) {
      var p = out[i], q = out[(i + 1) % out.length];
      for (var s = 0; s < steps; s++) {
        var u = s / steps;
        distortPlane(view, p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, P);
        if (i === 0 && s === 0) ctx.moveTo(P[0], P[1]); else ctx.lineTo(P[0], P[1]);
      }
    }
    ctx.closePath();
    ctx.fillStyle = '#05070b'; ctx.fill();
  }

  // ---------- labels ----------
  function tryText(view, text, x, y, size, font, color, align, force, spacing) {
    ctx.font = size + 'px ' + font;
    setSpacing(spacing || 0);
    var w = ctx.measureText(text).width, h = size * 1.05;
    var x0 = align === 'left' ? x : x - w / 2, y0 = y - h / 2, pad = size * 0.18, b = view.boxes;
    if (!force) {
      for (var i = 0; i < b.length; i++) {
        var q = b[i];
        if (x0 - pad < q[2] && x0 + w + pad > q[0] && y0 - pad < q[3] && y0 + h + pad > q[1]) { setSpacing(0); return false; }
      }
    }
    b.push([x0, y0, x0 + w, y0 + h]);
    ctx.textAlign = align; ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    setSpacing(0);
    return true;
  }
  function directions(view, fontPx) {
    for (var k = 0; k < 8; k++) {
      var e = enuFromAltAz(-2.2, k * 45);
      enuToCam(e, CV);
      if (!proj(view, CV[0], CV[1], CV[2], P)) continue;
      var main = k % 2 === 0;
      tryText(view, K.DIRS[k], P[0], P[1] + fontPx * 0.5, Math.round(fontPx * (main ? 1.1 : 0.85)), SANS,
        main ? 'rgba(222,170,104,0.92)' : 'rgba(222,170,104,0.5)', 'center', true);
      if (main) { // a short tick on the horizon
        ctx.fillStyle = 'rgba(222,170,104,0.5)';
        enuToCam(enuFromAltAz(0.2, k * 45), CV2);
        if (proj(view, CV2[0], CV2[1], CV2[2], Q)) ctx.fillRect(Q[0] - 0.5, Q[1] - fontPx * 0.5, 1, fontPx * 0.5);
      }
    }
  }
  var Q = [0, 0];
  function labels(view, o, fontPx, limit) {
    var sel = o.sel, hl = o.highlight;
    ctx.globalAlpha = o.labelAlpha == null ? 1 : o.labelAlpha;
    if (ctx.globalAlpha < 0.01) { ctx.globalAlpha = 1; return; }
    ctx.textBaseline = 'middle';
    if (o.show.dirs) directions(view, fontPx);
    for (var bg = 0; bg < frame.bodies.length; bg++) {
      toCam(frame.bodies[bg].v, CV);
      if (proj(view, CV[0], CV[1], CV[2], P)) { var gr = fontPx * 0.8; view.boxes.push([P[0] - gr, P[1] - gr * 0.6, P[0] + gr, P[1] + gr * 0.6]); }
    }
    var bodies = frame.bodies.slice().sort(function (a, b) { return a.mag - b.mag; });
    for (var bl = 0; bl < bodies.length; bl++) {
      var b = bodies[bl];
      toCam(b.v, CV);
      if (!proj(view, CV[0], CV[1], CV[2], P)) continue;
      var faint = b.mag > 5;
      tryText(view, K.BODY_INFO[b.key].name, P[0], P[1] + fontPx * (faint ? 1.2 : 1.5), Math.round(fontPx * (faint ? 0.8 : 1.0)), SANS,
        faint ? 'rgba(160,214,206,0.75)' : 'rgba(236,206,150,0.95)', 'center', false);
    }
    var consOrder = CONS.slice().sort(function (a, b) {
      var sa = (hl && a.id === hl) ? -10 : a.rank, sb = (hl && b.id === hl) ? -10 : b.rank;
      return sa - sb;
    });
    for (var ci = 0; ci < consOrder.length; ci++) {
      var cn = consOrder[ci], isHl = hl === cn.id;
      if (!o.show.names && !isHl) continue;
      if (altOf(cn.v) < 0.03) continue;
      toCam(cn.v, CV);
      if (!proj(view, CV[0], CV[1], CV[2], P)) continue;
      tryText(view, cn.ko, P[0], P[1], Math.round(fontPx * (isHl ? 1.15 : 0.92)), SERIF,
        isHl ? 'rgba(240,222,186,1)' : 'rgba(168,182,214,0.62)', 'center', isHl, fontPx * 0.12);
    }
    if (o.show.stars) {
      var starMax = view.vr ? 2.1 : 2.6;
      for (var ni = 0; ni < S.named.length; ni++) {
        var idx = S.named[ni][0];
        if (SM[idx] > Math.min(limit, starMax)) continue;
        var vv = [SV[3 * idx], SV[3 * idx + 1], SV[3 * idx + 2]];
        if (altOf(vv) < 0.02) continue;
        toCam(vv, CV);
        if (!proj(view, CV[0], CV[1], CV[2], P)) continue;
        tryText(view, S.named[ni][1], P[0] + fontPx * 0.6, P[1] - fontPx * 0.1, Math.round(fontPx * 0.78), SANS, 'rgba(232,226,212,0.72)', 'left');
      }
      for (var di = 0; di < DSO.length; di++) {
        if (altOf(DSO[di].v) < 0.03 || limit < 4) continue;
        toCam(DSO[di].v, CV);
        if (!proj(view, CV[0], CV[1], CV[2], P)) continue;
        ctx.strokeStyle = 'rgba(196,210,236,0.42)'; ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.arc(P[0], P[1], fontPx * 0.6, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        tryText(view, DSO[di].name, P[0], P[1] + fontPx * 1.3, Math.round(fontPx * 0.76), SANS, 'rgba(196,210,236,0.7)', 'center');
      }
    }
  }

  // arrow at the edge of the view pointing toward a target that is off-screen (show guidance)
  function guideArrow(view, v, fontPx) {
    toCam(v, CV);
    var ang = Math.acos(clamp(CV[2] / Math.hypot(CV[0], CV[1], CV[2]), -1, 1)) / D2R;
    if (ang < 14) return;
    var dx = CV[0], dy = -CV[1], l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    var rr = view.vr ? view.R * 0.5 : Math.min(view.clip[2], view.clip[3]) * 0.36;
    var x = view.cx + dx * rr, y = view.cy + dy * rr, s = fontPx * 0.9;
    var pulse = 0.55 + 0.45 * Math.sin(now / 260);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx));
    ctx.strokeStyle = 'rgba(236,206,150,' + (0.5 + 0.4 * pulse) + ')'; ctx.lineWidth = Math.max(2, fontPx * 0.16);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.6, -s); ctx.lineTo(s * 0.4, 0); ctx.lineTo(-s * 0.6, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 1.4, -s); ctx.lineTo(-s * 0.4, 0); ctx.lineTo(-s * 1.4, s); ctx.globalAlpha = 0.5; ctx.stroke();
    ctx.restore();
  }

  // one constellation's stick figure drawn stroke by stroke (p 0..1)
  function consLinesProgress(view, id, p, gapRad) {
    var segs = [];
    for (var i = 0; i < LINES.length; i++) if (LINES[i].id === id) for (var k = 1; k < LINES[i].pts.length; k++) segs.push([LINES[i].pts[k - 1], LINES[i].pts[k]]);
    var budget = clamp(p, 0, 1) * segs.length;
    for (var j = 0; j < segs.length && budget > 0; j++, budget--) {
      var a = segs[j][0], b = segs[j][1], f = Math.min(1, budget);
      var th = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
      var t = th > 0 ? Math.min(0.3, gapRad / th) : 0, e = t + (1 - 2 * t) * f;
      toCam([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], CV);
      toCam([a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e], CV2);
      segPath(view, CV, CV2, 6);
    }
  }
  // star trails: where the bright stars were over the past few hours
  function trails(view, tr, minutes) {
    var steps = 28, span = tr.hours * 60 * tr.p, Ms = [];
    for (var k = 0; k <= steps; k++) Ms.push(C.eqjToEnu(S, minutes - span * (1 - k / steps)));
    ctx.save();
    ctx.lineWidth = Math.max(0.8, view.f / 620);
    for (var col = 0; col < 6; col++) {
      ctx.strokeStyle = 'rgba(' + STAR_RGB[col].join(',') + ',0.42)';
      ctx.beginPath();
      for (var i = 0; i < NS; i++) {
        if (SB[i] !== col || SM[i] > 3.6) continue;
        var v = [SV[3 * i], SV[3 * i + 1], SV[3 * i + 2]], started = false;
        for (var q = 0; q <= steps; q++) {
          var e = C.apply(Ms[q], v);
          if (e[2] < 0) { started = false; continue; }
          enuToCam(e, CV);
          if (!proj(view, CV[0], CV[1], CV[2], P)) { started = false; continue; }
          if (!started) { ctx.moveTo(P[0], P[1]); started = true; } else ctx.lineTo(P[0], P[1]);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // telescope eyepiece: the sky darkens outside a circle and Saturn is shown in a Hubble photo from 2009,
  // when the rings were nearly edge-on as they are in 2026 (NASA, ESA and the Hubble Heritage Team (STScI/AURA))
  var SATURN = new Image(); SATURN.src = 'assets/saturn.webp';
  function eyepiece(view, ep, fontPx) {
    var a = clamp(ep.a, 0, 1), cl = view.clip;
    var r = view.vr ? view.R * 0.42 : Math.min(cl[2], cl[3]) * 0.34;
    ctx.save();
    ctx.beginPath(); ctx.rect(cl[0], cl[1], cl[2], cl[3]); ctx.arc(view.cx, view.cy, r, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(0,0,0,' + 0.88 * a + ')'; ctx.fill();
    ctx.beginPath(); ctx.arc(view.cx, view.cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(2,3,6,' + 0.9 * a + ')'; ctx.fillRect(view.cx - r, view.cy - r, r * 2, r * 2);
    if (SATURN.complete && SATURN.naturalWidth) {
      var sw = r * 1.5, sh = sw * SATURN.naturalHeight / SATURN.naturalWidth;
      ctx.globalAlpha = a;
      ctx.translate(view.cx, view.cy); ctx.rotate(-0.12);
      ctx.drawImage(SATURN, -sw / 2, -sh / 2, sw, sh);
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(200,190,170,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(view.cx, view.cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.font = Math.round(fontPx * 0.78) + 'px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(214,206,190,0.75)'; ctx.fillText('허블 사진 · 2009년, 올해처럼 고리가 옆으로 누운 때', view.cx, view.vr ? view.cy - r - fontPx * 0.9 : view.cy + r + fontPx * 1.1);
    ctx.restore();
  }

  // dotted guide line between two stars, drawn progressively (p 0..1)
  function pointerLine(view, pt) {
    var a = pt.from, b = pt.to, n = 40, m = Math.max(1, Math.round(n * clamp(pt.p, 0, 1)));
    ctx.save();
    ctx.strokeStyle = 'rgba(236,206,150,0.75)'; ctx.lineWidth = Math.max(1.2, view.f / 450);
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    for (var i = 0; i < m; i++) {
      var u0 = i / n, u1 = (i + 1) / n;
      var p0 = norm([a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0, a[2] + (b[2] - a[2]) * u0]);
      var p1 = norm([a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1, a[2] + (b[2] - a[2]) * u1]);
      toCam(p0, CV); toCam(p1, CV2); segPath(view, CV, CV2, 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---------- VR heads-up text ----------
  function vrHud(view, o, fontPx) {
    var c = ctx;
    c.textBaseline = 'middle';
    if (o.top) {
      c.font = Math.round(fontPx * 0.82) + 'px ' + MONO; c.textAlign = 'center';
      c.fillStyle = 'rgba(224,228,240,0.72)';
      c.fillText(o.top, view.cx, view.cy - view.R * 0.64);
    }
    if (o.card) drawCard(view, o.card, fontPx, view.cx - view.R * 0.58, view.cy + view.R * 0.15, view.R * 1.16, 4);
    if (o.caption) {
      var t = o.caption;
      c.textAlign = 'center';
      c.font = Math.round(fontPx * 1.25) + 'px ' + SERIF;
      var w = Math.max(c.measureText(t.title).width, t.sub ? (c.font = Math.round(fontPx * 0.8) + 'px ' + SANS, c.measureText(t.sub).width) : 0);
      var y = view.cy + view.R * 0.4, h = fontPx * (t.sub ? 3.2 : 2.2);
      c.fillStyle = 'rgba(7,9,16,' + 0.86 * t.alpha + ')';
      c.fillRect(view.cx - w / 2 - fontPx, y - fontPx * 1.1, w + fontPx * 2, h);
      c.fillStyle = 'rgba(236,206,150,' + 0.9 * t.alpha + ')';
      c.fillRect(view.cx - w / 2 - fontPx, y - fontPx * 1.1, 2, h);
      c.font = Math.round(fontPx * 1.25) + 'px ' + SERIF; c.fillStyle = 'rgba(244,236,220,' + t.alpha + ')';
      c.fillText(t.title, view.cx, y);
      if (t.sub) { c.font = Math.round(fontPx * 0.8) + 'px ' + SANS; c.fillStyle = 'rgba(200,204,220,' + t.alpha + ')'; c.fillText(t.sub, view.cx, y + fontPx * 1.35); }
    }
  }
  // info card with a fixed height; long text glides upward by itself
  function drawCard(view, card, fontPx, x, y, w, maxLines) {
    var c = ctx, pad = fontPx * 0.8;
    var bodyFont = Math.round(fontPx * 0.84) + 'px ' + SANS;
    var lines = card.text ? wrapLines(card.text, w - pad * 2, bodyFont) : [];
    var lh = fontPx * 1.32, shown = Math.min(maxLines, lines.length);
    var headH = fontPx * 2.0, h = headH + shown * lh + pad * 0.7;
    c.fillStyle = 'rgba(7,9,16,0.9)'; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(236,206,150,0.8)'; c.fillRect(x, y, 2, h);
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.font = Math.round(fontPx * 1.12) + 'px ' + SERIF; c.fillStyle = 'rgba(244,236,220,1)';
    c.fillText(card.name, x + pad, y + fontPx * 1.05);
    if (card.kind) {
      c.font = Math.round(fontPx * 0.68) + 'px ' + MONO; c.fillStyle = 'rgba(200,180,140,0.8)'; c.textAlign = 'right';
      c.fillText(card.kind, x + w - pad, y + fontPx * 1.05); c.textAlign = 'left';
    }
    if (!shown) return;
    var overflow = (lines.length - shown) * lh;
    var off = scrollOffset(card.t || 0, overflow, fontPx * 1.1), fade = 1;
    if (off < 0) { off = 0; fade = 0.35; }
    c.save();
    c.beginPath(); c.rect(x, y + headH - fontPx * 0.2, w, shown * lh + fontPx * 0.2); c.clip();
    c.font = bodyFont; c.fillStyle = 'rgba(226,228,236,' + 0.94 * fade + ')';
    for (var i = 0; i < lines.length; i++) {
      var ly = y + headH + lh * (i + 0.5) - off;
      if (ly < y + headH - lh || ly > y + h + lh) continue;
      c.fillText(lines[i], x + pad, ly);
    }
    c.restore();
    if (overflow > 0) { // scroll position tick on the right edge
      var tr = shown * lh, th = tr * shown / lines.length, ty = y + headH + (tr - th) * (off / overflow);
      c.fillStyle = 'rgba(236,206,150,0.35)'; c.fillRect(x + w - 3, ty, 1.5, th);
    }
  }

  // ---------- gaze settings panel (VR) ----------
  // a flat card standing 45 deg below the horizon, facing the viewer, in the heading looked at before bowing
  var PITCH = 45 * D2R;
  function panelBasis(yaw) {
    var a = yaw * D2R, sa = Math.sin(a), ca = Math.cos(a), cp = Math.cos(PITCH), sp = Math.sin(PITCH);
    var r = [ca, -sa, 0], c = [sa * cp, ca * cp, -sp];
    return { r: r, c: c, u: cross(r, c) };
  }
  function planePt(view, B, x, y, out) {
    var e = B.c[0] + B.r[0] * x + B.u[0] * y, n = B.c[1] + B.r[1] * x + B.u[1] * y, u = B.c[2] + B.r[2] * x + B.u[2] * y;
    var l = Math.hypot(e, n, u);
    enuToCam([e / l, n / l, u / l], CV);
    return proj(view, CV[0], CV[1], CV[2], out);
  }
  function panelHit(panel, f) {
    var B = panelBasis(panel.yaw), fc = f[0] * B.c[0] + f[1] * B.c[1] + f[2] * B.c[2];
    if (fc <= 0.3) return null;
    var gx = (f[0] * B.r[0] + f[1] * B.r[1] + f[2] * B.r[2]) / fc, gy = (f[0] * B.u[0] + f[1] * B.u[1] + f[2] * B.u[2]) / fc;
    for (var i = 0; i < panel.btns.length; i++) {
      var b = panel.btns[i];
      if (Math.abs(gx - b.x) < b.w / 2 + 0.02 && Math.abs(gy - b.y) < b.h / 2 + 0.02) return b;
    }
    return null;
  }
  function drawPanel(view, panel, fontPx) {
    var c = ctx, B = panelBasis(panel.yaw), A = [0, 0], Bp = [0, 0], Cp = [0, 0], Dp = [0, 0], P2 = [0, 0];
    function quad(x, y, w, h) {
      var ok = planePt(view, B, x - w / 2, y + h / 2, A) & planePt(view, B, x + w / 2, y + h / 2, Bp) &
               planePt(view, B, x + w / 2, y - h / 2, Cp) & planePt(view, B, x - w / 2, y - h / 2, Dp);
      if (!ok) return false;
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(Bp[0], Bp[1]); c.lineTo(Cp[0], Cp[1]); c.lineTo(Dp[0], Dp[1]); c.closePath();
      return true;
    }
    function hpx() { return Math.hypot(A[0] - Dp[0], A[1] - Dp[1]); }
    if (quad(0, -0.04, 1.42, 1.04)) { c.fillStyle = 'rgba(7,9,16,0.94)'; c.fill(); c.strokeStyle = 'rgba(236,206,150,0.35)'; c.lineWidth = 1; c.stroke(); }
    c.textBaseline = 'middle';
    if (planePt(view, B, 0, 0.48, P2)) { c.font = Math.round(fontPx * 0.95) + 'px ' + SERIF; c.textAlign = 'center'; c.fillStyle = 'rgba(244,236,220,0.95)'; c.fillText('설정 — 버튼을 1초 바라보세요', P2[0], P2[1]); }
    for (var r = 0; r < panel.rows.length; r++) {
      var row = panel.rows[r];
      if (planePt(view, B, -0.76, row.y, P2)) { c.font = Math.round(fontPx * 0.85) + 'px ' + SANS; c.textAlign = 'right'; c.fillStyle = 'rgba(214,218,230,0.85)'; c.fillText(row.name, P2[0] + fontPx * 3.2, P2[1]); }
      if (planePt(view, B, 0, row.y, P2)) { c.font = Math.round(fontPx * 1.0) + 'px ' + MONO; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText(String(row.val()), P2[0], P2[1]); }
    }
    for (var i = 0; i < panel.btns.length; i++) {
      var b = panel.btns[i];
      if (!quad(b.x, b.y, b.w, b.h)) continue;
      var active = panel.id === b.id, prog = active ? clamp(panel.t / panel.dwell, 0, 1) : 0;
      c.fillStyle = active ? 'rgba(236,206,150,' + (0.18 + 0.5 * prog) + ')' : 'rgba(40,48,72,0.7)';
      c.fill(); c.strokeStyle = active ? 'rgba(236,206,150,0.95)' : 'rgba(150,160,190,0.4)'; c.lineWidth = 1; c.stroke();
      if (planePt(view, B, b.x, b.y, P2)) {
        c.font = Math.round(Math.max(fontPx * 0.85, hpx() * (b.label.length > 2 ? 0.36 : 0.62))) + 'px ' + (b.label.length > 2 ? SANS : MONO);
        c.textAlign = 'center'; c.fillStyle = active ? '#fff' : 'rgba(228,230,238,0.92)'; c.fillText(b.label, P2[0], P2[1]);
      }
    }
    if (panel.toastT > 0 && planePt(view, B, 0, -0.44, P2)) { c.font = Math.round(fontPx * 1.0) + 'px ' + SANS; c.textAlign = 'center'; c.fillStyle = 'rgba(170,220,180,1)'; c.fillText(panel.toast, P2[0], P2[1]); }
    if (panel.id && panel.t > 0) {
      var pr = Math.min(1, panel.t / panel.dwell);
      c.strokeStyle = 'rgba(236,206,150,0.95)'; c.lineWidth = Math.max(2.5, fontPx * 0.22);
      c.beginPath(); c.arc(view.cx, view.cy, fontPx * 1.15, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2); c.stroke();
    }
  }

  // ---------- one view ----------
  function drawView(view, o) {
    var limit = Math.min(o.lim, frame.twiLim), fontPx = view.font;
    ctx.save();
    ctx.beginPath(); ctx.rect(view.clip[0], view.clip[1], view.clip[2], view.clip[3]); ctx.clip();
    skyBase(view);
    if (o.show.mw && !GL) milkyWay(view, o.lim);
    var hl = o.highlight, la = o.labelAlpha == null ? 1 : o.labelAlpha;
    var gap = 0.7 * D2R, lit = {};
    (o.lineCons || []).forEach(function (l) { lit[l.id] = l.p; });
    if (hl && lit[hl] == null) lit[hl] = 1;
    ctx.lineCap = 'round';
    if (o.show.lines && la > 0.01) {
      ctx.lineWidth = Math.max(0.8, view.f / 560);
      ctx.strokeStyle = 'rgba(140,158,200,' + (0.3 * la) + ')';
      ctx.beginPath();
      for (var li = 0; li < LINES.length; li++) if (lit[LINES[li].id] == null) consLinePath(view, LINES[li].pts, gap);
      ctx.stroke();
    }
    for (var lid in lit) {
      if (lit[lid] <= 0) continue;
      ctx.lineWidth = Math.max(1.2, view.f / (lid === hl ? 380 : 460));
      ctx.strokeStyle = 'rgba(236,206,150,' + (lid === hl ? 0.55 + 0.35 * (o.hlAlpha == null ? 1 : o.hlAlpha) : 0.6) + ')';
      ctx.beginPath(); consLinesProgress(view, lid, lit[lid], gap); ctx.stroke();
    }
    if (o.trails && o.trails.p > 0) trails(view, o.trails, o.minutes);
    if (o.figures) for (var fid in o.figures) { var fp = o.figures[fid]; if (fp.p > 0.001) drawFigure(view, fid, fp.p, fp.a); }
    if (o.pointer && o.pointer.from && o.pointer.to && o.pointer.p > 0) pointerLine(view, o.pointer);
    stars(view, limit);
    for (var bi = 0; bi < frame.bodies.length; bi++) drawBody(view, frame.bodies[bi]);
    ground(view);
    view.boxes = [];
    if (view.vr) { // keep labels out from under the HUD
      view.boxes.push([view.cx - view.R * 0.5, view.cy - view.R * 0.64 - fontPx, view.cx + view.R * 0.5, view.cy - view.R * 0.64 + fontPx]);
      if (o.card) view.boxes.push([view.cx - view.R * 0.58, view.cy + view.R * 0.15, view.cx + view.R * 0.58, view.cy + view.R * 0.15 + fontPx * 8]);
    }
    labels(view, o, fontPx, limit);
    ctx.globalAlpha = 1;
    if (o.guide) guideArrow(view, o.guide, fontPx);
    if (o.eyepiece && o.eyepiece.a > 0) eyepiece(view, o.eyepiece, fontPx);
    if (view.vr && o.panel && o.panel.open) drawPanel(view, o.panel, fontPx);
    // reticle
    if (o.reticle !== false && !(o.eyepiece && o.eyepiece.a > 0.3)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(view.cx, view.cy, fontPx * 0.62, 0, Math.PI * 2); ctx.stroke();
      if (o.dwell > 0) {
        ctx.strokeStyle = 'rgba(236,206,150,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(view.cx, view.cy, fontPx * 0.62, -Math.PI / 2, -Math.PI / 2 + o.dwell * Math.PI * 2); ctx.stroke();
      }
    }
    if (view.vr) {
      if (o.hint) {
        ctx.font = Math.round(fontPx * 0.85) + 'px ' + SANS; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var hw = ctx.measureText(o.hint).width;
        ctx.fillStyle = 'rgba(7,9,16,0.85)'; ctx.fillRect(view.cx - hw / 2 - 10, view.cy + view.R * 0.68 - fontPx * 0.75, hw + 20, fontPx * 1.5);
        ctx.fillStyle = 'rgba(236,206,150,0.95)'; ctx.fillText(o.hint, view.cx, view.cy + view.R * 0.68);
      }
      var vg = ctx.createRadialGradient(view.cx, view.cy, view.R * 0.92, view.cx, view.cy, view.R * 1.25);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = vg; ctx.fillRect(view.clip[0], view.clip[1], view.clip[2], view.clip[3]);
      vrHud(view, o, fontPx);
    }
    ctx.restore();
  }

  // ---------- gaze target ----------
  function pickTarget(f, wantCons) {
    var M = frame.M;
    function angTo(v) {
      var e = C.apply(M, v), d = e[0] * f[0] + e[1] * f[1] + e[2] * f[2];
      return { a: Math.acos(clamp(d, -1, 1)) / D2R, up: e[2] };
    }
    var best = null, bestScore = 1e9;
    function consider(score, t) { if (score < bestScore) { bestScore = score; best = t; } }
    frame.bodies.forEach(function (b) {
      var r = angTo(b.v); if (r.up <= 0) return;
      if (r.a < 4) consider(r.a / 4, { key: 'b:' + b.key, kind: '행성', name: K.BODY_INFO[b.key].name, text: K.BODY_INFO[b.key].text, cons: null });
    });
    DSO.forEach(function (d) {
      var r = angTo(d.v); if (r.up <= 0) return;
      if (r.a < 3.5) consider(r.a / 3.5 + 0.05, { key: 'd:' + d.name, kind: '천체', name: d.name, text: d.text, cons: null });
    });
    for (var i = 0; i < S.named.length; i++) {
      var idx = S.named[i][0];
      if (SM[idx] > 2.6) continue;
      var r = angTo([SV[3 * idx], SV[3 * idx + 1], SV[3 * idx + 2]]); if (r.up <= 0) continue;
      if (r.a < 2.6) { var nm = S.named[i][1]; consider(r.a / 2.6 + 0.1, { key: 's:' + nm, kind: '별 · ' + SM[idx].toFixed(1) + '등급', name: nm, text: K.STAR_INFO[nm] || '', cons: null }); }
    }
    if (!best || bestScore > 0.6 || wantCons) {
      var cb = null, cs = 1e9;
      for (var k = 0; k < CONS.length; k++) {
        var cr = angTo(CONS[k].v); if (cr.up <= 0.02 || cr.a > 40) continue;
        var dmin = cr.a + 3;
        for (var q = 0; q < CONS[k].verts.length; q++) { var vr = angTo(CONS[k].verts[q]); if (vr.a < dmin) dmin = vr.a; }
        if (dmin < 8 && dmin < cs) { cs = dmin; cb = CONS[k]; }
      }
      if (cb && (!best || bestScore > 0.6)) best = { key: 'c:' + cb.id, kind: '별자리', name: cb.ko, text: cb.info, cons: cb.id };
      if (wantCons && best) best.near = cb ? cb.id : null;
    }
    return best;
  }

  // ---------- frame entry ----------
  var W = 0, H = 0, DPR = 1;
  // NASA Milky Way photo map on a WebGL layer behind this canvas; without WebGL the point-cloud band is used
  var GL = glCanvas && window.SkyGL ? SkyGL(glCanvas, 'assets/milkyway_4k.jpg') : null;
  if (glCanvas && !GL) glCanvas.style.display = 'none';
  var artQueue = []; // illustrations to draw in the WebGL layer this frame
  function resize(w, h, dpr) {
    W = w; H = h; DPR = Math.min(dpr || 1, 3); // full phone resolution keeps stars crisp
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    if (GL) GL.resize(W, H, Math.min(DPR, 2)); // the smooth sky background does not need more
  }
  function skyRgb() {
    var t = clamp((-frame.sunAlt - 4) / 14, 0, 1);
    return [(30 - 25 * t) / 255, (44 - 37 * t) / 255, (78 - 64 * t) / 255];
  }
  // o: { cam, minutes, lim, show, mode: 'vr'|'flat', fov, cyFrac, warp, vrFov, sep, highlight, figures, sel, card, top,
  //      caption, guide, panel, hint, dwell, reticle }
  function render(o) {
    opts = o; now = performance.now();
    computeFrame(o.minutes, o.cam);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (GL) ctx.clearRect(0, 0, W, H); else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    var views;
    if (o.mode === 'vr') {
      var half = W / 2;
      var sep = Math.min(half * 1.02, o.sep);
      var R = Math.min(half / 2 + 8, H / 2);
      var f = (half / 2) / Math.tan(o.vrFov / 2 * D2R);
      var font = clamp(half / 26, 11, 18);
      views = [{ cx: W / 2 - sep / 2, cy: H / 2, f: f, R: R, k: o.warp, clip: [0, 0, half, H], vr: true, font: font },
               { cx: W / 2 + sep / 2, cy: H / 2, f: f, R: R, k: o.warp, clip: [half, 0, half, H], vr: true, font: font }];
    } else {
      var ff = (Math.max(W, H) / 2) / Math.tan(o.fov / 2 * D2R);
      views = [{ cx: W / 2, cy: H * (o.cyFrac == null ? 0.5 : o.cyFrac), f: ff, R: 1, k: 0, clip: [0, 0, W, H], vr: false, font: clamp(W / 44, 12, 16) }];
    }
    if (GL) {
      var lim = o.lim, gain = o.show.mw ? frame.dark * frame.dark * clamp((lim - 3.0) / 3.1, 0.1, 1) * 0.95 : 0;
      var t = clamp((-frame.sunAlt - 4) / 14, 0, 1);
      GL.draw(views, frame.T, frame.M, skyRgb(), gain * 0.7, {
        glow: [(34 - 14 * t) / 255, (36 - 16 * t) / 255, (50 - 26 * t) / 255],
        dome: [(52 * (0.4 + 0.6 * t)) / 255, (38 * (0.4 + 0.6 * t)) / 255, (26 * (0.4 + 0.6 * t)) / 255],
        cut: 0.2, curve: 1.25 // keep only the band itself, not the haze around it
      });
    }
    artQueue.length = 0;
    for (var i = 0; i < views.length; i++) drawView(views[i], o);
    if (GL && artQueue.length) GL.drawArt(artQueue);
    if (o.mode === 'vr') { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(W / 2 - 0.5, 0, 1, H); }
    return frame;
  }

  return {
    render: render, resize: resize, pickTarget: pickTarget, panelHit: panelHit, scrollOffset: scrollOffset,
    frame: function () { return frame; },
    consById: CONS_BY_ID, dso: DSO, hasFigure: function (id) { return !!ART[id]; },
    // direction (J2000 vector) of a named thing, for shows
    vecOf: function (t) {
      if (t.cons && CONS_BY_ID[t.cons]) return CONS_BY_ID[t.cons].v;
      if (t.star) { for (var i = 0; i < S.named.length; i++) if (S.named[i][1] === t.star) { var x = S.named[i][0]; return [SV[3 * x], SV[3 * x + 1], SV[3 * x + 2]]; } }
      if (t.dso) { for (var j = 0; j < DSO.length; j++) if (DSO[j].name === t.dso) return DSO[j].v; }
      if (t.radec) return C.radec2vec(t.radec[0], t.radec[1]);
      return null;
    },
    bodyVec: function (key, minutes) { return C.radec2vec.apply(null, C.bodyRaDec(S, key, minutes)); },
    enuFromAltAz: enuFromAltAz
  };
};
