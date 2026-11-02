// Closing timer on the participant phones (started by the presenter's 마무리 타이머 button).
// While it runs, a small countdown sits at the top of the view; when it ends (or the presenter ends it early)
// the sky dims and "헤드셋을 천천히 벗어 주세요" appears, the same picture in both eyes.
// The presenter sends { timer: { st: 'run', at, dur } | { st: 'done', at } } inside the show state (server clock, ms).
var EndTimer = (function () {
  'use strict';
  var O = null, cv = null, g = null, W = 0, H = 0, DPR = 1, drawn = false, doneAt = 0;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); drawn = true;
  }
  function fmt(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function state() {
    var s = O.guest.state(), t = s && s.timer;
    if (!t || !t.st) return null;
    var now = O.guest.now();
    if (t.st === 'run') { var left = t.at + t.dur - now; return left > 0 ? { run: true, left: left } : { done: true, since: now - (t.at + t.dur) }; }
    return { done: true, since: now - t.at };
  }
  function tick() {
    requestAnimationFrame(tick);
    var mode = O.mode(), x = mode === 'menu' ? null : state();
    if (!x) { if (drawn) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); drawn = false; } return; }
    drawn = true;
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
    var eyes;
    if (mode === 'vr') {
      var half = W / 2, sep = Math.min(half * 1.02, O.sep()), R = Math.min(half / 2 + 8, H / 2);   // same layout as engine.js
      eyes = [{ cx: W / 2 - sep / 2, cy: H / 2, R: R }, { cx: W / 2 + sep / 2, cy: H / 2, R: R }];
    } else eyes = [{ cx: W / 2, cy: H / 2, R: Math.min(W, H) / 2 }];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (x.run) {
      for (var i = 0; i < eyes.length; i++) {
        var E = eyes[i], fs = Math.max(13, Math.min(18, E.R / 11)), y = mode === 'vr' ? E.cy - E.R * 0.5 : 26;
        var txt = '자유 관찰 ' + fmt(x.left);
        g.font = '500 ' + Math.round(fs) + 'px "IBM Plex Sans KR", sans-serif';
        var tw = g.measureText(txt).width + fs * 1.4;
        g.fillStyle = 'rgba(7,9,16,0.72)'; g.fillRect(E.cx - tw / 2, y - fs * 0.85, tw, fs * 1.7);
        g.fillStyle = x.left < 30000 ? 'rgba(240,190,140,0.95)' : 'rgba(236,222,196,0.92)';
        g.fillText(txt, E.cx, y);
      }
      return;
    }
    // the end: dim the sky over a second, then the message
    var a = Math.min(1, x.since / 1200);
    g.fillStyle = 'rgba(0,0,0,' + (0.72 * a).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
    for (var j = 0; j < eyes.length; j++) {
      var F = eyes[j], vr = mode === 'vr', f1 = vr ? Math.max(15, Math.min(24, F.R / 8)) : Math.max(16, Math.min(30, F.R / 6.5)), mw = vr ? F.R * 1.4 : W - 32;
      g.globalAlpha = a;
      g.font = '600 ' + Math.round(f1) + 'px "IBM Plex Sans KR", sans-serif'; g.fillStyle = 'rgba(240,232,214,1)';
      if (vr) { g.fillText('헤드셋을 천천히', F.cx, F.cy - f1 * 1.05, mw); g.fillText('벗어 주세요', F.cx, F.cy + f1 * 0.2, mw); }   // two lines fit inside one lens
      else g.fillText('헤드셋을 천천히 벗어 주세요', F.cx, F.cy - f1 * 0.45, mw);
      g.font = Math.round(f1 * 0.6) + 'px "IBM Plex Sans KR", sans-serif'; g.fillStyle = 'rgba(236,222,196,0.7)';
      g.fillText('오늘 함께해 줘서 고마워요', F.cx, F.cy + (vr ? f1 * 1.45 : f1 * 0.75), mw);
      g.globalAlpha = 1;
    }
  }
  return {
    // opts: { guest, mode: fn → 'menu'|'vr'|'screen', sep: fn → px between the eye centres }
    attach: function (opts) {
      O = opts;
      cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:16;pointer-events:none;display:block';
      document.body.appendChild(cv); g = cv.getContext('2d');
      resize(); window.addEventListener('resize', resize);
      requestAnimationFrame(tick);
    },
    state: function () { return O ? state() : null; }
  };
})();
