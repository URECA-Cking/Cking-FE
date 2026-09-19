import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { getEvents } from '../../api/events.js'
import { ApiError } from '../../api/client.js'
import { DISPLAY_STATUS_LABEL, LoadingBlock, ErrorBlock, EmptyBlock, StatusPill, UserGate, formatDateTime } from './liveUi.jsx'

export default function LiveEvents() {
  const navigate = useNavigate()
  const { user } = useUser()

  const [page, setPage] = useState({ items: [], page: 0, totalPages: 0, hasNext: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load(pageNumber = 0) {
    setLoading(true)
    setError(null)
    try {
      const data = await getEvents({ page: pageNumber, size: 20 })
      setPage(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '이벤트 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-32 bg-surface">
      <BackHeader title="이벤트 목록" onBack={() => navigate('/live')} />

      <div className="pt-16 px-margin flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <span className="font-label-xs text-label-xs text-on-surface-variant">GET /api/events</span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            총 {page.totalElements ?? page.items.length}건
          </span>
        </div>

        <UserGate user={user}>
          {loading && <LoadingBlock label="이벤트 목록을 불러오는 중..." />}
          {!loading && error && <ErrorBlock message={error} onRetry={() => load(page.page ?? 0)} />}
          {!loading && !error && page.items.length === 0 && <EmptyBlock message="등록된 이벤트가 없어요." />}

          {!loading && !error && page.items.length > 0 && (
            <div className="flex flex-col gap-2">
              {page.items.map((event) => {
                const statusMeta = DISPLAY_STATUS_LABEL[event.displayStatus] ?? DISPLAY_STATUS_LABEL.CLOSED
                return (
                  <Link
                    key={event.eventId}
                    to={`/live/events/${event.eventId}`}
                    className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col gap-2 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill label={statusMeta.label} className={statusMeta.className} />
                      <span className="font-label-xs text-label-xs text-on-surface-variant">#{event.eventId}</span>
                    </div>
                    <p className="font-title-md text-title-md font-bold text-on-surface truncate">{event.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-label-xs text-label-xs text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <MaterialIcon name="storefront" className="text-[14px]" />
                        creatorId {event.creatorId}
                      </span>
                      <span className="flex items-center gap-1">
                        <MaterialIcon name="military_tech" className="text-[14px]" />
                        당첨 {event.winnerCount}명 · {event.drawMethod}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-label-xs text-label-xs text-on-surface-variant">
                      <MaterialIcon name="schedule" className="text-[14px]" />
                      {formatDateTime(event.startAt)} ~ {formatDateTime(event.endAt)}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {!loading && !error && page.items.length > 0 && (page.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={(page.page ?? 0) <= 0}
                onClick={() => load((page.page ?? 0) - 1)}
                className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-sm text-label-sm disabled:opacity-30"
              >
                이전
              </button>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {(page.page ?? 0) + 1} / {page.totalPages}
              </span>
              <button
                type="button"
                disabled={!page.hasNext}
                onClick={() => load((page.page ?? 0) + 1)}
                className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-sm text-label-sm disabled:opacity-30"
              >
                다음
              </button>
            </div>
          )}
        </UserGate>
      </div>
    </div>
  )
}
