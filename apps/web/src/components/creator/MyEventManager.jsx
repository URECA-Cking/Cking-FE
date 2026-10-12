import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import BottomSheet from '../ui/BottomSheet.jsx'
import ConfirmSheet from '../ui/ConfirmSheet.jsx'
import EventCard from './EventCard.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { deleteCreatorEvent, getMyCreatorEvents, requestEventApproval } from '../../api/creatorEvents.js'
import { closeEvent } from '../../api/events.js'
import { describeError } from '../../api/client.js'
import { toDisplayStatus } from '../../utils/eventStatus.js'

const PAGE_SIZE = 50

/**
 * 내 스페이스 이벤트 탭의 본인용 이벤트 목록. 팬이 보는 것과 같은 카드를 쓰고, 초안·승인 대기·거절됨처럼
 * 아직 공개되지 않은 이벤트도 상태 뱃지와 함께 섞어 보여준다. 카드의 ⋯ 메뉴에서 상태에 따라
 * 수정 · 승인 요청(POST .../approval-request) · 수동 마감(POST /events/{id}/close) · 삭제(DELETE)를 실행한다.
 * 각 동작의 허용 상태는 백엔드 도메인 규칙과 동일하게 맞췄다.
 */
export default function MyEventManager() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [busyId, setBusyId] = useState(null)
  const [menuTarget, setMenuTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  // 첫 페이지(data) 뒤에 "더 보기"로 이어 읽은 페이지. 다시 읽으면(data가 바뀌면) 버린다.
  const [more, setMore] = useState({ base: null, items: [], page: 0, hasNext: false })
  const [moreLoading, setMoreLoading] = useState(false)

  const { data, loading, error, reload } = useAsync(
    () => getMyCreatorEvents({ page: 0, size: PAGE_SIZE }),
    [],
    { fallbackMessage: '내 이벤트를 불러오지 못했습니다.' },
  )

  const extra = more.base === data ? more : null
  const events = [...(data?.items ?? []), ...(extra?.items ?? [])].map((event) => ({
    ...event,
    displayStatus: toDisplayStatus(event),
  }))
  const hasNext = extra ? extra.hasNext : Boolean(data?.hasNext)

  async function loadMore() {
    const page = (extra?.page ?? 0) + 1
    setMoreLoading(true)
    try {
      const result = await getMyCreatorEvents({ page, size: PAGE_SIZE })
      setMore({ base: data, items: [...(extra?.items ?? []), ...(result.items ?? [])], page, hasNext: Boolean(result.hasNext) })
    } catch (err) {
      showToast(describeError(err, '이벤트를 더 불러오지 못했어요.'), { icon: 'error' })
    } finally {
      setMoreLoading(false)
    }
  }

  async function run(eventId, action, successMessage) {
    setBusyId(eventId)
    try {
      await action()
      showToast(successMessage)
      await reload()
    } catch (err) {
      showToast(describeError(err, '요청을 처리하지 못했습니다.'), { icon: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const menuEvent = menuTarget
  const busy = busyId !== null
  const editable = menuEvent?.status === 'DRAFT' || menuEvent?.status === 'REJECTED'
  const canRequestApproval = menuEvent?.status === 'DRAFT'
  const canClose = ['OPEN', 'CLOSING', 'CLOSED'].includes(menuEvent?.status)
  const menuItemClass =
    'flex h-12 w-full items-center gap-2 rounded-xl px-3 font-label-md text-label-md font-semibold transition-all active:scale-[0.98] disabled:opacity-40'

  return (
    <div className="flex flex-col gap-space-md">
      <Link
        to="/creator/events/new"
        className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-primary font-label-md text-label-md font-bold text-on-primary shadow-md transition-all active:scale-[0.98]"
      >
        <MaterialIcon name="add" className="text-[20px]" />새 이벤트 만들기
      </Link>

      {loading && <LoadingBlock label="내 이벤트를 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && events.length === 0 && (
        <EmptyBlock icon="post_add" message="아직 만든 이벤트가 없어요. 첫 이벤트를 만들어보세요!" />
      )}

      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <EventCard key={event.eventId} event={event} variant="list" onManage={() => setMenuTarget(event)} />
        ))}
      </div>

      {hasNext && (
        <button
          type="button"
          disabled={moreLoading}
          onClick={loadMore}
          className="h-11 rounded-xl bg-surface-container font-label-md text-label-md font-semibold text-on-surface transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {moreLoading ? '불러오는 중...' : '이벤트 더 보기'}
        </button>
      )}

      <BottomSheet open={menuEvent !== null} onClose={() => setMenuTarget(null)} title={menuEvent?.title}>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={!editable || busy}
            onClick={() => {
              navigate(`/creator/events/${menuEvent.eventId}/edit`)
              setMenuTarget(null)
            }}
            className={`${menuItemClass} bg-surface-container text-on-surface`}
          >
            <MaterialIcon name="edit" className="text-[20px]" />수정
          </button>
          <button
            type="button"
            disabled={!canRequestApproval || busy}
            onClick={async () => {
              const target = menuEvent
              setMenuTarget(null)
              await run(target.eventId, () => requestEventApproval(target.eventId), '승인 요청을 보냈어요.')
            }}
            className={`${menuItemClass} bg-surface-container text-on-surface`}
          >
            <MaterialIcon name="send" className="text-[20px]" />승인 요청
          </button>
          <button
            type="button"
            disabled={!canClose || busy}
            onClick={async () => {
              const target = menuEvent
              setMenuTarget(null)
              await run(target.eventId, () => closeEvent(target.eventId), '마감 처리를 시작했어요.')
            }}
            className={`${menuItemClass} bg-surface-container text-on-surface`}
          >
            <MaterialIcon name="lock" className="text-[20px]" />수동 마감
          </button>
          <button
            type="button"
            disabled={!editable || busy}
            onClick={() => {
              setDeleteTarget(menuEvent)
              setMenuTarget(null)
            }}
            className={`${menuItemClass} bg-error-container text-on-error-container`}
          >
            <MaterialIcon name="delete" className="text-[20px]" />삭제
          </button>
        </div>
      </BottomSheet>

      <ConfirmSheet
        open={deleteTarget !== null}
        title="이벤트를 삭제할까요?"
        message={deleteTarget ? `"${deleteTarget.title}" 이벤트를 삭제해요.` : ''}
        busy={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          await run(deleteTarget.eventId, () => deleteCreatorEvent(deleteTarget.eventId), '이벤트를 삭제했어요.')
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
