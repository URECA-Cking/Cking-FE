import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../../components/ui/States.jsx'
import ScheduleEditorSheet from '../../components/creator/ScheduleEditorSheet.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { deleteSchedule, getMySchedules, scheduleTypeMeta } from '../../api/calendar.js'
import { describeError } from '../../api/client.js'
import { WEEKDAYS, dayKey, coveredDayKeys, buildMonthCells, moveMonthSelection } from '../../utils/calendarGrid.js'

// "다음 일정" 미리보기는 달력에 보이는 달을 넘어서도 찾는다 — 이번 달에 더 이상 일정이 없을 때
// 다음 달 일정까지 조회 범위를 넓혀서 검색한다(UpcomingSchedules의 60일 기준과 동일하게 맞췄다).
const NEXT_SCHEDULE_LOOKAHEAD_DAYS = 60

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

/**
 * 크리에이터 본인 캘린더 일정 관리(Cking-BE 이슈 #293).
 * 월 단위로 GET /api/creator/calendar/schedules를 조회하고, 날짜별 점 표시가 있는 달력에서
 * 하루를 골라 그날의 일정을 관리한다(등록·수정은 ScheduleEditorSheet, 삭제는 확인 후 바로 처리).
 * 고른 날에 일정이 없으면 이번 달 안에서 가장 가까운 다음 일정을 보여준다.
 */
export default function StudioCalendar() {
  const navigate = useNavigate()
  const showToast = useToast()
  const today = new Date()
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedKey, setSelectedKey] = useState(() => dayKey(today))
  // editor: null(닫힘) | { schedule: null }(등록) | { schedule }(수정) — CreatorPosts.jsx와 같은 패턴.
  const [editor, setEditor] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const monthStart = month
  const monthEnd = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 1), [month])
  // 달력 격자에 찍는 점은 monthEnd까지만 쓰지만, API 조회 자체는 다음 일정 검색을 위해 더 길게 가져온다.
  const lookaheadEnd = useMemo(
    () => new Date(monthEnd.getTime() + NEXT_SCHEDULE_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000),
    [monthEnd],
  )

  const { data, loading, error, reload } = useAsync(
    () => getMySchedules(monthStart, lookaheadEnd),
    [monthStart.getTime(), lookaheadEnd.getTime()],
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

  const cells = useMemo(() => buildMonthCells(month), [month])

  function moveMonth(offset) {
    const { month: next, selectedKey: nextSelectedKey } = moveMonthSelection(month, offset, today)
    setMonth(next)
    setSelectedKey(nextSelectedKey)
  }

  function goToToday() {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedKey(dayKey(today))
  }

  function handleSaved() {
    setEditor(null)
    reload()
  }

  async function handleDelete(schedule) {
    if (!window.confirm(`"${schedule.title}" 일정을 삭제할까요? 삭제하면 되돌릴 수 없어요.`)) return
    setDeletingId(schedule.scheduleId)
    try {
      await deleteSchedule(schedule.scheduleId)
      showToast('일정을 삭제했어요.')
      await reload()
    } catch (err) {
      showToast(describeError(err, '삭제하지 못했어요.'), { icon: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  const selectedDate = useMemo(
    () => cells.find((cell) => !cell.blank && cell.key === selectedKey),
    [cells, selectedKey],
  )
  const selectedSchedules = useMemo(
    () => (schedulesByDay.get(selectedKey) ?? []).slice().sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
    [schedulesByDay, selectedKey],
  )

  // 고른 날에 일정이 없으면 조회 범위(이번 달 + lookahead) 안에서 선택일 이후 가장 가까운 일정을 보여준다.
  const nextSchedule = useMemo(() => {
    if (selectedSchedules.length > 0 || !selectedDate) return null
    const selectedDayStart = new Date(month.getFullYear(), month.getMonth(), selectedDate.day, 23, 59, 59, 999)
    return (
      (data ?? [])
        .filter((schedule) => new Date(schedule.startAt) > selectedDayStart)
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))[0] ?? null
    )
  }, [data, selectedSchedules, selectedDate, month])

  function selectSchedule(schedule) {
    const target = new Date(schedule.startAt)
    setMonth(new Date(target.getFullYear(), target.getMonth(), 1))
    setSelectedKey(dayKey(target))
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-28">
      <BackHeader title="내 캘린더" onBack={() => navigate('/studio')} />

      <div className="pt-16 px-margin flex flex-col gap-space-md md:mx-auto md:w-full md:max-w-3xl">
        <button
          type="button"
          onClick={() => setEditor({ schedule: null })}
          className="w-full h-12 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-all"
        >
          <MaterialIcon name="add" className="text-[20px]" />새 일정 등록
        </button>

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

        <button
          type="button"
          onClick={goToToday}
          className="self-start px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant font-label-xs text-label-xs font-semibold active:scale-[0.98] transition-all"
        >
          오늘
        </button>

        {loading && <LoadingBlock label="일정을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}

        {!loading && !error && (
          <>
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
              <div className="flex items-center gap-1.5">
                <span className="font-label-md text-label-md font-bold text-on-surface">
                  {month.getMonth() + 1}월 {selectedDate.day}일 ({WEEKDAYS[selectedDate.weekday]})
                </span>
                {selectedKey === dayKey(today) && (
                  <span className="px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-xs text-label-xs">
                    오늘
                  </span>
                )}
              </div>
            )}

            {selectedSchedules.length === 0 && (
              <EmptyBlock icon="calendar_month" message="아직 일정이 없어요. 다른 날짜를 선택해 보세요." />
            )}

            <div className="flex flex-col gap-space-sm">
              {selectedSchedules.map((schedule) => {
                const meta = scheduleTypeMeta(schedule.scheduleType)
                const busy = deletingId === schedule.scheduleId
                return (
                  <article
                    key={schedule.scheduleId}
                    className="flex gap-3 p-space-md rounded-2xl bg-surface-container-lowest shadow-card"
                  >
                    <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                    <div className="flex flex-col gap-space-sm min-w-0 flex-1">
                      <div className="min-w-0">
                        <span className="font-label-xs text-label-xs font-semibold" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <p className="font-title-md text-title-md text-on-surface font-bold truncate">{schedule.title}</p>
                        <p className="font-label-xs text-label-xs text-on-surface-variant mt-0.5">
                          {formatRange(schedule)}
                          {schedule.location ? ` · ${schedule.location}` : ''}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setEditor({ schedule })}
                          className="h-10 rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDelete(schedule)}
                          className="h-10 rounded-xl bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
                        >
                          {busy ? '삭제하는 중...' : '삭제'}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {nextSchedule && (
              <button
                type="button"
                onClick={() => selectSchedule(nextSchedule)}
                className="flex items-center gap-3 p-space-md rounded-2xl bg-surface-container-low text-left active:scale-[0.99] transition-all"
              >
                <div
                  className="w-1 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: scheduleTypeMeta(nextSchedule.scheduleType).color }}
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-label-xs text-label-xs text-on-surface-variant">
                    {new Date(nextSchedule.startAt).getMonth() + 1}월 {new Date(nextSchedule.startAt).getDate()}일 (
                    {WEEKDAYS[new Date(nextSchedule.startAt).getDay()]}) · 다음 일정
                  </span>
                  <span className="font-label-md text-label-md font-bold text-on-surface truncate">
                    {nextSchedule.title}
                  </span>
                </div>
                <MaterialIcon name="chevron_right" className="text-[20px] text-on-surface-variant shrink-0" />
              </button>
            )}
          </>
        )}
      </div>

      <ScheduleEditorSheet
        open={editor !== null}
        onClose={() => setEditor(null)}
        schedule={editor?.schedule ?? null}
        onSaved={handleSaved}
      />
    </div>
  )
}
