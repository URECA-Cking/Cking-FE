import test from 'node:test'
import assert from 'node:assert/strict'
import {
  actionConfirm,
  actionSuccessMessage,
  canHandle,
  reasonLabel,
  reasonSummary,
  reportStatusLabel,
  viewAfterRefresh,
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

test('다시 읽은 목록이 비고 시작한 탭·페이지에 그대로 있으면 한 페이지 줄인다', () => {
  const view = { status: 'PENDING', page: 2 }
  assert.deepEqual(viewAfterRefresh(view, { status: 'PENDING', page: 2 }, 0), { status: 'PENDING', page: 1 })
})

test('목록이 비어 있지 않거나 첫 페이지이면 위치를 바꾸지 않는다', () => {
  const view = { status: '', page: 1 }
  assert.deepEqual(viewAfterRefresh(view, { status: '', page: 1 }, 3), { status: '', page: 1 })
  const first = { status: 'PENDING', page: 0 }
  assert.deepEqual(viewAfterRefresh(first, { status: 'PENDING', page: 0 }, 0), { status: 'PENDING', page: 0 })
})

test('재조회 중에 탭을 바꿨다면 늦게 끝난 빈 결과로 페이지를 줄이지 않는다(페이지가 -1이 되지 않는다)', () => {
  const started = { status: 'PENDING', page: 1 }
  // 접수 탭 2페이지에서 조치한 뒤 재조회가 끝나기 전에 전체 탭으로 바꾼 상태(탭을 바꾸면 페이지는 0이 된다)
  const current = { status: '', page: 0 }
  assert.deepEqual(viewAfterRefresh(started, current, 0), current)
})

test('재조회 중에 페이지를 옮겼다면 위치를 바꾸지 않는다', () => {
  const started = { status: 'PENDING', page: 2 }
  const current = { status: 'PENDING', page: 1 }
  assert.deepEqual(viewAfterRefresh(started, current, 0), current)
})
