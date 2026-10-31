# 별이 빛나는 밤에 VR

오송호수공원 천체관측회(2026. 11. 1)용 VR 플라네타리움. 비가 와서 관측을 못 할 때 쓰는 대체 프로그램이에요.

- `index.html`: 참가자 폰 화면 (VR / 화면으로 보기)
- `admin.html`: 진행자(노트북) 화면 — 이야기 진행, 진행 순서·타이머, 같이 볼 곳, 화면 따라오게 하기, 참가자 화면 미리보기
- `art.js`: 별자리 그림 (우리 테마 색으로 다시 칠함)
- `story.js`: 이야기 장면과 진행자 대본 (index.html·admin.html 안에도 들어 있어요. 고친 뒤에는 페이지를 다시 만들어야 해요)
- `worker.js`, `wrangler.toml`: 동기화 서버 (Cloudflare Worker + Durable Object)

## 출처와 라이선스

- 별자리 그림: Johan Meuris / Stellarium 팀 "modern" sky culture 일러스트 (Free Art License 1.3, https://artlibre.org/licence/lal/en/).
  원본 https://github.com/Stellarium/stellarium/tree/master/skycultures/modern/illustrations 을 크기를 줄이고 색을 바꿔 변형했으며, `art.js`의 그림도 같은 Free Art License를 따릅니다.
- 이야기(장면) 진행 방식: leedohyang15의 Osong-vr(https://github.com/leedohyang15-design/Osong-vr) 쇼 방식을 바탕으로 했어요.
- 별·별자리 선 데이터: d3-celestial (BSD-3-Clause), 행성 위치 계산: astronomy-engine (MIT).
