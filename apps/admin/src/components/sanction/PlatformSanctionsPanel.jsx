import { useState } from 'react'
import ConfirmModal from '../ConfirmModal.jsx'
import Pagination from './Pagination.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAdminSession } from '../../context/useAdminSession.js'
import { useAsync } from '../../hooks/useAsync.js'
import { getPlatformSanctions, releasePlatformSanction } from '../../api/admin.js'
import { ApiError, describeError } from '../../api/client.js'
import { formatDateTime } from '../../utils/format.js'
import {
  PLATFORM_STATUS_META,
  platformReleaseConfirm,
  sanctionBasis,
  sourceMeta,
} from '../../utils/sanction.js'
import {
  blockStatus,
  ceilToMinute,
  createdByLabel,
  pageAfterRefresh,
  parseFilterId,
  shouldRefreshAfterError,
} from '../../utils/spaceCommentBlock.js'

const PAGE_SIZE = 20

/**
 * 플랫폼 제한(모든 스페이스에서 댓글 작성·수정을 막는 제재)을 보고 해제한다. 관리자가 댓글을 숨겨 쌓인 자동 경고와 관리자가 직접
 * 건 수동 제한이 함께 나오며, 스페이스 차단은 나오지 않는다. 자동 경고는 해제해도 경고 횟수에 남는다.
 * 서버 페이지가 offset 방식이라 "제한 중만 보기"에서 해제하면 뒤 항목이 앞으로 당겨지므로, 해제한 뒤에는 현재 페이지를 서버에서 다시 읽는다.
 */
export default function PlatformSanctionsPanel() {
  const showToast = useToast()
  const { user } = useAdminSession()
  const [form, setForm] = useState({ memberId: '' })
  const [query, setQuery] = useState({ memberId: undefined, activeOnly: true, page: 0 })
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(null) // 해제 확인 중인 제한
  const [busy, setBusy] = useState(false)
  const { memberId, activeOnly, page } = query

  const { data, loading, error, reload } = useAsync(
    () => getPlatformSanctions({ memberId, activeOnly, page, size: PAGE_SIZE }),
    [memberId, activeOnly, page],
    { fallbackMessage: '플랫폼 제한 목록을 불러오지 못했습니다.' },
  )
  const items = data?.items ?? []

  function applyFilters(event) {
    event.preventDefault()
    const nextMemberId = parseFilterId(form.memberId)
    if (nextMemberId === null) {
      setFormError('회원 ID는 비우거나 1 이상의 정수로 입력해주세요.')
      return
    }
    setFormError('')
    setQuery((current) => ({ ...current, memberId: nextMemberId, page: 0 }))
  }

  /** 현재 페이지를 다시 읽는다. 읽은 결과가 비었을 때만(마지막 한 건을 해제했을 때) 이전 페이지로 간다. */
  async function refresh() {
    const startedPage = page
    const refreshed = await reload()
    if (refreshed) {
      setQuery((current) => ({ ...current, page: pageAfterRefresh(startedPage, current.page, (refreshed.items ?? []).length) }))
    }
  }

  async function release() {
    if (!pending) return
    setBusy(true)
    try {
      await releasePlatformSanction(pending.sanctionId)
      showToast('제한을 해제했어요.')
      setPending(null)
      await refresh()
    } catch (err) {
      showToast(describeError(err, '제한을 해제하지 못했습니다.'), { icon: 'error' })
      if (err instanceof ApiError && shouldRefreshAfterError(err.code)) {
        setPending(null)
        await refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  const confirm = pending ? platformReleaseConfirm(pending) : null

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white">
        <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <label className="text-sm text-slate-700">
            <span className="block text-xs font-medium text-slate-500">회원 ID</span>
            <input
              inputMode="numeric"
              value={form.memberId}
              onChange={(event) => setForm({ memberId: event.target.value })}
              placeholder="전체"
              className="mt-1 h-9 w-28 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600"
            />
          </label>
          <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(event) => setQuery((current) => ({ ...current, activeOnly: event.target.checked, page: 0 }))}
              className="accent-pink-700"
            />
            제한 중만 보기
          </label>
          <button type="submit" className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">조회</button>
          <button type="button" onClick={() => void refresh()} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button>
          {formError && <p className="w-full text-sm text-red-700" role="alert">{formError}</p>}
        </form>

        {loading && <LoadingBlock label="플랫폼 제한 목록을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && items.length === 0 && (
          <EmptyBlock icon="block" message={activeOnly ? '지금 제한 중인 회원이 없습니다.' : '조건에 해당하는 제한이 없습니다.'} />
        )}
        {!loading && !error && items.length > 0 && <SanctionTable items={items} busy={busy} myMemberId={user?.memberId} onRelease={setPending} />}
        {!loading && !error && (
          <Pagination
            page={data?.page ?? page}
            hasNext={data?.hasNext === true}
            totalElements={data?.totalElements}
            onPrevious={() => setQuery((current) => ({ ...current, page: Math.max(0, current.page - 1) }))}
            onNext={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
          />
        )}
      </section>

      {pending && (
        <ConfirmModal
          action="confirm"
          subject={`제한 #${pending.sanctionId}`}
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          confirmTone={confirm.confirmTone}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void release()}
        />
      )}
    </>
  )
}

function SanctionTable({ items, busy, myMemberId, onRelease }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-medium text-slate-500">
          <tr>
            <th className="px-5 py-3">제한</th>
            <th className="px-4 py-3">회원</th>
            <th className="px-4 py-3">출처</th>
            <th className="px-4 py-3">근거·사유</th>
            <th className="px-4 py-3">기간</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">건 사람</th>
            <th className="px-5 py-3 text-right">조치</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((sanction) => {
            const status = blockStatus(sanction)
            const meta = PLATFORM_STATUS_META[status]
            const source = sourceMeta(sanction.source)
            return (
              <tr key={sanction.sanctionId} className="align-top hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">#{sanction.sanctionId}</td>
                <td className="px-4 py-3 text-slate-700">회원 #{sanction.memberId}</td>
                <td className="px-4 py-3"><StatusPill label={source.label} tone={source.tone} /></td>
                <td className="max-w-xs px-4 py-3 text-slate-700">
                  <p className="whitespace-pre-wrap break-words">{sanctionBasis(sanction)}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>{formatDateTime(sanction.startedAt)}</p>
                  <p className="text-xs text-slate-500">~ {formatDateTime(ceilToMinute(new Date(sanction.endsAt)).toISOString())}</p>
                  {sanction.releasedAt && <p className="text-xs text-slate-500">{formatDateTime(sanction.releasedAt)} 해제</p>}
                </td>
                <td className="px-4 py-3"><StatusPill label={meta.label} tone={meta.tone} /></td>
                <td className="px-4 py-3 text-slate-600">{createdByLabel(sanction.createdBy, myMemberId)}</td>
                <td className="px-5 py-3 text-right">
                  {status === 'ACTIVE' ? (
                    <button type="button" disabled={busy} onClick={() => onRelease(sanction)} className="h-8 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">해제</button>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
