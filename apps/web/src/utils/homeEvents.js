const byTime = (field, direction) => (a, b) => direction * (new Date(a[field]) - new Date(b[field]))

/** 종료 시각이 now 이전이면 끝난 이벤트다. now가 없거나 종료 시각을 읽을 수 없으면 서버 상태를 믿는다. */
function hasEnded(event, now) {
  if (now == null || event.endAt == null) return false
  const endAt = new Date(event.endAt).getTime()
  return Number.isFinite(endAt) && endAt <= now
}

/**
 * 홈 "응모" 섹션: 진행 중인 Event만, 종료가 빠른 순(마감 임박순). 종료된 Event는 노출하지 않는다.
 * 관심 크리에이터가 없으면 전체 진행 중 Event로 채운다.
 */
export function selectEntryEvents(events, followedCreatorIds, limit = 8, now = null) {
  // 캐시로 그린 목록은 마감 뒤에도 IN_PROGRESS로 남아 있을 수 있다. now(ms)를 주면 이미 끝난 이벤트는 걸러 낸다.
  const open = events.filter((event) => event.displayStatus === 'IN_PROGRESS' && !hasEnded(event, now))
  const scoped = followedCreatorIds.length
    ? open.filter((event) => followedCreatorIds.includes(event.creatorId))
    : open
  return scoped.toSorted(byTime('endAt', 1)).slice(0, limit)
}
