import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { getEvent } from '../../api/events.js'
import { getTicketHistory } from '../../api/tickets.js'
import { applyEntry, getMyEntries } from '../../api/entries.js'
import { getPublicWinners } from '../../api/winners.js'
import { ApiError } from '../../api/client.js'
import { DISPLAY_STATUS_LABEL, LoadingBlock, ErrorBlock, EmptyBlock, StatusPill, UserGate, formatDateTime } from './liveUi.jsx'

export default function LiveEventDetail() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const { user } = useUser()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [ticketCount, setTicketCount] = useState(1)
  const [applying, setApplying] = useState(false)

  const [entries, setEntries] = useState(null)
  const [ledger, setLedger] = useState(null)
  const [winners, setWinners] = useState(null)
  const [winnersError, setWinnersError] = useState(null)

  const loadEvent = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const data = await getEvent(eventId, user.userId)
      setEvent(data)
      setTicketCount((prev) => Math.min(Math.max(prev, 1), Math.max(1, data.myTicketBalance)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '이벤트 상세를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [eventId, user])

  const loadEntries = useCallback(async () => {
    if (!user) return
    try {
      const data = await getMyEntries(eventId, user.userId, { size: 10 })
      setEntries(data)
    } catch (err) {
      setEntries({ items: [], error: err instanceof ApiError ? err.message : '응모 내역 조회 실패' })
    }
  }, [eventId, user])

  const loadLedger = useCallback(async (creatorId) => {
    if (!user || !creatorId) return
    try {
      const data = await getTicketHistory(creatorId, user.userId, { size: 10 })
      setLedger(data)
    } catch (err) {
      setLedger({ items: [], error: err instanceof ApiError ? err.message : '응모권 이력 조회 실패' })
    }
  }, [user])

  const loadWinners = useCallback(async () => {
    setWinnersError(null)
    try {
      const data = await getPublicWinners(eventId)
      setWinners(data)
    } catch (err) {
      // GET /api/events/{eventId}/winners의 정확한 응답 구조는 문서만으로 완전히 확정하지 못했습니다.
      // (추첨 전이거나 아직 공개되지 않은 이벤트라면 에러가 나는 게 정상일 수 있습니다.)
      setWinnersError(err instanceof ApiError ? err.message : '아직 당첨자가 공개되지 않았거나 조회에 실패했습니다.')
    }
  }, [eventId])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  useEffect(() => {
    if (!event) return
    loadEntries()
    loadLedger(event.creatorId)
    loadWinners()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.eventId])

  function adjust(delta) {
    setTicketCount((prev) => {
      const max = Math.max(1, event?.myTicketBalance ?? 1)
      return Math.min(max, Math.max(1, prev + delta))
    })
  }

  async function handleApply() {
    if (!user || !event) return
    if ((event.myTicketBalance ?? 0) <= 0) {
      showToast('보유한 응모권이 없어 응모할 수 없습니다.', { icon: 'error' })
      return
    }
    setApplying(true)
    try {
      const requestId = crypto.randomUUID()
      const envelope = await applyEntry(eventId, {
        userId: user.userId,
        requestId,
        ticketCount,
      })

      if (envelope.ok) {
        showToast(`응모 요청이 접수되었습니다. (code: ${envelope.code ?? 'SUCCESS'})`)
      } else {
        showToast(`응모 실패: ${envelope.message ?? envelope.code ?? '알 수 없는 오류'}`, { icon: 'error' })
      }

      await Promise.all([loadEvent(), loadEntries(), event?.creatorId ? loadLedger(event.creatorId) : Promise.resolve()])
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '응모 요청 중 오류가 발생했습니다.', { icon: 'error' })
    } finally {
      setApplying(false)
    }
  }

  const statusMeta = event ? DISPLAY_STATUS_LABEL[event.displayStatus] ?? DISPLAY_STATUS_LABEL.CLOSED : null

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-32 bg-surface">
      <BackHeader
        title="이벤트 상세"
        badge={eventId ? `#${eventId}` : undefined}
        onBack={() => navigate('/live/events')}
      />

      <div className="pt-16 px-margin flex flex-col gap-space-lg">
        <UserGate user={user}>
          {loading && <LoadingBlock label="이벤트 상세를 불러오는 중..." />}
          {!loading && error && <ErrorBlock message={error} onRetry={loadEvent} />}

          {!loading && !error && event && (
            <>
              <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-sm">
                <div className="flex items-center justify-between gap-2">
                  {statusMeta && <StatusPill label={statusMeta.label} className={statusMeta.className} />}
                  <span className="font-label-xs text-label-xs text-on-surface-variant">status: {event.status}</span>
                </div>
                <h1 className="font-headline-md text-headline-md font-extrabold text-on-surface">{event.title}</h1>
                {event.description && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{event.description}</p>
                )}
                <div className="flex flex-col gap-1 pt-1 font-label-xs text-label-xs text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <MaterialIcon name="schedule" className="text-[14px]" />
                    {formatDateTime(event.startAt)} ~ {formatDateTime(event.endAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MaterialIcon name="storefront" className="text-[14px]" />
                    creatorId {event.creatorId} · 당첨 {event.winnerCount}명 · {event.drawMethod}
                  </span>
                </div>
              </section>

              <section className="p-space-md rounded-2xl bg-berry-tint flex items-center justify-between">
                <div className="flex items-center gap-space-sm">
                  <div className="w-11 h-11 rounded-xl bg-surface flex items-center justify-center text-primary">
                    <MaterialIcon name="confirmation_number" className="text-[24px]" />
                  </div>
                  <div>
                    <p className="font-label-sm text-label-sm text-berry-deep">내 보유 응모권</p>
                    <p className="font-title-lg text-title-lg font-extrabold text-primary">
                      {event.myTicketBalance}<span className="font-label-md text-label-md">장</span>
                    </p>
                  </div>
                </div>
                <span className="font-label-xs text-label-xs text-berry-deep">GET /api/events/{'{id}'}</span>
              </section>

              <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-title-md text-title-md font-bold text-on-surface">응모하기</h2>
                  <span className="font-label-xs text-label-xs text-on-surface-variant">POST .../entries</span>
                </div>
                <div className="flex items-center justify-between bg-surface-container-low rounded-2xl p-2.5">
                  <button
                    type="button"
                    aria-label="1장 감소"
                    disabled={ticketCount <= 1}
                    onClick={() => adjust(-1)}
                    className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface active:scale-90 transition-transform shadow-sm disabled:opacity-30"
                  >
                    <MaterialIcon name="remove" className="text-[22px]" />
                  </button>
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline-lg text-headline-lg font-extrabold text-primary">{ticketCount}</span>
                    <span className="font-title-md text-title-md font-bold text-primary">장</span>
                  </div>
                  <button
                    type="button"
                    aria-label="1장 증가"
                    disabled={ticketCount >= Math.max(1, event.myTicketBalance)}
                    onClick={() => adjust(1)}
                    className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary active:scale-90 transition-transform shadow-sm disabled:opacity-30"
                  >
                    <MaterialIcon name="add" className="text-[22px]" />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={applying || (event.myTicketBalance ?? 0) <= 0}
                  onClick={handleApply}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-primary via-primary-container to-berry-glow text-on-primary font-title-md text-title-md font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {applying ? (
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
                    </svg>
                  ) : (
                    <MaterialIcon name="confirmation_number" filled className="text-[20px]" />
                  )}
                  <span>{applying ? '응모 처리 중...' : `${ticketCount}장으로 응모하기`}</span>
                </button>
                <p className="font-label-xs text-label-xs text-on-surface-variant">
                  요청마다 새 requestId(UUID)를 생성해 멱등하게 처리합니다. 응답 코드가 "SUCCESS"가 아니어도
                  중복 처리 등 정상적인 응답일 수 있어 코드/메시지를 그대로 보여드려요.
                </p>
              </section>

              <section className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-title-md text-title-md font-bold text-on-surface">내 응모 내역</h2>
                  <span className="font-label-xs text-label-xs text-on-surface-variant">GET .../entries/me</span>
                </div>
                {!entries && <LoadingBlock label="응모 내역을 불러오는 중..." />}
                {entries?.error && <ErrorBlock message={entries.error} onRetry={loadEntries} />}
                {entries && !entries.error && entries.items.length === 0 && <EmptyBlock message="아직 응모 내역이 없어요." />}
                {entries && !entries.error && entries.items.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {entries.items.map((item) => (
                      <div key={item.entryId} className="p-space-sm rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MaterialIcon name="confirmation_number" className="text-[18px] text-primary" />
                          <span className="font-label-md text-label-md text-on-surface font-semibold">
                            {item.usedTicketCount}장 사용
                          </span>
                        </div>
                        <span className="font-label-xs text-label-xs text-on-surface-variant">{formatDateTime(item.appliedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-title-md text-title-md font-bold text-on-surface">응모권 적립/사용 이력</h2>
                  <span className="font-label-xs text-label-xs text-on-surface-variant">GET .../tickets/history</span>
                </div>
                {!ledger && <LoadingBlock label="응모권 이력을 불러오는 중..." />}
                {ledger?.error && <ErrorBlock message={ledger.error} onRetry={() => loadLedger(event.creatorId)} />}
                {ledger && !ledger.error && (ledger.items ?? []).length === 0 && <EmptyBlock message="이력이 없어요." />}
                {ledger && !ledger.error && (ledger.items ?? []).length > 0 && (
                  <div className="flex flex-col gap-2">
                    {ledger.items.map((item) => (
                      <div key={item.ledgerId} className="p-space-sm rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="font-label-md text-label-md font-semibold text-on-surface">
                            {item.deltaAmount > 0 ? '+' : ''}{item.deltaAmount}장 · {item.type}
                          </p>
                          {item.reason && <p className="font-label-xs text-label-xs text-on-surface-variant truncate">{item.reason}</p>}
                        </div>
                        <span className="font-label-xs text-label-xs text-on-surface-variant shrink-0">{formatDateTime(item.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-title-md text-title-md font-bold text-on-surface">당첨자 공개</h2>
                  <span className="font-label-xs text-label-xs text-on-surface-variant">GET .../winners</span>
                </div>
                {!winners && !winnersError && <LoadingBlock label="당첨자 정보를 불러오는 중..." />}
                {winnersError && <ErrorBlock message={winnersError} onRetry={loadWinners} />}
                {winners && (
                  <pre className="p-space-sm rounded-xl bg-surface-container-low text-on-surface-variant font-label-xs text-label-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(winners, null, 2)}
                  </pre>
                )}
              </section>
            </>
          )}
        </UserGate>
      </div>
    </div>
  )
}
