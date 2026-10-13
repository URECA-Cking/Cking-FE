/**
 * 응모 직후 내 응모권 수(myTicketCount)가 baseline보다 늘어난 응답을 받을 때까지 제한적으로 다시 조회한다.
 * BE가 DB 집계를 5초 캐시하고 반영도 비동기라 직후 응답은 응모 전 값일 수 있다. 끝까지 늘지 않으면
 * 마지막 응답을 돌려주지 않는다(옛 수치를 최신처럼 보여주지 않으려는 것).
 * @param {{ fetchStatus: () => Promise<object|undefined>, baseline: number, maxRetries: number, retryMs: number,
 *           wait?: (ms: number) => Promise<void>, cancelled?: () => boolean }} options fetchStatus는 실패하면 undefined
 * @returns {Promise<{ confirmed: true, data: object } | { confirmed: false } | null>} 중간에 정리되면 null
 */
export async function waitForIncrease({
  fetchStatus,
  baseline,
  maxRetries,
  retryMs,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  cancelled = () => false,
}) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const data = await fetchStatus()
    if (cancelled()) return null
    if (data && data.myTicketCount > baseline) return { confirmed: true, data }
    if (attempt < maxRetries) {
      await wait(retryMs)
      if (cancelled()) return null
    }
  }
  return { confirmed: false }
}
