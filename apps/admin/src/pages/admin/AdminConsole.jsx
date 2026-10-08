import AdminDrawingPanel from './AdminDrawingPanel.jsx'

/** 심사 기능이 별도 목록으로 이전된 뒤 유지되는 추첨 운영 진입점이다. */
export default function AdminConsole() {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6"><header className="border-b border-slate-200 pb-5"><h1 className="text-xl font-semibold text-slate-950">추첨 운영</h1><p className="mt-1 text-sm text-slate-500">이벤트 마감 상태를 확인하고 추첨을 운영합니다.</p></header><AdminDrawingPanel /></div>
}
