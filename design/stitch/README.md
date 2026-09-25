# Stitch 생성 결과

- Stitch 프로젝트: `projects/5412516818158249368` (영상수집 (Road Collector))
- 디자인 시스템: `assets/9657150900561138040`
- 원본 프롬프트: `../stitch-prompts.md`
- 통합 목업: `../mockups.html` (이 폴더 HTML을 srcdoc으로 살려 넣음 — HTML 고친 뒤 `python3 design/build_mockups.py`)
- 최초 생성 2026-09-22. 같은 날 critique 21/40 → 1차 수정 → 24/40 → 2차 수정(내비·미니맵·GPS 카피·종료 시트·앨범)

각 화면은 `NN-name.png`(스크린샷) + `NN-name.html`(Tailwind HTML) 한 쌍.
HTML은 RN 변환 시 레이아웃·간격·색 참고용이지 그대로 쓰는 코드가 아님.

## PNG는 Stitch 스크린샷이 아님

Stitch가 준 스크린샷은 03/05가 검은 화면이었고(HTML의 body `h-full`이 0으로 접히는 버그),
이후 HTML을 직접 고쳤기 때문에 **모든 PNG는 로컬 렌더**다.
Playwright(`playwright-core` + chromium-1208)로 세로 390×884@2x, 가로(03/04/05) 844×390@3x, 15는 390×2087@2x. `waitUntil: "load"` + 2.5s 대기 (networkidle은 외부 이미지 때문에 타임아웃).
Chrome headless `--screenshot`은 창 폭을 500 미만으로 못 줄여서 쓰지 않는다.
재렌더: scratchpad의 `shot/shot.mjs` 참고 (bun shot.mjs <이 디렉토리>).

| # | 파일 | 프롬프트 섹션 | Stitch screen id | 비고 |
|---|---|---|---|---|
| 01 | login | 1 | 156242066d1e432ea74dce925b7104af | |
| 01b | signup | 1-1 | — (로컬 제작) | 2026-09-23 팀 요청. 01-login HTML을 변형해 직접 만듦 |
| 02 | home | 2 | 99fc99730df44a1eadd028ed47819791 | 탭바 홈/지도/촬영/앨범 (홈 활성). 섹션 간격 36px. 알림 칩은 조건부 — `02-home.html?alerts=both\|upload\|reject\|none`, 결과 `02-home.png`(둘 다) / `02-home.one-alert.png` / `02-home.no-alert.png` |
| 03 | camera-standby | 3 | 08d3d83bab804f9d83761c01cbff3b1f | 도로명 pill 삭제, 거리 상단 32px, 미니맵 150px 지도만(범례·헤더 없음), dim 삭제 |
| 04 | camera-recording | 4 | 338378c1b0214e15b6b407ccb5ad9e27 | 구역 배지·68%·"기록 중" 삭제, 거리 32px/시간 13px, 미니맵 150px+파란 궤적, GPS 배너에 행동 지시(#EF9F27) |
| 05 | camera-finish-sheet | 5 | a4c540c855504d31839d1542ffdcb17e | 2열(좌 16:9 프리뷰+저정확도 경고 / 우 버튼 3개), 제목 "이 클립을 저장할까요?", "폐기 후 다시 찍기" |
| 06 | map-district | 6 | 3e79fb268f144d3b8cf18a8fe16c5c25 | 뒤로가기 제거, 탭바 추가 |
| 07 | map-road | 7 | baa576e837754179a595f9ad665feef1 | 뒤로가기 제거, 탭바 홈/지도/촬영/앨범 |
| 08 | map-clip | 8 | b6f6c2a63cf648df857ed8cebc268906 | 뒤로가기 제거, 탭바, "수집률"→"전체" |
| 09 | map-rejected-sheet | 9 | 6d75ee2139874b2f9618a79e6a0fc706 | 국도 47호선→성북로 12길, 1.2km 삭제 |
| 10 | album-list | 10 | b36de30f4ab54dc6b514687bdee4dd41 | 뒤로가기 제거, 업로드 버튼(배지 3), 칩 전체/업로드 대기/검수 대기/반려, 제목 장소명, cloud_done 아이콘, 미업로드 카드 검수 배지 없음, 탭바 |
| 11 | video-detail | 11 | dd03f2ab6877483eb6ea6cb94fcac418 | 골목 사진, 54km/h·E-402·장비상태·지도± 삭제, "재주행"→"다시 걸으며" |
| 12 | upload-queue | 12 | 0da9b5c1990347b78c0e1cfb4ee8194d | 골목 썸네일, 경부선→성북로, 기술정보 카드 삭제, "자동 업로드 중" 삭제 |
| 13 | permissions | 13 | b138b1906df44c65a92c07f8a1fb4190 | 알림 행 삭제, "주행 중"→"걷는 중" |
| 14 | settings | 14 | 4c6f0ab1473341a29a8f0dd4ad1aa173 | 자동 업로드 토글 삭제, 60fps·빌드·단말 삭제 |
| 15 | empty-states | 15 | 6704aedc73a24f5bb20526039f805710 | "연결 시 자동 재개"→"연결 후 앨범에서 업로드", 프레임마다 미니 탭바, 뒤로가기 제거 |

## 전 파일 일괄 적용 (2026-09-22)
- `font-bold/semibold` → `font-medium` (디자인 시스템 400/500만)
- 상태색 이탈 hex·Tailwind 팔레트(`gray-*`, `emerald-*`, `red-*`…) → 스펙 hex
- `shadow-*`, `drop-shadow`, `animate-pulse` 제거
- 필터 칩 26px → 44px (`py-2.5 text-[14px]`)
- 세로 화면 래퍼에 `min-w-0`, `html { height: 100%; }` 보정

## 남은 편차 / 안 건드린 것
- 샘플 숫자(18초·112m 등)는 차량 속도. 도보 전제 재계산은 **보류** (CLAUDE.md 남은 작업 참고)
- 날짜 포맷 3종 혼재 — 프로토타입이라 그대로
- `backdrop-blur-sm` 9건 — 그대로
- 14 "현장단말 #04" 배지, 01 상단 부제, 06 "실시간 갱신됨" — 그대로
- 09 하단 시트가 탭바를 덮으므로 09엔 탭바 안 넣음
- 상태색이 시스템 상태(11 전송 완료 초록점, 12 실패 빨간점)에도 쓰임 — 2차 critique P2, 미수정
- 샘플 시간 "1분 14초"는 사용자가 stitch-prompts.md 10/11에 직접 반영. HTML엔 아직 "18초" — 보류 결정 유지
- Stitch 디자인 시스템 Tone 문구("moving vehicle")는 Stitch 쪽만 미수정

## 2026-09-23 팀 피드백 반영 (HTML 직접 수정 → 로컬 재렌더)

- 01 로그인 하단에 회원가입 링크, 01b 회원가입 신규
- 02 홈: 확정/검수중 금액 → km. `재촬영 필요` 칩 → 읽으면 사라지는 반려 알림(전체 폭, × 닫기)
- 06~09, 15: 필터 칩 `내 담당` 삭제
- 09 반려 시트: 배지 `재촬영 필요` → `반려`, `여기서 촬영 시작` 삭제, "누구든 다시 찍으면 됩니다"
- 11 상세: `재촬영하러 가기` 삭제
- Stitch 프로젝트 원본에는 반영 안 됨 — 이 폴더 HTML이 최신
