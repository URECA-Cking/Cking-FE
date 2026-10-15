import { useCallback, useMemo, useRef, useState } from 'react'
import InstallBanner from '../components/pwa/InstallBanner.jsx'
import WinnerBanner from '../components/home/WinnerBanner.jsx'
import StudioLink from '../components/home/StudioLink.jsx'
import NewsFeed from '../components/home/NewsFeed.jsx'
import NewsRow from '../components/home/NewsRow.jsx'
import EntrySection from '../components/home/EntrySection.jsx'
import MissionSection from '../components/home/MissionSection.jsx'
import WelcomeQuest from '../components/home/WelcomeQuest.jsx'
import WelcomeCreators from '../components/home/WelcomeCreators.jsx'
import { LoadingBlock, ErrorBlock, InlineRetry } from '../components/ui/States.jsx'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { getInProgressEvents } from '../api/events.js'
import { useCreatorBalances } from '../hooks/useCreatorBalances.js'
import { useAppliedEvents } from '../hooks/useAppliedEvents.js'
import { useCreatorNews } from '../hooks/useCreatorNews.js'
import { useWelcomeQuest } from '../hooks/useWelcomeQuest.js'
import { useWelcomeClaim } from '../hooks/useWelcomeClaim.js'
import { useWelcomeGuideHidden } from '../hooks/useWelcomeGuideHidden.js'
import { selectEntryEvents } from '../utils/homeEvents.js'
import { WELCOME_QUEST_STEPS, isWelcomeQuestActive } from '../utils/welcomeQuest.js'

// 한 화면에 소식·응모·미션이 함께 보이도록 응모는 티켓 3장까지만 보여준다.
const ENTRY_LIMIT = 3

/**
 * 홈. 당첨 → 소식 → 응모 → 미션 순으로 팬이 지금 할 수 있는 "내 것"만 보여준다. 남의 이벤트·크리에이터를 훑어보는 건 탐색 화면이 맡는다.
 * 이벤트·크리에이터·잔액은 BE 응답 그대로이고, 여기서는 목록을 고르고 정렬하기만 한다.
 * 신규 회원(웰컴 퀘스트 대상이고 아직 끝내지 않은 회원)에게는 응모 대신 웰컴 퀘스트 → 출석 → 인기 크리에이터 순으로 보여준다.
 * 신규 여부와 단계 상태는 서버가 판정한 값(eligible, completed)을 그대로 따른다.
 */
export default function Home() {
  const { user, isCreator, followedCreators } = useUser()

  const directory = useAsync(() => loadCreatorDirectory(), [], {
    fallbackMessage: '크리에이터와 이벤트를 불러오지 못했습니다.',
  })
  // 마감 임박순 3건을 정확히 고르려면 진행 중 이벤트 전체가 필요하다. 목록 전체(최신 100건)에서 고르면 100건을 넘을 때 놓친다.
  const openEvents = useAsync(() => getInProgressEvents(), [], {
    fallbackMessage: '진행 중인 이벤트를 불러오지 못했습니다.',
  })
  const { balances } = useCreatorBalances(followedCreators, user?.memberId)
  const { latestByCreator, posts, failed: newsFailed, retry: retryNews } = useCreatorNews(followedCreators, user?.memberId)

  const myCreators = useMemo(
    () => (directory.data?.creators ?? []).filter((creator) => followedCreators.includes(creator.creatorId)),
    [directory.data, followedCreators],
  )

  const balanceByCreator = useMemo(() => {
    const map = new Map()
    balances.forEach((balance, creatorId) => map.set(creatorId, balance.balance))
    return map
  }, [balances])

  const entryEvents = useMemo(
    () => selectEntryEvents(openEvents.data ?? [], followedCreators, ENTRY_LIMIT),
    [openEvents.data, followedCreators],
  )
  const { appliedIds, knownIds, failedIds: appliedFailedIds, retry: retryApplied } = useAppliedEvents(entryEvents.map((event) => event.eventId), user?.memberId)

  const ready = !directory.loading && !directory.error

  const welcome = useWelcomeQuest(user?.memberId)
  const claimWelcome = useWelcomeClaim(welcome.claim)
  const [guideHidden, setGuideHidden] = useWelcomeGuideHidden(user?.memberId)
  const creatorsRef = useRef(null)
  const questActive = isWelcomeQuestActive(welcome.quest)
  // 이번 화면에서 퀘스트가 진행 중인 것을 본 회원. 마지막 단계를 받는 순간 완료 화면이 바로 사라지지 않고,
  // 새로고침하거나 다시 들어올 때까지 완료 안내(웰컴 퀘스트 완료!)를 보여 주기 위해 기억한다.
  // 회원 번호와 함께 기억해, 같은 화면에서 계정이 바뀌어도 이전 회원의 기록이 다른 회원에게 남지 않게 한다.
  const memberId = user?.memberId
  const [seenMemberId, setSeenMemberId] = useState(null)
  if (questActive && memberId != null && seenMemberId !== memberId) setSeenMemberId(memberId)
  const questSeen = memberId != null && seenMemberId === memberId
  const isNewMember = questActive || (questSeen && welcome.quest?.eligible === true)
  // 퀘스트 상태를 처음 받아 오는 동안은 신규 여부를 모른다. 응모 섹션이 떴다가 사라지지 않게 그 사이에는 응모를 그리지 않는다.
  const questPending = user?.memberId != null && welcome.quest === null && welcome.loading

  /** 팔로우 단계를 하러 가는 사용자를 인기 크리에이터 섹션으로 부드럽게 스크롤한다. */
  const goFollow = useCallback(() => {
    creatorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  // 웰컴 보너스는 퀘스트가 끝난 뒤에도 받을 수 있으므로, 신규 대상이면 상태에 맞춰 출석 카드에 넘긴다.
  const bonus = welcome.quest?.eligible ? welcome.quest.bonus : null
  const welcomeBonus = bonus
    ? {
        status: bonus.status,
        claiming: welcome.claimingSteps.includes(WELCOME_QUEST_STEPS.BONUS),
        onClaim: () => claimWelcome(WELCOME_QUEST_STEPS.BONUS),
      }
    : null
  const attendance = <MissionSection memberId={user?.memberId} welcomeBonus={welcomeBonus} />

  return (
    <div className="flex flex-col w-full pb-6">
      <InstallBanner />
      <WinnerBanner memberId={user?.memberId} />

      {isNewMember && (
        <>
          <WelcomeQuest
            memberId={user?.memberId}
            nickname={user?.nickname}
            quest={welcome.quest}
            claimingSteps={welcome.claimingSteps}
            onClaim={claimWelcome}
            hidden={guideHidden}
            onHide={() => setGuideHidden(true)}
            onShow={() => setGuideHidden(false)}
            onGoFollow={goFollow}
          />
          {attendance}
          <WelcomeCreators sectionRef={creatorsRef} onFollowed={welcome.reload} />
        </>
      )}

      {directory.loading && <LoadingBlock label="소식과 이벤트를 불러오는 중..." />}
      {!directory.loading && directory.error && <ErrorBlock message={directory.error} onRetry={directory.reload} />}
      {ready && (!isNewMember || myCreators.length > 0) && <NewsRow creators={myCreators} latestByCreator={latestByCreator} />}
      {ready && <NewsFeed creators={myCreators} posts={posts} />}
      {ready && newsFailed && (
        <div className="mt-3 px-margin">
          <InlineRetry message="일부 소식을 불러오지 못했어요." onRetry={retryNews} />
        </div>
      )}
      {isCreator && <StudioLink />}
      {ready && !isNewMember && !questPending && openEvents.loading && <LoadingBlock label="진행 중인 이벤트를 불러오는 중..." />}
      {ready && !isNewMember && !questPending && !openEvents.loading && openEvents.error && (
        <ErrorBlock message={openEvents.error} onRetry={openEvents.reload} />
      )}
      {ready && !isNewMember && !questPending && !openEvents.loading && !openEvents.error && (
        <EntrySection
          events={entryEvents}
          balanceByCreator={balanceByCreator}
          appliedIds={appliedIds}
          knownIds={knownIds}
          appliedCheckFailed={appliedFailedIds.size > 0}
          onRetryApplied={retryApplied}
        />
      )}

      {!isNewMember && attendance}
    </div>
  )
}
