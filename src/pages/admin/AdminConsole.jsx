import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import { LoadingBlock, ErrorBlock, EmptyBlock, StatusPill } from '../../components/ui/States.jsx'
import AdminDrawingPanel from './AdminDrawingPanel.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import {
  approveCreatorApplication,
  approveEvent,
  getCreatorApplications,
  getPendingEvents,
  rejectCreatorApplication,
  rejectEvent,
} from '../../api/admin.js'
import { describeError } from '../../api/client.js'
import { formatDateTime, formatNumber, totalPrizeQuantity } from '../../utils/format.js'
import { CREATOR_APPLICATION_STATUS_META } from '../../utils/eventStatus.js'

const TABS = [
  { id: 'events', label: '이벤트 승인', icon: 'fact_check' },
  { id: 'applications', label: '크리에이터 신청', icon: 'how_to_reg' },
  { id: 'drawings', label: '추첨 운영', icon: 'casino' },
]

/**
 * 관리자 콘솔.
 * 이벤트 승인 심사, 크리에이터 전환 신청 심사, 추첨 운영을 한 화면에서 처리한다.
 */
export default function AdminConsole() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('events')

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-24">
      <BackHeader title="관리자 콘솔" onBack={() => navigate('/my-page')} />

      <div className="pt-16 px-margin flex flex-col gap-space-md">
        <div className="flex items-center gap-space-xs p-1 rounded-xl bg-surface-container-low">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 py-2 rounded-lg font-label-sm text-label-sm flex items-center justify-center gap-1 transition-colors ${
                tab === item.id
                  ? 'bg-surface shadow-sm text-primary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <MaterialIcon name={item.icon} className="text-[16px]" />
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'events' && <PendingEvents />}
        {tab === 'applications' && <CreatorApplications />}
        {tab === 'drawings' && <AdminDrawingPanel />}
      </div>
    </div>
  )
}

function PendingEvents() {
  const showToast = useToast()
  const { userId } = useUser()
  const [busyId, setBusyId] = useState(null)

  const { data, loading, error, reload } = useAsync(
    () => getPendingEvents(userId, { size: 50 }),
    [userId],
    { fallbackMessage: '승인 대기 목록을 불러오지 못했습니다.' },
  )

  const items = data?.items ?? []

  async function decide(eventId, approve, title) {
    let reason = null
    if (!approve) {
      reason = window.prompt(`"${title}" 이벤트를 거절하는 사유를 입력해주세요.`)
      if (!reason?.trim()) return
    }
    setBusyId(eventId)
    try {
      if (approve) await approveEvent(eventId, userId)
      else await rejectEvent(eventId, userId, reason.trim())
      showToast(approve ? '이벤트를 승인했어요.' : '이벤트를 거절했어요.')
      await reload()
    } catch (err) {
      showToast(describeError(err, '심사 처리에 실패했습니다.'), { icon: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <LoadingBlock label="승인 대기 이벤트를 불러오는 중..." />
  if (error) return <ErrorBlock message={error} onRetry={reload} />
  if (items.length === 0) return <EmptyBlock icon="done_all" message="승인을 기다리는 이벤트가 없어요." />

  return (
    <div className="flex flex-col gap-space-sm">
      {items.map((item) => (
        <article
          key={`${item.eventId}-${item.approvalRound}`}
          className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-space-sm"
        >
          <div className="flex items-start justify-between gap-space-sm">
            <div className="min-w-0">
              <p className="font-title-md text-title-md text-on-surface font-bold truncate">{item.title}</p>
              <p className="font-label-xs text-label-xs text-on-surface-variant mt-0.5">
                #{item.eventId} · {item.creatorName} · {item.approvalRound}차 요청
              </p>
            </div>
            <StatusPill label="승인 대기" tone="bg-gold-badge-bg text-gold-badge" className="shrink-0" />
          </div>

          <div className="flex flex-col gap-1 font-label-xs text-label-xs text-on-surface-variant">
            <span>
              기간 {formatDateTime(item.startAt)} ~ {formatDateTime(item.endAt)}
            </span>
            <span>
              당첨 {formatNumber(item.winnerCount)}명 · 상품 {formatNumber(totalPrizeQuantity(item.prizes))}개 ·{' '}
              {item.drawMethod}
            </span>
            <span>요청일 {formatDateTime(item.requestedAt)}</span>
          </div>

          {item.prizes?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.prizes.map((prize) => (
                <span
                  key={prize.prizeKey}
                  className="px-2 py-0.5 rounded-full bg-surface-container-low font-label-xs text-label-xs text-on-surface-variant"
                >
                  {prize.displayName} × {prize.quantity}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busyId === item.eventId}
              onClick={() => decide(item.eventId, false, item.title)}
              className="h-10 rounded-xl bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50"
            >
              거절
            </button>
            <button
              type="button"
              disabled={busyId === item.eventId}
              onClick={() => decide(item.eventId, true, item.title)}
              className="h-10 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50"
            >
              승인
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

function CreatorApplications() {
  const showToast = useToast()
  const { userId } = useUser()
  const [busyId, setBusyId] = useState(null)

  const { data, loading, error, reload } = useAsync(
    () => getCreatorApplications(userId, { size: 50 }),
    [userId],
    { fallbackMessage: '크리에이터 신청 목록을 불러오지 못했습니다.' },
  )

  const items = data?.items ?? []

  async function decide(applicationId, approve, name) {
    let reason = null
    if (!approve) {
      reason = window.prompt(`${name}님의 크리에이터 신청을 거절하는 사유를 입력해주세요.`)
      if (!reason?.trim()) return
    }
    setBusyId(applicationId)
    try {
      if (approve) await approveCreatorApplication(applicationId, userId)
      else await rejectCreatorApplication(applicationId, userId, reason.trim())
      showToast(approve ? '크리에이터 신청을 승인했어요.' : '신청을 거절했어요.')
      await reload()
    } catch (err) {
      showToast(describeError(err, '심사 처리에 실패했습니다.'), { icon: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <LoadingBlock label="신청 목록을 불러오는 중..." />
  if (error) return <ErrorBlock message={error} onRetry={reload} />
  if (items.length === 0) return <EmptyBlock icon="how_to_reg" message="접수된 크리에이터 신청이 없어요." />

  return (
    <div className="flex flex-col gap-space-sm">
      {items.map((item) => {
        const meta = CREATOR_APPLICATION_STATUS_META[item.status] ?? { label: item.status }
        const pending = item.status === 'PENDING'
        return (
          <article
            key={item.applicationId}
            className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-space-sm"
          >
            <div className="flex items-start justify-between gap-space-sm">
              <div className="min-w-0">
                <p className="font-title-md text-title-md text-on-surface font-bold truncate">
                  {item.applicantName} (#{item.applicantUserId})
                </p>
                <p className="font-label-xs text-label-xs text-on-surface-variant mt-0.5">
                  신청 #{item.applicationId} · {formatDateTime(item.requestedAt)}
                </p>
              </div>
              <StatusPill label={meta.label} tone={meta.tone} icon={meta.icon} className="shrink-0" />
            </div>

            {item.reviewedAt && (
              <p className="font-label-xs text-label-xs text-on-surface-variant">
                심사 {formatDateTime(item.reviewedAt)}
                {item.reviewedBy ? ` · 심사자 #${item.reviewedBy}` : ''}
              </p>
            )}
            {item.rejectReason && (
              <p className="font-body-sm text-body-sm text-error">거절 사유: {item.rejectReason}</p>
            )}

            {pending && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busyId === item.applicationId}
                  onClick={() => decide(item.applicationId, false, item.applicantName)}
                  className="h-10 rounded-xl bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  거절
                </button>
                <button
                  type="button"
                  disabled={busyId === item.applicationId}
                  onClick={() => decide(item.applicationId, true, item.applicantName)}
                  className="h-10 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  승인
                </button>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
