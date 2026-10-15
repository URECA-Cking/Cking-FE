import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import {
  archiveEvent,
  closeEvent,
  getClosingStatus,
  getEventSnapshot,
  getOperatingEvent,
  getOperatingEvents,
  OPERATING_EVENT_STATUSES,
  unarchiveEvent,
} from '../../api/admin.js'
import { describeError } from '../../api/client.js'
import { AdminPageHeader, DetailInfoRows } from '../../components/AdminContent.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { EVENT_ARCHIVE_VIEWS, archiveStatusSearch, canArchiveEvent, canUnarchiveEvent, shouldShowEventStatusFilter } from '../../utils/eventArchive.js'
import { EVENT_OPERATION_FLOW, eventStatusMeta } from '../../utils/eventStatus.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'

const STATUS_OPTIONS = OPERATING_EVENT_STATUSES.map((status) => ({ status, ...eventStatusMeta(status) }))

function normalizeArchiveStatus(value) {
  return value === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'
}

/** 운영 Event와 보관 Event를 분리해 검색·상태 필터로 탐색한다. */
export function AdminEventsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const archiveStatus = normalizeArchiveStatus(searchParams.get('archiveStatus'))
  const { data, loading, error, reload } = useAsync(
    () => getOperatingEvents({ archiveStatus }),
    [archiveStatus],
    { fallbackMessage: '이벤트 목록을 불러오지 못했습니다.' },
  )
  const events = data?.items ?? []
  const term = query.trim().toLowerCase()
  const filtered = events.filter((event) => (
    (!status || event.status === status)
    && [event.eventId, event.title, event.creatorName, event.creatorId]
      .some((value) => String(value ?? '').toLowerCase().includes(term))
  ))
  const emptyMessage = events.length === 0
    ? (archiveStatus === 'ARCHIVED' ? '보관된 이벤트가 없습니다.' : '현재 운영 대상 이벤트가 없습니다.')
    : '조건에 해당하는 이벤트가 없습니다.'

  function changeArchiveStatus(next) {
    setStatus('')
    setSearchParams(next === 'ARCHIVED' ? { archiveStatus: 'ARCHIVED' } : {})
  }

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <AdminPageHeader title="이벤트 관리" description="운영 Event와 보관 Event를 구분해 상태를 확인하고 관리합니다." />
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 px-4 pt-4" aria-label="이벤트 목록 범위">
        {EVENT_ARCHIVE_VIEWS.map((view) => <button
          key={view.value}
          type="button"
          onClick={() => changeArchiveStatus(view.value)}
          className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${archiveStatus === view.value ? 'border-pink-700 text-pink-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >{view.label}</button>)}
      </div>
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
        <label className="min-w-64 flex-1 text-xs font-medium text-slate-600">검색
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이벤트 ID, 이벤트명 또는 Creator 검색" className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600" />
        </label>
        {shouldShowEventStatusFilter(archiveStatus) && <label className="w-40 text-xs font-medium text-slate-600">상태
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-pink-600">
            <option value="">전체</option>
            {STATUS_OPTIONS.map((option) => <option key={option.status} value={option.status}>{option.label}</option>)}
          </select>
        </label>}
        <button type="button" onClick={() => void reload()} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button>
      </div>
      {loading && <LoadingBlock label="이벤트 목록을 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && (filtered.length === 0
        ? <EmptyBlock icon="event_busy" message={emptyMessage} />
        : <EventTable events={filtered} archiveStatus={archiveStatus} />)}
    </section>
  </div>
}

function EventTable({ events, archiveStatus }) {
  const archived = archiveStatus === 'ARCHIVED'
  return <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm">
    <thead className="bg-slate-50 text-xs font-medium text-slate-500"><tr>
      <th className="px-5 py-3">이벤트 ID</th><th className="px-4 py-3">이벤트명</th><th className="px-4 py-3">Creator</th><th className="px-4 py-3">상태</th><th className="px-4 py-3">일정</th>
      {archived && <th className="px-4 py-3">보관 시각</th>}<th className="px-5 py-3 text-right">관리</th>
    </tr></thead>
    <tbody className="divide-y divide-slate-100">{events.map((event) => <tr key={event.eventId} className="hover:bg-slate-50">
      <td className="px-5 py-3 font-medium text-slate-900">#{event.eventId}</td>
      <td className="px-4 py-3 font-medium text-slate-900">{event.title ?? '-'}</td>
      <td className="px-4 py-3 text-slate-600">{event.creatorName ?? (event.creatorId ? `#${event.creatorId}` : '-')}</td>
      <td className="px-4 py-3"><StatusBadge status={event.status} /></td>
      <td className="px-4 py-3 text-slate-600">{event.startAt || event.endAt ? `${formatDateTime(event.startAt)} ~ ${formatDateTime(event.endAt)}` : '-'}</td>
      {archived && <td className="px-4 py-3 text-slate-600">{formatDateTime(event.archivedAt)}</td>}
      <td className="px-5 py-3 text-right"><Link to={`/admin/events/${event.eventId}${archiveStatusSearch(archiveStatus)}`} className="font-medium text-pink-700 hover:text-pink-800">상세 보기</Link></td>
    </tr>)}</tbody>
  </table></div>
}

/** URL의 Event를 다시 조회해 현재 서버 상태 중심으로 운영 상세를 표시한다. */
export function AdminEventDetailPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const showToast = useToast()
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [archiveConfirmAction, setArchiveConfirmAction] = useState(null)
  const [closingBusy, setClosingBusy] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const archiveStatus = normalizeArchiveStatus(searchParams.get('archiveStatus'))
  const { data: event, loading, error, reload } = useAsync(
    () => getOperatingEvent(eventId, { archiveStatus }),
    [eventId, archiveStatus],
    { fallbackMessage: '이벤트 정보를 불러오지 못했습니다.' },
  )
  const closing = useAsync(
    () => event?.status === 'CLOSING' ? getClosingStatus(event.eventId) : Promise.resolve(null),
    [event?.eventId, event?.status],
    { fallbackMessage: '마감 처리 상태를 불러오지 못했습니다.' },
  )
  const snapshot = useAsync(
    () => ['CLOSED', 'DRAW_COMPLETED', 'PUBLISHED'].includes(event?.status) ? getEventSnapshot(event.eventId) : Promise.resolve(null),
    [event?.eventId, event?.status],
    { fallbackMessage: '스냅샷 정보를 불러오지 못했습니다.' },
  )

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
    } finally {
      setClosingBusy(false)
    }
  }

  async function requestArchiveAction() {
    if (!event || !archiveConfirmAction) return
    setArchiveBusy(true)
    try {
      if (archiveConfirmAction === 'archive') {
        await archiveEvent(event.eventId)
        showToast('이벤트를 보관함으로 옮겼습니다. 사용자와 Creator 화면에는 더 이상 노출되지 않습니다.')
        navigate('/admin/events?archiveStatus=ARCHIVED', { replace: true })
      } else {
        await unarchiveEvent(event.eventId)
        showToast('이벤트 보관을 해제했습니다. 결과 공개 Event로 다시 노출됩니다.')
        navigate('/admin/events', { replace: true })
      }
    } catch (err) {
      showToast(describeError(err, archiveConfirmAction === 'archive' ? '이벤트 보관에 실패했습니다.' : '이벤트 보관 해제에 실패했습니다.'), { icon: 'error' })
    } finally {
      setArchiveBusy(false)
    }
  }

  if (loading) return <LoadingBlock label="이벤트 정보를 불러오는 중..." />
  if (error) return <ErrorBlock message={error} onRetry={reload} />
  if (!event) return <div className="mx-auto max-w-6xl"><EmptyBlock message="현재 선택한 이벤트 목록에서 해당 이벤트를 찾을 수 없습니다." /><Link to={`/admin/events${archiveStatusSearch(archiveStatus)}`} className="text-sm font-medium text-pink-700">이벤트 목록으로 돌아가기</Link></div>

  const archived = Boolean(event.archivedAt)
  const infoRows = [
    ['Event ID', event.eventId], ['이벤트명', event.title], ['Creator', event.creatorName ?? (event.creatorId ? `#${event.creatorId}` : '-')], ['현재 상태', <StatusBadge key="status" status={event.status} />],
    ['보관 상태', archived ? '보관됨' : '운영 목록'],
  ]
  const scheduleRows = [['시작 시간', formatDateTime(event.startAt)], ['종료 시간', formatDateTime(event.endAt)]]
  const eventRows = [['당첨 인원', event.winnerCount == null ? '-' : `${formatNumber(event.winnerCount)}명`], ['추첨 방식', event.drawMethod]]
  if (archived) {
    eventRows.push(['보관 시각', formatDateTime(event.archivedAt)], ['보관 관리자', event.archivedBy == null ? '-' : `#${event.archivedBy}`])
  }

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><Link to={`/admin/events${archiveStatusSearch(archiveStatus)}`} className="text-sm font-medium text-pink-700 hover:text-pink-800">← 이벤트 목록</Link><h1 className="mt-3 text-xl font-semibold text-slate-950">이벤트 운영 상세</h1><p className="mt-1 text-sm text-slate-500">{event.title} · Event #{event.eventId}</p></div><button type="button" onClick={() => void refreshEvent()} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button></div>
    {!archived && <EventStatusFlow status={event.status} />}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="border-y border-slate-200 bg-white"><DetailInfoRows title="기본 정보" rows={infoRows} /><DetailInfoRows title="운영 일정" rows={scheduleRows} /><DetailInfoRows title="이벤트 정보" rows={eventRows} />{snapshot.data && <DetailInfoRows title="추첨 Snapshot" rows={toRows(snapshot.data)} />}{snapshot.error && <section className="border-b border-slate-200 px-5 py-5"><ErrorBlock message={snapshot.error} onRetry={snapshot.reload} /></section>}</section>
      <OperationPanel event={event} archived={archived} closing={closing} closingBusy={closingBusy} onClose={() => setCloseConfirmOpen(true)} onRefresh={() => void refreshEvent()} onArchive={() => setArchiveConfirmAction('archive')} onUnarchive={() => setArchiveConfirmAction('unarchive')} />
    </div>
    {closeConfirmOpen && <ConfirmModal action="confirm" subject={event.title} busy={closingBusy} title="이 이벤트의 마감을 요청할까요?" message={'마감 요청이 접수되면 백엔드에서 마감 처리가 진행됩니다.\n처리 완료 전까지 상태는 마감 처리 중으로 표시될 수 있습니다.'} confirmLabel="마감 요청" onCancel={() => setCloseConfirmOpen(false)} onConfirm={() => void requestClose()} />}
    {archiveConfirmAction && <ConfirmModal action="confirm" subject={event.title} busy={archiveBusy} title={archiveConfirmAction === 'archive' ? '이 이벤트를 보관할까요?' : '이 이벤트 보관을 해제할까요?'} message={archiveConfirmAction === 'archive' ? '보관하면 사용자·Creator 화면, 응모, 내 당첨, 알림에서 이 이벤트가 제외됩니다.\n추첨·당첨 등 기존 기록은 삭제되지 않습니다.' : '보관을 해제하면 결과 공개 Event로 다시 노출됩니다.'} confirmLabel={archiveConfirmAction === 'archive' ? '보관하기' : '보관 해제'} confirmTone={archiveConfirmAction === 'archive' ? 'bg-slate-700 hover:bg-slate-800' : undefined} onCancel={() => setArchiveConfirmAction(null)} onConfirm={() => void requestArchiveAction()} />}
  </div>
}

function EventStatusFlow({ status }) {
  const current = EVENT_OPERATION_FLOW.indexOf(status)
  if (current < 0) return null
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">운영 상태 흐름</h2><ol className="mt-4 flex flex-wrap items-center gap-2">{EVENT_OPERATION_FLOW.map((step, index) => <li key={step} className="flex items-center gap-2">{index > 0 && <span className="text-slate-300">→</span>}<span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${index === current ? 'bg-pink-700 text-white' : index < current ? 'bg-pink-50 text-pink-700' : 'bg-slate-100 text-slate-500'}`}>{eventStatusMeta(step).label}</span></li>)}</ol></section>
}

function OperationPanel({ event, archived, closing, closingBusy, onClose, onRefresh, onArchive, onUnarchive }) {
  const status = event.status
  return <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">운영 상태</h2><div className="mt-4"><p className="text-xs text-slate-500">현재 상태</p><div className="mt-2"><StatusBadge status={status} /></div></div>
    {archived && <><p className="mt-5 text-sm leading-6 text-slate-600">보관된 Event입니다. 사용자와 Creator 화면에는 노출되지 않지만, 운영 기록은 유지됩니다.</p>{canUnarchiveEvent(event) && <button type="button" onClick={onUnarchive} className="mt-4 h-10 w-full rounded-md border border-pink-700 text-sm font-semibold text-pink-700 hover:bg-pink-50">보관 해제</button>}</>}
    {!archived && status === 'SCHEDULED' && <p className="mt-5 text-sm leading-6 text-slate-600">오픈 예정 이벤트입니다. 현재 제공되는 관리자 작업은 없습니다.</p>}
    {!archived && status === 'OPEN' && <><p className="mt-5 text-sm leading-6 text-slate-600">현재 이벤트의 마감을 요청할 수 있습니다.</p><button type="button" disabled={closingBusy} onClick={onClose} className="mt-4 h-10 w-full rounded-md bg-pink-700 text-sm font-semibold text-white hover:bg-pink-800 disabled:opacity-50">이벤트 마감</button></>}
    {!archived && status === 'CLOSING' && <ClosingPanel closing={closing} onRefresh={onRefresh} />}
    {!archived && status === 'CLOSED' && <StateLink eventId={event.eventId} text="마감이 완료되어 추첨 작업을 진행할 수 있습니다." />}
    {!archived && status === 'DRAW_COMPLETED' && <StateLink eventId={event.eventId} text="추첨이 완료되었습니다. 추첨 관리에서 결과를 확인하세요." />}
    {!archived && status === 'PUBLISHED' && <><StateLink eventId={event.eventId} text="결과 공개가 완료되었습니다." />{canArchiveEvent(event) && <button type="button" onClick={onArchive} className="mt-4 h-10 w-full rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">이벤트 보관</button>}</>}
  </aside>
}

function ClosingPanel({ closing, onRefresh }) {
  return <div className="mt-5"><p className="text-sm leading-6 text-slate-600">마감 처리가 진행 중입니다. 신규 응모 차단과 정리 상태는 서버 응답을 기준으로 표시됩니다.</p><button type="button" disabled={closing.loading} onClick={onRefresh} className="mt-4 h-10 w-full rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{closing.loading ? '상태 조회 중...' : '상태 새로고침'}</button><div className="mt-4 border-t border-slate-100 pt-4">{closing.error && <ErrorBlock message={closing.error} onRetry={closing.reload} />}{!closing.loading && !closing.error && closing.data && <dl className="space-y-2 text-sm">{toRows(closing.data).map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="break-all text-right text-slate-800">{value}</dd></div>)}</dl>}</div></div>
}

function StateLink({ eventId, text }) {
  return <><p className="mt-5 text-sm leading-6 text-slate-600">{text}</p><Link to={`/admin/drawings?eventId=${eventId}`} className="mt-4 inline-block text-sm font-semibold text-pink-700 hover:text-pink-800">추첨 관리에서 확인 →</Link></>
}

function toRows(data) {
  const labels = { status: '현재 상태', snapshotId: 'Snapshot ID', createdAt: '생성 시간', candidateCount: '후보자 수', totalTicketCount: '누적 응모권', winnerCount: '당첨 인원', cutoff: 'Cutoff', gateStatus: 'Gate 상태', drainStatus: 'Drain 상태' }
  return Object.entries(data ?? {}).filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object').map(([key, value]) => [labels[key] ?? key, key.endsWith('At') ? formatDateTime(value) : String(value)])
}
