import { apiClient } from './client.js'

// GET /api/me/winners - 현재 사용자의 공개된 당첨 내역
export async function getMyWinners() {
  return apiClient.get('/api/me/winners')
}

// POST /api/me/winners/{winnerId}/decline - 당첨 포기
export async function declineMyWinner(winnerId) {
  return apiClient.post(`/api/me/winners/${winnerId}/decline`)
}

// GET /api/winners/{winnerId}/history - 당첨 상태 변경 이력
export async function getWinnerHistory(winnerId) {
  return apiClient.get(`/api/winners/${winnerId}/history`)
}
