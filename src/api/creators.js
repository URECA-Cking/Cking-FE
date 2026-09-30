import { getEvents } from './events';
import { apiClient } from './client';
import { getCreatorSpace, getCreatorSpaceBySlug } from './creatorSpace';

function toProfile(space) {
  return {
    creatorId: space.creatorId,
    name: space.creatorName,
    handle: space.slug,
    avatar: space.profileImageUrl,
    banner: space.bannerImageUrl,
    bio: space.introText,
    verified: true,
  };
}

let creatorCatalogPromise = null;

/** 공개 Creator 목록의 모든 페이지를 읽고 요청 결과를 화면 간에 공유한다. */
export function getCreatorCatalog() {
  if (!creatorCatalogPromise) {
    creatorCatalogPromise = (async () => {
      const creators = new Map();
      let page = 0;
      while (true) {
        const result = await apiClient.get('/api/creators', { page, size: 100 });
        result.items.forEach((item) => creators.set(item.creatorId, toProfile(item)));
        if (!result.hasNext) return [...creators.values()];
        page += 1;
      }
    })().catch((error) => {
      creatorCatalogPromise = null;
      throw error;
    });
  }
  return creatorCatalogPromise;
}

export async function getCreatorProfileById(creatorId) {
  const id = Number(creatorId);
  try {
    const creators = await getCreatorCatalog();
    const profile = creators.find((creator) => creator.creatorId === id);
    if (profile) return profile;
  } catch {
    // 목록 조회가 실패해도 이벤트 카드에서는 공개 Space로 프로필을 조회한다.
  }
  return toProfile(await getCreatorSpace(id));
}

/** 공개 Creator 목록과 이벤트만 조합한다. 응모권 잔액은 화면에서 필요한 ID만 조회한다. */
export async function loadCreatorDirectory({ size = 100 } = {}) {
  const profiles = await getCreatorCatalog();
  const page = await getEvents({ size });
  const events = page?.items ?? [];
  const byCreator = new Map();
  events.forEach((event) => {
    const list = byCreator.get(event.creatorId) ?? [];
    list.push(event);
    byCreator.set(event.creatorId, list);
  });

  const creators = profiles.map((profile) => {
    const creatorEvents = byCreator.get(profile.creatorId) ?? [];
    return {
      ...profile,
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
  try {
    const eventsPage = await getEvents({ creatorId: space.creatorId, size: 50 });
    return { ...space, events: eventsPage?.items ?? [], eventsError: false };
  } catch {
    return { ...space, events: [], eventsError: true };
  }
}
