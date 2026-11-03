// Presenter console: moves everyone through the show scene by scene and shows the presenter script.
(function () {
  'use strict';
  var C = SkyCore;
  var $ = function (id) { return document.getElementById(id); };
  var QS = new URLSearchParams(location.search);
  var canvas = $('sky'), stage = canvas.parentNode;
  var eng = SkyEngine(canvas, $('skygl'));

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function clockText(min) {
    var t = 18 * 60 + Math.round(min), h = Math.floor(t / 60) % 24, m = t % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function camFrom(yaw, pitch) {
    var az = yaw * C.D2R, al = pitch * C.D2R;
    var f = [Math.sin(az) * Math.cos(al), Math.cos(az) * Math.cos(al), Math.sin(al)], r = [Math.cos(az), -Math.sin(az), 0];
    return { f: f, r: r, u: cross(r, f) };
  }

  // ---------- room ----------
  var room = (QS.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!room) { try { room = localStorage.getItem('osongvr-room') || ''; } catch (e) {} }
  if (!room) room = ShowSync.makeRoom();
  try { localStorage.setItem('osongvr-room', room); } catch (e) {}

  function joinUrl() {
    var u = new URL('./', location.href);
    u.searchParams.set('room', room);
    if (QS.has('sync')) u.searchParams.set('sync', QS.get('sync'));
    return u.toString();
  }
  function qrSvg(text) {
    var q = qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }
  function renderJoin() {
    var url = joinUrl();
    $('roomCode').textContent = room; $('qrBigRoom').textContent = room;
    $('joinUrl').textContent = url; $('qrBigUrl').textContent = url;
    $('qr').innerHTML = qrSvg(url); $('qrBigCode').innerHTML = qrSvg(url);
  }
  renderJoin();

  var PEER_TEXT = {
    waking: '동기화 서버를 깨우는 중이에요 (처음엔 최대 1분)', connecting: '동기화 서버에 연결하는 중',
    connected: '준비됐어요. 휴대폰이 접속할 수 있어요.', reconnecting: '서버 연결이 끊겨 다시 잇는 중',
    denied: '이 방은 다른 노트북이 진행 중이에요. 새 방 코드를 만드세요.'
  };
  function setPeer(s) {
    $('peerState').dataset.state = s === 'connected' ? 'ready' : s === 'denied' ? 'error' : 'connecting';
    $('peerText').textContent = PEER_TEXT[s] || s;
  }
  var hub = null, cur = { show: null, status: 'idle', scene: 0, sceneStart: 0 };
  function openHub() {
    if (hub) hub.close();
    hub = ShowSync.host(room, {
      status: setPeer,
      count: function (n) { $('count').textContent = n; },
      state: function (s) { cur = s; if (s.show && $('showSel').value !== s.show) { $('showSel').value = s.show; buildSteps(); } }
    });
    if (skyDate) hub.date(skyDate);   // phones follow this console's night
  }
  // ---------- the night everyone sees (js/skytime.js) ----------
  var skyDate = null;
  function dateRender() {
    var n = window.SkyTime ? SkyTime.now() : null;
    $('dateState').textContent = window.SkyTime ? SkyTime.label(window.SKY.date) + (n && n.date === window.SKY.date ? ' · 오늘 밤' : '') : '';
    if ($('hostDate').value !== window.SKY.date) $('hostDate').value = window.SKY.date;
    $('metaDate').textContent = window.SKY.date.replace(/-/g, '.');
  }
  function chooseDate(d, quiet) {
    if (!window.SkyTime || !SkyTime.set(d)) { dateRender(); return false; }
    skyDate = d; try { localStorage.setItem('osongvr-skydate', d); } catch (e) {}
    if (hub) hub.date(d);
    dateRender(); return true;
  }
  if (window.SkyTime && SkyTime.ok) {
    $('hostDate').min = SkyTime.MIN; $('hostDate').max = SkyTime.MAX;
    var saved = null; try { saved = localStorage.getItem('osongvr-skydate'); } catch (e) {}
    chooseDate(saved && SkyTime.valid(saved) ? saved : SkyTime.now().date);
    $('hostDate').addEventListener('change', function () { chooseDate(this.value); });
    $('hostToday').addEventListener('click', function () { chooseDate(SkyTime.now().date); });
  } else {
    $('hostDate').disabled = true; $('hostToday').disabled = true;
    $('dateText').textContent = '날짜 계산 라이브러리를 불러오지 못해서 2026년 11월 1일 하늘만 보여요.';
  }
  dateRender();

  $('newRoom').addEventListener('click', function () {
    if (cur.status === 'live' && !confirm('쇼가 진행 중이에요. 방 코드를 바꾸면 접속한 사람들이 모두 끊겨요. 바꿀까요?')) return;
    room = ShowSync.makeRoom();
    try { localStorage.setItem('osongvr-room', room); } catch (e) {}
    history.replaceState(null, '', location.pathname + (QS.has('sync') ? '?sync=' + encodeURIComponent(QS.get('sync')) : ''));
    renderJoin(); openHub();
  });

  // ---------- shows ----------
  SHOWS.forEach(function (s) {
    var o = document.createElement('option'); o.value = s.id; o.textContent = s.title + ' (' + s.scenes.length + '장면)';
    $('showSel').appendChild(o);
  });
  function selected() { return ShowTimeline.byId($('showSel').value); }
  function buildSteps() {
    var show = selected(), list = $('stepList');
    list.innerHTML = '';
    show.scenes.forEach(function (s, i) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<span class="t"></span><span class="n"></span>';
      b.querySelector('.t').textContent = String(i + 1).padStart(2, '0');
      b.querySelector('.n').textContent = s.title;
      b.addEventListener('click', function () { hub.go(show.id, i); });
      li.appendChild(b); list.appendChild(li);
    });
    $('sceneCount').textContent = show.scenes.length;
    lastIdx = -2;
  }
  $('showSel').addEventListener('change', function () { if (cur.status === 'live') hub.stop(); buildSteps(); });
  openHub();
  buildSteps();

  // ---------- controls ----------
  function live() { return cur.status === 'live' && cur.show === selected().id; }
  function next() {
    var show = selected();
    if (!live()) { hub.go(show.id, 0); return; }
    if (cur.scene + 1 < show.scenes.length) hub.go(show.id, cur.scene + 1);
  }
  function prev() { if (live()) hub.go(selected().id, Math.max(0, cur.scene - 1)); }
  $('nextBtn').addEventListener('click', next);
  $('prevBtn').addEventListener('click', prev);
  $('stopBtn').addEventListener('click', function () { hub.stop(); });
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Space' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'q' || e.key === 'Q') toggleQr();
    else if (e.key === 'Escape') $('qrBig').hidden = true;
  });
  function toggleQr() { $('qrBig').hidden = !$('qrBig').hidden; }
  $('qr').addEventListener('click', toggleQr);
  $('qrBigBtn').addEventListener('click', toggleQr);
  $('qrBig').addEventListener('click', toggleQr);


  // ---------- opening film (phones run it in js/intro.js) ----------
  var INTRO_SRC = 'assets/videos/vr-intro.mp4?v=2';
  var IN = { PRE: 0.8, BLACK: 0.6, SKIPBLACK: 0.3, FADE: 2.0, NOFILM: 1.5 };
  var film = { status: 'check', dur: 0 };
  (function () {
    var v = document.createElement('video'); v.preload = 'metadata'; v.muted = true;
    v.addEventListener('loadedmetadata', function () { film.status = 'ok'; film.dur = isFinite(v.duration) ? v.duration : 0; });
    v.addEventListener('error', function () { film.status = 'none'; });
    v.src = INTRO_SRC;
  })();
  function filmLen() { return film.status === 'ok' && film.dur ? Math.round(film.dur * 100) / 100 : 0; }
  function introNow() {
    var I = cur.intro;
    if (!I) return cur.show && cur.status === 'live' ? { phase: 'sky', busy: false } : { phase: 'wait', busy: false };   // phones wait until 체험 시작
    if (I.st === 'wait') return { phase: 'wait', busy: false };
    var t = hub ? hub.now() : Date.now(), len = I.len > 0 ? I.len : IN.NOFILM, e = (t - (I.pat || I.at)) / 1000;
    if (I.st === 'skip') { var k = (t - I.at) / 1000; return k < IN.SKIPBLACK + IN.FADE ? { phase: 'fade', busy: true } : { phase: 'sky', busy: false }; }
    if (e < IN.PRE) return { phase: 'dark', busy: true, film: true };
    if (e < IN.PRE + len) return { phase: I.len > 0 ? 'film' : 'dark', busy: true, film: true, left: IN.PRE + len - e };
    if (e < IN.PRE + len + IN.BLACK) return { phase: 'dark', busy: true, film: true };
    if (e < IN.PRE + len + IN.BLACK + IN.FADE) return { phase: 'fade', busy: true };
    return { phase: 'sky', busy: false };
  }
  var resetArm = 0;
  function introRender() {
    var x = introNow(), I = cur.intro;
    $('introState').textContent =
      x.phase === 'wait' ? '대기 중이에요. 참여자 화면에는 ‘대기 중’이 떠 있고, 체험 시작을 누르면 오프닝부터 시작돼요.' :
      x.phase === 'dark' ? '화면이 어두워지는 중이에요.' :
      x.phase === 'film' ? '오프닝 영상 재생 중 · ' + Math.ceil(x.left) + '초 남음' :
      x.phase === 'fade' ? '별 화면이 서서히 나타나는 중이에요.' : '참여자 화면에 별이 보이고 있어요.';
    $('introStart').disabled = x.busy || !!(I && I.st !== 'wait');
    $('introSkip').disabled = !x.film;
    $('introReplay').disabled = x.busy || !(I && I.st !== 'wait');
    $('introFilm').textContent = film.status === 'ok' ? '영상 ' + Math.round(film.dur) + '초' : film.status === 'none' ? '영상 파일 없음 · 검은 화면 뒤 바로 별 화면' : '';
    if (resetArm && Date.now() > resetArm) { resetArm = 0; $('introReset').textContent = '체험 초기화'; }
  }
  $('introStart').addEventListener('click', function () { if (!this.disabled) hub.intro('play', filmLen()); });
  $('introReplay').addEventListener('click', function () { if (!this.disabled) hub.intro('play', filmLen()); });
  $('introSkip').addEventListener('click', function () { if (!this.disabled) hub.intro('skip'); });
  $('introReset').addEventListener('click', function () {
    if (!resetArm) { resetArm = Date.now() + 3000; this.textContent = '한 번 더 누르면 초기화'; return; }
    resetArm = 0; this.textContent = '체험 초기화'; hub.intro('wait');
  });
  setInterval(introRender, 300);

  // ---------- closing timer (phones draw it in js/endtimer.js) ----------
  function etFmt(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function etRender() {
    var T = cur.timer, now = hub ? hub.now() : Date.now(), left = T && T.st === 'run' ? T.at + T.dur - now : 0;
    var done = T && (T.st === 'done' || left <= 0), run = T && !done;
    $('etState').textContent = run ? etFmt(left) : done ? '끝' : '';
    $('etText').textContent = run ? '폰에 남은 시간이 떠 있어요. 끝나면 ‘헤드셋을 천천히 벗어 주세요’가 떠요.' :
      done ? '폰에 ‘헤드셋을 천천히 벗어 주세요’가 떠 있어요. 안내 지우기를 누르면 사라져요.' : '시작하면 폰 위쪽에 남은 시간이 떠요.';
    $('etStart').textContent = T ? '다시 시작' : '타이머 시작';
    $('etNow').disabled = !run; $('etClear').disabled = !T;
  }
  $('etStart').addEventListener('click', function () { hub.timer('run', +$('etMin').value || 3); });
  $('etNow').addEventListener('click', function () { if (!this.disabled) hub.timer('done'); });
  $('etClear').addEventListener('click', function () { if (!this.disabled) hub.timer('off'); });
  setInterval(etRender, 300);

  // ---------- preview ----------
  function resize() { var r = stage.getBoundingClientRect(); eng.resize(r.width, r.height, window.devicePixelRatio || 1); }
  window.addEventListener('resize', resize); resize();
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(function () {}); } catch (e) {}

  var idleYaw = 160, lastIdx = -2, lastCap = '';
  var SHOW_ALL = { lines: true, names: true, stars: true, mw: true, dirs: true };
  function loop() {
    var show = selected(), on = live();
    var t = on ? Math.max(0, (hub.now() - cur.sceneStart) / 1000) : 0;
    var ev = on ? ShowTimeline.evaluate(eng, show, cur.scene, t) : null;
    var o = { minutes: 92, lim: 4.6, show: SHOW_ALL, mode: 'flat', fov: 80, cyFrac: 0.5, reticle: false };
    if (ev) {
      var aa = C.enuToAltAz(ev.dir);
      o.cam = camFrom(aa.az, clamp(aa.alt, -4, 86));
      o.minutes = ev.minutes; o.fov = ev.fov; o.highlight = ev.highlight; o.figures = ev.figures; o.pointer = ev.pointer;
      o.lineCons = ev.lineCons; o.labelAlpha = ev.labelAlpha; o.trails = ev.trails; o.eyepiece = ev.eyepiece; o.photoGrow = ev.photoGrow;
      if (ev.lim != null) o.lim = ev.lim;
      idleYaw = aa.az;
    } else {
      idleYaw = (idleYaw + 0.02) % 360;
      o.cam = camFrom(idleYaw, 40);
    }
    eng.render(o);
    $('stageClock').textContent = (window.SkyTime ? SkyTime.shortLabel() + ' ' : '') + clockText(o.minutes);

    var cap = $('caption');
    if (ev && ev.caption) {
      cap.hidden = false; cap.style.opacity = ev.caption.alpha.toFixed(3);
      var key = ev.caption.title + ev.caption.sub;
      if (key !== lastCap) { lastCap = key; $('capTitle').textContent = ev.caption.title; $('capSub').textContent = ev.caption.sub; }
    } else cap.hidden = true;

    var idx = on ? cur.scene : -1;
    $('nextBtn').textContent = !on ? '시작' : idx + 1 < show.scenes.length ? '다음 장면' : '마지막 장면';
    $('nextBtn').disabled = on && idx + 1 >= show.scenes.length;
    $('prevBtn').disabled = !on || idx === 0;
    $('stopBtn').disabled = cur.status !== 'live';
    $('sceneNo').textContent = on ? idx + 1 : '-';
    $('settle').textContent = !on ? '' : ev.settled ? '연출 끝 · 이야기하세요' : '연출 중 ' + Math.max(0, Math.ceil(ShowTimeline.settleTime(ev.scene) - t)) + '초';
    if (idx !== lastIdx) {
      lastIdx = idx;
      var items = $('stepList').children;
      for (var k = 0; k < items.length; k++) items[k].className = k === idx ? 'on' : '';
      if (idx >= 0) {
        var sc = show.scenes[idx], nx = show.scenes[idx + 1];
        $('nowTitle').textContent = sc.title;
        $('nowCue').hidden = !sc.cue; $('nowCue').textContent = sc.cue ? '참여 — ' + sc.cue : '';
        $('nowNote').textContent = sc.note || '';
        $('nextWrap').hidden = !nx;
        if (nx) $('nextNote').textContent = nx.title + (nx.sub ? ' · ' + nx.sub : '');
      } else {
        $('nowTitle').textContent = '쇼를 고르고 시작을 누르세요';
        $('nowCue').hidden = true;
        $('nowNote').textContent = '시작하면 접속한 모든 휴대폰이 같은 장면으로 넘어가요. 장면은 짧은 연출이 끝나면 멈춰서 기다리고, 다음 장면 버튼을 누를 때 넘어가요.';
        $('nextWrap').hidden = true;
      }
    }
    requestAnimationFrame(loop);
  }
  if (document.fonts && document.fonts.load) ['16px "Nanum Myeongjo"', '16px "IBM Plex Sans KR"', '16px "IBM Plex Mono"'].forEach(function (f) { document.fonts.load(f); });
  requestAnimationFrame(loop);
  window.__host = { hub: function () { return hub; }, room: function () { return room; }, state: function () { return cur; } };
})();
