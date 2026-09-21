import { getEvents } from './events';
import { getTicketHistory } from './tickets';
import { getPublicWinners } from './winners';

// 백엔드에 "내 응모 목록" 단일 API가 없다(docs/api-index.md의 GET /api/events/{id}/entries/me 는
// 아직 컨트롤러가 없다). 대신 응모할 때마다 기록되는 응모권 원장(SPEND)에 eventId가 남으므로,
// 크리에이터별 원장을 모아 이벤트 단위로 묶으면 실제 응모 내역을 그대로 재구성할 수 있다.

const LEDGER_PAGE_SIZE = 100;

/** 한 크리에이터의 원장을 최대 maxPages까지 따라가며 모은다. */
async function collectLedger(creatorId, userId, maxPages = 3) {
  const items = [];
  let cursor;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await getTicketHistory(creatorId, userId, { size: LEDGER_PAGE_SIZE, cursor });
    items.push(...(result.items ?? []));
    if (!result.hasNext || !result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return items;
}

/**
 * 내 응모 내역을 이벤트 단위로 모은다.
 * @returns {Promise<{entries: Array, totalSpent: number}>}
 */
export async function loadMyEntries(userId) {
  const eventPage = await getEvents({ size: 100 });
  const events = eventPage?.items ?? [];

  const eventById = new Map(events.map((event) => [event.eventId, event]));
  const creatorIds = [...new Set(events.map((event) => event.creatorId))];

  const ledgers = await Promise.all(
    creatorIds.map((creatorId) => collectLedger(creatorId, userId).catch(() => [])),
  );

  const byEvent = new Map();
  ledgers.flat().forEach((item) => {
    if (item.type !== 'SPEND' || !item.eventId) return;
    const current = byEvent.get(item.eventId) ?? { eventId: item.eventId, ticketCount: 0, entryCount: 0, lastAt: null };
    current.ticketCount += Math.abs(Number(item.deltaAmount) || 0);
    current.entryCount += 1;
    if (!current.lastAt || new Date(item.createdAt) > new Date(current.lastAt)) current.lastAt = item.createdAt;
    byEvent.set(item.eventId, current);
  });

  const entries = [...byEvent.values()].map((entry) => ({
    ...entry,
    event: eventById.get(entry.eventId) ?? null,
  }));

  // 결과가 공개된 이벤트만 당첨자를 조회해 내 당첨 여부를 붙인다.
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.event?.status !== 'PUBLISHED') return;
      try {
        const result = await getPublicWinners(entry.eventId);
        const winners = result?.winners ?? [];
        entry.published = true;
        entry.winnerCount = winners.length;
        entry.myWin = winners.find((winner) => winner.userId === userId) ?? null;
      } catch {
        // 아직 공개되지 않았거나 조회에 실패해도 응모 내역 자체는 보여준다.
        entry.published = false;
      }
    }),
  );

  entries.sort((a, b) => new Date(b.lastAt ?? 0) - new Date(a.lastAt ?? 0));

  return {
    entries,
    totalSpent: entries.reduce((sum, entry) => sum + entry.ticketCount, 0),
  };
}
