import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMe, logout, restoreSession } from '../api/auth.js'
import { AdminSessionContext } from './adminSessionContext.js'

/** 관리자 로그인 상태를 복원하고 ADMIN 역할만 유지한다. */
export function AdminSessionProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  const loadUser = useCallback(async () => {
    try {
      const me = await getMe()
      if (me.role !== 'ADMIN') throw new Error('FORBIDDEN')
      setUser(me)
      setStatus('authenticated')
      return me
    } catch {
      await logout().catch(() => {})
      setUser(null)
      setStatus('anonymous')
      return null
    }
  }, [])

  useEffect(() => {
    restoreSession().then((restored) => (restored ? loadUser() : setStatus('anonymous')))
  }, [loadUser])

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
