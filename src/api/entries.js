import { requestEnvelope, apiClient } from './client';

/**
 * POST /api/events/{eventId}/entries - 이벤트 응모 신청
 * 성공 코드가 반드시 "SUCCESS"만은 아닐 수 있어(중복 처리 등) apiClient가 아닌
 * requestEnvelope를 직접 사용해 envelope 전체(ok, code, message)를 그대로 반환한다.
 */
export async function applyEntry(eventId, { userId, requestId, ticketCount }) {
  return requestEnvelope(`/api/events/${eventId}/entries`, {
    method: 'POST',
    body: { userId, requestId, ticketCount },
  });
}

// GET /api/events/{eventId}/entries/me - 내 응모 내역(커서 페이지네이션)
export async function getMyEntries(eventId, userId, { size = 20, cursor } = {}) {
  return apiClient.get(`/api/events/${eventId}/entries/me`, { userId, size, cursor });
}
