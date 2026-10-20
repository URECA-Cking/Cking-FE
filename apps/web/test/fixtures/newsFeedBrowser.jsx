import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../../src/index.css'
import NewsFeed from '../../src/components/home/NewsFeed.jsx'

const root = createRoot(document.getElementById('root'))

const creators = [{ creatorId: 1, handle: 'dock', name: '도킹 크리에이터', avatar: '' }]
// 좋아요·댓글 수가 있는 카드는 sr-only 라벨이 함께 그려지므로 가로 넘침 회귀를 재현한다.
const posts = Array.from({ length: 8 }, (_, index) => ({
  postId: index + 1,
  creatorId: 1,
  content: `새 게시물 ${index + 1}\n부제 문구`,
  createdAt: '2026-10-20T00:00:00Z',
  likeCount: 12,
  commentCount: 3,
}))

/** 홈의 새 게시물 영역을 라우터 안에서 그린다. */
window.renderNewsFeed = () => root.render(
  <MemoryRouter>
    <main>
      <NewsFeed creators={creators} posts={posts} />
    </main>
  </MemoryRouter>,
)
