# API 스펙 [제안]

백엔드 담당과 합의 전. 프론트가 필요로 하는 모양을 적은 것.

## 인증

```
POST /api/login          { username, password } → { token, user }
POST /api/signup         { username, password } → { token, user }   # 409 = 아이디 중복
GET  /api/health         → { ok: true }
```

토큰은 `Authorization: Bearer <token>`. 401이면 앱이 자동 로그아웃한다.

회원가입은 인증 없이 아이디·비밀번호만 받는다. 가입 응답에 토큰을 바로 줘서 로그인을 한 번 더 거치지 않게 한다.

## 진척도

```
GET /api/progress
→ {
    total_ratio: 0.42,
    my_distance_m: 18400,           // 내가 올린 전체
    confirmed_distance_m: 8100,     // accept된 것만
    pending_distance_m: 4300        // 검수 대기분
  }
```

**금액은 내려주지 않는다 — 앱에 km만 표시한다** (D13). 확정 거리는 **accept된 것만** 센다.
찍은 양으로 세면 대충 찍는 유인이 생긴다. 같은 구간 중복 accept를 셀지는 미정 (`06` Q9).

## 지도 — 줌 레벨별로 분리 [확정]

클립이 수천 개라 하나의 API로는 감당이 안 된다. `bbox`는 모든 지도 API에 필수.

```
GET /api/map/coverage?bbox=minLat,minLon,maxLat,maxLon     # 광역 (z ≤ 13)
→ { areas: [ { dong: "성북동", ratio: 0.62, geometry: [[lat,lon],...] } ] }

GET /api/map/roads?bbox=...                                 # 중간 (z 14~16)
→ { roads: [ { road_id, road_number, road_name, seq, status,
                reject_reason?, geometry: [[lat,lon],...] } ] }

GET /api/map/clips?bbox=...                                 # 근접 (z ≥ 17)
→ { clips: [ { video_id, status, geometry: [[lat,lon],...] } ] }
```

- 광역 집계는 서버가 미리 계산해 캐싱해야 한다. 요청마다 trajectory 파일 수천 개를 파싱할 수 없다.
- 클립 API는 줌이 낮을 때 **아예 호출하지 않는다** (클라이언트 책임).
- 증분 갱신을 위해 `updated_after` 파라미터가 있으면 SQLite 캐싱이 훨씬 효율적이다.

## 앨범 — 커서 페이지네이션 [확정]

```
GET /api/videos?user=me&status=rejected&from=2026-09-01&cursor=<opaque>&limit=20
→ { items: [Video], next_cursor: "..." | null }
```

offset을 쓰면 수천 건에서 뒤로 갈수록 느려지고, 스크롤 중 새 업로드가 생기면 항목이
중복되거나 건너뛰어진다.

`Video` 응답에는 `superseded: boolean`이 포함돼야 한다 — 반려됐지만 이후 같은 구간을
**누군가** 다시 찍어 accept된 경우. 앨범에서 "반려 · 재촬영됨"(회색)으로 구분해 보여준다.

`reviewed_at`(ConfirmTable.confirm_date)도 포함한다. 반려 알림에 쓴다.

### 반려 알림 — 별도 API 없이 앨범 API 재사용

```
GET /api/videos?user=me&status=rejected&reviewed_after=2026-09-22T18:30:00+09:00
```

앱은 마지막으로 읽은 판정의 `reviewed_at`을 로컬(SecureStore)에 저장하고, 그 이후 반려만 받아
알림으로 띄운다. 읽으면 그 값을 갱신한다. 서버에 읽음 상태를 둘 필요가 없다 (D14).

## 업로드 — 영상과 trajectory를 한 요청에 [확정]

```
POST /api/upload
Content-Type: multipart/form-data
  video        <mp4 파일>
  trajectory   <json 문자열 또는 파일>
  recorded_at  ISO8601
  duration_sec
  distance_m
→ { video_id }
```

`road_id`는 보내지 않는다. 재촬영 모드가 없으므로 모든 클립은 검수자가 도로에 매칭한다 (D14).

따로 보내면 한쪽만 성공하는 상태가 생기고, 그때부터 정합성 코드를 쓰게 된다.
서버는 둘 다 저장에 성공했을 때만 `VideoTable`에 INSERT한다.

## 영상 재생

```
GET /api/videos/:id/stream    # Range 요청 지원 필수
```

오브젝트 스토리지를 쓴다면 signed URL 발급 방식이 서버 부하가 덜하다.

**코덱 주의:** iOS는 HEVC(.mov)로 녹화하는 경우가 있는데 브라우저에서 재생이 안 된다.
검수 웹이 영상을 봐야 하므로 앱에서 H.264 강제 또는 서버에서 트랜스코딩이 필요하다.

## 검수 (웹 전용 — 앱에서는 호출하지 않음)

```
GET  /api/review/queue
POST /api/review/accept    { video_id, road_id }
POST /api/review/reject    { video_id, road_id, reason }
POST /api/review/rollback  { confirm_id }
```

수집가 앱은 검수 **결과를 읽기만** 한다. accept/reject 버튼은 앱 어디에도 없다.

---

# 실제 백엔드 (2026-09-24 확인)

위 스펙은 합의 전 제안이었다. 팀원이 만든 실제 서버는 아래와 같다.
출처: OpenAPI(`/video-collector/openapi.json`) + 검수 웹 코드 + admin 계정 조회(읽기만, 2026-09-24).

**앱 연결 상태:** 로그인·가입·토큰 갱신·도로 구간은 실제 서버(`src/models/api.ts`). 나머지는 mock.
업로드는 `uploader.ts`의 `UPLOAD_ENABLED = false`로 막아 둠.

확인된 사실:
- ID는 전부 UUID/문자열 (`video_id`, `user_id`, `road_id: "sdwalk:100017:0dd3…"`)
- 로그인 응답 `{access_token(15분), refresh_token, expires_in, user{user_id, username, role}}`. **refresh는 매번 새 토큰으로 교체(rotation)**
- **bbox는 경도 먼저** `minLon,minLat,maxLon,maxLat`. 순서가 틀리면 422
- 도로 응답이 무겁다: 반경 1km에 2000구간 초과, 2000구간 = 1.2MB. 구간 평균 45m
- 도로 properties의 `accepted/pending/rejected`는 개수 → 상태는 앱에서 D5 규칙으로 파생
- 영상 상세에 `roads[]{confirm_id, status, acceptability, confirm_date, version}`. **목록에는 없음** → 앨범 배지를 그리려면 항목마다 상세 호출 필요
- 반려 사유는 `/reviews/{confirm_id}/history`의 이벤트 `reason`(자유 텍스트)
- 진척도 `{videos{ready}, uploaded_videos, reviews{pending}, accepted_roads, processed_ratio}` — **km 없음**
- 궤적 조회는 GeoJSON LineString — t·acc가 빠진다

- Base: `http://166.104.36.71:8002/video-collector/api/v1`
- 에러: `{ error: { code, message, request_id } }` — message가 한국어라 그대로 보여줘도 된다
- **로그인은 `client_type: "mobile"` 필수.** 기본값 web은 Origin 검사에 걸려 403

| 용도 | 실제 API | 우리 제안과 차이 |
|---|---|---|
| 로그인 | `POST /auth/login {username,password,client_type}` → `{access_token, user{username, role}, …}` | access + refresh 토큰. `POST /auth/refresh`, `/auth/logout` |
| 회원가입 | `POST /auth/register {username, password}` → 201 (10.05 추가) | 토큰을 주는지 문서에 없어 앱은 가입 뒤 바로 login을 부른다. 항상 수집가 권한 |
| 내 정보·진척도 | `GET /users/me`, `GET /users/me/progress` | 진척도 응답 모양 미확인 |
| 업로드 | `POST /videos` multipart `file`, `trajectory`(파일, 선택) + `Idempotency-Key` 헤더 → 202 | 메타(recorded_at 등) 필드 없음 — 서버가 파일에서 뽑는 듯. 비동기 처리(`processing_status`: uploaded→processing→ready/failed) |
| 앨범 | `GET /videos?scope=mine&processing_status=&unlinked=&cursor=&limit=` → `{items, next_cursor}` | 커서 페이지네이션 ✓. **검수 상태(반려) 필터 없음** |
| 영상 상세 | `GET /videos/{id}` → `size_bytes, duration_ms, upload_date, processing_status…` | |
| 재생 | `POST /videos/{id}/playback-token` → `{url, expires_in}` | signed URL 방식 ✓ |
| 궤적 | `GET /videos/{id}/trajectory` → GeoJSON | 업로드 궤적 파일 형식(우리 JSON vs GeoJSON) 확인 필요 |
| 지도 | `GET /roads?bbox=&limit≤2000&cursor=` → GeoJSON `{features, next_cursor}`; properties `road_id, road_name, road_number, path_type, accepted/pending/rejected` | 줌 레벨별 3분리 없음. 동 단위 집계 없음 |
| 데이터셋 | `GET /roads/summary` → `datasets[{boundary, metadata}]` | **서울시 도보 네트워크**(횡단보도·육교·지하도 포함) — Q4 해결 |
| 검수 | `/reviews/queue`, `/reviews/{confirm_id}/{accept|reject|rollback}`, `/videos/{id}/roads` | 반려 사유는 자유 텍스트 `reason`. 낙관적 잠금 `expected_version` |

역할: `user.role` — `reviewer`, `admin`, 그 외(수집가).
검수 웹 이름은 "길:록 (GILLOG) — 누구나 이동할 수 있는 지도". 촬영 목적은 **보행 접근성 지도**로 보인다 (Q1 단서).
