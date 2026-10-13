import { useEffect, useRef, useState } from 'react'
import { getEntryStatus } from '../api/entries.js'
import { waitForIncrease } from '../utils/entryStatusSettle.js'

// BE가 DB 집계 경로에서 응답을 5초 캐시하므로 그보다 길게 잡는다.
const POLL_MS = 10_000
// 응모 직후에는 DB 반영(비동기)과 캐시 만료를 기다리며 짧게 다시 묻는다. 6번 × 1.5초 ≈ 9초로 5초 캐시를 넘긴다.
const RETRY_MS = 1_500
const MAX_RETRIES = 6

const INITIAL = { eventId: null, data: null, failed: false, waiting: false }

/**
 * 이벤트 응모 현황(GET /api/events/{id}/entry-status)을 조회한다. 표시용 값이다.
 * - live(진행 중)이면 화면이 보이는 동안 POLL_MS마다 다시 조회한다.
 * - refreshKey가 바뀌면(응모 후 이벤트 상세를 다시 받음) 내 응모권 수가 늘 때까지 제한적으로 다시 조회한다.
 *   그동안과, 끝까지 늘지 않았을 때는 응모 전 수치를 최신처럼 보여주지 않으려고 값을 내보내지 않는다.
 *   이후 주기 조회에서 증가가 확인되면 다시 보여준다.
 * @returns {{ status: object|null, failed: boolean }} status가 null이면 값이 없거나 믿을 수 없는 상태
 */
export function useEntryStatus(eventId, { enabled, live, refreshKey }) {
  const [state, setState] = useState(INITIAL)
  const latest = useRef(null)
  const prevKey = useRef(undefined)
  const owner = useRef(null)

  useEffect(() => {
    if (!enabled) return undefined
    // 다른 이벤트로 바뀌면 이전 이벤트의 기준값을 버린다(상태는 eventId로 걸러 읽는다).
    if (owner.current !== eventId) {
      owner.current = eventId
      latest.current = null
      prevKey.current = undefined
    }
    let cancelled = false
    // 응모 직후 증가를 확인하지 못한 동안은 주기 조회가 옛 값을 다시 보여주지 못하게 막는다.
    let unconfirmed = false
    // 응모 직후 재조회가 진행 중일 때는 주기 조회를 쉬어 두 조회가 값을 덮어쓰지 않게 한다.
    let bursting = false
    const baseline = latest.current?.myTicketCount ?? null
    const afterEntry = prevKey.current !== undefined && prevKey.current !== refreshKey && baseline !== null
    prevKey.current = refreshKey

    // 성공이면 응답, 실패면 undefined, 이미 정리된 뒤면 null
    async function fetchStatus() {
      try {
        const data = await getEntryStatus(eventId)
        return cancelled ? null : data
      } catch {
        return cancelled ? null : undefined
      }
    }

    const base = (prev) => (prev.eventId === eventId ? prev : { ...INITIAL, eventId })
    function show(data) {
      latest.current = data
      setState({ eventId, data, failed: false, waiting: false })
    }
    function hide() {
      setState((prev) => ({ ...base(prev), failed: true, waiting: false }))
    }

    async function refresh() {
      const data = await fetchStatus()
      if (data === null) return
      if (!data) return hide()
      if (unconfirmed) {
        if (data.myTicketCount <= baseline) return
        unconfirmed = false
      }
      show(data)
    }

    if (afterEntry) {
      unconfirmed = true
      bursting = true
      setState((prev) => ({ ...base(prev), waiting: true }))
      waitForIncrease({
        fetchStatus,
        baseline,
        maxRetries: MAX_RETRIES,
        retryMs: RETRY_MS,
        cancelled: () => cancelled,
      }).then((result) => {
        if (!result) return
        bursting = false
        if (result.confirmed) {
          unconfirmed = false
          show(result.data)
        } else {
          hide()
        }
      })
    } else {
      refresh()
    }

    const poll = live
      ? setInterval(() => {
          if (document.visibilityState === 'visible' && !bursting) refresh()
        }, POLL_MS)
      : null
    const onVisible = () => {
      if (live && document.visibilityState === 'visible' && !bursting) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      if (poll) clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [eventId, enabled, live, refreshKey])

  // 다른 이벤트에서 받은 값은 이 이벤트의 것이 아니므로 쓰지 않는다.
  const mine = state.eventId === eventId ? state : INITIAL
  return { status: mine.failed || mine.waiting ? null : mine.data, failed: mine.failed }
}
