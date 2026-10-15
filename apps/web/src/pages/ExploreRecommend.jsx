import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import ProfilePhoto from '../components/ui/ProfilePhoto.jsx'
import InterestEditor from '../components/creator/InterestEditor.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock, SectionHeader } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { useRecommendationEvents } from '../hooks/useRecommendationEvents.js'
import { getMyCreatorRecommendations, getSimilarCreators, loadCreatorDirectory } from '../api/creators.js'
import { spacePath } from '../api/creatorSpace.js'
import { describeError } from '../api/client.js'

// 추천은 BE 상한(20)까지 한 번에 받고 화면에서 나눠 보여준다. 더 보기마다 다시 받으면 응답 ID(수집 단위)가 바뀐다.
const RECOMMEND_MAX = 20
const RECOMMEND_PAGE_SIZE = 10
const SIMILAR_SIZE = 5

/**
 * 맞춤 추천 화면.
 *
 * 탐색 첫 화면에서 자동으로 받던 추천을 사용자가 들어왔을 때만 받도록 분리했다.
 * 추천 응답은 이름·이미지·소개만 주므로 핸들 등은 전체 크리에이터 목록의 같은 크리에이터로 채운다.
 */
export default function ExploreRecommend() {
  const showToast = useToast()
  const { user, followedCreators, toggleFollow, isFollowing, followsReady, pendingFollowIds } = useUser()
  const directory = useAsync(() => loadCreatorDirectory(), [], {
    fallbackMessage: '크리에이터를 불러오지 못했습니다.',
  })
  const creatorsById = useMemo(
    () => new Map((directory.data?.creators ?? []).map((creator) => [creator.creatorId, creator])),
    [directory.data],
  )

  const recommendation = useAsync(
    () => getMyCreatorRecommendations({ size: RECOMMEND_MAX }),
    [user?.memberId],
    { enabled: Boolean(user), fallbackMessage: '추천 크리에이터를 불러오지 못했어요.' },
  )
  const { impressionRef, trackClick } = useRecommendationEvents(recommendation.data?.requestId ?? null)
  const [limit, setLimit] = useState(RECOMMEND_PAGE_SIZE)
  const recommended = useMemo(
    () => (recommendation.data?.items ?? []).map((item) => creatorsById.get(item.creatorId)).filter(Boolean),
    [recommendation.data, creatorsById],
  )
  const shown = recommended.slice(0, limit)

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
      if (result) showToast(result.following ? `${creator.name} 관심 크리에이터로 등록되었어요! 💖` : '관심 크리에이터에서 해제되었습니다.')
    } catch (error) {
      showToast(describeError(error, '관심 상태를 변경하지 못했어요.'), { icon: 'error' })
    }
  }

  function renderRow(creator, { tracked = false } = {}) {
    const followed = isFollowing(creator.creatorId)
    return (
      <div
        key={creator.creatorId}
        ref={tracked ? impressionRef(creator.creatorId) : undefined}
        className="w-full p-3 rounded-2xl bg-surface-container-lowest shadow-card flex items-center justify-between gap-3"
      >
        <Link
          to={spacePath(creator.handle)}
          onClick={tracked ? () => trackClick(creator.creatorId) : undefined}
          className="flex items-center gap-3 min-w-0"
        >
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
            <ProfilePhoto src={creator.avatar} className="h-full w-full" loading="lazy" decoding="async" />
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="font-title-md text-title-md text-on-surface truncate">{creator.name}</span>
            <span className="font-label-xs text-label-xs text-outline line-clamp-1">{creator.bio}</span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => handleToggleFollow(creator)}
          disabled={!followsReady || pendingFollowIds.has(creator.creatorId)}
          className={`flex-shrink-0 px-3 h-8 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-all active:scale-95 disabled:opacity-60 ${
            followed ? 'bg-primary text-on-primary' : 'bg-berry-tint text-primary'
          }`}
        >
          <MaterialIcon name={followed ? 'done' : 'add'} className="text-[16px]" />
          <span>{followed ? '완료' : '관심'}</span>
        </button>
      </div>
    )
  }

  const loading = recommendation.loading || directory.loading

  return (
    <div className="page-enter flex flex-col w-full pb-8">
      <section className="mt-space-md flex flex-col">
        <div className="px-margin">
          <SectionHeader icon="auto_awesome" title="나를 위한 추천" action="관심 관리" actionTo="/onboarding/creators" />
        </div>
        <InterestEditor onSaved={() => { setLimit(RECOMMEND_PAGE_SIZE); recommendation.reload() }} />
        {loading && <LoadingBlock label="추천 크리에이터를 찾는 중..." />}
        {!loading && recommendation.error && <ErrorBlock message={recommendation.error} onRetry={recommendation.reload} />}
        {!loading && !recommendation.error && shown.length === 0 && (
          <EmptyBlock icon="auto_awesome" message="아직 보여드릴 추천이 없어요. 관심 분야를 골라 보세요." />
        )}
        {!loading && !recommendation.error && shown.length > 0 && (
          <div className="px-margin flex flex-col gap-2.5">
            {shown.map((creator) => renderRow(creator, { tracked: true }))}
            {recommended.length > shown.length && (
              <button
                type="button"
                onClick={() => setLimit((current) => current + RECOMMEND_PAGE_SIZE)}
                className="h-11 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md active:scale-95 transition-all"
              >
                더 보기
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
