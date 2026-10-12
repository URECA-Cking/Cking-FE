import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import BottomNav from './BottomNav.jsx'
import { TopHeader } from './TopHeader.jsx'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useOnline } from '../../hooks/useOnline.js'
import { useAsync } from '../../hooks/useAsync.js'
import { getMyNotifications } from '../../api/notifications.js'
import FollowStatus from '../creator/FollowStatus.jsx'
import { useScrollChrome } from '../../hooks/useScrollChrome.js'

const APP_BAR_TITLES = {
  '/': { title: 'Cking' },
  '/explore': { title: '탐색', centered: true },
  // back: 홈·스페이스 등 다른 화면에서 들어오므로 뒤로 가기 버튼을 보여준다.
  '/notifications': { title: '알림', back: true },
  '/my-entries': { title: '내 응모', centered: true },
  '/my-page': { title: '마이', centered: true },
}

export default function MainLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const scrollRef = useRef(null)
  const { headerVisible, bottomCompact } = useScrollChrome(scrollRef)
  const online = useOnline()
  const appBarTitle = APP_BAR_TITLES[pathname]

  // 하단 탭의 읽지 않은 알림 배지는 실제 알림 목록에서 계산한다.
  // 같은 결과를 홈 화면도 쓰기 때문에 Outlet context로 내려보내 중복 호출을 막는다.
  // 이 레이아웃은 RequireUser 안에서만 렌더링되므로 항상 로그인된 상태에서 조회한다.
  const { data, reload } = useAsync(() => getMyNotifications({ size: 50 }), [pathname])
  const notifications = data?.items ?? []
  const unreadCount = notifications.filter((item) => !item.readAt).length

  function goBack() {
    // 앱 안에서 뒤로 갈 곳이 있는지: react-router가 이 앱에서 쌓은 위치를 history.state.idx에 기록한다.
    // 로그인 직후나 주소로 직접 연 경우는 이전 기록이 앱 밖(로그인 중간 페이지 등)이라 idx가 0이고, 그쪽으로 돌아가면 안 되므로 홈으로 간다.
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate('/', { replace: true })
  }

  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden">
      {appBarTitle && (
        <TopHeader
          title={appBarTitle.title}
          centered={appBarTitle.centered}
          unreadCount={unreadCount}
          embedded
          hidden={!headerVisible}
          onBack={appBarTitle.back ? goBack : undefined}
        />
      )}
      <main
        ref={scrollRef}
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] ${
          appBarTitle ? 'pt-[calc(env(safe-area-inset-top,0px)+3.5rem)]' : 'pt-safe'
        }`}
      >
        <FollowStatus />
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
      <BottomNav embedded compact={bottomCompact} />
    </div>
  )
}
