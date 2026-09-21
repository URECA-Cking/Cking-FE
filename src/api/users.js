import { apiGet, apiPost } from './http'

export function getUsers(signal) {
  return apiGet('/users', signal)
}

export function selectUser(userId) {
  return apiPost('/demo/users/select', { userId })
}
