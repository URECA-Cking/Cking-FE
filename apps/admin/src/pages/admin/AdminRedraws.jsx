import { useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { approveRedrawRequest, createRedrawRequest, executeRedrawRequest, getRedrawRequest, getRedrawRequests, rejectRedrawRequest, retryDrawing } from '../../api/admin.js'
import { describeError } from '../../api/client.js'
import { AdminPageHeader, DetailInfoRows } from '../../components/AdminContent.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import MaterialIcon from '../../components/MaterialIcon.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'
import { createIdempotencyKey } from '../../utils/redrawRequest.js'

const REQUEST_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED']
const EXECUTION_STATUSES = ['PENDING', 'EXECUTED', 'FAILED', 'INSUFFICIENT_CANDIDATES']
const reviewLabels = { REQUESTED: '검토 대기', APPROVED: '승인', REJECTED: '거절' }
const executionLabels = { PENDING: '실행 대기', EXECUTED: '실행 완료', FAILED: '실행 실패', INSUFFICIENT_CANDIDATES: '후보 부족' }

/** 목록 응답만 Table에 사용하고, 상세 진입 뒤에만 단건 요청을 조회한다. */
export default function AdminRedraws() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const status = searchParams.get('status') ?? ''
  const executionStatus = searchParams.get('executionStatus') ?? ''
  const list = useAsync(
    () => getRedrawRequests({ status: status || undefined, executionStatus: executionStatus || undefined, page, size: 20 }),
    [status, executionStatus, page],
    { fallbackMessage: '재추첨 요청 목록을 불러오지 못했습니다.' },
  )
  const items = useMemo(() => {
    const value = keyword.trim().toLowerCase()
    if (!value) return list.data?.items ?? []
    return (list.data?.items ?? []).filter((item) => [item.redrawRequestId, item.eventId].some((field) => String(field).toLowerCase().includes(value)))
  }, [keyword, list.data?.items])

  function changeFilters(nextStatus, nextExecutionStatus) {
    setPage(0)
    const params = {}
    if (nextStatus) params.status = nextStatus
    if (nextExecutionStatus) params.executionStatus = nextExecutionStatus
    setSearchParams(params)
  }

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <AdminPageHeader title="재추첨 관리" description="결원이 발생한 이벤트의 재추첨 요청을 검토하고 실행합니다.">
      <button type="button" onClick={() => setCreateOpen(true)} className="h-9 rounded-md bg-pink-700 px-3 text-sm font-semibold text-white hover:bg-pink-800">재추첨 요청 생성</button>
    </AdminPageHeader>
    <section className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <label className="flex flex-1 flex-col gap-1 text-xs text-slate-500">현재 페이지 내 검색<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="요청 ID 또는 Event ID 검색" className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900" /></label>
      <select value={status} onChange={(event) => changeFilters(event.target.value, executionStatus)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"><option value="">심사 상태: 전체</option>{REQUEST_STATUSES.map((value) => <option key={value} value={value}>{reviewLabels[value]}</option>)}</select>
      <select value={executionStatus} onChange={(event) => changeFilters(status, event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"><option value="">실행 상태: 전체</option>{EXECUTION_STATUSES.map((value) => <option key={value} value={value}>{executionLabels[value]}</option>)}</select>
      <button type="button" onClick={() => void list.reload()} className="inline-flex h-10 items-center justify-center gap-1 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><MaterialIcon name="refresh" className="text-[18px]" />새로고침</button>
    </div></section>
    <section className="rounded-lg border border-slate-200 bg-white"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-base font-semibold text-slate-950">재추첨 요청 목록</h2><p className="mt-0.5 text-xs text-slate-500">심사 상태와 재추첨 실행 상태는 별도로 표시됩니다.</p></div>
      <RedrawTable items={items} loading={list.loading} error={list.error} filtered={Boolean(keyword || status || executionStatus)} onRetry={list.reload} />
      {!list.loading && !list.error && list.data?.totalPages > 1 && <Pagination page={page} list={list.data} onPage={setPage} />}
    </section>
    {createOpen && <CreateRedrawModal onCancel={() => setCreateOpen(false)} onCreated={async () => { setCreateOpen(false); await list.reload() }} />}
  </div>
}

function RedrawTable({ items, loading, error, filtered, onRetry }) {
  if (loading) return <LoadingBlock label="재추첨 요청 목록을 불러오는 중..." />
  if (error) return <ErrorBlock message={error} onRetry={onRetry} />
  if (!items.length) return <EmptyBlock icon="autorenew" message={filtered ? '검색 조건에 해당하는 재추첨 요청이 없습니다.' : '현재 재추첨 요청이 없습니다.'} />
  return <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs font-medium text-slate-500"><tr><th className="px-5 py-3">요청 ID</th><th className="px-4 py-3">Event ID</th><th className="px-4 py-3">심사 상태</th><th className="px-4 py-3">실행 상태</th><th className="px-4 py-3">결원</th><th className="px-4 py-3">요청 시각</th><th className="px-5 py-3 text-right">관리</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.redrawRequestId} className="hover:bg-slate-50"><td className="px-5 py-3 font-medium text-slate-900">#{item.redrawRequestId}</td><td className="px-4 py-3 text-slate-700">#{item.eventId}</td><td className="px-4 py-3"><StatusBadge type="redraw-review" status={item.status} /></td><td className="px-4 py-3"><StatusBadge type="redraw-execution" status={item.executionStatus} /></td><td className="px-4 py-3 text-slate-700">{item.vacancyCount == null ? '-' : `${formatNumber(item.vacancyCount)}명`}</td><td className="px-4 py-3 text-slate-600">{formatDateTime(item.requestedAt)}</td><td className="px-5 py-3 text-right"><Link to={`/admin/redraws/${item.redrawRequestId}`} className="font-medium text-pink-700 hover:text-pink-800">상세 보기</Link></td></tr>)}</tbody></table></div>
}

function Pagination({ page, list, onPage }) { return <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm"><button type="button" disabled={page === 0} onClick={() => onPage((value) => value - 1)} className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40">이전</button><span>{page + 1} / {list.totalPages}</span><button type="button" disabled={!list.hasNext} onClick={() => onPage((value) => value + 1)} className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40">다음</button></div> }

function CreateRedrawModal({ onCancel, onCreated }) {
  const showToast = useToast(); const [eventId, setEventId] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const idempotencyKeyRef = useRef(null)
  async function submit(event) { event.preventDefault(); const id = Number(eventId); if (!Number.isInteger(id) || id <= 0) return showToast('Event ID를 입력해주세요.', { icon: 'error' }); if (!reason.trim()) return showToast('재추첨 사유를 입력해주세요.', { icon: 'error' }); const idempotencyKey = idempotencyKeyRef.current ?? createIdempotencyKey(); idempotencyKeyRef.current = idempotencyKey; setBusy(true); try { const created = await createRedrawRequest(id, reason.trim(), idempotencyKey); idempotencyKeyRef.current = null; showToast(`재추첨 요청 #${created.redrawRequestId}을 생성했습니다.`); await onCreated() } catch (error) { showToast(describeError(error, '재추첨 요청을 생성하지 못했습니다.'), { icon: 'error' }) } finally { setBusy(false) } }
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4"><form onSubmit={submit} role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg bg-white p-6 shadow-floating"><h2 className="text-lg font-semibold text-slate-950">재추첨 요청 생성</h2><p className="mt-2 text-sm leading-6 text-slate-600">결원 수와 재추첨 가능 여부는 서버가 판단합니다.</p><label className="mt-5 block text-sm font-medium">Event ID<input type="number" min="1" required value={eventId} disabled={busy} onChange={(event) => setEventId(event.target.value)} className="mt-2 block h-10 w-full rounded-md border border-slate-300 px-3" /></label><label className="mt-4 block text-sm font-medium">요청 사유<textarea required rows="4" maxLength="500" value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2" /></label><div className="mt-6 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onCancel} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium">취소</button><button type="submit" disabled={busy} className="h-9 rounded-md bg-pink-700 px-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? '요청 생성 중...' : '요청 생성'}</button></div></form></div>
}

/** 요청 정보, 고정 결원 당첨자, 상태별 Action Panel을 독립 페이지에 표시한다. */
export function AdminRedrawDetailPage() {
  const { redrawRequestId } = useParams(); const showToast = useToast(); const [action, setAction] = useState(null); const [busy, setBusy] = useState(false)
  const detail = useAsync(() => getRedrawRequest(redrawRequestId), [redrawRequestId], { fallbackMessage: '재추첨 요청 정보를 불러오지 못했습니다.' })
  async function run(reason) { const redraw = detail.data; if (!redraw || !action) return; setBusy(true); try { if (action === 'approve') await approveRedrawRequest(redraw.redrawRequestId); else if (action === 'reject') await rejectRedrawRequest(redraw.redrawRequestId, reason); else if (action === 'execute') await executeRedrawRequest(redraw.redrawRequestId); else await retryDrawing(redraw.redrawDrawingId); showToast({ approve: '재추첨 요청을 승인했습니다.', reject: '재추첨 요청을 거절했습니다.', execute: '재추첨 실행 요청을 처리했습니다.', retry: '재추첨 Drawing을 다시 실행했습니다.' }[action]); setAction(null); await detail.reload() } catch (error) { showToast(describeError(error, '요청을 처리하지 못했습니다.'), { icon: 'error' }) } finally { setBusy(false) } }
  if (detail.loading) return <LoadingBlock label="재추첨 요청을 불러오는 중..." />
  if (detail.error) return <ErrorBlock message={detail.error} onRetry={detail.reload} />
  const redraw = detail.data; if (!redraw) return <EmptyBlock icon="autorenew" message="해당 재추첨 요청을 찾을 수 없습니다." />
  const drawingLink = redraw.redrawDrawingId ? `/admin/drawings/${redraw.redrawDrawingId}?eventId=${redraw.eventId}` : null
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6"><div><Link to="/admin/redraws" className="text-sm font-medium text-pink-700 hover:text-pink-800">← 재추첨 목록</Link><h1 className="mt-3 text-xl font-semibold text-slate-950">재추첨 요청 #{redraw.redrawRequestId}</h1><p className="mt-1 text-sm text-slate-500">Event #{redraw.eventId}</p></div><Progress redraw={redraw} /><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]"><section className="border-y border-slate-200 bg-white"><DetailInfoRows title="요청 정보" rows={[["RedrawRequest ID", redraw.redrawRequestId], ["Event ID", redraw.eventId], ["요청 사유", redraw.reason], ["요청 시각", formatDateTime(redraw.requestedAt)], ["요청자", redraw.requestedBy ? `#${redraw.requestedBy}` : '-']]} /><DetailInfoRows title="재추첨 조건" rows={[["결원 수", redraw.vacancyCount == null ? '-' : `${formatNumber(redraw.vacancyCount)}명`], ["원본 Drawing ID", redraw.originalDrawingId ? `#${redraw.originalDrawingId}` : '-'], ["재추첨 Drawing ID", redraw.redrawDrawingId ? `#${redraw.redrawDrawingId}` : '-']]} /><VacancyWinners winners={redraw.vacancyWinners} /><DetailInfoRows title="심사 정보" rows={[["심사 상태", <StatusBadge key="review" type="redraw-review" status={redraw.status} />], ["실행 상태", <StatusBadge key="execution" type="redraw-execution" status={redraw.executionStatus} />], ["심사자", redraw.reviewedBy ? `#${redraw.reviewedBy}` : '-'], ["심사 일시", redraw.reviewedAt ? formatDateTime(redraw.reviewedAt) : '-'], ["거절 사유", redraw.rejectReason ?? '-']]} />{redraw.executionStatus === 'INSUFFICIENT_CANDIDATES' && <section className="border-b border-amber-200 bg-amber-50 px-5 py-5"><h2 className="text-sm font-semibold text-amber-950">후보 부족</h2><p className="mt-1 text-sm leading-6 text-amber-900">서버 판단 결과 남은 후보가 결원 수에 미치지 않아 재추첨을 진행할 수 없습니다.</p></section>}{drawingLink && <section className="border-b border-slate-200 px-5 py-5"><h2 className="text-sm font-semibold">재추첨 Drawing</h2><p className="mt-1 text-sm text-slate-600">생성된 Drawing의 결과·검증·공개는 추첨 관리에서 처리합니다.</p><Link to={drawingLink} className="mt-3 inline-block text-sm font-medium text-pink-700 hover:text-pink-800">재추첨 결과 확인 →</Link></section>}</section><ActionPanel redraw={redraw} busy={busy} onAction={setAction} onRefresh={detail.reload} /></div>{action && <ConfirmModal action={action === 'reject' ? 'reject' : 'confirm'} subject={`재추첨 요청 #${redraw.redrawRequestId}`} busy={busy} onCancel={() => setAction(null)} onConfirm={(reason) => void run(reason)} {...confirmCopy(action)} />}</div>
}

function VacancyWinners({ winners }) { return <section className="border-b border-slate-200 px-5 py-5"><h2 className="text-sm font-semibold text-slate-900">고정된 결원 당첨자</h2>{winners?.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2">당첨자</th><th className="px-3 py-2">회원 ID</th><th className="px-3 py-2 text-right">원본 추첨 순위</th></tr></thead><tbody className="divide-y divide-slate-100">{winners.map((winner) => <tr key={winner.winnerId}><td className="px-3 py-3"><p className="font-medium text-slate-900">{winner.name ?? '-'}</p><p className="text-xs text-slate-500">Winner #{winner.winnerId}</p></td><td className="px-3 py-3 text-slate-700">#{winner.userId}</td><td className="px-3 py-3 text-right text-slate-700">{winner.rankInDrawing == null ? '-' : `${winner.rankInDrawing}위`}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-slate-500">고정된 결원 당첨자 정보가 없습니다.</p>}</section> }
function ActionPanel({ redraw, busy, onAction, onRefresh }) { const canExecute = redraw.status === 'APPROVED' && redraw.executionStatus === 'PENDING'; return <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">현재 가능한 작업</h2><div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">{redraw.status === 'REQUESTED' && <><p>검토 대기 요청입니다. 승인하면 재추첨 실행이 가능해집니다.</p><button type="button" disabled={busy} onClick={() => onAction('approve')} className="h-10 w-full rounded-md bg-pink-700 px-3 font-semibold text-white disabled:opacity-50">승인</button><button type="button" disabled={busy} onClick={() => onAction('reject')} className="h-10 w-full rounded-md border border-red-200 bg-red-50 px-3 font-semibold text-red-800 disabled:opacity-50">거절</button></>}{canExecute && <><p>승인되었고 실행 대기 상태입니다. 서버가 확정한 조건을 기준으로 재추첨을 실행합니다.</p><button type="button" disabled={busy} onClick={() => onAction('execute')} className="h-10 w-full rounded-md bg-pink-700 px-3 font-semibold text-white disabled:opacity-50">재추첨 실행</button></>}{redraw.status === 'REJECTED' && <p>거절된 요청입니다. 추가 실행 작업은 제공되지 않습니다.</p>}{redraw.executionStatus === 'EXECUTED' && <p>재추첨 실행이 완료되었습니다. 생성된 Drawing에서 결과를 확인하세요.</p>}{redraw.executionStatus === 'FAILED' && (redraw.redrawDrawingId ? <><p>재추첨 Drawing 실행에 실패했습니다. 기존 Drawing과 Seed를 재사용해 다시 시도할 수 있습니다.</p><button type="button" disabled={busy} onClick={() => onAction('retry')} className="h-10 w-full rounded-md border border-red-200 bg-red-50 px-3 font-semibold text-red-800 disabled:opacity-50">Drawing 다시 시도</button></> : <p>재추첨 실행에 실패했으며 생성된 Drawing이 없어 재시도할 수 없습니다.</p>)}{redraw.executionStatus === 'INSUFFICIENT_CANDIDATES' && <p>후보 부족은 정상적인 비즈니스 결과입니다. 부분 재추첨은 제공되지 않습니다.</p>}<button type="button" disabled={busy} onClick={() => void onRefresh()} className="w-full text-sm font-medium text-pink-700 hover:text-pink-800">새로고침</button></div></aside> }
function Progress({ redraw }) { if (redraw.status === 'REJECTED') return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">재추첨 진행</h2><p className="mt-3 text-sm text-slate-600">요청은 거절되어 실행 단계로 진행하지 않습니다.</p><div className="mt-3 flex gap-2 text-xs font-semibold"><span className="rounded-full bg-pink-50 px-3 py-1.5 text-pink-700">요청 ✓</span><span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700">거절됨</span></div></section>; const approved = redraw.status === 'APPROVED' || ['EXECUTED', 'FAILED', 'INSUFFICIENT_CANDIDATES'].includes(redraw.executionStatus); const executed = redraw.executionStatus === 'EXECUTED'; const labels = [['요청', true], ['심사', approved], ['실행', executed], ['결과', executed]]; return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">재추첨 진행</h2><ol className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">{labels.map(([label, complete], index) => <li key={label} className="flex items-center gap-2">{index > 0 && <span className="text-slate-300">→</span>}<span className={`rounded-full px-3 py-1.5 ${complete ? 'bg-pink-50 text-pink-700' : 'bg-slate-100 text-slate-500'}`}>{label} {complete ? '✓' : '·'}</span></li>)}</ol></section> }
function confirmCopy(action) { if (action === 'approve') return { title: '재추첨 요청을 승인할까요?', message: '현재 결원과 재추첨 조건은 서버가 관리합니다. 승인 후 재추첨 실행이 가능해집니다.', confirmLabel: '승인' }; if (action === 'reject') return { title: '재추첨 요청 거절', message: '거절 사유를 입력해주세요.', confirmLabel: '거절하기' }; if (action === 'execute') return { title: '재추첨을 실행할까요?', message: '확정된 결원 수와 기존 추첨 기준으로 재추첨을 실행합니다. 후보 제외 규칙은 서버가 적용합니다.', confirmLabel: '재추첨 실행' }; return { title: '실패한 Drawing을 다시 실행할까요?', message: '기존 Drawing과 Seed를 재사용합니다. 새로운 추첨을 생성하지 않습니다.', confirmLabel: '다시 시도', confirmTone: 'bg-red-700 hover:bg-red-800' } }
