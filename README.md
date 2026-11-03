# 별이 빛나는 밤에 VR

오송호수공원 천체관측회(2026. 11. 1)를 위해 만든 휴대폰 VR 플라네타리움이에요. 비가 와서 관측을 못 할 때 쓰는 대체 프로그램으로 시작했고, 이제는 아무 날짜·장소의 저녁 하늘도 보여 줘요.
참가자는 진행자 노트북의 QR로 접속하고, 진행자가 이야기 장면을 넘기거나 같이 볼 곳을 고르면 모든 휴대폰이 함께 움직여요.

| 주소 | 누가 | 하는 일 |
| --- | --- | --- |
| `index.html` | 참가자 휴대폰 | VR(카드보드) / 화면 모드로 하늘 보기. 별자리를 바라보면 그림과 설명이 나와요. 메뉴에서 날짜·장소를 고를 수 있어요. |
| `admin.html` | 진행자 노트북 | 비밀번호로 들어가요. 오프닝 영상, 이야기 진행, 설명/자유 관찰 타이머, 같이 볼 곳, 화면 따라오게 하기, 하늘 날짜·장소, 참가자 화면 미리보기, 아래 진행자 도구 |
| `worker.js` | 인터넷 | 동기화 서버 (Cloudflare Worker + Durable Object) |

## 진행자 도구 (`admin.html` 오른쪽 메뉴)
- **하늘 시각 · 날짜 · 장소**: 오후 6시~오전 6시 슬라이더, 1시간/10분 앞뒤로 건너뛰기, 속도(거꾸로 600배·60배, 멈춤, 실제, 10배·60배·600배), 날짜·장소.
- **퀴즈**: 준비된 퀴즈(`quiz.js`)나 직접 만든 퀴즈를 내요.
  - 고르기 퀴즈: VR에서는 보기 카드가 하늘에 떠 있고 1.6초 바라보면 골라져요. 화면 모드에서는 눌러서 골라요.
  - 찾기 퀴즈: 별·별자리·행성을 찾아 가운데 동그라미로 2초 바라보면 정답이에요.
  - 진행자 화면에 보기별 인원이 실시간으로 나오고, ‘정답 공개’를 누르면 모든 폰에 정답과 설명이 떠요.
- **화면에 보이는 것**: 별자리 그림·선·이름, 별 이름, 별의 궤적(지난 2시간), 은하수, 동서남북을 모든 폰에서 켬/끔, 또는 ‘각자’(참가자 메뉴대로).
- **원하는 하늘로 이동 · 확대**: 행성·별자리·밝은 별·성단/은하 목록에서 골라 이동, 동서남북·머리 위 버튼, 확대/축소. 이동하면 ‘따라오게 하기’가 켜져서 화면 모드 폰은 같이 돌아가고, VR 폰에는 그쪽을 가리키는 화살표가 떠요(VR 화면을 억지로 돌리면 어지러워서요).

## 어떻게 동작하나요
- **하늘 계산**: 별 5,044개(6.5등급까지)와 88개 별자리 선은 J2000 적도좌표로 들고 있어요. 매 프레임 "J2000 → 관측 날짜의 적도(세차·장동) → 그 장소의 지평좌표" 회전 행렬 하나를 만들어 모든 별에 곱해요(`js/sky-core.js`).
  - 2026-11-01 오송은 미리 계산한 표(`js/sky-data.js`)를 써요.
  - 다른 날짜·장소는 astronomy-engine으로 그 자리에서 다시 계산해요(`SkyCore.setSky`). 행성·달·태양은 지표면 관측자 기준, 광행차 포함 위치예요. 11월 1일 값으로 미리 계산한 표와 비교했을 때 차이는 0.0001° 이하예요.
- **화면에 그리기**: 카메라 방향으로 투영(gnomonic)한 뒤, VR에서는 카드보드 렌즈의 휘어짐을 미리 반대로 휘어 그려요(`s = 1/√(1 + k·r²/R²)`). 두 눈 화면은 같은 하늘을 눈 간격만큼 떨어진 중심에 그려요.
- **은하수**: NASA SVS Deep Star Maps 2020 사진 지도를 WebGL 셰이더가 픽셀마다 하늘 방향으로 되돌려 찾아 그려요. 렌즈 보정도 셰이더가 거꾸로 풀어요(`js/skygl.js`). WebGL이 없으면 윤곽 다각형으로 대신 그려요.
- **밝기**: 태양 고도로 박명(하늘색·보이는 별 등급)을 정하고, 지평선 근처는 대기 감광으로 어둡게, 달이 높고 밝으면 달빛으로 흐린 별이 사라져요. 달은 실제 위상과 밝은 쪽 방향으로 그려요.
- **동기화**: 진행자 명령은 서버의 상태 하나로 모이고, 휴대폰은 그 상태(장면 번호와 시작 후 지난 시간)를 받아 각자 같은 장면을 계산해요. 그래서 늦게 들어온 폰도 같은 순간을 봐요.

## 배포
1. **사이트**: GitHub Pages(브랜치 `main`, 폴더 `/`). 휴대폰 기울기 센서는 HTTPS에서만 동작해요.
2. **동기화 서버**: `wrangler deploy` (Cloudflare 계정 필요). 진행자 비밀번호는 `wrangler secret put ADMIN_KEY`로 넣어요.
   - 날짜·장소 동기화(`sky` 명령)는 이번에 서버에 추가했어요. **서버를 다시 배포해야** 진행자가 고른 날짜가 휴대폰에 전달돼요. 배포 전에도 나머지는 그대로 동작하고, 참가자가 각자 메뉴에서 날짜를 고를 수는 있어요.
   - 서버 주소는 `js/app.js`, `js/admin.js`의 `SERVER`예요. 허용 출처는 `worker.js`의 `ALLOWED`(*.github.io, localhost)예요.

## 이야기 고치기
`story.js` 하나만 고치면 두 화면에 모두 반영돼요. 장면 형식은 파일 맨 위 주석에 있어요(`view`, `move`, `fx`, `keepArt`, `title`/`sub`, `cue`, `note`). 연출(`fx`)은 `timelapse`, `lightsOut`, `labels`, `lines`, `art`, `pointer`, `eyepiece`(망원경 시야에 허블 토성 사진)예요.
이야기는 언제나 관측회 날(2026-11-01) 오송 하늘로 진행돼요. 장면의 대상과 시각이 그 밤에 맞춰져 있기 때문이에요.

## 로컬에서 시험하기
```
python3 -m http.server 8765                      # 저장소 루트에서
printf 'ADMIN_KEY=test1234\n' > .dev.vars
npx wrangler dev --port 8787 --local             # 다른 터미널
```
`http://localhost:8765/admin.html?server=ws://localhost:8787` (비밀번호 test1234) 와 `http://localhost:8765/?r=<방 코드>&server=ws://localhost:8787`.

## 파일
```
index.html, admin.html   참가자 / 진행자 화면
sim.html                 예전 미리보기 주소 → admin.html로 이동
story.js                 이야기 장면과 진행자 대본 (두 화면이 같이 씀)
quiz.js                  준비된 퀴즈 (두 화면이 같이 씀)
art.js                   별자리 그림 (Stellarium modern, 테마 색으로 다시 칠함)
js/sky-data.js           별·별자리 선·은하수 윤곽, 2026-11-01 오송의 행성 위치 표
js/sky-core.js           하늘 좌표 계산, 다른 날짜·장소 계산(setSky), 장소 목록
js/skygl.js              WebGL 하늘색 + NASA 은하수
js/app.js                참가자 화면 (그리기, VR, 응시, 이야기 재생, 오프닝 영상, 동기화)
js/admin.js              진행자 화면
css/                     디자인
vendor/                  qrcode-generator (MIT), astronomy-engine 2.1.19 (MIT)
assets/                  은하수 사진 지도, 토성 사진, 오프닝 영상
tools/                   은하수·토성 이미지 만드는 스크립트
worker.js, wrangler.toml 동기화 서버
```
`v2/`, `v3/`는 Osong-vr 쇼 방식으로 만든 예전 버전이에요. 같은 앱이 https://github.com/leedohyang15-design/Osong-vr 에도 있어요(예전 진행자 쇼 버전은 그 저장소의 `osong-1101` 브랜치).

## 출처와 라이선스
- 별자리 그림: Johan Meuris / Stellarium 팀 "modern" sky culture 일러스트 (Free Art License 1.3, https://artlibre.org/licence/lal/en/). 크기를 줄이고 색을 바꿔 변형했으며 `art.js`의 그림도 같은 Free Art License를 따라요.
- 은하수 사진 지도: NASA/Goddard Space Flight Center Scientific Visualization Studio, Deep Star Maps 2020 (Gaia DR2: ESA/Gaia/DPAC). `tools/build-milkyway.py`로 변환.
- 토성 사진: NASA, ESA and the Hubble Heritage Team (STScI/AURA), 2009 — CC BY 4.0. `tools/build-saturn.py`로 배경을 투명하게 변환.
- 별·별자리 선 데이터: d3-celestial (Olaf Frohn, BSD-3-Clause). 행성 위치 계산: astronomy-engine (Don Cross, MIT).
- 함께 만든 저장소: https://github.com/leedohyang15-design/Osong-vr
