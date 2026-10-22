/**
 * 추천 응답에 실제 기여한 관심 분야·팔로우 seed로 카드의 추천 이유를 만든다.
 * boxed는 박스 태그로 보일지 여부다. 관심 분야는 분야명만 태그로, 도킹 기반은 소개글 자리에 박스 없이 보여준다.
 */
export function recommendationReason(item, interestNames = new Map()) {
  const names = (item?.interestCodes ?? []).map((code) => interestNames?.get?.(code)).filter(Boolean)
  if (names.length > 0) return { text: names.join(', '), boxed: true }
  if ((item?.seedCreatorIds ?? []).length > 0) return { text: '내가 도킹한 크리에이터와 비슷해요', boxed: false }
  return null
}
