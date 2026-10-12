import { apiClient } from './client';

// GET /api/events - 이벤트 목록(페이지네이션, creatorId·status 필터)
export async function getEvents({ creatorId, status, page = 0, size = 20 } = {}) {
  return apiClient.get('/api/events', { creatorId, status, page, size });
}

// GET /api/events/{eventId} - 이벤트 상세 (로그인 사용자의 응모권 잔액 포함)
export async function getEvent(eventId) {
  return apiClient.get(`/api/events/${eventId}`);
}

// POST /api/events/{eventId}/close - 수동 마감 요청 (크리에이터 또는 관리자)
export async function closeEvent(eventId) {
  return apiClient.post(`/api/events/${eventId}/close`);
}

/**
 * GET /api/events?status=IN_PROGRESS - 진행 중 이벤트를 모두 모은다.
 * 목록은 createdAt 내림차순이라 마감 임박순을 만들려면 일부만 받아서는 안 되므로 hasNext가 끝날 때까지 이어 받는다.
 * 비정상적으로 많아도 무한히 돌지 않게 maxPages에서 멈춘다.
 * @returns {Promise<object[]>}
 */
export async function getInProgressEvents({ size = 100, maxPages = 10 } = {}) {
  const items = [];
  for (let page = 0; page < maxPages; page += 1) {
    const result = await getEvents({ status: 'IN_PROGRESS', page, size });
    items.push(...(result?.items ?? []));
    if (!result?.hasNext) break;
  }
  return items;
}
