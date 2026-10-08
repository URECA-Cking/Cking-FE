import AdminDrawingPanel from './AdminDrawingPanel.jsx'

/** 이벤트 운영과 분리된 마감 완료 이벤트의 추첨 운영 진입점이다. */
export default function AdminConsole() {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6"><header className="border-b border-slate-200 pb-5"><h1 className="text-xl font-semibold text-slate-950">추첨 운영</h1><p className="mt-1 text-sm text-slate-500">마감 완료된 이벤트의 추첨을 운영합니다.</p></header><AdminDrawingPanel /></div>
}
