import { ApiError, apiClient } from './client';
import { describeCreatorWriteError } from './creatorProfile.js';

// 크리에이터 운영(이벤트 CRUD·승인 요청) API. 호출자는 Access JWT로 식별하며, Creator가 아니면 FORBIDDEN이다.
// 배너는 Cking-BE docs/domains/event/banner-api.md를 따른다. 응답의 bannerImageUrl은 배너가 없으면 null이다.

// POST /api/creator/events/banner-images - 배너 이미지 1장 업로드 → { imageKey }.
// 생성·수정의 bannerImageKey로 연결하며, 24시간 안에 연결하지 않으면 서버가 지운다.
export function uploadEventBannerImage(file) {
  const form = new FormData();
  form.append('image', file);
  return apiClient.post('/api/creator/events/banner-images', form);
}

/** 이벤트 배너 업로드·이벤트 저장 오류 코드별 문구. 그 밖의 오류는 기존 이벤트 저장 문구 규칙(활동명 미설정 안내 등)을 따른다. */
export const EVENT_BANNER_ERROR_MESSAGES = {
  INVALID_EVENT_BANNER_IMAGE: '배너 이미지를 사용할 수 없어요. JPEG·PNG, 5MB 이하, 600×200px 이상인지 확인하고 배너를 다시 올려주세요.',
  UPLOAD_TOO_LARGE: '이미지가 너무 커요. 5MB 이하 이미지를 올려주세요.',
  IMAGE_PROCESSING_BUSY: '지금 사진을 처리하는 요청이 많아요. 잠시 뒤에 다시 시도해주세요.',
  // 응답을 받지 못한 첫 저장이 실제로는 반영된 뒤 내용(배너 등)을 바꿔 다시 저장하면 같은 requestId라 BE가 거절한다.
  // requestId를 새로 만들면 이벤트가 두 개 생길 수 있어, 목록에서 확인하도록 안내한다.
  IDEMPOTENCY_CONFLICT: '이 이벤트는 이미 저장됐을 수 있어요. 내 이벤트 목록에서 확인한 뒤 필요하면 수정해주세요.',
};

export function describeEventBannerError(error, fallback) {
  if (error instanceof ApiError && EVENT_BANNER_ERROR_MESSAGES[error.code]) return EVENT_BANNER_ERROR_MESSAGES[error.code];
  return describeCreatorWriteError(error, fallback);
}

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
