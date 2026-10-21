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
import { getFollowTagRecommendations } from '../api/creators.js'
import { getInterests, getMyInterests } from '../api/interests.js'
import { describeError } from '../api/client.js'
import { recommendationReason } from '../utils/recommendationReason.js'

const RECOMMEND_PAGE_SIZE = 10
const SIMILAR_SIZE = 5

/**
 * 맞춤 추천 화면.
 *
 * 탐색 첫 화면에서 자동으로 받던 추천을 사용자가 들어왔을 때만 받도록 분리했다.
 * 조회와 회원별 결과 격리는 useMyCreatorRecommendations가 맡고, 응답의 기여 분야를 기존 온보딩 규칙으로 표시한다.
 * 인기순 대체 응답은 추천 제목과 빈 결과 안내를 구분한다.
 */
export default function ExploreRecommend() {
  const showToast = useToast()
  const { user, followedCreators, toggleFollow, isFollowing, followsReady, pendingFollowIds } = useUser()
  const { ownCreatorId, ownSpacePending } = useOwnCreatorId()
  const { items: recommended, creatorsById, requestId, personalized, rankingStatus, loading, error, reload, reloadRecommendations } = useMyCreatorRecommendations(user?.memberId ?? null)
  const { impressionRef, trackClick } = useRecommendationEvents(requestId)
  const [limit, setLimit] = useState(RECOMMEND_PAGE_SIZE)
  const shown = recommended.slice(0, limit)
  // 카탈로그는 편집기와 추천 이유에서 함께 쓰며, 조회 실패 뒤에도 추천 목록은 표시한다.
  const interests = useAsync(getInterests, [], { fallbackMessage: '관심 분야를 불러오지 못했어요.' })
  const selectedInterests = useAsync(() => getMyInterests().then((result) => ({ owner: user?.memberId, result })), [user?.memberId], {
    enabled: user?.memberId != null,
    fallbackMessage: '관심 분야를 불러오지 못했어요.',
  })
  const interestNames = useMemo(
    () => new Map((interests.data?.items ?? []).map((item) => [item.interestCode, item.name])),
    [interests.data],
  )
  const mine = selectedInterests.data?.owner === user?.memberId ? selectedInterests.data.result : null
  const recommendationsLoading = loading || interests.loading || selectedInterests.loading

  // 제목은 최근 도킹한 크리에이터를 대표로 쓰고, 후보는 전체 팔로우의 확인 태그로 조회한다.
  const similarBaseId = followsReady ? (followedCreators[0] ?? null) : null
  const similar = useAsync(
    () => getFollowTagRecommendations({ size: SIMILAR_SIZE }).then((result) => ({ owner: user?.memberId, seeds: followedCreators.join(','), result })),
    [user?.memberId, similarBaseId, followedCreators.join(',')],
    { enabled: similarBaseId !== null },
  )
  const similarCreators = useMemo(
    () => similar.data?.owner === user?.memberId && similar.data?.seeds === followedCreators.join(',') && !similar.loading && !similar.error
      ? (similar.data.result.items ?? []).map((candidate) => ({ ...creatorsById.get(candidate.creatorId), ...Object.fromEntries(Object.entries(candidate).filter(([, value]) => value !== undefined)) })) : [],
    [similar.data, similar.loading, similar.error, creatorsById, user?.memberId, followedCreators],
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
          <SectionHeader icon="auto_awesome" title={personalized === false ? '지금 인기 있는 크리에이터' : '나를 위한 추천'} action="도킹 관리" actionTo="/onboarding/creators" />
        </div>
        <InterestEditor
          catalog={interests.data}
          catalogError={interests.error}
          onRetryCatalog={interests.reload}
          mine={mine}
          mineError={selectedInterests.error}
          mineLoading={selectedInterests.loading || (user?.memberId != null && !mine && !selectedInterests.error)}
          onReloadMine={selectedInterests.reload}
          onSaved={() => { setLimit(RECOMMEND_PAGE_SIZE); reloadRecommendations() }}
        />
        {recommendationsLoading && <LoadingBlock label="추천 크리에이터를 찾는 중..." />}
        {!recommendationsLoading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!recommendationsLoading && !error && shown.length === 0 && (
          <EmptyBlock icon="auto_awesome" message={rankingStatus === 'PENDING' ? '추천 순위를 갱신하고 있어요. 잠시 후 다시 확인해 주세요.' : personalized === false ? '지금 보여드릴 크리에이터가 없어요.' : '아직 보여드릴 추천이 없어요. 관심 분야를 골라 보세요.'} />
        )}
        {!recommendationsLoading && !error && shown.length > 0 && (
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
          <SectionHeader icon="group" title={followedCreators.length > 1 ? `${similarBase.name} 외 ${followedCreators.length - 1}명과 비슷한 크리에이터` : `${similarBase.name}와 비슷한 크리에이터`} />
          <div className="flex flex-col gap-2.5">{similarCreators.map((creator) => renderRow(creator))}</div>
        </section>
      )}
    </div>
  )
}
