/** 심사·운영 화면에서 공통으로 쓰는 페이지 제목 영역이다. */
export function AdminPageHeader({ title, description, children }) {
  return <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5"><div><h1 className="text-xl font-semibold text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div>{children}</header>
}

/** 상세 화면의 읽기 전용 정보 행을 공통 형식으로 표시한다. */
export function DetailInfoRows({ title, rows }) {
  return <section className="border-b border-slate-200 px-5 py-5 last:border-b-0"><h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2><dl className="grid grid-cols-[9rem_1fr] gap-x-6 gap-y-3 text-sm">{rows.map(([label, value], index) => <div key={`${label}-${index}`} className="contents"><dt className="text-slate-500">{label}</dt><dd className="min-w-0 text-slate-800">{value ?? '-'}</dd></div>)}</dl></section>
}
