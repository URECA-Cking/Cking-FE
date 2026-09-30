import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onUnauthorized } from '../api/client.js'
import { getMe, logout, restoreSession } from '../api/auth.js'
import { followCreator, getAllFollows, unfollowCreator } from '../api/follows.js'
import UserContext from './userContext.js'
import { OAUTH_CALLBACK_PATH } from '../utils/loginIntent.js'

const emptyFollows = { memberId: null, ids: [], ready: false, error: null }

/**
 * 로그인/세션 컨텍스트.
 * OAuth Access JWT로 사용자를 식별하고, 로그인 후 서버의 팔로우 목록을 모두 조회한다.
 * status: 'loading'(복원 중) | 'authenticated' | 'anonymous'
 */
export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [followState, setFollowState] = useState(emptyFollows)
  const [pendingFollowIds, setPendingFollowIds] = useState(() => new Set())
  const pendingFollowRef = useRef(new Set())
  // 늦게 끝난 이전 세션의 요청이 현재 계정의 상태를 덮지 못하게 한다.
  const sessionSeq = useRef(0)
  const memberId = user?.memberId ?? null

  const markSignedOut = useCallback(() => {
    sessionSeq.current += 1
    pendingFollowRef.current.clear()
    setPendingFollowIds(new Set())
    setFollowState(emptyFollows)
    setUser(null)
    setStatus('anonymous')
  }, [])

  const loadUser = useCallback(async () => {
    const seq = ++sessionSeq.current
    pendingFollowRef.current.clear()
    setPendingFollowIds(new Set())
    setFollowState(emptyFollows)
    setUser(null)
    setStatus('loading')
    try {
      const me = await getMe()
      if (sessionSeq.current !== seq) return null
      let follows
      try {
        follows = { memberId: me.memberId, ids: await getAllFollows(), ready: true, error: null }
      } catch (error) {
        follows = { memberId: me.memberId, ids: [], ready: false, error }
      }
      if (sessionSeq.current !== seq) return null
      setFollowState(follows)
      setUser(me)
      setStatus('authenticated')
      return me
    } catch {
      if (sessionSeq.current === seq) markSignedOut()
      return null
    }
  }, [markSignedOut])

  const restore = useCallback(async () => {
    const authenticated = await restoreSession()
    if (authenticated) return loadUser()
    markSignedOut()
    return null
  }, [loadUser, markSignedOut])

  useEffect(() => {
    // OAuth 콜백은 새 Login Code를 먼저 교환하므로 이전 계정의 세션을 복원하지 않는다.
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

  // Access JWT 갱신까지 실패하면 이전 사용자의 팔로우 상태도 함께 지운다.
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

  const followedCreators = useMemo(
    () => (memberId !== null && followState.memberId === memberId ? followState.ids : []),
    [memberId, followState],
  )
  const followsReady = memberId !== null && followState.memberId === memberId && followState.ready
  const followsError = memberId !== null && followState.memberId === memberId ? followState.error : null

  const reloadFollows = useCallback(async () => {
    if (memberId === null) return
    const seq = sessionSeq.current
    setFollowState({ memberId, ids: [], ready: false, error: null })
    try {
      const ids = await getAllFollows()
      if (sessionSeq.current === seq) setFollowState({ memberId, ids, ready: true, error: null })
    } catch (error) {
      if (sessionSeq.current === seq) setFollowState({ memberId, ids: [], ready: false, error })
    }
  }, [memberId])

  const toggleFollow = useCallback(async (creatorId) => {
    const id = Number(creatorId)
    if (memberId === null || !followsReady || !Number.isInteger(id) || id <= 0) return null
    if (pendingFollowRef.current.has(id)) return null
    const seq = sessionSeq.current
    const wasFollowing = followedCreators.includes(id)
    pendingFollowRef.current.add(id)
    setPendingFollowIds(new Set(pendingFollowRef.current))
    try {
      const result = wasFollowing ? await unfollowCreator(id) : await followCreator(id)
      if (sessionSeq.current !== seq) return null
      setFollowState((current) => {
        if (current.memberId !== memberId || !current.ready) return current
        return {
          ...current,
          ids: result.following
            ? [...new Set([...current.ids, id])]
            : current.ids.filter((value) => value !== id),
        }
      })
      return result
    } finally {
      if (sessionSeq.current === seq) {
        pendingFollowRef.current.delete(id)
        setPendingFollowIds(new Set(pendingFollowRef.current))
      }
    }
  }, [memberId, followsReady, followedCreators])

  const isFollowing = useCallback(
    (creatorId) => followedCreators.includes(Number(creatorId)),
    [followedCreators],
  )

  const value = useMemo(() => ({
    user,
    status,
    capabilities,
    isCreator: capabilities.isCreator,
    isAdmin: capabilities.isAdmin,
    loadUser,
    clearUser,
    restore,
    // 크리에이터 승인처럼 권한이 바뀌었을 수 있을 때 /api/me를 다시 읽는다.
    refreshCapabilities: loadUser,
    followedCreators,
    followsReady,
    followsError,
    reloadFollows,
    pendingFollowIds,
    toggleFollow,
    isFollowing,
  }), [user, status, capabilities, loadUser, clearUser, restore, followedCreators, followsReady, followsError, reloadFollows, pendingFollowIds, toggleFollow, isFollowing])

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}
