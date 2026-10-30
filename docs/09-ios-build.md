# iOS 빌드·설치 (무료 Apple 계정)

유료 Apple Developer Program($99/년) 없이 **무료 계정(Personal Team) + 내 Mac의 Xcode**로
iPhone에 직접 설치한다. 링크 다운로드·TestFlight는 안 된다 — 그건 유료 계정이 필요하다.

- 설치한 앱은 **7일 뒤 실행이 안 된다** → 7일 안에 다시 설치 ([A](#a-다시-설치-7일마다))
- 설치할 수 있는 폰은 **내 Apple ID 기준 3대** (내 폰 + 수집가 2명이면 꽉 참)
- 설치는 **케이블** 또는 **같은 Wi-Fi**에서만 된다

## 현재 상태 (2026-10-30)

| 항목 | 상태 |
|---|---|
| Xcode 26.6, CocoaPods 1.17.0, 키체인 "항상 허용" | ✅ |
| Personal Team `2WM498V2QU`, 인증서 `Apple Development: dong11ro@naver.com` | ✅ |
| `app.json`: bundle ID `com.dong11ro.collector`, `appleTeamId` | ✅ |
| 서버 HTTPS 전환 대응 (주소 `https://dblab.166.104.36.71.nip.io:8002`, ATS 예외 제거) | ✅ 2026-10-30 빌드·내 폰 설치. 회원가입 확인은 아직 |
| 내 iPhone(Dreamy) Release 설치 + 개발자 신뢰 | ✅ 2026-10-29 |
| 앱 기능 확인 (권한·서버 통신·녹화) | ❌ 아직 |
| 원격 iPhone 수집가 설치 (Sideloadly, D) | ❌ IPA `collector-app/dist/collector-ios-1.0.0-20261030.ipa`, 수집가 설치는 아직 |

## 언제 돈이 드는가

| 하려는 것 | 무료 | $99/년 |
|---|---|---|
| Xcode로 내 Mac에서 폰에 설치 (케이블/같은 Wi-Fi) | ✅ 7일 만료, 기기 3대 | |
| Expo Go, 시뮬레이터 | ✅ | |
| TestFlight, Ad Hoc(EAS internal), EAS Build iOS, App Store | | ✅ |

---

## A. 다시 설치 (7일마다)

폰과 Mac이 **같은 Wi-Fi**(또는 케이블)에 있고 폰 잠금이 풀려 있어야 한다.
**재설치 전에 폰에 남은 영상을 다 업로드하게 한다** (덮어쓰기 설치는 데이터가 보통 남지만 확인 안 함).

```bash
cd ~/workspace/collector-front/collector-app/ios

# 1) 폰 확인 — Identifier 열 = devicectl ID
xcrun devicectl list devices

# 2) 빌드 — destination id는 하드웨어 UDID
xcodebuild -workspace app.xcworkspace -scheme app -configuration Release \
  -destination id=<하드웨어 UDID> -allowProvisioningUpdates

# 3) 설치
xcrun devicectl device install app --device <devicectl ID> \
  ~/Library/Developer/Xcode/DerivedData/app-*/Build/Products/Release-iphoneos/app.app
```

하드웨어 UDID 확인: `xcrun devicectl device info details --device <devicectl ID> | grep " udid"`

| 기기 | devicectl ID | 하드웨어 UDID |
|---|---|---|
| 내 iPhone (Dreamy, iPhone 17) | `1142D37B-2596-5573-B5B1-6C022D4D598B` | `00008150-001D793A3A0A401C` |

코드(JS)를 바꿨을 때도 같은 절차다. `app.json`이나 네이티브 패키지를 바꿨으면 먼저
`npx expo prebuild -p ios --clean`을 한다 (`appleTeamId`가 있어서 서명 설정은 유지된다).

## B. 새 폰 추가 (기기마다 한 번)

1. 케이블로 Mac에 연결 → 폰에서 **"이 컴퓨터 신뢰"**
2. 폰: 설정 → 개인정보 보호 및 보안 → **개발자 모드** 켜기 → 재부팅
   (메뉴는 Mac에 한 번 연결한 뒤에야 보인다)
3. Xcode → Window → Devices and Simulators → 그 폰 → **Connect via network** 체크 → 이후 케이블 불필요
4. Xcode에서 실행 대상을 그 폰으로 고르면 팀에 기기가 등록되고 프로파일이 생긴다
5. [A](#a-다시-설치-7일마다)로 설치. 위 기기 표에 ID를 추가해 둔다
6. 폰: 설정 → 일반 → **VPN 및 기기 관리** → 개발자 앱 `Apple Development: dong11ro@naver.com` → **신뢰**
   (인터넷 연결 필요. 메뉴가 안 보이면 설정 검색창에 "기기 관리")
7. **서버 인증서 설치** ([E](#e-서버-인증서-설치-iphone마다-한-번)) — 안 하면 회원가입·로그인·업로드가 전부 안 된다

## C. 처음부터 세팅 (새 Mac)

```bash
# Xcode는 App Store에서 설치
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
brew install cocoapods
```

1. Xcode → Settings → Accounts → `+` → Apple ID 로그인 → "Personal Team"이 생긴다
2. **프로젝트 경로에 한글이 없어야 한다** (아래 문제 해결 참고)
3. `cd collector-app && npx expo prebuild -p ios` — `ios/`는 생성물이라 `.gitignore`에 있다
4. `xed ios` → 앱 target → Signing & Capabilities → "Automatically manage signing" → Team: Personal Team
5. 다른 Apple ID로 서명하면 `app.json`의 `appleTeamId`를 그 팀 ID로 바꾼다
6. 첫 빌드 때 키체인 암호를 묻는다 → **Mac 로그인 비밀번호** 입력 → **"항상 허용"**

## D. 원격 수집가 — Sideloadly (비공식, 미검증)

만날 수 없는 iPhone 수집가용. 내가 IPA를 보내면 **수집가가 자기 PC + 자기 Apple ID로** 설치한다.
비공식 도구에 Apple ID를 넣는 방식이라 **본인 동의 필요, 보조 Apple ID 권장.** 아직 실제로 해 보지 않았다.

**내 쪽: IPA 만들기** (A의 빌드까지 한 뒤)

```bash
cd ~/workspace/collector-front/collector-app
T=$(mktemp -d) && mkdir -p "$T/Payload" dist
cp -R ~/Library/Developer/Xcode/DerivedData/app-*/Build/Products/Release-iphoneos/app.app "$T/Payload/"
(cd "$T" && zip -qry "$OLDPWD/dist/collector-ios-<버전>.ipa" Payload) && rm -rf "$T"
```

`dist/`는 `.gitignore`에 있다. 서명은 Sideloadly가 수집가 Apple ID로 다시 하므로 상관없다.

**수집가 쪽**

1. PC에 [Sideloadly](https://sideloadly.io/) 설치. Windows면 iTunes·iCloud **웹 설치판**이 필요하다 (Microsoft Store판은 지우고 설치)
2. iPhone을 USB로 연결 → "이 컴퓨터 신뢰"
3. Sideloadly에 IPA를 끌어다 놓고, Apple ID 입력 → Start → 2단계 인증 코드 입력
4. iPhone: 설정 → 개인정보 보호 및 보안 → **개발자 모드** 켜기 → 재부팅
5. iPhone: 설정 → 일반 → VPN 및 기기 관리 → 본인 Apple ID → **신뢰**
   그리고 **서버 인증서 설치** ([E](#e-서버-인증서-설치-iphone마다-한-번)) — `dist/dblab-8002-ca.crt`를 메일로 같이 보낸다
6. 7일 만료: Sideloadly **auto-refresh**를 켜 두면 PC와 폰이 같은 Wi-Fi에 있을 때 알아서 갱신한다. 아니면 3번을 7일 안에 다시 한다

**막힐 수 있는 곳**

- bundle ID `com.dong11ro.collector`는 내 팀에 등록돼 있어서, 수집가 Apple ID로는 등록이 안 될 수 있다
  → Sideloadly 고급 옵션의 **Change Bundle ID**로 `com.<수집가이름>.collector` 같은 값으로 바꾼다. 앱은 bundle ID를 쓰지 않으니 기능엔 영향 없다
- 새 버전을 보낼 때도 같은 절차. **재설치 전에 업로드를 끝내게 한다**

## E. 서버 인증서 설치 (iPhone마다 한 번)

서버는 2026-10-24부터 HTTPS이고 인증서가 사설 CA(`dblab-8002-Local-CA`)라 폰이 기본으로 믿지 않는다.
CA 파일: 저장소 루트 `dblab-8002-ca.pem` (공개 인증서, 개인키 없음). 폰에 보낼 땐 `collector-app/dist/dblab-8002-ca.crt`.

1. 파일을 **AirDrop·메일 첨부·Safari 다운로드**로 폰에서 연다 (카카오톡은 설치가 안 될 수 있다)
2. 설정 → **프로파일이 다운로드됨** → 설치
3. 설정 → 일반 → 정보 → 맨 아래 **인증서 신뢰 설정** → `dblab-8002-Local-CA` **켜기** ← 빼먹으면 연결 안 됨

서버가 공인 인증서로 바뀌면 이 절차는 필요 없다.

---

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| `pod install`: `incompatible character encodings: BINARY (ASCII-8BIT) and UTF-8` | 프로젝트 경로에 한글(예: `외주`) | 폴더를 영문 이름으로 바꾼다. `LANG`, `RUBYOPT`, 심볼릭 링크로는 안 됨 (node가 실제 경로를 돌려줌) |
| Xcode: `Your team has no devices from which to generate a provisioning profile` | 무료 계정은 연결된 기기가 있어야 프로파일을 만든다 | 폰을 연결하고 실행 대상을 그 폰으로 → Try Again |
| `Failed to register bundle identifier` | bundle ID를 남이 이미 씀 | `app.json` bundle ID 변경 → `prebuild --clean`. 무료 계정은 App ID를 7일에 10개까지만 |
| 키체인 암호가 계속 틀림 | 한/영이 한글 상태, 또는 키체인이 옛 Mac 비밀번호 | 영문으로 바꿔 입력. 끝까지 안 되면 키체인 접근 → 설정 → "기본 키체인 재설정" (저장된 암호를 잃음, 인증서는 Xcode가 다시 만듦) |
| 설치: `No code signature found` / `ApplicationVerificationFailed` | 키체인 접근이 거부돼 framework 일부가 서명 없이 들어감 | 키체인 "항상 허용" 후 다시 빌드. 확인: `codesign --verify --deep --strict .../app.app` |
| `npx expo run:ios`: `No device UDID or name matching` | devicectl ID를 넘김 | 하드웨어 UDID나 기기 이름을 넘긴다 |
| `npx expo run:ios`: `error reading pair record` | Expo CLI 설치 단계 문제 (원인 미확인) | [A](#a-다시-설치-7일마다)처럼 `xcodebuild` + `devicectl`로 직접 |
| 폰: "신뢰하지 않는 개발자" | 처음 설치한 개발자 인증서 | [B](#b-새-폰-추가-기기마다-한-번)의 6번 |
| 앱이 갑자기 안 열림 | 7일 만료 | [A](#a-다시-설치-7일마다)로 재설치 |
| 회원가입·로그인이 "서버에 연결할 수 없습니다" | 서버 사설 인증서를 폰이 안 믿음 | [E](#e-서버-인증서-설치-iphone마다-한-번). 3번 "전체 신뢰"까지 켰는지 확인 |

## 주의사항

- **반드시 `Release`.** 프로젝트에 `expo-dev-client`가 있어서 Debug로 빌드하면 개발용 앱이 깔리고, 실행할 때마다 내 Mac의 개발 서버를 찾는다.
- **무선 설치는 같은 Wi-Fi일 때만.** Tailscale 원격 설치는 확인 안 됨.
- **기기 3대 제한은 내 Apple ID 기준.** 수집가가 폰을 바꾸면 그 자리가 7일 동안 막힌다.
- **서버 주소는 IP가 아니라 `dblab.166.104.36.71.nip.io`.** 인증서 이름이 이 도메인이라 IP로 접속하면 거절된다. ATS 예외(`NSAllowsArbitraryLoads`)는 HTTPS 전환으로 필요 없어져 2026-10-30에 지웠다.
- 안드로이드 설정(`android` 블록)은 건드리지 않았다. 안드로이드 빌드에는 영향 없음.

## 남은 과제 (수집가에게 나눠 주기 전)

- 앱 기능 실기기 확인: 위치·카메라 권한, 서버 통신(ATS), 녹화 → 업로드
- **HEVC 코덱** — iOS 녹화가 HEVC면 검수 웹에서 재생이 안 될 수 있다 (`06-open-questions.md`)
- **iCloud 백업 제외** — `documentDirectory`는 기본 백업 대상 (`05-decisions.md`)
- 수집가 폰 기종 확인 (iPhone이 아니면 이 문서 자체가 필요 없다)

## 참고

- [Apple 멤버십 비교](https://developer.apple.com/support/compare-memberships/)
- [Xcode 무선 기기 페어링](https://help.apple.com/xcode/mac/current/en.lproj/devbc48d1bad.html)
