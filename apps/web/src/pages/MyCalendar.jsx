import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { MonthGrid, MonthNav, NextSchedulePreview, SelectedDayHeader } from '../components/calendar/MonthCalendar.jsx'
import { useToast } from '../context/useToast.js'
import { useMonthCalendar } from '../hooks/useMonthCalendar.js'
import { getMyCalendar, removeFromMyCalendar, scheduleTypeMeta } from '../api/calendar.js'
import { describeError } from '../api/client.js'
import { formatScheduleRange } from '../utils/calendarGrid.js'
import { toSafeHttpUrl } from '../utils/safeUrl.js'

/**
 * 개인 캘린더(Cking-BE 이슈 #319). 크리에이터 스페이스 캘린더에서 "담은" 일정을 월 단위로 모아본다.
 * GET /api/me/calendar/schedules로 조회하고, 일정마다 어느 크리에이터의 것인지(creatorName)를 보여준다.
 * 일정 내용은 크리에이터의 원본을 참조하므로 크리에이터가 수정하면 여기에도 바로 반영된다.
 */
export default function MyCalendar() {
  const navigate = useNavigate()
  const showToast = useToast()
  // 일정마다 따로 잠가야 해서(같은 날 여러 개) 진행 중인 id를 모은다. ref는 연타로 같은 요청이 겹치는 것을 막는다.
  const inFlight = useRef(new Set())
  const [removingIds, setRemovingIds] = useState(() => new Set())
  // 이 화면에서 뺀 일정. 빼는 중에 월을 옮겨 시작된 조회가 삭제 반영 전에 서버를 읽고 삭제 성공 뒤에 도착하면
  // 그 결과가 목록을 통째로 교체해 뺀 일정이 되살아나므로, 조회 응답이 도착한 시점에 뺀 일정을 걸러낸다.
  // (useAsync의 requestSeq는 조회끼리의 순서만 막고 삭제와의 순서는 막지 못한다.)
  const removedIds = useRef(new Set())
  const fetchMyCalendar = useCallback(
    (from, to) => getMyCalendar(from, to).then((list) => list.filter((entry) => !removedIds.current.has(entry.scheduleId))),
    [],
  )

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
    setData,
  } = useMonthCalendar(fetchMyCalendar, { fallbackMessage: '내 캘린더를 불러오지 못했어요.' })

  async function handleRemove(schedule) {
    const { scheduleId } = schedule
    if (inFlight.current.has(scheduleId)) return
    inFlight.current.add(scheduleId)
    setRemovingIds(new Set(inFlight.current))
    try {
      await removeFromMyCalendar(scheduleId)
      removedIds.current.add(scheduleId)
      // 다시 조회하면 화면 전체가 로딩으로 바뀌어 스크롤을 잃으므로, 뺀 항목만 목록에서 지운다.
      setData((current) => (current ?? []).filter((entry) => entry.scheduleId !== scheduleId))
      showToast('내 캘린더에서 뺐어요.')
    } catch (err) {
      showToast(describeError(err, '내 캘린더에서 빼지 못했어요.'), { icon: 'error' })
    } finally {
      inFlight.current.delete(scheduleId)
      setRemovingIds(new Set(inFlight.current))
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-28">
      <BackHeader title="내 캘린더" onBack={() => navigate('/my-page')} />

      <div className="pt-16 px-margin flex flex-col gap-space-md md:mx-auto md:w-full md:max-w-3xl">
        <MonthNav month={month} onMove={moveMonth} onToday={goToToday} />

        {loading && <LoadingBlock label="내 캘린더를 불러오는 중..." />}
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

            {selectedDate && <SelectedDayHeader month={month} selectedDate={selectedDate} isToday={isTodaySelected} />}

            {selectedSchedules.length === 0 && (
              <EmptyBlock icon="calendar_month" message="이 날 담은 일정이 없어요. 다른 날짜를 선택해 보세요." />
            )}

            <div className="flex flex-col gap-space-sm">
              {selectedSchedules.map((schedule) => {
                const meta = scheduleTypeMeta(schedule.scheduleType)
                const busy = removingIds.has(schedule.scheduleId)
                const externalUrl = toSafeHttpUrl(schedule.externalUrl)
                return (
                  <article
                    key={schedule.scheduleId}
                    className="flex gap-3 p-space-md rounded-2xl bg-surface-container-lowest shadow-card"
                  >
                    <div className={`w-1 rounded-full shrink-0 ${meta.bgClass}`} />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <Link
                        to={`/creators/${schedule.creatorId}`}
                        className="self-start font-label-xs text-label-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
                      >
                        {schedule.creatorName}
                      </Link>
                      <span className={`font-label-xs text-label-xs font-semibold ${meta.textClass}`}>
                        {meta.label}
                      </span>
                      <span className="font-title-md text-title-md font-bold text-on-surface">{schedule.title}</span>
                      <span className="font-label-xs text-label-xs text-on-surface-variant">
                        {formatScheduleRange(schedule)}
                        {schedule.location ? ` · ${schedule.location}` : ''}
                      </span>
                      {schedule.description && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-1">
                          {schedule.description}
                        </p>
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
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemove(schedule)}
                        className="mt-2 self-start flex items-center gap-1 px-3 h-9 rounded-full bg-surface-container text-on-surface-variant font-label-xs text-label-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                      >
                        <MaterialIcon name="bookmark_remove" className="text-[16px]" />
                        {busy ? '빼는 중...' : '내 캘린더에서 빼기'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>

            {nextSchedules.length > 0 && <NextSchedulePreview schedules={nextSchedules} onSelect={selectSchedule} />}

            <div className="flex items-center gap-2 p-space-sm rounded-xl bg-surface-container-low">
              <MaterialIcon name="info" className="text-secondary text-[18px]" />
              <span className="flex-1 font-label-xs text-label-xs text-on-surface-variant">
                일정은 크리에이터 스페이스의 캘린더 탭에서 담을 수 있어요.
              </span>
              <Link to="/explore" className="shrink-0 font-label-xs text-label-xs font-semibold text-primary">
                둘러보기
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
