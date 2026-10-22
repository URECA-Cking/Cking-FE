import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import '../../src/index.css'
import Explore from '../../src/pages/Explore.jsx'
import ExploreRecommend from '../../src/pages/ExploreRecommend.jsx'
import ExploreSearch from '../../src/pages/ExploreSearch.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'

const root = createRoot(document.getElementById('root'))

/** 라우터 위치와 뒤로 가기를 테스트가 쓸 수 있게 window에 드러낸다. */
function Bridge() {
  const location = useLocation()
  const navigate = useNavigate()
  window.where = () => location.pathname + location.search
  window.goBack = () => navigate(-1)
  return null
}

/**
 * 탐색 세 화면(탐색·검색 결과·맞춤 추천)을 실제 컴포넌트와 라우팅 그대로 그리고,
 * 로그인 상태(UserContext)와 토스트만 대신하는 틀. 팔로우는 서버 대신 이 틀이 목록만 바꾼다.
 */
function Shell({ initial, memberId }) {
  const [ids, setIds] = useState([])
  const value = {
    user: { memberId, nickname: '혁준' },
    isCreator: false,
    followedCreators: ids,
    followsReady: true,
    pendingFollowIds: new Set(),
    isFollowing: (creatorId) => ids.includes(Number(creatorId)),
    toggleFollow: async (creatorId) => {
      setIds((current) => [creatorId, ...current])
      return { creatorId, following: true }
    },
  }
  return (
    <MemoryRouter initialEntries={[initial]}>
      <ToastContext.Provider value={() => {}}>
        <UserContext.Provider value={value}>
          <Bridge />
          <main>
            <Routes>
              <Route path="/explore" element={<Explore />} />
              <Route path="/explore/search" element={<ExploreSearch />} />
              <Route path="/explore/recommend" element={<ExploreRecommend />} />
            </Routes>
          </main>
        </UserContext.Provider>
      </ToastContext.Provider>
    </MemoryRouter>
  )
}

/** 지정한 주소에서 시작해 탐색 화면들을 그린다. */
window.renderExplore = (initial = '/explore', memberId = 7) => root.render(<Shell initial={initial} memberId={memberId} />)
