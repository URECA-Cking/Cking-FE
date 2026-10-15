/** 알림 카드를 왼쪽으로 밀어 "숨기기" 버튼을 드러내는 제스처 계산. 화면과 분리해 단위 테스트한다. */

/** 숨기기 버튼이 차지하는 너비(px). 카드를 이만큼 밀면 버튼이 완전히 드러난다. */
export const SWIPE_REVEAL = 88

/** 이 거리(px) 안의 움직임은 탭·클릭으로 보고 방향을 정하지 않는다. */
export const SWIPE_INTENT_DISTANCE = 8

/** 첫 움직임이 가로 스와이프인지 세로 스크롤인지 정한다. 가로 이동이 더 크면 'x', 아니면 'y', 아직 작으면 null이다. */
export function swipeAxis(dx, dy) {
  if (Math.abs(dx) < SWIPE_INTENT_DISTANCE && Math.abs(dy) < SWIPE_INTENT_DISTANCE) return null
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
}

/** 시작 위치(닫힘 0, 열림 -reveal)에서 dx만큼 끌었을 때의 카드 이동량. 왼쪽으로만, 버튼 너비까지만 움직인다. */
export function clampSwipeOffset(startOffset, dx, reveal = SWIPE_REVEAL) {
  return Math.min(0, Math.max(-reveal, startOffset + dx))
}

/** 손을 뗀 위치에서 카드가 멈출 곳. 절반 넘게 밀렸으면 열린 상태(-reveal), 아니면 닫힌 상태(0)다. */
export function settleSwipe(offset, reveal = SWIPE_REVEAL) {
  return offset <= -reveal / 2 ? -reveal : 0
}
