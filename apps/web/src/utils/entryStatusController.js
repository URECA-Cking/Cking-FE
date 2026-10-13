import { createLatestGate, waitForIncrease } from './entryStatusSettle.js'

/**
 * 이벤트 응모 현황 조회의 상태 흐름. React와 무관하게 두어 단위 테스트할 수 있다(훅은 이걸 감싸기만 한다).
 *
 * - sync({ live, replay, refreshKey })를 의존값이 바뀔 때마다 부른다. live면 pollMs마다 다시 조회한다.
 * - refreshKey가 새 값(null이 아님)으로 바뀌면(응모가 수락됨) 내 응모권 수가 늘 때까지 제한적으로 다시 조회한다.
 *   null로 돌아가는 것(다음 응모 준비)은 신호가 아니다.
 *   그동안과 끝까지 늘지 않았을 때는 응모 전 수치를 최신처럼 보여주지 않으려고 status를 null로 둔다.
 *   이후 주기 조회에서 증가가 확인되면 다시 보여준다. 이 대기 상태는 sync가 다시 불려도 유지한다.
 * - setEntering(true)는 응모 요청을 보내기 시작하는 순간의 내 응모권 수를 응모 전 기준으로 고정한다.
 *   응모 후 재조회가 끝나기 전에 주기 조회가 증가한 값을 받아도 그 값이 기준이 되지 않게 하려는 것이다.
 * - replay(DUPLICATE_REPLAY: 이미 접수된 요청의 재시도)는 응모권이 다시 늘지 않으므로 증가를 기다리지 않는다.
 * - 조회가 겹치면 가장 최근에 시작한 요청의 응답만 반영한다.
 * - 이벤트가 마감돼 live가 아니어도 증가 확인 전에는 recoveryPolls번까지 주기 조회를 이어 간다.
 *   그래도 확인하지 못하면 멈추고, 사용자가 retry()로 다시 확인할 수 있다.
 *
 * @param {{ fetchStatus: () => Promise<object>, onChange: (view: { status: object|null, failed: boolean }) => void,
 *           isVisible?: () => boolean, pollMs?: number, retryMs?: number, maxRetries?: number,
 *           timers?: { setInterval: Function, clearInterval: Function }, wait?: (ms: number) => Promise<void> }} options
 */
export function createEntryStatusController({
  fetchStatus,
  onChange,
  isVisible = () => true,
  // BE가 DB 집계 경로에서 응답을 5초 캐시하므로 주기는 그보다 길게 잡는다.
  pollMs = 10_000,
  // 응모 직후에는 DB 반영(비동기)과 캐시 만료를 기다리며 짧게 다시 묻는다. 6번 × 1.5초 ≈ 9초로 5초 캐시를 넘긴다.
  retryMs = 1_500,
  maxRetries = 6,
  // 마감돼 live가 아닌데 응모 직후 증가를 확인하지 못했을 때 이어 가는 주기 조회 횟수(약 60초)
  recoveryPolls = 6,
  timers = { setInterval, clearInterval },
  wait,
}) {
  // 브라우저의 setInterval은 this가 window여야 하므로, 객체의 메서드로 부르지 않고 떼어 낸 함수로 부른다.
  const { setInterval: startTimer, clearInterval: stopTimer } = timers
  let data = null
  let failed = false
  let waiting = false
  let latest = null // 마지막으로 보여준 응답. 응모 전 기준값의 후보다
  let prevKey
  let frozen = null // 응모 요청을 보내기 시작할 때 고정한 응모 전 기준값
  let pending = null // 응모 직후 아직 증가를 확인하지 못한 기준값
  let generation = 0
  let pollTimer = null
  let bursting = false
  let current = null
  let lastArgs = null
  let recoveryLeft = 0

  const emit = () => onChange({ status: failed || waiting ? null : data, failed })
  function show(next) {
    latest = next
    data = next
    failed = false
    waiting = false
    emit()
  }
  function hide() {
    failed = true
    waiting = false
    emit()
  }

  function stopPoll() {
    if (pollTimer !== null) stopTimer(pollTimer)
    pollTimer = null
  }

  function stopRun() {
    generation += 1
    stopPoll()
    current = null
  }

  function sync({ live = false, replay = false, refreshKey } = {}) {
    stopRun()
    bursting = false
    recoveryLeft = 0
    lastArgs = { live, replay, refreshKey }
    const gen = generation
    const cancelled = () => gen !== generation
    const begin = createLatestGate()

    const baseline = frozen ?? latest?.myTicketCount ?? null
    const afterEntry = refreshKey != null && prevKey !== undefined && prevKey !== refreshKey && baseline !== null
    if (prevKey !== refreshKey) frozen = null
    prevKey = refreshKey
    // 이미 접수된 요청의 재시도(replay)는 응모권이 다시 늘지 않으므로 증가를 기다리지 않고, 이전에 남은 대기도 풀어 준다.
    if (replay) pending = null
    else if (afterEntry) pending = baseline

    // 성공이면 응답, 실패면 undefined, 이미 정리된 뒤면 null
    async function request() {
      try {
        const next = await fetchStatus()
        return cancelled() ? null : next
      } catch {
        return cancelled() ? null : undefined
      }
    }

    async function refresh() {
      const isLatest = begin()
      const next = await request()
      if (next === null || !isLatest()) return
      if (!next) return hide()
      // 응모 직후 증가를 확인하지 못한 동안은 주기 조회가 옛 값을 다시 보여주지 못하게 막는다.
      if (pending !== null) {
        if (next.myTicketCount <= pending) return
        pending = null
      }
      show(next)
    }

    current = { live, refresh }

    if (pending !== null) {
      bursting = true
      waiting = true
      emit()
      waitForIncrease({ fetchStatus: request, baseline: pending, maxRetries, retryMs, wait, cancelled }).then((result) => {
        if (!result) return
        bursting = false
        if (result.confirmed) {
          pending = null
          show(result.data)
        } else {
          recoveryLeft = recoveryPolls
          hide()
        }
      })
    } else {
      refresh()
    }

    // 응모 직후 재조회가 진행 중일 때는 주기 조회를 쉬어 두 조회가 값을 덮어쓰지 않게 한다.
    // 마감돼 live가 아니어도 증가 확인 전에는 제한적으로 이어 간다.
    if (live || pending !== null) {
      pollTimer = startTimer(() => {
        if (!isVisible() || bursting) return
        if (!live) {
          if (pending === null || recoveryLeft <= 0) return stopPoll()
          recoveryLeft -= 1
        }
        refresh()
      }, pollMs)
    }
  }

  return {
    sync,
    setEntering(on) {
      if (on) frozen = latest?.myTicketCount ?? null
    },
    onVisible() {
      if (!current || !isVisible() || bursting) return
      if (current.live || (pending !== null && recoveryLeft > 0)) current.refresh()
    },
    /** 조회를 포기한 뒤 사용자가 다시 확인한다. 증가 확인 전이면 응모 직후 재조회부터 다시 시작한다. */
    retry() {
      if (lastArgs) sync(lastArgs)
    },
    dispose: stopRun,
  }
}
