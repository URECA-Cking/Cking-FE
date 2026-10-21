import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import '../../src/index.css'
import Onboarding from '../../src/pages/Onboarding.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'

// 온보딩 1단계 뒤로가기 확인 시트를 검증하는 화면. 건너뛰면 로그인 전에 가려던 /my-page 자리표시자가 보인다.
const user = { nickname: '새가입자', profileConfigured: true, onboardingCompleted: false }

function Destination() {
  return <p>마이페이지 화면 ({useLocation().pathname})</p>
}

createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={[{ pathname: '/onboarding', state: { from: '/my-page' } }]}>
    <ToastContext.Provider value={() => {}}>
      <UserContext.Provider value={{ user, markOnboardingCompleted: () => {}, status: 'authenticated' }}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/my-page" element={<Destination />} />
        </Routes>
      </UserContext.Provider>
    </ToastContext.Provider>
  </MemoryRouter>,
)
