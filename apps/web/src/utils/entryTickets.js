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

/** 응모 직후 예상 잔액을 기억해 두는 최대 시간. DB 반영은 보통 이보다 훨씬 빨리 끝난다. */
export const EXPECTED_TTL_MS = 10_000

/** 응모 직후 DB 반영이 끝났을 즈음 한 번 더 잔액을 불러오는 시점. 서버가 따라잡았으면 예상 값을 일찍 해제한다. */
export const EXPECTED_SYNC_MS = 1_500

/**
 * 응모 직후에는 DB 반영이 비동기라 서버가 잠깐 옛 잔액을 돌려줄 수 있다. 그래서 응모가 수락된 종류는
 * "응모 후 예상 잔액"을 기억해 두고, 화면에는 서버 값과 예상 값 중 작은 쪽을 보여 준다.
 * 서버가 아직 옛 값이면 예상 값이, 이미 따라잡았으면 서버 값이 보이므로 이중 차감이 생기지 않는다.
 * 예상 값은 {@link pruneExpected}로 서버가 따라잡거나 시간이 지나면 해제한다.
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
 * 예상 잔액 기록(entries: { 종류: { value, at } }) 중 더는 필요 없는 것을 해제한다.
 * - 서버 잔액이 예상 값 이하이면 서버가 차감을 반영한 것이라 해제한다.
 * - 기록한 지 ttlMs가 지났으면 해제한다. 그 사이 다른 곳에서 응모권이 늘어 서버 잔액이 예상 값보다 커진 경우에도
 *   옛 예상 값이 계속 상한으로 남지 않게 하려는 것이다.
 * @param {Record<string, {value: number, at: number}> | null | undefined} entries
 * @param {{CREATOR: number, COMMON: number}} serverBalances 서버 잔액
 * @param {number} now 현재 시각(ms)
 */
export function pruneExpected(entries, serverBalances, now, ttlMs = EXPECTED_TTL_MS) {
  const next = {}
  for (const [type, entry] of Object.entries(entries ?? {})) {
    const caughtUp = serverBalances[type] <= entry.value
    const expired = now - entry.at > ttlMs
    if (!caughtUp && !expired) next[type] = entry
  }
  return next
}

/** 예상 잔액 기록에서 값만 꺼낸다({ 종류: value }). */
export function expectedValues(entries) {
  return Object.fromEntries(Object.entries(entries ?? {}).map(([type, entry]) => [type, entry.value]))
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

/**
 * 응모 직전에 받은 최신 이벤트로 이번에 응모할 종류·수량·잔액을 확정한다. 화면을 열어 둔 사이 다른 곳에서 응모권이
 * 바뀌었어도 최신 서버 잔액을 기준으로 삼기 위한 것이다. 쓸 수 있는 응모권이 없으면 null을 돌려준다.
 * @param {object} event 최신 이벤트 상세
 * @param {Record<string, {value: number, at: number}> | null | undefined} expectedEntries 기억해 둔 예상 잔액
 * @param {string | null} chosenType 사용자가 고른 종류(없으면 null)
 * @param {number} ticketCount 사용자가 고른 수량
 */
export function planEntry(event, expectedEntries, chosenType, ticketCount, now = Date.now()) {
  const server = ticketBalances(event)
  const live = pruneExpected(expectedEntries, server, now)
  const balances = applyExpectedBalances(server, expectedValues(live))
  const couponType = resolveCouponType(balances, chosenType)
  const balance = balances[couponType]
  if (balance <= 0) return null
  return { couponType, count: clampEntryCount(ticketCount, balance), balance }
}
