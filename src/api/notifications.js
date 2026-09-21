import { apiClient } from './client';

// GET /api/me/notifications - 알림 목록(페이지네이션)
export async function getMyNotifications(userId, { page = 0, size = 20 } = {}) {
  return apiClient.get('/api/me/notifications', { userId, page, size });
}

// PATCH /api/me/notifications/{notificationId}/read - 알림 읽음 처리
export async function readNotification(notificationId, userId) {
  return apiClient.patch(`/api/me/notifications/${notificationId}/read`, { userId });
}
