const HOME_EVENT_STATUS_ORDER = {
  IN_PROGRESS: 0,
  UPCOMING: 1,
}

/** 홈에는 아직 종료되지 않은 Event만 진행 상태 우선으로 노출한다. */
export function selectHomeEvents(events, followedCreatorIds, limit = 8) {
  const scoped = followedCreatorIds.length
    ? events.filter((event) => followedCreatorIds.includes(event.creatorId))
    : events

  return scoped
    .filter((event) => Object.hasOwn(HOME_EVENT_STATUS_ORDER, event.displayStatus))
    .toSorted((a, b) => HOME_EVENT_STATUS_ORDER[a.displayStatus] - HOME_EVENT_STATUS_ORDER[b.displayStatus])
    .slice(0, limit)
}
