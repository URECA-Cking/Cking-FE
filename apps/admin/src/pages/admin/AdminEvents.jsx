import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { closeEvent, getClosingStatus, getEventSnapshot, getOperatingEvent, getOperatingEvents, OPERATING_EVENT_STATUSES } from '../../api/admin.js'
import { describeError } from '../../api/client.js'
import { AdminPageHeader, DetailInfoRows } from '../../components/AdminContent.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { EVENT_OPERATION_FLOW, eventStatusMeta } from '../../utils/eventStatus.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'

const STATUS_OPTIONS = OPERATING_EVENT_STATUSES.map((status) => ({ status, ...eventStatusMeta(status) }))

/** 운영 단계 이벤트를 표·검색·상태 필터로 탐색한다. */
export function AdminEventsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const { data, loading, error, reload } = useAsync(() => getOperatingEvents(), [], { fallbackMessage: '이벤트 목록을 불러오지 못했습니다.' })
  const events = data?.items ?? []
  const term = query.trim().toLowerCase()
  const filtered = events.filter((event) => (!status || event.status === status) && [event.eventId, event.title, event.creatorName, event.creatorId].some((value) => String(value ?? '').toLowerCase().includes(term)))

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <AdminPageHeader title="이벤트 관리" description="전체 이벤트의 운영 상태를 확인하고 관리합니다." />
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
        <label className="min-w-64 flex-1 text-xs font-medium text-slate-600">검색<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이벤트 ID, 이벤트명 또는 Creator 검색" className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600" /></label>
        <label className="w-40 text-xs font-medium text-slate-600">상태<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-pink-600"><option value="">전체</option>{STATUS_OPTIONS.map((option) => <option key={option.status} value={option.status}>{option.label}</option>)}</select></label>
        <button type="button" onClick={() => void reload()} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button>
      </div>
      {loading && <LoadingBlock label="이벤트 목록을 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && (filtered.length === 0 ? <EmptyBlock icon="event_busy" message={events.length === 0 ? '현재 운영 대상 이벤트가 없습니다.' : '조건에 해당하는 이벤트가 없습니다.'} /> : <EventTable events={filtered} />)}
    </section>
  </div>
}

function EventTable({ events }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-xs font-medium text-slate-500"><tr><th className="px-5 py-3">이벤트 ID</th><th className="px-4 py-3">이벤트명</th><th className="px-4 py-3">Creator</th><th className="px-4 py-3">상태</th><th className="px-4 py-3">일정</th><th className="px-5 py-3 text-right">관리</th></tr></thead><tbody className="divide-y divide-slate-100">{events.map((event) => <tr key={event.eventId} className="hover:bg-slate-50"><td className="px-5 py-3 font-medium text-slate-900">#{event.eventId}</td><td className="px-4 py-3 font-medium text-slate-900">{event.title ?? '-'}</td><td className="px-4 py-3 text-slate-600">{event.creatorName ?? (event.creatorId ? `#${event.creatorId}` : '-')}</td><td className="px-4 py-3"><StatusBadge status={event.status} /></td><td className="px-4 py-3 text-slate-600">{event.startAt || event.endAt ? `${formatDateTime(event.startAt)} ~ ${formatDateTime(event.endAt)}` : '-'}</td><td className="px-5 py-3 text-right"><Link to={`/admin/events/${event.eventId}`} className="font-medium text-pink-700 hover:text-pink-800">상세 보기</Link></td></tr>)}</tbody></table></div>
}

/** URL의 이벤트를 다시 조회해 현재 서버 상태를 중심으로 운영 상세를 표시한다. */
export function AdminEventDetailPage() {
  const { eventId } = useParams()
  const showToast = useToast()
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [closingBusy, setClosingBusy] = useState(false)
  const { data: event, loading, error, reload } = useAsync(() => getOperatingEvent(eventId), [eventId], { fallbackMessage: '이벤트 정보를 불러오지 못했습니다.' })
  const closing = useAsync(() => event?.status === 'CLOSING' ? getClosingStatus(event.eventId) : Promise.resolve(null), [event?.eventId, event?.status], { fallbackMessage: '마감 처리 상태를 불러오지 못했습니다.' })
  const snapshot = useAsync(() => ['CLOSED', 'DRAW_COMPLETED', 'PUBLISHED'].includes(event?.status) ? getEventSnapshot(event.eventId) : Promise.resolve(null), [event?.eventId, event?.status], { fallbackMessage: '스냅샷 정보를 불러오지 못했습니다.' })

  async function refreshEvent() {
    const nextEvent = await reload()
    if (nextEvent?.status === 'CLOSING') await closing.reload()
  }

  async function requestClose() {
    if (!event) return
    setClosingBusy(true)
    try {
      await closeEvent(event.eventId)
      setCloseConfirmOpen(false)
      showToast('마감 요청이 접수되었습니다. 현재 상태를 다시 확인합니다.')
      await reload()
    } catch (err) {
      showToast(describeError(err, '이벤트 마감 요청에 실패했습니다.'), { icon: 'error' })
    } finally { setClosingBusy(false) }
  }

  if (loading) return <LoadingBlock label="이벤트 정보를 불러오는 중..." />
  if (error) return <ErrorBlock message={error} onRetry={reload} />
  if (!event) return <div className="mx-auto max-w-6xl"><EmptyBlock message="현재 운영 이벤트 목록에서 해당 이벤트를 찾을 수 없습니다." /><Link to="/admin/events" className="text-sm font-medium text-pink-700">이벤트 목록으로 돌아가기</Link></div>

  const infoRows = [['Event ID', event.eventId], ['이벤트명', event.title], ['Creator', event.creatorName ?? (event.creatorId ? `#${event.creatorId}` : '-')], ['현재 상태', <StatusBadge key="status" status={event.status} />]]
  const scheduleRows = [['시작 시간', formatDateTime(event.startAt)], ['종료 시간', formatDateTime(event.endAt)]]
  const eventRows = [['당첨 인원', event.winnerCount == null ? '-' : `${formatNumber(event.winnerCount)}명`], ['추첨 방식', event.drawMethod]]

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><Link to="/admin/events" className="text-sm font-medium text-pink-700 hover:text-pink-800">← 이벤트 목록</Link><h1 className="mt-3 text-xl font-semibold text-slate-950">이벤트 운영 상세</h1><p className="mt-1 text-sm text-slate-500">{event.title} · Event #{event.eventId}</p></div><button type="button" onClick={() => void refreshEvent()} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button></div>
    <EventStatusFlow status={event.status} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]"><section className="border-y border-slate-200 bg-white"><DetailInfoRows title="기본 정보" rows={infoRows} /><DetailInfoRows title="운영 일정" rows={scheduleRows} /><DetailInfoRows title="이벤트 정보" rows={eventRows} />{snapshot.data && <DetailInfoRows title="추첨 Snapshot" rows={toRows(snapshot.data)} />}{snapshot.error && <section className="border-b border-slate-200 px-5 py-5"><ErrorBlock message={snapshot.error} onRetry={snapshot.reload} /></section>}</section><OperationPanel event={event} closing={closing} closingBusy={closingBusy} onClose={() => setCloseConfirmOpen(true)} onRefresh={() => void refreshEvent()} /></div>
    {closeConfirmOpen && <ConfirmModal action="confirm" subject={event.title} busy={closingBusy} title="이 이벤트의 마감을 요청할까요?" message={'마감 요청이 접수되면 백엔드에서 마감 처리가 진행됩니다.\n처리 완료 전까지 상태는 마감 처리 중으로 표시될 수 있습니다.'} confirmLabel="마감 요청" onCancel={() => setCloseConfirmOpen(false)} onConfirm={() => void requestClose()} />}
  </div>
}

function EventStatusFlow({ status }) {
  const current = EVENT_OPERATION_FLOW.indexOf(status)
  if (current < 0) return null
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">운영 상태 흐름</h2><ol className="mt-4 flex flex-wrap items-center gap-2">{EVENT_OPERATION_FLOW.map((step, index) => <li key={step} className="flex items-center gap-2">{index > 0 && <span className="text-slate-300">→</span>}<span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${index === current ? 'bg-pink-700 text-white' : index < current ? 'bg-pink-50 text-pink-700' : 'bg-slate-100 text-slate-500'}`}>{eventStatusMeta(step).label}</span></li>)}</ol></section>
}

function OperationPanel({ event, closing, closingBusy, onClose, onRefresh }) {
  const status = event.status
  return <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">운영 상태</h2><div className="mt-4"><p className="text-xs text-slate-500">현재 상태</p><div className="mt-2"><StatusBadge status={status} /></div></div>{status === 'SCHEDULED' && <p className="mt-5 text-sm leading-6 text-slate-600">오픈 예정 이벤트입니다. 현재 제공되는 관리자 작업은 없습니다.</p>}{status === 'OPEN' && <><p className="mt-5 text-sm leading-6 text-slate-600">현재 이벤트의 마감을 요청할 수 있습니다.</p><button type="button" disabled={closingBusy} onClick={onClose} className="mt-4 h-10 w-full rounded-md bg-pink-700 text-sm font-semibold text-white hover:bg-pink-800 disabled:opacity-50">이벤트 마감</button></>}{status === 'CLOSING' && <ClosingPanel closing={closing} onRefresh={onRefresh} />}{status === 'CLOSED' && <StateLink text="마감이 완료되어 추첨 작업을 진행할 수 있습니다." />}{status === 'DRAW_COMPLETED' && <StateLink text="추첨이 완료되었습니다. 추첨 관리에서 결과를 확인하세요." />}{status === 'PUBLISHED' && <p className="mt-5 text-sm leading-6 text-slate-600">결과 공개가 완료되었습니다.</p>}</aside>
}

function ClosingPanel({ closing, onRefresh }) {
  return <div className="mt-5"><p className="text-sm leading-6 text-slate-600">마감 처리가 진행 중입니다. 신규 응모 차단과 정리 상태는 서버 응답을 기준으로 표시됩니다.</p><button type="button" disabled={closing.loading} onClick={onRefresh} className="mt-4 h-10 w-full rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{closing.loading ? '상태 조회 중...' : '상태 새로고침'}</button><div className="mt-4 border-t border-slate-100 pt-4">{closing.error && <ErrorBlock message={closing.error} onRetry={closing.reload} />}{!closing.loading && !closing.error && closing.data && <dl className="space-y-2 text-sm">{toRows(closing.data).map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="break-all text-right text-slate-800">{value}</dd></div>)}</dl>}</div></div>
}

function StateLink({ text }) { return <><p className="mt-5 text-sm leading-6 text-slate-600">{text}</p><Link to="/admin/console" className="mt-4 inline-block text-sm font-semibold text-pink-700 hover:text-pink-800">추첨 관리에서 확인 →</Link></> }

function toRows(data) {
  const labels = { status: '현재 상태', snapshotId: 'Snapshot ID', createdAt: '생성 시간', candidateCount: '후보자 수', totalTicketCount: '누적 응모권', winnerCount: '당첨 인원', cutoff: 'Cutoff', gateStatus: 'Gate 상태', drainStatus: 'Drain 상태' }
  return Object.entries(data ?? {}).filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object').map(([key, value]) => [labels[key] ?? key, key.endsWith('At') ? formatDateTime(value) : String(value)])
}
