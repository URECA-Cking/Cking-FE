import React from 'react'
import { createRoot } from 'react-dom/client'
import QuizGenerationPanel from '../../src/components/creator/QuizGenerationPanel.jsx'
import QuizRevisionSheet from '../../src/components/creator/QuizRevisionSheet.jsx'
import ToastContext from '../../src/context/toastContext.js'

const root = createRoot(document.getElementById('root'))
window.renderQuiz = (kind) => root.render(
  <ToastContext.Provider value={() => {}}>
    {kind === 'generation'
      ? <QuizGenerationPanel creatorId={10} />
      : <QuizRevisionSheet creatorId={10} quizId={1} initialRevisionId={100} onChanged={() => {}} />}
  </ToastContext.Provider>,
)
