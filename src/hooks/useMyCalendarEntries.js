import { useCallback, useMemo, useRef, useState } from 'react'
import { describeError } from '../api/client.js'
import { MY_CALENDAR_ERROR_MESSAGES, addToMyCalendar, getMyCalendar, removeFromMyCalendar } from '../api/calendar.js'
import { useToast } from '../context/useToast.js'
import { useAsync } from './useAsync.js'

/**
 * 크리에이터 스페이스 캘린더에서 "내 캘린더에 담기/빼기"를 하기 위한 훅.
 * 담김 여부를 단건 조회하는 API가 없어서, 보고 있는 기간의 GET /api/me/calendar/schedules 결과로 판별한다.
 *
 * @param {{from: Date, to: Date, enabled: boolean, onScheduleGone?: () => void}} options
 *   onScheduleGone: 담으려는 일정을 그사이 크리에이터가 삭제한 경우(RESOURCE_NOT_FOUND) 목록을 다시 불러오는 데 쓴다.
 */
export function useMyCalendarEntries({ from, to, enabled, onScheduleGone }) {
  const showToast = useToast()
  // 일정마다 따로 잠가야 해서(같은 날 여러 개) 진행 중인 id를 모은다. ref는 연타로 같은 요청이 겹치는 것을 막는다.
  const inFlight = useRef(new Set())
  const [busyIds, setBusyIds] = useState(() => new Set())
  // 이 화면에서 사용자가 바꾼 담김 여부. 월을 옮기며 시작된 조회가 요청보다 늦게/먼저 도착해
  // 목록을 통째로 교체해도 사용자의 마지막 행동이 이기도록 조회 결과 위에 덮어 쓴다.
  const [overrides, setOverrides] = useState(() => new Map())

  const { data, loading, error, reload } = useAsync(
    () => getMyCalendar(from, to),
    [from.getTime(), to.getTime()],
    { enabled, fallbackMessage: '내 캘린더를 불러오지 못했어요.' },
  )
  const fetchedIds = useMemo(() => new Set((data ?? []).map((entry) => entry.scheduleId)), [data])
  const isAdded = useCallback(
    (scheduleId) => (overrides.has(scheduleId) ? overrides.get(scheduleId) : fetchedIds.has(scheduleId)),
    [overrides, fetchedIds],
  )

  const toggle = useCallback(
    async (scheduleId) => {
      if (inFlight.current.has(scheduleId)) return
      const added = isAdded(scheduleId)
      inFlight.current.add(scheduleId)
      setBusyIds(new Set(inFlight.current))
      try {
        if (added) await removeFromMyCalendar(scheduleId)
        else await addToMyCalendar(scheduleId)
        setOverrides((current) => new Map(current).set(scheduleId, !added))
        showToast(added ? '내 캘린더에서 뺐어요.' : '내 캘린더에 담았어요.')
      } catch (err) {
        const message = MY_CALENDAR_ERROR_MESSAGES[err?.code] ?? describeError(err, '내 캘린더를 바꾸지 못했어요.')
        showToast(message, { icon: 'error' })
        if (err?.code === 'RESOURCE_NOT_FOUND') onScheduleGone?.()
      } finally {
        inFlight.current.delete(scheduleId)
        setBusyIds(new Set(inFlight.current))
      }
    },
    [isAdded, showToast, onScheduleGone],
  )

  return {
    // 담김 여부를 알 수 있을 때만 버튼을 활성화한다(조회 중이거나 실패하면 상태를 모른다).
    ready: enabled && !loading && !error && data !== null,
    // 조회가 실패하면 버튼이 계속 잠겨 있으므로 이유와 재시도 수단을 화면이 보여줄 수 있게 내보낸다.
    error: enabled ? error : null,
    reload,
    isAdded,
    isBusy: (scheduleId) => busyIds.has(scheduleId),
    toggle,
  }
}
