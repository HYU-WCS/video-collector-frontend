# DB 스키마

DB는 팀원 담당이다. 아래 "요청" 항목은 **프론트 입장에서 필요한 것**이고, 합의 전이다.

## 원본 [원본]

```
UserTable
  user_id (pk)
  username
  password

VideoTable
  video_id (pk)
  video_name
  video_path
  upload_user (fk) -> UserTable.user_id
  upload_date

RoadTable
  road_id (pk)
  road_name
  road_number

ConfirmTable
  confirm_id (pk)
  video_id (fk) -> VideoTable.video_id
  road_id (fk, 1:N) -> RoadTable.road_id
  confirm_date
  acceptability
```

## 요청하는 변경 [제안]

### VideoTable — 컬럼 추가

| 컬럼 | 이유 |
|---|---|
| `trajectory_path` | 궤적 JSON 위치. 지도 화면 전체가 이 데이터에 의존하는데 지금 저장할 곳이 없다. |
| `thumbnail_path` | 서버가 만든 궤적 미리보기 이미지. 앨범 목록에 지도 컴포넌트 20개를 띄우면 앱이 죽는다. |
| `status` | `uploaded/pending/accepted/rejected`. ConfirmTable 레코드 유무로 판단하면 목록 쿼리마다 JOIN이 붙고 롤백 처리가 지저분해진다. |
| `duration_sec` | 목록에 "1분 14초" 표시. 없으면 매번 영상 파일을 열어야 한다. |
| `distance_m` | 목록 표시 + 진척도 계산 |

### RoadTable — **구간 단위여야 함** (가장 중요)

`road_id` 하나가 도로 전체를 가리키면, 100m 클립 하나가 accept되는 순간 그 도로 전체가
완료로 바뀐다. 지도 화면이 통째로 무의미해진다.

```
road_id      12
road_number  "47"
road_name    "동소문로"
seq          3          ← 그 도로의 몇 번째 구간인지
direction    "up"|"down" ← 양방향을 따로 찍어야 함
geometry     [[lat,lon], ...]
dong         "동소문동"  ← 지도 광역 뷰(동 단위 달성률) 집계용
status       파생값 캐시 (아래 참조)
```

**형상 좌표(`geometry`) 출처가 미정이다.** 네이버 지도 API는 도로 형상을 주지 않는다.
- ITS 표준노드링크 — 공공데이터, 링크 1개 = 교차로~교차로 구간. **차량 도로망이라 인도·골목·계단이 없다.**
- OSM — `highway=footway|path|steps|pedestrian` 태그로 보행로가 잘 들어가 있다.
- **도보 수집이므로 OSM이 유력하다.** 촬영 대상에 골목·인도가 포함되는지 확인 후 결정.

### ConfirmTable — 컬럼 추가

| 컬럼 | 이유 |
|---|---|
| `reject_reason` | 없으면 수집가가 왜 반려됐는지 모르고 똑같이 다시 찍는다. 정해진 선택지(GPS 이상 / 화질 불량 / 구간 누락 / 야간·역광)로. |
| `confirm_user` | 누가 판정했는지 |

`(video_id, road_id)` 쌍마다 한 행. 영상 하나가 구간 3개에 걸쳤을 때 2번 구간만 반려하는
**부분 반려**가 이 구조에서 자연스럽게 나온다.

### 인덱스

```
(upload_user, upload_date DESC)   -- 앨범 목록
(status)                          -- 상태 필터
```

## 도로 상태는 파생값이다 [확정]

`RoadTable.status`는 저장값이 아니라 `ConfirmTable`에서 계산되는 값이다. 캐시 컬럼으로 두되,
진실은 항상 ConfirmTable에 있다.

```sql
CASE
  WHEN COUNT(*) = 0            THEN 'none'       -- 미촬영
  WHEN SUM(acceptability) > 0  THEN 'accepted'   -- accept가 하나라도 있으면 완료
  ELSE                              'rejected'   -- reject만 있음 = 재촬영 필요
END
```

**accept가 하나라도 있으면 완료.** reject가 몇 개 섞여 있든 보지 않는다.
검수 API(accept/reject/rollback)가 호출될 때만 캐시를 갱신하면 된다.

## 영상 실물은 DB에 넣지 않는다 [확정]

`video_path`는 포인터고, 실물은 서버 파일시스템이나 오브젝트 스토리지에 둔다.
관계형 DB에 BLOB을 넣으면 백업이 수십~수백 GB로 불어나고 구간 스트리밍이 안 된다.

- 경로는 날짜별로 쪼갠다: `videos/2026/09/20/clip_1042.mp4`
- **[미정]** 로컬 디스크 / 오브젝트 스토리지(NCP, S3, MinIO) / NAS 중 어디에 둘지
- 용량: 도보라 클립당 80~100MB(H.264 기준). 3000개면 270GB. 720p 하향 검토 필요.
- 폰에서 로컬 영상을 지우는 시점은 **서버가 파일을 받고 DB INSERT까지 끝난 뒤**
