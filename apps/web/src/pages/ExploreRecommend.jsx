import { useMemo, useState } from 'react'
import CreatorRow from '../components/creator/CreatorRow.jsx'
import InterestEditor from '../components/creator/InterestEditor.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock, SectionHeader } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { useMyCreatorRecommendations } from '../hooks/useMyCreatorRecommendations.js'
import { useOwnCreatorId } from '../hooks/useOwnCreatorId.js'
import { useRecommendationEvents } from '../hooks/useRecommendationEvents.js'
import { getSimilarCreators } from '../api/creators.js'
import { getInterests } from '../api/interests.js'
import { describeError } from '../api/client.js'
import { recommendationReason } from '../utils/recommendationReason.js'

const RECOMMEND_PAGE_SIZE = 10
const SIMILAR_SIZE = 5

/**
 * 맞춤 추천 화면.
 *
 * 탐색 첫 화면에서 자동으로 받던 추천을 사용자가 들어왔을 때만 받도록 분리했다.
 * 조회와 회원별 결과 격리는 useMyCreatorRecommendations가 맡고, 응답의 기여 분야를 기존 온보딩 규칙으로 표시한다.
 */
export default function ExploreRecommend() {
  const showToast = useToast()
  const { user, followedCreators, toggleFollow, isFollowing, followsReady, pendingFollowIds } = useUser()
  const { ownCreatorId, ownSpacePending } = useOwnCreatorId()
  const { items: recommended, creatorsById, requestId, loading, error, reload, reloadRecommendations } = useMyCreatorRecommendations(user?.memberId ?? null)
  const { impressionRef, trackClick } = useRecommendationEvents(requestId)
  const [limit, setLimit] = useState(RECOMMEND_PAGE_SIZE)
  const shown = recommended.slice(0, limit)
  // 분야명 조회가 실패해도 추천 목록은 그대로 보여 준다.
  const interests = useAsync(() => getInterests().catch(() => null), [])
  const interestNames = useMemo(
    () => new Map((interests.data?.items ?? []).map((item) => [item.interestCode, item.name])),
    [interests.data],
  )

  // 유사 크리에이터는 기준이 필요해서 가장 최근에 관심 등록한 크리에이터를 기준으로 삼는다(followedCreators는 최근 팔로우 순). 관심이 없으면 숨긴다.
  const similarBaseId = followsReady ? (followedCreators[0] ?? null) : null
  const similar = useAsync(
    () => getSimilarCreators(similarBaseId, { size: SIMILAR_SIZE }),
    [similarBaseId],
    { enabled: similarBaseId !== null },
  )
  const similarCreators = useMemo(
    () => (similar.data ?? []).map((candidate) => creatorsById.get(candidate.similarCreatorId)).filter(Boolean),
    [similar.data, creatorsById],
  )
  const similarBase = creatorsById.get(similarBaseId)

  async function handleToggleFollow(creator) {
    try {
      const result = await toggleFollow(creator.creatorId)
      if (result) showToast(result.following ? `${creator.name} 도킹 완료! 💖` : '도킹이 해제되었습니다.')
    } catch (error) {
      showToast(describeError(error, '도킹 상태를 변경하지 못했어요.'), { icon: 'error' })
    }
  }

  /** 추천 카드에서만 노출·클릭과 추천 이유를 연결하고 유사 크리에이터 카드는 그대로 그린다. */
  function renderRow(creator, { tracked = false } = {}) {
    return (
      <CreatorRow
        key={creator.creatorId}
        creator={creator}
        followed={isFollowing(creator.creatorId)}
        disabled={!followsReady || pendingFollowIds.has(creator.creatorId) || ownSpacePending || ownCreatorId === creator.creatorId}
        onToggle={handleToggleFollow}
        rowRef={tracked ? impressionRef(creator.creatorId) : undefined}
        onOpen={tracked ? () => trackClick(creator.creatorId) : undefined}
        reason={tracked ? recommendationReason(creator, interestNames) : undefined}
      />
    )
  }

  return (
    <div className="page-enter flex flex-col w-full pb-8">
      <section className="mt-space-md flex flex-col">
        <div className="px-margin">
          <SectionHeader icon="auto_awesome" title="나를 위한 추천" action="도킹 관리" actionTo="/onboarding/creators" />
        </div>
        <InterestEditor onSaved={() => { setLimit(RECOMMEND_PAGE_SIZE); reloadRecommendations() }} />
        {loading && <LoadingBlock label="추천 크리에이터를 찾는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && shown.length === 0 && (
          <EmptyBlock icon="auto_awesome" message="아직 보여드릴 추천이 없어요. 관심 분야를 골라 보세요." />
        )}
        {!loading && !error && shown.length > 0 && (
          <div className="px-margin flex flex-col gap-2.5">
            {shown.map((creator) => renderRow(creator, { tracked: true }))}
            {recommended.length > RECOMMEND_PAGE_SIZE && (
              <button
                type="button"
                onClick={() => setLimit((current) => (recommended.length > current ? current + RECOMMEND_PAGE_SIZE : RECOMMEND_PAGE_SIZE))}
                className="h-11 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md active:scale-95 transition-all"
              >
                {recommended.length > shown.length ? '더 보기' : '접기'}
              </button>
            )}
          </div>
        )}
      </section>

      {similarBase && similarCreators.length > 0 && (
        <section className="mt-space-lg px-margin flex flex-col">
          <SectionHeader icon="group" title={`${similarBase.name}와 비슷한 크리에이터`} />
          <div className="flex flex-col gap-2.5">{similarCreators.map((creator) => renderRow(creator))}</div>
        </section>
      )}
    </div>
  )
}
