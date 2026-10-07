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
