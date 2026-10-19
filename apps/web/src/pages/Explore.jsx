import CreatorVerifiedBadge from '../components/ui/CreatorVerifiedBadge.jsx'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import ProfilePhoto from '../components/ui/ProfilePhoto.jsx'
import CreatorRow from '../components/creator/CreatorRow.jsx'
import EventCard from '../components/creator/EventCard.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { getEventCounts, getEvents } from '../api/events.js'
import { CreatorFilterChips, CreatorSortMenu } from '../components/creator/CreatorListControls.jsx'
import { useOwnCreatorId } from '../hooks/useOwnCreatorId.js'
import { useCreatorBalances } from '../hooks/useCreatorBalances.js'
import { useVisibleCreatorIds } from '../hooks/useVisibleCreatorIds.js'
import { formatNumber } from '../utils/format.js'
import { creatorFilterCounts, filterExploreCreators, sortExploreCreators } from '../utils/exploreCreatorSection.js'
import { describeError } from '../api/client.js'
import { spacePath } from '../api/creatorSpace.js'

// 목록에는 앞 7명만 보여주고, 그 뒤는 '전체' 버튼으로 전체 크리에이터 화면에 넘긴다.
const CREATOR_PREVIEW = 7
// 이벤트는 5개씩 늘려 가며 다시 받는다. BE 페이지 상한(100)을 넘기면 더 받을 수 없다.
// 진행 중 이벤트가 많은 크리에이터는 3위까지 먼저 보이고 '더 보기'로 5위까지 펼친다.
const TRENDING_PREVIEW = 3
const TRENDING_MAX = 5
const EVENT_PAGE_SIZE = 5
const EVENT_MAX_SIZE = 100

const EVENT_FILTERS = [
  { id: '', label: '전체' },
  { id: 'IN_PROGRESS', label: '진행 중' },
  { id: 'UPCOMING', label: '오픈 예정' },
  { id: 'CLOSED', label: '종료' },
]

/**
 * 탐색 화면.
 *
 * 크리에이터 검색과 관심 필터는 이벤트 및 서버 팔로우 목록의 크리에이터를 대상으로 하고,
 * 이벤트 목록은 GET /api/events 의 status(표시 상태) 필터를 그대로 사용한다.
 */
export default function Explore() {
  const pageRef = useRef(null)
  const showToast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user, followedCreators, toggleFollow, isFollowing, followsReady, pendingFollowIds } = useUser()
  const { ownCreatorId, ownSpacePending } = useOwnCreatorId()
  // 탭과 검색어는 주소에 둔다. 다른 화면의 '이벤트 둘러보기' 링크가 이벤트 탭으로 열 수 있고, 검색 뒤 뒤로 가기에서도 유지된다.
  const tab = params.get('tab') === 'event' ? 'event' : 'creator'
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [creatorFilter, setCreatorFilter] = useState('전체')
  const [creatorSort, setCreatorSort] = useState('name-asc')
  const [trendingExpanded, setTrendingExpanded] = useState(false)
  const [eventFilter, setEventFilter] = useState('IN_PROGRESS')
  const [eventSize, setEventSize] = useState(EVENT_PAGE_SIZE)

  const directory = useAsync(() => loadCreatorDirectory(), [], {
    fallbackMessage: '크리에이터를 불러오지 못했습니다.',
  })
  // 필터 칩의 개수. 선택한 필터와 상관없이 한 번만 받고(서버 집계 한 번, 없으면 상태별 호출), 못 받으면 개수 없이 칩만 보인다.
  const eventCounts = useAsync(() => getEventCounts(EVENT_FILTERS.map((filter) => filter.id)), [], { enabled: tab === 'event' })
  const eventList = useAsync(
    () => getEvents({ status: eventFilter || undefined, size: eventSize }),
    [eventFilter, eventSize],
    { fallbackMessage: '이벤트를 불러오지 못했습니다.' },
  )

  const creators = useMemo(() => directory.data?.creators ?? [], [directory.data])

  const filteredCreators = useMemo(
    () => sortExploreCreators(filterExploreCreators(creators, followedCreators, creatorFilter, ''), creatorSort),
    [creators, creatorFilter, creatorSort, followedCreators],
  )

  // 진행 중 이벤트 수는 공개 API의 값만 사용한다. 이벤트 탭에서 이벤트가 많이 열린 크리에이터를 소개한다.
  const trending = useMemo(
    () =>
      [...creators]
        .filter((creator) => creator.openEventCount > 0)
        .sort((a, b) => b.openEventCount - a.openEventCount || b.events.length - a.events.length)
        .slice(0, TRENDING_MAX),
    [creators],
  )

  // 필터를 바꿔 처음부터 다시 받는 동안에는 이전 필터의 목록을 보여주지 않는다. '더 보기'로 늘리는 중에는 목록을 유지한다.
  const eventsFirstLoad = eventList.loading && eventSize === EVENT_PAGE_SIZE
  const events = eventsFirstLoad ? [] : (eventList.data?.items ?? [])
  const shownCreators = useMemo(() => filteredCreators.slice(0, CREATOR_PREVIEW), [filteredCreators])
  const renderedBalanceIds = [
    ...shownCreators.map((creator) => creator.creatorId),
  ]
  const visibleBalanceIds = useVisibleCreatorIds(pageRef, renderedBalanceIds)
  const { balances, failedIds, retry: retryBalances, loading: balancesLoading } = useCreatorBalances(visibleBalanceIds, user?.memberId)

  async function handleToggleFollow(creator) {
    try {
      const result = await toggleFollow(creator.creatorId)
      if (result) showToast(result.following ? `${creator.name} 도킹 완료! 💖` : '도킹이 해제되었습니다.')
    } catch (error) {
      showToast(describeError(error, '도킹 상태를 변경하지 못했어요.'), { icon: 'error' })
    }
  }

  function changeTab(next) {
    setParams((current) => {
      const nextParams = new URLSearchParams(current)
      if (next === 'event') nextParams.set('tab', 'event')
      else nextParams.delete('tab')
      return nextParams
    }, { replace: true })
  }

  function changeEventFilter(nextFilter) {
    setEventFilter(nextFilter)
    setEventSize(EVENT_PAGE_SIZE)
  }

  function changeCreatorFilter(nextFilter) {
    setCreatorFilter(nextFilter)
  }

  // 진행 중 뱃지와 응모권 잔액은 이름 아래에 작게 보여 준다. 잔액은 화면에 보이는 행만 조회한다.
  function renderCreatorMeta(creator) {
    const balance = balances.get(creator.creatorId)
    return (
      <div className="flex items-center gap-2 font-label-xs text-label-xs text-outline">
        {creator.openEventCount > 0 && (
          <span className="px-2 py-0.5 rounded border border-primary text-primary">진행 중 {creator.openEventCount}</span>
        )}
        <span>🎟 {balance ? `${formatNumber(balance.balance)}장` : failedIds.has(creator.creatorId) ? '조회 실패' : '조회 중'}</span>
      </div>
    )
  }

  return (
    <div ref={pageRef} className="flex flex-col w-full pb-8">
      <div className="px-margin pt-space-md pb-space-sm flex flex-col gap-space-sm">
        <form
          className="relative w-full"
          onSubmit={(event) => {
            event.preventDefault()
            const keyword = query.trim()
            // 보던 탭에 맞춰 검색 대상을 좁혀 연다. 결과 화면에서 '전체'로 넓힐 수 있다.
            if (!keyword) return
            // 뒤로 돌아왔을 때 검색어가 남도록 현재 기록에 q를 심어 두고 이동한다.
            setParams((current) => { const next = new URLSearchParams(current); next.set('q', keyword); return next }, { replace: true })
            navigate(`/explore/search?q=${encodeURIComponent(keyword)}&type=${tab}`)
          }}
        >
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
            <MaterialIcon name="search" className="text-[20px]" />
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:bg-surface-container transition-colors shadow-sm"
            placeholder={tab === 'event' ? '이벤트 제목이나 크리에이터로 검색해 보세요' : '크리에이터를 검색해 보세요 (아티스트, 유튜버, 스트리머)'}
            type="search"
          />
          {query && (
            <button
              type="button"
              aria-label="지우기"
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-outline hover:text-on-surface transition-colors"
            >
              <MaterialIcon name="cancel" className="text-[18px]" />
            </button>
          )}
        </form>
        <div role="tablist" className="relative flex border-b border-outline-variant/30">
          {[['creator', '크리에이터'], ['event', '이벤트']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => changeTab(id)}
              className={`flex-1 h-10 font-label-md text-label-md font-semibold transition-colors ${
                tab === id ? 'text-on-surface' : 'text-outline'
              }`}
            >
              {label}
            </button>
          ))}
          {/* 탭 두 개가 같은 너비라 활성 탭 순서만큼 한 칸씩 밀어 밑줄이 미끄러지듯 옮겨 간다. */}
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-0.5 w-1/2 bg-primary transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(${tab === 'creator' ? 0 : 100}%)` }}
          />
        </div>
        {tab === 'creator' && (
        <Link
          to="/explore/recommend"
          className="flex items-center justify-between gap-2 px-3 h-11 rounded-xl bg-berry-tint text-primary font-label-md text-label-md font-semibold active:scale-[0.98] transition-all"
        >
          <span className="flex items-center gap-1.5">
            <MaterialIcon name="auto_awesome" className="text-[18px]" />
            맞춤 추천 보기
          </span>
          <MaterialIcon name="chevron_right" className="text-[20px]" />
        </Link>
        )}
      </div>

      {tab === 'creator' && (<>
      <section className="mt-space-md flex flex-col">
        <div className="px-margin mb-space-sm flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <MaterialIcon name="groups" className="text-[20px] text-primary" />
            <h2 className="font-title-md text-title-md font-bold text-on-surface">크리에이터</h2>
          </div>
          <CreatorSortMenu value={creatorSort} onChange={setCreatorSort} />
        </div>
        <CreatorFilterChips value={creatorFilter} onChange={changeCreatorFilter} counts={directory.data ? creatorFilterCounts(creators, followedCreators) : undefined} />
        {directory.loading && <LoadingBlock label="크리에이터를 불러오는 중..." />}
        {!directory.loading && directory.error && (
          <ErrorBlock message={directory.error} onRetry={directory.reload} />
        )}
        {failedIds.size > 0 && !directory.error && (
          <button type="button" onClick={retryBalances} disabled={balancesLoading} className="mx-margin mb-2 self-start font-label-sm text-label-sm text-primary disabled:opacity-50">
            응모권 잔액 다시 조회
          </button>
        )}
        {!directory.loading && !directory.error && filteredCreators.length === 0 && (
          creatorFilter === '도킹' && followedCreators.length === 0
            ? <EmptyBlock
              icon="favorite_border"
              message="아직 도킹한 크리에이터가 없어요. 마음에 드는 크리에이터를 찾아보세요."
              action={<button type="button" onClick={() => changeCreatorFilter('전체')} className="mt-2 min-h-10 rounded-xl bg-primary px-4 font-label-sm text-label-sm font-semibold text-on-primary active:scale-95">전체 크리에이터 보기</button>}
            />
            : <EmptyBlock icon="person_search" message={creatorFilter === '진행 중' ? '지금 진행 중인 이벤트가 있는 크리에이터가 없어요.' : '조건에 맞는 크리에이터가 없어요.'} />
        )}
        {!directory.loading && !directory.error && filteredCreators.length > 0 && (
          <div className="px-margin flex flex-col">
            {shownCreators.map((creator) => (
              <CreatorRow
                key={creator.creatorId}
                creator={creator}
                variant="flat"
                highlight={creator.openEventCount > 0}
                meta={renderCreatorMeta(creator)}
                trackBalance
                followed={isFollowing(creator.creatorId)}
                disabled={!followsReady || pendingFollowIds.has(creator.creatorId) || ownSpacePending || ownCreatorId === creator.creatorId}
                onToggle={handleToggleFollow}
              />
            ))}
            {filteredCreators.length > shownCreators.length && (
              <Link
                to={`/explore/creators?filter=${encodeURIComponent(creatorFilter)}&sort=${creatorSort}`}
                aria-label="전체 크리에이터 보기"
                className="self-center mt-2 h-[34px] px-5 rounded-full bg-surface-container-low text-primary font-label-md text-label-md flex items-center active:scale-95 transition-all"
              >
                전체
              </Link>
            )}
          </div>
        )}
      </section>

      </>)}

      {tab === 'event' && (
      <section className="mt-space-sm flex flex-col">
        {trending.length > 0 && (
          <div className="px-margin mb-space-lg flex flex-col">
            <div className="flex items-center gap-1.5 mb-1">
              <MaterialIcon name="trending_up" className="text-tertiary text-[20px]" />
              <h2 className="font-title-md text-title-md font-bold text-on-surface">진행 중 이벤트가 많은 크리에이터</h2>
            </div>
            {directory.data?.eventsTruncated && (
              <p className="mb-space-sm font-label-xs text-label-xs text-outline">
                최근 이벤트 {formatNumber(directory.data.events.length)}건 기준 집계예요.
              </p>
            )}
            {!directory.data?.eventsTruncated && <div className="mb-1" />}
            <div className="flex flex-col gap-2.5">
              {trending.slice(0, trendingExpanded ? TRENDING_MAX : TRENDING_PREVIEW).map((creator, index) => (
                <Link
                  key={creator.creatorId}
                  to={spacePath(creator.handle)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-lowest shadow-card flex items-center gap-2.5 active:scale-[0.98] transition-all"
                >
                  <span className="font-label-md text-label-md font-bold text-primary w-4 text-center">{index + 1}</span>
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                    <ProfilePhoto src={creator.avatar} className="h-full w-full" loading="lazy" decoding="async" />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="font-label-md text-label-md font-semibold text-on-surface truncate">{creator.name}</span>
                      <CreatorVerifiedBadge />
                    </span>
                    <span className="font-label-sm text-label-sm text-secondary font-semibold">
                      진행 중 {creator.openEventCount}개{directory.data?.eventsComplete && ` · 전체 ${creator.events.length}개`}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            {trending.length > TRENDING_PREVIEW && (
              <button
                type="button"
                onClick={() => setTrendingExpanded((expanded) => !expanded)}
                className="mt-2 h-9 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md active:scale-95 transition-all"
              >
                {trendingExpanded ? '접기' : '더 보기'}
              </button>
            )}
          </div>
        )}
        <div className="px-margin flex items-center justify-between mb-space-sm">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="confirmation_number" filled className="text-primary text-[20px]" />
            <h2 className="font-title-md text-title-md font-bold text-on-surface">이벤트 둘러보기</h2>
          </div>
        </div>
        <div className="flex overflow-x-auto gap-2 px-margin no-scrollbar py-1 mb-space-sm">
          {EVENT_FILTERS.map((filter) => (
            <button
              key={filter.id || 'all'}
              type="button"
              onClick={() => changeEventFilter(filter.id)}
              className={`px-4 py-1.5 rounded-full font-label-sm text-label-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
                eventFilter === filter.id
                  ? 'bg-inverse-surface text-inverse-on-surface shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant'
              }`}
            >
              {filter.label}
              {eventCounts.data?.[filter.id] != null && ` ${formatNumber(eventCounts.data[filter.id])}`}
            </button>
          ))}
        </div>

        {eventsFirstLoad && <LoadingBlock label="이벤트를 불러오는 중..." />}
        {!eventList.loading && eventList.error && (
          <ErrorBlock message={eventList.error} onRetry={eventList.reload} />
        )}
        {!eventList.loading && !eventList.error && events.length === 0 && (
          <EmptyBlock icon="event_busy" message="이 조건에 해당하는 이벤트가 없어요." />
        )}
        {!eventList.error && events.length > 0 && (
          <div className="px-margin grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {events.map((event) => (
              <EventCard
                key={event.eventId}
                event={event}
                variant="compact"
                showCreatorTag
              />
            ))}
          </div>
        )}
        {!eventList.error && eventList.data?.hasNext && eventSize < EVENT_MAX_SIZE && (
          <button
            type="button"
            onClick={() => setEventSize((size) => Math.min(size + EVENT_PAGE_SIZE, EVENT_MAX_SIZE))}
            disabled={eventList.loading}
            className="mx-margin mt-space-md h-11 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md active:scale-95 transition-all disabled:opacity-60"
          >
            {eventList.loading ? '불러오는 중...' : '더 보기'}
          </button>
        )}
      </section>
      )}
    </div>
  )
}
