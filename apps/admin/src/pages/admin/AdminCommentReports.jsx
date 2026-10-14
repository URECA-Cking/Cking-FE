import { useState } from 'react'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import SpaceBlockModal from '../../components/SpaceBlockModal.jsx'
import { AdminPageHeader } from '../../components/AdminContent.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { deleteComment, getCommentReports, hideReportedComment, rejectCommentReports } from '../../api/admin.js'
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
  viewAfterRefresh,
} from '../../utils/commentReport.js'
import { blockSuccessMessage, deleteConfirm } from '../../utils/spaceCommentBlock.js'

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
 * 처리 상태와 상관없이 댓글을 삭제하거나 작성자를 그 스페이스에서 차단할 수 있다(BE 이슈 #584).
 */
export default function AdminCommentReports() {
  const showToast = useToast()
  // 탭과 페이지는 함께 바뀌므로 한 상태로 둔다. 재조회가 끝난 뒤 시작할 때와 같은 위치일 때만 페이지를 줄이기 위해서다.
  const [view, setView] = useState({ status: 'PENDING', page: 0 })
  const { status, page } = view
  // pending: null | { action: 'hide' | 'reject' | 'delete', item }
  const [pending, setPending] = useState(null)
  // blocking: 스페이스 차단 모달을 열어 둔 신고된 댓글. 크리에이터·작성 회원 ID는 이 행에서 가져온다.
  const [blocking, setBlocking] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, reload } = useAsync(
    () => getCommentReports({ status: status || undefined, page, size: PAGE_SIZE }),
    [status, page],
    { fallbackMessage: '신고된 댓글 목록을 불러오지 못했습니다.' },
  )
  const items = data?.items ?? []

  function changeStatus(next) {
    setView({ status: next, page: 0 })
  }

  async function run() {
    if (!pending) return
    const { action, item } = pending
    setBusy(true)
    try {
      if (action === 'delete') {
        await deleteComment(item.commentId)
        showToast('댓글을 삭제했어요.')
      } else {
        const result = action === 'hide' ? await hideReportedComment(item.commentId) : await rejectCommentReports(item.commentId)
        showToast(actionSuccessMessage(action, result?.handledReportCount ?? 0))
      }
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
    const started = view
    const refreshed = await reload()
    if (refreshed) setView((current) => viewAfterRefresh(started, current, (refreshed.items ?? []).length))
  }

  const confirm = pending
    ? (pending.action === 'delete' ? deleteConfirm(pending.item) : actionConfirm(pending.action, pending.item.pendingReportCount))
    : null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AdminPageHeader
        title="댓글 신고"
        description="신고된 게시글 댓글을 댓글별로 확인하고 숨기거나 신고를 반려합니다. 댓글 삭제와 스페이스 차단도 할 수 있습니다."
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
        {!loading && !error && items.length > 0 && <ReportTable items={items} busy={busy} onAction={(action, item) => setPending({ action, item })} onBlock={setBlocking} />}
        {!loading && !error && (
          <Pagination
            page={data?.page ?? page}
            hasNext={data?.hasNext === true}
            totalElements={data?.totalElements}
            onPrevious={() => setView((current) => ({ ...current, page: Math.max(0, current.page - 1) }))}
            onNext={() => setView((current) => ({ ...current, page: current.page + 1 }))}
          />
        )}
      </section>

      {blocking && (
        <SpaceBlockModal
          creatorId={blocking.creatorId}
          memberId={blocking.authorMemberId}
          onClose={() => setBlocking(null)}
          onBlocked={(block) => {
            setBlocking(null)
            showToast(blockSuccessMessage(block))
          }}
        />
      )}

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

function ReportTable({ items, busy, onAction, onBlock }) {
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
                <div className="flex flex-wrap justify-end gap-2">
                  {canHandle(item) ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => onAction('reject', item)} className="h-8 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">반려</button>
                      <button type="button" disabled={busy} onClick={() => onAction('hide', item)} className="h-8 rounded-md bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">숨기기</button>
                    </>
                  ) : (
                    <span className="self-center text-xs text-slate-400">처리 완료</span>
                  )}
                  {/* 처리 상태와 상관없이 쓸 수 있다. 차단은 이 댓글 작성자를 그 스페이스에서만 막고, 삭제는 되돌릴 수 없다. */}
                  <button type="button" disabled={busy} onClick={() => onBlock(item)} className="h-8 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">스페이스 차단</button>
                  <button type="button" disabled={busy} onClick={() => onAction('delete', item)} className="h-8 rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">삭제</button>
                </div>
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
