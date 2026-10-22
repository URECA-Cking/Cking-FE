import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CreatorSpace from '../../src/pages/CreatorSpace.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'
import MyTicketsContext from '../../src/context/myTicketsContext.js'

const root = createRoot(document.getElementById('root'))

/**
 * 크리에이터 스페이스를 실제 컴포넌트 그대로 그리되, 로그인 상태(UserContext)·토스트·헤더 응모권만 대신하는 틀.
 * 서버 응답은 테스트의 fetch 목이 정하고, 이 틀은 회원 번호·크리에이터 여부·로그인 여부만 바꿔 끼운다.
 */
function Shell({ memberId, isCreator, authenticated }) {
  const value = {
    user: authenticated ? { memberId, nickname: '팬' } : null,
    status: authenticated ? 'authenticated' : 'anonymous',
    isCreator,
    followedCreators: [],
    followsReady: true,
    pendingFollowIds: new Set(),
    isFollowing: () => false,
    toggleFollow: async () => null,
  }
  return (
    <MemoryRouter initialEntries={['/space/test']}>
      <ToastContext.Provider value={(message) => window.toasts.push(message)}>
        <MyTicketsContext.Provider value={{ refresh: () => { window.ticketRefreshes += 1 } }}>
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

/** 회원 번호·크리에이터 여부·로그인 여부를 정해 스페이스를 그린다. 같은 화면에서 값만 바꿔 다시 부르면 계정 전환을 흉내 낸다. */
window.renderSpace = ({ memberId = 1, isCreator = false, authenticated = true } = {}) =>
  root.render(<Shell memberId={memberId} isCreator={isCreator} authenticated={authenticated} />)
