import test from 'node:test'
import assert from 'node:assert/strict'
import {
  actionConfirm,
  actionSuccessMessage,
  canHandle,
  reasonLabel,
  reasonSummary,
  reportStatusLabel,
} from '../src/utils/commentReport.js'

test('신고 사유는 아는 코드를 한국어로, 모르는 코드는 그대로 보여준다', () => {
  assert.equal(reasonLabel('ABUSE'), '욕설·혐오')
  assert.equal(reasonLabel('SPAM'), '스팸·홍보')
  assert.equal(reasonLabel('PRIVACY'), '개인정보 노출')
  assert.equal(reasonLabel('OTHER'), '기타')
  assert.equal(reasonLabel('NEW_REASON'), 'NEW_REASON')
})

test('사유별 신고 수는 정해진 순서로 합치고 건수가 없거나 비어 있으면 대시다', () => {
  assert.equal(reasonSummary({ SPAM: 1, ABUSE: 2 }), '욕설·혐오 2 · 스팸·홍보 1')
  assert.equal(reasonSummary({ OTHER: 1, PRIVACY: 3, ABUSE: 1 }), '욕설·혐오 1 · 개인정보 노출 3 · 기타 1')
  assert.equal(reasonSummary({ ABUSE: 0, SPAM: 2 }), '스팸·홍보 2')
  assert.equal(reasonSummary({}), '-')
  assert.equal(reasonSummary(undefined), '-')
})

test('모르는 사유는 아는 사유 뒤에 코드순으로 둔다', () => {
  assert.equal(reasonSummary({ ZZZ: 1, AAA: 2, ABUSE: 1 }), '욕설·혐오 1 · AAA 2 · ZZZ 1')
})

test('처리 상태는 문구로 바꾸고 모르는 상태는 그대로 보여준다', () => {
  assert.equal(reportStatusLabel('PENDING'), '접수')
  assert.equal(reportStatusLabel('RESOLVED'), '숨김 처리')
  assert.equal(reportStatusLabel('REJECTED'), '반려')
  assert.equal(reportStatusLabel('X'), 'X')
  assert.equal(reportStatusLabel(undefined), '-')
})

test('접수 신고가 남아 있는 댓글만 조치할 수 있다', () => {
  assert.equal(canHandle({ pendingReportCount: 2 }), true)
  assert.equal(canHandle({ pendingReportCount: 0 }), false)
  assert.equal(canHandle({}), false)
  assert.equal(canHandle(null), false)
})

test('확인 문구는 조치별로 다르고 처리될 접수 신고 수를 담는다', () => {
  const hide = actionConfirm('hide', 3)
  assert.equal(hide.confirmLabel, '숨기기')
  assert.match(hide.message, /3건/)
  assert.match(hide.message, /되돌릴 수 없어요/)
  const reject = actionConfirm('reject', 2)
  assert.equal(reject.confirmLabel, '반려하기')
  assert.match(reject.message, /2건/)
  assert.doesNotMatch(reject.message, /되돌릴 수 없어요/)
})

test('성공 안내는 처리한 건수가 있으면 건수를, 0이면 이미 처리됐다고 알린다', () => {
  assert.equal(actionSuccessMessage('hide', 2), '신고 2건을 처리하고 댓글을 숨겼어요.')
  assert.equal(actionSuccessMessage('hide', 0), '이미 숨긴 댓글이에요.')
  assert.equal(actionSuccessMessage('reject', 1), '신고 1건을 반려했어요.')
  assert.equal(actionSuccessMessage('reject', 0), '이미 반려한 신고예요.')
})
