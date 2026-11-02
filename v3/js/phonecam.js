// Participant screen for the presenter's "CCTV" wall.
// Every ~1.5 s the phone shrinks what it is drawing (sky + overlays, the left eye in VR) into a small JPEG
// and sends it to the presenter through our Cloudflare relay (room "cc" + room code). Only the sky drawing
// is sent: no camera, no microphone, nothing outside this page. Turn it off with ?nocam=1.
var PhoneCam = (function () {
  'use strict';
  var URL_ = 'wss://osong-vr-sync.lrwe36.workers.dev/ws';
  var EVERY = 1500, W = 320;
  var ws = null, room = null, retry = 1000, last = 0, cv = null, g = null, id = '';
  function open() {
    try { ws = new WebSocket(URL_ + '?room=cc' + room); } catch (e) { setTimeout(open, 5000); return; }
    ws.onopen = function () { retry = 1000; };
    ws.onmessage = function () {};
    ws.onclose = function () { ws = null; setTimeout(open, retry + Math.random() * 500); retry = Math.min(retry * 2, 15000); };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }
  return {
    start: function (roomCode) {
      var q = new URLSearchParams(location.search);
      if (q.has('nocam') || !roomCode) return;
      var o = q.get('cam'); if (o && /^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) URL_ = o + '/ws';
      room = String(roomCode).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
      try { id = sessionStorage.getItem('osongvr-camid') || ''; } catch (e) {}
      if (!id) { id = Math.random().toString(36).slice(2, 8); try { sessionStorage.setItem('osongvr-camid', id); } catch (e) {} }
      cv = document.createElement('canvas'); g = cv.getContext('2d');
      open();
    },
    // call right after the sky is drawn, so the WebGL picture is still there
    frame: function (mode, dirText, state) {
      if (!ws || ws.readyState !== 1 || document.hidden) return;
      var now = performance.now(); if (now - last < EVERY) return; last = now;
      var layers = [document.getElementById('skygl'), document.getElementById('sky'), document.getElementById('introLayer')];
      var base = layers[1]; if (!base || !base.width) return;
      var vr = mode === 'vr', srcW = vr ? 0.5 : 1;
      var H = Math.max(60, Math.round(W * base.height / (base.width * srcW)));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i]; if (!L || !L.width || !L.height || L.style.display === 'none') continue;
        try { g.drawImage(L, 0, 0, L.width * srcW, L.height, 0, 0, W, H); } catch (e) {}
      }
      var img; try { img = cv.toDataURL('image/jpeg', 0.55); } catch (e) { return; }
      try { ws.send(JSON.stringify({ k: 'cam', id: id, img: img, m: mode, d: dirText || '', s: state || '' })); } catch (e) {}
    }
  };
})();
