// 월 단위 캘린더 그리드 공용 로직. 일정이 있는 날짜에 점을 찍는 화면(CreatorCalendar, StudioCalendar)에서 함께 쓴다.
// 날짜 구분·표시는 사용자 브라우저 시간대 기준이다(일정의 startAt·endAt은 UTC Instant).

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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
