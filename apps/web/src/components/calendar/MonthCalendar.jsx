import MaterialIcon from '../ui/MaterialIcon.jsx'
import { scheduleTypeMeta } from '../../api/calendar.js'
import { WEEKDAYS, formatScheduleTime } from '../../utils/calendarGrid.js'

// 월 단위 캘린더 화면(StudioCalendar, MyCalendar)이 함께 쓰는 표시 컴포넌트.
// 상태(선택한 날짜·조회 데이터)는 각 화면이 들고 있고, 여기서는 받은 값을 그리기만 한다.

/** 이전/다음 달 이동과 "오늘" 버튼. */
export function MonthNav({ month, onMove, onToday }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => onMove(-1)}
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant"
        >
          <MaterialIcon name="chevron_left" className="text-[22px]" />
        </button>
        <span className="font-title-md text-title-md font-bold text-on-surface">
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </span>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => onMove(1)}
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant"
        >
          <MaterialIcon name="chevron_right" className="text-[22px]" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToday}
        className="self-start px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant font-label-xs text-label-xs font-semibold active:scale-[0.98] transition-all"
      >
        오늘
      </button>
    </>
  )
}

/** 요일 머리글과 날짜 칸. 일정이 있는 날에는 일정 종류 색의 점을 최대 3개 찍는다. */
export function MonthGrid({ month, cells, selectedKey, schedulesByDay, onSelect }) {
  return (
    <div className="grid grid-cols-7 gap-y-1 p-space-sm rounded-2xl bg-surface-container-lowest shadow-card text-center">
      {WEEKDAYS.map((weekday, index) => (
        <span
          key={weekday}
          className={`font-label-xs text-label-xs font-semibold py-1 ${
            index === 0 ? 'text-error' : index === 6 ? 'text-secondary' : 'text-on-surface-variant'
          }`}
        >
          {weekday}
        </span>
      ))}
      {cells.map((cell) => {
        if (cell.blank) return <span key={cell.key} />
        const selected = cell.key === selectedKey
        const daySchedules = schedulesByDay.get(cell.key) ?? []
        return (
          <button
            key={cell.key}
            type="button"
            onClick={() => onSelect(cell.key)}
            aria-pressed={selected}
            aria-label={`${month.getMonth() + 1}월 ${cell.day}일${daySchedules.length ? `, 일정 ${daySchedules.length}개` : ''}`}
            className="flex flex-col items-center gap-0.5 py-1 min-h-[44px]"
          >
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ${
                selected ? 'bg-primary text-on-primary font-bold' : 'text-on-surface'
              }`}
            >
              {cell.day}
            </span>
            <span className="flex gap-0.5 h-1.5">
              {daySchedules.slice(0, 3).map((schedule) => (
                <span
                  key={schedule.scheduleId}
                  className={`w-1.5 h-1.5 rounded-full ${scheduleTypeMeta(schedule.scheduleType).bgClass}`}
                />
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** 고른 날짜 제목("10월 2일 (금)" + 오늘이면 "오늘" 표시). */
export function SelectedDayHeader({ month, selectedDate, isToday }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-label-md text-label-md font-bold text-on-surface">
        {month.getMonth() + 1}월 {selectedDate.day}일 ({WEEKDAYS[selectedDate.weekday]})
      </span>
      {isToday && (
        <span className="px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-xs text-label-xs">
          오늘
        </span>
      )}
    </div>
  )
}

/**
 * 고른 날에 일정이 없을 때 보여주는 "다음 일정" 미리보기. 가장 가까운 날의 일정을 모두 보여주고,
 * 누르면 그 날짜로 이동한다. schedules는 같은 날의 일정을 시작 시각순으로 담은 비어 있지 않은 배열이다.
 */
export function NextSchedulePreview({ schedules, onSelect }) {
  const start = new Date(schedules[0].startAt)
  return (
    <button
      type="button"
      onClick={() => onSelect(schedules[0])}
      className="flex flex-col gap-space-sm p-space-md rounded-2xl bg-surface-container-low text-left active:scale-[0.99] transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="font-label-xs text-label-xs text-on-surface-variant">
          {start.getMonth() + 1}월 {start.getDate()}일 ({WEEKDAYS[start.getDay()]}) · 다음 일정
          {schedules.length > 1 ? ` ${schedules.length}개` : ''}
        </span>
        <MaterialIcon name="chevron_right" className="text-[20px] text-on-surface-variant shrink-0" />
      </div>
      {schedules.map((schedule) => (
        <div key={schedule.scheduleId} className="flex items-center gap-3">
          <div className={`w-1 h-10 rounded-full shrink-0 ${scheduleTypeMeta(schedule.scheduleType).bgClass}`} />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-label-md text-label-md font-bold text-on-surface truncate">{schedule.title}</span>
            <span className="font-label-xs text-label-xs text-on-surface-variant truncate">
              {formatScheduleTime(schedule.startAt)}
              {schedule.creatorName ? ` · ${schedule.creatorName}` : ''}
            </span>
          </div>
        </div>
      ))}
    </button>
  )
}
