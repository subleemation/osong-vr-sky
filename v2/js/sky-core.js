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
    var x = Math.max(0, Math.min(n - 1.0001, minutes / 10));
    var i = Math.floor(x), f = x - i;
    var ra0 = p[2 * i], ra1 = p[2 * i + 2], d0 = p[2 * i + 1], d1 = p[2 * i + 3];
    if (ra1 - ra0 > 180) ra1 -= 360;
    if (ra0 - ra1 > 180) ra1 += 360;
    var ra = ra0 + (ra1 - ra0) * f;
    if (ra < 0) ra += 360;
    return [ra, d0 + (d1 - d0) * f];
  }
  return { D2R: D2R, radec2vec: radec2vec, eqjToEnu: eqjToEnu, mul: mul, apply: apply, enuToAltAz: enuToAltAz, bodyRaDec: bodyRaDec };
})();
if (typeof module !== 'undefined') module.exports = SkyCore;
