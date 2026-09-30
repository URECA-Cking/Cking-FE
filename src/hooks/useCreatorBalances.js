import { useMemo } from 'react'
import { getTicketBalance } from '../api/tickets.js'
import { useAsync } from './useAsync.js'

const emptyBalances = new Map()

/** 화면에서 필요한 크리에이터만 조회하고 같은 화면의 중복 요청을 공유한다. */
export function useCreatorBalances(creatorIds, memberId) {
  const idsKey = [...new Set(creatorIds)].sort((a, b) => a - b).join(',')
  const cache = useMemo(() => ({ memberId, entries: new Map() }), [memberId])
  const { data } = useAsync(async () => {
    const ids = idsKey.split(',').map(Number)
    const entries = await Promise.all(ids.map(async (id) => {
      if (!cache.entries.has(id)) cache.entries.set(id, getTicketBalance(id).catch(() => null))
      return [id, await cache.entries.get(id)]
    }))
    return {
      memberId,
      idsKey,
      balances: new Map(entries.filter(([, balance]) => balance !== null)),
    }
  }, [idsKey, memberId], { enabled: memberId != null && idsKey !== '' })

  return data?.memberId === memberId && data.idsKey === idsKey
    ? data.balances
    : emptyBalances
}
