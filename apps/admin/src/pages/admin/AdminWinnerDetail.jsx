import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { disqualifyWinner, getWinnerHistory, receiveWinner } from '../../api/admin.js'
import { describeError } from '../../api/client.js'
import { AdminPageHeader, DetailInfoRows } from '../../components/AdminContent.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/States.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'

/** 전용 목록 API가 없으므로 추첨 결과에서 당첨자 상세로 진입하도록 안내한다. */
export default function AdminWinners() {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <AdminPageHeader title="당첨자 관리" description="당첨자의 현재 상태와 처리 이력은 추첨 결과에서 선택해 관리합니다." />
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-950">당첨자 전체 목록을 제공하지 않습니다</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">현재 관리자 API에는 전체 당첨자 또는 단건 당첨자 조회 계약이 없습니다. 모든 추첨 결과를 순회해 목록을 만들지 않고, 각 Drawing 결과에서 당첨자를 선택하는 운영 흐름을 유지합니다.</p>
      <Link to="/admin/drawings" className="mt-5 inline-flex h-10 items-center rounded-md bg-pink-700 px-4 text-sm font-semibold text-white hover:bg-pink-800">추첨 관리로 이동</Link>
    </section>
  </div>
}

/** Drawing Result에서 전달된 Winner와 상태 이력을 함께 표시하고, 서버 명령으로만 상태를 변경한다. */
export function AdminWinnerDetail() {
  const { winnerId } = useParams()
  const { state } = useLocation()
  const winner = state?.winner
  const showToast = useToast()
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const history = useAsync(() => getWinnerHistory(winnerId), [winnerId], { fallbackMessage: '상태 변경 이력을 불러오지 못했습니다.' })
  const currentStatus = history.data?.at(-1)?.afterStatus
    ?? winner?.winnerManagementStatus
    ?? (!history.loading && !history.error && winner ? 'SELECTED' : null)

  async function runAction(reason) {
    if (!action) return
    setBusy(true)
    try {
      if (action === 'receive') await receiveWinner(winnerId)
      else await disqualifyWinner(winnerId, reason)
      showToast(action === 'receive' ? '수령 완료 처리되었습니다.' : '당첨자 자격을 박탈했습니다.')
      setAction(null)
      await history.reload()
    } catch (error) {
      showToast(describeError(error, action === 'receive' ? '수령 완료 처리에 실패했습니다.' : '자격 박탈 처리에 실패했습니다.'), { icon: 'error' })
      await history.reload()
    } finally {
      setBusy(false)
    }
  }

  const header = <div>
    <Link to="/admin/winners" className="text-sm font-medium text-pink-700 hover:text-pink-800">← 당첨자 관리</Link>
    <AdminPageHeader title="당첨자 상세" description={`Winner #${winnerId}의 상태와 처리 이력을 확인합니다.`} />
  </div>

  if (!winner) return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    {header}
    {history.loading ? <LoadingBlock label="당첨자 정보를 확인하는 중..." /> : <EmptyBlock icon="workspace_premium" message="당첨자 기본 정보가 없습니다. 추첨 결과에서 상세 보기를 선택해주세요." />}
  </div>

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    {header}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="border-y border-slate-200 bg-white">
        <DetailInfoRows title="기본 정보" rows={[
          ['Winner ID', winnerId],
          ['User ID', winner?.userId == null ? '-' : `#${winner.userId}`],
          ['이름', winner?.name ?? '-'],
          ['연락처', winner.phone ?? winner.phoneNumber ?? '-'],
          ['현재 상태', currentStatus ? <StatusBadge key="status" type="winner" status={currentStatus} /> : '-'],
        ]} />
        <DetailInfoRows title="당첨 정보" rows={[
          ['Event ID', winner?.eventId == null ? '-' : `#${winner.eventId}`],
          ['이벤트명', winner?.eventTitle ?? '-'],
          ['Drawing ID', winner?.drawingId == null ? '-' : `#${winner.drawingId}`],
          ['Drawing 유형', winner?.drawType ?? '-'],
          ['회차', winner?.drawNo == null ? '-' : `${winner.drawNo}회차`],
          ['당첨 순위', winner?.rankInDrawing == null ? '-' : `${winner.rankInDrawing}위`],
          ['상품', winner?.prizeDisplayName ?? '-'],
          ['사용 응모권', winner?.appliedTicketCount == null ? '-' : `${formatNumber(winner.appliedTicketCount)}장`],
        ]} />
        <HistorySection history={history} />
      </section>
      <WinnerActionPanel status={currentStatus} busy={busy} onAction={setAction} onRefresh={history.reload} />
    </div>
    {action && <ConfirmModal action={action === 'disqualify' ? 'reject' : 'confirm'} subject={`Winner #${winnerId}`} busy={busy} onCancel={() => setAction(null)} onConfirm={(reason) => void runAction(reason)} {...confirmCopy(action)} />}
  </div>
}

function HistorySection({ history }) {
  return <section className="border-b border-slate-200 px-5 py-5 last:border-b-0"><h2 className="text-sm font-semibold text-slate-900">상태 변경 이력</h2>
    {history.loading && <LoadingBlock label="상태 변경 이력을 불러오는 중..." />}
    {!history.loading && history.error && <ErrorBlock message={history.error} onRetry={history.reload} />}
    {!history.loading && !history.error && !(history.data?.length) && <EmptyBlock icon="history" message="상태 변경 이력이 없습니다." />}
    {!history.loading && !history.error && history.data?.length > 0 && <ol className="mt-4 flex flex-col gap-4 border-l-2 border-pink-100 pl-4">{history.data.map((item, index) => <li key={item.historyId ?? `${item.changedAt}-${index}`} className="relative"><span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-pink-600" /><div className="flex flex-wrap items-center gap-2"><StatusBadge type="winner" status={item.afterStatus} /><span className="text-xs text-slate-500">{formatDateTime(item.changedAt)}</span></div>{item.reason && <p className="mt-1 text-sm text-slate-600">{item.reason}</p>}</li>)}</ol>}
  </section>
}

function WinnerActionPanel({ status, busy, onAction, onRefresh }) {
  const redrawLink = '/admin/redraws'
  return <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">현재 가능한 작업</h2><div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
    {status === 'SELECTED' && <><p>당첨 상태입니다. 서버 명령을 통해 수령 완료 또는 자격 박탈 처리할 수 있습니다.</p><button type="button" disabled={busy} onClick={() => onAction('receive')} className="h-10 w-full rounded-md bg-pink-700 px-3 font-semibold text-white hover:bg-pink-800 disabled:opacity-50">{busy ? '처리 중...' : '수령 완료'}</button><button type="button" disabled={busy} onClick={() => onAction('disqualify')} className="h-10 w-full rounded-md border border-red-200 bg-red-50 px-3 font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50">자격 박탈</button></>}
    {status === 'RECEIVED' && <p>수령 완료된 당첨자입니다. 추가 관리자 처리가 없습니다.</p>}
    {status === 'DECLINED' && <><p>당첨 포기 상태입니다. 추가 관리자 처리가 없습니다.</p><Link to={redrawLink} className="block font-medium text-pink-700 hover:text-pink-800">재추첨 관리에서 확인 →</Link></>}
    {status === 'DISQUALIFIED' && <><p>자격 박탈 상태입니다. 결원과 재추첨 필요 여부는 서버가 판단합니다.</p><Link to={redrawLink} className="block font-medium text-pink-700 hover:text-pink-800">재추첨 관리에서 확인 →</Link></>}
    {!status && <p>현재 상태를 확인할 수 없어 작업을 제공하지 않습니다.</p>}
    <button type="button" disabled={busy} onClick={() => void onRefresh()} className="w-full text-sm font-medium text-pink-700 hover:text-pink-800 disabled:opacity-50">새로고침</button>
  </div></aside>
}

function confirmCopy(action) {
  if (action === 'receive') return { title: '수령 완료 처리할까요?', message: '이 당첨자를 수령 완료 상태로 변경합니다.', confirmLabel: '수령 완료' }
  return { title: '당첨자 자격을 박탈할까요?', message: '자격 박탈 사유를 입력해주세요. 처리 후 결원과 재추첨 필요 여부는 서버가 판단합니다.', confirmLabel: '자격 박탈', reasonLabel: '자격 박탈 사유', busyLabel: '자격 박탈 처리 중...' }
}
