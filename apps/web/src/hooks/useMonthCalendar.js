import { useMemo, useState } from 'react'
import {
  NEXT_SCHEDULE_LOOKAHEAD_DAYS,
  buildMonthCells,
  coveredDayKeys,
  dayKey,
  findNextSchedules,
  moveMonthSelection,
} from '../utils/calendarGrid.js'
import { useAsync } from './useAsync.js'

/**
 * 월 달력 화면(StudioCalendar, MyCalendar)의 공통 상태: 보이는 달·선택한 날짜, 일정 조회,
 * 날짜별 일정·고른 날 일정·"다음 일정" 계산, 월/날짜 이동.
 *
 * @param {(from: Date, to: Date) => Promise<Array>} fetchSchedules 기간과 겹치는 일정을 조회하는 API 함수
 * @param {{fallbackMessage?: string}} options
 *
 * 달력 격자의 점은 보이는 달까지만 쓰지만, 조회는 다음 일정을 찾기 위해 그 뒤 lookahead 기간까지 가져온다
 * (UpcomingSchedules의 60일 기준과 같다). 한 번에 조회하는 기간은 약 91일이라 백엔드의 365일 제한 안이다.
 */
export function useMonthCalendar(fetchSchedules, { fallbackMessage } = {}) {
  const today = new Date()
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedKey, setSelectedKey] = useState(() => dayKey(today))

  const monthStart = month
  const monthEnd = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 1), [month])
  const lookaheadEnd = useMemo(
    () => new Date(monthEnd.getTime() + NEXT_SCHEDULE_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000),
    [monthEnd],
  )

  const { data, loading, error, reload, setData } = useAsync(
    () => fetchSchedules(monthStart, lookaheadEnd),
    [monthStart.getTime(), lookaheadEnd.getTime()],
    { fallbackMessage },
  )

  const schedulesByDay = useMemo(() => {
    const map = new Map()
    ;(data ?? []).forEach((schedule) => {
      coveredDayKeys(schedule, monthStart, monthEnd).forEach((key) => {
        map.set(key, [...(map.get(key) ?? []), schedule])
      })
    })
    return map
  }, [data, monthStart, monthEnd])

  const cells = useMemo(() => buildMonthCells(month), [month])
  const selectedDate = useMemo(
    () => cells.find((cell) => !cell.blank && cell.key === selectedKey),
    [cells, selectedKey],
  )
  const selectedSchedules = useMemo(
    () => (schedulesByDay.get(selectedKey) ?? []).slice().sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
    [schedulesByDay, selectedKey],
  )
  // 고른 날에 일정이 없으면 조회 범위 안에서 선택일 이후 가장 가까운 날의 일정을 모두 보여준다.
  const nextSchedules = useMemo(() => {
    if (selectedSchedules.length > 0 || !selectedDate) return []
    const selectedDayEnd = new Date(month.getFullYear(), month.getMonth(), selectedDate.day, 23, 59, 59, 999)
    return findNextSchedules(data ?? [], selectedDayEnd)
  }, [data, selectedSchedules, selectedDate, month])

  function moveMonth(offset) {
    const next = moveMonthSelection(month, offset, today)
    setMonth(next.month)
    setSelectedKey(next.selectedKey)
  }

  function goToToday() {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedKey(dayKey(today))
  }

  // 월 경계를 넘는 일정도 따라가도록 보이는 달과 선택 날짜를 함께 옮긴다.
  function selectSchedule(schedule) {
    const target = new Date(schedule.startAt)
    setMonth(new Date(target.getFullYear(), target.getMonth(), 1))
    setSelectedKey(dayKey(target))
  }

  return {
    month,
    cells,
    selectedKey,
    setSelectedKey,
    selectedDate,
    isTodaySelected: selectedKey === dayKey(today),
    schedulesByDay,
    selectedSchedules,
    nextSchedules,
    moveMonth,
    goToToday,
    selectSchedule,
    data,
    loading,
    error,
    reload,
    setData,
  }
}
