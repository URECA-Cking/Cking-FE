import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../../components/ui/States.jsx'
import ScheduleEditorSheet from '../../components/creator/ScheduleEditorSheet.jsx'
import { MonthGrid, MonthNav, NextSchedulePreview, SelectedDayHeader } from '../../components/calendar/MonthCalendar.jsx'
import { useToast } from '../../context/useToast.js'
import { useMonthCalendar } from '../../hooks/useMonthCalendar.js'
import { deleteSchedule, getMySchedules, scheduleTypeMeta } from '../../api/calendar.js'
import { describeError } from '../../api/client.js'
import { formatScheduleRange } from '../../utils/calendarGrid.js'

/**
 * 크리에이터 본인 캘린더 일정 관리(Cking-BE 이슈 #293).
 * 월 단위로 GET /api/creator/calendar/schedules를 조회하고, 날짜별 점 표시가 있는 달력에서
 * 하루를 골라 그날의 일정을 관리한다(등록·수정은 ScheduleEditorSheet, 삭제는 확인 후 바로 처리).
 * 고른 날에 일정이 없으면 가장 가까운 다음 날의 일정을 보여준다.
 */
export default function StudioCalendar() {
  const navigate = useNavigate()
  const showToast = useToast()
  // editor: null(닫힘) | { schedule: null }(등록) | { schedule }(수정) — CreatorPosts.jsx와 같은 패턴.
  const [editor, setEditor] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const {
    month,
    cells,
    selectedKey,
    setSelectedKey,
    selectedDate,
    isTodaySelected,
    schedulesByDay,
    selectedSchedules,
    nextSchedules,
    moveMonth,
    goToToday,
    selectSchedule,
    loading,
    error,
    reload,
  } = useMonthCalendar(getMySchedules, { fallbackMessage: '일정을 불러오지 못했어요.' })

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

        <MonthNav month={month} onMove={moveMonth} onToday={goToToday} />

        {loading && <LoadingBlock label="일정을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}

        {!loading && !error && (
          <>
            <MonthGrid
              month={month}
              cells={cells}
              selectedKey={selectedKey}
              schedulesByDay={schedulesByDay}
              onSelect={setSelectedKey}
            />

            {selectedDate && (
              <SelectedDayHeader month={month} selectedDate={selectedDate} isToday={isTodaySelected} />
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
                    <div className={`w-1 rounded-full shrink-0 ${meta.bgClass}`} />
                    <div className="flex flex-col gap-space-sm min-w-0 flex-1">
                      <div className="min-w-0">
                        <span className={`font-label-xs text-label-xs font-semibold ${meta.textClass}`}>
                          {meta.label}
                        </span>
                        <p className="font-title-md text-title-md text-on-surface font-bold truncate">{schedule.title}</p>
                        <p className="font-label-xs text-label-xs text-on-surface-variant mt-0.5">
                          {formatScheduleRange(schedule)}
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

            {nextSchedules.length > 0 && <NextSchedulePreview schedules={nextSchedules} onSelect={selectSchedule} />}
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
