# Web 앱

## 현재 develop 구조

현재 Web과 Creator 기능은 단일 Vite 앱의 `src/`에 있으며, Admin과 빌드·실행 단위를 공유한다. Web 화면은 `src/pages/`, Creator 운영 화면은 `src/pages/studio/`와 `src/components/creator/`에 있다.

## PR #46 머지 후 구조

PR #46이 머지되면 이 코드는 `apps/web/src/`으로 이동한다. 이 단계의 `apps/web`은 여전히 Admin 코드까지 포함한 기존 앱 전체이고, 독립 Admin 앱은 아직 없다. 루트에서는 `npm run dev:web`, `npm run build:web`, `npm run lint`로 Web workspace를 실행·검증한다.

### 책임과 라우트

| 영역 | 현재 라우트 | 책임 |
| --- | --- | --- |
| 인증 | `/login`, `/oauth/callback` | Google/Kakao OAuth 시작과 Login Code 교환 |
| 사용자 | `/`, `/explore`, `/my-entries`, `/my-winners`, `/notifications`, `/my-page`, `/my-calendar` | 탐색, 응모, 알림, 개인 정보·캘린더·당첨 관리 |
| 온보딩·공개 Space | `/onboarding/creators`, `/creators/:creatorId`, `/space/:slug`, `/events/:eventId` | 팔로우, Creator Space, 이벤트·응모 |
| Creator 운영 | `/studio`, `/studio/events/new`, `/studio/events/:eventId/edit`, `/studio/calendar` | 이벤트·일정·Space 운영 |

`/space/:slug`는 비로그인 공개 조회를 허용한다. 그 밖의 사용자 경로는 `RequireUser`, Creator 운영은 추가로 `RequireRole role="creator"`를 사용한다.

### 상태와 인증

`UserContext`가 `/api/me`, 세션 상태, 역할, 팔로우 상태를 관리한다. Access JWT는 `sessionStorage`에 두며, `src/api/client.js`가 `Authorization`과 Refresh Cookie를 처리한다. Toast는 `ToastContext`가 담당한다. Web 전용 상태·Context·페이지는 Admin과 공유하지 않는다.

### B-01 이후 목표

위 코드는 `apps/web`으로 이동한다. Web은 PUBLIC, USER, CREATOR API만 소유한다. 공통화 후보는 앱 독립적인 UI·HTTP 클라이언트·유틸·실제 공통 타입뿐이며, `UserContext`, 팔로우 상태, Web/Creator 화면은 shared에 두지 않는다.

API 사용 범위와 정본 링크는 [api-coverage.md](../api-coverage.md)를 따른다.
