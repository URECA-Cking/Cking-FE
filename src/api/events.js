import { apiClient } from './client';

/** 이벤트 목록 조회용 표시 상태(백엔드 DisplayStatus). */
export const DISPLAY_STATUS = {
  UPCOMING: 'UPCOMING',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED',
};

// GET /api/events - 이벤트 목록(페이지네이션, creatorId·status 필터)
export async function getEvents({ creatorId, status, page = 0, size = 20 } = {}) {
  return apiClient.get('/api/events', { creatorId, status, page, size });
}

// GET /api/events/{eventId} - 이벤트 상세 (userId 기준 내 응모권 잔액 포함)
export async function getEvent(eventId, userId) {
  return apiClient.get(`/api/events/${eventId}`, { userId });
}

// POST /api/events/{eventId}/close - 수동 마감 요청 (크리에이터 또는 관리자)
export async function closeEvent(eventId, userId) {
  return apiClient.post(`/api/events/${eventId}/close`, { userId });
}
