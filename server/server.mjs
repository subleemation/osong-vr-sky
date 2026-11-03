// 별이 빛나는 밤에 VR — 동기화 서버를 Render(Node)에서 돌리기.
// worker.js(Cloudflare Worker + Durable Object)의 Room 코드를 그대로 쓰고, Durable Object가 주는 것들
// (방마다 하나인 객체, 소켓 목록과 첨부 데이터, 저장소, 알람)만 여기서 흉내 내요. 서버 로직은 worker.js 한 곳에만 있어요.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = +process.env.PORT || 8787;
const ALLOWED = [/^https:\/\/[a-z0-9-]+\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

// what worker.js expects from the Workers runtime
globalThis.WebSocketRequestResponsePair = class { constructor(request, response) { this.request = request; this.response = response; } };
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'worker.js'), 'utf8');
const { Room } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

// one Room per room code, with a Durable Object-like ctx
const rooms = new Map();
function getRoom(id) {
  let r = rooms.get(id);
  if (r) return r;
  const sockets = new Set(), store = new Map();
  let auto = null, alarmT = null;
  const ctx = {
    setWebSocketAutoResponse(pair) { auto = pair; },
    getWebSockets() { return [...sockets]; },
    acceptWebSocket(ws) { sockets.add(ws); },
    storage: {
      async get(k) { return store.has(k) ? structuredClone(store.get(k)) : undefined; },
      async put(k, v) { store.set(k, structuredClone(v)); },
      async setAlarm(t) { clearTimeout(alarmT); alarmT = setTimeout(() => r.room.alarm().catch(console.error), Math.max(0, t - Date.now())); },
      async deleteAlarm() { clearTimeout(alarmT); alarmT = null; }
    }
  };
  r = { room: null, sockets, auto: () => auto, queue: Promise.resolve() };
  r.room = new Room(ctx, process.env);
  rooms.set(id, r);
  return r;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url.startsWith('/healthz')) { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('osong-vr-sync ok');
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  const origin = req.headers.origin;
  if (url.pathname !== '/ws' || (origin && !ALLOWED.some((re) => re.test(origin)))) { socket.destroy(); return; }
  const id = (url.searchParams.get('room') || 'main').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'main';
  wss.handleUpgrade(req, socket, head, (ws) => {
    const r = getRoom(id);
    let att = null;
    ws.serializeAttachment = (o) => { att = o == null ? null : structuredClone(o); };
    ws.deserializeAttachment = () => (att == null ? null : structuredClone(att));
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    // messages of a room run one after another, like a Durable Object
    const run = (fn) => { r.queue = r.queue.then(fn).catch(console.error); };
    run(async () => { // same as Room.fetch(): accept, mark as a phone, send the state
      r.sockets.add(ws);
      ws.serializeAttachment({ role: 'phone', mode: 'menu' });
      const s = await r.room.load();
      r.room.qn = s.quiz ? s.quiz.n : 0;
      ws.send(r.room.pack(s));
      r.room.pushCounts();
    });
    ws.on('message', (buf) => {
      const raw = buf.toString();
      const a = r.auto();
      if (a && raw === a.request) { try { ws.send(a.response); } catch (e) {} return; }
      run(() => r.room.webSocketMessage(ws, raw));
    });
    ws.on('close', () => run(async () => { r.sockets.delete(ws); await r.room.webSocketClose(ws); }));
    ws.on('error', () => run(async () => { r.sockets.delete(ws); await r.room.webSocketError(ws); }));
  });
});

// drop dead connections (phones that went to sleep) so the counts stay right
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; try { ws.ping(); } catch (e) {} }
}, 30000);

server.listen(PORT, () => console.log('osong-vr-sync on :' + PORT));
