import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import YoutubeChannelSheet from '../../src/components/creator/YoutubeChannelSheet.jsx'
import ToastContext from '../../src/context/toastContext.js'

// YouTube 구독 인증 채널 설정 시트를 검증하는 화면. 토스트는 window.toasts에 { message, icon }로 모은다.
window.toasts = []
createRoot(document.getElementById('root')).render(
  <ToastContext.Provider value={(message, options = {}) => window.toasts.push({ message, icon: options.icon ?? 'check_circle' })}>
    <YoutubeChannelSheet open onClose={() => {}} />
  </ToastContext.Provider>,
)
