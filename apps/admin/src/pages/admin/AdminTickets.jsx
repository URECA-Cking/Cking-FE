import { useState } from 'react'
import { getAdminTicketBalance, getAdminTicketHistory, resyncCommonTickets, resyncCreatorTickets } from '../../api/admin.js'
import { describeError } from '../../api/client.js'
import { AdminPageHeader } from '../../components/AdminContent.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { formatDateTime, formatNumber } from '../../utils/format.js'

const PAGE_SIZE = 20
const LEDGER_LABELS = { EARN: '적립', SPEND: '사용', COMPENSATE: '수동 보정' }

/** 양수인 회원·Creator ID만 요청에 전달할 수 있도록 확인한다. */
function isPositiveId(value) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
}

/** 값이 없는 잔액과 실제 0잔액을 구분해 표시한다. */
function balanceText(value, exists) {
  return exists === false || value == null ? '없음' : `${formatNumber(value)}장`
}

/** 응모권 조회 조건을 입력받고 제출된 조건의 결과만 표시한다. */
export default function AdminTickets() {
  const [memberId, setMemberId] = useState('')
  const [couponType, setCouponType] = useState('CREATOR')
  const [creatorId, setCreatorId] = useState('')
  const [scope, setScope] = useState(null)
  const [searchId, setSearchId] = useState(0)
  const [inputError, setInputError] = useState('')

  /** 조회 조건을 검증하고 이전 조회 결과와 페이지 상태를 새 조건으로 교체한다. */
  function search(event) {
    event.preventDefault()
    const member = memberId.trim()
    const creator = creatorId.trim()
    if (!isPositiveId(member) || (couponType === 'CREATOR' && !isPositiveId(creator))) {
      setInputError('회원 ID와 필요한 Creator ID를 양수로 입력해주세요.')
      return
    }
    setInputError('')
    setScope({ memberId: Number(member), couponType, ...(couponType === 'CREATOR' ? { creatorId: Number(creator) } : {}) })
    setSearchId((current) => current + 1)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AdminPageHeader title="응모권 관리" description="회원의 응모권 잔액과 변동 이력을 확인하고 필요한 경우 수동 재동기화합니다." />
      <form onSubmit={search} className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <label className="text-sm font-medium text-slate-800">회원 ID
            <input value={memberId} onChange={(event) => setMemberId(event.target.value)} inputMode="numeric" placeholder="예: 1" className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-800">응모권 종류
            <select value={couponType} onChange={(event) => setCouponType(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
              <option value="CREATOR">Creator 전용</option>
              <option value="COMMON">공용</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-800">Creator ID {couponType === 'COMMON' && <span className="font-normal text-slate-500">(공용은 불필요)</span>}
            <input value={creatorId} onChange={(event) => setCreatorId(event.target.value)} disabled={couponType === 'COMMON'} inputMode="numeric" placeholder="예: 2" className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
          </label>
          <button type="submit" className="h-10 rounded-md bg-pink-700 px-5 text-sm font-semibold text-white hover:bg-pink-800">조회</button>
        </div>
        {inputError && <p role="alert" className="mt-3 text-sm text-red-700">{inputError}</p>}
      </form>
      {scope ? <TicketResults key={searchId} scope={scope} /> : <EmptyBlock icon="confirmation_number" message="조회할 회원과 응모권 종류를 입력해주세요." />}
    </div>
  )
}

/** 선택된 회원·응모권 범위의 잔액, 커서 이력, 수동 보정을 관리한다. */
function TicketResults({ scope }) {
  const showToast = useToast()
  const [cursor, setCursor] = useState(null)
  const [previousCursors, setPreviousCursors] = useState([])
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const balance = useAsync(() => getAdminTicketBalance(scope), [], { fallbackMessage: '잔액을 조회하지 못했습니다.' })
  const history = useAsync(() => getAdminTicketHistory({ ...scope, cursor, size: PAGE_SIZE }), [cursor], { fallbackMessage: '이력을 조회하지 못했습니다.' })

  /** 다음 커서를 기억하고 서버가 제공한 다음 이력 페이지를 연다. */
  function nextPage() {
    if (!history.data?.hasNext || !history.data.nextCursor) return
    setPreviousCursors((current) => [...current, cursor])
    setCursor(history.data.nextCursor)
  }

  /** 이전 페이지의 커서를 복원한다. */
  function previousPage() {
    if (previousCursors.length === 0) return
    setCursor(previousCursors[previousCursors.length - 1])
    setPreviousCursors((current) => current.slice(0, -1))
  }

  /** 확인한 종류에 맞는 수동 재동기화를 수행하고 최신 잔액·이력을 읽는다. */
  async function resync(event) {
    event.preventDefault()
    const trimmedReason = reason.trim()
    if (!trimmedReason || trimmedReason.length > 500 || busy) return
    setBusy(true)
    try {
      if (scope.couponType === 'CREATOR') await resyncCreatorTickets(scope.memberId, scope.creatorId, trimmedReason)
      else await resyncCommonTickets(scope.memberId, trimmedReason)
      showToast('응모권 잔액을 DB 기준으로 재동기화했습니다.')
      setConfirming(false)
      setReason('')
      await balance.reload()
      setPreviousCursors([])
      if (cursor === null) await history.reload()
      else setCursor(null)
    } catch (error) {
      showToast(describeError(error, '응모권 잔액을 재동기화하지 못했습니다.'), { icon: 'error' })
      await balance.reload()
    } finally {
      setBusy(false)
    }
  }

  const data = balance.data
  const difference = data?.balanceDifference
  const differenceLabel = difference == null ? '비교 불가' : difference === 0 ? '일치' : '차이 있음'

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div><h2 className="font-semibold text-slate-950">잔액 관측</h2><p className="mt-1 text-sm text-slate-500">회원 #{scope.memberId} · {scope.couponType === 'CREATOR' ? `Creator #${scope.creatorId}` : '공용 응모권'}</p></div>
          <button type="button" onClick={() => void balance.reload()} disabled={balance.loading} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50">잔액 새로고침</button>
        </div>
        {balance.loading && <LoadingBlock label="잔액을 조회하는 중..." />}
        {!balance.loading && balance.error && <ErrorBlock message={balance.error} onRetry={balance.reload} />}
        {!balance.loading && !balance.error && data && (
          <div className="p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <BalanceCard label="Redis 잔액" value={balanceText(data.redisBalance, data.redisKeyExists)} />
              <BalanceCard label="MySQL 잔액" value={balanceText(data.mysqlBalance, data.mysqlBalanceRowExists)} />
              <BalanceCard label="잔액 비교" value={differenceLabel} detail={difference == null ? '저장소에 없는 값이 있어 비교할 수 없습니다.' : `Redis − MySQL: ${formatNumber(difference)}장`} />
            </div>
            <p className="mt-4 text-xs text-slate-500">관측 시각: {formatDateTime(data.observedAt)} · 두 저장소는 서로 다른 시점에 읽습니다. 일시적인 차이만으로 장애를 판단하지 마세요.</p>
            <button type="button" onClick={() => setConfirming(true)} className="mt-5 rounded-md border border-pink-700 px-4 py-2 text-sm font-semibold text-pink-700 hover:bg-pink-50">수동 재동기화</button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-950">변동 이력</h2><p className="mt-1 text-sm text-slate-500">최근 기록부터 표시합니다.</p></div><button type="button" onClick={() => void history.reload()} disabled={history.loading} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50">이력 새로고침</button></div>
        {history.loading && <LoadingBlock label="응모권 이력을 조회하는 중..." />}
        {!history.loading && history.error && <ErrorBlock message={history.error} onRetry={history.reload} />}
        {!history.loading && !history.error && history.data && (history.data.items ?? []).length === 0 && <EmptyBlock icon="history" message="응모권 변동 이력이 없습니다." />}
        {!history.loading && !history.error && (history.data?.items ?? []).length > 0 && <HistoryTable items={history.data.items} />}
        {!history.loading && !history.error && history.data && <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3"><span className="text-sm text-slate-500">{previousCursors.length + 1}페이지</span><div className="flex gap-2"><button type="button" disabled={previousCursors.length === 0} onClick={previousPage} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">이전</button><button type="button" disabled={!history.data.hasNext || !history.data.nextCursor} onClick={nextPage} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">다음</button></div></div>}
      </section>

      {confirming && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4" role="presentation"><form onSubmit={resync} role="dialog" aria-modal="true" aria-labelledby="ticket-resync-title" className="w-full max-w-md rounded-lg bg-white p-6 shadow-floating"><h2 id="ticket-resync-title" className="text-lg font-semibold">수동 재동기화 확인</h2><p className="mt-2 text-sm leading-6 text-slate-600">회원 #{scope.memberId}의 {scope.couponType === 'CREATOR' ? `Creator #${scope.creatorId} 응모권` : '공용 응모권'} Redis 잔액을 DB 기준으로 맞춥니다. 미반영 메시지가 있으면 서버가 보정을 거부합니다.</p><label className="mt-5 block text-sm font-medium text-slate-800">보정 사유 <span className="text-red-700">*</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={500} disabled={busy} rows={4} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><p className="mt-1 text-right text-xs text-slate-500">{reason.length}/500자</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirming(false)} disabled={busy} className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">취소</button><button type="submit" disabled={busy || !reason.trim()} className="rounded-md bg-pink-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? '처리 중...' : '재동기화'}</button></div></form></div>}
    </div>
  )
}

/** 한 저장소의 잔액 또는 비교 상태를 카드로 표시한다. */
function BalanceCard({ label, value, detail }) {
  return <div className="rounded-md bg-slate-50 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>
}

/** 응모권 원장 항목의 유형·증감·관련 ID·사유를 표시한다. */
function HistoryTable({ items }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">발생 시각</th><th className="px-4 py-3">유형</th><th className="px-4 py-3">증감</th><th className="px-4 py-3">관련 항목</th><th className="px-5 py-3">사유</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.ledgerId}><td className="px-5 py-3 text-slate-600">{formatDateTime(item.createdAt)}</td><td className="px-4 py-3"><StatusPill label={LEDGER_LABELS[item.type] ?? item.type} /></td><td className={`px-4 py-3 font-semibold ${item.deltaAmount < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{item.deltaAmount > 0 ? '+' : ''}{formatNumber(item.deltaAmount)}</td><td className="px-4 py-3 text-slate-600">{item.missionId ? `미션 #${item.missionId}` : item.eventId ? `이벤트 #${item.eventId}` : '-'}</td><td className="px-5 py-3 text-slate-600">{item.reason || '-'}</td></tr>)}</tbody></table></div>
}
