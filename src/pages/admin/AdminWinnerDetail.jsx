import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../../components/ui/States.jsx'
import { describeError } from '../../api/client.js'
import { disqualifyWinner, getWinnerHistory, receiveWinner } from '../../api/admin.js'
import { useToast } from '../../context/useToast.js'
import { useUser } from '../../context/useUser.js'
import { useAsync } from '../../hooks/useAsync.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'

const STATUS_META = {
  SELECTED: { label: '수령 대기', tone: 'bg-berry-tint text-primary', icon: 'workspace_premium' },
  RECEIVED: { label: '수령 완료', tone: 'bg-secondary-fixed text-on-secondary-fixed', icon: 'check_circle' },
  DECLINED: { label: '당첨 포기', tone: 'bg-surface-container-high text-on-surface-variant', icon: 'block' },
  DISQUALIFIED: { label: '당첨 취소', tone: 'bg-error-container text-on-error-container', icon: 'gpp_bad' },
}

function statusMeta(status) {
  return STATUS_META[status] ?? { label: status ?? '상태 확인 중', tone: 'bg-surface-container-high text-on-surface-variant' }
}

export default function AdminWinnerDetail() {
  const navigate = useNavigate()
  const { winnerId } = useParams()
  const { state } = useLocation()
  const winner = state?.winner
  const { userId } = useUser()
  const showToast = useToast()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: history, loading, error, reload } = useAsync(
    () => getWinnerHistory(winnerId, userId),
    [winnerId, userId],
    { fallbackMessage: '당첨 상태 이력을 불러오지 못했어요.' },
  )

  const latestStatus = history?.at(-1)?.afterStatus ?? winner?.winnerManagementStatus ?? 'SELECTED'
  const meta = statusMeta(latestStatus)
  const isSelected = latestStatus === 'SELECTED'

  async function receive() {
    if (!window.confirm('이 당첨자의 수령을 완료 처리할까요? 완료 후에는 되돌릴 수 없어요.')) return
    setBusy(true)
    try {
      await receiveWinner(winnerId, userId)
      showToast('수령 완료로 처리했어요.')
      await reload()
    } catch (receiveError) {
      showToast(describeError(receiveError, '수령 완료를 처리하지 못했어요.'), { icon: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function disqualify() {
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      showToast('당첨 취소 사유를 입력해주세요.', { icon: 'error' })
      return
    }
    if (!window.confirm('이 당첨을 취소할까요? 처리 후에는 되돌릴 수 없어요.')) return

    setBusy(true)
    try {
      await disqualifyWinner(winnerId, userId, trimmedReason)
      showToast('당첨을 취소했어요.')
      setReason('')
      await reload()
    } catch (disqualifyError) {
      showToast(describeError(disqualifyError, '당첨을 취소하지 못했어요.'), { icon: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-8">
      <BackHeader title="당첨자 운영" onBack={() => navigate(-1)} />

      <main className="pt-16 px-margin flex flex-col gap-space-md">
        <section className="p-space-md rounded-2xl bg-gradient-to-br from-primary via-[#be185d] to-berry-deep text-on-primary shadow-floating relative overflow-hidden">
          <MaterialIcon name="workspace_premium" filled className="absolute -right-2 -bottom-4 text-[112px] text-primary-fixed/15" />
          <div className="relative flex items-start gap-space-sm">
            <div className="w-11 h-11 rounded-xl bg-primary-fixed/20 flex items-center justify-center shrink-0">
              <MaterialIcon name="emoji_events" filled className="text-primary-fixed text-[24px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">Winner #{winnerId}</p>
              <h2 className="font-title-lg text-title-lg font-bold mt-1 truncate">{winner?.name ?? '당첨자 운영'}</h2>
              <p className="font-label-xs text-label-xs text-primary-fixed mt-1">
                {winner?.eventId ? `이벤트 #${winner.eventId} · ` : ''}{winner?.rankInDrawing ? `${winner.rankInDrawing}위` : '상태와 이력을 관리할 수 있어요.'}
              </p>
            </div>
          </div>
        </section>

        <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-space-sm">
          <div className="flex items-center justify-between gap-space-sm">
            <div>
              <p className="font-label-xs text-label-xs text-on-surface-variant">현재 운영 상태</p>
              <p className="font-title-md text-title-md text-on-surface font-bold mt-1">당첨자 #{winnerId}</p>
            </div>
            <StatusPill label={meta.label} tone={meta.tone} icon={meta.icon} className="shrink-0" />
          </div>
          {winner && (
            <div className="grid grid-cols-2 gap-2 p-space-sm rounded-xl bg-surface-container-low">
              <Info label="사용 응모권" value={`${formatNumber(winner.appliedTicketCount)}장`} />
              <Info label="상품" value={winner.prizeDisplayName ?? '상품 미지정'} />
            </div>
          )}
        </section>

        {isSelected && (
          <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-space-sm">
            <div className="flex items-center gap-1.5">
              <MaterialIcon name="settings" className="text-primary text-[20px]" />
              <h3 className="font-title-md text-title-md text-on-surface font-bold">운영 처리</h3>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={receive}
              className="w-full h-11 rounded-xl bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md font-bold active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <MaterialIcon name="task_alt" className="text-[19px] mr-1" />
              수령 완료 처리
            </button>
            <div className="p-space-sm rounded-xl bg-error-container/45 flex flex-col gap-2">
              <label htmlFor="disqualify-reason" className="font-label-sm text-label-sm text-on-error-container font-semibold">당첨 취소 사유</label>
              <textarea
                id="disqualify-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="당첨 취소 사유를 입력해주세요."
                className="w-full resize-none rounded-xl bg-surface-container-lowest px-3 py-2.5 font-body-sm text-body-sm text-on-surface outline-none ring-primary focus:ring-2"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="font-label-xs text-label-xs text-on-error-container">{reason.length}/500</span>
                <button
                  type="button"
                  disabled={busy || !reason.trim()}
                  onClick={disqualify}
                  className="h-9 px-3 rounded-xl bg-error text-on-error font-label-sm text-label-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  당첨 취소
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-space-sm">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="history" className="text-primary text-[20px]" />
            <h3 className="font-title-md text-title-md text-on-surface font-bold">상태 이력</h3>
          </div>
          {loading && <LoadingBlock label="상태 이력을 불러오는 중..." />}
          {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
          {!loading && !error && history.length === 0 && <EmptyBlock icon="history" message="아직 상태 변경 이력이 없어요." />}
          {!loading && !error && history.length > 0 && (
            <ol className="flex flex-col gap-4 pl-3 border-l-2 border-berry-tint">
              {history.map((item) => {
                const itemMeta = statusMeta(item.afterStatus)
                return (
                  <li key={item.historyId} className="relative pl-3">
                    <span className="absolute w-2.5 h-2.5 rounded-full bg-primary -left-[7px] top-1.5" />
                    <div className="flex items-center gap-2">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">{itemMeta.label}</span>
                      <span className="font-label-xs text-label-xs text-on-surface-variant">{formatDateTime(item.changedAt)}</span>
                    </div>
                    {item.reason && <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{item.reason}</p>}
                  </li>
                )
              })}
            </ol>
          )}
        </section>
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
