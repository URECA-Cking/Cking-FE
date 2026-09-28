# Cking-FE

Cking 팬덤 래플 서비스의 프론트엔드(웹앱)입니다. React + Vite + Tailwind CSS로 만들었고,
화면 구성은 `stitch/` 시안(Fandom Editorial Luxe 디자인 시스템)을 따릅니다.
표시되는 값은 별도로 표기한 항목을 빼고 모두 백엔드(`Cking-BE`)의 실제 응답입니다.

## 실행

```bash
npm install
npm run dev
```

- 개발 서버: http://localhost:5173
- `/api` 요청은 vite 프록시가 백엔드로 전달합니다(기본 `http://localhost:8080`).
  같은 출처 요청이 되어 Refresh Cookie(`Path=/api/auth`)도 그대로 오갑니다.
- 로그인(OAuth)은 API 호출이 아니라 백엔드 주소로의 페이지 이동이라 프록시를 거치지 않습니다.
  로컬 백엔드는 `local,oauth` 프로필과 `JWT_SECRET`, OAuth Client 환경변수로 실행해야 합니다(`Cking-BE` README 참고).
- 환경변수는 `.env.example`을 복사해 `.env`로 사용하세요.

| 변수 | 설명 |
| --- | --- |
| `VITE_API_PROXY_TARGET` | 개발 서버가 `/api`를 전달할 백엔드 주소 (기본 `http://localhost:8080`). `VITE_API_BASE_URL`이 비어 있으면 OAuth 로그인도 이 주소로 이동 |
| `VITE_API_BASE_URL` | API 기준 주소. 비우면 같은 출처로 요청(프록시 사용). 값이 있으면 OAuth 로그인도 이 주소로 이동 |
| `VITE_DEMO_CREATOR_IDS` | 이벤트가 없을 때 탐색 기준이 되는 크리에이터 ID (기본 `1,2,3`) |

백엔드는 더미 데이터 시더(`local` + `seed` 프로필)로 사용자 15명과 크리에이터 3명을 만듭니다.

## 웹앱(PWA)

- `public/manifest.webmanifest` — standalone 실행, 브랜드 테마 색상, 바로가기(내 응모/알림)
- `public/sw.js` — 앱 셸은 stale-while-revalidate, `/api`는 네트워크 우선(오프라인일 때만 마지막 성공 응답). Access JWT가 붙은 요청은 캐시하지 않음
- 홈 화면 설치 배너(`InstallBanner`)와 오프라인 안내 배너 제공
- 아이콘은 `node scripts/generate-icons.mjs`로 다시 생성할 수 있습니다(추가 의존성 없음)

서비스 워커는 프로덕션 빌드에서만 등록됩니다. 설치 동작을 확인하려면 `npm run build && npm run preview`.

## 화면과 연동된 API

| 화면 | 경로 | 사용하는 백엔드 API |
| --- | --- | --- |
| 로그인 | `/login` | `GET /oauth2/authorization/{google\|kakao}` (페이지 이동) |
| 로그인 콜백 | `/oauth/callback` | `POST /api/auth/token`, `GET /api/me`, (크리에이터로 시작 시) `POST /api/creator/applications` |
| 관심 크리에이터 선택 | `/onboarding/creators` | `GET /api/events`, `GET /api/creators/{id}/tickets` |
| 홈 | `/` | `GET /api/events`, `GET /api/creators/{id}/tickets`, `GET /api/me/notifications` |
| 탐색 | `/explore` | `GET /api/events` (표시 상태 필터), `GET /api/creators/{id}/tickets` |
| 크리에이터 스페이스 | `/creators/:creatorId`, `/space/:slug` | `GET /api/creators/{id}/space`, `GET /api/creator-spaces/{slug}`, (본인) `GET·PATCH /api/creator/space`, `PATCH /api/creator/space/slug`, `GET /api/events?creatorId=`, `GET /api/creators/{id}/tickets`, `.../tickets/history`, `GET·POST .../missions`, `GET /api/creators/{id}/calendar/schedules` |
| 이벤트 상세 · 응모 | `/events/:eventId` | `GET /api/events/{id}`, `POST /api/events/{id}/entries`, `GET /api/events/{id}/winners` |
| 내 응모 | `/my-entries` | `GET /api/creators/{id}/tickets/history`, `GET /api/events/{id}/winners` |
| 알림 | `/notifications` | `GET /api/me/notifications`, `PATCH /api/me/notifications/{id}/read` |
| 마이페이지 | `/my-page` | `GET /api/creators/{id}/tickets`, `GET /api/creator/applications/me`, `POST /api/creator/applications` |
| 크리에이터 스튜디오 | `/studio` | `GET /api/creator/events`, `DELETE /api/creator/events/{id}`, `POST .../approval-request`, `POST /api/events/{id}/close` |
| 이벤트 작성 | `/studio/events/new` | `POST /api/creator/events` |
| 이벤트 수정 | `/studio/events/:eventId/edit` | `GET /api/creator/events`, `PATCH /api/creator/events/{id}` |
| 관리자 콘솔 | `/admin` | `GET /api/admin/events/pending`, `POST .../approve·reject`, `GET /api/admin/creator-applications`, `POST .../approve·reject`, `GET .../closing-status`, `GET .../snapshot`, `POST .../drawings`, `GET /api/admin/drawings/{id}`, `GET .../result` |

최신 백엔드 API 인덱스와의 대조 결과, 화면·API별 연동 상태와 역할별 흐름은
[`docs/api-coverage.md`](docs/api-coverage.md)에서 관리한다.

### 로그인과 권한

Google·Kakao OAuth로 로그인하고 Access JWT로 호출자를 식별합니다(`Cking-BE` `docs/domains/auth/api.md`).
요청에 `userId`를 보내지 않습니다.

1. 로그인 화면에서 `/oauth2/authorization/{provider}`로 이동합니다. "크리에이터로 시작"과 돌아갈 화면은 `sessionStorage`에 잠시 맡겨 둡니다.
2. 백엔드가 `/oauth/callback?code=...`(실패 시 `?error=...`)로 돌려보내면, Login Code를 `POST /api/auth/token`으로 Access JWT와 교환합니다.
3. Access JWT는 `sessionStorage`에 두고 모든 요청에 `Authorization: Bearer`로 붙입니다(`credentials: 'include'`).
4. 401을 받으면 `POST /api/auth/refresh`(HttpOnly Refresh Cookie)로 한 번 갱신 후 재시도하고, 실패하면 로그인 화면으로 보냅니다. 동시에 여러 요청이 401을 받아도 갱신은 한 번만 합니다.
5. 새로고침·새 탭에서는 Refresh Cookie로 조용히 재발급해 로그인을 유지합니다. 로그아웃은 `POST /api/auth/logout`입니다.

사용자 정보와 권한은 `GET /api/me` 응답을 그대로 씁니다.

- 크리에이터: `creator`
- 관리자: `role === 'ADMIN'`

### 응모 처리

응모는 `POST /api/events/{eventId}/entries`에 UUID 멱등키(`requestId`)를 함께 보냅니다.
같은 응모 시도에서 재시도할 때는 같은 `requestId`를 유지해 중복 차감이 생기지 않게 하고,
백엔드가 돌려주는 결과 코드 10종(`SUCCESS`, `DUPLICATE_REPLAY`, `INSUFFICIENT_BALANCE`,
`EVENT_NOT_OPEN`, `EVENT_CLOSED`, `INVALID_TICKET_COUNT`, `IDEMPOTENCY_CONFLICT`,
`GATE_NOT_LOADED`, `BALANCE_NOT_LOADED`, `SYSTEM_ERROR`)을 각각의 문구로 안내합니다.

## 백엔드 API는 있으나 아직 프론트에 연동하지 않은 부분

| 항목 | 상황 | 프론트엔드 처리 |
| --- | --- | --- |
| 크리에이터 프로필 | `GET /api/creators`, `GET /api/creators/{id}`는 백엔드 API 인덱스에만 있고 아직 구현되지 않음. Space 조회(`GET /api/creators/{id}/space`)는 제공됨 | 이벤트 목록의 `creatorId`로 디렉터리를 만들고, 이름·카테고리·이미지는 `src/data/creatorProfiles.js`에서 생성 |
| 내 응모 목록 | `GET /api/events/{id}/entries/me` 제공됨 | 아직 응모권 원장의 `SPEND` + `eventId` 기록을 이벤트 단위로 모아 재구성 |
| 출석·좋아요 미션 | 조회·완료 API 제공됨 | 화면에는 남기되 아직 프론트 연동 전이라 "준비 중"으로 표시 |
| 게시물 피드 | 피드 API 없음 | 홈 피드는 샘플 게시물(`src/data/posts.js`), 크리에이터 스페이스 게시물 탭은 빈 상태로 표시 |
| 누적 응모 건수 | 공개 API가 제공하지 않음 | 대신 당첨 인원·상품 구성 등 실제 값이 있는 항목을 노출 |
| 결과 공개(PUBLISHED 전환) | 관리자 공개 API 제공됨 | 관리자 콘솔에 아직 공개 기능이 없어 결과 공개 API를 연동해야 함 |

## 구조

```
src/
  api/        백엔드 엔드포인트별 호출 모듈 (+ creators/myEntries 같은 조합 조회)
  components/ 레이아웃·카드·시트 등 공용 UI
  context/    로그인 세션(UserContext), 토스트
  data/       크리에이터 표시용 프로필, 샘플 게시물, 이미지 헬퍼
  hooks/      useAsync(조회 공통), useOnline
  pages/      화면 (studio/, admin/ 하위 포함)
  pwa/        서비스 워커 등록, 설치 프롬프트
  utils/      날짜·숫자 포맷, 상태 매핑
```

## 검사

```bash
npm run lint
npm run build
```
