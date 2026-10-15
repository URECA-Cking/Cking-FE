import { apiClient } from './client.js'
import { getEvents } from './events.js'

// GET /api/me/winners - 현재 사용자의 공개된 당첨 내역
export async function getMyWinners() {
  return apiClient.get('/api/me/winners')
}

/** 당첨 목록은 이벤트 목록과 무관하게 먼저 표시한다. */
export async function loadMyWinners() {
  const result = await getMyWinners()
  return result?.items ?? result ?? []
}

/**
 * 카드 제목을 보강할 공개 이벤트 목록이다.
 * 이 조회가 실패하거나 지연돼도 당첨 목록은 eventId fallback으로 표시한다.
 */
export async function loadWinnerEventCatalog() {
  try {
    const result = await getEvents({ size: 100 })
    const events = result?.items ?? result ?? []
    return new Map(events.map((event) => [event.eventId, event]))
  } catch {
    return new Map()
  }
}

// POST /api/me/winners/{winnerId}/decline - 당첨 포기
export async function declineMyWinner(winnerId) {
  return apiClient.post(`/api/me/winners/${winnerId}/decline`)
}

// GET /api/winners/{winnerId}/history - 당첨 상태 변경 이력
export async function getWinnerHistory(winnerId) {
  return apiClient.get(`/api/winners/${winnerId}/history`)
}
