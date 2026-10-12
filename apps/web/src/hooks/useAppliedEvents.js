import { getMyEventEntries } from '../api/myEntries.js'
import { useAsync } from './useAsync.js'

const noneApplied = new Set()
const noneFailed = new Set()
const noneKnown = new Set()

/**
 * 넘긴 이벤트 중 내가 이미 응모한 이벤트의 id 집합. 사용자 단위 응모 목록 API가 없어 이벤트마다 조회하므로,
 * 홈에 보이는 몇 개에만 쓴다(전체를 훑으면 이벤트 수만큼 요청이 나간다).
 * 조회에 실패한 이벤트는 응모 여부를 모르는 것이므로 응모 안 함으로 보지 않고 failedIds로 따로 알린다.
 */
export function useAppliedEvents(eventIds, memberId) {
  const idsKey = eventIds.join(',')
  const { data, reload } = useAsync(async () => {
    const results = await Promise.all(idsKey.split(',').map(async (value) => {
      const id = Number(value)
      try {
        const page = await getMyEventEntries(id, { size: 1 })
        return { id, applied: page?.items?.length > 0, failed: false }
      } catch {
        return { id, applied: false, failed: true }
      }
    }))
    return {
      appliedIds: new Set(results.filter((result) => result.applied).map((result) => result.id)),
      failedIds: new Set(results.filter((result) => result.failed).map((result) => result.id)),
      // 조회가 끝나 응모 여부를 확정할 수 있는 이벤트. 여기에 없으면(조회 중·실패) 미응모로 단정하지 않는다.
      knownIds: new Set(results.filter((result) => !result.failed).map((result) => result.id)),
    }
  }, [idsKey, memberId], { enabled: memberId != null && idsKey !== '' })

  return {
    appliedIds: data?.appliedIds ?? noneApplied,
    failedIds: data?.failedIds ?? noneFailed,
    knownIds: data?.knownIds ?? noneKnown,
    retry: reload,
  }
}
