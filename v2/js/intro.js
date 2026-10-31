// Opening film on the participant phones: wait (black) → fade to black → film → hold black → the real sky fades in over 2 s.
// It lives on its own transparent canvas above the sky, so the sky drawing itself is untouched.
// The presenter sends { intro: { st: 'wait'|'play'|'skip', n, at, pat, len } } inside the show state (server clock, ms).
// If the film file is missing, will not play or never ends, the phone holds black with everyone else and fades in anyway.
var VRIntro = (function () {
  'use strict';
  var SRC = 'assets/videos/vr-intro.mp4?v=2';
  var IN = { PRE: 0.8, BLACK: 0.6, SKIPBLACK: 0.3, FADE: 2.0, NOFILM: 1.5, WAIT_LOAD: 4, MAXLEN: 60 };
  var O = null;                       // { guest, mode(), sep(), onDone() }
  var cv = null, g = null, W = 0, H = 0, DPR = 1;
  var I = { srv: null, n: -1, doneN: -1, state: 'ACTIVE', alpha: 0, showVid: false,
    vid: null, vidStatus: 'none', dur: 0, started: false, vidOk: false, playFail: false, endE: null, skipEnd: false, cls: false, drawn: false };

  function video() {
    if (I.vid) return I.vid;
    var v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
    I.vidStatus = 'load';
    v.addEventListener('loadedmetadata', function () { I.dur = isFinite(v.duration) && v.duration > 0 ? Math.min(v.duration, IN.MAXLEN) : 0; });
    v.addEventListener('canplay', function () { if (I.vidStatus === 'load') I.vidStatus = 'ready'; });
    v.addEventListener('playing', function () { I.vidOk = true; I.vidStatus = 'ready'; });
    v.addEventListener('error', function () { I.vidStatus = 'fail'; });
    v.src = SRC; document.body.appendChild(v);
    try { v.load(); } catch (e) {}
    I.vid = v; return v;
  }
  function stopVid(rewind) {
    var v = I.vid; if (!v) return;
    if (!v.paused) try { v.pause(); } catch (e) {}
    if (rewind && v.currentTime > 0) try { v.currentTime = 0; } catch (e) {}
  }
  function playAt(p) {
    var v = I.vid; if (!v) { I.playFail = true; return; }
    if (!I.started) {
      I.started = true; I.vidOk = false;
      try { v.currentTime = p > 0.4 && I.dur ? Math.min(p, I.dur - 0.05) : 0; } catch (e) {}
      try { var pr = v.play(); if (pr && pr.catch) pr.catch(function () { I.playFail = true; }); } catch (e) { I.playFail = true; }
      return;
    }
    // a phone that loaded late catches up with everyone else
    if (I.vidOk && !v.paused && I.dur && p < I.dur - 0.5 && Math.abs(v.currentTime - p) > 0.6) try { v.currentTime = p; } catch (e) {}
  }
  function set(state, alpha, showVid) { I.state = state; I.alpha = alpha; I.showVid = !!showVid; }

  function readServer() {
    var s = O && O.guest && O.guest.state(), it = s && s.intro;
    if (!it || !it.st) { I.srv = null; return; }
    var off = O.guest.now() - Date.now();            // server clock minus ours
    I.srv = { st: it.st, n: it.n | 0, len: typeof it.len === 'number' ? it.len : null, t0: (it.at || 0) - off, playT0: (it.pat || it.at || 0) - off };
  }
  function evaluate() {
    readServer();
    var s = I.srv;
    if (!s) { stopVid(false); set('ACTIVE', 0); return; }
    if (s.st === 'wait') { stopVid(true); I.n = -1; set('IDLE', 1); return; }
    if (s.n !== I.n) { I.n = s.n; I.started = false; I.vidOk = false; I.playFail = false; I.endE = null; I.skipEnd = false; }
    if (I.doneN === s.n) { stopVid(true); set('ACTIVE', 0); return; }
    var e = (Date.now() - s.playT0) / 1000, p = e - IN.PRE, v = I.vid;
    var se = s.st === 'skip' ? Math.max(0, (s.t0 - s.playT0) / 1000) : Infinity;
    var sched = s.len == null ? null : s.len > 0 ? s.len : IN.NOFILM;   // the presenter sends the film length: one schedule for all
    if (s.len === 0) I.playFail = true;
    if (I.endE == null && !I.started && sched != null && e > IN.PRE + sched && e < se) {
      if (e > IN.PRE + sched + IN.BLACK + IN.FADE) { I.doneN = s.n; set('ACTIVE', 0); return; }   // joined long after: just the sky
      I.endE = IN.PRE + sched;
    }
    if (I.endE == null) {
      if (e >= se) { I.endE = Math.max(IN.PRE, se); I.skipEnd = true; }
      else if (e < IN.PRE) { video(); set('PLAYING', e / IN.PRE); return; }
      else if (!v || I.vidStatus === 'fail' || I.playFail) { var hold = sched || IN.NOFILM; if (p >= hold) I.endE = IN.PRE + hold; }
      else {
        playAt(p);
        if (v.ended || (I.dur && p >= I.dur)) I.endE = I.dur ? Math.min(e, IN.PRE + I.dur + 0.2) : e;
        else if (!I.vidOk && p >= IN.WAIT_LOAD) { I.playFail = true; stopVid(false); }
        else if (p >= IN.MAXLEN) I.endE = e;
      }
      if (I.endE == null) { set('PLAYING', 1, I.vidOk && v && v.readyState >= 2); return; }
      stopVid(false);
    }
    var k = e - I.endE, b = I.skipEnd ? IN.SKIPBLACK : IN.BLACK;
    if (k < b) { set('BLACKOUT', 1); return; }
    if (k < b + IN.FADE) { var q = (k - b) / IN.FADE; set('FADING_IN', 1 - q * q * (3 - 2 * q)); return; }
    I.doneN = s.n; stopVid(true); set('ACTIVE', 0);
    if (O.onDone) O.onDone();
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); I.drawn = true;
  }
  function draw() {
    var mode = O.mode(), on = mode !== 'menu' && (I.alpha > 0.001 || I.showVid);
    var cls = on && mode === 'screen';
    if (cls !== I.cls) { I.cls = cls; document.body.classList.toggle('intro-on', cls); }
    if (!on) { if (I.drawn) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); I.drawn = false; } return; }
    I.drawn = true;
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
    if (I.alpha > 0.001) { g.globalAlpha = Math.min(1, I.alpha); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    var eyes;
    if (mode === 'vr') {
      var half = W / 2, sep = Math.min(half * 1.02, O.sep()), R = Math.min(half / 2 + 8, H / 2);   // same layout as engine.js
      eyes = [{ cx: W / 2 - sep / 2, cy: H / 2, R: R, clip: [0, 0, half, H] }, { cx: W / 2 + sep / 2, cy: H / 2, R: R, clip: [half, 0, half, H] }];
    }
    var v = I.vid;
    if (I.showVid && v) {
      var vw = v.videoWidth || 16, vh = v.videoHeight || 9;
      if (eyes) {
        for (var i = 0; i < 2; i++) {          // the same picture in both eyes: no parallax, both go dark together
          var E = eyes[i], w = Math.min(E.R * 2 * 0.96, E.clip[2]), h = w * vh / vw;
          g.save(); g.beginPath(); g.rect(E.clip[0], E.clip[1], E.clip[2], E.clip[3]); g.clip();
          try { g.drawImage(v, E.cx - w / 2, E.cy - h / 2, w, h); } catch (x) {}
          var vg = g.createRadialGradient(E.cx, E.cy, E.R * 0.92, E.cx, E.cy, E.R * 1.25);
          vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
          g.fillStyle = vg; g.fillRect(E.clip[0], E.clip[1], E.clip[2], E.clip[3]);
          g.restore();
        }
      } else {
        var sc = Math.min(W / vw, H / vh), dw = vw * sc, dh = vh * sc;
        try { g.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (x) {}
      }
    }
    if (I.state === 'IDLE') {
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(236,232,222,0.42)';
      var spots = eyes || [{ cx: W / 2, cy: H / 2, R: Math.min(W, H) / 2 }];
      for (var j = 0; j < spots.length; j++) {
        g.font = Math.round(Math.max(13, Math.min(20, spots[j].R / 9))) + 'px "IBM Plex Sans KR", sans-serif';
        g.fillText('잠시 후 시작해요', spots[j].cx, spots[j].cy);
      }
    }
  }
  function tick() { if (O) { evaluate(); draw(); } requestAnimationFrame(tick); }

  return {
    // opts: { guest, mode: fn → 'menu'|'vr'|'screen', sep: fn → px between the eye centres, onDone: fn }
    attach: function (opts) {
      O = opts;
      cv = document.createElement('canvas'); cv.id = 'introLayer'; cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:15;pointer-events:none;display:block';
      document.body.appendChild(cv); g = cv.getContext('2d');
      resize(); window.addEventListener('resize', resize);
      setTimeout(video, 1500);                  // fetch the film early so it is ready when the presenter starts
      requestAnimationFrame(tick);
    },
    // true while the screen is mostly covered: no gaze picking, no look-down settings panel
    covers: function () { return !!O && O.mode() !== 'menu' && I.alpha > 0.5; },
    // call from a tap (entering VR / screen) so stricter phones let the muted film start later on its own
    prime: function () {
      var v = O && video(); if (!v || I.started) return;
      try { var p = v.play(); if (p && p.then) p.then(function () { if (!I.started) { v.pause(); try { v.currentTime = 0; } catch (e) {} } }, function () {}); } catch (e) {}
    },
    state: function () { return { state: I.state, alpha: +I.alpha.toFixed(2), showVid: I.showVid, vid: I.vidStatus }; }
  };
})();
