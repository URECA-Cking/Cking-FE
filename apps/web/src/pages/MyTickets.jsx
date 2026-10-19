import { useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import ProfilePhoto from '../components/ui/ProfilePhoto.jsx'
import { ErrorBlock, LoadingBlock } from '../components/ui/States.jsx'
import { useMyTickets } from '../context/useMyTickets.js'
import { formatNumber } from '../utils/format.js'

// 팔로우한 크리에이터가 많아도 화면이 길어지지 않게 처음에는 이만큼만 보여 주고 나머지는 "더보기"로 펼친다.
const INITIAL_CREATOR_COUNT = 5

const cardClass = 'flex flex-col gap-space-sm p-space-md rounded-2xl bg-surface-container-lowest shadow-card'

/**
 * 내 응모권. 공용 응모권과 팔로우한 크리에이터별 응모권의 개수를 보여 준다.
 * 숫자는 헤더 응모권 버튼과 같은 데이터(MyTicketsProvider)를 쓰므로 응모·미션 완료 뒤 함께 바뀐다.
 * 크리에이터 응모권은 그 크리에이터의 이벤트에만, 공용 응모권은 모든 이벤트에 쓸 수 있다.
 */
export default function MyTickets() {
  const { ready, loading, error, summary, refresh, reload } = useMyTickets()
  const [showAllCreators, setShowAllCreators] = useState(false)

  if (!ready) {
    // 한 번도 받지 못했을 때는 0장으로 단정하지 않고, 불러오는 중이거나 오류와 다시 시도를 보여 준다.
    return (
      <div className="flex flex-col w-full px-margin pt-space-md pb-8 md:mx-auto md:max-w-5xl md:px-8">
        {error ? (
          <ErrorBlock message="응모권을 불러오지 못했어요." onRetry={reload} />
        ) : (
          <LoadingBlock label="응모권을 불러오는 중..." />
        )}
      </div>
    )
  }

  const visibleCreators = showAllCreators ? summary.creators : summary.creators.slice(0, INITIAL_CREATOR_COUNT)
  const hiddenCount = summary.creators.length - visibleCreators.length

  return (
    <div className="flex flex-col w-full px-margin pt-space-md pb-8 gap-space-lg md:mx-auto md:max-w-5xl md:px-8">
      <section className={cardClass}>
        <div className="flex items-center justify-between gap-space-sm">
          <span className="font-label-md text-label-md text-on-surface-variant">총 응모권</span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label={loading ? '불러오는 중' : '다시 불러오기'}
            className="-m-2 p-2 text-primary disabled:opacity-50"
          >
            <MaterialIcon name="refresh" className={`text-[20px] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-metric-display text-metric-display font-extrabold text-on-surface tabular-nums">
            {formatNumber(summary.total)}
          </span>
          <span className="font-label-md text-label-md font-bold text-primary">장</span>
        </div>
        {error && (
          <p className="font-label-sm text-label-sm text-error">
            최신 응모권을 불러오지 못해 이전에 받은 값을 보여 드려요.
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
            {formatNumber(summary.commonCount)}장
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

        {summary.creators.length === 0 ? (
          <div className={`${cardClass} items-start`}>
            <p className="font-body-sm text-body-sm text-on-surface-variant">아직 도킹한 크리에이터가 없어요.</p>
            <Link to="/onboarding/creators" className="font-label-md text-label-md text-primary font-semibold">
              도킹할 크리에이터 고르기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-space-sm md:grid md:grid-cols-2">
            {visibleCreators.map((creator) => (
              <Link
                key={creator.creatorId}
                // 요약 응답에는 공유 주소(slug)가 없어 크리에이터 ID로 스페이스에 간다.
                to={`/creators/${creator.creatorId}`}
                className="flex items-center justify-between gap-space-sm p-space-sm rounded-xl bg-surface-container-lowest shadow-card"
              >
                <div className="flex items-center gap-space-sm min-w-0">
                  <ProfilePhoto src={creator.avatar} className="h-9 w-9 shrink-0" />
                  <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    {creator.name}
                  </span>
                </div>
                <span className="font-label-md text-label-md font-bold shrink-0 tabular-nums text-on-surface">
                  {formatNumber(creator.balance)}장
                </span>
              </Link>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllCreators(true)}
                className="flex items-center justify-center gap-1 py-space-sm rounded-xl bg-surface-container-lowest shadow-card font-label-md text-label-md text-primary font-semibold md:col-span-2"
              >
                더보기 ({formatNumber(hiddenCount)}명)
                <MaterialIcon name="expand_more" className="text-[18px]" />
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
