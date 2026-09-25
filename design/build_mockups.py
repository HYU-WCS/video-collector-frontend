# design/mockups.html 생성기.
# design/stitch/*.html 을 srcdoc iframe으로 그대로 살려 넣고(이미지 아님),
# 화면마다 요소 설명 + 수치 산출 규칙을 붙인다. 실행: python3 design/build_mockups.py

import html, os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "stitch")
OUT = os.path.join(ROOT, "mockups.html")

def read(name):
    return open(os.path.join(SRC, name), encoding="utf-8").read()

def srcdoc(doc):
    return html.escape(doc, quote=True)

# 02 알림 상태 변형: window.__alerts 를 먼저 심는다
def with_alerts(doc, state):
    return doc.replace("<head>", f"<head><script>window.__alerts={state!r};</script>", 1)

# ─────────────────────────────────────────────────────────────
# 화면 스펙: (파일, 태그, 제목, 노트, [요소 설명...], 가로여부, 02변형)
# 요소 설명은 "이름 — 동작/수치" 한 줄씩. 숫자가 나오는 곳은 어떻게 구하는지 적는다.
# ─────────────────────────────────────────────────────────────
SCREENS = [
    dict(file="01-login.html", tag="로그인", title="로그인 — 한 번만 치고 다시는 안 친다",
         note="현장에서 매번 입력하는 건 고문이라 자동 로그인이 기본. 토큰은 expo-secure-store에 두고 앱 시작 시 조용히 갱신한다. 하단에 회원가입 링크(01b). 비밀번호 찾기 없음.",
         items=[
             "아이디 / 비밀번호 — 서버 로그인 API. 실패 시 필드 아래 빨간 한 줄만, 팝업 없음",
             "로그인 버튼 — 성공하면 access/refresh 토큰을 SecureStore에 저장하고 02 홈으로",
             "\"자동 로그인됩니다\" — 다음 실행부터 이 화면을 건너뛴다는 예고. 토큰 만료·401이면 다시 여기로",
         ]),
    dict(file="01b-signup.html", tag="회원가입", title="회원가입 — 인증 없이 아이디·비밀번호만", variant="signup",
         note="팀 요청(09.23): 간단하게, 인증 없이. 가입 응답에 토큰을 바로 받아 로그인을 한 번 더 거치지 않고 02 홈으로.",
         items=[
             "아이디 / 비밀번호 / 비밀번호 확인 — 확인 불일치는 앱에서 먼저 막는다",
             "이미 있는 아이디입니다 — 서버 409. 그 외 실패는 서버 연결 오류 문구",
             "가입하고 시작하기 — POST /api/signup → { token, user }. 토큰을 SecureStore에 저장",
             "이메일·휴대폰 인증, 약관 동의 없음. 서버 주소를 알면 누구나 가입 — 내부 도구라 수용",
         ]),
    dict(file="02-home.html", tag="홈 · 알림 2개", title="홈 — 오늘 얼마나 했고, 지금 뭘 해야 하는지",
         note="요약 카드(성과) → 알림 칩(할 일) → 3개 타일(가는 곳) 순서. 알림 칩은 조건부라 0·1·2개 어느 경우에도 자연스럽게 배치된다(아래 변형 참고). 하단 탭바 홈/지도/촬영/앨범.",
         items=[
             "18.4km — 내 클립 전체의 distance_m 합. 업로드 완료된 것만 센다(로컬에만 있는 클립은 제외). 소수 1자리",
             "확정 8.1km — 검수완료 클립 distance_m 합. 검수중 4.3km — 검수전 클립 합. 금액은 표시하지 않는다(D13)",
             "업로드 대기 N건 — 로컬 pending/ 폴더의 클립 수. 0이면 칩 자체가 사라짐. 탭 → 12 업로드 큐",
             "반려 알림 — 마지막으로 읽은 reviewed_at 이후 내 반려 건수 + 사유. 탭 → 10 앨범 반려 필터, 탭하거나 × 하면 사라지고 다시 안 뜬다. 과제가 아니다(D14)",
             "지도 / 촬영 / 앨범 리스트 타일 — 각각 06 / 03 / 10. 탭바와 같은 목적지(프로토타입은 둘 다 둠)",
             "저장공간 12.4GB — expo-file-system getFreeDiskStorageAsync. 2GB 미만이면 이 줄이 노랑, 500MB 미만이면 촬영 버튼 비활성",
         ]),
    dict(file="02-home.html", tag="홈 · 알림 1개", title="홈 — 알림이 하나만 있을 때", variant="upload",
         note="칩이 하나면 전체 폭으로 늘어나고 건수는 오른쪽 끝. 반폭 빈칸을 남기지 않는다.",
         items=["flex-1 로 폭을 나누는 구조라 개수에 따라 자동으로 맞춰진다"]),
    dict(file="02-home.html", tag="홈 · 알림 없음", title="홈 — 할 일이 없을 때", variant="none",
         note="알림 행이 통째로 사라지고 요약 카드 바로 아래 타일이 온다. 빈 행·안내문 없음.",
         items=["섹션 간격(36px)만 남는다"]),
    dict(file="03-camera-standby.html", tag="촬영 · 대기", title="촬영 대기 — 숫자 하나, 버튼 하나, 지도 하나", landscape=True,
         note="가로 고정(도로 폭을 넓게 담기 위해). 도로명 텍스트 없음 — 어디인지는 좌하단 미니맵으로 본다. 하단엔 미니맵만, 정보를 더 넣어야 하면 상단에. 상태는 idle / recording 둘뿐이라 일시정지 없음.",
         items=[
             "0m / 100m — 이번 클립 누적 거리. 0에서 시작. 100m는 임시로 넣어둔 값 — 클립 단위는 논의 후 확정. 자동 정지 아님(정지는 항상 수동)",
             "GPS 4m — Location.watchPositionAsync 의 accuracy(m). 항상 표시. ≤10m 초록 / >10m 노랑. GPS 수신 자체가 없을 때만 녹화 버튼 비활성",
             "녹화 버튼(72px, 우측 중앙) — 오른손 엄지 자리. 탭 → recording. GPS 없으면 회색+비활성",
             "미니맵 150px — 촬영 시작 시 주변 2~3km 도로를 한 번에 받아 메모리에 든다. 주행 중 추가 요청 없음. 범례·헤더 없음(색 뜻은 지도 탭에서 배운다)",
             "카메라 피드 — dim 없음. 배율 버튼 없음(모든 영상 화각 통일). useKeepAwake 로 화면 안 꺼짐",
         ]),
    dict(file="04-camera-recording.html", tag="촬영 · 녹화 중 · GPS 낮음", title="녹화 중 — 거리가 주인공, 시간은 보조", landscape=True,
         note="거리 32px, 시간 13px. 정지 버튼에 진행 링 같은 장식 없음. GPS 정확도가 떨어지면 경고만 하지 말고 무엇을 하라고 말한다.",
         items=[
             "68m — 하버사인 누적(아래 규칙 A). 1초마다 갱신. 정수 m",
             "00:12 — 녹화 시작 기준 경과 초. trajectory 의 t 필드와 같은 시계",
             "GPS 배너 — accuracy > 10m 가 3초 이상 이어지면 표시. 문구에 결과(반려 가능)와 행동(멈춰서 기다리기)을 같이 쓴다. 회복되면 사라짐",
             "정지 버튼(빨간 사각) — 탭 → 05 확인 시트. 목표 거리 도달 시 햅틱 1회 + 거리 숫자 강조 — 그래도 정지는 사용자가",
             "미니맵 파란 궤적 — 이번 클립의 trajectory 점을 이어 그림. 점프로 판정된 점(규칙 B)은 선에서 뺀다",
             "10초마다 trajectory 임시 저장 — 앱이 죽어도 손실은 10초치",
         ]),
    dict(file="05-camera-finish-sheet.html", tag="촬영 · 종료 확인", title="종료 시트 — 찐빠 났는지 보고 저장", landscape=True,
         note="자동 저장하지 않는다. 클립마다 확인하는 이유는 흔들림·가림·잘못 찍힘을 현장에서 잡기 위해서. 가로 폭을 2열로: 왼쪽 프리뷰, 오른쪽(그립 쪽) 버튼.",
         items=[
             "프리뷰 — 방금 찍은 파일을 무음 루프 재생. 캡션은 초 · m · 미니맵 기준 가장 가까운 도로명(서버 매칭 전이라 참고용)",
             "저정확도 경고 — 규칙 C 의 lowAccSeconds > 0 이면 표시. 'N초 포함'의 N이 그 값. 규칙 B 점프가 3회 이상이면 문구가 'GPS 점프 N회'로 바뀜",
             "저장 — 캐시 → documentDirectory/pending/ 로 즉시 이동 + trajectory JSON + 썸네일 1장. 그리고 03으로 복귀",
             "폐기 후 다시 찍기 — 파일 삭제 후 바로 recording 재진입(03 을 거치지 않음)",
             "폐기 — 파일·trajectory 삭제. 확인 다이얼로그 1단계",
         ]),
    dict(file="06-map-district.html", tag="지도 · 광역 z≤13", title="지도 광역 — 동 이름이 곧 내비게이션",
         note="수천 클립을 다 그릴 수 없어 줌마다 다른 걸 보여준다. 광역에선 행정동 면 + 이름 + %. 성북동 9%를 보면 어디로 갈지 바로 안다. 탭 루트라 뒤로가기 없음.",
         items=[
             "전체 42% — 관내 전체: Σ 검수완료 구간길이 / Σ 전체 구간길이. 서버 집계(GROUP BY dong)",
             "동별 % — 같은 식을 동 단위로. 면 색의 투명도 = %. 4%·9% 같은 낮은 값은 거의 흰 면",
             "필터 칩 전체/내 촬영/반려 — 색이 아니라 필터로 '내 것'을 구분한다. 구역을 나누지 않아 '내 담당'은 없다(D15)",
             "동 면 탭 → z14로 확대(07). bbox 필수, 카메라 이동 후 400ms 디바운스로 요청",
             "확대/축소 버튼 없음(핀치). 회전·기울기 끔",
         ]),
    dict(file="07-map-road.html", tag="지도 · 중간 z14~16", title="지도 중간 — 도로 구간 단위 4색",
         note="ITS 표준노드링크의 링크 1개 = 1구간. 교차로에서 색이 바뀐다. 도로 상태는 저장값이 아니라 파생값이다.",
         items=[
             "구간 색 — ConfirmTable 에 accept 가 하나라도 있으면 초록(검수완료). 없고 검수전 클립이 있으면 노랑. 없고 reject 만 있으면 빨강. 아무것도 없으면 회색",
             "reject 는 절대 지우지 않는다 — 재촬영으로 통과해도 이력은 남고 영상 쪽만 superseded 플래그",
             "양방향은 따로 찍는다 — 구간마다 direction 이 있어 같은 도로가 방향별로 다른 색일 수 있음",
             "현위치 파란 점 — Location 1Hz. 지도 API 는 bbox 로 보이는 구간만",
             "구간 탭 → 하단 시트(09). 레이어/내 위치 버튼 2개만",
         ]),
    dict(file="08-map-clip.html", tag="지도 · 근접 z≥17", title="지도 근접 — 개별 클립과 진행 방향",
         note="클립 하나가 짧은 선 하나. 시작점 점 + 진행 화살표. 같은 도로 위 인접 클립 사이엔 틈을 둔다(어디까지 찍혔는지 보이게). 파란 점선은 방금 찍고 아직 안 올린 것.",
         items=[
             "클립 선 — trajectory JSON 의 점을 이은 것. 서버가 준 geometry 그대로 그림(앱에서 재계산 없음)",
             "화살표 — 첫 점 → 마지막 점 방향. 양방향 구분의 근거",
             "파란 점선 — 로컬 pending/ 의 trajectory. 업로드 성공하면 노랑 실선으로 바뀜",
             "클립 탭 → 11 상세. 미업로드 클립 탭 → 12 업로드 큐",
         ]),
    dict(file="09-map-rejected-sheet.html", tag="지도 · 반려 구간 탭", title="반려 시트 — 왜 반려됐는지, 누구든 다시 찍으면 된다",
         note="반려 구간은 특정인의 과제가 아니다(D14). 다른 사람이 찍을 수도 있어서 road_id 를 들고 가는 재촬영 모드는 없다. 시트가 탭바를 덮는다.",
         items=[
             "반려 배지 — 구간 상태 rejected (accept 가 하나도 없고 reject 만 있음)",
             "반려 사유 — ConfirmTable.reject_reason. 검수 시각은 confirm 행의 시각",
             "누구든 다시 찍으면 됩니다 — 그냥 가서 찍으면 검수자가 매칭한다",
             "반려된 영상 보기 — 11 상세",
         ]),
    dict(file="10-album-list.html", tag="앨범", title="앨범 — 장소로 찾고, 업로드는 여기서 시작",
         note="제목은 파일명이 아니라 장소명(수집가는 장소로 기억한다). 검수 배지(좌하)와 업로드 상태(우측)는 다른 축이라 물리적으로 떨어뜨렸다. 업로드는 자동이 아님 — 헤더 버튼으로 시작.",
         items=[
             "헤더 업로드 버튼 배지 3 — pending/ 클립 수. 탭 → 12",
             "칩 전체 / 업로드 대기 / 검수 대기 / 반려 — 업로드 실패도 '업로드 대기'에 포함",
             "장소명 — 업로드 전엔 미니맵 기준 최근접 도로명(참고), 업로드 후엔 서버가 매칭한 road 의 이름",
             "26/09/20 13:47 · 18초 · 112m — 촬영 시작 시각, duration_sec, distance_m(규칙 A). 프로토타입 숫자는 차량 속도라 실제 도보는 70~90초",
             "썸네일 — 서버가 만든 정적 이미지(지도 컴포넌트 20개를 띄우면 죽는다). 로컬 클립은 촬영 시 뽑은 1프레임",
             "cloud_done 아이콘 — 업로드 완료. 진행 바 62% — 업로드 바이트/전체. 실패 → 재시도 버튼",
             "반려 · 재촬영됨(회색, 흐림) — superseded=true(누가 찍었든 이후 통과). 목록에 남긴다",
             "커서 페이지네이션 — offset 아님. 수천 건에서 중복·누락 방지",
             "업로드 성공 후에만 로컬 영상 삭제. trajectory JSON 과 썸네일은 남김(오프라인 목록용)",
         ]),
    dict(file="11-video-detail.html", tag="영상 상세 · 반려", title="영상 상세 — 영상 시각과 지도 위치를 잇는다",
         note="플레이어의 현재 시각(0:06)이 지도 위 마커를 움직인다. trajectory 의 t 필드가 그 다리. 반려 박스는 사유 + 왜 + 무엇을 할지 + CTA 순서.",
         items=[
             "플레이어 — expo-video. 스크럽하면 t 에 가장 가까운 trajectory 점으로 지도 마커 이동",
             "경로 지도 — 파란 선은 trajectory 전체, 출발·도착 점, 현재 마커. 점프 판정 점은 뺀다",
             "촬영일시 / 길이 / 거리 / 전송 상태 / 수집자 — VideoTable 그대로",
             "반려됨 박스 — reject_reason 코드를 사람 말로 바꾼 문장. 재촬영 버튼 없음 — 구간은 지도에 빨강으로 남는다",
             "삭제 — 업로드 전에만 활성. 업로드 후엔 회색 비활성 + 캡션",
         ]),
    dict(file="12-upload-queue.html", tag="업로드 큐", title="업로드 큐 — 영상과 trajectory 를 한 요청으로",
         note="영상과 trajectory JSON 을 따로 보내면 한쪽만 성공하는 상태가 생긴다. multipart 한 요청. Wi-Fi 에서만 업로드 토글이 켜져 있으면 LTE 에선 '대기 중'으로 머문다.",
         items=[
             "3건 · 420MB — pending/ 파일 수와 바이트 합",
             "업로드 중 62% — 전송 바이트/파일 크기. 남은 시간 = 남은 바이트 / 최근 5초 평균 속도",
             "대기 중 — 큐 순서대로 1개씩. 동시 업로드 안 함(배터리·발열)",
             "실패 · 네트워크 오류 — 3회 자동 재시도 후 실패 표시. 재시도 버튼은 즉시 1회. 파일은 로컬에 그대로 있다",
             "전체 재시도 / 전체 취소 — 취소는 큐에서만 빼고 파일은 안 지움",
         ]),
    dict(file="13-permissions.html", tag="권한", title="권한 — 카메라와 위치, 둘뿐",
         note="알림 권한은 받지 않는다. 위치는 '항상 허용'이 필요하다고 이유를 적는다(걷는 중 화면이 꺼져도 기록해야 하므로).",
         items=[
             "카메라 — expo-camera. 거부 시 이 화면에 머물고 설정 열기 버튼",
             "위치 — expo-location, 백그라운드 포함. iOS 는 '앱 사용 중' → '항상' 2단계",
             "권한 허용하기 — 둘 다 허용되면 01 또는 02 로",
         ]),
    dict(file="14-settings.html", tag="설정", title="설정 — 만질 게 별로 없어야 한다",
         note="자동 업로드 토글 없음(업로드는 앨범에서 수동). 화질은 통일이 원칙이라 바꿀 수 없어야 하는데 프로토타입엔 chevron 이 남아 있음 — RN 에선 읽기 전용.",
         items=[
             "Wi-Fi 에서만 업로드 — 켜져 있으면 12 큐가 LTE 에서 대기",
             "영상 화질 1080p — 읽기 전용 표시",
             "12.4GB 사용 가능 — 홈과 같은 값. 업로드 완료분 정리 — 업로드 성공 시 이미 지우므로 실제론 썸네일·trajectory 캐시 정리",
             "로그아웃 — 확인 다이얼로그 1단계. SecureStore 토큰 삭제 후 01",
         ]),
    dict(file="15-empty-states.html", tag="빈 상태 · 오프라인 · 로딩", title="상태 3종 — 막지 않고 알려만 준다", tall=True,
         note="빈 앨범은 촬영으로 유도. 오프라인은 상단 띠 하나로 알리고 내용은 그대로 보여준다(로컬 데이터가 있으니). 지도 로딩은 화면을 막지 않는다.",
         items=[
             "오프라인 판정 — NetInfo isConnected=false. 서버 데이터는 마지막 응답 캐시, 로컬 클립은 그대로",
             "지도 로딩 — 회색 placeholder 선 + 상단 pill. bbox 요청 중일 때만",
             "오프라인 중 촬영 가능 — 미니맵은 캐시가 있으면 표시, 없으면 회색",
         ]),
]

# ─────────────────────────────────────────────────────────────
# 수치 산출 규칙 (앱이 계산하는 것들). API 안 쓰고 단말에서 계산.
# ─────────────────────────────────────────────────────────────
RULES = """
<div class="rule" id="rule-a">
<h3>A. 거리 — 하버사인 누적</h3>
<p>API 없이 단말에서 계산한다. GPS 점이 들어올 때마다 직전 유효 점과의 거리를 하버사인 공식으로 구해 더한다.</p>
<pre>R = 6371000 m
dφ = φ2−φ1,  dλ = λ2−λ1   (라디안)
a = sin²(dφ/2) + cosφ1·cosφ2·sin²(dλ/2)
d = 2R · atan2(√a, √(1−a))</pre>
<table>
<tr><th>조건</th><th>처리</th><th>이유</th></tr>
<tr><td>acc &gt; 30m 인 점</td><td>누적에서 제외, 유효 점으로도 안 삼음</td><td>오차가 걸은 거리보다 큼</td></tr>
<tr><td>d &lt; 1m</td><td>더하지 않음(직전 유효 점 유지)</td><td>서 있을 때 GPS 떨림이 거리로 쌓이는 것 방지</td></tr>
<tr><td>규칙 B 점프</td><td>더하지 않음, 유효 점도 갱신 안 함</td><td>튄 점 한 번에 50m 가 생기면 안 됨</td></tr>
<tr><td>표시</td><td>정수 m. 목표 거리 도달 시 햅틱 1회 + 숫자 강조</td><td>자동 정지 아님 — 정지는 항상 사용자. 목표 100m 는 임시값, 논의 후 확정</td></tr>
</table>
<p>샘플링 1Hz. 클립 단위가 100m 라면 도보 1.2~1.5 m/s 기준 약 70~90초, 점 70~90개. 클립당 JSON 은 수 KB. (100m 는 임시값)</p>
</div>

<div class="rule" id="rule-b">
<h3>B. GPS 점프 판정</h3>
<p>연속 두 점 사이의 <b>암시 속도</b>로 판정한다. 사람은 3 m/s 이상으로 걷지 않는다.</p>
<pre>v = d / dt            (직전 유효 점 기준)
jump = v &gt; 3 m/s
    또는 d &gt; 3 × max(acc1, acc2)   ← 오차 반경 3배 밖으로 튐</pre>
<table>
<tr><th>값</th><th>어디에 쓰나</th></tr>
<tr><td>jump 플래그</td><td>trajectory 점에 <code>jump:true</code> 로 기록은 한다(검수 웹이 볼 수 있게). 거리·궤적 선에서만 뺀다</td></tr>
<tr><td>클립 내 점프 횟수</td><td>05 시트 경고 문구. 3회 이상이면 "GPS 점프 N회 — 반려될 수 있어요"</td></tr>
<tr><td>연속 점프 5회</td><td>04 배너를 "GPS 신호가 튀고 있어요. 멈춰서 기다리세요" 로 바꿈</td></tr>
</table>
<p>GPS 가 '이탈했다'는 건 결국 이 둘 중 하나다 — (1) 정확도가 나쁨(규칙 C), (2) 위치가 물리적으로 불가능하게 튐(점프). 검수자가 반려 사유 "GPS 이상"을 고를 때 근거가 되는 숫자를 앱이 먼저 만든다.</p>
</div>

<div class="rule" id="rule-c">
<h3>C. GPS 정확도 등급</h3>
<table>
<tr><th>accuracy</th><th>표시</th><th>동작</th></tr>
<tr><td>≤ 10m</td><td>초록 점 "GPS 4m"</td><td>정상</td></tr>
<tr><td>&gt; 10m, 3초 이상</td><td>노랑 점 + 상단 배너(행동 지시)</td><td>녹화는 계속. 그 구간 초를 <code>lowAccSeconds</code> 로 센다. 정확도 때문에 녹화를 막지는 않는다</td></tr>
<tr><td>수신 자체가 없음</td><td>회색 점 "GPS 없음"</td><td>대기 화면에서 녹화 버튼 비활성(헛수고 방지). 녹화 중 끊기면 계속하되 05 에서 경고</td></tr>
</table>
<p><code>lowAccSeconds</code> 와 점프 횟수는 trajectory JSON 헤더에 같이 넣어 서버로 보낸다. 검수 웹이 "저정확도 30% 이상"을 걸러내는 근거.</p>
</div>

<div class="rule" id="rule-d">
<h3>D. trajectory JSON</h3>
<pre>{
  "clipId": "…", "startedAt": "2026-09-20T13:47:12+09:00",
  "durationSec": 74, "distanceM": 112,
  "lowAccSeconds": 6, "jumpCount": 1,
  "points": [
    { "t": 0.0,  "lat": 37.5924, "lng": 127.0163, "acc": 4.1 },
    { "t": 1.0,  "lat": 37.5925, "lng": 127.0164, "acc": 4.3 },
    { "t": 31.0, "lat": 37.5933, "lng": 127.0171, "acc": 18.2, "jump": true },
    …
  ]
}</pre>
<p><code>t</code> 는 영상 시작 기준 경과 초 — 11 상세에서 플레이어 시각 ↔ 지도 마커를 잇는 키. <code>acc</code> 필수. 녹화 중 10초마다 임시 파일에 덮어쓴다.</p>
</div>

<div class="rule" id="rule-e">
<h3>E. 도로·동 상태 (서버 파생값, 앱은 그리기만)</h3>
<table>
<tr><th>값</th><th>식</th></tr>
<tr><td>구간 상태</td><td>accept ≥ 1 → 검수완료 &nbsp;/&nbsp; 아니면 검수전 클립 있음 → 검수전 &nbsp;/&nbsp; 아니면 reject 만 → 반려 &nbsp;/&nbsp; 없음 → 미촬영</td></tr>
<tr><td>동 달성률</td><td>Σ(검수완료 구간 길이) / Σ(전체 구간 길이) — 기준은 구간 길이, 클립 수 아님</td></tr>
<tr><td>전체 42%</td><td>같은 식을 관내 전체로</td></tr>
<tr><td>홈 18.4km</td><td>내 클립 distanceM 합(업로드 완료분)</td></tr>
<tr><td>확정 / 검수중 km</td><td>검수완료 클립 km / 검수전 클립 km. 금액은 앱에 표시하지 않는다. 같은 구간 중복 accept 인정 여부는 미정</td></tr>
</table>
</div>

<div class="rule" id="rule-f">
<h3>F. 아직 정하지 않은 것</h3>
<ul>
<li><b>클립 단위(100m)는 임시값.</b> 논의 후 확정. 100m·20초 전제는 차량 시절 숫자라 도보면 70~90초 — trajectory 점 수·파일 크기·10초 백업 손실률도 그때 재계산</li>
<li>가로 한 손 그립에서 어느 손인가. 좌우 미러 옵션 여부</li>
<li>같은 구간을 두 명이 찍어 둘 다 accept 되면 km 를 둘 다 인정하나 — 확정 km 계산 기준</li>
<li>도로 형상 좌표 출처 — ITS 표준노드링크 권장, 네이버 지도 API 는 안 줌</li>
<li>spike: 카메라+지도+GPS 동시 구동 시 발열·프레임·용량</li>
</ul>
</div>
"""

CSS = """
:root{--ink:#1C1C1A;--sub:#6B6A65;--hair:#E3E2DD;--surface:#F5F5F3;--accent:#2B6CB0;
--none:#888780;--pending:#EF9F27;--accepted:#97C459;--rejected:#E24B4A}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#E9E8E3;color:var(--ink);-webkit-font-smoothing:antialiased;padding:40px 24px 80px}
.head{max-width:1360px;margin:0 auto 20px}
.head h1{font-size:22px;font-weight:700;letter-spacing:-.3px}
.head p{font-size:14px;color:var(--sub);margin-top:8px;line-height:1.6;max-width:900px}
.secnav{max-width:1360px;margin:0 auto 8px;display:flex;gap:10px;flex-wrap:wrap}
.secnav a{font-size:13px;font-weight:600;color:var(--accent);background:#EBF2FA;border:1px solid var(--accent);border-radius:9999px;padding:8px 16px;text-decoration:none}
.legend{max-width:1360px;margin:12px auto 0;display:flex;gap:16px;font-size:12.5px;color:var(--sub);flex-wrap:wrap}
.legend span::before{content:'';display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px;background:var(--c)}
.sec-title{max-width:1360px;margin:40px auto 20px;font-size:18px;font-weight:700;letter-spacing:-.3px;display:flex;align-items:baseline;gap:12px}
.sec-title small{font-size:13px;font-weight:400;color:var(--sub)}
.board{max-width:1360px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:48px 32px}
.demo{min-width:0}
.demo.wide{grid-column:1 / -1}
.demo .tag{display:inline-block;font-size:12px;font-weight:700;color:var(--accent);background:#EBF2FA;border:1px solid var(--accent);border-radius:9999px;padding:4px 12px;margin-bottom:8px}
.demo h2{font-size:15px;font-weight:700;margin-bottom:6px;letter-spacing:-.2px}
.demo .note{font-size:12.5px;color:var(--sub);line-height:1.6;margin-bottom:14px;max-width:560px}
.demo ul.items{list-style:none;margin:0 0 12px;max-width:560px}
.demo ul.items li{font-size:12.5px;line-height:1.55;padding:6px 0 6px 22px;position:relative;border-top:1px solid var(--hair)}
.demo ul.items li::before{content:counter(item);counter-increment:item;position:absolute;left:0;top:7px;width:16px;height:16px;border-radius:9999px;background:var(--ink);color:#fff;font-size:10px;font-weight:700;text-align:center;line-height:16px}
.demo ul.items{counter-reset:item}
.demo .stage{display:flex;gap:32px;align-items:flex-start;flex-wrap:wrap}
.demo .side{flex:1;min-width:320px}
.demo .src{font-size:11.5px;margin-top:4px}
.demo .phone{margin-top:4px}
.phone{width:414px;background:#111;border-radius:48px;padding:12px;flex-shrink:0}
.phone .screen{width:390px;height:884px;border-radius:38px;overflow:hidden;background:#fff;position:relative}
.phone.tall .screen{height:2087px;border-radius:24px}
.phone.land{width:868px;border-radius:40px}
.phone.land .screen{width:844px;height:390px;border-radius:30px}
.screen iframe{width:100%;height:100%;border:0;display:block}
/* 규칙 */
.rules{max-width:1360px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:24px}
.rule{background:#fff;border:1px solid var(--hair);border-radius:16px;padding:20px 22px}
.rule h3{font-size:15px;font-weight:700;margin-bottom:8px}
.rule p{font-size:13px;line-height:1.65;color:var(--ink);margin:8px 0}
.rule pre{font-family:'JetBrains Mono',Menlo,monospace;font-size:12px;line-height:1.55;background:var(--surface);border:1px solid var(--hair);border-radius:8px;padding:12px 14px;margin:10px 0;overflow:auto}
.rule table{width:100%;border-collapse:collapse;font-size:12.5px;margin:10px 0}
.rule th,.rule td{text-align:left;padding:7px 8px;border-top:1px solid var(--hair);vertical-align:top;line-height:1.5}
.rule th{color:var(--sub);font-weight:600;background:var(--surface)}
.rule code{font-family:Menlo,monospace;font-size:11.5px;background:var(--surface);padding:1px 5px;border-radius:4px}
.rule ul{padding-left:18px;font-size:13px;line-height:1.65}
@media (max-width:900px){.phone.land{width:100%;overflow:auto}}
"""

def demo(spec):
    doc = read(spec["file"])
    if spec.get("variant"):
        doc = with_alerts(doc, spec["variant"])
    phone_cls = "phone land" if spec.get("landscape") else ("phone tall" if spec.get("tall") else "phone")
    demo_cls = "demo wide" if (spec.get("landscape") or spec.get("tall")) else "demo"
    items = "".join(f"<li>{html.escape(i)}</li>" for i in spec["items"])
    text = f"""<p class="note">{html.escape(spec['note'])}</p>
      <ul class="items">{items}</ul>
      <p class="note src">원본: <code>design/stitch/{spec['file']}</code></p>"""
    phone = f"""<div class="{phone_cls}"><div class="screen"><iframe loading="lazy" title="{html.escape(spec['title'])}" srcdoc="{srcdoc(doc)}"></iframe></div></div>"""
    wide = spec.get("landscape") or spec.get("tall")
    inner = f'<div class="stage">{phone}<div class="side">{text}</div></div>' if wide else f'{text}{phone}'
    return f"""
<div class="{demo_cls}" id="{spec['file'][:2]}{'-'+spec['variant'] if spec.get('variant') else ''}">
  <span class="tag">{html.escape(spec['tag'])}</span>
  <h2>{html.escape(spec['title'])}</h2>
  {inner}
</div>"""

sections = [
    ("flow", "촬영 흐름", "로그인·가입 → 홈 → 촬영 대기 → 녹화 → 종료 확인", ["01-login.html","01b-signup.html","02-home.html","03-camera-standby.html","04-camera-recording.html","05-camera-finish-sheet.html"]),
    ("map", "지도", "줌 레벨마다 다른 걸 보여준다 — 동 → 구간 → 클립", ["06-map-district.html","07-map-road.html","08-map-clip.html","09-map-rejected-sheet.html"]),
    ("data", "앨범·상세·업로드", "찍은 것을 찾고, 올리고, 반려를 확인한다", ["10-album-list.html","11-video-detail.html","12-upload-queue.html"]),
    ("etc", "권한·설정·상태", "", ["13-permissions.html","14-settings.html","15-empty-states.html"]),
]

body = []
for sid, title, sub, files in sections:
    body.append(f'<div class="sec-title" id="{sid}">{html.escape(title)} <small>{html.escape(sub)}</small></div><div class="board">')
    for spec in SCREENS:
        if spec["file"] in files:
            body.append(demo(spec))
    body.append("</div>")

page = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>영상수집 — 수집가 앱 통합 목업</title>
<!--
THESIS: 걸으면서 100m 씩 도로 영상을 찍어 올리는 내부 도구. 화면은 15개, 사용자는 수집가 2명.
숫자(거리·GPS 정확도·점프·달성률)는 전부 단말 또는 서버에서 어떻게 계산되는지 규칙 A~F 에 적었다.
화면은 이미지가 아니라 design/stitch/*.html 을 그대로 iframe(srcdoc)으로 살려 넣은 것 — 원본을 고치고
python3 design/build_mockups.py 를 다시 돌리면 이 파일이 갱신된다.
-->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>{CSS}</style>
</head>
<body>
<div class="head">
  <h1>영상수집 — 수집가 앱 통합 목업</h1>
  <p>도로를 걸으며 100m 단위로 영상을 찍고, 올리고, 검수 결과를 받아 다시 찍는 앱. 아래 화면은 실제 HTML 컴포넌트(이미지 아님)이고, 각 화면 옆에 요소별 동작과 숫자가 어디서 오는지 적었다. 거리·GPS 판정·달성률 같은 계산 규칙은 맨 아래 <a href="#rules">규칙 A~F</a>.</p>
</div>
<div class="secnav">
  <a href="#flow">촬영 흐름</a><a href="#map">지도</a><a href="#data">앨범·상세·업로드</a><a href="#etc">권한·설정·상태</a><a href="#rules">계산 규칙</a>
</div>
<div class="legend">
  <span style="--c:var(--none)">미촬영 #888780</span><span style="--c:var(--pending)">촬영완료·검수전 #EF9F27</span><span style="--c:var(--accepted)">검수완료 #97C459</span><span style="--c:var(--rejected)">반려 #E24B4A</span><span style="--c:var(--accent)">현위치·궤적·주요 버튼 #2B6CB0</span>
</div>
{''.join(body)}
<div class="sec-title" id="rules">계산 규칙 <small>앱이 만드는 숫자 — API 아님, 단말 계산</small></div>
<div class="rules">{RULES}</div>
</body>
</html>"""

open(OUT, "w", encoding="utf-8").write(page)
print("wrote", OUT, len(page)//1024, "KB")
