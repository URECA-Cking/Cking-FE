import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COUPON_TYPE,
  MAX_TICKETS_PER_ENTRY,
  applyExpectedBalances,
  clampEntryCount,
  entryLimit,
  expectedValues,
  planEntry,
  pruneExpected,
  resolveCouponType,
  ticketBalances,
} from '../src/utils/entryTickets.js'

test('이벤트 상세에서 두 잔액을 꺼내고 값이 없으면 0으로 본다', () => {
  assert.deepEqual(ticketBalances({ myTicketBalance: 3, myCommonTicketBalance: 5 }), { CREATOR: 3, COMMON: 5 })
  assert.deepEqual(ticketBalances({ myTicketBalance: 3 }), { CREATOR: 3, COMMON: 0 })
  assert.deepEqual(ticketBalances(null), { CREATOR: 0, COMMON: 0 })
})

test('기본 종류는 크리에이터 응모권이고, 그 잔액이 없을 때만 공용을 쓴다', () => {
  assert.equal(resolveCouponType({ CREATOR: 2, COMMON: 9 }), COUPON_TYPE.CREATOR)
  assert.equal(resolveCouponType({ CREATOR: 0, COMMON: 9 }), COUPON_TYPE.COMMON)
  assert.equal(resolveCouponType({ CREATOR: 0, COMMON: 0 }), COUPON_TYPE.CREATOR)
})

test('사용자가 고른 종류에 잔액이 있으면 그대로 두고, 없으면 기본으로 돌아간다', () => {
  assert.equal(resolveCouponType({ CREATOR: 2, COMMON: 9 }, COUPON_TYPE.COMMON), COUPON_TYPE.COMMON)
  assert.equal(resolveCouponType({ CREATOR: 2, COMMON: 0 }, COUPON_TYPE.COMMON), COUPON_TYPE.CREATOR)
  assert.equal(resolveCouponType({ CREATOR: 0, COMMON: 4 }, COUPON_TYPE.CREATOR), COUPON_TYPE.COMMON)
})

test('한 번에 고를 수 있는 수량은 잔액과 100 중 작은 값이다', () => {
  assert.equal(MAX_TICKETS_PER_ENTRY, 100)
  assert.equal(entryLimit(7), 7)
  assert.equal(entryLimit(100), 100)
  assert.equal(entryLimit(250), 100)
  assert.equal(entryLimit(0), 0)
})

test('선택 수량은 1 이상 한도 이하로 맞추고, 잔액이 없어도 1을 돌려준다', () => {
  assert.equal(clampEntryCount(0, 5), 1)
  assert.equal(clampEntryCount(3, 5), 3)
  assert.equal(clampEntryCount(9, 5), 5)
  assert.equal(clampEntryCount(150, 250), 100)
  assert.equal(clampEntryCount(1, 0), 1)
})

test('응모 직후 서버가 옛 잔액을 줘도 예상 잔액으로 보인다', () => {
  const server = { CREATOR: 5, COMMON: 3 }
  assert.deepEqual(applyExpectedBalances(server, { COMMON: 2 }), { CREATOR: 5, COMMON: 2 })
})

test('서버가 이미 따라잡았거나 더 작으면 서버 값을 보여 이중 차감하지 않는다', () => {
  assert.deepEqual(applyExpectedBalances({ CREATOR: 5, COMMON: 2 }, { COMMON: 2 }), { CREATOR: 5, COMMON: 2 })
  assert.deepEqual(applyExpectedBalances({ CREATOR: 5, COMMON: 1 }, { COMMON: 2 }), { CREATOR: 5, COMMON: 1 })
})

test('예상 잔액이 없으면 서버 값 그대로이고 음수는 0으로 맞춘다', () => {
  assert.deepEqual(applyExpectedBalances({ CREATOR: 5, COMMON: 3 }, null), { CREATOR: 5, COMMON: 3 })
  assert.deepEqual(applyExpectedBalances({ CREATOR: 5, COMMON: 3 }, {}), { CREATOR: 5, COMMON: 3 })
  assert.deepEqual(applyExpectedBalances({ CREATOR: 5, COMMON: 3 }, { CREATOR: -2 }), { CREATOR: 0, COMMON: 3 })
})

test('원본 잔액 객체는 바꾸지 않는다', () => {
  const server = { CREATOR: 5, COMMON: 3 }
  applyExpectedBalances(server, { CREATOR: 1 })
  assert.deepEqual(server, { CREATOR: 5, COMMON: 3 })
})

const T0 = 1_000_000

test('서버가 차감을 반영하면(예상 값 이하) 그 종류의 예상 값을 해제한다', () => {
  const entries = { CREATOR: { value: 4, at: T0 } }
  assert.deepEqual(pruneExpected(entries, { CREATOR: 4, COMMON: 0 }, T0 + 1000), {})
  assert.deepEqual(pruneExpected(entries, { CREATOR: 3, COMMON: 0 }, T0 + 1000), {})
})

test('서버가 아직 옛 값이고 시간이 지나지 않았으면 예상 값을 유지한다', () => {
  const entries = { CREATOR: { value: 4, at: T0 } }
  assert.deepEqual(pruneExpected(entries, { CREATOR: 5, COMMON: 0 }, T0 + 1000), entries)
})

test('시간 제한이 지나면 서버 잔액이 더 커도 예상 값을 해제한다', () => {
  const entries = { CREATOR: { value: 4, at: T0 } }
  assert.deepEqual(pruneExpected(entries, { CREATOR: 7, COMMON: 0 }, T0 + 10_001), {})
  assert.deepEqual(pruneExpected(entries, { CREATOR: 7, COMMON: 0 }, T0 + 10_000), entries)
})

test('차감이 반영된 뒤 다른 곳에서 늘어난 잔액은 정상으로 보인다(회귀)', () => {
  let entries = { CREATOR: { value: 4, at: T0 } }
  // 1) 서버가 차감을 반영(4장) → 예상 값 해제
  entries = pruneExpected(entries, { CREATOR: 4, COMMON: 0 }, T0 + 500)
  // 2) 다른 탭에서 3장 적립 → 서버 7장. 예상 값이 없으니 7장 그대로
  const shown = applyExpectedBalances({ CREATOR: 7, COMMON: 0 }, expectedValues(entries))
  assert.deepEqual(shown, { CREATOR: 7, COMMON: 0 })
})

test('다른 종류의 예상 값은 서로 영향을 주지 않는다', () => {
  const entries = { CREATOR: { value: 4, at: T0 }, COMMON: { value: 0, at: T0 } }
  const next = pruneExpected(entries, { CREATOR: 5, COMMON: 0 }, T0 + 1000)
  assert.deepEqual(Object.keys(next), ['CREATOR'])
  assert.deepEqual(expectedValues(next), { CREATOR: 4 })
})

test('응모 직전 최신 잔액으로 확정한다: 다른 곳에서 늘어난 잔액이 반영된다(리뷰 시나리오)', () => {
  // 앞선 응모의 예상 값은 서버가 따라잡아 이미 해제된 상태에서, 다른 탭의 적립으로 서버가 7장이 됐다.
  assert.deepEqual(planEntry({ myTicketBalance: 7, myCommonTicketBalance: 0 }, {}, null, 1), {
    couponType: 'CREATOR',
    count: 1,
    balance: 7,
  })
})

test('서버가 아직 차감을 반영하지 않은 동안은 예상 잔액으로 확정한다', () => {
  const entries = { CREATOR: { value: 4, at: T0 } }
  const plan = planEntry({ myTicketBalance: 5, myCommonTicketBalance: 0 }, entries, null, 1, T0 + 500)
  assert.equal(plan.balance, 4)
})

test('응모권이 없으면 null이고, 고른 종류가 0장이면 다른 종류로 확정한다', () => {
  assert.equal(planEntry({ myTicketBalance: 0, myCommonTicketBalance: 0 }, {}, null, 1), null)
  assert.deepEqual(planEntry({ myTicketBalance: 0, myCommonTicketBalance: 2 }, {}, 'CREATOR', 1), {
    couponType: 'COMMON',
    count: 1,
    balance: 2,
  })
})

test('고른 수량이 최신 잔액을 넘으면 최신 잔액으로 맞춘다', () => {
  assert.equal(planEntry({ myTicketBalance: 3, myCommonTicketBalance: 0 }, {}, null, 9).count, 3)
  assert.equal(planEntry({ myTicketBalance: 250, myCommonTicketBalance: 0 }, {}, null, 150).count, 100)
})
