// Show sync through our relay server (server/server.js). Works on LTE and any Wi-Fi: phones never connect to each other.
// The host page sends { show, status:'idle'|'live', scene, sceneStart } and the server passes it to every phone in the room.
// sceneStart is in server time; each page measures its offset to the server clock with ping/pong.
var ShowSync = (function () {
  'use strict';
  var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function makeRoom() {
    var s = '';
    for (var i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
  }
  function serverUrl() {
    var q = new URLSearchParams(location.search).get('sync');
    return q || (typeof SYNC_URL !== 'undefined' ? SYNC_URL : '');
  }
  function httpUrl() { return serverUrl().replace(/^ws/, 'http').replace(/\/$/, '') + '/healthz'; }

  function connect(role, room, on) {
    var ws = null, closed = false, retry = 0, retryTimer = null, pingTimer = null, pings = 0;
    var offset = 0, samples = [], pending = {}, state = null, key = null, status = '';
    try { key = localStorage.getItem('osongvr-hostkey-' + room); } catch (e) {}
    function setStatus(s) { if (s !== status) { status = s; on.status && on.status(s); } }
    function now() { return Date.now() + offset; }
    function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
    function ping() {
      var id = pings++;
      pending[id] = Date.now();
      send({ t: 'ping', id: id });
      clearTimeout(pingTimer);
      pingTimer = setTimeout(ping, pings < 6 ? 600 : 10000); // settle the clock quickly, then keep it fresh
    }
    function open() {
      if (closed) return;
      setStatus(retry ? 'reconnecting' : 'connecting');
      try { ws = new WebSocket(serverUrl()); } catch (e) { schedule(); return; }
      ws.onopen = function () {
        retry = 0;
        send({ t: 'hello', role: role, room: room, key: key });
        pings = 0; ping();
      };
      ws.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'pong') {
          var t0 = pending[m.id]; if (t0 == null) return;
          delete pending[m.id];
          var t1 = Date.now();
          samples.push({ rtt: t1 - t0, off: m.s - (t0 + t1) / 2 });
          if (samples.length > 12) samples.shift();
          offset = samples.reduce(function (a, b) { return b.rtt < a.rtt ? b : a; }).off;
        } else if (m.t === 'welcome') {
          if (!samples.length) offset = m.s - Date.now();
          if (m.key) { key = m.key; try { localStorage.setItem('osongvr-hostkey-' + room, key); } catch (e) {} }
          setStatus('connected');
          if (m.state) { state = m.state; on.state && on.state(state); }
          if (role === 'host' && on.welcome) on.welcome(m.state);
        } else if (m.t === 'state') {
          state = m.state; on.state && on.state(state);
        } else if (m.t === 'count') {
          on.count && on.count(m.n);
        } else if (m.t === 'denied') {
          setStatus('denied'); closed = true; try { ws.close(); } catch (e) {}
        }
      };
      ws.onclose = function () { clearTimeout(pingTimer); if (!closed) schedule(); };
      ws.onerror = function () {};
    }
    function schedule() {
      retry++;
      setStatus('reconnecting');
      clearTimeout(retryTimer);
      retryTimer = setTimeout(open, Math.min(8000, 600 * Math.pow(1.6, retry)));
    }
    // a sleeping free-tier server wakes on a plain HTTP request; fire one first, then open the socket
    if (role === 'host') { setStatus('waking'); fetch(httpUrl(), { cache: 'no-store' }).catch(function () {}).then(open); }
    else open();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !closed && (!ws || ws.readyState > 1)) { retry = 0; clearTimeout(retryTimer); open(); }
    });
    return {
      status: function () { return status; },
      state: function () { return state; },
      now: now,
      send: function (s) { send({ t: 'state', state: s }); },
      close: function () { closed = true; clearTimeout(retryTimer); clearTimeout(pingTimer); if (ws) ws.close(); }
    };
  }

  // presenter side: owns the show state
  function host(room, on) {
    var cur = { show: null, status: 'idle', scene: 0, sceneStart: 0 }, want = null;   // want: the night this console chose
    var link = connect('host', room, {
      status: on.status, count: on.count,
      // after a server restart the room is empty again: put our show state back
      welcome: function (s) {
        if (s && (s.show || s.intro || s.timer || s.date)) { cur = s; on.state && on.state(cur); if (want && cur.date !== want) push({ date: want }); }
        else if (cur.show || cur.intro || cur.timer || want) push(want ? { date: want } : {});
      },
      state: function (s) { cur = s; on.state && on.state(cur); }
    });
    function push(patch) {
      var next = {};
      for (var k in cur) next[k] = cur[k];
      for (var p in patch) next[p] = patch[p];
      cur = next; on.state && on.state(cur);
      link.send({ show: cur.show, status: cur.status, scene: cur.scene, sceneStart: cur.sceneStart, intro: cur.intro || null, timer: cur.timer || null, date: cur.date || null });
    }
    return {
      state: function () { return cur; },
      now: link.now,
      go: function (showId, scene) { push({ show: showId, status: 'live', scene: scene, sceneStart: link.now() }); },
      stop: function () { push({ status: 'idle', scene: 0 }); },
      // opening film: 'play' (start / replay), 'skip', 'wait' (reset: phones go black and the show stops)
      intro: function (v, len) {
        var c = cur.intro, n = ((c && c.n) || 0) + 1, t = link.now();
        if (v === 'play') { if (c && c.st === 'play' && t - c.at < 2500) return; push({ intro: { st: 'play', n: n, at: t, pat: t, len: len || 0 } }); }
        else if (v === 'skip') { if (c && c.st === 'play') push({ intro: { st: 'skip', n: c.n, at: t, pat: c.pat, len: c.len } }); }
        else if (v === 'wait') push({ status: 'idle', scene: 0, intro: { st: 'wait', n: n, at: t, pat: t }, timer: null });
      },
      // closing timer: 'run' (minutes), 'done' (show the take-off message now), 'off' (clear it)
      timer: function (v, min) {
        var t = link.now();
        if (v === 'run') push({ timer: { st: 'run', at: t, dur: Math.round(Math.max(0.25, Math.min(30, +min || 3)) * 60000) } });
        else if (v === 'done') push({ timer: { st: 'done', at: t } });
        else push({ timer: null });
      },
      // the night everyone sees ('YYYY-MM-DD', sky clock = minutes after 18:00 KST of that date)
      date: function (d) { want = d; if (cur.date !== d) push({ date: d }); },
      close: link.close
    };
  }
  // phone side: follows
  function guest(room, on) {
    var link = connect('guest', room, on);
    return {
      status: link.status, state: link.state, now: link.now, close: link.close,
      // { show, scene, t } with t = seconds since the scene started, or null when nothing is playing
      position: function () {
        var s = link.state();
        if (!s || !s.show || s.status !== 'live') return null;
        return { show: s.show, scene: s.scene, t: Math.max(0, (link.now() - s.sceneStart) / 1000) };
      }
    };
  }
  return { host: host, guest: guest, makeRoom: makeRoom, serverUrl: serverUrl };
})();
