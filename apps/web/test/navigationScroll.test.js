import assert from 'node:assert/strict'
import test from 'node:test'
import { resetNavigationScroll } from '../src/components/layout/navigationScroll.js'

test('하단 메뉴 이동은 공용 스크롤을 최상단으로 옮기고 앱 크롬을 초기화한다', () => {
  const scrollContainer = { scrollTop: 240 }
  let chromeResetCount = 0

  resetNavigationScroll(scrollContainer, () => {
    chromeResetCount += 1
  })

  assert.equal(scrollContainer.scrollTop, 0)
  assert.equal(chromeResetCount, 1)
})

test('스크롤 컨테이너가 아직 없어도 앱 크롬 초기화는 요청한다', () => {
  let chromeResetCount = 0

  resetNavigationScroll(null, () => {
    chromeResetCount += 1
  })

  assert.equal(chromeResetCount, 1)
})
