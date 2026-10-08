import { apiClient } from './client';

// GET /api/creators/{creatorId}/tickets - 응모권 잔액 조회
export async function getTicketBalance(creatorId) {
  return apiClient.get(`/api/creators/${creatorId}/tickets`);
}

// GET /api/creators/{creatorId}/tickets/history - 응모권 적립/사용 이력(커서 페이지네이션)
export async function getTicketHistory(creatorId, { size = 20, cursor } = {}) {
  return apiClient.get(`/api/creators/${creatorId}/tickets/history`, { size, cursor });
}

// GET /api/tickets/common/history - 공용 응모권 적립/사용 이력(커서 페이지네이션). 출석 도장은 여기 남은 출석 적립 기록으로 그린다.
export async function getCommonTicketHistory({ size = 20, cursor } = {}) {
  return apiClient.get('/api/tickets/common/history', { size, cursor });
}

/**
 * GET /api/tickets/common/history - sinceMs 이후의 공용 원장 항목을 커서로 이어 받아 모은다.
 * 원장은 createdAt 내림차순이라 가장 오래된 항목이 기준 시각보다 앞서면 더 받지 않는다.
 * 거래가 많아도 필요한 기간이 잘리지 않게 하되, 비정상적으로 긴 이력은 maxPages에서 멈춘다.
 * 반환 형태는 getCommonTicketHistory와 같은 { items }.
 */
export async function getCommonTicketHistorySince(sinceMs, { size = 100, maxPages = 10 } = {}) {
  const items = [];
  let cursor;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await getCommonTicketHistory({ size, cursor });
    const pageItems = result?.items ?? [];
    items.push(...pageItems);
    const oldest = pageItems.at(-1);
    const reachedStart = oldest && new Date(oldest.createdAt).getTime() < sinceMs;
    if (!result?.hasNext || !result.nextCursor || reachedStart) break;
    cursor = result.nextCursor;
  }
  return { items };
}
