import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BLOCK_DAYS_PRESETS,
  BLOCK_STATUS_META,
  SPACE_BLOCK_ERROR_MESSAGES,
  blockStatus,
  ceilToMinute,
  createdByLabel,
  deleteConfirm,
  pageAfterRefresh,
  parseBlockDays,
  parseFilterId,
  releaseConfirm,
  shouldRefreshAfterError,
} from '../src/utils/spaceCommentBlock.js'

test('차단 기간은 1~365 정수만 받는다', () => {
  assert.equal(parseBlockDays('1'), 1)
  assert.equal(parseBlockDays('365'), 365)
  assert.equal(parseBlockDays(' 30 '), 30)
  for (const text of ['0', '366', '-1', '1.5', '7일', '', ' ', 'abc', null, undefined]) {
    assert.equal(parseBlockDays(text), null, String(text))
  }
  for (const days of BLOCK_DAYS_PRESETS) assert.equal(parseBlockDays(String(days)), days)
})

test('목록 필터 ID는 비우면 필터 없음, 양의 정수만 받고 나머지는 잘못된 입력이다', () => {
  assert.equal(parseFilterId(''), undefined)
  assert.equal(parseFilterId('   '), undefined)
  assert.equal(parseFilterId(null), undefined)
  assert.equal(parseFilterId(' 12 '), 12)
  for (const text of ['0', '-3', '1.5', 'abc', '12a', '99999999999999999999']) {
    assert.equal(parseFilterId(text), null, text)
  }
})

test('초 이하가 있으면 다음 분으로 올리고 정각이면 그대로 둔다', () => {
  assert.equal(ceilToMinute(new Date('2026-10-20T03:00:00Z')).toISOString(), '2026-10-20T03:00:00.000Z')
  assert.equal(ceilToMinute(new Date('2026-10-20T03:00:00.001Z')).toISOString(), '2026-10-20T03:01:00.000Z')
  assert.equal(ceilToMinute(new Date('2026-10-20T23:59:30Z')).toISOString(), '2026-10-21T00:00:00.000Z')
})

test('차단 상태는 active와 releasedAt으로 가르고 모두 표시 문구가 있다', () => {
  assert.equal(blockStatus({ active: true, releasedAt: null }), 'ACTIVE')
  assert.equal(blockStatus({ active: false, releasedAt: '2026-10-14T00:00:00Z' }), 'RELEASED')
  assert.equal(blockStatus({ active: false, releasedAt: null }), 'EXPIRED')
  assert.equal(blockStatus(null), 'EXPIRED')
  for (const status of ['ACTIVE', 'RELEASED', 'EXPIRED']) assert.ok(BLOCK_STATUS_META[status].label, status)
})

test('건 사람은 내 회원 ID와 같을 때만 나로 표시하고 나머지는 회원 ID로 보여준다', () => {
  assert.equal(createdByLabel(5, 5), '나(관리자)')
  assert.equal(createdByLabel('5', 5), '나(관리자)')
  assert.equal(createdByLabel(7, 5), '회원 #7')
  assert.equal(createdByLabel(7, null), '회원 #7')
  assert.equal(createdByLabel(null, 5), '-')
})

test('해제 뒤 목록이 비면 이전 페이지로 가되 첫 페이지거나 이미 다른 페이지로 옮겼으면 그대로 둔다', () => {
  assert.equal(pageAfterRefresh(2, 2, 0), 1)
  assert.equal(pageAfterRefresh(0, 0, 0), 0)
  assert.equal(pageAfterRefresh(2, 2, 3), 2)
  assert.equal(pageAfterRefresh(2, 3, 0), 3)
})

test('BE 오류 코드별 안내가 있고 목록을 다시 읽어야 하는 코드는 찾을 수 없음뿐이다', () => {
  for (const code of ['CANNOT_BLOCK_SELF', 'CANNOT_BLOCK_ADMIN', 'CANNOT_BLOCK_SPACE_OWNER', 'VALIDATION_FAILED', 'RESOURCE_NOT_FOUND']) {
    assert.ok(SPACE_BLOCK_ERROR_MESSAGES[code], code)
  }
  assert.equal(shouldRefreshAfterError('RESOURCE_NOT_FOUND'), true)
  for (const code of ['VALIDATION_FAILED', 'FORBIDDEN', 'CANNOT_BLOCK_ADMIN', undefined]) {
    assert.equal(shouldRefreshAfterError(code), false, String(code))
  }
})

test('댓글 삭제 확인 문구는 되돌릴 수 없음과 경고·알림·기록이 없음을 알리고, 신고가 있으면 함께 삭제됨을 알린다', () => {
  const withReports = deleteConfirm({ reportCount: 3 })
  assert.equal(withReports.confirmLabel, '삭제하기')
  assert.match(withReports.message, /되돌릴 수 없어요/)
  assert.match(withReports.message, /신고 3건도 함께 삭제/)
  assert.match(withReports.message, /경고가 쌓이지 않고/)
  assert.doesNotMatch(deleteConfirm({ reportCount: 0 }).message, /함께 삭제/)
  assert.doesNotMatch(deleteConfirm(null).message, /함께 삭제/)
})

test('해제 확인 문구에 대상 회원과 스페이스가 들어가고 이름이 없으면 회원 ID로 대신한다', () => {
  assert.match(releaseConfirm({ memberName: '열혈팬', memberId: 12, creatorId: 3 }).message, /열혈팬.*스페이스 #3/)
  assert.match(releaseConfirm({ memberName: null, memberId: 12, creatorId: 3 }).message, /회원 #12/)
  assert.match(releaseConfirm({ memberName: '열혈팬', memberId: 12, creatorId: 3 }).message, /이미 끝난 차단이면 알림은 가지 않아요/)
})
