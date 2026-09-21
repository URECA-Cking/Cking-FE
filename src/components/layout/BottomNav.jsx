import { NavLink } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'

const NAV_ITEMS = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/explore', label: '탐색', icon: 'explore' },
  { to: '/my-entries', label: '내 응모', icon: 'confirmation_number' },
  { to: '/notifications', label: '알림', icon: 'notifications', badgeKey: 'unread' },
  { to: '/my-page', label: 'MY', icon: 'person' },
]

/** 시안의 프로스티드 글래스 하단 독. 알림 탭에는 읽지 않은 알림 배지를 표시한다. */
export default function BottomNav({ unreadCount = 0 }) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 pb-safe bg-surface/84 backdrop-blur-xl border-t border-border-rose shadow-dock">
      <div className="flex justify-around items-center h-16 px-space-xs">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center min-w-[48px] h-12 gap-0.5 transition-all active:scale-95 ${
                isActive ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <MaterialIcon name={item.icon} filled={isActive} className="text-[24px]" />
                  {item.badgeKey === 'unread' && unreadCount > 0 && (
                    <span
                      className="absolute -top-0.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error font-label-xs text-[10px] leading-4 text-center font-bold"
                      aria-label={`읽지 않은 알림 ${unreadCount}개`}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
                <span className="font-label-xs text-label-xs">{item.label}</span>
                {isActive && <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary" />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
