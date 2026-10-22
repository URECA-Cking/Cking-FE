import React from 'react'
import { createRoot } from 'react-dom/client'
import QuizRevisionSheet from '../../src/components/creator/QuizRevisionSheet.jsx'
import MyQuizManager from '../../src/components/creator/MyQuizManager.jsx'
import CreatorQuizzes from '../../src/components/creator/CreatorQuizzes.jsx'
import ToastContext from '../../src/context/toastContext.js'
const root = createRoot(document.getElementById('root'))
window.renderCloseQuiz = (kind, props = {}) => root.render(
  <ToastContext.Provider value={message => { window.toasts.push(message) }}>
    {kind === 'fan' ? <CreatorQuizzes creatorId={10} authenticated sessionLoading={false} isMine={false} />
      : kind === 'manager' ? <MyQuizManager creatorId={10} />
        : <QuizRevisionSheet creatorId={10} quizId={1} initialRevisionId={100} onChanged={() => { window.changed++ }} {...props} />}
  </ToastContext.Provider>,
)
