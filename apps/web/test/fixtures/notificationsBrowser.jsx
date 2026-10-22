import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom'
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

/** 알림 클릭으로 열린 이벤트의 ID를 테스트 화면에 보여 준다. */
function EventRoute() {
  const { eventId } = useParams()
  return <div>이벤트 상세 {eventId}</div>
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
              <Route path="/events/:eventId" element={<EventRoute />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </MyTicketsContext.Provider>
    </UserContext.Provider>
  </ToastContext.Provider>,
)
