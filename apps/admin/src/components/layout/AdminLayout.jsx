import AdminHeader from './AdminHeader.jsx'
import AdminSidebar from './AdminSidebar.jsx'

/** 보호된 관리자 페이지에 공통 Backoffice Shell을 적용한다. */
export default function AdminLayout({ children }) {
  return <div className="min-h-screen min-w-[1024px] bg-[#f7f8fa] text-slate-900"><AdminHeader /><div className="flex"><AdminSidebar /><main className="min-w-0 flex-1 p-6 xl:p-8">{children}</main></div></div>
}
