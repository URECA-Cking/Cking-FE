import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMe, logout, restoreSession } from '../api/auth.js'
import { onUnauthorized } from '../api/client.js'
import { clearAccessToken } from '../api/token.js'
import { AdminSessionContext } from './adminSessionContext.js'

/** 관리자 로그인 상태를 복원하고 ADMIN 역할만 유지한다. */
export function AdminSessionProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  /** Access Token으로 역할을 재검증하고 ADMIN 세션 상태만 유지한다. */
  const loadUser = useCallback(async () => {
    try {
      const me = await getMe()
      if (me.role !== 'ADMIN') {
        clearAccessToken()
        setUser(null)
        setStatus('anonymous')
        void logout().catch(() => {})
        return null
      }
      setUser(me)
      setStatus('authenticated')
      return me
    } catch {
      clearAccessToken()
      setUser(null)
      setStatus('anonymous')
      return null
    }
  }, [])

  useEffect(() => {
    restoreSession().then((restored) => (restored ? loadUser() : setStatus('anonymous')))
  }, [loadUser])

  /** 갱신 불가 401을 받으면 즉시 관리자 화면 접근을 막는다. */
  useEffect(() => onUnauthorized(() => {
    clearAccessToken()
    setUser(null)
    setStatus('anonymous')
  }), [])

  /** 서버 로그아웃 결과와 무관하게 관리자 화면의 로그인 상태를 종료한다. */
  const signOut = useCallback(async () => {
    try {
      await logout()
    } finally {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo(() => ({ user, status, loadUser, signOut }), [user, status, loadUser, signOut])

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}
