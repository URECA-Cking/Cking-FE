import test from 'node:test'
import assert from 'node:assert/strict'
import { SWIPE_INTENT_DISTANCE, SWIPE_REVEAL, clampSwipeOffset, settleSwipe, swipeAxis } from '../src/utils/swipeToHide.js'

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

test('카드는 왼쪽으로만, 숨기기 버튼 너비까지만 움직인다', () => {
  assert.equal(clampSwipeOffset(0, -30), -30)
  assert.equal(clampSwipeOffset(0, 40), 0)
  assert.equal(clampSwipeOffset(0, -SWIPE_REVEAL - 50), -SWIPE_REVEAL)
})

test('열린 카드를 오른쪽으로 끌면 열린 위치에서 이어서 닫힌다', () => {
  assert.equal(clampSwipeOffset(-SWIPE_REVEAL, 30), -SWIPE_REVEAL + 30)
  assert.equal(clampSwipeOffset(-SWIPE_REVEAL, 200), 0)
  assert.equal(clampSwipeOffset(-SWIPE_REVEAL, -20), -SWIPE_REVEAL)
})

test('절반 넘게 밀면 열림, 아니면 닫힘으로 멈춘다', () => {
  assert.equal(settleSwipe(0), 0)
  assert.equal(settleSwipe(-SWIPE_REVEAL / 2 + 1), 0)
  assert.equal(settleSwipe(-SWIPE_REVEAL / 2), -SWIPE_REVEAL)
  assert.equal(settleSwipe(-SWIPE_REVEAL), -SWIPE_REVEAL)
})
