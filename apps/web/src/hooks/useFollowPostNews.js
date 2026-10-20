import { getFollowPostNews } from '../api/follows.js'
import { useAsync } from './useAsync.js'

const emptyNews = { unreadCreatorIds: new Set(), latestPostAt: new Map() }

/**
 * 팔로우한 크리에이터의 새 글 정보. unreadCreatorIds는 읽지 않은 새 글이 있는 크리에이터 ID 집합, latestPostAt은 크리에이터별 최신 글 시각(ms)이다.
 * 홈에 들어올 때마다 다시 받아 스페이스에서 읽은 결과가 반영되게 캐시하지 않는다.
 * 조회 중이거나 실패하면 비어 있어 NEW를 보여주지 않는다. NEW는 표시 힌트라서 실패를 따로 알리지 않는다.
 */
export function useFollowPostNews(memberId, followedCreators) {
  const idsKey = followedCreators.join(',')
  const { data } = useAsync(
    async () => {
      const items = await getFollowPostNews()
      return {
        unreadCreatorIds: new Set(items.filter((item) => item.hasUnreadPosts).map((item) => Number(item.creatorId))),
        latestPostAt: new Map(items.filter((item) => item.latestPostCreatedAt).map((item) => [Number(item.creatorId), Date.parse(item.latestPostCreatedAt)])),
      }
    },
    [memberId, idsKey],
    { enabled: memberId != null && idsKey !== '' },
  )
  return data ?? emptyNews
}
