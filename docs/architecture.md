# FE 아키텍처와 앱 경계

## 현재 구조

현재 Cking-FE는 npm workspaces의 `apps/web` 하나를 실행하는 React + Vite 앱이다. `apps/web/src/App.jsx`가 Web·Creator·Admin 라우트를 모두 등록하며, Admin 코드는 `apps/web/src/pages/admin/`, API 모듈은 `apps/web/src/api/admin.js`에 있다. `packages/`는 workspace 경로만 준비돼 있고 패키지는 아직 없다.

```text
apps/
└── web/                 # Web·Creator·Admin 코드를 모두 포함
    └── src/
packages/                # workspace 경로만 준비, 패키지는 아직 없음
```

루트 명령은 `dev:web`, `build:web`, `lint`를 제공하며 `build`는 Web만 빌드한다. 이 구조는 B-01의 Admin 분리와 혼동하지 않는다.

## B-01 이후 목표 구조

```text
apps/
├── web/
└── admin/

packages/
└── shared/
```

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
