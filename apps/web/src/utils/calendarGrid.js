// 월 단위 캘린더 그리드 공용 로직. 일정이 있는 날짜에 점을 찍는 화면(CreatorCalendar, StudioCalendar)에서 함께 쓴다.
// 날짜 구분·표시는 사용자 브라우저 시간대 기준이다(일정의 startAt·endAt은 UTC Instant).

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// "다음 일정" 미리보기는 달력에 보이는 달을 넘어서도 찾는다 — 이번 달에 더 이상 일정이 없을 때
// 다음 달 일정까지 조회 범위를 넓혀서 검색한다(UpcomingSchedules의 60일 기준과 동일하게 맞췄다).
export const NEXT_SCHEDULE_LOOKAHEAD_DAYS = 60

export const dayKey = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

/** 일정이 걸친 날짜 키 목록([rangeStart, rangeEnd) 안으로 자르고, endAt은 포함하지 않는다). */
export function coveredDayKeys(schedule, rangeStart, rangeEnd) {
  const keys = []
  const start = new Date(Math.max(new Date(schedule.startAt).getTime(), rangeStart.getTime()))
  const lastMoment = new Date(Math.min(new Date(schedule.endAt).getTime() - 1, rangeEnd.getTime() - 1))
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  while (cursor <= lastMoment) {
    keys.push(dayKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

/** month(해당 월 1일)의 달력 셀 목록. 앞쪽은 요일 맞춤용 빈 칸, 뒤쪽은 1일부터 말일까지. */
export function buildMonthCells(month) {
  const blanks = Array.from({ length: month.getDay() }, (_, index) => ({ blank: true, key: `blank-${index}` }))
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth(), index + 1)
    return { blank: false, key: dayKey(date), day: index + 1, weekday: date.getDay() }
  })
  return [...blanks, ...days]
}

/**
 * offset만큼 달을 옮긴 뒤 선택할 날짜를 정한다 — 옮긴 달이 실제 이번 달이면 오늘, 아니면 1일.
 * 월 이동 버튼을 쓰는 화면(CreatorCalendar, StudioCalendar)에서 공통으로 쓴다.
 */
export function moveMonthSelection(month, offset, today) {
  const next = new Date(month.getFullYear(), month.getMonth() + offset, 1)
  const isCurrentMonth = next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()
  return { month: next, selectedKey: dayKey(isCurrentMonth ? today : next) }
}

/** 일정 시각(UTC Instant)을 사용자 브라우저 시간대의 "오전 11:00" 형식으로 보여준다. */
export function formatScheduleTime(iso) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

/** 같은 날이면 "오전 11:00 – 오후 02:00", 여러 날에 걸치면 날짜를 함께 보여준다. */
export function formatScheduleRange(schedule) {
  const start = new Date(schedule.startAt)
  const end = new Date(schedule.endAt)
  if (dayKey(start) === dayKey(new Date(end.getTime() - 1))) {
    return `${formatScheduleTime(schedule.startAt)} – ${formatScheduleTime(schedule.endAt)}`
  }
  const date = (d) => `${d.getMonth() + 1}/${d.getDate()}`
  return `${date(start)} ${formatScheduleTime(schedule.startAt)} – ${date(end)} ${formatScheduleTime(schedule.endAt)}`
}

/** after 이후에 시작하는 일정 중 가장 빠른 날(브라우저 시간대 기준)의 일정을 모두 시작 시각순으로(없으면 빈 배열). */
export function findNextSchedules(schedules, after) {
  const upcoming = schedules
    .filter((schedule) => new Date(schedule.startAt) > after)
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
  if (upcoming.length === 0) return []
  const firstDay = dayKey(new Date(upcoming[0].startAt))
  return upcoming.filter((schedule) => dayKey(new Date(schedule.startAt)) === firstDay)
}
