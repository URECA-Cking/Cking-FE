# TC-08 관리자 응모권 E2E 검증

## 설계와 범위

대상은 격리된 FE·BE·Redis·MySQL 테스트 환경이다. 관리자 로그인부터 `/admin/tickets`의 조회·이력·수동 보정까지 실제 HTTP 요청으로 검증한다. 브라우저의 API 응답은 모의하지 않는다. 기존 `AdminTickets` 화면과 BE의 보정 안전장치를 그대로 사용한다. 이 문서는 준비·실행·결과 기록 절차이며, API 계약은 [BE Ticket API](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/ticket/api.md)를 따른다.

| 단계 | 입력 상태 | 확인할 결과 |
| --- | --- | --- |
| 조회 | 적립·사용 원장이 있는 Creator 전용 및 공용 테스트 회원 | 관리자 로그인, 메뉴 접근, 종류별 Redis·MySQL 잔액과 EARN·SPEND 이력 |
| 거부 | 전용 테스트 대상에 잔액 불일치와 미반영 EARN/SPEND Stream 메시지 | 화면의 불일치, 보정 요청의 `INVALID_STATE`, 잔액·COMPENSATE 이력 불변 |
| 보정 | 별도 테스트 대상에 지속 불일치가 있고 미반영 Stream·Dead Stream이 없음 | 사유 확인 후 보정, Redis·MySQL 일치, 새 COMPENSATE 원장과 사유 |

조회 대상, 거부 대상, 보정 대상은 분리한다. 보정은 테스트 데이터만 변경한다. 보정 전에는 BE 운영 절차에 따라 원인과 Stream·Dead Stream 상태를 확인한다. FE 테스트는 Redis·MySQL 값을 직접 수정하지 않는다. 환경 준비와 저장소의 직접 관측은 해당 환경 관리자 또는 BE 검증 절차에서 수행하고, 브라우저 테스트는 실제 API 및 화면 결과를 확인한다. [BE 관리자 회귀 검증](https://github.com/URECA-Cking/Cking-BE/blob/develop/docs/domains/ticket/admin-regression-verification.md)도 함께 참고한다.

## 테스트 데이터 준비

1. 격리된 환경의 FE·BE 배포 버전, Redis·MySQL 연결, 관리자 계정, 대상 회원·Creator ID를 확인한다. 계정·토큰·Cookie·개인정보는 기록하지 않는다.
2. 조회 대상에는 Creator 전용과 공용 응모권의 EARN·SPEND 원장을 각각 준비한다.
3. 거부 대상의 Redis·MySQL 잔액을 다르게 만들고, 해당 종류의 미반영 EARN/SPEND Stream 메시지를 유지한다. 보정 전후 원장 ID·잔액을 관측한다.
4. 보정 대상에는 별도의 지속 불일치를 만든다. 해당 대상의 미반영 Stream 및 미해결 Dead Stream이 없음을 확인한 뒤 테스트를 실행한다.
5. 실행 직전 각 대상의 잔액·원장과 Stream 상태를 재확인한다. 비동기 Worker가 테스트 데이터를 처리해 상태가 바뀌면 데이터를 다시 준비한다.

## 실행

PowerShell에서 다음 변수를 현재 세션에 설정한다. ID에는 양의 정수를 사용한다. `E2E_ADMIN_API_BASE_URL`을 지정하지 않으면 `https://dev-api.cking.co.kr`를 사용한다.

```powershell
$env:E2E_ADMIN_BASE_URL='https://격리된-admin-주소'
$env:E2E_ADMIN_API_BASE_URL='https://격리된-api-주소'
$env:E2E_ADMIN_LOGIN_ID='<관리자 ID>'
$env:E2E_ADMIN_PASSWORD='<관리자 비밀번호>'
$env:E2E_TICKET_READ_MEMBER_ID='<조회 회원 ID>'
$env:E2E_TICKET_READ_CREATOR_ID='<조회 Creator ID>'
$env:E2E_TICKET_BLOCKED_MEMBER_ID='<거부 대상 회원 ID>'
$env:E2E_TICKET_BLOCKED_CREATOR_ID='<거부 대상 Creator ID>'
$env:E2E_TICKET_RESYNC_MEMBER_ID='<보정 대상 회원 ID>'
$env:E2E_TICKET_RESYNC_CREATOR_ID='<보정 대상 Creator ID>'
npm run lint:admin
npm run build:admin
npm run test:e2e:admin -- --grep 'TC-08'
```

테스트는 준비되지 않은 시나리오를 `skipped`로 표시한다. `skipped`는 통과가 아니다. 변경 작업을 수행하는 거부·보정 테스트는 환경 변수 `E2E_TICKET_MUTATION_READY=1`도 필요하다. Creator 전용·공용 보정 대상은 같은 회원 ID를 사용할 수 있으나, 거부 대상과 보정 대상은 서로 달라야 한다. 실행 뒤 BE에서 Redis 키, MySQL Balance 행, COMPENSATE Ledger를 직접 조회해 브라우저/API 관측과 대조한다.

## 결과 기록

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| FE lint/build | 통과 | `npm run lint`, `npm run build`, `npx oxlint apps/admin/e2e/tickets.spec.js` (2026-10-13, FE `27fd63b` 기반 작업 브랜치) |
| Admin 단위 테스트 | 통과 | `npm run test:admin` 31개 통과 |
| 관리자 로그인·메뉴·Creator 전용/공용 조회 | 미실행 | 관리자 계정·테스트 대상 ID 미설정으로 Playwright `skipped` |
| EARN·SPEND 이력 | 미실행 | 관리자 계정·테스트 대상 ID 미설정으로 Playwright `skipped` |
| 미반영 Stream 보정 거부 | 미실행 | 격리된 테스트 데이터와 관리자 계정 미설정으로 Playwright `skipped` |
| 안전한 수동 보정 | 미실행 | 격리된 테스트 데이터와 관리자 계정 미설정으로 Playwright `skipped` |
| Redis·MySQL 직접 재확인 | 미실행 | 대상별 잔액·원장 ID (비밀값 제외) |

실행할 때 날짜·환경·FE/BE SHA와 각 항목의 `통과`/`실패`/`미실행`을 기록한다. Playwright 결과만으로 저장소의 직접 확인을 완료로 표시하지 않는다.
