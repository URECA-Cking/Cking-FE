import { apiClient } from './client';

// 크리에이터 운영(이벤트 CRUD·승인 요청) API. 호출자는 Access JWT로 식별하며, Creator가 아니면 FORBIDDEN이다.

// GET /api/creator/events - 내가 만든 이벤트 목록
export async function getMyCreatorEvents({ page = 0, size = 20 } = {}) {
  return apiClient.get('/api/creator/events', { page, size });
}

// 수정 화면처럼 한 건을 찾으려고 내 이벤트를 끝까지 읽는다(단건 조회 API가 없다). 응답의 hasNext가 false가 될 때까지 이어 읽는다.
export async function getAllMyCreatorEvents() {
  const items = [];
  for (let page = 0; ; page += 1) {
    const result = await getMyCreatorEvents({ page, size: 100 });
    items.push(...(result.items ?? []));
    if (!result.hasNext) return items;
  }
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
