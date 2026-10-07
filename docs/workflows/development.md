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

Admin은 `apps/admin` 독립 workspace이므로 Web과 별도로 검증한다.

| 변경 범위 | 최소 검증 |
| --- | --- |
| Web | `npm run lint:web`, `npm run build:web` |
| Admin | `npm run lint:admin`, `npm run build:admin` |
| workspace·빌드 설정 | `npm run build` + 양쪽 앱 기동/확인 |
