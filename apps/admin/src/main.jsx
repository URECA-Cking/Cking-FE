import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AdminSessionProvider } from './context/AdminSessionContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import './index.css'

/** 관리자 앱에 독립 라우터·알림·세션 공급자를 연결한다. */
createRoot(document.getElementById('root')).render(
  <StrictMode><BrowserRouter><ToastProvider><AdminSessionProvider><App /></AdminSessionProvider></ToastProvider></BrowserRouter></StrictMode>,
)
