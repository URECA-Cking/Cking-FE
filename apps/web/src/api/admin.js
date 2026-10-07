import { apiClient } from './client';

// 관리자 전용 API. 백엔드는 Access JWT의 role이 ADMIN이 아니면 FORBIDDEN을 돌려준다.

// GET /api/admin/events/pending - 승인 대기 이벤트 목록
export async function getPendingEvents({ page = 0, size = 20 } = {}) {
  return apiClient.get('/api/admin/events/pending', { page, size });
}

// POST /api/admin/events/{eventId}/approve - 이벤트 승인(SCHEDULED)
export async function approveEvent(eventId) {
  return apiClient.post(`/api/admin/events/${eventId}/approve`);
}

// POST /api/admin/events/{eventId}/reject - 이벤트 거절(사유 필수)
export async function rejectEvent(eventId, rejectReason) {
  return apiClient.post(`/api/admin/events/${eventId}/reject`, { rejectReason });
}

// GET /api/admin/events/{eventId}/closing-status - 마감 상태 조회
export async function getClosingStatus(eventId) {
  return apiClient.get(`/api/admin/events/${eventId}/closing-status`);
}

// GET /api/admin/events/{eventId}/snapshot - 공식 스냅샷 조회
export async function getEventSnapshot(eventId) {
  return apiClient.get(`/api/admin/events/${eventId}/snapshot`);
}

// POST /api/admin/events/{eventId}/drawings - 초기 추첨 실행
export async function runInitialDrawing(eventId) {
  return apiClient.post(`/api/admin/events/${eventId}/drawings`);
}

// GET /api/admin/drawings/{drawingId} - 추첨 메타데이터 조회
export async function getDrawing(drawingId) {
  return apiClient.get(`/api/admin/drawings/${drawingId}`);
}

// GET /api/admin/drawings/{drawingId}/result - 추첨 당첨자(개인정보 포함) 조회
export async function getDrawingResult(drawingId) {
  return apiClient.get(`/api/admin/drawings/${drawingId}/result`);
}

// POST /api/admin/drawings/{drawingId}/publish - 완료 Drawing 결과 공개
export async function publishDrawing(drawingId) {
  return apiClient.post(`/api/admin/drawings/${drawingId}/publish`);
}

// POST /api/admin/drawings/{drawingId}/verify - 완료 Drawing 검증 실행
export async function verifyDrawing(drawingId) {
  return apiClient.post(`/api/admin/drawings/${drawingId}/verify`);
}

// GET /api/admin/drawings/{drawingId}/verification-history - 검증 이력
export async function getDrawingVerificationHistory(drawingId, { page = 0, size = 20 } = {}) {
  return apiClient.get(`/api/admin/drawings/${drawingId}/verification-history`, { page, size });
}

// POST /api/admin/winners/{winnerId}/receive - 당첨자 수령 완료 처리
export async function receiveWinner(winnerId) {
  return apiClient.post(`/api/admin/winners/${winnerId}/receive`)
}

// POST /api/admin/winners/{winnerId}/disqualify - 당첨자 자격 박탈
export async function disqualifyWinner(winnerId, reason) {
  return apiClient.post(`/api/admin/winners/${winnerId}/disqualify`, { reason })
}

// GET /api/winners/{winnerId}/history - 당첨 상태 이력
export async function getWinnerHistory(winnerId) {
  return apiClient.get(`/api/winners/${winnerId}/history`)
}

export async function createRedrawRequest(eventId, reason, idempotencyKey) {
  return apiClient.post(`/api/admin/events/${eventId}/redraw-requests`, { reason, idempotencyKey })
}

export async function getRedrawRequest(redrawRequestId) {
  return apiClient.get(`/api/admin/redraw-requests/${redrawRequestId}`)
}

export async function getDeadStreams({ status = 'UNRESOLVED', page = 0, size = 20 } = {}) {
  return apiClient.get('/api/admin/dead-streams', { status, page, size })
}

export async function replayDeadStream(deadStreamId) {
  return apiClient.post(`/api/admin/dead-streams/${deadStreamId}/replay`)
}

// GET /api/admin/creator-applications - 크리에이터 전환 신청 목록
export async function getCreatorApplications({ page = 0, size = 20 } = {}) {
  return apiClient.get('/api/admin/creator-applications', { page, size });
}

// POST /api/admin/creator-applications/{id}/approve - 신청 승인
export async function approveCreatorApplication(applicationId) {
  return apiClient.post(`/api/admin/creator-applications/${applicationId}/approve`);
}

// POST /api/admin/creator-applications/{id}/reject - 신청 거절(사유 필수)
export async function rejectCreatorApplication(applicationId, rejectReason) {
  return apiClient.post(`/api/admin/creator-applications/${applicationId}/reject`, { rejectReason });
}
