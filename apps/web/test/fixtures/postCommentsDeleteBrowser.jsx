import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../../src/index.css'
import PostComments from '../../src/components/creator/PostComments.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'

// 댓글 삭제 확인 시트를 검증하는 화면. 로그인한 회원(memberId 7)과 관리자 여부를 테스트에서 정한다.
const root = createRoot(document.getElementById('root'))
window.toasts = []
window.countChanges = []
window.renderComments = ({ isMine = false, isAdmin = false } = {}) => root.render(
  <MemoryRouter><ToastContext.Provider value={(message) => window.toasts.push(message)}>
    <UserContext.Provider value={{ status: 'authenticated', isAdmin }}>
      <PostComments creatorId={13} postId={5} authenticated following isMine={isMine} memberId={7}
        onCommentCountChange={(delta) => window.countChanges.push(delta)} />
    </UserContext.Provider>
  </ToastContext.Provider></MemoryRouter>,
)
