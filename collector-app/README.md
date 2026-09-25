# 수집가 앱 (collector-app)

도로 영상 수집·검수 플랫폼의 **수집가용 React Native 앱**. 검수는 별도 웹에서 한다.

## 실행

Expo SDK 57. 지금 쓰는 모듈(카메라/위치/지도/SQLite/SecureStore/비디오)은 전부 Expo Go에 들어 있다.

```bash
npm install
npm start                # 폰의 Expo Go 앱으로 QR 스캔 (같은 Wi-Fi)
```

Expo Go로 안 되는 것 — 백그라운드 위치, 안드로이드 Google Maps 키 적용 — 을 확인할 때만
dev build를 만든다 (`npx expo run:ios --device` 또는 EAS).

백엔드 주소는 `.env`의 `EXPO_PUBLIC_API_URL`. 없으면 `localhost:8080`.

지금은 화면 대부분이 `models/mockApi.ts`를 본다. 백엔드가 붙으면
각 controller 상단의 `const source = mockApi` 를 `api` 로 바꾸면 된다.

## MVC 매핑

React Native에서 고전적 MVC는 잘 안 맞아서, 역할만 지키고 형태는 관례를 따랐다.

| 레이어 | 디렉터리 | 형태 | 하는 일 |
|---|---|---|---|
| Model | `src/models/` | 모듈 | 타입, API 클라이언트, SQLite, 파일/업로드 |
| Controller | `src/controllers/` | 커스텀 훅 | 상태 관리, API 호출, 화면에 줄 값 계산 |
| View | `src/views/` | 컴포넌트 | JSX만. 로직 없음 |

controller를 클래스가 아니라 `useXxx` 훅으로 두면 RN 관례에서 벗어나지 않으면서
"controller에서 API를 때린다"는 구조가 그대로 성립한다.

## 화면

| 화면 | 파일 | 상태 |
|---|---|---|
| 로그인 | `views/LoginView.tsx` | 골격 |
| 메인 | `views/HomeView.tsx` | 골격 |
| 촬영 | `views/RecordView.tsx` | 골격 (미니맵 TODO) |
| 지도 | `views/MapView.tsx` | 골격 (격자/클립 레벨 TODO) |
| 앨범 | `views/AlbumView.tsx` | 골격 |
| 영상 상세 | `views/VideoDetailView.tsx` | 골격 (플레이어 TODO) |
| 업로드 큐 | `views/UploadQueueView.tsx` | 골격 |
| 설정 | `views/SettingsView.tsx` | 빈 껍데기 |
| 권한 요청 | — | 미작성 |

## 설계 메모

**영상은 핸드폰 앨범에 저장하지 않는다.** 카메라 캐시 → 앱 전용 저장소(`documentDirectory/pending/`)로
즉시 옮기고, 업로드가 **성공한 뒤에만** 로컬 영상을 지운다. trajectory JSON은 남겨서
오프라인에서도 목록이 보이게 한다.

**영상과 trajectory는 한 요청에 묶어 보낸다.** 따로 보내면 한쪽만 성공하는 상태가 생긴다.

**trajectory는 DB 행이 아니라 JSON 파일.** 클립 하나가 100m·20초라 점이 20개 남짓이다.
`t`(영상 시작 기준 경과 초)를 반드시 넣는다 — 검수 웹에서 영상 시간과 지도 위치를 잇는 데 쓴다.

**지도는 줌 레벨마다 다른 걸 보여준다.** 성북구 규모면 클립이 수천 개라 전부 그릴 수 없다.
광역=격자 집계 / 중간=도로 구간 / 근접=개별 클립. `useCoverage.ts` 참고.

**도로 상태는 저장값이 아니라 파생값이다.** `ConfirmTable`에 accept가 하나라도 있으면 완료.
reject 판정은 지우지 않는다 — 재촬영으로 통과해도 이력은 남고, 영상 쪽만 `superseded`로 표시한다.

**촬영 중 화면 꺼짐 방지는 필수.** 없으면 주행 중 화면이 꺼지며 녹화가 끊긴다 (`useKeepAwake`).

## 백엔드에 요청한 스키마 변경

- `VideoTable`: `trajectory_path`, `thumbnail_path`, `status`, `duration_sec`, `distance_m` 추가
- `RoadTable`: **구간 단위**여야 함 (ITS 표준노드링크 링크 = 1행). `seq`, `direction`, `geometry`, `status` 추가
- `ConfirmTable`: `(video_id, road_id)` 쌍마다 1행. `reject_reason`, `confirm_user` 추가
- 인덱스: `(upload_user, upload_date DESC)`, `(status)`
- 지도 API는 `bbox` 필수, 줌별로 분리
- 앨범 API는 offset이 아니라 커서 페이지네이션
