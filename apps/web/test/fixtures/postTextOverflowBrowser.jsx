import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../../src/index.css'
import CreatorPosts from '../../src/components/creator/CreatorPosts.jsx'
import NewsFeed from '../../src/components/home/NewsFeed.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'

// 띄어쓰기 없는 긴 글자가 게시글 카드·상세·홈 새 게시물 카드 밖으로 나가지 않는지 보는 화면.
const root = createRoot(document.getElementById('root'))

window.renderPosts = (initialPostId) => root.render(
  <MemoryRouter><ToastContext.Provider value={() => {}}>
    <UserContext.Provider value={{ status: 'authenticated', isAdmin: false }}>
      <CreatorPosts creatorId={13} creatorName="크리에이터" authenticated following isMine={false} memberId={7}
        initialPostId={initialPostId} onInitialPostOpened={() => {}} onLeaveToOrigin={() => {}} />
    </UserContext.Provider>
  </ToastContext.Provider></MemoryRouter>,
)

window.renderFeed = (content) => root.render(
  <MemoryRouter>
    <NewsFeed
      creators={[{ creatorId: 13, name: '크리에이터', handle: 'creator', avatar: null }]}
      posts={[{ postId: 5, creatorId: 13, content, createdAt: '2026-10-20T01:00:00Z', imageCount: 0, likeCount: 0, commentCount: 0 }]}
    />
  </MemoryRouter>,
)
