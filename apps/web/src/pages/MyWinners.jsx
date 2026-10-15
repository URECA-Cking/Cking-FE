import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import BottomSheet from '../components/ui/BottomSheet.jsx'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../components/ui/States.jsx'
import { describeError } from '../api/client.js'
import { declineMyWinner, getWinnerHistory, loadMyWinners } from '../api/myWinners.js'
import { useToast } from '../context/useToast.js'
import { useAsync } from '../hooks/useAsync.js'
import { formatDateTime, formatNumber } from '../utils/format.js'
import {
  filterWinnersByStatus,
  winnerEventTitle,
  winnerRankLabel,
  winnerStatusFilters,
  winnerStatusMeta,
} from '../utils/winnerPresentation.js'

const EMPTY_WINNERS = []
const EMPTY_EVENT_BY_ID = new Map()

export default function MyWinners() {
  const showToast = useToast()
  const [historyByWinner, setHistoryByWinner] = useState({})
  const [selectedWinner, setSelectedWinner] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoadingId, setHistoryLoadingId] = useState(null)
  const [decliningId, setDecliningId] = useState(null)
  const [declineConfirmOpen, setDeclineConfirmOpen] = useState(false)
  const [activeStatus, setActiveStatus] = useState('ALL')

  const { data, loading, error, reload } = useAsync(() => loadMyWinners(), [], {
    fallbackMessage: '당첨 내역을 불러오지 못했어요.',
  })

  const winners = data?.winners ?? EMPTY_WINNERS
  const eventById = data?.eventById ?? EMPTY_EVENT_BY_ID
  const filters = useMemo(() => winnerStatusFilters(winners), [winners])
  const filteredWinners = useMemo(() => filterWinnersByStatus(winners, activeStatus), [winners, activeStatus])
  const selectedHistory = selectedWinner ? historyByWinner[selectedWinner.winnerId] ?? [] : []

  async function toggleHistory() {
    if (!selectedWinner) return
    if (historyOpen) {
      setHistoryOpen(false)
      return
    }

    setHistoryOpen(true)
    if (historyByWinner[selectedWinner.winnerId]) return

    setHistoryLoadingId(selectedWinner.winnerId)
    try {
      const history = await getWinnerHistory(selectedWinner.winnerId)
      setHistoryByWinner((current) => ({ ...current, [selectedWinner.winnerId]: history ?? [] }))
    } catch (historyError) {
      showToast(describeError(historyError, '상태 이력을 불러오지 못했어요.'), { icon: 'error' })
      setHistoryOpen(false)
    } finally {
      setHistoryLoadingId(null)
    }
  }

  function openDetail(winner) {
    setSelectedWinner(winner)
    setHistoryOpen(false)
    setDeclineConfirmOpen(false)
  }

  function closeDetail() {
    if (decliningId) return
    setSelectedWinner(null)
    setHistoryOpen(false)
    setDeclineConfirmOpen(false)
  }

  async function declineSelectedWinner() {
    if (!selectedWinner) return

    setDecliningId(selectedWinner.winnerId)
    try {
      await declineMyWinner(selectedWinner.winnerId)
      showToast('당첨 포기가 완료됐어요.')
      setHistoryByWinner((current) => {
        const next = { ...current }
        delete next[selectedWinner.winnerId]
        return next
      })
      setSelectedWinner(null)
      setHistoryOpen(false)
      setDeclineConfirmOpen(false)
      await reload()
    } catch (declineError) {
      showToast(describeError(declineError, '당첨 포기를 처리하지 못했어요.'), { icon: 'error' })
    } finally {
      setDecliningId(null)
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen pb-8">
      <BackHeader title="내 당첨" />

      <main className="pt-16 px-margin flex flex-col gap-space-md pb-24">
        {loading && <LoadingBlock label="당첨 내역을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && winners.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <EmptyBlock
              icon="emoji_events"
              message="아직 당첨된 이벤트가 없어요."
              action={(
                <Link
                  to="/explore"
                  className="mt-1 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold active:scale-95 transition-all"
                >
                  이벤트 둘러보기
                </Link>
              )}
            />
          </div>
        )}

        {!loading && !error && winners.length > 0 && (
          <>
            <nav aria-label="당첨 상태 필터" className="-mx-margin px-margin flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {filters.map((filter) => {
                const selected = activeStatus === filter.value
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveStatus(filter.value)}
                    className={`shrink-0 inline-flex items-center gap-1.5 min-h-10 px-3 rounded-full font-label-sm text-label-sm font-bold transition-colors ${
                      selected
                        ? 'bg-primary text-on-primary shadow-card'
                        : 'bg-surface-container text-on-surface-variant active:bg-surface-container-high'
                    }`}
                    aria-pressed={selected}
                  >
                    {filter.label}
                    <span className={`min-w-5 h-5 px-1 rounded-full grid place-items-center text-label-xs ${selected ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-on-surface'}`}>
                      {filter.count}
                    </span>
                  </button>
                )
              })}
            </nav>

            {filteredWinners.length === 0 ? (
              <EmptyBlock icon="filter_list_off" message={`${filters.find((filter) => filter.value === activeStatus)?.label ?? '선택한'} 상태의 당첨 내역이 없어요.`} />
            ) : (
              <section className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-space-sm">
                {filteredWinners.map((winner) => {
                  const meta = winnerStatusMeta(winner.winnerManagementStatus)
                  const eventTitle = winnerEventTitle(winner, eventById)

                  return (
                    <article key={winner.winnerId} className="rounded-2xl bg-surface-container-lowest shadow-card overflow-hidden">
                  <div className="p-space-md flex flex-col gap-space-sm">
                    <div className="flex items-start gap-space-sm">
                      <div className="w-11 h-11 rounded-xl bg-berry-tint text-primary flex items-center justify-center shrink-0">
                        <MaterialIcon name="emoji_events" filled className="text-[23px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-title-md text-title-md text-on-surface font-bold truncate">{eventTitle}</p>
                        <p className="font-label-sm text-label-sm text-primary font-bold mt-0.5">{winnerRankLabel(winner.rankInDrawing)}</p>
                      </div>
                      <StatusPill label={meta.label} tone={meta.tone} icon={meta.icon} className="shrink-0" />
                    </div>

                    <div className="flex items-center gap-2 pt-space-sm border-t border-surface-container">
                      <MaterialIcon name="calendar_today" className="text-[16px] text-on-surface-variant" />
                      <span className="font-label-sm text-label-sm text-on-surface-variant">당첨 확정일</span>
                      <span className="min-w-0 flex-1 text-right font-label-sm text-label-sm text-on-surface font-semibold truncate">{formatDateTime(winner.winnerCreatedAt)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => openDetail(winner)}
                      className="w-full h-10 rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm font-bold active:scale-[0.98] transition-all"
                    >
                      <span className="inline-flex items-center gap-1">
                        당첨 상세 보기
                        <MaterialIcon name="chevron_right" className="text-[18px]" />
                      </span>
                    </button>
                  </div>
                </article>
                  )
                })}
              </section>
            )}
          </>
        )}
      </main>

      <WinnerDetailSheet
        winner={selectedWinner}
        eventById={eventById}
        history={selectedHistory}
        historyOpen={historyOpen}
        historyLoading={selectedWinner && historyLoadingId === selectedWinner.winnerId}
        declineConfirmOpen={declineConfirmOpen}
        declining={Boolean(selectedWinner && decliningId === selectedWinner.winnerId)}
        onClose={closeDetail}
        onToggleHistory={toggleHistory}
        onOpenDeclineConfirm={() => setDeclineConfirmOpen(true)}
        onCancelDecline={() => setDeclineConfirmOpen(false)}
        onConfirmDecline={declineSelectedWinner}
      />
    </div>
  )
}

function WinnerDetailSheet({
  winner,
  eventById,
  history,
  historyOpen,
  historyLoading,
  declineConfirmOpen,
  declining,
  onClose,
  onToggleHistory,
  onOpenDeclineConfirm,
  onCancelDecline,
  onConfirmDecline,
}) {
  if (!winner) return null

  const meta = winnerStatusMeta(winner.winnerManagementStatus)
  const canDecline = winner.winnerManagementStatus === 'SELECTED'
  const title = winnerEventTitle(winner, eventById)

  return (
    <BottomSheet open={Boolean(winner)} onClose={onClose} eyebrow={declineConfirmOpen ? '당첨 포기 확인' : '당첨 결과'} title={declineConfirmOpen ? '당첨을 포기할까요?' : title}>
      {declineConfirmOpen ? (
        <div className="flex flex-col gap-space-md">
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">당첨 포기 후에는 되돌릴 수 없어요. 포기한 당첨은 다시 수령할 수 없습니다.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onCancelDecline} disabled={declining} className="h-11 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md font-bold disabled:opacity-50">돌아가기</button>
            <button type="button" onClick={onConfirmDecline} disabled={declining} className="h-11 rounded-xl bg-error-container text-on-error-container font-label-md text-label-md font-bold disabled:opacity-50">
              {declining ? '처리 중...' : '포기하기'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center justify-between gap-3">
            <p className="font-title-md text-title-md text-primary font-bold">{winnerRankLabel(winner.rankInDrawing)}</p>
            <StatusPill label={meta.label} tone={meta.tone} icon={meta.icon} />
          </div>

          <dl className="rounded-2xl bg-surface-container-low p-space-sm divide-y divide-surface-container">
            <DetailRow label="추첨 구분" value={`${winner.drawType === 'REDRAW' ? '재추첨' : '초기 추첨'} ${Number.isInteger(winner.drawNo) ? `${winner.drawNo + 1}회차` : ''}`} />
            <DetailRow label="응모권 사용" value={`${formatNumber(winner.appliedTicketCount)}장`} />
            <DetailRow label="당첨 확정일" value={formatDateTime(winner.winnerCreatedAt)} />
            <DetailRow label="현재 상태" value={meta.label} />
          </dl>

          <section className="border-t border-surface-container pt-space-sm">
            <button type="button" onClick={onToggleHistory} className="w-full min-h-10 flex items-center justify-between text-on-surface font-label-md text-label-md font-bold">
              <span className="inline-flex items-center gap-1.5"><MaterialIcon name="history" className="text-[18px] text-primary" />진행 내역</span>
              <MaterialIcon name={historyOpen ? 'expand_less' : 'expand_more'} className="text-[20px] text-on-surface-variant" />
            </button>
            {historyOpen && (
              <div className="pt-space-sm">
                {historyLoading && <LoadingBlock label="진행 내역을 불러오는 중..." />}
                {!historyLoading && history.length === 0 && <p className="py-2 text-center font-label-sm text-label-sm text-on-surface-variant">아직 상태 변경 이력이 없어요.</p>}
                {!historyLoading && history.length > 0 && (
                  <ol className="flex flex-col gap-3 pl-3 border-l-2 border-berry-tint">
                    {history.map((item) => (
                      <li key={item.historyId} className="relative pl-3">
                        <span className="absolute w-2.5 h-2.5 rounded-full bg-primary -left-[7px] top-1.5" />
                        <p className="font-label-sm text-label-sm text-on-surface font-semibold">{winnerStatusMeta(item.afterStatus).label}</p>
                        <p className="font-label-xs text-label-xs text-on-surface-variant mt-0.5">{formatDateTime(item.changedAt)}</p>
                        {item.reason && <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{item.reason}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>

          {canDecline && (
            <button type="button" onClick={onOpenDeclineConfirm} className="min-h-10 self-start text-error font-label-sm text-label-sm font-bold active:opacity-70">
              당첨 포기
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="font-label-sm text-label-sm text-on-surface-variant">{label}</dt>
      <dd className="min-w-0 text-right font-label-sm text-label-sm text-on-surface font-semibold break-words">{value}</dd>
    </div>
  )
}
