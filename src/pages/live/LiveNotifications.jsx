import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { getMyNotifications, readNotification } from '../../api/notifications.js'
import { ApiError } from '../../api/client.js'
import { NOTIFICATION_TYPE_LABEL, LoadingBlock, ErrorBlock, EmptyBlock, UserGate, formatDateTime } from './liveUi.jsx'

export default function LiveNotifications() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { user } = useUser()

  const [page, setPage] = useState({ items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [readingId, setReadingId] = useState(null)

  async function load() {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const data = await getMyNotifications(user.userId, { page: 0, size: 20 })
      setPage(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '알림 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleRead(notification) {
    if (!user || notification.readAt) return
    setReadingId(notification.notificationId)
    try {
      await readNotification(notification.notificationId, user.userId)
      setPage((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.notificationId === notification.notificationId
            ? { ...item, readAt: new Date().toISOString() }
            : item
        ),
      }))
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '읽음 처리에 실패했습니다.', { icon: 'error' })
    } finally {
      setReadingId(null)
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-32 bg-surface">
      <BackHeader title="알림" onBack={() => navigate('/live')} />

      <div className="pt-16 px-margin flex flex-col gap-space-md">
        <span className="font-label-xs text-label-xs text-on-surface-variant self-end">GET /api/me/notifications</span>

        <UserGate user={user}>
          {loading && <LoadingBlock label="알림을 불러오는 중..." />}
          {!loading && error && <ErrorBlock message={error} onRetry={load} />}
          {!loading && !error && (page.items ?? []).length === 0 && <EmptyBlock message="받은 알림이 없어요." />}

          {!loading && !error && (page.items ?? []).length > 0 && (
            <div className="flex flex-col gap-2">
              {page.items.map((notification) => {
                const isRead = Boolean(notification.readAt)
                return (
                  <button
                    key={notification.notificationId}
                    type="button"
                    onClick={() => handleRead(notification)}
                    disabled={readingId === notification.notificationId}
                    className={`text-left p-space-md rounded-2xl shadow-sm flex flex-col gap-1.5 transition-all active:scale-[0.98] ${
                      isRead ? 'bg-surface-container-low' : 'bg-surface-container-lowest'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-berry-tint text-primary font-label-xs text-label-xs font-semibold">
                        <MaterialIcon name="emoji_events" filled className="text-[13px]" />
                        {NOTIFICATION_TYPE_LABEL[notification.type] ?? notification.type}
                      </span>
                      {!isRead && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <p className="font-title-md text-title-md font-bold text-on-surface">{notification.title}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{notification.body}</p>
                    {notification.event?.title && (
                      <p className="font-label-xs text-label-xs text-on-surface-variant">
                        이벤트: {notification.event.title} (#{notification.event.eventId})
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1 font-label-xs text-label-xs text-on-surface-variant">
                      <span>{formatDateTime(notification.createdAt)}</span>
                      <span>{isRead ? `읽음 · ${formatDateTime(notification.readAt)}` : '탭하여 읽음 처리'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </UserGate>
      </div>
    </div>
  )
}
