import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getMyTicketsSummary } from '../api/tickets.js'
import { useAsync } from '../hooks/useAsync.js'
import { createRetryScheduler, normalizeSummary } from '../utils/myTickets.js'
import MyTicketsContext from './myTicketsContext.js'
import { useUser } from './useUser.js'

// 응모권 적립은 Redis에서 먼저 접수되고 DB 반영이 비동기라, 적립·응모 직후 바로 불러온 값에는 아직 반영 전의 수량이 남을 수 있다.
// 값이 바뀔 때까지 이 간격(2초, 5초, 10초 시점)으로 다시 불러오고, 바뀐 것을 확인하면 멈춘다. 끝까지 안 바뀌어도 여기서 그친다.
const REFRESH_RETRY_GAPS_MS = [2000, 3000, 5000]
// 탭으로 돌아올 때마다 불러오지 않도록 최소 간격을 둔다.
const VISIBLE_REFRESH_MIN_GAP_MS = 10_000

// 조회 실패에 어느 회원의 요청이었는지 붙인다. useAsync는 요청을 막아 둔 동안(다른 회원으로 바뀐 직후 팔로우 목록이 준비되기 전 등)
// 이전 오류를 지우지 않으므로, 이 값으로 현재 회원의 실패만 보여 주려는 것이다.
class MyTicketsLoadError extends Error {
  constructor(memberId, cause) {
    super('내 응모권을 불러오지 못했습니다.', { cause })
    this.memberId = memberId
  }
}

/**
 * 내 응모권(공용 응모권 + 팔로우한 크리에이터별 응모권)을 한 곳에서 불러와 헤더 버튼과 내 응모권 화면이 나눠 쓴다.
 * - BE 요약 API(GET /api/me/tickets) 한 번으로 공용 잔액, 크리에이터별 잔액(이름·이미지 포함), 서버가 계산한 합계를 받는다.
 *   크리에이터마다 따로 조회하지 않으므로 팔로우 수와 무관하게 요청은 한 번이고, 일부만 실패하는 경우도 없다.
 * - 조회 실패는 0으로 단정하지 않는다. 아직 받은 값이 없으면 summary가 null이라 헤더는 자리 표시("–"), 화면은 오류와 다시 시도를 보여 준다.
 * - 새로 불러오는 동안과 다시 불러오다 실패했을 때도 이전 값을 그대로 보여 주고(ready 유지), 로그인 사용자가 바뀌면 이전 사용자의 값은 버린다.
 * - 응답은 DB 기준의 표시용 값이며 응모 가능 여부의 근거가 아니다(응모 가능 여부는 응모 응답 코드로 판단한다).
 */
export function MyTicketsProvider({ children }) {
  const { user, followedCreators, followsReady, followsError } = useUser()
  const memberId = user?.memberId ?? null
  const [refreshKey, setRefreshKey] = useState(0)
  const lastVisibleRefresh = useRef(0)
  // 팔로우를 하거나 끊으면 요약의 크리에이터 목록이 바뀌므로 다시 불러온다. 팔로우 목록 조회가 끝난 뒤(성공이든 실패든)에 불러와
  // 시작할 때 팔로우 목록이 준비되기 전후로 두 번 불러오지 않는다. 팔로우 목록을 못 불러와도 요약은 서버가 팔로우 기준으로 계산한다.
  const followsSettled = followsReady || followsError != null
  const idsKey = useMemo(() => [...new Set(followedCreators)].sort((a, b) => a - b).join(','), [followedCreators])

  const { data, loading, error, errorObject, reload } = useAsync(
    async () => {
      try {
        return { memberId, summary: normalizeSummary(await getMyTicketsSummary()) }
      } catch (cause) {
        throw new MyTicketsLoadError(memberId, cause)
      }
    },
    [memberId, idsKey, refreshKey],
    { enabled: memberId != null && followsSettled, fallbackMessage: '응모권을 불러오지 못했습니다.' },
  )

  // 다시 불러오기. 바로 한 번 불러오고, 총 개수가 그대로면 DB 반영이 아직일 수 있어 정해진 간격으로 몇 번 더 불러온다.
  // 재시도 규칙(값이 바뀌면 멈춤, 연속 호출 처리)은 utils/myTickets.js의 createRetryScheduler가 맡는다.
  const totalRef = useRef(null)
  const retrierRef = useRef(null)
  useEffect(() => {
    const retrier = createRetryScheduler({
      gapsMs: REFRESH_RETRY_GAPS_MS,
      getValue: () => totalRef.current,
      run: () => setRefreshKey((key) => key + 1),
    })
    retrierRef.current = retrier
    return () => {
      retrier.stop()
      retrierRef.current = null
    }
  }, [])
  const refresh = useCallback(() => retrierRef.current?.start(), [])

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

  const summary = data?.memberId === memberId ? data.summary : null
  useEffect(() => {
    totalRef.current = summary ? summary.total : null
  }, [summary])

  const value = useMemo(
    () => ({
      ready: summary !== null,
      loading,
      // 요약을 받은 적이 없거나 마지막 조회가 실패했을 때의 안내 문구. 값이 있으면 이전 값을 계속 보여 주므로 안내만 더한다.
      error: memberId != null && error && errorObject?.memberId === memberId ? error : null,
      summary,
      refresh,
      reload,
    }),
    [summary, loading, error, errorObject, memberId, refresh, reload],
  )

  return <MyTicketsContext.Provider value={value}>{children}</MyTicketsContext.Provider>
}
