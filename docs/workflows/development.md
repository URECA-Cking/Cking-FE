# 개발 Workflow와 검증

## 현재 프로젝트 절차

현재 저장소의 CI/CD와 최근 병합 PR을 기준으로 작업 흐름은 다음과 같다.

```text
Issue
→ develop 최신화
→ 작업 브랜치
→ 개발
→ 검증
→ Commit
→ Push
→ PR(develop)
→ Review
→ Squash and Merge
```

- 기준 브랜치는 `develop`이다.
- 최근 관례상 작업 브랜치는 `feat/{issue}-...`, `task/{issue}-...`, `docs/{issue}-...`처럼 작업 성격과 Issue 번호를 포함한다. 명시 규칙이 새로 생기면 그것을 우선한다.
- 최근 PR 체크리스트는 `feat`, `fix`, `refactor`, `docs`, `test`, `ci`, `chore` 커밋 접두어를 사용하도록 안내한다.
- PR 대상이 `develop` 또는 `main`이면 CI가 Node 22에서 `npm ci`, `npm run lint`, `npm run build`를 실행한다. `develop` push만 배포한다.

## 현재 develop 검증 명령

| 변경 범위 | 최소 검증 |
| --- | --- |
| 현재 단일 앱의 화면·API·상태·문서 | `npm run lint`, `npm run build` |
| PWA 동작 | `npm run build && npm run preview` 후 수동 확인 |
| CI/CD 파일 | YAML 및 영향 범위 확인; `.github/` 변경은 CODEOWNERS 검토 고려 |

현재는 단일 앱이므로 Web과 Admin을 따로 lint/build하는 명령은 존재하지 않는다.

## PR #46 머지 후 검증 명령

PR #46이 머지되면 npm workspaces 구조가 적용된다. 이 단계에서 Admin은 여전히 `apps/web`에 포함되므로, 아래 Web 검증에는 기존 관리자 화면도 포함된다.

| 변경 범위 | 최소 검증 |
| --- | --- |
| `apps/web` 코드·문서 | `npm run lint`, `npm run build:web` |
| 루트 workspace 설정·CI | `npm run lint`, `npm run build` |
| PWA 동작 | `npm run build && npm run preview` 후 수동 확인 |

`npm run dev:web`는 Web workspace 개발 서버를 실행한다. 이 시점에는 Admin 전용 lint/build 명령이 없다.

## B-01 이후 목표 검증

아래는 workspace와 각 앱 명령이 실제로 도입된 뒤 적용할 목표다. 현재 명령이 아니다.

| 변경 범위 | 최소 검증 |
| --- | --- |
| Web | Web lint + Web build |
| Admin | Admin lint + Admin build |
| shared | Web·Admin 모두 lint/build |
| workspace·빌드 설정 | 전체 build + 양쪽 앱 기동/확인 |

명령 이름은 B-01에서 `package.json`에 실제로 확정한 뒤 이 문서에 반영한다.
