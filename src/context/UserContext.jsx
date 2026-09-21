import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { probe } from '../api/client.js'

const STORAGE_KEY = 'cking.demoUser'
const FOLLOW_KEY = 'cking.followedCreators'
const UserContext = createContext(null)

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
 * 백엔드에 인증 체계가 아직 없어(GET /api/users + POST /api/demo/users/select),
 * 가상 사용자 중 하나를 골라 userId를 모든 요청에 실어 보내는 방식으로 "로그인"을 대신한다.
 *
 * 선택된 사용자의 권한(크리에이터/관리자)도 백엔드가 응답에 담아주지 않으므로,
 * 권한이 필요한 조회 API를 한 번씩 호출해 성공 여부로 판정한다.
 *  - 크리에이터: GET /api/creator/events (Creator가 아니면 FORBIDDEN)
 *  - 관리자:     GET /api/admin/events/pending (ADMIN이 아니면 FORBIDDEN)
 */
export function UserProvider({ children }) {
  const [user, setUser] = useState(() => readJson(STORAGE_KEY, null))
  const [followedCreators, setFollowedCreators] = useState(() => readJson(FOLLOW_KEY, []))
  // 권한 판정 결과는 어떤 userId에 대한 것인지까지 같이 들고 있어야,
  // 사용자를 바꾼 직후 이전 사용자의 권한이 잠시 남아 보이는 일이 없다.
  const [probed, setProbed] = useState(null)

  const selectUser = useCallback((nextUser) => {
    setUser(nextUser)
    writeJson(STORAGE_KEY, nextUser)
  }, [])

  const clearUser = useCallback(() => {
    setUser(null)
    writeJson(STORAGE_KEY, null)
  }, [])

  const refreshCapabilities = useCallback(async (targetUser) => {
    const current = targetUser ?? user
    if (!current) return
    const [isCreator, isAdmin] = await Promise.all([
      probe('/api/creator/events', { userId: current.userId, page: 0, size: 1 }),
      probe('/api/admin/events/pending', { userId: current.userId, page: 0, size: 1 }),
    ])
    setProbed({ userId: current.userId, isCreator, isAdmin })
  }, [user])

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    Promise.all([
      probe('/api/creator/events', { userId: user.userId, page: 0, size: 1 }),
      probe('/api/admin/events/pending', { userId: user.userId, page: 0, size: 1 }),
    ]).then(([isCreator, isAdmin]) => {
      if (!cancelled) setProbed({ userId: user.userId, isCreator, isAdmin })
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const capabilities = useMemo(() => {
    if (!user) return { isCreator: false, isAdmin: false, checked: true }
    if (probed?.userId !== user.userId) return { isCreator: false, isAdmin: false, checked: false }
    return { isCreator: probed.isCreator, isAdmin: probed.isAdmin, checked: true }
  }, [user, probed])

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
      userId: user?.userId ?? null,
      capabilities,
      isCreator: capabilities.isCreator,
      isAdmin: capabilities.isAdmin,
      selectUser,
      clearUser,
      refreshCapabilities,
      followedCreators,
      toggleFollow,
      isFollowing,
    }),
    [user, capabilities, selectUser, clearUser, refreshCapabilities, followedCreators, toggleFollow, isFollowing]
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error('useUser는 UserProvider 내부에서만 사용할 수 있습니다.')
  }
  return ctx
}
