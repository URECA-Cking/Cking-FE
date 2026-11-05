import { filterReasonSummary, isFilterRecheckPending } from '../utils/commentFilter.js'

/** 필터링 사유와, 수정 후 재판정이 끝나지 않은 댓글의 안내를 표시한다. */
export default function CommentFilterReason({ reasons, filterStatus }) {
  return (
    <>
      <p>{filterReasonSummary(reasons)}</p>
      {isFilterRecheckPending(filterStatus) && (
        <p className="mt-1 text-xs text-amber-800">
          <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium">다시 확인 중</span>
          <span className="mt-1 block text-slate-500">수정된 댓글이에요. 사유는 수정 전 내용 기준이에요.</span>
        </p>
      )}
    </>
  )
}
