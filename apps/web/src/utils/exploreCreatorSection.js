/** 크리에이터 목록 필터 선택지. */
export const CREATOR_FILTERS = ['전체', '관심', '진행 중']

/** 정렬 선택지. 진행 중 이벤트 수는 공개 이벤트 목록에서 센 값이다. */
export const CREATOR_SORTS = [
  { id: 'name-asc', label: '이름 오름차순' },
  { id: 'name-desc', label: '이름 내림차순' },
  { id: 'open-desc', label: '진행 중 이벤트 많은 순' },
  { id: 'open-asc', label: '진행 중 이벤트 적은 순' },
]

/** 탐색 Creator 정렬. 같은 값은 이름순으로 맞춰 순서가 흔들리지 않게 한다. */
export function sortExploreCreators(creators, sortId) {
  const byName = (a, b) => a.name.localeCompare(b.name, 'ko')
  const compare = {
    'name-asc': byName,
    'name-desc': (a, b) => byName(b, a),
    'open-desc': (a, b) => (b.openEventCount ?? 0) - (a.openEventCount ?? 0) || byName(a, b),
    'open-asc': (a, b) => (a.openEventCount ?? 0) - (b.openEventCount ?? 0) || byName(a, b),
  }[sortId] ?? byName
  return [...creators].sort(compare)
}

/** 탐색 Creator 필터는 이미 받은 목록과 UserContext의 관심 Creator ID만으로 처리한다. '진행 중'은 이벤트가 열린 Creator만 남긴다. */
export function filterExploreCreators(creators, followedCreatorIds, filter, query) {
  const keyword = query.trim().toLowerCase()
  return creators.filter((creator) => {
    const matchesFilter =
      filter === '관심' ? followedCreatorIds.includes(creator.creatorId)
        : filter === '진행 중' ? creator.openEventCount > 0
          : true
    const matchesQuery = !keyword || creator.name.toLowerCase().includes(keyword)
    return matchesFilter && matchesQuery
  })
}

/** CSS 가로 스크롤 캐러셀을 새 필터 목록의 첫 카드로 되돌린다. */
export function resetCreatorCarousel(container) {
  container?.scrollTo?.({ left: 0, behavior: 'auto' })
}
