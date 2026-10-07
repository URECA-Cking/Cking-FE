# Cking-FE 작업 규칙

이 문서는 Cking-FE에서 작업하는 AI Agent와 기여자의 최상위 안내입니다. GitHub 운영 규칙의 정본은 [조직 CONTRIBUTING](https://github.com/URECA-Cking/.github/blob/main/CONTRIBUTING.md), [`.github/`](.github/), 저장소 설정이며, 이 문서는 그것을 복제하지 않습니다.

## 읽기 순서

1. [README.md](README.md)
2. [docs/README.md](docs/README.md)
3. 변경 대상 앱의 문서: [Web](docs/apps/web.md) 또는 [Admin](docs/apps/admin.md)
4. 기능·API 관련 문서: [API 사용 현황](docs/api-coverage.md)와 BE 계약 문서

## API 계약

요청·응답·오류 코드의 정본은 FE가 아니라 Cking-BE `develop`의 [docs/api-index.md](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/api-index.md) 및 `docs/domains/**/api.md`이다. FE 문서는 사용 앱·화면·구현 상태·BE 정본 위치만 추적한다. 계약을 FE 문서에 복제하거나 독자적으로 정의하지 않는다.

## 앱 경계

현재 `develop`은 `apps/web` workspace 하나를 실행하며, 기존 관리자 화면도 이 workspace에 포함한다. B-01 이후 목표 경계는 `apps/web`, `apps/admin`, `packages/shared`이며, 상세 책임과 의존 방향은 [architecture.md](docs/architecture.md)를 따른다.

## 작업 방식

- 작업은 Issue를 기준으로 시작하고, 담당자를 지정한다.
- 브랜치·커밋·PR 규칙은 [조직 CONTRIBUTING](https://github.com/URECA-Cking/.github/blob/main/CONTRIBUTING.md)을 따른다. 문서 작업 브랜치는 `docs/{issue}-...` 형식과 `docs:` 커밋 타입을 사용한다.
- 코드 변경은 범위에 맞는 검증을 수행한다. 현재와 B-01 이후 명령의 구분은 [development.md](docs/workflows/development.md)를 따른다.
- API, 라우팅, 인증, 아키텍처를 변경하면 관련 문서를 함께 갱신한다.
- 현재 Issue와 관계없는 리팩터링을 하지 않는다.
- [조직 CONTRIBUTING](https://github.com/URECA-Cking/.github/blob/main/CONTRIBUTING.md)과 `.github/`의 명시적 규칙을 우선한다.
