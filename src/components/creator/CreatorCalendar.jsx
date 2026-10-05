import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../ui/States.jsx'
import { useUser } from '../../context/useUser.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useMyCalendarEntries } from '../../hooks/useMyCalendarEntries.js'
import { getCreatorSchedules, scheduleTypeMeta } from '../../api/calendar.js'
import { toSafeHttpUrl } from '../../utils/safeUrl.js'
import {
  WEEKDAYS,
  buildMonthCells,
  coveredDayKeys,
  dayKey,
  formatScheduleRange,
  formatScheduleTime,
  moveMonthSelection,
} from '../../utils/calendarGrid.js'

const UPCOMING_DAYS = 60
const EMPTY_MESSAGE = '현재 열려있는 게 없습니다.'

/** calendar: 로그인 사용자의 "내 캘린더 담기" 상태({ ready, added, busy, onToggle }), 비로그인이면 null. */
function ScheduleCard({ schedule, calendar }) {
  const meta = scheduleTypeMeta(schedule.scheduleType)
  // 크리에이터가 입력한 값이라 javascript: 같은 스킴이 들어올 수 있어 http(s)일 때만 링크로 그린다.
  const externalUrl = toSafeHttpUrl(schedule.externalUrl)
  return (
    <div className="flex gap-3 p-space-md rounded-xl bg-surface-container-lowest shadow-card">
      <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="font-label-xs text-label-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
        <span className="font-title-md text-title-md font-bold text-on-surface">{schedule.title}</span>
        <span className="font-label-xs text-label-xs text-on-surface-variant">
          {formatScheduleRange(schedule)}
          {schedule.location ? ` · ${schedule.location}` : ''}
        </span>
        {schedule.description && (
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-1">{schedule.description}</p>
        )}
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            className="font-label-xs text-label-xs font-semibold text-primary mt-1 self-start"
          >
            자세히 보기
          </a>
        )}
        {calendar && (
          <button
            type="button"
            disabled={!calendar.ready || calendar.busy}
            aria-label="내 캘린더에 담기"
            aria-pressed={calendar.added}
            onClick={calendar.onToggle}
            className={`mt-2 self-start flex items-center gap-1 px-3 h-9 rounded-full font-label-xs text-label-xs font-semibold active:scale-95 transition-all disabled:opacity-50 ${
              calendar.added ? 'bg-berry-tint text-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            <MaterialIcon name={calendar.added ? 'bookmark_added' : 'bookmark_add'} filled={calendar.added} className="text-[16px]" />
            {calendar.added ? '내 캘린더에 담음' : '내 캘린더에 담기'}
          </button>
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
  const navigate = useNavigate()
  const location = useLocation()
  const { status } = useUser()
  const authenticated = status === 'authenticated'
  // 로그인 상태를 복원하는 동안(loading)에는 로그인 안내를 띄우지 않아 로그인 사용자에게 깜빡이지 않게 한다.
  const anonymous = status === 'anonymous'
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
  const myCalendar = useMyCalendarEntries({
    from: monthStart,
    to: monthEnd,
    enabled: authenticated,
    onScheduleGone: reload,
  })

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

  function moveMonth(offset) {
    const { month: next, selectedKey: nextSelectedKey } = moveMonthSelection(month, offset, today)
    setMonth(next)
    setSelectedKey(nextSelectedKey)
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
        <ScheduleCard
          key={schedule.scheduleId}
          schedule={schedule}
          calendar={
            authenticated
              ? {
                  ready: myCalendar.ready,
                  added: myCalendar.isAdded(schedule.scheduleId),
                  busy: myCalendar.isBusy(schedule.scheduleId),
                  onToggle: () => myCalendar.toggle(schedule.scheduleId),
                }
              : null
          }
        />
      ))}

      {anonymous && (
        <div className="flex items-center justify-between gap-3 p-space-md rounded-xl bg-surface-container-low">
          <span className="font-body-sm text-body-sm text-on-surface-variant">로그인하면 일정을 내 캘린더에 담을 수 있어요.</span>
          <button
            type="button"
            onClick={() => navigate('/login', { state: { from: location.pathname + location.search } })}
            className="shrink-0 px-3 py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm font-semibold active:scale-95 transition-all"
          >
            로그인
          </button>
        </div>
      )}
      {authenticated && myCalendar.error && (
        <div className="flex items-center justify-between gap-3 p-space-md rounded-xl bg-surface-container-low">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            내 캘린더에 담았는지 확인하지 못해 담기 버튼을 잠시 쓸 수 없어요.
          </span>
          <button
            type="button"
            onClick={myCalendar.reload}
            className="shrink-0 px-3 py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm font-semibold active:scale-95 transition-all"
          >
            다시 시도
          </button>
        </div>
      )}
      {authenticated && (
        <Link to="/my-calendar" className="self-start flex items-center gap-0.5 font-label-xs text-label-xs text-on-surface-variant hover:text-primary transition-colors">
          내 캘린더 보기
          <MaterialIcon name="chevron_right" className="text-[14px]" />
        </Link>
      )}

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
                    {meta.label} · {formatScheduleTime(schedule.startAt)}
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
