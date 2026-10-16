/** 알림 카드를 왼쪽으로 밀어 "삭제" 버튼을 드러내거나, 끝까지 밀어 바로 삭제하는 제스처 계산. 화면과 분리해 단위 테스트한다. */

/** 삭제 버튼이 차지하는 너비(px). 카드를 이만큼 밀면 버튼이 완전히 드러난다. */
export const SWIPE_REVEAL = 88

/** 이 거리(px) 안의 움직임은 탭·클릭으로 보고 방향을 정하지 않는다. */
export const SWIPE_INTENT_DISTANCE = 8

/**
 * 카드 너비의 이 비율 이상 밀고 놓으면 버튼을 거치지 않고 바로 삭제한다.
 * 삭제한 알림은 되돌릴 수 없어서, 세로 스크롤 중 손가락이 비스듬히 밀린 정도로는 지워지지 않게 크게 잡는다.
 */
export const SWIPE_DELETE_RATIO = 0.65

/** 첫 움직임이 가로 스와이프인지 세로 스크롤인지 정한다. 가로 이동이 더 크면 'x', 아니면 'y', 아직 작으면 null이다. */
export function swipeAxis(dx, dy) {
  if (Math.abs(dx) < SWIPE_INTENT_DISTANCE && Math.abs(dy) < SWIPE_INTENT_DISTANCE) return null
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
}

/** 시작 위치(닫힘 0, 열림 -reveal)에서 dx만큼 끌었을 때의 카드 이동량. 왼쪽으로만, limit(기본은 버튼 너비, 바로 삭제를 허용하면 카드 너비)까지만 움직인다. */
export function clampSwipeOffset(startOffset, dx, limit = SWIPE_REVEAL) {
  return Math.min(0, Math.max(-limit, startOffset + dx))
}

/** 이 이동량이면 놓았을 때 바로 삭제되는지. width는 카드 너비(px)다. */
export function isDeleteSwipe(offset, width) {
  return width > 0 && offset <= -width * SWIPE_DELETE_RATIO
}

/**
 * 손을 뗀 위치에서의 결과. 크게 밀었으면 'delete', 버튼 너비의 절반 넘게 밀렸으면 열린 상태 'open', 아니면 'closed'다.
 * 'open'이면 카드가 -reveal에서, 'closed'면 0에서 멈춘다.
 */
export function swipeOutcome(offset, width, reveal = SWIPE_REVEAL) {
  if (isDeleteSwipe(offset, width)) return 'delete'
  return offset <= -reveal / 2 ? 'open' : 'closed'
}
