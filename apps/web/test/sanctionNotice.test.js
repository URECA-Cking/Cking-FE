import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ceilToMinute,
  describeCommentRestriction,
  isCommentRestrictionCode,
  localizeNoticeBody,
  parseRestrictionEnd,
} from '../src/utils/sanctionNotice.js'
import { formatDateTime } from '../src/utils/format.js'

// 표기는 브라우저(=실행 머신) 시간대를 따르므로, 서식 문자열을 고정해 단언하지 않고 formatDateTime 결과와 비교한다.

test('제한 오류 코드만 제한 안내 대상이다', () => {
  assert.equal(isCommentRestrictionCode('COMMENT_RESTRICTED'), true)
  assert.equal(isCommentRestrictionCode('SPACE_COMMENT_BLOCKED'), true)
  for (const code of ['COMMENT_FOLLOWERS_ONLY', 'FORBIDDEN', 'toString', '', undefined, null]) {
    assert.equal(isCommentRestrictionCode(code), false, String(code))
  }
})

test('초 이하가 있으면 다음 분으로 올리고, 정각이면 그대로 둔다', () => {
  assert.equal(ceilToMinute(new Date('2026-10-20T03:00:00Z')).toISOString(), '2026-10-20T03:00:00.000Z')
  assert.equal(ceilToMinute(new Date('2026-10-20T03:00:00.001Z')).toISOString(), '2026-10-20T03:01:00.000Z')
  assert.equal(ceilToMinute(new Date('2026-10-20T03:00:59Z')).toISOString(), '2026-10-20T03:01:00.000Z')
  assert.equal(ceilToMinute(new Date('2026-10-20T23:59:30Z')).toISOString(), '2026-10-21T00:00:00.000Z')
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

test('플랫폼 제한과 스페이스 차단은 서로 다른 문구를 보여주고, 해제 시각은 올림한 값을 앱 표기로 붙인다', () => {
  const end = formatDateTime(new Date('2026-10-20T03:01:00Z'))
  const restricted = describeCommentRestriction('COMMENT_RESTRICTED', '댓글 작성이 제한되었습니다. 해제 시각(UTC): 2026-10-20T03:00:00.5Z')
  const blocked = describeCommentRestriction('SPACE_COMMENT_BLOCKED', '이 스페이스에서 댓글 작성이 제한되었습니다. 해제 시각(UTC): 2026-10-20T03:00:00.5Z')
  assert.equal(restricted, `댓글 작성이 제한되어 있어요. ${end}부터 다시 쓸 수 있어요.`)
  assert.equal(blocked, `이 스페이스에서는 댓글을 쓸 수 없어요. 다른 스페이스에서는 쓸 수 있어요. ${end}부터 다시 쓸 수 있어요.`)
  assert.notEqual(restricted, blocked)
})

test('해제 시각을 읽지 못해도 사유는 안내하고, 제한 오류가 아니면 null이다', () => {
  assert.equal(describeCommentRestriction('COMMENT_RESTRICTED', '댓글 작성이 제한되었습니다.'), '댓글 작성이 제한되어 있어요.')
  assert.equal(describeCommentRestriction('FORBIDDEN', '해제 시각(UTC): 2026-10-20T03:00:00Z'), null)
})

test('알림 본문의 UTC 시각을 앱 표기로 바꾸고 다른 문구는 건드리지 않는다', () => {
  const end = formatDateTime(new Date('2026-10-14T00:00:00Z'))
  assert.equal(
    localizeNoticeBody('경고 1회가 기록되었습니다. 2026-10-14 00:00 UTC까지 댓글을 작성하거나 수정할 수 없습니다.'),
    `경고 1회가 기록되었습니다. ${end}까지 댓글을 작성하거나 수정할 수 없습니다.`,
  )
  assert.equal(
    localizeNoticeBody('하늘의 스페이스에서 댓글 작성이 제한되었습니다. 2026-10-14 00:00 UTC까지 이 스페이스에서 댓글을 작성하거나 수정할 수 없습니다.'),
    `하늘의 스페이스에서 댓글 작성이 제한되었습니다. ${end}까지 이 스페이스에서 댓글을 작성하거나 수정할 수 없습니다.`,
  )
  assert.equal(localizeNoticeBody('댓글 작성 제한이 해제되었습니다.'), '댓글 작성 제한이 해제되었습니다.')
  assert.equal(localizeNoticeBody(null), null)
  assert.equal(localizeNoticeBody(''), '')
})

test('알림 본문에 시각이 여러 번 나와도 모두 바꾼다', () => {
  assert.equal(
    localizeNoticeBody('2026-10-14 15:00 UTC부터 2026-10-15 15:00 UTC까지'),
    `${formatDateTime(new Date('2026-10-14T15:00:00Z'))}부터 ${formatDateTime(new Date('2026-10-15T15:00:00Z'))}까지`,
  )
})
