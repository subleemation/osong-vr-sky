# 별이 빛나는 밤에 VR

오송호수공원 천체관측회(2026. 11. 1)용 VR 플라네타리움.

- `index.html`: 참가자 폰 화면 (VR / 화면으로 보기)
- `admin.html`: 진행자(노트북) 화면 — 진행 순서, 타이머, 같이 볼 곳, 화면 따라오게 하기, 참가자 화면 미리보기
- 별자리 선 그림: 직접 그린 그림 (index.html 안에 포함)
- `worker.js`, `wrangler.toml`: 동기화 서버 (Cloudflare Worker + Durable Object)

## 출처와 라이선스

- 별자리 선 그림은 이 프로젝트에서 직접 그린 것입니다.
- `art.js`(Stellarium 팀 일러스트, Free Art License 1.3)는 이전 버전에서 쓰던 파일로, 지금은 사용하지 않습니다.
- 별·별자리 선 데이터: d3-celestial (BSD-3-Clause), 행성 위치 계산: astronomy-engine (MIT).
