import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import BackButton from '../components/ui/BackButton.jsx'
import { useAppBack } from '../hooks/useAppBack.js'
import EventCard from '../components/creator/EventCard.jsx'
import CreatorPosts from '../components/creator/CreatorPosts.jsx'
import CreatorQuizzes from '../components/creator/CreatorQuizzes.jsx'
import MyEventManager from '../components/creator/MyEventManager.jsx'
import SpaceEditSheet from '../components/creator/SpaceEditSheet.jsx'
import CreatorCalendar, { UpcomingSchedules } from '../components/creator/CreatorCalendar.jsx'
import TicketLedgerSheet from '../components/ticket/TicketLedgerSheet.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorSpace } from '../api/creators.js'
import { getCreatorSpace, getMySpace, spacePath, spaceShareUrl } from '../api/creatorSpace.js'
import { getCreatorPosts } from '../api/posts.js'
import { getCreatorMissions } from '../api/missions.js'
import { getCreatorYoutubeChannel } from '../api/subscriptionVerification.js'
import { getTicketBalance } from '../api/tickets.js'
import { ApiError, describeError } from '../api/client.js'
import { formatNumber } from '../utils/format.js'
import FollowStatus from '../components/creator/FollowStatus.jsx'
import YoutubeChannelSheet from '../components/creator/YoutubeChannelSheet.jsx'
import YoutubeSubscriptionMissionCard from '../components/creator/YoutubeSubscriptionMissionCard.jsx'
import { isYoutubeChannelForCreator } from '../utils/subscriptionVerificationState.js'

// 탭은 항상 노출하고, 내용이 없으면 EMPTY_TAB_MESSAGE를 보여준다(Cking-BE #290).
// 순서: 응모권을 모으는 미션과 응모하는 이벤트를 앞에, 캘린더 일정(추첨 이벤트와 별개)과 게시물을 뒤에 둔다.
const TABS = [
  { id: 'home', label: '홈' },
  { id: 'missions', label: '미션' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'events', label: '이벤트' },
  { id: 'calendar', label: '캘린더' },
  { id: 'posts', label: '게시물' },
]
const EMPTY_TAB_MESSAGE = '현재 열려있는 게 없습니다.'

/** RESOURCE_NOT_FOUND는 오류가 아니라 "찾을 수 없음" 안내로 보여주기 위해 표시 값으로 바꾼다. */
async function loadSpaceOrNotFound(key) {
  try {
    return await loadCreatorSpace(key)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND') return { notFound: true }
    throw error
  }
}

// 공유 링크의 slug가 없으면(바뀌었거나 잘못된 주소) 404, creatorId로 들어왔는데 없으면 Space가 아직 없는 크리에이터다.
const NOT_FOUND_MESSAGES = {
  slug: { icon: 'link_off', title: '존재하지 않는 공유 주소예요.', detail: '주소가 바뀌었거나 잘못 입력됐을 수 있어요.' },
  creator: { icon: 'storefront', title: '아직 준비된 크리에이터 스페이스가 없어요.', detail: '' },
}

/** 소개글: 3줄을 넘으면 접고 "더보기"로 펼친다. */
function ProfileIntro({ text }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null
  const long = text.length > 80 || text.split(String.fromCharCode(10)).length > 3
  return (
    <div className="font-body-sm text-body-sm text-on-surface">
      <p className={`whitespace-pre-wrap break-words ${expanded || !long ? '' : 'line-clamp-3'}`}>{text}</p>
      {long && !expanded && (
        <button type="button" onClick={() => setExpanded(true)} className="font-label-sm text-label-sm text-on-surface-variant">
          더보기
        </button>
      )}
    </div>
  )
}

/**
 * 크리에이터 스페이스(시안 _5, toast).
 *
 * 경로: /:slug(인스타식 주소, 로그인 없이 열람 가능), 예전 경로 /space/:slug·/creators/:creatorId도 유지
 * 공개 데이터: 프로필(GET /api/creators/{id}/space, GET /api/creator-spaces/{slug}), 이벤트(GET /api/events?creatorId=), 캘린더.
 * 로그인 사용자만: 응모권 잔액(GET /api/creators/{id}/tickets)·내역, LIKE·YouTube 구독 인증 미션 참여(SHARE는 공유 UI 연동 전까지 숨긴다),
 * 관심 등록, 본인 편집. 비로그인이면 이 영역에 로그인 안내를 보여준다.
 * 캘린더 탭·홈의 다가오는 일정은 GET /api/creators/{id}/calendar/schedules(추첨 이벤트와 별개인 크리에이터 일정)를 쓴다.
 * 게시물 탭은 공개 Post API로 조회하며 팔로워 공개 게시글은 권한에 따라 잠금 상태로 표시한다.
 * 내 Space면(GET /api/creator/space의 creatorId가 같으면) 편집할 수 있고, 이벤트 탭에서 이벤트를,
 * 캘린더 탭에서 일정을 관리한다(예전 크리에이터 스튜디오 기능).
 */
// 좋아요 미션 적립 뒤 잔액을 다시 확인하는 간격(ms). 합계 약 10초.
const BALANCE_SYNC_DELAYS_MS = [500, 1500, 3000, 5000]

/** 적립 전 잔액을 알면 (적립 전 잔액 + 보상액) 이상, 모르면 지금까지 본 잔액보다 늘어났을 때만 반영된 것으로 본다. */
function isEarnReflected(latest, expected, seen) {
  if (expected !== null) return latest >= expected
  return seen !== null && latest > seen
}

export default function CreatorSpace() {
  const { creatorId: creatorIdParam, slug: slugParam } = useParams()
  const navigate = useNavigate()
  // 공유 링크(/space/:slug)로 직접 열었거나 로그인 직후면 앱 밖으로 나가지 않고 홈으로 간다.
  const goBack = useAppBack('/')
  const showToast = useToast()
  const location = useLocation()
  const { user, status, isCreator, isFollowing, toggleFollow, followsReady, pendingFollowIds } = useUser()
  const authenticated = status === 'authenticated'
  const sessionLoading = status === 'loading'
  // 로그인 상태를 복원하는 동안(loading)에는 로그인 안내를 띄우지 않아 로그인 사용자에게 깜빡이지 않게 한다.
  const anonymous = status === 'anonymous'

  // 홈의 게시물 카드처럼 특정 탭을 가리키며 들어오면(location.state.tab) 그 탭으로 연다.
  const [tab, setTab] = useState(location.state?.tab ?? 'home')
  const [ledgerOpen, setLedgerOpen] = useState(false)
  // 미션 적립이 접수됐지만 잔액 반영을 확인하지 못했을 때: { creatorId, expected(반영됐다고 볼 잔액, 적립 전 잔액을 몰랐으면 null), seen(마지막으로 본 잔액) }.
  const [balancePending, setBalancePending] = useState(null)
  const [balanceRechecking, setBalanceRechecking] = useState(false)
  const followerRefreshSeq = useRef(0)
  const balanceSyncSeq = useRef(0)
  const [editOpen, setEditOpen] = useState(false)
  const [youtubeChannelSettingsOpen, setYoutubeChannelSettingsOpen] = useState(false)

  const { data: loaded, loading, error, reload, setData: setCreator } = useAsync(
    () => loadSpaceOrNotFound({ creatorId: creatorIdParam, slug: slugParam }),
    [creatorIdParam, slugParam],
    { fallbackMessage: '크리에이터 정보를 불러오지 못했습니다.' },
  )
  const creator = useMemo(() => (loaded?.notFound ? null : loaded), [loaded])
  const creatorId = creator?.creatorId ?? null

  // 인증이 필요한 데이터는 로그인 상태가 확인된 뒤에만 조회한다(비로그인 공유 링크 열람 지원).
  const balance = useAsync(
    () => getTicketBalance(creatorId),
    [creatorId, authenticated],
    { enabled: authenticated && creatorId !== null, fallbackMessage: '응모권 잔액을 불러오지 못했어요.' },
  )
  const { data: missions, loading: missionsLoading, error: missionsError, reload: reloadMissions, setData: setMissions } = useAsync(
    () => getCreatorMissions(creatorId),
    [creatorId, authenticated],
    { enabled: authenticated && creatorId !== null, fallbackMessage: '오늘의 미션을 불러오지 못했어요.' },
  )
  // 채널이 없는 Creator는 구독 인증 미션을 팬 화면에 노출하지 않는다. 공개 Space에서도 같은 API를 쓸 수 있다.
  const youtubeChannel = useAsync(
    async () => {
      try {
        return await getCreatorYoutubeChannel(creatorId)
      } catch (channelError) {
        if (channelError instanceof ApiError && channelError.code === 'CREATOR_CHANNEL_NOT_CONFIGURED') return null
        throw channelError
      }
    },
    [creatorId],
    { enabled: creatorId !== null },
  )
  // 프로필 통계의 게시물 수는 목록 응답의 totalElements를 쓴다(1건만 요청). 실패하면 그 칸만 숨긴다.
  const postTotal = useAsync(
    () => getCreatorPosts(creatorId, { size: 1 }),
    [creatorId, authenticated],
    { enabled: creatorId !== null },
  )
  const ticketBalance = balance.data?.balance ?? 0
  const likeMissions = useMemo(() => (missions ?? []).filter((mission) => mission.type === 'LIKE'), [missions])
  const youtubeSubscriptionMission = useMemo(
    () => (missions ?? []).find((mission) => mission.type === 'YOUTUBE_SUBSCRIPTION') ?? null,
    [missions],
  )
  // useAsync는 재조회 중 이전 data를 유지한다. Creator를 이동했을 때 이전 채널을 새 Space에 보이지 않게 응답의 소유 Creator를 확인한다.
  const currentYoutubeChannel = isYoutubeChannelForCreator(youtubeChannel.data, creatorId) ? youtubeChannel.data : null
  const goLogin = () => navigate('/login', { state: { from: location.pathname + location.search } })
  // 크리에이터인 경우에만 내 Space를 조회해 지금 보는 Space가 내 것인지 판별한다.
  const mySpace = useAsync(() => getMySpace(), [isCreator], { enabled: isCreator })
  const isMine = creatorId !== null && mySpace.data?.creatorId === creatorId
  // 내 게시글의 좋아요는 보상 대상이 아니므로(BE가 자기 Space의 좋아요 미션 보상을 주지 않는다) 내 Space에서는 좋아요 미션을 숨긴다.
  const shownLikeMissions = isMine ? [] : likeMissions

  const events = useMemo(() => creator?.events ?? [], [creator])
  const liveEvents = useMemo(
    () => events.filter((event) => event.displayStatus !== 'CLOSED'),
    [events],
  )
  const publishedEvent = useMemo(() => events.find((event) => event.status === 'PUBLISHED'), [events])

  const following = creatorId !== null && isFollowing(creatorId)

  // 다른 Creator로 이동하거나 화면을 떠나면 진행 중인 잔액 확인을 멈춘다.
  useEffect(() => () => {
    balanceSyncSeq.current += 1
  }, [creatorId])

  // 탭 제목을 인스타처럼 "이름 (@slug) • Cking"으로 보여주고, 떠날 때 원래 제목으로 되돌린다.
  const creatorName = creator?.creatorName
  const creatorSlug = creator?.slug
  useEffect(() => {
    if (!creatorName) return undefined
    const previous = document.title
    document.title = creatorSlug ? `${creatorName} (@${creatorSlug}) • Cking` : `${creatorName} • Cking`
    return () => {
      document.title = previous
    }
  }, [creatorName, creatorSlug])

  // 값이 없는 통계는 칸 자체를 숨긴다. 팔로워 수는 스페이스 조회 응답의 followerCount가 숫자일 때만 나타난다(0 포함).
  const profileStats = [
    typeof postTotal.data?.totalElements === 'number' && { label: '게시물', value: postTotal.data.totalElements },
    typeof creator?.followerCount === 'number' && { label: '팔로워', value: creator.followerCount },
    creator && !creator.eventsError && { label: '진행 이벤트', value: liveEvents.length },
  ].filter(Boolean)

  if (loading) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-safe">
        <LoadingBlock label="크리에이터 스페이스를 불러오는 중..." />
      </div>
    )
  }

  if (error || !creator) {
    const notFound = NOT_FOUND_MESSAGES[slugParam ? 'slug' : 'creator']
    return (
      <div className="flex flex-col w-full min-h-screen pt-safe justify-center">
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : (
          <div className="flex flex-col items-center gap-2 py-space-xl px-margin text-center" role="status">
            <MaterialIcon name={notFound.icon} className="text-[32px] text-outline" />
            <p className="font-title-md text-title-md font-semibold text-on-surface">{notFound.title}</p>
            {notFound.detail && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">{notFound.detail}</p>
            )}
          </div>
        )}
        <Link to="/" className="text-center text-primary font-label-md text-label-md font-semibold">
          홈으로 돌아가기
        </Link>
      </div>
    )
  }

  /**
   * 팔로워 수는 BE가 스페이스를 조회할 때 세므로, 팔로우 변경이 성공하면 그 값만 다시 받아 반영한다.
   * 실패해도 팔로우 결과는 이미 반영됐으니 조용히 넘기고, 늦게 도착한 이전 응답이나 다른 스페이스의 응답은 버린다.
   */
  async function refreshFollowerCount(targetId) {
    const seq = ++followerRefreshSeq.current
    try {
      const latest = await getCreatorSpace(targetId)
      if (followerRefreshSeq.current !== seq || typeof latest?.followerCount !== 'number') return
      setCreator((current) => (current?.creatorId === targetId ? { ...current, followerCount: latest.followerCount } : current))
    } catch {
      // 다음 조회 때 바로잡힌다.
    }
  }

  async function handleFollow() {
    if (!authenticated) {
      goLogin()
      return
    }
    if (isMine) return
    try {
      const result = await toggleFollow(creator.creatorId)
      if (result) {
        showToast(result.following ? `${creator.creatorName} 관심 등록 완료! 💖` : '관심 크리에이터에서 해제되었습니다.')
        refreshFollowerCount(creator.creatorId)
      }
    } catch (followError) {
      showToast(describeError(followError, '관심 상태를 변경하지 못했어요.'), { icon: 'error' })
    }
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

  /**
   * 스페이스 편집의 저장 결과를 화면 상태에 반영한다. 저장은 프로필·주소·활동명을 따로 하고 서로 겹칠 수 있어서,
   * 응답에 담긴 필드만 지금 상태 위에 병합한다(요청 당시의 전체 값으로 교체하면 먼저 끝난 다른 저장을 되돌린다).
   */
  function handleSpaceSaved(updated) {
    mySpace.setData((current) => ({ ...current, ...updated }))
    setCreator((current) => (current ? { ...current, ...updated } : current))
    // 공유 링크로 들어온 화면에서 slug를 바꾸면 이전 주소는 더 이상 열리지 않으므로 새 주소로 옮긴다.
    if (slugParam && updated.slug !== undefined && updated.slug !== slugParam) {
      navigate(spacePath(updated.slug), { replace: true })
    }
  }

  // 좋아요 미션은 서버가 게시글 좋아요를 확인해야 완료로 인정하므로 완료 API를 호출하지 않고 게시글로 안내한다.
  function goLikePosts() {
    setTab('posts')
    showToast('게시글에 좋아요를 누르면 미션이 완료돼요.')
  }

  /**
   * 적립은 Redis에서 먼저 접수되고 DB 잔액은 비동기로 반영되므로, 응답 직후 조회한 잔액은 이전 값일 수 있다.
   * 잔액이 (적립 전 잔액 + 보상액) 이상이 된 것이 확인될 때까지 몇 번 다시 조회한다. 끝까지 확인되지 않으면 적립 중이라고 알린다.
   * 적립 전 잔액(before)을 모르면(첫 조회가 끝나지 않았거나 실패) 반영 여부를 판단할 수 없으므로 증가로 멈추지 않고
   * 정해진 횟수만큼 화면 잔액만 갱신하다가, 그동안 본 잔액보다 늘어난 것을 확인하면 반영된 것으로 본다.
   * 어느 쪽이든 끝까지 확인하지 못하면 잔액 줄에 '반영 중' 표시와 다시 확인 버튼을 남긴다.
   */
  async function syncBalanceAfterEarn(targetId, before, reward) {
    const seq = ++balanceSyncSeq.current
    setBalancePending(null)
    const expected = typeof before === 'number' ? before + (reward > 0 ? reward : 1) : null
    let seen = typeof before === 'number' ? before : null
    for (const delay of BALANCE_SYNC_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      if (balanceSyncSeq.current !== seq) return
      try {
        const latest = await getTicketBalance(targetId)
        if (balanceSyncSeq.current !== seq) return
        balance.setData(latest)
        if (isEarnReflected(latest.balance, expected, seen)) return
        seen = latest.balance
      } catch {
        // 다음 시도에서 다시 확인한다.
      }
    }
    if (balanceSyncSeq.current === seq) setBalancePending({ creatorId: targetId, expected, seen })
  }

  // 잔액 줄의 '다시 확인': 한 번 조회한다. 반영이 확인되면 표시를 거두고, 아니면 최신 잔액만 보여 주고 표시를 유지한다.
  async function recheckBalance() {
    const pending = balancePending
    if (!pending || balanceRechecking) return
    const seq = balanceSyncSeq.current
    setBalanceRechecking(true)
    try {
      const latest = await getTicketBalance(pending.creatorId)
      // 확인하는 사이 다른 Creator로 이동했거나 새 적립 확인이 시작됐으면 이 응답은 버린다.
      if (balanceSyncSeq.current !== seq) return
      balance.setData(latest)
      if (isEarnReflected(latest.balance, pending.expected, pending.seen)) {
        setBalancePending(null)
      } else {
        setBalancePending({ ...pending, seen: latest.balance })
        showToast('아직 반영 중이에요. 잠시 뒤 다시 확인해주세요.')
      }
    } catch (recheckError) {
      if (balanceSyncSeq.current === seq) showToast(describeError(recheckError, '응모권 잔액을 불러오지 못했어요.'), { icon: 'error' })
    } finally {
      setBalanceRechecking(false)
    }
  }

  // 게시글 좋아요 응답의 missionAwarded가 true일 때: 미션 완료 표시를 바꾸고 잔액이 반영될 때까지 확인한다.
  function handleLikeMissionAwarded() {
    const reward = likeMissions[0]?.rewardAmount
    setMissions((current) => (current ?? []).map((item) => (item.type === 'LIKE' ? { ...item, completedToday: true } : item)))
    showToast(reward ? `좋아요 미션 완료! 응모권 ${reward}장을 적립하고 있어요.` : '좋아요 미션 완료! 응모권을 적립하고 있어요.')
    // 잔액 데이터가 다른 Creator의 것이면(이동 직후 재조회 전) 적립 전 잔액으로 쓰지 않는다.
    const before = balance.data?.creatorId === creator.creatorId ? balance.data.balance : undefined
    syncBalanceAfterEarn(creator.creatorId, before, reward)
  }

  // 관심 등록·편집·공유 버튼 행. 좁은 화면에서는 소개 아래에 가로로 꽉 차게, md 이상에서는 이름 옆에 놓는다.
  const actions = (
    <div className="flex items-center gap-space-xs">
      <button
        type="button"
        onClick={handleFollow}
        disabled={isMine || (authenticated && (!followsReady || pendingFollowIds.has(creator.creatorId) || (isCreator && !mySpace.data)))}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed md:flex-none md:px-5 ${
          following || isMine ? 'bg-surface-container-highest text-on-surface' : 'bg-primary text-on-primary'
        }`}
      >
        <MaterialIcon name={following ? 'check' : 'add'} filled={following} className="text-[18px]" />
        <span className="font-label-md text-label-md font-semibold">{isMine ? '내 스페이스' : pendingFollowIds.has(creator.creatorId) ? '처리 중...' : following ? '관심 중' : '관심 등록'}</span>
      </button>
      {isMine && (
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-container-highest py-2 text-on-surface transition-all active:scale-95 md:flex-none md:px-5"
        >
          <MaterialIcon name="edit" className="text-[18px]" />
          <span className="font-label-md text-label-md font-semibold">스페이스 편집</span>
        </button>
      )}
      {isMine && (
        <button
          type="button"
          onClick={() => setYoutubeChannelSettingsOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-container-highest py-2 text-on-surface transition-all active:scale-95 md:flex-none md:px-5"
        >
          <MaterialIcon name="subscriptions" className="text-[18px]" />
          <span className="font-label-md text-label-md font-semibold">YouTube 채널</span>
        </button>
      )}
      <button
        type="button"
        aria-label="공유하기"
        onClick={handleShare}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface transition-all active:scale-95"
      >
        <MaterialIcon name="share" className="text-[20px]" />
      </button>
    </div>
  )

  const loginPrompt = (message) => (
    <div className="flex items-center justify-between gap-3 p-space-md rounded-xl bg-surface-container-low">
      <span className="font-body-sm text-body-sm text-on-surface-variant">{message}</span>
      <button
        type="button"
        onClick={goLogin}
        className="shrink-0 px-3 py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm font-semibold active:scale-95 transition-all"
      >
        로그인
      </button>
    </div>
  )

  // SHARE는 공유 행동 검증 UI가 연결되기 전까지 숨긴다. YouTube 구독 인증은 채널이 설정된 경우에만 별도로 노출한다.
  const missionList = sessionLoading ? <LoadingBlock label="로그인 상태를 확인하는 중..." /> : anonymous ? loginPrompt('로그인하면 미션에 참여하고 응모권을 모을 수 있어요.') : (
    <>
      {missionsLoading && <LoadingBlock label="오늘의 미션을 불러오는 중..." />}
      {!missionsLoading && missionsError && <ErrorBlock message={missionsError} onRetry={reloadMissions} />}
      {!missionsLoading && !missionsError && shownLikeMissions.map((mission) => {
        const completed = mission.completedToday
        return (
          <div key={mission.missionId} className="flex items-center justify-between gap-3 p-space-md rounded-xl bg-surface-container-lowest shadow-card">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-container-high text-primary">
                <MaterialIcon name="favorite" filled className="text-[22px]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-md text-label-md text-on-surface font-semibold">좋아요 미션</span>
                <span className="text-secondary font-label-xs text-label-xs">🎟 응모권 +{mission.rewardAmount}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={completed}
              onClick={goLikePosts}
              className={`shrink-0 px-3 py-2 rounded-lg font-label-sm text-label-sm transition-all active:scale-95 disabled:opacity-60 ${completed ? 'bg-surface-container-high text-outline' : 'bg-berry-tint text-primary'}`}
            >
              {completed ? '완료' : '좋아요 하러 가기'}
            </button>
          </div>
        )
      })}
      {!missionsLoading && !missionsError && youtubeSubscriptionMission && youtubeChannel.loading && (
        <LoadingBlock label="YouTube 인증 채널을 확인하는 중..." />
      )}
      {!missionsLoading && !missionsError && youtubeSubscriptionMission && !youtubeChannel.loading && youtubeChannel.error && (
        <ErrorBlock message={youtubeChannel.error} onRetry={youtubeChannel.reload} />
      )}
      {!missionsLoading && !missionsError && youtubeSubscriptionMission && !youtubeChannel.loading && !youtubeChannel.error && currentYoutubeChannel && (
        <YoutubeSubscriptionMissionCard
          key={`${creator.creatorId}:${youtubeSubscriptionMission.missionId}`}
          creatorId={creator.creatorId}
          mission={youtubeSubscriptionMission}
          channel={currentYoutubeChannel}
          onRewarded={balance.reload}
        />
      )}
      {!missionsLoading && !missionsError && shownLikeMissions.length === 0 && !youtubeSubscriptionMission && (
        <EmptyBlock icon="bolt" message={EMPTY_TAB_MESSAGE} />
      )}
    </>
  )

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-24">
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-50 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 px-margin md:px-8 flex items-center justify-between gap-space-xs">
          <div className="flex items-center gap-space-xs min-w-0">
            <BackButton onClick={goBack} />
            <h1 className="font-title-md text-title-md text-on-surface font-semibold truncate">{creator.creatorName}</h1>
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

      <div className="pt-14 flex flex-col w-full md:mx-auto md:max-w-[935px]">
        <FollowStatus />
        {/* 좁은 화면: 아바타·통계 → 이름·소개 → 버튼 행. md 이상: 왼쪽 큰 아바타, 오른쪽에 이름+버튼 / 통계 / 소개를 쌓는다(인스타 웹). */}
        <section className="flex flex-col gap-space-sm px-margin pt-space-md md:grid md:grid-cols-[auto_minmax(0,1fr)] md:gap-x-16 md:gap-y-4 md:px-8 md:pb-6 md:pt-10">
          <div className="flex items-center gap-space-lg md:contents">
            <div className="h-20 w-20 shrink-0 rounded-full border border-surface-container-high bg-surface-container p-0.5 md:col-start-1 md:row-span-3 md:row-start-1 md:mx-6 md:h-36 md:w-36 md:p-1">
              <img className="h-full w-full rounded-full object-cover" src={creator.profileImageUrl} alt={creator.creatorName} />
            </div>
            <dl className="flex flex-1 justify-around text-center md:col-start-2 md:row-start-2 md:flex-none md:justify-start md:gap-10 md:text-left">
              {profileStats.map((stat) => (
                <div key={stat.label} className="flex flex-col md:flex-row md:items-baseline md:gap-1.5">
                  <dd className="font-title-md text-title-md font-bold text-on-surface">{formatNumber(stat.value)}</dd>
                  <dt className="font-label-sm text-label-sm font-normal text-on-surface-variant md:text-body-md">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex flex-col gap-0.5 md:contents">
            <div className="flex items-center gap-1 md:col-start-2 md:row-start-1 md:gap-5">
              <span className="flex items-center gap-1">
                <span className="font-title-md text-title-md font-bold text-on-surface md:text-xl">{creator.creatorName}</span>
                <MaterialIcon name="verified" filled className="text-[16px] text-primary md:text-[18px]" />
              </span>
              <div className="hidden md:flex md:items-center md:gap-space-xs">{actions}</div>
            </div>
            <div className="md:col-start-2 md:row-start-3">
              <span className="block font-label-xs text-label-xs text-outline">@{creator.slug}</span>
              <ProfileIntro text={creator.introText} />
            </div>
          </div>
          <div className="md:hidden">{actions}</div>
        </section>

        {/* 탭이 늘어나도 좁은 화면에서 가로로 스크롤되는 밑줄 탭(유튜브 채널·위버스 방식). */}
        <div className="mt-space-md sticky top-14 z-40 bg-surface/95 backdrop-blur-xl border-b border-surface-container-high">
          <div role="tablist" aria-label="스페이스 탭" className="flex gap-6 px-margin overflow-x-auto no-scrollbar md:justify-center md:gap-12">
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
            {anonymous && loginPrompt(`로그인하면 ${creator.creatorName} 전용 응모권을 확인하고 이벤트에 응모할 수 있어요.`)}
            {authenticated && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-space-md py-3">
                <span className="min-w-0 font-label-md text-label-md font-semibold text-on-surface">
                  🎟 {creator.creatorName} 응모권 {formatNumber(ticketBalance)}장
                  {balancePending?.creatorId === creator.creatorId && (
                    <span className="ml-1.5 inline-flex items-center gap-1 font-label-xs text-label-xs font-normal text-on-surface-variant">
                      적립 반영 중
                      <button
                        type="button"
                        onClick={recheckBalance}
                        disabled={balanceRechecking}
                        className="text-primary underline disabled:opacity-60"
                      >
                        {balanceRechecking ? '확인 중...' : '다시 확인'}
                      </button>
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setLedgerOpen(true)}
                  className="flex shrink-0 items-center gap-0.5 font-label-sm text-label-sm text-primary"
                >
                  내역
                  <MaterialIcon name="chevron_right" className="text-[16px]" />
                </button>
              </div>
            )}

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
                {!creator.eventsError && (
                  <span className="font-label-xs text-label-xs text-primary font-semibold">
                    총 {liveEvents.length}개 진행중
                  </span>
                )}
              </div>
              {creator.eventsError ? (
                <ErrorBlock message="이벤트를 불러오지 못했어요." onRetry={reload} />
              ) : liveEvents.length > 0 ? (
                <div className="flex gap-space-md overflow-x-auto px-margin no-scrollbar snap-x snap-mandatory py-1">
                  {liveEvents.map((event) => (
                    <EventCard key={event.eventId} event={event} ticketsOwned={ticketBalance} />
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

        {tab === 'quiz' && (
          <CreatorQuizzes
            key={`${creator.creatorId}:${user?.memberId ?? 'anonymous'}`}
            creatorId={creator.creatorId}
            authenticated={authenticated}
            sessionLoading={sessionLoading}
            isMine={isMine}
            onLogin={goLogin}
            onRewardPaid={balance.reload}
          />
        )}

        {tab === 'calendar' && <CreatorCalendar creatorId={creator.creatorId} isMine={isMine} />}

        {tab === 'posts' && sessionLoading && <LoadingBlock label="로그인 상태를 확인하는 중..." />}

        {tab === 'posts' && !sessionLoading && (
          <CreatorPosts
            key={`${creator.creatorId}:${user?.memberId ?? 'anonymous'}:${authenticated}:${following}:${isMine}`}
            onPostCountChange={postTotal.reload}
            onMissionAwarded={handleLikeMissionAwarded}
            creatorId={creator.creatorId}
            creatorName={creator.creatorName}
            profileImageUrl={creator.profileImageUrl}
            authenticated={authenticated}
            following={following}
            isMine={isMine}
            memberId={user?.memberId ?? null}
            followDisabled={authenticated && !following && (!followsReady || pendingFollowIds.has(creator.creatorId) || (isCreator && !mySpace.data))}
            onFollow={handleFollow}
            onLogin={goLogin}
          />
        )}

        {tab === 'events' && (
          <div className="flex flex-col gap-space-md px-margin py-space-sm">
            {isMine ? (
              <MyEventManager />
            ) : creator.eventsError ? (
              <ErrorBlock message="이벤트를 불러오지 못했어요." onRetry={reload} />
            ) : events.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
                {events.map((event) => (
                  <EventCard key={event.eventId} event={event} variant="list" ticketsOwned={ticketBalance} />
                ))}
              </div>
            ) : (
              <EmptyBlock icon="event_busy" message={EMPTY_TAB_MESSAGE} />
            )}
          </div>
        )}
      </div>

      {authenticated && (
        <TicketLedgerSheet
          open={ledgerOpen}
          onClose={() => setLedgerOpen(false)}
          creatorId={creator.creatorId}
          creatorName={creator.creatorName}
          balance={ticketBalance}
        />
      )}
      {isMine && (
        <SpaceEditSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          space={mySpace.data}
          onSaved={handleSpaceSaved}
        />
      )}
      {isMine && (
        <YoutubeChannelSheet
          open={youtubeChannelSettingsOpen}
          onClose={() => {
            setYoutubeChannelSettingsOpen(false)
            youtubeChannel.reload()
            reloadMissions()
          }}
        />
      )}
    </div>
  )
}
