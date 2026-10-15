import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import MainLayout from '../../src/components/layout/MainLayout.jsx'
import Notifications from '../../src/pages/Notifications.jsx'
import UserContext from '../../src/context/userContext.js'
import MyTicketsContext from '../../src/context/myTicketsContext.js'
import ToastContext from '../../src/context/toastContext.js'

/** 테스트에서 실제 레이아웃과 알림 화면 사이를 이동할 수 있게 한다. */
function Home() {
  const navigate = useNavigate()
  window.goHome = () => navigate('/')
  window.goNotifications = () => navigate('/notifications')
  return <button onClick={() => navigate('/notifications')}>알림 열기</button>
}

createRoot(document.getElementById('root')).render(
  <ToastContext.Provider value={(message) => window.toasts.push(message)}>
    <UserContext.Provider value={{ status: 'authenticated', followsError: null }}>
      <MyTicketsContext.Provider value={{ summary: { total: 0 } }}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/events/:eventId" element={<div>이벤트 상세</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </MyTicketsContext.Provider>
    </UserContext.Provider>
  </ToastContext.Provider>,
)
