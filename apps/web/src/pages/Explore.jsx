import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import ProfilePhoto from '../components/ui/ProfilePhoto.jsx'
import CreatorBanner from '../components/creator/CreatorBanner.jsx'
import EventCard from '../components/creator/EventCard.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { getMySpace } from '../api/creatorSpace.js'
import { getEvents } from '../api/events.js'
import { useCreatorBalances } from '../hooks/useCreatorBalances.js'
import { useVisibleCreatorIds } from '../hooks/useVisibleCreatorIds.js'
import { formatNumber } from '../utils/format.js'
import { filterExploreCreators, resetCreatorCarousel } from '../utils/exploreCreatorSection.js'
import { describeError } from '../api/client.js'
import { spacePath } from '../api/creatorSpace.js'

// 크리에이터가 수천 명일 수 있어 처음엔 일부만 그리고 '더 보기'로 늘린다.
const CREATOR_PAGE_SIZE = 30

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
  const creatorCarouselRef = useRef(null)
  const showToast = useToast()
  const navigate = useNavigate()
  const { user, followedCreators, toggleFollow, isFollowing, followsReady, pendingFollowIds, isCreator } = useUser()
  const mySpace = useAsync(
    () => getMySpace().then((space) => ({ ...space, memberId: user.memberId })),
    [isCreator, user?.memberId],
    { enabled: isCreator },
  )
  const ownSpaceReady = isCreator && !mySpace.loading && mySpace.data?.memberId === user?.memberId
  const ownCreatorId = ownSpaceReady ? mySpace.data.creatorId : null
  const ownSpacePending = isCreator && !ownSpaceReady
  const [tab, setTab] = useState('creator')
  const [query, setQuery] = useState('')
  const [creatorFilter, setCreatorFilter] = useState('전체')
  const [eventFilter, setEventFilter] = useState('IN_PROGRESS')
  const [creatorLimit, setCreatorLimit] = useState(CREATOR_PAGE_SIZE)

  const directory = useAsync(() => loadCreatorDirectory(), [], {
    fallbackMessage: '크리에이터를 불러오지 못했습니다.',
  })
  const eventList = useAsync(
    () => getEvents({ status: eventFilter || undefined, size: 30 }),
    [eventFilter],
    { fallbackMessage: '이벤트를 불러오지 못했습니다.' },
  )

  const creators = useMemo(() => directory.data?.creators ?? [], [directory.data])

  const filteredCreators = useMemo(
    () => filterExploreCreators(creators, followedCreators, creatorFilter, ''),
    [creators, creatorFilter, followedCreators],
  )

  // 진행 중 이벤트 수는 공개 API의 값만 사용한다.
  const trending = useMemo(
    () =>
      [...creators]
        .filter((creator) => creator.openEventCount > 0)
        .sort((a, b) => b.openEventCount - a.openEventCount || b.events.length - a.events.length)
        .slice(0, 3),
    [creators],
  )

  const events = eventList.data?.items ?? []
  const shownCreators = useMemo(() => filteredCreators.slice(0, creatorLimit), [filteredCreators, creatorLimit])
  const renderedBalanceIds = [
    ...shownCreators.map((creator) => creator.creatorId),
    ...trending.map((creator) => creator.creatorId),
  ]
  const visibleBalanceIds = useVisibleCreatorIds(pageRef, renderedBalanceIds)
  const { balances, failedIds, retry: retryBalances, loading: balancesLoading } = useCreatorBalances(visibleBalanceIds, user?.memberId)

  async function handleToggleFollow(creator) {
    try {
      const result = await toggleFollow(creator.creatorId)
      if (result) showToast(result.following ? `${creator.name} 관심 크리에이터로 등록되었어요! 💖` : '관심 크리에이터에서 해제되었습니다.')
    } catch (error) {
      showToast(describeError(error, '관심 상태를 변경하지 못했어요.'), { icon: 'error' })
    }
  }

  function changeCreatorFilter(nextFilter) {
    setCreatorFilter(nextFilter)
    setCreatorLimit(CREATOR_PAGE_SIZE)
    resetCreatorCarousel(creatorCarouselRef.current)
  }

  // 추천 섹션과 전체 목록이 같은 카드를 쓴다. 추천 카드만 노출·클릭 수집용 ref/onClick을 받는다.
  function renderCreatorCard(creator, { impressionRef, onOpen } = {}) {
    const followed = isFollowing(creator.creatorId)
    return (
      <div
        key={creator.creatorId}
        data-balance-creator-id={creator.creatorId}
        ref={impressionRef?.(creator.creatorId)}
        className="min-w-[260px] max-w-[260px] md:min-w-0 md:max-w-none snap-center rounded-2xl bg-surface-container-lowest p-3 shadow-card flex flex-col"
      >
        <Link to={spacePath(creator.handle)} onClick={onOpen ? () => onOpen(creator.creatorId) : undefined} className="block">
          <div className="relative w-full h-36 rounded-xl overflow-hidden mb-3">
            <CreatorBanner src={creator.banner} profileSrc={creator.avatar} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            {creator.openEventCount > 0 && (
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-xs text-label-xs font-semibold flex items-center gap-1">
                <MaterialIcon name="stars" filled className="text-[12px]" />
                진행 중 {creator.openEventCount}
              </span>
            )}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white">
              <span className="font-label-xs text-label-xs bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">
                🎟 {balances.has(creator.creatorId)
                  ? `${formatNumber(balances.get(creator.creatorId).balance)}장`
                  : failedIds.has(creator.creatorId) ? '조회 실패' : '조회 중'}
              </span>
            </div>
          </div>
          <div className="mb-1.5">
            <div className="flex items-center gap-1">
              <h3 className="font-title-md text-title-md text-on-surface truncate">{creator.name}</h3>
              <MaterialIcon name="verified" filled className="text-[16px] text-primary" />
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-outline line-clamp-1 mb-3">{creator.bio}</p>
        </Link>
        <button
          type="button"
          onClick={() => handleToggleFollow(creator)}
          disabled={!followsReady || pendingFollowIds.has(creator.creatorId) || ownSpacePending || ownCreatorId === creator.creatorId}
          className={`mt-auto w-full h-9 rounded-xl font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-60 ${
            followed ? 'bg-primary text-on-primary' : 'bg-berry-tint text-primary'
          }`}
        >
          <MaterialIcon name="favorite" filled={followed} className="text-[18px]" />
          <span>{followed ? '관심 중' : '관심 추가'}</span>
        </button>
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
            if (keyword) navigate(`/explore/search?q=${encodeURIComponent(keyword)}&type=${tab}`)
          }}
        >
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
            <MaterialIcon name="search" className="text-[20px]" />
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:bg-surface-container transition-all shadow-sm"
            placeholder="크리에이터를 검색해 보세요 (아티스트, 유튜버, 스트리머)"
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
              onClick={() => setTab(id)}
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
        <div className="px-margin mb-space-sm flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <MaterialIcon name="groups" className="text-[20px] text-primary" />
            <h2 className="font-title-lg text-title-lg text-on-surface">크리에이터</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2" aria-label="크리에이터 목록 필터">
            {['전체', '관심'].map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={creatorFilter === item}
                onClick={() => changeCreatorFilter(item)}
                className={`min-h-9 rounded-full px-3 py-1.5 font-label-sm text-label-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
                  creatorFilter === item
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {item === '관심' ? `관심 ${followedCreators.length}` : item}
              </button>
            ))}
          </div>
        </div>
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
          creatorFilter === '관심' && followedCreators.length === 0
            ? <EmptyBlock
              icon="favorite_border"
              message="아직 관심 등록한 크리에이터가 없어요. 마음에 드는 크리에이터를 찾아보세요."
              action={<button type="button" onClick={() => changeCreatorFilter('전체')} className="mt-2 min-h-10 rounded-xl bg-primary px-4 font-label-sm text-label-sm font-semibold text-on-primary active:scale-95">전체 크리에이터 보기</button>}
            />
            : <EmptyBlock icon="person_search" message="조건에 맞는 크리에이터가 없어요." />
        )}
        {!directory.loading && !directory.error && filteredCreators.length > 0 && (
          <div ref={creatorCarouselRef} className="flex overflow-x-auto md:grid md:grid-cols-2 xl:grid-cols-3 md:overflow-visible gap-space-md px-margin no-scrollbar snap-x snap-mandatory pt-1 pb-3">
            {shownCreators.map((creator) => renderCreatorCard(creator))}
            {filteredCreators.length > shownCreators.length && (
              <button
                type="button"
                onClick={() => setCreatorLimit((limit) => limit + CREATOR_PAGE_SIZE)}
                className="min-w-[120px] snap-center rounded-2xl bg-surface-container-low text-primary font-label-md text-label-md flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
              >
                <MaterialIcon name="add_circle" className="text-[28px]" />
                <span>더 보기</span>
                <span className="font-label-xs text-label-xs text-outline">
                  {formatNumber(filteredCreators.length - shownCreators.length)}명 남음
                </span>
              </button>
            )}
          </div>
        )}
      </section>

      {trending.length > 0 && (
        <section className="mt-space-lg px-margin flex flex-col">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-1.5">
              <MaterialIcon name="trending_up" className="text-tertiary text-[20px]" />
              <h2 className="font-title-lg text-title-lg text-on-surface">진행 중 이벤트가 많은 크리에이터</h2>
            </div>
            <span className="font-label-xs text-label-xs text-outline">진행 중 이벤트 기준</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {trending.map((creator, index) => {
              const followed = isFollowing(creator.creatorId)
              return (
                <div
                  key={creator.creatorId}
                  data-balance-creator-id={creator.creatorId}
                  className="w-full p-3 rounded-2xl bg-surface-container-lowest shadow-card flex items-center justify-between gap-3"
                >
                  <Link to={spacePath(creator.handle)} className="flex items-center gap-3 min-w-0">
                    <span className="font-metric-display text-metric-display text-primary w-4 text-center">
                      {index + 1}
                    </span>
                    <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                      <ProfilePhoto src={creator.avatar} className="h-full w-full" loading="lazy" decoding="async" />
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="font-title-md text-title-md text-on-surface truncate">{creator.name}</span>
                        <MaterialIcon name="verified" filled className="text-[15px] text-primary" />
                      </div>
                      <div className="flex items-center gap-1 text-secondary font-semibold">
                        <MaterialIcon name="arrow_drop_up" className="text-[14px]" />
                        <span className="font-label-xs text-label-xs">
                          진행 중 {creator.openEventCount}개 · 전체 {creator.events.length}개
                        </span>
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleToggleFollow(creator)}
                    disabled={!followsReady || pendingFollowIds.has(creator.creatorId) || ownSpacePending || ownCreatorId === creator.creatorId}
                    className={`flex-shrink-0 px-3 h-8 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-all active:scale-95 disabled:opacity-60 ${
                      followed ? 'bg-primary text-on-primary' : 'bg-berry-tint text-primary'
                    }`}
                  >
                    <MaterialIcon name={followed ? 'done' : 'add'} className="text-[16px]" />
                    <span>{followed ? '완료' : '관심'}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      </>)}

      {tab === 'event' && (
      <section className="mt-space-sm flex flex-col">
        <div className="px-margin flex items-center justify-between mb-space-sm">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="confirmation_number" filled className="text-primary text-[20px]" />
            <h2 className="font-title-lg text-title-lg text-on-surface">이벤트 둘러보기</h2>
          </div>
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            {formatNumber(eventList.data?.totalElements ?? 0)}개
          </span>
        </div>
        <div className="flex overflow-x-auto gap-2 px-margin no-scrollbar py-1 mb-space-sm">
          {EVENT_FILTERS.map((filter) => (
            <button
              key={filter.id || 'all'}
              type="button"
              onClick={() => setEventFilter(filter.id)}
              className={`px-4 py-1.5 rounded-full font-label-sm text-label-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
                eventFilter === filter.id
                  ? 'bg-inverse-surface text-inverse-on-surface shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {eventList.loading && <LoadingBlock label="이벤트를 불러오는 중..." />}
        {!eventList.loading && eventList.error && (
          <ErrorBlock message={eventList.error} onRetry={eventList.reload} />
        )}
        {!eventList.loading && !eventList.error && events.length === 0 && (
          <EmptyBlock icon="event_busy" message="이 조건에 해당하는 이벤트가 없어요." />
        )}
        {!eventList.loading && !eventList.error && events.length > 0 && (
          <div className="px-margin grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
            {events.map((event) => (
              <EventCard
                key={event.eventId}
                event={event}
                variant="list"
                showCreatorTag
              />
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  )
}
