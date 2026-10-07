# Cking-FE 작업 규칙

이 문서는 Cking-FE에서 작업하는 AI Agent와 기여자의 최상위 안내입니다. GitHub 운영 규칙의 정본은 [`.github/`](.github/)와 저장소 설정이며, 이 문서는 그것을 복제하지 않습니다.

## 읽기 순서

1. [README.md](README.md)
2. [docs/README.md](docs/README.md)
3. 변경 대상 앱의 문서: [Web](docs/apps/web.md) 또는 [Admin](docs/apps/admin.md)
4. 기능·API 관련 문서: [API 사용 현황](docs/api-coverage.md)와 BE 계약 문서

## API 계약

요청·응답·오류 코드의 정본은 FE가 아니라 Cking-BE `develop`의 [docs/api-index.md](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/api-index.md) 및 `docs/domains/**/api.md`이다. FE 문서는 사용 앱·화면·구현 상태·BE 정본 위치만 추적한다. 계약을 FE 문서에 복제하거나 독자적으로 정의하지 않는다.

## 앱 경계

현재 `develop`은 루트 `src/` 단일 Vite 앱이다. PR #46이 머지되면 기존 앱은 `apps/web` workspace로 이동하며, 그 단계에서도 관리자 화면은 `apps/web`에 남는다. B-01 이후 목표 경계는 `apps/web`, `apps/admin`, `packages/shared`이며, 상세 책임과 의존 방향은 [architecture.md](docs/architecture.md)를 따른다.

## 작업 방식

- 작업은 Issue를 기준으로 시작한다.
- 기준 브랜치를 최신화한 뒤 프로젝트의 실제 브랜치 관례를 따라 작업 브랜치를 만든다.
- 코드 변경은 범위에 맞는 검증을 수행한다. 현재 develop, PR #46 머지 후, B-01 이후 명령의 구분은 [development.md](docs/workflows/development.md)를 따른다.
- API, 라우팅, 인증, 아키텍처를 변경하면 관련 문서를 함께 갱신한다.
- 현재 Issue와 관계없는 리팩터링을 하지 않는다.
- `.github/` 및 향후 추가될 `CONTRIBUTING.md`의 명시적 규칙을 우선한다.
