import { getFollowPostNews } from '../api/follows.js'
import { useAsync } from './useAsync.js'

const emptyUnread = new Set()

/**
 * 팔로우한 크리에이터 중 읽지 않은 새 글이 있는 크리에이터의 ID 집합. 홈에 들어올 때마다 다시 받아 스페이스에서 읽은 결과가 반영되게 캐시하지 않는다.
 * 조회 중이거나 실패하면 빈 집합이라 NEW를 보여주지 않는다. NEW는 표시 힌트라서 실패를 따로 알리지 않는다.
 */
export function useFollowPostNews(memberId, followedCount) {
  const { data } = useAsync(
    async () => new Set((await getFollowPostNews()).filter((item) => item.hasUnreadPosts).map((item) => Number(item.creatorId))),
    [memberId, followedCount],
    { enabled: memberId != null && followedCount > 0 },
  )
  return data ?? emptyUnread
}
