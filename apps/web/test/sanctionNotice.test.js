import test from 'node:test'
import assert from 'node:assert/strict'
import {
  describeCommentRestriction,
  formatKstMinuteCeil,
  isCommentRestrictionCode,
  localizeNoticeBody,
  parseRestrictionEnd,
} from '../src/utils/sanctionNotice.js'

test('제한 오류 코드만 제한 안내 대상이다', () => {
  assert.equal(isCommentRestrictionCode('COMMENT_RESTRICTED'), true)
  assert.equal(isCommentRestrictionCode('SPACE_COMMENT_BLOCKED'), true)
  for (const code of ['COMMENT_FOLLOWERS_ONLY', 'FORBIDDEN', 'toString', '', undefined, null]) {
    assert.equal(isCommentRestrictionCode(code), false, String(code))
  }
})

test('UTC 시각을 한국 시간(+9시간)으로 바꾼다', () => {
  assert.equal(formatKstMinuteCeil(new Date('2026-10-20T03:00:00Z')), '2026.10.20 12:00')
  assert.equal(formatKstMinuteCeil(new Date('2026-10-20T15:30:00Z')), '2026.10.21 00:30')
  assert.equal(formatKstMinuteCeil(new Date('2026-12-31T14:59:00Z')), '2026.12.31 23:59')
})

test('초 이하가 있으면 다음 분으로 올려, 표시한 시각 이후에는 항상 풀려 있다', () => {
  assert.equal(formatKstMinuteCeil(new Date('2026-10-20T03:00:00.001Z')), '2026.10.20 12:01')
  assert.equal(formatKstMinuteCeil(new Date('2026-10-20T03:00:59Z')), '2026.10.20 12:01')
  assert.equal(formatKstMinuteCeil(new Date('2026-10-20T14:59:30Z')), '2026.10.21 00:00')
})

test('오류 메시지에서 Instant 문자열(나노초 포함)을 읽는다', () => {
  assert.equal(
    parseRestrictionEnd('댓글 작성이 제한되었습니다. 해제 시각(UTC): 2026-10-20T03:00:00Z')?.toISOString(),
    '2026-10-20T03:00:00.000Z',
  )
  assert.equal(
    parseRestrictionEnd('이 스페이스에서 댓글 작성이 제한되었습니다. 해제 시각(UTC): 2026-10-20T03:00:00.123456Z')?.toISOString(),
    '2026-10-20T03:00:00.123Z',
  )
})

test('해제 시각이 없거나 읽을 수 없으면 null이다', () => {
  for (const message of ['댓글 작성이 제한되었습니다.', '해제 시각(UTC): 어제', '', null, undefined]) {
    assert.equal(parseRestrictionEnd(message), null, String(message))
  }
})

test('플랫폼 제한과 스페이스 차단은 서로 다른 문구와 해제 시각을 보여준다', () => {
  const restricted = describeCommentRestriction('COMMENT_RESTRICTED', '댓글 작성이 제한되었습니다. 해제 시각(UTC): 2026-10-20T03:00:00Z')
  const blocked = describeCommentRestriction('SPACE_COMMENT_BLOCKED', '이 스페이스에서 댓글 작성이 제한되었습니다. 해제 시각(UTC): 2026-10-20T03:00:00Z')
  assert.equal(restricted, '댓글 작성이 제한되어 있어요. 2026.10.20 12:00부터 다시 쓸 수 있어요.')
  assert.equal(blocked, '이 스페이스에서는 댓글을 쓸 수 없어요. 다른 스페이스에서는 쓸 수 있어요. 2026.10.20 12:00부터 다시 쓸 수 있어요.')
})

test('해제 시각을 읽지 못해도 사유는 안내하고, 제한 오류가 아니면 null이다', () => {
  assert.equal(describeCommentRestriction('COMMENT_RESTRICTED', '댓글 작성이 제한되었습니다.'), '댓글 작성이 제한되어 있어요.')
  assert.equal(describeCommentRestriction('FORBIDDEN', '해제 시각(UTC): 2026-10-20T03:00:00Z'), null)
})

test('알림 본문의 UTC 시각을 한국 시간으로 바꾸고 다른 문구는 건드리지 않는다', () => {
  assert.equal(
    localizeNoticeBody('경고 1회가 기록되었습니다. 2026-10-14 00:00 UTC까지 댓글을 작성하거나 수정할 수 없습니다.'),
    '경고 1회가 기록되었습니다. 2026.10.14 09:00 (한국 시간)까지 댓글을 작성하거나 수정할 수 없습니다.',
  )
  assert.equal(localizeNoticeBody('댓글 작성 제한이 모두 해제되었습니다.'), '댓글 작성 제한이 모두 해제되었습니다.')
  assert.equal(localizeNoticeBody(null), null)
  assert.equal(localizeNoticeBody(''), '')
})

test('알림 본문에 시각이 여러 번 나와도 모두 바꾼다', () => {
  assert.equal(
    localizeNoticeBody('2026-10-14 15:00 UTC부터 2026-10-15 15:00 UTC까지'),
    '2026.10.15 00:00 (한국 시간)부터 2026.10.16 00:00 (한국 시간)까지',
  )
})
