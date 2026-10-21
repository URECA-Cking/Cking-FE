import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import '../../src/index.css'
import Onboarding from '../../src/pages/Onboarding.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'

// 브라우저·기기 뒤로가기를 검증하는 화면. 실제 history를 쓰려고 BrowserRouter를 쓴다.
// 건너뛰면 로그인 전에 가려던 /my-page 자리표시자가 보인다.
const user = { nickname: '새가입자', profileConfigured: true, onboardingCompleted: false }
// 2단계(크리에이터)가 쓰는 팔로우 관련 값. 아무도 팔로우하지 않은 상태로 둔다.
const follows = { followedCreators: [], toggleFollow: async () => null, isFollowing: () => false, followsReady: true, pendingFollowIds: new Set(), isCreator: false, followsError: null }

function Destination() {
  return <p>마이페이지 화면 ({useLocation().pathname})</p>
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ToastContext.Provider value={() => {}}>
      <UserContext.Provider value={{ user, markOnboardingCompleted: () => {}, status: 'authenticated', ...follows }}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/my-page" element={<Destination />} />
        </Routes>
      </UserContext.Provider>
    </ToastContext.Provider>
  </BrowserRouter>,
)
