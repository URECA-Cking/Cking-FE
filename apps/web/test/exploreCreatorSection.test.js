import assert from 'node:assert/strict'
import test from 'node:test'
import { CREATOR_FILTERS, creatorFilterCounts, filterExploreCreators, sortExploreCreators } from '../src/utils/exploreCreatorSection.js'

const creators = [
  { creatorId: 1, name: '유니' },
  { creatorId: 2, name: '체킹' },
  { creatorId: 3, name: '코딩' },
]

test('탐색 Creator 필터는 받은 목록을 재사용해 전체·도킹·검색 결과를 나눈다', () => {
  assert.deepEqual(filterExploreCreators(creators, [2], '전체', '').map(({ creatorId }) => creatorId), [1, 2, 3])
  assert.deepEqual(filterExploreCreators(creators, [2], '도킹', '').map(({ creatorId }) => creatorId), [2])
  assert.deepEqual(filterExploreCreators(creators, [2], '전체', '코딩').map(({ creatorId }) => creatorId), [3])
})

test('탐색 Creator는 도킹 필터와 이름·진행 중 이벤트 수 정렬을 쓴다', () => {
  const list = [
    { creatorId: 1, name: '유니', openEventCount: 0 },
    { creatorId: 2, name: '체킹', openEventCount: 2 },
    { creatorId: 3, name: '코딩', openEventCount: 2 },
    { creatorId: 4, name: '가나', openEventCount: 1 },
  ]
  const ids = (items) => items.map(({ creatorId }) => creatorId)

  assert.deepEqual(ids(filterExploreCreators(list, [3], '도킹', '')), [3])
  // 진행 중 필터는 없어서 알 수 없는 값은 전체로 본다.
  assert.deepEqual(ids(filterExploreCreators(list, [], '진행 중', '')), [1, 2, 3, 4])
  assert.deepEqual(ids(sortExploreCreators(list, 'name-asc')), [4, 1, 2, 3])
  assert.deepEqual(ids(sortExploreCreators(list, 'name-desc')), [3, 2, 1, 4])
  assert.deepEqual(ids(sortExploreCreators(list, 'open-desc')), [2, 3, 4, 1])
  assert.deepEqual(ids(sortExploreCreators(list, 'open-asc')), [1, 4, 2, 3])
})

test('필터 칩 개수는 전체·도킹을 따로 센다', () => {
  const list = [
    { creatorId: 1, name: '가', openEventCount: 2 },
    { creatorId: 2, name: '나', openEventCount: 0 },
    { creatorId: 3, name: '다', openEventCount: 1 },
  ]
  assert.deepEqual(creatorFilterCounts(list, [2, 9]), { 전체: 3, 도킹: 2 })
})

test('크리에이터 필터 선택지는 전체·도킹뿐이고 진행 중은 없다', () => {
  assert.deepEqual(CREATOR_FILTERS, ['전체', '도킹'])
})
