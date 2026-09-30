import { apiClient } from './client.js'

const postPath = (creatorId) => `/api/creators/${creatorId}/posts`

export function getCreatorPosts(creatorId, { page = 0, size = 20 } = {}) {
  return apiClient.get(postPath(creatorId), { page, size })
}

export function getCreatorPost(creatorId, postId) {
  return apiClient.get(`${postPath(creatorId)}/${postId}`)
}
