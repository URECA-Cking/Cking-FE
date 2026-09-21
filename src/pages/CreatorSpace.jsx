import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import EventCard from '../components/creator/EventCard.jsx'
import FeedPostCard from '../components/feed/FeedPostCard.jsx'
import TicketLedgerSheet from '../components/ticket/TicketLedgerSheet.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorSpace } from '../api/creators.js'
import { getPostsByCreator } from '../data/posts.js'
import { formatNumber } from '../utils/format.js'

const TABS = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'posts', label: '게시물', icon: 'grid_view' },
  { id: 'events', label: '이벤트', icon: 'confirmation_number' },
]

/**
 * 크리에이터 스페이스(시안 _5, toast).
 *
 * 응모권 잔액(GET /api/creators/{id}/tickets), 응모권 내역(.../tickets/history),
 * 해당 크리에이터의 이벤트(GET /api/events?creatorId=)를 실제로 조회한다.
 * 게시물과 출석/좋아요 미션은 백엔드에 대응 API가 없어 화면 구성만 유지한다.
 */
export default function CreatorSpace() {
  const { creatorId } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const { userId, isFollowing, toggleFollow } = useUser()

  const [tab, setTab] = useState('home')
  const [ledgerOpen, setLedgerOpen] = useState(false)

  const { data: creator, loading, error, reload } = useAsync(
    () => loadCreatorSpace(creatorId, userId),
    [creatorId, userId],
    { fallbackMessage: '크리에이터 정보를 불러오지 못했습니다.' },
  )

  const posts = useMemo(() => getPostsByCreator(creatorId), [creatorId])
  const events = useMemo(() => creator?.events ?? [], [creator])
  const liveEvents = useMemo(
    () => events.filter((event) => event.displayStatus !== 'CLOSED'),
    [events],
  )
  const publishedEvent = useMemo(() => events.find((event) => event.status === 'PUBLISHED'), [events])

  const following = isFollowing(creatorId)

  if (loading) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-safe">
        <LoadingBlock label="크리에이터 스페이스를 불러오는 중..." />
      </div>
    )
  }

  if (error || !creator) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-safe justify-center">
        <ErrorBlock message={error ?? '크리에이터를 찾을 수 없어요.'} onRetry={reload} />
        <Link to="/" className="text-center text-primary font-label-md text-label-md font-semibold">
          홈으로 돌아가기
        </Link>
      </div>
    )
  }

  function handleFollow() {
    toggleFollow(creator.creatorId)
    showToast(following ? '관심 크리에이터에서 해제되었습니다.' : `${creator.name} 관심 등록 완료! 💖`)
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-24">
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 px-margin flex items-center justify-between gap-space-xs">
          <div className="flex items-center gap-space-xs min-w-0">
            <button
              type="button"
              aria-label="뒤로가기"
              onClick={() => navigate(-1)}
              className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface shrink-0"
            >
              <MaterialIcon name="arrow_back" className="text-[22px]" />
            </button>
            <h1 className="font-title-md text-title-md text-on-surface font-semibold truncate">Cking Creator</h1>
          </div>
          <div className="flex items-center gap-space-xs shrink-0">
            <Link
              to="/notifications"
              aria-label="알림"
              className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
            >
              <MaterialIcon name="notifications" className="text-[20px]" />
            </Link>
            <Link
              to="/my-page"
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
              aria-label="마이페이지"
            >
              <MaterialIcon name="person" className="text-on-primary text-[18px]" />
            </Link>
          </div>
        </div>
      </header>

      <div className="pt-14 flex flex-col w-full">
        <section className="relative w-full">
          <div className="relative w-full h-44 overflow-hidden">
            <img className="w-full h-full object-cover" src={creator.banner} alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
          </div>
          <div className="px-margin relative -mt-12 flex flex-col gap-space-sm">
            <div className="flex items-end justify-between">
              <div className="relative w-20 h-20 rounded-full p-1 bg-surface shadow-md">
                <img className="w-full h-full rounded-full object-cover" src={creator.avatar} alt={creator.name} />
                <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm">
                  <MaterialIcon name="verified" filled className="text-[16px]" />
                </div>
              </div>
              <button
                type="button"
                onClick={handleFollow}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-sm transition-all active:scale-95 mb-1 ${
                  following ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                <MaterialIcon name={following ? 'check' : 'add'} filled={following} className="text-[18px]" />
                <span className="font-label-sm text-label-sm">{following ? '관심 중' : '관심 등록'}</span>
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-headline-md text-headline-md text-on-surface">{creator.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-xs text-label-xs">
                  Official Creator
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{creator.bio}</p>
            </div>
          </div>
        </section>

        <div className="mt-space-md px-margin">
          <div className="flex items-center gap-space-xs p-1 rounded-xl bg-surface-container-low">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex-1 py-2 rounded-lg font-label-md text-label-md flex items-center justify-center gap-1 transition-colors ${
                  tab === item.id
                    ? 'bg-surface shadow-sm text-primary font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <MaterialIcon name={item.icon} className="text-[18px]" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'home' && (
          <div className="flex flex-col gap-space-xl mt-space-lg px-margin">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-[#be185d] to-berry-deep p-space-lg text-on-primary shadow-floating">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-1.5">
                  <MaterialIcon name="stars" filled className="text-primary-fixed text-[20px]" />
                  <span className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">
                    {creator.name} Dedicated Drops
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLedgerOpen(true)}
                  className="flex items-center gap-0.5 font-label-xs text-label-xs text-primary-fixed hover:text-white transition-colors"
                >
                  응모권 내역 보기
                  <MaterialIcon name="chevron_right" className="text-[14px]" />
                </button>
              </div>
              <div className="mt-4 flex items-baseline gap-2 relative z-10">
                <span className="font-headline-xl text-headline-xl text-white font-bold tracking-tight">
                  {creator.name} 응모권 🎟 {formatNumber(creator.balance)}장
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 pt-3 border-t border-white/20 relative z-10">
                <MaterialIcon name="info" className="text-[16px] text-primary-fixed" />
                <span className="font-body-sm text-body-sm text-primary-fixed font-medium">
                  응모권은 이 공간 이벤트에서만 쓸 수 있어!
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MaterialIcon name="bolt" className="text-primary text-[20px]" />
                  <h2 className="font-title-md text-title-md text-on-surface">오늘의 활동</h2>
                </div>
                <span className="font-label-xs text-label-xs text-on-surface-variant">매일 00:00 갱신</span>
              </div>
              <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-lowest shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-container/40 flex items-center justify-center text-secondary">
                    <MaterialIcon name="calendar_today" className="text-[22px]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">오늘 출석하기</span>
                    <span className="text-secondary font-label-xs text-label-xs">🎟 응모권 +1</span>
                  </div>
                </div>
                <span className="px-3 py-2 rounded-lg bg-surface-container-high text-outline font-label-sm text-label-sm">
                  준비 중
                </span>
              </div>
              <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-lowest shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
                    <MaterialIcon name="favorite" filled className="text-[22px]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      게시물에 좋아요하기
                    </span>
                    <span className="text-secondary font-label-xs text-label-xs">🎟 응모권 +1</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('posts')}
                  className="px-3 py-2 rounded-lg bg-berry-tint text-primary font-label-sm text-label-sm transition-all active:scale-95"
                >
                  게시물 보러가기
                </button>
              </div>
              <p className="font-label-xs text-label-xs text-outline leading-relaxed px-1">
                미션 완료 API(POST /api/creators/{'{creatorId}'}/missions/.../complete)가 백엔드에 아직 없어
                출석·좋아요 적립은 연결되어 있지 않아요. 응모권 잔액과 사용 내역은 실제 값입니다.
              </p>
            </div>

            <div className="flex flex-col gap-space-sm -mx-margin">
              <div className="flex items-center justify-between px-margin">
                <div className="flex items-center gap-1.5">
                  <MaterialIcon name="local_activity" className="text-tertiary text-[20px]" />
                  <h2 className="font-title-md text-title-md text-on-surface">진행 중 이벤트</h2>
                </div>
                <span className="font-label-xs text-label-xs text-primary font-semibold">
                  총 {liveEvents.length}개 진행중
                </span>
              </div>
              {liveEvents.length > 0 ? (
                <div className="flex gap-space-md overflow-x-auto px-margin no-scrollbar snap-x snap-mandatory py-1">
                  {liveEvents.map((event) => (
                    <EventCard key={event.eventId} event={event} ticketsOwned={creator.balance} />
                  ))}
                </div>
              ) : (
                <EmptyBlock icon="event_busy" message="진행 중인 이벤트가 없어요." />
              )}
            </div>

            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MaterialIcon name="photo_library" className="text-primary text-[20px]" />
                  <h2 className="font-title-md text-title-md text-on-surface">최신 게시물 미리보기</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('posts')}
                  className="flex items-center gap-0.5 font-label-xs text-label-xs text-on-surface-variant hover:text-primary transition-colors"
                >
                  전체보기
                  <MaterialIcon name="chevron_right" className="text-[14px]" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {posts.slice(0, 3).map((post) => (
                  <button
                    type="button"
                    key={post.id}
                    onClick={() => setTab('posts')}
                    className="relative aspect-square rounded-xl overflow-hidden shadow-sm group"
                  >
                    <img
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      src={post.image}
                      alt=""
                    />
                  </button>
                ))}
              </div>
            </div>

            {publishedEvent && (
              <Link
                to={`/events/${publishedEvent.eventId}`}
                className="flex items-center gap-space-sm p-space-md rounded-2xl bg-berry-tint border border-border-rose active:scale-[0.99] transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0">
                  <MaterialIcon name="celebration" filled className="text-[20px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md text-berry-deep font-bold truncate">
                    {publishedEvent.title} 결과가 공개됐어
                  </p>
                  <p className="font-label-xs text-label-xs text-berry-deep/80">당첨 내역을 지금 바로 확인해봐!</p>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-xs text-label-xs font-bold shrink-0">
                  결과 확인 &gt;
                </span>
              </Link>
            )}
          </div>
        )}

        {tab === 'posts' && (
          <div className="flex flex-col gap-space-md px-margin py-space-sm">
            <div className="p-space-sm rounded-xl bg-berry-tint flex items-center gap-space-sm shadow-sm">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <MaterialIcon name="confirmation_number" className="text-on-primary text-[15px]" />
              </div>
              <p className="font-body-sm text-body-sm text-berry-deep flex-1 leading-snug">
                게시물에 공감(좋아요)을 남기면 오늘 하루{' '}
                <strong className="font-bold">1회 {creator.name} 전용 응모권 1장</strong>이 지급될 예정이에요.
              </p>
            </div>
            {posts.map((post) => (
              <FeedPostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {tab === 'events' && (
          <div className="flex flex-col gap-space-md px-margin py-space-sm">
            {events.length > 0 ? (
              <div className="grid grid-cols-1 gap-space-md">
                {events.map((event) => (
                  <EventCard key={event.eventId} event={event} variant="list" ticketsOwned={creator.balance} />
                ))}
              </div>
            ) : (
              <EmptyBlock icon="event_busy" message="아직 등록된 이벤트가 없어요." />
            )}
          </div>
        )}
      </div>

      <TicketLedgerSheet
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        creatorId={creator.creatorId}
        creatorName={creator.name}
        userId={userId}
        balance={creator.balance}
      />
    </div>
  )
}
