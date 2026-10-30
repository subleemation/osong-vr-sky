# 별이 빛나는 밤에 VR

오송호수공원 천체관측회(2026. 11. 1)용 VR 플라네타리움.

- `index.html`: 참가자 폰 화면 (VR / 화면으로 보기)
- `admin.html`: 진행자(노트북) 화면 — 진행 순서, 타이머, 같이 볼 곳, 화면 따라오게 하기, 참가자 화면 미리보기
- `art.js`: 별자리 그림
- `worker.js`, `wrangler.toml`: 동기화 서버 (Cloudflare Worker + Durable Object)

## 출처와 라이선스

- 별자리 그림: Stellarium 팀의 "modern" sky culture 일러스트 (Free Art License 1.3, https://artlibre.org/licence/lal/en/).
  원본 https://github.com/Stellarium/stellarium/tree/master/skycultures/modern/illustrations 을 크기를 줄이고 색을 입혀 변형했으며, `art.js` 안의 그림도 같은 Free Art License를 따릅니다.
- 별·별자리 선 데이터: d3-celestial (BSD-3-Clause), 행성 위치 계산: astronomy-engine (MIT).
