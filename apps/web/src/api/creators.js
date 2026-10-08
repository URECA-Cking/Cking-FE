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
let creatorCatalogLoadedAt = 0;
// 공개 Creator 목록은 자주 바뀌지 않는다. 탭을 오갈 때마다 전체 페이지를 다시 받지 않도록 잠시 재사용한다.
const CREATOR_CATALOG_TTL_MS = 60_000;

/**
 * 공개 Creator 목록의 모든 페이지를 읽는다. 첫 페이지의 totalPages로 나머지를 한 번에 병렬 요청하고,
 * 진행 중인 요청은 공유하며 성공한 결과는 CREATOR_CATALOG_TTL_MS 동안 재사용한다.
 */
export function getCreatorCatalog() {
  if (creatorCatalogPromise && Date.now() - creatorCatalogLoadedAt < CREATOR_CATALOG_TTL_MS) {
    return creatorCatalogPromise;
  }
  const request = (async () => {
    const fetchPage = (page) => apiClient.get('/api/creators', { page, size: 100 });
    const first = await fetchPage(0);
    const rest = await Promise.all(
      Array.from({ length: Math.max((first.totalPages ?? 1) - 1, 0) }, (_, i) => fetchPage(i + 1)),
    );
    const creators = new Map();
    [first, ...rest].forEach((result) =>
      result.items.forEach((item) => creators.set(item.creatorId, toProfile(item))),
    );
    return [...creators.values()];
  })();
  creatorCatalogPromise = request;
  // 진행 중에는 만료로 보지 않도록 시작 시각을 먼저 찍고, 실패하면 다음 호출이 다시 시도하게 비운다.
  creatorCatalogLoadedAt = Date.now();
  request.catch(() => {
    if (creatorCatalogPromise === request) creatorCatalogPromise = null;
  });
  return request;
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
  // 서로 의존하지 않는 두 조회라 직렬로 기다리면 탐색 진입이 두 배 느려진다.
  const [profiles, page] = await Promise.all([getCreatorCatalog(), getEvents({ size })]);
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
