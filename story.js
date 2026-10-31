// 이야기(쇼) 장면 — 진행자가 다음 장면으로 넘기면 모든 휴대폰이 같은 장면을 봐요.
// 장면 형식은 leedohyang15의 Osong-vr 쇼 방식을 따랐어요(view / move / fx / keepArt / title·sub·cue·note).
//   view    장면이 끝날 때 보는 곳 { target, fov, minutes }  target: {cons}|{star}|{dso}|{body}|{altaz:[고도, 방위]}
//   move    앞 장면에서 넘어오는 데 걸리는 초     start  첫 장면이 시작하는 곳
//   fx      연출 (at: 시작 초, dur: 길이)
//           timelapse(from,to: 분) · lightsOut(from,to: 등급) · labels(from,to: 0~1) · lines(cons) · art(cons, stagger) · pointer(from,to: 별 이름)
//   keepArt 앞 장면에서 이어서 보여 줄 별자리 그림
//   title, sub  휴대폰 자막   cue  진행자 화면에 크게 뜨는 참여 질문   note  진행자 대본
// 시각(minutes)은 오후 6시부터 지난 분이에요. 92 = 오후 7시 32분.
window.STORY_SHOWS = [
  {
    id: 'first',
    title: '첫 번째 이야기 · 별이 켜지는 하늘',
    blurb: '노을 뒤에 별이 켜지는 모습, 북극성 찾기, 오늘의 주인공 토성. 5분쯤 걸려요.',
    scenes: [
      { start: { target: { altaz: [10, 250] }, fov: 100, minutes: 0 },
        view: { target: { altaz: [45, 255] }, fov: 100, minutes: 92 }, move: 0,
        fx: [{ type: 'timelapse', from: 0, to: 92, at: 0.5, dur: 14 }, { type: 'labels', from: 0, to: 1, at: 13, dur: 2 }],
        title: '해가 지면, 별이 하나씩', sub: '오후 6시 → 7시 반을 14초 만에',
        cue: '가장 먼저 보이는 별을 찾으면 손을 들어 주세요',
        note: '오늘 해는 오후 5시 34분에 져요. 한 시간 반을 14초로 줄여서 보여 줄게요. 서쪽 높은 곳에 먼저 나타난 밝은 별 두 개가 직녀성과 견우성이에요. 밝은 별일수록 먼저 보여요.' },

      { view: { target: { altaz: [58, 175] }, fov: 108, minutes: 92 }, move: 5,
        fx: [{ type: 'labels', from: 1, to: 0, at: 0, dur: 1.5 }, { type: 'lightsOut', from: 2.5, to: 6.3, at: 2, dur: 10 }],
        title: '도시 불빛이 모두 꺼진다면', sub: '맨눈으로 보이는 별: 수백 개 → 수천 개',
        cue: '비가 그치면 우리 공원에서는 별이 몇 개쯤 보일까요?',
        note: '도시 한가운데서는 밝은 별 수백 개만 보이지만, 불빛이 하나도 없는 산골에서는 맨눈으로 수천 개가 보여요. 가운데 뿌연 띠가 은하수예요. 오송처럼 도시와 가까운 곳에서는 은하수를 보기 어려워요.' },

      { view: { target: { star: '북극성' }, fov: 96, minutes: 92 }, move: 6,
        fx: [{ type: 'labels', from: 0, to: 1, at: 0, dur: 2 }, { type: 'lines', cons: ['UMi', 'Cas'], at: 3, dur: 2 },
             { type: 'pointer', from: '나비', to: '북극성', at: 6, dur: 2.5 }],
        title: '움직이지 않는 별, 북극성', sub: '모든 별이 이 별을 중심으로 돌아요',
        cue: '주먹을 쥐고 팔을 쭉 뻗어 보세요. 주먹 하나가 10도예요',
        note: '북쪽 하늘의 별들은 밤새 북극성을 가운데 두고 크게 원을 그려요. 북극성은 지평선에서 37도, 주먹 네 개쯤 높이에 있어요. W 모양 카시오페이아에서 점선을 따라가면 찾을 수 있어요.' },

      { view: { target: { body: 'Saturn' }, fov: 40, minutes: 92 }, move: 7,
        fx: [],
        title: '오늘의 주인공, 토성', sub: '깜빡이지 않고 차분하게 빛나는 노란 점',
        cue: '별과 행성은 어떻게 구별할까요?',
        note: '남동쪽에서 차분하게 빛나는 노란 점이 토성이에요. 별은 반짝반짝 깜빡이지만 행성은 덜 깜빡여요. 지구에서 약 13억 km, 빛으로 70분쯤 걸리는 거리예요. 지금은 물고기자리 아래쪽, 고래자리와의 경계 가까이에 있어요.' },

      { view: { target: { altaz: [84, 180] }, fov: 118, minutes: 92 }, move: 8,
        fx: [{ type: 'labels', from: 1, to: 0, at: 3, dur: 4 }],
        title: '잠깐 쉬어요', sub: '헤드셋을 벗고 눈을 쉬게 해 주세요',
        cue: '헤드셋을 벗고 1분 쉬어요',
        note: '여기까지가 첫 번째 이야기예요. 눈이 피곤하지 않게 헤드셋을 잠깐 벗어 주세요. 다음에는 가을 하늘에 사는 한 가족의 이야기를 들려줄게요.' }
    ]
  },
  {
    id: 'royal',
    title: '두 번째 이야기 · 가을 하늘의 왕가',
    blurb: '왕비 카시오페이아, 공주 안드로메다, 영웅 페르세우스, 날개 달린 말. 7분쯤 걸려요.',
    scenes: [
      { start: { target: { altaz: [45, 30] }, fov: 100, minutes: 92 },
        view: { target: { cons: 'Cas' }, fov: 80, minutes: 92 }, move: 4,
        fx: [{ type: 'lines', cons: ['Cas', 'Cep'], at: 2, dur: 2 }, { type: 'art', cons: ['Cas', 'Cep'], at: 4, dur: 2, stagger: 2 }],
        title: '자랑이 많은 왕비', sub: '카시오페이아와 케페우스 왕',
        cue: '여러분이 가장 자랑하고 싶은 건 뭔가요?',
        note: '가을 하늘에는 한 가족의 이야기가 통째로 떠 있어요. 에티오피아의 카시오페이아 왕비는 딸 안드로메다가 바다의 요정들보다 더 아름답다고 자랑했어요. 바다의 신 포세이돈이 그 말을 듣고 크게 화가 났대요.' },

      { view: { target: { cons: 'Cet' }, fov: 92, minutes: 92 }, move: 6,
        fx: [{ type: 'lines', cons: ['Cet'], at: 2, dur: 2 }, { type: 'art', cons: ['Cet'], at: 4, dur: 2.5 }],
        keepArt: ['Cas', 'Cep'],
        title: '바다 괴물 케투스', sub: '고래자리',
        cue: '괴물 등 위쪽에서 깜빡이지 않는 노란 점을 찾아보세요',
        note: '화가 난 포세이돈은 바다 괴물 케투스를 보냈어요. 동쪽 낮은 곳의 커다란 고래자리가 그 괴물이에요. 괴물 등 위쪽에 있는 노란 점이 아까 본 토성이에요.' },

      { view: { target: { cons: 'And' }, fov: 84, minutes: 92 }, move: 6,
        fx: [{ type: 'lines', cons: ['And'], at: 2, dur: 2 }, { type: 'art', cons: ['And'], at: 4, dur: 2.5 }],
        keepArt: ['Cas', 'Cep', 'Cet'],
        title: '사슬에 묶인 공주', sub: '안드로메다',
        cue: '공주를 구하려면 누가 와야 할까요?',
        note: '괴물을 달래려면 공주를 바쳐야 한다는 말에, 안드로메다는 바닷가 바위에 사슬로 묶였어요. 하늘에서도 공주는 엄마 카시오페이아와 괴물 사이에 있어요.' },

      { view: { target: { cons: 'Per' }, fov: 84, minutes: 92 }, move: 6,
        fx: [{ type: 'lines', cons: ['Per'], at: 2, dur: 2 }, { type: 'art', cons: ['Per'], at: 4, dur: 2.5 }],
        keepArt: ['Cas', 'Cep', 'Cet', 'And'],
        title: '영웅 페르세우스', sub: '손에 든 것은 메두사의 머리',
        cue: '메두사의 눈에 있는 별 ‘알골’을 찾아보세요',
        note: '그때 날개 달린 신발을 신은 영웅 페르세우스가 날아왔어요. 보는 사람을 돌로 만드는 메두사의 머리를 들어 괴물을 돌로 만들었대요. 메두사의 눈 자리에 있는 알골은 약 3일마다 어두워졌다 밝아지는 신기한 별이에요.' },

      { view: { target: { cons: 'Peg' }, fov: 86, minutes: 92 }, move: 6,
        fx: [{ type: 'lines', cons: ['Peg'], at: 2, dur: 2 }, { type: 'art', cons: ['Peg'], at: 4, dur: 2.5 }],
        keepArt: ['Cas', 'Cep', 'Cet', 'And', 'Per'],
        title: '날개 달린 말, 페가수스', sub: '가을의 대사각형',
        cue: '대사각형 안에 별이 몇 개 보이나요?',
        note: '메두사가 쓰러질 때 날개 달린 말 페가수스가 태어났대요. 머리 위 높이 떠 있는 커다란 네모가 페가수스의 몸통, ‘가을의 대사각형’이에요.' },

      { view: { target: { altaz: [55, 75] }, fov: 122, minutes: 92 }, move: 7,
        fx: [{ type: 'lines', cons: ['Cas', 'Cep', 'Cet', 'And', 'Per', 'Peg'], at: 0, dur: 0.1 }],
        keepArt: ['Cas', 'Cep', 'Cet', 'And', 'Per', 'Peg'],
        title: '하늘에 남은 가족 사진', sub: '여섯 별자리, 한 이야기',
        cue: '이야기 순서대로 손가락으로 따라가 볼까요?',
        note: '조금 뒤로 물러나 볼게요. 왕비, 왕, 공주, 영웅, 괴물, 날개 달린 말이 북쪽부터 남동쪽 하늘에 모두 모여 있어요. 옛사람들은 이 이야기를 잊지 않으려고 하늘에 그려 넣었어요.' },

      { view: { target: { dso: '안드로메다은하' }, fov: 34, minutes: 92 }, move: 7,
        fx: [],
        keepArt: ['And'],
        title: '250만 년 전에 출발한 빛', sub: '안드로메다은하',
        cue: '이 빛이 출발할 때 지구에는 누가 살았을까요?',
        note: '공주의 허리께를 크게 보면 희뿌연 얼룩이 있어요. 별이 1조 개쯤 모인 이웃 은하, 안드로메다은하예요. 지금 보는 빛은 250만 년 전에 출발했어요.' },

      { view: { target: { dso: '좀생이별 (플레이아데스)' }, fov: 62, minutes: 152 }, move: 8,
        fx: [{ type: 'timelapse', from: 92, to: 152, at: 0, dur: 8 }, { type: 'lines', cons: ['Tau'], at: 8, dur: 2 }, { type: 'art', cons: ['Tau'], at: 10, dur: 2.5 }],
        title: '좀생이별', sub: '밤 8시 반, 동쪽에서 올라오는 황소',
        cue: '좀생이별이 몇 개로 보이나요?',
        note: '시간을 한 시간 빨리 돌렸어요. 동쪽에서 작은 별들이 모인 무리가 올라왔어요. 우리 조상들은 좀생이별이라고 부르며, 이 별과 달을 보고 그해 농사를 점치기도 했어요.' },

      { view: { target: { altaz: [84, 180] }, fov: 118, minutes: 152 }, move: 9,
        fx: [{ type: 'labels', from: 1, to: 0, at: 4, dur: 4 }],
        title: '구름 위의 하늘', sub: '비가 와도 별은 그 자리에 있어요',
        cue: '헤드셋을 벗어 주세요',
        note: '이름과 선을 지우면 이렇게 별만 남아요. 오늘은 비구름에 가려 있지만, 구름 위에는 지금 본 하늘이 그대로 떠 있어요. 맑은 날 밤에 꼭 한 번 직접 올려다봐 주세요.' }
    ]
  }
];
