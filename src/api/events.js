import { apiClient } from './client';

// GET /api/events - 이벤트 목록(페이지네이션)
export async function getEvents({ creatorId, status, page = 0, size = 20 } = {}) {
  return apiClient.get('/api/events', { creatorId, status, page, size });
}

// GET /api/events/{eventId} - 이벤트 상세 (userId 기준 내 응모권 잔액 포함)
export async function getEvent(eventId, userId) {
  return apiClient.get(`/api/events/${eventId}`, { userId });
}
