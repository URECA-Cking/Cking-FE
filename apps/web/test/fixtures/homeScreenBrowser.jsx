import React, { Suspense, lazy, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import Home from '../../src/pages/Home.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'
import MyTicketsContext from '../../src/context/myTicketsContext.js'
import { useAsync } from '../../src/hooks/useAsync.js'
import { clearAsyncCache } from '@cking/shared/useAsync'
import ChunkErrorBoundary from '../../src/components/ui/ChunkErrorBoundary.jsx'

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

/** 홈을 화면에서 내린다. 다시 renderHome을 부르면 처음 여는 것처럼 새로 마운트돼 캐시된 결과가 먼저 보인다. */
window.unmountHome = () => root.render(null)

window.clearAsyncCache = clearAsyncCache

/**
 * useAsync만 따로 확인하는 틀. 조회는 window.probeLoader(tag)가 정하고, 결과는 화면에 그대로 나온다.
 * 테스트가 window.probeGates[tag]()를 불러야 해당 조회가 끝난다.
 */
function Probe({ tag, enabled = true, cacheKey = null }) {
  const { data } = useAsync(() => new Promise((resolve) => { window.probeGates[tag] = () => resolve(tag) }), [tag], { enabled, cacheKey })
  return <p id="probe" data-enabled={String(enabled)}>{data ?? 'none'}</p>
}
window.probeGates = {}
window.renderProbe = (props) => root.render(<Probe {...props} />)

/** 지연 로딩한 화면의 JS 조각을 받지 못한 경우를 흉내 낸다. */
const BrokenPage = lazy(() => Promise.reject(new Error('chunk load failed')))
window.renderBrokenLazy = () => root.render(
  <ChunkErrorBoundary resetKey="a"><Suspense fallback={<p>loading</p>}><BrokenPage /></Suspense></ChunkErrorBoundary>,
)
