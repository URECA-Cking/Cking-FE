# Admin 앱

## 현재 develop 구조

관리자 기능은 아직 단일 Vite 앱 안에 있다. 라우트는 `src/App.jsx`, 페이지는 `src/pages/admin/`, API 호출은 `src/api/admin.js`에 있다.

PR #46이 머지된 뒤에도 관리자는 독립 앱이 아니다. 같은 코드가 `apps/web/src/App.jsx`, `apps/web/src/pages/admin/`, `apps/web/src/api/admin.js`으로 이전될 뿐이며, Web workspace의 일부로 빌드된다.

| 현재 라우트 | 화면·기능 |
| --- | --- |
| `/admin` | 승인 대기 이벤트·Creator 신청, 마감·스냅샷·초기 추첨 운영 |
| `/admin/winners/:winnerId` | 당첨자 수령 처리·자격 박탈·이력 |
| `/admin/redraws` | 재추첨 요청·조회 |
| `/admin/dead-streams` | Dead Stream 조회·replay |

모든 관리자 라우트는 `RequireUser`와 `RequireRole role="admin"`으로 보호한다. 현재 역할 판정은 `/api/me`의 `role === 'ADMIN'`이며, 요청 권한의 최종 판정은 BE가 한다.

## B-01 이후 목표

관리자 화면·라우팅·운영 상태·`/api/admin/**` 호출은 `apps/admin`이 소유한다. Admin은 Web의 페이지, `UserContext`, 팔로우 상태, 사용자·Creator 화면을 import하지 않는다. 관리자 인증·권한 계약의 정본은 [Cking-BE Auth API](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md)와 각 관리자 도메인 API 문서이며, FE가 별도 인증 계약을 만들지 않는다.

공통 HTTP 클라이언트나 순수 UI가 실제로 양쪽에서 필요할 때만 `packages/shared`를 사용한다. Admin 전용 운영 정책과 상태는 shared에 두지 않는다.
