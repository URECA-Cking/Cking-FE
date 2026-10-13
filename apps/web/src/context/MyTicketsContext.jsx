import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCommonTicketBalance, getTicketBalance } from '../api/tickets.js'
import { useAsync } from '../hooks/useAsync.js'
import { summarizeTickets } from '../utils/myTickets.js'
import MyTicketsContext from './myTicketsContext.js'
import { useUser } from './useUser.js'

const emptyCreators = new Map()
const emptyFailures = new Set()

// 응모권 적립은 Redis에서 먼저 접수되고 DB 반영이 비동기라, 적립·응모 직후 한 번 더 불러와 늦게 반영된 값도 따라간다.
const REFRESH_AGAIN_MS = 2000
// 탭으로 돌아올 때마다 불러오지 않도록 최소 간격을 둔다.
const VISIBLE_REFRESH_MIN_GAP_MS = 10_000

/**
 * 내 응모권(팔로우한 크리에이터의 응모권 + 공용 응모권)을 한 곳에서 불러와 헤더 버튼과 내 응모권 화면이 나눠 쓴다.
 * - 조회 대상은 팔로우 목록이 준비된 로그인 사용자의 팔로우한 크리에이터와 공용 응모권이다.
 * - 크리에이터마다 따로 조회해야 해서(BE에 요약 API가 없다) 팔로우 수만큼 호출한다. 한 곳에 모아 두었으니
 *   BE에 요약 API가 생기면 이 안의 조회만 바꾸면 된다.
 * - 새로 불러오는 동안에도 이전 값을 그대로 보여 주고(ready 유지), 로그인 사용자가 바뀌면 이전 사용자의 값은 버린다.
 */
export function MyTicketsProvider({ children }) {
  const { user, followedCreators, followsReady } = useUser()
  const memberId = user?.memberId ?? null
  const [refreshKey, setRefreshKey] = useState(0)
  const lastVisibleRefresh = useRef(0)
  const idsKey = useMemo(() => [...new Set(followedCreators)].sort((a, b) => a - b).join(','), [followedCreators])

  const { data, loading } = useAsync(
    async () => {
      const ids = idsKey === '' ? [] : idsKey.split(',').map(Number)
      const [common, entries] = await Promise.all([
        getCommonTicketBalance().catch(() => null),
        Promise.all(ids.map((id) => getTicketBalance(id).then((balance) => [id, balance]).catch(() => [id, null]))),
      ])
      return {
        memberId,
        common,
        creators: new Map(entries.filter(([, balance]) => balance !== null)),
        failedIds: new Set(entries.filter(([, balance]) => balance === null).map(([id]) => id)),
      }
    },
    [memberId, idsKey, refreshKey],
    { enabled: memberId != null && followsReady },
  )

  // 다시 불러오기. 바로 한 번, 그리고 DB 반영이 늦을 수 있어 잠시 뒤 한 번 더.
  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1)
    setTimeout(() => setRefreshKey((key) => key + 1), REFRESH_AGAIN_MS)
  }, [])

  // 다른 탭·앱에서 응모권이 바뀌었을 수 있어 화면으로 돌아오면 다시 불러온다.
  useEffect(() => {
    if (memberId == null) return undefined
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastVisibleRefresh.current < VISIBLE_REFRESH_MIN_GAP_MS) return
      lastVisibleRefresh.current = now
      setRefreshKey((key) => key + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [memberId])

  const current = data?.memberId === memberId ? data : null
  const summary = useMemo(() => (current ? summarizeTickets(current) : null), [current])

  const value = useMemo(
    () => ({
      ready: current !== null,
      loading,
      summary,
      creators: current?.creators ?? emptyCreators,
      failedIds: current?.failedIds ?? emptyFailures,
      refresh,
    }),
    [current, loading, summary, refresh],
  )

  return <MyTicketsContext.Provider value={value}>{children}</MyTicketsContext.Provider>
}
