import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import { TopHeader } from './TopHeader.jsx'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useOnline } from '../../hooks/useOnline.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useUser } from '../../context/useUser.js'
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
  // 같은 결과를 홈 화면도 쓰기 때문에 Outlet context로 내려보내 중복 호출을 막는다.
  const { data, reload } = useAsync(() => getMyNotifications(userId, { size: 50 }), [userId, pathname], {
    enabled: Boolean(userId),
  })
  const notifications = data?.items ?? []
  const unreadCount = notifications.filter((item) => !item.readAt).length

  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden">
      <TopHeader title={title} embedded />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface">
        {!online && (
          <div className="mx-margin mt-space-sm flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-badge-bg text-gold-badge">
            <MaterialIcon name="wifi_off" className="text-[18px]" />
            <span className="font-label-xs text-label-xs font-semibold">
              오프라인 상태예요. 마지막으로 불러온 내용을 보여주고 있어요.
            </span>
          </div>
        )}
        <Outlet context={{ notifications, unreadCount, reloadNotifications: reload }} />
      </main>
      <BottomNav unreadCount={unreadCount} embedded />
    </div>
  )
}
