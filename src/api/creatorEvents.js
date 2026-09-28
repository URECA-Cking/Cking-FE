import { apiClient } from './client';

// 크리에이터 운영(이벤트 CRUD·승인 요청) API. 호출자는 Access JWT로 식별하며, Creator가 아니면 FORBIDDEN이다.

// GET /api/creator/events - 내가 만든 이벤트 목록
export async function getMyCreatorEvents({ page = 0, size = 20 } = {}) {
  return apiClient.get('/api/creator/events', { page, size });
}

// POST /api/creator/events - 이벤트 생성(requestId 멱등)
export async function createCreatorEvent(payload) {
  return apiClient.post('/api/creator/events', payload);
}

// PATCH /api/creator/events/{eventId} - 초안 이벤트 수정
export async function updateCreatorEvent(eventId, payload) {
  return apiClient.patch(`/api/creator/events/${eventId}`, payload);
}

// DELETE /api/creator/events/{eventId} - 초안 이벤트 논리 삭제
export async function deleteCreatorEvent(eventId) {
  return apiClient.delete(`/api/creator/events/${eventId}`);
}

// POST /api/creator/events/{eventId}/approval-request - 관리자 승인 요청
export async function requestEventApproval(eventId) {
  return apiClient.post(`/api/creator/events/${eventId}/approval-request`);
}
