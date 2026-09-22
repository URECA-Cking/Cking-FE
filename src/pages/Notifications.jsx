import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { getMyNotifications, readNotification } from '../api/notifications.js'
import { describeError } from '../api/client.js'
import { formatRelativeTime } from '../utils/format.js'
import { NOTIFICATION_TYPE_META } from '../utils/eventStatus.js'

/**
 * 알림 목록.
 * GET /api/me/notifications 로 조회하고, 항목을 누르면
 * PATCH /api/me/notifications/{id}/read 로 읽음 처리한 뒤 관련 이벤트로 이동한다.
 */
export default function Notifications() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { userId } = useUser()
  const [page, setPage] = useState(0)
  const [readingId, setReadingId] = useState(null)

  const { data, loading, error, reload, setData } = useAsync(
    () => getMyNotifications(userId, { page, size: 20 }),
    [userId, page],
    { fallbackMessage: '알림을 불러오지 못했습니다.' },
  )

  const items = data?.items ?? []
  const unreadCount = items.filter((item) => !item.readAt).length

  async function handleOpen(notification) {
    const eventId = notification.event?.eventId
    if (!notification.readAt) {
      setReadingId(notification.notificationId)
      try {
        const result = await readNotification(notification.notificationId, userId)
        // 목록 전체를 다시 읽지 않고 해당 항목만 갱신한다.
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((item) =>
                  item.notificationId === notification.notificationId
                    ? { ...item, readAt: result?.readAt ?? new Date().toISOString() }
                    : item,
                ),
              }
            : prev,
        )
      } catch (err) {
        showToast(describeError(err, '읽음 처리에 실패했습니다.'), { icon: 'error' })
      } finally {
        setReadingId(null)
      }
    }
    if (eventId) navigate(`/events/${eventId}`)
  }

  async function markAllRead() {
    const unread = items.filter((item) => !item.readAt)
    if (unread.length === 0) return
    try {
      await Promise.all(unread.map((item) => readNotification(item.notificationId, userId)))
      showToast(`${unread.length}개의 알림을 읽음 처리했어요.`)
      await reload()
    } catch (err) {
      showToast(describeError(err, '읽음 처리에 실패했습니다.'), { icon: 'error' })
    }
  }

  return (
    <div className="flex min-h-full flex-col w-full px-margin pt-space-md pb-8 gap-space-sm md:mx-auto md:max-w-4xl md:px-8">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">알림</h2>
          {unreadCount > 0 && (
            <p className="font-label-sm text-label-sm text-primary font-semibold mt-0.5">
              읽지 않은 알림 {unreadCount}개
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="px-3 py-1.5 rounded-full bg-berry-tint text-primary font-label-sm text-label-sm font-semibold active:scale-95 transition-all"
          >
            모두 읽음
          </button>
        )}
      </div>

      {loading && <LoadingBlock label="알림을 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <EmptyBlock icon="notifications_off" message="아직 도착한 알림이 없어요. 당첨 결과가 나오면 알려드릴게요!" />
        </div>
      )}

      {items.map((item) => {
        const meta = NOTIFICATION_TYPE_META[item.type] ?? { label: item.type, icon: 'notifications' }
        const unread = !item.readAt
        return (
          <button
            key={item.notificationId}
            type="button"
            onClick={() => handleOpen(item)}
            disabled={readingId === item.notificationId}
            className={`p-space-md rounded-2xl shadow-card flex items-start gap-space-md text-left transition-all active:scale-[0.99] ${
              unread ? 'bg-surface-container-lowest border border-border-rose' : 'bg-surface-container-low'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                unread ? 'bg-berry-tint text-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              <MaterialIcon name={meta.icon} filled={unread} className="text-[20px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-label-xs text-label-xs text-primary font-bold">{meta.label}</span>
                {unread && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </div>
              <p className="font-label-md text-label-md text-on-surface font-semibold mt-0.5">{item.title}</p>
              {item.body && (
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">{item.body}</p>
              )}
              {item.event?.title && (
                <p className="font-label-xs text-label-xs text-outline mt-1 truncate">
                  {item.event.title}
                  {item.drawing ? ` · ${item.drawing.drawNo}회차` : ''}
                </p>
              )}
            </div>
            <span className="font-label-xs text-label-xs text-outline shrink-0">
              {formatRelativeTime(item.createdAt)}
            </span>
          </button>
        )
      })}

      {data?.hasNext && (
        <button
          type="button"
          onClick={() => setPage((prev) => prev + 1)}
          className="mt-space-sm w-full h-11 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md font-semibold active:scale-[0.98] transition-all"
        >
          다음 페이지
        </button>
      )}
      {page > 0 && (
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          className="w-full h-11 rounded-xl bg-surface-container-low text-on-surface-variant font-label-md text-label-md font-semibold active:scale-[0.98] transition-all"
        >
          이전 페이지
        </button>
      )}
    </div>
  )
}
