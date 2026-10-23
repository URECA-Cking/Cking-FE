import CreatorVerifiedBadge from '../components/ui/CreatorVerifiedBadge.jsx'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import ProfilePhoto from '../components/ui/ProfilePhoto.jsx'
import SpaceHeaderBackdrop from '../components/creator/SpaceHeaderBackdrop.jsx'
import BackButton from '../components/ui/BackButton.jsx'
import { MyProfileLink } from '../components/layout/TopHeader.jsx'
import { useAppBack } from '../hooks/useAppBack.js'
import EventCard from '../components/creator/EventCard.jsx'
import CreatorPosts from '../components/creator/CreatorPosts.jsx'
import CreatorQuizzes from '../components/creator/CreatorQuizzes.jsx'
import MyCommentBlocks from '../components/creator/MyCommentBlocks.jsx'
import MyEventManager from '../components/creator/MyEventManager.jsx'
import MyQuizManager from '../components/creator/MyQuizManager.jsx'
import SpaceEditSheet from '../components/creator/SpaceEditSheet.jsx'
import CreatorCalendar, { UpcomingSchedules } from '../components/creator/CreatorCalendar.jsx'
import TicketLedgerSheet from '../components/ticket/TicketLedgerSheet.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useMyTickets } from '../context/useMyTickets.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { loadCreatorSpace } from '../api/creators.js'
import { getCreatorSpace, getMySpace, spacePath, spaceShareUrl } from '../api/creatorSpace.js'
import { completeShareMission, getCreatorMissions } from '../api/missions.js'
import { getCreatorYoutubeChannel } from '../api/subscriptionVerification.js'
import { getTicketBalance } from '../api/tickets.js'
import { markCreatorPostsRead } from '../api/follows.js'
import { ApiError, describeError, newRequestId } from '../api/client.js'
import { formatNumber } from '../utils/format.js'
import FollowStatus from '../components/creator/FollowStatus.jsx'
import YoutubeChannelSheet from '../components/creator/YoutubeChannelSheet.jsx'
import YoutubeSubscriptionMissionCard from '../components/creator/YoutubeSubscriptionMissionCard.jsx'
import { isYoutubeChannelForCreator } from '../utils/subscriptionVerificationState.js'
import { canRequestShareReward, requestShareReward } from '../utils/shareMission.js'

// 탭은 항상 노출하고, 내용이 없으면 탭별 빈 상태 문구를 보여준다(Cking-BE #290).
// 순서: 응모권을 모으는 미션과 응모하는 이벤트를 앞에, 캘린더 일정(추첨 이벤트와 별개)과 게시물을 뒤에 둔다.
const TABS = [
  { id: 'home', label: '홈' },
  { id: 'missions', label: '미션' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'events', label: '이벤트' },
  { id: 'calendar', label: '캘린더' },
  { id: 'posts', label: '게시물' },
]
// 내 스페이스에서만 보이는 탭. 다른 사람의 스페이스에서는 목록에 넣지 않는다.
const MY_SPACE_ONLY_TABS = [{ id: 'blocks', label: '차단 관리' }]
const EMPTY_EVENTS_MESSAGE = '이벤트 준비 중이에요!'
const EMPTY_MISSIONS_MESSAGE = '미션 준비 중이에요!'

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
 * 로그인 사용자만: 응모권 잔액(GET /api/creators/{id}/tickets)·내역, LIKE·SHARE(공유 완료, 본인 Space 제외)·YouTube 구독 인증 미션 참여,
 * 관심 등록, 본인 편집. 비로그인이면 이 영역에 로그인 안내를 보여준다.
 * 캘린더 탭·홈의 다가오는 일정은 GET /api/creators/{id}/calendar/schedules(추첨 이벤트와 별개인 크리에이터 일정)를 쓴다.
 * 게시물 탭은 공개 Post API로 조회하며 팔로워 공개 게시글은 권한에 따라 잠금 상태로 표시한다.
 * 홈은 마감되지 않은 이벤트를 미리 보여주고, 이벤트 탭은 종료된 이벤트와 공개 결과로 이어지는 카드를 유지한다.
 * 내 Space면(GET /api/creator/space의 creatorId가 같으면) 편집할 수 있고, 이벤트 탭에서 이벤트를,
 * 캘린더 탭에서 일정을 관리한다(예전 크리에이터 스튜디오 기능). Quiz 탭에서는 AI Quiz를 만들고 검토·게시한다.
 */
// 좋아요 미션 적립 뒤 잔액을 다시 확인하는 간격(ms). 합계 약 10초.
const BALANCE_SYNC_DELAYS_MS = [500, 1500, 3000, 5000]
// 공유 보상 DUPLICATE_MISSION 뒤 서버의 완료 기록을 확인하는 간격(ms). 완료 기록은 비동기로 남는다.
const SHARE_CONFIRM_DELAYS_MS = [500, 1500, 3000]

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
  const { refresh: refreshMyTickets } = useMyTickets() // 좋아요 미션 적립 뒤 헤더의 총 응모권 개수를 갱신한다
  const location = useLocation()
  const { user, status, isCreator, isFollowing, toggleFollow, followsReady, pendingFollowIds } = useUser()
  const authenticated = status === 'authenticated'
  const sessionLoading = status === 'loading'
  // 로그인 상태를 복원하는 동안(loading)에는 로그인 안내를 띄우지 않아 로그인 사용자에게 깜빡이지 않게 한다.
  const anonymous = status === 'anonymous'

  // 현재 탭을 방문 기록 항목에 보관해 상세 화면에서 돌아올 때 마지막 선택을 복원한다.
  const tab = location.state?.tab ?? 'home'
  const [ledgerOpen, setLedgerOpen] = useState(false)
  // 미션 적립이 접수됐지만 잔액 반영을 확인하지 못했을 때: { creatorId, expected }. expected는 반영됐다고 볼 잔액이고,
  // 적립 전 잔액을 몰라 숫자로 판단할 수 없으면 null이다(이때는 적립 내역에서 확인하도록 안내한다).
  const [balancePending, setBalancePending] = useState(null)
  const [balanceRechecking, setBalanceRechecking] = useState(false)
  const followerRefreshSeq = useRef(0)
  const balanceSyncSeq = useRef(0)
  // 공유 보상 요청이 진행 중이면 다시 보내지 않는다. 승인 불명 requestId는 utils/shareAttempts.js가 저장소에 보관한다.
  const shareRewarding = useRef(false)
  const [editOpen, setEditOpen] = useState(false)
  const [youtubeChannelSettingsOpen, setYoutubeChannelSettingsOpen] = useState(false)

  const { data: loaded, loading, error, reload, setData: setCreator } = useAsync(
    () => loadSpaceOrNotFound({ creatorId: creatorIdParam, slug: slugParam }),
    [creatorIdParam, slugParam],
    { fallbackMessage: '크리에이터 정보를 불러오지 못했습니다.' },
  )
  const creator = useMemo(() => (loaded?.notFound ? null : loaded), [loaded])
  const creatorId = creator?.creatorId ?? null

  const memberId = user?.memberId ?? null
  // 인증이 필요한 데이터는 로그인 상태가 확인된 뒤에만 조회한다(비로그인 공유 링크 열람 지원).
  // 잔액과 미션 완료 여부는 요청한 회원의 기록이다. 같은 화면에서 로그인 회원이 바뀌어도 이전 회원의 값이 새 회원에게 보이지 않도록
  // 조회한 회원·크리에이터 번호를 결과에 함께 보관하고, 지금 회원·크리에이터의 것일 때만 data로 내보낸다.
  const personalEnabled = authenticated && creatorId !== null && memberId !== null
  const balanceLoad = useAsync(
    async () => ({ memberId, creatorId, balance: await getTicketBalance(creatorId) }),
    [creatorId, authenticated, memberId],
    { enabled: personalEnabled, fallbackMessage: '응모권 잔액을 불러오지 못했어요.' },
  )
  // 자식 컴포넌트가 이 함수를 효과 의존성에 넣으므로 회원이나 조회가 바뀔 때만 새로 만든다. 늦게 도착한 이전 회원의 응답은 결과로 돌려주지 않는다.
  const loadBalance = balanceLoad.reload
  const reloadBalance = useCallback(async () => {
    const result = await loadBalance()
    return result?.memberId === memberId ? result.balance : null
  }, [loadBalance, memberId])
  const balance = {
    ...balanceLoad,
    data: balanceLoad.data?.memberId === memberId && balanceLoad.data.creatorId === creatorId ? balanceLoad.data.balance : null,
    reload: reloadBalance,
  }
  const missionsLoad = useAsync(
    async () => ({ memberId, creatorId, missions: await getCreatorMissions(creatorId) }),
    [creatorId, authenticated, memberId],
    { enabled: personalEnabled, fallbackMessage: '오늘의 미션을 불러오지 못했어요.' },
  )
  const missionsOwned = missionsLoad.data?.memberId === memberId && missionsLoad.data.creatorId === creatorId
  const missions = missionsOwned ? missionsLoad.data.missions : null
  // 회원이나 크리에이터가 바뀐 직후 새 조회가 시작되기 전의 한 번의 그리기에서도 빈 목록 안내가 깜빡이지 않게 조회 중으로 본다.
  const missionsLoading = missionsLoad.loading || (personalEnabled && !missionsOwned && !missionsLoad.error)
  const missionsError = missionsLoad.error
  const reloadMissions = missionsLoad.reload
  const setMissions = (update) => missionsLoad.setData((current) => (
    current ? { ...current, missions: typeof update === 'function' ? update(current.missions) : update } : current
  ))
  const [shareRewardBusy, setShareRewardBusy] = useState(false)
  // DUPLICATE_MISSION을 받아 서버의 완료 기록을 확인하는 중인 { memberId, creatorId }. 서버가 완료로 확인하기 전에는 "완료"로 바꾸지 않는다.
  const [shareChecking, setShareChecking] = useState(null)
  const ticketBalance = balance.data?.balance ?? 0
  const likeMissions = useMemo(() => (missions ?? []).filter((mission) => mission.type === 'LIKE'), [missions])
  const shareMission = useMemo(() => (missions ?? []).find((mission) => mission.type === 'SHARE') ?? null, [missions])
  const youtubeSubscriptionMission = useMemo(
    () => (missions ?? []).find((mission) => mission.type === 'YOUTUBE_SUBSCRIPTION') ?? null,
    [missions],
  )
  // 채널 설정 시 생성되는 구독 인증 미션이 있는 경우에만 공개 채널을 조회한다.
  // 채널 미설정 Creator의 Space를 열 때마다 409을 발생시키거나 재시도하지 않는다.
  const youtubeChannel = useAsync(
    async () => {
      try {
        return await getCreatorYoutubeChannel(creatorId)
      } catch (channelError) {
        // 데이터가 불일치해 미션만 남은 경우에는 카드를 숨긴다. 자동 재시도는 하지 않는다.
        if (channelError instanceof ApiError && channelError.code === 'CREATOR_CHANNEL_NOT_CONFIGURED') return null
        throw channelError
      }
    },
    [creatorId, youtubeSubscriptionMission?.missionId],
    { enabled: youtubeSubscriptionMission !== null },
  )
  // useAsync는 재조회 중 이전 data를 유지한다. Creator를 이동했을 때 이전 채널을 새 Space에 보이지 않게 응답의 소유 Creator를 확인한다.
  const currentYoutubeChannel = isYoutubeChannelForCreator(youtubeChannel.data, creatorId) ? youtubeChannel.data : null
  const goLogin = () => navigate('/login', { state: { from: location.pathname + location.search } })
  /** 홈에서 넘어온 openPostId를 한 번 쓴 뒤 지워, 새로고침·뒤로 가기에서 상세가 다시 열리지 않게 한다. */
  function clearOpenPostId() {
    navigate(location.pathname + location.search + location.hash, {
      replace: true,
      state: { ...location.state, openPostId: null },
      preventScrollReset: true,
    })
  }
  /** 탭 선택을 현재 방문 기록에 반영해 상세 화면과 브라우저 뒤로 가기에서 같은 탭으로 돌아온다. */
  function selectTab(nextTab) {
    navigate(location.pathname + location.search + location.hash, {
      replace: true,
      state: { ...location.state, tab: nextTab },
      preventScrollReset: true,
    })
  }
  // 크리에이터인 경우에만 내 Space를 조회해 지금 보는 Space가 내 것인지 판별한다.
  // 같은 화면에서 크리에이터 계정이 바뀌어도 이전 회원의 Space로 본인 여부를 판단하지 않도록 조회한 회원 번호를 함께 보관하고,
  // 현재 회원의 것일 때만 data로 내보낸다. 새 회원의 조회가 끝나기 전에는 data가 null이라 본인 여부를 모르는 상태가 된다.
  const mySpaceLoad = useAsync(
    async () => ({ memberId, space: await getMySpace() }),
    [isCreator, memberId],
    { enabled: isCreator && memberId !== null },
  )
  const mySpace = {
    ...mySpaceLoad,
    data: mySpaceLoad.data?.memberId === memberId ? mySpaceLoad.data.space : null,
    setData: (update) => mySpaceLoad.setData((current) => (
      current ? { ...current, space: typeof update === 'function' ? update(current.space) : update } : current
    )),
  }
  const isMine = creatorId !== null && mySpace.data?.creatorId === creatorId
  // 마이페이지·오류 안내가 "스페이스 편집을 열어 달라"고 보낸 경우(OPEN_SPACE_EDIT_STATE) 내 스페이스에서 시트를 연다.
  // 요청은 시트를 여는 순간 한 번 쓰고 지운다(clearOpenPostId와 같은 방식): 새로고침이나 뒤로 가기에서 다시 열리지 않고,
  // 시트가 뒤로가기를 받으려고 쌓는 history 항목이 지워진 상태를 복사해 닫을 때 이동 상태를 다시 바꿀 필요가 없다.
  const openSpaceEditRequested = Boolean(location.state?.openSpaceEdit)
  useEffect(() => {
    if (!isMine || !openSpaceEditRequested) return
    setEditOpen(true)
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: { ...location.state, openSpaceEdit: false },
      preventScrollReset: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMine, openSpaceEditRequested])
  // 편집 시트에서 slug를 바꾸면 주소 이동은 시트를 닫은 뒤로 미룬다. 시트가 열려 있는 동안 replace하면 시트가 쌓은 history 항목이
  // 새 주소로 바뀌어, 닫을 때 되돌린 위치(이전 slug의 항목)로 돌아가 뒤로가기에서 더는 열리지 않는 주소가 나타난다.
  const pendingSlugRef = useRef(null)
  function closeSpaceEdit() {
    setEditOpen(false)
    const nextSlug = pendingSlugRef.current
    if (!nextSlug) return
    pendingSlugRef.current = null
    // 들어온 경로(/{slug} 또는 /space/{slug})를 그대로 기준으로 삼는다. 닫는 순간의 경로가 시트가 쌓은 항목이 있던 경로다.
    const enteredPath = window.location.pathname
    let timer = null
    const moveToNewSlug = () => {
      window.removeEventListener('popstate', moveToNewSlug)
      window.clearTimeout(timer)
      // 그 사이 다른 화면으로 옮겨 갔다면 건드리지 않는다.
      if (window.location.pathname === enteredPath) navigate(spacePath(nextSlug), { replace: true })
    }
    // 시트가 항목을 되돌리며 popstate를 내므로 그 뒤에 옮긴다. 되돌릴 항목이 없어 popstate가 오지 않는 경우를 위해 잠시 뒤에도 옮긴다.
    window.addEventListener('popstate', moveToNewSlug)
    timer = window.setTimeout(moveToNewSlug, 600)
  }
  // 내 게시글의 좋아요는 보상 대상이 아니므로(BE가 자기 Space의 좋아요 미션 보상을 주지 않는다) 내 Space에서는 좋아요 미션을 숨긴다.
  const shownLikeMissions = isMine ? [] : likeMissions
  // BE는 본인 Space 공유도 막지 않으므로 FE가 구분한다. 크리에이터는 내 Space 조회가 끝나야 본인 여부를 알 수 있다.
  const ownershipKnown = !isCreator || Boolean(mySpace.data)
  const shownShareMission = isMine || !ownershipKnown ? null : shareMission
  const shareUnconfirmed = shareChecking?.memberId === memberId && shareChecking?.creatorId === creatorId
    && Boolean(shownShareMission) && !shownShareMission.completedToday

  const events = useMemo(() => creator?.events ?? [], [creator])
  const liveEvents = useMemo(
    () => events.filter((event) => event.displayStatus !== 'CLOSED'),
    [events],
  )

  const following = creatorId !== null && isFollowing(creatorId)

  // 팔로우 중인 크리에이터의 스페이스를 열면 읽음으로 기록해 홈의 NEW가 사라지게 한다. 표시 힌트라 실패해도 화면에는 영향이 없다.
  useEffect(() => {
    if (!following || !authenticated || isMine) return
    markCreatorPostsRead(creatorId).catch(() => {})
  }, [creatorId, memberId, following, authenticated, isMine])

  // 다른 Creator로 이동하거나 로그인 회원이 바뀌거나 화면을 떠나면 진행 중인 잔액 확인을 멈춘다.
  useEffect(() => () => {
    balanceSyncSeq.current += 1
  }, [creatorId, memberId])

  // 공유 보상 응답이 늦게 도착했을 때 지금 보는 회원·Creator와 같은지 확인하기 위한 값이다.
  const viewedCreatorId = useRef(null)
  const viewedMemberId = useRef(null)
  // 비동기 보상 응답은 회원 전환 직후에도 도착할 수 있다. paint 전에 현재 대상을 반영해 이전 회원의 응답을 막는다.
  useLayoutEffect(() => {
    viewedCreatorId.current = creatorId
    viewedMemberId.current = memberId
  }, [creatorId, memberId])
  /** 요청을 보낸 회원·크리에이터가 지금 화면과 같은지. 다르면 늦게 온 응답을 화면에 반영하지 않는다. */
  const isViewing = (targetId, targetMemberId) => viewedCreatorId.current === targetId && viewedMemberId.current === targetMemberId

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


  // 홈 새 게시물 카드로 들어와 상세가 열리기 전까지는 스페이스 화면 대신 게시글 로딩만 보여 준다.
  const openingPost = location.state?.openPostId != null

  if (loading) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-safe">
        <LoadingBlock label={openingPost ? '게시글을 불러오는 중...' : '크리에이터 스페이스를 불러오는 중...'} />
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
        showToast(result.following ? `${creator.creatorName} 도킹 완료! 💖` : '도킹이 해제되었습니다.')
        refreshFollowerCount(creator.creatorId)
      }
    } catch (followError) {
      showToast(describeError(followError, '도킹 상태를 변경하지 못했어요.'), { icon: 'error' })
    }
  }

  /** 서버가 SHARE 완료를 확인했을 때: 카드를 완료로 바꾸고 잔액을 한 번 다시 읽는다(이번 호출로 늘어난 잔액이 없을 수 있어 기다리지 않는다). */
  function applyShareConfirmed() {
    setShareChecking(null)
    setMissions((current) => (current ?? []).map((item) => (item.type === 'SHARE' ? { ...item, completedToday: true } : item)))
    balance.reload()
    refreshMyTickets()
  }

  /**
   * DUPLICATE_MISSION은 이미 승인됐다는 뜻이 아니다(이전 요청이 승인 전이어도 같은 응답이 나온다). 그래서 미션 목록을 다시 읽어
   * 서버가 SHARE를 완료로 기록했을 때만 완료로 바꾼다. 완료 기록은 비동기로 남으므로 짧은 간격으로 몇 번 확인하고,
   * 끝까지 확인하지 못하면 "적립 확인 중" 상태로 두고 사용자가 다시 확인하게 한다. 조회는 목록 로딩 표시 없이 직접 한다.
   * @returns 서버가 완료로 확인했으면 true
   */
  async function confirmShareCompletion(targetId, targetMemberId, delays) {
    setShareChecking({ memberId: targetMemberId, creatorId: targetId })
    for (const delay of delays) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
      if (!isViewing(targetId, targetMemberId)) return false
      try {
        const latest = await getCreatorMissions(targetId)
        if (!isViewing(targetId, targetMemberId)) return false
        if ((latest ?? []).some((item) => item.type === 'SHARE' && item.completedToday)) {
          applyShareConfirmed()
          return true
        }
      } catch {
        // 조회에 실패하면 다음 확인에서 다시 시도한다.
      }
    }
    return false
  }

  // "적립 확인 중" 카드의 다시 확인: 서버의 완료 기록을 한 번 읽는다.
  async function recheckShare() {
    if (shareRewarding.current) return
    shareRewarding.current = true
    setShareRewardBusy(true)
    try {
      const confirmed = await confirmShareCompletion(creator.creatorId, memberId, [0])
      if (confirmed) showToast('공유 미션 완료가 확인됐어요.')
      else showToast('아직 적립이 확인되지 않았어요. 잠시 뒤 다시 확인해주세요.')
    } finally {
      shareRewarding.current = false
      setShareRewardBusy(false)
    }
  }

  /**
   * 공유가 끝났을 때(공유 시트 완료 또는 링크 복사) SHARE 미션 보상을 요청한다. 서버는 실제 공유 여부를 검증하지 않는다.
   * 이미 받았거나 본인 Space이거나 비로그인이거나 본인 여부를 아직 모르면 요청하지 않는다.
   * 승인 여부를 모르는 실패의 requestId는 회원·크리에이터별로 저장소에 남아 다음 공유에서 같은 값으로 재시도한다.
   */
  async function rewardShare(copied) {
    if (shareRewarding.current) return
    if (!canRequestShareReward({ authenticated, memberId, isMine, ownershipKnown, mission: shareMission })) {
      if (copied) showToast('공유 링크를 복사했어요.')
      return
    }
    const targetId = creator.creatorId
    const targetMemberId = memberId
    shareRewarding.current = true
    setShareRewardBusy(true)
    try {
      const result = await requestShareReward({
        memberId: targetMemberId,
        creatorId: targetId,
        complete: completeShareMission,
        newId: newRequestId,
      })
      // 요청 중에 다른 Creator로 이동했거나 로그인 회원이 바뀌었으면 이 결과를 화면에 반영하지 않는다.
      if (!isViewing(targetId, targetMemberId)) return
      if (copied) showToast('공유 링크를 복사했어요.')
      if (result.status === 'failed') {
        showToast(describeError(result.error, '공유 미션 보상을 받지 못했어요. 다시 공유해 주세요.'), { icon: 'error' })
        return
      }
      if (result.status === 'unconfirmed') {
        const confirmed = await confirmShareCompletion(targetId, targetMemberId, SHARE_CONFIRM_DELAYS_MS)
        if (confirmed) showToast('공유 미션 완료가 확인됐어요.')
        else if (isViewing(targetId, targetMemberId)) showToast('적립 여부를 확인하고 있어요. 잠시 뒤 다시 확인해주세요.')
        return
      }
      setMissions((current) => (current ?? []).map((item) => (item.type === 'SHARE' ? { ...item, completedToday: true } : item)))
      if (result.status === 'done') {
        // 같은 requestId 재전송(ALREADY_PROCESSED)은 서버가 이미 승인한 요청이라 이번 호출로 늘어난 잔액이 없을 수 있다.
        // "보상액만큼 늘어날 때까지"를 기다리지 않고 현재 잔액만 한 번 다시 읽는다.
        balance.reload()
        refreshMyTickets()
        return
      }
      const reward = result.rewardAmount ?? shareMission?.rewardAmount
      showToast(reward ? `공유 미션 완료! 응모권 ${reward}장을 적립하고 있어요.` : '공유 미션 완료! 응모권을 적립하고 있어요.')
      const before = balance.data?.creatorId === targetId ? balance.data.balance : undefined
      syncBalanceAfterEarn(targetId, before, reward)
      refreshMyTickets()
    } finally {
      shareRewarding.current = false
      setShareRewardBusy(false)
    }
  }

  async function handleShare() {
    const url = spaceShareUrl(creator.slug)
    try {
      if (navigator.share) {
        await navigator.share({ title: `${creator.creatorName} | Cking`, url })
        await rewardShare(false)
        return
      }
      await navigator.clipboard.writeText(url)
    } catch (shareError) {
      // 사용자가 공유 시트를 닫은 경우(AbortError)는 알림도 보상도 없다.
      if (shareError?.name !== 'AbortError') showToast('공유할 수 없는 환경이에요.', { icon: 'error' })
      return
    }
    await rewardShare(true)
  }

  /**
   * 스페이스 편집의 저장 결과를 화면 상태에 반영한다. 저장은 프로필·주소·활동명을 따로 하고 서로 겹칠 수 있어서,
   * 응답에 담긴 필드만 지금 상태 위에 병합한다(요청 당시의 전체 값으로 교체하면 먼저 끝난 다른 저장을 되돌린다).
   */
  function handleSpaceSaved(updated) {
    mySpace.setData((current) => ({ ...current, ...updated }))
    setCreator((current) => (current ? { ...current, ...updated } : current))
    // 공유 링크로 들어온 화면에서 slug를 바꾸면 이전 주소는 더 이상 열리지 않으므로 새 주소로 옮긴다.
    if (slugParam && updated.slug !== undefined) {
      if (updated.slug === slugParam) pendingSlugRef.current = null // 원래 주소로 되돌렸으면 예약해 둔 이동도 없앤다.
      else if (editOpen) pendingSlugRef.current = updated.slug
      else navigate(spacePath(updated.slug), { replace: true })
    }
  }

  // 좋아요 미션은 서버가 게시글 좋아요를 확인해야 완료로 인정하므로 완료 API를 호출하지 않고 게시글로 안내한다.
  function goLikePosts() {
    selectTab('posts')
    showToast('게시글에 좋아요를 누르면 미션이 완료돼요.')
  }

  /**
   * 적립은 Redis에서 먼저 접수되고 DB 잔액은 비동기로 반영되므로, 응답 직후 조회한 잔액은 이전 값일 수 있다.
   * 잔액 조회는 일반 조회와 같은 useAsync의 reload로 해서, 나중에 시작한 요청이 이기고 오래된 응답은 버려지게 한다.
   * 잔액이 (적립 전 잔액 + 보상액) 이상이 된 것이 확인될 때까지 몇 번 다시 조회하고, 끝까지 확인하지 못하면 잔액 줄에
   * '반영 중' 표시와 다시 확인 버튼을 남긴다.
   * 적립 전 잔액(before)을 모르면(첫 조회가 끝나지 않았거나 실패) 숫자만으로는 반영 여부를 알 수 없다. 그동안 본 잔액보다
   * 늘어나면 반영된 것으로 보고, 아니면 적립 내역에서 확인하도록 안내만 남긴다.
   */
  async function syncBalanceAfterEarn(targetId, before, reward) {
    const seq = ++balanceSyncSeq.current
    setBalancePending(null)
    const expected = typeof before === 'number' ? before + (reward > 0 ? reward : 1) : null
    let seen = typeof before === 'number' ? before : null
    for (const delay of BALANCE_SYNC_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      if (balanceSyncSeq.current !== seq) return
      const latest = await balance.reload()
      if (balanceSyncSeq.current !== seq) return
      if (latest?.creatorId !== targetId) continue
      if (isEarnReflected(latest.balance, expected, seen)) return
      seen = latest.balance
    }
    if (balanceSyncSeq.current === seq) setBalancePending({ creatorId: targetId, expected })
  }

  // 잔액 줄의 '다시 확인'(적립 전 잔액을 알았던 경우): 한 번 조회해 반영이 확인되면 표시를 거두고, 아니면 표시를 유지한다.
  async function recheckBalance() {
    const pending = balancePending
    if (!pending || pending.expected === null || balanceRechecking) return
    const seq = balanceSyncSeq.current
    setBalanceRechecking(true)
    try {
      const latest = await balance.reload()
      // 확인하는 사이 다른 Creator로 이동했거나 새 적립 확인이 시작됐으면 이 응답은 쓰지 않는다.
      if (balanceSyncSeq.current !== seq) return
      if (latest?.creatorId !== pending.creatorId) {
        showToast('응모권 잔액을 불러오지 못했어요.', { icon: 'error' })
      } else if (latest.balance >= pending.expected) {
        setBalancePending(null)
      } else {
        showToast('아직 반영 중이에요. 잠시 뒤 다시 확인해주세요.')
      }
    } finally {
      setBalanceRechecking(false)
    }
  }

  // 잔액 반영을 숫자로 확인할 수 없는 경우: 적립 내역을 열고 안내는 거둔다.
  function openLedgerFromPending() {
    setBalancePending(null)
    setLedgerOpen(true)
  }

  // 게시글 좋아요 응답의 missionAwarded가 true일 때: 미션 완료 표시를 바꾸고 잔액이 반영될 때까지 확인한다.
  function handleLikeMissionAwarded() {
    // useAsync는 재조회 중 이전 data를 유지하고 미션 응답에는 creatorId가 없으므로, 조회 중에는 보상액을 쓰지 않는다.
    const reward = missionsLoading ? undefined : likeMissions[0]?.rewardAmount
    setMissions((current) => (current ?? []).map((item) => (item.type === 'LIKE' ? { ...item, completedToday: true } : item)))
    showToast(reward ? `좋아요 미션 완료! 응모권 ${reward}장을 적립하고 있어요.` : '좋아요 미션 완료! 응모권을 적립하고 있어요.')
    // 잔액 데이터가 다른 Creator의 것이면(이동 직후 재조회 전) 적립 전 잔액으로 쓰지 않는다.
    const before = balance.data?.creatorId === creator.creatorId ? balance.data.balance : undefined
    syncBalanceAfterEarn(creator.creatorId, before, reward)
    refreshMyTickets()
  }

  // 팬에게는 관심 등록과 공유를, 본인에게는 편집·채널 설정·공유를 같은 자리에서 제공한다.
  const actions = (
    <div className="flex items-center gap-space-xs">
      {!isMine && (
        <button
          type="button"
          onClick={handleFollow}
          disabled={authenticated && (!followsReady || pendingFollowIds.has(creator.creatorId) || (isCreator && !mySpace.data))}
          className={`flex h-11 w-[calc((100%-3.25rem)/2)] shrink-0 items-center justify-center gap-1.5 rounded-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:flex-none md:px-5 ${
            following ? 'bg-surface-container-highest text-on-surface' : 'bg-primary text-on-primary'
          }`}
        >
          <MaterialIcon name={following ? 'check' : 'add'} filled={following} className="text-[18px]" />
          <span className="font-label-md text-label-md font-semibold">{pendingFollowIds.has(creator.creatorId) ? '처리 중...' : following ? '도킹 중' : '도킹'}</span>
        </button>
      )}
      {isMine && (
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-container-highest px-2.5 text-on-surface transition-all active:scale-95 md:flex-none md:px-5"
        >
          <MaterialIcon name="edit" className="text-[18px]" />
          <span className="whitespace-nowrap font-label-md text-label-md font-semibold">스페이스 편집</span>
        </button>
      )}
      {isMine && (
        <button
          type="button"
          onClick={() => setYoutubeChannelSettingsOpen(true)}
          className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-container-highest px-2.5 text-on-surface transition-all active:scale-95 md:flex-none md:px-5"
        >
          <MaterialIcon name="subscriptions" className="text-[18px]" />
          <span className="whitespace-nowrap font-label-md text-label-md font-semibold">YouTube 채널</span>
        </button>
      )}
      <button
        type="button"
        aria-label="공유하기"
        onClick={handleShare}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface transition-all active:scale-95"
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

  // SHARE는 본인 Space에서는 숨기고(BE가 막지 않아 FE가 구분), YouTube 구독 인증은 채널이 설정된 경우에만 별도로 노출한다.
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
              </div>
            </div>
            <button
              type="button"
              disabled={completed}
              onClick={goLikePosts}
              className={`shrink-0 px-3 py-2 rounded-lg font-label-sm text-label-sm transition-all active:scale-95 disabled:opacity-60 ${completed ? 'bg-surface-container-high text-outline' : 'bg-berry-tint text-primary'}`}
            >
              {completed ? '완료' : `${mission.rewardAmount}장`}
            </button>
          </div>
        )
      })}
      {!missionsLoading && !missionsError && shownShareMission && (
        <div className="flex items-center justify-between gap-3 p-space-md rounded-xl bg-surface-container-lowest shadow-card">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-container-high text-primary">
              <MaterialIcon name="share" filled className="text-[22px]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md text-on-surface font-semibold">공유 미션</span>
              <span className="text-secondary font-label-xs text-label-xs">{shareUnconfirmed ? '적립을 확인하고 있어요' : '한 번만 받을 수 있어요'}</span>
            </div>
          </div>
          <button
            type="button"
            disabled={shownShareMission.completedToday || shareRewardBusy}
            onClick={shareUnconfirmed ? recheckShare : handleShare}
            className={`shrink-0 px-3 py-2 rounded-lg font-label-sm text-label-sm transition-all active:scale-95 disabled:opacity-60 ${shownShareMission.completedToday ? 'bg-surface-container-high text-outline' : 'bg-berry-tint text-primary'}`}
          >
            {shownShareMission.completedToday ? '완료' : shareRewardBusy ? '처리 중...' : shareUnconfirmed ? '다시 확인' : `${shownShareMission.rewardAmount}장`}
          </button>
        </div>
      )}
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
      {!missionsLoading && !missionsError && shownLikeMissions.length === 0 && !shownShareMission && !youtubeSubscriptionMission && (
        <EmptyBlock icon="bolt" message={EMPTY_MISSIONS_MESSAGE} />
      )}
    </>
  )

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-24">
      {/* 게시글 상세(z-60)는 이 덮개 위에 뜨고, 상세가 열리면 openPostId가 지워져 덮개도 사라진다. */}
      {openingPost && tab === 'posts' && (
        <div className="fixed inset-0 z-[55] flex flex-col bg-surface pt-safe">
          <LoadingBlock label="게시글을 불러오는 중..." />
        </div>
      )}
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
            <MyProfileLink />
          </div>
        </div>
      </header>

      <div className="pt-14 flex flex-col w-full md:mx-auto md:max-w-[935px]">
        <FollowStatus />
        {/* 배너를 배경으로 깔고 그 위에 올린다. 좁은 화면: 아바타 → 이름·소개 → 버튼 행. md 이상: 왼쪽 큰 아바타, 오른쪽에 이름+버튼 / 소개를 쌓는다(인스타 웹). */}
        <div className="relative">
        <SpaceHeaderBackdrop src={creator.bannerImageUrl} />
        <section className="relative flex flex-col gap-space-sm px-margin pb-space-sm pt-space-lg md:grid md:grid-cols-[auto_minmax(0,1fr)] md:gap-x-16 md:gap-y-4 md:px-8 md:pb-6 md:pt-10">
          <div className="flex items-center gap-space-lg md:contents">
            <div className="h-20 w-20 shrink-0 rounded-full border border-white p-px md:col-start-1 md:row-span-2 md:row-start-1 md:mx-6 md:h-36 md:w-36 md:p-0.5">
              <ProfilePhoto src={creator.profileImageUrl} className="h-full w-full" iconClassName="text-[40px] md:text-[72px]" />
            </div>
          </div>
          <div className="flex flex-col gap-0.5 md:contents">
            <div className="flex items-center gap-1 md:col-start-2 md:row-start-1 md:gap-5">
              <span className="flex items-center gap-1">
                <span className="font-title-md text-title-md font-bold text-on-surface md:text-xl">{creator.creatorName}</span>
                <CreatorVerifiedBadge />
              </span>
              <div className="hidden md:flex md:items-center md:gap-space-xs">{actions}</div>
            </div>
            <div className="md:col-start-2 md:row-start-2">
              <span className="block font-label-xs text-label-xs text-outline">@{creator.slug}</span>
              <ProfileIntro text={creator.introText} />
            </div>
          </div>
          <div className="md:hidden">{actions}</div>
        </section>
        </div>

        {/* 탭이 늘어나도 좁은 화면에서 가로로 스크롤되는 밑줄 탭(유튜브 채널·위버스 방식). */}
        <div className="mt-space-md sticky top-14 z-40 bg-surface/95 backdrop-blur-xl border-b border-surface-container-high">
          <div role="tablist" aria-label="스페이스 탭" className="flex gap-6 px-margin overflow-x-auto no-scrollbar md:justify-center md:gap-12">
            {(isMine ? [...TABS, ...MY_SPACE_ONLY_TABS] : TABS).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => selectTab(item.id)}
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
                <div className="flex min-w-0 items-center gap-space-sm">
                  <MaterialIcon name="confirmation_number" className="shrink-0 text-primary text-[24px]" />
                  <div className="min-w-0">
                    <p className="truncate font-label-xs text-label-xs text-on-surface-variant">{creator.creatorName} 응모권</p>
                    <p data-clarity-mask="True" className="font-title-md text-title-md font-extrabold text-primary">{formatNumber(ticketBalance)}장</p>
                  {balancePending?.creatorId === creator.creatorId && (
                    <span className="mt-0.5 inline-flex items-center gap-1 font-label-xs text-label-xs font-normal text-on-surface-variant">
                      {balancePending.expected === null ? '적립을 접수했어요' : '적립 반영 중'}
                      {balancePending.expected === null ? (
                        <button type="button" onClick={openLedgerFromPending} className="text-primary underline">
                          내역 보기
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={recheckBalance}
                          disabled={balanceRechecking}
                          className="text-primary underline disabled:opacity-60"
                        >
                          {balanceRechecking ? '확인 중...' : '다시 확인'}
                        </button>
                      )}
                    </span>
                  )}
                  </div>
                </div>
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

            <UpcomingSchedules creatorId={creator.creatorId} onShowAll={() => selectTab('calendar')} />

            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {/* bolt는 글자 폭이 좁아 같은 20px로는 옆 헤더 아이콘보다 작고 왼쪽으로 쏠려 보여, 22px로 키우고 20px 칸 안에서 가운데로 맞춘다. */}
                  <span className="flex h-5 w-5 items-center justify-center"><MaterialIcon name="bolt" className="text-primary text-[22px]" /></span>
                  <h2 className="font-title-md text-title-md text-on-surface">오늘의 미션</h2>
                </div>
                <span className="font-label-xs text-label-xs text-on-surface-variant">좋아요 미션은 매일 00:00 갱신</span>
              </div>
              {missionList}
            </div>

            <div className="flex flex-col gap-space-sm -mx-margin">
              <div className="flex items-center justify-between px-margin">
                <div className="flex items-center gap-1.5">
                  <MaterialIcon name="local_activity" className="text-tertiary text-[20px]" />
                  <h2 className="font-title-md text-title-md text-on-surface">진행 중 이벤트</h2>
                </div>
              </div>
              {creator.eventsError ? (
                <ErrorBlock message="이벤트를 불러오지 못했어요." onRetry={reload} />
              ) : liveEvents.length > 0 ? (
                <div className="flex gap-space-md overflow-x-auto px-margin no-scrollbar snap-x snap-mandatory py-1">
                  {liveEvents.map((event, index) => (
                    // 앞의 두 장은 진입하자마자 보이므로 배너를 바로 받는다. 나머지는 가로로 넘길 때 받는다.
                    <EventCard key={event.eventId} event={event} priority={index < 2} />
                  ))}
                </div>
              ) : (
                <EmptyBlock icon="event_busy" message={EMPTY_EVENTS_MESSAGE} />
              )}
            </div>
          </div>
        )}

        {tab === 'missions' && (
          <div className="flex flex-col gap-space-sm px-margin py-space-sm">{missionList}</div>
        )}

        {tab === 'quiz' && isMine && (
          <MyQuizManager key={`${creator.creatorId}:${user?.memberId ?? 'anonymous'}`} creatorId={creator.creatorId} />
        )}

        {tab === 'quiz' && !isMine && (
          <CreatorQuizzes
            key={`${creator.creatorId}:${user?.memberId ?? 'anonymous'}`}
            creatorId={creator.creatorId}
            memberId={user?.memberId ?? null}
            authenticated={authenticated}
            sessionLoading={sessionLoading}
            isMine={isMine}
            onLogin={goLogin}
            onRewardPaid={balance.reload}
          />
        )}

        {tab === 'blocks' && isMine && <MyCommentBlocks />}

        {tab === 'calendar' && <CreatorCalendar creatorId={creator.creatorId} isMine={isMine} />}

        {tab === 'posts' && sessionLoading && <LoadingBlock label="로그인 상태를 확인하는 중..." />}

        {tab === 'posts' && !sessionLoading && (
          <CreatorPosts
            key={`${creator.creatorId}:${user?.memberId ?? 'anonymous'}:${authenticated}:${following}:${isMine}`}
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
            initialPostId={location.state?.openPostId ?? null}
            onInitialPostOpened={clearOpenPostId}
            onLeaveToOrigin={goBack}
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
                  <EventCard key={event.eventId} event={event} variant="list" />
                ))}
              </div>
            ) : (
              <EmptyBlock icon="event_busy" message={EMPTY_EVENTS_MESSAGE} />
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
          onClose={closeSpaceEdit}
          closeOnBack
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
