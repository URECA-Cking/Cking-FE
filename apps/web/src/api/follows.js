import { apiClient } from './client.js'

const followPath = (creatorId) => `/api/creators/${creatorId}/follow`

export async function getAllFollows() {
  const ids = new Set()
  let page = 0
  while (true) {
    const result = await apiClient.get('/api/me/follows', { page, size: 100 })
    for (const item of result.items ?? []) ids.add(Number(item.creatorId))
    if (!result.hasNext) return [...ids]
    page += 1
  }
}

export function followCreator(creatorId) {
  return apiClient.put(followPath(creatorId))
}

export function unfollowCreator(creatorId) {
  return apiClient.delete(followPath(creatorId))
}

/** 팔로우한 크리에이터별로 읽지 않은 새 글이 있는지 한 번에 받는다. [{ creatorId, hasUnreadPosts, latestPostCreatedAt }] */
export async function getFollowPostNews() {
  const result = await apiClient.get('/api/me/follows/post-news')
  return result?.items ?? []
}

/** 팔로우 중인 크리에이터의 스페이스·글을 열었다고 서버에 알려 읽음 시각을 기록한다. */
export function markCreatorPostsRead(creatorId) {
  return apiClient.put(`/api/creators/${creatorId}/posts/read`)
}
