import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onUnauthorized } from '../api/client.js'
import { getMe, logout, restoreSession } from '../api/auth.js'
import UserContext from './userContext.js'
import { OAUTH_CALLBACK_PATH } from '../utils/loginIntent.js'

const FOLLOW_KEY = 'cking.followedCreators'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function writeJson(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage를 쓸 수 없는 환경(시크릿 모드 등)에서도 앱은 계속 동작해야 한다.
  }
}

/**
 * 로그인/세션 컨텍스트.
 *
 * OAuth 로그인으로 받은 Access JWT로 호출자를 식별한다(Cking-BE docs/domains/auth/api.md).
 * 앱 시작 시 저장된 토큰이 없으면 Refresh Cookie로 재발급을 시도하고, GET /api/me로
 * 사용자 정보({ memberId, name, email, role, creator })를 그대로 가져온다.
 *  - 크리에이터: /api/me 응답의 creator
 *  - 관리자:     /api/me 응답의 role === 'ADMIN'
 *
 * status: 'loading'(복원 중) | 'authenticated' | 'anonymous'
 */
export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [followedCreators, setFollowedCreators] = useState(() => readJson(FOLLOW_KEY, []))

  // 사용자 상태를 바꾸는 요청마다 순번을 올려, 늦게 끝난 이전 요청(예: 이전 계정의 /api/me)이
  // 최신 결과를 덮지 못하게 한다.
  const sessionSeq = useRef(0)

  const markSignedOut = useCallback(() => {
    sessionSeq.current += 1
    setUser(null)
    setStatus('anonymous')
  }, [])

  const loadUser = useCallback(async () => {
    const seq = ++sessionSeq.current
    try {
      const me = await getMe()
      if (sessionSeq.current !== seq) return null
      setUser(me)
      setStatus('authenticated')
      return me
    } catch {
      if (sessionSeq.current === seq) {
        setUser(null)
        setStatus('anonymous')
      }
      return null
    }
  }, [])

  useEffect(() => {
    // OAuth 콜백 화면은 새 계정의 Login Code를 직접 교환하므로 기존 세션을 복원하지 않는다.
    // 복원하면 이전 계정의 Refresh Cookie로 받은 토큰·쿠키가 새 계정 것을 덮을 수 있다.
    if (window.location.pathname === OAUTH_CALLBACK_PATH) return undefined
    let cancelled = false
    restoreSession().then((authenticated) => {
      if (cancelled) return
      if (authenticated) loadUser()
      else markSignedOut()
    })
    return () => {
      cancelled = true
    }
  }, [loadUser, markSignedOut])

  // Access JWT 갱신까지 실패하면 로그아웃 상태로 돌려 RequireUser가 로그인 화면으로 보내게 한다.
  useEffect(() => onUnauthorized(markSignedOut), [markSignedOut])

  const clearUser = useCallback(async () => {
    try {
      await logout()
    } finally {
      markSignedOut()
    }
  }, [markSignedOut])

  const capabilities = useMemo(() => {
    if (status === 'loading') return { isCreator: false, isAdmin: false, checked: false }
    return { isCreator: Boolean(user?.creator), isAdmin: user?.role === 'ADMIN', checked: true }
  }, [user, status])

  const toggleFollow = useCallback((creatorId) => {
    setFollowedCreators((prev) => {
      const id = Number(creatorId)
      const next = prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
      writeJson(FOLLOW_KEY, next)
      return next
    })
  }, [])

  const isFollowing = useCallback(
    (creatorId) => followedCreators.includes(Number(creatorId)),
    [followedCreators]
  )

  const value = useMemo(
    () => ({
      user,
      status,
      capabilities,
      isCreator: capabilities.isCreator,
      isAdmin: capabilities.isAdmin,
      loadUser,
      clearUser,
      markSignedOut,
      // 크리에이터 승인처럼 권한이 바뀌었을 수 있을 때 /api/me를 다시 읽는다.
      refreshCapabilities: loadUser,
      followedCreators,
      toggleFollow,
      isFollowing,
    }),
    [user, status, capabilities, loadUser, clearUser, markSignedOut, followedCreators, toggleFollow, isFollowing]
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}
