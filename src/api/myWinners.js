import { apiClient } from './client.js'

// GET /api/me/winners - 현재 사용자의 공개된 당첨 내역
export async function getMyWinners(userId) {
  return apiClient.get('/api/me/winners', { userId })
}

// POST /api/me/winners/{winnerId}/decline - 당첨 포기
export async function declineMyWinner(winnerId, userId) {
  return apiClient.post(`/api/me/winners/${winnerId}/decline`, { userId })
}

// GET /api/winners/{winnerId}/history - 당첨 상태 변경 이력
export async function getWinnerHistory(winnerId, userId) {
  return apiClient.get(`/api/winners/${winnerId}/history`, { userId })
}
