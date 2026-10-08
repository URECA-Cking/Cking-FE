import { Link, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { AdminPageHeader, DetailInfoRows } from '../../components/AdminContent.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { ApiError, describeError } from '../../api/client.js'
import { getAbuseDetection, getAbuseDetections, reviewAbuseDetection } from '../../api/admin.js'
import { formatDateTime } from '../../utils/format.js'
import {
  ABUSE_STATUS_META,
  ABUSE_TYPE_META,
  abuseStatusLabel,
  abuseTypeLabel,
  formatMaxDelay,
  formatWindow,
  metricLabel,
  ruleLabels,
  scopeSummary,
  toUtcDateTime,
} from '../../utils/abuseDetection.js'

const PAGE_SIZE = 20

const EMPTY_FILTERS = {
  memberId: '',
  abuseType: '',
  status: '',
  detectedAtFrom: '',
  detectedAtTo: '',
}

/** Abuse Detection 운영 목록과 서버 페이지네이션·필터를 제공한다. */
export function AdminAbuseDetectionListPage() {
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [searchVersion, setSearchVersion] = useState(0)
  const [validationMessage, setValidationMessage] = useState('')
  const query = useMemo(() => ({
    memberId: filters.memberId ? Number(filters.memberId) : undefined,
    abuseType: filters.abuseType || undefined,
    status: filters.status || undefined,
    detectedAtFrom: toUtcDateTime(filters.detectedAtFrom),
    detectedAtTo: toUtcDateTime(filters.detectedAtTo, { endOfMinute: true }),
    page,
    size: PAGE_SIZE,
  }), [filters, page])
  const { data, loading, error, reload } = useAsync(
    () => getAbuseDetections(query),
    [query.memberId, query.abuseType, query.status, query.detectedAtFrom, query.detectedAtTo, query.page, searchVersion],
    { fallbackMessage: '이상행위 탐지 목록을 불러오지 못했습니다.' },
  )
  const items = data?.items ?? []

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function applyFilters(event) {
    event.preventDefault()
    const memberId = draft.memberId ? Number(draft.memberId) : undefined
    const from = toUtcDateTime(draft.detectedAtFrom)
    const to = toUtcDateTime(draft.detectedAtTo, { endOfMinute: true })
    if (draft.memberId && (!Number.isSafeInteger(memberId) || memberId <= 0)) {
      setValidationMessage('회원 ID는 양의 정수로 입력해주세요.')
      return
    }
    if ((draft.detectedAtFrom && !from) || (draft.detectedAtTo && !to)) {
      setValidationMessage('탐지 기간 형식이 올바르지 않습니다.')
      return
    }
    if (from && to && from > to) {
      setValidationMessage('시작 시각은 종료 시각보다 늦을 수 없습니다.')
      return
    }
    setValidationMessage('')
    setFilters(draft)
    setPage(0)
    setSearchVersion((current) => current + 1)
  }

  function resetFilters() {
    setDraft(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setPage(0)
    setSearchVersion((current) => current + 1)
    setValidationMessage('')
  }

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <AdminPageHeader title="이상행위 탐지" description="자동 차단 없이 탐지 근거를 검토하고 운영 판정을 기록합니다." />
    <form onSubmit={applyFilters} className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <FilterInput label="회원 ID" type="number" min="1" value={draft.memberId} onChange={(value) => updateDraft('memberId', value)} placeholder="예: 7" />
        <FilterSelect label="탐지 유형" value={draft.abuseType} onChange={(value) => updateDraft('abuseType', value)} options={ABUSE_TYPE_META} />
        <FilterSelect label="검토 상태" value={draft.status} onChange={(value) => updateDraft('status', value)} options={ABUSE_STATUS_META} />
        <FilterInput label="탐지 시작" type="datetime-local" value={draft.detectedAtFrom} onChange={(value) => updateDraft('detectedAtFrom', value)} />
        <FilterInput label="탐지 종료" type="datetime-local" value={draft.detectedAtTo} onChange={(value) => updateDraft('detectedAtTo', value)} />
      </div>
      {validationMessage && <p role="alert" className="mt-3 text-sm text-red-700">{validationMessage}</p>}
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={resetFilters} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">초기화</button><button type="submit" className="h-9 rounded-md bg-pink-700 px-3 text-sm font-semibold text-white hover:bg-pink-800">조회</button></div>
    </form>
    <section className="rounded-lg border border-slate-200 bg-white">
      {loading && <LoadingBlock label="이상행위 탐지 목록을 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && (items.length === 0 ? <EmptyBlock icon="policy" message="조건에 해당하는 탐지 결과가 없습니다." /> : <DetectionTable items={items} />)}
      {!loading && !error && <Pagination page={data?.page ?? page} hasNext={data?.hasNext === true} totalElements={data?.totalElements} onPrevious={() => setPage((current) => Math.max(0, current - 1))} onNext={() => setPage((current) => current + 1)} />}
    </section>
  </div>
}

function FilterInput({ label, ...inputProps }) {
  return <label className="text-xs font-medium text-slate-600">{label}<input {...inputProps} onChange={(event) => inputProps.onChange(event.target.value)} className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600" /></label>
}

function FilterSelect({ label, value, onChange, options }) {
  return <label className="text-xs font-medium text-slate-600">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600"><option value="">전체</option>{Object.entries(options).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select></label>
}

function DetectionTable({ items }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs font-medium text-slate-500"><tr><th className="px-5 py-3">탐지 ID</th><th className="px-4 py-3">회원</th><th className="px-4 py-3">유형</th><th className="px-4 py-3">상태</th><th className="px-4 py-3">범위</th><th className="px-4 py-3">매칭 Rule</th><th className="px-4 py-3">탐지 시각</th><th className="px-5 py-3 text-right">관리</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.detectionId} className="hover:bg-slate-50"><td className="px-5 py-3 font-medium text-slate-900">#{item.detectionId}</td><td className="px-4 py-3 text-slate-700">#{item.memberId}</td><td className="px-4 py-3"><TypeBadge type={item.abuseType} /></td><td className="px-4 py-3"><StatusBadge status={item.status} /></td><td className="max-w-56 truncate px-4 py-3 text-slate-600" title={scopeSummary(item.evidenceSummary?.scope)}>{scopeSummary(item.evidenceSummary?.scope)}</td><td className="max-w-48 truncate px-4 py-3 text-slate-600" title={ruleLabels(item.evidenceSummary?.matchedRules)}>{ruleLabels(item.evidenceSummary?.matchedRules)}</td><td className="px-4 py-3 text-slate-600">{formatDateTime(item.detectedAt)}</td><td className="px-5 py-3 text-right"><Link to={`/admin/abuse-detections/${item.detectionId}`} className="font-medium text-pink-700 hover:text-pink-800">상세 보기</Link></td></tr>)}</tbody></table></div>
}

/** 하나의 Detection Evidence를 읽고 검토 결과를 저장한다. */
export function AdminAbuseDetectionDetailPage() {
  const { detectionId } = useParams()
  const showToast = useToast()
  const [decision, setDecision] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data: detection, loading, error, reload, setData } = useAsync(
    () => getAbuseDetection(detectionId),
    [detectionId],
    { fallbackMessage: '탐지 상세를 불러오지 못했습니다.' },
  )

  async function review() {
    if (!detection || !decision) return
    setBusy(true)
    try {
      const updated = await reviewAbuseDetection(detection.detectionId, decision)
      setData(updated)
      setDecision(null)
      showToast(decision === 'CONFIRMED' ? '이상 행동으로 확정했습니다.' : '오탐으로 처리했습니다.')
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_STATE') {
        await reload()
        setDecision(null)
        showToast('다른 관리자가 이미 다른 판정을 기록했습니다. 최신 상태를 확인해주세요.', { icon: 'error' })
      } else {
        showToast(describeError(error, '검토 결과를 저장하지 못했습니다.'), { icon: 'error' })
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock label="탐지 상세를 불러오는 중..." />
  if (error) return <ErrorBlock message={error} onRetry={reload} />
  if (!detection) return <div className="mx-auto max-w-6xl"><EmptyBlock icon="policy" message="탐지 결과를 찾을 수 없습니다." /><Link to="/admin/abuse-detections" className="text-sm font-medium text-pink-700">목록으로 돌아가기</Link></div>

  const evidence = detection.evidence
  const reviewable = detection.status === 'DETECTED'
  const reviewRows = [['현재 상태', <StatusBadge key="status" status={detection.status} />], ['탐지 시각', formatDateTime(detection.detectedAt)], ['검토 시각', detection.reviewedAt ? formatDateTime(detection.reviewedAt) : '-'], ['검토 관리자', detection.reviewedBy ? `#${detection.reviewedBy}` : '-']]

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><Link to="/admin/abuse-detections" className="text-sm font-medium text-pink-700 hover:text-pink-800">← 이상행위 탐지 목록</Link><h1 className="mt-3 text-xl font-semibold text-slate-950">탐지 결과 #{detection.detectionId}</h1><p className="mt-1 text-sm text-slate-500">회원 #{detection.memberId} · {abuseTypeLabel(detection.abuseType)}</p></div><button type="button" onClick={() => void reload()} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button></div>
    <section className="border-y border-slate-200 bg-white"><DetailInfoRows title="탐지 정보" rows={[['탐지 유형', <TypeBadge key="type" type={detection.abuseType} />], ...reviewRows]} /><EvidenceSection evidence={evidence} /></section>
    {reviewable && <section className="flex justify-end gap-2"><button type="button" onClick={() => setDecision('FALSE_POSITIVE')} className="h-10 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">오탐 처리</button><button type="button" onClick={() => setDecision('CONFIRMED')} className="h-10 rounded-md bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800">이상 행동 확정</button></section>}
    {!reviewable && <p className="text-sm text-slate-500">검토가 완료된 탐지 결과입니다. 상태를 다시 변경할 수 없습니다.</p>}
    {decision && <ConfirmModal action="confirm" subject={`탐지 결과 #${detection.detectionId}`} busy={busy} title={decision === 'CONFIRMED' ? '이상 행동으로 확정할까요?' : '오탐으로 처리할까요?'} message={decision === 'CONFIRMED' ? '탐지 근거를 검토한 뒤 실제 이상 행동으로 기록합니다. 이 판정은 다시 변경할 수 없습니다.' : '탐지 근거를 오탐으로 기록합니다. 이 판정은 다시 변경할 수 없습니다.'} confirmLabel={decision === 'CONFIRMED' ? '이상 행동 확정' : '오탐 처리'} confirmTone={decision === 'CONFIRMED' ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'} onCancel={() => setDecision(null)} onConfirm={() => void review()} />}
  </div>
}

function EvidenceSection({ evidence }) {
  if (!evidence) return <DetailInfoRows title="탐지 근거" rows={[["근거", '저장된 탐지 근거가 없습니다.']]} />
  const primaryRows = [
    ['정책 버전', evidence.policyVersion],
    ['적용 범위', scopeSummary(evidence.scope)],
    ['측정 기간', formatWindow(evidence.window)],
    ...(formatMaxDelay(evidence.window) ? [['최대 적립·사용 간격', formatMaxDelay(evidence.window)]] : []),
    ['Signal', ruleLabels(evidence.signals)],
    ['매칭 Rule', ruleLabels(evidence.matchedRules)],
  ]
  return <><DetailInfoRows title="주요 근거" rows={primaryRows} /><MetricRows title="측정값과 기준" features={evidence.features} thresholds={evidence.thresholds} />{Object.entries(evidence.supportingEvidence ?? {}).map(([rule, entries]) => <SupportingEvidence key={rule} rule={rule} entries={entries} />)}</>
}

function SupportingEvidence({ rule, entries }) {
  return <section className="border-b border-slate-200 px-5 py-5"><h2 className="text-sm font-semibold text-slate-900">{rule} 보조 근거</h2><div className="mt-4 space-y-4">{entries.map((entry, index) => <div key={`${entry.abuseType ?? entry.signal}-${index}`} className="rounded-md bg-slate-50 p-4"><p className="text-sm font-medium text-slate-800">{entry.abuseType ? abuseTypeLabel(entry.abuseType) : entry.signal}</p><p className="mt-1 text-xs text-slate-500">{scopeSummary(entry.scope)} · {formatWindow(entry.window)}{formatMaxDelay(entry.window) ? ` · 최대 간격 ${formatMaxDelay(entry.window)}` : ''}</p><MetricRows features={entry.features} thresholds={entry.thresholds} compact /></div>)}</div></section>
}

function MetricRows({ title, features, thresholds, compact = false }) {
  const rows = Object.entries(features ?? {}).map(([metric, value]) => [metricLabel(metric), value, thresholds?.[metric]])
  if (compact) return <dl className="mt-3 grid gap-2 sm:grid-cols-2">{rows.map(([label, value, threshold]) => <div key={label} className="flex justify-between gap-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="font-medium text-slate-800">{value} / {threshold ?? '-'}</dd></div>)}</dl>
  return <section className="border-b border-slate-200 px-5 py-5"><h2 className="text-sm font-semibold text-slate-900">{title}</h2>{rows.length === 0 ? <p className="mt-3 text-sm text-slate-500">저장된 측정값이 없습니다.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-96 text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2">지표</th><th className="py-2">측정값</th><th className="py-2">기준값</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(([label, value, threshold]) => <tr key={label}><td className="py-2 text-slate-700">{label}</td><td className="py-2 font-medium text-slate-900">{value}</td><td className="py-2 text-slate-700">{threshold ?? '-'}</td></tr>)}</tbody></table></div>}</section>
}

function TypeBadge({ type }) {
  const meta = ABUSE_TYPE_META[type] ?? { label: type ?? '-', tone: 'bg-slate-100 text-slate-700' }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${meta.tone}`}>{meta.label}</span>
}

function StatusBadge({ status }) {
  const meta = ABUSE_STATUS_META[status] ?? { label: abuseStatusLabel(status), tone: 'bg-slate-100 text-slate-700' }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${meta.tone}`}>{meta.label}</span>
}

function Pagination({ page, hasNext, totalElements, onPrevious, onNext }) {
  return <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3"><p className="text-sm text-slate-500">{totalElements == null ? `페이지 ${page + 1}` : `총 ${totalElements}건 · ${page + 1}페이지`}</p><div className="flex gap-2"><button type="button" disabled={page === 0} onClick={onPrevious} className="h-8 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-40">이전</button><button type="button" disabled={!hasNext} onClick={onNext} className="h-8 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-40">다음</button></div></div>
}
