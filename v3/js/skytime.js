// Sky clock for any date. js/sky-data.js ships the evening of 2026-11-01 already computed; when another date is
// chosen, this recomputes the date-dependent parts of window.SKY in the browser with astronomy-engine
// (vendor/astronomy.browser.min.js): precession/nutation, sidereal time, and the Sun, Moon and planets.
// The sky clock stays "minutes after 18:00 KST" of that date, so shows, sliders and sync keep working unchanged.
// Stars stay at their J2000 catalogue places (proper motion is ignored, fine for a few centuries either way).
var SkyTime = (function () {
  'use strict';
  var S = window.SKY, A = window.Astronomy;
  var BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  var P0 = -360, STEP = 10, N = 121;          // body samples from 12:00 to 08:00 next morning, every 10 minutes
  var MIN_YEAR = 1700, MAX_YEAR = 2300;
  var listeners = [];
  var obs = A ? new A.Observer(S.lat, S.lon, 30) : null;
  S.date = '2026-11-01'; S.pMin0 = S.pMin0 || 0;   // what js/sky-data.js holds

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function valid(date) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
    if (!m) return false;
    var y = +m[1], mo = +m[2], d = +m[3], t = new Date(Date.UTC(y, mo - 1, d));
    return y >= MIN_YEAR && y <= MAX_YEAR && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
  }
  function base(date) { var p = date.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2], 9, 0); }  // 18:00 KST

  function set(date) {
    if (date === S.date) return true;
    if (!A || !valid(date)) return false;
    var t0 = base(date), planets = {};
    for (var b = 0; b < BODIES.length; b++) {
      var arr = new Array(2 * N);
      for (var i = 0; i < N; i++) {
        var eq = A.Equator(BODIES[b], A.MakeTime(new Date(t0 + (P0 + i * STEP) * 60000)), obs, false, true);
        arr[2 * i] = eq.ra * 15; arr[2 * i + 1] = eq.dec;
      }
      var mag = BODIES[b] === 'Sun' ? -26.7 : A.Illumination(BODIES[b], A.MakeTime(new Date(t0 + 180 * 60000))).mag;
      planets[BODIES[b]] = { p: arr, mag: Math.round(mag * 10) / 10 };
    }
    S.planets = planets; S.pMin0 = P0;
    S.rot = A.Rotation_EQJ_EQD(A.MakeTime(new Date(t0 + 180 * 60000))).rot;
    S.gast0 = A.SiderealTime(A.MakeTime(new Date(t0)));
    S.t0ms = t0; S.date = date;
    for (var k = 0; k < listeners.length; k++) { try { listeners[k](date); } catch (e) {} }
    return true;
  }
  // "tonight" in Korea: before noon still counts as the previous night
  function now() {
    var k = new Date(Date.now() + 9 * 3600000), night = new Date(k.getTime() - 12 * 3600000);
    var date = night.getUTCFullYear() + '-' + pad(night.getUTCMonth() + 1) + '-' + pad(night.getUTCDate());
    return { date: date, minutes: (Date.now() - base(date)) / 60000 };   // minutes after 18:00 KST of that night
  }
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  function label(date) {
    date = date || S.date;
    var p = date.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return p[0] + '.' + p[1] + '.' + p[2] + ' ' + DOW[d.getUTCDay()];
  }
  function shortLabel(date) { var p = (date || S.date).split('-'); return +p[1] + '/' + +p[2]; }
  return {
    ok: !!A, set: set, valid: valid, now: now, label: label, shortLabel: shortLabel,
    date: function () { return S.date; },
    onChange: function (f) { listeners.push(f); },
    MIN: MIN_YEAR + '-01-01', MAX: MAX_YEAR + '-12-31'
  };
})();
