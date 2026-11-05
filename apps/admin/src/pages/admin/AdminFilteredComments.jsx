import { useState } from 'react'
import CommentFilterReason from '../../components/CommentFilterReason.jsx'
import Pagination from '../../components/Pagination.jsx'
import { AdminPageHeader } from '../../components/AdminContent.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { getFilteredComments } from '../../api/admin.js'
import { formatDateTime } from '../../utils/format.js'

const PAGE_SIZE = 20

/**
 * AI가 자동으로 가린 댓글과 그 사유를 신고 여부와 상관없이 최근 판정 순으로 확인한다(BE 이슈 #809).
 * 이미 필터링된 댓글은 새 신고를 받지 않아 신고 관리에 나오지 않을 수 있다. 조회만 하고 조치는 하지 않는다.
 */
export default function AdminFilteredComments() {
  const [page, setPage] = useState(0)
  const { data, loading, error, reload } = useAsync(
    () => getFilteredComments({ page, size: PAGE_SIZE }),
    [page],
    { fallbackMessage: '필터링 내역을 불러오지 못했습니다.' },
  )
  const items = data?.items ?? []

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AdminPageHeader title="필터링 내역" description="AI가 자동으로 가린 댓글과 그 사유를 확인합니다." />

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="note">
        관리자 전용 화면이라 댓글 원문이 그대로 보입니다. 욕설이나 개인정보가 포함돼 있을 수 있어요.
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex justify-end border-b border-slate-200 p-4">
          <button type="button" onClick={() => void reload()} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">새로고침</button>
        </div>

        {loading && <LoadingBlock label="필터링 내역을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && items.length === 0 && <EmptyBlock icon="filter_alt" message="필터링된 댓글이 없습니다." />}
        {!loading && !error && items.length > 0 && <FilteredCommentTable items={items} />}
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
    </div>
  )
}

function FilteredCommentTable({ items }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-medium text-slate-500">
          <tr>
            <th className="px-5 py-3">댓글 번호</th>
            <th className="px-4 py-3">댓글 내용</th>
            <th className="px-4 py-3">필터링 사유</th>
            <th className="px-4 py-3">작성자</th>
            <th className="px-4 py-3">게시글</th>
            <th className="px-4 py-3">스페이스</th>
            <th className="px-5 py-3">필터링 시각</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.commentId} className="align-top hover:bg-slate-50">
              <td className="px-5 py-3 font-medium text-slate-900">#{item.commentId}</td>
              <td className="max-w-xs px-4 py-3 text-slate-800">
                <p className="line-clamp-4 whitespace-pre-wrap break-words" title={item.content}>{item.content}</p>
              </td>
              <td className="max-w-[200px] px-4 py-3 text-slate-700">
                <CommentFilterReason reasons={item.filterReasons} filterStatus={item.filterStatus} />
              </td>
              <td className="px-4 py-3 text-slate-700">{item.authorName ?? '-'}</td>
              <td className="max-w-[200px] px-4 py-3 text-slate-600">
                <p className="line-clamp-2 break-words" title={item.postPreview}>{item.postPreview}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{item.creatorName ?? '-'}</td>
              <td className="px-5 py-3 text-slate-600">{formatDateTime(item.filteredAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
