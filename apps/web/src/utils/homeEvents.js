const byTime = (field, direction) => (a, b) => direction * (new Date(a[field]) - new Date(b[field]))

/**
 * 홈 "응모" 섹션: 진행 중인 Event만, 종료가 빠른 순(마감 임박순). 종료된 Event는 노출하지 않는다.
 * 관심 크리에이터가 없으면 전체 진행 중 Event로 채운다.
 */
export function selectEntryEvents(events, followedCreatorIds, limit = 8) {
  const open = events.filter((event) => event.displayStatus === 'IN_PROGRESS')
  const scoped = followedCreatorIds.length
    ? open.filter((event) => followedCreatorIds.includes(event.creatorId))
    : open
  return scoped.toSorted(byTime('endAt', 1)).slice(0, limit)
}
