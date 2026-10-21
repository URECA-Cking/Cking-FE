import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from '../../src/App.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'
import '../../src/index.css'

const initialUser = { memberId: 1, nickname: null, profileConfigured: false, onboardingCompleted: false, creator: null }

/** 설정 화면에 전달된 원래 경로를 브라우저 테스트에서 확인할 수 있게 기록한다. */
function LocationProbe() {
  const location = useLocation()
  useEffect(() => { window.routeStateFrom = location.state?.from }, [location])
  return null
}

/** 닉네임 미설정 계정의 앱 라우팅과 로그아웃을 실제 화면 구성으로 검증한다. */
function Fixture() {
  const [user, setUser] = useState(initialUser)
  const [status, setStatus] = useState('authenticated')

  /** 로그아웃 요청 횟수를 남기고 인증 상태를 익명으로 바꾼다. */
  async function clearUser() {
    window.logoutCalls += 1
    if (window.delayLogout) await new Promise((resolve) => { window.finishLogout = resolve })
    setUser(null)
    setStatus('anonymous')
  }

  return (
    <MemoryRouter initialEntries={[window.location.pathname + window.location.search + window.location.hash]}>
      <LocationProbe />
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
