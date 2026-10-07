import { apiClient } from './client';

// POST /api/creator/applications - 크리에이터 전환 신청
export async function applyCreator() {
  return apiClient.post('/api/creator/applications');
}

// GET /api/creator/applications/me - 내 크리에이터 신청 내역(페이지네이션)
export async function getMyCreatorApplications({ page = 0, size = 20 } = {}) {
  return apiClient.get('/api/creator/applications/me', { page, size });
}
