import { createLatestGate, waitUntilConfirmed } from './entryStatusSettle.js'

/**
 * 이벤트 응모 현황 조회의 상태 흐름. React와 무관하게 두어 단위 테스트할 수 있다(훅은 이걸 감싸기만 한다).
 *
 * - sync({ live })를 의존값이 바뀔 때마다 부른다. live면 pollMs마다 다시 조회한다.
 * - 응모는 beginEntry(요청을 보내기 시작)와 acceptEntry(수락됨)로 알린다. 수락된 응모가 현황(myTicketCount)에
 *   반영됐는지는 "필요 수치"로 판단한다. 필요 수치는 응모 시작 시점의 기준(이미 확인을 기다리는 응모들의 필요 수치와
 *   마지막으로 본 수치 중 큰 값)에 그 응모의 수량을 더한 값이다. 그래서
 *   · 첫 응모가 확인되기 전에 두 번째가 수락돼도 두 응모가 모두 반영돼야 보여준다(필요 수치가 누적된다).
 *   · 응답을 못 받아 같은 requestId로 재시도해 DUPLICATE_REPLAY가 와도 처음 기록한 필요 수치로 확인한다.
 *   · 기준을 몰랐던 응모는 숫자로 반영 여부를 증명할 수 없다. realtime(Redis 집계, 수락 기준) 응답이거나
 *     수락 후 unverifiedGraceMs가 지난 응답일 때만 보여준다.
 *   확인되기 전과 끝까지 확인하지 못했을 때는 응모 전 수치를 최신처럼 보여주지 않으려고 status를 null로 둔다.
 *   이후 주기 조회에서 확인되면 다시 보여준다. 이 대기 상태는 sync가 다시 불려도 유지한다.
 * - 조회가 겹치면 가장 최근에 시작한 요청의 응답만 반영한다.
 * - 이벤트가 마감돼 live가 아니어도 확인 전에는 recoveryPolls번까지 주기 조회를 이어 간다.
 *   그래도 확인하지 못하면 멈추고, 사용자가 retry()로 다시 확인할 수 있다.
 *
 * @param {{ fetchStatus: () => Promise<object>, onChange: (view: { status: object|null, failed: boolean }) => void,
 *           isVisible?: () => boolean, pollMs?: number, retryMs?: number, maxRetries?: number, recoveryPolls?: number,
 *           unverifiedGraceMs?: number, now?: () => number,
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
  // 마감돼 live가 아닌데 응모 직후 반영을 확인하지 못했을 때 이어 가는 주기 조회 횟수(약 60초)
  recoveryPolls = 6,
  // 기준 없이 수락된 응모를 숫자로 확인할 수 없을 때 기다리는 시간. BE 캐시 5초와 비동기 반영 지연보다 길게 잡는다.
  unverifiedGraceMs = 15_000,
  now = Date.now,
  timers = { setInterval, clearInterval },
  wait,
}) {
  // 브라우저의 setInterval은 this가 window여야 하므로, 객체의 메서드로 부르지 않고 떼어 낸 함수로 부른다.
  const { setInterval: startTimer, clearInterval: stopTimer } = timers

  let data = null
  let failed = false
  let waiting = false
  let latest = null // 마지막으로 보여준 응답
  let pending = null // 수락됐지만 반영을 확인하지 못한 응모들이 모두 반영됐을 때의 최소 내 응모권 수
  let unverifiedSince = null // 기준 없이 수락된 응모의 수락 시각
  const submissions = new Map() // requestId → { target: 필요 수치(기준을 몰랐으면 null), accepted }
  let generation = 0
  let pollTimer = null
  let bursting = false
  let current = null
  let lastArgs = null
  let recoveryLeft = 0

  const isWaiting = () => pending !== null || unverifiedSince !== null
  function isConfirmed(next) {
    if (pending !== null && next.myTicketCount < pending) return false
    if (unverifiedSince !== null && next.realtime !== true && now() - unverifiedSince < unverifiedGraceMs) return false
    return true
  }
  function clearWaiting() {
    pending = null
    unverifiedSince = null
  }

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

  function sync({ live = false } = {}) {
    stopRun()
    bursting = false
    recoveryLeft = 0
    lastArgs = { live }
    const gen = generation
    const cancelled = () => gen !== generation
    const begin = createLatestGate()

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
      // 응모 직후 반영을 확인하지 못한 동안은 주기 조회가 옛 값을 다시 보여주지 못하게 막는다.
      if (isWaiting()) {
        if (!isConfirmed(next)) return
        clearWaiting()
      }
      show(next)
    }

    current = { live, refresh }

    if (isWaiting()) {
      bursting = true
      waiting = true
      emit()
      // 기준 없이 수락된 응모는 유예 시간이 지난 응답을 받을 수 있도록 재시도를 그 시간만큼 이어 간다.
      const retries = unverifiedSince !== null ? Math.max(maxRetries, Math.ceil(unverifiedGraceMs / retryMs) + 1) : maxRetries
      waitUntilConfirmed({ fetchStatus: request, isConfirmed, maxRetries: retries, retryMs, wait, cancelled }).then((result) => {
        if (!result) return
        bursting = false
        if (result.confirmed) {
          clearWaiting()
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
    // 마감돼 live가 아니어도 확인 전에는 제한적으로 이어 간다.
    if (live || isWaiting()) {
      pollTimer = startTimer(() => {
        if (!isVisible() || bursting) return
        if (!live) {
          if (!isWaiting() || recoveryLeft <= 0) return stopPoll()
          recoveryLeft -= 1
        }
        refresh()
      }, pollMs)
    }
  }

  return {
    sync,
    /** 응모 요청을 보내기 시작한다. 같은 requestId의 재시도(응답을 못 받은 경우)는 처음 기록한 기준을 유지한다. */
    beginEntry(requestId, count) {
      if (submissions.has(requestId)) return
      const known = [pending, latest?.myTicketCount].filter((value) => value !== null && value !== undefined)
      const base = known.length > 0 ? Math.max(...known) : null
      submissions.set(requestId, { target: base === null ? null : base + count, accepted: false })
    },
    /** 응모가 수락됐다(SUCCESS와 DUPLICATE_REPLAY 모두). 반영이 확인될 때까지 현황을 숨기고 다시 조회한다. */
    acceptEntry(requestId) {
      const sub = submissions.get(requestId)
      if (sub?.accepted) return
      if (sub) sub.accepted = true
      if (sub && sub.target !== null) pending = Math.max(pending ?? 0, sub.target)
      else unverifiedSince = unverifiedSince ?? now()
      if (lastArgs) sync(lastArgs)
    },
    onVisible() {
      if (!current || !isVisible() || bursting) return
      if (current.live || (isWaiting() && recoveryLeft > 0)) current.refresh()
    },
    /** 조회를 포기한 뒤 사용자가 다시 확인한다. 반영 확인 전이면 응모 직후 재조회부터 다시 시작한다. */
    retry() {
      if (lastArgs) sync(lastArgs)
    },
    dispose: stopRun,
  }
}
