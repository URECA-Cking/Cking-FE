import React from 'react'
import { createRoot } from 'react-dom/client'
import QuizGenerationPanel from '../../src/components/creator/QuizGenerationPanel.jsx'
import ToastContext from '../../src/context/toastContext.js'
const root = createRoot(document.getElementById('root'))
let session = 0
window.renderQuiz = () => root.render(<ToastContext.Provider value={() => {}}><QuizGenerationPanel key={++session} creatorId={10} /></ToastContext.Provider>)
