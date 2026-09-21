import { getEvents } from './events';
import { getTicketBalance } from './tickets';
import { getCreatorProfile } from '../data/creatorProfiles.js';

// 백엔드는 크리에이터 목록 API를 제공하지만, 현재 화면은 아직 이를 연동하지 않아 실제로 존재하는 크리에이터를
// "이벤트 목록에 등장하는 creatorId"로 알아낸다. 아직 이벤트가 하나도 없는 초기 상태에서도
// 화면이 비지 않도록 .env의 VITE_DEMO_CREATOR_IDS(기본 1,2,3 - BE 더미 시더 기준)를 함께 본다.

const FALLBACK_IDS = String(import.meta.env.VITE_DEMO_CREATOR_IDS ?? '1,2,3')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);

/**
 * 이벤트 목록을 한 번 읽어 크리에이터별로 묶고, 로그인한 사용자의 응모권 잔액을 붙인다.
 * @param {number|null} userId 잔액 조회에 쓸 사용자. 없으면 잔액은 null로 둔다.
 */
export async function loadCreatorDirectory(userId, { size = 100 } = {}) {
  const page = await getEvents({ size });
  const events = page?.items ?? [];

  const byCreator = new Map();
  FALLBACK_IDS.forEach((creatorId) => byCreator.set(creatorId, []));
  events.forEach((event) => {
    const list = byCreator.get(event.creatorId) ?? [];
    list.push(event);
    byCreator.set(event.creatorId, list);
  });

  const creatorIds = [...byCreator.keys()].sort((a, b) => a - b);
  const balances = await Promise.all(
    creatorIds.map(async (creatorId) => {
      if (!userId) return null;
      try {
        return await getTicketBalance(creatorId, userId);
      } catch {
        // 잔액 조회 실패가 목록 전체를 막지 않게 한다.
        return null;
      }
    })
  );

  const creators = creatorIds.map((creatorId, index) => {
    const creatorEvents = byCreator.get(creatorId) ?? [];
    return {
      ...getCreatorProfile(creatorId),
      creatorId,
      balance: balances[index]?.balance ?? 0,
      balanceUpdatedAt: balances[index]?.updatedAt ?? null,
      events: creatorEvents,
      openEventCount: creatorEvents.filter((event) => event.displayStatus === 'IN_PROGRESS').length,
    };
  });

  return { creators, events };
}

/** 크리에이터 한 명의 프로필 + 잔액 + 이벤트를 모은다(크리에이터 스페이스 화면용). */
export async function loadCreatorSpace(creatorId, userId) {
  const [eventsPage, balance] = await Promise.all([
    getEvents({ creatorId, size: 50 }),
    userId ? getTicketBalance(creatorId, userId).catch(() => null) : Promise.resolve(null),
  ]);

  return {
    ...getCreatorProfile(creatorId),
    creatorId: Number(creatorId),
    balance: balance?.balance ?? 0,
    balanceUpdatedAt: balance?.updatedAt ?? null,
    events: eventsPage?.items ?? [],
  };
}
