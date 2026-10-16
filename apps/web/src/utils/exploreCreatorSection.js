/** 크리에이터 목록 필터 선택지. */
export const CREATOR_FILTERS = ['전체', '관심', '진행 중']

/**
 * 필터 칩별 개수. 관심은 서버 팔로우 목록 수, 전체·진행 중은 받은 크리에이터 목록에서 센다.
 * 진행 중은 한 번에 받은 최근 이벤트 기준이라 이벤트가 아주 많으면 실제보다 적을 수 있다.
 */
export function creatorFilterCounts(creators, followedCreatorIds) {
  return {
    전체: creators.length,
    관심: followedCreatorIds.length,
    '진행 중': creators.filter((creator) => creator.openEventCount > 0).length,
  }
}

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
