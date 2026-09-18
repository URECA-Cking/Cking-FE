import { NavLink } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'

const NAV_ITEMS = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/explore', label: '탐색', icon: 'explore' },
  { to: '/my-entries', label: '내 응모', icon: 'confirmation_number' },
  { to: '/notifications', label: '알림', icon: 'notifications' },
  { to: '/my-page', label: 'MY', icon: 'person' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-4px_16px_rgba(15,23,42,0.04)]">
      <div className="flex justify-around items-center h-16 px-space-xs">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[48px] h-12 gap-0.5 transition-all active:scale-95 ${
                isActive ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <MaterialIcon name={item.icon} filled={isActive} className="text-[24px]" />
                <span className="font-label-xs text-label-xs">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
