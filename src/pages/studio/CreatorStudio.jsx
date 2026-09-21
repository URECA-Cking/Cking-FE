import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock, StatusPill } from '../../components/ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useUser } from '../../context/useUser.js'
import { useAsync } from '../../hooks/useAsync.js'
import { deleteCreatorEvent, getMyCreatorEvents, requestEventApproval } from '../../api/creatorEvents.js'
import { closeEvent } from '../../api/events.js'
import { describeError } from '../../api/client.js'
import { formatDateTime, formatNumber, totalPrizeQuantity } from '../../utils/format.js'
import { eventStatusMeta } from '../../utils/eventStatus.js'

/**
 * 크리에이터 스튜디오.
 *
 * GET /api/creator/events 로 내가 만든 이벤트를 보여주고, 상태에 따라
 * 수정(PATCH) · 삭제(DELETE) · 승인 요청(POST .../approval-request) · 수동 마감(POST /events/{id}/close)을
 * 실행한다. 각 동작의 허용 상태는 백엔드 도메인 규칙과 동일하게 맞췄다.
 */
export default function CreatorStudio() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { userId } = useUser()
  const [busyId, setBusyId] = useState(null)

  const { data, loading, error, reload } = useAsync(
    () => getMyCreatorEvents(userId, { size: 50 }),
    [userId],
    { fallbackMessage: '내 이벤트를 불러오지 못했습니다.' },
  )

  const events = data?.items ?? []

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

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-28">
      <BackHeader title="크리에이터 스튜디오" onBack={() => navigate('/my-page')} />

      <div className="pt-16 px-margin flex flex-col gap-space-md">
        <div className="p-space-md rounded-2xl bg-gradient-to-br from-secondary via-[#7c3aed] to-[#5b21b6] text-on-secondary shadow-floating flex items-center justify-between">
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-wider opacity-80">내 이벤트</p>
            <p className="font-headline-lg text-headline-lg font-bold mt-1">{formatNumber(events.length)}개</p>
            <p className="font-label-xs text-label-xs opacity-80 mt-1">
              초안 → 승인 요청 → 관리자 승인 → 오픈 순서로 진행돼요
            </p>
          </div>
          <MaterialIcon name="dashboard" className="text-[36px] opacity-80" />
        </div>

        <Link
          to="/studio/events/new"
          className="w-full h-12 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-all"
        >
          <MaterialIcon name="add" className="text-[20px]" />새 이벤트 만들기
        </Link>

        {loading && <LoadingBlock label="내 이벤트를 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && events.length === 0 && (
          <EmptyBlock icon="post_add" message="아직 만든 이벤트가 없어요. 첫 이벤트를 만들어보세요!" />
        )}

        {events.map((event) => {
          const meta = eventStatusMeta(event.status)
          const editable = event.status === 'DRAFT' || event.status === 'REJECTED'
          const canRequestApproval = event.status === 'DRAFT'
          const canClose = ['OPEN', 'CLOSING', 'CLOSED'].includes(event.status)
          const busy = busyId === event.eventId

          return (
            <article
              key={event.eventId}
              className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-space-sm"
            >
              <div className="flex items-start justify-between gap-space-sm">
                <div className="min-w-0">
                  <p className="font-title-md text-title-md text-on-surface font-bold truncate">{event.title}</p>
                  <p className="font-label-xs text-label-xs text-on-surface-variant mt-0.5">
                    #{event.eventId} · {formatDateTime(event.startAt)} ~ {formatDateTime(event.endAt)}
                  </p>
                </div>
                <StatusPill label={meta.label} tone={meta.tone} className="shrink-0" />
              </div>

              <div className="flex items-center gap-space-md font-label-xs text-label-xs text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <MaterialIcon name="emoji_events" className="text-[14px]" />
                  당첨 {formatNumber(event.winnerCount)}명
                </span>
                <span className="flex items-center gap-1">
                  <MaterialIcon name="redeem" className="text-[14px]" />
                  상품 {formatNumber(totalPrizeQuantity(event.prizes))}개
                </span>
                <span className="flex items-center gap-1">
                  <MaterialIcon name="casino" className="text-[14px]" />
                  {event.drawMethod}
                </span>
              </div>

              {event.prizes?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {event.prizes.map((prize) => (
                    <span
                      key={prize.prizeKey}
                      className="px-2 py-0.5 rounded-full bg-surface-container-low font-label-xs text-label-xs text-on-surface-variant"
                    >
                      {prize.displayName} × {prize.quantity}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-space-xs">
                <button
                  type="button"
                  disabled={!editable || busy}
                  onClick={() => navigate(`/studio/events/${event.eventId}/edit`)}
                  className="h-10 rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  수정
                </button>
                <button
                  type="button"
                  disabled={!canRequestApproval || busy}
                  onClick={() =>
                    run(event.eventId, () => requestEventApproval(event.eventId, userId), '승인 요청을 보냈어요.')
                  }
                  className="h-10 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  승인 요청
                </button>
                <button
                  type="button"
                  disabled={!canClose || busy}
                  onClick={() => run(event.eventId, () => closeEvent(event.eventId, userId), '마감 처리를 시작했어요.')}
                  className="h-10 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  수동 마감
                </button>
                <button
                  type="button"
                  disabled={!editable || busy}
                  onClick={() => {
                    if (!window.confirm(`"${event.title}" 이벤트를 삭제할까요?`)) return
                    run(event.eventId, () => deleteCreatorEvent(event.eventId, userId), '이벤트를 삭제했어요.')
                  }}
                  className="h-10 rounded-xl bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  삭제
                </button>
              </div>

              <p className="font-label-xs text-label-xs text-outline leading-relaxed">
                수정·삭제는 초안(또는 거절됨) 상태에서만, 승인 요청은 초안 상태에서만, 수동 마감은 응모가 시작된
                뒤에만 가능해요.
              </p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
