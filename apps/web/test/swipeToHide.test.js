import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SWIPE_DELETE_RATIO,
  SWIPE_INTENT_DISTANCE,
  SWIPE_REVEAL,
  clampSwipeOffset,
  isDeleteSwipe,
  swipeAxis,
  swipeOutcome,
} from '../src/utils/swipeToHide.js'

const WIDTH = 400

test('첫 움직임이 작으면 방향을 정하지 않아 탭·클릭을 방해하지 않는다', () => {
  assert.equal(swipeAxis(0, 0), null)
  assert.equal(swipeAxis(SWIPE_INTENT_DISTANCE - 1, SWIPE_INTENT_DISTANCE - 1), null)
})

test('가로 이동이 더 크면 가로 스와이프, 세로 이동이 더 크거나 같으면 세로 스크롤이다', () => {
  assert.equal(swipeAxis(-20, 5), 'x')
  assert.equal(swipeAxis(20, -5), 'x')
  assert.equal(swipeAxis(5, 20), 'y')
  assert.equal(swipeAxis(-12, 12), 'y')
})

test('카드는 왼쪽으로만, 기본은 삭제 버튼 너비까지만 움직인다', () => {
  assert.equal(clampSwipeOffset(0, -30), -30)
  assert.equal(clampSwipeOffset(0, 40), 0)
  assert.equal(clampSwipeOffset(0, -SWIPE_REVEAL - 50), -SWIPE_REVEAL)
})

test('바로 삭제를 허용하면 카드 너비까지 끌 수 있다', () => {
  assert.equal(clampSwipeOffset(0, -250, WIDTH), -250)
  assert.equal(clampSwipeOffset(0, -WIDTH - 100, WIDTH), -WIDTH)
  assert.equal(clampSwipeOffset(0, 40, WIDTH), 0)
})

test('열린 카드를 오른쪽으로 끌면 열린 위치에서 이어서 닫힌다', () => {
  assert.equal(clampSwipeOffset(-SWIPE_REVEAL, 30, WIDTH), -SWIPE_REVEAL + 30)
  assert.equal(clampSwipeOffset(-SWIPE_REVEAL, 200, WIDTH), 0)
  assert.equal(clampSwipeOffset(-SWIPE_REVEAL, -20, WIDTH), -SWIPE_REVEAL - 20)
})

test('카드 너비의 기준 비율 이상 밀어야 바로 삭제되고, 그보다 덜 밀면 삭제되지 않는다', () => {
  const edge = -WIDTH * SWIPE_DELETE_RATIO
  assert.equal(isDeleteSwipe(edge, WIDTH), true)
  assert.equal(isDeleteSwipe(-WIDTH, WIDTH), true)
  assert.equal(isDeleteSwipe(edge + 1, WIDTH), false)
  assert.equal(isDeleteSwipe(-SWIPE_REVEAL, WIDTH), false)
  assert.equal(isDeleteSwipe(0, WIDTH), false)
})

test('카드 너비를 알 수 없으면(0) 바로 삭제하지 않는다', () => {
  assert.equal(isDeleteSwipe(-500, 0), false)
  assert.equal(swipeOutcome(-500, 0), 'open')
})

test('손을 뗀 위치에 따라 삭제·열림·닫힘으로 나뉜다', () => {
  assert.equal(swipeOutcome(0, WIDTH), 'closed')
  assert.equal(swipeOutcome(-SWIPE_REVEAL / 2 + 1, WIDTH), 'closed')
  assert.equal(swipeOutcome(-SWIPE_REVEAL / 2, WIDTH), 'open')
  assert.equal(swipeOutcome(-SWIPE_REVEAL, WIDTH), 'open')
  // 버튼 너비를 훨씬 넘겨도 기준 비율 전이면 삭제가 아니라 열린 상태로 멈춘다.
  assert.equal(swipeOutcome(-WIDTH * SWIPE_DELETE_RATIO + 1, WIDTH), 'open')
  assert.equal(swipeOutcome(-WIDTH * SWIPE_DELETE_RATIO, WIDTH), 'delete')
})
