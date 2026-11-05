// Local stand-in for the Cloudflare deployment, for browser tests and rehearsals:
//   - serves the static site (index.html, admin.html …) over http
//   - runs the real worker.js Room on a WebSocket server with in-memory storage and alarms
// Usage: node tests/e2e/mock-server.mjs [port=8790]   → site http://localhost:8790/  sync ws://localhost:8790
// Presenter password for this local server: the MOCK_ADMIN_KEY env var, or 'test1234'. Never the real one.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { loadRoomClass } from '../helpers/room.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

export async function startMock(port = 8790, adminKey = process.env.MOCK_ADMIN_KEY || 'test1234') {
  const Room = await loadRoomClass();
  const rooms = new Map();
  function getRoom(name) {
    if (rooms.has(name)) return rooms.get(name);
    const store = new Map(), sockets = new Set(); let alarmT = null, room;
    const ctx = {
      storage: {
        get: async (k) => (store.has(k) ? structuredClone(store.get(k)) : undefined),
        put: async (k, v) => { store.set(k, structuredClone(v)); },
        setAlarm: async (t) => { clearTimeout(alarmT); alarmT = setTimeout(() => room.alarm(), Math.max(0, t - Date.now())); },
        deleteAlarm: async () => { clearTimeout(alarmT); },
      },
      setWebSocketAutoResponse() {}, acceptWebSocket(w) { sockets.add(w); }, getWebSockets() { return [...sockets]; },
    };
    room = new Room(ctx, { ADMIN_KEY: adminKey }); room._sockets = sockets; room._store = store;
    rooms.set(name, room); return room;
  }
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let f = path.normalize(path.join(root, decodeURIComponent(u.pathname)));
    if (!f.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (f.endsWith(path.sep)) f = path.join(f, 'index.html');
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(data);
    });
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', async (ws, req) => {
    const u = new URL(req.url, 'http://x');
    const name = (u.searchParams.get('room') || 'main').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'main';
    const room = getRoom(name);
    const w = {
      send(d) { if (ws.readyState === 1) ws.send(d); }, close() { try { ws.close(); } catch (e) {} },
      serializeAttachment(a) { this._a = structuredClone(a); }, deserializeAttachment() { return this._a ? structuredClone(this._a) : null; },
    };
    // messages are handled one at a time, like a Durable Object's input gate
    let chain = Promise.resolve();
    const run = (fn) => { chain = chain.then(fn).catch((e) => console.error(e)); return chain; };
    run(async () => {
      globalThis.WebSocketPair = class { constructor() { return { 0: {}, 1: w }; } };
      const savedResp = globalThis.Response; globalThis.Response = class { constructor(b, o) { this.o = o; } };
      try { await room.fetch({ url: 'https://x' + req.url }); } finally { globalThis.Response = savedResp; }
    });
    ws.on('message', (d) => { const t = d.toString(); if (t === 'ping') { ws.send('pong'); return; } run(() => room.webSocketMessage(w, t)); });
    ws.on('close', () => run(async () => { room._sockets.delete(w); await room.webSocketClose(w); }));
    w.kill = () => ws.terminate();   // tests: cut a phone off without a clean close
  });
  await new Promise((r) => server.listen(port, r));
  return { port, rooms, close: () => new Promise((r) => { wss.close(); server.close(r); }) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = +process.argv[2] || 8790;
  await startMock(port);
  console.log(`site: http://localhost:${port}/   presenter: http://localhost:${port}/admin.html?r=test&server=ws://localhost:${port}`);
  console.log(`phone: http://localhost:${port}/?r=test&server=ws://localhost:${port}`);
}
