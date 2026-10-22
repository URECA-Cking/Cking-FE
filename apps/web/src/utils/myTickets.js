// 내 응모권 요약(GET /api/me/tickets) 응답을 화면용 값으로 바꾸는 순수 함수. 화면과 분리해 테스트로 보호한다.

/** 헤더 버튼에 숫자를 그대로 보여 줄 최대값. 넘으면 "999+"로 줄인다. */
export const MAX_BADGE_COUNT = 999

/** 헤더 버튼에 쓸 총 응모권 문구. */
export function formatTicketBadge(total) {
  return total > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(total)
}

function invalid(field) {
  return new Error(`내 응모권 요약 응답이 올바르지 않습니다: ${field}`)
}

function requireNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(field)
  return value
}

/**
 * BE 요약 응답을 화면용으로 정리한다.
 * - 합계(creatorTotal, total)는 서버가 팔로우한 모든 크리에이터 기준으로 계산한 값을 그대로 쓴다. 목록을 나중에 제한해도 합계는 전체 기준이다.
 * - 한 번의 요청이라 일부만 실패하는 경우가 없다. 요청이 실패하거나 응답 모양이 계약과 다르면(응답이 비었거나 숫자가 아닌 값 등)
 *   0으로 바꾸지 않고 예외를 던져, 호출하는 쪽이 오류 경로(헤더 "–", 화면의 다시 시도)로 처리하게 한다. 0장은 BE가 보장하는 정상 값(balance: 0)일 때만 나온다.
 * - 이름·이미지는 표시용이라 비어 있어도 던지지 않는다(이름은 빈 문자열, 이미지는 null).
 *
 * @param {{
 *   common: { balance: number },
 *   creators: Array<{ creatorId: number, creatorName?: string | null, profileImageUrl?: string | null, balance: number }>,
 *   creatorTotal: number,
 *   total: number,
 * }} response
 */
export function normalizeSummary(response) {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) throw invalid('응답')
  if (response.common === null || typeof response.common !== 'object') throw invalid('common')
  if (!Array.isArray(response.creators)) throw invalid('creators')
  const commonCount = requireNumber(response.common.balance, 'common.balance')
  const creators = response.creators.map((creator, index) => {
    if (creator === null || typeof creator !== 'object') throw invalid(`creators[${index}]`)
    return {
      creatorId: requireNumber(creator.creatorId, `creators[${index}].creatorId`),
      name: creator.creatorName ?? '',
      avatar: creator.profileImageUrl ?? null,
      balance: requireNumber(creator.balance, `creators[${index}].balance`),
    }
  })
  return {
    commonCount,
    creators,
    creatorTotal: requireNumber(response.creatorTotal, 'creatorTotal'),
    total: requireNumber(response.total, 'total'),
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
