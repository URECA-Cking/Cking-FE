# Web·Admin 모노레포 최종 E2E 검증 (#65)

## 진행 상태

2026-10-07~08 기준 자동 검증, 비인증 배포 경계 검증 및 실계정의 화면·세션 복원 일부를 확인했다. #55(B-02)와 #56(B-03)이 머지된 FE `develop` `14d3f09`을 #65 브랜치에 fast-forward한 뒤 확인했다. 토큰·Cookie 원문, Refresh API의 네트워크 요청·회전, 만료 뒤 401 재시도는 직접 관찰하지 않았으므로 이 결과만으로 해당 저수준 계약까지 통과했다고 주장하지 않는다.

## 확인한 항목

| 항목 | 결과 | 확인 방법 |
| --- | --- | --- |
| Workspace 설치 | 통과 | `npm ci` |
| Shared/Web/Admin lint | 통과 | `npm run lint` |
| Shared·Admin 테스트 | 9개 통과(6+3) | `npm run test` |
| Web 빌드 | 통과 | `npm run build:web` |
| Admin 빌드 | 통과 | `npm run build:admin` |
| 전체 빌드 | 통과 | `npm run build` |
| 로컬 Web/Admin 동시 기동 | 통과 | 5173·5174의 `/`가 각각 200 |
| 양 앱의 `/api` 프록시 | 미완료 | 현재 8080에 BE가 없어 두 앱의 `/api/me`가 모두 502. 이전에 임시 8080 응답 서버로 전달 배선은 확인했지만 실제 BE 연결 성공은 아님 |
| 개발 Web·Admin 도메인 | 응답 확인 | `https://dev.cking.co.kr/`, `https://dev-admin.cking.co.kr/` 각각 HTTP 200 HTML. 화면 기능 검증은 아님 |
| 개발 배포 JavaScript 주소 | 확인 | 두 도메인의 HTML에서 실제 JS asset을 가져와 각각 `https://dev-api.cking.co.kr`이 포함됨을 확인. Web asset에는 `https://dev-admin.cking.co.kr`도 포함됨. API 호출 성공 검증은 아님 |
| 개발 API 인증 경계 | 응답 확인 | 토큰 없는 `GET https://dev-api.cking.co.kr/api/me` → 401 |
| 두 Refresh 경로의 CORS preflight | 통과 | Web origin → `/api/auth/refresh`, Admin origin → `/api/admin/auth/refresh`가 각각 자기 origin에 대해 `Access-Control-Allow-Credentials: true` 응답 |
| Web/Admin 코드 경계 | 통과 | Web App에 Admin route·page/API import 없음; Admin 앱·shared에 Web `UserContext` import 없음; Web 로컬 프로덕션 번들에 `AdminConsole`·`/admin/redraws` 없음 |
| Admin 배포 E2E 스펙 | 계정 부재로 건너뜀 | `npm run test:e2e:admin` → 1 skipped. 브라우저 기동 전에 조건을 평가하도록 스펙을 수정해, 계정 부재가 Playwright 브라우저 미설치 실패로 위장되지 않게 함 |

`npm ci` 감사 출력의 의존성 취약점 8건(중간 2, 높음 6)은 설치·빌드를 막지 않았다. #65에서 자동 수정하지 않았으며 별도 의존성 점검 대상이다.

## 로컬 Web 실계정 부분 검증 (2026-10-07)

사용자가 로컬 BE(8080)와 Web(5173)을 기동하고 Google로 로그인한 뒤, 같은 Chrome 프로필의 Web 화면을 읽기 전용으로 확인했다. 토큰·Cookie 원문은 조회하거나 기록하지 않았다. 이 검증은 위 표의 초기 비인증 점검 이후에 수행했다.

| 항목 | 결과 |
| --- | --- |
| Google 로그인 후 사용자 화면 | `/my-page`에 계정 이름·이메일과 팬 상태가 표시됨. OAuth Callback과 Login Code 교환의 네트워크 요청은 직접 관찰하지 않아 해당 API 단계까지 통과했다고 단정하지 않음 |
| 로그인 상태에서 화면 조회 | `/my-entries`, `/my-winners`, `/my-calendar`, `/notifications`가 로딩 후 빈 상태를 표시하고 오류 화면으로 전환되지 않음 |
| 탐색 조회 | `/explore`가 열리며 이벤트는 0건. 현재 로컬 데이터에서 크리에이터·이벤트가 보이지 않아 Space·Mission·Entry까지 진행할 대상이 없음 |
| 같은 탭 새로고침 | `/notifications` 새로고침 후 인증된 화면이 유지됨 |
| 새 탭 세션 복원 | Chrome의 새 탭에서 `http://localhost:5173/my-page`를 직접 열었을 때 로그인 입력 없이 같은 계정이 표시됨. Refresh 요청/쿠키 회전 자체는 네트워크에서 별도 확인 필요 |

이 결과로 Web 읽기 전용 UI와 세션 유지 일부만 확인했다. Admin 로그인, 두 앱 동시 세션, 토큰 만료/401 재시도, 로그아웃, 데이터가 필요한 미션·응모·당첨·관리자 운영 E2E는 여전히 미검증이다.

## 로컬 Kakao 실계정 부분 검증 (2026-10-07)

사용자가 같은 로컬 Web에서 Kakao 로그인을 마친 뒤 Chrome 화면을 읽기 전용으로 확인했다. 계정 이메일·토큰·Cookie 원문은 기록하지 않는다.

| 항목 | 결과 |
| --- | --- |
| Kakao 로그인 후 사용자 화면 | `/my-page`에 앞서 Google 로그인 때와 다른 이메일의 팬 계정이 표시됨. Provider callback·Login Code 교환 및 `/api/me` 네트워크 응답은 직접 관찰하지 못함 |
| 보호 화면 조회 | 해당 탭에서 `/my-entries`가 로딩 후 빈 상태를 정상 표시 |
| 같은 탭 새로고침 | `/my-entries` 새로고침 후 인증된 화면이 유지됨 |
| 새 탭 세션 복원 | Chrome 새 탭에서 `/my-page`를 직접 열었을 때 로그인 입력 없이 Kakao 계정이 표시됨. Refresh API 호출·Cookie 회전 자체는 별도 확인 필요 |
| 기존 Google 탭 | 앞서 열어둔 Google 탭의 `/my-page`는 여전히 Google 계정을 표시함. 각 탭의 Access Token 유지가 확인된 것이며, 만료 후 갱신 시 계정 격리까지 보장하는 결과는 아님 |

Kakao 사용자 화면과 조회·세션 유지 일부는 확인했다. Kakao OAuth 요청/응답 전체, 만료 뒤 Refresh, 로그아웃 및 Web/Admin 동시 세션은 이 시점에 미검증이었다.

### 화면 정합성 관찰

Kakao 로그인 뒤 홈의 `진행 중인 이벤트` 섹션에 `종료` 표시가 붙은 Event 카드가 노출됐다. `apps/web/src/pages/Home.jsx`의 `followedEvents`는 진행 중·예정·종료를 정렬만 하고 종료 이벤트를 제외하지 않으므로, 현재 화면 문구와 실제 목록 범위가 맞지 않는다. 인증 실패는 아니며 별도 Web UI 수정 대상으로 남긴다.

## 개발 Admin 실계정 부분 검증 (2026-10-07)

사용자가 `https://dev-admin.cking.co.kr/admin`에 관리자 계정으로 로그인한 뒤, 같은 Chrome 프로필에서 조회 전용 화면을 확인했다. 관리자 ID·비밀번호·Token·Cookie 원문 및 운영 대상 개인 정보는 기록하지 않는다.

| 항목 | 결과 |
| --- | --- |
| 보호된 관리자 콘솔 | 로그인 후 `/admin`이 열리고 이벤트 승인·Creator 신청·추첨 운영 탭이 표시됨. 로그인 요청과 `/api/me`의 네트워크 응답 자체는 직접 관찰하지 못함 |
| 실제 운영 데이터 조회 | 추첨 운영 목록에서 마감·결과 공개 Event를 조회하고, 공개 Event의 Snapshot·INITIAL Drawing·당첨자 목록과 당첨자 상세를 열어 확인함 |
| 다른 관리 목록 | Creator 신청 목록의 승인·대기 상태, 재추첨 요청 목록의 빈 상태, Dead Stream 목록의 빈 상태를 확인함 |
| 새 탭 세션 복원 | 같은 Chrome 프로필의 새 탭에서 `/admin`을 직접 열었을 때 로그인 입력 없이 관리자 콘솔이 복원됨. 관리자 Refresh 호출·Cookie 회전은 네트워크에서 별도 확인 필요 |
| 운영 상태 변경 | 승인·반려·수령 완료·추첨·replay 등 변경 버튼은 누르지 않음 |

Admin의 보호 화면·조회 동선과 새 탭 세션 복원은 확인했다. 401 후 갱신·1회 재시도와 403 분기는 아래의 남은 검증에 포함한다.

## 개발 Web·Admin 동시 세션 부분 검증 (2026-10-08)

같은 Chrome 프로필에서 `https://dev.cking.co.kr`의 USER 세션과 `https://dev-admin.cking.co.kr`의 ADMIN 세션을 각각 열어, 두 origin의 화면 세션이 서로 영향을 주지 않는지 확인했다. 화면에서 확인 가능한 세션 복원·로그아웃 결과만 기록하며, Token·Cookie 원문은 조회하거나 기록하지 않는다.

| 항목 | 결과 |
| --- | --- |
| USER·ADMIN 동시 세션 | Web의 `/my-page`는 USER 화면, Admin의 `/admin`은 관리자 콘솔을 각각 표시함 |
| 새 탭 복원 | Web·Admin을 각각 새 탭으로 다시 열어도 각 보호 화면이 로그인 입력 없이 표시됨 |
| Web Logout 영향 | Web에서 로그아웃 후 Web 새 탭은 `/login`으로 이동했고, Admin 새 탭은 계속 `/admin` 관리자 콘솔을 표시함 |
| Admin Logout 영향 | Admin 로그아웃 후 Admin 보호 화면은 로그인으로 전환되고, Web의 USER 세션은 `/my-page`에서 유지됨 |

이 결과는 서로 다른 Access Token 저장소와 Refresh 경로가 화면 수준에서 분리되어 동작함을 보여 준다. 다만 실제 Refresh 요청의 Cookie Path·회전과 401 재시도는 브라우저 네트워크 수준의 별도 검증이 남아 있다.

## 실제 BE·브라우저 E2E: 남은 검증

다음은 모두 **실행 결과가 아니라 남은 확인 절차**다. 인증 정보·Access Token·Cookie 원문은 문서와 PR에 기록하지 않는다. 테스트 계정은 채팅이나 PR 본문으로 공유하지 않는다.

로컬 검증에는 8080에서 실제 BE를 먼저 기동해야 한다. 개발 배포 검증에는 테스트 계정·테스트 Event를 준비하고, Web과 Admin을 **같은 브라우저 프로필의 서로 다른 탭**에서 연다. 각 단계의 성공/실패, 환경, 확인 시각을 이 문서에 기록한다. 관리자 자동 브라우저 스펙은 테스트 계정 접근과 Playwright Chromium 설치 후 `npm run test:e2e:admin`으로 실행한다. 계정이 없을 때는 성공이 아니라 skipped로 남는다.

- [x] Web Google·Kakao 로그인 뒤 USER 화면 및 보호 조회 화면 확인 (OAuth Callback·Login Code 교환·`/api/me` 네트워크 응답은 직접 관찰하지 않음)
- [x] Web 새로고침·새 탭에서 사용자 화면 복원, Web Logout 뒤 재진입 시 로그인 화면 확인 (만료 뒤 Refresh 회전은 직접 관찰하지 않음)
- [x] Admin ID/PW 로그인 뒤 관리자 콘솔·관리 운영 API 화면 조회 및 새 탭 세션 복원 확인 (`/api/me` 네트워크 응답은 직접 관찰하지 않음)
- [ ] Admin 401 → 관리자 Refresh 한 번 → 원 요청 한 번 재시도; 403은 Refresh하지 않음
- [x] Admin Logout 후 Admin 보호 화면이 로그인으로 전환되고, Web USER 세션은 유지됨
- [x] 같은 브라우저에서 Web·Admin 동시 로그인 후 Web·Admin 각각의 Logout이 반대쪽 세션을 변경하지 않음
- [ ] Web Creator Space·Event·Mission·Calendar 화면이 실제 API 응답을 표시
- [ ] Admin 운영 목록·상세·주요 동선이 실제 API 응답을 표시. 상태 변경은 개발 환경 테스트 데이터에만 수행
- [ ] 개발 배포 화면의 네트워크 요청이 두 앱 모두 `dev-api.cking.co.kr`로 향하는지 브라우저에서 확인

동시 세션 검증에서는 Web 로그인 후 Admin 로그인, Web Refresh, Admin Refresh, Web Logout, Admin 상태 재확인, Web 재로그인, Admin Logout, Web 상태 재확인 순서로 진행한다. 각 단계에서 `/api/me`와 해당 앱의 보호 API가 여전히 기대한 사용자를 반환하는지 확인한다. 쿠키 값이 아니라 Cookie **이름·Domain·Path·HttpOnly·Secure·SameSite**만 기록한다.

실제 BE Auth 계약은 [Cking-BE Auth API](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md), Web 사전 검증은 [A-03 결과](a-03-web-regression.md)를 참조한다.
