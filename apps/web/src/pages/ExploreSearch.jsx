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
          className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:bg-surface-container transition-all shadow-sm"
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

      <div className="px-margin flex flex-col gap-space-lg">
        {directory.loading && <LoadingBlock label="크리에이터를 불러오는 중..." />}
        {!directory.loading && directory.error && <ErrorBlock message={directory.error} onRetry={directory.reload} />}
        {!directory.loading && !directory.error && nothing && (
          <EmptyBlock icon="search_off" message={`'${keyword}'에 맞는 결과가 없어요.`} />
        )}
        {showCreators && scope === 'all' && results.length > 0 && <SectionHeader icon="groups" title="크리에이터" count={results.length} />}
        {showCreators && results.map((creator) => (
          <section key={creator.creatorId} className="flex flex-col gap-space-sm">
            <Link to={spacePath(creator.handle)} className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                <ProfilePhoto src={creator.avatar} className="h-full w-full" loading="lazy" decoding="async" />
              </div>
              <div className="min-w-0 flex flex-col">
                <span className="font-label-md text-label-md font-semibold text-on-surface truncate">{creator.name}</span>
                <span className="font-body-sm text-body-sm text-outline line-clamp-1">{creator.bio}</span>
              </div>
            </Link>
            {/* 크리에이터만 볼 때는 그 크리에이터의 이벤트를 함께 보여 주고, 전체에서는 아래 이벤트 목록과 겹치므로 생략한다. */}
            {scope === 'creator' && (creator.events.length === 0
              ? <p className="font-body-sm text-body-sm text-outline">진행 중이거나 예정된 이벤트가 아직 없어요.</p>
              : creator.events.map((event) => <EventCard key={event.eventId} event={event} variant="list" />))}
          </section>
        ))}
        {showEvents && eventResults.length > 0 && (
          <section className="flex flex-col gap-space-sm">
            {scope === 'all' && <SectionHeader icon="confirmation_number" title="이벤트" count={eventResults.length} />}
            {eventResults.map((event) => <EventCard key={event.eventId} event={event} variant="list" showCreatorTag />)}
          </section>
        )}
      </div>
    </div>
  )
}
