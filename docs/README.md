# Cking-FE 문서

이 디렉터리는 현재 단일 앱의 사실과 B-01 이후 모노레포 목표를 분리해 기록한다. 구현 사실은 현재 구조로, 계획은 **B-01 이후 목표**로 표기한다.

| 문서 | 책임 |
| --- | --- |
| [architecture.md](architecture.md) | Web/Admin/shared의 구조와 의존성 경계 |
| [apps/web.md](apps/web.md) | 사용자·Creator Web 앱의 책임과 규칙 |
| [apps/admin.md](apps/admin.md) | 관리자 앱의 책임과 규칙 |
| [api-coverage.md](api-coverage.md) | BE API의 FE 사용·구현 범위 추적 |
| [workflows/development.md](workflows/development.md) | Issue, 브랜치, 검증, PR 절차 |

## 작업별 읽기 순서

| 작업 | 먼저 읽을 문서 |
| --- | --- |
| 새 Web 화면 또는 Creator 기능 | [apps/web.md](apps/web.md) |
| 관리자 화면·운영 기능 | [apps/admin.md](apps/admin.md) |
| API 연동 | [api-coverage.md](api-coverage.md) → 연결된 BE 계약 문서 |
| 양 앱 공통 코드 | [architecture.md](architecture.md) |
| Issue·브랜치·검증·PR | [workflows/development.md](workflows/development.md) |
