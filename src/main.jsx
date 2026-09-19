import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { UserProvider } from './context/UserContext.jsx'
import { registerServiceWorker } from './pwa/registerServiceWorker.js'
import './index.css'

registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <UserProvider>
          <App />
        </UserProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
