/** post-news 응답 항목을 화면용으로 바꾼다. unreadCreatorIds: 읽지 않은 새 글이 있는 크리에이터, latestPostAt: 크리에이터별 최신 글 시각(ms). */
export function buildFollowPostNews(items) {
  return {
    unreadCreatorIds: new Set(items.filter((item) => item.hasUnreadPosts).map((item) => Number(item.creatorId))),
    latestPostAt: new Map(items.filter((item) => item.latestPostCreatedAt).map((item) => [Number(item.creatorId), Date.parse(item.latestPostCreatedAt)])),
  }
}

export const EMPTY_FOLLOW_POST_NEWS = { unreadCreatorIds: new Set(), latestPostAt: new Map() }

/**
 * 지금 화면에 써도 되는 새 글 정보만 고른다. 조회 중·실패이거나 결과가 다른 회원·다른 팔로우 구성의 것이면 비어 있는 값을 준다.
 * useAsync는 실패해도 이전 성공 값을 들고 있고 조건이 바뀌어도 바로 비우지 않아, 그대로 쓰면 지난 NEW가 남는다.
 */
export function pickCurrentFollowPostNews(result, { memberId, idsKey, loading, error }) {
  if (loading || error || result == null) return EMPTY_FOLLOW_POST_NEWS
  if (result.memberId !== memberId || result.idsKey !== idsKey) return EMPTY_FOLLOW_POST_NEWS
  return result.news
}

/**
 * 최신 글이 있는 크리에이터를 앞으로, 나머지는 기존 순서를 유지한다.
 * 글 목록은 일부 크리에이터만 가져오므로 팔로우 전체의 최신 글 시각(latestPostAt)과 비교해 더 늦은 쪽을 쓴다.
 */
export function sortCreatorsByLatestPost(creators, latestByCreator, latestPostAt) {
  const timeOf = (creator) => {
    const fromPosts = new Date(latestByCreator.get(creator.creatorId)?.createdAt).getTime()
    return Math.max(Number.isFinite(fromPosts) ? fromPosts : 0, latestPostAt.get(creator.creatorId) ?? 0)
  }
  return [...creators].sort((a, b) => timeOf(b) - timeOf(a))
}
