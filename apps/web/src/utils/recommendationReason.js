/** 추천 응답에 실제 기여한 관심 분야·팔로우 seed로 카드의 추천 이유를 만든다. */
export function recommendationReason(item, interestNames) {
  const names = (item.interestCodes ?? []).map((code) => interestNames.get(code)).filter(Boolean)
  if (names.length > 0) return `관심 분야 · ${names.join(', ')}`
  if ((item.seedCreatorIds ?? []).length > 0) return '내가 도킹한 크리에이터와 비슷해요'
  return null
}
