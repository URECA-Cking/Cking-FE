import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CreatorSpace from '../../src/pages/CreatorSpace.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'
import MyTicketsContext from '../../src/context/myTicketsContext.js'

const root = createRoot(document.getElementById('root'))

/** 크리에이터 회원 1이 자기 스페이스(slug test)를 보는 화면. 서버 응답은 테스트의 fetch 목이 정한다. */
function Shell() {
  const value = {
    user: { memberId: 1, nickname: '크리에이터', creator: true },
    status: 'authenticated',
    isCreator: true,
    followedCreators: [],
    followsReady: true,
    pendingFollowIds: new Set(),
    isFollowing: () => false,
    toggleFollow: async () => null,
  }
  return (
    <MemoryRouter initialEntries={['/space/test']}>
      <ToastContext.Provider value={(message) => window.toasts.push(message)}>
        <MyTicketsContext.Provider value={{ refresh: () => {} }}>
          <UserContext.Provider value={value}>
            <Routes>
              <Route path="/space/:slug" element={<CreatorSpace />} />
            </Routes>
          </UserContext.Provider>
        </MyTicketsContext.Provider>
      </ToastContext.Provider>
    </MemoryRouter>
  )
}

window.renderSpace = () => root.render(<Shell />)
