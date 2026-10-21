import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import '../../src/index.css'
import CreatorSpace from '../../src/pages/CreatorSpace.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'
import MyTicketsContext from '../../src/context/myTicketsContext.js'
import { OPEN_SPACE_EDIT_STATE } from '../../src/utils/publicProfile.js'

// 마이페이지에서 "스페이스 편집"으로 들어와 시트가 자동으로 열리는 경로를 실제 BrowserRouter(window.history)로 검증하는 화면.
function MyPage() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/space/test', { state: OPEN_SPACE_EDIT_STATE })}>스페이스 편집으로 이동</button>
}

const value = {
  user: { memberId: 1, nickname: '크리에이터' },
  status: 'authenticated',
  isCreator: true,
  followedCreators: [],
  followsReady: true,
  pendingFollowIds: new Set(),
  isFollowing: () => false,
  toggleFollow: async () => null,
}

window.toasts = []
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ToastContext.Provider value={(message) => window.toasts.push(message)}>
      <MyTicketsContext.Provider value={{ refresh: () => {} }}>
        <UserContext.Provider value={value}>
          <Routes>
            <Route path="/my" element={<MyPage />} />
            <Route path="/space/:slug" element={<CreatorSpace />} />
          </Routes>
        </UserContext.Provider>
      </MyTicketsContext.Provider>
    </ToastContext.Provider>
  </BrowserRouter>,
)
