import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import MyWinners from '../../src/pages/MyWinners.jsx'
import ToastContext from '../../src/context/toastContext.js'

/** 실제 화면 상호작용을 검증하기 위한 최소 앱 셸이다. */
window.renderMyWinners = () => {
  createRoot(document.getElementById('root')).render(
    <ToastContext.Provider value={(message) => window.toasts.push(message)}>
      <MemoryRouter>
        <MyWinners />
      </MemoryRouter>
    </ToastContext.Provider>,
  )
}
