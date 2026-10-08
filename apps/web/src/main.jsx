import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import PullToRefresh from './components/layout/PullToRefresh.jsx'
import Splash from './components/layout/Splash.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { UserProvider } from './context/UserContext.jsx'
import { registerServiceWorker } from './pwa/registerServiceWorker.js'
import './index.css'

registerServiceWorker()

async function start() {
  // 개발 모드에서만 더미 API를 불러온다. 배포 빌드에서는 이 분기와 모듈이 통째로 빠진다.
  if (import.meta.env.DEV) {
    const { installMockApiIfRequested } = await import('./dev/mockApi.js')
    installMockApiIfRequested()
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <UserProvider>
            <App />
            <Splash />
            <PullToRefresh />
          </UserProvider>
        </ToastProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}

start()
