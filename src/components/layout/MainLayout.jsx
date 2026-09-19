import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import { TopHeader } from './TopHeader.jsx'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useOnline } from '../../hooks/useOnline.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useUser } from '../../context/UserContext.jsx'
import { getMyNotifications } from '../../api/notifications.js'

const TITLES = {
  '/': 'Home',
  '/explore': 'Explore',
  '/my-entries': '내 응모',
  '/notifications': '알림',
  '/my-page': 'MY',
}

export default function MainLayout() {
  const { pathname } = useLocation()
  const { userId } = useUser()
  const online = useOnline()
  const title = TITLES[pathname] ?? 'Cking'

  // 하단 탭의 읽지 않은 알림 배지는 실제 알림 목록에서 계산한다.
  const { data } = useAsync(() => getMyNotifications(userId, { size: 50 }), [userId, pathname], {
    enabled: Boolean(userId),
  })
  const unreadCount = (data?.items ?? []).filter((item) => !item.readAt).length

  return (
    <>
      <TopHeader title={title} />
      <main className="flex-1 flex flex-col w-full pt-14 pb-24 bg-surface">
        {!online && (
          <div className="mx-margin mt-space-sm flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-badge-bg text-gold-badge">
            <MaterialIcon name="wifi_off" className="text-[18px]" />
            <span className="font-label-xs text-label-xs font-semibold">
              오프라인 상태예요. 마지막으로 불러온 내용을 보여주고 있어요.
            </span>
          </div>
        )}
        <Outlet />
      </main>
      <BottomNav unreadCount={unreadCount} />
    </>
  )
}
