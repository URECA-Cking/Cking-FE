import { useEffect, useRef, useState } from 'react'
import { getEntryStatus } from '../api/entries.js'

// BE가 DB 집계 경로에서 응답을 5초 캐시하므로 그보다 길게 잡는다.
const POLL_MS = 10_000
// 응모 직후에는 DB 반영(비동기)과 캐시 만료를 기다리며 짧게 다시 묻는다. 6번 × 1.5초 ≈ 9초로 5초 캐시를 넘긴다.
const RETRY_MS = 1_500
const MAX_RETRIES = 6

const INITIAL = { eventId: null, data: null, failed: false, waiting: false }

/**
 * 이벤트 응모 현황(GET /api/events/{id}/entry-status)을 조회한다. 표시용 값이다.
 * - live(진행 중)이면 화면이 보이는 동안 POLL_MS마다 다시 조회한다.
 * - refreshKey가 바뀌면(응모 후 이벤트 상세를 다시 받음) 내 응모권 수가 늘 때까지 제한적으로 다시 조회하고,
 *   그동안·조회에 실패했을 때는 이전 값을 내보내지 않는다(응모 전 수치를 최신처럼 보여주지 않으려는 것).
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
    let timer
    let bursting = false
    const baseline = latest.current?.myTicketCount ?? null
    const afterEntry = prevKey.current !== undefined && prevKey.current !== refreshKey && baseline !== null
    prevKey.current = refreshKey

    // 성공이면 응답, 실패면 undefined, 이미 정리된 뒤면 null
    async function fetchStatus() {
      try {
        const data = await getEntryStatus(eventId)
        if (cancelled) return null
        latest.current = data
        return data
      } catch {
        return cancelled ? null : undefined
      }
    }

    function apply(data) {
      setState((prev) => {
        const base = prev.eventId === eventId ? prev : { ...INITIAL, eventId }
        return data ? { eventId, data, failed: false, waiting: false } : { ...base, failed: true, waiting: false }
      })
    }

    async function refresh() {
      const data = await fetchStatus()
      if (data !== null) apply(data)
    }

    async function settleAfterEntry(attempt) {
      const data = await fetchStatus()
      if (data === null) return
      const notYet = data === undefined || data.myTicketCount <= baseline
      if (notYet && attempt < MAX_RETRIES) {
        timer = setTimeout(() => settleAfterEntry(attempt + 1), RETRY_MS)
        return
      }
      bursting = false
      apply(data)
    }

    if (afterEntry) {
      bursting = true
      setState((prev) => ({ ...(prev.eventId === eventId ? prev : { ...INITIAL, eventId }), waiting: true }))
      settleAfterEntry(0)
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
      clearTimeout(timer)
      if (poll) clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [eventId, enabled, live, refreshKey])

  // 다른 이벤트에서 받은 값은 이 이벤트의 것이 아니므로 쓰지 않는다.
  const mine = state.eventId === eventId ? state : INITIAL
  return { status: mine.failed || mine.waiting ? null : mine.data, failed: mine.failed }
}
