/** 탐색 Creator 필터는 이미 받은 목록과 UserContext의 관심 Creator ID만으로 처리한다. */
export function filterExploreCreators(creators, followedCreatorIds, filter, query) {
  const keyword = query.trim().toLowerCase()
  return creators.filter((creator) => {
    const matchesFilter = filter !== '관심' || followedCreatorIds.includes(creator.creatorId)
    const matchesQuery = !keyword || creator.name.toLowerCase().includes(keyword)
    return matchesFilter && matchesQuery
  })
}

/** CSS 가로 스크롤 캐러셀을 새 필터 목록의 첫 카드로 되돌린다. */
export function resetCreatorCarousel(container) {
  container?.scrollTo?.({ left: 0, behavior: 'auto' })
}
