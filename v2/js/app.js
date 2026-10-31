// Participant page: menu, VR and on-screen viewing, gaze info, constellation drawings, show playback and sync.
(function () {
  'use strict';
  var C = SkyCore, D2R = C.D2R;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('sky');
  var eng = SkyEngine(canvas, $('skygl'));
  var QS = new URLSearchParams(location.search);
  var DIRS = CONTENT.DIRS;

  // ---------- state ----------
  var st = {
    minutes: 90, speed: 0, lim: 4.6,
    show: { lines: true, names: true, stars: true, mw: true, dirs: true },
    ipdAdj: 0, warp: 0.3, fov: 95, headingOffset: 0, red: false,
    mode: 'menu', // menu | vr | screen
    yaw: 150, pitch: 30, zoomFov: 75,
    sensorSeen: false, absolute: false, compassDone: false, compassOffset: 0,
    cam: null, vrT: 0
  };
  try {
    var saved = JSON.parse(localStorage.getItem('osong-vr-settings') || 'null');
    if (saved) {
      st.ipdAdj = saved.ipdAdj || 0; st.warp = saved.warp != null ? saved.warp : 0.3; st.fov = saved.fov || 95;
      st.headingOffset = saved.headingOffset || 0; st.red = !!saved.red;
    }
  } catch (e) {}
  function saveSettings() {
    try { localStorage.setItem('osong-vr-settings', JSON.stringify({ ipdAdj: st.ipdAdj, warp: st.warp, fov: st.fov, headingOffset: st.headingOffset, red: st.red })); } catch (e) {}
  }

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function wrap180(a) { a = ((a + 180) % 360 + 360) % 360; return a - 180; }
  function clockText(min) {
    var t = 18 * 60 + Math.round(min), h = Math.floor(t / 60) % 24, m = t % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function sunState(sunAlt) {
    if (sunAlt > -6) return '해가 막 졌어요. 아직 밝아서 아주 밝은 별만 보여요.';
    if (sunAlt > -12) return '서쪽에 노을빛이 남아 있어요. 밝은 별이 하나둘 나타나요.';
    if (sunAlt > -18) return '하늘이 점점 어두워져요. 별자리 모양이 보이기 시작해요.';
    return '완전히 어두운 밤이에요. 별이 가장 많이 보이는 시간이에요.';
  }
  function fmtLen(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }

  // ---------- orientation sensors ----------
  function devMatrix(a, b, g) { // W3C: R = Rz(a) Rx(b) Ry(g), device -> earth (E, N, U)
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
  function rotCam(cam, deg) { var a = deg * D2R; return { f: rotZ(cam.f, a), u: rotZ(cam.u, a), r: rotZ(cam.r, a) }; }

  var rawCam = null;
  function onOrient(e) {
    if (e.alpha == null && e.beta == null) return;
    if (e.type === 'deviceorientationabsolute') st.absolute = true;
    else if (st.absolute) return;
    st.sensorSeen = true;
    var alpha = e.alpha || 0;
    if (!st.compassDone && typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      st.compassOffset = (360 - e.webkitCompassHeading) - alpha; st.compassDone = true;
    }
    alpha += st.compassOffset;
    var R = devMatrix(alpha, e.beta || 0, e.gamma || 0), th = screenAngle();
    var rs = [Math.cos(th), -Math.sin(th), 0], us = [Math.sin(th), Math.cos(th), 0];
    var off = st.headingOffset * D2R;
    rawCam = { f: rotZ(C.apply(R, [0, 0, -1]), off), u: rotZ(C.apply(R, us), off), r: rotZ(C.apply(R, rs), off) };
  }
  if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOrient);
  window.addEventListener('deviceorientation', onOrient);
  function askMotionPermission() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function')
        return DeviceOrientationEvent.requestPermission().then(function (r) { return r === 'granted'; }).catch(function () { return false; });
    } catch (e) {}
    return Promise.resolve(true);
  }

  function camFromYawPitch(yaw, pitch) {
    var az = yaw * D2R, al = pitch * D2R;
    var f = [Math.sin(az) * Math.cos(al), Math.cos(az) * Math.cos(al), Math.sin(al)];
    var r = [Math.cos(az), -Math.sin(az), 0];
    return { f: f, r: r, u: cross(r, f) };
  }
  function smoothCam(target, k) {
    if (!st.cam) { st.cam = target; return; }
    var c = st.cam;
    var f = norm([c.f[0] + (target.f[0] - c.f[0]) * k, c.f[1] + (target.f[1] - c.f[1]) * k, c.f[2] + (target.f[2] - c.f[2]) * k]);
    var u0 = [c.u[0] + (target.u[0] - c.u[0]) * k, c.u[1] + (target.u[1] - c.u[1]) * k, c.u[2] + (target.u[2] - c.u[2]) * k];
    var r = norm(cross(f, u0));
    st.cam = { f: f, r: r, u: cross(r, f) };
  }
  function altAz(e) { return C.enuToAltAz(e); }

  // ---------- canvas sizing ----------
  var W = 0, H = 0;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    eng.resize(W, H, window.devicePixelRatio || 1);
    $('rotate').hidden = !(st.mode === 'vr' && H > W);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  resize();

  // ---------- gaze: info card and constellation drawings ----------
  var FIG_DWELL = 1.5;   // seconds of steady gaze before the drawing starts
  var gaze = { key: '', t: 0, cons: null, dwell: 0 }, figs = {};
  function updateGaze(dt, sel) {
    var key = sel ? sel.key : '';
    if (key !== gaze.key) { gaze.key = key; gaze.t = 0; } else gaze.t += dt;
    var cid = sel ? (sel.cons || sel.near || null) : null;
    if (cid !== gaze.cons) { gaze.cons = cid; gaze.dwell = 0; } else gaze.dwell += dt;
    for (var id in figs) {
      if (id === cid) continue;
      figs[id].a -= dt / 0.9;
      if (figs[id].a <= 0) delete figs[id];
    }
    if (cid && eng.hasFigure(cid)) {
      var f = figs[cid];
      if (f) { f.a = Math.min(1, f.a + dt / 0.4); if (f.p < 1) f.p = Math.min(1, f.p + dt / 2.6); }
      else if (gaze.dwell > FIG_DWELL) figs[cid] = { p: 0, a: 0.2 };
    }
  }
  function dwellRing() {
    var cid = gaze.cons;
    if (!cid || !eng.hasFigure(cid) || figs[cid]) return 0;
    return clamp(gaze.dwell / FIG_DWELL, 0, 1);
  }
  function resetGaze() { gaze = { key: '', t: 0, cons: null, dwell: 0 }; figs = {}; }

  // ---------- VR settings panel (look down at your feet) ----------
  var PANEL = {
    open: false, yaw: 180, lastAz: 180, id: null, t: 0, repeat: 0, toast: '', toastT: 0, dwell: 0.9,
    btns: [
      { id: 'ipd-', x: -0.26, y: 0.31, w: 0.17, h: 0.15, label: '−', rep: true },
      { id: 'ipd+', x: 0.26, y: 0.31, w: 0.17, h: 0.15, label: '+', rep: true },
      { id: 'warp-', x: -0.26, y: 0.11, w: 0.17, h: 0.15, label: '−', rep: true },
      { id: 'warp+', x: 0.26, y: 0.11, w: 0.17, h: 0.15, label: '+', rep: true },
      { id: 'fov-', x: -0.26, y: -0.09, w: 0.17, h: 0.15, label: '−', rep: true },
      { id: 'fov+', x: 0.26, y: -0.09, w: 0.17, h: 0.15, label: '+', rep: true },
      { id: 'south', x: -0.25, y: -0.31, w: 0.62, h: 0.16, label: '이 방향이 남쪽' },
      { id: 'menu', x: 0.36, y: -0.31, w: 0.3, h: 0.16, label: '메뉴로' }
    ],
    rows: [
      { y: 0.31, name: '두 화면 간격', val: function () { return st.ipdAdj === 0 ? '0' : (st.ipdAdj > 0 ? '+' : '') + st.ipdAdj; } },
      { y: 0.11, name: '렌즈 보정', val: function () { return st.warp < 0.1 ? '끔' : Math.round(st.warp * 10); } },
      { y: -0.09, name: '보이는 넓이', val: function () { return st.fov + '°'; } }
    ]
  };
  var REPEAT = 0.4;
  function applyBtn(id) {
    if (id === 'ipd-') st.ipdAdj = Math.max(-60, st.ipdAdj - 4);
    else if (id === 'ipd+') st.ipdAdj = Math.min(60, st.ipdAdj + 4);
    else if (id === 'warp-') st.warp = Math.max(0, Math.round((st.warp - 0.1) * 10) / 10);
    else if (id === 'warp+') st.warp = Math.min(0.8, Math.round((st.warp + 0.1) * 10) / 10);
    else if (id === 'fov-') st.fov = Math.max(70, st.fov - 5);
    else if (id === 'fov+') st.fov = Math.min(120, st.fov + 5);
    else if (id === 'south') {
      // remove any show turn first so "south" means the real south
      st.headingOffset = ((st.headingOffset + (PANEL.yaw + showYaw - 180)) % 360 + 360) % 360;
      PANEL.yaw = 180; PANEL.lastAz = 180;
      PANEL.toast = '맞췄어요'; PANEL.toastT = 1.6;
      saveSettings(); return;
    } else if (id === 'menu') { leave(); return; }
    $('ipd').value = st.ipdAdj; $('warp').value = st.warp; $('fov').value = st.fov;
    syncVrLabels(); saveSettings();
  }
  function updatePanel(dt) {
    if (PANEL.toastT > 0) PANEL.toastT -= dt;
    if (st.mode !== 'vr' || (window.VRIntro && VRIntro.covers())) { PANEL.open = false; PANEL.id = null; return; }
    var f = st.cam.f, pitch = Math.asin(clamp(f[2], -1, 1)) / D2R;
    if (pitch > -30) PANEL.lastAz = altAz(f).az;
    if (!PANEL.open && pitch < -36) { PANEL.open = true; PANEL.yaw = PANEL.lastAz; PANEL.id = null; PANEL.t = 0; }
    else if (PANEL.open && pitch > -16) { PANEL.open = false; PANEL.id = null; }
    if (!PANEL.open) return;
    var hit = eng.panelHit(PANEL, f);
    if (!hit) { PANEL.id = null; PANEL.t = 0; return; }
    if (PANEL.id !== hit.id) { PANEL.id = hit.id; PANEL.t = 0; PANEL.repeat = 0; return; }
    PANEL.t += dt;
    if (PANEL.t >= PANEL.dwell) {
      if (hit.rep) {
        PANEL.repeat += dt;
        if (PANEL.repeat >= REPEAT || PANEL.repeat === dt) { PANEL.repeat = 0.0001; applyBtn(hit.id); }
      } else { applyBtn(hit.id); PANEL.id = null; PANEL.t = -0.8; }
    }
  }

  // ---------- shows: local playback or following the presenter ----------
  var room = (QS.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  var guest = null;
  var local = null; // { id, scene, start } when playing a show alone: scenes advance by themselves
  var showOn = false, showJoin = 0, joinCam = null, showYaw = 0, vrStep = { index: -1, goal: 0 };
  var LOCAL_HOLD = 14; // seconds a scene stays up after its animation when playing alone
  function activeShow() {
    if (guest) {
      var g = guest.position();
      if (g) { var gs = ShowTimeline.byId(g.show); if (gs) { local = null; return { show: gs, scene: g.scene, t: g.t, synced: true }; } }
    }
    if (local) {
      var ls = ShowTimeline.byId(local.id), lt = (performance.now() - local.start) / 1000;
      if (lt > ShowTimeline.settleTime(ls.scenes[local.scene]) + LOCAL_HOLD) {
        if (local.scene + 1 >= ls.scenes.length) { local = null; return null; }
        local.scene++; local.start = performance.now(); lt = 0;
      }
      return { show: ls, scene: local.scene, t: lt, synced: false };
    }
    return null;
  }
  function playLocal(id) { local = { id: id, scene: 0, start: performance.now() }; }
  function onShowStart(a) {
    showOn = true; showJoin = performance.now(); vrStep.index = -1;
    joinCam = { yaw: st.yaw, pitch: st.pitch, fov: st.zoomFov };
    resetGaze();
    if (st.mode === 'menu') {
      if (a.synced) openBanner(a.show); else enter('screen');
    }
  }
  function onShowEnd() {
    showOn = false; vrStep.goal = 0; vrStep.index = -1;
    closeBanner();
    $('caption').hidden = true;
  }

  var bannerTimer = null;
  function openBanner(show) {
    var b = $('banner'), left = 5;
    $('bannerTitle').textContent = '‘' + show.title + '’ 쇼가 시작됐어요';
    var tick = function () {
      $('bannerText').textContent = left + '초 뒤에 화면으로 보기로 넘어가요';
      if (left-- <= 0) { closeBanner(); if (st.mode === 'menu') enter('screen'); }
    };
    b.hidden = false; clearInterval(bannerTimer); tick(); bannerTimer = setInterval(tick, 1000);
  }
  function closeBanner() { clearInterval(bannerTimer); $('banner').hidden = true; }
  $('bannerScreen').addEventListener('click', function () { closeBanner(); enter('screen'); });
  $('bannerVR').addEventListener('click', function () { closeBanner(); startVR(); });

  // ---------- menu: shows list ----------
  (function () {
    var list = $('showList');
    SHOWS.forEach(function (s) {
      var el = document.createElement('div');
      el.className = 'show-item';
      el.innerHTML = '<h3></h3><button type="button" class="btn-line">혼자 보기</button><p></p>';
      el.querySelector('h3').textContent = s.title + ' ';
      var len = document.createElement('span'); len.className = 'len'; len.textContent = s.scenes.length + '장면';
      el.querySelector('h3').appendChild(len);
      el.querySelector('p').textContent = s.blurb;
      el.querySelector('button').addEventListener('click', function () { playLocal(s.id); });
      list.appendChild(el);
    });
  })();

  // ---------- presenter link ----------
  var LIVE_TEXT = {
    connecting: '진행자 화면에 연결하는 중',
    connected: '진행자와 연결됐어요. 대기 중이에요. 진행자가 시작하면 바로 시작돼요.',
    reconnecting: '연결이 끊겨서 다시 잇는 중이에요'
  };
  function setLive(s) {
    $('live').dataset.state = s;
    $('liveText').textContent = LIVE_TEXT[s] || s;
    $('hudLive').hidden = s !== 'connected';
  }
  if (room) {
    $('live').hidden = false; $('liveCode').textContent = room;
    $('showHint').textContent = '진행자가 쇼를 시작하면 어느 화면에 있든 바로 함께 재생돼요.';
    setLive('connecting');
    guest = ShowSync.guest(room, { status: setLive });
    // opening film (js/intro.js): the presenter's 체험 시작 plays it on every phone, then the sky fades in
    if (window.PhoneCam) PhoneCam.start(room);   // small snapshots of this screen for the presenter's wall (js/phonecam.js)
    if (window.VRIntro) VRIntro.attach({ guest: guest, mode: function () { return st.mode; }, sep: function () { return baseSep() + st.ipdAdj; }, onDone: function () { st.vrT = performance.now(); } });
  }

  // ---------- main loop ----------
  var last = performance.now(), lastCardKey = null, lastCap = '';
  function loop(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    var a = activeShow();
    if (a && !showOn) onShowStart(a);
    if (!a && showOn) onShowEnd();
    var ev = a ? ShowTimeline.evaluate(eng, a.show, a.scene, a.t) : null;

    if (ev) { st.minutes = ev.minutes; syncTime(); }
    else if (st.speed > 0 && st.mode !== 'menu') {
      st.minutes += dt * st.speed / 60;
      if (st.minutes > 210) st.minutes = 30;
      syncTime();
    }

    // camera
    var target, smoothK = 0.45;
    if (st.mode === 'vr' && rawCam) {
      if (ev) {
        if (ev.index !== vrStep.index) {
          vrStep.index = ev.index;
          var fa = altAz(rawCam.f);
          // turn the sky so this step's target ends up where the viewer is facing now
          if (Math.abs(fa.alt) < 75) vrStep.goal = wrap180(fa.az - altAz(ev.endTargetEnu).az);
        }
      }
      var d = wrap180(vrStep.goal - showYaw), maxStep = 24 * dt;
      showYaw = wrap180(showYaw + clamp(d * Math.min(1, dt * 1.6), -maxStep, maxStep));
      target = Math.abs(showYaw) > 0.01 ? rotCam(rawCam, showYaw) : rawCam;
    } else {
      showYaw = 0;
      if (st.mode === 'menu') st.yaw = (st.yaw + dt * 1.2) % 360;
      if (ev && st.mode === 'screen') {
        var ta = altAz(ev.dir), b = ease((now - showJoin) / 1600);
        var y = joinCam.yaw + wrap180(ta.az - joinCam.yaw) * b;
        var p = joinCam.pitch + (clamp(ta.alt, -4, 86) - joinCam.pitch) * b;
        st.yaw = (y + 360) % 360; st.pitch = p;
        st.zoomFov = joinCam.fov + (ev.fov - joinCam.fov) * b;
        smoothK = 0.6;
      }
      target = camFromYawPitch(st.yaw, st.pitch);
    }
    smoothCam(target, smoothK);
    updatePanel(dt);

    // gaze
    var sel = null;
    if (!ev && st.mode !== 'menu' && !(st.mode === 'vr' && PANEL.open) && !(window.VRIntro && VRIntro.covers())) {
      var fr = eng.frame();
      if (fr) { sel = eng.pickTarget(st.cam.f, true); updateGaze(dt, sel); }
    } else if (!ev) { updateGaze(dt, null); }

    // what to draw
    var o = {
      cam: st.cam, minutes: st.minutes, lim: st.lim, show: st.show,
      mode: st.mode === 'vr' ? 'vr' : 'flat',
      fov: st.mode === 'menu' ? 80 : st.zoomFov, cyFrac: st.mode === 'menu' ? 0.3 : 0.5,
      warp: st.warp, vrFov: st.fov, sep: baseSep() + st.ipdAdj,
      reticle: st.mode !== 'menu', panel: PANEL
    };
    if (ev) {
      o.highlight = ev.highlight; o.figures = ev.figures; o.pointer = ev.pointer;
      o.lineCons = ev.lineCons; o.labelAlpha = ev.labelAlpha; o.trails = ev.trails; o.eyepiece = ev.eyepiece;
      if (ev.lim != null) o.lim = ev.lim;
      var M = C.eqjToEnu(window.SKY, ev.minutes), e = ev.endTargetEnu;
      o.guide = st.mode === 'vr' ? [M[0][0] * e[0] + M[1][0] * e[1] + M[2][0] * e[2], M[0][1] * e[0] + M[1][1] * e[1] + M[2][1] * e[2], M[0][2] * e[0] + M[1][2] * e[1] + M[2][2] * e[2]] : null;
      if (st.mode === 'vr') {
        o.caption = ev.caption;
        o.top = (ev.index + 1) + ' / ' + a.show.scenes.length + '  ' + a.show.title;
      }
    } else {
      var hcons = sel ? (sel.cons || sel.near) : null;
      o.highlight = hcons; o.figures = figs; o.dwell = dwellRing();
      if (st.mode === 'vr') {
        var fa2 = altAz(st.cam.f);
        o.top = clockText(st.minutes) + '  ' + DIRS[Math.round(fa2.az / 45) % 8] + '  고도 ' + Math.round(fa2.alt) + '°';
        if (sel && !PANEL.open) o.card = { name: sel.name, kind: sel.kind, text: sel.text, t: gaze.t };
        if (!PANEL.open && now - st.vrT < 12000) o.hint = '고개를 숙여 발밑을 보면 설정이 나와요';
      }
    }
    var fr2 = eng.render(o);
    if (window.PhoneCam) {
      var fa3 = altAz(st.cam.f), ist = window.VRIntro ? VRIntro.state().state : '';
      PhoneCam.frame(st.mode, DIRS[Math.round(((fa3.az % 360) + 360) % 360 / 45) % 8] + ' ' + Math.round(fa3.alt) + '°',
        ist !== 'ACTIVE' && ist ? (ist === 'IDLE' ? '대기' : '오프닝') : ev ? '쇼 ' + (ev.index + 1) + '장면' : '');
    }

    if (st.mode === 'screen') {
      updateCard(ev ? null : sel);
      updateCaption(ev, a);
      $('clockHud').innerHTML = clockText(st.minutes) + '<span>' + DIRS[Math.round(altAz(st.cam.f).az / 45) % 8] + ' · 고도 ' + Math.round(altAz(st.cam.f).alt) + '°</span>';
    }
    if (st.mode === 'menu' && fr2) $('skyState').textContent = sunState(fr2.sunAlt);
    requestAnimationFrame(loop);
  }
  function baseSep() { return 360; } // about 63 mm on most phones

  function updateCard(sel) {
    var key = sel ? sel.key : '';
    if (key !== lastCardKey) {
      lastCardKey = key;
      $('info').hidden = !sel;
      if (sel) {
        $('infoName').textContent = sel.name; $('infoKind').textContent = sel.kind || '';
        $('infoText').textContent = sel.text || ''; $('infoBody').hidden = !sel.text;
        $('infoText').style.transform = 'translateY(0)';
      }
    }
    if (!sel || !sel.text) return;
    var body = $('infoBody'), p = $('infoText');
    var overflow = p.scrollHeight - body.clientHeight;
    body.classList.toggle('scrolls', overflow > 2);
    var off = eng.scrollOffset(gaze.t, overflow, 15);
    if (off < 0) { p.style.opacity = '0.3'; off = 0; } else p.style.opacity = '1';
    p.style.transform = 'translateY(' + (-off).toFixed(1) + 'px)';
  }
  function updateCaption(ev, a) {
    var cap = $('caption');
    if (!ev || !ev.caption) { cap.hidden = true; lastCap = ''; return; }
    cap.hidden = false;
    var key = ev.caption.title + ev.caption.sub;
    if (key !== lastCap) { lastCap = key; $('capTitle').textContent = ev.caption.title; $('capSub').textContent = ev.caption.sub; }
    cap.style.opacity = ev.caption.alpha.toFixed(3);
    $('capBar').style.width = (100 * (a.scene + 1) / a.show.scenes.length).toFixed(1) + '%';
  }

  // ---------- menu wiring ----------
  function syncTime() {
    var t = clockText(st.minutes);
    $('clockMenu').innerHTML = t + '<small>KST</small>';
    if (Math.abs(+$('time').value - st.minutes) >= 5) $('time').value = Math.round(st.minutes / 5) * 5;
  }
  $('time').addEventListener('input', function () { st.minutes = +this.value; syncTime(); });
  function seg(attr, apply) {
    var btns = document.querySelectorAll('[data-' + attr + ']');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        apply(b.getAttribute('data-' + attr));
      });
    });
  }
  seg('speed', function (v) { st.speed = +v; });
  seg('lim', function (v) { st.lim = +v; $('limVal').textContent = '맨눈 ' + (+v).toFixed(1) + '등급'; });
  document.querySelectorAll('[data-opt]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-opt'); st.show[k] = !st.show[k];
      b.setAttribute('aria-pressed', st.show[k] ? 'true' : 'false');
    });
  });
  function applyRed() { $('redfilter').hidden = !st.red; $('redBtn').setAttribute('aria-pressed', st.red ? 'true' : 'false'); }
  $('redBtn').addEventListener('click', function () { st.red = !st.red; applyRed(); saveSettings(); });
  applyRed();
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
        if (!rawCam) { note('기울기 센서를 읽지 못했어요. 휴대폰의 크롬이나 사파리에서 이 주소를 직접 열어 주세요.'); return; }
        st.headingOffset = ((st.headingOffset + (altAz(rawCam.f).az - 180)) % 360 + 360) % 360;
        saveSettings();
        btn.setAttribute('aria-pressed', 'true');
        btn.textContent = '맞췄어요. 다시 맞추려면 누르기';
      }, 300);
    });
  });
  function note(t) { var n = $('sensorNote'); n.textContent = t; n.hidden = !t; }

  // ---------- modes ----------
  function enter(mode) {
    st.mode = mode; st.vrT = performance.now(); PANEL.open = false; PANEL.id = null;
    if (window.VRIntro) VRIntro.prime();
    $('menu').hidden = true;
    $('hud').hidden = mode !== 'screen';
    $('hint').hidden = mode !== 'screen' || showOn;
    lastCardKey = null; resetGaze();
    if (mode === 'screen') {
      var fa = altAz(st.cam.f); st.yaw = fa.az; st.pitch = 30;
      if (showOn) joinCam = { yaw: st.yaw, pitch: st.pitch, fov: st.zoomFov }, showJoin = performance.now();
      setTimeout(function () { $('hint').hidden = true; }, 4000);
    }
    if (mode === 'vr') vrStep.index = -1;
    resize();
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { st.lock = l; }).catch(function () {}); } catch (e) {}
  }
  function leave() {
    st.mode = 'menu'; $('guide').hidden = true;
    $('menu').hidden = false; $('hud').hidden = true; $('rotate').hidden = true;
    local = null;
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {}); } catch (e) {}
    try { if (st.lock) { st.lock.release(); st.lock = null; } } catch (e) {}
    st.pitch = 30;
  }

  // first-run guide: four short cards; the last one counts down while the phone goes into the headset
  var GUIDE = [
    { t: '앉아서 천천히 둘러봐요', x: '의자에 앉아 고개를 천천히 돌리면 하늘이 따라와요. 서서 보면 넘어질 수 있어요.' },
    { t: '바라보면 그림이 그려져요', x: '가운데 동그라미로 별자리를 2초쯤 바라보면 별자리 그림이 그려지고, 아래 설명이 천천히 흘러가요.' },
    { t: '잘 안 보이면 발밑을 봐요', x: '별이 둘로 보이면 고개를 숙여 발밑을 보세요. 설정판이 나와요. 버튼을 1초 바라보면 눌려요. 어지러우면 바로 벗고 쉬어요.' },
    { t: '폰을 헤드셋에 넣어요', x: '폰을 가로로 돌려 헤드셋 가운데에 끼우고 써 주세요.' }
  ];
  var gi = 0, gTimer = null, gLeft = 0;
  function gClear() { if (gTimer) { clearInterval(gTimer); gTimer = null; } }
  function gRender() {
    var lastCard = gi === GUIDE.length - 1;
    $('gStep').textContent = (gi + 1) + ' / ' + GUIDE.length;
    $('gTitle').textContent = GUIDE[gi].t; $('gText').textContent = GUIDE[gi].x;
    $('gBack').style.visibility = gi === 0 ? 'hidden' : 'visible';
    $('gNext').textContent = lastCard ? '지금 시작' : '다음';
    var bars = $('gBar').children; for (var k = 0; k < bars.length; k++) bars[k].className = k <= gi ? 'on' : '';
    gClear(); $('gCount').textContent = '';
    if (lastCard) {
      gLeft = 8; $('gCount').textContent = gLeft + '초 뒤에 시작해요';
      gTimer = setInterval(function () {
        gLeft--; if (gLeft <= 0) { gStart(); return; }
        $('gCount').textContent = gLeft + '초 뒤에 시작해요';
      }, 1000);
    }
  }
  function gStart() { gClear(); $('guide').hidden = true; enter('vr'); }
  $('gNext').addEventListener('click', function () { if (gi < GUIDE.length - 1) { gi++; gRender(); } else gStart(); });
  $('gBack').addEventListener('click', function () { if (gi > 0) { gi--; gRender(); } });
  $('gSkip').addEventListener('click', gStart);
  $('gCancel').addEventListener('click', function () { gClear(); $('guide').hidden = true; });

  var seenGuide = false;
  function startVR() {
    try {
      var el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(function () {
        try { screen.orientation.lock('landscape').catch(function () {}); } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
    askMotionPermission().then(function (ok) {
      setTimeout(function () {
        if (!QS.has('vrtest') && (!ok || !st.sensorSeen)) {
          note('이 화면에서는 폰 기울기 센서를 쓸 수 없어요. 고개를 돌려도 하늘이 따라오지 않으니, 휴대폰의 크롬이나 사파리에서 이 주소를 직접 열어 주세요. 지금은 ‘화면으로 보기’로 둘러볼 수 있어요.');
          if (showOn) enter('screen');
          return;
        }
        note('');
        if (showOn || seenGuide) { enter('vr'); return; } // a show is waiting: skip the cards
        seenGuide = true; gi = 0; gRender(); $('guide').hidden = false;
      }, 600);
    });
  }
  $('goVR').addEventListener('click', startVR);
  $('goScreen').addEventListener('click', function () { enter('screen'); });
  $('backBtn').addEventListener('click', leave);

  var lastTap = 0;
  canvas.addEventListener('pointerup', function () {
    if (st.mode !== 'vr') return;
    var t = performance.now();
    if (t - lastTap < 380) leave();
    lastTap = t;
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.mode !== 'menu') leave(); });

  // drag and pinch on screen (ignored while a show is steering the view)
  var pointers = {}, pinch0 = 0, fov0 = 75;
  canvas.addEventListener('pointerdown', function (e) {
    if (st.mode !== 'screen') return;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 2) { var a = pointers[ids[0]], b = pointers[ids[1]]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); fov0 = st.zoomFov; }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (st.mode !== 'screen' || !pointers[e.pointerId]) return;
    var p = pointers[e.pointerId], ids = Object.keys(pointers);
    if (!showOn) {
      if (ids.length === 1) {
        var degPerPx = st.zoomFov / Math.max(W, H);
        st.yaw = (st.yaw - (e.clientX - p.x) * degPerPx + 360) % 360;
        st.pitch = clamp(st.pitch + (e.clientY - p.y) * degPerPx, -10, 89);
      }
      if (ids.length === 2 && pinch0 > 0) {
        p.x = e.clientX; p.y = e.clientY;
        var a = pointers[ids[0]], b = pointers[ids[1]];
        st.zoomFov = clamp(fov0 * pinch0 / Math.hypot(a.x - b.x, a.y - b.y), 25, 110);
      }
    }
    p.x = e.clientX; p.y = e.clientY;
  });
  function up(e) { delete pointers[e.pointerId]; if (Object.keys(pointers).length < 2) pinch0 = 0; }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', function (e) {
    if (st.mode !== 'screen' || showOn) return;
    e.preventDefault();
    st.zoomFov = clamp(st.zoomFov * (e.deltaY > 0 ? 1.08 : 0.93), 25, 110);
  }, { passive: false });
  document.addEventListener('keydown', function (e) {
    if (st.mode !== 'screen' || showOn) return;
    if (e.key === 'ArrowLeft') st.yaw = (st.yaw - 5 + 360) % 360;
    if (e.key === 'ArrowRight') st.yaw = (st.yaw + 5) % 360;
    if (e.key === 'ArrowUp') st.pitch = Math.min(89, st.pitch + 5);
    if (e.key === 'ArrowDown') st.pitch = Math.max(-10, st.pitch - 5);
  });

  // ---------- start ----------
  st.cam = camFromYawPitch(st.yaw, st.pitch);
  syncTime();
  if (document.fonts && document.fonts.load) {
    ['16px "Nanum Myeongjo"', '700 16px "Nanum Myeongjo"', '16px "IBM Plex Sans KR"', '16px "IBM Plex Mono"'].forEach(function (f) { document.fonts.load(f); });
  }
  requestAnimationFrame(loop);
  window.__sky = { st: st, eng: eng, gaze: function () { return gaze; }, figs: function () { return figs; }, guest: function () { return guest; },
    setRaw: function (cam) { rawCam = cam; st.sensorSeen = true; }, playLocal: playLocal };
})();
