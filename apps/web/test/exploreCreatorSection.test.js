import assert from 'node:assert/strict'
import test from 'node:test'
import { filterExploreCreators, resetCreatorCarousel } from '../src/utils/exploreCreatorSection.js'

const creators = [
  { creatorId: 1, name: '유니' },
  { creatorId: 2, name: '체킹' },
  { creatorId: 3, name: '코딩' },
]

test('탐색 Creator 필터는 받은 목록을 재사용해 전체·관심·검색 결과를 나눈다', () => {
  assert.deepEqual(filterExploreCreators(creators, [2], '전체', '').map(({ creatorId }) => creatorId), [1, 2, 3])
  assert.deepEqual(filterExploreCreators(creators, [2], '관심', '').map(({ creatorId }) => creatorId), [2])
  assert.deepEqual(filterExploreCreators(creators, [2], '전체', '코딩').map(({ creatorId }) => creatorId), [3])
})

test('필터 전환은 CSS 가로 스크롤 캐러셀을 첫 카드로 되돌린다', () => {
  const calls = []
  resetCreatorCarousel({ scrollTo: (options) => calls.push(options) })
  resetCreatorCarousel(null)

  assert.deepEqual(calls, [{ left: 0, behavior: 'auto' }])
})
