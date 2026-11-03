// ---- sky math core (shared by page and tests) ----
var SkyCore = (function () {
  var D2R = Math.PI / 180;
  function radec2vec(ra, dec) {
    var a = ra * D2R, d = dec * D2R, cd = Math.cos(d);
    return [cd * Math.cos(a), cd * Math.sin(a), Math.sin(d)];
  }
  // J2000 equatorial -> local East/North/Up, for minutes since 18:00 KST on 2026-11-01
  function eqjToEnu(S, minutes) {
    var r = S.rot; // astronomy-engine stores column-wise: v' = rot[0][i]x + rot[1][i]y + rot[2][i]z
    var P = [
      [r[0][0], r[1][0], r[2][0]],
      [r[0][1], r[1][1], r[2][1]],
      [r[0][2], r[1][2], r[2][2]]
    ];
    var gast = S.gast0 + (minutes / 60) * 1.00273790935;
    var th = ((gast * 15 + S.lon) % 360) * D2R;
    var c = Math.cos(th), s = Math.sin(th);
    var Rz = [[c, s, 0], [-s, c, 0], [0, 0, 1]];
    var ph = S.lat * D2R, sp = Math.sin(ph), cp = Math.cos(ph);
    var L = [[0, 1, 0], [-sp, 0, cp], [cp, 0, sp]];
    return mul(L, mul(Rz, P));
  }
  function mul(A, B) {
    var C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++)
      C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    return C;
  }
  function apply(M, v) {
    return [
      M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
      M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
      M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]
    ];
  }
  function enuToAltAz(e) {
    var az = Math.atan2(e[0], e[1]) / D2R;
    if (az < 0) az += 360;
    return { alt: Math.asin(Math.max(-1, Math.min(1, e[2]))) / D2R, az: az };
  }
  function bodyRaDec(S, name, minutes) {
    var p = S.planets[name].p, n = p.length / 2;
    var x = Math.max(0, Math.min(n - 1.0001, (minutes - (S.pMin || 0)) / 10)); // the table starts at S.pMin minutes
    var i = Math.floor(x), f = x - i;
    var ra0 = p[2 * i], ra1 = p[2 * i + 2], d0 = p[2 * i + 1], d1 = p[2 * i + 3];
    if (ra1 - ra0 > 180) ra1 -= 360;
    if (ra0 - ra1 > 180) ra1 += 360;
    var ra = ra0 + (ra1 - ra0) * f;
    if (ra < 0) ra += 360;
    return [ra, d0 + (d1 - d0) * f];
  }
  // Re-point the sky at another evening and place with astronomy-engine (vendor/astronomy.browser.min.js).
  // sky: { date: 'YYYY-MM-DD', tz: hours east of UTC, lat, lon }. Minutes still count from 18:00 local time.
  // Rebuilds what js/sky-data.js holds for 2026-11-01 at Osong: precession/nutation, sidereal time at 18:00,
  // and topocentric J2000 positions (with aberration) of the Sun, Moon and planets every 10 minutes from 06:00 to 06:00
  // the next morning (minutes -720 … +720 around 18:00), so any moment of a day can be shown.
  var BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  function setSky(S, sky) {
    var A = typeof Astronomy !== 'undefined' ? Astronomy : null;
    if (!A || !sky) return false;
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sky.date || '');
    if (!d) return false;
    var t0 = Date.UTC(+d[1], +d[2] - 1, +d[3], 18, 0, 0) - (sky.tz || 0) * 3600000;
    var t = new A.AstroTime(new Date(t0)), obs = new A.Observer(sky.lat, sky.lon, 0);
    S.t0ms = t0; S.lat = sky.lat; S.lon = sky.lon; S.pMin = -720;
    S.rot = A.Rotation_EQJ_EQD(t).rot;
    S.gast0 = A.SiderealTime(t);
    var planets = {}; // a new object, so a saved copy of the event night's table stays intact
    BODIES.forEach(function (name) {
      var p = [];
      for (var i = -72; i <= 72; i++) {
        var eq = A.Equator(name, t.AddDays(i * 10 / 1440), obs, false, true);
        p.push(Math.round(eq.ra * 15 * 1000) / 1000, Math.round(eq.dec * 1000) / 1000);
      }
      var mag = name === 'Sun' ? -26.8 : A.Illumination(name, t).mag;
      planets[name] = { p: p, mag: Math.round(mag * 10) / 10 };
    });
    S.planets = planets;
    return true;
  }
  // places offered in the menus (tz: hours east of UTC); 'here' uses the phone's location and clock
  var PLACES = {
    cheongju: { name: '청주', lat: 36.642, lon: 127.489, tz: 9 },
    osong: { name: '오송호수공원', lat: 36.635, lon: 127.325, tz: 9 },
    seoul: { name: '서울', lat: 37.5665, lon: 126.978, tz: 9 },
    jeju: { name: '제주', lat: 33.4996, lon: 126.5312, tz: 9 }
  };
  var EVENT = { date: '2026-11-01', place: 'osong', lat: 36.635, lon: 127.325, tz: 9 }; // the night js/sky-data.js was built for
  // the reference sky: right now in Cheongju. A day runs 06:00 → 06:00, so minutes stay within ±720 of that date's 18:00.
  function refSky(nowMs) {
    var P = PLACES.cheongju, d = new Date(nowMs + P.tz * 3600000);
    if (d.getUTCHours() < 6) d = new Date(d.getTime() - 86400000);
    var date = d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
    return { date: date, place: 'cheongju', name: P.name, lat: P.lat, lon: P.lon, tz: P.tz };
  }
  function minutesAt(sky, nowMs) { // minutes after 18:00 local of the sky's date
    var p = sky.date.split('-');
    return (nowMs - (Date.UTC(+p[0], +p[1] - 1, +p[2], 18, 0, 0) - sky.tz * 3600000)) / 60000;
  }
  function wrapMin(m) { return ((m + 720) % 1440 + 1440) % 1440 - 720; }
  function skyOk(k) {
    return !!(k && /^\d{4}-\d{2}-\d{2}$/.test(k.date) && isFinite(k.lat) && Math.abs(k.lat) <= 90 && isFinite(k.lon) && Math.abs(k.lon) <= 180 && isFinite(k.tz) && Math.abs(k.tz) <= 14);
  }
  return { PLACES: PLACES, EVENT: EVENT, refSky: refSky, minutesAt: minutesAt, wrapMin: wrapMin, skyOk: skyOk, D2R: D2R, radec2vec: radec2vec, eqjToEnu: eqjToEnu, mul: mul, apply: apply, enuToAltAz: enuToAltAz, bodyRaDec: bodyRaDec, setSky: setSky };
})();
if (typeof module !== 'undefined') module.exports = SkyCore;
