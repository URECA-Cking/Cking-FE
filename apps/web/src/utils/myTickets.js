// 내 응모권(크리에이터 응모권 합계 + 공용 응모권) 요약 계산. 화면과 분리한 순수 함수라 테스트로 보호한다.

/** 헤더 버튼에 숫자를 그대로 보여 줄 최대값. 넘으면 "999+"로 줄인다. */
export const MAX_BADGE_COUNT = 999

/**
 * 헤더 버튼에 쓸 총 응모권 문구.
 * partial(일부 조회 실패)이면 실제로는 더 많을 수 있어 "N+"로 보여 준다. 999를 넘을 때의 "999+"와 같은 모양이다.
 */
export function formatTicketBadge(total, partial = false) {
  if (total > MAX_BADGE_COUNT) return `${MAX_BADGE_COUNT}+`
  return partial ? `${total}+` : String(total)
}

/**
 * 조회한 잔액을 합산한다.
 * - 크리에이터 응모권: 조회에 성공한 크리에이터 잔액의 합(조회에 실패한 크리에이터는 합에서 빠지고 failedIds에 남는다)
 * - 공용 응모권: 조회에 실패하면 commonCount가 null이다(0으로 단정하지 않는다)
 * - total: 두 종류의 합. 일부 조회가 실패하면 partial이 true라 화면이 "일부만 합산"임을 알릴 수 있다.
 *
 * @param {{
 *   common: { balance: number } | null,
 *   creators: Map<number, { balance: number }>,
 *   failedIds: Set<number>,
 * }} data
 */
export function summarizeTickets({ common, creators, failedIds }) {
  const commonCount = typeof common?.balance === 'number' ? common.balance : null
  let creatorTotal = 0
  for (const entry of creators.values()) {
    const balance = Number(entry?.balance)
    if (Number.isFinite(balance)) creatorTotal += balance
  }
  const failedCount = failedIds.size + (commonCount === null ? 1 : 0)
  return {
    commonCount,
    creatorTotal,
    total: (commonCount ?? 0) + creatorTotal,
    failedCount,
    partial: failedCount > 0,
  }
}
