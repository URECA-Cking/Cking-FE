import { getFollowPostNews } from '../api/follows.js'
import { buildFollowPostNews, pickCurrentFollowPostNews } from '../utils/followPostNews.js'
import { useAsync } from './useAsync.js'

/**
 * 팔로우한 크리에이터의 새 글 정보(unreadCreatorIds, latestPostAt). 홈에 들어올 때마다 다시 받아 스페이스에서 읽은 결과가 반영되게 캐시하지 않는다.
 * 조회 중이거나 실패하면, 또는 결과가 현재 회원·팔로우 구성과 다르면 비어 있어 NEW를 보여주지 않는다. NEW는 표시 힌트라서 실패를 따로 알리지 않는다.
 */
export function useFollowPostNews(memberId, followedCreators) {
  const idsKey = followedCreators.join(',')
  const { data, loading, error } = useAsync(
    async () => ({ memberId, idsKey, news: buildFollowPostNews(await getFollowPostNews()) }),
    [memberId, idsKey],
    { enabled: memberId != null && idsKey !== '' },
  )
  return pickCurrentFollowPostNews(data, { memberId, idsKey, loading, error })
}
