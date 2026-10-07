# FE API 사용 현황

이 문서는 **FE가 실제로 호출하는 API와 화면의 매핑**만 관리한다. 요청/응답 필드, 오류 코드, 인가 규칙의 정본은 Cking-BE `develop`의 [API 인덱스](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/api-index.md)와 각 행의 계약 문서다. 계약 상세를 이 문서에 복사하지 않는다.

표기의 `연동`은 각 앱의 `src/api/` 모듈과 화면/컴포넌트에서 호출하는 항목, `미연동`은 BE에 있으나 현재 화면이 없는 항목이다. Admin API는 `apps/admin`이 소유한다.

## Common

| Method | Endpoint | 사용 앱 | 화면/기능 | FE 상태 | BE 계약 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/me` | Web | 세션 복원·역할 판정 | 연동 | [Auth](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md) |
| POST | `/api/auth/token`, `/api/auth/refresh`, `/api/auth/logout` | Web | OAuth Login Code 교환·갱신·로그아웃 | 연동 | [Auth](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md) |
| GET | `/oauth2/authorization/{provider}` | Web | OAuth 로그인 시작 페이지 이동 | 연동 | [Auth](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md) |
| - | 공통 HTTP·오류 규약 | Web | `apps/web/src/api/client.js`: Bearer JWT, `credentials: include`, 401 1회 갱신 | 연동 | [API 인덱스](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/api-index.md) |

## Web — PUBLIC / USER

| Method | Endpoint | 화면/기능 | FE 상태 | BE 계약 |
| --- | --- | --- | --- | --- |
| GET | `/api/creators` | 홈·탐색·온보딩·마이페이지의 Creator 목록/프로필 | 연동 | [Creator](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/api.md) |
| GET | `/api/creators/{id}/space`, `/api/creator-spaces/{slug}` | Creator Space·공유 링크 | 연동 | [Creator Space](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/space-api.md) |
| GET | `/api/events`, `/api/events/{eventId}` | 홈·탐색·이벤트 상세 | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| POST | `/api/events/{eventId}/entries` | 이벤트 응모(멱등 키) | 연동 | [Entry](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/entry-api.md) |
| GET | `/api/events/{eventId}/entries/me` | 내 응모 조회 | 연동 | [Entry](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/entry-api.md) |
| GET | `/api/events/{eventId}/winners`, `/api/me/winners` | 이벤트 상세·내 당첨 | 연동 | [Winner](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/winner/api.md) |
| POST | `/api/me/winners/{winnerId}/decline` | 내 당첨 포기 | 연동 | [Winner](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/winner/api.md) |
| GET | `/api/winners/{winnerId}/history` | 내 당첨 상태 이력 | 연동 | [Winner](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/winner/api.md) |
| GET/PUT/DELETE | `/api/me/follows`, `/api/creators/{creatorId}/follow` | 팔로우 목록·등록·해제 | 연동 | [Follow](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/follow/api.md) |
| GET/PATCH | `/api/me/notifications`, `/api/me/notifications/{id}/read` | 알림 목록·읽음 | 연동 | [Notification](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/notification/api.md) |
| GET | `/api/creators/{creatorId}/tickets`, `/api/creators/{creatorId}/tickets/history` | 잔액·응모권 원장 | 연동 | [Ticket](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/ticket/api.md) |
| GET/POST | `/api/creators/{creatorId}/missions`, `/api/creators/{creatorId}/missions/{missionId}/complete` | Creator Space 미션 조회·완료 | 연동 | [Mission](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/mission/api.md) |
| GET | `/api/creators/{creatorId}/calendar/schedules` | Creator Space 공개 캘린더 | 연동 | [Calendar](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/calendar/api.md) |
| GET/PUT/DELETE | `/api/me/calendar/schedules`, `/api/me/calendar/schedules/{scheduleId}` | 내 캘린더 조회·담기·빼기 | 연동 | [Calendar](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/calendar/api.md) |
| GET | `/api/creators/{creatorId}/posts`, `/api/creators/{creatorId}/posts/{postId}` | Space 게시물 목록·상세 | 연동 | [Post](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/api.md) |
| GET/POST/PATCH/DELETE | `/api/creators/{creatorId}/posts/{postId}/comments` | 게시물 댓글 조회·작성·수정·삭제 | 연동 | [Comment](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/comment-api.md) |

## Web — CREATOR

| Method | Endpoint | 화면/기능 | FE 상태 | BE 계약 |
| --- | --- | --- | --- | --- |
| POST/GET | `/api/creator/applications`, `/api/creator/applications/me` | Creator 전환 신청·내 신청 | 연동 | [Creator](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/api.md) |
| GET/PATCH | `/api/creator/space`, `/api/creator/space/slug` | 내 Space 편집·slug 변경 | 연동 | [Creator Space](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/space-api.md) |
| GET/POST/PATCH/DELETE | `/api/creator/events`, `/api/creator/events/{eventId}` | Creator Studio 이벤트 CRUD | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| POST | `/api/creator/events/{eventId}/approval-request` | 이벤트 승인 요청 | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| POST | `/api/events/{eventId}/close` | 이벤트 수동 마감 | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| GET/POST/PATCH/DELETE | `/api/creator/calendar/schedules`, `/api/creator/calendar/schedules/{scheduleId}` | Creator 일정 관리 | 연동 | [Calendar](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/calendar/api.md) |
| POST | `/api/creator/posts/images` | 게시물 이미지 업로드 | 연동 | [Post](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/api.md) |
| POST/PATCH/DELETE | `/api/creator/posts`, `/api/creator/posts/{postId}` | 게시물 작성·수정·삭제 | 연동 | [Post](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/api.md) |

## Admin — ADMIN

| Method | Endpoint | 화면/기능 | FE 상태 | BE 계약 |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/admin/login` | 관리자 ID/PW 로그인, ADMIN JWT·`admin_refresh_token` Cookie 발급 | 연동 | [Auth](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md) |
| POST | `/api/admin/auth/refresh`, `/api/admin/auth/logout` | `admin_refresh_token` Cookie 갱신·로그아웃 | 연동 | [Auth](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md) |
| - | 공통 HTTP·오류 규약 | Admin | `apps/admin/src/api/client.js`: Admin Bearer JWT·`credentials: include`, 401 관리자 refresh 후 1회 재시도, 실패 시 Admin 세션 제거, 403은 권한 오류 | 연동 | [API 인덱스](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/api-index.md) |
| GET/POST | `/api/admin/events/pending`, `/api/admin/events/{eventId}/approve`, `/reject` | 이벤트 승인·반려 | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| GET/POST | `/api/admin/creator-applications`, `/api/admin/creator-applications/{id}/approve`, `/reject` | Creator 신청 승인·반려 | 연동 | [Creator](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/api.md) |
| GET | `/api/admin/events/{eventId}/closing-status`, `/snapshot` | 마감·스냅샷 확인 | 연동 | [Drawing Admin Query](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/drawing/admin-query-api.md) |
| POST/GET | `/api/admin/events/{eventId}/drawings`, `/api/admin/drawings/{drawingId}`, `/result`, `/publish` | 초기 추첨·결과 확인·공개 | 연동 | [Drawing](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/drawing/api.md) |
| POST/GET | `/api/admin/drawings/{drawingId}/verify`, `/verification-history` | 추첨 검증·이력 | 연동 | [Verification](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/drawing/verification-api.md) |
| POST/GET | `/api/admin/winners/{winnerId}/receive`, `/disqualify`, `/api/winners/{winnerId}/history` | 당첨자 수령·자격·이력 | 연동 | [Winner](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/winner/api.md) |
| POST/GET | `/api/admin/events/{eventId}/redraw-requests`, `/api/admin/redraw-requests/{id}` | 재추첨 요청·조회 | 연동 | [Redraw](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/redraw/api.md) |
| GET/POST | `/api/admin/dead-streams`, `/api/admin/dead-streams/{id}/replay` | Dead Stream 조회·replay | 연동 | [Stream](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/stream/api.md) |

## 미연동 또는 확인이 필요한 BE 기능

현재 UI/API 모듈에서 사용하지 않는 API를 새로 연동할 때는 먼저 API 인덱스에서 역할과 계약 문서를 확인하고, 해당 행을 이 문서에 추가한다. 예: Creator Space 템플릿, 관심사, Abuse Detection, Subscription Verification, Ticket/Lua 내부 처리 API는 현재 FE 화면 사용 범위가 아니다.
