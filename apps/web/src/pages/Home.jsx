import { useMemo } from 'react'
import InstallBanner from '../components/pwa/InstallBanner.jsx'
import WinnerBanner from '../components/home/WinnerBanner.jsx'
import StudioLink from '../components/home/StudioLink.jsx'
import NewsFeed from '../components/home/NewsFeed.jsx'
import NewsRow from '../components/home/NewsRow.jsx'
import EntrySection from '../components/home/EntrySection.jsx'
import MissionSection from '../components/home/MissionSection.jsx'
import { LoadingBlock, ErrorBlock, InlineRetry } from '../components/ui/States.jsx'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { getInProgressEvents } from '../api/events.js'
import { useCreatorBalances } from '../hooks/useCreatorBalances.js'
import { useAppliedEvents } from '../hooks/useAppliedEvents.js'
import { useCreatorNews } from '../hooks/useCreatorNews.js'
import { selectEntryEvents } from '../utils/homeEvents.js'

// 한 화면에 소식·응모·미션이 함께 보이도록 응모는 티켓 3장까지만 보여준다.
const ENTRY_LIMIT = 3

/**
 * 홈. 당첨 → 소식 → 응모 → 미션 순으로 팬이 지금 할 수 있는 "내 것"만 보여준다. 남의 이벤트·크리에이터를 훑어보는 건 탐색 화면이 맡는다.
 * 이벤트·크리에이터·잔액은 BE 응답 그대로이고, 여기서는 목록을 고르고 정렬하기만 한다.
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

  return (
    <div className="flex flex-col w-full pb-6">
      <InstallBanner />
      <WinnerBanner memberId={user?.memberId} />

      {directory.loading && <LoadingBlock label="소식과 이벤트를 불러오는 중..." />}
      {!directory.loading && directory.error && <ErrorBlock message={directory.error} onRetry={directory.reload} />}
      {ready && <NewsRow creators={myCreators} latestByCreator={latestByCreator} />}
      {ready && <NewsFeed creators={myCreators} posts={posts} />}
      {ready && newsFailed && (
        <div className="mt-3 px-margin">
          <InlineRetry message="일부 소식을 불러오지 못했어요." onRetry={retryNews} />
        </div>
      )}
      {isCreator && <StudioLink />}
      {ready && openEvents.loading && <LoadingBlock label="진행 중인 이벤트를 불러오는 중..." />}
      {ready && !openEvents.loading && openEvents.error && (
        <ErrorBlock message={openEvents.error} onRetry={openEvents.reload} />
      )}
      {ready && !openEvents.loading && !openEvents.error && (
        <EntrySection
          events={entryEvents}
          balanceByCreator={balanceByCreator}
          appliedIds={appliedIds}
          knownIds={knownIds}
          appliedCheckFailed={appliedFailedIds.size > 0}
          onRetryApplied={retryApplied}
        />
      )}

      <MissionSection memberId={user?.memberId} />
    </div>
  )
}
