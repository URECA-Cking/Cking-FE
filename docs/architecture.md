# FE 아키텍처와 앱 경계

## 현재 구조

현재 Cking-FE는 `apps/web`과 `apps/admin`을 각각 실행하는 React + Vite npm workspace다. Web은 사용자·Creator 화면만, Admin은 관리자 화면과 `/api/admin/**` 호출을 소유한다. 실제 공통 로직은 `packages/shared`가 제공한다.

```text
apps/
├── web/                 # 사용자·Creator 화면
└── admin/               # 관리자 화면
    └── src/
packages/shared/         # 두 앱이 사용하는 앱 독립적인 공통 모듈
```

루트 명령은 `dev:web`, `dev:admin`, `build:web`, `build:admin`, `lint:shared`, `lint:web`, `lint:admin`을 제공한다. `build`는 두 앱을, `lint`는 shared와 두 앱을 모두 검사한다.

```text
web ─┐
     ├──> shared
admin┘
```

`admin → web`와 `web → admin` 의존은 금지한다. 각 앱은 자신의 페이지·라우팅·상태·도메인 조합 로직을 소유한다.

## 책임

| 경계 | 소유하는 것 | 소유하지 않는 것 |
| --- | --- | --- |
| `apps/web` | 일반 사용자·Creator 화면, PUBLIC/USER/CREATOR API, Web 라우트, Web 전용 상태 | Admin 페이지·관리자 전용 상태 |
| `apps/admin` | 관리자 화면, `/api/admin/**`, 관리자 라우트·권한·운영 상태 | Web 페이지·사용자/Creator 전용 상태 |
| `packages/shared` | 실제 양쪽에서 쓰는 순수 UI, API base client, 공통 HTTP 오류 처리, 범용 유틸, 실제 공통 타입 | Web/Admin 페이지, 특정 앱 Context·상태, 특정 앱 비즈니스 로직 |

## shared 승격 기준

두 앱이 같은 기능을 필요로 하고 앱별 정책 없이 재사용 가능한 경우에만 shared로 옮긴다. 한 앱에서만 사용하는 코드는 재사용 가능성만으로 옮기지 않는다. 인증·권한 정책과 도메인별 화면 조합은 각 앱에 둔다.

현재 shared에는 HTTP 응답 봉투 전송과 `ApiError`, 앱별 storage key를 주입하는 Access Token 저장소, MaterialIcon, 공통 날짜·숫자 포맷터, 앱별 오류 문구 함수를 주입하는 `useAsync`, Web 프로필·배너·게시글·인증 이미지가 쓰는 JPEG/PNG 판정·해상도 검증(`imageValidation`, Admin 템플릿 이미지 업로드가 함께 쓰던 것으로 Cking-BE #754 이후 Web만 쓴다)이 있다. `useAsync`는 화면 표시용 `error` 문자열과 도메인별 오류 분기에 쓸 원본 `errorObject`를 함께 제공한다. `cacheKey`를 주면 같은 키의 마지막 성공 결과를 로딩 표시 없이 먼저 보여 주고 뒤에서 다시 불러온다(stale-while-revalidate, 메모리에만 유지). 키에는 회원 번호처럼 결과를 가르는 값을 넣는다. Web의 OAuth refresh/401 후 로그인 이동과 Admin의 전용 refresh/권한 처리는 각 앱의 API client에 남긴다. `UserContext`·`AdminSessionContext`, 앱별 화면·상태 UI·도메인별 API는 공유하지 않는다.

Web 화면의 오류 문구는 FE가 정한 문구만 쓴다. BE 응답의 `message`와 오류 코드 원문은 화면에 쓰지 않고, 화면별 코드 표 → `apps/web/src/api/errorMessages.js`의 공통 표 → 화면별 대체 문구 순으로 고른다. `apps/web/test/errorMessages.test.js`가 서버 message를 화면에 넘기는 코드를 막는다. Admin은 운영자가 장애를 처리할 수 있도록 서버 message를 그대로 보여 준다.
