import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import BottomSheet from '../components/ui/BottomSheet.jsx'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import { LoadingBlock, ErrorBlock, StatusPill, Spinner } from '../components/ui/States.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useUser } from '../context/UserContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { getEvent } from '../api/events.js'
import { applyEntry, describeEntryResult } from '../api/entries.js'
import { getPublicWinners } from '../api/winners.js'
import { newRequestId } from '../api/client.js'
import { getCreatorProfile, getEventBanner } from '../data/creatorProfiles.js'
import { formatDday, formatEventDate, formatNumber, totalPrizeQuantity } from '../utils/format.js'
import { displayStatusMeta, eventStatusMeta, isEntryOpen } from '../utils/eventStatus.js'

/**
 * 이벤트(래플) 상세 · 응모 화면 (시안 _6 + bottom_sheet).
 *
 * 응모는 POST /api/events/{eventId}/entries 를 멱등키(requestId, UUID)와 함께 보내고,
 * 백엔드가 돌려주는 결과 코드 10종을 그대로 해석해 사용자에게 알린다.
 * 같은 응모 시도에서는 requestId를 유지해 재시도가 중복 차감으로 이어지지 않게 한다.
 */
export default function EventDetail() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const { userId } = useUser()

  const [ticketCount, setTicketCount] = useState(1)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [phase, setPhase] = useState('idle') // idle | submitting | done
  const [result, setResult] = useState(null)
  const [requestId, setRequestId] = useState(() => newRequestId())

  const { data: event, loading, error, reload } = useAsync(
    () => getEvent(eventId, userId),
    [eventId, userId],
    { fallbackMessage: '이벤트 상세를 불러오지 못했습니다.' },
  )

  const published = event?.status === 'PUBLISHED'
  const winners = useAsync(() => getPublicWinners(eventId), [eventId, published], {
    enabled: Boolean(published),
    fallbackMessage: '당첨자 목록을 불러오지 못했습니다.',
  })

  const balance = event?.myTicketBalance ?? 0
  const creator = useMemo(() => getCreatorProfile(event?.creatorId), [event?.creatorId])
  const prizeCount = totalPrizeQuantity(event?.prizes)
  const canApply = isEntryOpen(event) && balance > 0
  // 응모 성공으로 잔액이 줄어들 수 있으므로, 실제로 쓸 수량은 렌더 시점에 잔액 범위로 맞춘다.
  const selectedCount = Math.min(Math.max(1, ticketCount), Math.max(1, balance))

  if (loading) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-safe">
        <BackHeader title="Raffle Detail" onBack={() => navigate(-1)} />
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

  function adjust(delta) {
    setTicketCount(Math.min(balance, Math.max(1, selectedCount + delta)))
  }

  function quickAdd(amount) {
    setTicketCount(Math.min(balance, selectedCount + amount))
  }

  function openConfirm() {
    if (!isEntryOpen(event)) {
      showToast('지금은 응모할 수 있는 상태가 아니에요.', { icon: 'error' })
      return
    }
    if (balance <= 0) {
      showToast('보유한 응모권이 없어요. 응모권을 먼저 모아주세요!', { icon: 'error' })
      return
    }
    setPhase('idle')
    setResult(null)
    setRequestId(newRequestId())
    setSheetOpen(true)
  }

  async function submitEntry() {
    setPhase('submitting')
    // 재시도해도 같은 requestId를 쓰므로 백엔드가 DUPLICATE_REPLAY로 안전하게 처리한다.
    const envelope = await applyEntry(eventId, { userId, requestId, ticketCount: selectedCount })
    const outcome = describeEntryResult(envelope)
    setResult(outcome)
    setPhase('done')
    showToast(outcome.message, { icon: outcome.accepted ? 'check_circle' : 'error' })

    if (outcome.accepted) {
      await reload()
      setTimeout(() => setSheetOpen(false), 1200)
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-32">
      <BackHeader title="Raffle Detail" onBack={() => navigate(-1)} />
      <div className="pt-14 flex flex-col w-full">
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-container">
          <img className="w-full h-full object-cover" src={getEventBanner(event.eventId)} alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-surface/90 via-slate-surface/20 to-transparent" />
          <div className="absolute top-space-md left-space-md flex flex-wrap items-center gap-space-xs">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-xs text-label-xs shadow-md ${status.tone}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
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
          <div className="absolute bottom-space-md left-space-md right-space-md flex items-center justify-between text-white">
            <div className="flex items-center gap-space-xs">
              <MaterialIcon name="verified" className="text-berry-glow text-[18px]" />
              <span className="font-label-sm text-label-sm tracking-wide text-white/95">공식 아티스트 래플 이벤트</span>
            </div>
            <div className="flex items-center gap-1 bg-surface-glass-dark px-2 py-0.5 rounded-full backdrop-blur-md text-white/90 font-label-xs text-label-xs">
              <MaterialIcon name="casino" className="text-[14px]" />
              <span>{event.drawMethod === 'WEIGHTED' ? '가중 난수 추첨' : event.drawMethod}</span>
            </div>
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
              <MaterialIcon name="verified" filled className="text-primary text-[18px]" />
              <StatusPill label={statusDetail.label} tone={statusDetail.tone} className="ml-auto" />
            </div>
            <h2 className="font-headline-md text-headline-md font-extrabold text-on-surface tracking-tight">
              {event.title}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 text-slate-muted font-body-sm text-body-sm pt-0.5">
              <MaterialIcon name="event" className="text-primary text-[17px]" />
              <span>{formatEventDate(event.startAt)} 오픈</span>
              <span className="text-outline-variant">•</span>
              <span>{formatEventDate(event.endAt)} 마감</span>
            </div>
            {event.description && (
              <p className="font-body-md text-body-md text-on-surface-variant pt-1 leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            )}
            <div className="mt-space-xs flex items-center gap-2 p-3 rounded-xl bg-surface-container-low text-on-surface-variant">
              <MaterialIcon name="info" className="text-secondary text-[20px] shrink-0" />
              <span className="font-body-sm text-body-sm leading-snug">
                사용한 응모권이 많을수록 당첨 확률이 높아져요.{' '}
                <span className="text-on-surface font-semibold">(조작 없는 공정 난수 추첨)</span>
              </span>
            </div>
          </div>

          <div className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-berry-tint flex items-center justify-center text-primary">
                <MaterialIcon name="confirmation_number" className="text-[26px]" />
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  내 보유 {creator.name} 응모권
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-metric-display text-metric-display font-extrabold text-on-surface">
                    {formatNumber(balance)}
                  </span>
                  <span className="font-label-md text-label-md font-bold text-primary">장</span>
                </div>
              </div>
            </div>
            <Link
              to={`/creators/${event.creatorId}`}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-berry-tint text-primary hover:bg-primary hover:text-on-primary transition-all active:scale-95 shadow-sm"
            >
              <MaterialIcon name="add_circle" className="text-[18px]" />
              <span className="font-label-sm text-label-sm font-bold">응모권 더 받기</span>
            </Link>
          </div>

          {canApply && (
            <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-floating flex flex-col gap-space-lg relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                  <h3 className="font-title-lg text-title-lg font-bold text-on-surface">사용할 응모권 수</h3>
                </div>
                <span className="font-label-xs text-label-xs px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">
                  단위: 1장
                </span>
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
                  disabled={selectedCount >= balance}
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
                  onClick={() => setTicketCount(balance)}
                  className="py-2.5 rounded-xl bg-primary/10 text-primary font-label-md text-label-md font-bold active:scale-95 hover:bg-primary hover:text-on-primary transition-all"
                >
                  전부 ({formatNumber(balance)}장)
                </button>
              </div>

              <div className="p-4 rounded-xl bg-surface-rose-muted flex flex-col gap-3">
                <div className="flex items-center justify-between text-on-surface">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">응모 후 잔여 응모권</span>
                  <div className="flex items-center gap-1.5 font-label-md text-label-md">
                    <span className="text-slate-muted">보유 {formatNumber(balance)}장</span>
                    <MaterialIcon name="arrow_forward" className="text-[14px] text-outline" />
                    <span className="font-bold text-primary">{formatNumber(balance - selectedCount)}장 남음</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between font-label-sm text-label-sm">
                    <span className="flex items-center gap-1 text-on-surface font-semibold">
                      <MaterialIcon name="trending_up" className="text-[16px] text-secondary" />
                      사용 비중
                    </span>
                    <span className="font-bold text-secondary">
                      보유 응모권의 {Math.round((selectedCount / Math.max(1, balance)) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((selectedCount / Math.max(1, balance)) * 100)}%` }}
                    />
                  </div>
                  <p className="font-label-xs text-label-xs text-slate-muted text-right">
                    당첨 확률은 전체 응모량에 따라 달라져요
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 pt-1 text-slate-muted">
                <MaterialIcon name="priority_high" className="text-[16px] text-outline shrink-0 mt-0.5" />
                <p className="font-label-xs text-label-xs leading-normal">
                  안내: 사용한 응모권은 응모 완료 후 취소 및 환불할 수 없으며, 이벤트 종료 후 당첨자는 앱 알림으로
                  개별 고지됩니다.
                </p>
              </div>
            </div>
          )}

          {!canApply && (
            <div className="p-space-md rounded-2xl bg-surface-container-low flex items-start gap-space-sm">
              <MaterialIcon name="info" className="text-on-surface-variant text-[20px] shrink-0 mt-0.5" />
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {event.displayStatus === 'UPCOMING'
                  ? `아직 응모가 열리지 않았어요. ${formatEventDate(event.startAt)}에 시작됩니다.`
                  : closed
                    ? '응모가 마감된 이벤트예요. 결과가 공개되면 알림으로 알려드릴게요.'
                    : '보유한 응모권이 없어 응모할 수 없어요. 응모권을 먼저 모아주세요.'}
              </p>
            </div>
          )}

          {event.prizes?.length > 0 && (
            <div className="p-space-md rounded-2xl bg-surface-container-low flex flex-col gap-3">
              <span className="font-title-md text-title-md font-bold text-on-surface">응모 상세 혜택</span>
              <div className="grid grid-cols-2 gap-2.5">
                {event.prizes.map((prize) => (
                  <div
                    key={prize.prizeKey}
                    className="p-3 rounded-xl bg-surface-container-lowest flex flex-col gap-1 shadow-sm"
                  >
                    <MaterialIcon name="redeem" className="text-primary text-[22px]" />
                    <span className="font-label-md text-label-md font-bold text-on-surface">{prize.displayName}</span>
                    <span className="font-label-xs text-label-xs text-slate-muted">
                      {formatNumber(prize.quantity)}개 · 가중치 {formatNumber(prize.weight)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
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
              {!winners.loading && (winners.data?.winners ?? []).length > 0 && (
                <ul className="flex flex-col gap-2">
                  {winners.data.winners.map((winner) => {
                    const mine = winner.userId === userId
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
                          <p className="font-label-md text-label-md font-semibold text-on-surface truncate">
                            {mine ? '나의 당첨 🎉' : `당첨자 #${winner.userId}`}
                          </p>
                          <p className="font-label-xs text-label-xs text-on-surface-variant truncate">
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

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-40 bg-surface-glass backdrop-blur-2xl px-space-md pt-3 pb-6 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={openConfirm}
            disabled={!canApply}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary via-primary-container to-berry-glow text-on-primary font-title-md text-title-md font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <MaterialIcon name="confirmation_number" filled className="text-[20px]" />
            <span>{canApply ? `🎟️ ${selectedCount}장으로 응모하기` : '응모할 수 없는 상태예요'}</span>
          </button>
          <p className="text-center font-label-xs text-label-xs text-slate-muted">
            당첨 발표는 앱 알림으로 개별 안내됩니다.
          </p>
        </div>
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={phase === 'submitting' ? undefined : () => setSheetOpen(false)}
        eyebrow="Raffle Confirmation"
        title="응모 확인"
      >
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 mb-space-md">
          아래 내용으로 응모를 완료할까요?
        </p>

        <div className="p-space-sm bg-surface-rose-muted rounded-xl flex items-center gap-space-md mb-space-md shadow-sm">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
            <img className="w-full h-full object-cover" src={getEventBanner(event.eventId)} alt="" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="font-label-sm text-label-sm text-primary font-bold tracking-tight">{creator.name}</span>
              <MaterialIcon name="verified" filled className="text-[15px] text-primary" />
              <span className="font-label-xs text-label-xs text-slate-muted ml-auto">{dday}</span>
            </div>
            <h3 className="font-title-md text-title-md text-on-surface font-bold truncate mt-0.5">{event.title}</h3>
            <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
              {formatNumber(event.winnerCount)}명 추첨 · 상품 {formatNumber(prizeCount)}개
            </p>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-xl p-space-md mb-space-md flex flex-col gap-space-sm">
          <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
            <div className="flex items-center gap-space-xs">
              <div className="w-7 h-7 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed">
                <MaterialIcon name="confirmation_number" className="text-[16px]" />
              </div>
              <span className="font-title-md text-title-md text-on-surface font-semibold">사용할 응모권</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-metric-display text-metric-display text-primary-container font-extrabold tracking-tight">
                {selectedCount}
              </span>
              <span className="font-label-md text-label-md text-primary-container font-bold">장 소모</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="font-body-sm text-body-sm text-on-surface-variant">현재 보유 수량</span>
            <span className="font-label-md text-label-md text-on-surface font-medium">{formatNumber(balance)}장</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-on-surface-variant">응모 후 잔여 수량</span>
            <span className="font-label-md text-label-md text-slate-muted font-bold">
              {formatNumber(balance - selectedCount)}장
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-on-surface-variant">요청 번호(멱등키)</span>
            <span className="font-label-xs text-label-xs text-outline truncate max-w-[160px]">{requestId}</span>
          </div>
        </div>

        <div className="bg-gold-badge-bg rounded-xl p-space-md mb-space-lg flex items-start gap-space-sm">
          <MaterialIcon name="warning" className="text-[20px] text-gold-badge flex-shrink-0 mt-0.5" />
          <p className="font-body-sm text-body-sm text-tertiary-container leading-relaxed">
            응모 완료 시 사용된 응모권은 취소 또는 환불이 불가하며, 이벤트 종료 후 공정 난수 추첨 알고리즘을 통해
            투명하게 선정됩니다.
          </p>
        </div>

        {phase === 'idle' && (
          <div className="grid grid-cols-5 gap-space-sm">
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="col-span-2 h-12 rounded-xl bg-berry-tint text-berry-deep font-label-md text-label-md font-bold flex items-center justify-center hover:bg-border-rose active:scale-[0.98] transition-all"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submitEntry}
              className="col-span-3 h-12 rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md font-bold shadow-md flex items-center justify-center gap-space-xs hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <span>최종 응모하기</span>
              <span className="bg-berry-deep/40 px-1.5 py-0.5 rounded-full text-[11px] font-medium text-white">
                {selectedCount}장 소모
              </span>
            </button>
          </div>
        )}

        {phase !== 'idle' && (
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
                <p className="font-label-xs text-label-xs text-on-surface-variant truncate">
                  {phase === 'submitting'
                    ? '중복 입력을 방지하기 위해 잠시만 기다려주세요'
                    : `결과 코드: ${result?.code}`}
                </p>
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
      </BottomSheet>
    </div>
  )
}
