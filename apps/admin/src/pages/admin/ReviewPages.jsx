import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { AdminPageHeader, DetailInfoRows } from '../../components/AdminContent.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { approveCreatorApplication, approveEvent, getAllCreatorApplications, getAllPendingEvents, rejectCreatorApplication, rejectEvent } from '../../api/admin.js'
import { describeError } from '../../api/client.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'

const CONFIG = {
  creators: {
    title: 'Creator 신청 관리', description: 'Creator 권한 신청을 검토하고 승인하거나 거절합니다.', listPath: '/admin/reviews/creators', loadList: async () => ({ items: await getAllCreatorApplications() }), loadDetail: async () => ({ items: await getAllCreatorApplications() }), itemId: (item) => item.applicationId,
    empty: '현재 검토할 Creator 신청이 없습니다.', searchPlaceholder: '신청 ID 또는 신청자 검색', matches: (item, term) => [item.applicationId, item.applicantName, item.applicantUserId].some((value) => String(value ?? '').toLowerCase().includes(term)),
    subject: (item) => `${item.applicantName}님의 Creator 신청`, status: (item) => item.status,
  },
  events: {
    title: '이벤트 승인 관리', description: '승인 대기 중인 Creator 이벤트를 심사합니다.', listPath: '/admin/reviews/events', loadList: async () => ({ items: await getAllPendingEvents() }), loadDetail: async () => ({ items: await getAllPendingEvents() }), itemId: (item) => item.eventId,
    empty: '현재 승인 대기 중인 이벤트가 없습니다.', searchPlaceholder: '이벤트 ID, 이벤트명 또는 Creator 검색', matches: (item, term) => [item.eventId, item.title, item.creatorName, item.creatorId].some((value) => String(value ?? '').toLowerCase().includes(term)),
    subject: (item) => `“${item.title}” 이벤트`, status: (item) => item.status,
  },
}

/** Creator 신청과 이벤트 승인을 같은 목록·상세 심사 흐름으로 제공한다. */
export function ReviewListPage({ type }) {
  const config = CONFIG[type]
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('PENDING')
  const { data, loading, error, reload } = useAsync(config.loadList, [], { fallbackMessage: '목록을 불러오지 못했습니다.' })
  const items = data?.items ?? []
  const filteredItems = items.filter((item) => {
    const currentStatus = config.status(item)
    return (type === 'events' || !status || currentStatus === status) && config.matches(item, query.trim().toLowerCase())
  })

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <AdminPageHeader title={config.title} description={config.description} />
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
        <label className="min-w-64 flex-1 text-xs font-medium text-slate-600">검색<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={config.searchPlaceholder} className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600" /></label>
        {type === 'creators' ? <label className="w-36 text-xs font-medium text-slate-600">상태<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-pink-600"><option value="">전체</option><option value="PENDING">승인 대기</option><option value="APPROVED">승인 완료</option><option value="REJECTED">거절</option></select></label> : <span className="h-9 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">승인 대기 심사 큐</span>}
        <button type="button" onClick={() => void reload()} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button>
      </div>
      {loading && <LoadingBlock label="목록을 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && (filteredItems.length === 0 ? <EmptyBlock icon="done_all" message={items.length === 0 ? config.empty : '검색 조건에 맞는 항목이 없습니다.'} /> : <ReviewTable type={type} config={config} items={filteredItems} />)}
    </section>
  </div>
}

function ReviewTable({ type, config, items }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-slate-50 text-xs font-medium text-slate-500"><tr>{type === 'creators' ? <><th className="px-5 py-3">신청 ID</th><th className="px-4 py-3">신청자</th><th className="px-4 py-3">상태</th><th className="px-4 py-3">신청일</th><th className="px-4 py-3">처리일</th></> : <><th className="px-5 py-3">이벤트 ID</th><th className="px-4 py-3">이벤트명</th><th className="px-4 py-3">Creator</th><th className="px-4 py-3">상태</th><th className="px-4 py-3">승인 요청일</th></>}<th className="px-5 py-3 text-right">관리</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={config.itemId(item)} className="hover:bg-slate-50"><td className="px-5 py-3 font-medium text-slate-900">#{config.itemId(item)}</td>{type === 'creators' ? <><td className="px-4 py-3 text-slate-700">{item.applicantName} <span className="text-slate-500">#{item.applicantUserId}</span></td><td className="px-4 py-3"><StatusBadge status={config.status(item)} /></td><td className="px-4 py-3 text-slate-600">{formatDateTime(item.requestedAt)}</td><td className="px-4 py-3 text-slate-600">{item.reviewedAt ? formatDateTime(item.reviewedAt) : '-'}</td></> : <><td className="px-4 py-3 font-medium text-slate-900">{item.title}</td><td className="px-4 py-3 text-slate-600">{item.creatorName ?? `#${item.creatorId}`}</td><td className="px-4 py-3"><StatusBadge status={config.status(item)} /></td><td className="px-4 py-3 text-slate-600">{formatDateTime(item.requestedAt)}</td></>}<td className="px-5 py-3 text-right"><Link to={`${config.listPath}/${config.itemId(item)}`} className="font-medium text-pink-700 hover:text-pink-800">상세 보기</Link></td></tr>)}</tbody></table></div>
}

/** 목록 API가 유일한 조회 계약인 현재 상태에서, 해당 목록을 다시 읽어 URL 기반 상세 화면을 구성한다. */
export function ReviewDetailPage({ type }) {
  const config = CONFIG[type]
  const { reviewId } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, reload } = useAsync(config.loadDetail, [type], { fallbackMessage: '상세 정보를 불러오지 못했습니다.' })
  const item = data?.items?.find((candidate) => String(config.itemId(candidate)) === reviewId)

  async function decide(reason) {
    if (!item || !action) return
    setBusy(true)
    try {
      if (type === 'creators') {
        if (action === 'approve') await approveCreatorApplication(item.applicationId)
        else await rejectCreatorApplication(item.applicationId, reason)
      } else if (action === 'approve') await approveEvent(item.eventId)
      else await rejectEvent(item.eventId, reason)
      showToast(action === 'approve' ? '승인 처리했습니다.' : '거절 처리했습니다.')
      navigate(config.listPath, { replace: true })
    } catch (err) { showToast(describeError(err, '심사 처리에 실패했습니다.'), { icon: 'error' }) } finally { setBusy(false) }
  }

  if (loading) return <LoadingBlock label="상세 정보를 불러오는 중..." />
  if (error) return <ErrorBlock message={error} onRetry={reload} />
  if (!item) return <div className="mx-auto max-w-6xl"><EmptyBlock message="현재 목록에서 해당 심사 대상을 찾을 수 없습니다." /><Link to={config.listPath} className="text-sm font-medium text-pink-700">목록으로 돌아가기</Link></div>
  const pending = config.status(item) === 'PENDING' || config.status(item) === 'PENDING_APPROVAL'
  const basicRows = type === 'creators'
    ? [['Application ID', item.applicationId], ['신청자', item.applicantName], ['Member ID', item.applicantUserId], ['신청 상태', <StatusBadge key="creator-status" status={item.status} />], ['신청 시간', formatDateTime(item.requestedAt)]]
    : [['Event ID', item.eventId], ['이벤트명', item.title], ['Creator', item.creatorName ?? `#${item.creatorId}`], ['상태', <StatusBadge key="event-status" status={item.status} />], ['승인 요청일', formatDateTime(item.requestedAt)]]
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-6"><div><Link to={config.listPath} className="text-sm font-medium text-pink-700 hover:text-pink-800">← {config.title} 목록</Link><h1 className="mt-3 text-xl font-semibold text-slate-950">{type === 'creators' ? 'Creator 신청 상세' : '이벤트 승인 상세'}</h1></div><section className="border-y border-slate-200 bg-white"><DetailInfoRows title="기본 정보" rows={basicRows} />{type === 'creators' ? <DetailInfoRows title="처리 정보" rows={[['처리 시간', item.reviewedAt ? formatDateTime(item.reviewedAt) : '-'], ['처리자', item.reviewedBy ? `#${item.reviewedBy}` : '-'], ['거절 사유', item.rejectReason ?? '-']]} /> : <><DetailInfoRows title="진행 정보" rows={[['시작일', formatDateTime(item.startAt)], ['종료일', formatDateTime(item.endAt)], ['당첨 인원', `${formatNumber(item.winnerCount)}명`], ['추첨 방식', item.drawMethod], ['승인 요청 차수', `${item.approvalRound}차`]]} />{item.prizes?.length > 0 && <DetailInfoRows title="상품" rows={item.prizes.map((prize) => [prize.displayName, `${formatNumber(prize.quantity)}개`])} />}</>}</section>{pending && <div className="flex justify-end gap-2"><button type="button" onClick={() => setAction('reject')} className="h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800 hover:bg-red-100">거절</button><button type="button" onClick={() => setAction('approve')} className="h-10 rounded-md bg-pink-700 px-4 text-sm font-semibold text-white hover:bg-pink-800">승인</button></div>}{action && <ConfirmModal action={action} subject={config.subject(item)} busy={busy} onCancel={() => setAction(null)} onConfirm={(reason) => void decide(reason)} />}</div>
}
