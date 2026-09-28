import { apiClient } from './client';

// GET /api/creators/{creatorId}/tickets - 응모권 잔액 조회
export async function getTicketBalance(creatorId) {
  return apiClient.get(`/api/creators/${creatorId}/tickets`);
}

// GET /api/creators/{creatorId}/tickets/history - 응모권 적립/사용 이력(커서 페이지네이션)
export async function getTicketHistory(creatorId, { size = 20, cursor } = {}) {
  return apiClient.get(`/api/creators/${creatorId}/tickets/history`, { size, cursor });
}
