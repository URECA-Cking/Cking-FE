import { apiClient } from './client';

// GET /api/users - 가상(데모) 사용자 목록 조회
export async function getUsers() {
  const data = await apiClient.get('/api/users');
  return data?.items ?? [];
}

// POST /api/demo/users/select - 데모 사용자 선택(로그인 대체)
export async function selectUser(userId) {
  return apiClient.post('/api/demo/users/select', { userId });
}
