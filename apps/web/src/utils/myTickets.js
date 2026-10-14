// 내 응모권 요약(GET /api/me/tickets) 응답을 화면용 값으로 바꾸는 순수 함수. 화면과 분리해 테스트로 보호한다.

/** 헤더 버튼에 숫자를 그대로 보여 줄 최대값. 넘으면 "999+"로 줄인다. */
export const MAX_BADGE_COUNT = 999

/** 헤더 버튼에 쓸 총 응모권 문구. */
export function formatTicketBadge(total) {
  return total > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(total)
}

function toCount(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

/**
 * BE 요약 응답을 화면용으로 정리한다.
 * - 합계(creatorTotal, total)는 서버가 팔로우한 모든 크리에이터 기준으로 계산한 값을 그대로 쓴다. 목록을 나중에 제한해도 합계는 전체 기준이다.
 *   (값이 빠진 응답에 한해 목록·공용 잔액으로 대신 계산한다.)
 * - 한 번의 요청이라 일부만 실패하는 경우가 없다. 실패하면 이 함수까지 오지 않고, 호출하는 쪽이 0으로 단정하지 않고 "알 수 없음"으로 둔다.
 *
 * @param {{
 *   common?: { balance?: number },
 *   creators?: Array<{ creatorId: number, creatorName?: string, profileImageUrl?: string | null, balance?: number }>,
 *   creatorTotal?: number,
 *   total?: number,
 * } | null | undefined} response
 */
export function normalizeSummary(response) {
  const commonCount = toCount(response?.common?.balance, 0)
  const creators = (response?.creators ?? []).map((creator) => ({
    creatorId: creator.creatorId,
    name: creator.creatorName ?? '',
    avatar: creator.profileImageUrl ?? null,
    balance: toCount(creator.balance, 0),
  }))
  const creatorTotal = toCount(response?.creatorTotal, creators.reduce((sum, creator) => sum + creator.balance, 0))
  return {
    commonCount,
    creators,
    creatorTotal,
    total: toCount(response?.total, commonCount + creatorTotal),
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
