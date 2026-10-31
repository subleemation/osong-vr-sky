// Presenter's "CCTV" wall: small live snapshots of every participant's screen (sent by js/phonecam.js).
// The first presenter page to open a room's wall gets a key (kept in this browser), so other pages can't watch.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var URL_ = 'wss://osong-vr-sync.lrwe36.workers.dev/ws';
  var q = new URLSearchParams(location.search), o = q.get('cam');
  if (o && /^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) URL_ = o + '/ws';
  var MODE = { vr: 'VR', screen: '화면', menu: '메뉴' };
  var ws = null, room = '', retry = 1000, tiles = {}, order = 0, denied = false;

  function keyName() { return 'osongvr-cctvkey-' + room; }
  function connect() {
    if (!room) return;
    var my; try { my = ws = new WebSocket(URL_ + '?room=cc' + room); } catch (e) { setTimeout(connect, 5000); return; }
    my.onopen = function () { retry = 1000; var k = null; try { k = localStorage.getItem(keyName()); } catch (e) {} my.send(JSON.stringify({ k: 'watch', key: k })); };
    my.onmessage = function (e) {
      if (my !== ws) return;
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.k === 'watchok') { denied = false; try { localStorage.setItem(keyName(), m.key); } catch (x) {} render(); }
      else if (m.k === 'watchdeny') { denied = true; render(); }
      else if (m.k === 'cam') show(m);
      else if (m.k === 'camgone') drop(m.id);
    };
    my.onclose = function () { if (my !== ws) return; setTimeout(connect, retry); retry = Math.min(retry * 2, 15000); };
    my.onerror = function () { try { my.close(); } catch (x) {} };
  }
  function setRoom(r) {
    r = String(r || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!r || r === room) return;
    room = r;
    for (var id in tiles) tiles[id].el.remove();
    tiles = {}; order = 0;
    var old = ws; ws = null; if (old) try { old.close(); } catch (e) {}
    connect(); render();
  }
  function show(m) {
    var t = tiles[m.id];
    if (!t) {
      var el = document.createElement('figure'); el.className = 'cam';
      el.innerHTML = '<img alt=""><figcaption><b></b><span></span><em></em></figcaption>';
      t = tiles[m.id] = { el: el, n: ++order, at: 0 };
      el.querySelector('b').textContent = t.n;
      $('cctvGrid').appendChild(el);
    }
    t.at = Date.now();
    t.el.querySelector('img').src = m.img;
    t.el.querySelector('span').textContent = (MODE[m.m] || m.m || '') + (m.m !== 'menu' && m.d ? ' · ' + m.d : '');
    t.el.querySelector('em').textContent = m.s || '';
    t.el.classList.remove('stale');
    render();
  }
  function drop(id) { var t = tiles[id]; if (t) { t.el.remove(); delete tiles[id]; render(); } }
  function render() {
    var n = Object.keys(tiles).length;
    $('cctvCount').textContent = n + '대';
    $('cctvWallCount').textContent = n + '대';
    $('cctvEmpty').hidden = n > 0;
    $('cctvEmpty').textContent = denied ? '이 방의 화면은 다른 노트북에서 보고 있어요. 새 방 코드를 만들면 여기서 볼 수 있어요.' : '휴대폰이 들어오면 여기에 화면이 떠요.';
  }
  setInterval(function () {
    var now = Date.now();
    for (var id in tiles) {
      var age = now - tiles[id].at;
      if (age > 30000) drop(id);
      else tiles[id].el.classList.toggle('stale', age > 6000);
    }
  }, 1000);

  // big wall: the same grid moves into a full-screen layer
  function wall(on) {
    $('cctvWall').hidden = !on;
    (on ? $('cctvWallBody') : $('cctvHome')).appendChild($('cctvGrid'));
    $('cctvGrid').classList.toggle('big', on);
  }
  $('cctvBig').addEventListener('click', function () { wall(true); });
  $('cctvClose').addEventListener('click', function () { wall(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('cctvWall').hidden) wall(false); });

  // follow the room code the console shows (it can change with 새 방 코드)
  var rc = $('roomCode');
  setRoom(rc.textContent);
  new MutationObserver(function () { setRoom(rc.textContent); }).observe(rc, { childList: true, characterData: true, subtree: true });
})();
