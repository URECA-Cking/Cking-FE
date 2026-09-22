import { Link } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock, StatusPill } from '../components/ui/States.jsx'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadMyEntries } from '../api/myEntries.js'
import { getCreatorProfile, getEventBanner } from '../data/creatorProfiles.js'
import { formatDateTime, formatNumber } from '../utils/format.js'
import { eventStatusMeta } from '../utils/eventStatus.js'

/**
 * 내 응모 현황.
 *
 * 백엔드는 "내 응모 목록" API를 제공하지만 아직 연동하지 않아, 응모 시 기록되는 응모권 원장(SPEND + eventId)을
 * 이벤트 단위로 모아 실제 응모 내역을 보여준다. 결과가 공개된 이벤트는
 * GET /api/events/{eventId}/winners 로 내 당첨 여부까지 확인한다.
 */
export default function MyEntries() {
  const { userId } = useUser()
  const { data, loading, error, reload } = useAsync(() => loadMyEntries(userId), [userId], {
    fallbackMessage: '응모 내역을 불러오지 못했습니다.',
  })

  const entries = data?.entries ?? []

  return (
    <div className="flex min-h-full flex-col w-full px-margin pt-space-md pb-8 gap-space-md md:mx-auto md:max-w-5xl md:px-8">
      <div>
        <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">내 응모 현황</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          지금까지 참여한 래플 응모 내역을 한눈에 확인해봐
        </p>
      </div>

      {!loading && !error && entries.length > 0 && (
        <section className="p-space-md rounded-2xl bg-gradient-to-br from-primary via-[#be185d] to-berry-deep text-on-primary shadow-floating flex items-center justify-between">
          <div>
            <p className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">누적 사용 응모권</p>
            <p className="font-headline-lg text-headline-lg font-bold mt-1">
              🎟 {formatNumber(data.totalSpent)}장
            </p>
            <p className="font-label-xs text-label-xs text-primary-fixed mt-1">참여한 이벤트 {entries.length}개</p>
          </div>
          <MaterialIcon name="local_activity" className="text-[36px] text-primary-fixed" />
        </section>
      )}

      {!loading && !error && (data?.failedEventCount > 0 || data?.winnersFailed) && (
        <div className="flex items-center gap-2 p-space-sm rounded-xl bg-surface-container-lowest text-on-surface-variant">
          <MaterialIcon name="warning" className="text-[18px] text-primary shrink-0" />
          <p className="font-label-xs text-label-xs leading-relaxed flex-1">
            {data.failedEventCount > 0 && `이벤트 ${data.failedEventCount}개의 응모 내역을 불러오지 못했어요. `}
            {data.winnersFailed && '일부 당첨 결과를 확인하지 못했어요.'}
          </p>
          <button
            type="button"
            onClick={reload}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-xs text-label-xs font-semibold active:scale-95 transition-all"
          >
            다시 시도
          </button>
        </div>
      )}

      {loading && <LoadingBlock label="응모 내역을 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <EmptyBlock
            icon="confirmation_number"
            message="아직 응모한 이벤트가 없어요. 진행 중인 이벤트에 응모해보세요!"
            action={
              <Link
                to="/explore"
                className="mt-1 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold active:scale-95 transition-all"
              >
                이벤트 둘러보기
              </Link>
            }
          />
        </div>
      )}

      <div className="flex flex-col md:grid md:grid-cols-2 gap-space-sm">
        {entries.map((entry) => {
          const event = entry.event
          const creator = getCreatorProfile(event?.creatorId)
          const statusMeta = event ? eventStatusMeta(event.status) : null
          const won = Boolean(entry.myWin)

          return (
            <Link
              key={entry.eventId}
              to={`/events/${entry.eventId}`}
              className={`p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-space-sm active:scale-[0.99] transition-all ${
                won ? 'border border-primary' : ''
              }`}
            >
              <div className="flex items-center gap-space-md">
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-surface-container">
                  <img className="w-full h-full object-cover" src={getEventBanner(entry.eventId)} alt="" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-label-xs text-label-xs text-primary font-bold shrink-0">{creator.name}</span>
                    <span className="text-outline text-[10px] shrink-0">·</span>
                    <span className="font-label-xs text-label-xs text-on-surface-variant truncate">
                      {formatDateTime(entry.lastAt)} 응모
                    </span>
                  </div>
                  <p className="font-title-md text-title-md text-on-surface font-semibold truncate">
                    {event?.title ?? `이벤트 #${entry.eventId}`}
                  </p>
                </div>
                {statusMeta && <StatusPill label={statusMeta.label} tone={statusMeta.tone} className="shrink-0" />}
              </div>

              <div className="flex items-center justify-between pt-space-sm border-t border-surface-container">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  사용한 응모권{' '}
                  <strong className="text-primary font-bold">{formatNumber(entry.ticketCount)}장</strong>
                  <span className="text-outline"> · {entry.entryCount}회 응모</span>
                </span>
                {entry.published ? (
                  entry.winUnknown ? (
                    <span className="font-label-sm text-label-sm text-on-surface-variant">당첨 확인 불가</span>
                  ) : won ? (
                    <span className="flex items-center gap-1 font-label-sm text-label-sm text-primary font-bold">
                      <MaterialIcon name="celebration" filled className="text-[16px]" />
                      당첨! {entry.myWin.prizeDisplayName ?? ''}
                    </span>
                  ) : (
                    <span className="font-label-sm text-label-sm text-on-surface-variant">아쉽게 미당첨</span>
                  )
                ) : (
                  <span className="font-label-sm text-label-sm text-on-surface-variant">발표 대기</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
