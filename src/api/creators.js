import { getEvents } from './events';
import { getTicketBalance } from './tickets';
import { getCreatorProfile } from '../data/creatorProfiles.js';
import { getCreatorSpace, getCreatorSpaceBySlug } from './creatorSpace';

// 백엔드에 크리에이터 목록 API(GET /api/creators)가 아직 구현되지 않아, 실제로 존재하는 크리에이터를
// "이벤트 목록에 등장하는 creatorId"로 알아낸다. 아직 이벤트가 하나도 없는 초기 상태에서도
// 화면이 비지 않도록 .env의 VITE_DEMO_CREATOR_IDS(기본 1,2,3 - BE 더미 시더 기준)를 함께 본다.

const FALLBACK_IDS = String(import.meta.env.VITE_DEMO_CREATOR_IDS ?? '1,2,3')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);

/**
 * 이벤트 목록을 한 번 읽어 크리에이터별로 묶고, 로그인한 사용자의 응모권 잔액을 붙인다.
 */
export async function loadCreatorDirectory({ size = 100 } = {}) {
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
      try {
        return await getTicketBalance(creatorId);
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

/**
 * 크리에이터 스페이스 화면의 공개 데이터를 모은다. 프로필(이름·소개·이미지·slug)은 Creator Space API,
 * 이벤트는 이벤트 목록 API에서 가져온다. 둘 다 인증 없이 조회할 수 있어 공유 링크로 들어온 비로그인
 * 사용자도 볼 수 있다. 응모권 잔액·미션처럼 인증이 필요한 데이터는 화면이 로그인 상태일 때만 따로 조회한다.
 * @param {{ creatorId?: string|number, slug?: string }} key 앱 안 이동은 creatorId, 공유 링크는 slug
 */
export async function loadCreatorSpace({ creatorId, slug }) {
  const space = slug ? await getCreatorSpaceBySlug(slug) : await getCreatorSpace(creatorId);
  const eventsPage = await getEvents({ creatorId: space.creatorId, size: 50 });
  return { ...space, events: eventsPage?.items ?? [] };
}
