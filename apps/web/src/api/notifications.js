import { apiClient } from './client';

/** GET /api/me/notifications에서 지정한 페이지의 알림을 조회한다. */
export async function getMyNotifications({ page = 0, size = 20 } = {}) {
  const result = await apiClient.get('/api/me/notifications', { page, size });
  if (!Array.isArray(result?.items) || typeof result.hasNext !== 'boolean') {
    throw new Error('알림 목록 응답 형식이 올바르지 않습니다.');
  }
  return result;
}

/** PATCH /api/me/notifications/{notificationId}/read로 알림 하나를 읽음 처리한다. */
export async function readNotification(notificationId) {
  return apiClient.patch(`/api/me/notifications/${notificationId}/read`);
}

/** PATCH /api/me/notifications/read로 현재 사용자의 모든 미확인 알림을 읽음 처리한다. */
export async function readAllNotifications() {
  return apiClient.patch('/api/me/notifications/read');
}
