// 별이 빛나는 밤에 VR — 동기화 서버 (Cloudflare Worker + Durable Object)
// 폰들은 /ws 로 접속해서 상태를 받기만 하고, 관리자만 비밀번호(ADMIN_KEY)로 명령을 보낼 수 있어요.

const ALLOWED = [/^https:\/\/[a-z0-9-]+\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/ws') return new Response('osong-vr-sync ok', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const origin = req.headers.get('Origin');
    if (origin && !ALLOWED.some((r) => r.test(origin))) return new Response('forbidden origin', { status: 403 });
    const room = (url.searchParams.get('room') || 'main').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'main';
    return env.ROOM.get(env.ROOM.idFromName(room)).fetch(req);
  },
};

function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const FRESH = () => ({ phase: 'idle', time: 90, timeAt: Date.now(), speed: 0, spot: null, note: '', hold: false, timer: null, plan: null, close: null, pin: null, trail: null });

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async load() { return (await this.ctx.storage.get('s')) || FRESH(); }
  async save(s) { await this.ctx.storage.put('s', s); }

  minutes(s) {
    // minutes after 18:00, over the whole night (18:00–06:00); time can run backwards too
    const m = s.time + ((Date.now() - s.timeAt) / 60000) * s.speed;
    return ((m % 720) + 720) % 720;
  }
  pack(s, admin) {
    const tm = s.timer;
    const out = {
      k: 'state', phase: s.phase, time: this.minutes(s), speed: s.speed, spot: s.spot, note: s.note, hold: s.hold,
      timer: tm ? { rem: tm.paused ? tm.rem : Math.max(0, tm.end - Date.now()), total: tm.total, label: tm.label, paused: !!tm.paused, closing: tm.src === 'closing' } : null,
      plan: s.plan ? { order: s.plan.order, i: s.plan.i, n: s.plan.steps.length, label: s.plan.steps[s.plan.i].l } : null,
      view: this.view || s.view || null,
      art: typeof s.art === 'boolean' ? s.art : null,
      story: s.story ? { show: s.story.show, i: s.story.i, el: Date.now() - s.story.at, sky: !!s.story.sky } : null, // sky: on the presenter's night instead of the event night
      sky: s.sky || null,
      disp: s.disp ? Object.fromEntries(Object.entries(s.disp).filter(([k]) => k !== 'trails')) : null, // old rooms may still hold a saved 'trails'
      trail: s.trail ? { h: s.trail.h, el: Date.now() - s.trail.at } : null, // 일주운동: presenter turned the star trails on
      quiz: s.quiz || null,
      intro: s.intro ? { st: s.intro.st, n: s.intro.n, len: s.intro.len, el: Date.now() - s.intro.at, pel: Date.now() - (s.intro.pat || s.intro.at) } : null,
      close: s.close ? { el: Date.now() - s.close.at } : null,
      pin: s.pin || null, // closing free look stays on the story's night: 'event' or 'host'   // closing timer ran out: phones go black with "take the headset off"
    };
    return JSON.stringify(out);
  }
  broadcast(s) {
    const msg = this.pack(s);
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(msg); } catch (e) {} }
  }
  counts() {
    let phones = 0, vr = 0, admins = 0, film = 0, filmFail = 0;
    const quiz = { n: this.qn || 0, answered: 0, tally: {} }; // answers to the open quiz
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() || {};
      if (a.role === 'admin') admins++;
      else if (a.role === 'watch' || a.mode === 'host' || a.mode === 'sim') continue; // the presenter's CCTV wall is not a participant // host's own sky view and preview pages are not participants
      else {
        phones++; if (a.mode === 'vr') vr++; if (a.vid === 'ready') film++; else if (a.vid === 'fail') filmFail++;
        if (a.qa && a.qa.n === this.qn) { quiz.answered++; quiz.tally[a.qa.a] = (quiz.tally[a.qa.a] || 0) + 1; }
      }
    }
    return { k: 'counts', phones, vr, admins, film, filmFail, quiz };
  }
  pushCounts() {
    const c = JSON.stringify(this.counts());
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() || {};
      if (a.role === 'admin') { try { ws.send(c); } catch (e) {} }
    }
  }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role: 'phone', mode: 'menu' });
    const s = await this.load();
    this.qn = s.quiz ? s.quiz.n : 0;
    server.send(this.pack(s));
    this.pushCounts();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.k !== 'string') return;
    const att = ws.deserializeAttachment() || { role: 'phone', mode: 'menu' };
    // ---- participant screens for the presenter (v2 "CCTV"): phones send small JPEG frames, only the room's watcher gets them ----
    if (m.k === 'watch') {
      const now = Date.now(); let wk = await this.ctx.storage.get('wk');
      if (!wk || now - wk.at > 24 * 3600 * 1000 || (typeof m.key === 'string' && safeEq(m.key, wk.key))) {
        if (!wk || !(typeof m.key === 'string' && safeEq(m.key, wk.key))) { wk = { key: crypto.randomUUID().replace(/-/g, ''), at: now }; }
        else wk.at = now;
        await this.ctx.storage.put('wk', wk);
        att.role = 'watch'; ws.serializeAttachment(att);
        ws.send(JSON.stringify({ k: 'watchok', key: wk.key }));
      } else ws.send(JSON.stringify({ k: 'watchdeny' }));
      return;
    }
    if (m.k === 'cam') {
      const now = Date.now();
      if (att.role !== 'phone' || typeof m.img !== 'string' || m.img.length > 60000 || m.img.slice(0, 23) !== 'data:image/jpeg;base64,') return;
      if (att.camAt && now - att.camAt < 700) return;
      att.camAt = now; att.cid = att.cid || String(m.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 12) || Math.random().toString(36).slice(2, 8);
      ws.serializeAttachment(att);
      const out = JSON.stringify({ k: 'cam', id: att.cid, img: m.img, m: String(m.m || '').slice(0, 8), d: String(m.d || '').slice(0, 24), s: String(m.s || '').slice(0, 12), t: now });
      for (const w of this.ctx.getWebSockets()) { const a = w.deserializeAttachment() || {}; if (a.role === 'watch') { try { w.send(out); } catch (e) {} } }
      return;
    }
    if (m.k === 'ans') { // a phone's quiz answer: option index, or 1 for "found it"
      const s = await this.load();
      if (att.role !== 'phone' || !s.quiz || s.quiz.st !== 'open' || m.n !== s.quiz.n) return;
      att.qa = { n: s.quiz.n, a: this.clip(m.a, 0, 3, 0) | 0 }; ws.serializeAttachment(att);
      this.qn = s.quiz.n; this.pushCounts(); return;
    }
    if (m.k === 'hi') {
      att.mode = ['vr', 'screen', 'host', 'sim'].includes(m.m) ? m.m : 'menu';
      att.vid = ['ready', 'load', 'fail', 'none'].includes(m.v) ? m.v : 'none';
      ws.serializeAttachment(att); this.pushCounts(); return;
    }
    if (m.k === 'auth') {
      if (this.env.ADMIN_KEY && safeEq(String(m.key || ''), String(this.env.ADMIN_KEY))) {
        att.role = 'admin'; ws.serializeAttachment(att);
        ws.send(JSON.stringify({ k: 'authok' }));
        const s = await this.load();
        ws.send(this.pack(s)); ws.send(JSON.stringify(this.counts())); this.pushCounts();
      } else {
        ws.send(JSON.stringify({ k: 'authfail', configured: !!this.env.ADMIN_KEY }));
      }
      return;
    }
    if (m.k !== 'cmd' || att.role !== 'admin') return;
    if (m.c === 'view') {
      // live camera from the host's mouse: relay right away, write to storage only when asked (toggle / end of a drag)
      const v = { on: !!m.on, yaw: ((this.clip(m.yaw, -720, 720, 0) % 360) + 360) % 360, pitch: this.clip(m.pitch, -30, 90, 30), fov: this.clip(m.fov, 20, 120, 75) };
      this.view = v;
      const msg = JSON.stringify(Object.assign({ k: 'view' }, v));
      for (const w of this.ctx.getWebSockets()) { try { w.send(msg); } catch (e) {} }
      if (m.persist) {
        const s = await this.load();
        s.view = v;
        if (v.on && s.phase === 'idle') s.phase = 'guide';
        await this.save(s); this.broadcast(s);
      }
      return;
    }
    const s = await this.load();
    await this.apply(s, m);
    await this.save(s);
    await this.arm(s);
    this.broadcast(s);
    if (m.c === 'quiz') this.pushCounts();
  }

  setTimer(s, ms, label, src) {
    s.timer = ms > 0 ? { end: Date.now() + ms, rem: ms, total: ms, label: label || '', paused: false, src: src || 'manual' } : null;
  }
  planEnter(s, i) {
    const st = s.plan.steps[i]; s.plan.i = i;
    s.phase = st.p; s.hold = false; s.note = '';
    if (st.p === 'free') s.spot = null;
    this.setTimer(s, st.m * 60000, '', 'plan');
  }
  planNext(s) {
    if (!s.plan) return;
    if (s.plan.i + 1 < s.plan.steps.length) this.planEnter(s, s.plan.i + 1);
    else { s.phase = 'end'; s.timer = null; s.spot = null; s.hold = false; s.note = '모두 수고했어요!'; s.plan = null; }
  }
  clip(x, a, b, d) { x = Number(x); return Number.isFinite(x) ? Math.max(a, Math.min(b, x)) : d; }

  async apply(s, m) {
    const now = Date.now();
    switch (m.c) {
      case 'planStart': {
        const g = this.clip(m.g, 1, 90, 10), f = this.clip(m.f, 1, 90, 10);
        const steps = m.order === 'FG' ? [{ p: 'free', m: f, l: '자유 관찰' }, { p: 'guide', m: g, l: '설명' }] : [{ p: 'guide', m: g, l: '설명' }, { p: 'free', m: f, l: '자유 관찰' }];
        s.plan = { order: m.order === 'FG' ? 'FG' : 'GF', steps, i: 0 }; this.planEnter(s, 0); break;
      }
      case 'next': this.planNext(s); break;
      case 'stop': s.plan = null; s.phase = 'idle'; s.timer = null; s.spot = null; s.hold = false; s.note = ''; s.view = null; this.view = null; s.art = null; s.story = null; s.intro = null; s.close = null; s.pin = null; break;
      case 'intro': {
        // opening film: wait (everyone black) → play → (skip) ; phones run the timeline themselves from 'at'
        const cur = s.intro, n = ((cur && cur.n) || 0) + 1;
        if (m.v === 'play') {
          if (cur && cur.st === 'play' && now - cur.at < 2500) break;          // double clicks
          s.intro = { st: 'play', n, at: now, pat: now, len: this.clip(m.len, 0, 60, 0) }; s.hold = false;
        } else if (m.v === 'skip') {
          if (cur && cur.st === 'play' && now - cur.at < 70000) s.intro = { st: 'skip', n: cur.n, at: now, pat: cur.pat, len: cur.len };
        } else if (m.v === 'wait') {
          s.plan = null; s.phase = 'idle'; s.timer = null; s.spot = null; s.hold = false; s.note = ''; s.view = null; this.view = null; s.art = null; s.story = null; s.close = null; s.pin = null;
          s.intro = { st: 'wait', n, at: now, pat: now };
        } else if (m.v === 'off') s.intro = null;
        break;
      }
      case 'pause': if (s.timer) { if (s.timer.paused) { s.timer.paused = false; s.timer.end = now + s.timer.rem; } else { s.timer.rem = Math.max(0, s.timer.end - now); s.timer.paused = true; } } break;
      case 'phase': if (!s.plan && (m.v === 'guide' || m.v === 'free')) { s.phase = m.v; if (m.v === 'free') s.spot = null; } break;
      case 'spot': s.spot = typeof m.v === 'string' ? m.v.slice(0, 12) : null; if (s.spot && !s.plan && s.phase !== 'guide') s.phase = 'guide'; break;
      case 'time': s.time = this.clip(m.v, 0, 720, 90); s.timeAt = now; break;
      case 'step': s.time = ((this.minutes(s) + this.clip(m.v, -720, 720, 0)) % 720 + 720) % 720; s.timeAt = now; break; // jump forward / back
      case 'speed': s.time = this.minutes(s); s.timeAt = now; s.speed = [-600, -60, -10, 0, 1, 10, 60, 600].includes(Number(m.v)) ? Number(m.v) : 0; break;
      case 'show': { // what every phone draws: true / false, or null to leave it to each phone
        const keys = ['lines', 'names', 'stars', 'art', 'mw', 'dirs'];   // star trails: the 'trail' command below
        if (!keys.includes(m.key)) break;
        s.disp = Object.assign({}, s.disp); s.disp[m.key] = typeof m.v === 'boolean' ? m.v : undefined;
        if (m.key === 'art') s.art = typeof m.v === 'boolean' ? m.v : null;
        break;
      }
      case 'quiz': { // 'open' a question, 'reveal' the answer, 'off'
        if (m.v === 'open' && m.q && typeof m.q === 'object') {
          const q = m.q, str = (x, n) => String(x || '').slice(0, n);
          const opts = Array.isArray(q.opts) ? q.opts.slice(0, 4).map((o) => str(o, 24)) : [];
          const tg = q.target && typeof q.target === 'object' ? { kind: str(q.target.kind, 6), id: str(q.target.id, 24), name: str(q.target.name, 24) } : null;
          if (q.type === 'choice' && opts.length < 2) break;
          if (q.type === 'find' && !tg) break;
          s.quiz = { n: ((s.quiz && s.quiz.n) || 0) + 1, st: 'open', at: now, type: q.type === 'find' ? 'find' : 'choice', q: str(q.q, 80), opts, ans: this.clip(q.ans, 0, 3, 0) | 0, target: tg, ex: str(q.ex, 140) };
          this.qn = s.quiz.n;
        } else if (m.v === 'reveal' && s.quiz) s.quiz.st = 'reveal';
        else if (m.v === 'off') s.quiz = null;
        break;
      }
      case 'timer': if (!s.plan) { this.setTimer(s, this.clip(m.min, 0, 180, 0) * 60000, String(m.label || '').slice(0, 12), 'manual'); if (s.timer && s.phase === 'idle') s.phase = 'free'; } break;
      case 'note': s.note = String(m.v || '').slice(0, 40); if (s.phase === 'idle') s.phase = 'free'; break;
      case 'hold': s.hold = !!m.v; if (s.hold) s.note = String(m.note || '헤드셋을 벗고 앞을 봐 주세요').slice(0, 40); if (s.phase === 'idle') s.phase = 'free'; break;
      case 'art': s.art = typeof m.v === 'boolean' ? m.v : null; break;
      case 'story': s.story = typeof m.show === 'string' && m.show ? { show: m.show.slice(0, 24), i: this.clip(m.i, 0, 99, 0) | 0, at: now, sky: !!m.sky } : null; if (s.story) { s.hold = false; s.close = null; s.pin = null; s.trail = null; } break;
      case 'closing': { // the last free look: a countdown on every phone, then black with "take the headset off"
        if (m.v === 'run') {
          if (Number.isFinite(Number(m.time))) { s.time = this.clip(m.time, 0, 720, 90); s.timeAt = now; s.speed = 0; } // keep the story's sky
          if (s.story) s.pin = s.story.sky ? 'host' : 'event';
          s.story = null; s.plan = null; s.view = null; this.view = null; s.spot = null; s.hold = false; s.note = ''; s.quiz = null; s.close = null;
          s.phase = 'free'; this.setTimer(s, this.clip(m.min, 0.25, 30, 3) * 60000, '남은 시간', 'closing');
        } else if (m.v === 'done') { if (s.timer && s.timer.src === 'closing') s.timer = null; s.quiz = null; s.close = { at: now }; }
        else if (m.v === 'off') { s.close = null; s.pin = null; if (s.timer && s.timer.src === 'closing') s.timer = null; }
        break;
      }
      case 'sky': { // which evening and place every phone shows outside the story (null = the event night)
        const d = typeof m.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : null;
        const lat = Number(m.lat), lon = Number(m.lon), tz = Number(m.tz);
        s.sky = d && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && Math.abs(tz) <= 14
          ? { date: d, lat, lon, tz, place: String(m.place || '').slice(0, 12), name: String(m.name || '').slice(0, 16) } : null;
        break;
      }
      case 'trail': { const h = Number(m.v); s.trail = [1, 2, 4, 6, 8, 12].includes(h) ? { h, at: now } : null; break; } // 일주운동 on (hours of trail) / off
      case 'reset': Object.assign(s, FRESH()); this.view = null; break;
    }
  }

  async arm(s) {
    if (s.timer && !s.timer.paused) await this.ctx.storage.setAlarm(Math.max(Date.now() + 50, s.timer.end));
    else await this.ctx.storage.deleteAlarm();
  }
  async alarm() {
    const s = await this.load();
    const tm = s.timer;
    if (tm && !tm.paused && tm.end <= Date.now() + 100) {
      if (tm.src === 'plan') this.planNext(s);
      else if (tm.src === 'closing') { s.timer = null; s.close = { at: Date.now() }; }
      else { s.timer = null; s.note = '시간이 끝났어요'; }
      await this.save(s); await this.arm(s); this.broadcast(s);
    }
  }

  async webSocketClose(ws) {
    const a = ws.deserializeAttachment() || {};
    if (a.cid) { const gone = JSON.stringify({ k: 'camgone', id: a.cid }); for (const w of this.ctx.getWebSockets()) { if (w === ws) continue; const b = w.deserializeAttachment() || {}; if (b.role === 'watch') { try { w.send(gone); } catch (e) {} } } }
    try { ws.close(); } catch (e) {} this.pushCounts();
  }
  async webSocketError() { this.pushCounts(); }
}
