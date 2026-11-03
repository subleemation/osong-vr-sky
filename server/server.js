// Render services set up with the first blueprint start `node server.js` inside server/; the server now lives in server.mjs.
import('./server.mjs').catch((e) => { console.error(e); process.exit(1); });
