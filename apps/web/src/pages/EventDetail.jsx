import CreatorVerifiedBadge from '../components/ui/CreatorVerifiedBadge.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import BottomSheet from '../components/ui/BottomSheet.jsx'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import { LoadingBlock, ErrorBlock, StatusPill, Spinner } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useMyTickets } from '../context/useMyTickets.js'
import { useAsync } from '../hooks/useAsync.js'
import { useEntryStatus } from '../hooks/useEntryStatus.js'
import { getEvent } from '../api/events.js'
import { applyEntry, describeEntryResult } from '../api/entries.js'
import { requiresSameRequestRetry, restorePendingEntryAttempt } from '../utils/entryResult.js'
import { useProfileSetupRedirect } from '../hooks/useProfileSetupRedirect.js'
import { useOwnCreatorId } from '../hooks/useOwnCreatorId.js'
import { getPublicWinners } from '../api/winners.js'
import { getMyWinners } from '../api/myWinners.js'
import { newRequestId } from '../api/client.js'
import { getEventBanner } from '../data/eventBanners.js'
import { useCreatorProfile } from '../hooks/useCreatorProfile.js'
import { formatDday, formatEventDate, formatNumber, totalPrizeQuantity } from '../utils/format.js'
import { displayStatusMeta, eventStatusMeta, isEntryOpen } from '../utils/eventStatus.js'
import {
  COUPON_TYPE,
  EXPECTED_SYNC_MS,
  EXPECTED_TTL_MS,
  applyExpectedBalances,
  clampEntryCount,
  entryLimit,
  expectedValues,
  planEntry,
  pruneExpected,
  resolveCouponType,
  ticketBalances,
} from '../utils/entryTickets.js'

const COUPON_LABEL = { [COUPON_TYPE.CREATOR]: '크리에이터 응모권', [COUPON_TYPE.COMMON]: '공용 응모권' }

/**
 * 이벤트(래플) 상세 · 응모 화면 (시안 _6 + bottom_sheet).
 *
 * 응모는 POST /api/events/{eventId}/entries 를 멱등키(requestId, UUID)와 함께 보내고,
 * 백엔드가 돌려주는 결과 코드 10종을 그대로 해석해 사용자에게 알린다.
 * 같은 응모 시도에서는 requestId를 유지해 재시도가 중복 차감으로 이어지지 않게 한다.
 */
export default function EventDetail() {
  const { eventId } = useParams()
  const showToast = useToast()
  const redirectToProfileSetup = useProfileSetupRedirect()
  const { refresh: refreshMyTickets } = useMyTickets() // 응모하면 헤더의 총 응모권 개수도 바뀌어야 한다
  // 크리에이터는 내 스페이스를 불러와야 이 이벤트가 내 것인지 안다. 알 수 없는 동안에는 응모를 막는다.
  // 불러오는 중(ownSpaceLoading)이면 확인 중으로, 실패했으면(ownSpaceError) 다시 확인할 수 있게 따로 안내한다.
  const { ownCreatorId, ownSpacePending, ownSpaceError, reloadOwnSpace } = useOwnCreatorId()
  const ownSpaceLoading = ownSpacePending && !ownSpaceError

  const [ticketCount, setTicketCount] = useState(1)
  const [chosenType, setChosenType] = useState(null) // 사용자가 고른 응모권 종류. 고른 적 없으면 null
  // 응모가 수락된 종류의 "응모 후 예상 잔액"({ 종류: { value, at } }). DB 반영이 늦어 서버가 옛 값을 줘도 바로 차감된
  // 값을 보여 주려는 것이다. 서버가 따라잡거나 시간이 지나면 해제한다(syncBalances).
  const [expected, setExpected] = useState({ eventId: null, entries: {} })
  const [attempt, setAttempt] = useState(null) // 확인 시트를 연 시점에 확정한 응모 내용 { couponType, count, balance }
  const [opening, setOpening] = useState(false) // 응모 확인 시트를 열기 전 최신 잔액을 불러오는 중(버튼 표시용)
  const openingRef = useRef(false) // 같은 순간에 여러 번 눌려도 한 번만 처리하려는 잠금(state는 다음 렌더에야 바뀐다)
  const [sheetOpen, setSheetOpen] = useState(false)
  const confirmationRef = useRef(null)
  const prizeDragRef = useRef(null)
  useEffect(() => {
    const dialog = confirmationRef.current
    if (sheetOpen) dialog?.showModal()
    else dialog?.close()
  }, [sheetOpen])
  const [selectionOpen, setSelectionOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const [phase, setPhase] = useState('idle') // idle | submitting | done
  const [result, setResult] = useState(null)
  const [requestId, setRequestId] = useState(() => newRequestId())
  // 네트워크/서버 오류는 서버가 이미 응모를 수락했을 가능성이 있다. 시트를 닫아도 같은
  // requestId·내용으로 다시 확인할 수 있게 현재 이벤트의 미확정 요청을 남겨 둔다.
  const [pendingEntry, setPendingEntry] = useState(null)

  const { data: event, loading, error, reload, setData: setEvent } = useAsync(
    () => getEvent(eventId),
    [eventId],
    { fallbackMessage: '이벤트 상세를 불러오지 못했습니다.' },
  )

  // 예정 이벤트는 응모가 없어 조회하지 않는다. 진행 중이면 주기적으로 다시 받는다. 응모는 submitEntry가
  // beginEntry·acceptEntry로 알리고, 수락된 응모가 현황에 반영될 때까지 현황을 숨기고 다시 조회한다.
  // 이벤트 상세를 조용히 다시 받는 것(syncBalances)은 시트를 열 때나 지연 재조회에서도 일어나 응모와 무관하다.
  const entryStatus = useEntryStatus(eventId, {
    enabled: Boolean(event) && event.displayStatus !== 'UPCOMING',
    live: event?.displayStatus === 'IN_PROGRESS',
  })

  // 응모 뒤 잔액을 조용히 다시 불러온다(화면 전체를 로딩 상태로 바꾸는 reload와 달리 시트와 입력을 그대로 둔다).
  // 불러온 서버 잔액으로 서버가 차감을 반영한 종류, 또는 오래된 예상 값을 해제한다. 그래야 다른 곳에서 응모권이
  // 늘어도 옛 예상 값이 계속 상한으로 남지 않는다.
  // 불러온 최신 이벤트를 돌려준다(조회에 실패하면 null).
  async function syncBalances() {
    try {
      const fresh = await getEvent(eventId)
      // 그 사이 다른 이벤트 화면으로 바뀌었으면(같은 컴포넌트가 다른 eventId로 재사용될 때) 예전 이벤트로 덮어쓰지 않는다.
      setEvent((current) => (current && String(current.eventId) === String(fresh?.eventId) ? fresh : current))
      setExpected((prev) => {
        if (prev.eventId !== eventId) return prev
        const entries = pruneExpected(prev.entries, ticketBalances(fresh), Date.now())
        return Object.keys(entries).length === Object.keys(prev.entries).length ? prev : { ...prev, entries }
      })
      return fresh
    } catch {
      // 조회에 실패해도 예상 값은 시간이 지나 다음 조회에서 해제된다. 화면은 마지막으로 불러온 값을 그대로 보여 준다.
      return null
    }
  }

  const published = event?.status === 'PUBLISHED'
  const winners = useAsync(() => getPublicWinners(eventId), [eventId, published], {
    enabled: Boolean(published),
    fallbackMessage: '당첨자 목록을 불러오지 못했습니다.',
  })
  // 공개 당첨자 목록에는 회원 식별자가 없어(마스킹된 이름·전화번호만), 내 당첨 목록의 winnerId로 "나의 당첨"을 판별한다.
  const myWinners = useAsync(() => getMyWinners(), [published], {
    enabled: Boolean(published),
    fallbackMessage: '내 당첨 정보를 불러오지 못했습니다.',
  })
  // 조회 중이거나 실패하면 null(판별 불가)로 두어, 본인 당첨을 다른 당첨자로 확정해 보여주지 않는다.
  const myWinnerIds = useMemo(() => {
    if (myWinners.loading || myWinners.error || !Array.isArray(myWinners.data)) return null
    return new Set(myWinners.data.map((winner) => winner.winnerId))
  }, [myWinners.loading, myWinners.error, myWinners.data])

  // 응모권은 크리에이터 전용과 공용 두 종류다. 이벤트 상세 응답이 두 잔액을 함께 내려준다.
  // 크리에이터 응모권은 이벤트(크리에이터)마다 달라서 예상 잔액은 같은 이벤트에서만 쓴다.
  const balances = applyExpectedBalances(
    ticketBalances(event),
    expected.eventId === eventId ? expectedValues(expected.entries) : null,
  )
  const couponType = resolveCouponType(balances, chosenType)
  const balance = balances[couponType]
  const limit = entryLimit(balance) // 한 번에 고를 수 있는 최대 장수: min(잔액, 100)
  const hasAnyTicket = balances[COUPON_TYPE.CREATOR] > 0 || balances[COUPON_TYPE.COMMON] > 0
  const creator = useCreatorProfile(event?.creatorId)
  const prizeCount = totalPrizeQuantity(event?.prizes)
  const endTime = new Date(event?.endAt).getTime()
  const remaining = Number.isFinite(endTime) ? Math.max(0, Math.ceil((endTime - now) / 1000)) : null
  const deadlinePassed = remaining === 0
  // 본인이 만든 이벤트에는 응모할 수 없다(BE가 막지 않아 FE가 구분한다).
  const isOwnEvent = ownCreatorId != null && event != null && Number(event.creatorId) === Number(ownCreatorId)
  const canApply = isEntryOpen(event) && hasAnyTicket && !deadlinePassed && !isOwnEvent && !ownSpacePending
  // 응모 버튼의 글자. 본인 이벤트이면 이유를 알 수 있게 따로 안내한다.
  const applyLabel = canApply
    ? '응모하기'
    : isOwnEvent && isEntryOpen(event)
      ? '내 이벤트에는 응모할 수 없어요'
      : '응모할 수 없는 상태예요'
  // 응모 성공으로 잔액이 줄어들 수 있으므로, 실제로 쓸 수량은 렌더 시점에 한도 범위로 맞춘다.
  const selectedCount = clampEntryCount(ticketCount, balance)

  if (loading) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-safe">
        <BackHeader title="" />
        <LoadingBlock label="이벤트를 불러오는 중..." />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-safe justify-center gap-3">
        <ErrorBlock message={error ?? '이벤트를 찾을 수 없어요.'} onRetry={reload} />
        <Link to="/" className="text-center text-primary font-label-md text-label-md font-semibold">
          홈으로 돌아가기
        </Link>
      </div>
    )
  }

  const status = displayStatusMeta(event.displayStatus)
  const statusDetail = eventStatusMeta(event.status)
  const closed = event.displayStatus === 'CLOSED'
  const dday = formatDday(event.endAt, { closed })

  function finishPrizeDrag(event) {
    if (prizeDragRef.current?.id !== event.pointerId) return
    prizeDragRef.current = null
    event.currentTarget.style.scrollSnapType = ''
    event.currentTarget.style.cursor = ''
  }

  function adjust(delta) {
    setTicketCount(Math.min(limit, Math.max(1, selectedCount + delta)))
  }

  function quickAdd(amount) {
    setTicketCount(Math.min(limit, selectedCount + amount))
  }

  function chooseCouponType(type) {
    if (balances[type] <= 0) return
    setChosenType(type)
    // 다른 종류의 잔액에 맞춰 수량이 한도를 넘지 않게 다시 맞춘다.
    setTicketCount((count) => clampEntryCount(count, balances[type]))
  }

  async function openConfirm() {
    if (openingRef.current) return
    if (isOwnEvent) {
      showToast('내가 만든 이벤트에는 응모할 수 없어요.', { icon: 'error' })
      return
    }
    // 응답 유실 뒤 시트를 닫았다가 다시 연 경우에는 새 요청을 만들지 않는다. 같은
    // requestId 재전송만이 서버의 멱등 처리(DUPLICATE_REPLAY)를 보장한다.
    const restored = restorePendingEntryAttempt(pendingEntry, eventId)
    if (restored) {
      setAttempt(restored.attempt)
      setRequestId(restored.requestId)
      setResult(restored.outcome)
      setPhase('done')
      setSelectionOpen(false)
      setSheetOpen(true)
      return
    }

    if (!isEntryOpen(event) || deadlinePassed) {
      showToast('지금은 응모할 수 있는 상태가 아니에요.', { icon: 'error' })
      return
    }

    openingRef.current = true
    setOpening(true)
    try {
      // 화면을 열어 둔 사이 다른 곳에서 응모권이 바뀌었을 수 있어, 응모 직전에 최신 잔액을 불러와 그 값으로 확정한다.
      // 조회에 실패하면 지금 화면의 값으로 진행한다.
      const fresh = await syncBalances()
      const source = fresh ?? event
      if (!isEntryOpen(source)) {
        showToast('지금은 응모할 수 있는 상태가 아니에요.', { icon: 'error' })
        return
      }
      const entries = expected.eventId === eventId ? expected.entries : {}
      const plan = planEntry(source, entries, chosenType, ticketCount)
      if (!plan) {
        showToast('보유한 응모권이 없어 응모할 수 없어요.', { icon: 'error' })
        return
      }
      // 시트를 열 때 종류·수량·그때의 잔액을 확정해 둔다. 응모 성공 뒤 잔액이 바뀌어도 시트 표시와
      // 재시도 요청(같은 requestId)이 달라지지 않게 하려는 것이다.
      setAttempt(plan)
      setPhase('idle')
      setResult(null)
      setRequestId(newRequestId())
      setSelectionOpen(false)
      setSheetOpen(true)
    } finally {
      openingRef.current = false
      setOpening(false)
    }
  }

  async function submitEntry() {
    if (!attempt) return
    const retrying = restorePendingEntryAttempt(pendingEntry, eventId)?.requestId === requestId
    if (!retrying && (!isEntryOpen(event) || Date.now() >= endTime)) {
      showToast('지금은 응모할 수 있는 상태가 아니에요.', { icon: 'error' })
      return
    }
    setPhase('submitting')
    // 응모 현황에 반영됐는지 확인할 필요 수치의 기준을 이 시점에 잡는다. 같은 requestId로 재시도하면 처음 기준을 유지한다.
    entryStatus.beginEntry(requestId, attempt.count)
    try {
      // 재시도해도 같은 requestId·종류·수량을 쓰므로 백엔드가 DUPLICATE_REPLAY로 안전하게 처리한다.
      const envelope = await applyEntry(eventId, {
        requestId,
        ticketCount: attempt.count,
        couponType: attempt.couponType,
      })
      // 닉네임을 설정하지 않은 회원은 응모할 수 없다. 응모 시트를 닫고 프로필 설정 화면으로 보낸다.
      if (redirectToProfileSetup(envelope)) {
        setPhase('idle')
        setSheetOpen(false)
        return
      }
      const outcome = describeEntryResult(envelope)
      setResult(outcome)
      setPhase('done')
      if (requiresSameRequestRetry(outcome)) {
        setPendingEntry({ eventId, requestId, attempt, outcome })
      } else {
        setPendingEntry(null)
      }
      // SUCCESS와 DUPLICATE_REPLAY 모두 원래 응모가 현황에 반영됐는지 확인해야 한다.
      if (outcome.accepted) entryStatus.acceptEntry(requestId)
      showToast(outcome.message, { icon: outcome.accepted ? 'check_circle' : 'error' })

      if (outcome.accepted) {
        // 이벤트를 다시 불러와도 DB 반영 전이면 서버가 옛 잔액을 줄 수 있어, 방금 쓴 만큼 뺀 값을 먼저 기억해 둔다.
        setExpected((prev) => ({
          eventId,
          entries: {
            ...(prev.eventId === eventId ? prev.entries : {}),
            [attempt.couponType]: { value: attempt.balance - attempt.count, at: Date.now() },
          },
        }))
        setSheetOpen(false)
        refreshMyTickets()
        await syncBalances()
        // DB 반영이 끝났을 즈음 한 번 더 불러와 서버가 따라잡은 예상 값을 일찍 해제하고, 시간 제한으로 해제되는 때에도
        // 한 번 더 불러와 그 사이 다른 곳에서 바뀐 잔액을 화면에 반영한다.
        setTimeout(syncBalances, EXPECTED_SYNC_MS)
        setTimeout(syncBalances, EXPECTED_TTL_MS + 500)
      }
    } catch (error) {
      // 네트워크 오류처럼 서버가 수락했는지 알 수 없는 경우에도 같은 requestId를 유지한다.
      // done 상태가 되면 기존 재시도 버튼이 다시 열리고, 다음 요청은 DUPLICATE_REPLAY로 안전하게 복구된다.
      const outcome = describeEntryResult(error)
      setResult(outcome)
      setPhase('done')
      if (requiresSameRequestRetry(outcome)) {
        setPendingEntry({ eventId, requestId, attempt, outcome })
      } else {
        setPendingEntry(null)
      }
      showToast(outcome.message, { icon: 'error' })
    }
  }

  // 확인 시트는 열 때 확정한 값을 보여 준다(시트를 열기 전에는 현재 선택값).

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-32">
      <BackHeader title="" />
      <div className="pt-14 flex flex-col w-full">
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-container">
          <img className="w-full h-full object-cover" src={getEventBanner(event.eventId)} alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-surface/90 via-slate-surface/20 to-transparent" />
          <div className="absolute top-space-md left-space-md flex flex-wrap items-center gap-space-xs">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-xs text-label-xs shadow-md ${status.tone}`}
            >
              {status.label} {!closed && dday}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-surface-glass backdrop-blur-md text-on-surface font-label-xs text-label-xs shadow-sm">
              {formatNumber(event.winnerCount)}명 추첨
            </span>
            {prizeCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-xs text-label-xs shadow-sm">
                <MaterialIcon name="stars" filled className="text-[13px]" />
                상품 {formatNumber(prizeCount)}개
              </span>
            )}
          </div>
        </div>

        <div className="px-space-md pt-space-lg flex flex-col gap-space-lg">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-1.5 text-primary">
              <Link
                to={`/creators/${event.creatorId}`}
                className="font-title-md text-title-md font-bold text-on-surface"
              >
                {creator.name}
              </Link>
              <CreatorVerifiedBadge />
              <StatusPill label={statusDetail.label} tone={statusDetail.tone} className="ml-auto" />
            </div>
            <h2 className="font-headline-md text-headline-md font-extrabold text-on-surface tracking-tight">
              {event.title}
            </h2>
            {event.description && (
              <p className="font-body-md text-body-md text-on-surface-variant pt-1 leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            )}
          </div>

          <section aria-label="내 응모" className="flex flex-wrap items-center justify-center gap-2 self-center w-fit max-w-full px-6 py-3 rounded-xl bg-surface-container-low text-primary font-title-md text-title-md font-bold">
            <span>내 응모</span>
            {entryStatus.status?.myTicketCount != null ? (
              <span>{formatNumber(entryStatus.status.myTicketCount)}장</span>
            ) : event.displayStatus === 'UPCOMING' ? (
              <span className="text-on-surface-variant text-body-sm">응모 시작 전</span>
            ) : entryStatus.failed ? (
              <>
                <span className="text-on-surface-variant text-body-sm">조회하지 못했어요.</span>
                <button type="button" onClick={entryStatus.retry} className="text-label-sm underline">다시 확인</button>
              </>
            ) : (
              <span className="text-on-surface-variant text-body-sm">확인 중...</span>
            )}
          </section>

          {remaining !== null && (
            <div className="rounded-2xl bg-surface-container-low p-space-lg text-center" role="timer" aria-label="이벤트 마감 카운트다운">
              <p className="font-label-md text-label-md text-on-surface-variant mb-3">{deadlinePassed || closed ? '응모 마감' : '마감까지'}</p>
              <div className="flex justify-center gap-3 text-primary tabular-nums">
                {[['일', Math.floor(remaining / 86400)], ['시간', Math.floor(remaining / 3600) % 24], ['분', Math.floor(remaining / 60) % 60], ['초', remaining % 60]].map(([label, value], index) => (
                  <div key={label} className="flex items-start gap-3">
                    {index > 0 && <span className="text-[28px] sm:text-[36px] leading-tight font-bold" aria-hidden="true">:</span>}
                    <div className="flex flex-col gap-1">
                      <span className="text-[36px] sm:text-[44px] leading-tight font-extrabold">{String(closed ? 0 : value).padStart(2, '0')}</span>
                      <span className="text-label-xs text-on-surface-variant">{label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <section aria-label="응모기간" className="p-space-md rounded-2xl bg-surface-container-low flex items-start justify-between gap-4">
            <h3 className="font-label-md text-label-md text-on-surface font-bold shrink-0">응모기간</h3>
            <div className="text-right font-body-sm text-body-sm text-on-surface-variant">
              <span>{formatEventDate(event.startAt).replace(/^\d{2,4}[.\-/년]\s*/, '')}</span>
              <span className="mx-1">~</span>
              <span>{formatEventDate(event.endAt).replace(/^\d{2,4}[.\-/년]\s*/, '')}</span>
            </div>
          </section>

          {/* 결과가 공개되면 아래 당첨 결과 카드가 안내를 대신하므로 "결과가 공개되면 알려드릴게요" 안내는 숨긴다. */}
          {!canApply && !published && (
            <div className="p-space-md rounded-2xl bg-surface-container-low flex items-start gap-space-sm">
              <MaterialIcon name="info" className="text-on-surface-variant text-body-sm leading-relaxed shrink-0" />
              <div className="flex flex-col gap-2">
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  {event.displayStatus === 'UPCOMING'
                    ? `아직 응모가 열리지 않았어요. ${formatEventDate(event.startAt)}에 시작됩니다.`
                    : closed
                      ? '응모가 마감된 이벤트예요. 결과가 공개되면 알림으로 알려드릴게요.'
                      : isOwnEvent
                        ? '내가 만든 이벤트에는 응모할 수 없어요.'
                        : ownSpaceLoading
                          ? '내 이벤트인지 확인하는 중이에요.'
                          : ownSpaceError
                            ? '내 이벤트인지 확인하지 못했어요.'
                            : '보유한 응모권이 없어 응모할 수 없어요.'}
                </p>
                {ownSpaceError && !isOwnEvent && isEntryOpen(event) && (
                  <button type="button" onClick={reloadOwnSpace} className="self-start text-label-sm underline text-on-surface-variant">다시 확인</button>
                )}
              </div>
            </div>
          )}

          {event.prizes?.length > 0 && (
            <section aria-label="이벤트 경품" aria-roledescription="캐러셀" className="p-space-md rounded-2xl bg-surface-container-low flex flex-col gap-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-title-md text-title-md font-bold text-on-surface">이벤트 경품</h3>
              </div>
              <ul
                tabIndex={0}
                aria-label="경품 목록"
                onPointerDown={(event) => {
                  if (event.pointerType !== 'mouse' || event.button !== 0) return
                  event.preventDefault()
                  event.currentTarget.focus()
                  prizeDragRef.current = { id: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft }
                  event.currentTarget.setPointerCapture(event.pointerId)
                  event.currentTarget.style.scrollSnapType = 'none'
                  event.currentTarget.style.cursor = 'grabbing'
                }}
                onPointerMove={(event) => {
                  const drag = prizeDragRef.current
                  if (drag?.id !== event.pointerId) return
                  event.currentTarget.scrollLeft = drag.left + drag.x - event.clientX
                }}
                onPointerUp={finishPrizeDrag}
                onPointerCancel={finishPrizeDrag}
                onLostPointerCapture={finishPrizeDrag}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 cursor-grab select-none"
              >
                {[...event.prizes].sort((a,b) => a.priority - b.priority).map((prize) => (
                  <li key={prize.prizeKey} className="p-4 rounded-xl bg-surface-container-lowest flex flex-col gap-2 shadow-sm basis-[55%] sm:basis-[35%] shrink-0 min-w-0 snap-start">
                    <MaterialIcon name="redeem" className="text-primary text-[28px]" />
                    {Number.isInteger(prize.priority) && <span className="font-label-sm text-label-sm text-primary font-bold">{prize.priority}등</span>}
                    <span className="font-label-md text-label-md font-bold text-on-surface break-words">{prize.displayName}</span>
                    <span className="font-label-xs text-label-xs text-slate-muted">{formatNumber(prize.quantity)}개</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {published && (
            <div className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-space-sm">
              <div className="flex items-center gap-1.5">
                <MaterialIcon name="emoji_events" filled className="text-gold-badge text-[20px]" />
                <h3 className="font-title-md text-title-md font-bold text-on-surface">당첨 결과</h3>
              </div>
              {winners.loading && <LoadingBlock label="당첨자를 불러오는 중..." />}
              {!winners.loading && winners.error && (
                <ErrorBlock message={winners.error} onRetry={winners.reload} />
              )}
              {!winners.loading && !winners.error && (winners.data?.winners ?? []).length === 0 && (
                <p className="font-body-sm text-body-sm text-on-surface-variant">아직 공개된 당첨자가 없어요.</p>
              )}
              {!winners.loading && (winners.data?.winners ?? []).length > 0 && myWinners.loading && (
                <p className="font-label-xs text-label-xs text-on-surface-variant">내 당첨 여부를 확인하는 중...</p>
              )}
              {!winners.loading && (winners.data?.winners ?? []).length > 0 && myWinners.error && (
                <div className="flex items-center justify-between gap-2 p-space-sm rounded-xl bg-surface-container-low">
                  <p className="font-label-xs text-label-xs text-on-surface-variant">내 당첨 여부를 확인하지 못했어요.</p>
                  <button
                    type="button"
                    onClick={myWinners.reload}
                    className="shrink-0 font-label-xs text-label-xs font-semibold text-primary"
                  >
                    다시 시도
                  </button>
                </div>
              )}
              {!winners.loading && (winners.data?.winners ?? []).length > 0 && (
                <ul className="flex flex-col gap-2">
                  {winners.data.winners.map((winner) => {
                    const mine = myWinnerIds?.has(winner.winnerId) ?? false
                    return (
                      <li
                        key={winner.winnerId}
                        className={`flex items-center gap-space-sm p-space-sm rounded-xl ${
                          mine ? 'bg-berry-tint border border-primary' : 'bg-surface-container-low'
                        }`}
                      >
                        <span className="w-8 h-8 rounded-full bg-surface-container-lowest flex items-center justify-center font-label-sm text-label-sm font-bold text-primary shrink-0">
                          {winner.rankInDrawing}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`font-label-md text-label-md font-semibold ${mine ? 'text-on-primary-fixed' : 'text-on-surface'} truncate`}>
                            {mine ? '나의 당첨 🎉' : winner.name}
                          </p>
                          <p className={`font-label-xs text-label-xs ${mine ? 'text-on-primary-fixed-variant' : 'text-on-surface-variant'} truncate`}>
                            {winner.prizeDisplayName ?? '상품 미지정'}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-40 bg-surface-glass backdrop-blur-2xl px-space-md pt-3 pb-6 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-label={applyLabel}
            onClick={() => pendingEntry ? openConfirm() : setSelectionOpen(true)}
            disabled={(!canApply && !restorePendingEntryAttempt(pendingEntry, eventId)) || opening}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary via-primary-container to-berry-glow text-on-primary font-title-md text-title-md font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <MaterialIcon name="confirmation_number" filled className="text-[20px]" />
            <span>{applyLabel}</span>
        </button>
        </div>
        </div>
      </div>

      <BottomSheet
        open={selectionOpen}
        onClose={opening ? undefined : () => setSelectionOpen(false)}
        title="응모하기"
      >
            <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-floating flex flex-col gap-space-lg relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-title-lg text-title-lg font-bold text-on-surface">사용할 응모권 수</h3>
                </div>
              </div>

              <div role="radiogroup" aria-label="사용할 응모권 종류" className="grid grid-cols-2 gap-2">
                {[COUPON_TYPE.CREATOR, COUPON_TYPE.COMMON].map((type) => {
                  const selected = couponType === type
                  const empty = balances[type] <= 0
                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={empty}
                      onClick={() => chooseCouponType(type)}
                      className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-left transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none ${
                        selected
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-surface-container border-transparent text-on-surface-variant'
                      }`}
                    >
                      <span className="font-label-sm text-label-sm font-semibold">{COUPON_LABEL[type]}</span>
                      <span className="font-label-md text-label-md font-bold">{formatNumber(balances[type])}장</span>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between bg-surface-container-low rounded-2xl p-2.5">
                <button
                  type="button"
                  aria-label="응모권 1장 감소"
                  disabled={selectedCount <= 1}
                  onClick={() => adjust(-1)}
                  className="w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface active:scale-90 transition-transform shadow-sm disabled:opacity-30 disabled:pointer-events-none"
                >
                  <MaterialIcon name="remove" className="text-[26px]" />
                </button>
                <div className="flex flex-col items-center justify-center px-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline-xl text-headline-xl font-extrabold text-primary tracking-tight">
                      {selectedCount}
                    </span>
                    <span className="font-title-md text-title-md font-bold text-primary">장</span>
                  </div>
                  <span className="font-label-xs text-label-xs text-slate-muted">선택 수량</span>
                </div>
                <button
                  type="button"
                  aria-label="응모권 1장 증가"
                  disabled={selectedCount >= limit}
                  onClick={() => adjust(1)}
                  className="w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary active:scale-90 transition-transform shadow-sm disabled:opacity-30 disabled:pointer-events-none"
                >
                  <MaterialIcon name="add" className="text-[26px]" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => quickAdd(1)}
                  className="py-2.5 rounded-xl bg-surface-container text-on-surface-variant font-label-md text-label-md font-semibold active:scale-95 hover:bg-berry-tint hover:text-primary transition-all"
                >
                  +1장
                </button>
                <button
                  type="button"
                  onClick={() => quickAdd(5)}
                  className="py-2.5 rounded-xl bg-surface-container text-on-surface-variant font-label-md text-label-md font-semibold active:scale-95 hover:bg-berry-tint hover:text-primary transition-all"
                >
                  +5장
                </button>
                <button
                  type="button"
                  onClick={() => setTicketCount(limit)}
                  className="py-2.5 rounded-xl bg-primary/10 text-primary font-label-md text-label-md font-bold active:scale-95 hover:bg-primary hover:text-on-primary transition-all"
                >
                  일괄 사용
                </button>
              </div>

              <div className="p-4 rounded-xl bg-surface-rose-muted flex items-center justify-between gap-space-sm">
                <span className="font-body-sm text-body-sm text-on-surface-variant">응모 후 잔여 응모권</span>
                <div className="flex items-center gap-1.5 font-label-md text-label-md">
                  <span className="text-on-surface-variant">{formatNumber(balance)}장</span>
                  <MaterialIcon name="arrow_forward" className="text-[14px] text-on-surface-variant" />
                  <span className="font-bold text-on-surface">{formatNumber(balance - selectedCount)}장</span>
                </div>
              </div>

              <div className="flex items-start gap-2 pt-1 text-slate-muted">
                <MaterialIcon name="priority_high" className="text-label-xs leading-normal text-outline shrink-0" />
                <p className="font-label-xs text-label-xs leading-normal">
                  응모 완료 시 사용된 응모권은 취소 또는 환불이 불가합니다.
                </p>
              </div>
            </div>
        <div className="grid grid-cols-2 gap-space-sm mt-4">
          <button type="button" disabled={opening} onClick={() => setSelectionOpen(false)} className="h-12 rounded-xl bg-surface-container text-on-surface font-bold">취소</button>
          <button type="button" disabled={!canApply || opening} onClick={openConfirm} className="h-12 rounded-xl bg-primary text-on-primary font-bold disabled:opacity-50">{opening ? '확인 중...' : `${selectedCount}장으로 응모하기`}</button>
        </div>
      </BottomSheet>

      <dialog
        ref={confirmationRef}
        aria-label="응모 확인"
        aria-describedby="entry-confirm-message"
        onCancel={(event) => {
          event.preventDefault()
          if (phase !== 'submitting') {
            setSheetOpen(false)
            if (phase === 'idle') setSelectionOpen(true)
          }
        }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border-0 bg-surface-container-lowest p-6 text-on-surface shadow-2xl backdrop:bg-black/60"
      >
        <p id="entry-confirm-message" className="font-body-md text-body-md text-on-surface leading-relaxed mb-6">
          응모 완료 시 사용된 응모권은 취소 또는 환불이 불가합니다. 응모하시겠습니까?
        </p>

        {phase === 'idle' && (
          <div className="grid grid-cols-5 gap-space-sm">
            <button
              type="button"
              onClick={() => { setSheetOpen(false); setSelectionOpen(true) }}
              className="col-span-2 h-12 rounded-xl bg-berry-tint text-berry-deep font-label-md text-label-md font-bold flex items-center justify-center hover:bg-border-rose active:scale-[0.98] transition-all"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submitEntry}
              disabled={!canApply}
              className="col-span-3 disabled:opacity-50 disabled:pointer-events-none h-12 rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md font-bold shadow-md flex items-center justify-center gap-space-xs hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <span>응모 확정</span>
            </button>
          </div>
        )}

        {phase !== 'idle' && !result?.accepted && (
          <div className="flex flex-col gap-space-sm">
            <div
              className={`w-full rounded-xl p-space-md flex items-center gap-space-md ${
                phase === 'submitting'
                  ? 'bg-surface-container-high'
                  : result?.accepted
                    ? 'bg-berry-tint'
                    : 'bg-error-container'
              }`}
            >
              {phase === 'submitting' ? (
                <Spinner className="w-6 h-6 text-primary shrink-0" />
              ) : (
                <MaterialIcon
                  name={result?.accepted ? 'check_circle' : 'error'}
                  filled
                  className={`text-[24px] shrink-0 ${result?.accepted ? 'text-primary' : 'text-on-error-container'}`}
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-label-sm text-on-surface font-bold">
                  {phase === 'submitting' ? '응모 처리 중...' : result?.message}
                </span>
                {phase === 'submitting' && (
                  <p className="font-label-xs text-label-xs text-on-surface-variant truncate">
                    중복 입력을 방지하기 위해 잠시만 기다려주세요
                  </p>
                )}
              </div>
            </div>

            {phase === 'done' && !result?.accepted && (
              <div className="grid grid-cols-2 gap-space-sm">
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="h-11 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md font-semibold active:scale-[0.98] transition-all"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={submitEntry}
                  className="h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold active:scale-[0.98] transition-all"
                >
                  다시 시도
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </div>
  )
}
