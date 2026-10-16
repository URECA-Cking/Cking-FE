# Admin 앱

## 현재 구조

관리자 기능은 `apps/admin` 독립 Vite 앱이 소유한다. 라우트는 `apps/admin/src/App.jsx`, 페이지는 `apps/admin/src/pages/admin/`, API 호출은 `apps/admin/src/api/admin.js`에 있다. 개발 서버는 `5174`를 사용한다.

| 현재 라우트 | 화면·기능 |
| --- | --- |
| `/admin` | 운영 우선순위·주의 상태·현재 운영 이벤트 Dashboard |
| `/admin/reviews/creators`, `/admin/reviews/creators/:reviewId` | Creator 신청 목록·상세 심사와 승인·거절 |
| `/admin/reviews/events`, `/admin/reviews/events/:reviewId` | 승인 대기 이벤트 목록·상세 심사와 승인·거절 |
| `/admin/events`, `/admin/events/:eventId` | 운영 이벤트·보관함 목록·상세, 상태 흐름, 수동 마감 요청, 결과 공개 Event 보관·복원 |
| `/admin/drawings`, `/admin/drawings/:drawingId` | 마감 완료 이벤트의 Snapshot·초기 추첨·실패 추첨 재시도·결과·검증·공개 운영 (`/admin/console`은 목록으로 리디렉션) |
| `/admin/winners`, `/admin/winners/:winnerId` | 당첨자 관리 진입·상세 상태 이력·수령 처리·자격 박탈 |
| `/admin/redraws`, `/admin/redraws/:redrawRequestId` | 재추첨 요청 생성·Table 목록(심사/실행 상태 분리)·상세 심사·실행·실패 Drawing 재시도 |
| `/admin/abuse-detections`, `/admin/abuse-detections/:detectionId` | 이상행위 탐지 목록·Evidence 상세·`CONFIRMED`/`FALSE_POSITIVE` 검토 |
| `/admin/dead-streams` | Dead Stream 조회·replay |
| `/admin/subscription-verifications/image-reuse` | Verification ID 기준 구독 인증 이미지 재사용 탐지 결과 조회 |
| `/admin/tickets` | 회원별 Creator 전용·공용 응모권 잔액 비교, 변동 이력 조회, DB 기준 수동 재동기화 |
| `/admin/comment-reports` | 신고 관리: 신고된 게시글 댓글 목록(처리 상태 필터)과 댓글 숨김·신고 반려, 처리 상태와 무관한 댓글 삭제·작성자 제재(이 스페이스에서만 / 모든 스페이스) |
| `/admin/space-comment-blocks` | 제재 관리: 걸려 있는 댓글 작성 제재를 `스페이스 차단`(모든 스페이스의 차단, 크리에이터·회원 ID 필터)과 `플랫폼 제한`(자동 경고·관리자 수동 제한, 회원 ID 필터) 탭으로 나눠 보고 해제. 둘 다 "차단·제한 중만 보기" 지원. 선택한 탭은 `?scope=platform`으로 주소에 남고, 한 번 연 탭은 숨기기만 해서 필터가 유지되며 좌우 방향키로 탭을 옮긴다. 경로는 스페이스 차단만 다루던 때 주소를 지키려고 그대로 둔다 |
| `/admin/space-templates` | Creator Space 템플릿 목록·추가·수정·활성화 (활성 템플릿은 항상 하나, Creator 승인 시 복사해 스페이스 생성) |

`/admin/reviews/events`는 `PENDING_APPROVAL` 상태만 처리하는 심사 큐다. `/admin/events`는 기존 `/api/admin/events`의 상태별 조회를 합쳐 승인 완료 뒤 `SCHEDULED`부터 `PUBLISHED`까지의 이벤트를 추적한다. 보관함은 `archiveStatus=ARCHIVED`로 결과 공개(`PUBLISHED`) Event만 별도 조회하며, 상세에서 보관·복원한다. 보관은 추첨·당첨 기록을 삭제하지 않고 사용자·Creator 화면, 응모, 내 당첨, 알림에서 Event를 제외한다. `SCHEDULED`는 오픈 예정 상태로 표시하되, `OPEN`부터 시작하는 실제 운영 흐름과는 구분하고 별도 관리자 작업을 노출하지 않는다. 단건 이벤트 조회 계약이 없으므로 상세도 같은 목록 범위에서 현재 서버 응답을 다시 찾아 구성한다. 심사 이력 필드의 제공 범위는 해당 API 계약을 확인한 뒤 결정한다.

댓글 신고는 댓글 단위로 모아 보여주며, 한 댓글의 접수(PENDING) 신고를 숨김(RESOLVED)이나 반려(REJECTED)로 한 번에 처리한다. 숨김은 되돌리는 API가 없어 확인 창에서 이를 안내하고, 이미 처리된 댓글은 조치 버튼을 막는다. BE가 `COMMENT_REPORT_ALREADY_HANDLED`(409)나 404를 돌려주면(다른 관리자가 먼저 처리했거나 댓글이 삭제됨) 확인 창을 닫고 목록을 다시 읽는다. 댓글 원문이 그대로 보이는 관리자 전용 화면이며 신고자 정보는 BE가 주지 않는다.

댓글 삭제(`DELETE /api/admin/comments/{commentId}`)는 물리 삭제라 되돌릴 수 없고, 그 댓글의 신고도 함께 지워지며 작성자 경고·알림·삭제 이력이 남지 않는다(경고를 남기려면 숨기기를 쓴다). 관리자가 댓글을 찾는 화면이 없어 신고된 댓글에서만 삭제한다. 작성자 제재는 신고된 댓글 행의 `작성자 제재` 버튼으로 건다. 모달에서 범위를 고른다. `이 스페이스에서만`은 행의 크리에이터·작성 회원 ID와 기간(1~365일)으로 스페이스 차단(`POST /api/admin/comment-blocks`)을 걸고(스페이스 주인·관리자는 BE가 400으로 막는다), `모든 스페이스`는 기간과 사유(1~200자, 필수)로 플랫폼 제한(`POST /api/admin/sanctions`)을 건다. 플랫폼 제한은 경고 횟수에 세지 않고, 대상이 관리자·크리에이터인지는 BE가 아직 막지 않으므로 BE 규칙이 정해지면 오류 코드 안내를 연결한다. 숨기기는 이미 경고를 쌓아 단계별 플랫폼 제한을 자동으로 걸기 때문에 모달이 이 관계를 안내한다. 제재 목록은 offset 페이지라 "중만 보기"에서 해제한 뒤 현재 페이지를 서버에서 다시 읽는다. 스페이스 차단과 플랫폼 제한은 해제 API가 달라 탭마다 자기 API만 호출한다(서로 상대 것은 404). 플랫폼 제한의 자동 경고는 해제해도 경고 횟수에 남는다. BE는 건 사람을 회원 ID(`createdBy`)로만 알려서 크리에이터 본인과 다른 관리자를 구분하지 못하고, 로그인한 관리자 본인이 건 제재만 "나"로 표시한다.

Creator 신청 승인은 활성 Creator Space 템플릿이 있어야 한다. 없으면 `NO_ACTIVE_SPACE_TEMPLATE`, 있어도 주소 규칙이 잘못됐으면 `INVALID_ACTIVE_SPACE_TEMPLATE`(둘 다 409)로 BE가 막으므로, 심사 상세 화면이 템플릿 관리로 안내한다. 템플릿은 값을 복사해 쓰므로 활성 템플릿을 바꾸거나 수정해도 이미 만든 스페이스는 바뀌지 않는다. `slugRule` 형식 검증은 BE 규칙을 따라 화면에서 먼저 안내하고 최종 판단은 서버가 한다. 기본 프로필·배너 이미지는 URL 입력 대신 파일(JPEG·PNG, 5MB 이하, 프로필 200×200px·배너 600×200px 이상)을 선택하면 먼저 업로드하고, 응답의 `imageUrl`을 템플릿 추가·수정 요청에 넣어 저장한다. 업로드는 템플릿에 연결되지 않으므로 저장해야 반영되고, 올린 뒤 저장하지 않으면 서버가 24시간 뒤 정리할 수 있다(안내 문구를 화면에 보여 준다). 올리는 중에는 저장할 수 없다.

관리자 Winner 전체 목록·단건 조회 계약은 현재 제공되지 않는다. 따라서 `/admin/winners`는 모든 Drawing 결과를 순회하는 목록을 만들지 않고 추첨 관리로 안내하며, Winner 상세는 Drawing 결과가 전달한 범위와 상태 이력 API를 사용한다. 새로고침 뒤에도 기본 정보 전체를 복원할 수 있는 단건 조회 계약이 필요하다.

관리자 라우트는 Admin 자체 세션 가드로 보호하며, `/api/me`의 `role === 'ADMIN'`을 확인한다. Admin은 Web의 페이지, `UserContext`, 팔로우 상태, 사용자·Creator 화면을 import하지 않는다.

독립 Admin은 Web OAuth를 재사용하지 않는다. [Cking-BE Auth API](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md)의 관리자 전용 ID/PW 로그인 `POST /api/auth/admin/login`으로 `role=ADMIN` Access JWT와 `ADMIN_WEB` 전용 Refresh Cookie를 발급받는다. Access JWT는 Admin 전용 `sessionStorage` 키에만 두며, 로그인·세션 복원 뒤 `/api/me`의 `role === 'ADMIN'`을 다시 확인한다. 갱신·로그아웃은 각각 `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout`으로 분리하고 `credentials: 'include'`로 관리자 Refresh Cookie를 전송한다. 관리자 API의 401은 관리자 refresh 후 한 번만 재시도하며, 복구하지 못하면 로컬 관리자 토큰을 지우고 접근을 차단한다. Logout은 진행 중인 refresh가 끝난 뒤 호출하고, Logout 시작 이전 세대의 refresh 응답은 Access Token을 저장하지 못하게 한다. 403은 refresh하지 않는다. 해당 Cookie와 Origin 계약도 Auth API 정본을 따른다. `/api/admin/**`는 ADMIN JWT로 인증·인가한다.

Admin은 `develop` 배포 때 Web과 함께 `dev-admin.cking.co.kr`로 배포한다. 별도 S3·CloudFront·DNS는 [Cking-Infra #3](https://github.com/URECA-Cking/Cking-Infra/issues/3)에서, 해당 Origin의 BE CORS·Refresh Origin 허용은 [Cking-BE #465](https://github.com/URECA-Cking/Cking-BE/issues/465)에서 구성했다.

HTTP 전송·토큰 저장소·MaterialIcon·포맷터·조회 훅은 `packages/shared`를 사용한다. 관리자 전용 refresh/로그아웃 URL, `AdminSessionContext`, 운영 정책과 상태는 Admin 앱에 둔다.

이상행위 탐지는 자동 차단이나 회원 제재를 수행하지 않는다. 관리자는 서버 페이지네이션으로 Detection을 조회하고 저장된 Evidence를 확인한 뒤 `CONFIRMED` 또는 `FALSE_POSITIVE`를 한 번 기록할 수 있다. 탐지 설정과 Rule 변경은 Admin UI 범위 밖이다.

목록의 탐지 기간은 `datetime-local` 입력을 UTC RFC 3339로 변환해 전달한다. 종료 시각은 사용자가 고른 분의 마지막 시각(`:59.999999999`)까지 포함하며, 동일 조건으로 조회를 다시 실행하면 최신 서버 목록을 다시 읽는다.

응모권 관리는 대상 회원 ID와 종류를 직접 입력해 조회한다. Creator 전용 응모권일 때만 Creator ID를 전달한다. 이력은 발생 시각·유형·증감량·이벤트/미션/요청 ID·사유를 표시하며, 서버 cursor를 이용한 더보기로 이전 목록 아래에 추가한다. 추가 조회가 실패하면 이미 읽은 이력은 유지하고 재시도할 수 있다. Redis·MySQL 잔액 중 하나가 없으면 비교 불가로 표시하고, Redis 키 미존재는 Redis 조회 실패(`REDIS_BALANCE_QUERY_FAILED`)와 별도로 안내한다. Redis 조회 실패 시에는 응답이 없어 MySQL 잔액과 비교 결과를 표시하지 않는다. 두 값의 차이는 비동기 반영 지연일 수 있으므로 자동 보정하지 않는다. 수동 재동기화는 MySQL 행이 있고 Redis 키가 없거나 잔액이 다를 때만 시작할 수 있다. 확인창에서 사유를 입력한 뒤 최신 잔액을 재조회하고 처음 조회한 값과의 변경 여부, 키 유실 또는 일시적인 불일치 가능성을 안내한다. 운영자가 원인을 확인해야 보정 요청을 보낼 수 있으며, 최신 잔액이 일치하면 요청을 막는다. `INVALID_STATE`는 미반영 Stream·Dead Stream 확인, `CONCURRENT_COMMAND`는 진행 중인 보정 확인을 안내한다. 최종 허용 여부는 BE의 maintenance lock 및 미반영 메시지 검사에 따른다. 성공 후 잔액과 이력을 첫 페이지부터 다시 조회한다. 요청·응답·오류 규약은 [BE Ticket API](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/ticket/api.md)를 따른다.

## 로컬 E2E 확인

`npm run test:e2e:admin`은 실제 개발 배포 환경에서 관리자 로그인, Refresh Cookie를 이용한 세션 복원, 로그아웃과 보호 라우트 차단을 확인하는 선택적 Playwright 테스트다. CI와 기본 `npm run test`에는 포함하지 않는다. 테스트 계정은 `E2E_ADMIN_LOGIN_ID`, `E2E_ADMIN_PASSWORD` 환경변수로 전달하며 저장소에 기록하지 않는다.

응모권 관리의 실제 FE·BE·Redis·MySQL 검증은 [TC-08 실행 절차와 결과](../verification/tc-08-admin-ticket-e2e.md)를 따른다. 조회와 보정 테스트는 기존 Admin E2E 명령에서 `--grep 'TC-08'`로 선택하며, 보정은 격리된 테스트 데이터가 준비된 경우에만 실행한다.
