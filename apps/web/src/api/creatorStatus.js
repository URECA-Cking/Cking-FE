import { apiClient } from './client.js'

/** Creator 본인에게 공개할 자격 상태와 안내를 읽는다. */
export function getMyCreatorStatus() {
  return apiClient.get('/api/creator/me/status')
}
