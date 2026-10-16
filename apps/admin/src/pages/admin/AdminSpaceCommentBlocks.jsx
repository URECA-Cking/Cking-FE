import { useState } from 'react'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { AdminPageHeader } from '../../components/AdminContent.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAdminSession } from '../../context/useAdminSession.js'
import { useAsync } from '../../hooks/useAsync.js'
import { getSpaceCommentBlocks, releaseSpaceCommentBlock } from '../../api/admin.js'
import { ApiError, describeError } from '../../api/client.js'
import { formatDateTime } from '../../utils/format.js'
import {
  BLOCK_STATUS_META,
  SPACE_BLOCK_ERROR_MESSAGES,
  blockStatus,
  ceilToMinute,
  createdByLabel,
  pageAfterRefresh,
  parseFilterId,
  releaseConfirm,
  shouldRefreshAfterError,
} from '../../utils/spaceCommentBlock.js'

const PAGE_SIZE = 20

/**
 * 모든 스페이스의 댓글 차단을 보고 해제한다(BE 이슈 #579·#584). 크리에이터가 건 차단과 관리자가 건 차단이 함께 나온다.
 * 차단은 신고된 댓글 화면(/admin/comment-reports)에서 건다. 서버 페이지가 offset 방식이라 "차단 중만 보기"에서 해제하면 뒤 항목이
 * 앞으로 당겨지므로, 해제한 뒤에는 현재 페이지를 서버에서 다시 읽는다.
 */
export default function AdminSpaceCommentBlocks() {
  const showToast = useToast()
  const { user } = useAdminSession()
  // form: 입력 중인 값(문자열), query: 조회에 적용한 값. 입력할 때마다 조회하지 않고 "조회"를 눌렀을 때만 적용한다.
  const [form, setForm] = useState({ creatorId: '', memberId: '' })
  const [query, setQuery] = useState({ creatorId: undefined, memberId: undefined, activeOnly: true, page: 0 })
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(null) // 해제 확인 중인 차단
  const [busy, setBusy] = useState(false)
  const { creatorId, memberId, activeOnly, page } = query

  const { data, loading, error, reload } = useAsync(
    () => getSpaceCommentBlocks({ creatorId, memberId, activeOnly, page, size: PAGE_SIZE }),
    [creatorId, memberId, activeOnly, page],
    { fallbackMessage: '스페이스 차단 목록을 불러오지 못했습니다.' },
  )
  const items = data?.items ?? []

  function applyFilters(event) {
    event.preventDefault()
    const nextCreatorId = parseFilterId(form.creatorId)
    const nextMemberId = parseFilterId(form.memberId)
    if (nextCreatorId === null || nextMemberId === null) {
      setFormError('크리에이터·회원 ID는 비우거나 1 이상의 정수로 입력해주세요.')
      return
    }
    setFormError('')
    setQuery((current) => ({ ...current, creatorId: nextCreatorId, memberId: nextMemberId, page: 0 }))
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
      await releaseSpaceCommentBlock(pending.sanctionId)
      showToast('차단을 해제했어요.')
      setPending(null)
      await refresh()
    } catch (err) {
      showToast(releaseErrorMessage(err), { icon: 'error' })
      if (err instanceof ApiError && shouldRefreshAfterError(err.code)) {
        setPending(null)
        await refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  const confirm = pending ? releaseConfirm(pending) : null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AdminPageHeader
        title="스페이스 차단 관리"
        description="크리에이터와 관리자가 건 스페이스 댓글 차단을 확인하고 해제합니다. 차단은 신고된 댓글 화면에서 걸 수 있습니다."
      />

      <section className="rounded-lg border border-slate-200 bg-white">
        <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <label className="text-sm text-slate-700">
            <span className="block text-xs font-medium text-slate-500">크리에이터 ID</span>
            <input
              inputMode="numeric"
              value={form.creatorId}
              onChange={(event) => setForm((current) => ({ ...current, creatorId: event.target.value }))}
              placeholder="전체"
              className="mt-1 h-9 w-28 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600"
            />
          </label>
          <label className="text-sm text-slate-700">
            <span className="block text-xs font-medium text-slate-500">회원 ID</span>
            <input
              inputMode="numeric"
              value={form.memberId}
              onChange={(event) => setForm((current) => ({ ...current, memberId: event.target.value }))}
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
            차단 중만 보기
          </label>
          <button type="submit" className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">조회</button>
          <button type="button" onClick={() => void refresh()} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button>
          {formError && <p className="w-full text-sm text-red-700" role="alert">{formError}</p>}
        </form>

        {loading && <LoadingBlock label="스페이스 차단 목록을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && items.length === 0 && (
          <EmptyBlock icon="block" message={activeOnly ? '지금 차단 중인 회원이 없습니다.' : '조건에 해당하는 차단이 없습니다.'} />
        )}
        {!loading && !error && items.length > 0 && <BlockTable items={items} busy={busy} myMemberId={user?.memberId} onRelease={setPending} />}
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
          subject={`차단 #${pending.sanctionId}`}
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          confirmTone={confirm.confirmTone}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void release()}
        />
      )}
    </div>
  )
}

function releaseErrorMessage(error) {
  if (error instanceof ApiError && Object.hasOwn(SPACE_BLOCK_ERROR_MESSAGES, error.code)) return SPACE_BLOCK_ERROR_MESSAGES[error.code]
  return describeError(error, '차단을 해제하지 못했습니다.')
}

function BlockTable({ items, busy, myMemberId, onRelease }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-medium text-slate-500">
          <tr>
            <th className="px-5 py-3">차단</th>
            <th className="px-4 py-3">스페이스</th>
            <th className="px-4 py-3">차단된 회원</th>
            <th className="px-4 py-3">기간</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">건 사람</th>
            <th className="px-5 py-3 text-right">조치</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((block) => {
            const status = blockStatus(block)
            const meta = BLOCK_STATUS_META[status]
            return (
              <tr key={block.sanctionId} className="align-top hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">#{block.sanctionId}</td>
                <td className="px-4 py-3 text-slate-700">Creator #{block.creatorId}</td>
                <td className="px-4 py-3 text-slate-700">
                  <p className="font-medium text-slate-900">{block.memberName ?? '알 수 없는 회원'}</p>
                  <p className="text-xs text-slate-500">회원 #{block.memberId}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>{formatDateTime(block.startedAt)}</p>
                  <p className="text-xs text-slate-500">~ {formatDateTime(ceilToMinute(new Date(block.endsAt)).toISOString())}</p>
                  {block.releasedAt && <p className="text-xs text-slate-500">{formatDateTime(block.releasedAt)} 해제</p>}
                </td>
                <td className="px-4 py-3"><StatusPill label={meta.label} tone={meta.tone} /></td>
                <td className="px-4 py-3 text-slate-600">{createdByLabel(block.createdBy, myMemberId)}</td>
                <td className="px-5 py-3 text-right">
                  {status === 'ACTIVE' ? (
                    <button type="button" disabled={busy} onClick={() => onRelease(block)} className="h-8 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">해제</button>
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

function Pagination({ page, hasNext, totalElements, onPrevious, onNext }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
      <p className="text-sm text-slate-500">{totalElements == null ? `페이지 ${page + 1}` : `총 ${totalElements}건 · ${page + 1}페이지`}</p>
      <div className="flex gap-2">
        <button type="button" disabled={page === 0} onClick={onPrevious} className="h-8 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-40">이전</button>
        <button type="button" disabled={!hasNext} onClick={onNext} className="h-8 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-40">다음</button>
      </div>
    </div>
  )
}
