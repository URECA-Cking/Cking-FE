# FE API 사용 현황

이 문서는 **FE가 실제로 호출하는 API와 화면의 매핑**만 관리한다. 요청/응답 필드, 오류 코드, 인가 규칙의 정본은 Cking-BE `develop`의 [API 인덱스](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/api-index.md)와 각 행의 계약 문서다. 계약 상세를 이 문서에 복사하지 않는다.

표기의 `연동`은 각 앱의 `src/api/` 모듈과 화면/컴포넌트에서 호출하는 항목, `미연동`은 BE에 있으나 현재 화면이 없는 항목이다. Admin API는 `apps/admin`이 소유한다.

## Common

| Method | Endpoint | 사용 앱 | 화면/기능 | FE 상태 | BE 계약 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/me` | Web | 세션 복원·역할 판정, 신규 가입자 판별(`onboardingCompleted`), 프로필(`nickname`·`profileImageUrl`·`profileConfigured`·`nicknameChangeableAt`·`restorableNickname`). 크리에이터에게도 내려오지만 공개 이름·사진은 아니라서 마이페이지는 크리에이터를 스페이스의 활동명·사진으로 표시한다 | 연동 | [Auth](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md) |
| POST | `/api/auth/token`, `/api/auth/refresh`, `/api/auth/logout` | Web | OAuth Login Code 교환·갱신·로그아웃 | 연동 | [Auth](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md) |
| GET | `/oauth2/authorization/{provider}` | Web | OAuth 로그인 시작 페이지 이동 | 연동 | [Auth](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md) |
| - | 공통 HTTP·오류 규약 | Web | `apps/web/src/api/client.js`: Bearer JWT, `credentials: include`, 401 1회 갱신 | 연동 | [API 인덱스](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/api-index.md) |

## Web — PUBLIC / USER

| Method | Endpoint | 화면/기능 | FE 상태 | BE 계약 |
| --- | --- | --- | --- | --- |
| GET | `/api/creators` | 홈·탐색·온보딩·마이페이지의 Creator 목록/프로필. 항목의 `openEventCount`(진행 중 이벤트 수)를 탐색의 "진행 중" 필터·칩·태그·정렬·순위에 쓰고, 없는 구버전 BE에서는 받아 온 이벤트 목록에서 센다 | 연동 | [Creator](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/api.md) |
| GET | `/api/creators/{id}/space`, `/api/creator-spaces/{slug}` | Creator Space·공유 링크. 응답의 `followerCount`를 프로필 팔로워 통계로 표시(0 포함, 값이 없으면 칸 숨김) | 연동 | [Creator Space](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/space-api.md) |
| GET | `/api/events/counts` | 탐색 이벤트 필터 칩 개수(`total`·`upcoming`·`inProgress`·`closed`). 엔드포인트가 없거나 응답이 다르면 상태별 `GET /api/events?size=1`로 대체 | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| GET | `/api/events`, `/api/events/{eventId}` | 홈·탐색·이벤트 상세 | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| POST | `/api/events/{eventId}/entries` | 이벤트 응모(멱등 키, `couponType`으로 크리에이터·공용 응모권 선택) | 연동 | [Entry](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/entry-api.md) |
| GET | `/api/events/{eventId}/entries/me` | 내 응모 조회 | 연동 | [Entry](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/entry-api.md) |
| GET | `/api/events/{eventId}/entry-status` | 이벤트 상세의 응모 현황 카드(참여자·누적 응모권·내가 응모한 수, `realtime`이면 "실시간"·아니면 "집계")와 홈 응모 티켓의 "N명 참여". 표시용이라 응모 판단에는 쓰지 않고, 예정 이벤트는 조회하지 않음 | 연동 | [Entry](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/entry-api.md) |
| GET | `/api/events/{eventId}/winners`, `/api/me/winners` | 이벤트 상세·내 당첨 | 연동 | [Winner](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/winner/api.md) |
| POST | `/api/me/winners/{winnerId}/decline` | 내 당첨 포기 | 연동 | [Winner](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/winner/api.md) |
| GET | `/api/winners/{winnerId}/history` | 내 당첨 상태 이력 | 연동 | [Winner](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/winner/api.md) |
| GET/PUT/DELETE | `/api/me/follows`, `/api/creators/{creatorId}/follow` | 팔로우 목록·등록·해제 | 연동 | [Follow](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/follow/api.md) |
| GET/PATCH | `/api/me/notifications`, `/api/me/notifications/{id}/read`, `/api/me/notifications/read`, `/api/me/notifications/{id}/hide` | 알림 목록·개별 읽음·전체 읽음·삭제(서버는 숨김 기록). `INITIAL_WINNER`·`REDRAW_WINNER`·`INITIAL_NON_WINNER`는 유형별 아이콘과 서버 제목·본문을 표시하고 공개 결과가 있는 해당 이벤트 상세로 이동한다. 헤더 배지는 첫 100건의 미확인 개수만 하한값으로 표시하며 알림 화면의 첫 페이지와 조회 결과를 공유한다. 정확한 전체 미확인 개수는 BE 조회 API가 필요하다. 제재 알림(`COMMENT_RESTRICTION_STARTED`·`RELEASED`)은 `event`·`drawing`이 null이라 이동 없이 읽음 처리만 하고, 본문의 UTC 시각은 앱 공통 시각 표기(브라우저 시간대)로 바꿔 표시. 카드를 왼쪽으로 밀어(터치·마우스) 드러난 "삭제"를 누르거나 카드 너비의 65% 이상 끝까지 밀고 놓으면 알림을 지우며(서버에는 `hide`로 숨김만 기록하고 행은 남긴다), 목록과 헤더 배지에서 먼저 빼고 실패하면 되돌린다. 지운 알림은 되돌릴 수 없다. 키보드로 삭제하는 수단은 없고 열린 카드는 Esc로 닫는다 | 연동 | [Notification](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/notification/api.md) |
| GET | `/api/creators/{creatorId}/tickets`, `/api/creators/{creatorId}/tickets/history` | 잔액·응모권 원장 | 연동 | [Ticket](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/ticket/api.md) |
| GET/POST | `/api/creators/{creatorId}/missions`, `/api/creators/{creatorId}/missions/{missionId}/complete` | Creator Space 미션 조회. 좋아요 미션은 서버가 게시물 좋아요를 확인해야 완료되므로 완료 API는 호출하지 않고 게시물 좋아요로 안내 | 연동 | [Mission](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/mission/api.md) |
| POST | `/api/creators/{creatorId}/missions/share/complete` | Creator Space 공유 보상. 공유 시트 완료 또는 링크 복사 뒤 호출하며 본인 Space·비로그인·이미 받은 경우는 호출하지 않는다. `DUPLICATE_MISSION`(409)은 승인 전 요청이 선점한 경우에도 나오므로 완료로 단정하지 않고 미션 목록을 다시 읽어 서버가 완료로 기록했을 때만 완료로 표시(아니면 "적립 확인 중"). 승인 불명 `requestId`는 회원·크리에이터별로 `localStorage`에 보존해 재시도 | 연동 | [Mission](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/mission/api.md) |
| GET/POST | `/api/creators/{creatorId}/youtube-channel`, `/api/creators/{creatorId}/missions/{missionId}/subscription-verifications`, `.../me/latest` | Creator Space의 YouTube 구독 인증 채널 안내·이미지 제출·비동기 상태 조회 | 연동 | [Subscription Verification](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/subscription-verification/api.md) |
| GET/POST | `/api/creators/{creatorId}/quizzes`, `/api/creators/{creatorId}/quizzes/{quizId}`, `/api/creators/{creatorId}/quizzes/{quizId}/attempts`, `.../my-attempt` | Creator Space Quiz 탭. 게시 Quiz 목록·상세는 공개, 답안 제출·채점 결과·내 응시 결과·응모권 지급 상태(`reward.paymentStatus`)는 로그인 | 연동 | [AI Quiz](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/api.md), [Fan Quiz 응시](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/attempt-api.md) |
| GET/POST | `/api/missions`, `/api/missions/{missionId}/complete` | 홈 공용 출석 미션 조회·완료 | 연동 | [Mission](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/mission/api.md) |
| GET/POST | `/api/me/welcome-quest`, `/api/me/welcome-quest/{step}/claim` | 신규 회원 홈: 웰컴 퀘스트 상태 조회와 단계(SIGNUP·FOLLOW·QUIZ)·출석 카드 웰컴 보너스(BONUS)의 공용 응모권 지급 | 연동 | [Welcome Quest](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/mission/welcome-quest.md) |
| GET | `/api/me/tickets` | 헤더 응모권 버튼·내 응모권 화면(공용 잔액, 팔로우한 크리에이터별 잔액·이름·프로필 이미지, 서버가 계산한 합계를 한 번에 조회. 표시용이며 응모 가능 여부의 근거가 아님) | 연동 | [Ticket](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/ticket/api.md) |
| GET | `/api/tickets/common/history` | 홈 출석 도장(최근 7일 출석 적립 기록) | 연동 | [Ticket](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/ticket/api.md) |
| GET | `/api/creators/{creatorId}/calendar/schedules` | Creator Space 공개 캘린더 | 연동 | [Calendar](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/calendar/api.md) |
| GET/PUT/DELETE | `/api/me/calendar/schedules`, `/api/me/calendar/schedules/{scheduleId}` | 내 캘린더 조회·담기·빼기 | 연동 | [Calendar](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/calendar/api.md) |
| GET | `/api/creators/{creatorId}/posts`, `/api/creators/{creatorId}/posts/{postId}` | Space 게시물 목록·상세 | 연동 | [Post](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/api.md) |
| GET/POST/PATCH/DELETE | `/api/creators/{creatorId}/posts/{postId}/comments`, `/api/creators/{creatorId}/posts/{postId}/comments/{commentId}/original` | 게시물 댓글 조회·작성·수정·삭제, 필터링된 댓글 원문 보기. 작성자 프로필 사진(`authorProfileImageUrl`)을 댓글 옆에 표시하고, 가려진 댓글의 `authorName` null은 "가려진 댓글"로 대체. 작성·수정이 `COMMENT_RESTRICTED`(플랫폼 제한)·`SPACE_COMMENT_BLOCKED`(스페이스 차단) 403이면 사유를 구분하고 해제 시각을 앱 공통 시각 표기(브라우저 시간대)로 안내(시각은 BE 메시지 문장에서 읽으므로 형식이 바뀌면 사유만 보임) | 연동 | [Comment](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/comment-api.md) |
| POST/DELETE | `/api/creators/{creatorId}/posts/{postId}/likes` | 게시물 좋아요·취소. 응답의 `liked`·`likeCount`를 목록·상세에 반영하고, `missionAwarded`가 true면 좋아요 미션 적립 안내와 잔액·미션 표시를 갱신. 게시물 목록·상세의 `likeCount`·`liked`·`commentCount`도 표시 | 연동 | [Post](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/api.md) |
| POST | `/api/creators/{creatorId}/posts/{postId}/comments/{commentId}/reports` | 게시물 댓글 신고 | 연동 | [Comment](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/comment-api.md) |
| POST/GET | `/api/creator/comment-blocks`, `/api/creator/comment-blocks/{sanctionId}/release` | Creator의 스페이스 댓글 차단·목록·해제. 댓글 머리글 "…" 메뉴에서 작성자를 1~365일 차단하고, 내 스페이스 "차단 관리" 탭에서 목록(차단 중인 회원만 보기)과 해제. 이미 차단 중이면 기존 차단의 종료 시각을 안내 | 연동 | [Sanction](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/sanction/api.md) |
| GET | `/api/interests`, `/api/me/interests` | 온보딩·탐색 분야 편집의 관심 분야 조회 | 연동 | [Interest](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/interest/api.md) |
| PUT | `/api/me/interests` | 온보딩·탐색 분야 편집의 관심 분야 저장(0~3개) | 연동 | [Interest](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/interest/api.md) |
| GET | `/api/me/creator-recommendations` | 온보딩·탐색 "나를 위한 추천"(AI 개인화, 20명을 받아 10명씩 노출), 응답의 `recommendationRequestId`를 노출·클릭 수집에 사용 | 연동 | [Creator](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/api.md) |
| POST | `/api/me/creator-recommendation-events` | 탐색 추천 카드의 노출(`IMPRESSION`, 화면에 절반 이상 보일 때)·클릭(`CLICK`) 수집. 행동마다 UUID `eventId`, 최대 50건 묶음, 5xx·네트워크 오류만 같은 `eventId`로 재시도 | 연동 | [Creator](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/recommendation-events.md) |
| GET | `/api/creators/{creatorId}/similar` | 탐색 "○○와 비슷한 크리에이터"(가장 최근 관심 등록한 크리에이터 기준, 후보가 없으면 숨김) | 연동 | [Creator](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/api.md) |
| POST | `/api/me/profile-images` | 프로필 편집의 사진 업로드(`imageKey` 반환). 크리에이터는 `CREATOR_PROFILE_MANAGED_IN_SPACE`(409)로 막혀 이 화면에서 호출하지 않는다 | 연동 | [Member](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/member/api.md) |
| PUT | `/api/me/profile` | 프로필 편집(닉네임 저장, 사진은 key를 보낼 때만 교체), `PROFILE_SETUP_REQUIRED`(409) 처리. 크리에이터는 `CREATOR_PROFILE_MANAGED_IN_SPACE`(409)로 막혀 프로필 편집 대신 스페이스 편집으로 안내한다 | 연동 | [Member](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/member/api.md) |
| PUT | `/api/me/onboarding/complete` | 온보딩 완료·건너뛰기 기록 | 연동 | [Auth](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/api-index.md) |

## Web — CREATOR

| Method | Endpoint | 화면/기능 | FE 상태 | BE 계약 |
| --- | --- | --- | --- | --- |
| POST/GET | `/api/creator/applications`, `/api/creator/applications/me` | Creator 전환 신청·내 신청 | 연동 | [Creator](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/api.md) |
| GET/PATCH | `/api/creator/space`, `/api/creator/space/slug` | 내 Space 편집·slug 변경. 프로필 사진은 `profileImageKey`, 배너는 `bannerImageKey`로 교체·유지(생략)·기본 이미지·기본 배너 복귀(`null`) | 연동 | [Creator Space](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/space-api.md) |
| POST | `/api/creator/space/profile-images` | 스페이스 프로필 사진 업로드(`imageKey` 반환, 스페이스 편집) | 연동 | [Creator Space](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/space-api.md) |
| POST | `/api/creator/space/banner-images` | 스페이스 배너 이미지 업로드(`imageKey` 반환, 스페이스 편집). 연결은 PATCH의 `bannerImageKey`로 하므로 `PUT /api/creator/space/banner-image`는 쓰지 않음 | 연동 | [Creator Space](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/space-api.md) |
| GET/PUT | `/api/creator/profile` | Creator 활동명 조회·설정·변경(스페이스 편집). 14일 변경 제한·이전 활동명 복귀, `ACTIVITY_NAME_SETUP_REQUIRED`(409): 활동명을 정하기 전에는 댓글·응모·게시글·이벤트를 막으므로 이 코드를 받으면 스페이스 편집(활동명)으로 안내하고, 마이페이지는 "활동명을 설정해주세요" 배너를 보여 준다 | 연동 | [Creator Space](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/space-api.md) |
| GET/PUT | `/api/creator/youtube-channel` | Space의 YouTube 구독 인증 대상 채널 최초 설정·수정 | 연동 | [Subscription Verification](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/subscription-verification/api.md) |
| GET/POST/PATCH/DELETE | `/api/creator/events`, `/api/creator/events/{eventId}` | Creator 이벤트 CRUD(스페이스 이벤트 탭) | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| POST | `/api/creator/events/{eventId}/approval-request` | 이벤트 승인 요청 | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| POST | `/api/events/{eventId}/close` | 이벤트 수동 마감 | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| POST/PATCH/DELETE | `/api/creator/calendar/schedules`, `/api/creator/calendar/schedules/{scheduleId}` | Creator 일정 관리(스페이스 캘린더 탭). 목록은 공개 조회를 쓰고 `GET /api/creator/calendar/schedules`는 쓰지 않는다 | 연동 | [Calendar](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/calendar/api.md) |
| POST | `/api/creator/posts/images` | 게시물 이미지 업로드 | 연동 | [Post](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/api.md) |
| POST/PATCH/DELETE | `/api/creator/posts`, `/api/creator/posts/{postId}` | 게시물 작성·수정·삭제 | 연동 | [Post](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/api.md) |
| GET/POST | `/api/creator/quizzes`, `/api/creator/quizzes/{quizId}`, `.../revisions/{revisionId}`, `.../approve`, `.../reject`, `/api/creator/quizzes/{quizId}/publish`, `.../unpublish` | 내 스페이스 Quiz 탭: 내 Quiz 목록·상세, revision 검토(정답·해설·근거), 승인(Judge ALL_PASS일 때만)·반려, 게시·게시 중지. 개발용 더미 API로만 확인했고 실제 BE에서는 미검증 | 연동 | [AI Quiz](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/api.md) |
| POST/GET | `/api/creator/quizzes/generations`, `/api/creator/quizzes/generations/{generationId}` | 내 스페이스 Quiz 탭의 AI Quiz 생성 요청·상태 조회. requestId·generationId를 Creator별로 브라우저에 저장해 새로고침 뒤 복구, 응답 불확실 재시도는 같은 requestId. 실제 BE 미검증(dev 생성 기능 기본 OFF) | 연동 | [AI Quiz](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/api.md) |
| GET | `/api/creator/quizzes/generations/current` | 저장 작업이 없을 때 복구, 원문·facts 검토. 실제 BE 통합 검증 미실시 | 연동 | [원문 검토](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/content-review-api.md) |
| POST | `/api/creator/quizzes/generations/{generationId}/content-confirmation` | 원문 확정·문항 생성 재개. 실제 BE 통합 검증 미실시 | 연동 | [원문 검토](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/content-review-api.md) |
| POST | `/api/creator/quizzes/generations/{generationId}/cancel` | 검토 대기 작업 취소. 실제 BE 통합 검증 미실시 | 연동 | [원문 검토](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/content-review-api.md) |
| POST/GET | `/api/creator/quizzes/{quizId}/revisions/{revisionId}/judge-evaluations`, `.../judge-evaluations/{evaluationId}` | 내 스페이스 Quiz 탭의 GPT Judge 평가 요청·조회(문항별 7개 항목·집계). requestId·evaluationId를 브라우저에 저장해 복구하며, 저장값이 없는 기기에서는 이전 평가를 볼 수 없다(BE에 revision별 최근 평가 조회 없음). 실제 BE 미검증(dev Judge 기능 기본 OFF) | 연동 | [Judge](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/judge-api.md) |
| POST | `/api/creator/quizzes/{quizId}/close` | Creator 수동 마감 확인 모달·상태 재조회·CLOSED 읽기 전용. 팬 마감 제출 안내와 기존 결과 복구 유지. Mock/컴포넌트 검증, 실제 dev 변경 API 미검증 | 연동 | [AI Quiz](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/api.md) |
| POST | `/api/creator/quizzes/{quizId}/revisions` | Creator 문항 선택·편집·추가와 새 Revision 저장. 별도 UUID·본문 기록으로 응답 유실·탭 경쟁 복구. 실제 BE 미검증 | 연동 | [문항 구성·책임 승인](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/composition-api.md) |
| POST | `/api/creator/quizzes/{quizId}/revisions/{revisionId}/creator-approval` | 서버에 저장한 최종 hash를 명시적으로 책임 승인. 기존 Judge 승인과 분리, 게시 요청은 별도. 실제 BE 미검증 | 연동 | [문항 구성·책임 승인](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/quiz/composition-api.md) |

## Admin — ADMIN

| Method | Endpoint | 화면/기능 | FE 상태 | BE 계약 |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/admin/login` | 관리자 ID/PW 로그인, ADMIN JWT·`admin_refresh_token` Cookie 발급 | 연동 | [Auth](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md) |
| POST | `/api/admin/auth/refresh`, `/api/admin/auth/logout` | `admin_refresh_token` Cookie 갱신·로그아웃 | 연동 | [Auth](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/auth/api.md) |
| - | 공통 HTTP·오류 규약 | `apps/admin/src/api/client.js`: Admin Bearer JWT·`credentials: include`, 401 관리자 refresh 후 1회 재시도, 실패 시 Admin 세션 제거, 403은 권한 오류 | 연동 | [API 인덱스](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/api-index.md) |
| GET/POST | `/api/admin/events/pending`, `/api/admin/events/{eventId}/approve`, `/reject` | 이벤트 승인·반려 | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| GET/PATCH/POST | `/api/admin/events?archiveStatus=...`, `/api/admin/events/{eventId}/archive`, `/unarchive`, `/api/events/{eventId}/close` | 운영·보관함 Event 조회, 결과 공개 Event 보관·복원, 수동 마감 | 연동 | [Event](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/event/api.md) |
| GET/POST | `/api/admin/creator-applications`, `/api/admin/creator-applications/{id}/approve`, `/reject` | Creator 신청 승인·반려 | 연동 | [Creator](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/api.md) |
| GET | `/api/admin/events/{eventId}/closing-status`, `/snapshot` | 마감·스냅샷 확인 | 연동 | [Drawing Admin Query](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/drawing/admin-query-api.md) |
| POST/GET | `/api/admin/events/{eventId}/drawings`, `/api/admin/drawings/{drawingId}`, `/result`, `/publish`, `/retry` | 초기 추첨·실패 추첨 재시도·결과 확인·공개 | 연동 | [Drawing](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/drawing/api.md) |
| POST/GET | `/api/admin/drawings/{drawingId}/verify`, `/verification-history` | 추첨 검증·이력 | 연동 | [Verification](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/drawing/verification-api.md) |
| POST/GET | `/api/admin/winners/{winnerId}/receive`, `/disqualify`, `/api/winners/{winnerId}/history` | 당첨자 수령·자격·이력 | 연동 | [Winner](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/winner/api.md) |
| GET/POST | `/api/admin/events/{eventId}/redraw-requests`, `/api/admin/redraw-requests`, `/{id}`, `/{id}/approve`, `/{id}/reject`, `/{id}/execute` | 재추첨 요청 생성·목록·상세·심사·실행 | 연동 | [Redraw](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/redraw/api.md) |
| GET/POST | `/api/admin/dead-streams`, `/api/admin/dead-streams/{id}/replay` | Dead Stream 조회·replay | 연동 | [Stream](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/stream/api.md) |
| GET | `/api/admin/subscription-verifications/{verificationId}/image-reuse` | Verification ID 기준 구독 인증 이미지 재사용 탐지 결과 조회 | 연동 | [Subscription Verification](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/subscription-verification/api.md) |
| GET | `/api/admin/tickets/balance`, `/api/admin/tickets/history` | 회원별 Creator 전용·공용 응모권 잔액 비교와 cursor 더보기 이력 조회. 이력의 이벤트·미션·요청 ID와 사유를 표시하고, Redis 키 미존재와 `REDIS_BALANCE_QUERY_FAILED` 조회 장애를 구분 | 연동 | [Ticket](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/ticket/api.md) |
| POST | `/api/admin/tickets/resync`, `/api/admin/tickets/common/resync` | Creator 전용·공용 응모권의 DB 기준 수동 재동기화 | 연동 | [Ticket](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/ticket/api.md) |
| GET/POST/PATCH | `/api/admin/creator-space-templates`, `/{templateId}`, `/{templateId}/activate` | Creator Space 템플릿 목록·추가·수정·활성화 | 연동 | [Creator Space Template](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/space-template-api.md) |
| POST | `/api/admin/creator-space-templates/profile-images`, `/banner-images` | 템플릿 기본 프로필·배너 이미지 파일 업로드(multipart `image`) → `{imageUrl}`. 템플릿 편집 화면이 응답 URL을 추가·수정 요청에 넣어 저장한다 | 연동 | [Creator Space Template](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/creator/space-template-api.md) |
| GET/POST | `/api/admin/comment-reports`, `/api/admin/comment-reports/{commentId}/hide`, `/reject` | 신고된 댓글 목록(처리 상태 필터)·숨김·신고 반려 | 연동 | [Post Comment](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/comment-api.md) |
| DELETE | `/api/admin/comments/{commentId}` | 관리자 앱의 신고된 댓글 목록과 Web 게시글 댓글창에서 댓글 삭제(물리 삭제, 되돌릴 수 없음, 경고·알림 없음). Web은 게시글 주인이 아닌 관리자가 남의 댓글을 삭제할 때만 쓴다 | 연동 | [Post Comment](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/post/comment-api.md) |
| POST/GET | `/api/admin/sanctions`, `/api/admin/sanctions/{sanctionId}/release` | 플랫폼 제한(모든 스페이스에서 댓글 작성·수정 제한) 생성·목록·해제. 관리자 앱의 신고 관리에서 "작성자 제재 > 모든 스페이스"로 기간·사유(필수)와 함께 걸고, 제재 관리의 "플랫폼 제한" 탭에서 수동 제한과 이전 정책(#643 이전)의 자동 경고를 보고 해제. 관리자·크리에이터 대상은 `CANNOT_BLOCK_ADMIN`·`CANNOT_SANCTION_CREATOR`로 안내. 자동 경고는 해제해도 경고 횟수에 남고 스페이스 차단은 이 API로 해제할 수 없다 | 연동 | [Sanction](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/sanction/api.md) |
| POST/GET | `/api/admin/comment-blocks`, `/api/admin/comment-blocks/{sanctionId}/release` | 스페이스 댓글 차단 생성(관리자 앱의 신고된 댓글 행, Web 댓글창의 "…" 메뉴)·목록(크리에이터·회원 필터, 차단 중만 보기)·해제. Web은 게시글 주인이 아닌 관리자일 때 `creatorId`를 게시글의 크리에이터로 채워 호출한다 | 연동 | [Sanction](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/sanction/api.md) |
| GET/PATCH | `/api/admin/abuse-detections`, `/api/admin/abuse-detections/{id}`, `/api/admin/abuse-detections/{id}/review` | Detection 목록·Evidence 상세·관리자 검토 | 연동 | [Abuse Detection](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/abuse-detection/api.md) |

## 미연동 또는 확인이 필요한 BE 기능

현재 UI/API 모듈에서 사용하지 않는 API를 새로 연동할 때는 먼저 API 인덱스에서 역할과 계약 문서를 확인하고, 해당 행을 이 문서에 추가한다. Ticket/Lua 내부 처리 API처럼 화면에서 직접 호출하지 않는 내부 API는 연동 대상으로 보지 않는다.

Issue #200 원문 검토 흐름은 로컬 Mock·브라우저 테스트로 검증한다. Mock 생성 제목에 `[원문검토]`를 넣으면 검토 대기·확정·취소를, `[원문검토][확정꺼짐]`은 확정 503과 취소를 확인할 수 있다. 실제 BE 환경 통합 검증은 아직 수행하지 않았다.
