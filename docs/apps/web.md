# Web 앱

## 현재 구조

Web과 Creator 기능은 `apps/web/src/`에 있으며 독립 Web workspace에서 빌드·실행한다. Web 화면은 `apps/web/src/pages/`, Creator 운영 기능(이벤트·일정 관리)은 내 스페이스 화면과 `apps/web/src/components/creator/`에 있다. 루트에서는 `npm run dev:web`, `npm run build:web`, `npm run lint:web`로 Web workspace를 실행·검증한다.

### 책임과 라우트

| 영역 | 현재 라우트 | 책임 |
| --- | --- | --- |
| 인증 | `/login`, `/oauth/callback` | Google/Kakao OAuth 시작과 Login Code 교환 |
| 프로필 | `/profile/edit` | 닉네임·프로필 사진 편집, 닉네임 미설정 회원의 최초 설정 |
| 사용자 | `/`, `/explore`, `/my-entries`, `/my-winners`, `/notifications`, `/my-page`, `/my-calendar`, `/my-tickets` | 탐색, 응모, 알림, 개인 정보·캘린더·당첨·응모권 관리 |
| 온보딩·공개 Space | `/onboarding`, `/onboarding/creators`, `/creators/:creatorId`, `/space/:slug`, `/events/:eventId` | 관심 분야·추천, 팔로우, Creator Space, 이벤트·응모 |
| Creator 운영 | `/creator/events/new`, `/creator/events/:eventId/edit` | 이벤트 작성·수정. 이벤트 목록·일정 관리는 내 스페이스의 이벤트·캘린더 탭에서 한다 |

`/studio*`는 내 스페이스로 리다이렉트한다. `/space/:slug`는 비로그인 공개 조회를 허용한다. 그 밖의 사용자 경로는 `RequireUser`, Creator 운영은 추가로 `RequireRole role="creator"`를 사용한다.

크리에이터 스페이스의 탭 선택은 현재 방문 기록 항목의 라우터 상태에 보관한다. 홈 탭의 `결과 확인`에서 이벤트 상세로 이동한 뒤 화면 또는 브라우저 뒤로 가기로 돌아오면 홈 탭이 다시 열린다. 다른 탭에서도 상세 화면 복귀 시 마지막으로 선택한 탭을 유지한다.

하단 메뉴로 다른 메뉴 화면을 열거나 현재 메뉴를 다시 누르면 `MainLayout`의 공용 스크롤 컨테이너를 최상단으로 옮기고, 스크롤로 바뀐 헤더·하단 메뉴 표시 상태를 기본값으로 되돌린다. 이 초기화는 하단 메뉴 클릭에만 적용하므로 상세 화면에서 뒤로 이동할 때는 이전 스크롤 위치 복원 동작을 유지한다.

### 상태와 인증

`UserContext`가 `/api/me`, 세션 상태, 역할, 팔로우 상태를 관리한다. Access JWT는 `sessionStorage`에 두며, `apps/web/src/api/client.js`가 Web 전용 refresh와 401 동작을 처리한다. 공통 HTTP 전송과 토큰 저장소의 저수준 로직은 `packages/shared`를 사용한다. Toast는 `ToastContext`가 담당한다. Web 전용 상태·Context·페이지는 Admin과 공유하지 않는다.

회원·크리에이터 프로필 사진은 Web 공통 `ProfilePhoto`로 표시한다. 사진 URL이 없거나 이미지 로딩에 실패하면 사람 아이콘을 보여주며, URL이 바뀌면 새 사진을 다시 표시한다. 사진 업로드·저장과 Creator Space의 기본 이미지 URL 결정은 기존 API 흐름을 따른다.

Creator Space 게시물 상세는 작성자 이름과 작성 시각, 이미지, 본문, 좋아요, 댓글 목록·입력창 순으로 표시한다. 본문에는 작성자 이름을 반복하지 않고, 댓글은 상세를 열면 바로 조회한다. 좋아요와 댓글의 권한·오류 처리는 기존 게시물·댓글 API 흐름을 따른다. 게시글 주인(크리에이터)과 관리자는 같은 댓글창에서 남의 댓글에 "…" 메뉴의 "이 회원 차단"(그 스페이스에서 1~365일)과 삭제를 쓸 수 있고, 호출하는 API만 다르다(크리에이터는 크리에이터 API, 게시글 주인이 아닌 관리자는 관리자 API). 게시글 주인이 쓴 댓글(`writtenByCreator`)에는 차단 메뉴를 보이지 않는다. 작성자가 관리자인지는 댓글 응답으로 알 수 없어서 그 경우는 서버가 거절한 뒤 안내한다.

`apps/web`은 PUBLIC, USER, CREATOR API를 소유한다. 공통화 후보는 앱 독립적인 UI·HTTP 클라이언트·유틸·실제 공통 타입뿐이며, `UserContext`, 팔로우 상태, Web/Creator 화면은 shared에 두지 않는다. 관리자 콘솔은 `VITE_ADMIN_BASE_URL`로 독립 Admin 앱에 진입한다.

API 사용 범위와 정본 링크는 [api-coverage.md](../api-coverage.md)를 따른다.

### Creator Quiz 최종 문항 구성

내 Quiz 검토 시트에서 최신 미게시 Revision의 문항을 선택·재정렬·편집하거나 직접 추가한다. 최종 미리보기 후 저장하고 서버에서 받은 Revision을 다시 확인해 책임 승인한다. 게시 요청은 별도로 실행하며 AI 원본의 기존 Judge 승인 흐름은 유지한다.

원본 평가와 현재 수정 상태를 구분한다. 수동 문항에 근거가 없으면 근거 없음으로 표시하며 자동 AI 재평가를 하지 않는다. 최초 게시 이후에는 공개를 취소해도 편집할 수 없고 같은 고정 Revision만 재게시한다. 신규 필드가 없는 BE 응답에서는 편집 진입을 숨긴다.

편집 UUID·정규화 요청 본문·저장 결과는 Creator/Quiz별 별도 localStorage 키에 보관한다. Web Locks와 조건부 갱신으로 탭 간 요청을 보호하고 응답 유실은 같은 UUID·본문으로 복구한다. 저장소/Web Locks가 불가능하면 저장 요청을 보내지 않는다. stale 충돌에서는 작성 내용을 보존하고 최신본을 확인하며 사용자의 명시적 선택 없이 새 UUID로 저장하지 않는다. Generation/Judge 기록은 변경하지 않는다.

계약 정본은 [BE 문항 구성·책임 승인](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/composition-api.md)이다. 실제 BE·Provider 통합 검증은 별도 승인 후 수행한다.

### 실행 환경과 회귀 검증

로컬에서 `VITE_API_BASE_URL`을 비우면 `/api`는 Web과 같은 출처로 요청되고 Vite가 `VITE_API_PROXY_TARGET`(기본 `http://localhost:8080`)으로 전달한다. OAuth 시작은 페이지 이동이므로 프록시를 거치지 않고 백엔드 주소로 직접 이동한다. `VITE_ADMIN_BASE_URL`은 독립 Admin 앱 주소이며, 운영 빌드에서 값이 없으면 이동 가능한 관리자 링크 대신 `서비스 준비 중` 비활성 항목을 표시한다. 개발 배포 빌드는 CI가 API와 Admin 주소를 주입한다.

모노레포 전환 후 Web 경계와 로컬 검증 결과는 [A-03 회귀 검증](../verification/a-03-web-regression.md)을 참고한다.
