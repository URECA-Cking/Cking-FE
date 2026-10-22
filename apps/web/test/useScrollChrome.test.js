import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createScrollChromeTracker,
  resolveScrollChrome,
  synchronizeScrollChromeTracker,
} from '../src/hooks/useScrollChrome.js'

test('POP 스크롤 복원 후 발생한 scroll 이벤트는 앱 크롬을 다시 숨기지 않는다', () => {
  const tracker = createScrollChromeTracker(0)

  synchronizeScrollChromeTracker(tracker, 800)

  assert.equal(resolveScrollChrome(tracker, 800), null)
  assert.deepEqual(tracker, { lastScrollTop: 800, pendingDistance: 0, pendingDirection: null })
})

test('실제 아래 방향 스크롤은 동기화 뒤에도 앱 크롬을 축소한다', () => {
  const tracker = createScrollChromeTracker(800)

  assert.deepEqual(resolveScrollChrome(tracker, 824), { headerVisible: false, bottomCompact: true })
})
