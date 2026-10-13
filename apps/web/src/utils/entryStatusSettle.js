/**
 * 응모 직후 반영을 확인할 수 있는 응답(isConfirmed)을 받을 때까지 제한적으로 다시 조회한다.
 * BE가 DB 집계를 5초 캐시하고 반영도 비동기라 직후 응답은 응모 전 값일 수 있다. 끝까지 확인하지 못하면
 * 마지막 응답을 돌려주지 않는다(옛 수치를 최신처럼 보여주지 않으려는 것).
 * @param {{ fetchStatus: () => Promise<object|undefined>, isConfirmed: (data: object) => boolean, maxRetries: number,
 *           retryMs: number, wait?: (ms: number) => Promise<void>, cancelled?: () => boolean }} options fetchStatus는 실패하면 undefined
 * @returns {Promise<{ confirmed: true, data: object } | { confirmed: false } | null>} 중간에 정리되면 null
 */
export async function waitUntilConfirmed({
  fetchStatus,
  isConfirmed,
  maxRetries,
  retryMs,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  cancelled = () => false,
}) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const data = await fetchStatus()
    if (cancelled()) return null
    if (data && isConfirmed(data)) return { confirmed: true, data }
    if (attempt < maxRetries) {
      await wait(retryMs)
      if (cancelled()) return null
    }
  }
  return { confirmed: false }
}

/**
 * 가장 최근에 시작한 요청의 응답만 반영하게 하는 문지기. 주기 조회와 탭 복귀 조회가 겹칠 때
 * 늦게 도착한 오래된 응답이 최신 값을 덮어쓰지 못하게 한다.
 * @returns {() => () => boolean} begin()을 호출해 요청을 시작하고, 돌려받은 함수가 true일 때만 응답을 반영한다
 */
export function createLatestGate() {
  let seq = 0
  return () => {
    const mine = ++seq
    return () => mine === seq
  }
}
