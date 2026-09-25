# Stitch 프롬프트 — 도로 영상 수집가 앱

각 블록을 Stitch에 **하나씩** 붙여넣는다. 한 번에 여러 화면을 요구하면 품질이 떨어진다.

공통 규칙: 모바일 앱 화면, 한국어 UI, 라이트 모드, 플랫 디자인, 실무용 도구 톤(장식 최소).

상태 색상 (모든 화면 공통):
- 미촬영 = 회색 #888780
- 촬영완료/검수전 = 노랑 #EF9F27
- 검수완료 = 초록 #97C459
- 반려 = 빨강 #E24B4A

---

## 0. 디자인 시스템 먼저 등록

화면을 뽑기 전에 `create_design_system`으로 아래를 등록한다.
등록해두면 화면마다 색·폰트를 다시 설명할 필요가 없고 12개 톤이 자동으로 맞는다.

```
Name: 영상수집 (Road Collector)

Colors:
- background #FFFFFF
- surface #F5F5F3
- border #E3E2DD
- text primary #1C1C1A
- text muted #6B6A65
- accent #2B6CB0
- status/none #888780      (미촬영)
- status/pending #EF9F27   (촬영완료·검수전)
- status/accepted #97C459  (검수완료)
- status/rejected #E24B4A  (반려)

Typography: clean sans-serif. Title 24, heading 17, body 15, caption 12-13.
Two weights only: regular 400, medium 500.

Tone: utilitarian internal tool for field workers. Flat. No decorative
illustrations, no gradients, no shadows. Generous touch targets — used
one-handed, outdoors, sometimes in a moving vehicle.
All UI text in Korean. Light mode only.
```

---

## 0-1. 공통 프리앰블 (디자인 시스템을 못 쓸 때만)

```
A mobile app screen for a Korean road-video data collection tool used by field
workers. Utilitarian, flat design. No decorative illustrations. All UI text in
Korean. Light mode. Clean sans-serif. Status colors: gray #888780 = not captured,
amber #EF9F27 = captured/pending review, green #97C459 = approved,
red #E24B4A = rejected.
```

---

## 1. 로그인

```
[공통 프리앰블]

Screen: Login. Portrait.
Centered vertical layout with generous whitespace.
- App title "영상 수집" at top center, medium weight
- Text field labeled "아이디"
- Password field labeled "비밀번호" with a show/hide eye icon on the right
- Inline error text slot in red below the password field reading
  "아이디 또는 비밀번호가 올바르지 않습니다"
- Full-width primary button "로그인"
- Below the button, centered: gray "계정이 없나요?" followed by a blue text link "회원가입"
- Small gray caption at the bottom: "자동 로그인됩니다"
No social login, no forgot-password link.
```

---

## 1-1. 회원가입

```
[공통 프리앰블]

Screen: Sign up. Portrait. Same layout and spacing as the login screen.
- Title "회원가입", subtitle "아이디와 비밀번호만 정하면 바로 시작합니다"
- Text field "아이디", password field "비밀번호" with show/hide eye icon,
  password field "비밀번호 확인"
- Inline red error slot: "이미 있는 아이디입니다"
- Full-width primary button "가입하고 시작하기"
- Centered below: gray "이미 계정이 있나요?" + blue link "로그인"
- Small gray caption at the bottom: "이메일·휴대폰 인증 없이 가입됩니다"
No email, no phone verification, no terms checkbox.
```

---

## 2. 메인 (로그인 후)

```
[공통 프리앰블]

Screen: Home dashboard. Portrait.
Top bar: title "영상 수집" on the left, a settings gear icon on the right.

Below it, a rounded summary card:
- "오동현님, 18.4km 촬영했어요!"
- Two side-by-side boxes: green dot "확정" … "8.1km", amber dot "검수중" … "4.3km".
  Distance only — never show money amounts.

Below the card, an alerts block that may hold 0, 1 or 2 items stacked
vertically with 12px gap; when there are none the block is absent and the card
sits directly above the tiles with the normal section gap:
- a full-width dismissible red-tinted notice (one-time, disappears once read):
  bell icon, "내 영상 2건이 반려됐어요" in medium red, below it gray
  "사유: GPS 이상 · 화질 불량", and a close (×) button on the right.
  It is a notice, not a to-do — no count badge, no "재촬영" wording.
- a full-width amber chip with upload icon: "업로드 대기" … "3건"
Sections on this screen are separated by generous space (~36px).

Below that, two large square tiles side by side:
- Left tile "지도" with a small map thumbnail showing colored road lines, caption "얼마나 했는지 보기"
- Right tile "촬영" with a camera icon, caption "영상 수집"

Below the tiles, one wide horizontal tile "앨범 리스트" with caption
"찍은 데이터 확인" and a small map thumbnail on the right edge.

Bottom: a thin gray line of text "저장공간 12.4GB 남음", then a bottom tab bar
with four items: 홈 / 지도 / 촬영 / 앨범 (홈 active). The same tab bar appears
on every tab-root screen (map at every zoom, album). Tab roots have no back
arrow.
```

---

## 3. 촬영 — 대기 상태

```
[공통 프리앰블]

Screen: Camera capture, standby. LANDSCAPE orientation, wide.
Full-bleed camera viewfinder background: a pedestrian's eye-level view of a
neighborhood street ahead, shot handheld while walking along the roadside —
asphalt, curb, parked cars, low buildings. No car interior, no dashboard,
no windshield.

Overlays on top of the camera feed:
- Top center: distance pill — "0m" large (32px) with "/ 100m" small beside it.
  This is the primary readout; no road name, no other text up here.
- Top right: a small green dot with text "GPS 4m" (always shown)
- Right center edge: a large circular white record button (hollow ring), no label
- Bottom left: a 150px square minimap — map only. Thick road lines in the four
  status colors and a blue dot for current position. No header, no legend, no
  labels (the legend lives on the map tab). No dim overlay on the camera feed.
- Nothing else at the bottom. Location is read from the minimap, not from text.

No zoom buttons, no filters, no settings icons, no status badges. Minimal chrome.
```

---

## 4. 촬영 — 녹화 중

```
[공통 프리앰블]

Same as the standby camera screen, LANDSCAPE, but recording.
Background is still a handheld pedestrian eye-level view of a neighborhood
street — no car interior, no windshield.
- Top center pill: red dot, "68m" large (32px), "/ 100m" small, and "00:12"
  small and dimmed as a secondary readout. No progress ring on the button.
- The circular record button is now a red rounded square (stop), no label
- Bottom left minimap (same 150px square as standby) adds a bright blue trail
  behind the position dot. Still no legend.
- Top right shows an amber dot with "GPS 18m" and a thin amber (#EF9F27, dark
  text) banner across the top that tells the collector what to do:
  "GPS 18m · 이대로 저장하면 반려될 수 있어요. 잠시 멈춰 신호를 기다리세요"
- No percentage, no zone name, no extra badges anywhere
```

---

## 5. 촬영 종료 확인 시트

```
[공통 프리앰블]

Screen: Camera screen PORTRAIT, dimmed, with a bottom sheet rising over it.
Behind the dim: a handheld pedestrian eye-level view of a neighborhood street,
barely visible. No car interior.
Bottom sheet contents, using the landscape width as two columns:
- Drag handle at top
- Left column: title "이 클립을 저장할까요?", then a 16:9 preview of the clip
  (street at eye level, play icon, caption "18초 · 112m · 성북로 12길" in the
  corner), then a thin amber warning row
  "저정확도(GPS 18m) 구간 6초 포함 — 검수에서 반려될 수 있어요"
- Right column (200px, on the grip side): three stacked boxed buttons —
  primary "저장", secondary outlined "폐기 후 다시 찍기", outlined red "폐기"
- No HUD badges behind the dim
```

---

## 6. 지도 — 광역 (동 단위 달성률)

```
[공통 프리앰블]

Screen: Coverage map, zoomed out to show a whole district. Portrait.
Top bar: title "지도" (no back arrow — tab root), blue pill badge "전체 42%" on
the right. Bottom tab bar 홈 / 지도 / 촬영 / 앨범 with 지도 active.
Second row: filter chips "전체" (selected), "내 촬영", "반려".

Body: a map of a Korean city district divided into neighborhood (동) areas by
thin boundary lines. Each area is filled with a translucent blue wash whose
opacity encodes completion — nearly transparent for low percentages, strongly
tinted for high ones.

Centered inside each area, two stacked lines of text:
- the neighborhood name in medium weight: 성북동, 삼선동, 동선동, 돈암동,
  안암동, 보문동, 정릉동, 길음동, 월곡동
- the percentage below it in a larger number: 62%, 9%, 88%, 54%, 91%, 47%,
  4%, 58%, 85%

Areas with low completion should read as clearly emptier than the rest.
No individual road lines at this zoom — only area fills and labels.
Bottom left: a small legend card explaining the tint scale, 0% to 100%.
```

---

## 7. 지도 — 중간 (도로 단위)

```
[공통 프리앰블]

Screen: Coverage map at neighborhood zoom. Portrait. Same top bar and filter
chips as the wide view.

Body: a street map showing roads as thick colored lines, no area fills.
Most roads gray, several amber, several green, two short red segments.
Lines follow the street grid and stop at intersections — each segment is a
separately colored unit, so one street can be green at one end and gray at the other.
A blue dot with a light halo marks the user position.

Floating on the map:
- Top right: two stacked square icon buttons — layers, and locate-me
- Bottom left: a legend card with four rows, each a short color bar plus label:
  미촬영 / 촬영완료·검수전 / 검수완료 / 반려

No zoom +/- buttons, no compass.
```

---

## 8. 지도 — 근접 (개별 클립)

```
[공통 프리앰블]

Screen: Coverage map. Portrait.
Top bar: back arrow, title "지도", and on the right a blue pill badge "전체 42%".

Second row: horizontal filter chips — "전체" (selected, dark fill),
"내 촬영", "반려".

Body: a street map zoomed in close, showing individual recorded clips rather
than whole roads. Each clip is a short colored line about a block long, with a
small dot at its start and a tiny arrowhead showing the direction it was driven.
Adjacent clips on the same street have visible gaps between them.
Colors: amber for pending review, green for approved, red for rejected.
Uncaptured road underneath is a thicker gray line.
A blue dot with a light halo marks the user's position, with a short dashed
blue trail behind it showing a clip recorded just now but not yet uploaded.

Floating on the map:
- Top right: two stacked square icon buttons — layers, and locate-me
- Bottom left: a small legend card with four rows, each a short color bar
  plus label: 미촬영 / 촬영완료·검수전 / 검수완료 / 반려

No zoom +/- buttons, no compass.
```

---

## 9. 지도 — 반려 구간 탭

```
[공통 프리앰블]

Screen: Same coverage map, portrait, with one red road segment highlighted
thicker with small dots at both ends. A bottom sheet covers the lower third.

Bottom sheet contents:
- Drag handle
- Row 1: "성북로 12길" on the left, a red badge "반려" on the right
- Row 2 gray text: "반려 사유: GPS 이상"
- Row 3 gray text: "검수 09/20 18:30" on the left, "누구든 다시 찍으면 됩니다" on the right
- One full-width secondary outlined button "반려된 영상 보기"
No "start shooting here" button — a rejected segment is not anyone's assignment.
```

---

## 10. 앨범 리스트

```
[공통 프리앰블]

Screen: Video list. Portrait.
Top bar: title "앨범" (no back arrow — this is a tab root), and on the right an
upload icon button with a small amber count badge ("3" = pending uploads) next
to a filter icon. Upload is manual — this button is the entry point to the
upload queue.
Second row: filter chips "전체", "업로드 대기", "검수 대기", "반려".
Bottom: tab bar 홈 / 지도 / 촬영 / 앨범 with 앨범 active.

A scrolling list of horizontal cards. Each card:
- Left: a square thumbnail showing a small route drawn as colored lines on a
  pale map background
- Right: three stacked lines —
  medium-weight place name "성북로 12길" (collectors remember places, not
  file names — the file name lives on the detail screen)
  gray "26/09/20 13:47 · 1분 14초 · 112m"
  a small status badge
- Far right: a small upload status icon

Show six cards covering every state:
1. green badge "검수완료", gray cloud-done icon on the far right
2. amber badge "검수 대기", gray cloud-done icon
3. red badge "반려" with a second gray line "사유: GPS 이상"
4. gray badge "반려 · 재촬영됨" — the whole card slightly dimmed
5. uploading: no review badge, instead a thin blue progress bar spanning the
   card bottom edge and right-side text "62%"
6. failed: no review badge (nothing uploaded means nothing to review); red
   text "업로드 실패" on the right with a small "재시도" button

The upload indicator sits on the far right of each card and is visually
separate from the review badge — they are two different things.
```

---

## 11. 영상 상세

```
[공통 프리앰블]

Screen: Video detail. Portrait.
Top: a 16:9 video player showing a dashcam frame of a road, with a play button
and a scrub bar underneath.

Below the player: a map panel about 200px tall showing the full recorded route
as a thick blue line with start and end dots, and a small marker mid-route.

Below the map, a metadata block with label-value rows:
"촬영일시 / 26.09.20 13:47", "길이 / 1분 14초", "거리 / 112m", "업로드 / 완료".

Below that, a red-tinted notice box:
title "반려됨", body "사유: GPS 이상", and one gray explanatory line.
No reshoot button.

At the very bottom, separated by whitespace, a quiet text-only button in red:
"삭제" with a small gray caption beside it "업로드 전에만 삭제할 수 있습니다".
```

---

## 12. 업로드 큐

```
[공통 프리앰블]

Screen: Upload queue. Portrait.
Top bar: back arrow, title "업로드", right side gray text "3건 · 420MB".
Below: a thin info strip with a wifi icon reading "Wi-Fi 연결됨".

A list of rows, each with a small video thumbnail, filename, size, and status:
- Row 1: "업로드 중 62%" with a blue progress bar
- Row 2: gray "대기 중"
- Row 3: red "실패 · 네트워크 오류" with a small "재시도" text button on the right

Bottom: two buttons side by side, "전체 재시도" and "전체 취소".
```

---

## 13. 권한 요청

```
[공통 프리앰블]

Screen: Permission onboarding. Portrait.
Centered layout, generous whitespace.
Title "시작하기 전에", subtitle "영상 수집에 필요한 권한입니다".

Two stacked rows, each with a simple outline icon on the left and two lines
of text on the right:
- camera icon / "카메라" / "도로 영상을 촬영합니다"
- location icon / "위치" / "촬영 경로를 기록합니다. 걷는 중에도 기록이 필요해 항상 허용이 필요합니다"
No notification permission.

Bottom: full-width primary button "권한 허용하기".
```

---

## 14. 설정

```
[공통 프리앰블]

Screen: Settings. Portrait.
Top bar: back arrow, title "설정".

Grouped list sections with gray section headers:

"업로드"
- toggle row "Wi-Fi에서만 업로드" (on)
(no auto-upload toggle — uploads are started manually from the album)

"촬영"
- row "영상 화질" with right-aligned gray value "1080p" (no fps)

"저장공간"
- a row showing "12.4GB 사용 가능" with a thin usage bar
- a row "업로드 완료분 정리" with a right chevron

"계정"
- row "오동현" with gray "수집가"
- red text row "로그아웃"

Bottom: small centered gray text "버전 1.0.0".
```

---

## 15. 빈 상태 · 오류

```
[공통 프리앰블]

Produce three small screen states on one canvas, stacked vertically as three
separate phone frames. Portrait.

Frame 1 — empty album:
Top bar "앨범". Centered in the body, a small outline camera icon in light gray,
below it "아직 촬영한 영상이 없습니다" in muted text, and below that a
secondary button "촬영 시작하기". No illustration, no mascot.

Frame 2 — offline:
Any screen with a thin full-width amber strip pinned directly under the top bar,
containing a small wifi-off icon and the text "오프라인 · 저장된 내용만 표시됩니다".
The content below is shown normally, not blocked.

Frame 3 — map loading:
The coverage map with roads drawn in flat light gray placeholder lines and a
small pill at the top center reading "불러오는 중" with a tiny spinner.
No full-screen blocking spinner.
```
