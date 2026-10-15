import { apiClient } from './client';

/** GET /api/me/notifications에서 지정한 페이지의 알림을 조회한다. */
export async function getMyNotifications({ page = 0, size = 20 } = {}) {
  return apiClient.get('/api/me/notifications', { page, size });
}

/** 전체 페이지를 조회해 헤더 배지에 사용할 알림 목록을 모은다. */
export async function getAllMyNotifications() {
  const items = [];
  let page = 0;
  let hasNext = true;

  while (hasNext) {
    const result = await getMyNotifications({ page, size: 100 });
    items.push(...result.items);
    hasNext = result.hasNext;
    page += 1;
  }

  return { items };
}

/** PATCH /api/me/notifications/{notificationId}/read로 알림 하나를 읽음 처리한다. */
export async function readNotification(notificationId) {
  return apiClient.patch(`/api/me/notifications/${notificationId}/read`);
}

/** PATCH /api/me/notifications/read로 현재 사용자의 모든 미확인 알림을 읽음 처리한다. */
export async function readAllNotifications() {
  return apiClient.patch('/api/me/notifications/read');
}
