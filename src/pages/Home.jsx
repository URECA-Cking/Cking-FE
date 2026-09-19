import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import CreatorAvatarItem from '../components/creator/CreatorAvatarItem.jsx'
import EventCard from '../components/creator/EventCard.jsx'
import FeedPostCard from '../components/feed/FeedPostCard.jsx'
import InstallBanner from '../components/pwa/InstallBanner.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock, SectionHeader } from '../components/ui/States.jsx'
import { useUser } from '../context/UserContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorDirectory } from '../api/creators.js'
import { getMyNotifications } from '../api/notifications.js'
import { getFeedPosts } from '../data/posts.js'
import { formatNumber } from '../utils/format.js'

/**
 * 홈 피드.
 *
 * 내 크리에이터/응모권 잔액/진행 중 이벤트/읽지 않은 알림을 모두 실제 API에서 가져온다.
 * (게시물 피드만 백엔드에 대응 API가 없어 화면 구성용 샘플을 쓴다.)
 */
export default function Home() {
  const { user, userId, isCreator, isAdmin, followedCreators } = useUser()

  const directory = useAsync(() => loadCreatorDirectory(userId), [userId], {
    fallbackMessage: '크리에이터와 이벤트를 불러오지 못했습니다.',
  })
  const notifications = useAsync(
    () => getMyNotifications(userId, { size: 50 }),
    [userId],
    { fallbackMessage: '알림을 불러오지 못했습니다.' },
  )

  const creators = useMemo(() => {
    const list = directory.data?.creators ?? []
    // 관심 등록한 크리에이터를 앞에, 그다음은 보유 응모권이 많은 순서로 보여준다.
    return [...list].sort((a, b) => {
      const aFollowed = followedCreators.includes(a.creatorId) ? 1 : 0
      const bFollowed = followedCreators.includes(b.creatorId) ? 1 : 0
      if (aFollowed !== bFollowed) return bFollowed - aFollowed
      return b.balance - a.balance
    })
  }, [directory.data, followedCreators])

  const events = useMemo(() => directory.data?.events ?? [], [directory.data])

  const balanceByCreator = useMemo(() => {
    const map = new Map()
    creators.forEach((creator) => map.set(creator.creatorId, creator.balance))
    return map
  }, [creators])

  const followedEvents = useMemo(() => {
    const scoped = followedCreators.length
      ? events.filter((event) => followedCreators.includes(event.creatorId))
      : events
    const order = { IN_PROGRESS: 0, UPCOMING: 1, CLOSED: 2 }
    return [...scoped].sort((a, b) => (order[a.displayStatus] ?? 3) - (order[b.displayStatus] ?? 3)).slice(0, 8)
  }, [events, followedCreators])

  const unreadCount = useMemo(
    () => (notifications.data?.items ?? []).filter((item) => !item.readAt).length,
    [notifications.data],
  )
  const openEventCount = useMemo(
    () => events.filter((event) => event.displayStatus === 'IN_PROGRESS').length,
    [events],
  )
  const publishedCount = useMemo(() => events.filter((event) => event.status === 'PUBLISHED').length, [events])
  const totalTickets = useMemo(() => creators.reduce((sum, creator) => sum + creator.balance, 0), [creators])

  const posts = useMemo(() => {
    const ids = (followedCreators.length ? followedCreators : creators.map((creator) => creator.creatorId)).slice(0, 3)
    return getFeedPosts(ids, 2)
  }, [followedCreators, creators])

  const todayActivities = [
    {
      id: 'events',
      icon: 'confirmation_number',
      tag: '응모',
      title: `지금 응모할 수 있는 이벤트 ${formatNumber(openEventCount)}개`,
      action: '응모하러 가기',
      to: '/explore',
      disabled: openEventCount === 0,
    },
    {
      id: 'notifications',
      icon: 'notifications_active',
      tag: '알림',
      title: unreadCount > 0 ? `읽지 않은 알림 ${formatNumber(unreadCount)}개` : '새로운 알림이 없어요',
      action: '알림 보기',
      to: '/notifications',
      disabled: unreadCount === 0,
    },
    {
      id: 'winners',
      icon: 'emoji_events',
      tag: '결과',
      title: publishedCount > 0 ? `결과가 공개된 이벤트 ${formatNumber(publishedCount)}개` : '발표를 기다리는 중이에요',
      action: '당첨 확인',
      to: '/my-entries',
      disabled: publishedCount === 0,
    },
  ]

  return (
    <div className="flex flex-col w-full pb-8">
      <section className="px-margin pt-4 pb-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="font-label-sm text-label-sm text-primary font-semibold">
            🎟 보유 응모권 {formatNumber(totalTickets)}장
            {isCreator && ' · 크리에이터'}
            {isAdmin && ' · 관리자'}
          </p>
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">
          {user?.name ?? '팬'}님, 오늘도 좋아하는 크리에이터와 함께해봐 ✨
        </h2>
      </section>

      <InstallBanner />

      <section className="mt-4">
        <div className="px-margin">
          <SectionHeader
            icon="favorite"
            title="내 크리에이터"
            count={creators.length}
            action="전체보기"
            actionTo="/explore"
          />
        </div>
        {directory.loading && <LoadingBlock label="크리에이터를 불러오는 중..." />}
        {!directory.loading && directory.error && (
          <ErrorBlock message={directory.error} onRetry={directory.reload} />
        )}
        {!directory.loading && !directory.error && (
          <div className="flex gap-3 overflow-x-auto px-margin no-scrollbar py-1">
            {creators.map((creator) => (
              <CreatorAvatarItem key={creator.creatorId} creator={creator} />
            ))}
            <Link
              to="/onboarding/creators"
              className="flex flex-col items-center flex-shrink-0 w-24 group cursor-pointer"
            >
              <div className="w-[4.5rem] h-[4.5rem] rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors mb-2 shadow-sm">
                <MaterialIcon name="add" className="text-[28px]" />
              </div>
              <span className="font-label-md text-label-md text-on-surface-variant font-medium text-center">
                추가하기
              </span>
            </Link>
          </div>
        )}
      </section>

      <section className="mt-6 px-margin">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="bolt" className="text-[20px] text-tertiary" />
            <h3 className="font-title-md text-title-md text-on-surface font-bold">오늘의 활동</h3>
          </div>
          <span className="font-label-xs text-label-xs text-primary font-semibold bg-berry-tint px-2 py-0.5 rounded-full">
            실시간 반영
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {todayActivities.map((task) => (
            <div
              key={task.id}
              className="bg-surface-container-lowest p-3.5 rounded-xl shadow-card flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center flex-shrink-0 text-primary">
                  <MaterialIcon name={task.icon} className="text-[22px]" />
                </div>
                <div className="min-w-0">
                  <span className="font-label-xs text-label-xs text-primary font-bold">{task.tag}</span>
                  <p className="font-title-md text-title-md text-on-surface font-semibold truncate">{task.title}</p>
                </div>
              </div>
              <Link
                to={task.to}
                className={`flex-shrink-0 px-3.5 py-2 rounded-lg font-label-md text-label-md font-semibold active:scale-95 transition-all shadow-sm ${
                  task.disabled ? 'bg-surface-container-high text-outline' : 'bg-primary text-on-primary'
                }`}
              >
                {task.action}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <div className="px-margin">
          <SectionHeader
            icon="confirmation_number"
            title={followedCreators.length ? '관심 크리에이터 이벤트' : '진행 중인 이벤트'}
            action="더보기"
            actionTo="/explore"
          />
        </div>
        {directory.loading && <LoadingBlock label="이벤트를 불러오는 중..." />}
        {!directory.loading && !directory.error && followedEvents.length === 0 && (
          <EmptyBlock
            icon="confirmation_number"
            message="아직 열린 이벤트가 없어요. 크리에이터가 이벤트를 등록하면 여기에 표시됩니다."
          />
        )}
        {!directory.loading && !directory.error && followedEvents.length > 0 && (
          <div className="flex gap-4 overflow-x-auto px-margin no-scrollbar pb-2">
            {followedEvents.map((event) => (
              <EventCard
                key={event.eventId}
                event={event}
                showCreatorTag
                ticketsOwned={balanceByCreator.get(event.creatorId)}
              />
            ))}
          </div>
        )}
      </section>

      {posts.length > 0 && (
        <section className="mt-7 px-margin">
          <SectionHeader icon="feed" title="최신 소식" />
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <FeedPostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
