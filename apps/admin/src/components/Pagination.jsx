/** 제재 목록의 이전·다음 페이지 이동. 서버 페이지가 offset 방식이라 총 건수가 있으면 함께 보여 준다. */
export default function Pagination({ page, hasNext, totalElements, onPrevious, onNext }) {
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
