import { useState } from 'react'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../components/ui/States.jsx'
import { describeError } from '../api/client.js'
import { declineMyWinner, getMyWinners, getWinnerHistory } from '../api/myWinners.js'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { formatDateTime, formatNumber } from '../utils/format.js'

const STATUS_META = {
  SELECTED: { label: '수령 대기', tone: 'bg-berry-tint text-primary', icon: 'workspace_premium' },
  RECEIVED: { label: '수령 완료', tone: 'bg-secondary-fixed text-on-secondary-fixed', icon: 'check_circle' },
  DECLINED: { label: '당첨 포기', tone: 'bg-surface-container-high text-on-surface-variant', icon: 'block' },
  DISQUALIFIED: { label: '자격 박탈', tone: 'bg-error-container text-on-error-container', icon: 'gpp_bad' },
}

function statusMeta(status) {
  return STATUS_META[status] ?? { label: status ?? '상태 확인 중', tone: 'bg-surface-container-high text-on-surface-variant' }
}

export default function MyWinners() {
  const { userId } = useUser()
  const showToast = useToast()
  const [historyByWinner, setHistoryByWinner] = useState({})
  const [openHistoryId, setOpenHistoryId] = useState(null)
  const [historyLoadingId, setHistoryLoadingId] = useState(null)
  const [decliningId, setDecliningId] = useState(null)

  const { data, loading, error, reload } = useAsync(() => getMyWinners(userId), [userId], {
    fallbackMessage: '당첨 내역을 불러오지 못했어요.',
  })

  const winners = data ?? []
  const selectedCount = winners.filter((winner) => winner.winnerManagementStatus === 'SELECTED').length

  async function toggleHistory(winnerId) {
    if (openHistoryId === winnerId) {
      setOpenHistoryId(null)
      return
    }

    setOpenHistoryId(winnerId)
    if (historyByWinner[winnerId]) return

    setHistoryLoadingId(winnerId)
    try {
      const history = await getWinnerHistory(winnerId, userId)
      setHistoryByWinner((current) => ({ ...current, [winnerId]: history ?? [] }))
    } catch (historyError) {
      showToast(describeError(historyError, '상태 이력을 불러오지 못했어요.'), { icon: 'error' })
      setOpenHistoryId(null)
    } finally {
      setHistoryLoadingId(null)
    }
  }

  async function decline(winner) {
    if (!window.confirm('당첨을 포기할까요? 포기한 당첨은 되돌릴 수 없어요.')) return

    setDecliningId(winner.winnerId)
    try {
      await declineMyWinner(winner.winnerId, userId)
      showToast('당첨 포기가 완료됐어요.')
      setHistoryByWinner((current) => {
        const next = { ...current }
        delete next[winner.winnerId]
        return next
      })
      await reload()
    } catch (declineError) {
      showToast(describeError(declineError, '당첨 포기를 처리하지 못했어요.'), { icon: 'error' })
    } finally {
      setDecliningId(null)
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-8">
      <BackHeader title="내 당첨" />

      <main className="pt-16 px-margin flex flex-col gap-space-md">
        <section className="p-space-md rounded-2xl bg-gradient-to-br from-primary via-[#be185d] to-berry-deep text-on-primary shadow-floating overflow-hidden relative">
          <MaterialIcon name="emoji_events" filled className="absolute -right-2 -bottom-4 text-[112px] text-primary-fixed/15" />
          <div className="relative">
            <p className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">My winners</p>
            <h2 className="font-headline-md text-headline-md font-bold mt-1">나의 당첨 내역</h2>
            <p className="font-body-sm text-body-sm text-primary-fixed mt-2 leading-relaxed">
              {selectedCount > 0 ? `수령을 기다리는 당첨이 ${selectedCount}개 있어요.` : '당첨 상태와 처리 이력을 확인할 수 있어요.'}
            </p>
          </div>
        </section>

        {loading && <LoadingBlock label="당첨 내역을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && winners.length === 0 && (
          <EmptyBlock icon="emoji_events" message="아직 공개된 당첨 내역이 없어요." />
        )}

        {!loading && !error && winners.length > 0 && (
          <section className="flex flex-col gap-space-sm">
            {winners.map((winner) => {
              const meta = statusMeta(winner.winnerManagementStatus)
              const opened = openHistoryId === winner.winnerId
              const history = historyByWinner[winner.winnerId] ?? []
              const canDecline = winner.winnerManagementStatus === 'SELECTED'

              return (
                <article key={winner.winnerId} className="rounded-2xl bg-surface-container-lowest shadow-card overflow-hidden">
                  <div className="p-space-md flex flex-col gap-space-sm">
                    <div className="flex items-start gap-space-sm">
                      <div className="w-11 h-11 rounded-xl bg-berry-tint text-primary flex items-center justify-center shrink-0">
                        <MaterialIcon name="emoji_events" filled className="text-[23px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-title-md text-title-md text-on-surface font-bold">이벤트 #{winner.eventId}</p>
                        <p className="font-label-xs text-label-xs text-on-surface-variant mt-0.5">
                          {winner.drawType === 'REDRAW' ? '재추첨' : '초기 추첨'} {winner.drawNo + 1}회차 · {winner.rankInDrawing}위
                        </p>
                      </div>
                      <StatusPill label={meta.label} tone={meta.tone} icon={meta.icon} className="shrink-0" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-space-sm rounded-xl bg-surface-container-low">
                      <Info label="응모권 사용" value={`${formatNumber(winner.appliedTicketCount)}장`} />
                      <Info label="당첨 확정" value={formatDateTime(winner.winnerCreatedAt)} />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleHistory(winner.winnerId)}
                        className="flex-1 h-10 rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold active:scale-[0.98] transition-all"
                      >
                        <span className="inline-flex items-center gap-1">
                          <MaterialIcon name="history" className="text-[17px]" />
                          처리 이력
                          <MaterialIcon name={opened ? 'expand_less' : 'expand_more'} className="text-[17px]" />
                        </span>
                      </button>
                      {canDecline && (
                        <button
                          type="button"
                          disabled={decliningId === winner.winnerId}
                          onClick={() => decline(winner)}
                          className="px-4 h-10 rounded-xl bg-error-container text-on-error-container font-label-sm text-label-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {decliningId === winner.winnerId ? '처리 중...' : '당첨 포기'}
                        </button>
                      )}
                    </div>
                  </div>

                  {opened && (
                    <div className="px-space-md pb-space-md border-t border-surface-container pt-space-sm">
                      {historyLoadingId === winner.winnerId && <LoadingBlock label="처리 이력을 불러오는 중..." />}
                      {historyLoadingId !== winner.winnerId && history.length === 0 && (
                        <p className="py-2 text-center font-label-sm text-label-sm text-on-surface-variant">아직 상태 변경 이력이 없어요.</p>
                      )}
                      {historyLoadingId !== winner.winnerId && history.length > 0 && (
                        <ol className="flex flex-col gap-3 pl-3 border-l-2 border-berry-tint">
                          {history.map((item) => (
                            <li key={item.historyId} className="relative pl-3">
                              <span className="absolute w-2.5 h-2.5 rounded-full bg-primary -left-[7px] top-1.5" />
                              <p className="font-label-sm text-label-sm text-on-surface font-semibold">
                                {statusMeta(item.afterStatus).label}
                              </p>
                              <p className="font-label-xs text-label-xs text-on-surface-variant mt-0.5">{formatDateTime(item.changedAt)}</p>
                              {item.reason && <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{item.reason}</p>}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        )}
      </main>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="font-label-xs text-label-xs text-on-surface-variant">{label}</p>
      <p className="font-label-sm text-label-sm text-on-surface font-semibold truncate mt-0.5">{value}</p>
    </div>
  )
}
