import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import '../../src/index.css'
import MainLayout from '../../src/components/layout/MainLayout.jsx'
import Notifications from '../../src/pages/Notifications.jsx'
import UserContext from '../../src/context/userContext.js'
import MyTicketsContext from '../../src/context/myTicketsContext.js'
import ToastContext from '../../src/context/toastContext.js'

function Navigation() {
  window.navigate = useNavigate()
  return <div>테스트 홈</div>
}

function App() {
  const [memberId, setMemberId] = useState(1)
  const [total, setTotal] = useState(null)
  const [mounted, setMounted] = useState(true)
  window.setMember = setMemberId
  window.setTotal = setTotal
  window.unmountLayout = () => setMounted(false)
  return (
    <UserContext.Provider value={{ user: memberId == null ? null : { memberId }, status: memberId == null ? 'anonymous' : 'authenticated' }}>
      <MyTicketsContext.Provider value={{ summary: total == null ? null : { total } }}>
        <ToastContext.Provider value={(message) => window.toasts.push(message)}>
          <MemoryRouter>
            <Navigation />
            {mounted && <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<div>홈 화면</div>} />
                <Route path="/explore" element={<div>탐색 화면</div>} />
                <Route path="/notifications" element={<Notifications />} />
              </Route>
            </Routes>}
          </MemoryRouter>
        </ToastContext.Provider>
      </MyTicketsContext.Provider>
    </UserContext.Provider>
  )
}

createRoot(document.getElementById('root')).render(<App />)
