# B-02 관리자 인증·세션 통합 검증 설계

## 목적

`apps/admin`이 사용자 Web 앱과 독립된 관리자 인증 경계를 유지하면서, 현재 Cking-BE `develop`의 관리자 로그인·갱신·로그아웃 계약을 일관되게 사용하게 한다.

## 현재 문제와 범위

- 관리자 전용 API client와 sessionStorage 키는 이미 분리되어 있다.
- 로그인·세션 복원 후 `GET /api/me`의 `role === 'ADMIN'` 확인은 세션 Context가 담당한다.
- 세션 검증 실패는 관리자 Access Token을 즉시 제거하고 익명 상태로 전환해야 한다.
- 관리자 전용 token 저장소는 명시적으로 `sessionStorage`를 사용해야 하며, 만료된 토큰도 복원 시 제거해야 한다.

이 작업은 Admin 인증 경계만 다룬다. Web OAuth, 사용자용 refresh/logout endpoint, 관리자 운영 API 화면은 변경하지 않는다.

## 설계 결정

| 관심사 | 결정 | 이유 |
| --- | --- | --- |
| 토큰 저장 | Admin 전용 키 `cking.admin.accessToken`을 `sessionStorage`에만 저장 | 탭 단위 관리자 세션과 Web 사용자 세션의 저장 영역을 분리한다. |
| 로그인 | 로그인 응답의 Access Token 저장 뒤 즉시 `/api/me`로 역할 검증 | JWT 발급만으로 화면 진입을 허용하지 않는다. |
| 세션 복원 | 유효 Access Token이 있으면 `/api/me`, 없으면 관리자 refresh 후 `/api/me` | 새 탭·새로고침에서도 `admin_refresh_token`만 사용한다. |
| 401 | 공유 중인 refresh Promise로 관리자 refresh를 한 번 수행한 뒤 원 요청을 한 번 재시도 | 동시 401의 중복 갱신과 재시도 루프를 막는다. |
| 403 | refresh하지 않고 `FORBIDDEN`으로 전달 | 권한 부족은 토큰 만료가 아니다. |
| 세션 검증 실패 | 먼저 로컬 관리자 Access Token을 제거하고 익명 상태로 전환 | `/api/me` 실패·비관리자 역할에서 관리자 접근을 즉시 차단한다. |
| 로그아웃 | `credentials: 'include'` logout을 시도하고 결과와 무관하게 로컬 토큰을 제거 | BE refresh token 폐기 실패가 FE 세션 종료를 막지 않는다. |

## 검증 시나리오

1. 관리자 ID/PW 로그인 → Access Token 저장 → `/api/me`에서 `ADMIN` 확인 → `/admin` 진입
2. 새로고침 또는 새 탭 → 관리자 refresh → `/api/me` → 관리자 화면 복원
3. 관리자 API 401 → `/api/admin/auth/refresh` 1회 → 원 요청 1회 재시도
4. 관리자 API 403 → refresh 없이 권한 오류 표시
5. `/api/me`이 비관리자 역할 또는 실패 → Admin 토큰 제거 → `/login` 이동
6. 로그아웃 → `/api/admin/auth/logout` 호출 여부와 무관하게 Admin 토큰 제거

계약의 요청·응답 세부 정의는 FE 문서가 복제하지 않고 Cking-BE `develop` Auth API를 정본으로 참조한다.
