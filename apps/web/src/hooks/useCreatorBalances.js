import { useMemo } from 'react'
import { getTicketBalance } from '../api/tickets.js'
import { useAsync } from './useAsync.js'

const emptyBalances = new Map()
const emptyFailures = new Set()

/** 화면에서 필요한 크리에이터만 조회하고 같은 화면의 중복 요청을 공유한다. */
export function useCreatorBalances(creatorIds, memberId) {
  const idsKey = [...new Set(creatorIds)].sort((a, b) => a - b).join(',')
  const cache = useMemo(() => ({ memberId, entries: new Map() }), [memberId])
  const { data, loading, reload } = useAsync(async () => {
    const ids = idsKey.split(',').map(Number)
    const entries = await Promise.all(ids.map(async (id) => {
      if (!cache.entries.has(id)) {
        const request = getTicketBalance(id).catch(() => {
          if (cache.entries.get(id) === request) cache.entries.delete(id)
          return null
        })
        cache.entries.set(id, request)
      }
      return [id, await cache.entries.get(id)]
    }))
    return {
      memberId,
      idsKey,
      balances: new Map(entries.filter(([, balance]) => balance !== null)),
      failedIds: new Set(entries.filter(([, balance]) => balance === null).map(([id]) => id)),
    }
  }, [idsKey, memberId], { enabled: memberId != null && idsKey !== '' })

  const current = data?.memberId === memberId && data.idsKey === idsKey ? data : null
  return {
    balances: current?.balances ?? emptyBalances,
    failedIds: current?.failedIds ?? emptyFailures,
    retry: reload,
    loading,
  }
}
