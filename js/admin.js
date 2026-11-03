(function () {
  'use strict';
  var S = window.SKY, C = SkyCore;
  // the sky the phones show outside a story: the presenter's reference (now, in Cheongju). Stories use their own night.
  var EVENT0 = { rot: S.rot, gast0: S.gast0, lat: S.lat, lon: S.lon, t0ms: S.t0ms, planets: S.planets }, skyKey = '';
  function useSky(sky) {
    var key = sky ? [sky.date, sky.lat, sky.lon, sky.tz].join(',') : 'event';
    if (key === skyKey) return;
    if (!C.setSky(S, sky || C.EVENT)) { for (var k in EVENT0) S[k] = EVENT0[k]; }
    skyKey = key;
  }
  var $ = function (id) { return document.getElementById(id); };
  var SERVER = window.SYNC_SERVER || 'wss://osong-vr-sync.lrwe36.workers.dev'; // js/config.js
  var DEFAULT_ROOM = 'b32226cf';
  var q = new URLSearchParams(location.search);
  var sv = q.get('server');
  if (sv && /^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(sv)) SERVER = sv;
  var room = (q.get('r') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
  try { if (!room) room = localStorage.getItem('osong-room') || ''; } catch (e) {}
  if (room.length < 4) room = DEFAULT_ROOM;

  var DIRS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  function clockText(min) { var t = ((18 * 60 + Math.round(min)) % 1440 + 1440) % 1440, h = Math.floor(t / 60), m = t % 60; return (h < 12 ? '오전 ' : '오후 ') + (h % 12 === 0 ? 12 : h % 12) + ':' + (m < 10 ? '0' : '') + m; }

  // ---- spots (same ids as the phone page) ----
  function starV(nm) { for (var i = 0; i < S.named.length; i++) if (S.named[i][1] === nm) { var k = S.named[i][0]; return C.radec2vec(S.stars[4 * k], S.stars[4 * k + 1]); } return null; }
  function consV(id) { for (var i = 0; i < S.cons.length; i++) if (S.cons[i].id === id) return C.radec2vec(S.cons[i].ra, S.cons[i].dec); return null; }
  var SPOTS = [
    { id: 'sat', name: '토성', body: 'Saturn' },
    { id: 'pol', name: '북극성', v: starV('북극성') },
    { id: 'peg', name: '가을의 대사각형', v: consV('Peg') },
    { id: 'cas', name: '카시오페이아자리', v: consV('Cas') },
    { id: 'and', name: '안드로메다은하', v: C.radec2vec(10.68, 41.27) },
    { id: 'per', name: '페르세우스자리', v: consV('Per') },
    { id: 'alg', name: '알골', v: starV('알골') },
    { id: 'ple', name: '좀생이별', v: C.radec2vec(56.75, 24.12) },
    { id: 'cap', name: '카펠라', v: starV('카펠라') },
    { id: 'cyg', name: '백조자리', v: consV('Cyg') },
    { id: 'veg', name: '직녀성', v: starV('직녀성 (베가)') },
    { id: 'alt', name: '견우성', v: starV('견우성 (알타이르)') },
    { id: 'fom', name: '포말하우트', v: starV('포말하우트') },
    { id: 'ura', name: '천왕성 (망원경)', body: 'Uranus' },
    { id: 'nep', name: '해왕성 (망원경)', body: 'Neptune' }
  ].filter(function (s) { return s.v || s.body; });

  // ---- connection ----
  var ws = null, authed = false, key = '', retry = 1000, ST = null, stAt = 0, counts = { phones: 0, vr: 0 }, refSent = false;
  function send(o) { if (ws && ws.readyState === 1 && authed) { try { ws.send(JSON.stringify(o)); } catch (e) {} } }
  function cmd(c, extra) { var o = { k: 'cmd', c: c }; if (extra) for (var k in extra) o[k] = extra[k]; send(o); }
  function setConn(t, ok) { $('hConn').textContent = t; $('hDot').className = 'dot ' + (ok ? 'ok' : 'bad'); $('mWait').hidden = ok; }
  // the reference observing time and place: the moment this page opened, in Cheongju, running in real time
  function sendReference() {
    var k = C.refSky(Date.now());
    cmd('sky', k); cmd('time', { v: C.minutesAt(k, Date.now()) }); cmd('speed', { v: 1 });
  }
  function connect() {
    try { ws = new WebSocket(SERVER + '/ws?room=' + room); } catch (e) { setConn('연결 실패', false); setTimeout(connect, 4000); return; }
    var my = ws; authed = false;
    $('mWait').textContent = '서버에 연결하는 중이에요… (잠든 서버는 깨어나는 데 최대 1분 걸려요)';
    my.onopen = function () { setConn('서버 연결됨', true); retry = 1000; my.send(JSON.stringify({ k: 'auth', key: key })); };
    my.onmessage = function (e) {
      if (e.data === 'pong') return;
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.k === 'authok') {
        authed = true; $('login').hidden = true; try { sessionStorage.setItem('osong-key', key); } catch (x) {}
        if (!refSent) { refSent = true; sendReference(); }
      } else if (m.k === 'authfail') {
        // only a server that still runs the old worker.js asks for a password
        authed = false; $('login').hidden = false;
        $('lerr').textContent = key ? '비밀번호가 맞지 않아요' : '서버가 아직 예전 버전이라 비밀번호가 필요해요 (worker.js를 다시 배포하면 없어져요)';
        try { sessionStorage.removeItem('osong-key'); } catch (x) {}
        my.onclose = null; my.close();
      }
      else if (m.k === 'state') { ST = m; stAt = Date.now(); storyT0 = m.story ? Date.now() - (m.story.el || 0) : 0; if (Date.now() - followAt > 3000) { follow = !!(m.view && m.view.on); renderFollow(); } render(); }
      else if (m.k === 'counts') { counts = m; renderCounts(); renderQuiz(); }
    };
    my.onclose = function () { authed = false; setConn('연결이 끊겼어요. 다시 연결 중…', false); setTimeout(connect, retry); retry = Math.min(retry * 2, 8000); };
    my.onerror = function () { try { my.close(); } catch (x) {} };
  }
  setInterval(function () { if (ws && ws.readyState === 1) { try { ws.send('ping'); } catch (e) {} } }, 20000);
  $('hServer').textContent = '동기화 서버: ' + SERVER.replace(/^wss?:\/\//, '') + ' · 방 코드: ' + room;

  // ---- tabs ----
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      var id = t.getAttribute('data-tab');
      document.querySelectorAll('.tab').forEach(function (o) { o.setAttribute('aria-selected', o === t ? 'true' : 'false'); });
      document.querySelectorAll('.pane').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== id; });
    });
  });

  // ---- render ----
  function curMinutes() { return C.wrapMin(ST ? ST.time + (Date.now() - stAt) / 60000 * ST.speed : 90); }
  function render() {
    if (!ST) return;
    $('hHold').setAttribute('aria-pressed', ST.hold ? 'true' : 'false');
    if (document.activeElement !== $('hNote') && $('hNote').value !== ST.note && ST.note) $('hNote').value = ST.note;
    renderStory();
    renderTime();
    renderDisp();
    tick();
  }
  function renderCounts() {
    var p = counts.phones || 0, v = counts.vr || 0;
    $('cPhones').textContent = p; $('cVR').textContent = v; $('cScreen').textContent = Math.max(0, p - v);
  }
  function tick() {
    storyState();
    introRender();
    if (!ST) return;
    var cs = curStory();
    $('hBig').textContent = cs ? '이야기 ' + (cs.i + 1) + '장면 진행 중' : ST.quiz ? '퀴즈 진행 중' : ST.hold ? '쉬는 시간' : '자유 관찰';
    $('hLive').classList.toggle('on', !!authed);
    var mins = curMinutes();
    $('hClock').textContent = cs ? clockText(mins) + ' (이야기)' : clockText(mins);
    useSky(cs ? null : (C.skyOk(ST.sky) ? ST.sky : C.refSky(Date.now())));
    var M = C.eqjToEnu(S, mins);
    document.querySelectorAll('#hSpots [data-spot]').forEach(function (b) {
      var sp = SPOTS.filter(function (x) { return x.id === b.getAttribute('data-spot'); })[0]; if (!sp) return;
      var v = sp.body ? C.radec2vec.apply(null, C.bodyRaDec(S, sp.body, mins)) : sp.v;
      var aa = C.enuToAltAz(C.apply(M, v));
      b.querySelector('small').textContent = aa.alt < 0 ? '지평선 아래' : DIRS[Math.round(aa.az / 45) % 8] + '쪽 · 높이 ' + Math.round(aa.alt) + '°';
      b.classList.toggle('below', aa.alt < 0);
      b.setAttribute('aria-pressed', ST.spot === sp.id ? 'true' : 'false');
    });
  }
  setInterval(tick, 500);

  // ---- time: pause/play, speed slider, jumps ----
  var SPEEDS = [-600, -60, -10, 0, 1, 10, 60, 600];
  var SPEED_TEXT = { '-600': '600배 거꾸로', '-60': '60배 거꾸로', '-10': '10배 거꾸로', '0': '멈춤', '1': '실제 속도', '10': '10배', '60': '60배 (1초에 1분)', '600': '600배 (1초에 10분)' };
  var lastSpeed = 1;
  function renderTime() {
    var sp = ST ? ST.speed : 1;
    if (sp !== 0) lastSpeed = sp;
    if (document.activeElement !== $('hSpeed')) $('hSpeed').value = Math.max(0, SPEEDS.indexOf(sp));
    $('hSpeedText').textContent = SPEED_TEXT[String(sp)] || sp + '배';
    $('cPlayT').textContent = sp === 0 ? '재생' : '일시정지';
    $('cPlay').querySelector('.ic').textContent = sp === 0 ? '▶' : '❚❚';
  }
  $('hSpeed').addEventListener('input', function () { $('hSpeedText').textContent = SPEED_TEXT[String(SPEEDS[+this.value])]; });
  $('hSpeed').addEventListener('change', function () { cmd('speed', { v: SPEEDS[+this.value] }); });
  $('cPlay').addEventListener('click', function () { cmd('speed', { v: ST && ST.speed !== 0 ? 0 : (lastSpeed || 1) }); });
  document.querySelectorAll('[data-hstep]').forEach(function (b) { b.addEventListener('click', function () { cmd('step', { v: +b.getAttribute('data-hstep') }); }); });
  $('hNow').addEventListener('click', sendReference);
  $('hDiurnal').addEventListener('click', function () { cmd('show', { key: 'trails', v: true }); cmd('speed', { v: 600 }); });

  // ---- what every phone draws ----
  var DISP = [['art', '별자리 그림', true], ['lines', '별자리 선', true], ['names', '별자리 이름', true], ['stars', '별 이름', true], ['trails', '별의 궤적', false], ['mw', '은하수', true], ['dirs', '동서남북', true]];
  DISP.forEach(function (d) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn switch'; b.textContent = d[1];
    b.setAttribute('data-disp', d[0]); b.setAttribute('aria-pressed', d[2] ? 'true' : 'false');
    b.addEventListener('click', function () { cmd('show', { key: d[0], v: b.getAttribute('aria-pressed') !== 'true' }); });
    $('hDisp').appendChild(b);
  });
  function dispOn(k) { var ds = (ST && ST.disp) || {}, d = DISP.filter(function (x) { return x[0] === k; })[0]; return typeof ds[k] === 'boolean' ? ds[k] : d[2]; }
  function renderDisp() { document.querySelectorAll('[data-disp]').forEach(function (b) { b.setAttribute('aria-pressed', dispOn(b.getAttribute('data-disp')) ? 'true' : 'false'); }); }

  // ---- quiz ----
  (window.QUIZZES || []).forEach(function (q, i) {
    var o = document.createElement('option'); o.value = i; o.textContent = (q.type === 'find' ? '[찾기] ' : '[고르기] ') + q.q; $('qzSel').appendChild(o);
  });
  function openQuiz(q) { cmd('quiz', { v: 'open', q: { type: q.type, q: q.q, opts: q.opts || [], ans: q.ans || 0, target: q.target || null, ex: q.ex || '' } }); }
  $('qzOpen').addEventListener('click', function () { var q = (window.QUIZZES || [])[+$('qzSel').value]; if (q) openQuiz(q); });
  $('qzReveal').addEventListener('click', function () { cmd('quiz', { v: 'reveal' }); });
  $('qzOff').addEventListener('click', function () { cmd('quiz', { v: 'off' }); });
  $('qzMakeChoice').addEventListener('click', function () {
    var q = $('qzMQ').value.trim(), opts = [], pick = +(document.querySelector('[name=qzAns]:checked') || { value: 0 }).value, ans = -1;
    for (var i = 0; i < 4; i++) { var t = $('qzM' + i).value.trim(); if (t) { if (i === pick) ans = opts.length; opts.push(t); } }
    if (!q || opts.length < 2) { alert('질문과 보기를 두 개 이상 써 주세요.'); return; }
    if (ans < 0) { alert('정답으로 고른 보기가 비어 있어요.'); return; }
    openQuiz({ type: 'choice', q: q, opts: opts, ans: ans, ex: '' });
  });
  $('qzMakeFind').addEventListener('click', function () {
    var it = navItems[+$('hGoSel').value]; if (!it) return;
    openQuiz({ type: 'find', q: it.name + '을(를) 찾아 2초 동안 바라보세요', target: { kind: it.target.kind, id: String(it.target.id), name: it.name }, ex: '' });
  });
  function renderQuiz() {
    var q = ST && ST.quiz;
    $('qzLive').hidden = !q;
    if (!q) return;
    var qc = counts && counts.quiz && counts.quiz.n === q.n ? counts.quiz : { answered: 0, tally: {} }, phones = (counts && counts.phones) || 0;
    $('qzLiveQ').textContent = q.q + (q.st === 'reveal' ? '  · 정답 공개함' : '');
    var box = $('qzBars'); box.innerHTML = '';
    var rows = q.type === 'find' ? [['찾은 사람', qc.tally[1] || 0, true]] : q.opts.map(function (o, i) { return [(i + 1) + '. ' + o, qc.tally[i] || 0, i === q.ans]; });
    rows.forEach(function (r) {
      var d = document.createElement('div'); d.className = 'qzbar' + (r[2] ? ' ans' : '');
      d.innerHTML = '<div><i></i><span></span></div><b></b>';
      d.querySelector('span').textContent = r[0]; d.querySelector('b').textContent = r[1];
      d.querySelector('i').style.width = (phones ? Math.round(100 * r[1] / phones) : 0) + '%';
      box.appendChild(d);
    });
    $('qzCount').textContent = '답한 폰 ' + qc.answered + ' / ' + phones + '대' + (q.type === 'choice' ? ' · 테두리가 있는 보기가 정답' : '');
    $('qzReveal').disabled = q.st === 'reveal';
  }
  setInterval(renderQuiz, 1000);

  // ---- move everyone's view anywhere in the sky ----
  var navItems = [];
  (function () {
    var sel = $('hGoSel'), groups = { body: '행성 · 달', cons: '별자리', star: '밝은 별', dso: '성단 · 은하' };
    var BODY_KO = { Moon: '달', Mercury: '수성', Venus: '금성', Mars: '화성', Jupiter: '목성', Saturn: '토성', Uranus: '천왕성', Neptune: '해왕성' };
    var items = navItems;
    Object.keys(BODY_KO).forEach(function (k) { items.push({ g: 'body', name: BODY_KO[k], body: k, target: { kind: 'body', id: k } }); });
    var seen = {};
    S.cons.forEach(function (c) { if (seen[c.ko]) return; seen[c.ko] = 1; items.push({ g: 'cons', name: c.ko, v: C.radec2vec(c.ra, c.dec), target: { kind: 'cons', id: c.id.replace(/\d$/, '') } }); });
    S.named.forEach(function (n) { var k = n[0]; items.push({ g: 'star', name: n[1], v: C.radec2vec(S.stars[4 * k], S.stars[4 * k + 1]), target: { kind: 'star', id: n[1] } }); });
    [['안드로메다은하', 10.68, 41.27], ['좀생이별 (플레이아데스)', 56.75, 24.12], ['오리온 대성운', 83.82, -5.39], ['이중성단', 34.75, 57.13], ['헤라클레스 구상성단', 250.42, 36.46]].forEach(function (d) { items.push({ g: 'dso', name: d[0], v: C.radec2vec(d[1], d[2]), target: { kind: 'radec', id: d[1] + ',' + d[2] } }); });
    Object.keys(groups).forEach(function (g) {
      var og = document.createElement('optgroup'); og.label = groups[g];
      items.forEach(function (it, i) {
        if (it.g !== g) return;
        var o = document.createElement('option'); o.value = i; o.textContent = it.name; og.appendChild(o);
      });
      sel.appendChild(og);
    });
    function altaz(it) {
      var m = curMinutes(), v = it.body ? C.radec2vec.apply(null, C.bodyRaDec(S, it.body, m)) : it.v;
      return C.enuToAltAz(C.apply(C.eqjToEnu(S, m), v));
    }
    function goView(yaw, pitch, fov) {
      view = { yaw: ((yaw % 360) + 360) % 360, pitch: Math.max(-10, Math.min(88, pitch)), fov: Math.max(20, Math.min(120, fov)) };
      try { $('hSky').contentWindow.postMessage({ type: 'osong-setview', yaw: view.yaw, pitch: view.pitch, fov: view.fov }, '*'); } catch (e) {}
      if (!follow) { follow = true; followAt = Date.now(); renderFollow(); }
      sendView(true);
      renderFov();
    }
    function renderFov() { $('hFov').value = Math.round(view.fov); $('hFovText').textContent = Math.round(view.fov) + '°'; }
    function updateOptions() { // mark what is below the horizon right now
      for (var i = 0; i < sel.options.length; i++) {
        var o = sel.options[i], it = items[+o.value], aa = altaz(it);
        o.textContent = it.name + (aa.alt < 0 ? ' (지평선 아래)' : '');
      }
    }
    sel.addEventListener('focus', updateOptions);
    $('hGo').addEventListener('click', function () {
      var it = items[+sel.value]; if (!it) return;
      var aa = altaz(it);
      goView(aa.az, aa.alt, it.g === 'cons' ? 70 : it.g === 'dso' ? 30 : it.g === 'body' ? 35 : 45);
    });
    document.querySelectorAll('[data-hdir]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = b.getAttribute('data-hdir');
        if (d === 'zen') goView(view.yaw, 88, 110); else goView(+d, 25, Math.max(view.fov, 80));
      });
    });
    document.querySelectorAll('[data-hzoom]').forEach(function (b) {
      b.addEventListener('click', function () { goView(view.yaw, view.pitch, view.fov * (+b.getAttribute('data-hzoom') > 0 ? 1.35 : 1 / 1.35)); });
    });
    $('hFov').addEventListener('input', function () { $('hFovText').textContent = this.value + '°'; });
    $('hFov').addEventListener('change', function () { goView(view.yaw, view.pitch, +this.value); });
    window.addEventListener('message', function (ev) { if ((ev.data || {}).type === 'osong-view' && document.activeElement !== $('hFov')) renderFov(); });
    updateOptions();
  })();

  // ---- opening film (체험 시작) ----
  // same timeline numbers as the phones, used here only to show what the phones are doing
  var INTRO_SRC = 'assets/videos/vr-intro.mp4?v=2';
  var IN = { PRE: 0.8, BLACK: 0.6, SKIPBLACK: 0.3, FADE: 2.0, NOFILM: 1.5 };
  var film = { status: 'check', dur: 0 };
  (function () {
    var v = document.createElement('video'); v.preload = 'metadata'; v.muted = true;
    v.addEventListener('loadedmetadata', function () { film.status = 'ok'; film.dur = isFinite(v.duration) ? v.duration : 0; introRender(); });
    v.addEventListener('error', function () { film.status = 'none'; introRender(); });
    v.src = INTRO_SRC;
  })();
  function introNow() {
    if (!ST || !ST.intro) return { phase: 'sky', busy: false };
    var I = ST.intro, since = (Date.now() - stAt) / 1000, e = (I.pel || 0) / 1000 + since;
    if (I.st === 'wait') return { phase: 'wait', busy: false };
    var len = I.len > 0 ? I.len : IN.NOFILM, hasFilm = I.len > 0;
    if (I.st === 'skip') {
      var k = (I.el || 0) / 1000 + since;
      return k < IN.SKIPBLACK + IN.FADE ? { phase: 'fade', busy: true } : { phase: 'sky', busy: false, ran: true };
    }
    if (e < IN.PRE) return { phase: 'dark', busy: true, film: true };
    if (e < IN.PRE + len) return { phase: hasFilm ? 'film' : 'dark', busy: true, film: true, left: IN.PRE + len - e };
    if (e < IN.PRE + len + IN.BLACK) return { phase: 'dark', busy: true, film: true };
    if (e < IN.PRE + len + IN.BLACK + IN.FADE) return { phase: 'fade', busy: true };
    return { phase: 'sky', busy: false, ran: true };
  }
  var resetArm = 0;
  function introRender() {
    var x = introNow();
    $('iState').textContent =
      x.phase === 'wait' ? '대기 중이에요. 참가자 화면은 검게 가려져 있어요.' :
      x.phase === 'dark' ? '화면이 어두워지는 중이에요.' :
      x.phase === 'film' ? '오프닝 영상 재생 중 · ' + Math.ceil(x.left) + '초 남음' :
      x.phase === 'fade' ? '별 화면이 서서히 나타나는 중이에요.' :
      '참가자 화면에 별이 보이고 있어요.';
    $('iStart').disabled = x.busy || (ST && ST.intro && ST.intro.st !== 'wait');
    $('iSkip').disabled = !x.film;
    $('iReplay').disabled = x.busy || !(ST && ST.intro && ST.intro.st !== 'wait');
    $('iFilm').textContent = film.status === 'ok' ? '오프닝 영상 ' + (film.dur ? Math.round(film.dur) + '초' : '') + ' · 영상이 준비된 폰 ' + (counts.film || 0) + '/' + (counts.phones || 0) + '대' + (counts.filmFail ? ' (못 불러온 폰 ' + counts.filmFail + '대는 영상 없이 넘어가요)' : '') :
      film.status === 'none' ? '오프닝 영상 파일이 없어요. 시작하면 검은 화면 뒤 바로 별 화면이 나타나요.' : '오프닝 영상 확인 중…';
    if (resetArm && Date.now() > resetArm) { resetArm = 0; $('iReset').textContent = '체험 초기화'; }
  }
  function filmLen() { return film.status === 'ok' && film.dur ? Math.round(film.dur * 100) / 100 : 0; }
  $('iStart').addEventListener('click', function () { if (!this.disabled) cmd('intro', { v: 'play', len: filmLen() }); });
  $('iReplay').addEventListener('click', function () { if (!this.disabled) cmd('intro', { v: 'play', len: filmLen() }); });
  $('iSkip').addEventListener('click', function () { if (!this.disabled) cmd('intro', { v: 'skip' }); });
  $('iReset').addEventListener('click', function () {
    if (!resetArm) { resetArm = Date.now() + 3000; this.textContent = '한 번 더 누르면 초기화'; return; }
    resetArm = 0; this.textContent = '체험 초기화'; cmd('intro', { v: 'wait' });
  });

  // ---- mirroring: host view (drag to steer) + the same page as phones in VR / screen mode ----
  var view = { yaw: 150, pitch: 30, fov: 75 }, follow = false, followAt = 0, lastSend = 0, sendT = null, endT = null;
  function pageUrl(extra) { var u = new URL('./', location.href).href + '?r=' + room + extra; if (sv) u += '&server=' + encodeURIComponent(SERVER); return u; }
  $('hSky').src = pageUrl('&hostview=1');
  function sendView(persist) {
    lastSend = Date.now();
    cmd('view', { on: follow, yaw: view.yaw, pitch: view.pitch, fov: view.fov, persist: !!persist });
  }
  window.addEventListener('message', function (ev) {
    if (ev.source !== $('hSky').contentWindow) return;
    var d = ev.data || {};
    if (d.type !== 'osong-view') return;
    view = { yaw: +d.yaw, pitch: +d.pitch, fov: +d.fov };
    if (!follow) return;
    // live updates at most ~8 per second, then one saved update when the mouse stops
    var wait = 125 - (Date.now() - lastSend);
    clearTimeout(sendT); sendT = setTimeout(function () { sendView(false); }, Math.max(0, wait));
    clearTimeout(endT); endT = setTimeout(function () { sendView(true); }, 700);
  });
  function renderFollow() { $('hFollow').setAttribute('aria-pressed', follow ? 'true' : 'false'); }
  $('hFollow').addEventListener('click', function () { follow = !follow; followAt = Date.now(); renderFollow(); sendView(true); });

  var mview = 'host', split = false, prevOn = true;
  try { prevOn = localStorage.getItem('osong-prev') !== 'off'; mview = localStorage.getItem('osong-mview') || 'host'; } catch (e) {}
  function renderMirror() {
    var f = $('mFrame');
    if (!prevOn && mview !== 'host') mview = 'host';
    // split: the presenter's view above, the participant view (VR or screen mode) below
    var sp = split && prevOn, second = mview === 'screen' ? 'screen' : 'vr';
    f.setAttribute('data-view', mview); f.setAttribute('data-second', second); f.classList.toggle('split', sp);
    document.querySelectorAll('[data-view]').forEach(function (b) {
      if (b.tagName !== 'BUTTON') return;
      var v = b.getAttribute('data-view');
      b.setAttribute('aria-pressed', (sp ? v === second : v === mview) ? 'true' : 'false'); b.disabled = !prevOn && v !== 'host';
    });
    $('hSplit').setAttribute('aria-pressed', sp ? 'true' : 'false'); $('hSplit').disabled = !prevOn;
    $('hPrevToggle').setAttribute('aria-pressed', prevOn ? 'true' : 'false');
    // a preview is only drawn while it is on screen, so the laptop does not draw three skies at once
    var showVR = prevOn && (sp ? second === 'vr' : mview === 'vr'), showSC = prevOn && (sp ? second === 'screen' : mview === 'screen');
    var vrSrc = showVR ? pageUrl('&sim=vr') : 'about:blank', scSrc = showSC ? pageUrl('&sim=screen') : 'about:blank';
    if ($('pVR').getAttribute('src') !== vrSrc) $('pVR').setAttribute('src', vrSrc);
    if ($('pSC').getAttribute('src') !== scSrc) $('pSC').setAttribute('src', scSrc);
  }
  document.querySelectorAll('button[data-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      mview = b.getAttribute('data-view');
      if (mview === 'host') split = false; // in split view the VR / screen buttons pick the lower half
      try { localStorage.setItem('osong-mview', mview); } catch (e) {} renderMirror();
    });
  });
  $('hSplit').addEventListener('click', function () { split = !split; if (split && mview === 'host') mview = 'vr'; renderMirror(); });
  $('hPrevToggle').addEventListener('click', function () { prevOn = !prevOn; try { localStorage.setItem('osong-prev', prevOn ? 'on' : 'off'); } catch (e) {} renderMirror(); });
  renderMirror();

  // ---- story (scene-by-scene show) ----
  var SH = window.STORY_SHOWS || [], storyT0 = 0, lastServerShow = null;
  function showBy(id) { for (var i = 0; i < SH.length; i++) if (SH[i].id === id) return SH[i]; return null; }
  SH.forEach(function (s) { var o = document.createElement('option'); o.value = s.id; o.textContent = s.title + ' (' + s.scenes.length + '장면)'; $('sShow').appendChild(o); });
  function settleTime(sc) {
    var t = sc.move || 0;
    (sc.fx || []).forEach(function (f) { t = Math.max(t, f.at + (f.dur || 0) + (f.stagger || 0) * ((f.cons || []).length - 1)); });
    return t;
  }
  function curStory() { return ST && ST.story && showBy(ST.story.show) ? ST.story : null; }
  function renderStory() {
    var cs = curStory();
    // follow the server only when it switches to another show, so a choice you just made in the list is kept
    var srv = cs ? cs.show : null;
    if (srv && srv !== lastServerShow) $('sShow').value = srv;
    lastServerShow = srv;
    if (cs && cs.show !== $('sShow').value) cs = null;
    var show = cs ? showBy(cs.show) : showBy($('sShow').value);
    if (!show) return;
    var n = show.scenes.length, i = cs ? cs.i : -1;
    var list = $('sList');
    if (list.getAttribute('data-show') !== show.id) {
      list.innerHTML = ''; list.setAttribute('data-show', show.id);
      show.scenes.forEach(function (sc, j) {
        var li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.innerHTML = '<span class="mk"></span><span class="st"><small></small><span></span></span>';
        b.querySelector('small').textContent = (j + 1) + '단계'; b.querySelector('.st span').textContent = sc.title;
        b.addEventListener('click', function () { cmd('story', { show: show.id, i: j }); });
        li.appendChild(b); list.appendChild(li);
      });
    }
    list.querySelectorAll('li').forEach(function (li, j) {
      li.className = j < i ? 'done' : j === i ? 'now' : '';
      li.querySelector('.mk').textContent = j < i ? '✓' : j === i ? String(j + 1) : '';
      var b = li.querySelector('button'); if (j === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    var sc = cs ? show.scenes[i] : show.scenes[0];
    $('nStep').textContent = cs ? (i + 1) + ' / ' + n + '단계' : '시작 전 · 1단계 미리보기';
    $('sTitle').textContent = sc.title || '';
    $('sCue').textContent = sc.cue ? '참여 질문 · ' + sc.cue : ''; $('sNote').textContent = sc.note || '';
    $('sGoT').textContent = !cs ? '시작' : i + 1 < n ? '다음 단계' : '마지막 단계';
    $('sGo').disabled = !!cs && i + 1 >= n; $('nNext').disabled = $('sGo').disabled;
    $('sPrev').disabled = !cs || i <= 0; $('nPrev').disabled = $('sPrev').disabled;
    $('sEnd').disabled = !cs;
  }
  function storyState() {
    var cs = curStory(), bar = $('sProg');
    if (!cs) { bar.style.width = '0'; return; }
    var sc = showBy(cs.show).scenes[cs.i], total = Math.max(0.1, settleTime(sc)), p = Math.min(1, (Date.now() - storyT0) / 1000 / total);
    bar.style.width = (p * 100).toFixed(1) + '%';
  }
  function storyNext() {
    var cs = curStory(), show = showBy($('sShow').value); if (!show) return;
    if (!cs || cs.show !== show.id) cmd('story', { show: show.id, i: 0 });
    else if (cs.i + 1 < show.scenes.length) cmd('story', { show: show.id, i: cs.i + 1 });
  }
  function storyPrev() { var cs = curStory(); if (cs && cs.i > 0) cmd('story', { show: cs.show, i: cs.i - 1 }); }
  $('sShow').addEventListener('change', function () { renderStory(); });
  $('sGo').addEventListener('click', storyNext); $('nNext').addEventListener('click', storyNext);
  $('sPrev').addEventListener('click', storyPrev); $('nPrev').addEventListener('click', storyPrev);
  $('cRestart').addEventListener('click', function () { var show = showBy($('sShow').value); if (show) cmd('story', { show: show.id, i: 0 }); });
  $('sEnd').addEventListener('click', function () { cmd('story', { show: null }); });
  document.addEventListener('keydown', function (e) {
    var tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || !authed) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); if (!$('sGo').disabled) storyNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); storyPrev(); }
  });
  renderStory();

  // ---- QR / link ----
  function roomLink() { return new URL('./', location.href).href + '?r=' + room; }
  function drawQR() {
    var link = roomLink(); $('hLink').value = link; $('hRoom').value = room;
    try {
      var qr = qrcode(0, 'M'); qr.addData(link); qr.make();
      var n = qr.getModuleCount(), cv = $('hQR'), sz = 8, qz = 4;
      cv.width = cv.height = (n + qz * 2) * sz;
      var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#000';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + qz) * sz, (r + qz) * sz, sz, sz);
    } catch (e) {}
  }

  // ---- wiring ----
  SPOTS.forEach(function (sp) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.setAttribute('data-spot', sp.id); b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span></span><small></small>'; b.firstChild.textContent = sp.name;
    b.addEventListener('click', function () {
      var off = ST && ST.spot === sp.id;
      cmd('spot', { v: off ? null : sp.id });
      if (!off) try { $('hSky').contentWindow.postMessage({ type: 'osong-lookat', id: sp.id }, '*'); } catch (e) {}
    });
    $('hSpots').appendChild(b);
  });
  $('hSpotOff').addEventListener('click', function () { cmd('spot', { v: null }); });
  $('hSend').addEventListener('click', function () { cmd('note', { v: $('hNote').value.trim() }); });
  $('hNoteClear').addEventListener('click', function () { $('hNote').value = ''; cmd('note', { v: '' }); });
  document.querySelectorAll('[data-hnote]').forEach(function (b) { b.addEventListener('click', function () { var t = b.getAttribute('data-hnote'); $('hNote').value = t; cmd('note', { v: t }); }); });
  $('hHold').addEventListener('click', function () { cmd('hold', { v: !(ST && ST.hold) }); });
  $('hCopy').addEventListener('click', function () { var t = $('hLink').value; try { navigator.clipboard.writeText(t).then(function () { $('hCopy').textContent = '복사됨'; }, function () { $('hLink').select(); }); } catch (e) { $('hLink').select(); } });
  $('hRoomSet').addEventListener('click', function () {
    var r = $('hRoom').value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
    if (r.length < 4) { $('hRoom').value = room; return; }
    try { localStorage.setItem('osong-room', r); } catch (e) {}
    location.href = location.pathname + '?r=' + r;
  });
  $('lform').addEventListener('submit', function (e) {
    e.preventDefault(); key = $('lkey').value; $('lerr').textContent = '확인 중…';
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ k: 'auth', key: key })); else connect();
  });
  drawQR();
  try { key = sessionStorage.getItem('osong-key') || ''; } catch (e) {}
  connect();
  window.__admin = { send: send, state: function () { return ST; } };
})();
