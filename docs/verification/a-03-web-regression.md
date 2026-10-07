# A-03 Web 모노레포 전환 회귀 검증 (#59)

2026-10-07, `develop`의 A-02 반영 커밋 `7a4bfe6`에서 분기해 확인했다. 이 문서는 검증한 사실과 로컬 환경 부재로 확인하지 못한 항목을 구분한다.

## 실행·환경 설정

| 항목 | 확인 결과 |
| --- | --- |
| `npm ci --offline` | 성공. lockfile에 맞는 workspace 의존성 설치 |
| `npm run lint` | 성공. shared, Web, Admin 검사 |
| `npm run test:shared` | 6개 통과 |
| `npm run build:web` | 성공 |
| `npm run build` | 성공. Web, Admin 모두 빌드 |
| `npm run dev:web` | 5173에서 `/` 200 응답 |
| `/api` 개발 프록시 | `VITE_API_PROXY_TARGET=http://127.0.0.1:18080`으로 임시 테스트 서버를 지정한 뒤 `/api/a03-proxy-check` 요청이 해당 서버에 전달되어 200 응답 |

로컬 기본값은 `VITE_API_BASE_URL` 빈 값, `VITE_API_PROXY_TARGET=http://localhost:8080`, `VITE_ADMIN_BASE_URL=http://localhost:5174`이다. Web의 일반 API 요청은 같은 출처 `/api`를 쓰며, OAuth 시작은 페이지 이동이라 프록시가 아닌 백엔드 주소로 직접 이동한다. `develop` 배포 빌드에서는 CI가 `VITE_API_BASE_URL=https://dev-api.cking.co.kr`과 `VITE_ADMIN_BASE_URL=https://dev-admin.cking.co.kr`을 주입한다.

배포 URL을 주입해 별도로 Web을 빌드했을 때 두 주소가 번들에 포함되고 `localhost:5174`는 포함되지 않음을 확인했다. URL을 주입하지 않은 프로덕션 빌드는 이동 가능한 Admin 링크를 노출하지 않고 `서비스 준비 중` 비활성 항목을 표시하는 현재 코드 경계를 유지한다.

## Web/Admin 경계

- `apps/web/src/App.jsx`에 `/admin` 라우트와 Admin 페이지 import가 없다.
- `apps/web/src/`에 Admin 페이지·전용 API 파일이 없다. `UserContext`는 Web 전용으로 남아 있다.
- Web 프로덕션 번들에서 `AdminConsole`, `/admin/redraws`가 발견되지 않았다.
- Web 마이페이지의 Admin 진입은 `VITE_ADMIN_BASE_URL`이 있을 때 별도 origin 링크로만 제공된다. 로컬 개발 기본값은 5174이고, 값 없는 프로덕션 빌드에서 localhost로 대체하지 않는다.

## 실계정 인증 검증 범위

코드 경로는 `Google/Kakao OAuth 시작 → /oauth/callback → POST /api/auth/token → GET /api/me`이며, 새로고침은 `POST /api/auth/refresh`, 로그아웃은 `POST /api/auth/logout`으로 이어진다. 이번 로컬 확인 시 8080 백엔드가 기동하지 않았고 Web용 로컬 `.env`도 없어, Provider 로그인 화면·실제 Login Code 교환·Refresh Cookie 회전·로그아웃까지의 실계정 E2E는 **미검증**이다. 프록시 테스트 서버의 200 응답을 인증 성공으로 간주하지 않는다.

실계정 E2E는 로컬 BE의 `local,oauth` 프로필과 Google/Kakao Client 설정, DB/Redis를 준비한 뒤 Web 5173에서 각 Provider 로그인, `/api/me`, 새로고침 후 세션 복원, 로그아웃 후 `/api/me` 인증 거부를 각각 확인해야 한다. 인증 설정값이나 토큰을 문서·커밋에 기록하지 않는다.
