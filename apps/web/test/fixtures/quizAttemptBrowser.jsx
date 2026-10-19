import React from 'react'
import { createRoot } from 'react-dom/client'
import CreatorQuizzes from '../../src/components/creator/CreatorQuizzes.jsx'
import ToastContext from '../../src/context/toastContext.js'

const root = createRoot(document.getElementById('root'))
// CreatorSpace처럼 회원이 바뀌면 key로 다시 마운트해 이전 회원의 화면 상태가 남지 않게 한다.
window.renderAttempt = ({ memberId = 1, authenticated = true, isMine = false } = {}) => root.render(
  <ToastContext.Provider value={(message) => { window.toasts.push(message) }}>
    <CreatorQuizzes
      key={`10:${memberId ?? 'anonymous'}`}
      creatorId={10}
      memberId={memberId}
      authenticated={authenticated}
      sessionLoading={false}
      isMine={isMine}
      onLogin={() => { window.logins += 1 }}
    />
  </ToastContext.Provider>,
)
