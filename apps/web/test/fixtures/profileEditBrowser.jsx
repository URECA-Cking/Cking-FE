import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import '../../src/index.css'
import ProfileEdit from '../../src/pages/ProfileEdit.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'

// 프로필 편집 화면에서 뒤로가기 확인 시트를 검증하는 화면. 나가면 /my-page 자리표시자가 보인다.
const user = { nickname: '기존닉네임', profileConfigured: true, onboardingCompleted: true, profileImageUrl: null }
createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/profile/edit']}>
    <ToastContext.Provider value={() => {}}>
      <UserContext.Provider value={{ user, applyUser: () => {}, status: 'authenticated' }}>
        <Routes>
          <Route path="/profile/edit" element={<ProfileEdit />} />
          <Route path="/my-page" element={<p>마이페이지 화면</p>} />
        </Routes>
      </UserContext.Provider>
    </ToastContext.Provider>
  </MemoryRouter>,
)
