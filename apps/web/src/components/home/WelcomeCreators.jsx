import { Link } from 'react-router-dom'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import { LoadingBlock, ErrorBlock } from '../ui/States.jsx'
import FilledCheck from './FilledCheck.jsx'
import { describeError } from '../../api/client.js'
import { getMyCreatorRecommendations } from '../../api/creators.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useRecommendationEvents } from '../../hooks/useRecommendationEvents.js'
import { useToast } from '../../context/useToast.js'
import { useUser } from '../../context/useUser.js'

// 홈 한 줄에 가로로 넘겨 보는 추천 수. 추천 API는 1~20명을 허용한다.
const RECOMMEND_SIZE = 10

/**
 * 신규 회원 홈의 "지금 팬들이 가장 많이 모이는 곳". 추천 크리에이터를 가로 카드로 보여주고 여기서 바로 팔로우한다.
 * - 팔로우는 실제 팔로우(useUser의 toggleFollow)이며, 팔로우한 뒤 onFollowed로 퀘스트 상태를 다시 불러와 STEP 2를 받을 수 있게 한다.
 * - 추천 노출·클릭은 탐색 화면과 같은 방식(useRecommendationEvents)으로 모아 서버가 팔로우 전환을 귀속할 수 있게 한다.
 * - BE가 이미 팔로우한 크리에이터를 추천에서 빼므로, 머무는 동안은 다시 불러오지 않고 팔로우한 카드는 "팔로잉"으로 남겨 목록이 흔들리지 않게 한다.
 */
export default function WelcomeCreators({ sectionRef, onFollowed }) {
  const showToast = useToast()
  const { user, toggleFollow, isFollowing, followsReady, pendingFollowIds } = useUser()
  // 회원이 바뀌면 그 회원 기준으로 다시 조회한다. 같은 회원이 머무는 동안에는 팔로우로 목록이 흔들리지 않게 다시 부르지 않는다.
  const recommended = useAsync(() => getMyCreatorRecommendations({ size: RECOMMEND_SIZE }), [user?.memberId], {
    fallbackMessage: '추천 크리에이터를 불러오지 못했어요.',
  })
  const { impressionRef, trackClick } = useRecommendationEvents(recommended.data?.requestId ?? null)
  const creators = recommended.data?.items ?? []

  /** 팔로우 상태를 바꾸고 클릭을 기록한다. 팔로우가 됐으면 퀘스트 상태를 다시 불러온다. */
  async function handleToggle(creator) {
    trackClick(creator.creatorId)
    try {
      const result = await toggleFollow(creator.creatorId)
      if (!result) return
      showToast(result.following ? `${creator.name} 도킹 완료!` : '도킹을 해제했어요.')
      onFollowed()
    } catch (error) {
      showToast(describeError(error, '도킹 상태를 변경하지 못했어요.'), { icon: 'error' })
    }
  }

  return (
    <section ref={sectionRef} className="mt-6">
      <div className="mb-3 px-margin">
        <h3 className="flex items-center gap-1 text-sm font-extrabold text-on-surface">
          <span aria-hidden="true">🔥</span>
          지금 팬들이 가장 많이 모이는 곳
        </h3>
        <p className="font-label-sm text-label-sm text-primary font-normal">도킹하면 STEP 2 응모권을 받을 수 있어요</p>
      </div>

      {recommended.loading && <LoadingBlock label="추천 크리에이터를 찾는 중..." />}
      {!recommended.loading && recommended.error && (
        <div className="px-margin"><ErrorBlock message={recommended.error} onRetry={recommended.reload} /></div>
      )}
      {!recommended.loading && !recommended.error && creators.length === 0 && (
        <Link to="/onboarding/creators" className="mx-margin block rounded-2xl bg-surface-container py-4 text-center font-label-md text-label-md text-primary">
          크리에이터 둘러보기
        </Link>
      )}
      {!recommended.loading && !recommended.error && creators.length > 0 && (
        <div className="flex gap-3 overflow-x-auto overscroll-x-contain px-margin pb-1 no-scrollbar">
          {creators.map((creator) => {
            const followed = isFollowing(creator.creatorId)
            return (
              <div
                key={creator.creatorId}
                ref={impressionRef(creator.creatorId)}
                className="flex w-36 shrink-0 flex-col items-center rounded-2xl bg-surface-container p-3.5 text-center"
              >
                <Link
                  to={`/creators/${creator.creatorId}`}
                  onClick={() => trackClick(creator.creatorId)}
                  className="flex w-full flex-col items-center"
                >
                  <ProfilePhoto src={creator.avatar} className="h-14 w-14 shadow-md" iconClassName="text-[28px]" />
                  <span className="mt-2 w-full truncate font-label-md text-label-md font-bold text-on-surface">{creator.name}</span>
                </Link>
                <button
                  type="button"
                  aria-pressed={followed}
                  disabled={!followsReady || pendingFollowIds.has(creator.creatorId)}
                  onClick={() => handleToggle(creator)}
                  className={`mt-3 flex w-full items-center justify-center gap-1 rounded-xl py-1.5 font-label-sm text-label-sm font-bold transition-colors disabled:opacity-50 ${
                    followed ? 'bg-on-surface text-surface' : 'bg-primary/15 text-primary'
                  }`}
                >
                  {followed ? (
                    <>
                      <FilledCheck size={14} />
                      도킹 중
                    </>
                  ) : (
                    '+ 도킹'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
