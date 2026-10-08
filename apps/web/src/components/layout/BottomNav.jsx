import { NavLink } from 'react-router-dom'
import MaterialIcon from '../ui/MaterialIcon.jsx'

const NAV_ITEMS = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/explore', label: '탐색', icon: 'explore' },
  { to: '/my-entries', label: '내 응모', icon: 'confirmation_number' },
  { to: '/notifications', label: '알림', icon: 'notifications', badgeKey: 'unread' },
  { to: '/my-page', label: 'MY', icon: 'person' },
]

/** 화면 아래에 떠 있는 프로스티드 알약 독. 선택한 탭은 채운 알약으로, 알림 탭에는 읽지 않은 알림 배지를 표시한다. */
export default function BottomNav({ unreadCount = 0, embedded = false }) {
  return (
    <nav
      className={
        embedded
          ? 'relative z-50 shrink-0 w-full px-4 pb-safe'
          : 'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-50 px-4 pb-safe'
      }
    >
      <div className="mx-auto mb-3 max-w-[480px] rounded-full border border-on-surface/10 bg-surface-container/90 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-around p-1.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex flex-1 flex-col items-center justify-center h-12 gap-0.5 rounded-full transition-all active:scale-95 ${
                  isActive ? 'bg-primary/20 text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <MaterialIcon name={item.icon} filled={isActive} className="text-[22px]" />
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
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
