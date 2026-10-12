import { useState } from 'react'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { AdminPageHeader } from '../../components/AdminContent.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { getCommentReports, hideReportedComment, rejectCommentReports } from '../../api/admin.js'
import { ApiError, describeError } from '../../api/client.js'
import { formatDateTime } from '../../utils/format.js'
import {
  COMMENT_REPORT_ERROR_MESSAGES,
  REPORT_STATUS_META,
  actionConfirm,
  actionSuccessMessage,
  canHandle,
  reasonSummary,
  reportStatusLabel,
} from '../../utils/commentReport.js'

const PAGE_SIZE = 20

/** 상태 필터. 빈 값은 전체다. 처리해야 할 접수 건이 기본이다. */
const STATUS_OPTIONS = [
  { value: 'PENDING', label: '접수' },
  { value: 'RESOLVED', label: '숨김 처리' },
  { value: 'REJECTED', label: '반려' },
  { value: '', label: '전체' },
]

/**
 * 신고된 게시글 댓글을 댓글별로 모아 확인하고 숨기거나 신고를 반려한다(BE 이슈 #485·#499).
 * 한 댓글의 접수 신고는 한 번에 처리되고, 숨김은 되돌릴 수 없다.
 */
export default function AdminCommentReports() {
  const showToast = useToast()
  const [status, setStatus] = useState('PENDING')
  const [page, setPage] = useState(0)
  // pending: null | { action: 'hide' | 'reject', item }
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, reload } = useAsync(
    () => getCommentReports({ status: status || undefined, page, size: PAGE_SIZE }),
    [status, page],
    { fallbackMessage: '신고된 댓글 목록을 불러오지 못했습니다.' },
  )
  const items = data?.items ?? []

  function changeStatus(next) {
    setStatus(next)
    setPage(0)
  }

  async function run() {
    if (!pending) return
    const { action, item } = pending
    setBusy(true)
    try {
      const result = action === 'hide' ? await hideReportedComment(item.commentId) : await rejectCommentReports(item.commentId)
      showToast(actionSuccessMessage(action, result?.handledReportCount ?? 0))
      setPending(null)
      await refresh()
    } catch (err) {
      showToast(actionErrorMessage(err), { icon: 'error' })
      // 다른 관리자가 먼저 처리했거나 댓글이 사라졌을 수 있어 확인 창을 닫고 최신 상태를 다시 읽는다.
      if (err instanceof ApiError && COMMENT_REPORT_ERROR_MESSAGES[err.code]) {
        setPending(null)
        await refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  /**
   * 현재 페이지를 다시 읽는다. 읽은 결과가 비었을 때만(접수 탭에서 마지막 한 건을 처리했거나 다른 관리자가 처리·삭제해
   * 페이지가 줄었을 때) 이전 페이지로 간다. 전체 탭에서는 처리한 댓글이 목록에 남으므로 같은 페이지에 머문다.
   */
  async function refresh() {
    const refreshed = await reload()
    if (refreshed && (refreshed.items ?? []).length === 0 && page > 0) setPage((current) => current - 1)
  }

  const confirm = pending ? actionConfirm(pending.action, pending.item.pendingReportCount) : null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AdminPageHeader
        title="댓글 신고"
        description="신고된 게시글 댓글을 댓글별로 확인하고 숨기거나 신고를 반려합니다."
      />

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="note">
        관리자 전용 화면이라 댓글 원문이 그대로 보입니다. 욕설이나 개인정보가 포함돼 있을 수 있어요.
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div role="tablist" aria-label="처리 상태" className="flex gap-1 rounded-md bg-slate-100 p-1">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value || 'ALL'}
                type="button"
                role="tab"
                aria-selected={status === option.value}
                onClick={() => changeStatus(option.value)}
                className={`h-8 rounded px-3 text-sm font-medium ${status === option.value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void refresh()} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button>
        </div>

        {loading && <LoadingBlock label="신고된 댓글을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && items.length === 0 && (
          <EmptyBlock icon="flag" message={status === 'PENDING' ? '처리할 신고가 없습니다.' : '조건에 해당하는 신고된 댓글이 없습니다.'} />
        )}
        {!loading && !error && items.length > 0 && <ReportTable items={items} busy={busy} onAction={(action, item) => setPending({ action, item })} />}
        {!loading && !error && (
          <Pagination
            page={data?.page ?? page}
            hasNext={data?.hasNext === true}
            totalElements={data?.totalElements}
            onPrevious={() => setPage((current) => Math.max(0, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        )}
      </section>

      {pending && (
        <ConfirmModal
          action="confirm"
          subject={`댓글 #${pending.item.commentId}`}
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          confirmTone={confirm.confirmTone}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void run()}
        />
      )}
    </div>
  )
}

function actionErrorMessage(error) {
  if (error instanceof ApiError && COMMENT_REPORT_ERROR_MESSAGES[error.code]) return COMMENT_REPORT_ERROR_MESSAGES[error.code]
  return describeError(error, '조치를 처리하지 못했습니다.')
}

function ReportTable({ items, busy, onAction }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-medium text-slate-500">
          <tr>
            <th className="px-5 py-3">댓글</th>
            <th className="px-4 py-3">원문</th>
            <th className="px-4 py-3">신고</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">최근 신고</th>
            <th className="px-5 py-3 text-right">조치</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.commentId} className="align-top hover:bg-slate-50">
              <td className="px-5 py-3 text-slate-700">
                <p className="font-medium text-slate-900">#{item.commentId}</p>
                <p className="mt-0.5 text-xs text-slate-500">게시글 #{item.postId} · Creator #{item.creatorId}</p>
                <p className="text-xs text-slate-500">작성 회원 #{item.authorMemberId}</p>
              </td>
              <td className="max-w-xs px-4 py-3 text-slate-800">
                <p className="line-clamp-4 whitespace-pre-wrap break-words" title={item.content}>{item.content}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">
                <p>총 {item.reportCount}건 · 접수 {item.pendingReportCount}건</p>
                <p className="mt-0.5 text-xs text-slate-500">{reasonSummary(item.reasonCounts)}</p>
              </td>
              <td className="px-4 py-3">
                <StatusPill label={reportStatusLabel(item.status)} tone={REPORT_STATUS_META[item.status]?.tone} />
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.hiddenByAdmin && <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-800">관리자 숨김</span>}
                  {item.blocked && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-xs text-violet-800">AI 필터 차단</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">{formatDateTime(item.latestReportedAt)}</td>
              <td className="px-5 py-3 text-right">
                {canHandle(item) ? (
                  <div className="flex justify-end gap-2">
                    <button type="button" disabled={busy} onClick={() => onAction('reject', item)} className="h-8 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">반려</button>
                    <button type="button" disabled={busy} onClick={() => onAction('hide', item)} className="h-8 rounded-md bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">숨기기</button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">처리 완료</span>
                )}
              </td>
            </tr>
          ))}
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
