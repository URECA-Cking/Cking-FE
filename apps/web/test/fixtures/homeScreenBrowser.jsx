import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import Home from '../../src/pages/Home.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'
import MyTicketsContext from '../../src/context/myTicketsContext.js'

const root = createRoot(document.getElementById('root'))

/**
 * 홈을 실제 컴포넌트 그대로 그리되, 로그인 상태(UserContext)·토스트·헤더 응모권만 대신하는 틀.
 * 팔로우는 서버 대신 이 틀이 기록(window.followCalls)하고 팔로우 목록을 바꾼다. 팔로우 뒤 퀘스트 상태는 테스트의 fetch 목이 정한다.
 */
function Shell({ follows, memberId }) {
  const [ids, setIds] = useState(follows)
  const user = { memberId, nickname: '혁준' }
  const value = {
    user,
    isCreator: false,
    followedCreators: ids,
    followsReady: true,
    pendingFollowIds: new Set(),
    isFollowing: (creatorId) => ids.includes(Number(creatorId)),
    /** 서버 호출 없이 팔로우 목록만 바꾸고 호출을 기록한다. */
    toggleFollow: async (creatorId) => {
      window.followCalls.push(creatorId)
      setIds((current) => [creatorId, ...current])
      return { creatorId, following: true }
    },
  }
  return (
    <MemoryRouter>
      <ToastContext.Provider value={(message) => window.toasts.push(message)}>
        <MyTicketsContext.Provider value={{ refresh: () => { window.ticketRefreshes += 1 } }}>
          <UserContext.Provider value={value}>
            <Home />
          </UserContext.Provider>
        </MyTicketsContext.Provider>
      </ToastContext.Provider>
    </MemoryRouter>
  )
}

/** 지정한 팔로우 목록과 회원 번호로 홈을 그린다. 같은 화면에서 회원 번호만 바꿔 다시 부르면 계정 전환을 흉내 낸다. */
window.renderHome = (follows = [], memberId = 7) => root.render(<Shell follows={follows} memberId={memberId} />)

/** 홈을 화면에서 내린다. 로그아웃이나 화면 이동으로 홈이 사라지는 상황을 흉내 낸다. */
window.unmountHome = () => root.render(null)
