import { apiClient } from './client';
import { getEvents } from './events';
import { getMyWinners } from './myWinners';

const ENTRY_PAGE_SIZE = 100;
// 이벤트 수가 늘어나도 한 번에 수백 개 요청이 동시에 나가지 않도록 동시 조회 개수를 제한한다.
// 사용자 기준 통합 응모 내역 API가 없어 이벤트별 조회를 수행한다.
// 총 요청 수는 그대로지만 한꺼번에 열리는 연결 수를 낮춘다.
const ENTRY_FETCH_CONCURRENCY = 6;

export async function getMyEventEntries(eventId, userId, { size = ENTRY_PAGE_SIZE, cursor } = {}) {
  return apiClient.get(`/api/events/${eventId}/entries/me`, { userId, size, cursor });
}

async function collectEntries(eventId, userId, maxPages = 3) {
  const items = [];
  let cursor;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await getMyEventEntries(eventId, userId, { size: ENTRY_PAGE_SIZE, cursor });
    items.push(...(result.items ?? []));
    if (!result.hasNext || !result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return items;
}

/** items를 concurrency개씩만 동시에 처리한다(전체 요청 수는 그대로, 동시 연결 수만 제한). */
async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function loadMyEntries(userId) {
  const eventPage = await getEvents({ size: 100 });
  const events = eventPage?.items ?? [];

  let winnersFailed = false;
  const [entryGroups, winnerResult] = await Promise.all([
    mapWithConcurrency(events, ENTRY_FETCH_CONCURRENCY, async (event) => {
      try {
        return { event, items: await collectEntries(event.eventId, userId), failed: false };
      } catch {
        // 조회 실패를 "응모 없음"과 구분해서, 실제 실패 건수를 화면에 알릴 수 있게 한다.
        return { event, items: [], failed: true };
      }
    }),
    getMyWinners(userId).catch(() => {
      winnersFailed = true;
      return [];
    }),
  ]);

  const winners = winnerResult?.items ?? winnerResult ?? [];
  const winnerByEventId = new Map(winners.map((winner) => [winner.eventId, winner]));
  const failedEventCount = entryGroups.filter((group) => group.failed).length;

  const entries = entryGroups
    .filter(({ items }) => items.length > 0)
    .map(({ event, items }) => ({
      eventId: event.eventId,
      event,
      ticketCount: items.reduce((sum, item) => sum + (Number(item.usedTicketCount) || 0), 0),
      entryCount: items.length,
      lastAt: items[0]?.appliedAt ?? null,
      published: event.status === 'PUBLISHED',
      myWin: winnerByEventId.get(event.eventId) ?? null,
      // 당첨자 조회 자체가 실패하면 "미당첨"이 아니라 "확인 불가"로 구분해서 보여준다.
      winUnknown: winnersFailed && event.status === 'PUBLISHED',
    }))
    .sort((a, b) => new Date(b.lastAt ?? 0) - new Date(a.lastAt ?? 0));

  return {
    entries,
    totalSpent: entries.reduce((sum, entry) => sum + entry.ticketCount, 0),
    failedEventCount,
    winnersFailed,
  };
}
