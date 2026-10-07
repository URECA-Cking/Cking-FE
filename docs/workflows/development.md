# 개발 Workflow와 검증

## 현재 프로젝트 절차

작업 흐름의 정본은 [조직 CONTRIBUTING](https://github.com/URECA-Cking/.github/blob/main/CONTRIBUTING.md)이다. 아래는 FE에서 참조할 최소 흐름이다.

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

- 기준 브랜치는 `develop`이며, 작업 브랜치는 `<type>/{issue}-<summary>` 형식이다. `type`은 `feat`, `fix`, `refactor`, `docs`, `test`, `ci`, `chore` 중 하나다.
- 커밋은 `<type>: <한국어 한 줄 요약>` 형식이며, PR 제목은 Issue 제목과 동일하게 쓴다.
- PR 대상이 `develop` 또는 `main`이면 CI가 Node 22에서 `npm ci`, `npm run lint`, `npm run build:web`를 실행한다. `develop` push만 배포한다.

## 현재 검증 명령

| 변경 범위 | 최소 검증 |
| --- | --- |
| `apps/web`의 화면·API·상태·문서 | `npm run lint`, `npm run build:web` |
| PWA 동작 | `npm run build && npm run preview` 후 수동 확인 |
| CI/CD 파일 | YAML 및 영향 범위 확인; `.github/` 변경은 CODEOWNERS에 따른 인프라 담당 승인 필요 |

현재 Admin은 `apps/web`에 포함되므로, Web 검증에는 기존 관리자 화면도 포함된다. Admin 전용 lint/build 명령은 아직 없다.

## B-01 이후 목표 검증

아래는 workspace와 각 앱 명령이 실제로 도입된 뒤 적용할 목표다. 현재 명령이 아니다.

| 변경 범위 | 최소 검증 |
| --- | --- |
| Web | Web lint + Web build |
| Admin | Admin lint + Admin build |
| shared | Web·Admin 모두 lint/build |
| workspace·빌드 설정 | 전체 build + 양쪽 앱 기동/확인 |

명령 이름은 B-01에서 `package.json`에 실제로 확정한 뒤 이 문서에 반영한다.
