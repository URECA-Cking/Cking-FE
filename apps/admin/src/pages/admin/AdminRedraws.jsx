import { useState } from 'react'
import {
  approveRedrawRequest,
  createRedrawRequest,
  executeRedrawRequest,
  getRedrawRequest,
  getRedrawRequests,
  rejectRedrawRequest,
  retryDrawing,
} from '../../api/admin.js'
import { describeError } from '../../api/client.js'
import MaterialIcon from '../../components/MaterialIcon.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
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

/** 상태 값을 화면용 표시 정보로 변환한다. */
function metaOf(map, value) {
  return map[value] ?? { label: value ?? '상태 확인 중', tone: 'bg-surface-container-high text-on-surface-variant' }
}
/** 재추첨 생성 요청에 사용할 멱등 키를 생성한다. */
function createIdempotencyKey() {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** 재추첨 요청 목록과 상세 심사·실행 흐름을 제공한다. */
export default function AdminRedraws() {
  const showToast = useToast()
  const [eventId, setEventId] = useState('')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [creating, setCreating] = useState(false)
  const { data: list, loading: listLoading, error: listError, reload: reloadList } = useAsync(
    () => getRedrawRequests({ status: status || undefined, page, size: 20 }),
    [status, page],
    { fallbackMessage: '재추첨 요청 목록을 불러오지 못했어요.' },
  )
  const { data: redraw, loading, error, reload } = useAsync(
    () => getRedrawRequest(selectedId), [selectedId],
    { enabled: Boolean(selectedId), fallbackMessage: '재추첨 요청 정보를 불러오지 못했어요.' },
  )
  const items = list?.items ?? []

  /** 새 요청을 생성하고 목록과 상세를 갱신한다. */
  async function createRequest(event) {
    event.preventDefault()
    const numericEventId = Number(eventId)
    const trimmedReason = reason.trim()
    if (!Number.isInteger(numericEventId) || numericEventId <= 0) return showToast('이벤트 ID를 입력해주세요.', { icon: 'error' })
    if (!trimmedReason) return showToast('재추첨 사유를 입력해주세요.', { icon: 'error' })
    setCreating(true)
    try {
      const created = await createRedrawRequest(numericEventId, trimmedReason, createIdempotencyKey())
      setSelectedId(created.redrawRequestId)
      setReason('')
      showToast(`재추첨 요청 #${created.redrawRequestId}을 생성했어요.`)
      await reloadList()
    } catch (error) {
      showToast(describeError(error, '재추첨 요청을 생성하지 못했어요.'), { icon: 'error' })
    } finally { setCreating(false) }
  }
  /** 목록 필터를 바꾸고 첫 페이지를 조회한다. */
  function selectStatus(nextStatus) { setStatus(nextStatus); setPage(0) }
  /** 상세 명령 후 목록과 상세를 최신 상태로 갱신한다. */
  async function refreshOperation() { await Promise.all([reload(), reloadList()]) }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-space-md">
      <div className="border-b border-slate-200 pb-4"><p className="text-sm text-slate-500">이벤트 운영</p><h1 className="mt-1 text-xl font-semibold text-slate-950">재추첨 관리</h1></div>
        <section className="p-space-md rounded-2xl bg-gradient-to-br from-primary via-[#be185d] to-berry-deep text-on-primary shadow-floating">
          <p className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">Redraw request</p><h2 className="font-title-lg text-title-lg font-bold mt-1">재추첨 요청 관리</h2><p className="font-body-sm text-body-sm text-primary-fixed mt-1">요청 목록에서 심사와 실행 상태를 안전하게 처리하세요.</p>
        </section>
        <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card">
          <form onSubmit={createRequest} className="flex flex-col gap-space-sm">
            <h3 className="font-title-md text-title-md text-on-surface font-bold">재추첨 요청 생성</h3>
            <label className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface font-semibold">이벤트 ID<input type="number" min="1" inputMode="numeric" value={eventId} onChange={(event) => setEventId(event.target.value)} placeholder="예: 20" className="h-11 rounded-xl bg-surface-container-low px-3" /></label>
            <label className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface font-semibold">재추첨 사유<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} placeholder="재추첨 사유" className="resize-none rounded-xl bg-surface-container-low px-3 py-2.5" /></label>
            <div className="flex items-center justify-between"><span className="font-label-xs text-label-xs text-on-surface-variant">결원 수는 서버가 계산해요. {reason.length}/500</span><button type="submit" disabled={creating} className="h-10 px-4 rounded-xl bg-primary text-on-primary font-bold disabled:opacity-50">요청 생성</button></div>
          </form>
        </section>
        <RedrawList items={items} list={list} loading={listLoading} error={listError} status={status} page={page} selectedId={selectedId} onStatus={selectStatus} onSelect={setSelectedId} onPage={setPage} onRetry={reloadList} />
        {selectedId && loading && <LoadingBlock label="재추첨 요청을 불러오는 중..." />}
        {selectedId && !loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {redraw?.redrawRequestId === selectedId && !loading && (
          <RedrawDetail redraw={redraw} onChanged={refreshOperation} />
        )}
    </div>
  )
}

/** 상태별 재추첨 요청 목록과 페이지 이동을 표시한다. */
function RedrawList({ items, list, loading, error, status, page, selectedId, onStatus, onSelect, onPage, onRetry }) {
  return (
    <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-2">
      <div className="flex justify-between">
        <h3 className="font-title-md text-title-md text-on-surface font-bold">재추첨 요청 목록</h3>
        <span className="font-label-xs text-label-xs text-on-surface-variant">최신 요청순</span>
      </div>
      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-surface-container-low">
        {[['', '전체'], ...Object.entries(REQUEST_STATUS).map(([value, meta]) => [value, meta.label])].map(([value, label]) => (
          <button key={value} type="button" onClick={() => onStatus(value)} className={`h-9 rounded-lg font-label-xs font-semibold ${status === value ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>{label}</button>
        ))}
      </div>
      {loading && <LoadingBlock label="재추첨 요청 목록을 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={onRetry} />}
      {!loading && !error && items.length === 0 && <EmptyBlock icon="autorenew" message="조건에 맞는 재추첨 요청이 없어요." />}
      {!loading && !error && items.map((item) => (
        <button key={item.redrawRequestId} type="button" onClick={() => onSelect(item.redrawRequestId)} className={`p-space-sm rounded-xl text-left flex justify-between gap-2 ${selectedId === item.redrawRequestId ? 'bg-berry-tint border border-primary' : 'bg-surface-container-low'}`}>
          <div><p className="font-label-md text-label-md text-on-surface font-semibold">이벤트 #{item.eventId} · 요청 #{item.redrawRequestId}</p><p className="font-label-xs text-label-xs text-on-surface-variant">결원 {formatNumber(item.vacancyCount)}명 · {formatDateTime(item.requestedAt)}</p></div>
          <div><StatusPill {...metaOf(REQUEST_STATUS, item.status)} /><StatusPill {...metaOf(EXECUTION_STATUS, item.executionStatus)} /></div>
        </button>
      ))}
      {list?.totalPages > 1 && <div className="flex items-center justify-between"><button type="button" disabled={page === 0} onClick={() => onPage((value) => value - 1)} className="h-10 px-3 rounded-xl bg-surface-container-low disabled:opacity-40">이전</button><span>{page + 1} / {list.totalPages}</span><button type="button" disabled={!list.hasNext} onClick={() => onPage((value) => value + 1)} className="h-10 px-3 rounded-xl bg-surface-container-low disabled:opacity-40">다음</button></div>}
    </section>
  )
}

/** 선택한 요청의 고정 결원, 심사, 실행 정보를 표시한다. */
function RedrawDetail({ redraw, onChanged }) {
  const showToast = useToast(); const [rejectReason, setRejectReason] = useState(''); const [busy, setBusy] = useState(false)
  /** 요청 명령을 실행하고 갱신한다. */
  async function run(action, success, fallback) { setBusy(true); try { await action(); showToast(success); await onChanged() } catch (error) { showToast(describeError(error, fallback), { icon: 'error' }) } finally { setBusy(false) } }
  /** 요청을 승인한다. */
  function approve() { return run(() => approveRedrawRequest(redraw.redrawRequestId), '재추첨 요청을 승인했어요.', '재추첨 요청을 승인하지 못했어요.') }
  /** 입력한 사유로 요청을 반려한다. */
  function reject() { const reason = rejectReason.trim(); if (!reason) return showToast('반려 사유를 입력해주세요.', { icon: 'error' }); return run(() => rejectRedrawRequest(redraw.redrawRequestId, reason), '재추첨 요청을 반려했어요.', '재추첨 요청을 반려하지 못했어요.') }
  /** 재추첨 실행 결과에 맞는 안내를 표시한다. */
  async function execute() { setBusy(true); try { const result = await executeRedrawRequest(redraw.redrawRequestId); showToast(result.executionStatus === 'EXECUTED' ? '재추첨을 실행했어요.' : result.executionStatus === 'INSUFFICIENT_CANDIDATES' ? '후보가 부족하여 재추첨을 완료하지 못했어요.' : '재추첨 실행 결과를 확인해주세요.'); await onChanged() } catch (error) { showToast(describeError(error, '재추첨을 실행하지 못했어요.'), { icon: 'error' }) } finally { setBusy(false) } }
  /** 실패한 REDRAW Drawing을 보존된 입력으로 다시 실행한다. */
  async function retryFailedDrawing() {
    if (!redraw.redrawDrawingId) return
    setBusy(true)
    try {
      await retryDrawing(redraw.redrawDrawingId)
      showToast('기존 추첨 입력과 Seed를 재사용해 재추첨을 다시 실행했어요.')
      await onChanged()
    } catch (error) {
      showToast(describeError(error, '재추첨을 다시 실행하지 못했어요.'), { icon: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-card flex flex-col gap-3">
      <div className="flex justify-between"><div><p className="font-label-xs text-label-xs text-on-surface-variant">재추첨 요청 #{redraw.redrawRequestId}</p><h3 className="font-title-md text-title-md text-on-surface font-bold">이벤트 #{redraw.eventId}</h3></div><div><StatusPill {...metaOf(REQUEST_STATUS, redraw.status)} /><StatusPill {...metaOf(EXECUTION_STATUS, redraw.executionStatus)} /></div></div>
      <div className="grid grid-cols-2 gap-2 p-space-sm rounded-xl bg-surface-container-low md:grid-cols-4"><Info label="결원" value={`${formatNumber(redraw.vacancyCount)}명`} /><Info label="최초 추첨" value={`#${redraw.originalDrawingId}`} /><Info label="재추첨 결과" value={redraw.redrawDrawingId ? `#${redraw.redrawDrawingId}` : '아직 없음'} /><Info label="요청 일시" value={formatDateTime(redraw.requestedAt)} /></div>
      <p className="p-3 rounded-xl bg-berry-tint">{redraw.reason}</p>
      {redraw.status === 'REQUESTED' && <><button type="button" disabled={busy} onClick={approve} className="h-10 rounded-xl bg-primary text-on-primary font-bold">재추첨 승인</button><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} maxLength={500} rows={3} placeholder="반려 사유" className="rounded-xl bg-error-container/45 px-3 py-2" /><button type="button" disabled={busy || !rejectReason.trim()} onClick={reject} className="h-10 rounded-xl bg-error text-on-error font-bold">반려</button></>}
      {redraw.status === 'APPROVED' && redraw.executionStatus === 'PENDING' && <button type="button" disabled={busy} onClick={execute} className="h-11 rounded-xl bg-primary text-on-primary font-bold"><MaterialIcon name="casino" className="mr-1" />재추첨 실행</button>}
      {redraw.executionStatus === 'FAILED' && redraw.redrawDrawingId && <button type="button" disabled={busy} onClick={retryFailedDrawing} className="h-11 rounded-xl bg-error text-on-error font-bold"><MaterialIcon name="refresh" className="mr-1" />실패한 재추첨 다시 실행</button>}
      {redraw.rejectReason && <p className="text-error">반려 사유: {redraw.rejectReason}</p>}
      <div className="flex flex-col gap-2"><p className="font-label-sm text-label-sm text-on-surface font-semibold">고정된 결원 당첨자</p>{redraw.vacancyWinners?.length ? redraw.vacancyWinners.map((winner) => <div key={winner.winnerId} className="flex justify-between p-space-sm rounded-xl bg-surface-container-low"><div><p className="font-label-md text-label-md text-on-surface font-semibold">{winner.name}</p><p className="font-label-xs text-label-xs text-on-surface-variant">당첨자 #{winner.winnerId} · 사용자 #{winner.userId}</p></div><span className="text-primary font-bold">{winner.rankInDrawing}위</span></div>) : <p className="font-body-sm text-body-sm text-on-surface-variant">고정된 결원 당첨자 정보가 없어요.</p>}</div>
    </section>
  )
}
/** 라벨과 값을 표시한다. */
function Info({ label, value }) { return <div><p className="font-label-xs text-label-xs text-on-surface-variant">{label}</p><p className="font-label-sm text-label-sm text-on-surface font-semibold">{value}</p></div> }
