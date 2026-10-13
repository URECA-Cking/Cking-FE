import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { ErrorBlock, LoadingBlock } from '../components/ui/States.jsx'
import { useMyTickets } from '../context/useMyTickets.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { spacePath } from '../api/creatorSpace.js'
import { formatNumber } from '../utils/format.js'

const cardClass = 'flex flex-col gap-space-sm p-space-md rounded-2xl bg-surface-container-lowest shadow-card'

/**
 * 내 응모권. 팔로우한 크리에이터별 응모권과 공용 응모권의 개수를 보여 준다.
 * 숫자는 헤더 응모권 버튼과 같은 데이터(MyTicketsProvider)를 쓰므로 응모·미션 완료 뒤 함께 바뀐다.
 * 크리에이터 응모권은 그 크리에이터의 이벤트에만, 공용 응모권은 모든 이벤트에 쓸 수 있다.
 */
export default function MyTickets() {
  const { followedCreators, followsReady, followsError, reloadFollows } = useUser()
  const { ready, loading, summary, creators: balances, failedIds, refresh } = useMyTickets()
  const directory = useAsync(() => loadCreatorDirectory(), [], {
    fallbackMessage: '크리에이터 정보를 불러오지 못했습니다.',
  })

  const followedProfiles = useMemo(
    () => (directory.data?.creators ?? []).filter((creator) => followedCreators.includes(creator.creatorId)),
    [directory.data, followedCreators],
  )

  if (!ready) {
    // 팔로우 목록을 불러오지 못하면 어느 크리에이터의 응모권을 조회할지 몰라 응모권도 불러올 수 없다. 영원히 로딩만 보이지 않게 다시 시도를 제공한다.
    return (
      <div className="flex flex-col w-full px-margin pt-space-md pb-8 md:mx-auto md:max-w-5xl md:px-8">
        {followsError ? (
          <ErrorBlock message="응모권을 불러오지 못했어요." onRetry={reloadFollows} />
        ) : (
          <LoadingBlock label="응모권을 불러오는 중..." />
        )}
      </div>
    )
  }

  const hasFollows = followedCreators.length > 0

  return (
    <div className="flex flex-col w-full px-margin pt-space-md pb-8 gap-space-lg md:mx-auto md:max-w-5xl md:px-8">
      <section className={cardClass}>
        <div className="flex items-center justify-between gap-space-sm">
          <span className="font-label-md text-label-md text-on-surface-variant">총 응모권</span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="font-label-sm text-label-sm text-primary font-semibold disabled:opacity-50"
          >
            {loading ? '불러오는 중...' : '다시 불러오기'}
          </button>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-metric-display text-metric-display font-extrabold text-on-surface tabular-nums">
            {formatNumber(summary.total)}
          </span>
          <span className="font-label-md text-label-md font-bold text-primary">장</span>
        </div>
        {summary.partial && (
          <p className="font-label-sm text-label-sm text-error">
            일부 응모권을 불러오지 못해 실제보다 적게 보일 수 있어요.
          </p>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-xs">
            <MaterialIcon name="confirmation_number" className="text-primary text-[20px]" />
            <h3 className="font-title-md text-title-md text-on-surface font-bold">공용 응모권</h3>
          </div>
          <span className="font-title-md text-title-md font-extrabold text-on-surface tabular-nums">
            {summary.commonCount === null ? '조회 실패' : `${formatNumber(summary.commonCount)}장`}
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          모든 크리에이터의 이벤트에 쓸 수 있어요. 출석 미션으로 받을 수 있어요.
        </p>
        <Link to="/" className="self-start font-label-sm text-label-sm text-primary font-semibold">
          출석하러 가기
        </Link>
      </section>

      <section className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between gap-space-sm">
          <h3 className="font-title-md text-title-md text-on-surface font-bold">크리에이터 응모권</h3>
          <span className="font-label-md text-label-md font-bold text-on-surface tabular-nums">
            {formatNumber(summary.creatorTotal)}장
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          각 크리에이터의 이벤트에만 쓸 수 있어요.
        </p>

        {followsReady && !hasFollows && (
          <div className={`${cardClass} items-start`}>
            <p className="font-body-sm text-body-sm text-on-surface-variant">아직 팔로우한 크리에이터가 없어요.</p>
            <Link to="/onboarding/creators" className="font-label-md text-label-md text-primary font-semibold">
              관심 크리에이터 고르기
            </Link>
          </div>
        )}
        {directory.error && <ErrorBlock message={directory.error} onRetry={directory.reload} />}
        {hasFollows && !directory.error && (
          <div className="flex flex-col gap-space-sm md:grid md:grid-cols-2">
            {directory.loading && followedProfiles.length === 0 && <LoadingBlock label="크리에이터를 불러오는 중..." />}
            {followedProfiles.map((creator) => {
              const entry = balances.get(creator.creatorId)
              const failed = failedIds.has(creator.creatorId)
              return (
                <Link
                  key={creator.creatorId}
                  to={spacePath(creator.handle)}
                  className="flex items-center justify-between gap-space-sm p-space-sm rounded-xl bg-surface-container-lowest shadow-card"
                >
                  <div className="flex items-center gap-space-sm min-w-0">
                    <img src={creator.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                      {creator.name}
                    </span>
                  </div>
                  <span
                    className={`font-label-md text-label-md font-bold shrink-0 tabular-nums ${failed ? 'text-error' : 'text-on-surface'}`}
                  >
                    {failed ? '조회 실패' : entry ? `${formatNumber(entry.balance)}장` : '조회 중'}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
