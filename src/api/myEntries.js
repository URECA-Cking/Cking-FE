import { apiClient } from './client';
import { getEvents } from './events';
import { getMyWinners } from './myWinners';

const ENTRY_PAGE_SIZE = 100;

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

export async function loadMyEntries(userId) {
  const eventPage = await getEvents({ size: 100 });
  const events = eventPage?.items ?? [];
  const [entryGroups, winnerResult] = await Promise.all([
    Promise.all(events.map(async (event) => ({
      event,
      items: await collectEntries(event.eventId, userId).catch(() => []),
    }))),
    getMyWinners(userId).catch(() => []),
  ]);

  const winners = winnerResult?.items ?? winnerResult ?? [];
  const winnerByEventId = new Map(winners.map((winner) => [winner.eventId, winner]));
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
    }))
    .sort((a, b) => new Date(b.lastAt ?? 0) - new Date(a.lastAt ?? 0));

  return {
    entries,
    totalSpent: entries.reduce((sum, entry) => sum + entry.ticketCount, 0),
  };
}
