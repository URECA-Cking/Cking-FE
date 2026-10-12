import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COUPON_TYPE,
  MAX_TICKETS_PER_ENTRY,
  applyExpectedBalances,
  clampEntryCount,
  entryLimit,
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
