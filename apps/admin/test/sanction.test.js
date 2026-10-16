import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HIDE_RELATION_NOTICE,
  PLATFORM_STATUS_META,
  PLATFORM_TARGET_NOTICE,
  REASON_MAX,
  SANCTION_SCOPE,
  SANCTION_SCOPE_OPTIONS,
  parseSanctionReason,
  platformReleaseConfirm,
  sanctionBasis,
  sanctionDescription,
  sanctionErrorMessage,
  sanctionSuccessMessage,
  sourceMeta,
} from '../src/utils/sanction.js'
import { SPACE_BLOCK_ERROR_MESSAGES } from '../src/utils/spaceCommentBlock.js'
import { formatDateTime } from '../src/utils/format.js'

test('범위 선택지는 이 스페이스에서만이 먼저이고 모든 스페이스가 뒤다', () => {
  assert.deepEqual(SANCTION_SCOPE_OPTIONS.map((option) => option.value), [SANCTION_SCOPE.SPACE, SANCTION_SCOPE.PLATFORM])
  assert.deepEqual(SANCTION_SCOPE_OPTIONS.map((option) => option.label), ['이 스페이스에서만', '모든 스페이스'])
})

test('사유는 앞뒤 공백을 제거하고 1~200자만 받는다', () => {
  assert.equal(parseSanctionReason('  반복 욕설  '), '반복 욕설')
  assert.equal(parseSanctionReason('가'.repeat(REASON_MAX)), '가'.repeat(REASON_MAX))
  assert.equal(parseSanctionReason('가'.repeat(REASON_MAX + 1)), null)
  assert.equal(parseSanctionReason('   '), null)
  assert.equal(parseSanctionReason(''), null)
  assert.equal(parseSanctionReason(undefined), null)
})

test('범위별 설명은 어느 쪽이든 이미 쓴 댓글이 남는다고 알리고 범위가 다르다', () => {
  const space = sanctionDescription(SANCTION_SCOPE.SPACE, { creatorId: 5, memberId: 20 })
  const platform = sanctionDescription(SANCTION_SCOPE.PLATFORM, { creatorId: 5, memberId: 20 })
  assert.match(space, /회원 #20/)
  assert.match(space, /Creator #5/)
  assert.match(space, /다른 스페이스에서는 쓸 수 있어요/)
  assert.match(platform, /모든 스페이스에서 댓글을 쓰거나 수정할 수 없게/)
  assert.match(platform, /경고 횟수에는 세지 않아요/)
  assert.doesNotMatch(platform, /Creator #5/)
  for (const text of [space, platform]) assert.match(text, /이미 쓴 댓글은 그대로 남고/)
})

test('숨기기와의 관계 안내는 자동 경고 단계와 제한이 겹칠 때의 적용 기준을 알린다', () => {
  assert.match(HIDE_RELATION_NOTICE, /경고가 쌓여 1일·3일·7일/)
  assert.match(HIDE_RELATION_NOTICE, /종료 시각이 가장 늦은 쪽/)
})

test('스페이스 범위는 스페이스 차단 오류 문구를, 플랫폼 범위는 기간·사유 범위를 알리는 문구를 쓴다', () => {
  assert.equal(sanctionErrorMessage(SANCTION_SCOPE.SPACE, 'CANNOT_BLOCK_ADMIN'), SPACE_BLOCK_ERROR_MESSAGES.CANNOT_BLOCK_ADMIN)
  assert.equal(sanctionErrorMessage(SANCTION_SCOPE.SPACE, 'CANNOT_BLOCK_SPACE_OWNER'), SPACE_BLOCK_ERROR_MESSAGES.CANNOT_BLOCK_SPACE_OWNER)
  assert.match(sanctionErrorMessage(SANCTION_SCOPE.PLATFORM, 'VALIDATION_FAILED'), /기간은 1일 이상 365일 이하, 사유는 1자 이상 200자 이하/)
  assert.match(sanctionErrorMessage(SANCTION_SCOPE.PLATFORM, 'RESOURCE_NOT_FOUND'), /대상 회원을 찾을 수 없어요/)
})

test('모르는 오류 코드는 null이라 일반 문구로 대신한다', () => {
  assert.equal(sanctionErrorMessage(SANCTION_SCOPE.PLATFORM, 'SOMETHING_NEW'), null)
  assert.equal(sanctionErrorMessage(SANCTION_SCOPE.SPACE, 'SOMETHING_NEW'), null)
  assert.equal(sanctionErrorMessage(SANCTION_SCOPE.SPACE, undefined), null)
})

test('제재 완료 안내는 돌려받은 종료 시각을 올림해 범위와 함께 알리고 이름이 없으면 회원 ID로 대신한다', () => {
  const end = formatDateTime(new Date('2026-10-20T03:01:00Z').toISOString())
  assert.equal(
    sanctionSuccessMessage(SANCTION_SCOPE.SPACE, { memberName: '열혈팬', memberId: 12, endsAt: '2026-10-20T03:00:00.5Z' }),
    `열혈팬을(를) ${end}까지 이 스페이스에서 제재했어요.`,
  )
  assert.equal(
    sanctionSuccessMessage(SANCTION_SCOPE.PLATFORM, { memberId: 12, endsAt: '2026-10-20T03:00:00.5Z' }),
    `회원 #12을(를) ${end}까지 모든 스페이스에서 제재했어요.`,
  )
})

test('제한 출처는 자동 경고와 관리자 제한으로 구분하고 모르는 출처는 코드를 그대로 보여 준다', () => {
  assert.equal(sourceMeta('AUTOMATIC').label, '자동 경고')
  assert.equal(sourceMeta('MANUAL').label, '관리자 제한')
  assert.equal(sourceMeta('NEW_SOURCE').label, 'NEW_SOURCE')
  assert.equal(sourceMeta(undefined).label, '-')
})

test('제한의 근거는 자동 경고면 숨긴 댓글 번호, 수동 제한이면 사유다', () => {
  assert.equal(sanctionBasis({ source: 'AUTOMATIC', causeCommentId: 500 }), '숨긴 댓글 #500')
  assert.equal(sanctionBasis({ source: 'AUTOMATIC', causeCommentId: null }), '댓글 숨김')
  assert.equal(sanctionBasis({ source: 'MANUAL', reason: '반복 욕설' }), '반복 욕설')
  assert.equal(sanctionBasis({ source: 'MANUAL', reason: null }), '-')
})

test('플랫폼 제한 상태 표시 문구가 있다', () => {
  for (const status of ['ACTIVE', 'RELEASED', 'EXPIRED']) assert.ok(PLATFORM_STATUS_META[status].label, status)
  assert.equal(PLATFORM_STATUS_META.ACTIVE.label, '제한 중')
})

test('플랫폼 제한 해제 확인은 대상 회원을 알리고 자동 경고일 때만 경고 횟수에 남음을 알린다', () => {
  const automatic = platformReleaseConfirm({ source: 'AUTOMATIC', memberId: 20 })
  const manual = platformReleaseConfirm({ source: 'MANUAL', memberId: 20 })
  assert.equal(automatic.confirmLabel, '해제하기')
  assert.match(automatic.message, /회원 #20/)
  assert.match(automatic.message, /자동 경고는 해제해도 경고 횟수에는 남아요/)
  assert.doesNotMatch(manual.message, /경고 횟수/)
  assert.match(manual.message, /다른 제한이 남아 있으면 알림은 가지 않아요/)
})

test('모든 스페이스 제재는 BE가 대상을 막지 않는 동안 크리에이터·관리자도 걸린다고 임시로 알린다', () => {
  assert.match(PLATFORM_TARGET_NOTICE, /크리에이터나 관리자여도 제한이 걸려요/)
  assert.match(PLATFORM_TARGET_NOTICE, /자기 스페이스에서도 댓글을 쓸 수 없게/)
})
