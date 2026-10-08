import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import PullToRefresh from './components/layout/PullToRefresh.jsx'
import Splash from './components/layout/Splash.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { UserProvider } from './context/UserContext.jsx'
import { registerServiceWorker } from './pwa/registerServiceWorker.js'
import './index.css'

registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <ToastProvider>
          <UserProvider>
            <App />
            <Splash />
            <PullToRefresh />
          </UserProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
