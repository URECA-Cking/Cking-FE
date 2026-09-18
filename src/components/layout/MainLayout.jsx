import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import { TopHeader } from './TopHeader.jsx'

const TITLES = {
  '/': 'Home',
  '/explore': 'Explore',
  '/my-entries': '내 응모',
  '/notifications': '알림',
  '/my-page': 'MY',
}

export default function MainLayout() {
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'Cking'

  return (
    <>
      <TopHeader title={title} />
      <main className="flex-1 flex flex-col w-full pt-14 pb-24 bg-surface">
        <Outlet />
      </main>
      <BottomNav />
    </>
  )
}
