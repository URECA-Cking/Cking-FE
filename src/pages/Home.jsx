import { useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import CreatorAvatarItem from '../components/creator/CreatorAvatarItem.jsx'
import EventCard from '../components/creator/EventCard.jsx'
import FeedPostCard from '../components/feed/FeedPostCard.jsx'
import { creators } from '../data/creators.js'
import { events } from '../data/events.js'
import { posts } from '../data/posts.js'
import { useToast } from '../context/ToastContext.jsx'

const DAILY_TASKS = [
  {
    id: 'checkin',
    creatorTag: 'IVE',
    title: '매일 팬덤 출석 미션',
    reward: 1,
    action: '출석하기',
    doneLabel: '완료됨',
  },
  {
    id: 'like',
    creatorTag: 'DAY6',
    title: '새 단체 포토 좋아요 누르기',
    reward: 1,
    action: '게시물 보러가기',
  },
]

export default function Home() {
  const showToast = useToast()
  const [checkedIn, setCheckedIn] = useState(false)

  function handleCheckin() {
    if (checkedIn) return
    setCheckedIn(true)
    showToast('✨ IVE 일일 출석 완료! 🎟 티켓 1장을 획득했습니다.')
  }

  return (
    <div className="flex flex-col w-full pb-8">
      <section className="px-margin pt-4 pb-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="font-label-sm text-label-sm text-primary font-semibold">팬 레벨 3 · 열혈 서포터</p>
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">
          오늘도 좋아하는 크리에이터와 함께해봐 ✨
        </h2>
      </section>

      <Link
        to="/live"
        className="mx-margin mt-3 flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-primary to-[#e11d48] text-on-primary shadow-md active:scale-[0.98] transition-all"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <MaterialIcon name="cloud_sync" className="text-[22px]" />
          <div className="min-w-0">
            <p className="font-label-md text-label-md font-semibold">실시간 백엔드 기능 확인하기</p>
            <p className="font-label-xs text-label-xs opacity-90 truncate">가상 사용자로 실제 이벤트·응모·알림 API를 테스트해보세요</p>
          </div>
        </div>
        <MaterialIcon name="chevron_right" className="text-[20px] shrink-0" />
      </Link>

      <section className="mt-4">
        <div className="flex items-center justify-between px-margin mb-3">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="favorite" filled className="text-[20px] text-primary" />
            <h3 className="font-title-md text-title-md text-on-surface font-bold">내 크리에이터</h3>
            <span className="font-label-xs text-label-xs bg-surface-container-high text-primary px-2 py-0.5 rounded-full font-bold">
              {creators.length}
            </span>
          </div>
          <Link
            to="/explore"
            className="flex items-center text-on-surface-variant hover:text-primary transition-colors font-label-sm text-label-sm"
          >
            전체보기
            <MaterialIcon name="chevron_right" className="text-[16px]" />
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto px-margin no-scrollbar py-1">
          {creators.map((creator) => (
            <CreatorAvatarItem key={creator.id} creator={creator} />
          ))}
          <Link to="/onboarding/creators" className="flex flex-col items-center flex-shrink-0 w-24 group cursor-pointer">
            <div className="w-[4.5rem] h-[4.5rem] rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors mb-2 shadow-sm">
              <MaterialIcon name="add" className="text-[28px]" />
            </div>
            <span className="font-label-md text-label-md text-on-surface-variant font-medium text-center">추가하기</span>
          </Link>
        </div>
      </section>

      <section className="mt-6 px-margin">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="bolt" className="text-[20px] text-tertiary" />
            <h3 className="font-title-md text-title-md text-on-surface font-bold">오늘의 활동</h3>
          </div>
          <span className="font-label-xs text-label-xs text-primary font-semibold bg-berry-tint px-2 py-0.5 rounded-full">
            티켓 획득 가능
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {DAILY_TASKS.map((task) => {
            const isCheckin = task.id === 'checkin'
            const done = isCheckin && checkedIn
            return (
              <div
                key={task.id}
                className="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center flex-shrink-0 text-primary">
                    <MaterialIcon name={isCheckin ? 'event_available' : 'favorite_border'} className="text-[22px]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="font-label-xs text-label-xs text-primary font-bold">{task.creatorTag}</span>
                      <span className="text-outline text-[10px]">·</span>
                      <span className="font-label-xs text-label-xs text-secondary font-bold">
                        🎟 +{task.reward} 티켓
                      </span>
                    </div>
                    <p className="font-title-md text-title-md text-on-surface font-semibold truncate">{task.title}</p>
                  </div>
                </div>
                {isCheckin ? (
                  <button
                    type="button"
                    disabled={done}
                    onClick={handleCheckin}
                    className={`flex-shrink-0 px-3.5 py-2 rounded-lg font-label-md text-label-md font-semibold active:scale-95 transition-all shadow-sm ${
                      done ? 'bg-surface-container-high text-outline' : 'bg-primary text-on-primary'
                    }`}
                  >
                    {done ? '완료됨' : task.action}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex-shrink-0 px-3 py-2 rounded-lg bg-berry-tint text-primary font-label-md text-label-md font-medium active:scale-95 transition-all flex items-center gap-1"
                  >
                    {task.action}
                    <MaterialIcon name="arrow_forward" className="text-[16px]" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-7">
        <div className="flex items-center justify-between px-margin mb-3">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="confirmation_number" filled className="text-[20px] text-primary" />
            <h3 className="font-title-md text-title-md text-on-surface font-bold">관심 크리에이터 이벤트</h3>
          </div>
          <Link
            to="/explore"
            className="flex items-center text-on-surface-variant hover:text-primary transition-colors font-label-sm text-label-sm"
          >
            더보기
            <MaterialIcon name="chevron_right" className="text-[16px]" />
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto px-margin no-scrollbar pb-2">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              showCreatorTag
              ticketsOwned={creators.find((creator) => creator.id === event.creatorId)?.tickets}
            />
          ))}
        </div>
      </section>

      <section className="mt-7 px-margin">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="feed" className="text-[20px] text-primary" />
            <h3 className="font-title-md text-title-md text-on-surface font-bold">최신 소식</h3>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {posts.slice(0, 2).map((post) => (
            <FeedPostCard key={post.id} post={post} />
          ))}
        </div>
      </section>
    </div>
  )
}
