import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreatorFilterChips, CreatorSortMenu } from '../components/creator/CreatorListControls.jsx'
import CreatorRow from '../components/creator/CreatorRow.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { useOwnCreatorId } from '../hooks/useOwnCreatorId.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { describeError } from '../api/client.js'
import { formatNumber } from '../utils/format.js'
import { CREATOR_FILTERS, CREATOR_SORTS, creatorFilterCounts, filterExploreCreators, sortExploreCreators } from '../utils/exploreCreatorSection.js'

// 크리에이터가 수천 명일 수 있어 처음엔 일부만 그리고 '더 보기'로 늘리며, 끝까지 펼치면 같은 자리의 '접기'로 되돌린다.
const PAGE_SIZE = 30

/**
 * 전체 크리에이터 화면.
 *
 * 탐색 크리에이터 목록 끝의 '전체' 버튼에서 들어온다. 필터·정렬은 주소(?filter=&sort=)에 둬서 탐색에서 고른 값을 이어받고
 * 뒤로 돌아와도 유지된다. 분야(태그)별 분류는 두지 않는다.
 */
export default function ExploreCreators() {
  const showToast = useToast()
  const [params, setParams] = useSearchParams()
  const { followedCreators, toggleFollow, isFollowing, followsReady, pendingFollowIds } = useUser()
  const { ownCreatorId, ownSpacePending } = useOwnCreatorId()
  const filter = CREATOR_FILTERS.includes(params.get('filter')) ? params.get('filter') : '전체'
  const sort = CREATOR_SORTS.some((option) => option.id === params.get('sort')) ? params.get('sort') : 'name-asc'
  const [limit, setLimit] = useState(PAGE_SIZE)

  const directory = useAsync(() => loadCreatorDirectory(), [], {
    fallbackMessage: '크리에이터를 불러오지 못했습니다.',
  })
  const creators = useMemo(
    () => sortExploreCreators(filterExploreCreators(directory.data?.creators ?? [], followedCreators, filter, ''), sort),
    [directory.data, followedCreators, filter, sort],
  )
  const shown = creators.slice(0, limit)

  function change(next) {
    setLimit(PAGE_SIZE)
    setParams({ filter, sort, ...next }, { replace: true })
  }

  async function handleToggleFollow(creator) {
    try {
      const result = await toggleFollow(creator.creatorId)
      if (result) showToast(result.following ? `${creator.name} 도킹 완료! 💖` : '도킹이 해제되었습니다.')
    } catch (error) {
      showToast(describeError(error, '도킹 상태를 변경하지 못했어요.'), { icon: 'error' })
    }
  }

  return (
    <div className="page-enter flex flex-col w-full pb-8">
      <div className="px-margin pt-space-md mb-space-sm flex items-center justify-between gap-3">
        <h2 className="font-title-md text-title-md font-bold text-on-surface">
          전체 크리에이터{!directory.loading && !directory.error && ` ${formatNumber(creators.length)}`}
        </h2>
        <CreatorSortMenu value={sort} onChange={(next) => change({ sort: next })} />
      </div>
      <CreatorFilterChips value={filter} onChange={(next) => change({ filter: next })} counts={directory.data ? creatorFilterCounts(directory.data.creators, followedCreators) : undefined} />

      <div className="px-margin flex flex-col">
        {directory.loading && <LoadingBlock label="크리에이터를 불러오는 중..." />}
        {!directory.loading && directory.error && <ErrorBlock message={directory.error} onRetry={directory.reload} />}
        {!directory.loading && !directory.error && creators.length === 0 && (
          <EmptyBlock
            icon="person_search"
            message={filter === '도킹' ? '아직 도킹한 크리에이터가 없어요.' : filter === '진행 중' ? '지금 진행 중인 이벤트가 있는 크리에이터가 없어요.' : '크리에이터가 없어요.'}
          />
        )}
        {shown.map((creator) => (
          <CreatorRow
            key={creator.creatorId}
            creator={creator}
            variant="flat"
            highlight={creator.openEventCount > 0}
            meta={creator.openEventCount > 0 && (
              <span className="self-start px-2 py-0.5 rounded border border-primary text-primary font-label-xs text-label-xs">진행 중 {creator.openEventCount}</span>
            )}
            followed={isFollowing(creator.creatorId)}
            disabled={!followsReady || pendingFollowIds.has(creator.creatorId) || ownSpacePending || ownCreatorId === creator.creatorId}
            onToggle={handleToggleFollow}
          />
        ))}
        {creators.length > PAGE_SIZE && (
          <button
            type="button"
            onClick={() => setLimit((current) => (creators.length > current ? current + PAGE_SIZE : PAGE_SIZE))}
            className="h-11 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md active:scale-95 transition-all"
          >
            {creators.length > shown.length ? `더 보기 (${formatNumber(creators.length - shown.length)}명 남음)` : '접기'}
          </button>
        )}
      </div>
    </div>
  )
}
