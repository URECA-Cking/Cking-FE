# Admin 앱

## 현재 구조

관리자 기능은 `apps/admin` 독립 Vite 앱이 소유한다. 라우트는 `apps/admin/src/App.jsx`, 페이지는 `apps/admin/src/pages/admin/`, API 호출은 `apps/admin/src/api/admin.js`에 있다. 개발 서버는 `5174`를 사용한다.

| 현재 라우트 | 화면·기능 |
| --- | --- |
| `/admin` | 운영 우선순위·주의 상태·현재 운영 이벤트 Dashboard |
| `/admin/reviews/creators`, `/admin/reviews/creators/:reviewId` | Creator 신청 목록·상세 심사와 승인·거절 |
| `/admin/reviews/events`, `/admin/reviews/events/:reviewId` | 승인 대기 이벤트 목록·상세 심사와 승인·거절 |
| `/admin/events`, `/admin/events/:eventId` | 운영 이벤트 목록·상세, 상태 흐름, 수동 마감 요청과 마감 처리 상태 확인 |
| `/admin/abuse-detections`, `/admin/abuse-detections/:detectionId` | 이상행위 탐지 목록·Evidence 상세·`CONFIRMED`/`FALSE_POSITIVE` 검토 |
| `/admin/console` | 마감 완료 이벤트의 스냅샷·초기 추첨·실패 추첨 재시도 운영 |
| `/admin/winners/:winnerId` | 당첨자 수령 처리·자격 박탈·이력 |
| `/admin/redraws` | 재추첨 요청 생성·상태별 목록·심사·실행 |
| `/admin/dead-streams` | Dead Stream 조회·replay |

`/admin/reviews/events`는 `PENDING_APPROVAL` 상태만 처리하는 심사 큐다. `/admin/events`는 기존 `/api/admin/events`의 상태별 조회를 합쳐 승인 완료 뒤 `SCHEDULED`부터 `PUBLISHED`까지의 이벤트를 추적한다. `SCHEDULED`는 오픈 예정 상태로 표시하되, `OPEN`부터 시작하는 실제 운영 흐름과는 구분하고 별도 관리자 작업을 노출하지 않는다. 단건 이벤트 조회 계약이 없으므로 상세도 같은 운영 목록에서 현재 서버 응답을 다시 찾아 구성한다. 심사 이력 필드의 제공 범위는 해당 API 계약을 확인한 뒤 결정한다.

관리자 라우트는 Admin 자체 세션 가드로 보호하며, `/api/me`의 `role === 'ADMIN'`을 확인한다. Admin은 Web의 페이지, `UserContext`, 팔로우 상태, 사용자·Creator 화면을 import하지 않는다.

독립 Admin은 Web OAuth를 재사용하지 않는다. [Cking-BE Auth API](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md)의 관리자 전용 ID/PW 로그인 `POST /api/auth/admin/login`으로 `role=ADMIN` Access JWT와 `ADMIN_WEB` 전용 Refresh Cookie를 발급받는다. Access JWT는 Admin 전용 `sessionStorage` 키에만 두며, 로그인·세션 복원 뒤 `/api/me`의 `role === 'ADMIN'`을 다시 확인한다. 갱신·로그아웃은 각각 `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout`으로 분리하고 `credentials: 'include'`로 관리자 Refresh Cookie를 전송한다. 관리자 API의 401은 관리자 refresh 후 한 번만 재시도하며, 복구하지 못하면 로컬 관리자 토큰을 지우고 접근을 차단한다. Logout은 진행 중인 refresh가 끝난 뒤 호출하고, Logout 시작 이전 세대의 refresh 응답은 Access Token을 저장하지 못하게 한다. 403은 refresh하지 않는다. 해당 Cookie와 Origin 계약도 Auth API 정본을 따른다. `/api/admin/**`는 ADMIN JWT로 인증·인가한다.

Admin은 `develop` 배포 때 Web과 함께 `dev-admin.cking.co.kr`로 배포한다. 별도 S3·CloudFront·DNS는 [Cking-Infra #3](https://github.com/URECA-Cking/Cking-Infra/issues/3)에서, 해당 Origin의 BE CORS·Refresh Origin 허용은 [Cking-BE #465](https://github.com/URECA-Cking/Cking-BE/issues/465)에서 구성했다.

HTTP 전송·토큰 저장소·MaterialIcon·포맷터·조회 훅은 `packages/shared`를 사용한다. 관리자 전용 refresh/로그아웃 URL, `AdminSessionContext`, 운영 정책과 상태는 Admin 앱에 둔다.

이상행위 탐지는 자동 차단이나 회원 제재를 수행하지 않는다. 관리자는 서버 페이지네이션으로 Detection을 조회하고 저장된 Evidence를 확인한 뒤 `CONFIRMED` 또는 `FALSE_POSITIVE`를 한 번 기록할 수 있다. 탐지 설정과 Rule 변경은 Admin UI 범위 밖이다.

목록의 탐지 기간은 `datetime-local` 입력을 UTC RFC 3339로 변환해 전달한다. 종료 시각은 사용자가 고른 분의 마지막 시각(`:59.999999999`)까지 포함하며, 동일 조건으로 조회를 다시 실행하면 최신 서버 목록을 다시 읽는다.

## 로컬 E2E 확인

`npm run test:e2e:admin`은 실제 개발 배포 환경에서 관리자 로그인, Refresh Cookie를 이용한 세션 복원, 로그아웃과 보호 라우트 차단을 확인하는 선택적 Playwright 테스트다. CI와 기본 `npm run test`에는 포함하지 않는다. 테스트 계정은 `E2E_ADMIN_LOGIN_ID`, `E2E_ADMIN_PASSWORD` 환경변수로 전달하며 저장소에 기록하지 않는다.
