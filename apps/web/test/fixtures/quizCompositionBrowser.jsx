import React from 'react'
import '../../src/index.css'
import { createRoot } from 'react-dom/client'
import QuizCompositionPanel from '../../src/components/creator/QuizCompositionPanel.jsx'
import QuizRevisionSheet from '../../src/components/creator/QuizRevisionSheet.jsx'
import ToastContext from '../../src/context/toastContext.js'
const root=createRoot(document.getElementById('root'))
window.renderComposition = (kind = 'panel') => root.render(<ToastContext.Provider value={() => {}}>{kind === 'panel'
  ? <QuizCompositionPanel creatorId={window.fixtureCreatorId ?? 10} quizId={window.fixtureQuizId ?? 1} revision={window.fixtureRevision} onSaved={data => {window.savedRevision=data}} onClose={() => {}} />
  : <QuizRevisionSheet creatorId={window.fixtureCreatorId ?? 10} quizId={window.fixtureQuizId ?? 1} initialRevisionId={window.fixtureRevision.revisionId} onChanged={() => {}} />}</ToastContext.Provider>)
