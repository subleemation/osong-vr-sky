(function () {
  'use strict';
  var S = window.SKY, C = SkyCore;
  // the evening the phones show outside the story (null = the event night; see SkyCore.setSky)
  var EVENT0 = { rot: S.rot, gast0: S.gast0, lat: S.lat, lon: S.lon, t0ms: S.t0ms, planets: S.planets }, skyKey = '';
  function useSky(sky) {
    var key = sky ? [sky.date, sky.lat, sky.lon, sky.tz].join(',') : 'event';
    if (key === skyKey) return;
    if (!C.setSky(S, sky || C.EVENT)) { for (var k in EVENT0) S[k] = EVENT0[k]; } // the built-in table stops at 21:30
    skyKey = key;
  }
  var $ = function (id) { return document.getElementById(id); };
  var SERVER = 'wss://osong-vr-sync.lrwe36.workers.dev';
  var DEFAULT_ROOM = 'b32226cf';
  var q = new URLSearchParams(location.search);
  var sv = q.get('server');
  if (sv && /^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(sv)) SERVER = sv;
  var room = (q.get('r') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
  try { if (!room) room = localStorage.getItem('osong-room') || ''; } catch (e) {}
  if (room.length < 4) room = DEFAULT_ROOM;

  var DIRS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  function clockText(min) { var t = (18 * 60 + Math.round(min)) % 1440, h = Math.floor(t / 60), m = t % 60; return (h < 12 ? '오전 ' : '오후 ') + (h % 12 === 0 ? 12 : h % 12) + ':' + (m < 10 ? '0' : '') + m; }
  function fmtTime(ms) { var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60), x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x; }
  function phaseName(p) { return p === 'guide' ? '설명 시간' : p === 'free' ? '자유 관찰' : p === 'end' ? '끝' : '대기 중'; }

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
  function spotAltAz(sp, minutes) {
    var v = sp.body ? C.radec2vec.apply(null, C.bodyRaDec(S, sp.body, minutes)) : sp.v;
    return C.enuToAltAz(C.apply(C.eqjToEnu(S, minutes), v));
  }

  // ---- connection ----
  var ws = null, authed = false, key = '', retry = 1000, ST = null, stAt = 0, counts = { phones: 0, vr: 0 }, order = 'GF';
  function send(o) { if (ws && ws.readyState === 1 && authed) { try { ws.send(JSON.stringify(o)); } catch (e) {} } }
  function cmd(c, extra) { var o = { k: 'cmd', c: c }; if (extra) for (var k in extra) o[k] = extra[k]; send(o); }
  function setConn(t, ok) { $('hConn').textContent = t; $('hConn').className = ok ? 'ok' : 'bad'; }
  function connect() {
    try { ws = new WebSocket(SERVER + '/ws?room=' + room); } catch (e) { setConn('연결 실패', false); setTimeout(connect, 4000); return; }
    var my = ws; authed = false;
    my.onopen = function () { setConn('서버 연결됨', true); retry = 1000; my.send(JSON.stringify({ k: 'auth', key: key })); };
    my.onmessage = function (e) {
      if (e.data === 'pong') return;
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.k === 'authok') { authed = true; $('login').hidden = true; try { sessionStorage.setItem('osong-key', key); } catch (x) {} }
      else if (m.k === 'authfail') {
        authed = false; $('login').hidden = false;
        $('lerr').textContent = m.configured ? '비밀번호가 맞지 않아요' : '서버에 관리자 비밀번호가 아직 설정되지 않았어요';
        try { sessionStorage.removeItem('osong-key'); } catch (x) {}
        my.onclose = null; my.close();
      }
      else if (m.k === 'state') { ST = m; stAt = Date.now(); storyT0 = m.story ? Date.now() - (m.story.el || 0) : 0; if (Date.now() - followAt > 3000) { follow = !!(m.view && m.view.on); renderFollow(); } render(); }
      else if (m.k === 'counts') { counts = m; renderQuiz(); $('hPeers').textContent = m.phones + '대 접속 (VR 중 ' + m.vr + '대)'; }
    };
    my.onclose = function () { authed = false; setConn('연결이 끊겼어요. 다시 연결 중…', false); setTimeout(connect, retry); retry = Math.min(retry * 2, 8000); };
    my.onerror = function () { try { my.close(); } catch (x) {} };
  }
  setInterval(function () { if (ws && ws.readyState === 1) { try { ws.send('ping'); } catch (e) {} } }, 20000);

  // ---- render ----
  function curMinutes() { var m = ST ? ST.time + (Date.now() - stAt) / 60000 * ST.speed : 90; return ((m % 720) + 720) % 720; }
  function timerRem() { if (!ST || !ST.timer) return 0; return ST.timer.paused ? ST.timer.rem : Math.max(0, ST.timer.rem - (Date.now() - stAt)); }
  function render() {
    if (!ST) return;
    $('hOrderGF').setAttribute('aria-pressed', order === 'GF' ? 'true' : 'false');
    $('hOrderFG').setAttribute('aria-pressed', order === 'FG' ? 'true' : 'false');
    var run = !!ST.plan;
    $('hPlanRun').hidden = !run; $('hPlanStart').hidden = run;
    $('hPlanInfo').textContent = run ? (ST.plan.i + 1) + '/' + ST.plan.n + '단계 · ' + ST.plan.label : '순서를 고르고 시작을 누르세요';
    $('hPause').textContent = ST.timer && ST.timer.paused ? '재개' : '일시정지';
    $('hHold').setAttribute('aria-pressed', ST.hold ? 'true' : 'false');
    $('hHold').title = ST.hold ? '켜짐' : '꺼짐';
    document.querySelectorAll('#hSpeed [data-hspeed]').forEach(function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-hspeed') === ST.speed ? 'true' : 'false'); });
    $('hManualTimers').classList.toggle('off', run);
    $('hPhaseG').setAttribute('aria-pressed', ST.phase === 'guide' ? 'true' : 'false');
    $('hPhaseF').setAttribute('aria-pressed', ST.phase === 'free' ? 'true' : 'false');
    $('hPhaseG').disabled = $('hPhaseF').disabled = run;
    var artOn = ST.art !== false;
    $('hArt').setAttribute('aria-pressed', artOn ? 'true' : 'false');
    $('hArt').title = artOn ? '켜짐' : '꺼짐';
    if (document.activeElement !== $('hNote') && $('hNote').value !== ST.note && ST.note) $('hNote').value = ST.note;
    renderStory();
    tick();
  }
  // ---- closing timer: the last free look on the story's sky, then every phone goes black with "take the headset off" ----
  function clRender() {
    var T = ST && ST.timer && ST.timer.closing ? ST.timer : null, closed = !!(ST && ST.close);
    $('clState').textContent = T ? fmtTime(timerRem()) + (T.paused ? ' (멈춤)' : '') : closed ? '끝' : '';
    $('clText').textContent = T ? '폰 위쪽에 남은 시간이 떠 있어요. 별자리를 바라보면 그림과 설명이 나와요. 끝나면 화면이 검게 바뀌고 ‘헤드셋을 천천히 벗어 주세요’가 떠요.'
      : closed ? '폰에 ‘헤드셋을 천천히 벗어 주세요’가 떠 있어요. 안내 지우기를 누르면 사라져요.'
      : '이야기 마지막 장면에서 누르면, 그 하늘 그대로 자유 관찰 시간이 시작돼요.';
    $('clStart').textContent = T || closed ? '다시 시작' : '타이머 시작';
    $('clNow').disabled = !T; $('clOff').disabled = !T && !closed;
  }
  function tick() {
    storyState();
    clRender();
    if (typeof introRender === 'function') introRender();
    if (!ST) return;
    var rem = timerRem();
    $('hBig').textContent = (curStory() ? '이야기 ' + (ST.story.i + 1) + '장면' : phaseName(ST.phase)) + (ST.timer ? '  ' + (ST.timer.label ? ST.timer.label + ' ' : '') + fmtTime(rem) + (ST.timer.paused ? ' (멈춤)' : '') : '');
    var mins = curMinutes();
    $('hClock').textContent = clockText(mins);
    if (document.activeElement !== $('hTime')) $('hTime').value = Math.round(mins);
    useSky(curStory() ? null : (C.skyOk(ST.sky) ? ST.sky : null));
    renderSky();
    var M = C.eqjToEnu(S, mins);
    document.querySelectorAll('#hSpots button[data-spot]').forEach(function (b) {
      var sp = SPOTS.filter(function (x) { return x.id === b.getAttribute('data-spot'); })[0]; if (!sp) return;
      var v = sp.body ? C.radec2vec.apply(null, C.bodyRaDec(S, sp.body, mins)) : sp.v;
      var aa = C.enuToAltAz(C.apply(M, v));
      b.querySelector('small').textContent = aa.alt < 0 ? '지평선 아래' : DIRS[Math.round(aa.az / 45) % 8] + '쪽 · 높이 ' + Math.round(aa.alt) + '°';
      b.classList.toggle('below', aa.alt < 0);
      b.setAttribute('aria-pressed', ST.spot === sp.id && ST.phase === 'guide' ? 'true' : (ST.spot === sp.id ? 'true' : 'false'));
    });
  }
  setInterval(tick, 500);

  // ---- time jumps ----
  document.querySelectorAll('[data-hstep]').forEach(function (b) { b.addEventListener('click', function () { cmd('step', { v: +b.getAttribute('data-hstep') }); }); });

  // ---- what every phone draws ----
  var DISP = [['art', '별자리 그림'], ['lines', '별자리 선'], ['names', '별자리 이름'], ['stars', '별 이름'], ['trails', '별의 궤적'], ['mw', '은하수'], ['dirs', '동서남북']];
  DISP.forEach(function (d) {
    var lab = document.createElement('span'); lab.textContent = d[1];
    var seg = document.createElement('div'); seg.className = 'seg';
    [['on', '켬'], ['off', '끔'], ['', '각자']].forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'hb'; b.textContent = o[1];
      b.setAttribute('data-disp', d[0]); b.setAttribute('data-dv', o[0]); b.setAttribute('aria-pressed', o[0] === '' ? 'true' : 'false');
      b.addEventListener('click', function () { cmd('show', { key: d[0], v: o[0] === 'on' ? true : o[0] === 'off' ? false : null }); });
      seg.appendChild(b);
    });
    $('hDisp').appendChild(lab); $('hDisp').appendChild(seg);
  });
  function renderDisp() {
    var ds = (ST && ST.disp) || {};
    document.querySelectorAll('[data-disp]').forEach(function (b) {
      var v = ds[b.getAttribute('data-disp')], cur = v === true ? 'on' : v === false ? 'off' : '';
      b.setAttribute('aria-pressed', b.getAttribute('data-dv') === cur ? 'true' : 'false');
    });
  }
  setInterval(renderDisp, 500);

  // ---- quiz ----
  (window.QUIZZES || []).forEach(function (q, i) {
    var o = document.createElement('option'); o.value = i; o.textContent = (q.type === 'find' ? '[찾기] ' : '[고르기] ') + q.q; $('qzSel').appendChild(o);
  });
  function openQuiz(q) { cmd('quiz', { v: 'open', q: { type: q.type, q: q.q, opts: q.opts || [], ans: q.ans || 0, target: q.target || null, ex: q.ex || '' } }); }
  $('qzOpen').addEventListener('click', function () { var q = (window.QUIZZES || [])[+$('qzSel').value]; if (q) openQuiz(q); });
  $('qzReveal').addEventListener('click', function () { cmd('quiz', { v: 'reveal' }); });
  $('qzOff').addEventListener('click', function () { cmd('quiz', { v: 'off' }); });
  $('qzMakeChoice').addEventListener('click', function () {
    var q = $('qzMQ').value.trim(), opts = [], ans = +(document.querySelector('[name=qzAns]:checked') || { value: 0 }).value, map = [];
    for (var i = 0; i < 4; i++) { var t = $('qzM' + i).value.trim(); if (t) { if (i === ans) ans = opts.length; map.push(i); opts.push(t); } }
    if (!q || opts.length < 2) { alert('질문과 보기를 두 개 이상 써 주세요.'); return; }
    if (map.indexOf(+(document.querySelector('[name=qzAns]:checked') || { value: 0 }).value) < 0) { alert('정답으로 고른 보기가 비어 있어요.'); return; }
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
    $('qzCount').textContent = '답한 폰 ' + qc.answered + ' / ' + phones + '대' + (q.type === 'choice' ? ' · 초록 테두리가 정답' : '');
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

  // ---- date & place for every phone ----
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function today(tz) { var d = new Date(Date.now() + tz * 3600000); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function curSky() { return ST && C.skyOk(ST.sky) ? ST.sky : C.EVENT; }
  function sendSky(date, place) {
    var cur = curSky(); date = date || cur.date; place = place || cur.place || 'osong';
    var p = C.PLACES[place] || C.PLACES.osong;
    if (date === C.EVENT.date && place === 'osong') cmd('sky', {});
    else cmd('sky', { date: date, place: place, name: p.name, lat: p.lat, lon: p.lon, tz: p.tz });
  }
  function renderSky() {
    var k = curSky(), d = k.date.split('-');
    $('hWhere').textContent = +d[0] + '. ' + +d[1] + '. ' + +d[2] + ' · ' + (k.name || (C.PLACES[k.place] || C.PLACES.osong).name) + (curStory() ? '  (이야기 중에는 관측회 날)' : '');
    if (document.activeElement !== $('hDate')) $('hDate').value = k.date;
    document.querySelectorAll('[data-hplace]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-hplace') === (k.place || 'osong') ? 'true' : 'false'); });
    $('hSkyEvent').setAttribute('aria-pressed', k.date === C.EVENT.date ? 'true' : 'false');
    $('hSkyToday').setAttribute('aria-pressed', k.date !== C.EVENT.date && k.date === today(k.tz) ? 'true' : 'false');
  }
  document.querySelectorAll('[data-hplace]').forEach(function (b) { b.addEventListener('click', function () { sendSky(null, b.getAttribute('data-hplace')); }); });
  $('hSkyEvent').addEventListener('click', function () { sendSky(C.EVENT.date, null); });
  $('hSkyToday').addEventListener('click', function () { sendSky(today(curSky().tz), null); });
  $('hDate').addEventListener('change', function () { if (/^\d{4}-\d{2}-\d{2}$/.test(this.value)) sendSky(this.value, null); });

  // ---- opening film (체험 시작) ----
  // same timeline numbers as the phones (sky_app.js INTRO), used here only to show what the phones are doing
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
    var f = film.status === 'ok' ? '오프닝 영상 ' + (film.dur ? Math.round(film.dur) + '초' : '') + ' · 영상이 준비된 폰 ' + (counts.film || 0) + '/' + (counts.phones || 0) + '대' + (counts.filmFail ? ' (못 불러온 폰 ' + counts.filmFail + '대는 영상 없이 넘어가요)' : '') :
      film.status === 'none' ? '오프닝 영상 파일이 아직 없어요. 시작하면 검은 화면 뒤 바로 별 화면이 나타나요.' : '오프닝 영상 확인 중…';
    $('iFilm').textContent = f;
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


  // ---- host sky view (iframe of the phone page in host mode) ----
  var view = { yaw: 150, pitch: 30, fov: 75 }, follow = false, followAt = 0, lastSend = 0, sendT = null, endT = null;
  (function () {
    var src = new URL('./', location.href).href + '?r=' + room + '&hostview=1';
    if (sv) src += '&server=' + encodeURIComponent(SERVER);
    $('hSky').src = src;
  })();
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
  function renderFollow() {
    $('hFollow').setAttribute('aria-pressed', follow ? 'true' : 'false');
    $('hFollow').title = follow ? '켜짐' : '꺼짐';
    document.querySelector('.hview').classList.toggle('live', follow);
  }
  $('hFollow').addEventListener('click', function () { follow = !follow; followAt = Date.now(); renderFollow(); sendView(true); });

  // ---- participant previews (same page as phones, mouse stands in for the head) ----
  var prevOn = true;
  try { prevOn = localStorage.getItem('osong-prev') !== 'off'; } catch (e) {}
  function prevSrc(mode) {
    var u = new URL('./', location.href).href + '?sim=' + mode + '&r=' + room;
    if (sv) u += '&server=' + encodeURIComponent(SERVER);
    return u;
  }
  function renderPrev() {
    $('hPrev').hidden = !prevOn;
    $('hPrevToggle').setAttribute('aria-pressed', prevOn ? 'true' : 'false');
    $('hPrevToggle').title = prevOn ? '보이는 중' : '숨김';
    // unloading the frames when hidden keeps the laptop from drawing three skies at once
    $('pVR').src = prevOn ? prevSrc('vr') : 'about:blank';
    $('pSC').src = prevOn ? prevSrc('screen') : 'about:blank';
  }
  $('hPrevToggle').addEventListener('click', function () { prevOn = !prevOn; try { localStorage.setItem('osong-prev', prevOn ? 'on' : 'off'); } catch (e) {} renderPrev(); });
  renderPrev();

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
    var cs = curStory(), show = cs ? showBy(cs.show) : showBy($('sShow').value);
    if (!show) return;
    // follow the server only when it switches to another show, so a choice you just made in the list is kept
    var srv = cs ? cs.show : null;
    if (srv && srv !== lastServerShow) $('sShow').value = srv;
    lastServerShow = srv;
    if (cs && cs.show !== $('sShow').value) cs = null;
    show = cs ? showBy(cs.show) : showBy($('sShow').value);
    var n = show.scenes.length, i = cs ? cs.i : -1;
    var list = $('sList');
    if (list.getAttribute('data-show') !== show.id) {
      list.innerHTML = ''; list.setAttribute('data-show', show.id);
      show.scenes.forEach(function (sc, j) {
        var li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.innerHTML = '<span class="n"></span><span class="t"></span>';
        b.querySelector('.n').textContent = (j < 9 ? '0' : '') + (j + 1); b.querySelector('.t').textContent = sc.title;
        b.addEventListener('click', function () { cmd('story', { show: show.id, i: j }); });
        li.appendChild(b); list.appendChild(li);
      });
    }
    list.querySelectorAll('button').forEach(function (b, j) { if (j === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    if (cs) {
      var sc = show.scenes[i];
      $('sTitle').textContent = (i + 1) + '. ' + (sc.title || '');
      $('sCue').textContent = sc.cue || ''; $('sNote').textContent = sc.note || '';
      $('sGo').textContent = i + 1 < n ? '다음 장면' : '마지막 장면'; $('sGo').disabled = i + 1 >= n;
      $('sPrev').disabled = i <= 0; $('sEnd').disabled = false;
    } else {
      $('sTitle').textContent = '1. ' + (show.scenes[0].title || '');
      $('sCue').textContent = show.scenes[0].cue || ''; $('sNote').textContent = show.scenes[0].note || '';
      $('sGo').textContent = '시작'; $('sGo').disabled = false; $('sPrev').disabled = true; $('sEnd').disabled = true;
    }
  }
  function storyState() {
    var cs = curStory(), bar = $('sProg'), box = bar.parentNode;
    if (!cs) { box.className = 'sprog done'; bar.style.width = '0'; return; }
    var sc = showBy(cs.show).scenes[cs.i], total = Math.max(0.1, settleTime(sc)), p = Math.min(1, (Date.now() - storyT0) / 1000 / total);
    bar.style.width = (p * 100).toFixed(1) + '%'; box.className = p >= 1 ? 'sprog done' : 'sprog';
  }
  $('sShow').addEventListener('change', function () { renderStory(); });
  $('sGo').addEventListener('click', function () {
    var cs = curStory(), show = showBy($('sShow').value); if (!show) return;
    if (!cs || cs.show !== show.id) cmd('story', { show: show.id, i: 0 });
    else if (cs.i + 1 < show.scenes.length) cmd('story', { show: show.id, i: cs.i + 1 });
  });
  $('sPrev').addEventListener('click', function () { var cs = curStory(); if (cs && cs.i > 0) cmd('story', { show: cs.show, i: cs.i - 1 }); });
  $('sEnd').addEventListener('click', function () { cmd('story', { show: null }); });
  $('clStart').addEventListener('click', function () {
    var cs = curStory(), extra = { v: 'run', min: Math.max(0.25, Math.min(30, +$('clMin').value || 3)) };
    if (cs) { var sc = showBy(cs.show).scenes[cs.i]; if (sc && sc.view) extra.time = sc.view.minutes; }   // keep the story's sky time
    cmd('closing', extra);
  });
  $('clNow').addEventListener('click', function () { if (!this.disabled) cmd('closing', { v: 'done' }); });
  $('clOff').addEventListener('click', function () { if (!this.disabled) cmd('closing', { v: 'off' }); });
  document.addEventListener('keydown', function (e) {
    var tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || !authed) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (!$('sGo').disabled) $('sGo').click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); $('sPrev').click(); }
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
  var box = $('hSpots');
  SPOTS.forEach(function (sp) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'spot'; b.setAttribute('data-spot', sp.id); b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span></span><small></small>'; b.firstChild.textContent = sp.name;
    b.addEventListener('click', function () {
      var off = ST && ST.spot === sp.id;
      cmd('spot', { v: off ? null : sp.id });
      if (!off) try { $('hSky').contentWindow.postMessage({ type: 'osong-lookat', id: sp.id }, '*'); } catch (e) {}
    });
    box.appendChild(b);
  });
  $('hArt').addEventListener('click', function () { cmd('show', { key: 'art', v: !(ST && ST.art !== false) ? true : false }); });
  $('hSpotOff').addEventListener('click', function () { cmd('spot', { v: null }); });
  $('hOrderGF').addEventListener('click', function () { order = 'GF'; render(); });
  $('hOrderFG').addEventListener('click', function () { order = 'FG'; render(); });
  $('hPlanStart').addEventListener('click', function () { cmd('planStart', { order: order, g: +$('hGMin').value || 10, f: +$('hFMin').value || 10 }); });
  $('hNext').addEventListener('click', function () { cmd('next'); });
  $('hStop').addEventListener('click', function () { cmd('stop'); });
  $('hPause').addEventListener('click', function () { cmd('pause'); });
  $('hPhaseG').addEventListener('click', function () { cmd('phase', { v: 'guide' }); });
  $('hPhaseF').addEventListener('click', function () { cmd('phase', { v: 'free' }); });
  var tPub = null;
  $('hTime').addEventListener('input', function () { var v = +this.value; clearTimeout(tPub); tPub = setTimeout(function () { cmd('time', { v: v }); }, 150); });
  document.querySelectorAll('#hSpeed [data-hspeed]').forEach(function (b) { b.addEventListener('click', function () { cmd('speed', { v: +b.getAttribute('data-hspeed') }); }); });
  document.querySelectorAll('[data-htimer]').forEach(function (b) { b.addEventListener('click', function () { cmd('timer', { min: +b.getAttribute('data-htimer') }); }); });
  $('hTimerCustom').addEventListener('click', function () { var m = +$('hTimerMin').value; if (m > 0) cmd('timer', { min: m, label: $('hTimerLabel').value.trim() }); });
  $('hTimerOff').addEventListener('click', function () { cmd('timer', { min: 0 }); });
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
  window.__admin = { send: send, room: function () { return room; }, server: function () { return SERVER; }, state: function () { return ST; } };
})();
