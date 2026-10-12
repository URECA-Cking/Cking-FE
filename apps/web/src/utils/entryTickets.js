// 응모에 쓸 응모권 종류(couponType)와 수량을 계산하는 순수 함수. BE 계약은 docs/domains/event/entry-api.md.

/** 한 번의 응모 요청으로 쓸 수 있는 최대 장수(BE ticketCount 1~100). */
export const MAX_TICKETS_PER_ENTRY = 100

export const COUPON_TYPE = { CREATOR: 'CREATOR', COMMON: 'COMMON' }

/** 이벤트 상세 응답에서 두 종류의 잔액을 꺼낸다. 값이 없으면 0으로 본다. */
export function ticketBalances(event) {
  return {
    [COUPON_TYPE.CREATOR]: Math.max(0, Number(event?.myTicketBalance ?? 0)),
    [COUPON_TYPE.COMMON]: Math.max(0, Number(event?.myCommonTicketBalance ?? 0)),
  }
}

/**
 * 응모 직후에는 DB 반영이 비동기라 서버가 잠깐 옛 잔액을 돌려줄 수 있다. 그래서 응모가 수락된 종류는
 * "응모 후 예상 잔액"을 기억해 두고, 화면에는 서버 값과 예상 값 중 작은 쪽을 보여 준다.
 * 서버가 아직 옛 값이면 예상 값이, 이미 따라잡았으면 서버 값이 보이므로 이중 차감이 생기지 않는다.
 * @param {{CREATOR: number, COMMON: number}} balances 서버 잔액
 * @param {Partial<{CREATOR: number, COMMON: number}> | null | undefined} expected 종류별 응모 후 예상 잔액
 */
export function applyExpectedBalances(balances, expected) {
  const next = { ...balances }
  for (const type of Object.keys(next)) {
    if (expected && Number.isFinite(expected[type])) {
      next[type] = Math.min(next[type], Math.max(0, expected[type]))
    }
  }
  return next
}

/**
 * 사용자가 고른 종류가 쓸 수 있으면 그대로, 아니면(고른 적 없거나 잔액이 없으면) 기본 종류를 돌려준다.
 * 기본은 크리에이터 응모권이고, 그 잔액이 없을 때만 공용 응모권이다.
 */
export function resolveCouponType(balances, chosen) {
  if (chosen && balances[chosen] > 0) return chosen
  if (balances[COUPON_TYPE.CREATOR] > 0) return COUPON_TYPE.CREATOR
  if (balances[COUPON_TYPE.COMMON] > 0) return COUPON_TYPE.COMMON
  return COUPON_TYPE.CREATOR
}

/** 한 번에 고를 수 있는 최대 수량: min(잔액, 100). */
export function entryLimit(balance) {
  return Math.min(Math.max(0, balance), MAX_TICKETS_PER_ENTRY)
}

/** 선택 수량을 1 이상, 한도 이하로 맞춘다. 잔액이 없어도 화면 계산이 깨지지 않게 최소 1을 돌려준다. */
export function clampEntryCount(count, balance) {
  return Math.min(Math.max(1, count), Math.max(1, entryLimit(balance)))
}
