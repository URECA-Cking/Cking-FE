import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../../src/index.css'
import CreatorPosts from '../../src/components/creator/CreatorPosts.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'

// 게시글 삭제 확인 시트를 검증하는 화면. 본인(크리에이터) 스페이스의 게시글 목록을 보여 준다.
window.toasts = []
createRoot(document.getElementById('root')).render(
  <MemoryRouter><ToastContext.Provider value={(message) => window.toasts.push(message)}>
    <UserContext.Provider value={{ status: 'authenticated', isAdmin: false }}>
      <CreatorPosts creatorId={13} creatorName="크리에이터" authenticated following isMine memberId={7} />
    </UserContext.Provider>
  </ToastContext.Provider></MemoryRouter>,
)
