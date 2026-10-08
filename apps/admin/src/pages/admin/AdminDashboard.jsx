import { Link } from 'react-router-dom'
import MaterialIcon from '../../components/MaterialIcon.jsx'
import { StatusPill } from '../../components/States.jsx'
import { useDashboardData } from '../../hooks/useDashboardData.js'
import { formatDateTime } from '../../utils/format.js'
import { eventStatusMeta } from '../../utils/eventStatus.js'

const EVENT_TABLE_STATUSES = new Set(['OPEN', 'CLOSING', 'CLOSED', 'DRAW_COMPLETED'])

/** 운영자가 우선 처리할 업무와 현재 운영 이벤트를 한 화면에 표시한다. */
export default function AdminDashboard() {
  const { sections, lastUpdatedAt, reload } = useDashboardData()
  const creatorPendingCount = sections.creatorApplications.data?.filter((item) => item.status === 'PENDING').length
  const pendingEventCount = sections.pendingEvents.data?.length
  const requestedRedrawCount = sections.requestedRedraws.data?.filter((item) => item.status === 'REQUESTED').length
  const closingEventCount = sections.operatingEvents.data?.items?.filter((item) => item.status === 'CLOSING').length
  const unresolvedDeadStreamCount = sections.unresolvedDeadStreams.data?.length
  const operatingEvents = sections.operatingEvents.data?.items?.filter((item) => EVENT_TABLE_STATUSES.has(item.status)).slice(0, 8) ?? []

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <section className="flex items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div><p className="text-sm text-slate-500">운영 현황</p><h1 className="mt-1 text-xl font-semibold text-slate-950">관리자 대시보드</h1></div>
        <div className="flex items-center gap-3"><span className="text-xs text-slate-500">{lastUpdatedAt ? `마지막 갱신 ${formatDashboardTime(lastUpdatedAt)}` : '데이터 갱신 대기 중'}</span><button type="button" onClick={() => void reload()} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><MaterialIcon name="refresh" className="text-[18px]" />새로고침</button></div>
      </section>

      <DashboardSection title="처리할 작업">
        <StatusCard title="Creator 신청" count={creatorPendingCount} meaning="승인 대기" to="/admin/reviews/creators" section={sections.creatorApplications} onRetry={reload} />
        <StatusCard title="이벤트 승인" count={pendingEventCount} meaning="승인 대기" to="/admin/reviews/events" section={sections.pendingEvents} onRetry={reload} />
        <StatusCard title="재추첨 요청" count={requestedRedrawCount} meaning="검토 필요" to="/admin/redraws" section={sections.requestedRedraws} onRetry={reload} />
      </DashboardSection>

      <DashboardSection title="주의 필요">
        <StatusCard title="마감 처리 중" count={closingEventCount} meaning="확인 필요" to="/admin/console?tab=drawings" section={sections.operatingEvents} onRetry={reload} />
        <StatusCard title="Dead Stream" count={unresolvedDeadStreamCount} meaning="미처리" to="/admin/dead-streams" section={sections.unresolvedDeadStreams} onRetry={reload} />
      </DashboardSection>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-base font-semibold text-slate-950">현재 운영 이벤트</h2><p className="mt-0.5 text-xs text-slate-500">진행·마감·추첨 상태의 이벤트를 최대 8건 표시합니다.</p></div><Link to="/admin/console?tab=drawings" className="text-sm font-medium text-pink-700 hover:text-pink-800">전체 보기 →</Link></div>
        <OperatingEventsTable section={sections.operatingEvents} events={operatingEvents} onRetry={reload} />
      </section>
    </div>
  )
}

function DashboardSection({ title, children }) {
  return <section><h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2><div className="grid grid-cols-1 gap-3 xl:grid-cols-3">{children}</div></section>
}

function StatusCard({ title, count, meaning, to, section, onRetry }) {
  return (
    <article className="flex min-h-36 flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-card">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {section.loading && <p className="mt-3 text-sm text-slate-500">조회 중...</p>}
      {!section.loading && section.error && <div className="mt-3 text-sm text-slate-500"><p>데이터를 불러오지 못했습니다.</p><button type="button" onClick={() => void onRetry()} className="mt-1 font-medium text-pink-700">다시 시도</button></div>}
      {!section.loading && !section.error && <><p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{count}건</p><p className="mt-1 text-xs text-slate-500">{count === 0 ? `대기 중인 ${title === 'Dead Stream' ? '메시지가' : '요청이'} 없습니다.` : meaning}</p></>}
      <Link to={to} className="mt-auto pt-4 text-sm font-medium text-pink-700 hover:text-pink-800">상세 보기 →</Link>
    </article>
  )
}

function OperatingEventsTable({ section, events, onRetry }) {
  if (section.loading) return <div className="px-5 py-10 text-center text-sm text-slate-500">운영 이벤트를 불러오는 중...</div>
  if (section.error) return <div className="px-5 py-10 text-center"><p className="text-sm text-slate-500">데이터를 불러오지 못했습니다.</p><button type="button" onClick={() => void onRetry()} className="mt-2 text-sm font-medium text-pink-700">다시 시도</button></div>
  if (events.length === 0) return <div className="px-5 py-10 text-center text-sm text-slate-500">현재 운영 중인 이벤트가 없습니다.</div>

  return <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs font-medium text-slate-500"><tr><th className="px-5 py-3">이벤트</th><th className="px-4 py-3">Creator</th><th className="px-4 py-3">상태</th><th className="px-4 py-3">종료일</th><th className="px-5 py-3 text-right">관리</th></tr></thead><tbody className="divide-y divide-slate-100">{events.map((event) => { const meta = eventStatusMeta(event.status); return <tr key={event.eventId}><td className="px-5 py-3"><p className="font-medium text-slate-900">{event.title}</p><p className="mt-0.5 text-xs text-slate-500">#{event.eventId}</p></td><td className="px-4 py-3 text-slate-600">{event.creatorName ?? `크리에이터 #${event.creatorId}`}</td><td className="px-4 py-3"><StatusPill label={`${meta.label} · ${event.status}`} tone={meta.tone} /></td><td className="px-4 py-3 text-slate-600">{event.endAt ? formatDateTime(event.endAt) : '조회 불가'}</td><td className="px-5 py-3 text-right"><Link to="/admin/console?tab=drawings" className="font-medium text-pink-700 hover:text-pink-800">보기</Link></td></tr> })}</tbody></table></div>
}

function formatDashboardTime(value) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(value)
}
