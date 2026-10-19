import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import SwipeToHide from '../components/notification/SwipeToHide.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useNotificationPage } from '../hooks/useNotificationPage.js'
import { getMyNotifications, hideNotification, readAllNotifications, readNotification } from '../api/notifications.js'
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
 * 카드를 왼쪽으로 밀어 드러난 "삭제"를 누르면 PATCH /api/me/notifications/{id}/hide 로 알림함에서 지운다(서버는 숨김으로 기록하고 되돌릴 수 없음).
 */
export default function Notifications() {
  const navigate = useNavigate()
  const showToast = useToast()
  const {
    unreadCount: totalUnreadCount,
    notificationsData,
    notificationsLoading,
    notificationsError,
    reloadNotifications,
    markNotificationReadLocally,
    markAllNotificationsReadLocally,
    rollbackAllNotificationsReadLocally,
    hideNotificationLocally,
    unhideNotificationLocally,
  } = useOutletContext()
  const [page, setPage] = useState(0)
  const [readingId, setReadingId] = useState(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [hidingId, setHidingId] = useState(null)
  const chunkPage = Math.floor(page / 5)

  const {
    data: extraData, loading: extraLoading, error: extraError, reload: reloadExtra,
    markRead: markExtraRead, markAllRead: markAllExtraRead, rollbackAllRead: rollbackAllExtraRead,
    hide: hideExtra, unhide: unhideExtra,
  } = useNotificationPage(
    () => getMyNotifications({ page: chunkPage, size: 100 }),
    [chunkPage],
    { enabled: chunkPage > 0, fallbackMessage: '알림을 불러오지 못했습니다.' },
  )

  const data = chunkPage === 0 ? notificationsData : extraData?.page === chunkPage ? extraData : null
  const offset = (page % 5) * 20
  const items = data?.items.slice(offset, offset + 20) ?? []
  const hasNext = Boolean(data && (data.items.length > offset + 20 || data.hasNext))
  const loading = chunkPage === 0 ? notificationsLoading : extraLoading || (!data && !extraError)
  const error = chunkPage === 0 ? notificationsError : extraError
  const canMarkAllRead = Boolean(totalUnreadCount > 0 || notificationsData?.hasNext)

  // 숨겨서 마지막 페이지가 비면 한 페이지 앞으로 돌아간다(빈 목록 안내가 "알림 없음"으로 오해되지 않게).
  useEffect(() => {
    if (page > 0 && data && !loading && items.length === 0) setPage((prev) => Math.max(0, prev - 1))
  }, [page, data, loading, items.length])

  /** 현재 목록 페이지와 헤더의 서버 상태를 필요한 조회만으로 다시 맞춘다. */
  async function reloadCurrentPage() {
    if (chunkPage === 0) return Boolean(await reloadNotifications())
    const results = await Promise.all([reloadExtra(), reloadNotifications()])
    return results.every(Boolean)
  }

  /** 항목 선택 시 목록과 배지를 먼저 갱신하고 서버 결과로 확정한다. */
  async function handleOpen(notification) {
    const eventId = notification.event?.eventId
    if (!notification.readAt) {
      setReadingId(notification.notificationId)
      const optimisticReadAt = new Date().toISOString()
      /** 선택한 알림의 읽음 시각을 목록과 배지에 같은 값으로 반영한다. */
      const updateReadAt = (readAt) => {
        if (chunkPage > 0) markExtraRead(notification.notificationId, readAt)
        markNotificationReadLocally(notification.notificationId, readAt)
      }
      updateReadAt(optimisticReadAt)
      try {
        const result = await readNotification(notification.notificationId)
        updateReadAt(result.readAt)
      } catch (err) {
        updateReadAt(null)
        showToast(describeError(err, '읽음 처리에 실패했습니다.'), { icon: 'error' })
        await reloadCurrentPage()
        return
      } finally {
        setReadingId(null)
      }
    }
    if (eventId) navigate(`/events/${eventId}`)
  }

  /** 알림을 목록과 배지에서 먼저 빼고 서버에 숨김을 요청한다. 실패하면 되돌리고, 성공하면 서버 기준으로 목록을 다시 맞춘다. */
  async function handleHide(notification) {
    if (hidingId !== null) return
    const id = notification.notificationId
    setHidingId(id)
    setOpenId(null)
    hideNotificationLocally(id)
    if (chunkPage > 0) hideExtra(id)
    try {
      await hideNotification(id)
    } catch (err) {
      // 이미 없는 알림이면 어차피 목록에서 빠질 알림이라 숨긴 것으로 둔다.
      if (err?.code !== 'NOTIFICATION_NOT_FOUND') {
        unhideNotificationLocally(id)
        if (chunkPage > 0) unhideExtra(id)
        showToast(describeError(err, '알림을 삭제하지 못했습니다.'), { icon: 'error' })
        await reloadCurrentPage()
        setHidingId(null)
        return
      }
    }
    // 100건 단위로 받는 목록은 숨긴 만큼 서버 기준 위치가 당겨지므로 다시 맞춘다.
    await reloadCurrentPage()
    setHidingId(null)
  }

  /** 서버의 전체 읽음 API를 한 번 호출하고 목록과 배지를 다시 조회한다. */
  async function markAllRead() {
    if (!canMarkAllRead || markingAll || readingId !== null || hidingId !== null) return
    setMarkingAll(true)
    const optimisticReadAt = new Date().toISOString()
    if (chunkPage > 0) markAllExtraRead(optimisticReadAt)
    markAllNotificationsReadLocally(optimisticReadAt)
    try {
      const result = await readAllNotifications()
      const refreshed = await reloadCurrentPage()
      showToast(refreshed
        ? `${result.readCount}개의 알림을 읽음 처리했어요.`
        : `${result.readCount}개의 알림을 읽음 처리했어요. 최신 목록은 다시 확인해 주세요.`,
      )
    } catch (err) {
      if (chunkPage > 0) rollbackAllExtraRead(optimisticReadAt)
      rollbackAllNotificationsReadLocally(optimisticReadAt)
      showToast(describeError(err, '읽음 처리에 실패했습니다.'), { icon: 'error' })
      await reloadCurrentPage()
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col w-full px-margin pt-space-md pb-8 gap-space-sm md:mx-auto md:max-w-4xl md:px-8">
      <div className="flex items-center justify-between mb-1">
        <div>
          {totalUnreadCount > 0 && (
            <p className="font-label-sm text-label-sm text-primary font-semibold mt-0.5">
              {notificationsData?.hasNext ? '최근 100건 중 읽지 않은 알림' : '읽지 않은 알림'} {totalUnreadCount}개
            </p>
          )}
        </div>
        {canMarkAllRead && (
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

      {loading && !data && <LoadingBlock label="알림을 불러오는 중..." />}
      {!loading && error && (data
        ? <div role="status" className="rounded-xl bg-berry-tint px-3 py-2 text-label-sm text-primary">
          최신 목록을 확인하지 못했습니다. <button type="button" onClick={reloadCurrentPage} className="font-semibold underline">다시 시도</button>
        </div>
        : <ErrorBlock message={error} onRetry={reloadCurrentPage} />)}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <EmptyBlock icon="notifications_off" message="도착한 알림이 없어요." />
        </div>
      )}

      {items.map((item) => {
        const meta = NOTIFICATION_TYPE_META[item.type] ?? { label: item.type, icon: 'notifications' }
        const unread = !item.readAt
        return (
          <SwipeToHide
            key={item.notificationId}
            open={openId === item.notificationId}
            onOpenChange={(next) => setOpenId(next ? item.notificationId : null)}
            onHide={() => handleHide(item)}
            hiding={hidingId === item.notificationId}
            disabled={markingAll || readingId !== null || (hidingId !== null && hidingId !== item.notificationId)}
            label={`알림 삭제: ${item.title}`}
          >
          <button
            type="button"
            onClick={() => handleOpen(item)}
            disabled={markingAll || readingId !== null}
            className={`w-full p-space-md rounded-2xl flex items-start gap-space-md text-left transition-all active:scale-[0.99] ${
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
          </SwipeToHide>
        )
      })}

      {hasNext && (
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
