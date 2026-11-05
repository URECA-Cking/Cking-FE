import React from 'react'
import { createRoot } from 'react-dom/client'
import CreatorApplicationSheet from '../../src/components/creator/CreatorApplicationSheet.jsx'
import ToastContext from '../../src/context/toastContext.js'
import '../../src/index.css'

createRoot(document.getElementById('root')).render(
  <ToastContext.Provider value={(message) => window.toasts.push(message)}>
    <CreatorApplicationSheet open application={window.application ?? null} onClose={() => {}} onDone={() => { window.done = true }} />
  </ToastContext.Provider>,
)
