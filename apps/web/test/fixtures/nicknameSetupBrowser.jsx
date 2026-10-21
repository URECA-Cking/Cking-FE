import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import App from '../../src/App.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'
import '../../src/index.css'

const initialUser = { memberId: 1, nickname: null, profileConfigured: false, onboardingCompleted: false, creator: null }

/** 닉네임 미설정 계정의 앱 라우팅과 로그아웃을 실제 화면 구성으로 검증한다. */
function Fixture() {
  const [user, setUser] = useState(initialUser)
  const [status, setStatus] = useState('authenticated')

  /** 로그아웃 요청 횟수를 남기고 인증 상태를 익명으로 바꾼다. */
  async function clearUser() {
    window.logoutCalls += 1
    setUser(null)
    setStatus('anonymous')
  }

  return (
    <MemoryRouter initialEntries={[window.location.pathname]}>
      <ToastContext.Provider value={() => {}}>
        <UserContext.Provider value={{ user, status, clearUser, applyUser: setUser }}>
          <App />
        </UserContext.Provider>
      </ToastContext.Provider>
    </MemoryRouter>
  )
}

window.logoutCalls = 0
createRoot(document.getElementById('root')).render(<Fixture />)
