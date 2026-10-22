import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import NewsFeed from '../../src/components/home/NewsFeed.jsx'
import NewsRow from '../../src/components/home/NewsRow.jsx'
import CreatorPosts from '../../src/components/creator/CreatorPosts.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'

const root = createRoot(document.getElementById('root'))

const creators = [{ creatorId: 13, handle: 'dock', name: '도킹 크리에이터', avatar: '' }]
const posts = [1, 2, 3].map((postId) => ({ postId, creatorId: 13, content: `새 게시물 ${postId}`, createdAt: '2026-10-20T00:00:00Z' }))

/** 스페이스 화면 대신 도착한 경로와 라우터 상태만 그대로 보여 준다. */
function Arrived() {
  const location = useLocation()
  return <output data-testid="arrived">{JSON.stringify({ path: location.pathname, state: location.state })}</output>
}

/** 홈 새 게시물 카드를 누르면 이동하는 경로·상태를 검증하는 화면. */
window.renderFeed = () => root.render(
  <MemoryRouter>
    <Routes>
      <Route path="/" element={<NewsFeed creators={creators} posts={posts} />} />
      <Route path="/:slug" element={<Arrived />} />
    </Routes>
  </MemoryRouter>,
)

/** 홈 소식 행의 크리에이터를 누르면 이동하는 경로·상태를 검증하는 화면. 13은 NEW+최근 글 있음, 14는 NEW 아님, 15는 NEW지만 최근 글 목록에 없음. */
const rowCreators = [
  { creatorId: 13, handle: 'dock', name: '새글 크리에이터', avatar: '' },
  { creatorId: 14, handle: 'calm', name: '조용한 크리에이터', avatar: '' },
  { creatorId: 15, handle: 'late', name: '목록밖 크리에이터', avatar: '' },
]
window.renderNewsRow = () => root.render(
  <MemoryRouter>
    <Routes>
      <Route path="/" element={<NewsRow creators={rowCreators}
        latestByCreator={new Map([[13, { postId: 3, createdAt: '2026-10-20T00:00:00Z' }], [14, { postId: 9, createdAt: '2026-10-19T00:00:00Z' }]])}
        unreadCreatorIds={new Set([13, 15])} />} />
      <Route path="/:slug" element={<Arrived />} />
    </Routes>
  </MemoryRouter>,
)

/** initialPostId로 들어온 게시글 탭이 목록을 누르지 않아도 그 상세를 여는지 검증하는 화면. */
window.openedCalls = 0
window.renderPosts = () => root.render(
  <MemoryRouter><ToastContext.Provider value={() => {}}>
    <UserContext.Provider value={{ status: 'authenticated', isAdmin: false }}>
      <CreatorPosts creatorId={13} creatorName="크리에이터" authenticated following isMine={false} memberId={7}
        initialPostId={2} onInitialPostOpened={() => { window.openedCalls += 1 }} />
    </UserContext.Provider>
  </ToastContext.Provider></MemoryRouter>,
)
