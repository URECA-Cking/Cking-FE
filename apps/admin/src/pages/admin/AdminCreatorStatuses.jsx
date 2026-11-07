import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { AdminPageHeader, DetailInfoRows } from '../../components/AdminContent.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/States.jsx'
import Pagination from '../../components/Pagination.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import {
  getCreatorStatusHistory,
  getManagedCreator,
  getManagedCreators,
  reactivateCreator,
  revokeCreator,
  suspendCreator,
} from '../../api/admin.js'
import { ApiError, describeError } from '../../api/client.js'
import { formatDateTime } from '../../utils/format.js'
import { CREATOR_STATUS_META } from '../../utils/eventStatus.js'

const REASON_CODES = {
  POLICY_VIOLATION: '운영 정책 위반',
  ABUSE: '비정상 이용',
  INACTIVITY: '장기 미활동',
  REVIEW_COMPLETED: '심사 완료',
  OTHER: '기타',
}
const STATUS_COMMANDS_ENABLED = import.meta.env.VITE_CREATOR_STATUS_MANAGEMENT_ENABLED === 'true'

const creatorStatusLabel = (status) => CREATOR_STATUS_META[status]?.label ?? '상태 확인 필요'
const reasonCodeLabel = (reasonCode) => REASON_CODES[reasonCode] ?? '사유 확인 필요'

export default function AdminCreatorStatuses() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const { data, loading, error, reload } = useAsync(
    () => getManagedCreators({ status: status || undefined, page, size: 20 }),
    [status, page],
    { fallbackMessage: '크리에이터 목록을 불러오지 못했습니다.' },
  )
  const items = data?.items ?? []

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AdminPageHeader title="Creator 자격 관리" description="크리에이터 활동 상태와 자격 변경 이력을 관리합니다." />
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-end gap-3 border-b border-slate-200 p-4">
          <label className="w-40 text-xs font-medium text-slate-600">
            상태
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0) }} className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
              <option value="">전체</option>
              <option value="ACTIVE">활동 가능</option>
              <option value="SUSPENDED">활동 정지</option>
              <option value="REVOKED">자격 박탈</option>
            </select>
          </label>
          <button type="button" onClick={() => void reload()} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700">새로고침</button>
        </div>
        {loading && <LoadingBlock label="크리에이터 목록을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && (items.length ? <CreatorTable items={items} /> : <EmptyBlock icon="groups" message="조회 조건에 맞는 크리에이터가 없습니다." />)}
        {!loading && !error && <Pagination page={page} hasNext={data?.hasNext === true} totalElements={data?.totalElements} onPrevious={() => setPage((current) => Math.max(0, current - 1))} onNext={() => setPage((current) => current + 1)} />}
      </section>
    </div>
  )
}

function CreatorTable({ items }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr><th className="px-5 py-3">Creator</th><th className="px-4 py-3">회원</th><th className="px-4 py-3">상태</th><th className="px-4 py-3">안내</th><th className="px-5 py-3 text-right">관리</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.creatorId}>
              <td className="px-5 py-3 font-medium text-slate-900">{item.activityName ?? `Creator #${item.creatorId}`}<span className="ml-2 text-slate-500">#{item.creatorId}</span></td>
              <td className="px-4 py-3 text-slate-600">#{item.memberId}</td>
              <td className="px-4 py-3"><StatusBadge status={item.status} type="creator" /></td>
              <td className="max-w-xs truncate px-4 py-3 text-slate-600">{item.publicNotice ?? '-'}</td>
              <td className="px-5 py-3 text-right"><Link to={`/admin/creators/${item.creatorId}`} className="font-medium text-pink-700">상세 보기</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AdminCreatorStatusDetail() {
  const { creatorId } = useParams()
  const showToast = useToast()
  const [action, setAction] = useState(null)
  const [historyPage, setHistoryPage] = useState(0)
  const creator = useAsync(() => getManagedCreator(creatorId), [creatorId], { fallbackMessage: '크리에이터 정보를 불러오지 못했습니다.' })
  const history = useAsync(() => getCreatorStatusHistory(creatorId, { page: historyPage, size: 20 }), [creatorId, historyPage], { fallbackMessage: '자격 변경 이력을 불러오는 중...' })

  async function changed() {
    setAction(null)
    await Promise.all([creator.reload(), history.reload()])
    showToast('크리에이터 자격 상태를 변경했습니다.')
  }

  if (creator.loading) return <LoadingBlock label="크리에이터 정보를 불러오는 중..." />
  if (creator.error) return <ErrorBlock message={creator.error} onRetry={creator.reload} />
  const item = creator.data
  const historyRows = (history.data?.items ?? []).length
    ? history.data.items.map((entry) => [
      `${entry.previousStatus ? creatorStatusLabel(entry.previousStatus) : '-'} → ${creatorStatusLabel(entry.status)}`,
      `${reasonCodeLabel(entry.reasonCode)} · ${entry.publicNotice} · ${entry.detailReason ?? '-'} · ${formatDateTime(entry.createdAt)}`,
    ])
    : [['이력', '변경 이력이 없습니다.']]

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div><Link to="/admin/creators" className="text-sm font-medium text-pink-700">← Creator 자격 관리</Link><h1 className="mt-3 text-xl font-semibold text-slate-950">Creator 자격 상세</h1></div>
      <section className="border-y border-slate-200 bg-white">
        <DetailInfoRows title="기본 정보" rows={[["Creator ID", item.creatorId], ['회원 ID', item.memberId], ['활동명', item.activityName ?? '-'], ['현재 상태', <StatusBadge key="status" status={item.status} type="creator" />], ['공개 안내', item.publicNotice ?? '-'], ['생성 시각', formatDateTime(item.createdAt)]]} />
        {history.loading ? <LoadingBlock label="자격 변경 이력을 불러오는 중..." /> : history.error ? <ErrorBlock message={history.error} onRetry={history.reload} /> : <><DetailInfoRows title="자격 변경 이력" rows={historyRows} /><Pagination page={historyPage} hasNext={history.data?.hasNext === true} totalElements={history.data?.totalElements} onPrevious={() => setHistoryPage((current) => Math.max(0, current - 1))} onNext={() => setHistoryPage((current) => current + 1)} /></>}
      </section>
      {STATUS_COMMANDS_ENABLED && <StatusActions status={item.status} onAction={setAction} />}
      {action && <CreatorStatusModal creatorId={item.creatorId} action={action} onClose={() => setAction(null)} onDone={changed} onError={(error) => showToast(describeError(error, '자격 상태를 변경하지 못했습니다.'), { icon: 'error' })} />}
    </div>
  )
}

function StatusActions({ status, onAction }) {
  return <div className="flex justify-end gap-2">{status === 'ACTIVE' && <><button type="button" onClick={() => onAction('suspend')} className="h-10 rounded-md border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-800">활동 정지</button><button type="button" onClick={() => onAction('revoke')} className="h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800">자격 박탈</button></>}{status === 'SUSPENDED' && <><button type="button" onClick={() => onAction('reactivate')} className="h-10 rounded-md bg-pink-700 px-4 text-sm font-semibold text-white">정지 해제</button><button type="button" onClick={() => onAction('revoke')} className="h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800">자격 박탈</button></>}</div>
}

function CreatorStatusModal({ creatorId, action, onClose, onDone, onError }) {
  const [reasonCode, setReasonCode] = useState('POLICY_VIOLATION')
  const [detailReason, setDetailReason] = useState('')
  const [publicNotice, setPublicNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  const [submittedBody, setSubmittedBody] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const label = action === 'suspend' ? '활동 정지' : action === 'reactivate' ? '정지 해제' : '자격 박탈'

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setSubmitError('')
    const body = submittedBody ?? { requestId, reasonCode, detailReason: detailReason.trim(), publicNotice: publicNotice.trim() }
    setSubmittedBody(body)
    try {
      const command = action === 'suspend' ? suspendCreator : action === 'reactivate' ? reactivateCreator : revokeCreator
      await command(creatorId, body)
      await onDone()
    } catch (error) {
      if (error instanceof ApiError && [409, 503].includes(error.status)) {
        setSubmittedBody(null)
        setSubmitError('현재 상태에서는 요청을 처리할 수 없어요. 최신 상태를 확인한 뒤 다시 시도해주세요.')
      } else {
        onError(error)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-6 shadow-floating">
        <h2 className="text-lg font-semibold text-slate-950">{label} 확인</h2>
        <p className="mt-2 text-sm text-slate-600">공개 안내는 크리에이터에게 표시되고, 상세 사유는 관리자만 볼 수 있습니다.</p>
        <fieldset disabled={Boolean(submittedBody)}>
          <label className="mt-4 block text-sm font-medium text-slate-800">사유 코드<select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 px-2">{Object.entries(REASON_CODES).map(([code, text]) => <option key={code} value={code}>{text}</option>)}</select></label>
          <label className="mt-4 block text-sm font-medium text-slate-800">상세 사유<textarea required value={detailReason} onChange={(event) => setDetailReason(event.target.value)} maxLength={1000} rows="3" className="mt-1.5 block w-full rounded-md border border-slate-300 px-3 py-2" /></label>
          <label className="mt-4 block text-sm font-medium text-slate-800">공개 안내<textarea required value={publicNotice} onChange={(event) => setPublicNotice(event.target.value)} maxLength={500} rows="3" className="mt-1.5 block w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        </fieldset>
        {submitError && <p role="alert" className="mt-4 text-sm text-error">{submitError}</p>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="h-9 rounded-md border border-slate-300 px-3 text-sm">취소</button><button type="submit" disabled={busy || !detailReason.trim() || !publicNotice.trim()} className="h-9 rounded-md bg-pink-700 px-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? '처리 중...' : label}</button></div>
      </form>
    </div>
  )
}
