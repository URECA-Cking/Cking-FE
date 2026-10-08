import { getCreatorPosts } from '../api/posts.js'
import { useAsync } from './useAsync.js'

// 팔로우 전체의 최신 글을 한 번에 주는 API가 없어 크리에이터마다 호출한다. 홈 진입 때마다 나가는 요청이라 상한을 둔다.
// ponytail: 11번째부터는 글을 가져오지 않는다. 피드 API가 생기면 이 훅만 교체한다.
export const NEWS_CREATOR_LIMIT = 10
// 크리에이터당 가져오는 글 수. 호출 수는 그대로이고 한 번에 받는 양만 늘린다.
const POSTS_PER_CREATOR = 3

const emptyNews = { latestByCreator: new Map(), posts: [] }

/**
 * 팔로우한 크리에이터의 최근 글. latestByCreator는 크리에이터별 최신 1건(새 글 표시용),
 * posts는 모두 합쳐 최신순으로 정렬한 목록(게시물 카드용). 한 명의 조회가 실패해도 나머지는 그대로 쓴다.
 */
export function useCreatorNews(creatorIds, memberId) {
  const idsKey = creatorIds.slice(0, NEWS_CREATOR_LIMIT).join(',')
  const { data, loading } = useAsync(async () => {
    const groups = await Promise.all(idsKey.split(',').map(async (value) => {
      const id = Number(value)
      try {
        const page = await getCreatorPosts(id, { size: POSTS_PER_CREATOR })
        return [id, page?.items ?? []]
      } catch {
        return [id, []]
      }
    }))
    const latestByCreator = new Map(groups.filter(([, items]) => items.length > 0).map(([id, items]) => [id, items[0]]))
    const posts = groups
      .flatMap(([, items]) => items)
      .toSorted((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return { latestByCreator, posts }
  }, [idsKey, memberId], { enabled: memberId != null && idsKey !== '' })

  return { ...(data ?? emptyNews), loading }
}
