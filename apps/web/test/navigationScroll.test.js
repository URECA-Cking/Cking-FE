import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resetNavigationScroll,
  resolveNavigationScrollTop,
  restoreNavigationScroll,
  saveNavigationScroll,
  shouldContinueNavigationScrollRestore,
  shouldResetNavigationOnClick,
  shouldResetSelectedNavigation,
  MAX_SCROLL_POSITION_ENTRIES,
  SCROLL_RESTORE_TOLERANCE_PX,
} from '../src/components/layout/navigationScroll.js'

test('하단 메뉴 이동은 공용 스크롤을 최상단으로 옮기고 앱 크롬을 초기화한다', () => {
  const scrollContainer = { scrollTop: 240 }
  let chromeResetCount = 0

  resetNavigationScroll(scrollContainer, 'reset-target', () => {
    chromeResetCount += 1
  })

  assert.equal(scrollContainer.scrollTop, 0)
  assert.equal(chromeResetCount, 1)
})

test('스크롤 컨테이너가 아직 없어도 앱 크롬 초기화는 요청한다', () => {
  let chromeResetCount = 0

  resetNavigationScroll(null, 'missing-container', () => {
    chromeResetCount += 1
  })

  assert.equal(chromeResetCount, 1)
})

test('새 화면 진입은 저장된 위치가 있어도 최상단에서 시작한다', () => {
  saveNavigationScroll('push-target', 240)

  assert.equal(resolveNavigationScrollTop('PUSH', 'push-target'), 0)
  assert.equal(resolveNavigationScrollTop('REPLACE', 'push-target'), 0)
})

test('뒤로 가기는 같은 history 위치에 기록한 스크롤 위치를 복원한다', () => {
  const scrollContainer = { scrollTop: 0 }
  let chromeResetCount = 0
  saveNavigationScroll('pop-target', 240)

  const restoredScrollTop = restoreNavigationScroll(scrollContainer, 'POP', 'pop-target', () => {
    chromeResetCount += 1
  })

  assert.equal(restoredScrollTop, 240)
  assert.equal(scrollContainer.scrollTop, 240)
  assert.equal(chromeResetCount, 1)
})

test('새 탭을 여는 보조 키 클릭은 현재 탭의 초기화를 요청하지 않는다', () => {
  const plainClick = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }

  assert.equal(shouldResetNavigationOnClick(plainClick), true)
  assert.equal(shouldResetNavigationOnClick(null), false)
  assert.equal(shouldResetNavigationOnClick({ ...plainClick, ctrlKey: true }), false)
  assert.equal(shouldResetNavigationOnClick({ ...plainClick, metaKey: true }), false)
  assert.equal(shouldResetNavigationOnClick({ ...plainClick, button: 1 }), false)
})

test('다른 하단 메뉴 클릭은 이전 history 위치를 초기화하지 않는다', () => {
  const plainClick = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }

  assert.equal(shouldResetSelectedNavigation(plainClick, false), false)
  assert.equal(shouldResetSelectedNavigation(plainClick, true), true)
})

test('복원 목표에 닿을 때까지 제한 횟수 안에서만 다음 프레임 복원을 계속한다', () => {
  assert.equal(shouldContinueNavigationScrollRestore(800, 120, 0), true)
  assert.equal(shouldContinueNavigationScrollRestore(800, 800, 0), false)
  assert.equal(shouldContinueNavigationScrollRestore(800, 120, 120), false)
})

test('1px 이하 서브픽셀 차이는 복원 완료로 본다', () => {
  assert.equal(shouldContinueNavigationScrollRestore(450.8, 450.8 - SCROLL_RESTORE_TOLERANCE_PX, 0), false)
  assert.equal(shouldContinueNavigationScrollRestore(450.8, 450.8 - SCROLL_RESTORE_TOLERANCE_PX - 0.01, 0), true)
})

test('스크롤 위치는 최근 history 항목 수만 유지한다', () => {
  const evictedKey = 'evicted-scroll-position'
  saveNavigationScroll(evictedKey, 10)
  for (let index = 0; index <= MAX_SCROLL_POSITION_ENTRIES; index += 1) {
    saveNavigationScroll(`scroll-position-${index}`, index)
  }

  assert.equal(resolveNavigationScrollTop('POP', evictedKey), 0)
  assert.equal(resolveNavigationScrollTop('POP', `scroll-position-${MAX_SCROLL_POSITION_ENTRIES}`), MAX_SCROLL_POSITION_ENTRIES)
})

test('앱 크롬 초기화 콜백이 없어도 스크롤 복원과 초기화가 안전하게 끝난다', () => {
  const scrollContainer = { scrollTop: 24 }

  assert.doesNotThrow(() => restoreNavigationScroll(scrollContainer, 'PUSH', 'missing-reset', undefined))
  assert.doesNotThrow(() => resetNavigationScroll(scrollContainer, 'missing-reset', undefined))
})
