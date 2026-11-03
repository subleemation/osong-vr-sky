(function () {
  'use strict';
  var S = window.SKY, C = SkyCore, D2R = C.D2R;
  // which evening the sky shows: js/sky-data.js holds 2026-11-01 at Osong; other dates and places are
  // computed with astronomy-engine (SkyCore.setSky). Stories always play on the event night they were written for.
  var EVENT0 = { rot: S.rot, gast0: S.gast0, lat: S.lat, lon: S.lon, t0ms: S.t0ms, planets: S.planets };
  function skyKeyOf(k) { return [k.date, k.lat, k.lon, k.tz].join(','); }
  var EVENT_KEY = skyKeyOf(C.EVENT), skyKey = '', skyNow = C.EVENT;
  function useSky(sky) { // sky: { date, lat, lon, tz, name } or null for the event night
    var key = sky ? skyKeyOf(sky) : EVENT_KEY;
    if (key === skyKey) return;
    if (!C.setSky(S, sky || C.EVENT)) { for (var k in EVENT0) S[k] = EVENT0[k]; key = EVENT_KEY; } // the table only covers 18:00–21:30
    skyKey = key; skyNow = key === EVENT_KEY ? C.EVENT : sky;
    renderSkyWhere();
  }
  var canvas = document.getElementById('sky');
  var ctx = canvas.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };

  // ---------- content (Korean, kid friendly) ----------
  var CONS_INFO = {
    Peg: '하늘을 나는 날개 달린 말이에요. 밝은 별 네 개가 만드는 커다란 네모 ‘가을의 대사각형’을 찾아봐요!',
    And: '공주 안드로메다의 별자리예요. 근처에 우리 은하의 이웃, 안드로메다은하가 숨어 있어요.',
    Cas: '알파벳 W 모양! 안드로메다 공주의 엄마인 왕비예요. 북쪽 하늘에서 1년 내내 볼 수 있어요.',
    Cep: '안드로메다 공주의 아빠인 왕이에요. 뾰족한 지붕이 있는 집 모양이에요.',
    Per: '괴물을 물리치고 공주를 구한 영웅이에요. 밝기가 변하는 신기한 별 ‘알골’이 있어요.',
    Psc: '리본으로 묶인 물고기 두 마리예요. 대사각형 아래쪽을 V자로 감싸고 있어요.',
    Aqr: '물병으로 물을 붓는 소년이에요. 흐린 별이 많아서 찾기가 조금 어려워요.',
    Cap: '위는 염소, 아래는 물고기인 신기한 동물이에요. 남서쪽 낮은 하늘에 있어요.',
    PsA: '가을 하늘에 하나뿐인 1등성 ‘포말하우트’가 있어요. 남쪽 낮은 곳에서 홀로 반짝여요.',
    Ari: '황금 털을 가진 양이에요. 별 세 개가 꺾인 막대처럼 이어져 있어요.',
    Tri: '이름 그대로 작은 삼각형이에요! 안드로메다자리 바로 옆에 있어요.',
    Cet: '바다 괴물 고래예요. 오늘 밤 토성이 이 별자리 안에 들어와 있어요!',
    Cyg: '날개를 활짝 편 백조, 커다란 십자가 모양이에요. 꼬리의 밝은 별은 ‘데네브’예요.',
    Lyr: '작은 거문고예요. 아주 밝은 ‘직녀성’이 있어요. 견우와 직녀 이야기 알고 있나요?',
    Aql: '하늘을 나는 독수리예요. ‘견우성’이 은하수 건너편 직녀성을 바라보고 있어요.',
    Del: '작고 귀여운 돌고래! 다이아몬드 모양의 별 네 개를 찾아봐요.',
    Sge: '아주 작은 화살 모양 별자리예요.',
    Vul: '작은 여우 별자리예요. 밝은 별이 없어 눈으로 찾기는 어려워요.',
    UMa: '국자 모양 ‘북두칠성’이 이 곰의 엉덩이와 꼬리예요. 지금은 북쪽 땅 가까이 낮게 있어요.',
    UMi: '꼬리 끝에 ‘북극성’이 있어요. 북극성은 거의 움직이지 않아서 북쪽을 알려줘요.',
    Dra: '북극성 주변을 길게 휘감고 있는 용이에요.',
    Tau: '황소예요. 붉은 눈 ‘알데바란’과 별 무리 ‘좀생이별’이 있어요. 밤이 깊을수록 높이 떠요.',
    Aur: '마차를 모는 사람이에요. 노란빛 밝은 별 ‘카펠라’가 북동쪽에서 떠올라요.',
    Sgr: '활을 쏘는 반인반마예요. 주전자처럼 생겼어요. 남서쪽으로 지고 있어요.',
    Her: '힘센 영웅 헤라클레스예요. 서쪽 하늘로 천천히 지고 있어요.',
    Lac: '작은 도마뱀이에요. 카시오페이아와 백조 사이에 있어요.',
    Gem: '쌍둥이 형제예요. 늦은 밤 북동쪽에서 떠올라요.',
    Boo: '곰을 모는 목동이에요. 주황빛 ‘아크투루스’가 서쪽 땅 가까이 있어요.',
    Oph: '뱀을 들고 있는 의사예요. 서쪽 하늘로 지고 있어요.',
    Equ: '아주 작은 망아지 별자리예요. 페가수스 옆에 붙어 있어요.',
    Lyn: '살쾡이 별자리예요. 아주 흐려서 ‘살쾡이 눈’이 있어야 보인대요.',
    Cam: '기린 별자리예요. 흐린 별이 많아요.',
    Scl: '조각가의 작업실 별자리예요. 남쪽 낮은 하늘에 있어요.'
  };
  var STAR_INFO = {
    '북극성': '거의 움직이지 않는 별이에요. 이 별이 있는 쪽이 북쪽이에요.',
    '직녀성 (베가)': '여름밤 가장 밝은 별 중 하나예요. 은하수 건너 견우를 기다리는 직녀예요.',
    '견우성 (알타이르)': '소를 끄는 견우예요. 1년에 한 번, 칠월 칠석에 직녀를 만난대요.',
    '데네브': '백조의 꼬리예요. 아주 멀리 있는데도 밝게 보이는 엄청 큰 별이에요.',
    '포말하우트': '가을 하늘의 유일한 1등성! ‘물고기의 입’이라는 뜻이에요.',
    '알골': '약 3일마다 어두워졌다 밝아져요. 두 별이 서로 가리기 때문이에요.',
    '카펠라': '노란빛이 예쁜 밝은 별이에요. 태양과 비슷한 색이에요.',
    '알데바란': '황소의 붉은 눈이에요. 주황빛이 나는 큰 별이에요.',
    '알페라츠': '안드로메다 공주의 머리이면서 가을의 대사각형 꼭짓점이에요.',
    '아크투루스': '주황빛 밝은 별이에요. 지금은 서쪽 땅에 거의 닿아 있어요.'
  };
  var DSO = [
    { ra: 10.68, dec: 41.27, name: '안드로메다은하', text: '250만 광년 떨어진 이웃 은하예요. 지금 보는 빛은 250만 년 전에 출발했어요!' },
    { ra: 56.75, dec: 24.12, name: '좀생이별 (플레이아데스)', text: '어린 별들이 모여 있는 별 무리예요. 맨눈으로도 6~7개가 보여요.' },
    { ra: 34.75, dec: 57.13, name: '이중성단', text: '별 무리 두 개가 나란히 있어요. 쌍안경으로 보면 정말 예뻐요.' }
  ];
  var BODY_INFO = {
    Saturn: { name: '토성', text: '고리를 가진 행성! 지구에서 약 12억 8천만 km 떨어져 있어요. 오늘 망원경으로 꼭 봐요.' },
    Uranus: { name: '천왕성 (망원경)', text: '청록색 행성이에요. 맨눈으로는 거의 안 보여서 망원경이 필요해요.' },
    Neptune: { name: '해왕성 (망원경)', text: '태양계에서 가장 바깥에 있는 행성이에요. 토성 근처에 있지만 망원경으로만 보여요.' },
    Jupiter: { name: '목성', text: '태양계에서 가장 큰 행성이에요.' },
    Mars: { name: '화성', text: '붉은 행성이에요.' },
    Venus: { name: '금성', text: '가장 밝게 보이는 행성이에요.' },
    Mercury: { name: '수성', text: '태양에 가장 가까운 행성이에요.' },
    Moon: { name: '달', text: '지구의 위성이에요.' }
  };
  var DIRS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];

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
  var STAR_COLORS = ['#b9cbff', '#dbe4ff', '#fff6ea', '#fff0c8', '#ffd9a0', '#ffbd84'];
  var sprites = STAR_COLORS.map(function (col) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.22, col); gr.addColorStop(0.5, hexA(col, 0.4)); gr.addColorStop(1, hexA(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  });
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  var namedByIdx = {};
  S.named.forEach(function (n) { namedByIdx[n[0]] = n[1]; });

  var LINES = [];
  Object.keys(S.lines).forEach(function (id) {
    S.lines[id].forEach(function (seg) {
      var pts = [];
      for (var k = 0; k < seg.length; k += 2) pts.push(C.radec2vec(seg[k], seg[k + 1]));
      LINES.push({ id: id, pts: pts });
    });
  });
  var CONS = [];
  var seenCons = {};
  S.cons.forEach(function (c) {
    var id = c.id.replace(/\d$/, '');
    if (seenCons[c.ko]) return; seenCons[c.ko] = 1;
    CONS.push({ id: c.id, ko: c.ko, v: C.radec2vec(c.ra, c.dec), info: CONS_INFO[c.id] || '' });
  });
  var MW = S.mw.map(function (rings) {
    return rings.map(function (r) { var o = []; for (var k = 0; k < r.length; k += 2) o.push(C.radec2vec(r[k], r[k + 1])); return o; });
  });
  DSO.forEach(function (d) { d.v = C.radec2vec(d.ra, d.dec); });

  // ---------- state ----------
  var st = {
    minutes: 90, speed: 0, lim: 4.6,
    show: { lines: true, names: true, stars: true, mw: true, dirs: true, art: true, trails: false },
    ipdAdj: 0, warp: 0.3, fov: 95,
    mode: 'menu', // menu | vr | screen
    yaw: 150, pitch: 30, zoomFov: 75,
    sensor: false, sensorSeen: false, absolute: false, headingOffset: 0, compassDone: false,
    devQ: null, cam: null,
    sky: null // this phone's own date/place choice (null = the event night)
  };
  try {
    var saved = JSON.parse(localStorage.getItem('osong-vr-settings') || 'null');
    if (saved) { if (C.skyOk(saved.sky)) st.sky = saved.sky; st.ipdAdj = saved.ipdAdj || 0; st.warp = saved.warp != null ? saved.warp : 0.3; st.fov = saved.fov || 95; st.headingOffset = saved.headingOffset || 0; }
  } catch (e) {}
  function saveSettings() {
    try { localStorage.setItem('osong-vr-settings', JSON.stringify({ sky: st.sky, ipdAdj: st.ipdAdj, warp: st.warp, fov: st.fov, headingOffset: st.headingOffset })); } catch (e) {}
  }

  // ---------- time helpers ----------
  function clockText(min) { // minutes after 18:00, through the night until 06:00
    var t = (18 * 60 + Math.round(min)) % 1440;
    var h = Math.floor(t / 60), m = t % 60;
    return (h < 12 ? '오전 ' : '오후 ') + (h % 12 === 0 ? 12 : h % 12) + ':' + (m < 10 ? '0' : '') + m;
  }
  function sunState(sunAlt) {
    if (sunAlt > -6) return '해가 막 졌어요. 하늘이 아직 밝아서 아주 밝은 별만 보여요.';
    if (sunAlt > -12) return '서쪽에 노을빛이 남아 있어요. 밝은 별들이 하나둘 나타나요.';
    if (sunAlt > -18) return '하늘이 점점 어두워져요. 별자리 모양이 보이기 시작해요.';
    return '완전히 깜깜한 밤! 별이 가장 많이 보이는 시간이에요.';
  }

  // ---------- orientation ----------
  function devMatrix(a, b, g) { // W3C: R = Rz(a) Rx(b) Ry(g), device -> earth(E,N,U)
    a *= D2R; b *= D2R; g *= D2R;
    var ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
    return [
      [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
      [sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg],
      [-cb * sg, sb, cb * cg]
    ];
  }
  function screenAngle() {
    var a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
    return a * D2R;
  }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function rotZ(v, ang) { var c = Math.cos(ang), s = Math.sin(ang); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; }

  var rawCam = null;
  function onOrient(e) {
    if (e.alpha == null && e.beta == null) return;
    if (e.type === 'deviceorientationabsolute') st.absolute = true;
    else if (st.absolute) return; // prefer absolute stream when both arrive
    st.sensorSeen = true;
    var alpha = e.alpha || 0;
    if (!st.compassDone && typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      st.compassOffset = ((360 - e.webkitCompassHeading) - alpha);
      st.compassDone = true;
    }
    if (st.compassOffset) alpha += st.compassOffset;
    var R = devMatrix(alpha, e.beta || 0, e.gamma || 0);
    var th = screenAngle();
    var rs = [Math.cos(th), -Math.sin(th), 0], us = [Math.sin(th), Math.cos(th), 0];
    var ap = function (v) { return C.apply(R, v); };
    var off = st.headingOffset * D2R;
    rawCam = { f: rotZ(ap([0, 0, -1]), off), u: rotZ(ap(us), off), r: rotZ(ap(rs), off) };
  }
  function listenSensors() {
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOrient);
    window.addEventListener('deviceorientation', onOrient);
  }
  function askMotionPermission() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        return DeviceOrientationEvent.requestPermission().then(function (r) { return r === 'granted'; }).catch(function () { return false; });
      }
    } catch (e) {}
    return Promise.resolve(true);
  }
  listenSensors();

  function cameraFromYawPitch() {
    var az = st.yaw * D2R, al = st.pitch * D2R;
    var f = [Math.sin(az) * Math.cos(al), Math.cos(az) * Math.cos(al), Math.sin(al)];
    var r = [Math.cos(az), -Math.sin(az), 0];
    return { f: f, r: r, u: cross(r, f) };
  }
  function smoothCam(target) {
    if (!st.cam) { st.cam = target; return; }
    var k = 0.45, c = st.cam;
    var f = norm([c.f[0] + (target.f[0] - c.f[0]) * k, c.f[1] + (target.f[1] - c.f[1]) * k, c.f[2] + (target.f[2] - c.f[2]) * k]);
    var u0 = [c.u[0] + (target.u[0] - c.u[0]) * k, c.u[1] + (target.u[1] - c.u[1]) * k, c.u[2] + (target.u[2] - c.u[2]) * k];
    var r = norm(cross(f, u0));
    st.cam = { f: f, r: r, u: cross(r, f) };
  }

  // ---------- canvas sizing ----------
  var W = 0, H = 0, DPR = 1;
  // NASA Milky Way photo map and the sky colour on a WebGL layer behind this canvas (js/skygl.js);
  // without WebGL the sky is filled here and the Milky Way outline polygons are used instead
  var glCanvas = document.getElementById('skygl');
  var GL = glCanvas && window.SkyGL ? SkyGL(glCanvas, 'assets/milkyway_4k.jpg') : null;
  if (glCanvas && !GL) glCanvas.style.display = 'none';
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 3); // full phone resolution keeps stars crisp
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    if (GL) GL.resize(W, H, Math.min(DPR, 2)); // the smooth sky background does not need more
    $('rotate').hidden = !(st.mode === 'vr' && H > W);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  resize();

  // ---------- projection ----------
  // view: {cx, cy, f, R (normalising radius), k (barrel), clip:[x,y,w,h]}
  function proj(view, x, y, z, out) { // camera coords -> screen px; returns false if behind
    if (z < 0.1) return false;
    var px = x / z * view.f, py = -y / z * view.f;
    if (view.k > 0) {
      var rn2 = (px * px + py * py) / (view.R * view.R);
      var s = 1 / Math.sqrt(1 + view.k * rn2);
      px *= s; py *= s;
    }
    out[0] = view.cx + px; out[1] = view.cy + py;
    return true;
  }
  function distortPlane(view, px, py, out) { // plane coords (pre-distortion, centered) -> screen
    if (view.k > 0) {
      var rn2 = (px * px + py * py) / (view.R * view.R);
      var s = 1 / Math.sqrt(1 + view.k * rn2); px *= s; py *= s;
    }
    out[0] = view.cx + px; out[1] = view.cy + py;
  }

  // ---------- frame ----------
  var frame = null; // per-frame shared values
  function computeFrame() {
    var M = C.eqjToEnu(S, st.minutes);
    var cam = st.cam;
    var rows = [cam.r, cam.u, cam.f];
    var T = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++)
      T[a][b] = rows[a][0] * M[0][b] + rows[a][1] * M[1][b] + rows[a][2] * M[2][b];
    var sunJ = C.radec2vec.apply(null, C.bodyRaDec(S, 'Sun', st.minutes));
    var sun = C.apply(M, sunJ);
    var sunAlt = Math.asin(sun[2]) / D2R;
    var twiLim = sunAlt >= -6 ? 1.0 : sunAlt <= -18 ? 6.5 : 1.0 + (-6 - sunAlt) / 12 * 5.5;
    var lim = Math.min(STORY.ev && STORY.ev.lim != null ? STORY.ev.lim : st.lim, twiLim);
    // moonlight: a bright Moon high in the sky washes out the faint stars
    var moonJ = C.radec2vec.apply(null, C.bodyRaDec(S, 'Moon', st.minutes)), moonUp = C.apply(M, moonJ)[2];
    var moonK = (1 - (moonJ[0] * sunJ[0] + moonJ[1] * sunJ[1] + moonJ[2] * sunJ[2])) / 2; // lit fraction
    var moonLight = moonUp > 0 ? moonK * moonK * Math.min(1, moonUp / 0.42) : 0;
    lim -= 1.6 * moonLight;
    var dark = Math.max(0, Math.min(1, (-sunAlt - 10) / 8)); // 0 at -10, 1 at -18
    var bodies = [];
    ['Saturn', 'Uranus', 'Neptune', 'Jupiter', 'Mars', 'Venus', 'Mercury', 'Moon'].forEach(function (b) {
      var v = C.radec2vec.apply(null, C.bodyRaDec(S, b, st.minutes));
      var e = C.apply(M, v);
      if (e[2] > 0) bodies.push({ key: b, v: v, enu: e, mag: S.planets[b].mag });
    });
    frame = { M: M, T: T, sunEnu: sun, sunJ: sunJ, sunAlt: sunAlt, lim: lim, dark: dark, bodies: bodies, moonK: moonK, moonLight: moonLight };
  }
  function toCam(v, out) {
    var T = frame.T;
    out[0] = T[0][0] * v[0] + T[0][1] * v[1] + T[0][2] * v[2];
    out[1] = T[1][0] * v[0] + T[1][1] * v[1] + T[1][2] * v[2];
    out[2] = T[2][0] * v[0] + T[2][1] * v[1] + T[2][2] * v[2];
    return out;
  }
  function altOf(v) { var M = frame.M; return M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]; }

  function mix(a, b, t) { return a + (b - a) * t; }
  function skyColor(sunAlt) {
    var t = Math.max(0, Math.min(1, (-sunAlt - 4) / 14));
    var top = [mix(34, 6, t), mix(52, 7, t), mix(98, 12, t)];
    return 'rgb(' + top.map(Math.round).join(',') + ')';
  }

  var P = [0, 0], Q = [0, 0], CV = [0, 0, 0], CV2 = [0, 0, 0];

  function drawView(view) {
    var c = ctx;
    c.save();
    c.beginPath(); c.rect(view.clip[0], view.clip[1], view.clip[2], view.clip[3]); c.clip();
    // sky (the WebGL layer underneath paints it when available)
    if (!GL) {
      c.fillStyle = skyColor(frame.sunAlt);
      c.fillRect(view.clip[0], view.clip[1], view.clip[2], view.clip[3]);
    }
    // twilight glow toward the sun
    var glowA = frame.sunAlt > -4 ? 0.7 : frame.sunAlt < -18 ? 0 : 0.7 * (frame.sunAlt + 18) / 14;
    if (glowA > 0.01) {
      var se = frame.sunEnu, cam = st.cam;
      var sx = se[0] * cam.r[0] + se[1] * cam.r[1] + se[2] * cam.r[2];
      var sy = se[0] * cam.u[0] + se[1] * cam.u[1] + se[2] * cam.u[2];
      var sz = se[0] * cam.f[0] + se[1] * cam.f[1] + se[2] * cam.f[2];
      if (sz > 0.12) {
        proj(view, sx, sy, sz, P);
        var rad = view.f * 2.2;
        var g = c.createRadialGradient(P[0], P[1], 0, P[0], P[1], rad);
        g.addColorStop(0, 'rgba(255,150,100,' + glowA + ')');
        g.addColorStop(0.35, 'rgba(200,110,120,' + glowA * 0.45 + ')');
        g.addColorStop(1, 'rgba(60,60,140,0)');
        c.fillStyle = g;
        c.fillRect(view.clip[0], view.clip[1], view.clip[2], view.clip[3]);
      }
    }
    // milky way
    if (opt('mw') && !GL) {
      var mwA = frame.dark * (st.lim >= 6 ? 1 : st.lim >= 4.5 ? 0.45 : 0.12);
      if (mwA > 0.02) {
        c.fillStyle = 'rgba(190,200,255,' + (0.055 * mwA) + ')';
        for (var fi = 0; fi < MW.length; fi++) {
          c.beginPath();
          var rings = MW[fi];
          for (var ri = 0; ri < rings.length; ri++) polyPath(view, rings[ri]);
          c.fill('evenodd');
        }
      }
    }
    // constellation lines
    var sel = view.sel, selCons = (sel && sel.cons) || guideCons() || (STORY.ev && STORY.ev.highlight) || null;
    LBL = STORY.ev ? STORY.ev.labelAlpha : 1;
    drawPhotos(view);
    drawArt(view, selCons);
    if (opt('lines')) {
      c.lineWidth = Math.max(1, view.f / 420);
      c.strokeStyle = 'rgba(140,170,255,' + (0.38 * LBL).toFixed(3) + ')';
      c.beginPath();
      for (var li = 0; li < LINES.length; li++) if (LINES[li].id !== selCons) linePath(view, LINES[li].pts);
      c.stroke();
    }
    if (selCons) {
      c.lineWidth = Math.max(1.6, view.f / 260);
      c.strokeStyle = 'rgba(232,207,138,0.9)';
      c.beginPath();
      for (var lj = 0; lj < LINES.length; lj++) if (LINES[lj].id === selCons) linePath(view, LINES[lj].pts);
      c.stroke();
    }
    drawStoryLines(view);
    drawStoryPointer(view);
    if (opt('trails') && !STORY.ev) drawTrails(view);
    // stars
    var lim = frame.lim, sizeK = Math.max(0.85, Math.min(2, Math.sqrt(view.f / 380)));
    var M = frame.M, T = frame.T;
    for (var i = 0; i < NS; i++) {
      var m = SM[i];
      if (m > lim + 0.3) continue;
      var x = SV[3 * i], y = SV[3 * i + 1], z = SV[3 * i + 2];
      var up = M[2][0] * x + M[2][1] * y + M[2][2] * z;
      if (up <= 0) continue;
      var cz = T[2][0] * x + T[2][1] * y + T[2][2] * z;
      if (cz < 0.1) continue;
      var cx = T[0][0] * x + T[0][1] * y + T[0][2] * z;
      var cy = T[1][0] * x + T[1][1] * y + T[1][2] * z;
      proj(view, cx, cy, cz, P);
      if (P[0] < view.clip[0] - 20 || P[0] > view.clip[0] + view.clip[2] + 20 || P[1] < view.clip[1] - 20 || P[1] > view.clip[1] + view.clip[3] + 20) continue;
      var mEff = m + 0.25 * (1 / Math.max(up, 0.06) - 1); // thicker air near the ground
      var vis = lim - mEff;
      if (vis < -0.3) continue;
      var alpha = Math.max(0.25, Math.min(1, 0.45 + vis / 1.4));
      var d = Math.max(3, (lim + 2.6 - mEff) * 2.5) * sizeK;
      if (m < 1.5) d *= 1.25;
      c.globalAlpha = alpha;
      c.drawImage(sprites[SB[i]], P[0] - d / 2, P[1] - d / 2, d, d);
    }
    c.globalAlpha = 1;
    // planets & deep-sky markers
    var fontPx = view.font;
    for (var bi = 0; bi < frame.bodies.length; bi++) drawBody(view, frame.bodies[bi], fontPx);
    // ground
    drawGround(view);
    // labels (greedy placement: earlier = more important, overlapping ones are skipped)
    view.boxes = [];
    if (view.vr) {
      view.layout = vrLayout(view, fontPx);
      view.boxes.push(view.layout.topBox);
      var kc = view.layout.card;
      if (kc) view.boxes.push([kc.x, kc.y, kc.x + kc.w, kc.y + kc.h]);
    }
    c.textBaseline = 'middle';
    if (opt('dirs')) drawDirs(view, fontPx);
    for (var bg = 0; bg < frame.bodies.length; bg++) { // reserve the planet glyphs themselves
      toCam(frame.bodies[bg].v, CV);
      if (proj(view, CV[0], CV[1], CV[2], P)) { var gr = fontPx * (frame.bodies[bg].mag > 5 ? 0.6 : 1.0); view.boxes.push([P[0] - gr, P[1] - gr * 0.6, P[0] + gr, P[1] + gr * 0.6]); }
    }
    var bodiesByMag = frame.bodies.slice().sort(function (a, b) { return a.mag - b.mag; });
    for (var bl = 0; bl < bodiesByMag.length; bl++) bodyLabel(view, bodiesByMag[bl], fontPx);
    if (opt('names') || selCons) {
      var consOrder = CONS.slice().sort(function (a, b) { return (b.id === selCons ? 1 : 0) - (a.id === selCons ? 1 : 0); });
      for (var ci = 0; ci < consOrder.length; ci++) {
        var cn = consOrder[ci];
        var isSel = selCons === cn.id;
        if (!opt('names') && !isSel) continue;
        if (altOf(cn.v) < 0.03) continue;
        toCam(cn.v, CV);
        if (!proj(view, CV[0], CV[1], CV[2], P)) continue;
        tryText(view, cn.ko, P[0], P[1], Math.round(fontPx * (isSel ? 1.25 : 1.05)), LABEL_FONT,
          isSel ? 'rgba(232,207,138,1)' : 'rgba(170,190,255,0.66)', 'center', isSel);
      }
    }
    if (opt('stars')) {
      var starMax = view.vr ? 2.1 : 2.6;
      for (var ni = 0; ni < S.named.length; ni++) {
        var idx = S.named[ni][0];
        if (SM[idx] > Math.min(lim, starMax)) continue;
        var vv = [SV[3 * idx], SV[3 * idx + 1], SV[3 * idx + 2]];
        if (altOf(vv) < 0.02) continue;
        toCam(vv, CV);
        if (!proj(view, CV[0], CV[1], CV[2], P)) continue;
        tryText(view, S.named[ni][1], P[0] + fontPx * 0.55, P[1] - fontPx * 0.15, Math.round(fontPx * 0.85), LABEL_FONT, 'rgba(255,240,210,0.85)', 'left');
      }
      for (var di = 0; di < DSO.length; di++) {
        if (altOf(DSO[di].v) < 0.03 || frame.lim < 4) continue;
        toCam(DSO[di].v, CV);
        if (!proj(view, CV[0], CV[1], CV[2], P)) continue;
        c.strokeStyle = 'rgba(200,220,255,0.5)'; c.lineWidth = 1;
        c.beginPath(); c.arc(P[0], P[1], fontPx * 0.55, 0, Math.PI * 2); c.stroke();
        tryText(view, DSO[di].name, P[0], P[1] + fontPx * 1.25, Math.round(fontPx * 0.85), LABEL_FONT, 'rgba(200,220,255,0.8)', 'center');
      }
    }
    if (view.vr && PANEL.open) drawPanel(view, fontPx);
    var ep = STORY.ev && STORY.ev.eyepiece;
    if (ep && ep.a > 0) drawEyepiece(view, ep.a, fontPx);
    // reticle (hidden while the telescope view covers the middle)
    if (!(ep && ep.a > 0.3)) {
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(view.cx, view.cy, fontPx * 0.7, 0, Math.PI * 2); c.stroke();
    }
    if (view.vr && !PANEL.open && performance.now() - (st.vrT || 0) < 12000) {
      c.font = Math.round(fontPx * 0.95) + 'px ' + LABEL_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
      var hint = '↓ 아래를 내려다보면 설정이 나와요';
      var hw = c.measureText(hint).width;
      c.fillStyle = 'rgba(14,15,20,0.94)'; roundRect(view.cx - hw / 2 - 10, view.cy + view.R * 0.66 - fontPx * 0.8, hw + 20, fontPx * 1.6, fontPx * 0.8); c.fill();
      c.fillStyle = '#e8cf8a'; c.fillText(hint, view.cx, view.cy + view.R * 0.66);
    }
    // vignette for lenses, then the heads-up text on top
    if (view.vr) {
      var vg = c.createRadialGradient(view.cx, view.cy, view.R * 0.92, view.cx, view.cy, view.R * 1.25);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
      c.fillStyle = vg; c.fillRect(view.clip[0], view.clip[1], view.clip[2], view.clip[3]);
      drawVrHud(view, fontPx);
    }
    drawNetOverlay(view, fontPx);
    if (view.vr && quizOn()) drawQuiz(view, fontPx);
    c.restore();
  }

  // telescope view: the sky darkens outside a circle and Saturn is shown in a Hubble photo from 2009,
  // when the rings were nearly edge-on as they are in 2026 (NASA, ESA and the Hubble Heritage Team (STScI/AURA), CC BY 4.0)
  var SATURN = new Image(); SATURN.src = 'assets/saturn.webp';
  function drawEyepiece(view, a, fontPx) {
    var c = ctx, cl = view.clip;
    var r = view.vr ? view.R * 0.42 : Math.min(cl[2], cl[3]) * 0.34;
    c.save();
    c.globalAlpha = 1;
    c.beginPath(); c.rect(cl[0], cl[1], cl[2], cl[3]); c.arc(view.cx, view.cy, r, 0, Math.PI * 2, true);
    c.fillStyle = 'rgba(0,0,0,' + 0.88 * a + ')'; c.fill();
    c.beginPath(); c.arc(view.cx, view.cy, r, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(2,3,6,' + 0.9 * a + ')'; c.fillRect(view.cx - r, view.cy - r, r * 2, r * 2);
    if (SATURN.complete && SATURN.naturalWidth) {
      var sw = r * 1.5, sh = sw * SATURN.naturalHeight / SATURN.naturalWidth;
      c.globalAlpha = a;
      c.translate(view.cx, view.cy); c.rotate(-0.12);
      c.drawImage(SATURN, -sw / 2, -sh / 2, sw, sh);
    }
    c.restore();
    c.save(); c.globalAlpha = a;
    c.strokeStyle = 'rgba(200,190,170,0.35)'; c.lineWidth = 1;
    c.beginPath(); c.arc(view.cx, view.cy, r, 0, Math.PI * 2); c.stroke();
    c.font = Math.round(fontPx * 0.8) + 'px ' + LABEL_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(214,206,190,0.8)';
    c.fillText('허블 사진 · 2009년, 올해처럼 고리가 옆으로 누운 때', view.cx, view.vr ? view.cy - r - fontPx * 0.9 : view.cy + r + fontPx * 1.1);
    c.restore();
  }

  // real photos of a few deep-sky objects (js/photos.js, from vr_planetarium v3), pinned to the sky by three corners;
  // faint at a normal field of view, full strength when zoomed in
  var PHOTOS = (window.SKY_PHOTOS || []).map(function (p) {
    var it = { id: p.id, img: new Image(), ok: false, base: p.base || 0.5,
      tl: C.radec2vec(p.tl[0], p.tl[1]), tr: C.radec2vec(p.tr[0], p.tr[1]), bl: C.radec2vec(p.bl[0], p.bl[1]) };
    it.cen = C.radec2vec((p.tr[0] + p.bl[0]) / 2, (p.tr[1] + p.bl[1]) / 2);
    it.img.onload = function () { it.ok = true; }; it.img.src = p.src;
    return it;
  });
  var PA = [0, 0], PB = [0, 0], PC = [0, 0], PM = [0, 0], PV = [0, 0, 0];
  function drawPhotos(view) {
    if (!PHOTOS.length || frame.dark < 0.05) return;
    var fovNow = view.vr ? st.fov : (st.mode === 'menu' ? 80 : st.zoomFov), zoom = Math.max(0, Math.min(1, (80 - fovNow) / 45));
    for (var i = 0; i < PHOTOS.length; i++) {
      var p = PHOTOS[i]; if (!p.ok || altOf(p.cen) < 0.02) continue;
      toCam(p.cen, PV); if (PV[2] < 0.2 || !proj(view, PV[0], PV[1], PV[2], PM)) continue;
      toCam(p.tl, PV); if (!proj(view, PV[0], PV[1], PV[2], PA)) continue;
      toCam(p.tr, PV); if (!proj(view, PV[0], PV[1], PV[2], PB)) continue;
      toCam(p.bl, PV); if (!proj(view, PV[0], PV[1], PV[2], PC)) continue;
      var w = p.img.width, h = p.img.height;
      ctx.save();
      ctx.globalAlpha = frame.dark * (p.base + (1 - p.base) * zoom);
      ctx.transform((PB[0] - PA[0]) / w, (PB[1] - PA[1]) / w, (PC[0] - PA[0]) / h, (PC[1] - PA[1]) / h, PA[0], PA[1]);
      ctx.drawImage(p.img, 0, 0);
      ctx.restore();
    }
  }

  // star trails: the paths the bright stars have drawn since the trails were switched on. They grow only as sky
  // time passes (run the clock fast to watch the diurnal motion); a jump in time or a new night starts them afresh.
  var TRAIL = { key: '', Ms: null, lo: null, hi: null, last: null, sky: '', at: 0 };
  function trailTick(on) {
    var m = st.minutes, now = performance.now(), dt = (now - (TRAIL.at || now)) / 1000; TRAIL.at = now;
    if (!on) { TRAIL.lo = TRAIL.hi = TRAIL.last = null; return; }
    var speed = syncActive() ? SYNC.speed : st.speed, flow = Math.abs(speed) * dt / 60; // minutes the clock may run in this frame
    if (TRAIL.last == null || Math.abs(m - TRAIL.last) > 20 + flow * 1.5 || TRAIL.sky !== skyKey) { TRAIL.lo = TRAIL.hi = m; TRAIL.sky = skyKey; }
    TRAIL.lo = Math.min(TRAIL.lo, m); TRAIL.hi = Math.max(TRAIL.hi, m); TRAIL.last = m;
  }
  function drawTrails(view) {
    var span = TRAIL.hi - TRAIL.lo, cam = st.cam, c = ctx;
    if (!(span > 0.5)) return;
    var steps = Math.max(2, Math.min(72, Math.ceil(span / 4)));
    var key = TRAIL.sky + ':' + Math.round(TRAIL.lo * 4) + ':' + Math.round(TRAIL.hi * 4);
    if (TRAIL.key !== key) {
      TRAIL.key = key; TRAIL.Ms = [];
      for (var k = 0; k <= steps; k++) TRAIL.Ms.push(C.eqjToEnu(S, TRAIL.lo + span * k / steps));
    }
    var Ms = TRAIL.Ms;
    c.save();
    c.lineWidth = Math.max(0.8, view.f / 620);
    for (var col = 0; col < STAR_COLORS.length; col++) {
      c.strokeStyle = hexA(STAR_COLORS[col], 0.45);
      c.beginPath();
      for (var i = 0; i < NS; i++) {
        if (SB[i] !== col || SM[i] > 3.6) continue;
        var v = [SV[3 * i], SV[3 * i + 1], SV[3 * i + 2]], started = false;
        for (var q = 0; q < Ms.length; q++) {
          var e = C.apply(Ms[q], v);
          if (e[2] < 0) { started = false; continue; }
          CV[0] = e[0] * cam.r[0] + e[1] * cam.r[1] + e[2] * cam.r[2];
          CV[1] = e[0] * cam.u[0] + e[1] * cam.u[1] + e[2] * cam.u[2];
          CV[2] = e[0] * cam.f[0] + e[1] * cam.f[1] + e[2] * cam.f[2];
          if (!proj(view, CV[0], CV[1], CV[2], P)) { started = false; continue; }
          if (!started) { c.moveTo(P[0], P[1]); started = true; } else c.lineTo(P[0], P[1]);
        }
      }
      c.stroke();
    }
    c.restore();
  }

  function linePath(view, pts) {
    var c = ctx, started = false;
    toCam(pts[0], CV);
    for (var k = 1; k < pts.length; k++) {
      toCam(pts[k], CV2);
      segPath(view, CV, CV2, started);
      CV[0] = CV2[0]; CV[1] = CV2[1]; CV[2] = CV2[2];
    }
  }
  function segPath(view, a, b, _s) {
    var c = ctx;
    var za = a[2], zb = b[2], ax = a[0], ay = a[1], bx = b[0], by = b[1];
    if (za < 0.1 && zb < 0.1) return;
    if (za < 0.1) { var t = (0.1 - za) / (zb - za); ax += (bx - ax) * t; ay += (by - ay) * t; za = 0.1; }
    else if (zb < 0.1) { var t2 = (0.1 - zb) / (za - zb); bx += (ax - bx) * t2; by += (ay - by) * t2; zb = 0.1; }
    var n = view.k > 0 ? 6 : 1;
    for (var s = 0; s <= n; s++) {
      var u = s / n;
      var x = ax + (bx - ax) * u, y = ay + (by - ay) * u, z = za + (zb - za) * u;
      proj(view, x, y, z, P);
      if (s === 0) c.moveTo(P[0], P[1]); else c.lineTo(P[0], P[1]);
    }
  }
  function polyPath(view, ring) {
    // clip ring against camera plane z >= 0.1 (Sutherland-Hodgman), then project
    var pts = [], n = ring.length, a = [0, 0, 0], b = [0, 0, 0];
    for (var k = 0; k < n; k++) {
      toCam(ring[k], a); toCam(ring[(k + 1) % n], b);
      var ina = a[2] >= 0.1, inb = b[2] >= 0.1;
      if (ina) pts.push([a[0], a[1], a[2]]);
      if (ina !== inb) {
        var t = (0.1 - a[2]) / (b[2] - a[2]);
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.1]);
      }
    }
    if (pts.length < 3) return;
    for (var j = 0; j < pts.length; j++) {
      proj(view, pts[j][0], pts[j][1], pts[j][2], P);
      if (j === 0) ctx.moveTo(P[0], P[1]); else ctx.lineTo(P[0], P[1]);
    }
    ctx.closePath();
  }

  function drawGround(view) {
    // ground = screen points whose ray has Up < 0: U(x,y) = f.U + x r.U - y u.U  (plane coords px / f)
    var cam = st.cam, fU = cam.f[2], rU = cam.r[2], uU = cam.u[2];
    var L = view.f * 8;
    var poly = [[-L, -L], [L, -L], [L, L], [-L, L]];
    var out = [];
    function U(p) { return fU + (p[0] / view.f) * rU - (p[1] / view.f) * uU; }
    for (var k = 0; k < 4; k++) {
      var a = poly[k], b = poly[(k + 1) % 4], ua = U(a), ub = U(b);
      if (ua < 0) out.push(a);
      if ((ua < 0) !== (ub < 0)) { var t = ua / (ua - ub); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    if (out.length < 3) return;
    var c = ctx;
    c.beginPath();
    var steps = view.k > 0 ? 40 : 1;
    for (var i = 0; i < out.length; i++) {
      var p = out[i], q = out[(i + 1) % out.length];
      for (var s = 0; s < steps; s++) {
        var u = s / steps;
        distortPlane(view, p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, P);
        if (i === 0 && s === 0) c.moveTo(P[0], P[1]); else c.lineTo(P[0], P[1]);
      }
    }
    c.closePath();
    c.fillStyle = '#0a0d14';
    c.fill();
    // horizon line: trees and town silhouette suggestion via soft edge
    c.strokeStyle = 'rgba(120,140,200,0.35)'; c.lineWidth = 1.2; c.stroke();
  }

  var LBL = 1;
  function tryText(view, text, x, y, size, font, color, align, force) {
    var c = ctx;
    c.font = size + 'px ' + font;
    var w = c.measureText(text).width, h = size * 1.05;
    var x0 = align === 'left' ? x : x - w / 2, y0 = y - h / 2;
    var pad = size * 0.15;
    var b = view.boxes;
    if (!force) {
      for (var i = 0; i < b.length; i++) {
        var q = b[i];
        if (x0 - pad < q[2] && x0 + w + pad > q[0] && y0 - pad < q[3] && y0 + h + pad > q[1]) return false;
      }
    }
    b.push([x0, y0, x0 + w, y0 + h]);
    c.globalAlpha = LBL;
    c.textAlign = align; c.fillStyle = color;
    c.fillText(text, x, y);
    return true;
  }
  function drawDirs(view, fontPx) {
    var c = ctx;
    c.font = Math.round(fontPx * 1.2) + 'px ' + LABEL_FONT;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    var cam = st.cam;
    for (var k = 0; k < 8; k++) {
      var az = k * 45 * D2R;
      var e = [Math.sin(az) * Math.cos(3 * D2R), Math.cos(az) * Math.cos(3 * D2R), Math.sin(-3 * D2R)];
      var x = e[0] * cam.r[0] + e[1] * cam.r[1] + e[2] * cam.r[2];
      var y = e[0] * cam.u[0] + e[1] * cam.u[1] + e[2] * cam.u[2];
      var z = e[0] * cam.f[0] + e[1] * cam.f[1] + e[2] * cam.f[2];
      if (!proj(view, x, y, z, P)) continue;
      tryText(view, DIRS[k], P[0], P[1] + fontPx * 0.4, Math.round(fontPx * 1.2), LABEL_FONT,
        k % 2 === 0 ? 'rgba(255,154,107,0.95)' : 'rgba(255,154,107,0.6)', 'center', true);
    }
  }

  function drawBody(view, b, fontPx) {
    toCam(b.v, CV);
    if (!proj(view, CV[0], CV[1], CV[2], P)) return;
    var c = ctx;
    var faint = b.mag > 5;
    var sizeK = Math.sqrt(view.f / 500);
    if (b.key === 'Saturn') { // to the eye Saturn is a steady yellow point; the photo appears in the story's telescope scene
      var ds = 17 * sizeK;
      c.drawImage(sprites[3], P[0] - ds / 2, P[1] - ds / 2, ds, ds);
    } else if (b.key === 'Moon') {
      drawMoon(view, b, sizeK);
    } else if (faint) {
      c.fillStyle = 'rgba(150,230,220,0.85)';
      c.beginPath(); c.arc(P[0], P[1], 1.6 * sizeK, 0, Math.PI * 2); c.fill();
      c.setLineDash([3, 3]); c.strokeStyle = 'rgba(150,230,220,0.6)'; c.lineWidth = 1;
      c.beginPath(); c.arc(P[0], P[1], fontPx * 0.6, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    } else {
      var d = 14 * sizeK;
      c.drawImage(sprites[3], P[0] - d / 2, P[1] - d / 2, d, d);
    }
  }
  // the Moon with its phase: the lit side faces the Sun, the terminator is a half ellipse
  function drawMoon(view, b, sizeK) {
    var c = ctx, m = b.v, s = frame.sunJ, k = frame.moonK;
    var r = Math.max(5.5 * sizeK, 0.26 * D2R * view.f);
    var d = m[0] * s[0] + m[1] * s[1] + m[2] * s[2], w = [s[0] - d * m[0], s[1] - d * m[1], s[2] - d * m[2]];
    var wl = Math.hypot(w[0], w[1], w[2]) || 1, q = [m[0] + 0.01 * w[0] / wl, m[1] + 0.01 * w[1] / wl, m[2] + 0.01 * w[2] / wl];
    var x0 = P[0], y0 = P[1], ang = 0;
    toCam(q, CV); if (proj(view, CV[0], CV[1], CV[2], Q)) ang = Math.atan2(Q[1] - y0, Q[0] - x0);
    c.globalAlpha = 0.5 + 0.5 * k;
    c.drawImage(sprites[2], x0 - r * 3, y0 - r * 3, r * 6, r * 6);
    c.globalAlpha = 1;
    c.save(); c.translate(x0, y0); c.rotate(ang);
    c.fillStyle = 'rgba(70,74,92,0.35)'; // earthshine on the dark side
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    if (k > 0.01) {
      c.fillStyle = '#f3efe2';
      c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
      c.ellipse(0, 0, r * Math.abs(2 * k - 1), r, 0, Math.PI / 2, -Math.PI / 2, k < 0.5);
      c.fill();
    }
    c.restore();
  }
  function bodyLabel(view, b, fontPx) {
    toCam(b.v, CV);
    if (!proj(view, CV[0], CV[1], CV[2], P)) return;
    var faint = b.mag > 5;
    tryText(view, BODY_INFO[b.key].name, P[0], P[1] + fontPx * (faint ? 1.25 : 1.6), Math.round(fontPx * (faint ? 0.85 : 1.15)), LABEL_FONT,
      faint ? 'rgba(150,230,220,0.85)' : 'rgba(232,207,138,1)', 'center', false);
  }

  function wrapLines(text, maxW) {
    var words = text.split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function roundRect(x, y, w, h, r) {
    var c = ctx; c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function vrLayout(view, fontPx) {
    var c = ctx, sel = view.sel;
    var fa = C.enuToAltAz(st.cam.f);
    var L = { top: clockText(st.minutes) + ' · ' + DIRS[Math.round(fa.az / 45) % 8] + '쪽 · 높이 ' + Math.round(fa.alt) + '°', topY: view.cy - view.R * 0.66 };
    c.font = Math.round(fontPx * 0.9) + 'px ' + LABEL_FONT;
    var tw = c.measureText(L.top).width;
    L.topBox = [view.cx - tw / 2 - 6, L.topY - fontPx * 0.7, view.cx + tw / 2 + 6, L.topY + fontPx * 0.7];
    if (sel) {
      var bw = view.R * 0.74, x = view.cx + view.R * 0.12;
      c.font = Math.round(fontPx * 0.88) + 'px ' + BODY_FONT;
      var lines = sel.text ? wrapLines(sel.text, bw - fontPx * 1.4) : [];
      var lh = fontPx * 1.3;
      var bh = fontPx * 2.1 + lines.length * lh + fontPx * 0.4;
      var y = view.cy - bh * 0.42;
      L.card = { x: x, y: y, w: bw, h: bh, lines: lines, lh: lh };
    }
    return L;
  }
  function drawVrHud(view, fontPx) {
    var c = ctx, sel = view.sel, L = view.layout || vrLayout(view, fontPx);
    c.font = Math.round(fontPx * 0.9) + 'px ' + LABEL_FONT;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(230,235,255,0.8)';
    c.fillText(L.top, view.cx, L.topY);
    if (!sel || !L.card) return;
    var k = L.card;
    c.fillStyle = 'rgba(14,15,20,0.97)';
    roundRect(k.x, k.y, k.w, k.h, fontPx * 0.6); c.fill();
    c.strokeStyle = 'rgba(232,207,138,0.35)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#e8cf8a';
    c.font = Math.round(fontPx * 1.2) + 'px ' + LABEL_FONT;
    c.textAlign = 'left';
    c.fillText(sel.name, k.x + fontPx * 0.7, k.y + fontPx * 1.15);
    c.fillStyle = 'rgba(241,242,245,0.95)';
    c.font = Math.round(fontPx * 0.88) + 'px ' + BODY_FONT;
    for (var i = 0; i < k.lines.length; i++) c.fillText(k.lines[i], k.x + fontPx * 0.7, k.y + fontPx * 2.3 + i * k.lh);
  }

  // ---------- gaze target ----------
  function pickTarget() {
    var f = st.cam.f; // ENU
    var M = frame.M;
    function angTo(v) { // v in J2000
      var e = C.apply(M, v);
      var d = e[0] * f[0] + e[1] * f[1] + e[2] * f[2];
      return { a: Math.acos(Math.max(-1, Math.min(1, d))) / D2R, up: e[2] };
    }
    var best = null, bestScore = 1e9;
    function consider(score, t) { if (score < bestScore) { bestScore = score; best = t; } }
    frame.bodies.forEach(function (b) {
      var r = angTo(b.v); if (r.up <= 0) return;
      if (r.a < 4) consider(r.a / 4, { name: BODY_INFO[b.key].name, text: BODY_INFO[b.key].text, cons: null });
    });
    DSO.forEach(function (d) {
      var r = angTo(d.v); if (r.up <= 0) return;
      if (r.a < 3.5) consider(r.a / 3.5 + 0.05, { name: d.name, text: d.text, cons: null });
    });
    for (var i = 0; i < S.named.length; i++) {
      var idx = S.named[i][0];
      if (SM[idx] > 2.6) continue;
      var r = angTo([SV[3 * idx], SV[3 * idx + 1], SV[3 * idx + 2]]); if (r.up <= 0) continue;
      if (r.a < 2.8) {
        var nm = S.named[i][1];
        consider(r.a / 2.8 + 0.1, { name: nm, text: STAR_INFO[nm] || '', cons: null });
      }
    }
    if (!best || bestScore > 0.6) {
      for (var k = 0; k < CONS.length; k++) {
        var cr = angTo(CONS[k].v); if (cr.up <= 0.02) continue;
        if (cr.a < 11) consider(0.7 + cr.a / 11, { name: CONS[k].ko, text: CONS[k].info, cons: CONS[k].id });
      }
    }
    return best;
  }

  // ---------- main loop ----------
  var LABEL_FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  var TITLE_FONT = LABEL_FONT;
  var BODY_FONT = LABEL_FONT;
  // ---------- gaze settings panel (look down at your feet, stare at a button ~1 s) ----------
  var PANEL = { open: false, yaw: 180, lastAz: 180, id: null, t: 0, repeat: 0, toast: '', toastT: 0 };
  var DWELL = 0.9, REPEAT = 0.4;
  var BTNS = [
    { id: 'ipd-', x: -0.26, y: 0.31, w: 0.17, h: 0.15, label: '−', rep: true },
    { id: 'ipd+', x: 0.26, y: 0.31, w: 0.17, h: 0.15, label: '+', rep: true },
    { id: 'warp-', x: -0.26, y: 0.11, w: 0.17, h: 0.15, label: '−', rep: true },
    { id: 'warp+', x: 0.26, y: 0.11, w: 0.17, h: 0.15, label: '+', rep: true },
    { id: 'fov-', x: -0.26, y: -0.09, w: 0.17, h: 0.15, label: '−', rep: true },
    { id: 'fov+', x: 0.26, y: -0.09, w: 0.17, h: 0.15, label: '+', rep: true },
    { id: 'south', x: -0.5, y: -0.31, w: 0.62, h: 0.16, label: '이 방향이 남쪽' },
    { id: 'menu', x: 0.18, y: -0.31, w: 0.3, h: 0.16, label: '메뉴로' },
    { id: 'art', x: 0.56, y: -0.31, w: 0.34, h: 0.16, label: '그림 끄기' }
  ];
  var ROWS = [
    { y: 0.31, name: '두 화면 간격', val: function () { return st.ipdAdj === 0 ? '기본' : (st.ipdAdj > 0 ? '+' : '') + st.ipdAdj; } },
    { y: 0.11, name: '렌즈 보정', val: function () { return st.warp < 0.1 ? '끔' : Math.round(st.warp * 10); } },
    { y: -0.09, name: '보이는 넓이', val: function () { return st.fov + '°'; } }
  ];
  // The panel is a flat card standing 45 deg below the horizon, facing the viewer, in the heading you looked at before bowing your head.
  var PITCH = 45 * D2R;
  function panelBasis() {
    var a = PANEL.yaw * D2R, sa = Math.sin(a), ca = Math.cos(a), cp = Math.cos(PITCH), sp = Math.sin(PITCH);
    var r = [ca, -sa, 0], c = [sa * cp, ca * cp, -sp];
    var u = [r[1] * c[2] - r[2] * c[1], r[2] * c[0] - r[0] * c[2], r[0] * c[1] - r[1] * c[0]];
    return { r: r, c: c, u: u };
  }
  function planePt(view, x, y, out) {
    var B = panelBasis(), cam = st.cam;
    var e = B.c[0] + B.r[0] * x + B.u[0] * y, n = B.c[1] + B.r[1] * x + B.u[1] * y, u = B.c[2] + B.r[2] * x + B.u[2] * y;
    var l = Math.hypot(e, n, u); e /= l; n /= l; u /= l;
    var cx = e * cam.r[0] + n * cam.r[1] + u * cam.r[2];
    var cy = e * cam.u[0] + n * cam.u[1] + u * cam.u[2];
    var cz = e * cam.f[0] + n * cam.f[1] + u * cam.f[2];
    return proj(view, cx, cy, cz, out);
  }
  function applyBtn(id) {
    var changed = true;
    if (id === 'ipd-') st.ipdAdj = Math.max(-60, st.ipdAdj - 4);
    else if (id === 'ipd+') st.ipdAdj = Math.min(60, st.ipdAdj + 4);
    else if (id === 'warp-') st.warp = Math.max(0, Math.round((st.warp - 0.1) * 10) / 10);
    else if (id === 'warp+') st.warp = Math.min(0.8, Math.round((st.warp + 0.1) * 10) / 10);
    else if (id === 'fov-') st.fov = Math.max(70, st.fov - 5);
    else if (id === 'fov+') st.fov = Math.min(120, st.fov + 5);
    else if (id === 'south') {
      var cur = st.headingOffset;
      st.headingOffset = (((cur + (PANEL.yaw - 180)) % 360) + 360) % 360;
      PANEL.yaw = 180; PANEL.lastAz = 180;
      PANEL.toast = '맞췄어요!'; PANEL.toastT = 1.6;
      saveSettings();
      return;
    } else if (id === 'menu') { leave(); return; }
    else if (id === 'art') {
      if (NET.room && SYNC.has && SYNC.art != null) { PANEL.toast = '지금은 진행자가 정해요'; PANEL.toastT = 1.6; return; }
      st.show.art = !st.show.art; artSlow = false; syncArtUi();
      PANEL.toast = st.show.art ? '별자리 그림을 켰어요' : '별자리 그림을 껐어요'; PANEL.toastT = 1.6;
      return;
    }
    else changed = false;
    if (changed) {
      $('ipd').value = st.ipdAdj; $('warp').value = st.warp; $('fov').value = st.fov;
      syncVrLabels(); saveSettings();
    }
  }
  function updatePanel(dt) {
    if (PANEL.toastT > 0) PANEL.toastT -= dt;
    if (st.mode !== 'vr' || introCovers()) { PANEL.open = false; PANEL.id = null; return; }
    var f = st.cam.f, pitch = Math.asin(Math.max(-1, Math.min(1, f[2]))) / D2R;
    if (pitch > -30) PANEL.lastAz = C.enuToAltAz(f).az;
    if (!PANEL.open && pitch < -36) { PANEL.open = true; PANEL.yaw = PANEL.lastAz; PANEL.id = null; PANEL.t = 0; }
    else if (PANEL.open && pitch > -16) { PANEL.open = false; PANEL.id = null; }
    if (!PANEL.open) return;
    var B = panelBasis(), fc = f[0] * B.c[0] + f[1] * B.c[1] + f[2] * B.c[2], hit = null;
    if (fc > 0.3) {
      var gx = (f[0] * B.r[0] + f[1] * B.r[1] + f[2] * B.r[2]) / fc, gy = (f[0] * B.u[0] + f[1] * B.u[1] + f[2] * B.u[2]) / fc;
      for (var i = 0; i < BTNS.length; i++) {
        var b = BTNS[i];
        if (Math.abs(gx - b.x) < b.w / 2 + 0.02 && Math.abs(gy - b.y) < b.h / 2 + 0.02) { hit = b; break; }
      }
    }
    if (!hit) { PANEL.id = null; PANEL.t = 0; return; }
    if (PANEL.id !== hit.id) { PANEL.id = hit.id; PANEL.t = 0; PANEL.repeat = 0; return; }
    PANEL.t += dt;
    if (PANEL.t >= DWELL) {
      if (hit.rep) {
        PANEL.repeat += dt;
        if (PANEL.repeat >= REPEAT || PANEL.repeat === dt) { PANEL.repeat = 0.0001; applyBtn(hit.id); }
      } else { applyBtn(hit.id); PANEL.id = null; PANEL.t = -0.8; }
    }
  }
  function drawPanel(view, fontPx) {
    var c = ctx, A = [0, 0], Bp = [0, 0], Cp = [0, 0], Dp = [0, 0];
    function quad(x, y, w, h) {
      var ok = planePt(view, x - w / 2, y + h / 2, A) & planePt(view, x + w / 2, y + h / 2, Bp) &
               planePt(view, x + w / 2, y - h / 2, Cp) & planePt(view, x - w / 2, y - h / 2, Dp);
      if (!ok) return false;
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(Bp[0], Bp[1]); c.lineTo(Cp[0], Cp[1]); c.lineTo(Dp[0], Dp[1]); c.closePath();
      return true;
    }
    function hpx() { return Math.hypot(A[0] - Dp[0], A[1] - Dp[1]); }
    function center(x, y, out) { return planePt(view, x, y, out); }
    // backdrop
    if (quad(0, -0.04, 1.42, 1.04)) { c.fillStyle = 'rgba(14,15,20,0.97)'; c.fill(); c.strokeStyle = 'rgba(232,207,138,0.4)'; c.lineWidth = 1.5; c.stroke(); }
    c.textBaseline = 'middle';
    var P2 = [0, 0];
    // title
    if (center(0, 0.48, P2)) { c.font = Math.round(fontPx * 1.05) + 'px ' + LABEL_FONT; c.textAlign = 'center'; c.fillStyle = '#e8cf8a'; c.fillText('설정 · 버튼을 1초 바라보세요', P2[0], P2[1]); }
    // row labels + values
    for (var r = 0; r < ROWS.length; r++) {
      if (center(-0.76, ROWS[r].y, P2)) { c.font = Math.round(fontPx * 0.95) + 'px ' + LABEL_FONT; c.textAlign = 'right'; c.fillStyle = 'rgba(241,242,245,0.9)'; c.fillText(ROWS[r].name, P2[0] + fontPx * 3.2, P2[1]); }
      if (center(0, ROWS[r].y, P2)) { c.font = Math.round(fontPx * 1.1) + 'px ' + LABEL_FONT; c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.fillText(String(ROWS[r].val()), P2[0], P2[1]); }
    }
    // buttons
    for (var i = 0; i < BTNS.length; i++) {
      var b = BTNS[i];
      if (!quad(b.x, b.y, b.w, b.h)) continue;
      var active = PANEL.id === b.id, prog = active ? Math.max(0, Math.min(1, PANEL.t / DWELL)) : 0;
      c.fillStyle = active ? 'rgba(232,207,138,' + (0.25 + 0.55 * prog) + ')' : 'rgba(40,42,52,0.95)';
      c.fill(); c.strokeStyle = active ? '#e8cf8a' : 'rgba(255,255,255,0.28)'; c.lineWidth = 1.5; c.stroke();
      if (center(b.x, b.y, P2)) {
        c.font = Math.round(Math.max(fontPx * 0.9, hpx() * (b.label.length > 2 ? 0.38 : 0.7))) + 'px ' + LABEL_FONT;
        c.textAlign = 'center'; c.fillStyle = active ? '#fff' : 'rgba(241,242,245,0.95)'; c.fillText(b.label, P2[0], P2[1]);
      }
    }
    if (PANEL.toastT > 0 && center(0, -0.44, P2)) { c.font = Math.round(fontPx * 1.1) + 'px ' + LABEL_FONT; c.textAlign = 'center'; c.fillStyle = '#9fe8b0'; c.fillText(PANEL.toast, P2[0], P2[1]); }
    // dwell ring around the reticle
    if (PANEL.id && PANEL.t > 0) {
      var pr = Math.min(1, PANEL.t / DWELL);
      c.strokeStyle = '#e8cf8a'; c.lineWidth = Math.max(3, fontPx * 0.28);
      c.beginPath(); c.arc(view.cx, view.cy, fontPx * 1.15, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2); c.stroke();
    }
  }

  // ---------- constellation art: Stellarium "modern" illustrations (Free Art License), recoloured to our cream theme in art.js ----------
  var ART = [], ARTI = {}, artReady = false;
  function inv3(m) {
    var a = m[0][0], b = m[0][1], c = m[0][2], d = m[1][0], e = m[1][1], f = m[1][2], g = m[2][0], h = m[2][1], i = m[2][2];
    var A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g, det = a * A + b * B + c * Cc;
    if (Math.abs(det) < 1e-12) return null;
    return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
            [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
            [Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
  }
  function initArt() {
    if (artReady || !window.SKY_ART) return;
    artReady = true;
    window.SKY_ART.forEach(function (d) {
      // linear map image (u, v, 1) -> J2000 direction, fixed by the three anchor stars
      var U = [[d.a[0][0], d.a[1][0], d.a[2][0]], [d.a[0][1], d.a[1][1], d.a[2][1]], [1, 1, 1]];
      var Ui = inv3(U); if (!Ui) return;
      var vs = d.a.map(function (p) { return C.radec2vec(p[2], p[3]); });
      var Mx = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) Mx[r][k] = vs[0][r] * Ui[0][k] + vs[1][r] * Ui[1][k] + vs[2][r] * Ui[2][k];
      function dir(u, v) { var x = Mx[0][0] * u + Mx[0][1] * v + Mx[0][2], y = Mx[1][0] * u + Mx[1][1] * v + Mx[1][2], z = Mx[2][0] * u + Mx[2][1] * v + Mx[2][2], n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; }
      var uv = [], vecs = [];
      for (var j = 0; j <= 2; j++) for (var i2 = 0; i2 <= 2; i2++) { var u = d.w * i2 / 2, v = d.h * j / 2; uv.push([u, v]); vecs.push(dir(u, v)); }
      var cen = dir(d.w / 2, d.h / 2), rad = 0;
      vecs.forEach(function (q) { rad = Math.max(rad, Math.acos(Math.max(-1, Math.min(1, q[0] * cen[0] + q[1] * cen[1] + q[2] * cen[2])))); });
      var img = new Image(), item = { id: d.id, w: d.w, h: d.h, img: img, ok: false, uv: uv, vecs: vecs, cen: cen, rad: rad };
      img.onload = function () { item.ok = true; };
      img.src = d.src;
      ART.push(item); ARTI[d.id] = item;
    });
  }

  var artEma = 0, artSlowT = 0, artSlow = false;
  function artPerf(dt) {
    // safety net for slow phones: if frames get slow with the art on, switch it off on this phone only
    if (!artReady || artSlow || st.mode === 'menu' || !artOn() || performance.now() - (st.vrT || 0) < 8000) { artSlowT = 0; artEma = 0; return; }
    artEma = artEma ? artEma * 0.9 + dt * 0.1 : dt;
    if (artEma > 0.045) {
      artSlowT += dt;
      if (artSlowT > 6) { artSlow = true; st.show.art = false; syncArtUi(); PANEL.toast = '폰이 느려서 별자리 그림을 껐어요'; PANEL.toastT = 2.5; }
    } else artSlowT = 0;
  }
  var ARTF = {};
  function updateArtFocus(dt, sel) {
    var focus = null;
    if (artReady && !STORY.ev && st.mode !== 'menu' && artOn()) {
      if (sel && sel.cons && ARTI[sel.cons]) focus = sel.cons;
      else {
        var f = st.cam.f, best = 1e9;
        for (var i = 0; i < ART.length; i++) {
          var it = ART[i], e = C.apply(frame.M, it.cen);
          var ang = Math.acos(Math.max(-1, Math.min(1, f[0] * e[0] + f[1] * e[1] + f[2] * e[2])));
          if (ang < it.rad * 0.8 && ang / it.rad < best) { best = ang / it.rad; focus = it.id; }
        }
      }
    }
    if (focus && !(focus in ARTF)) ARTF[focus] = 0;
    for (var id in ARTF) {
      var tg = id === focus ? 1 : 0;
      ARTF[id] += (tg - ARTF[id]) * Math.min(1, dt * (tg ? 3 : 4.5));
      if (!tg && ARTF[id] < 0.01) delete ARTF[id];
    }
  }
  // what to draw: the presenter's switch wins while connected, otherwise this phone's menu
  function opt(k) {
    if (NET.room && SYNC.has && SYNC.disp && typeof SYNC.disp[k] === 'boolean') return SYNC.disp[k];
    return !!st.show[k];
  }
  function artOn() {
    if (artSlow) return false;
    if (NET.room && SYNC.has && SYNC.art != null) return SYNC.art;
    return opt('art');
  }
  var ACAM = [0, 0, 0], APTS = [];
  for (var api = 0; api < 9; api++) APTS.push([0, 0, 0]);
  function artTri(c, img, p0, p1, p2, t0, t1, t2) {
    // affine texture map of one triangle: image (u, v) -> screen (x, y)
    var u0 = t0[0], v0 = t0[1], u1 = t1[0], v1 = t1[1], u2 = t2[0], v2 = t2[1];
    var den = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
    if (Math.abs(den) < 1e-9) return;
    var x0 = p0[0], y0 = p0[1], x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
    var a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / den;
    var b = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / den;
    var cc = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / den;
    var dd = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / den;
    var e = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / den;
    var f = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / den;
    var mx = (x0 + x1 + x2) / 3, my = (y0 + y1 + y2) / 3, g = 0.6;
    function ex(x, m) { var dx = x - m; return x + (dx > 0 ? g : -g); }
    c.save();
    c.beginPath(); c.moveTo(ex(x0, mx), ex(y0, my)); c.lineTo(ex(x1, mx), ex(y1, my)); c.lineTo(ex(x2, mx), ex(y2, my)); c.closePath(); c.clip();
    c.transform(a, b, cc, dd, e, f);
    c.drawImage(img, 0, 0);
    c.restore();
  }
  var APTS = [];
  for (var api = 0; api < 9; api++) APTS.push([0, 0, 0]);
  function drawArt(view, selCons) {
    if (!artReady) return;
    var sev = STORY.ev, figs = sev ? sev.figures : null;
    if (!figs && !artOn()) return;
    var c = ctx, fovNow = view.vr ? st.fov : (st.mode === 'menu' ? 80 : st.zoomFov);
    var half = fovNow * 0.5 * D2R * (view.vr ? 1.15 : Math.hypot(W, H) / Math.max(W, H));
    var base = 0.2 + 0.14 * frame.dark;
    for (var i = 0; i < ART.length; i++) {
      var it = ART[i]; if (!it.ok) continue;
      var alpha;
      if (figs) { var fg = figs[it.id]; if (!fg) continue; alpha = Math.min(0.55, base * 1.8) * fg.p * fg.a; if (alpha < 0.01) continue; }
      else { if (!ARTF[it.id]) continue; alpha = ARTF[it.id] * (0.42 + 0.2 * frame.dark); }
      if (altOf(it.cen) < -Math.sin(it.rad)) continue;
      toCam(it.cen, CV);
      if (Math.acos(Math.max(-1, Math.min(1, CV[2]))) - it.rad > half) continue;
      var m = 0, su = 0, sv = 0, suu = 0, svv = 0, suv = 0, sx = 0, sy = 0, sux = 0, svx = 0, suy = 0, svy = 0;
      for (var k = 0; k < 9; k++) {
        toCam(it.vecs[k], CV);
        if (CV[2] < 0.12 || !proj(view, CV[0], CV[1], CV[2], P)) continue;
        var uu = it.uv[k][0], vv = it.uv[k][1], xx = P[0], yy = P[1];
        su += uu; sv += vv; suu += uu * uu; svv += vv * vv; suv += uu * vv; sx += xx; sy += yy;
        sux += uu * xx; svx += vv * xx; suy += uu * yy; svy += vv * yy; m++;
      }
      if (m < 5) continue;
      // one least-squares affine fit over the 3x3 grid of projected points: a single drawImage per figure
      var Ni = inv3([[suu, suv, su], [suv, svv, sv], [su, sv, m]]); if (!Ni) continue;
      var ax = Ni[0][0] * sux + Ni[0][1] * svx + Ni[0][2] * sx, cx2 = Ni[1][0] * sux + Ni[1][1] * svx + Ni[1][2] * sx, ex2 = Ni[2][0] * sux + Ni[2][1] * svx + Ni[2][2] * sx;
      var by = Ni[0][0] * suy + Ni[0][1] * svy + Ni[0][2] * sy, dy2 = Ni[1][0] * suy + Ni[1][1] * svy + Ni[1][2] * sy, fy2 = Ni[2][0] * suy + Ni[2][1] * svy + Ni[2][2] * sy;
      c.globalAlpha = alpha;
      c.save(); c.transform(ax, by, cx2, dy2, ex2, fy2); c.drawImage(it.img, 0, 0); c.restore();
    }
    c.globalAlpha = 1;
  }

  // ---------- story: scene-by-scene show steered by the host (scenes in story.js) ----------
  var STORY = { ev: null };
  function easeS(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function starVecByName(nm) {
    for (var i = 0; i < S.named.length; i++) {
      var n = S.named[i][1];
      if (n === nm || n.split(' ')[0] === nm) { var k = S.named[i][0]; return [SV[3 * k], SV[3 * k + 1], SV[3 * k + 2]]; }
    }
    return null;
  }
  function targetVec(tg, minutes) {
    var i;
    if (tg.cons) { for (i = 0; i < CONS.length; i++) if (CONS[i].id === tg.cons) return CONS[i].v; }
    if (tg.star) return starVecByName(tg.star);
    if (tg.dso) { for (i = 0; i < DSO.length; i++) if (DSO[i].name === tg.dso || DSO[i].name.indexOf(tg.dso) === 0) return DSO[i].v; }
    if (tg.body) return C.radec2vec.apply(null, C.bodyRaDec(S, tg.body, minutes));
    return null;
  }
  function targetEnuS(tg, minutes) {
    if (tg.altaz) { var al = tg.altaz[0] * D2R, az = tg.altaz[1] * D2R; return [Math.sin(az) * Math.cos(al), Math.cos(az) * Math.cos(al), Math.sin(al)]; }
    var v = targetVec(tg, minutes);
    if (!v) return [0, -0.6, 0.8];
    return C.apply(C.eqjToEnu(S, minutes), v);
  }
  function slerpS(a, b, k) {
    var d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), th = Math.acos(d);
    if (th < 1e-4) return b.slice();
    var s = Math.sin(th), wa = Math.sin((1 - k) * th) / s, wb = Math.sin(k * th) / s;
    return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb];
  }
  function showById(id) { var L = window.STORY_SHOWS || []; for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }
  function sceneArt(sc) {
    var ids = (sc.keepArt || []).slice();
    (sc.fx || []).forEach(function (f) { if (f.type === 'art') f.cons.forEach(function (c) { if (ids.indexOf(c) < 0) ids.push(c); }); });
    return ids;
  }
  function storyOn() { return !!(NET.room && SYNC.has && SYNC.story && !SYNC.hold && showById(SYNC.story.show)); }
  function storyEval() {
    var sy = SYNC.story, show = showById(sy.show);
    var i = Math.max(0, Math.min(show.scenes.length - 1, sy.i));
    var s = show.scenes[i], p = i > 0 ? show.scenes[i - 1] : null;
    var t = (Date.now() - sy.t0) / 1000;
    var from = p ? p.view : (s.start || s.view), to = s.view;
    var k = s.move > 0 ? easeS(t / s.move) : 1;
    var minutes = from.minutes + (to.minutes - from.minutes) * k;
    var out = { i: i, n: show.scenes.length, scene: s, fov: from.fov + (to.fov - from.fov) * k, lim: null, labelAlpha: 1, lineCons: [], figures: {}, pointer: null };
    if (p) (p.fx || []).forEach(function (f) { if (f.type === 'labels') out.labelAlpha = f.to; });
    (s.fx || []).forEach(function (f) {
      var q = f.dur > 0 ? easeS((t - f.at) / f.dur) : (t >= f.at ? 1 : 0);
      if (f.type === 'timelapse') minutes = f.from + (f.to - f.from) * q;
      else if (f.type === 'lightsOut') out.lim = f.from + (f.to - f.from) * q;
      else if (f.type === 'labels') out.labelAlpha = t >= f.at ? f.from + (f.to - f.from) * q : f.from;
      else if (f.type === 'lines') f.cons.forEach(function (c) { out.lineCons.push({ id: c, p: q }); });
      else if (f.type === 'art') f.cons.forEach(function (c, j) { var a0 = f.at + (f.stagger || 0) * j; out.figures[c] = { p: f.dur > 0 ? easeS((t - a0) / f.dur) : 1, a: 1 }; });
      else if (f.type === 'pointer') out.pointer = { from: starVecByName(f.from), to: starVecByName(f.to), p: q };
      else if (f.type === 'eyepiece') out.eyepiece = { body: f.body, a: q };
    });
    (s.keepArt || []).forEach(function (c) {
      if (!out.figures[c]) out.figures[c] = { p: 1, a: 1 };
      if (out.lineCons.every(function (l) { return l.id !== c; })) out.lineCons.push({ id: c, p: 1 });
    });
    if (p) sceneArt(p).forEach(function (c) { if (!out.figures[c]) out.figures[c] = { p: 1, a: 1 - easeS(t / 1.4) }; });
    out.highlight = s.view.target.cons || null;
    out.minutes = minutes;
    out.dir = slerpS(targetEnuS(from.target, minutes), targetEnuS(to.target, minutes), k);
    out.endDir = targetEnuS(to.target, minutes);
    out.caption = s.title ? { title: s.title, sub: s.sub || '', a: easeS((t - (s.move || 0) * 0.5) / 0.8) } : null;
    return out;
  }
  function drawStoryLines(view) {
    var ev = STORY.ev; if (!ev || !ev.lineCons.length) return;
    var c = ctx;
    c.lineWidth = Math.max(1.6, view.f / 260);
    for (var j = 0; j < ev.lineCons.length; j++) {
      var lc = ev.lineCons[j]; if (lc.p <= 0.01) continue;
      c.strokeStyle = 'rgba(240,214,170,' + (0.85 * lc.p).toFixed(3) + ')';
      c.beginPath();
      for (var li = 0; li < LINES.length; li++) if (LINES[li].id === lc.id) linePath(view, LINES[li].pts);
      c.stroke();
    }
  }
  function drawStoryPointer(view) {
    var ev = STORY.ev; if (!ev || !ev.pointer || !ev.pointer.from || !ev.pointer.to || ev.pointer.p <= 0) return;
    var c = ctx, a = ev.pointer.from, b = ev.pointer.to, n = 40, pen = false;
    c.save(); c.setLineDash([6, 7]); c.lineWidth = Math.max(1.5, view.f / 300); c.strokeStyle = 'rgba(240,214,170,0.9)';
    c.beginPath();
    for (var i = 0; i <= n * ev.pointer.p; i++) {
      var v = slerpS(a, b, i / n); toCam(v, CV);
      if (CV[2] < 0.1 || !proj(view, CV[0], CV[1], CV[2], P)) { pen = false; continue; }
      if (pen) c.lineTo(P[0], P[1]); else { c.moveTo(P[0], P[1]); pen = true; }
    }
    c.stroke(); c.restore();
  }
  function drawCaption(view, fontPx) {
    var ev = STORY.ev; if (!ev || !ev.caption || ev.caption.a <= 0.01) return;
    var c = ctx, vr = view.vr, tf = Math.round(fontPx * (vr ? 1.15 : 1.45)), sf = Math.round(fontPx * (vr ? 0.82 : 0.95));
    c.font = '700 ' + tf + 'px ' + TITLE_FONT; var tw = c.measureText(ev.caption.title).width;
    c.font = sf + 'px ' + BODY_FONT; var sw = c.measureText(ev.caption.sub).width;
    var pad = fontPx * 0.9, bw = Math.min(Math.max(tw, sw) + pad * 2, vr ? view.R * 0.8 : W * 0.42), bh = tf * 1.0 + sf * 1.5 + pad * 1.4;
    var x = vr ? view.cx + view.R * 0.12 : W - bw - 20, y = vr ? view.cy - bh * 0.4 : H / 2 - bh / 2;
    c.globalAlpha = ev.caption.a;
    c.fillStyle = 'rgba(14,15,20,0.96)'; roundRect(x, y, bw, bh, fontPx * 0.6); c.fill();
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#f1f2f5'; c.font = '700 ' + tf + 'px ' + TITLE_FONT;
    c.fillText(ev.caption.title, x + pad, y + pad * 0.7 + tf * 0.6, bw - pad * 2);
    c.fillStyle = '#a4a7b3'; c.font = sf + 'px ' + BODY_FONT;
    c.fillText(ev.caption.sub, x + pad, y + pad * 0.7 + tf * 1.0 + sf * 0.9, bw - pad * 2);
    c.globalAlpha = 1;
  }

  // ---------- live link to the sync server (Cloudflare Worker), spots ----------
  var SERVER = 'wss://osong-vr-sync.lrwe36.workers.dev';
  var NET = { room: null, status: 'off', hostOpen: false, ws: null, gotState: false };
  var SYNC = { has: false, phase: 'idle', base: 90, speed: 0, at: 0, spot: null, note: '', hold: false, timer: null, plan: null, view: null, story: null, art: null };
  (function () {
    var q = new URLSearchParams(location.search), r = (q.get('r') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
    var sv = q.get('server');
    if (sv && /^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(sv)) SERVER = sv;
    NET.room = r.length >= 4 ? r : null;
    NET.hostview = q.get('hostview') === '1';
    NET.sim = q.get('sim') === 'vr' ? 'vr' : q.get('sim') === 'screen' ? 'screen' : null;
  })();
  function followOn() { return !NET.hostview && syncActive() && !SYNC.hold && SYNC.view && SYNC.view.on && !SYNC.story; }

  function phaseName(p) { return p === 'guide' ? '안내 시간' : p === 'free' ? '자유 관찰' : p === 'break' ? '쉬는 시간' : p === 'end' ? '끝' : ''; }
  function fmtTime(ms) { var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60), x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x; }
  function timerRemaining(tm) {
    if (!tm) return 0;
    if (tm.paused) return tm.rem;
    return Math.max(0, tm.endLocal - Date.now());
  }

  // spots the host can point everyone at
  var SPOTS = [];
  (function () {
    function consV(id) { for (var i = 0; i < CONS.length; i++) if (CONS[i].id === id) return CONS[i].v; return null; }
    function starV(nm) { for (var i = 0; i < S.named.length; i++) if (S.named[i][1] === nm) { var k = S.named[i][0]; return [SV[3 * k], SV[3 * k + 1], SV[3 * k + 2]]; } return null; }
    function add(o) { if (o.v || o.body) SPOTS.push(o); }
    add({ id: 'sat', name: '토성', body: 'Saturn', info: BODY_INFO.Saturn.text });
    add({ id: 'pol', name: '북극성', v: starV('북극성'), info: STAR_INFO['북극성'] });
    add({ id: 'peg', name: '가을의 대사각형', v: consV('Peg'), cons: 'Peg', info: CONS_INFO.Peg });
    add({ id: 'cas', name: '카시오페이아자리', v: consV('Cas'), cons: 'Cas', info: CONS_INFO.Cas });
    add({ id: 'and', name: '안드로메다은하', v: DSO[0].v, info: DSO[0].text });
    add({ id: 'per', name: '페르세우스자리', v: consV('Per'), cons: 'Per', info: CONS_INFO.Per });
    add({ id: 'alg', name: '알골', v: starV('알골'), info: STAR_INFO['알골'] });
    add({ id: 'ple', name: '좀생이별', v: DSO[1].v, info: DSO[1].text });
    add({ id: 'cap', name: '카펠라', v: starV('카펠라'), info: STAR_INFO['카펠라'] });
    add({ id: 'cyg', name: '백조자리', v: consV('Cyg'), cons: 'Cyg', info: CONS_INFO.Cyg });
    add({ id: 'veg', name: '직녀성', v: starV('직녀성 (베가)'), info: STAR_INFO['직녀성 (베가)'] });
    add({ id: 'alt', name: '견우성', v: starV('견우성 (알타이르)'), info: STAR_INFO['견우성 (알타이르)'] });
    add({ id: 'fom', name: '포말하우트', v: starV('포말하우트'), info: STAR_INFO['포말하우트'] });
    add({ id: 'ura', name: '천왕성 (망원경)', body: 'Uranus', info: BODY_INFO.Uranus.text });
    add({ id: 'nep', name: '해왕성 (망원경)', body: 'Neptune', info: BODY_INFO.Neptune.text });
  })();
  function spotById(id) { for (var i = 0; i < SPOTS.length; i++) if (SPOTS[i].id === id) return SPOTS[i]; return null; }
  function spotVec(sp, minutes) { return sp.body ? C.radec2vec.apply(null, C.bodyRaDec(S, sp.body, minutes)) : sp.v; }
  function spotAltAz(sp, minutes) { return C.enuToAltAz(C.apply(C.eqjToEnu(S, minutes), spotVec(sp, minutes))); }

  // ---------- phone side ----------
  function applyState(s) {
    if (s && s.k === 'view') { SYNC.view = { on: !!s.on, yaw: +s.yaw || 0, pitch: +s.pitch || 0, fov: +s.fov || 75 }; return; }
    if (!s || s.k !== 'state') return;
    SYNC.art = typeof s.art === 'boolean' ? s.art : null;
    SYNC.sky = C.skyOk(s.sky) ? s.sky : null;
    SYNC.disp = s.disp && typeof s.disp === 'object' ? s.disp : null;
    SYNC.quiz = s.quiz && s.quiz.n ? s.quiz : null;
    setTimeout(renderSkyWhere, 0);
    SYNC.story = s.story && s.story.show ? { show: s.story.show, i: s.story.i | 0, t0: Date.now() - (s.story.el || 0) } : null;
    SYNC.view = s.view ? { on: !!s.view.on, yaw: +s.view.yaw || 0, pitch: +s.view.pitch || 0, fov: +s.view.fov || 75 } : null;
    INTRO.srv = s.intro && s.intro.st ? { st: s.intro.st, n: s.intro.n | 0, len: typeof s.intro.len === 'number' ? s.intro.len : null, t0: Date.now() - (s.intro.el || 0), playT0: Date.now() - (s.intro.pel != null ? s.intro.pel : s.intro.el || 0) } : null;
    if (INTRO.srv && INTRO.srv.st !== 'wait') introVideo();
    NET.gotState = true;
    SYNC.has = true; SYNC.phase = s.phase || 'idle';
    SYNC.base = s.time; SYNC.speed = s.speed || 0; SYNC.at = Date.now();
    SYNC.spot = s.spot ? spotById(s.spot) : null;
    SYNC.note = s.note || ''; SYNC.hold = !!s.hold; SYNC.plan = s.plan || null;
    if (s.timer) {
      SYNC.timer = { rem: s.timer.rem, total: s.timer.total, label: s.timer.label || '', paused: !!s.timer.paused, endLocal: Date.now() + s.timer.rem };
    } else SYNC.timer = null;
    renderNetChip();
  }
  function syncActive() { return NET.room && SYNC.has && SYNC.phase !== 'idle' && SYNC.phase !== 'end'; }
  function syncMinutes() {
    var m = SYNC.base + (Date.now() - SYNC.at) / 60000 * SYNC.speed;
    return ((m % 720) + 720) % 720;
  }
  function renderNetChip() {
    var chip = $('netChip'); if (!chip) return;
    if (!NET.room) { chip.hidden = true; return; }
    chip.hidden = false;
    var t = '';
    if (NET.status !== 'ok' && !SYNC.has) t = '진행자와 연결하는 중…';
    else if (SYNC.story && showById(SYNC.story.show)) t = '진행자와 함께 이야기를 보는 중';
    else if (!SYNC.has) t = '진행자를 기다리는 중이에요';
    else if (SYNC.phase === 'idle' || SYNC.phase === 'end') t = SYNC.phase === 'end' ? '프로그램이 끝났어요. 자유롭게 봐요' : '진행자와 연결됐어요. 시작 신호를 기다려요';
    else t = '진행자와 함께 보는 중 · ' + phaseName(SYNC.phase) + (SYNC.timer ? ' · ' + fmtTime(timerRemaining(SYNC.timer)) : '') + (followOn() ? ' · 진행자 화면을 따라가요' : '');
    if (NET.status === 'lost') t += ' (연결이 끊겨도 계속 볼 수 있어요)';
    chip.textContent = t;
    $('time').disabled = syncActive();
  }
  var netN = 0;
  function netTick() { // returns true while the host is steering the clock
    if (!NET.room) return false;
    var on = syncActive();
    if (on) st.minutes = syncMinutes();
    if (++netN % 20 === 0) { renderNetChip(); if (on) syncTime(); }
    return on;
  }

  // guidance cue for the target the host picked: ring when in view, arrow at the edge otherwise
  function guideCons() { return (st.mode !== 'menu' && syncActive() && SYNC.phase === 'guide' && SYNC.spot && SYNC.spot.cons) || null; }
  function cueText(txt, x, y, fontPx, color) {
    var c = ctx; c.font = Math.round(fontPx * 1.1) + 'px ' + LABEL_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    var w = c.measureText(txt).width;
    c.fillStyle = 'rgba(14,15,20,0.94)'; roundRect(x - w / 2 - 8, y - fontPx * 0.78, w + 16, fontPx * 1.56, fontPx * 0.78); c.fill();
    c.fillStyle = color || '#e8cf8a'; c.fillText(txt, x, y);
  }
  // a message centred in its rounded box: wrapped to at most three lines, centred on the glyphs' real height
  function pillText(text, x, y, maxW, font, fontPx, bg, fg) {
    var c = ctx;
    c.save();
    c.font = font; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    var lines = wrapLines(String(text), maxW - 24);
    lines = lines.slice(0, 3);
    var m = c.measureText('가Ag'), asc = m.actualBoundingBoxAscent || fontPx * 0.8, desc = m.actualBoundingBoxDescent || fontPx * 0.2;
    var lh = (asc + desc) * 1.45, w = 0;
    lines.forEach(function (l) { w = Math.max(w, Math.min(maxW - 24, c.measureText(l).width)); });
    var h = lh * (lines.length - 1) + asc + desc + fontPx * 0.9;
    if (bg) { c.fillStyle = bg; roundRect(x - w / 2 - 12, y - h / 2, w + 24, h, Math.min(h / 2, fontPx * 0.8)); c.fill(); }
    c.fillStyle = fg;
    var top = y - (lh * (lines.length - 1) + asc + desc) / 2;
    for (var i = 0; i < lines.length; i++) c.fillText(lines[i], x, top + asc + i * lh, maxW - 24);
    c.restore();
  }
  function drawNetOverlay(view, fontPx) {
    if (!NET.room || !SYNC.has || st.mode === 'menu') return;
    var c = ctx, vr = view.vr, cx = view.cx, cy = view.cy;
    var rad = vr ? view.R : Math.min(W, H) / 2;
    if (SYNC.hold && syncActive()) {
      c.fillStyle = '#04060f'; c.fillRect(view.clip[0], view.clip[1], view.clip[2], view.clip[3]);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e8cf8a';
      c.font = Math.round(fontPx * 1.6) + 'px ' + LABEL_FONT;
      c.fillText('잠깐 쉬어요', vr ? cx : W / 2, (vr ? cy : H / 2) - fontPx * 1.2);
      pillText(SYNC.note || '헤드셋을 벗고 앞을 봐 주세요', vr ? cx : W / 2, (vr ? cy : H / 2) + fontPx * 1.1, vr ? rad * 1.5 : W - 40, Math.round(fontPx * 1.05) + 'px ' + BODY_FONT, fontPx, null, '#f1f2f5');
      return;
    }
    var storyNow = !!STORY.ev;
    if (!syncActive() && !storyNow) return;
    drawCaption(view, fontPx);
    // top info: phase + timer
    var topY = vr ? cy - rad * 0.82 : 84;
    var parts = storyNow ? [] : [phaseName(SYNC.phase)];
    if (followOn() && !vr) parts.push('진행자 화면을 따라가는 중');
    var tm = SYNC.timer, low = false;
    if (tm) { var rem = timerRemaining(tm); parts.push((tm.label ? tm.label + ' ' : '') + fmtTime(rem) + (tm.paused ? ' (멈춤)' : '')); low = !tm.paused && rem < 30000; }
    var txt = parts.join(' · ');
    if (txt) {
    c.font = Math.round(fontPx * 0.95) + 'px ' + LABEL_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    var tw = c.measureText(txt).width;
    c.fillStyle = 'rgba(14,15,20,0.96)'; roundRect((vr ? cx : W / 2) - tw / 2 - 10, topY - fontPx * 0.75, tw + 20, fontPx * 1.5, fontPx * 0.75); c.fill();
    c.fillStyle = low ? '#ff9a6b' : '#e8cf8a'; c.fillText(txt, vr ? cx : W / 2, topY);
    }
    // host message
    if (SYNC.note) pillText(SYNC.note, vr ? cx : W / 2, vr ? cy + rad * 0.44 : H - 70, vr ? rad * 1.5 : W - 40, Math.round(fontPx * 1.05) + 'px ' + BODY_FONT, fontPx, 'rgba(232,207,138,0.95)', '#2a1d00');
    // target cue
    var sp = SYNC.phase === 'guide' ? SYNC.spot : null, e, label, cam = st.cam;
    if (storyNow) {
      if (!vr) return;                                   // screen mode is turned for you
      e = STORY.ev.endDir; label = STORY.ev.scene.title || '여기를 봐요';
    } else if (followOn() && vr) {
      // the sky turns this round to the front (vrTurned); the marker shows the exact spot, also when it is high up
      var vaz = SYNC.view.yaw * D2R, val = SYNC.view.pitch * D2R;
      e = [Math.sin(vaz) * Math.cos(val), Math.cos(vaz) * Math.cos(val), Math.sin(val)];
      label = '진행자가 보는 곳';
    } else {
      if (!sp) return;
      e = C.apply(frame.M, spotVec(sp, st.minutes)); label = sp.name;
    }
    if (e[2] < -0.05) {
      c.font = Math.round(fontPx * 0.95) + 'px ' + LABEL_FONT; c.fillStyle = 'rgba(232,207,138,0.9)'; c.textAlign = 'center';
      c.fillText(label + '은(는) 지금 지평선 아래예요', vr ? cx : W / 2, vr ? cy + rad * 0.5 : H - 40);
      return;
    }
    var dx = e[0] * cam.r[0] + e[1] * cam.r[1] + e[2] * cam.r[2], dy = e[0] * cam.u[0] + e[1] * cam.u[1] + e[2] * cam.u[2], dz = e[0] * cam.f[0] + e[1] * cam.f[1] + e[2] * cam.f[2];
    var ang = Math.round(Math.acos(Math.max(-1, Math.min(1, dz))) / D2R);
    var inside = false;
    if (dz > 0.1 && proj(view, dx, dy, dz, P)) {
      inside = vr ? Math.hypot(P[0] - cx, P[1] - cy) < rad * 0.8 : (P[0] > 30 && P[0] < W - 30 && P[1] > 90 && P[1] < H - 30);
    }
    var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    c.lineWidth = Math.max(2, fontPx * 0.2);
    if (inside) {
      c.strokeStyle = 'rgba(232,207,138,' + (0.55 + 0.45 * pulse) + ')';
      c.beginPath(); c.arc(P[0], P[1], fontPx * (1.9 + 0.3 * pulse), 0, Math.PI * 2); c.stroke();
      cueText(label, P[0], P[1] - fontPx * 3.1, fontPx);
    } else {
      var a = Math.atan2(-dy, dx); if (Math.hypot(dx, dy) < 1e-3) a = Math.PI / 2;
      var ex = (vr ? cx : W / 2) + Math.cos(a) * (vr ? rad * 0.74 : W * 0.4);
      var ey = (vr ? cy : H / 2) + Math.sin(a) * (vr ? rad * 0.48 : H * 0.34);
      c.save(); c.translate(ex, ey); c.rotate(a);
      c.globalAlpha = 0.6 + 0.4 * pulse; c.fillStyle = '#e8cf8a';
      var s1 = fontPx * 1.5;
      c.beginPath(); c.moveTo(s1, 0); c.lineTo(-s1 * 0.6, s1 * 0.8); c.lineTo(-s1 * 0.2, 0); c.lineTo(-s1 * 0.6, -s1 * 0.8); c.closePath(); c.fill();
      c.restore(); c.globalAlpha = 1;
      cueText(label + ' · ' + ang + '°', ex - Math.cos(a) * fontPx * 0.8, ey - Math.sin(a) * fontPx * 0.8 + (Math.sin(a) >= 0 ? -fontPx * 2.4 : fontPx * 2.4), fontPx);
    }
  }

  // ---------- quiz: the presenter opens a question; answer by looking (VR) or tapping (screen mode) ----------
  // choice: answer cards hang in the sky in front of where you looked when the question opened; stare ~1.6 s to pick.
  // find: look at the named star / constellation / planet for ~2 s. The server only counts answers; the phone checks them.
  var QZ = { n: 0, mine: -1, found: false, anchor: null, dwell: -1, dwellT: 0, findT: 0, dom: '', last: 0 };
  var QZ_DWELL = 1.6, QZ_FIND = 2.0;
  function quizOn() { return !!(NET.room && SYNC.has && SYNC.quiz) && st.mode !== 'menu' && !introCovers(); }
  function quizTargetVec(t) {
    if (!t) return null;
    if (t.kind === 'star') return starVecByName(t.id);
    if (t.kind === 'cons') { for (var i = 0; i < CONS.length; i++) if (CONS[i].id === t.id) return CONS[i].v; return null; }
    if (t.kind === 'body') return S.planets[t.id] ? C.radec2vec.apply(null, C.bodyRaDec(S, t.id, st.minutes)) : null;
    if (t.kind === 'radec') { var p = String(t.id).split(','); return p.length === 2 ? C.radec2vec(+p[0], +p[1]) : null; }
    return null;
  }
  function quizSend(a) { if (NET.ws && NET.ws.readyState === 1) { try { NET.ws.send(JSON.stringify({ k: 'ans', n: QZ.n, a: a })); } catch (e) {} } }
  function quizCards() { // ENU directions of the answer cards around the anchor
    // a 2 x 2 grid (one row for two answers), 26° apart across and 11° apart down, measured on the sky
    var q = SYNC.quiz, n = q.opts.length, out = [], an = QZ.anchor;
    for (var i = 0; i < n; i++) {
      var col = i % 2, row = n > 2 ? Math.floor(i / 2) : 0;
      var al = an.alt - 2 - row * 11, az = an.az + (col - 0.5) * 26 / Math.cos(al * D2R);
      out.push([Math.sin(az * D2R) * Math.cos(al * D2R), Math.cos(az * D2R) * Math.cos(al * D2R), Math.sin(al * D2R)]);
    }
    return out;
  }
  function angFromView(e) { var f = st.cam.f; return Math.acos(Math.max(-1, Math.min(1, e[0] * f[0] + e[1] * f[1] + e[2] * f[2]))) / D2R; }
  function quizTick() {
    var now = performance.now(), dt = Math.min(0.5, (now - (QZ.last || now)) / 1000); QZ.last = now; // real time, even on slow phones
    var q = quizOn() ? SYNC.quiz : null;
    if (!q) { if (QZ.dom) { $('quizBox').hidden = true; QZ.dom = ''; } return; }
    if (q.n !== QZ.n) { QZ.n = q.n; QZ.mine = -1; QZ.found = false; QZ.anchor = null; QZ.dwell = -1; QZ.dwellT = 0; QZ.findT = 0; }
    if (!QZ.anchor && st.cam) { var aa = C.enuToAltAz(st.cam.f); QZ.anchor = { az: aa.az, alt: Math.max(12, Math.min(55, aa.alt)) }; }
    if (q.st === 'open') {
      if (q.type === 'choice' && st.mode === 'vr') {
        var cards = quizCards(), hit = -1;
        for (var i = 0; i < cards.length; i++) if (angFromView(cards[i]) < 5.5) hit = i;
        if (hit !== QZ.dwell) { QZ.dwell = hit; QZ.dwellT = 0; }
        else if (hit >= 0 && hit !== QZ.mine) { QZ.dwellT += dt; if (QZ.dwellT >= QZ_DWELL) { QZ.mine = hit; quizSend(hit); } }
      } else if (q.type === 'find' && !QZ.found) {
        var v = quizTargetVec(q.target);
        if (v) {
          var tol = q.target.kind === 'cons' ? 10 : 3.5;
          if (angFromView(C.apply(frame.M, v)) < tol) { QZ.findT += dt; if (QZ.findT >= QZ_FIND) { QZ.found = true; quizSend(1); } }
          else QZ.findT = Math.max(0, QZ.findT - dt * 2);
        }
      }
    }
    if (st.mode === 'screen') quizDom(q); else if (QZ.dom) { $('quizBox').hidden = true; QZ.dom = ''; }
  }
  function quizResult(q) {
    if (q.type === 'find') return q.st === 'reveal' ? (QZ.found ? '찾았어요! ' : '여기 있어요. ') + (q.ex || '') : QZ.found ? '찾았어요! 정답 공개를 기다려요.' : (QZ.findT > 0.2 ? '조금만 더 바라봐요…' : '하늘을 둘러보며 찾아보세요. 찾으면 가운데 동그라미로 2초 바라봐요.');
    if (q.st === 'reveal') return (QZ.mine === q.ans ? '정답! ' : QZ.mine >= 0 ? '아쉬워요. 정답은 ‘' + q.opts[q.ans] + '’. ' : '정답은 ‘' + q.opts[q.ans] + '’. ') + (q.ex || '');
    return QZ.mine >= 0 ? '‘' + q.opts[QZ.mine] + '’을(를) 골랐어요. 바꿔도 돼요.' : '';
  }
  function quizDom(q) { // screen mode: plain buttons at the bottom
    var key = q.n + q.st + QZ.mine + (QZ.found ? 'f' : '') + Math.round(QZ.findT * 4);
    if (key === QZ.dom) return; QZ.dom = key;
    $('quizBox').hidden = false; $('qzQ').textContent = q.q;
    var box = $('qzOpts'); box.innerHTML = '';
    if (q.type === 'choice') q.opts.forEach(function (o, i) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = (i + 1) + '. ' + o;
      b.setAttribute('aria-pressed', QZ.mine === i ? 'true' : 'false');
      if (q.st === 'reveal') b.className = i === q.ans ? 'right' : 'wrong';
      else b.addEventListener('click', function () { QZ.mine = i; quizSend(i); QZ.dom = ''; });
      box.appendChild(b);
    });
    $('qzMsg').textContent = quizResult(q);
  }
  function drawQuiz(view, fontPx) { // VR: question at the top of each eye, answer cards in the sky
    var c = ctx, q = SYNC.quiz, cam = st.cam, rad = view.R;
    c.save();
    if (q.type === 'choice' && QZ.anchor) {
      var cards = quizCards(), w = 23 * D2R * view.f, h = 9 * D2R * view.f, fs = Math.max(9, Math.min(fontPx * 0.9, w / 7.5));
      for (var i = 0; i < cards.length; i++) {
        var e = cards[i];
        CV[0] = e[0] * cam.r[0] + e[1] * cam.r[1] + e[2] * cam.r[2]; CV[1] = e[0] * cam.u[0] + e[1] * cam.u[1] + e[2] * cam.u[2]; CV[2] = e[0] * cam.f[0] + e[1] * cam.f[1] + e[2] * cam.f[2];
        if (!proj(view, CV[0], CV[1], CV[2], P)) continue;
        var right = q.st === 'reveal' && i === q.ans, dim = q.st === 'reveal' && i !== q.ans;
        c.globalAlpha = dim ? 0.45 : 1;
        c.fillStyle = right ? 'rgba(47,107,71,0.96)' : QZ.mine === i ? 'rgba(232,207,138,0.96)' : 'rgba(14,15,20,0.93)';
        roundRect(P[0] - w / 2, P[1] - h / 2, w, h, fontPx * 0.5); c.fill();
        c.strokeStyle = 'rgba(232,207,138,0.5)'; c.lineWidth = 1; c.stroke();
        c.fillStyle = QZ.mine === i && !right ? '#2a1d00' : '#f1f2f5';
        c.font = Math.round(fs) + 'px ' + LABEL_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText((i + 1) + '. ' + q.opts[i], P[0], P[1], w - fs);
        if (q.st === 'open' && QZ.dwell === i && i !== QZ.mine && QZ.dwellT > 0.05) { // filling bar while you stare
          c.fillStyle = 'rgba(232,207,138,0.95)';
          c.fillRect(P[0] - w / 2 + 6, P[1] + h / 2 - 5, (w - 12) * Math.min(1, QZ.dwellT / QZ_DWELL), 3);
        }
      }
      c.globalAlpha = 1;
    }
    if (q.type === 'find' && (q.st === 'reveal' || QZ.found)) { // circle the target
      var v = quizTargetVec(q.target);
      if (v) { toCam(v, CV); if (proj(view, CV[0], CV[1], CV[2], P)) {
        c.strokeStyle = '#7fe0a0'; c.lineWidth = 2; c.beginPath(); c.arc(P[0], P[1], q.target.kind === 'cons' ? fontPx * 3 : fontPx * 1.2, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#7fe0a0'; c.font = Math.round(fontPx) + 'px ' + LABEL_FONT; c.textAlign = 'center'; c.textBaseline = 'bottom';
        c.fillText(q.target.name || '', P[0], P[1] - (q.target.kind === 'cons' ? fontPx * 3.2 : fontPx * 1.4));
      } }
    }
    if (q.type === 'find' && q.st === 'open' && !QZ.found && QZ.findT > 0.05) { // ring around the reticle fills up
      c.strokeStyle = 'rgba(127,224,160,0.95)'; c.lineWidth = 3;
      c.beginPath(); c.arc(view.cx, view.cy, fontPx * 1.1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, QZ.findT / QZ_FIND)); c.stroke();
    }
    // question and result, head-locked at the top of the eye
    var bw = rad * 1.45, msg = quizResult(q);
    c.font = Math.round(fontPx * 0.85) + 'px ' + BODY_FONT;
    var mlines = msg ? wrapLines(msg, bw - fontPx * 1.4).slice(0, 3) : [];
    c.font = Math.round(fontPx * 1.0) + 'px ' + LABEL_FONT;
    var lines = wrapLines(q.q, bw - fontPx * 1.4);
    var lh = fontPx * 1.25, bh = fontPx * 1.0 + lh * (lines.length + mlines.length) + (mlines.length ? fontPx * 0.4 : 0), by = view.cy - rad * 0.88;
    c.fillStyle = 'rgba(14,15,20,0.93)'; roundRect(view.cx - bw / 2, by, bw, bh, fontPx * 0.6); c.fill();
    c.strokeStyle = 'rgba(232,207,138,0.4)'; c.lineWidth = 1; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillStyle = '#e8cf8a';
    for (var j = 0; j < lines.length; j++) c.fillText(lines[j], view.cx, by + fontPx * 0.5 + j * lh);
    c.font = Math.round(fontPx * 0.85) + 'px ' + BODY_FONT; c.fillStyle = 'rgba(241,242,245,0.92)';
    for (var k = 0; k < mlines.length; k++) c.fillText(mlines[k], view.cx, by + fontPx * 0.9 + (lines.length + k) * lh);
    c.restore();
  }

  // ---------- opening film (체험 시작) ----------
  // The host presses 체험 시작 and every phone runs the same timeline from the server's clock:
  //   fade the current view to black → play the film → hold black → the real sky fades in over 2 s.
  // The film is its own file (INTRO_SRC), so it can be replaced without touching this code.
  // If the file is missing, refuses to play or never ends, the phone holds black briefly and fades in anyway,
  // so nobody is left on a dark screen. The film is drawn into the canvas, the same picture in both eyes (no parallax).
  var INTRO_SRC = 'assets/videos/vr-intro.mp4?v=2';
  var IN = { PRE: 0.8, BLACK: 0.6, SKIPBLACK: 0.3, FADE: 2.0, NOFILM: 1.5, WAIT_LOAD: 4, MAXLEN: 60 };
  var INTRO = { srv: null, n: -1, doneN: -1, state: 'VR_ACTIVE', alpha: 0, showVid: false,
    vid: null, vidStatus: 'none', dur: 0, started: false, vidOk: false, playFail: false, endE: null, skipEnd: false, cls: false };
  var EYES = null;
  function introVideo() {
    if (INTRO.vid || NET.hostview || !NET.room) return INTRO.vid;
    var v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = false; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
    INTRO.vidStatus = 'load';
    v.addEventListener('loadedmetadata', function () { INTRO.dur = isFinite(v.duration) && v.duration > 0 ? Math.min(v.duration, IN.MAXLEN) : 0; });
    v.addEventListener('canplay', function () { if (INTRO.vidStatus === 'load') { INTRO.vidStatus = 'ready'; sendHi(); } });
    v.addEventListener('playing', function () { INTRO.vidOk = true; if (INTRO.vidStatus !== 'ready') { INTRO.vidStatus = 'ready'; sendHi(); } });
    v.addEventListener('error', function () { INTRO.vidStatus = 'fail'; sendHi(); });
    v.src = INTRO_SRC;
    document.body.appendChild(v);
    try { v.load(); } catch (e) {}
    INTRO.vid = v;
    return v;
  }
  function introPrime() {
    // called from a tap (entering VR / screen): lets stricter phones allow the muted film to start later on its own
    var v = introVideo(); if (!v || INTRO.state !== 'VR_ACTIVE' && INTRO.state !== 'IDLE') return;
    try { var p = v.play(); if (p && p.then) p.then(function () { if (!INTRO.started) { v.pause(); try { v.currentTime = 0; } catch (e) {} } }, function () {}); } catch (e) {}
  }
  function introStopVid(rewind) {
    var v = INTRO.vid; if (!v) return;
    if (!v.paused) try { v.pause(); } catch (e) {}
    if (rewind && v.currentTime > 0) try { v.currentTime = 0; } catch (e) {}
  }
  function introPlayAt(p) {
    var v = INTRO.vid; if (!v) { INTRO.playFail = true; return; }
    if (!INTRO.started) {
      INTRO.started = true; INTRO.vidOk = false;
      try { v.currentTime = p > 0.4 && INTRO.dur ? Math.min(p, INTRO.dur - 0.05) : 0; } catch (e) {}
      try { var pr = v.play(); if (pr && pr.catch) pr.catch(function () { INTRO.playFail = true; }); } catch (e) { INTRO.playFail = true; }
      return;
    }
    // phones that loaded late catch up with everyone else
    if (INTRO.vidOk && !v.paused && INTRO.dur && p < INTRO.dur - 0.5 && Math.abs(v.currentTime - p) > 0.6) try { v.currentTime = p; } catch (e) {}
  }
  function introSet(state, alpha, showVid) { INTRO.state = state; INTRO.alpha = alpha; INTRO.showVid = !!showVid; }
  function introEval() {
    var s = INTRO.srv;
    if (!s || NET.hostview) { introStopVid(false); introSet('VR_ACTIVE', 0); return; }
    if (s.st === 'wait') { introStopVid(true); INTRO.n = -1; introSet('IDLE', 1); return; }
    if (s.n !== INTRO.n) { INTRO.n = s.n; INTRO.started = false; INTRO.vidOk = false; INTRO.playFail = false; INTRO.endE = null; INTRO.skipEnd = false; }
    if (INTRO.doneN === s.n) { introStopVid(true); introSet('VR_ACTIVE', 0); return; }
    var now = Date.now(), e = (now - s.playT0) / 1000, p = e - IN.PRE, v = INTRO.vid;
    var se = s.st === 'skip' ? Math.max(0, (s.t0 - s.playT0) / 1000) : Infinity;
    // the host sends the film length with the start, so every phone shares one schedule (0 = no film file)
    var sched = s.len == null ? null : s.len > 0 ? s.len : IN.NOFILM;
    if (s.len === 0) INTRO.playFail = true;
    if (INTRO.endE == null && !INTRO.started && sched != null && e > IN.PRE + sched && e < se) {
      // joined after the film: go straight to wherever everyone else is (black, fading in, or the sky)
      if (e > IN.PRE + sched + IN.BLACK + IN.FADE) { INTRO.doneN = s.n; introSet('VR_ACTIVE', 0); return; }
      INTRO.endE = IN.PRE + sched;
    }
    if (INTRO.endE == null) {
      if (e >= se) { INTRO.endE = Math.max(IN.PRE, se); INTRO.skipEnd = true; }
      else if (e < IN.PRE) { introVideo(); introSet('INTRO_PLAYING', e / IN.PRE); return; }
      else if (!v || INTRO.vidStatus === 'fail' || INTRO.playFail) { var hold = sched || IN.NOFILM; if (p >= hold) INTRO.endE = IN.PRE + hold; }  // no film here: stay black with everyone
      else {
        introPlayAt(p);
        if (v.ended || (INTRO.dur && p >= INTRO.dur)) INTRO.endE = INTRO.dur ? Math.min(e, IN.PRE + INTRO.dur + 0.2) : e;
        else if (!INTRO.vidOk && p >= IN.WAIT_LOAD) { INTRO.playFail = true; introStopVid(false); }  // it never got going on this phone
        else if (p >= IN.MAXLEN) INTRO.endE = e;                          // no 'ended' and no length: stop anyway
      }
      if (INTRO.endE == null) { introSet('INTRO_PLAYING', 1, INTRO.vidOk && v && v.readyState >= 2); return; }
      introStopVid(false);
    }
    var k = e - INTRO.endE, b = INTRO.skipEnd ? IN.SKIPBLACK : IN.BLACK;
    if (k < b) { introSet('INTRO_BLACKOUT', 1); return; }
    if (k < b + IN.FADE) { var q = (k - b) / IN.FADE; introSet('VR_FADING_IN', 1 - q * q * (3 - 2 * q)); return; }
    INTRO.doneN = s.n; introStopVid(true); st.vrT = performance.now();
    introSet('VR_ACTIVE', 0);
  }
  function introCovers() { return st.mode !== 'menu' && INTRO.alpha > 0.5; }
  function drawIntro() {
    var on = st.mode !== 'menu' && (INTRO.alpha > 0.001 || INTRO.showVid);
    var cls = on && st.mode === 'screen';
    if (cls !== INTRO.cls) { INTRO.cls = cls; document.body.classList.toggle('intro-on', cls); }
    if (!on) return;
    var c = ctx;
    c.save();
    if (INTRO.alpha > 0.001) { c.globalAlpha = Math.min(1, INTRO.alpha); c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    var v = INTRO.vid;
    if (INTRO.showVid && v) {
      var vw = v.videoWidth || 16, vh = v.videoHeight || 9;
      if (st.mode === 'vr' && EYES) {
        for (var i = 0; i < 2; i++) {
          var E = EYES[i], w = Math.min(E.R * 2 * 0.96, E.clip[2]), h = w * vh / vw;
          c.save(); c.beginPath(); c.rect(E.clip[0], E.clip[1], E.clip[2], E.clip[3]); c.clip();
          try { c.drawImage(v, E.cx - w / 2, E.cy - h / 2, w, h); } catch (x) {}
          var vg = c.createRadialGradient(E.cx, E.cy, E.R * 0.92, E.cx, E.cy, E.R * 1.25);
          vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
          c.fillStyle = vg; c.fillRect(E.clip[0], E.clip[1], E.clip[2], E.clip[3]);
          c.restore();
        }
      } else {
        var sc = Math.min(W / vw, H / vh), dw = vw * sc, dh = vh * sc;
        try { c.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (x) {}
      }
    }
    if (INTRO.state === 'IDLE') {
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(241,242,245,0.42)';
      var spots = st.mode === 'vr' && EYES ? EYES : [{ cx: W / 2, cy: H / 2, R: Math.min(W, H) / 2 }];
      for (var j = 0; j < spots.length; j++) {
        c.font = Math.round(Math.max(13, Math.min(20, spots[j].R / 9))) + 'px ' + LABEL_FONT;
        c.fillText('잠시 후 시작해요', spots[j].cx, spots[j].cy);
      }
    }
    c.restore();
  }

  var wsRetry = 1000, lastSentMode = null;
  function hiMode() { return NET.hostview ? 'host' : NET.sim ? 'sim' : st.mode; }
  function sendHi() { if (NET.ws && NET.ws.readyState === 1) { try { NET.ws.send(JSON.stringify({ k: 'hi', m: hiMode(), v: INTRO.vidStatus })); lastSentMode = st.mode; } catch (e) {} } }
  function connect() {
    var ws;
    try { ws = new WebSocket(SERVER + '/ws?room=' + NET.room); } catch (e) { NET.status = 'lost'; renderNetChip(); setTimeout(connect, 5000); return; }
    NET.ws = ws;
    ws.onopen = function () { NET.status = 'ok'; wsRetry = 1000; sendHi(); renderNetChip(); };
    ws.onmessage = function (e) { if (e.data === 'pong') return; try { applyState(JSON.parse(e.data)); } catch (x) {} };
    ws.onclose = function () { NET.status = 'lost'; renderNetChip(); setTimeout(connect, wsRetry + Math.random() * 500); wsRetry = Math.min(wsRetry * 2, 10000); };
    ws.onerror = function () { try { ws.close(); } catch (x) {} };
  }
  function startPhoneLink() {
    if (!NET.room) return;
    connect();
    setInterval(function () {
      if (NET.ws && NET.ws.readyState === 1) { try { NET.ws.send('ping'); } catch (e) {} if (st.mode !== lastSentMode) sendHi(); }
    }, 5000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && NET.ws && NET.ws.readyState !== 1 && NET.ws.readyState !== 0) { wsRetry = 500; try { NET.ws.close(); } catch (e) {} } });
    renderNetChip();
  }
  startPhoneLink();
  if (NET.room && !NET.hostview) setTimeout(introVideo, 1500);  // fetch the film early so it is ready when the host starts

  var last = performance.now(), lastInfoKey = '';
  function loop(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!artReady && window.SKY_ART) initArt();
    introEval();
    var hidden = introCovers() && INTRO.alpha >= 0.999;
    if (!introCovers()) artPerf(dt);
    var synced = netTick();
    STORY.ev = storyOn() ? storyEval() : null;
    if (STORY.ev) { st.minutes = STORY.ev.minutes; synced = true; }
    if (!synced && st.speed > 0 && st.mode !== 'menu') {
      st.minutes += dt * st.speed / 60;
      if (st.minutes >= 720) st.minutes -= 720;
      syncTime();
    }
    if (followOn() && st.mode === 'screen') { st.yaw = SYNC.view.yaw; st.pitch = SYNC.view.pitch; st.zoomFov = SYNC.view.fov; }
    if (STORY.ev && st.mode === 'screen') { var sa = C.enuToAltAz(STORY.ev.dir); st.yaw = sa.az; st.pitch = Math.max(-10, Math.min(89, sa.alt)); st.zoomFov = Math.max(25, Math.min(125, STORY.ev.fov)); }
    var target;
    if (NET.sim === 'vr' && st.mode === 'vr') target = vrTurned(cameraFromYawPitch()); // the preview turns like a headset
    else if (st.mode === 'vr' && rawCam) target = vrTurned(rawCam);
    else if (st.mode === 'screen' && st.useSensor && rawCam) target = rawCam;
    else {
      if (st.mode === 'menu') st.yaw = (st.yaw + dt * 1.2) % 360;
      target = cameraFromYawPitch();
    }
    smoothCam(target);
    updatePanel(dt);
    useSky(activeSky());
    computeFrame();
    trailTick(opt('trails') && !STORY.ev);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (GL && !hidden) ctx.clearRect(0, 0, W, H);
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    quizTick();
    var sel = (st.mode === 'menu' || (st.mode === 'vr' && PANEL.open) || STORY.ev || introCovers() || quizOn()) ? null : pickTarget();
    updateArtFocus(dt, sel);
    if (st.mode === 'vr') {
      var half = W / 2;
      var sep = Math.min(half * 1.02, baseSep() + st.ipdAdj);
      var R = Math.min(half / 2 + 8, H / 2) * 1.0;
      var f = (half / 2) / Math.tan(st.fov / 2 * D2R);
      var font = Math.max(11, Math.min(18, half / 26));
      EYES = [{ cx: W / 2 - sep / 2, cy: H / 2, R: R, clip: [0, 0, half, H] }, { cx: W / 2 + sep / 2, cy: H / 2, R: R, clip: [half, 0, half, H] }];
      if (!hidden) {
        glSky([{ cx: W / 2 - sep / 2, cy: H / 2, f: f, R: R, k: st.warp, clip: [0, 0, half, H] }, { cx: W / 2 + sep / 2, cy: H / 2, f: f, R: R, k: st.warp, clip: [half, 0, half, H] }]);
        drawView({ cx: W / 2 - sep / 2, cy: H / 2, f: f, R: R, k: st.warp, clip: [0, 0, half, H], vr: true, sel: sel, font: font });
        drawView({ cx: W / 2 + sep / 2, cy: H / 2, f: f, R: R, k: st.warp, clip: [half, 0, half, H], vr: true, sel: sel, font: font });
      }
      ctx.fillStyle = hidden ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.25)'; ctx.fillRect(half - 0.5, 0, 1, H);
    } else {
      var fv = st.mode === 'menu' ? 80 : st.zoomFov;
      var ff = (Math.max(W, H) / 2) / Math.tan(fv / 2 * D2R);
      var cy0 = st.mode === 'menu' ? H * 0.32 : H / 2;
      if (!hidden) glSky([{ cx: W / 2, cy: cy0, f: ff, R: 1, k: 0, clip: [0, 0, W, H] }]);
      if (!hidden) drawView({ cx: W / 2, cy: cy0, f: ff, R: 1, k: 0, clip: [0, 0, W, H], vr: false, sel: sel, font: Math.max(13, Math.min(17, W / 40)) });
      if (st.mode === 'screen') {
        var key = sel ? sel.name : '';
        if (key !== lastInfoKey) {
          lastInfoKey = key;
          $('info').hidden = !sel;
          if (sel) { $('infoName').textContent = sel.name; $('infoText').textContent = sel.text || ''; $('infoText').hidden = !sel.text; }
        }
      }
    }
    drawIntro();
    requestAnimationFrame(loop);
  }
  // sky colour, horizon glow and the NASA Milky Way for this frame's views, drawn on the WebGL layer
  function glSky(views) {
    if (!GL) return;
    var t = Math.max(0, Math.min(1, (-frame.sunAlt - 4) / 14));
    var lim = frame.lim, gain = opt('mw') ? frame.dark * frame.dark * Math.max(0.1, Math.min(1, (lim - 3.0) / 3.1)) * 0.95 : 0;
    var ml = frame.moonLight;
    gain *= 1 - 0.75 * ml;
    GL.draw(views, frame.T, frame.M, [(mix(34, 6, t) + 14 * ml) / 255, (mix(52, 7, t) + 20 * ml) / 255, (mix(98, 12, t) + 34 * ml) / 255], gain * 0.7, {
      glow: [(34 - 14 * t) / 255, (36 - 16 * t) / 255, (50 - 26 * t) / 255],
      dome: [(52 * (0.4 + 0.6 * t)) / 255, (38 * (0.4 + 0.6 * t)) / 255, (26 * (0.4 + 0.6 * t)) / 255],
      cut: 0.2, curve: 1.25 // keep only the band itself, not the haze around it
    });
  }
  // VR: instead of pointing with an arrow, the sky turns (slowly, about the vertical only) so that what the
  // presenter shows - a story scene, the host's view, a spot - comes round in front of where the phone faces.
  var VRT = { key: '', goal: 0, cur: 0, at: 0 };
  function vrLookTarget() {
    if (STORY.ev) return { key: 'story' + SYNC.story.show + ':' + STORY.ev.i, az: C.enuToAltAz(STORY.ev.endDir).az };
    if (followOn()) return { key: 'view' + Math.round(SYNC.view.yaw), az: SYNC.view.yaw };
    var sp = syncActive() && SYNC.phase === 'guide' ? SYNC.spot : null;
    if (sp) return { key: 'spot' + sp.id, az: spotAltAz(sp, st.minutes).az };
    return null;
  }
  function vrTurned(raw) {
    var tg = vrLookTarget();
    if (tg && tg.key !== VRT.key) { // new target: work out once how far to turn, from where the head points now
      VRT.key = tg.key;
      var head = C.enuToAltAz(raw.f).az;
      VRT.goal = VRT.cur + ((tg.az - (head + VRT.cur) + 540) % 360 - 180);
    }
    var now = performance.now(), dt = Math.min(0.25, (now - (VRT.at || now)) / 1000); VRT.at = now;
    VRT.cur += (VRT.goal - VRT.cur) * Math.min(1, dt * 2.2); // settles in about 2 s, on slow phones too
    if (Math.abs(VRT.cur) < 1e-3) return raw;
    var a = -VRT.cur * D2R; // azimuth grows clockwise seen from above, rotZ turns counter-clockwise
    return { f: rotZ(raw.f, a), r: rotZ(raw.r, a), u: rotZ(raw.u, a) };
  }
  // the story plays on its own night; otherwise the presenter's choice, then this phone's own
  function activeSky() {
    if (STORY.ev) return null;
    if (SYNC.has && SYNC.sky) return SYNC.sky;
    return st.sky;
  }
  function baseSep() { return 360; } // ~63 mm on most phones (5.6-6 CSS px per mm)

  // ---------- menu wiring ----------
  function syncTime() {
    var t = clockText(st.minutes);
    $('clockMenu').textContent = t; $('clockHud').textContent = t;
    if (Math.abs(+$('time').value - st.minutes) >= 5) $('time').value = Math.round(st.minutes / 5) * 5;
    if (frame) $('skyState').textContent = sunState(frame.sunAlt);
  }
  $('time').addEventListener('input', function () { st.minutes = +this.value; computeFrame(); syncTime(); });
  function chipGroup(attr, apply) {
    var chips = document.querySelectorAll('[data-' + attr + ']');
    chips.forEach(function (ch) {
      ch.addEventListener('click', function () {
        chips.forEach(function (o) { o.setAttribute('aria-pressed', o === ch ? 'true' : 'false'); });
        apply(ch.getAttribute('data-' + attr));
      });
    });
  }
  chipGroup('speed', function (v) { st.speed = +v; });
  // ---- date & place ----
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function localDate(tz) { var d = new Date(Date.now() + tz * 3600000); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function pickSky(date, place) {
    var cur = st.sky || C.EVENT, p;
    date = date || cur.date; place = place || cur.place || 'osong';
    if (place === 'here') {
      if (cur.place === 'here') p = { name: '내 위치', lat: cur.lat, lon: cur.lon, tz: cur.tz };
      else { locateMe(date); return; }
    } else p = C.PLACES[place] || C.PLACES.osong;
    var k = { date: date, place: place, name: p.name, lat: p.lat, lon: p.lon, tz: p.tz };
    st.sky = date === C.EVENT.date && place === 'osong' ? null : k;
    saveSettings(); renderSkyWhere();
  }
  function locateMe(date) {
    if (!navigator.geolocation) { note('이 브라우저는 위치를 알려 주지 않아요.'); return; }
    $('skyWhere').textContent = '위치를 찾는 중…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      st.sky = { date: date, place: 'here', name: '내 위치', lat: Math.round(pos.coords.latitude * 1000) / 1000, lon: Math.round(pos.coords.longitude * 1000) / 1000, tz: -new Date().getTimezoneOffset() / 60 };
      saveSettings(); renderSkyWhere();
    }, function () { note('위치를 가져오지 못했어요. 위치 권한을 허용하거나 다른 장소를 골라 주세요.'); renderSkyWhere(); }, { timeout: 10000, maximumAge: 600000 });
  }
  function renderSkyWhere() {
    var shown = activeSky() || C.EVENT, mine = st.sky || C.EVENT, locked = !!(SYNC.has && SYNC.sky) || !!STORY.ev;
    var d = shown.date.split('-');
    $('skyWhere').textContent = +d[0] + '. ' + +d[1] + '. ' + +d[2] + ' · ' + (shown.name || (C.PLACES[shown.place] || C.PLACES.osong).name);
    $('skyEvent').setAttribute('aria-pressed', mine.date === C.EVENT.date ? 'true' : 'false');
    $('skyToday').setAttribute('aria-pressed', mine.date !== C.EVENT.date && mine.date === localDate(mine.tz) ? 'true' : 'false');
    if (document.activeElement !== $('skyDate')) $('skyDate').value = mine.date;
    document.querySelectorAll('[data-place]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-place') === (mine.place || 'osong') ? 'true' : 'false'); });
    $('skyLock').hidden = !locked;
    $('skyLock').textContent = STORY.ev ? '이야기는 관측회 날(2026년 11월 1일) 오송 하늘로 진행돼요.' : '진행자가 고른 날짜와 장소를 보여 주고 있어요.';
    document.querySelectorAll('#hTime .chips').forEach(function (c) { c.classList.toggle('locked', locked); });
    canvas.setAttribute('aria-label', $('skyWhere').textContent + ' 저녁 밤하늘');
  }
  $('skyEvent').addEventListener('click', function () { pickSky(C.EVENT.date, null); });
  $('skyToday').addEventListener('click', function () { pickSky(localDate((st.sky || C.EVENT).tz), null); });
  $('skyDate').addEventListener('change', function () { if (/^\d{4}-\d{2}-\d{2}$/.test(this.value)) pickSky(this.value, null); });
  document.querySelectorAll('[data-place]').forEach(function (b) { b.addEventListener('click', function () { pickSky(null, b.getAttribute('data-place')); }); });
  renderSkyWhere();
  chipGroup('lim', function (v) { st.lim = +v; });
  document.querySelectorAll('[data-opt]').forEach(function (ch) {
    ch.addEventListener('click', function () {
      var k = ch.getAttribute('data-opt'); st.show[k] = !st.show[k];
      ch.setAttribute('aria-pressed', st.show[k] ? 'true' : 'false');
      if (k === 'art') { artSlow = false; syncArtUi(); }
    });
  });
  function syncVrLabels() {
    $('ipdVal').textContent = st.ipdAdj === 0 ? '기본' : (st.ipdAdj > 0 ? '넓게 +' : '좁게 ') + st.ipdAdj;
    $('warpVal').textContent = st.warp < 0.1 ? '끔' : st.warp < 0.25 ? '약하게' : st.warp < 0.45 ? '보통' : '강하게';
    $('fovVal').textContent = st.fov + '°';
  }
  $('ipd').value = st.ipdAdj; $('warp').value = st.warp; $('fov').value = st.fov; syncVrLabels();
  $('ipd').addEventListener('input', function () { st.ipdAdj = +this.value; syncVrLabels(); saveSettings(); });
  $('warp').addEventListener('input', function () { st.warp = +this.value; syncVrLabels(); saveSettings(); });
  $('fov').addEventListener('input', function () { st.fov = +this.value; syncVrLabels(); saveSettings(); });

  $('calib').addEventListener('click', function () {
    var btn = this;
    askMotionPermission().then(function () {
      setTimeout(function () {
        if (!rawCam) { note('기울기 센서를 읽을 수 없어서 방향을 맞추지 못했어요. 이 페이지를 휴대폰 브라우저(크롬, 사파리)에서 주소로 직접 열어 주세요.'); return; }
        var cur = C.enuToAltAz(rawCam.f).az; // az with current offset
        st.headingOffset = ((st.headingOffset + (cur - 180)) % 360 + 360) % 360;
        // rotating the earth frame by +offset about Up moves azimuth by -offset
        saveSettings();
        btn.setAttribute('aria-pressed', 'true');
        btn.textContent = '맞췄어요! 다시 맞추려면 누르기';
      }, 300);
    });
  });
  function syncArtUi() {
    for (var i = 0; i < BTNS.length; i++) if (BTNS[i].id === 'art') BTNS[i].label = st.show.art ? '그림 끄기' : '그림 켜기';
    var ch = document.querySelector('[data-opt="art"]'); if (ch) ch.setAttribute('aria-pressed', st.show.art ? 'true' : 'false');
  }
  function note(t) { var n = $('sensorNote'); n.textContent = t; n.hidden = !t; }

  function enter(mode) {
    st.mode = mode; st.vrT = performance.now(); PANEL.open = false; PANEL.id = null;
    introPrime();
    $('menu').hidden = true;
    $('hud').hidden = mode !== 'screen';
    $('hint').hidden = mode !== 'screen';
    if (mode === 'screen') { st.yaw = C.enuToAltAz(st.cam.f).az; st.pitch = 30; setTimeout(function () { $('hint').hidden = true; }, 4000); }
    lastInfoKey = '__';
    resize();
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { st.lock = l; }).catch(function () {}); } catch (e) {}
  }
  function leave() {
    st.mode = 'menu'; try { $('guide').hidden = true; } catch (e) {}
    $('menu').hidden = false; $('hud').hidden = true; $('rotate').hidden = true;
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {}); } catch (e) {}
    try { if (st.lock) { st.lock.release(); st.lock = null; } } catch (e) {}
    st.pitch = 30;
  }
  // ---- first-run guide: 4 short cards, the last one counts down while you put the phone into the headset ----
  var GUIDE = [
    { t: '앉아서 천천히 둘러봐요', x: '의자에 앉아서 고개를 천천히 돌리면 하늘이 따라와요. 서서 보면 넘어질 수 있어요.' },
    { t: '바라보면 설명이 나와요', x: '화면 가운데 동그라미로 별자리나 토성을 바라보세요. 이름과 이야기가 나타나요.' },
    { t: '잘 안 보이면 아래를 봐요', x: '별이 둘로 보이면 고개를 숙여 아래를 보세요. 설정판이 나와요. 버튼을 1초 바라보면 눌려요. 어지러우면 바로 벗고 쉬어요.' },
    { t: '폰을 헤드셋에 넣어요', x: '폰을 가로로 돌려 헤드셋 가운데에 끼우고 쓰세요.' }
  ];
  var gi = 0, gTimer = null, gLeft = 0;
  function gClear() { if (gTimer) { clearInterval(gTimer); gTimer = null; } }
  function gRender() {
    var last = gi === GUIDE.length - 1;
    $('gStep').textContent = (gi + 1) + ' / ' + GUIDE.length;
    $('gTitle').textContent = GUIDE[gi].t; $('gText').textContent = GUIDE[gi].x;
    $('gBack').style.visibility = gi === 0 ? 'hidden' : 'visible';
    $('gNext').textContent = last ? '지금 시작' : '다음';
    var dots = $('gDots').children; for (var k = 0; k < dots.length; k++) dots[k].className = k === gi ? 'on' : '';
    gClear(); $('gCount').textContent = '';
    if (last) {
      gLeft = 8; $('gCount').textContent = gLeft + '초 뒤에 시작해요';
      gTimer = setInterval(function () {
        gLeft--; if (gLeft <= 0) { gStart(); return; }
        $('gCount').textContent = gLeft + '초 뒤에 시작해요';
      }, 1000);
    }
  }
  function gStart() { gClear(); $('guide').hidden = true; enter('vr'); }
  function gClose() { gClear(); $('guide').hidden = true; }
  $('gNext').addEventListener('click', function () { if (gi < GUIDE.length - 1) { gi++; gRender(); } else gStart(); });
  $('gBack').addEventListener('click', function () { if (gi > 0) { gi--; gRender(); } });
  $('gSkip').addEventListener('click', gStart);
  $('gCancel').addEventListener('click', gClose);

  $('goVR').addEventListener('click', function () {
    try {
      var el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(function () {
        try { screen.orientation.lock('landscape').catch(function () {}); } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
    askMotionPermission().then(function (ok) {
      setTimeout(function () {
        if (!ok || !st.sensorSeen) {
          note('이 화면에서는 폰 기울기 센서를 쓸 수 없어요. 고개를 돌려도 하늘이 따라오지 않으니, 휴대폰 브라우저(크롬, 사파리)에서 이 페이지 주소를 직접 열어 주세요. 지금은 ‘화면으로 보기’로 둘러볼 수 있어요.');
          return;
        }
        note(''); gi = 0; gRender(); $('guide').hidden = false;
      }, 700);
    });
  });
  $('goScreen').addEventListener('click', function () {
    askMotionPermission().then(function () { st.useSensor = false; enter('screen'); });
  });
  $('backBtn').addEventListener('click', leave);

  // double tap anywhere in VR -> menu
  var lastTap = 0;
  canvas.addEventListener('pointerup', function () {
    if (st.mode !== 'vr' || NET.sim) return;
    var t = performance.now();
    if (t - lastTap < 380) leave();
    lastTap = t;
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.mode !== 'menu') leave(); });

  // drag & pinch in screen mode
  var pointers = {}, pinch0 = 0, fov0 = 75;
  function canDrag() { return (st.mode === 'screen' && !followOn() && !storyOn()) || (NET.sim === 'vr' && st.mode === 'vr'); }
  canvas.addEventListener('pointerdown', function (e) {
    if (!canDrag()) return;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 2) { var a = pointers[ids[0]], b = pointers[ids[1]]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); fov0 = st.zoomFov; }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!canDrag() || !pointers[e.pointerId]) return;
    var p = pointers[e.pointerId], ids = Object.keys(pointers);
    if (ids.length === 1) {
      var degPerPx = (st.mode === 'vr' ? st.fov * 0.9 : st.zoomFov) / Math.max(W, H);
      st.yaw = (st.yaw - (e.clientX - p.x) * degPerPx + 360) % 360;
      st.pitch = Math.max(st.mode === 'vr' ? -80 : -10, Math.min(89, st.pitch + (e.clientY - p.y) * degPerPx));
    }
    p.x = e.clientX; p.y = e.clientY;
    if (ids.length === 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) st.zoomFov = Math.max(25, Math.min(110, fov0 * pinch0 / d));
    }
  });
  function up(e) { delete pointers[e.pointerId]; if (Object.keys(pointers).length < 2) pinch0 = 0; }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', function (e) {
    if (st.mode !== 'screen' || !canDrag()) return;
    e.preventDefault();
    st.zoomFov = Math.max(25, Math.min(110, st.zoomFov * (e.deltaY > 0 ? 1.08 : 0.93)));
  }, { passive: false });
  document.addEventListener('keydown', function (e) {
    if (st.mode !== 'screen') return;
    if (e.key === 'ArrowLeft') st.yaw = (st.yaw - 5 + 360) % 360;
    if (e.key === 'ArrowRight') st.yaw = (st.yaw + 5) % 360;
    if (e.key === 'ArrowUp') st.pitch = Math.min(89, st.pitch + 5);
    if (e.key === 'ArrowDown') st.pitch = Math.max(-10, st.pitch - 5);
  });

  // start
  st.cam = cameraFromYawPitch();
  computeFrame(); syncTime();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('16px "Pretendard Variable"'); document.fonts.load('700 16px "Pretendard Variable"');
  }
  if (NET.hostview || NET.sim) {
    try { $('backBtn').hidden = true; } catch (e) {}
    if (NET.hostview || NET.sim === 'screen') { st.useSensor = false; enter('screen'); if (NET.hostview) $('hint').textContent = '끌어서 돌리기 · 휠로 확대'; }
    else { st.yaw = 150; st.pitch = 30; enter('vr'); }
  }
  if (NET.hostview && window.parent !== window) {
    var lastPost = '';
    setInterval(function () {
      if (st.mode !== 'screen') return;
      var key = Math.round(st.yaw * 10) + ',' + Math.round(st.pitch * 10) + ',' + Math.round(st.zoomFov);
      if (key === lastPost) return; lastPost = key;
      try { window.parent.postMessage({ type: 'osong-view', yaw: st.yaw, pitch: st.pitch, fov: st.zoomFov }, location.origin === 'null' ? '*' : location.origin); } catch (e) {}
    }, 120);
    window.addEventListener('message', function (ev) {
      var d = ev.data || {};
      if (d.type === 'osong-setview') { // the presenter's 'move to' controls
        st.yaw = +d.yaw || 0; st.pitch = Math.max(-10, Math.min(89, +d.pitch || 0)); st.zoomFov = Math.max(15, Math.min(120, +d.fov || 75));
        return;
      }
      if (d.type === 'osong-lookat') {
        var sp = spotById(d.id); if (!sp) return;
        var aa = spotAltAz(sp, st.minutes);
        st.yaw = aa.az; st.pitch = Math.max(-5, Math.min(85, aa.alt));
      }
    });
  }
  requestAnimationFrame(loop);
  window.__sky = { intro: INTRO,  st: st, frame: function () { return frame; }, qz: QZ, vrt: VRT, setRaw: function (cam) { rawCam = cam; st.sensorSeen = true; }, polar: function () { var v = starVecByName('북극성'); return v ? C.enuToAltAz(C.apply(frame.M, v)) : null; } };
})();
