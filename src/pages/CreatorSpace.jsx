import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import EventCard from '../components/creator/EventCard.jsx'
import SpaceEditSheet from '../components/creator/SpaceEditSheet.jsx'
import CreatorCalendar, { UpcomingSchedules } from '../components/creator/CreatorCalendar.jsx'
import TicketLedgerSheet from '../components/ticket/TicketLedgerSheet.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorSpace } from '../api/creators.js'
import { getMySpace, spaceShareUrl } from '../api/creatorSpace.js'
import { completeCreatorMission, getCreatorMissions } from '../api/missions.js'
import { ApiError, describeError } from '../api/client.js'
import { formatNumber } from '../utils/format.js'

// 탭은 항상 노출하고, 내용이 없으면 EMPTY_TAB_MESSAGE를 보여준다(Cking-BE #290).
// 순서: 응모권을 모으는 미션과 응모하는 이벤트를 앞에, 캘린더 일정(추첨 이벤트와 별개)과 게시물을 뒤에 둔다.
const TABS = [
  { id: 'home', label: '홈' },
  { id: 'missions', label: '미션' },
  { id: 'events', label: '이벤트' },
  { id: 'calendar', label: '캘린더' },
  { id: 'posts', label: '게시물' },
]
const EMPTY_TAB_MESSAGE = '현재 열려있는 게 없습니다.'

/** Space가 없는 크리에이터(RESOURCE_NOT_FOUND)는 오류가 아니라 빈 상태로 보여주기 위해 null로 바꾼다. */
async function loadSpaceOrNull(key) {
  try {
    return await loadCreatorSpace(key)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND') return null
    throw error
  }
}

/**
 * 크리에이터 스페이스(시안 _5, toast).
 *
 * 경로: /creators/:creatorId(앱 안 이동), /space/:slug(공유 링크)
 * 프로필(이름·소개·이미지·slug)은 Creator Space API(GET /api/creators/{id}/space, GET /api/creator-spaces/{slug}),
 * 응모권 잔액(GET /api/creators/{id}/tickets)·내역, 이벤트(GET /api/events?creatorId=), 미션을 실제로 조회한다.
 * 캘린더 탭·홈의 다가오는 일정은 GET /api/creators/{id}/calendar/schedules(추첨 이벤트와 별개인 크리에이터 일정)를 쓴다.
 * 게시물은 백엔드 API가 아직 없어 빈 탭으로 보여준다.
 * 내 Space면(GET /api/creator/space의 creatorId가 같으면) 편집할 수 있다.
 */
export default function CreatorSpace() {
  const { creatorId: creatorIdParam, slug: slugParam } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const { isCreator, isFollowing, toggleFollow } = useUser()

  const [tab, setTab] = useState('home')
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [missionBusyId, setMissionBusyId] = useState(null)

  const { data: creator, loading, error, reload, setData: setCreator } = useAsync(
    () => loadSpaceOrNull({ creatorId: creatorIdParam, slug: slugParam }),
    [creatorIdParam, slugParam],
    { fallbackMessage: '크리에이터 정보를 불러오지 못했습니다.' },
  )
  const creatorId = creator?.creatorId ?? null

  const { data: missions, loading: missionsLoading, error: missionsError, reload: reloadMissions, setData: setMissions } = useAsync(
    () => getCreatorMissions(creatorId),
    [creatorId],
    { enabled: creatorId !== null, fallbackMessage: '오늘의 미션을 불러오지 못했어요.' },
  )
  // 크리에이터인 경우에만 내 Space를 조회해 지금 보는 Space가 내 것인지 판별한다.
  const mySpace = useAsync(() => getMySpace(), [isCreator], { enabled: isCreator })
  const isMine = creatorId !== null && mySpace.data?.creatorId === creatorId

  const events = useMemo(() => creator?.events ?? [], [creator])
  const liveEvents = useMemo(
    () => events.filter((event) => event.displayStatus !== 'CLOSED'),
    [events],
  )
  const publishedEvent = useMemo(() => events.find((event) => event.status === 'PUBLISHED'), [events])

  const following = creatorId !== null && isFollowing(creatorId)

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
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : (
          <EmptyBlock icon="storefront" message="아직 준비된 크리에이터 스페이스가 없어요." />
        )}
        <Link to="/" className="text-center text-primary font-label-md text-label-md font-semibold">
          홈으로 돌아가기
        </Link>
      </div>
    )
  }

  function handleFollow() {
    toggleFollow(creator.creatorId)
    showToast(following ? '관심 크리에이터에서 해제되었습니다.' : `${creator.creatorName} 관심 등록 완료! 💖`)
  }

  async function handleShare() {
    const url = spaceShareUrl(creator.slug)
    try {
      if (navigator.share) {
        await navigator.share({ title: `${creator.creatorName} | Cking`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      showToast('공유 링크를 복사했어요.')
    } catch (shareError) {
      // 사용자가 공유 시트를 닫은 경우(AbortError)는 알림을 띄우지 않는다.
      if (shareError?.name !== 'AbortError') showToast('공유할 수 없는 환경이에요.', { icon: 'error' })
    }
  }

  function handleSpaceSaved(updated) {
    mySpace.setData(updated)
    setCreator((current) => (current ? { ...current, ...updated } : current))
    // 공유 링크로 들어온 화면에서 slug를 바꾸면 이전 주소는 더 이상 열리지 않으므로 새 주소로 옮긴다.
    if (slugParam && updated.slug !== slugParam) {
      navigate(`/space/${encodeURIComponent(updated.slug)}`, { replace: true })
    }
  }

  async function completeMission(mission) {
    setMissionBusyId(mission.missionId)
    try {
      await completeCreatorMission(creator.creatorId, mission.missionId)
      setMissions((current) => (current ?? []).map((item) => (
        item.missionId === mission.missionId ? { ...item, completedToday: true } : item
      )))
      showToast(`응모권 ${mission.rewardAmount}장을 적립했어요.`)
    } catch (missionError) {
      showToast(describeError(missionError, '미션을 완료하지 못했어요.'), { icon: 'error' })
    } finally {
      setMissionBusyId(null)
    }
  }

  const missionList = (
    <>
      {missionsLoading && <LoadingBlock label="오늘의 미션을 불러오는 중..." />}
      {!missionsLoading && missionsError && <ErrorBlock message={missionsError} onRetry={reloadMissions} />}
      {!missionsLoading && !missionsError && missions?.map((mission) => {
        const attendance = mission.type === 'ATTENDANCE'
        const completed = mission.completedToday
        return (
          <div key={mission.missionId} className="flex items-center justify-between gap-3 p-space-md rounded-xl bg-surface-container-lowest shadow-card">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${attendance ? 'bg-secondary-container/40 text-secondary' : 'bg-surface-container-high text-primary'}`}>
                <MaterialIcon name={attendance ? 'calendar_today' : 'favorite'} filled={!attendance} className="text-[22px]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-md text-label-md text-on-surface font-semibold">{attendance ? '오늘 출석하기' : '좋아요 미션'}</span>
                <span className="text-secondary font-label-xs text-label-xs">🎟 응모권 +{mission.rewardAmount}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={completed || missionBusyId === mission.missionId}
              onClick={() => completeMission(mission)}
              className={`shrink-0 px-3 py-2 rounded-lg font-label-sm text-label-sm transition-all active:scale-95 disabled:opacity-60 ${completed ? 'bg-surface-container-high text-outline' : 'bg-berry-tint text-primary'}`}
            >
              {missionBusyId === mission.missionId ? '처리 중...' : completed ? '완료' : '참여하기'}
            </button>
          </div>
        )
      })}
      {!missionsLoading && !missionsError && (missions?.length ?? 0) === 0 && (
        <EmptyBlock icon="bolt" message={EMPTY_TAB_MESSAGE} />
      )}
    </>
  )

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-24">
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-50 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 px-margin md:px-8 flex items-center justify-between gap-space-xs">
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
            <button
              type="button"
              aria-label="공유하기"
              onClick={handleShare}
              className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
            >
              <MaterialIcon name="share" className="text-[20px]" />
            </button>
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
            <img className="w-full h-full object-cover" src={creator.bannerImageUrl} alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
          </div>
          <div className="px-margin relative -mt-12 flex flex-col gap-space-sm">
            <div className="flex items-end justify-between">
              <div className="relative w-20 h-20 rounded-full p-1 bg-surface shadow-md">
                <img className="w-full h-full rounded-full object-cover" src={creator.profileImageUrl} alt={creator.creatorName} />
                <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm">
                  <MaterialIcon name="verified" filled className="text-[16px]" />
                </div>
              </div>
              <div className="flex items-center gap-space-xs mb-1">
                {isMine && (
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-sm transition-all active:scale-95 bg-surface-container-highest text-on-surface"
                  >
                    <MaterialIcon name="edit" className="text-[18px]" />
                    <span className="font-label-sm text-label-sm">스페이스 편집</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleFollow}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-sm transition-all active:scale-95 ${
                    following ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  <MaterialIcon name={following ? 'check' : 'add'} filled={following} className="text-[18px]" />
                  <span className="font-label-sm text-label-sm">{following ? '관심 중' : '관심 등록'}</span>
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-headline-md text-headline-md text-on-surface">{creator.creatorName}</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-xs text-label-xs">
                  Official Creator
                </span>
              </div>
              <span className="font-label-xs text-label-xs text-outline">@{creator.slug}</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{creator.introText}</p>
            </div>
          </div>
        </section>

        {/* 탭이 늘어나도 좁은 화면에서 가로로 스크롤되는 밑줄 탭(유튜브 채널·위버스 방식). */}
        <div className="mt-space-md sticky top-14 z-40 bg-surface/95 backdrop-blur-xl border-b border-surface-container-high">
          <div role="tablist" aria-label="스페이스 탭" className="flex gap-6 px-margin overflow-x-auto no-scrollbar">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`shrink-0 min-h-[44px] pt-3 pb-2.5 border-b-2 font-title-md text-title-md transition-colors ${
                  tab === item.id
                    ? 'border-primary text-on-surface font-bold'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
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
                    {creator.creatorName} Dedicated Drops
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
                  {creator.creatorName} 응모권 🎟 {formatNumber(creator.balance)}장
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 pt-3 border-t border-white/20 relative z-10">
                <MaterialIcon name="info" className="text-[16px] text-primary-fixed" />
                <span className="font-body-sm text-body-sm text-primary-fixed font-medium">
                  응모권은 이 공간 이벤트에서만 쓸 수 있어!
                </span>
              </div>
            </div>

            <UpcomingSchedules creatorId={creator.creatorId} onShowAll={() => setTab('calendar')} />

            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MaterialIcon name="bolt" className="text-primary text-[20px]" />
                  <h2 className="font-title-md text-title-md text-on-surface">오늘의 미션</h2>
                </div>
                <span className="font-label-xs text-label-xs text-on-surface-variant">매일 00:00 갱신</span>
              </div>
              {missionList}
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
                <EmptyBlock icon="event_busy" message={EMPTY_TAB_MESSAGE} />
              )}
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

        {tab === 'missions' && (
          <div className="flex flex-col gap-space-sm px-margin py-space-sm">{missionList}</div>
        )}

        {tab === 'calendar' && <CreatorCalendar creatorId={creator.creatorId} />}

        {tab === 'posts' && (
          <div className="flex flex-col gap-space-md px-margin py-space-sm">
            <EmptyBlock icon="grid_view" message={EMPTY_TAB_MESSAGE} />
          </div>
        )}

        {tab === 'events' && (
          <div className="flex flex-col gap-space-md px-margin py-space-sm">
            {events.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
                {events.map((event) => (
                  <EventCard key={event.eventId} event={event} variant="list" ticketsOwned={creator.balance} />
                ))}
              </div>
            ) : (
              <EmptyBlock icon="event_busy" message={EMPTY_TAB_MESSAGE} />
            )}
          </div>
        )}
      </div>

      <TicketLedgerSheet
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        creatorId={creator.creatorId}
        creatorName={creator.creatorName}
        balance={creator.balance}
      />
      {isMine && (
        <SpaceEditSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          space={mySpace.data}
          onSaved={handleSpaceSaved}
        />
      )}
    </div>
  )
}
