import React from 'react'
import { createRoot } from 'react-dom/client'
import AdminDeadStreams from '../../src/pages/admin/AdminDeadStreams.jsx'
import { ToastContext } from '../../src/context/toastContext.js'

// Dead Stream 재처리 확인 모달을 검증하는 화면. 토스트는 window.toasts에 쌓는다.
window.toasts = []
createRoot(document.getElementById('root')).render(
  <ToastContext.Provider value={(message) => window.toasts.push(message)}>
    <AdminDeadStreams />
  </ToastContext.Provider>,
)
