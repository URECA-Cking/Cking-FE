/** 카드 식별자는 카탈로그를 유지하고 서버의 최신 표시 정보만 반영한다. */
export function mergeRecommendationProfile(creator, item) {
  const result = { ...creator }
  if (typeof item.name === 'string' && item.name.trim()) result.name = item.name
  for (const key of ['bio', 'avatar', 'interestCodes', 'seedCreatorIds']) {
    if (item[key] !== undefined) result[key] = item[key]
  }
  return result
}

export function recommendationEmptyMessage(hasInterests) {
  return hasInterests
    ? '선택한 관심 분야에 맞는 추천 크리에이터가 아직 없어요.'
    : '아직 보여드릴 추천이 없어요. 관심 분야를 골라 보세요.'
}

export function currentSimilarCreators(data, memberId, seed, loading, error, creatorsById) {
  if (data?.owner !== memberId || data?.seed !== seed || loading || error) return []
  return data.items.map((item) => creatorsById.get(item.similarCreatorId)).filter(Boolean)
}
