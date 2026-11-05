// In-process test harness for the Durable Object in worker.js: in-memory storage, alarms and sockets,
// so the real Room logic can be driven from node:test without Cloudflare or a network.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

globalThis.WebSocketRequestResponsePair ??= class { constructor(a, b) { this.a = a; this.b = b; } };
let pending = null;
globalThis.WebSocketPair = class { constructor() { return { 0: {}, 1: pending }; } };
// Node's Response refuses status 101, so the harness uses a stand-in
const FakeResponse = class { constructor(body, init) { this.body = body; this.init = init; } };

export const ADMIN_KEY = 'test-key-123';

export async function loadRoomClass() {
  const saved = globalThis.Response; globalThis.Response = FakeResponse;
  const mod = await import(pathToFileURL(path.join(root, 'worker.js')).href);
  globalThis.Response = saved;
  return mod.Room;
}

export async function makeRoom({ adminKey = ADMIN_KEY } = {}) {
  const Room = await loadRoomClass();
  const store = new Map(), sockets = new Set();
  const ctx = {
    storage: {
      get: async (k) => (store.has(k) ? structuredClone(store.get(k)) : undefined),
      put: async (k, v) => { store.set(k, structuredClone(v)); },
      setAlarm: async () => {}, deleteAlarm: async () => {},
    },
    setWebSocketAutoResponse() {}, acceptWebSocket(w) { sockets.add(w); }, getWebSockets() { return [...sockets]; },
  };
  const env = adminKey ? { ADMIN_KEY: adminKey } : {};
  let room = new Room(ctx, env);
  const api = {
    store,
    get room() { return room; },
    // a fresh object, as after the Durable Object was evicted and woke up again (in-memory fields are gone)
    wake() { room = new Room(ctx, env); },
    async connect(query = '') {
      const sock = {
        msgs: [], open: true, _a: null,
        send(d) { this.msgs.push(typeof d === 'string' ? JSON.parse(d) : d); },
        close() { this.open = false; },
        serializeAttachment(a) { this._a = structuredClone(a); },
        deserializeAttachment() { return this._a ? structuredClone(this._a) : null; },
        last(k) { for (let i = this.msgs.length - 1; i >= 0; i--) if (this.msgs[i].k === k) return this.msgs[i]; return null; },
        all(k) { return this.msgs.filter((m) => m.k === k); },
        async msg(o) { await room.webSocketMessage(this, JSON.stringify(o)); },
        async drop() { sockets.delete(this); await room.webSocketClose(this); },
      };
      pending = sock;
      const saved = globalThis.Response; globalThis.Response = FakeResponse;
      try { await room.fetch({ url: 'https://x/ws?room=t' + (query ? '&' + query : '') }); } finally { globalThis.Response = saved; }
      return sock;
    },
    async admin() { const a = await api.connect('as=admin'); await a.msg({ k: 'auth', key: adminKey }); return a; },
    async phone(pid, mode = 'vr') { const p = await api.connect(); await p.msg({ k: 'hi', m: mode, v: 'none', pid }); return p; },
    state() { return store.get('s'); },
  };
  return api;
}
