import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import MyCommentBlocks from '../../src/components/creator/MyCommentBlocks.jsx'
import ToastContext from '../../src/context/toastContext.js'

// 차단 해제 확인 시트를 검증하는 화면.
window.toasts = []
createRoot(document.getElementById('root')).render(
  <ToastContext.Provider value={(message) => window.toasts.push(message)}>
    <MyCommentBlocks />
  </ToastContext.Provider>,
)
