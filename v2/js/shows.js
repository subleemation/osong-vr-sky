// Shows are paced by the presenter: each scene plays a short opening animation, then holds
// until the presenter presses "next". Every phone evaluates the same scene from the same scene clock.
//
// scene fields
//   view     where the scene ends up: { target, fov, minutes }
//            target: {cons:'Peg'} | {star:'북극성'} | {dso:'안드로메다은하'} | {body:'Saturn'} | {altaz:[alt, az]}
//            minutes: sky clock, minutes after 18:00 KST
//   move     seconds to glide from the previous scene's view
//   fx       opening effects, each with `at` (s from scene start) and `dur`:
//            {type:'timelapse', from, to}           sky clock runs fast from -> to (minutes)
//            {type:'lightsOut', from, to}           naked-eye limit rises: stars come out one by one
//            {type:'labels', to}                    fade names/lines to `to` (0..1), e.g. to clean the sky
//            {type:'lines', cons:[...]}             stick figures drawn stroke by stroke
//            {type:'art', cons:[...], stagger}      illustrations fade in one after another
//            {type:'trails', hours}                 star trails around the pole (Earth's rotation)
//            {type:'pointer', from, to}             dotted guide from one named star to another
//            {type:'eyepiece', body}                telescope view of a planet
//   keepArt  illustrations from earlier scenes that stay visible
//   title, sub   caption on every phone          note   presenter script (host only)
//   cue          one-line audience prompt shown big on the host screen
var SHOWS = [
  {
    id: 'autumn',
    title: '가을 밤하늘, 에티오피아 왕가 이야기',
    blurb: '노을에서 별이 켜지는 순간부터 왕비 카시오페이아와 페르세우스 이야기, 안드로메다은하, 토성까지. 진행자가 장면을 넘겨요.',
    scenes: [
      { view: { target: { altaz: [30, 248] }, fov: 100, minutes: 92 }, move: 0,
        fx: [{ type: 'timelapse', from: 0, to: 92, at: 0.5, dur: 16 }, { type: 'labels', from: 0, to: 1, at: 15, dur: 2 }],
        start: { target: { altaz: [8, 250] }, fov: 100, minutes: 0 },
        title: '해가 지면, 별이 하나씩', sub: '오후 6시 → 7시 반, 16초 만에',
        cue: '가장 먼저 보이는 별을 찾으면 손을 들어 주세요',
        note: '오늘 해는 오후 5시 35분쯤 졌어요. 지금부터 한 시간 반을 16초로 줄여서 보여 드릴게요. 하늘이 어두워지면서 별이 하나씩 켜져요. 제일 먼저 보이는 별을 찾으면 손을 들어 보세요. (멈추면) 처음에 보인 밝은 별들이 직녀성, 견우성, 아크투루스예요. 1등성처럼 밝은 별일수록 먼저 보여요.' },

      { view: { target: { altaz: [58, 175] }, fov: 108, minutes: 92 }, move: 5,
        fx: [{ type: 'labels', from: 1, to: 0, at: 0, dur: 1.5 }, { type: 'lightsOut', from: 2.5, to: 6.3, at: 2, dur: 12 }],
        title: '도시의 불을 모두 끈다면', sub: '보이는 별: 200개 → 4,000개',
        cue: '지금 우리 공원에서는 몇 등성까지 보일까요?',
        note: '별이 얼마나 보이는지는 하늘이 얼마나 어두운지에 달려 있어요. 도시 한가운데서는 별이 200개 정도밖에 안 보이지만, 불빛이 하나도 없는 산골에서는 맨눈으로 4천 개 넘게 보여요. 지금 화면이 그 산골 하늘이에요. 가운데를 가로지르는 뿌연 띠가 은하수예요. 우리 은하를 옆에서 본 모습이에요. 오송 공원에서는 이것보다는 덜 보이지만, 눈이 어둠에 익으면 은하수도 희미하게 볼 수 있어요.' },

      { view: { target: { star: '북극성' }, fov: 96, minutes: 92 }, move: 6,
        fx: [{ type: 'labels', from: 0, to: 1, at: 0, dur: 2 }, { type: 'trails', hours: 4, at: 3, dur: 8 },
             { type: 'lines', cons: ['UMi', 'Cas'], at: 6, dur: 3 }, { type: 'pointer', from: '나비', to: '북극성', at: 10, dur: 2.5 }],
        title: '움직이지 않는 별, 북극성', sub: '모든 별이 이 별을 중심으로 돌아요',
        cue: '주먹을 쥐고 팔을 뻗어, 지평선에서 주먹 네 개 위를 보세요',
        note: '북쪽을 보세요. 지구가 돌기 때문에 별들은 하룻밤 동안 하늘에서 큰 원을 그려요. 지금 보이는 줄무늬가 4시간 동안 별이 지나간 길이에요. 그런데 가운데 한 별만 거의 움직이지 않죠. 북극성이에요. 주먹을 쥐고 팔을 쭉 뻗으면 주먹 하나가 약 10도예요. 지평선에서 주먹 네 개 쯤, 37도 높이에 북극성이 있어요. 오송의 위도가 37도라서 그래요. W 모양 카시오페이아에서 점선을 따라가도 찾을 수 있어요.' },

      { view: { target: { cons: 'Cas' }, fov: 80, minutes: 92 }, move: 5,
        fx: [{ type: 'lines', cons: ['Cas', 'Cep'], at: 2, dur: 3 }, { type: 'art', cons: ['Cas', 'Cep'], at: 4, dur: 2, stagger: 2.5 }],
        title: '자랑이 많은 왕비', sub: '카시오페이아와 케페우스 왕',
        cue: '여러분이 가장 자랑하고 싶은 건 뭔가요?',
        note: '오늘 밤 가을 하늘에는 한 가족의 이야기가 통째로 떠 있어요. 옛날 에티오피아에 케페우스 왕과 카시오페이아 왕비가 살았어요. 왕비는 딸 안드로메다가 너무 예뻐서 “바다의 요정들보다 우리 딸이 더 아름답다”고 자랑하고 다녔어요. 이 말을 들은 바다의 신 포세이돈이 화가 났어요. 그 벌로 왕비는 의자에 묶인 채 하늘을 돌게 됐는데, 그래서 밤이 깊어지면 거꾸로 매달린 모습이 돼요.' },

      { view: { target: { cons: 'Cet' }, fov: 92, minutes: 92 }, move: 6,
        fx: [{ type: 'lines', cons: ['Cet'], at: 2, dur: 3 }, { type: 'art', cons: ['Cet'], at: 4, dur: 2.5 }],
        keepArt: ['Cas', 'Cep'],
        title: '바다 괴물 케투스', sub: '고래자리',
        cue: '괴물 근처에서 흔들리지 않고 빛나는 노란 점을 찾아보세요',
        note: '포세이돈은 에티오피아 바다에 괴물 케투스를 보냈어요. 마을을 부수고 사람들을 괴롭혔죠. 지금 동쪽 낮은 곳에 있는 고래자리가 바로 그 괴물이에요. 하늘에서 네 번째로 큰 별자리예요. 괴물 머리 근처에 노란 점이 하나 보이죠? 그건 별이 아니라 토성이에요. 이따 망원경으로 볼 거예요.' },

      { view: { target: { cons: 'And' }, fov: 84, minutes: 92 }, move: 6,
        fx: [{ type: 'lines', cons: ['And'], at: 2, dur: 3 }, { type: 'art', cons: ['And'], at: 4, dur: 2.5 }],
        keepArt: ['Cas', 'Cep', 'Cet'],
        title: '사슬에 묶인 공주', sub: '안드로메다',
        cue: '공주를 구하려면 누가 와야 할까요?',
        note: '괴물을 멈추려면 공주 안드로메다를 바쳐야 한다는 신탁이 내려왔어요. 결국 공주는 바닷가 바위에 사슬로 묶였어요. 하늘에서도 안드로메다자리는 엄마 카시오페이아와 괴물 사이에 있어요. 팔을 벌린 채 묶여 있는 모습이 보이나요?' },

      { view: { target: { cons: 'Per' }, fov: 84, minutes: 92 }, move: 6,
        fx: [{ type: 'lines', cons: ['Per'], at: 2, dur: 3 }, { type: 'art', cons: ['Per'], at: 4, dur: 2.5 }],
        keepArt: ['Cas', 'Cep', 'Cet', 'And'],
        title: '영웅 페르세우스', sub: '손에 든 것은 메두사의 머리',
        cue: '메두사의 눈 자리에 있는 별 ‘알골’을 찾아보세요',
        note: '그때 하늘을 날아 영웅 페르세우스가 나타났어요. 마침 괴물 메두사를 물리치고 돌아오던 길이었죠. 메두사의 얼굴을 본 사람은 돌이 된대요. 페르세우스가 메두사의 머리를 꺼내 들자, 바다 괴물은 그대로 돌이 되어 가라앉았어요. 메두사의 눈 자리에 있는 별 알골은 사흘에 한 번씩 어두워졌다 밝아져요. 그래서 옛사람들은 ‘악마의 별’이라고 불렀어요.' },

      { view: { target: { cons: 'Peg' }, fov: 86, minutes: 92 }, move: 6,
        fx: [{ type: 'lines', cons: ['Peg'], at: 2, dur: 3 }, { type: 'art', cons: ['Peg'], at: 4, dur: 2.5 }],
        keepArt: ['Cas', 'Cep', 'Cet', 'And', 'Per'],
        title: '메두사에게서 태어난 말', sub: '페가수스와 가을의 대사각형',
        cue: '대사각형 안에 별이 몇 개 보이는지 세어 보세요',
        note: '메두사가 쓰러질 때 그 피에서 날개 달린 말 페가수스가 태어났대요. 머리 위 높은 곳에 밝은 별 네 개가 만드는 커다란 네모가 페가수스의 몸통, 가을의 대사각형이에요. 네모 안에 별이 몇 개 보이는지 세어 보세요. 하나도 안 보이면 도시 하늘, 네다섯 개 보이면 꽤 어두운 하늘이에요. 이따 진짜 하늘에서도 세어 봐요.' },

      { view: { target: { altaz: [52, 80] }, fov: 122, minutes: 92 }, move: 7,
        fx: [{ type: 'lines', cons: ['Cas', 'Cep', 'Cet', 'And', 'Per', 'Peg'], at: 0, dur: 0.1 }],
        keepArt: ['Cas', 'Cep', 'Cet', 'And', 'Per', 'Peg'],
        title: '하늘에 남은 가족 사진', sub: '여섯 별자리가 한 이야기',
        cue: '이야기 순서대로 손가락으로 따라가 볼까요?',
        note: '한 걸음 물러서서 볼게요. 왕비, 왕, 공주, 영웅, 괴물, 날개 달린 말까지, 이야기에 나온 여섯 주인공이 모두 동쪽 하늘에 모여 있어요. 그리스 사람들은 이 이야기를 잊지 않으려고 하늘에 그대로 그려 넣었어요. 이야기 순서대로 손가락으로 따라가 보세요.' },

      { view: { target: { dso: '안드로메다은하' }, fov: 34, minutes: 92 }, move: 7,
        fx: [],
        keepArt: ['And'],
        title: '250만 년 전에 출발한 빛', sub: '안드로메다은하',
        cue: '이 빛이 출발할 때 지구에는 누가 살았을까요?',
        note: '공주의 허리께를 확대해 볼게요. 점선 동그라미 안의 희뿌연 얼룩이 안드로메다은하예요. 별 1조 개가 모인, 우리 은하의 이웃이에요. 거리는 250만 광년. 지금 우리 눈에 들어오는 빛은 250만 년 전에 출발한 빛이에요. 그때 지구에는 아직 사람이 없고, 사람의 먼 조상이 아프리카에서 살고 있었어요. 맨눈으로 볼 수 있는 가장 먼 천체예요.' },

      { view: { target: { dso: '좀생이별 (플레이아데스)' }, fov: 62, minutes: 152 }, move: 8,
        fx: [{ type: 'timelapse', from: 92, to: 152, at: 0, dur: 8 }, { type: 'lines', cons: ['Tau'], at: 8, dur: 3 }, { type: 'art', cons: ['Tau'], at: 10, dur: 2.5 }],
        title: '좀생이별', sub: '밤 8시 반, 동쪽에서 떠오르는 황소',
        cue: '좀생이별이 몇 개로 보이나요?',
        note: '시간을 한 시간 앞으로 돌렸어요. 동쪽에서 작은 별들이 옹기종기 모인 무리가 올라왔어요. 우리 조상들은 이 별을 좀생이별이라고 불렀어요. 음력 2월 6일 저녁, 좀생이별과 달의 거리를 보고 그해 농사를 점치는 ‘좀생이 보기’라는 풍속도 있었어요. 맨눈으로 몇 개가 보이는지 세어 보세요. 6개가 보이면 보통, 9개 넘게 보이면 눈이 아주 좋은 거예요. 아래쪽 붉은 별 알데바란은 황소의 눈이에요.' },

      { view: { target: { body: 'Saturn' }, fov: 40, minutes: 152 }, move: 7,
        fx: [{ type: 'eyepiece', body: 'Saturn', at: 6, dur: 2 }],
        title: '오늘의 주인공, 토성', sub: '망원경으로 보면 이렇게 보여요',
        cue: '이제 망원경 줄로 이동해 주세요',
        note: '남동쪽에서 흔들림 없이 차분하게 빛나는 노란 점, 토성이에요. 별은 반짝반짝 깜빡이지만 행성은 덜 깜빡여요. 지구에서 약 13억 km, 빛으로 70분 넘게 걸리는 거리예요. 망원경으로 보면 고리가 보이는데, 올해는 고리를 거의 옆에서 보는 해라서 아주 가는 선처럼 보여요. 15년에 한 번 오는 모습이니, 잠시 뒤 망원경으로 꼭 확인해 보세요.' },

      { view: { target: { altaz: [84, 180] }, fov: 118, minutes: 152 }, move: 9,
        fx: [{ type: 'labels', from: 1, to: 0, at: 4, dur: 4 }],
        title: '이제 진짜 하늘로', sub: '헤드셋을 벗고 2분만 어둠에 눈을 맡겨 보세요',
        cue: '휴대폰 화면을 꺼 주세요',
        note: '오늘 본 별자리들은 지금 우리 머리 위에 그대로 있어요. 이름과 선을 지우면 이렇게, 그냥 별만 남아요. 이제 헤드셋을 벗고 진짜 하늘을 올려다봐 주세요. 눈이 어둠에 익는 데 시간이 걸리니 휴대폰 화면은 꺼 두세요. 2분만 기다리면 지금보다 훨씬 많은 별이 보일 거예요.' }
    ]
  }
];

var ShowTimeline = (function () {
  function ease(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function prog(fx, t) { return fx.dur > 0 ? ease((t - fx.at) / fx.dur) : (t >= fx.at ? 1 : 0); }
  function byId(id) { for (var i = 0; i < SHOWS.length; i++) if (SHOWS[i].id === id) return SHOWS[i]; return null; }
  function targetEnu(eng, target, minutes) {
    if (target.altaz) return eng.enuFromAltAz(target.altaz[0], target.altaz[1]);
    var v = target.body ? eng.bodyVec(target.body, minutes) : eng.vecOf(target);
    if (!v) return eng.enuFromAltAz(45, 180);
    return SkyCore.apply(SkyCore.eqjToEnu(window.SKY, minutes), v);
  }
  function slerp(a, b, k) {
    var d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), th = Math.acos(d);
    if (th < 1e-4) return b.slice();
    var s = Math.sin(th), wa = Math.sin((1 - k) * th) / s, wb = Math.sin(k * th) / s;
    return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb];
  }
  function artOf(sc) {
    var ids = (sc.keepArt || []).slice();
    (sc.fx || []).forEach(function (f) { if (f.type === 'art') f.cons.forEach(function (c) { if (ids.indexOf(c) < 0) ids.push(c); }); });
    return ids;
  }
  // seconds until a scene's opening animation is finished
  function settleTime(sc) {
    var t = sc.move || 0;
    (sc.fx || []).forEach(function (f) { t = Math.max(t, f.at + (f.dur || 0) + (f.stagger || 0) * ((f.cons || []).length - 1)); });
    return t;
  }
  // everything a page needs to draw scene `i` at `t` seconds after it started
  function evaluate(eng, show, i, t) {
    i = Math.max(0, Math.min(show.scenes.length - 1, i));
    var s = show.scenes[i], p = i > 0 ? show.scenes[i - 1] : null;
    var from = p ? p.view : (s.start || s.view), to = s.view;
    var k = s.move > 0 ? ease(t / s.move) : 1;
    var minutes = from.minutes + (to.minutes - from.minutes) * k;
    var out = {
      index: i, scene: s, k: k, fov: from.fov + (to.fov - from.fov) * k,
      lim: null, labelAlpha: 1, lineCons: [], figures: {}, pointer: null, trails: null, eyepiece: null,
      settled: t >= settleTime(s)
    };
    if (p) { // labels state carries over from the end of the previous scene
      (p.fx || []).forEach(function (f) { if (f.type === 'labels') out.labelAlpha = f.to; });
    }
    (s.fx || []).forEach(function (f) {
      var q = prog(f, t);
      if (f.type === 'timelapse') minutes = f.from + (f.to - f.from) * q;
      else if (f.type === 'lightsOut') out.lim = f.from + (f.to - f.from) * q;
      else if (f.type === 'labels') { if (t >= f.at) out.labelAlpha = f.from + (f.to - f.from) * q; else out.labelAlpha = f.from; }
      else if (f.type === 'lines') f.cons.forEach(function (c) { out.lineCons.push({ id: c, p: q }); });
      else if (f.type === 'art') f.cons.forEach(function (c, j) {
        var st = f.at + (f.stagger || 0) * j;
        out.figures[c] = { p: f.dur > 0 ? ease((t - st) / f.dur) : 1, a: 1 };
      });
      else if (f.type === 'trails') out.trails = { p: q, hours: f.hours };
      else if (f.type === 'pointer') out.pointer = { from: eng.vecOf({ star: f.from }), to: eng.vecOf({ star: f.to }), p: q };
      else if (f.type === 'eyepiece') out.eyepiece = { body: f.body, a: q };
    });
    (s.keepArt || []).forEach(function (c) { if (!out.figures[c]) out.figures[c] = { p: 1, a: 1 }; });
    (s.keepArt || []).forEach(function (c) { if (out.lineCons.every(function (l) { return l.id !== c; })) out.lineCons.push({ id: c, p: 1 }); });
    if (p) artOf(p).forEach(function (c) { if (!out.figures[c]) out.figures[c] = { p: 1, a: 1 - ease(t / 1.4) }; });
    var hl = null; for (var j = 0; j < out.lineCons.length; j++) if (s.view.target.cons === out.lineCons[j].id) hl = out.lineCons[j].id;
    out.highlight = hl || (s.view.target.cons || null);
    out.minutes = minutes;
    out.dir = slerp(targetEnu(eng, from.target, minutes), targetEnu(eng, to.target, minutes), k);
    out.endTargetEnu = targetEnu(eng, to.target, minutes);
    out.caption = s.title ? { title: s.title, sub: s.sub || '', alpha: ease((t - (s.move || 0) * 0.5) / 0.8) } : null;
    return out;
  }
  return { byId: byId, evaluate: evaluate, settleTime: settleTime };
})();
if (typeof module !== 'undefined') module.exports = { SHOWS: SHOWS, ShowTimeline: ShowTimeline };
