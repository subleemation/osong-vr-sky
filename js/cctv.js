// Presenter's "CCTV" wall: small live snapshots of every participant's screen (sent by js/app.js every 1.5 s).
// It opens its own connection to the room as a 'watch' socket; the first presenter page to watch a room gets a key
// (kept in this browser), so other pages can't watch the same room. Snapshots are only the sky drawing.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var A = window.__admin; if (!A || !$('cctvGrid')) return;
  var URL_ = A.server(), room = A.room();
  var MODE = { vr: 'VR', screen: '화면', menu: '메뉴' };
  var ws = null, retry = 1000, tiles = {}, order = 0, denied = false;

  function keyName() { return 'osong-cctvkey-' + room; }
  function connect() {
    var my; try { my = ws = new WebSocket(URL_ + '/ws?room=' + room); } catch (e) { setTimeout(connect, 5000); return; }
    my.onopen = function () { retry = 1000; var k = null; try { k = localStorage.getItem(keyName()); } catch (e) {} my.send(JSON.stringify({ k: 'watch', key: k })); };
    my.onmessage = function (e) {
      if (my !== ws || e.data === 'pong') return;
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.k === 'watchok') { denied = false; try { localStorage.setItem(keyName(), m.key); } catch (x) {} render(); }
      else if (m.k === 'watchdeny') { denied = true; render(); }
      else if (m.k === 'cam') show(m);
      else if (m.k === 'camgone') drop(m.id);
    };
    my.onclose = function () { if (my !== ws) return; setTimeout(connect, retry); retry = Math.min(retry * 2, 15000); };
    my.onerror = function () { try { my.close(); } catch (x) {} };
  }
  setInterval(function () { if (ws && ws.readyState === 1) { try { ws.send('ping'); } catch (e) {} } }, 20000);
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
    window.dispatchEvent(new CustomEvent('cctv:frame', { detail: { id: m.id, n: t.n, img: m.img, m: m.m, d: m.d, s: m.s } }));   // js/admin-ui.js mirrors one screen large
  }
  function drop(id) { var t = tiles[id]; if (t) { t.el.remove(); delete tiles[id]; render(); window.dispatchEvent(new CustomEvent('cctv:gone', { detail: { id: id } })); } }
  function render() {
    var n = Object.keys(tiles).length;
    $('cctvCount').textContent = n + '대';
    $('cctvWallCount').textContent = n + '대';
    $('cctvEmpty').hidden = n > 0;
    $('cctvEmpty').textContent = denied ? '이 방의 화면은 다른 노트북에서 보고 있어요. 방 이름을 바꾸면 여기서 볼 수 있어요.' : '휴대폰이 들어오면 여기에 화면이 떠요.';
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
    (on ? $('cctvWallBody') : (window.__cctvHomeOverride && window.__cctvHomeOverride()) || $('cctvHome')).appendChild($('cctvGrid'));
    $('cctvGrid').classList.toggle('big', on);
  }
  $('cctvBig').addEventListener('click', function () { wall(true); });
  $('cctvClose').addEventListener('click', function () { wall(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('cctvWall').hidden) wall(false); });
  window.__cctv = { wall: wall, home: function () { return $('cctvHome'); } };

  render();
  connect();
})();
