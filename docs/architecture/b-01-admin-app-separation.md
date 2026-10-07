# B-01 관리자 앱 분리 설계

## 목적과 완료 상태

관리자 화면을 `apps/web`에서 제거하고 `apps/admin`이 독립적으로 실행·배포 가능한 앱이 되게 한다. 두 앱은 서로 import하지 않으며, 실제로 공통인 코드만 `packages/shared`를 통해 사용한다.

```text
apps/web   ─┐
            ├── packages/shared
apps/admin ─┘
```

Admin은 `/admin`, `/admin/winners/:winnerId`, `/admin/redraws`, `/admin/dead-streams`를 계속 제공한다. Admin 도메인의 `/`는 `/admin`으로 redirect한다.

## 의존성 조사와 소유 결정

| 기존 Web 의존성 | Admin에서의 처리 | 근거 |
| --- | --- | --- |
| `pages/admin/**`, `api/admin.js` | `apps/admin`으로 이동 | 관리자 도메인 전용 코드다. |
| `api/events.js`의 `getEvents` | Admin API 모듈에 `getClosedEvents`로 명시 구현 | 사용자 이벤트 API 전체를 가져오지 않고 추첨 운영에 필요한 마감 이벤트 조회만 둔다. |
| `useCreatorCatalog`, `api/creators.js` | Admin에서 제거 | 카드에 필요한 `creatorName`은 관리자 이벤트 응답을 사용한다. Creator·follow 상태를 조회하지 않는다. |
| `UserContext`, `RequireUser`, `RequireRole`, OAuth 콜백 | Admin 전용 세션/가드/로그인 화면으로 교체 | 관리자 refresh cookie와 endpoint가 사용자 Web 세션과 분리되어 있다. |
| `Toast`, `useAsync`, `MaterialIcon`, `States`, format/status utility | `packages/shared`로 승격 | 앱 정책 없이 동일하게 재사용하는 UI·비동기·표시 코드다. |
| `TopHeader` | Admin 내부 컴포넌트로 이동 | Web의 내비게이션·사용자 화면 구조에 결합되어 있다. |
| `index.css`, Tailwind theme | Admin에 독립 복사 | 동일한 시각 토큰을 쓰지만 빌드 설정과 앱 진입점은 독립적이어야 한다. |

## 인증·권한 경계

백엔드 Auth API 정본을 따른다.

1. Admin 로그인 화면은 `POST /api/auth/admin/login`에 `loginId`, `password`를 보낸다.
2. Access JWT는 Admin의 `sessionStorage` 키에만 저장한다.
3. 401이 오면 `POST /api/admin/auth/refresh`를 한 번만 호출한다. `admin_refresh_token` Cookie는 관리자 Origin에서만 사용한다.
4. 세션 복원과 로그인 직후 `GET /api/me`을 호출해 `role === 'ADMIN'`을 확인한다. 다른 역할이면 Admin 세션을 로그아웃 처리한다.
5. 실패 시 `/login`으로 이동한다. URL에 Access Token을 넣거나 Web의 `refresh_token`을 사용하지 않는다.

## 구현 순서

1. Admin workspace, 환경변수 예시, 개발 서버 프록시와 루트 명령을 추가한다.
2. 순수 공통 코드와 Admin 전용 공통 UI를 분리한다.
3. Admin 전용 HTTP 클라이언트·세션·로그인·권한 가드를 만든다.
4. 관리자 페이지와 API를 옮기고, `AdminDrawingPanel`의 사용자 이벤트/Creator catalog 의존성을 제거한다.
5. Web의 관리자 route·원본 코드·전용 API를 제거하고 MyPage 진입점을 `VITE_ADMIN_BASE_URL`로 변경한다.
6. CI, 현재 구조 문서, API 사용 현황을 실제 구현과 일치하도록 갱신한다.

## 검증 계획

- `npm run lint:web`, `npm run build:web`, `npm run lint:admin`, `npm run build:admin`, `npm run build`
- Web `5173`과 Admin `5174`를 동시에 실행한다.
- Admin에서 직접 URL 접근·새로고침, 관리자 로그인/권한 거부, 관리자 API 호출을 확인한다.
- `rg`로 `apps/admin → apps/web`, `apps/web → apps/admin` import가 없는지 확인한다.
- Web 빌드 산출물에 관리자 페이지 경로·식별자가 남지 않는지 확인한다.
