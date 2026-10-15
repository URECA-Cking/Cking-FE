import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useAsync } from '../hooks/useAsync.js'
import { getMyNotifications, readAllNotifications, readNotification } from '../api/notifications.js'
import { describeError } from '../api/client.js'
import { formatRelativeTime } from '../utils/format.js'
import { NOTIFICATION_TYPE_META } from '../utils/eventStatus.js'
import { localizeNoticeBody } from '../utils/sanctionNotice.js'

/**
 * 알림 목록.
 * GET /api/me/notifications 로 조회하고, 항목을 누르면
 * PATCH /api/me/notifications/{id}/read 로 읽음 처리한 뒤 관련 이벤트로 이동한다.
 * 전체 읽음은 서버의 일괄 읽음 API를 사용한다.
 * 제재 알림은 event·drawing이 null이라 이동 없이 읽음 처리만 한다.
 */
export default function Notifications() {
  const navigate = useNavigate()
  const showToast = useToast()
  const {
    unreadCount: totalUnreadCount,
    reloadNotifications,
    markNotificationReadLocally,
    markAllNotificationsReadLocally,
    rollbackAllNotificationsReadLocally,
  } = useOutletContext()
  const [page, setPage] = useState(0)
  const [readingId, setReadingId] = useState(null)
  const [markingAll, setMarkingAll] = useState(false)

  const { data, loading, error, reload, setData } = useAsync(
    () => getMyNotifications({ page, size: 20 }),
    [page],
    { fallbackMessage: '알림을 불러오지 못했습니다.' },
  )

  const items = data?.items ?? []
  const unreadCount = Math.max(totalUnreadCount, items.filter((item) => !item.readAt).length)

  /** 항목 선택 시 목록과 배지를 먼저 갱신하고 서버 결과로 확정한다. */
  async function handleOpen(notification) {
    const eventId = notification.event?.eventId
    if (!notification.readAt) {
      setReadingId(notification.notificationId)
      const optimisticReadAt = new Date().toISOString()
      /** 선택한 알림의 읽음 시각을 목록과 배지에 같은 값으로 반영한다. */
      const updateReadAt = (readAt) => {
        setData((current) => current && ({
          ...current,
          items: current.items.map((item) =>
            item.notificationId === notification.notificationId ? { ...item, readAt } : item,
          ),
        }))
        markNotificationReadLocally(notification.notificationId, readAt)
      }
      updateReadAt(optimisticReadAt)
      try {
        const result = await readNotification(notification.notificationId)
        updateReadAt(result.readAt)
      } catch (err) {
        updateReadAt(null)
        showToast(describeError(err, '읽음 처리에 실패했습니다.'), { icon: 'error' })
        await Promise.all([reload(), reloadNotifications()])
      } finally {
        setReadingId(null)
      }
    }
    if (eventId) navigate(`/events/${eventId}`)
  }

  /** 서버의 전체 읽음 API를 한 번 호출하고 목록과 배지를 다시 조회한다. */
  async function markAllRead() {
    if (unreadCount === 0 || markingAll || readingId !== null) return
    setMarkingAll(true)
    const optimisticReadAt = new Date().toISOString()
    setData((current) => current && ({
      ...current,
      items: current.items.map((item) => item.readAt ? item : { ...item, readAt: optimisticReadAt }),
    }))
    markAllNotificationsReadLocally(optimisticReadAt)
    try {
      const result = await readAllNotifications()
      await Promise.all([reload(), reloadNotifications()])
      showToast(`${result.readCount}개의 알림을 읽음 처리했어요.`)
    } catch (err) {
      setData((current) => current && ({
        ...current,
        items: current.items.map((item) =>
          item.readAt === optimisticReadAt ? { ...item, readAt: null } : item,
        ),
      }))
      rollbackAllNotificationsReadLocally(optimisticReadAt)
      showToast(describeError(err, '읽음 처리에 실패했습니다.'), { icon: 'error' })
      await Promise.all([reload(), reloadNotifications()])
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col w-full px-margin pt-space-md pb-8 gap-space-sm md:mx-auto md:max-w-4xl md:px-8">
      <div className="flex items-center justify-between mb-1">
        <div>
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
            disabled={markingAll || readingId !== null}
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
          <EmptyBlock icon="notifications_off" message="아직 도착한 알림이 없어요. 당첨 결과나 계정 안내가 있으면 알려드릴게요!" />
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
            disabled={markingAll || readingId !== null}
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
                <span className={`font-label-xs text-label-xs font-bold ${unread ? 'text-primary' : 'text-on-surface-variant'}`}>{meta.label}</span>
                {unread && <span aria-label="읽지 않음" className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </div>
              <p className={`font-label-md text-label-md mt-0.5 ${unread ? 'text-on-surface font-semibold' : 'text-on-surface-variant font-medium'}`}>{item.title}</p>
              {item.body && (
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">{localizeNoticeBody(item.body)}</p>
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
