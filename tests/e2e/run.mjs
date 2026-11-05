// Browser test: presenter page + phones against the local mock server (tests/e2e/mock-server.mjs).
// Needs Playwright with a Chromium (or set CHROME=/path/to/chrome). Run: npm run test:e2e
// Prints one line per check and exits non-zero if any check failed.
import { startMock } from './mock-server.mjs';

let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) {
  const { createRequire } = await import('node:module');
  ({ chromium } = createRequire(import.meta.url)('playwright'));
}

const PORT = 8790, KEY = 'test1234', ROOM = 'e2e' + Date.now().toString(36);
const BASE = `http://localhost:${PORT}`, SV = `&server=ws://localhost:${PORT}`;
const results = [];
function check(name, ok, info = '') { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 5000) { const t = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t > ms) return v; await sleep(150); } }

// counts wake-lock requests, so the test can see listeners pile up (or not)
const WAKE = `window.__wake = 0; Object.defineProperty(navigator, 'wakeLock', { value: { request: function () { window.__wake++; var l = { released: false, release: function () { l.released = true; return Promise.resolve(); } }; window.__lock = l; return Promise.resolve(l); } } });`;

const mock = await startMock(PORT, KEY);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const errors = [];
try {
  const ctx = await browser.newContext();
  const admin = await ctx.newPage(); await admin.setViewportSize({ width: 1440, height: 900 });
  admin.on('pageerror', (e) => errors.push('admin: ' + e.message));
  await admin.goto(`${BASE}/admin.html?r=${ROOM}${SV}`);
  await admin.fill('#lkey', KEY); await admin.click('#lform button[type=submit]');
  check('presenter logs in', await until(() => admin.evaluate(() => document.getElementById('login').hidden)));
  check('presenter page is not counted as a phone', (await admin.evaluate(() => __admin.counts().phones)) === 0);

  const phone = async (mode, pidName) => {
    const p = await ctx.newPage(); await p.setViewportSize({ width: 844, height: 390 });
    await p.addInitScript(WAKE + `localStorage.setItem('osong-pid', '${pidName}');`);
    p.on('pageerror', (e) => errors.push(pidName + ': ' + e.message));
    await p.goto(`${BASE}/?r=${ROOM}${SV}`);
    return p;
  };
  const a = await phone('screen', 'phonealpha1');
  check('QR participant can pick screen mode', await a.evaluate(() => { const b = document.getElementById('goScreen'); return !!b && b.offsetParent !== null; }));
  check('constellation pictures are not loaded on the menu', await a.evaluate(() => !window.SKY_ART));
  await a.evaluate(() => __sky.enter('screen'));
  const b = await phone('screen', 'phonebeta22'); await b.evaluate(() => __sky.enter('screen'));
  await admin.evaluate(() => { document.getElementById('iStart').click(); });
  await sleep(500); await admin.evaluate(() => document.getElementById('iSkip').click());
  check('two phones counted', await until(() => admin.evaluate(() => __admin.counts().phones === 2)));
  check('constellation pictures load once the sky is shown', await until(() => a.evaluate(() => !!window.SKY_ART), 8000));
  await sleep(1500);
  const art = await a.evaluate(() => __sky.art());
  check('pictures are decoded lazily (only those near the view)', art.total > 0 && art.decoded > 0 && art.decoded < art.total, `${art.decoded}/${art.total} decoded`);

  // ---- wake lock: one request on entering, one again after the page comes back, never one per enter()
  const w0 = await a.evaluate(() => window.__wake);
  for (let i = 0; i < 3; i++) { await a.evaluate(() => { document.getElementById('backBtn').click(); }); await a.evaluate(() => __sky.enter('screen')); }
  await a.evaluate(() => { window.__lock.released = true; window.__wake = 0; document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(200);
  check('wake lock asked again once after returning to the page', (await a.evaluate(() => window.__wake)) === 1, `before: ${w0}, after return: ${await a.evaluate(() => window.__wake)}`);

  // ---- quiz answers survive a dropped connection and a reload
  await admin.evaluate(() => __admin.cmd('quiz', { v: 'open', q: { type: 'choice', q: '테스트 질문', opts: ['하나', '둘', '셋'], ans: 1 } }));
  await until(() => a.evaluate(() => !document.getElementById('quizBox').hidden));
  await a.click('#qzOpts button:nth-child(3)');
  check('answer counted', await until(() => admin.evaluate(() => { const q = __admin.counts().quiz; return q && q.answered === 1 && q.tally[2] === 1; })));
  const room = mock.rooms.get(ROOM);
  const kill = (pid) => { for (const w of room._sockets) if (w._a && w._a.pid === pid) w.kill(); };
  kill('phonealpha1');
  await sleep(300);
  check('answer kept while the phone is disconnected', (await admin.evaluate(() => __admin.counts().quiz.answered)) === 1);
  await a.reload(); await a.bringToFront(); await a.evaluate(() => __sky.enter('screen'));
  check('answer shown again after reload', await until(() => a.evaluate(() => { const x = document.querySelector('#qzOpts button:nth-child(3)'); return !!x && x.getAttribute('aria-pressed') === 'true'; }), 8000));
  // answer made while the connection is down is sent when it comes back
  kill('phonebeta22');
  await sleep(100);
  await b.click('#qzOpts button:nth-child(1)').catch(() => {});
  check('offline answer delivered after reconnect', await until(() => admin.evaluate(() => { const q = __admin.counts().quiz; return q.answered === 2 && q.tally[0] === 1; }), 12000));
  await admin.evaluate(() => __admin.cmd('quiz', { v: 'off' }));
  await admin.evaluate(() => __admin.cmd('quiz', { v: 'open', q: { type: 'choice', q: '두 번째', opts: ['A', 'B'], ans: 0 } }));
  await sleep(800);
  check('old answers do not count for the next quiz', (await admin.evaluate(() => __admin.counts().quiz.answered)) === 0);
  await a.bringToFront(); await sleep(600);
  check('phone does not show the old choice on the new quiz', await a.evaluate(() => ![...document.querySelectorAll('#qzOpts button')].some((x) => x.getAttribute('aria-pressed') === 'true')));
  await admin.evaluate(() => __admin.cmd('quiz', { v: 'off' }));

  // ---- Great Square find quiz: judged on the square
  await admin.evaluate(() => __admin.cmd('time', { v: 90 }));
  await admin.evaluate(() => __admin.cmd('quiz', { v: 'open', q: { type: 'find', q: '대사각형', target: { kind: 'ast', id: 'GSq', name: '가을의 대사각형' } } }));
  const lookAt = (p, ra, dec) => p.evaluate(([ra, dec]) => {
    const C = SkyCore, e = C.apply(__sky.frame().M, C.radec2vec(ra, dec)), aa = C.enuToAltAz(e);
    __sky.st.yaw = aa.az; __sky.st.pitch = aa.alt; return aa;
  }, [ra, dec]);
  await sleep(600);
  await b.bringToFront();
  await lookAt(b, 334.5, 16.0); await sleep(2800); // the middle of the Pegasus figure — outside the square
  check('looking at the Pegasus figure centre (outside the square) does not count', !(await b.evaluate(() => __sky.qz.found)));
  await lookAt(b, 354.6, 21.9); await sleep(2800); // middle of the square
  check('looking inside the Great Square counts', await b.evaluate(() => __sky.qz.found));
  await admin.evaluate(() => __admin.cmd('quiz', { v: 'off' }));

  // ---- horizon: a find quiz whose target is below the horizon cannot be sent
  await admin.evaluate(() => __admin.cmd('time', { v: 690 })); // 05:30 — Saturn has set
  await sleep(1500);
  const sat = await admin.evaluate(() => { const o = [...document.querySelectorAll('#qzSel option')].find((x) => x.textContent.includes('토성')); return o && [o.disabled, o.textContent]; });
  check('below-horizon quiz is marked and disabled in the list', !!sat && sat[0] === true, sat && sat[1]);
  await admin.evaluate(() => { const s = document.getElementById('qzSel'); const o = [...s.options].find((x) => x.textContent.includes('토성')); o.disabled = false; s.value = o.value; document.getElementById('qzOpen').click(); });
  await sleep(600);
  check('below-horizon quiz is refused', !(await admin.evaluate(() => !!__admin.state().quiz)), await admin.evaluate(() => document.getElementById('qzWarn').textContent));
  await admin.evaluate(() => __admin.cmd('time', { v: 90 }));

  // ---- story pause freezes the scene; a quiz during a story pauses it
  await admin.evaluate(() => __admin.storyCmd('autumn13', 0));
  await until(() => a.evaluate(() => !!(__sky.story.ev && __sky.story.ev.i === 0)), 6000);
  await sleep(2500);
  await admin.evaluate(() => document.getElementById('cPause').click());
  await until(() => a.evaluate(() => __sky.sync.story && __sky.sync.story.paused));
  await a.bringToFront(); await sleep(600);   // a page in a background tab does not draw frames
  const m1 = await a.evaluate(() => __sky.story.ev.minutes); await sleep(2000); const m2 = await a.evaluate(() => __sky.story.ev.minutes);
  check('paused story: scene clock stands still on the phone', Math.abs(m1 - m2) < 0.01, `${m1.toFixed(2)} → ${m2.toFixed(2)}`);
  check('presenter shows the pause', (await admin.evaluate(() => document.getElementById('hBig').textContent)).includes('멈춤'));
  await admin.evaluate(() => document.getElementById('cPause').click());
  await sleep(2000);
  const m3 = await a.evaluate(() => __sky.story.ev.minutes);
  check('resumed story moves again', Math.abs(m3 - m2) > 0.05, `${m2.toFixed(2)} → ${m3.toFixed(2)}`);
  await admin.evaluate(() => __admin.cmd('quiz', { v: 'open', q: { type: 'choice', q: '이야기 중 퀴즈', opts: ['A', 'B'], ans: 0 } }));
  check('quiz during a story pauses the story', await until(() => a.evaluate(() => __sky.sync.story && __sky.sync.story.paused && !!__sky.sync.quiz)));
  await admin.evaluate(() => __admin.cmd('quiz', { v: 'off' }));
  check('closing the quiz resumes the story', await until(() => a.evaluate(() => __sky.sync.story && !__sky.sync.story.paused && !__sky.sync.quiz)));
  await admin.evaluate(() => __admin.cmd('quiz', { v: 'open', q: { type: 'choice', q: '다음 장면 전', opts: ['A', 'B'], ans: 0 } }));
  await sleep(500);
  await admin.evaluate(() => __admin.storyCmd('autumn13', 1));
  check('next scene closes the open quiz', await until(() => a.evaluate(() => !__sky.sync.quiz && __sky.sync.story && __sky.sync.story.i === 1)));
  await admin.evaluate(() => __admin.cmd('story', { show: null }));

  // ---- VR gaze panel: staring at a toggle button switches it once, not again and again
  const v = await ctx.newPage(); await v.setViewportSize({ width: 844, height: 390 });
  await v.addInitScript("window.__a = 0; window.__b = 100; setInterval(() => { for (const t of ['deviceorientationabsolute', 'deviceorientation']) window.dispatchEvent(new DeviceOrientationEvent(t, { alpha: window.__a, beta: window.__b, gamma: 0, absolute: true })); }, 30);");
  v.on('pageerror', (e) => errors.push('vr: ' + e.message));
  await v.goto(`${BASE}/`); // alone, no presenter
  await v.click('#goVR'); await sleep(1700); if (await v.isVisible('#gSkip')) await v.click('#gSkip');
  await v.evaluate(() => { window.__b = 45; }); await sleep(600);
  const aimed = await v.evaluate(async () => { // look around the open panel until the gaze rests on the 별자리 그림 toggle
    for (let b = 60; b >= 20; b -= 2) for (let a = 0; a >= -70; a -= 2) {
      window.__a = a; window.__b = b; await new Promise((r) => setTimeout(r, 45));
      if (__sky.panel.open && __sky.panel.id === 'v:art') return [a, b];
    }
    return null;
  });
  if (aimed) {
    const flips = await v.evaluate(async () => { let n = 0, last = __sky.st.show.art; const t = Date.now(); while (Date.now() - t < 4500) { await new Promise((r) => setTimeout(r, 50)); if (__sky.st.show.art !== last) { n++; last = __sky.st.show.art; } } return n; });
    check('VR gaze toggle fires once while you keep looking at it', flips === 1, `${flips} switch(es) in 4.5 s`);
  } else check('VR gaze toggle fires once while you keep looking at it', false, 'could not aim at the button');

  // ---- presenter screen wall
  check('participant screens reach the presenter after login', await until(() => admin.evaluate(() => document.querySelectorAll('#cctvGrid .cam').length >= 2), 8000));
  const thief = await ctx.newPage();
  await thief.goto(`${BASE}/`);
  const denied = await thief.evaluate((sv) => new Promise((res) => { const w = new WebSocket(sv + '/ws?room=' + 'ROOM'.replace('ROOM', location.search) ); w.onopen = () => w.send(JSON.stringify({ k: 'watch', key: 'guess' })); w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.k === 'watchdeny') res(true); if (m.k === 'cam') res(false); }; setTimeout(() => res(null), 3000); }), `ws://localhost:${PORT}`);
  check('screen viewing refused without the presenter password', denied === true);
} finally {
  check('no script errors on any page', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); await mock.close();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
