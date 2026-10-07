# Admin 앱

## 현재 구조

관리자 기능은 아직 독립 앱이 아니다. 라우트는 `apps/web/src/App.jsx`, 페이지는 `apps/web/src/pages/admin/`, API 호출은 `apps/web/src/api/admin.js`에 있으며 Web workspace의 일부로 빌드된다.

| 현재 라우트 | 화면·기능 |
| --- | --- |
| `/admin` | 승인 대기 이벤트·Creator 신청, 마감·스냅샷·초기 추첨 운영 |
| `/admin/winners/:winnerId` | 당첨자 수령 처리·자격 박탈·이력 |
| `/admin/redraws` | 재추첨 요청·조회 |
| `/admin/dead-streams` | Dead Stream 조회·replay |

현재 과도기 구현의 관리자 라우트는 `RequireUser`와 `RequireRole role="admin"`으로 보호하며, `/api/me`의 `role === 'ADMIN'`을 사용한다. 이는 Web workspace 안의 현재 구현일 뿐, B-01 독립 Admin의 인증 계약이 아니다.

## B-01 이후 목표

관리자 화면·라우팅·운영 상태·`/api/admin/**` 호출은 `apps/admin`이 소유한다. Admin은 Web의 페이지, `UserContext`, 팔로우 상태, 사용자·Creator 화면을 import하지 않는다.

독립 Admin은 Web OAuth를 재사용하지 않는다. [Cking-BE Auth API](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md)의 관리자 전용 ID/PW 로그인 `POST /api/auth/admin/login`으로 `role=ADMIN` Access JWT와 `ADMIN_WEB` 전용 Refresh Cookie를 발급받는다. 갱신·로그아웃은 각각 `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout`으로 분리하며, 해당 Cookie와 Origin 계약도 Auth API 정본을 따른다. `/api/admin/**`는 ADMIN JWT로 인증·인가한다.

Admin은 `dev-admin.cking.co.kr`에서 별도 배포한다. 별도 S3·CloudFront와 해당 Origin의 BE CORS 허용은 Admin 생성 작업에서 확인하며, `apps/admin` 생성 PR에 Admin 배포 워크플로도 함께 추가한다.

공통 HTTP 클라이언트나 순수 UI가 실제로 양쪽에서 필요할 때만 `packages/shared`를 사용한다. Admin 전용 운영 정책과 상태는 shared에 두지 않는다.
