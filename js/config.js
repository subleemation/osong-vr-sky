// Sync server for phones and the presenter page: the Cloudflare Worker (worker.js). To use a Render server instead
// (server/server.mjs runs the same worker.js on Node) put its wss:// address here. Pages can override it with ?server=ws://localhost:8787
var SYNC_SERVER = 'wss://osong-vr-sync.lrwe36.workers.dev';
