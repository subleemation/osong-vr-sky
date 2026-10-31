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

const FRESH = () => ({ phase: 'idle', time: 90, timeAt: Date.now(), speed: 0, spot: null, note: '', hold: false, timer: null, plan: null });

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async load() { return (await this.ctx.storage.get('s')) || FRESH(); }
  async save(s) { await this.ctx.storage.put('s', s); }

  minutes(s) {
    let m = s.time + ((Date.now() - s.timeAt) / 60000) * s.speed;
    if (m > 180) m = 30 + ((m - 30) % 150);
    return m;
  }
  pack(s, admin) {
    const tm = s.timer;
    const out = {
      k: 'state', phase: s.phase, time: this.minutes(s), speed: s.speed, spot: s.spot, note: s.note, hold: s.hold,
      timer: tm ? { rem: tm.paused ? tm.rem : Math.max(0, tm.end - Date.now()), total: tm.total, label: tm.label, paused: !!tm.paused } : null,
      plan: s.plan ? { order: s.plan.order, i: s.plan.i, n: s.plan.steps.length, label: s.plan.steps[s.plan.i].l } : null,
      view: this.view || s.view || null,
      art: typeof s.art === 'boolean' ? s.art : null,
      story: s.story ? { show: s.story.show, i: s.story.i, el: Date.now() - s.story.at } : null,
      intro: s.intro ? { st: s.intro.st, n: s.intro.n, len: s.intro.len, el: Date.now() - s.intro.at, pel: Date.now() - (s.intro.pat || s.intro.at) } : null,
    };
    return JSON.stringify(out);
  }
  broadcast(s) {
    const msg = this.pack(s);
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(msg); } catch (e) {} }
  }
  counts() {
    let phones = 0, vr = 0, admins = 0, film = 0, filmFail = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() || {};
      if (a.role === 'admin') admins++;
      else if (a.mode === 'host' || a.mode === 'sim') continue; // host's own sky view and preview pages are not participants
      else { phones++; if (a.mode === 'vr') vr++; if (a.vid === 'ready') film++; else if (a.vid === 'fail') filmFail++; }
    }
    return { k: 'counts', phones, vr, admins, film, filmFail };
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
    server.send(this.pack(s));
    this.pushCounts();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.k !== 'string') return;
    const att = ws.deserializeAttachment() || { role: 'phone', mode: 'menu' };
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
      case 'stop': s.plan = null; s.phase = 'idle'; s.timer = null; s.spot = null; s.hold = false; s.note = ''; s.view = null; this.view = null; s.art = null; s.story = null; s.intro = null; break;
      case 'intro': {
        // opening film: wait (everyone black) → play → (skip) ; phones run the timeline themselves from 'at'
        const cur = s.intro, n = ((cur && cur.n) || 0) + 1;
        if (m.v === 'play') {
          if (cur && cur.st === 'play' && now - cur.at < 2500) break;          // double clicks
          s.intro = { st: 'play', n, at: now, pat: now, len: this.clip(m.len, 0, 60, 0) }; s.hold = false;
        } else if (m.v === 'skip') {
          if (cur && cur.st === 'play' && now - cur.at < 70000) s.intro = { st: 'skip', n: cur.n, at: now, pat: cur.pat, len: cur.len };
        } else if (m.v === 'wait') {
          s.plan = null; s.phase = 'idle'; s.timer = null; s.spot = null; s.hold = false; s.note = ''; s.view = null; this.view = null; s.art = null; s.story = null;
          s.intro = { st: 'wait', n, at: now, pat: now };
        } else if (m.v === 'off') s.intro = null;
        break;
      }
      case 'pause': if (s.timer) { if (s.timer.paused) { s.timer.paused = false; s.timer.end = now + s.timer.rem; } else { s.timer.rem = Math.max(0, s.timer.end - now); s.timer.paused = true; } } break;
      case 'phase': if (!s.plan && (m.v === 'guide' || m.v === 'free')) { s.phase = m.v; if (m.v === 'free') s.spot = null; } break;
      case 'spot': s.spot = typeof m.v === 'string' ? m.v.slice(0, 12) : null; if (s.spot && !s.plan && s.phase !== 'guide') s.phase = 'guide'; break;
      case 'time': s.time = this.clip(m.v, 30, 180, 90); s.timeAt = now; break;
      case 'speed': s.time = this.minutes(s); s.timeAt = now; s.speed = [0, 1, 60].includes(Number(m.v)) ? Number(m.v) : 0; break;
      case 'timer': if (!s.plan) { this.setTimer(s, this.clip(m.min, 0, 180, 0) * 60000, String(m.label || '').slice(0, 12), 'manual'); if (s.timer && s.phase === 'idle') s.phase = 'free'; } break;
      case 'note': s.note = String(m.v || '').slice(0, 40); if (s.phase === 'idle') s.phase = 'free'; break;
      case 'hold': s.hold = !!m.v; if (s.hold) s.note = String(m.note || '헤드셋을 벗고 앞을 봐 주세요').slice(0, 40); if (s.phase === 'idle') s.phase = 'free'; break;
      case 'art': s.art = typeof m.v === 'boolean' ? m.v : null; break;
      case 'story': s.story = typeof m.show === 'string' && m.show ? { show: m.show.slice(0, 24), i: this.clip(m.i, 0, 99, 0) | 0, at: now } : null; if (s.story) s.hold = false; break;
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
      else { s.timer = null; s.note = '시간이 끝났어요'; }
      await this.save(s); await this.arm(s); this.broadcast(s);
    }
  }

  async webSocketClose(ws) { try { ws.close(); } catch (e) {} this.pushCounts(); }
  async webSocketError() { this.pushCounts(); }
}
