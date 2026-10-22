import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import ProfilePhoto from '../components/ui/ProfilePhoto.jsx'
import EventCard from '../components/creator/EventCard.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock, SectionHeader } from '../components/ui/States.jsx'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { spacePath } from '../api/creatorSpace.js'
import { filterExploreCreators } from '../utils/exploreCreatorSection.js'

// '전체'에서는 크리에이터와 이벤트를 각각 이만큼만 먼저 보여주고 '더 보기'로 같은 수씩 늘린다.
const ALL_PAGE_SIZE = 7

const SCOPES = [
  { id: 'all', label: '전체' },
  { id: 'creator', label: '크리에이터' },
  { id: 'event', label: '이벤트' },
]

/**
 * 탐색 검색 결과 화면.
 *
 * 검색어는 URL(?q=)에 두어 새로고침·뒤로 가기에서도 유지한다.
 * 검색 대상(전체·크리에이터·이벤트)은 ?type= 으로 고른다. 공개 API에 검색어 파라미터가 없어 이미 받은 크리에이터·이벤트 목록을 화면에서 거른다.
 * 이벤트는 제목이나 크리에이터 이름에 검색어가 들어 있으면 걸린다.
 */
export default function ExploreSearch() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const keyword = params.get('q')?.trim() ?? ''
  const scope = SCOPES.some((item) => item.id === params.get('type')) ? params.get('type') : 'all'
  const [query, setQuery] = useState(keyword)
  // 더 보기로 늘린 개수. 검색어나 대상이 바뀌면 처음 개수로 돌아가도록 키를 함께 보관한다(효과로 되돌리지 않는다).
  const limitKey = `${keyword}|${scope}`
  const [expanded, setExpanded] = useState({ key: '', creators: ALL_PAGE_SIZE, events: ALL_PAGE_SIZE })
  const limits = expanded.key === limitKey ? expanded : { creators: ALL_PAGE_SIZE, events: ALL_PAGE_SIZE }
  // 더 볼 게 남았으면 한 번에 ALL_PAGE_SIZE개씩 늘리고, 끝까지 펼친 뒤에는 처음 개수로 접는다.
  const showMore = (section, total) =>
    setExpanded({ ...limits, key: limitKey, [section]: limits[section] < total ? limits[section] + ALL_PAGE_SIZE : ALL_PAGE_SIZE })
  const { followedCreators } = useUser()
  const directory = useAsync(() => loadCreatorDirectory(), [], {
    fallbackMessage: '크리에이터를 불러오지 못했습니다.',
  })
  const results = useMemo(
    () => (keyword ? filterExploreCreators(directory.data?.creators ?? [], followedCreators, '전체', keyword) : []),
    [directory.data, followedCreators, keyword],
  )

  const eventResults = useMemo(() => {
    const word = keyword.toLowerCase()
    if (!word) return []
    const names = new Map((directory.data?.creators ?? []).map((creator) => [creator.creatorId, creator.name]))
    return (directory.data?.events ?? []).filter((event) =>
      `${event.title} ${names.get(event.creatorId) ?? ''}`.toLowerCase().includes(word),
    )
  }, [directory.data, keyword])
  const counts = { all: results.length + eventResults.length, creator: results.length, event: eventResults.length }
  const showCreators = scope !== 'event'
  const showEvents = scope !== 'creator'
  // 전체에서만 개수를 나눠 보여준다. 크리에이터·이벤트만 볼 때는 전부 보여준다.
  const paged = scope === 'all'
  const shownCreators = paged ? results.slice(0, limits.creators) : results
  const shownEvents = paged ? eventResults.slice(0, limits.events) : eventResults
  const nothing = (!showCreators || results.length === 0) && (!showEvents || eventResults.length === 0)

  function submit(event) {
    event.preventDefault()
    const next = query.trim()
    if (next) navigate(`/explore/search?q=${encodeURIComponent(next)}&type=${scope}`, { replace: true })
  }

  function changeScope(next) {
    setParams({ q: keyword, type: next }, { replace: true })
  }

  return (
    <div className="page-enter flex flex-col w-full pb-8">
      <form onSubmit={submit} className="relative px-margin pt-space-md pb-space-sm">
        <div className="absolute inset-y-0 left-0 pl-[calc(theme(spacing.margin)+0.875rem)] flex items-center pointer-events-none text-outline">
          <MaterialIcon name="search" className="text-[20px]" />
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:bg-surface-container transition-colors shadow-sm"
          placeholder="크리에이터를 검색해 보세요"
          type="search"
        />
        {query && (
          <button
            type="button"
            aria-label="지우기"
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-[calc(theme(spacing.margin)+0.875rem)] flex items-center text-outline hover:text-on-surface transition-colors"
          >
            <MaterialIcon name="cancel" className="text-[18px]" />
          </button>
        )}
      </form>

      <div role="tablist" aria-label="검색 대상" className="flex gap-2 px-margin pb-space-sm">
        {SCOPES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={scope === item.id}
            onClick={() => changeScope(item.id)}
            className={`px-4 py-1.5 rounded-full font-label-sm text-label-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
              scope === item.id ? 'bg-inverse-surface text-inverse-on-surface shadow-sm' : 'bg-surface-container-low text-on-surface-variant'
            }`}
          >
            {item.label}{!directory.loading && keyword ? ` ${counts[item.id]}` : ''}
          </button>
        ))}
      </div>

      <div className="px-margin flex flex-col gap-space-xl">
        {directory.loading && <LoadingBlock label="크리에이터를 불러오는 중..." />}
        {!directory.loading && directory.error && <ErrorBlock message={directory.error} onRetry={directory.reload} />}
        {!directory.loading && !directory.error && nothing && (
          <EmptyBlock icon="search_off" message={`'${keyword}'에 맞는 결과가 없어요.`} />
        )}
        {showCreators && shownCreators.length > 0 && (
          <section className="flex flex-col">
            {scope === 'all' && <SectionHeader icon="groups" title="크리에이터" count={results.length} />}
            <div className="flex flex-col gap-space-md">
              {shownCreators.map((creator) => (
                <Link key={creator.creatorId} to={spacePath(creator.handle)} className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                    <ProfilePhoto src={creator.avatar} className="h-full w-full" loading="lazy" decoding="async" />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <span className="font-label-md text-label-md font-semibold text-on-surface truncate">{creator.name}</span>
                    <span className="font-body-sm text-body-sm text-outline line-clamp-1">{creator.bio}</span>
                  </div>
                </Link>
              ))}
              {paged && results.length > ALL_PAGE_SIZE && (
                <button
                  type="button"
                  onClick={() => showMore('creators', results.length)}
                  className="h-11 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md active:scale-95 transition-all"
                >
                  {results.length > shownCreators.length ? `크리에이터 더 보기 (${results.length - shownCreators.length}명 남음)` : '크리에이터 접기'}
                </button>
              )}
            </div>
          </section>
        )}
        {showEvents && eventResults.length > 0 && (
          // 전체에서 크리에이터 영역 뒤에 올 때는 옅은 구분선과 넉넉한 여백으로 두 영역을 확실히 가른다.
          <section className={`flex flex-col gap-space-sm ${paged && shownCreators.length > 0 ? 'border-t border-outline-variant/30 pt-space-xl' : ''}`}>
            {scope === 'all' && <SectionHeader icon="confirmation_number" title="이벤트" count={eventResults.length} />}
            {shownEvents.map((event) => <EventCard key={event.eventId} event={event} variant={paged ? 'compact' : 'list'} showCreatorTag />)}
            {paged && eventResults.length > ALL_PAGE_SIZE && (
              <button
                type="button"
                onClick={() => showMore('events', eventResults.length)}
                className="h-11 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md active:scale-95 transition-all"
              >
                {eventResults.length > shownEvents.length ? `이벤트 더 보기 (${eventResults.length - shownEvents.length}개 남음)` : '이벤트 접기'}
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
