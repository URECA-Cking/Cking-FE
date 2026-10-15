import { apiClient } from './client.js'
import { getEvents } from './events.js'

// GET /api/me/winners - 현재 사용자의 공개된 당첨 내역
export async function getMyWinners() {
  return apiClient.get('/api/me/winners')
}

/**
 * 내 당첨 목록에 실제 이벤트 제목을 보강한다.
 * 당첨 API에는 제목이 없어 공개 이벤트 목록을 한 번만 함께 조회한다. 카드별 상세 조회는 하지 않는다.
 */
export async function loadMyWinners() {
  const [winnerResult, eventResult] = await Promise.all([
    getMyWinners(),
    getEvents({ size: 100 }).catch(() => null),
  ])
  const winners = winnerResult?.items ?? winnerResult ?? []
  const events = eventResult?.items ?? eventResult ?? []
  const eventById = new Map(events.map((event) => [event.eventId, event]))

  return { winners, eventById }
}

// POST /api/me/winners/{winnerId}/decline - 당첨 포기
export async function declineMyWinner(winnerId) {
  return apiClient.post(`/api/me/winners/${winnerId}/decline`)
}

// GET /api/winners/{winnerId}/history - 당첨 상태 변경 이력
export async function getWinnerHistory(winnerId) {
  return apiClient.get(`/api/winners/${winnerId}/history`)
}
