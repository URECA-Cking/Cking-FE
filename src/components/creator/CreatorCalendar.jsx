import { useMemo, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../ui/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { getCreatorSchedules, scheduleTypeMeta } from '../../api/calendar.js'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const UPCOMING_DAYS = 60
const EMPTY_MESSAGE = '현재 열려있는 게 없습니다.'

// 날짜 구분·표시는 사용자 브라우저 시간대 기준이다(일정의 startAt·endAt은 UTC Instant).
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatRange(schedule) {
  const start = new Date(schedule.startAt)
  const end = new Date(schedule.endAt)
  if (dayKey(start) === dayKey(new Date(end.getTime() - 1))) {
    return `${formatTime(schedule.startAt)} – ${formatTime(schedule.endAt)}`
  }
  const date = (d) => `${d.getMonth() + 1}/${d.getDate()}`
  return `${date(start)} ${formatTime(schedule.startAt)} – ${date(end)} ${formatTime(schedule.endAt)}`
}

/** 일정이 걸친 날짜 키 목록(endAt은 포함하지 않는다). */
function coveredDayKeys(schedule, rangeStart, rangeEnd) {
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

function ScheduleCard({ schedule }) {
  const meta = scheduleTypeMeta(schedule.scheduleType)
  return (
    <div className="flex gap-3 p-space-md rounded-xl bg-surface-container-lowest shadow-card">
      <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="font-label-xs text-label-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
        <span className="font-title-md text-title-md font-bold text-on-surface">{schedule.title}</span>
        <span className="font-label-xs text-label-xs text-on-surface-variant">
          {formatRange(schedule)}
          {schedule.location ? ` · ${schedule.location}` : ''}
        </span>
        {schedule.description && (
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-1">{schedule.description}</p>
        )}
        {schedule.externalUrl && (
          <a
            href={schedule.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="font-label-xs text-label-xs font-semibold text-primary mt-1 self-start"
          >
            자세히 보기
          </a>
        )}
      </div>
    </div>
  )
}

/**
 * 크리에이터 캘린더 탭. 월 단위로 GET /api/creators/{creatorId}/calendar/schedules를 조회하고,
 * 일정이 있는 날에 점을 찍어 고른 날의 일정을 보여준다.
 */
export default function CreatorCalendar({ creatorId }) {
  const today = new Date()
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedKey, setSelectedKey] = useState(() => dayKey(today))

  const monthStart = month
  const monthEnd = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 1), [month])
  const { data, loading, error, reload } = useAsync(
    () => getCreatorSchedules(creatorId, monthStart, monthEnd),
    [creatorId, monthStart.getTime()],
    { fallbackMessage: '일정을 불러오지 못했어요.' },
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

  const cells = useMemo(() => {
    const blanks = Array.from({ length: month.getDay() }, (_, index) => ({ blank: true, key: `blank-${index}` }))
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(month.getFullYear(), month.getMonth(), index + 1)
      return { blank: false, key: dayKey(date), day: index + 1, weekday: date.getDay() }
    })
    return [...blanks, ...days]
  }, [month])

  function moveMonth(offset) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1)
    setMonth(next)
    const isCurrentMonth = next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()
    setSelectedKey(dayKey(isCurrentMonth ? today : next))
  }

  const selectedSchedules = schedulesByDay.get(selectedKey) ?? []
  const selectedDate = cells.find((cell) => !cell.blank && cell.key === selectedKey)

  return (
    <div className="flex flex-col gap-space-md px-margin py-space-sm md:mx-auto md:w-full md:max-w-3xl">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => moveMonth(-1)}
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
          onClick={() => moveMonth(1)}
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant"
        >
          <MaterialIcon name="chevron_right" className="text-[22px]" />
        </button>
      </div>

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
              onClick={() => setSelectedKey(cell.key)}
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
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: scheduleTypeMeta(schedule.scheduleType).color }}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <span className="font-label-md text-label-md font-bold text-on-surface">
          {month.getMonth() + 1}월 {selectedDate.day}일 ({WEEKDAYS[selectedDate.weekday]})
        </span>
      )}
      {loading && <LoadingBlock label="일정을 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && selectedSchedules.length === 0 && <EmptyBlock icon="calendar_month" message={EMPTY_MESSAGE} />}
      {!loading && !error && selectedSchedules.map((schedule) => (
        <ScheduleCard key={schedule.scheduleId} schedule={schedule} />
      ))}

      <div className="flex items-center gap-2 p-space-sm rounded-xl bg-surface-container-low">
        <MaterialIcon name="info" className="text-secondary text-[18px]" />
        <span className="font-label-xs text-label-xs text-on-surface-variant">응모가 있는 추첨 행사는 이벤트 탭에서 확인해요.</span>
      </div>
    </div>
  )
}

/** 홈 탭의 "다가오는 일정" 미리보기. 지금부터 60일 안의 일정 중 앞의 2개를 보여준다. */
export function UpcomingSchedules({ creatorId, onShowAll }) {
  const { data, loading, error, reload } = useAsync(
    () => {
      const from = new Date()
      const to = new Date(from.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000)
      return getCreatorSchedules(creatorId, from, to)
    },
    [creatorId],
    { fallbackMessage: '다가오는 일정을 불러오지 못했어요.' },
  )
  const upcoming = (data ?? []).slice(0, 2)

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MaterialIcon name="calendar_month" className="text-secondary text-[20px]" />
          <h2 className="font-title-md text-title-md text-on-surface">다가오는 일정</h2>
        </div>
        <button
          type="button"
          onClick={onShowAll}
          className="flex items-center gap-0.5 font-label-xs text-label-xs text-on-surface-variant hover:text-primary transition-colors"
        >
          캘린더 보기
          <MaterialIcon name="chevron_right" className="text-[14px]" />
        </button>
      </div>
      {loading && <LoadingBlock label="다가오는 일정을 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && upcoming.length === 0 && <EmptyBlock icon="calendar_month" message={EMPTY_MESSAGE} />}
      {!loading && !error && upcoming.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
          {upcoming.map((schedule) => {
            const meta = scheduleTypeMeta(schedule.scheduleType)
            const start = new Date(schedule.startAt)
            return (
              <button
                key={schedule.scheduleId}
                type="button"
                onClick={onShowAll}
                className="flex items-center gap-3 p-space-sm rounded-xl bg-surface-container-lowest shadow-card text-left active:scale-[0.99] transition-all"
              >
                <span className="w-11 h-12 rounded-lg bg-surface-container-low flex flex-col items-center justify-center shrink-0">
                  <span className="font-label-xs text-label-xs font-semibold" style={{ color: meta.color }}>{start.getMonth() + 1}월</span>
                  <span className="font-title-md text-title-md font-extrabold" style={{ color: meta.color }}>{start.getDate()}</span>
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="font-label-md text-label-md font-semibold text-on-surface truncate">{schedule.title}</span>
                  <span className="font-label-xs text-label-xs text-on-surface-variant">
                    {meta.label} · {formatTime(schedule.startAt)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
