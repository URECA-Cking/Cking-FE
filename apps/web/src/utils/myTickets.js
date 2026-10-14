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

/**
 * 적립·응모 직후의 다시 불러오기를 맡는 스케줄러. 서버의 DB 반영이 비동기라 바로 불러온 값이 아직 이전 값일 수 있어서,
 * start() 때 바로 한 번 run()하고, 값(getValue)이 시작 때와 같으면 gapsMs 간격으로 한정된 횟수만큼 다시 run()한다.
 * 값이 바뀌면(반영을 확인하면) 멈춘다.
 * 앞선 start()의 재조회가 아직 남아 있을 때 다시 start()하면, 지금 보이는 변화가 앞선 행동 때문일 수 있어
 * 이번 행동의 반영까지 확인할 수 없으므로 값이 바뀌어도 멈추지 않고 정해진 횟수를 끝까지 한다.
 * 새로 start()하면 대기 중이던 재조회는 취소하고 마지막 호출 기준으로 다시 시작한다.
 *
 * @param {{
 *   gapsMs: number[],
 *   getValue: () => unknown,
 *   run: () => void,
 *   schedule?: typeof setTimeout,
 *   cancel?: typeof clearTimeout,
 * }} options
 */
export function createRetryScheduler({ gapsMs, getValue, run, schedule = setTimeout, cancel = clearTimeout }) {
  let timer = null
  let active = false

  function start() {
    const baseline = getValue()
    const overlapping = active
    active = true
    cancel(timer)
    run()
    const step = (attempt) => {
      timer = schedule(() => {
        if (!overlapping && getValue() !== baseline) {
          active = false
          return
        }
        run()
        if (attempt + 1 < gapsMs.length) step(attempt + 1)
        else active = false
      }, gapsMs[attempt])
    }
    step(0)
  }

  function stop() {
    cancel(timer)
    active = false
  }

  return { start, stop }
}
