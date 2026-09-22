import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import EventCard from '../components/creator/EventCard.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock, SectionHeader } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { getEvents } from '../api/events.js'
import { CREATOR_CATEGORIES } from '../data/creatorProfiles.js'
import { formatNumber } from '../utils/format.js'

const EVENT_FILTERS = [
  { id: '', label: '전체' },
  { id: 'IN_PROGRESS', label: '진행 중' },
  { id: 'UPCOMING', label: '오픈 예정' },
  { id: 'CLOSED', label: '종료' },
]

/**
 * 탐색 화면.
 *
 * 크리에이터 검색/카테고리 필터는 이벤트 목록에서 도출한 실제 크리에이터를 대상으로 하고,
 * 이벤트 목록은 GET /api/events 의 status(표시 상태) 필터를 그대로 사용한다.
 */
export default function Explore() {
  const showToast = useToast()
  const { userId, followedCreators, toggleFollow, isFollowing } = useUser()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('전체')
  const [eventFilter, setEventFilter] = useState('IN_PROGRESS')

  const directory = useAsync(() => loadCreatorDirectory(userId), [userId], {
    fallbackMessage: '크리에이터를 불러오지 못했습니다.',
  })
  const eventList = useAsync(
    () => getEvents({ status: eventFilter || undefined, size: 30 }),
    [eventFilter],
    { fallbackMessage: '이벤트를 불러오지 못했습니다.' },
  )

  const creators = useMemo(() => directory.data?.creators ?? [], [directory.data])

  const balanceByCreator = useMemo(() => {
    const map = new Map()
    creators.forEach((creator) => map.set(creator.creatorId, creator.balance))
    return map
  }, [creators])

  const filteredCreators = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return creators.filter((creator) => {
      const matchesCategory = category === '전체' || creator.category === category
      const matchesQuery =
        !keyword ||
        creator.name.toLowerCase().includes(keyword) ||
        creator.category.toLowerCase().includes(keyword)
      return matchesCategory && matchesQuery
    })
  }, [creators, category, query])

  // "지금 인기 있는" 기준은 공개 API에 있는 값(진행 중 이벤트 수, 전체 이벤트 수)으로 정한다.
  const trending = useMemo(
    () =>
      [...creators]
        .sort((a, b) => b.openEventCount - a.openEventCount || b.events.length - a.events.length)
        .slice(0, 3),
    [creators],
  )

  const events = eventList.data?.items ?? []

  function handleToggleFollow(creator) {
    const wasFollowing = isFollowing(creator.creatorId)
    toggleFollow(creator.creatorId)
    showToast(
      wasFollowing ? '관심 크리에이터에서 해제되었습니다.' : `${creator.name} 관심 크리에이터로 등록되었어요! 💖`,
    )
  }

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="px-margin pt-space-md pb-space-sm flex flex-col gap-space-sm">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
            <MaterialIcon name="search" className="text-[20px]" />
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:bg-surface-container transition-all shadow-sm"
            placeholder="크리에이터를 검색해봐 (아티스트, 유튜버, 스트리머)"
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
        </div>
        <div className="flex items-center gap-space-xs px-2 py-1 bg-surface-container-low rounded-lg">
          <MaterialIcon name="local_fire_department" className="text-primary text-[16px] animate-pulse" />
          <span className="font-label-xs text-label-xs text-on-surface-variant truncate">
            {trending.length > 0
              ? `실시간 관심 급증: ${trending.map((creator) => creator.name).join(' & ')} 이벤트 확인해보기!`
              : '새로운 이벤트가 열리면 여기에서 가장 먼저 알려줄게요!'}
          </span>
        </div>
      </div>

      <section className="mt-space-md flex flex-col">
        <div className="px-margin">
          <SectionHeader icon="auto_awesome" title="추천 크리에이터" action="관심 관리" actionTo="/onboarding/creators" />
        </div>
        {directory.loading && <LoadingBlock label="크리에이터를 불러오는 중..." />}
        {!directory.loading && directory.error && (
          <ErrorBlock message={directory.error} onRetry={directory.reload} />
        )}
        {!directory.loading && !directory.error && filteredCreators.length === 0 && (
          <EmptyBlock icon="person_search" message="조건에 맞는 크리에이터가 없어요." />
        )}
        {!directory.loading && !directory.error && filteredCreators.length > 0 && (
          <div className="flex overflow-x-auto gap-space-md px-margin no-scrollbar snap-x snap-mandatory pt-1 pb-3">
            {filteredCreators.map((creator) => {
              const followed = isFollowing(creator.creatorId)
              return (
                <div
                  key={creator.creatorId}
                  className="min-w-[260px] max-w-[260px] snap-center rounded-2xl bg-surface-container-lowest p-3 shadow-card flex flex-col"
                >
                  <Link to={`/creators/${creator.creatorId}`} className="block">
                    <div className="relative w-full h-36 rounded-xl overflow-hidden mb-3">
                      <img className="w-full h-full object-cover" src={creator.banner} alt={creator.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                      {creator.openEventCount > 0 && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-xs text-label-xs font-semibold flex items-center gap-1">
                          <MaterialIcon name="stars" filled className="text-[12px]" />
                          진행 중 {creator.openEventCount}
                        </span>
                      )}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white">
                        <span className="font-label-xs text-label-xs bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">
                          팔로워 {creator.followers}
                        </span>
                        <span className="font-label-xs text-label-xs bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">
                          🎟 {formatNumber(creator.balance)}장
                        </span>
                      </div>
                    </div>
                    <div className="mb-1.5">
                      <div className="flex items-center gap-1">
                        <h3 className="font-title-md text-title-md text-on-surface truncate">{creator.name}</h3>
                        <MaterialIcon name="verified" filled className="text-[16px] text-primary" />
                      </div>
                      <span className="font-label-xs text-label-xs text-on-surface-variant font-medium">
                        {creator.category}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-outline line-clamp-1 mb-3">{creator.bio}</p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleToggleFollow(creator)}
                    className={`mt-auto w-full h-9 rounded-xl font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                      followed ? 'bg-primary text-on-primary' : 'bg-berry-tint text-primary'
                    }`}
                  >
                    <MaterialIcon name="favorite" filled={followed} className="text-[18px]" />
                    <span>{followed ? '관심 중' : '관심 추가'}</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {trending.length > 0 && (
        <section className="mt-space-lg px-margin flex flex-col">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-1.5">
              <MaterialIcon name="trending_up" className="text-tertiary text-[20px]" />
              <h2 className="font-title-lg text-title-lg text-on-surface">지금 인기 있는 크리에이터</h2>
            </div>
            <span className="font-label-xs text-label-xs text-outline">진행 중 이벤트 기준</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {trending.map((creator, index) => {
              const followed = isFollowing(creator.creatorId)
              return (
                <div
                  key={creator.creatorId}
                  className="w-full p-3 rounded-2xl bg-surface-container-lowest shadow-card flex items-center justify-between gap-3"
                >
                  <Link to={`/creators/${creator.creatorId}`} className="flex items-center gap-3 min-w-0">
                    <span className="font-metric-display text-metric-display text-primary w-4 text-center">
                      {index + 1}
                    </span>
                    <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                      <img className="w-full h-full object-cover" src={creator.avatar} alt={creator.name} />
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
                    className={`flex-shrink-0 px-3 h-8 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-all active:scale-95 ${
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

      <section className="mt-space-lg flex flex-col">
        <div className="px-margin flex items-center justify-between mb-space-sm">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="category" className="text-primary text-[20px]" />
            <h2 className="font-title-lg text-title-lg text-on-surface">카테고리 탐색</h2>
          </div>
          {followedCreators.length > 0 && (
            <span className="font-label-xs text-label-xs text-primary font-semibold">
              관심 {followedCreators.length}명
            </span>
          )}
        </div>
        <div className="flex overflow-x-auto gap-2 px-margin no-scrollbar py-1">
          {CREATOR_CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`px-4 py-2 rounded-full font-label-md text-label-md font-semibold whitespace-nowrap transition-all active:scale-95 ${
                category === item
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-space-lg flex flex-col">
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
          <div className="px-margin grid grid-cols-1 gap-space-md">
            {events.map((event) => (
              <EventCard
                key={event.eventId}
                event={event}
                variant="list"
                showCreatorTag
                ticketsOwned={balanceByCreator.get(event.creatorId)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
