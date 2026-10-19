import { apiClient } from './client';

// GET /api/events - 이벤트 목록(페이지네이션, creatorId·status 필터)
export async function getEvents({ creatorId, status, page = 0, size = 20 } = {}) {
  return apiClient.get('/api/events', { creatorId, status, page, size });
}

const COUNT_KEYS = { '': 'total', UPCOMING: 'upcoming', IN_PROGRESS: 'inProgress', CLOSED: 'closed' };

/** GET /api/events?status&size=1 - 서버 집계가 없을 때의 대체. 상태마다 1건만 받아 totalElements를 읽는다. */
async function countByStatusCalls(statuses) {
  const totals = await Promise.all(
    statuses.map((status) => getEvents({ status: status || undefined, size: 1 }).then((result) => result?.totalElements ?? null, () => null)),
  );
  return Object.fromEntries(statuses.map((status, index) => [status, totals[index]]));
}

/**
 * GET /api/events/counts - 표시 상태별 이벤트 총 개수를 한 번의 요청·한 시점의 값으로 받는다(인증 불필요).
 * 엔드포인트가 없는 BE(404, 또는 /api/events/{eventId}로 해석돼 400·401)이거나 응답 형식이 다르면
 * 상태마다 size=1로 받는 대체 호출을 쓴다. 대체에서 한 상태가 실패하면 그 값만 null이다.
 * 이 요청의 401은 로그인 만료가 아니므로 토큰 갱신·로그아웃을 건드리지 않는다.
 * @param {string[]} statuses 조회할 상태 값들(전체는 빈 문자열)
 * @returns {Promise<Record<string, number|null>>} 키는 상태 값이고 전체는 빈 문자열이다
 */
export async function getEventCounts(statuses) {
  try {
    const counts = await apiClient.get('/api/events/counts', undefined, { skipAuthRefresh: true });
    const keys = statuses.map((status) => COUNT_KEYS[status]);
    if (keys.every((key) => Number.isInteger(counts?.[key]))) {
      return Object.fromEntries(statuses.map((status, index) => [status, counts[keys[index]]]));
    }
  } catch {
    // 아래 대체 호출로 계속한다.
  }
  return countByStatusCalls(statuses);
}

// GET /api/events/{eventId} - 이벤트 상세 (로그인 사용자의 응모권 잔액 포함)
export async function getEvent(eventId) {
  return apiClient.get(`/api/events/${eventId}`);
}

// POST /api/events/{eventId}/close - 수동 마감 요청 (크리에이터 또는 관리자)
export async function closeEvent(eventId) {
  return apiClient.post(`/api/events/${eventId}/close`);
}

/**
 * GET /api/events?status=IN_PROGRESS - 진행 중 이벤트를 모두 모은다.
 * 목록은 createdAt 내림차순이라 마감 임박순을 만들려면 일부만 받아서는 안 된다. 첫 페이지의 totalPages로
 * 나머지 페이지를 한 번에 병렬 요청해, 페이지 수만큼 차례로 기다리지 않게 한다.
 * totalPages가 없는 응답이면 예전처럼 hasNext가 끝날 때까지 이어 받는다. 비정상적으로 많아도 maxPages에서 멈춘다.
 * @returns {Promise<object[]>}
 */
export async function getInProgressEvents({ size = 100, maxPages = 10 } = {}) {
  const fetchPage = (page) => getEvents({ status: 'IN_PROGRESS', page, size });
  const first = await fetchPage(0);
  const items = [...(first?.items ?? [])];
  if (!first?.hasNext) return items;

  if (Number.isInteger(first.totalPages)) {
    const lastPage = Math.min(first.totalPages, maxPages) - 1;
    const rest = await Promise.all(Array.from({ length: Math.max(lastPage, 0) }, (_, index) => fetchPage(index + 1)));
    rest.forEach((result) => items.push(...(result?.items ?? [])));
    return items;
  }

  for (let page = 1; page < maxPages; page += 1) {
    const result = await fetchPage(page);
    items.push(...(result?.items ?? []));
    if (!result?.hasNext) break;
  }
  return items;
}
