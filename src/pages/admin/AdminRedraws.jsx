import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRedrawRequest, getRedrawRequest } from '../../api/admin.js'
import { describeError } from '../../api/client.js'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { ErrorBlock, LoadingBlock, StatusPill } from '../../components/ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useUser } from '../../context/useUser.js'
import { useAsync } from '../../hooks/useAsync.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'

const REQUEST_STATUS = {
  REQUESTED: { label: '심사 대기', tone: 'bg-berry-tint text-primary', icon: 'pending' },
  APPROVED: { label: '승인', tone: 'bg-secondary-fixed text-on-secondary-fixed', icon: 'check_circle' },
  REJECTED: { label: '반려', tone: 'bg-error-container text-on-error-container', icon: 'cancel' },
}

const EXECUTION_STATUS = {
  PENDING: { label: '실행 대기', tone: 'bg-surface-container-high text-on-surface-variant', icon: 'schedule' },
  EXECUTED: { label: '실행 완료', tone: 'bg-secondary-fixed text-on-secondary-fixed', icon: 'task_alt' },
  INSUFFICIENT_CANDIDATES: { label: '후보 부족', tone: 'bg-gold-badge-bg text-gold-badge', icon: 'group_off' },
  FAILED: { label: '실행 실패', tone: 'bg-error-container text-on-error-container', icon: 'error' },
}

function metaOf(map, value) {
  return map[value] ?? { label: value ?? '상태 확인 중', tone: 'bg-surface-container-high text-on-surface-variant' }
}

function createIdempotencyKey() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function AdminRedraws() {
  const navigate = useNavigate()
  const { userId } = useUser()
  const showToast = useToast()
  const [eventId, setEventId] = useState('')
  const [reason, setReason] = useState('')
  const [lookupId, setLookupId] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)

  const { data: redraw, loading, error, reload } = useAsync(
    () => getRedrawRequest(selectedId, userId),
    [selectedId, userId],
    { enabled: Boolean(selectedId), fallbackMessage: '재추첨 요청 정보를 불러오지 못했어요.' },
  )

  async function createRequest(event) {
    event.preventDefault()
    const numericEventId = Number(eventId)
    const trimmedReason = reason.trim()
    if (!Number.isInteger(numericEventId) || numericEventId <= 0) {
      showToast('이벤트 ID를 입력해주세요.', { icon: 'error' })
      return
    }
    if (!trimmedReason) {
      showToast('재추첨 사유를 입력해주세요.', { icon: 'error' })
      return
    }

    setBusy(true)
    try {
      const created = await createRedrawRequest(numericEventId, userId, trimmedReason, createIdempotencyKey())
      setSelectedId(created.redrawRequestId)
      setLookupId(String(created.redrawRequestId))
      setReason('')
      showToast(`재추첨 요청 #${created.redrawRequestId}을 생성했어요.`)
    } catch (createError) {
      showToast(describeError(createError, '재추첨 요청을 생성하지 못했어요.'), { icon: 'error' })
    } finally {
      setBusy(false)
    }
  }

  function lookup(event) {
    event.preventDefault()
    const numericId = Number(lookupId)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      showToast('재추첨 요청 ID를 입력해주세요.', { icon: 'error' })
      return
    }
    if (numericId === selectedId) reload()
    else setSelectedId(numericId)
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-8">
      <BackHeader title="재추첨 관리" onBack={() => navigate('/admin')} />

      <main className="pt-16 px-margin flex flex-col gap-space-md">
        <section className="p-space-md rounded-2xl bg-gradient-to-br from-primary via-[#be185d] to-berry-deep text-on-primary shadow-floating relative overflow-hidden">
          <MaterialIcon name="autorenew" filled className="absolute -right-2 -bottom-4 text-[112px] text-primary-fixed/15" />
          <div className="relative flex items-start gap-space-sm">
            <div className="w-11 h-11 rounded-xl bg-primary-fixed/20 flex items-center justify-center shrink-0">
              <MaterialIcon name="shuffle" filled className="text-primary-fixed text-[24px]" />
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">Redraw request</p>
              <h2 className="font-title-lg text-title-lg font-bold mt-1">재추첨 요청 관리</h2>
              <p className="font-body-sm text-body-sm text-primary-fixed mt-1">당첨 취소·포기로 생긴 결원을 기준으로 요청해요.</p>
            </div>
          </div>
        </section>

        <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card">
          <form onSubmit={createRequest} className="flex flex-col gap-space-sm">
            <div className="flex items-center gap-1.5">
              <MaterialIcon name="add_circle" className="text-primary text-[20px]" />
              <h3 className="font-title-md text-title-md text-on-surface font-bold">재추첨 요청 생성</h3>
            </div>
            <label className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface font-semibold">
              이벤트 ID
              <input type="number" min="1" inputMode="numeric" value={eventId} onChange={(event) => setEventId(event.target.value)} placeholder="예: 20" className="h-11 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md text-on-surface outline-none ring-primary focus:ring-2" />
            </label>
            <label className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface font-semibold">
              재추첨 사유
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} placeholder="예: 당첨 취소로 결원이 발생했습니다." className="resize-none rounded-xl bg-surface-container-low px-3 py-2.5 font-body-sm text-body-sm text-on-surface outline-none ring-primary focus:ring-2" />
            </label>
            <div className="flex items-center justify-between gap-2">
              <p className="font-label-xs text-label-xs text-on-surface-variant">결원 수는 서버가 자동 계산해요. {reason.length}/500</p>
              <button type="submit" disabled={busy} className="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold disabled:opacity-50">요청 생성</button>
            </div>
          </form>
        </section>

        <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card">
          <form onSubmit={lookup} className="flex items-end gap-2">
            <label className="min-w-0 flex-1 flex flex-col gap-1 font-label-sm text-label-sm text-on-surface font-semibold">
              재추첨 요청 ID 조회
              <input type="number" min="1" inputMode="numeric" value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="예: 10" className="h-11 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md text-on-surface outline-none ring-primary focus:ring-2" />
            </label>
            <button type="submit" className="h-11 px-3 rounded-xl bg-surface-container-high text-on-surface font-label-sm text-label-sm font-bold">조회</button>
          </form>
        </section>

        {selectedId && loading && <LoadingBlock label="재추첨 요청을 불러오는 중..." />}
        {selectedId && !loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {selectedId && !loading && !error && redraw && <RedrawDetail redraw={redraw} />}
      </main>
    </div>
  )
}

function RedrawDetail({ redraw }) {
  const showToast = useToast()
  const requestMeta = metaOf(REQUEST_STATUS, redraw.status)
  const executionMeta = metaOf(EXECUTION_STATUS, redraw.executionStatus)
  const [rejectReason, setRejectReason] = useState('')

  function notifyPendingApi(action) {
    showToast(`${action} API가 준비되면 바로 처리할 수 있어요.`, { icon: 'info' })
  }

  function reject() {
    if (!rejectReason.trim()) {
      showToast('반려 사유를 입력해주세요.', { icon: 'error' })
      return
    }
    notifyPendingApi('재추첨 반려')
  }

  return (
    <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-space-sm">
      <div className="flex items-start justify-between gap-space-sm">
        <div>
          <p className="font-label-xs text-label-xs text-on-surface-variant">재추첨 요청 #{redraw.redrawRequestId}</p>
          <h3 className="font-title-md text-title-md text-on-surface font-bold mt-1">이벤트 #{redraw.eventId}</h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill label={requestMeta.label} tone={requestMeta.tone} icon={requestMeta.icon} />
          <StatusPill label={executionMeta.label} tone={executionMeta.tone} icon={executionMeta.icon} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-space-sm rounded-xl bg-surface-container-low">
        <Info label="결원" value={`${formatNumber(redraw.vacancyCount)}명`} />
        <Info label="최초 추첨" value={`#${redraw.originalDrawingId}`} />
        <Info label="재추첨 결과" value={redraw.redrawDrawingId ? `#${redraw.redrawDrawingId}` : '아직 없음'} />
        <Info label="요청 일시" value={formatDateTime(redraw.requestedAt)} />
      </div>

      <div className="p-space-sm rounded-xl bg-berry-tint">
        <p className="font-label-xs text-label-xs text-primary font-semibold">요청 사유</p>
        <p className="font-body-sm text-body-sm text-on-surface mt-1">{redraw.reason}</p>
      </div>

      {redraw.rejectReason && (
        <div className="p-space-sm rounded-xl bg-error-container/45">
          <p className="font-label-xs text-label-xs text-on-error-container font-semibold">반려 사유</p>
          <p className="font-body-sm text-body-sm text-on-error-container mt-1">{redraw.rejectReason}</p>
        </div>
      )}

      {redraw.status === 'REQUESTED' && (
        <section className="p-space-sm rounded-xl bg-surface-container-low flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <MaterialIcon name="fact_check" className="text-primary text-[19px]" />
              <h4 className="font-label-md text-label-md text-on-surface font-bold">심사 처리</h4>
            </div>
            <span className="font-label-xs text-label-xs text-on-surface-variant">API 연동 예정</span>
          </div>
          <button type="button" onClick={() => notifyPendingApi('재추첨 승인')} className="w-full h-10 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold active:scale-[0.98] transition-all">
            <MaterialIcon name="check_circle" className="text-[18px] mr-1" />
            재추첨 승인
          </button>
          <div className="p-space-sm rounded-xl bg-error-container/45 flex flex-col gap-2">
            <label htmlFor="reject-reason" className="font-label-sm text-label-sm text-on-error-container font-semibold">반려 사유</label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="반려 사유를 입력해주세요."
              className="w-full resize-none rounded-xl bg-surface-container-lowest px-3 py-2.5 font-body-sm text-body-sm text-on-surface outline-none ring-primary focus:ring-2"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-xs text-label-xs text-on-error-container">{rejectReason.length}/500</span>
              <button type="button" onClick={reject} className="h-9 px-3 rounded-xl bg-error text-on-error font-label-sm text-label-sm font-bold active:scale-[0.98] transition-all">
                반려
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-label-sm text-label-sm text-on-surface font-semibold">고정된 결원 당첨자</p>
        {redraw.vacancyWinners?.length ? redraw.vacancyWinners.map((winner) => (
          <div key={winner.winnerId} className="flex items-center justify-between gap-2 p-space-sm rounded-xl bg-surface-container-low">
            <div className="min-w-0">
              <p className="font-label-md text-label-md text-on-surface font-semibold truncate">{winner.name}</p>
              <p className="font-label-xs text-label-xs text-on-surface-variant">당첨자 #{winner.winnerId} · 사용자 #{winner.userId}</p>
            </div>
            <span className="font-label-sm text-label-sm text-primary font-bold shrink-0">{winner.rankInDrawing}위</span>
          </div>
        )) : <p className="font-body-sm text-body-sm text-on-surface-variant">고정된 결원 당첨자 정보가 없어요.</p>}
      </div>
    </section>
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
