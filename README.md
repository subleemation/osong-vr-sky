# 별이 빛나는 밤에 VR

오송호수공원 천체관측회(2026. 11. 1)를 위해 만든 휴대폰 VR 플라네타리움이에요. 비가 와서 관측을 못 할 때 쓰는 대체 프로그램으로 시작했고, 이제는 앱을 켠 순간의 청주 하늘을 보여 줘요.
참가자는 진행자 노트북의 QR로 접속하고, 진행자가 이야기 장면을 넘기거나 같이 볼 곳을 고르면 모든 휴대폰이 함께 움직여요.

| 주소 | 누가 | 하는 일 |
| --- | --- | --- |
| `index.html` | 참가자 휴대폰 | VR(카드보드) / 화면 모드로 하늘 보기. 별자리를 바라보면 그림과 설명이 나와요. 보여 줄 것과 시각은 진행자가 정해요. |
| `admin.html` | 진행자 노트북 | 비밀번호 없이 바로 들어가요. 왼쪽에서 진행하고, 오른쪽에서 참가자 화면을 늘 보면서 확인해요. |
| `worker.js` | 인터넷 | 동기화 서버 (Cloudflare Worker + Durable Object, 또는 `server/`로 Render) |

**기준 관측 시각과 장소**: 언제나 앱을 켠 순간의 **청주** 하늘이에요. 진행자 화면을 열면 그 순간의 시각이 모든 폰의 기준이 되고, 실제 속도로 흘러요. 낮에 열면 낮 하늘이 보이니 시간을 앞으로 건너뛰면 돼요. 이야기(story.js)는 장면이 맞춰진 2026-11-01 오송 저녁으로 진행돼요.

## 진행자 화면 (`admin.html`)
위쪽 메뉴로 왼쪽 패널을 바꾸고, 오른쪽 **참가자 화면 미러링**은 항상 그대로 보여요(16:9). 미러링은 참가자 폰과 같은 상태를 노트북에서 그린 화면이에요: 진행자 시점(끌어서 돌리기·휠로 확대) / VR 헤드셋 / 화면 모드, 진행자 + 참가자(진행자 시점은 크게, 참가자 화면은 구석의 작은 창, ‘크게 보기’로 바꾸기), 따라오게 하기. 아래에는 지금 장면의 진행자 대본과 참여 질문이 나와요.
- **운영 제어**
  - VR 연결 상태: 접속한 폰, VR로 보는 폰, 화면 모드·메뉴의 폰. 배터리는 폰이 보내지 않아서 표시하지 않아요.
  - 스토리텔링 진행: 이야기 단계 타임라인(완료 ✓ / 진행 중 / 대기), 단계를 누르면 그 장면으로 가요.
  - 운영 버튼: 일시정지·재생(하늘 시간), 재시작(1단계부터), 이전·다음 단계. 키보드 ← → 도 돼요.
  - 시간 흐름: 거꾸로 600배·60배·10배 / 멈춤 / 실제 / 10배·60배·600배 슬라이더, 1시간·10분 건너뛰기, 지금 시각으로, **일주운동 보기**(별의 궤적을 켜고 600배).
  - 체험 시작: 오프닝 영상 재생·건너뛰기·다시 재생.
- **콘텐츠 관리**
  - 화면에 보이는 것: 별자리 그림·선·이름, 별 이름, 별의 궤적, 은하수, 동서남북 켬/끔. 별의 궤적은 켠 뒤로 하늘 시간이 흐른 만큼 자라요.
  - 원하는 하늘로 이동 · 확대: 이동하면 ‘따라오게 하기’가 켜져서 화면 모드 폰은 같이 돌아가요. VR 폰은 약 2초에 걸쳐 좌우·위아래가 맞춰져서 그곳이 정면에 와요. 위아래는 고개 방향 기준으로 더해서 지평선이 기울지 않고, 따라오기가 끝나면 원래대로 돌아와요. 이야기 장면과 ‘같이 볼 곳’도 같아요.
  - 같이 볼 곳.
  - 퀴즈(`quiz.js` 또는 직접 만들기): VR에서는 하늘에 뜬 보기 카드를 1.6초 바라보면 골라지고, 화면 모드에서는 눌러요. 찾기 퀴즈는 대상을 2초 바라보면 정답이에요. 보기별 인원이 실시간으로 나오고, 정답 공개를 누르면 모든 폰에 정답과 설명이 떠요.
- **참가자 관리**: 폰 연결 QR·링크·방 코드, 메시지 보내기, 화면 가리기(쉬는 시간).
- **설정**: 미리보기 켜기/끄기, 체험 초기화, 서버 주소.

## 어떻게 동작하나요
- **하늘 계산**: 별 5,044개(6.5등급까지)와 88개 별자리 선은 J2000 적도좌표로 들고 있어요. 매 프레임 "J2000 → 관측 날짜의 적도(세차·장동) → 그 장소의 지평좌표" 회전 행렬 하나를 만들어 모든 별에 곱해요(`js/sky-core.js`).
  - 2026-11-01 오송은 미리 계산한 표(`js/sky-data.js`)를 써요.
  - 기준 하늘(그날 청주)은 astronomy-engine으로 그 자리에서 다시 계산해요(`SkyCore.setSky`, 오전 6시부터 다음 날 오전 6시까지 10분 간격). 행성·달·태양은 지표면 관측자 기준, 광행차 포함 위치예요. 11월 1일 값으로 미리 계산한 표와 비교했을 때 차이는 0.0001° 이하예요.
- **화면에 그리기**: 카메라 방향으로 투영(gnomonic)한 뒤, VR에서는 카드보드 렌즈의 휘어짐을 미리 반대로 휘어 그려요(`s = 1/√(1 + k·r²/R²)`). 두 눈 화면은 같은 하늘을 눈 간격만큼 떨어진 중심에 그려요.
- **은하수와 별 사진**: NASA SVS Deep Star Maps 2020의 은하수 지도와 별 지도를 WebGL 셰이더가 픽셀마다 하늘 방향으로 되돌려 찾아 그려요. 렌즈 보정도 셰이더가 거꾸로 풀어요(`js/skygl.js`).
  - 별 사진은 노트북에서 8192×4096(두 장), 휴대폰·VR에서 4096×2048이에요. 하늘이 밝으면(박명·불빛·달빛) 흐린 별부터 사라지고, 밝은 별(3등급까지)에는 부드러운 빛번짐을 더해요.
  - WebGL이 없으면 은하수 윤곽과 별 점으로 대신 그려요.
- **밝기**: 태양 고도로 박명(하늘색·보이는 별 등급)을 정하고, 지평선 근처는 대기 감광으로 어둡게, 달이 높고 밝으면 달빛으로 흐린 별이 사라져요. 달은 실제 위상과 밝은 쪽 방향으로 그려요.
- **동기화**: 진행자 명령은 서버의 상태 하나로 모이고, 휴대폰은 그 상태(장면 번호와 시작 후 지난 시간)를 받아 각자 같은 장면을 계산해요. 그래서 늦게 들어온 폰도 같은 순간을 봐요.

## 배포
1. **사이트**: GitHub Pages(브랜치 `main`, 폴더 `/`). 휴대폰 기울기 센서는 HTTPS에서만 동작해요.
2. **동기화 서버**: 방 코드(`?r=`)가 같은 사람끼리 같은 하늘을 봐요. 진행자 비밀번호는 없어요. 서버 코드는 `worker.js` 하나고, 두 곳 중 하나에서 돌려요.
   - **Render**: `server/server.mjs`가 `worker.js`를 Node에서 그대로 돌려요. `render.yaml` 블루프린트로 배포하고, `main`에 푸시하면 자동으로 다시 배포돼요. 무료 서버는 15분 동안 아무도 안 쓰면 잠들어서, **시작 몇 분 전에 진행자 화면을 먼저 열어 두세요**(처음 깨어날 때 최대 1분).
   - **Cloudflare (이 저장소 기본값)**: `npx wrangler deploy`. Render를 쓰려면 `js/config.js`의 주소를 Render 주소로 바꿔요.
   - 서버 주소는 `js/app.js`, `js/admin.js`의 `SERVER`예요. 허용 출처는 `worker.js`의 `ALLOWED`(*.github.io, localhost)예요.

## 이야기 고치기
`story.js` 하나만 고치면 두 화면에 모두 반영돼요. 장면 형식은 파일 맨 위 주석에 있어요(`view`, `move`, `fx`, `keepArt`, `title`/`sub`, `cue`, `note`). 연출(`fx`)은 `timelapse`, `lightsOut`, `labels`, `lines`, `art`, `pointer`, `eyepiece`(망원경 시야에 허블 토성 사진)예요.
이야기는 언제나 관측회 날(2026-11-01) 오송 하늘로 진행돼요. 장면의 대상과 시각이 그 밤에 맞춰져 있기 때문이에요.

## 로컬에서 시험하기
```
python3 -m http.server 8765                      # 저장소 루트에서
npm install --prefix server && PORT=8787 node server/server.mjs   # 다른 터미널 (또는 npx wrangler dev --port 8787)
```
`http://localhost:8765/admin.html?server=ws://localhost:8787` 와 `http://localhost:8765/?r=<방 코드>&server=ws://localhost:8787`.

## 파일
```
index.html, admin.html   참가자 / 진행자 화면
sim.html                 예전 미리보기 주소 → admin.html로 이동
story.js                 이야기 장면과 진행자 대본 (두 화면이 같이 씀)
quiz.js                  준비된 퀴즈 (두 화면이 같이 씀)
art.js                   별자리 그림 (Stellarium modern, 테마 색으로 다시 칠함)
js/sky-data.js           별·별자리 선·은하수 윤곽, 2026-11-01 오송의 행성 위치 표
js/sky-core.js           하늘 좌표 계산, 기준 하늘(지금·청주) 계산(setSky, refSky)
js/skygl.js              WebGL 하늘색 + NASA 은하수
js/app.js                참가자 화면 (그리기, VR, 응시, 이야기 재생, 오프닝 영상, 동기화)
js/admin.js              진행자 화면
css/                     디자인
vendor/                  qrcode-generator (MIT), astronomy-engine 2.1.19 (MIT)
assets/                  은하수·별 사진 지도, 토성 사진, 오프닝 영상
tools/                   은하수·별·토성 이미지 만드는 스크립트
worker.js, wrangler.toml 동기화 서버 (Cloudflare)
server/, render.yaml     같은 서버를 Render(Node)에서 돌리는 어댑터
js/config.js             동기화 서버 주소
```
`v2/`, `v3/`는 Osong-vr 쇼 방식으로 만든 예전 버전이에요. 같은 앱이 https://github.com/leedohyang15-design/Osong-vr 에도 있어요(예전 진행자 쇼 버전은 그 저장소의 `osong-1101` 브랜치).

## 출처와 라이선스
- 별자리 그림: Johan Meuris / Stellarium 팀 "modern" sky culture 일러스트 (Free Art License 1.3, https://artlibre.org/licence/lal/en/). 크기를 줄이고 색을 바꿔 변형했으며 `art.js`의 그림도 같은 Free Art License를 따라요.
- 은하수 사진 지도: NASA/Goddard Space Flight Center Scientific Visualization Studio, Deep Star Maps 2020 (Gaia DR2: ESA/Gaia/DPAC). `tools/build-milkyway.py`로 변환.
- 토성 사진: NASA, ESA and the Hubble Heritage Team (STScI/AURA), 2009 — CC BY 4.0. `tools/build-saturn.py`로 배경을 투명하게 변환.
- 안드로메다은하·좀생이별 사진: HG731GZ via Stellarium — CC BY 3.0 (`assets/photos/`, `js/photos.js`, vr_planetarium v3에서 가져옴).
- 별·별자리 선 데이터: d3-celestial (Olaf Frohn, BSD-3-Clause). 행성 위치 계산: astronomy-engine (Don Cross, MIT).
- 함께 만든 저장소: https://github.com/leedohyang15-design/Osong-vr
