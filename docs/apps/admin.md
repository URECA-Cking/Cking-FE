# Admin 앱

## 현재 구조

관리자 기능은 `apps/admin` 독립 Vite 앱이 소유한다. 라우트는 `apps/admin/src/App.jsx`, 페이지는 `apps/admin/src/pages/admin/`, API 호출은 `apps/admin/src/api/admin.js`에 있다. 개발 서버는 `5174`를 사용한다.

| 현재 라우트 | 화면·기능 |
| --- | --- |
| `/admin` | 승인 대기 이벤트·Creator 신청, 마감·스냅샷·초기 추첨 운영 |
| `/admin/winners/:winnerId` | 당첨자 수령 처리·자격 박탈·이력 |
| `/admin/redraws` | 재추첨 요청·조회 |
| `/admin/dead-streams` | Dead Stream 조회·replay |

관리자 라우트는 Admin 자체 세션 가드로 보호하며, `/api/me`의 `role === 'ADMIN'`을 확인한다. Admin은 Web의 페이지, `UserContext`, 팔로우 상태, 사용자·Creator 화면을 import하지 않는다.

독립 Admin은 Web OAuth를 재사용하지 않는다. [Cking-BE Auth API](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md)의 관리자 전용 ID/PW 로그인 `POST /api/auth/admin/login`으로 `role=ADMIN` Access JWT와 `ADMIN_WEB` 전용 Refresh Cookie를 발급받는다. Access JWT는 Admin 전용 `sessionStorage` 키에만 두며, 로그인·세션 복원 뒤 `/api/me`의 `role === 'ADMIN'`을 다시 확인한다. 갱신·로그아웃은 각각 `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout`으로 분리하고 `credentials: 'include'`로 관리자 Refresh Cookie를 전송한다. 관리자 API의 401은 관리자 refresh 후 한 번만 재시도하며, 복구하지 못하면 로컬 관리자 토큰을 지우고 접근을 차단한다. 403은 refresh하지 않는다. 해당 Cookie와 Origin 계약도 Auth API 정본을 따른다. `/api/admin/**`는 ADMIN JWT로 인증·인가한다.

Admin은 `dev-admin.cking.co.kr`에서 별도 배포한다. 별도 S3·CloudFront·DNS는 [Cking-Infra #3](https://github.com/URECA-Cking/Cking-Infra/issues/3)에서, 해당 Origin의 BE CORS·Refresh Origin 허용은 [Cking-BE #465](https://github.com/URECA-Cking/Cking-BE/issues/465)에서 준비를 완료했다. 남은 작업은 Admin 배포 워크플로와 Web 배포 빌드의 `VITE_ADMIN_BASE_URL` 주입이다.

공통 HTTP 클라이언트나 순수 UI가 실제로 양쪽에서 필요할 때만 `packages/shared`를 사용한다. Admin 전용 운영 정책과 상태는 shared에 두지 않는다.
