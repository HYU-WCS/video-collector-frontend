# 백엔드 전달용 — 스키마 변경 요청

전달용 페이지: https://claude.ai/artifact/JxDvyrGbrSAS4TQ9A3K5db
상세 근거는 `02-db-schema.md`, `05-decisions.md` 참조.

---

## 0. 먼저 확인 — RoadTable 한 행의 단위

**구간이어야 한다.** `road_id` 하나가 도로 전체를 가리키면, 100m 클립 하나가 accept되는
순간 그 도로 전체가 완료로 칠해져 지도 화면이 무의미해진다.
ITS/OSM의 링크 1개(교차로~교차로) = `RoadTable` 한 행이면 100m 클립과 스케일이 맞는다.

여기서 갈리면 지도 화면을 다시 설계해야 하므로 가장 먼저 합의할 것.

## 1. 컬럼 추가

### P0 — 없으면 해당 화면을 아예 못 만듦

| 컬럼 | 이유 |
|---|---|
| `VideoTable.trajectory_path` | 지도 화면 전체가 의존. 현재 좌표 저장할 자리가 없다. |
| `RoadTable.geometry` | "미촬영 회색" 렌더에 필요. 네이버 지도 API는 도로 형상을 주지 않는다. |
| `ConfirmTable.reject_reason` | 없으면 수집가가 사유를 모른 채 똑같이 다시 찍는다. 선택지: GPS 이상/화질 불량/구간 누락/야간·역광 |

### P1 — 없으면 느려지거나 동작이 이상해짐

| 컬럼 | 이유 |
|---|---|
| `VideoTable.thumbnail_path` | 앨범 목록에 지도 컴포넌트 20개 띄우면 죽는다. 서버가 궤적을 정적 이미지로 렌더. |
| `VideoTable.status` | ConfirmTable 유무로 판단하면 목록 쿼리마다 JOIN, 롤백 처리가 지저분 |
| `VideoTable.duration_sec`, `distance_m` | 목록 표시. 없으면 항목마다 파일을 열어야 함 |
| `RoadTable.dong` | 지도 광역 뷰(행정동 달성률) 집계 |
| `RoadTable.seq` | "국도 47호선 3구간" 표시 |
| `RoadTable.direction` | 양방향을 따로 찍어야 함 |

### P2

| 컬럼 | 이유 |
|---|---|
| `ConfirmTable.confirm_user` | 판정 이력 |

~~`RoadTable.assigned_user`~~ — 철회. 구역을 나누지 않기로 함 (2026-09-23).

## 2. DDL

```sql
ALTER TABLE VideoTable
  ADD COLUMN trajectory_path VARCHAR(255),
  ADD COLUMN thumbnail_path  VARCHAR(255),
  ADD COLUMN status          ENUM('uploaded','pending','accepted','rejected') NOT NULL DEFAULT 'uploaded',
  ADD COLUMN duration_sec    INT,
  ADD COLUMN distance_m      INT;

ALTER TABLE RoadTable
  ADD COLUMN seq           INT,
  ADD COLUMN direction     ENUM('up','down'),
  ADD COLUMN dong          VARCHAR(40),
  ADD COLUMN geometry      JSON,
  ADD COLUMN status        ENUM('none','pending','accepted','rejected') NOT NULL DEFAULT 'none';

ALTER TABLE ConfirmTable
  ADD COLUMN reject_reason ENUM('gps','quality','missing','lighting'),
  ADD COLUMN confirm_user  INT;

CREATE INDEX idx_video_user_date ON VideoTable(upload_user, upload_date DESC);
CREATE INDEX idx_video_status    ON VideoTable(status);
CREATE INDEX idx_road_dong       ON RoadTable(dong);
```

## 3. 상태 계산 규칙 (컬럼보다 중요)

**accept가 하나라도 있으면 완료. reject 판정은 지우지 않는다.**

```sql
CASE
  WHEN COUNT(*) = 0           THEN 'none'
  WHEN SUM(acceptability) > 0 THEN 'accepted'
  ELSE                             'rejected'
END
FROM ConfirmTable WHERE road_id = ?
```

판정을 지우면 "아직 검수 안 받음"과 구분이 안 돼서 오히려 꼬인다.
`(video_id, road_id)` 쌍마다 한 행 → 부분 반려가 자연스럽게 지원된다.

## 4. API 요청

- 지도 API: `bbox` 필수, **줌 레벨별 3개 분리** (동 집계 / 도로 구간 / 개별 클립)
- 앨범 API: **커서 페이지네이션** (offset 아님)
- 앨범 응답에 `superseded` 플래그
- 앨범 응답에 `reviewed_at` (= `ConfirmTable.confirm_date`), 쿼리 파라미터 `reviewed_after`
  → 반려 알림용. 읽음 상태는 앱이 로컬에 저장하므로 서버 컬럼 불필요
- 업로드 API: 영상+궤적 **한 요청**, 둘 다 성공 시에만 INSERT. `road_id`는 보내지 않음 (재촬영 모드 삭제)
- **회원가입 API** `POST /api/signup { username, password } → { token, user }`. 인증 없음, 아이디 중복이면 409
- 진척도 API: 금액 대신 거리 — `my_distance_m`, `confirmed_distance_m`, `pending_distance_m`
- 클립 API(`/api/map/clips`): **모든 사용자**의 검수 전 궤적 포함 — 중복 촬영 방지용 [제안]
- 영상 스트리밍: Range 요청 지원

## 5. 합의 필요

0. **같은 구간 중복 accept를 km로 인정하나** — 둘 다 인정 vs 구간당 첫 accept만. 확정 km 계산 기준.

1. **도로 형상 출처** — ITS 표준노드링크(차량 도로망, 인도·골목 없음) vs OSM(보행로 태그 있음).
   도보 수집이라 OSM이 유력.
2. **영상 실물 저장 위치** — 도보라 클립당 80~100MB, 3000개면 270GB. 로컬 디스크로 감당되는지,
   720p 하향할지 같이 판단 필요. 경로는 날짜별로 쪼갤 것.
3. ~~**iOS 코덱**~~ — 안드로이드로 가닥(09.23). 안드로이드 녹화는 기본 H.264/mp4라 보류.
