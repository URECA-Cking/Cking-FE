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

/** 공개 Creator 목록의 모든 페이지를 읽는다. 동시에 시작된 요청만 공유한다. */
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
    })().finally(() => {
      creatorCatalogPromise = null;
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

const KEYWORD_MAX_LENGTH = 50;
const POPULAR_FALLBACK = 'POPULAR_FALLBACK_V1';

/**
 * GET /api/creators?keyword&page&size - 공개 Creator 목록을 서버에서 검색·페이징한다(인증 불필요).
 * 이름 오름차순이라 페이지를 넘겨도 순서가 바뀌지 않는다. keyword는 BE 제약(최대 50자)에 맞춰 다듬는다.
 * @returns {Promise<{ items: object[], page: number, totalElements: number, hasNext: boolean }>}
 */
export async function searchCreators({ keyword = '', page = 0, size = 20 } = {}) {
  const trimmed = keyword.trim().slice(0, KEYWORD_MAX_LENGTH);
  const result = await apiClient.get('/api/creators', {
    page,
    size,
    keyword: trimmed || undefined,
  });
  return { ...result, items: (result.items ?? []).map(toProfile) };
}

/**
 * GET /api/me/creator-recommendations?size - 관심 분야·팔로우 기반 추천(size 1~20, 기본 10).
 * 개인화 결과가 없으면 BE가 팔로워 수 순 인기 크리에이터로 대체하고 policyVersion을 POPULAR_FALLBACK_V1로 준다.
 * 이미 팔로우한 크리에이터와 본인은 BE가 제외한다. aggregateScore는 정렬용이라 화면에 넘기지 않는다.
 * @returns {Promise<{ personalized: boolean, items: object[] }>} personalized가 false면 인기순 대체
 */
export async function getMyCreatorRecommendations({ size = 10 } = {}) {
  const result = await apiClient.get('/api/me/creator-recommendations', { size });
  return {
    personalized: result.policyVersion !== POPULAR_FALLBACK,
    items: (result.items ?? []).map((item) => ({
      creatorId: item.creatorId,
      name: item.creatorName,
      avatar: item.profileImageUrl,
      bio: item.introText,
      // 추천 이유 표시에 쓴다. 인기순 대체에서는 빈 배열이다.
      interestCodes: item.interestCodes ?? [],
      seedCreatorIds: item.seedCreatorIds ?? [],
    })),
  };
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
