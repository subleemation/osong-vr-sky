// Sync server (worker.js Room) — quiz lifecycle, answer persistence, presenter-only screen viewing, story pause.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom, ADMIN_KEY } from './helpers/room.mjs';

const CHOICE = { type: 'choice', q: '질문', opts: ['가', '나', '다'], ans: 1 };
const counts = (admin) => admin.last('counts');

test('an answer to a closed quiz never counts for the next quiz', async () => {
  const r = await makeRoom(); const admin = await r.admin(); const p = await r.phone('phoneaaa1');
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE });
  const n1 = r.state().quiz.n;
  await p.msg({ k: 'ans', n: n1, a: 2, pid: 'phoneaaa1' });
  assert.equal(counts(admin).quiz.answered, 1);
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'off' });
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE });
  const n2 = r.state().quiz.n;
  assert.notEqual(n2, n1);
  assert.equal(counts(admin).quiz.n, n2);
  assert.equal(counts(admin).quiz.answered, 0);
  await p.msg({ k: 'ans', n: n1, a: 0, pid: 'phoneaaa1' }); // a stale answer for the old number
  assert.equal(counts(admin).quiz.answered, 0);
});

test('quiz numbers keep growing across reset and 체험 초기화 (intro wait)', async () => {
  const r = await makeRoom(); const admin = await r.admin();
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE }); const a = r.state().quiz.n;
  await admin.msg({ k: 'cmd', c: 'reset' });
  assert.equal(r.state().quiz, null);
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE }); const b = r.state().quiz.n;
  await admin.msg({ k: 'cmd', c: 'intro', v: 'wait' });
  assert.equal(r.state().quiz, null, '체험 초기화 closes an open quiz');
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE }); const c = r.state().quiz.n;
  assert.ok(a < b && b < c, `${a} < ${b} < ${c}`);
});

test('answers survive a dropped connection and come back to the same phone', async () => {
  const r = await makeRoom(); const admin = await r.admin(); let p = await r.phone('phonebbb2');
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE });
  const n = r.state().quiz.n;
  await p.msg({ k: 'ans', n, a: 1, pid: 'phonebbb2' });
  assert.deepEqual(p.last('ansok'), { k: 'ansok', n, a: 1 });
  await p.drop();
  assert.equal(counts(admin).quiz.answered, 1, 'still counted while the phone is away');
  assert.equal(counts(admin).phones, 0);
  r.wake(); // the Durable Object went to sleep in between
  p = await r.phone('phonebbb2');
  assert.deepEqual(p.last('myans'), { k: 'myans', n, a: 1 });
  const other = await r.phone('phoneccc3');
  assert.equal(other.last('myans'), null, 'a different phone gets nothing back');
});

test('changing an answer replaces it; one count per participant', async () => {
  const r = await makeRoom(); const admin = await r.admin(); const p = await r.phone('phoneddd4');
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE }); const n = r.state().quiz.n;
  await p.msg({ k: 'ans', n, a: 0, pid: 'phoneddd4' });
  await p.msg({ k: 'ans', n, a: 2, pid: 'phoneddd4' });
  assert.equal(counts(admin).quiz.answered, 1);
  assert.deepEqual(counts(admin).quiz.tally, { 2: 1 });
});

test('the tally stays visible during the reveal, even when a phone joins then', async () => {
  const r = await makeRoom(); const admin = await r.admin(); const p = await r.phone('phoneeee5');
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE }); const n = r.state().quiz.n;
  await p.msg({ k: 'ans', n, a: 1, pid: 'phoneeee5' });
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'reveal' });
  r.wake();
  await r.phone('phonefff6');
  assert.equal(counts(admin).quiz.answered, 1);
  const late = await r.phone('phoneggg7');
  await late.msg({ k: 'ans', n, a: 0, pid: 'phoneggg7' });
  assert.equal(counts(admin).quiz.answered, 1, 'answers after the reveal are not counted');
  assert.equal(late.last('ansok').a, null);
});

test('answers without a participant id or from presenter sockets are ignored', async () => {
  const r = await makeRoom(); const admin = await r.admin();
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE }); const n = r.state().quiz.n;
  const anon = await r.connect(); await anon.msg({ k: 'ans', n, a: 1 });
  await admin.msg({ k: 'ans', n, a: 1, pid: 'adminxxx' });
  assert.equal(counts(admin).quiz.answered, 0);
});

test('participant screens only go to a socket that proved the presenter password', async () => {
  const r = await makeRoom(); const admin = await r.admin();
  const thief = await r.connect(); await thief.msg({ k: 'watch', key: 'guess' });
  assert.ok(thief.last('watchdeny'));
  const wall = await r.connect('as=watch'); await wall.msg({ k: 'watch', key: ADMIN_KEY });
  assert.ok(wall.last('watchok'));
  const p = await r.phone('phonehhh8');
  await p.msg({ k: 'cam', id: 'abc', img: 'data:image/jpeg;base64,AAAA', m: 'vr', d: '북', s: '' });
  assert.equal(wall.all('cam').length, 1);
  assert.equal(thief.all('cam').length, 0);
  assert.equal(counts(admin).phones, 2, 'the thief socket is a phone; the wall and the admin are not');
});

test('a presenter page is not counted as a phone while it is still on the login screen', async () => {
  const r = await makeRoom(); const admin = await r.admin();
  await r.connect('as=admin'); await r.connect('as=watch');
  assert.equal(counts(admin).phones, 0);
});

test('no screen viewing at all when the server has no presenter password', async () => {
  const r = await makeRoom({ adminKey: '' });
  const w = await r.connect('as=watch'); await w.msg({ k: 'watch', key: '' });
  assert.ok(w.last('watchdeny'));
});

test('story pause freezes the scene clock and resume continues from the same point', async () => {
  const r = await makeRoom(); const admin = await r.admin(); const p = await r.phone('phoneiii9');
  await admin.msg({ k: 'cmd', c: 'story', show: 'autumn13', i: 2, sky: false });
  r.store.get('s').story.at -= 5000; // 5 s into the scene
  await admin.msg({ k: 'cmd', c: 'storypause', v: true });
  const s1 = p.last('state').story;
  assert.equal(s1.paused, true);
  assert.ok(s1.el >= 5000 && s1.el < 5600);
  await new Promise((res) => setTimeout(res, 60));
  await admin.msg({ k: 'cmd', c: 'time', v: 100 }); // any other command rebroadcasts
  assert.equal(p.last('state').story.el, s1.el, 'elapsed time does not move while paused');
  await admin.msg({ k: 'cmd', c: 'storypause', v: false });
  const s2 = p.last('state').story;
  assert.equal(s2.paused, false);
  assert.ok(s2.el >= s1.el && s2.el < s1.el + 200);
});

test('a quiz pauses the story and closing it resumes; a new scene closes the quiz', async () => {
  const r = await makeRoom(); const admin = await r.admin();
  await admin.msg({ k: 'cmd', c: 'story', show: 'autumn13', i: 0 });
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE });
  assert.ok(r.state().story.paused && r.state().story.paused.why === 'quiz');
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'off' });
  assert.equal(r.state().story.paused, null);
  // a pause the presenter made is not undone by closing a quiz
  await admin.msg({ k: 'cmd', c: 'storypause', v: true });
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE });
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'off' });
  assert.ok(r.state().story.paused);
  // moving to another scene closes an open quiz and starts the scene running
  await admin.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE });
  await admin.msg({ k: 'cmd', c: 'story', show: 'autumn13', i: 1 });
  assert.equal(r.state().quiz, null);
  assert.equal(r.state().story.paused, null);
});

test('only the presenter can send commands', async () => {
  const r = await makeRoom(); const p = await r.phone('phonejjj0');
  await p.msg({ k: 'cmd', c: 'quiz', v: 'open', q: CHOICE });
  assert.equal(r.state(), undefined);
  await p.msg({ k: 'auth', key: 'nope' });
  assert.equal(p.last('authfail').configured, true);
});
