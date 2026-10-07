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
- PR 대상이 `develop` 또는 `main`이면 CI가 Node 22에서 `npm ci`, `npm run lint`, `npm run test:shared`, `npm run build`를 실행한다. `develop` push 시 Web과 Admin을 각각 배포한다.

## GitHub Issue·PR 템플릿

Issue와 PR 템플릿의 정본은 이 저장소가 아니라 조직 [URECA-Cking/.github](https://github.com/URECA-Cking/.github)에 있다. 생성 전에는 정본과 조직 CONTRIBUTING을 조회한다. 로컬에 템플릿 파일이 없거나 `gh` 명령이 본문 입력을 허용하더라도, 임의 본문으로 생성하지 않는다.

1. Issue는 `feature`, `bug`, `task` 중 유형을 선택해 조직 Issue 템플릿의 제목 접두어, 레이블, 섹션을 적용하고 자신을 담당자로 지정한다.
2. PR은 조직 `PULL_REQUEST_TEMPLATE.md`의 개요, 변경 사항, 관련 이슈, 테스트, 체크리스트를 유지한다. 본문에는 `Closes #이슈번호`를 넣고 리뷰어를 요청한다.
3. 생성 뒤에는 중앙 템플릿을 다시 읽는 아래 검증 명령으로 결과를 확인한다. 이 명령은 GitHub CLI 인증과 네트워크 연결이 필요하다.

```powershell
node scripts/github/create-from-template.mjs issue --type task --title "[TASK] 작업 제목" --body-file .\issue.md
node scripts/github/verify-template.mjs issue --number 74
node scripts/github/verify-template.mjs pr --number 75
```

`create-from-template.mjs`는 중앙 템플릿으로 입력을 사전 검증한 뒤 즉시 GitHub에 생성한다. 이어서 생성된 결과의 제목·본문·레이블·담당자 또는 리뷰어를 자동 보정하고 `verify-template.mjs`로 최종 검증한다. Issue 생성에는 `--type`, `--title`, `--body-file`을, PR 생성에는 `--title`, `--body-file`, `--issue`, `--reviewer`를 지정한다. 두 스크립트 모두 실행 시점에 조직 정본을 조회하며, 템플릿 파일은 이 저장소에 복제하지 않는다.

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
| shared·workspace·빌드 설정 | `npm run lint`, `npm run test:shared`, `npm run build` + 양쪽 앱 기동/확인 |
