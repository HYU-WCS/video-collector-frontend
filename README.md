# Video Collector App

도로 영상 수집·검수 플랫폼의 **수집가용 React Native 앱**입니다. 도보로 걸으며 100m 단위 영상을 촬영하고, 영상과 GPS 궤적을 함께 업로드합니다. 검수(도로 매칭, 승인·반려)는 별도 웹에서 하며, 앱은 검수 결과를 읽기만 합니다.

- API: `http://<host>:8002/video-collector/api/v1` — [HYU-WCS/video-collector-backend](https://github.com/HYU-WCS/video-collector-backend)
- 검수 웹: `http://<host>:8002/video-validator/` — [HYU-WCS/video-collector-web](https://github.com/HYU-WCS/video-collector-web)
- Expo SDK 57, 안드로이드 주력 (iOS 지원 여부는 팀 확인 중)

## 실행

```bash
cd collector-app
npm install
npm start          # 폰의 Expo Go 앱으로 QR 스캔 (같은 Wi-Fi)
```

카메라·위치·지도·SQLite·SecureStore·비디오 모듈은 모두 Expo Go에 포함되어 있어 개발 중에는 별도 빌드가 필요 없습니다.

백엔드 주소는 `collector-app/.env`의 `EXPO_PUBLIC_API_URL`로 바꿉니다. 없으면 `src/models/api.ts`의 테스트 서버 주소를 씁니다.

### 안드로이드 배포 빌드 (EAS)

```bash
eas env:create --name GOOGLE_MAPS_ANDROID_KEY ...   # 최초 1회
eas build -p android --profile preview              # 내부 배포용 APK
```

설치형 빌드에서는 구글 지도 키가 없으면 지도가 빈 화면이 됩니다. 키는 저장소에 넣지 않고 EAS 환경변수로 두며, `app.config.js`가 빌드 시 끼워 넣습니다.

## 구조

| 경로 | 내용 |
|---|---|
| `collector-app/` | 수집가 앱 (Expo). 아래 경로는 모두 이 폴더 기준입니다 |
| `docs/` | 요구사항, DB 스키마, 화면, API, 설계 결정, 미정 사항 |
| `design/` | 화면 시안 생성 프롬프트 |
| `data/` | 실기기 실험 데이터 (원본은 git 제외) |

MVC를 요구받았으나 React Native에서 고전적 MVC는 맞지 않아, 역할만 지키고 형태는 RN 관례를 따랐습니다.

| 레이어 | 디렉터리 | 형태 | 하는 일 |
|---|---|---|---|
| Model | `src/models/` | 모듈 | 타입, API 클라이언트, SQLite, 파일 저장·업로드, 거리 계산 |
| Controller | `src/controllers/` | `useXxx` 커스텀 훅 | 상태 관리, API 호출, 화면에 줄 값 계산 |
| View | `src/views/` | 컴포넌트 | JSX만. 로직 없음 |

각 controller 상단의 `const source = mockApi`가 데이터 출처입니다. 서버 API가 준비된 곳부터 `api`로 바꿉니다.

`scripts/`는 앱 코드가 아니라 **노트북에서 실행하는 개발 도구**입니다. 아래 [개발 스크립트](#개발-스크립트)를 참고하세요.

## 현재 구현

- 로그인: 실제 서버 (JWT, refresh 토큰 회전, 만료 시 자동 로그아웃)
- 촬영: 가로 고정, 소리 없는 녹화, 화면 꺼짐 방지, GPS 궤적 기록, 미니맵, 촬영 중 거리 표시
- 지도: 도로 구간은 실제 서버, 동 단위 집계·개별 클립은 mock (서버 API 없음)
- 업로드 큐: 영상+궤적을 한 요청으로 보내는 실제 서버 형식으로 작성되어 있으나 **꺼져 있음** (`uploader.ts`의 `UPLOAD_ENABLED`). 테스트 계정과 테스트 영상 삭제 방법이 정해진 뒤 켭니다.
- 앨범: 목록은 mock에 이 폰의 실제 클립을 더한 것. 썸네일(궤적 지도·첫 프레임)은 폰에 남은 파일로 그림
- 영상 상세: 재생(업로드 전은 폰 파일, 후는 서버 스트림)과 궤적 지도
- 반려 알림·진척도·회원가입: mock
- 설정 화면: 미구현

실기기 확인은 iPhone + Expo Go(실내 및 아파트 단지 보행)까지 했습니다. 안드로이드 실기기, 발열·배터리, 100m 클립 실제 용량은 아직 확인하지 않았습니다.

## 지켜야 할 것

근거는 [docs/05-decisions.md](docs/05-decisions.md)에 있습니다. 뒤집기 전에 먼저 읽어 주세요.

- **영상을 핸드폰 앨범에 저장하지 않습니다.** 앱 전용 저장소(`documentDirectory/pending/`)를 쓰고, 업로드가 **성공한 뒤에만** 로컬 영상을 지웁니다.
- **영상과 trajectory는 한 요청에 묶어 보냅니다.** 따로 보내면 한쪽만 성공하는 상태가 생깁니다.
- trajectory JSON의 점마다 `t`(영상 시작 기준 경과 초)와 `acc`(정확도)를 넣습니다. 검수 웹에서 영상 시간과 지도 위치를 잇는 데 씁니다.
- 거리 계산에 차량용 필터(3m 문턱)를 쓰지 않습니다. 도보는 초당 1.4m라 다 걸러집니다.
- 지도는 줌 레벨마다 다른 것을 보여줍니다: 광역=동 단위 집계, 중간=도로 구간, 근접=개별 클립.
- 도로 상태는 저장값이 아니라 파생값입니다. accept가 하나라도 있으면 완료이고, reject 판정은 지우지 않습니다.
- 상태 색은 4개뿐입니다. "내것/남의것"은 색이 아니라 필터로 구분합니다.
- 앱에는 금액이 아니라 km만 표시하며, accept/reject 버튼은 앱 어디에도 없습니다.

## 개발 스크립트

`scripts/`의 파일은 앱 번들에 포함되지 않습니다. 앱 번들러(Metro)는 `index.js`에서 import로 이어진 파일만 묶는데, `src/`는 `scripts/`를 import하지 않습니다. 반대로 스크립트는 `src/models/distance.ts`를 직접 import하므로, 앱과 **같은 거리 계산 코드**를 검증합니다.

모든 명령은 `collector-app/`에서 실행합니다.

### 거리 로직 시뮬레이션

합성 GPS(노이즈·정지·모퉁이·점프)를 만들어 `distance.ts`가 실제 걸은 거리에 가깝게 나오는지 확인합니다. **`distance.ts`를 고치면 다시 돌려 주세요.** 난수 시드가 고정되어 있어 결과가 매번 같습니다.

| 파일 | 확인하는 것 | 실행 |
|---|---|---|
| `sim-distance.ts` | 기존/새 누적 방식 비교 — 노이즈, 정지, 모퉁이, 한 번 튀는 점 | `npx tsx scripts/sim-distance.ts` |
| `sim-gate.ts` | 정확도 문턱(`MAX_ACC_M`) 20m vs 25m — 부정확한 구간이 섞일 때 | `npx tsx scripts/sim-gate.ts` |
| `sim-stop.ts` | 멈출 때 화면 거리가 줄어드는 문제 (2026-09-25 제보) | `npx tsx scripts/sim-stop.ts [이전 distance.ts 경로]` |

### 실기기 궤적 분석

앱 홈 화면의 **[개발] 궤적 내보내기**로 받은 파일을 `data/raw/`에 넣고 실행합니다. 데이터 형식과 폴더 규칙은 [data/README.md](data/README.md)에 있습니다.

```bash
npx tsx scripts/analyze-runs.ts --since 2026-10-01 --json ../data/out/runs.json
python3 scripts/plot-runs.py ../data/out/runs.json ../data/out/runs.png --new
```

| 파일 | 하는 일 | 주요 옵션 |
|---|---|---|
| `analyze-runs.ts` | 내보낸 파일들을 `local_id`로 합쳐, 촬영마다 앱 거리를 걸음 수 기준 거리(걸음 × 보폭)와 비교한 표를 출력합니다 | `--since 날짜`, `--stride 보폭(m, 기본 0.6)`, `--json 출력경로` |
| `plot-runs.py` | `analyze-runs.ts --json` 결과로 촬영별 궤적 모양을 그립니다 (matplotlib) | `--new` 새 촬영만, `--nodes` 점마다 시간 색 |

`data/raw/`에는 실험 장소 좌표가 그대로 들어 있어 git에서 제외합니다.

## 문서

- [docs/](docs/README.md) — 요구사항, DB 스키마, 화면, API, 설계 결정, 미정 사항
- [docs/07-schema-request.md](docs/07-schema-request.md) — 백엔드에 요청한 스키마 변경
- [design/stitch-prompts.md](design/stitch-prompts.md) — 화면 시안 프롬프트
