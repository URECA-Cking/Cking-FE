# Web 앱

## 현재 구조

Web과 Creator 기능은 `apps/web/src/`에 있으며 독립 Web workspace에서 빌드·실행한다. Web 화면은 `apps/web/src/pages/`, Creator 운영 기능(이벤트·일정 관리)은 내 스페이스 화면과 `apps/web/src/components/creator/`에 있다. 루트에서는 `npm run dev:web`, `npm run build:web`, `npm run lint:web`로 Web workspace를 실행·검증한다.

### 책임과 라우트

| 영역 | 현재 라우트 | 책임 |
| --- | --- | --- |
| 인증 | `/login`, `/oauth/callback` | Google/Kakao OAuth 시작과 Login Code 교환 |
| 프로필 | `/profile/edit` | 닉네임·프로필 사진 편집, 닉네임 미설정 회원의 최초 설정 |
| 사용자 | `/`, `/explore`, `/my-entries`, `/my-winners`, `/notifications`, `/my-page`, `/my-calendar` | 탐색, 응모, 알림, 개인 정보·캘린더·당첨 관리 |
| 온보딩·공개 Space | `/onboarding`, `/onboarding/creators`, `/creators/:creatorId`, `/space/:slug`, `/events/:eventId` | 관심 분야·추천, 팔로우, Creator Space, 이벤트·응모 |
| Creator 운영 | `/creator/events/new`, `/creator/events/:eventId/edit` | 이벤트 작성·수정. 이벤트 목록·일정 관리는 내 스페이스의 이벤트·캘린더 탭에서 한다 |

`/studio*`는 내 스페이스로 리다이렉트한다. `/space/:slug`는 비로그인 공개 조회를 허용한다. 그 밖의 사용자 경로는 `RequireUser`, Creator 운영은 추가로 `RequireRole role="creator"`를 사용한다.

### 상태와 인증

`UserContext`가 `/api/me`, 세션 상태, 역할, 팔로우 상태를 관리한다. Access JWT는 `sessionStorage`에 두며, `apps/web/src/api/client.js`가 Web 전용 refresh와 401 동작을 처리한다. 공통 HTTP 전송과 토큰 저장소의 저수준 로직은 `packages/shared`를 사용한다. Toast는 `ToastContext`가 담당한다. Web 전용 상태·Context·페이지는 Admin과 공유하지 않는다.

회원·크리에이터 프로필 사진은 Web 공통 `ProfilePhoto`로 표시한다. 사진 URL이 없거나 이미지 로딩에 실패하면 사람 아이콘을 보여주며, URL이 바뀌면 새 사진을 다시 표시한다. 사진 업로드·저장과 Creator Space의 기본 이미지 URL 결정은 기존 API 흐름을 따른다.

Creator Space 게시물 상세는 작성자 이름과 작성 시각, 이미지, 본문, 좋아요, 댓글 목록·입력창 순으로 표시한다. 본문에는 작성자 이름을 반복하지 않고, 댓글은 상세를 열면 바로 조회한다. 좋아요와 댓글의 권한·오류 처리는 기존 게시물·댓글 API 흐름을 따른다.

`apps/web`은 PUBLIC, USER, CREATOR API를 소유한다. 공통화 후보는 앱 독립적인 UI·HTTP 클라이언트·유틸·실제 공통 타입뿐이며, `UserContext`, 팔로우 상태, Web/Creator 화면은 shared에 두지 않는다. 관리자 콘솔은 `VITE_ADMIN_BASE_URL`로 독립 Admin 앱에 진입한다.

API 사용 범위와 정본 링크는 [api-coverage.md](../api-coverage.md)를 따른다.

### 실행 환경과 회귀 검증

로컬에서 `VITE_API_BASE_URL`을 비우면 `/api`는 Web과 같은 출처로 요청되고 Vite가 `VITE_API_PROXY_TARGET`(기본 `http://localhost:8080`)으로 전달한다. OAuth 시작은 페이지 이동이므로 프록시를 거치지 않고 백엔드 주소로 직접 이동한다. `VITE_ADMIN_BASE_URL`은 독립 Admin 앱 주소이며, 운영 빌드에서 값이 없으면 이동 가능한 관리자 링크 대신 `서비스 준비 중` 비활성 항목을 표시한다. 개발 배포 빌드는 CI가 API와 Admin 주소를 주입한다.

모노레포 전환 후 Web 경계와 로컬 검증 결과는 [A-03 회귀 검증](../verification/a-03-web-regression.md)을 참고한다.
