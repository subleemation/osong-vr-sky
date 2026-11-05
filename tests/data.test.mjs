// Sky data checks: named stars sit on the right catalog star, every name the shows, quizzes and spots use exists,
// and the prepared find-quizzes are above the horizon on the event night.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
function load(...files) {
  const ctx = { window: {}, module: undefined };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}
const W = load('js/sky-data.js', 'js/sky-core.js', 'story.js', 'quiz.js');
const S = W.SKY, C = W.SkyCore;
const D2R = Math.PI / 180;
const sep = (ra1, de1, ra2, de2) => Math.acos(Math.min(1, Math.sin(de1 * D2R) * Math.sin(de2 * D2R) + Math.cos(de1 * D2R) * Math.cos(de2 * D2R) * Math.cos((ra1 - ra2) * D2R))) / D2R;
const named = new Map(S.named.map(([k, n]) => [n, { ra: S.stars[4 * k], dec: S.stars[4 * k + 1], mag: S.stars[4 * k + 2] }]));
const byShort = (nm) => named.get(nm) || [...named.entries()].find(([n]) => n.split(' ')[0] === nm)?.[1];

// J2000 positions (deg) and V magnitudes of the named stars (Yale Bright Star Catalogue values, rounded)
const REF = {
  '알페라츠': [2.097, 29.091, 2.06], '카프': [2.295, 59.150, 2.27], '알게니브': [3.309, 15.184, 2.83], '셰다르': [10.127, 56.537, 2.24],
  '디프다': [10.897, -17.987, 2.04], '나비': [14.177, 60.717, 2.15], '미라크': [17.433, 35.621, 2.07], '루크바': [21.454, 60.235, 2.68],
  '셰라탄': [28.660, 20.808, 2.64], '알마크': [30.975, 42.330, 2.10], '하말': [31.793, 23.462, 2.01], '북극성': [37.955, 89.264, 1.98],
  '멘카르': [45.570, 4.090, 2.54], '알골': [47.042, 40.956, 2.12], '미르파크': [51.081, 49.861, 1.79], '알키오네': [56.871, 24.105, 2.87],
  '알데바란': [68.980, 16.509, 0.86], '리겔': [78.634, -8.202, 0.13], '카펠라': [79.172, 45.998, 0.08], '엘나트': [81.573, 28.608, 1.65],
  '베텔게우스': [88.793, 7.407, 0.50], '카스토르': [113.650, 31.888, 1.58], '폴룩스': [116.329, 28.026, 1.14], '메라크': [165.460, 56.382, 2.37],
  '두베': [165.932, 61.751, 1.79], '알리오트': [193.507, 55.960, 1.77], '미자르': [200.981, 54.925, 2.23], '알카이드': [206.885, 49.313, 1.86],
  '아크투루스': [213.915, 19.182, -0.05], '코카브': [222.676, 74.156, 2.08], '안타레스': [247.352, -26.432, 1.06], '아트리아': [252.166, -69.028, 1.91],
  '라스알하게': [263.734, 12.560, 2.08], '엘타닌': [269.152, 51.489, 2.23], '직녀성 (베가)': [279.235, 38.784, 0.03], '눈키': [283.816, -26.297, 2.05],
  '알비레오': [292.680, 27.960, 3.05], '견우성 (알타이르)': [297.696, 8.868, 0.77], '사드르': [305.557, 40.257, 2.23], '데네브': [310.358, 45.280, 1.25],
  '알데라민': [319.645, 62.586, 2.45], '에니프': [326.046, 9.875, 2.38], '사달멜리크': [331.446, -0.320, 2.95], '포말하우트': [344.413, -29.622, 1.16],
  '셰아트': [345.944, 28.083, 2.44], '마르카브': [346.190, 15.205, 2.49],
};

test('every named star is attached to the right catalog star (position within 0.2°, magnitude within 0.4)', () => {
  const bad = [];
  for (const [name, [ra, dec, mag]] of Object.entries(REF)) {
    const s = named.get(name);
    if (!s) { bad.push(`${name}: missing`); continue; }
    const d = sep(s.ra, s.dec, ra, dec);
    if (d > 0.2 || Math.abs(s.mag - mag) > 0.4) bad.push(`${name}: catalog ${s.ra},${s.dec} mag ${s.mag} — expected ${ra},${dec} mag ${mag} (${d.toFixed(2)}° off)`);
  }
  assert.deepEqual(bad, []);
  assert.deepEqual([...named.keys()].filter((n) => !(n in REF)), [], 'every named star has a reference entry');
});

test('one name per star, no star with two names', () => {
  const idx = S.named.map(([k]) => k), names = S.named.map(([, n]) => n);
  assert.equal(new Set(idx).size, idx.length);
  assert.equal(new Set(names).size, names.length);
});

test('every star and constellation the shows, quizzes and info cards refer to exists', () => {
  const missing = [], cons = new Set(S.cons.map((c) => c.id.replace(/\d$/, '')));
  for (const show of W.STORY_SHOWS) for (const sc of show.scenes) {
    const tgs = [sc.view && sc.view.target, sc.start && sc.start.target].filter(Boolean);
    for (const tg of tgs) {
      if (tg.star && !byShort(tg.star)) missing.push(`${show.id}: star ${tg.star}`);
      if (tg.cons && !cons.has(tg.cons)) missing.push(`${show.id}: cons ${tg.cons}`);
    }
    for (const f of sc.fx || []) {
      if (f.type === 'pointer') for (const nm of [f.from, f.to]) if (!byShort(nm)) missing.push(`${show.id}: pointer ${nm}`);
      for (const c of f.cons || []) if (!cons.has(c)) missing.push(`${show.id}: fx cons ${c}`);
    }
  }
  for (const q of W.QUIZZES) {
    const t = q.target; if (!t) continue;
    if (t.kind === 'star' && !byShort(t.id)) missing.push(`quiz ${q.id}: ${t.id}`);
    if (t.kind === 'cons' && !cons.has(t.id)) missing.push(`quiz ${q.id}: ${t.id}`);
    if (t.kind === 'body' && !S.planets[t.id]) missing.push(`quiz ${q.id}: ${t.id}`);
    if (t.kind === 'ast' && t.id !== 'GSq') missing.push(`quiz ${q.id}: asterism ${t.id}`);
  }
  for (const f of ['js/app.js', 'js/admin.js']) {
    for (const m of read(f).matchAll(/starV\('([^']+)'\)/g)) if (!named.has(m[1])) missing.push(`${f}: starV ${m[1]}`);
    for (const m of read(f).matchAll(/consV\('([^']+)'\)/g)) if (!cons.has(m[1])) missing.push(`${f}: consV ${m[1]}`);
  }
  const info = read('js/app.js').match(/var STAR_INFO = \{([\s\S]*?)\n  \};/)[1];
  for (const m of info.matchAll(/^\s*'([^']+)':/gm)) if (!named.has(m[1])) missing.push(`STAR_INFO ${m[1]}`);
  assert.deepEqual(missing, []);
});

test('the Great Square asterism corners are the four named stars', () => {
  const app = read('js/app.js');
  const corners = JSON.parse(app.match(/GSq: \{[^}]*corners: (\[\[.*?\]\])/)[1]);
  const names = ['알페라츠', '셰아트', '마르카브', '알게니브'];
  corners.forEach(([ra, dec], i) => { const s = named.get(names[i]); assert.ok(sep(s.ra, s.dec, ra, dec) < 0.05, names[i]); });
});

test('prepared find-quizzes are above the horizon on the event night at 19:30', () => {
  const M = C.eqjToEnu(S, 90), low = [];
  const sq = [[2.097, 29.091], [345.944, 28.083], [346.190, 15.205], [3.309, 15.184]].map(([r, d]) => C.radec2vec(r, d));
  for (const q of W.QUIZZES.filter((x) => x.type === 'find')) {
    const t = q.target; let v = null;
    if (t.kind === 'star') { const s = byShort(t.id); v = C.radec2vec(s.ra, s.dec); }
    if (t.kind === 'cons') { const c = S.cons.find((x) => x.id === t.id); v = C.radec2vec(c.ra, c.dec); }
    if (t.kind === 'body') v = C.radec2vec(...C.bodyRaDec(S, t.id, 90));
    if (t.kind === 'radec') v = C.radec2vec(...t.id.split(',').map(Number));
    if (t.kind === 'ast') { const s = sq.reduce((a, b) => a.map((x, i) => x + b[i]), [0, 0, 0]); const n = Math.hypot(...s); v = s.map((x) => x / n); }
    const alt = C.enuToAltAz(C.apply(M, v)).alt;
    if (!(alt > 5)) low.push(`${q.id} ${alt.toFixed(1)}°`);
  }
  assert.deepEqual(low, []);
});
