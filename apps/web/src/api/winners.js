import { apiClient } from './client';

// GET /api/events/{eventId}/winners - 공개 당첨자 목록 (인증 불필요)
export async function getPublicWinners(eventId) {
  return apiClient.get(`/api/events/${eventId}/winners`);
}
