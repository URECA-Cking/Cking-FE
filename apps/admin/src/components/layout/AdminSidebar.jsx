import { Link, useLocation } from 'react-router-dom'
import MaterialIcon from '../MaterialIcon.jsx'
import { ADMIN_NAVIGATION } from './adminNavigation.js'

/** 데스크톱 관리자 화면 전반에서 유지되는 기능 탐색 메뉴다. */
export default function AdminSidebar() {
  const location = useLocation()
  const route = { pathname: location.pathname, searchParams: new URLSearchParams(location.search) }

  return (
    <aside className="sticky top-16 h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-3 py-5">
      <nav aria-label="관리자 메뉴" className="space-y-5">
        {ADMIN_NAVIGATION.map((section) => (
          <section key={section.label} aria-label={section.label}>
            {section.label !== 'Dashboard' && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{section.label}</p>}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.matches?.(route) ?? false
                const className = `flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                  active ? 'bg-pink-50 text-pink-700' : item.unavailable ? 'cursor-not-allowed text-slate-400' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`

                return (
                  <li key={item.label}>
                    {item.unavailable ? (
                      <span aria-current={active ? 'page' : undefined} aria-disabled="true" className={className}>
                        <MaterialIcon name={item.icon} className="text-[18px]" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {!active && <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">준비 중</span>}
                      </span>
                    ) : (
                      <Link to={item.to} aria-current={active ? 'page' : undefined} className={className}>
                        <MaterialIcon name={item.icon} className="text-[18px]" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  )
}
