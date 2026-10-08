import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, describeError } from '../../api/client.js'
import { getDrawing, getDrawingReadyEvents, getDrawingResult, getDrawingVerificationHistory, getEventSnapshot, getInitialDrawing, getOperatingEvent, publishDrawing, retryDrawing, runInitialDrawing, verifyDrawing } from '../../api/admin.js'
import { AdminPageHeader, DetailInfoRows } from '../../components/AdminContent.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { drawingStatusMeta } from '../../utils/eventStatus.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'

const LIST_FILTERS = [
  { value: '', label: '전체' },
  { value: 'CLOSED', label: '추첨 전 / 마감 완료' },
  { value: 'DRAW_COMPLETED', label: '추첨 완료 / 미공개' },
  { value: 'PUBLISHED', label: '공개 완료' },
]

/** eventId query가 있으면 목록을 거치지 않고 해당 Event의 추첨 상세를 연다. */
export function AdminDrawingsRoute() {
  const [searchParams] = useSearchParams()
  return searchParams.get('eventId') ? <AdminDrawingDetailPage /> : <AdminDrawingsPage />
}

/** Snapshot·Drawing 상세 호출 없이, 추첨 대상 이벤트를 표로 탐색한다. */
export function AdminDrawingsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const { data, loading, error, reload } = useAsync(() => getDrawingReadyEvents(), [], { fallbackMessage: '추첨 관리 목록을 불러오지 못했습니다.' })
  const events = data?.items ?? []
  const term = query.trim().toLowerCase()
  const filtered = events.filter((event) => (!status || event.status === status) && [event.eventId, event.title].some((value) => String(value ?? '').toLowerCase().includes(term)))

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <AdminPageHeader title="추첨 관리" description="마감 완료된 이벤트의 Snapshot과 추첨 진행 상태를 관리합니다." />
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
        <label className="min-w-64 flex-1 text-xs font-medium text-slate-600">검색<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Event ID 또는 이벤트명 검색" className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600" /></label>
        <label className="w-48 text-xs font-medium text-slate-600">Event 상태<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-pink-600">{LIST_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
        <button type="button" onClick={() => void reload()} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button>
      </div>
      {loading && <LoadingBlock label="추첨 관리 목록을 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && (filtered.length ? <DrawingTable events={filtered} /> : <EmptyBlock icon="casino" message={events.length ? '조건에 해당하는 추첨 관리 대상이 없습니다.' : '현재 추첨 관리 대상 이벤트가 없습니다.'} />)}
    </section>
    <p className="text-xs leading-5 text-slate-500">목록은 Event 목록 API만 사용합니다. Drawing·공개 상태와 Snapshot은 상세 화면에서 서버 기준으로 확인합니다.</p>
  </div>
}

function DrawingTable({ events }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-slate-50 text-xs font-medium text-slate-500"><tr><th className="px-5 py-3">Event ID</th><th className="px-4 py-3">이벤트</th><th className="px-4 py-3">Event 상태</th><th className="px-4 py-3">추첨 상태</th><th className="px-4 py-3">당첨 인원</th><th className="px-5 py-3 text-right">관리</th></tr></thead><tbody className="divide-y divide-slate-100">{events.map((event) => <tr key={event.eventId} className="hover:bg-slate-50"><td className="px-5 py-3 font-medium text-slate-900">#{event.eventId}</td><td className="px-4 py-3"><p className="font-medium text-slate-900">{event.title ?? '-'}</p><p className="mt-0.5 text-xs text-slate-500">{event.creatorName ?? (event.creatorId ? `Creator #${event.creatorId}` : '')}</p></td><td className="px-4 py-3"><StatusBadge status={event.status} /></td><td className="px-4 py-3 text-slate-600">상세에서 확인</td><td className="px-4 py-3 text-slate-600">{event.winnerCount == null ? '-' : `${formatNumber(event.winnerCount)}명`}</td><td className="px-5 py-3 text-right"><Link to={`/admin/drawings?eventId=${event.eventId}`} className="font-medium text-pink-700 hover:text-pink-800">상세 보기</Link></td></tr>)}</tbody></table></div>
}

/** Event 또는 Drawing URL을 서버 데이터로 다시 조합해 추첨 운영 상세를 표시한다. */
export function AdminDrawingDetailPage() {
  const { drawingId } = useParams()
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId')
  const navigate = useNavigate()
  const showToast = useToast()
  const [confirmAction, setConfirmAction] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [verification, setVerification] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [historyError, setHistoryError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)

  const detail = useAsync(() => loadDrawingDetail({ drawingId, eventId }), [drawingId, eventId], { fallbackMessage: '추첨 정보를 불러오지 못했습니다.' })
  const event = detail.data?.event
  const drawing = detail.data?.drawing
  const snapshot = useAsync(() => event ? getEventSnapshot(event.eventId) : Promise.resolve(null), [event?.eventId], { fallbackMessage: 'Snapshot 정보를 불러오지 못했습니다.' })
  const result = useAsync(() => drawing?.status === 'COMPLETED' ? getDrawingResult(drawing.drawingId) : Promise.resolve(null), [drawing?.drawingId, drawing?.status], { fallbackMessage: '추첨 결과를 불러오지 못했습니다.' })

  async function refresh() {
    setVerification(null)
    setHistory([])
    setHistoryOpen(false)
    await detail.reload()
  }

  async function executeAction() {
    if (!event && confirmAction === 'initial') return
    setActionBusy(true)
    try {
      if (confirmAction === 'initial') {
        const created = await runInitialDrawing(event.eventId)
        showToast('최초 추첨을 실행했습니다.')
        setConfirmAction(null)
        navigate(`/admin/drawings/${created.drawingId}`, { replace: true })
      } else if (confirmAction === 'retry') {
        await retryDrawing(drawing.drawingId)
        showToast('기존 Drawing과 Seed를 재사용해 다시 실행했습니다.')
        setConfirmAction(null)
        await refresh()
      } else if (confirmAction === 'publish') {
        await publishDrawing(drawing.drawingId)
        showToast('추첨 결과가 공개되었습니다.')
        setConfirmAction(null)
        await refresh()
      }
    } catch (err) {
      const message = confirmAction === 'initial' ? '추첨 실행에 실패했습니다.' : confirmAction === 'retry' ? '추첨 재시도에 실패했습니다.' : '결과 공개에 실패했습니다.'
      showToast(describeError(err, message), { icon: 'error' })
    } finally { setActionBusy(false) }
  }

  async function verify() {
    if (!drawing) return
    setActionBusy(true)
    try {
      const next = await verifyDrawing(drawing.drawingId)
      setVerification(next)
      showToast(next.status === 'VERIFIED' ? '추첨 검증을 완료했습니다.' : '검증 결과를 확인해 주세요.')
    } catch (err) { showToast(describeError(err, '검증에 실패했습니다.'), { icon: 'error' }) } finally { setActionBusy(false) }
  }

  async function toggleHistory() {
    if (!drawing) return
    if (historyOpen) { setHistoryOpen(false); return }
    setHistoryLoading(true); setHistoryError('')
    try { const page = await getDrawingVerificationHistory(drawing.drawingId, { size: 20 }); setHistory(page?.items ?? []); setHistoryOpen(true) } catch (err) { setHistoryError(describeError(err, '검증 이력을 불러오지 못했습니다.')); setHistoryOpen(true) } finally { setHistoryLoading(false) }
  }

  if (detail.loading) return <LoadingBlock label="추첨 정보를 불러오는 중..." />
  if (detail.error) return <ErrorBlock message={detail.error} onRetry={detail.reload} />
  if (!event) return <div className="mx-auto max-w-6xl"><EmptyBlock message="해당 추첨 대상 이벤트를 찾을 수 없습니다." /><Link to="/admin/drawings" className="text-sm font-medium text-pink-700">추첨 관리 목록으로 돌아가기</Link></div>

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><Link to="/admin/drawings" className="text-sm font-medium text-pink-700 hover:text-pink-800">← 추첨 관리</Link><h1 className="mt-3 text-xl font-semibold text-slate-950">{event.title}</h1><p className="mt-1 text-sm text-slate-500">Event #{event.eventId}</p></div><button type="button" onClick={() => void refresh()} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button></div>
    <DrawingSteps snapshot={snapshot.data} drawing={drawing} verification={verification} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-6"><section className="border-y border-slate-200 bg-white"><DetailInfoRows title="Event 상태" rows={[["현재 상태", <StatusBadge key="event" status={event.status} />], ['Event ID', event.eventId], ['이벤트명', event.title]]} /></section><SnapshotSection snapshot={snapshot} /><DrawingSection drawing={drawing} drawingError={detail.data?.drawingError} result={result} verification={verification} history={history} historyOpen={historyOpen} historyLoading={historyLoading} historyError={historyError} onRetryDrawing={detail.reload} onToggleHistory={() => void toggleHistory()} /></div>
      <ActionPanel event={event} drawing={drawing} busy={actionBusy} onInitial={() => setConfirmAction('initial')} onRetry={() => setConfirmAction('retry')} onVerify={() => void verify()} onPublish={() => setConfirmAction('publish')} />
    </div>
    {confirmAction && <ConfirmModal action="confirm" subject={event.title} busy={actionBusy} onCancel={() => setConfirmAction(null)} onConfirm={() => void executeAction()} {...confirmCopy(confirmAction)} />}
  </div>
}

async function loadDrawingDetail({ drawingId, eventId }) {
  if (drawingId) {
    const drawing = await getDrawing(drawingId)
    const event = drawing.eventId ? await getOperatingEvent(drawing.eventId) : null
    return { event, drawing }
  }
  if (!eventId) return { event: null, drawing: null }
  const event = await getOperatingEvent(eventId)
  if (!event) return { event: null, drawing: null }
  try { return { event, drawing: await getInitialDrawing(event.eventId) } } catch (err) {
    if (err instanceof ApiError && err.code === 'DRAWING_NOT_FOUND') return { event, drawing: null }
    return { event, drawing: null, drawingError: describeError(err, '추첨 정보를 불러오지 못했습니다.') }
  }
}

function DrawingSteps({ snapshot, drawing, verification }) {
  const steps = [['Snapshot', Boolean(snapshot)], ['Drawing', Boolean(drawing && drawing.status === 'COMPLETED')], ['Verification', verification?.status === 'VERIFIED'], ['Publish', drawing?.visibility === 'PUBLIC']]
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">추첨 진행</h2><ol className="mt-4 flex flex-wrap items-center gap-2">{steps.map(([label, complete], index) => <li key={label} className="flex items-center gap-2">{index > 0 && <span className="text-slate-300">→</span>}<span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${complete ? 'bg-pink-50 text-pink-700' : 'bg-slate-100 text-slate-500'}`}>{index + 1} {label} {complete ? '✓' : '·'}</span></li>)}</ol></section>
}

function SnapshotSection({ snapshot }) {
  return <section className="border-y border-slate-200 bg-white"><h2 className="px-5 pt-5 text-sm font-semibold text-slate-900">Snapshot</h2>{snapshot.loading && <LoadingBlock label="Snapshot 정보를 불러오는 중..." />}{!snapshot.loading && snapshot.error && <ErrorBlock message={snapshot.error} onRetry={snapshot.reload} />}{!snapshot.loading && !snapshot.error && snapshot.data && <DetailInfoRows title="공식 Snapshot" rows={toRows(snapshot.data, { snapshotId: 'Snapshot ID', snapshotHash: 'Hash', candidateCount: '후보 수', totalTicketCount: '누적 응모권', winnerCount: '당첨 인원', createdAt: '생성 시각' })} />}</section>
}

function DrawingSection({ drawing, drawingError, result, verification, history, historyOpen, historyLoading, historyError, onRetryDrawing, onToggleHistory }) {
  if (drawingError) return <section className="border-y border-slate-200 bg-white"><ErrorBlock message={drawingError} onRetry={onRetryDrawing} /></section>
  if (!drawing) return <section className="border-y border-slate-200 bg-white"><DetailInfoRows title="Drawing" rows={[["현재 상태", 'INITIAL Drawing이 아직 없습니다.']]} /></section>
  const rows = [['Drawing ID', drawing.drawingId], ['Drawing 상태', <StatusBadge key="drawing" status={drawing.status} />], ['공개 상태', drawing.visibility ?? '-'], ['유형', drawing.drawType ?? '-'], ['회차', drawing.drawNo ?? '-']]
  return <section className="border-y border-slate-200 bg-white"><DetailInfoRows title="Drawing" rows={rows} />{drawing.status === 'COMPLETED' && <><div className="border-t border-slate-200 px-5 py-5"><h2 className="text-sm font-semibold text-slate-900">추첨 결과</h2>{result.loading && <LoadingBlock label="추첨 결과를 불러오는 중..." />}{!result.loading && result.error && <ErrorBlock message={result.error} onRetry={result.reload} />}{!result.loading && !result.error && <WinnerTable winners={result.data?.winners ?? []} />}</div><div className="border-t border-slate-200 px-5 py-5"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">검증</h2><button type="button" onClick={onToggleHistory} className="text-sm font-medium text-pink-700 hover:text-pink-800">{historyOpen ? '이력 닫기' : '검증 이력'}</button></div>{verification && <VerificationRows verification={verification} title="최근 검증 결과" />}{historyOpen && <div className="mt-4">{historyLoading && <LoadingBlock label="검증 이력을 불러오는 중..." />}{historyError && <ErrorBlock message={historyError} />}{!historyLoading && !historyError && (history.length ? <div className="divide-y divide-slate-100 border-y border-slate-200">{history.map((item) => <VerificationRows key={item.verificationId} verification={item} />)}</div> : <p className="mt-3 text-sm text-slate-500">검증 이력이 없습니다.</p>)}</div>}</div></>}</section>
}

function WinnerTable({ winners }) {
  if (!winners.length) return <p className="mt-3 text-sm text-slate-500">표시할 당첨자가 없습니다.</p>
  return <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2">순위</th><th className="px-3 py-2">Winner ID</th><th className="px-3 py-2">User ID</th><th className="px-3 py-2">상태</th><th className="px-3 py-2 text-right">관리</th></tr></thead><tbody className="divide-y divide-slate-100">{winners.map((winner) => <tr key={winner.winnerId}><td className="px-3 py-2">{winner.rankInDrawing ?? '-'}</td><td className="px-3 py-2">#{winner.winnerId}</td><td className="px-3 py-2">#{winner.userId}</td><td className="px-3 py-2">{winner.status ?? '-'}</td><td className="px-3 py-2 text-right"><Link to={`/admin/winners/${winner.winnerId}`} state={{ winner }} className="font-medium text-pink-700 hover:text-pink-800">상세 보기</Link></td></tr>)}</tbody></table></div>
}

function VerificationRows({ verification, title }) { return <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">{title ?? '검증 결과'}</dt><dd className="mt-1"><StatusBadge status={verification.status} /></dd></div><div><dt className="text-slate-500">검증 시각</dt><dd className="mt-1 text-slate-800">{formatDateTime(verification.verifiedAt)}</dd></div>{verification.failureMessage && <div className="sm:col-span-2"><dt className="text-slate-500">상세</dt><dd className="mt-1 text-slate-800">{verification.failureMessage}</dd></div>}</dl> }

function ActionPanel({ event, drawing, busy, onInitial, onRetry, onVerify, onPublish }) {
  const completed = drawing?.status === 'COMPLETED'
  return <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">현재 가능한 작업</h2><div className="mt-4 space-y-3 text-sm text-slate-600">{!drawing && event.status === 'CLOSED' && <><p>Snapshot을 확인한 뒤 최초 추첨을 실행할 수 있습니다.</p><ActionButton busy={busy} onClick={onInitial}>최초 추첨 실행</ActionButton></>}{drawing?.status === 'FAILED' && <><p>현재 추첨 실행에 실패했습니다. 기존 Drawing을 다시 실행할 수 있습니다.</p><ActionButton busy={busy} onClick={onRetry} tone="danger">다시 시도</ActionButton></>}{completed && drawing.visibility !== 'PUBLIC' && <><p>추첨이 완료되었고 결과는 아직 공개되지 않았습니다.</p><ActionButton busy={busy} onClick={onVerify} tone="secondary">추첨 결과 검증</ActionButton><ActionButton busy={busy} onClick={onPublish}>결과 공개</ActionButton></>}{completed && drawing.visibility === 'PUBLIC' && <p>이 Drawing의 결과는 이미 공개되었습니다.</p>}{drawing && !completed && drawing.status !== 'FAILED' && <p>{drawingStatusMeta(drawing.status).label} 상태입니다. 서버 상태를 새로고침해 진행 상황을 확인하세요.</p>}{!drawing && event.status !== 'CLOSED' && <p>현재 Event 상태에서는 최초 추첨을 실행할 수 없습니다.</p>}</div></aside>
}

function ActionButton({ children, busy, onClick, tone = 'primary' }) { const color = tone === 'danger' ? 'bg-red-700 hover:bg-red-800' : tone === 'secondary' ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50' : 'bg-pink-700 hover:bg-pink-800 text-white'; return <button type="button" disabled={busy} onClick={onClick} className={`h-10 w-full rounded-md px-3 text-sm font-semibold disabled:opacity-50 ${color}`}>{busy ? '처리 중...' : children}</button> }

function confirmCopy(action) { if (action === 'initial') return { title: '최초 추첨을 실행할까요?', message: '확정된 Snapshot을 기준으로 INITIAL Drawing을 실행합니다. Event당 최초 추첨은 1회만 허용됩니다.', confirmLabel: '추첨 실행' }; if (action === 'retry') return { title: '실패한 추첨을 다시 실행할까요?', message: '기존 Drawing과 Seed를 재사용합니다. 새로운 추첨을 생성하지 않습니다.', confirmLabel: '다시 시도', confirmTone: 'bg-red-700 hover:bg-red-800' }; return { title: '추첨 결과를 공개할까요?', message: '공개하면 사용자에게 당첨 결과가 노출됩니다. 서버가 Event 상태를 PUBLISHED로 전환한 뒤 다시 조회합니다.', confirmLabel: '결과 공개' } }

function toRows(data, labels) { return Object.entries(data ?? {}).filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object').map(([key, value]) => [labels[key] ?? key, key.endsWith('At') ? formatDateTime(value) : String(value)]) }
