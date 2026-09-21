import { apiClient } from './client';

// 관리자 전용 API. 백엔드는 MemberRole.ADMIN 이 아닌 userId에 대해 FORBIDDEN을 돌려준다.

// GET /api/admin/events/pending - 승인 대기 이벤트 목록
export async function getPendingEvents(userId, { page = 0, size = 20 } = {}) {
  return apiClient.get('/api/admin/events/pending', { userId, page, size });
}

// POST /api/admin/events/{eventId}/approve - 이벤트 승인(SCHEDULED)
export async function approveEvent(eventId, userId) {
  return apiClient.post(`/api/admin/events/${eventId}/approve`, { userId });
}

// POST /api/admin/events/{eventId}/reject - 이벤트 거절(사유 필수)
export async function rejectEvent(eventId, userId, rejectReason) {
  return apiClient.post(`/api/admin/events/${eventId}/reject`, { userId, rejectReason });
}

// GET /api/admin/events/{eventId}/closing-status - 마감 상태 조회
export async function getClosingStatus(eventId, userId) {
  return apiClient.get(`/api/admin/events/${eventId}/closing-status`, { userId });
}

// GET /api/admin/events/{eventId}/snapshot - 공식 스냅샷 조회
export async function getEventSnapshot(eventId, userId) {
  return apiClient.get(`/api/admin/events/${eventId}/snapshot`, { userId });
}

// POST /api/admin/events/{eventId}/drawings - 초기 추첨 실행
export async function runInitialDrawing(eventId, userId) {
  return apiClient.post(`/api/admin/events/${eventId}/drawings`, { userId });
}

// GET /api/admin/drawings/{drawingId} - 추첨 메타데이터 조회
export async function getDrawing(drawingId, userId) {
  return apiClient.get(`/api/admin/drawings/${drawingId}`, { userId });
}

// GET /api/admin/drawings/{drawingId}/result - 추첨 당첨자(개인정보 포함) 조회
export async function getDrawingResult(drawingId, userId) {
  return apiClient.get(`/api/admin/drawings/${drawingId}/result`, { userId });
}

// GET /api/admin/creator-applications - 크리에이터 전환 신청 목록
export async function getCreatorApplications(userId, { page = 0, size = 20 } = {}) {
  return apiClient.get('/api/admin/creator-applications', { userId, page, size });
}

// POST /api/admin/creator-applications/{id}/approve - 신청 승인
export async function approveCreatorApplication(applicationId, userId) {
  return apiClient.post(`/api/admin/creator-applications/${applicationId}/approve`, { userId });
}

// POST /api/admin/creator-applications/{id}/reject - 신청 거절(사유 필수)
export async function rejectCreatorApplication(applicationId, userId, rejectReason) {
  return apiClient.post(`/api/admin/creator-applications/${applicationId}/reject`, { userId, rejectReason });
}
