# Admin 앱

## 현재 구조

관리자 기능은 `apps/admin` 독립 Vite 앱이 소유한다. 라우트는 `apps/admin/src/App.jsx`, 페이지는 `apps/admin/src/pages/admin/`, API 호출은 `apps/admin/src/api/admin.js`에 있다. 개발 서버는 `5174`를 사용한다.

| 현재 라우트 | 화면·기능 |
| --- | --- |
| `/admin` (`?tab=events\|applications\|drawings`) | 공통 Backoffice Layout 내부에서 승인 대기 이벤트·Creator 신청, 수동 마감·스냅샷·초기 추첨·실패 추첨 재시도 운영 |
| `/admin/winners/:winnerId` | 당첨자 수령 처리·자격 박탈·이력 |
| `/admin/redraws` | 재추첨 요청 생성·상태별 목록·심사·실행 |
| `/admin/dead-streams` | Dead Stream 조회·replay |

관리자 라우트는 Admin 자체 세션 가드로 보호하며, `/api/me`의 `role === 'ADMIN'`을 확인한다. Admin은 Web의 페이지, `UserContext`, 팔로우 상태, 사용자·Creator 화면을 import하지 않는다.

독립 Admin은 Web OAuth를 재사용하지 않는다. [Cking-BE Auth API](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md)의 관리자 전용 ID/PW 로그인 `POST /api/auth/admin/login`으로 `role=ADMIN` Access JWT와 `ADMIN_WEB` 전용 Refresh Cookie를 발급받는다. Access JWT는 Admin 전용 `sessionStorage` 키에만 두며, 로그인·세션 복원 뒤 `/api/me`의 `role === 'ADMIN'`을 다시 확인한다. 갱신·로그아웃은 각각 `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout`으로 분리하고 `credentials: 'include'`로 관리자 Refresh Cookie를 전송한다. 관리자 API의 401은 관리자 refresh 후 한 번만 재시도하며, 복구하지 못하면 로컬 관리자 토큰을 지우고 접근을 차단한다. Logout은 진행 중인 refresh가 끝난 뒤 호출하고, Logout 시작 이전 세대의 refresh 응답은 Access Token을 저장하지 못하게 한다. 403은 refresh하지 않는다. 해당 Cookie와 Origin 계약도 Auth API 정본을 따른다. `/api/admin/**`는 ADMIN JWT로 인증·인가한다.

Admin은 `develop` 배포 때 Web과 함께 `dev-admin.cking.co.kr`로 배포한다. 별도 S3·CloudFront·DNS는 [Cking-Infra #3](https://github.com/URECA-Cking/Cking-Infra/issues/3)에서, 해당 Origin의 BE CORS·Refresh Origin 허용은 [Cking-BE #465](https://github.com/URECA-Cking/Cking-BE/issues/465)에서 구성했다.

HTTP 전송·토큰 저장소·MaterialIcon·포맷터·조회 훅은 `packages/shared`를 사용한다. 관리자 전용 refresh/로그아웃 URL, `AdminSessionContext`, 운영 정책과 상태는 Admin 앱에 둔다.

## 로컬 E2E 확인

`npm run test:e2e:admin`은 실제 개발 배포 환경에서 관리자 로그인, Refresh Cookie를 이용한 세션 복원, 로그아웃과 보호 라우트 차단을 확인하는 선택적 Playwright 테스트다. CI와 기본 `npm run test`에는 포함하지 않는다. 테스트 계정은 `E2E_ADMIN_LOGIN_ID`, `E2E_ADMIN_PASSWORD` 환경변수로 전달하며 저장소에 기록하지 않는다.
