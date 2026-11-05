// Presenter console layout glue (admin.html redesign). js/admin.js keeps all the logic and the connection;
// this file only adds the new layout pieces on top of it:
//  - header tabs (운영 제어 / 콘텐츠 관리 / 참가자 관리 / 설정)
//  - the big mirror: one participant's live snapshot (from js/cctv.js) or the presenter's own sky, plus split view
//  - the four playback buttons, the speed select and the narration bar under the mirror
// Nothing here invents data: every number and label comes from the server state or the participants' snapshots.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var A = window.__admin; if (!A || !$('mirStage')) return;
  var MODE = { vr: 'VR', screen: '화면', menu: '메뉴' };

  // ---- tabs ----
  var tabs = document.querySelectorAll('.nav-btn[data-tab]');
  function setTab(name) {
    var ok = false;
    tabs.forEach(function (b) { var on = b.getAttribute('data-tab') === name; ok = ok || on; b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    if (!ok) return setTab('ops');
    document.querySelectorAll('.tab[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
    $('hostPanel') && ($('hostPanel').scrollTop = 0);
    try { localStorage.setItem('osong-admintab', name); } catch (e) {}
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); }); });
  var saved = 'ops'; try { saved = localStorage.getItem('osong-admintab') || 'ops'; } catch (e) {}
  setTab(saved);

  // ---- mirror ----
  var cams = {}, pick = 'auto', split = false;   // pick: 'auto' (first participant), 'host' or a participant id
  function camList() { return Object.keys(cams).map(function (k) { return cams[k]; }).sort(function (a, b) { return a.n - b.n; }); }
  function chosen() {
    if (pick === 'host') return null;
    if (pick !== 'auto' && cams[pick]) return cams[pick];
    var l = camList(); return l.length ? l[0] : null;
  }
  function fillSelect() {
    var sel = $('mirSel'), l = camList(), want = pick === 'auto' ? (l.length ? l[0].id : 'host') : pick;
    var html = '<option value="host">진행자 화면</option>';
    l.forEach(function (c) { html += '<option value="' + c.id + '">참가자 ' + c.n + ' · ' + (MODE[c.m] || c.m || '') + '</option>'; });
    if (sel.getAttribute('data-sig') !== html) { sel.innerHTML = html; sel.setAttribute('data-sig', html); }
    if (pick !== 'auto' && pick !== 'host' && !cams[pick]) want = 'host';   // the chosen phone left: say so in the stage
    sel.value = cams[want] || want === 'host' ? want : 'host';
  }
  function renderMirror() {
    var c = chosen(), host = pick === 'host' || (!c && pick === 'auto' && false);
    var lost = pick !== 'auto' && pick !== 'host' && !cams[pick];
    var noOne = pick === 'auto' && !c;
    $('mirSplitBox').hidden = !split;
    $('mirSplit').setAttribute('aria-pressed', split ? 'true' : 'false');
    var showHost = !split && (host || noOne);
    $('hSky').style.visibility = showHost ? 'visible' : 'hidden';
    $('mirImg').hidden = split || !c || lost;
    var wait = !split && (lost || (c && Date.now() - c.at > 6000));
    $('mirWait').hidden = !wait;
    if (lost) { $('mirWaitT').textContent = '선택한 참가자의 연결이 끊겼어요'; $('mirWaitS').textContent = '대표 화면에서 다른 참가자를 고르거나 진행자 화면으로 바꿔 주세요.'; }
    else if (wait) { $('mirWaitT').textContent = '참가자 ' + c.n + '의 화면을 기다리는 중'; $('mirWaitS').textContent = '마지막 화면은 ' + Math.round((Date.now() - c.at) / 1000) + '초 전이에요. 휴대폰이 잠들었거나 연결이 약할 수 있어요.'; }
    if (c && !split && !lost && $('mirImg').getAttribute('src') !== c.img) $('mirImg').src = c.img;
    var live = false, meta = '';
    if (split) { var n = camList().length; meta = n ? '참가자 ' + n + '명 화면' : '참가자 화면이 아직 없어요'; live = n > 0; }
    else if (c && !lost) { live = Date.now() - c.at <= 6000; meta = '참가자 ' + c.n + ' · ' + (MODE[c.m] || c.m || '') + (c.m !== 'menu' && c.d ? ' · ' + c.d : '') + (c.s ? ' · ' + c.s : ''); }
    else if (showHost) { meta = noOne ? '참가자 화면이 없어서 진행자 화면을 보여줘요' : '진행자 노트북의 하늘'; live = !!A.authed(); }
    $('mirLive').textContent = live ? '(LIVE)' : '';
    $('mirMeta').textContent = meta;
  }
  window.addEventListener('cctv:frame', function (e) {
    var d = e.detail, c = cams[d.id] || (cams[d.id] = { id: d.id, n: d.n });
    c.img = d.img; c.m = d.m; c.d = d.d; c.s = d.s; c.at = Date.now();
    fillSelect(); renderMirror();
  });
  window.addEventListener('cctv:gone', function (e) { delete cams[e.detail.id]; fillSelect(); renderMirror(); });
  $('mirSel').addEventListener('change', function () {
    var v = this.value; pick = v; if (split) setSplit(false); fillSelect(); renderMirror();
  });
  function setSplit(on) {
    split = on;
    var wallOpen = !$('cctvWall').hidden;
    if (!wallOpen) (on ? $('mirSplitBox') : $('cctvHome')).appendChild($('cctvGrid'));
    renderMirror();
  }
  window.__cctvHomeOverride = function () { return split ? $('mirSplitBox') : $('cctvHome'); };
  $('mirSplit').addEventListener('click', function () { setSplit(!split); });
  $('mirSplitBox').addEventListener('click', function (e) {   // pick a tile to show it large
    var fig = e.target.closest('.cam'); if (!fig) return;
    var n = +((fig.querySelector('b') || {}).textContent), l = camList();
    for (var i = 0; i < l.length; i++) if (l[i].n === n) { pick = l[i].id; setSplit(false); fillSelect(); renderMirror(); return; }
  });

  // ---- playback controls ----
  var restartArm = 0, restartT = null, lastSpeed = 1;
  function state() { return A.state(); }
  function renderCtrls() {
    var ST = state(), cs = A.curStory(), ok = A.authed() && !!ST;
    var pb = $('cPause'), lbl = pb.querySelector('.lbl'), ic = pb.querySelector('use');
    var note = '';
    if (ok && cs) {   // a story: the scene and its effects stand still on every phone
      pb.disabled = false; lbl.textContent = cs.paused ? '재생' : '일시정지';
      ic.setAttribute('href', cs.paused ? '#i-play' : '#i-pause'); pb.title = '이야기 장면과 효과를 멈추거나 이어가요';
      if (cs.paused) note = ST.quiz ? '퀴즈가 열려 있어서 이야기가 멈춰 있어요. 퀴즈를 끝내면 이어져요.' : '이야기가 멈춰 있어요. 재생을 누르면 이어져요.';
    } else if (ok && ST.timer) {
      pb.disabled = false; lbl.textContent = ST.timer.paused ? '재생' : '일시정지';
      ic.setAttribute('href', ST.timer.paused ? '#i-play' : '#i-pause'); pb.title = '진행 타이머를 멈추거나 이어가요';
    } else if (ok && !cs) {
      pb.disabled = false; lbl.textContent = ST.speed ? '일시정지' : '재생';
      ic.setAttribute('href', ST.speed ? '#i-pause' : '#i-play'); pb.title = '하늘 시간 흐름을 멈추거나 이어가요';
    } else {
      pb.disabled = true; lbl.textContent = '일시정지'; ic.setAttribute('href', '#i-pause');
    }
    if (ST && ST.speed) lastSpeed = ST.speed;
    var rb = $('cRestart');
    rb.disabled = !ok || !cs;
    rb.classList.toggle('is-on', restartArm > Date.now());
    rb.querySelector('.lbl').textContent = restartArm > Date.now() ? '한 번 더' : '재시작';
    if (restartArm > Date.now()) note = '재시작을 한 번 더 누르면 1단계부터 다시 시작해요.';
    $('cNote').textContent = note;
    if (ST && document.activeElement !== $('tSpeed')) {
      var v = String(ST.speed), opt = $('tSpeed').querySelector('option[value="' + v + '"]');
      if (opt) $('tSpeed').value = v;
    }
    $('tSpeed').disabled = !ok;
    $('tClock').textContent = $('hClock').textContent;
  }
  $('cPause').addEventListener('click', function () {
    var ST = state(); if (!ST) return;
    var cs = A.curStory();
    if (cs) A.cmd('storypause', { v: !cs.paused });
    else if (ST.timer) A.cmd('pause');
    else A.cmd('speed', { v: ST.speed ? 0 : (lastSpeed || 1) });
  });
  $('cRestart').addEventListener('click', function () {
    var cs = A.curStory(); if (!cs) return;
    if (restartArm > Date.now()) { restartArm = 0; A.storyCmd(cs.show, 0); }
    else { restartArm = Date.now() + 3000; clearTimeout(restartT); restartT = setTimeout(tick, 3050); }
    tick();
  });
  $('tSpeed').addEventListener('change', function () { A.cmd('speed', { v: +this.value }); });

  // ---- narration bar ----
  $('nPrev').addEventListener('click', function () { if (!$('sPrev').disabled) $('sPrev').click(); });
  $('nNext').addEventListener('click', function () { if (!$('sGo').disabled) $('sGo').click(); });
  function renderNarr() {
    var ST = state(), cs = A.curStory(), t = '', s = '';
    if (cs) {
      var show = A.showBy(cs.show), sc = show && show.scenes[cs.i];
      if (sc) { t = sc.title || ''; s = sc.sub || ''; }
      if (ST && ST.close) s = (s ? s + ' · ' : '') + '마무리 화면';
    } else if (ST && ST.close) { t = '마무리 화면이 켜져 있어요'; }
    else if (ST && ST.note) { t = ST.note; s = '참가자에게 보낸 메시지'; }
    else if (!A.authed()) { t = '관리자 연결을 기다리는 중'; }
    else { t = '진행 중인 이야기가 없어요'; s = '왼쪽에서 이야기를 고르고 ‘이야기 시작’을 눌러 주세요.'; }
    $('nTitle').textContent = t; $('nSub').textContent = s;
    $('nPrev').disabled = $('sPrev').disabled;
    $('nNext').disabled = $('sGo').disabled || !cs;
  }

  // ---- header status dot, timeline scroll ----
  var lastStep = '';
  function renderHead() {
    var ST = state(), dot = $('sessDot'), conn = $('hConn').classList.contains('ok');
    dot.className = 'dot' + (!conn ? ' bad' : ST && (A.curStory() || ST.timer || ST.phase !== 'idle') ? ' ok' : '');
    var cur = document.querySelector('#sList button[aria-current="step"]'), key = cur ? $('sList').getAttribute('data-show') + cur.textContent : '';
    if (cur && key !== lastStep) {
      var L = $('sList'), top = cur.parentNode.offsetTop - L.offsetTop, h = cur.offsetHeight;
      if (top < L.scrollTop || top + h > L.scrollTop + L.clientHeight) L.scrollTop = Math.max(0, top - L.clientHeight / 2 + h / 2);
    }
    lastStep = key;
  }

  function tick() { renderCtrls(); renderNarr(); renderHead(); renderMirror(); }
  setInterval(tick, 500);
  fillSelect(); tick();
  window.__adminUI = { setTab: setTab, setSplit: setSplit, pick: function (v) { pick = v; fillSelect(); renderMirror(); }, cams: function () { return camList(); } };
})();
