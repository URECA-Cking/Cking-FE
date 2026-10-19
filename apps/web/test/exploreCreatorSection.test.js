import assert from 'node:assert/strict'
import test from 'node:test'
import { creatorFilterCounts, filterExploreCreators, sortExploreCreators } from '../src/utils/exploreCreatorSection.js'

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

test('탐색 Creator는 진행 중 이벤트가 있는 Creator만 걸러 이름·진행 중 이벤트 수로 정렬한다', () => {
  const list = [
    { creatorId: 1, name: '유니', openEventCount: 0 },
    { creatorId: 2, name: '체킹', openEventCount: 2 },
    { creatorId: 3, name: '코딩', openEventCount: 2 },
    { creatorId: 4, name: '가나', openEventCount: 1 },
  ]
  const ids = (items) => items.map(({ creatorId }) => creatorId)

  assert.deepEqual(ids(filterExploreCreators(list, [], '진행 중', '')), [2, 3, 4])
  assert.deepEqual(ids(sortExploreCreators(list, 'name-asc')), [4, 1, 2, 3])
  assert.deepEqual(ids(sortExploreCreators(list, 'name-desc')), [3, 2, 1, 4])
  assert.deepEqual(ids(sortExploreCreators(list, 'open-desc')), [2, 3, 4, 1])
  assert.deepEqual(ids(sortExploreCreators(list, 'open-asc')), [1, 4, 2, 3])
})

test('필터 칩 개수는 전체·도킹·진행 중을 따로 센다', () => {
  const list = [
    { creatorId: 1, name: '가', openEventCount: 2 },
    { creatorId: 2, name: '나', openEventCount: 0 },
    { creatorId: 3, name: '다', openEventCount: 1 },
  ]
  assert.deepEqual(creatorFilterCounts(list, [2, 9]), { 전체: 3, 도킹: 2, '진행 중': 2 })
})
