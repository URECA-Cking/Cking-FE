import test from 'node:test'
import assert from 'node:assert/strict'
import { selectEntryEvents } from '../src/utils/homeEvents.js'

const ids = (events) => events.map((event) => event.eventId)

test('응모 섹션에는 종료·예정 Event를 노출하지 않고 마감이 빠른 순으로 정렬한다', () => {
  const events = [
    { eventId: 1, creatorId: 10, displayStatus: 'CLOSED', endAt: '2026-10-01T00:00:00Z' },
    { eventId: 2, creatorId: 20, displayStatus: 'UPCOMING', endAt: '2026-10-20T00:00:00Z' },
    { eventId: 3, creatorId: 30, displayStatus: 'IN_PROGRESS', endAt: '2026-10-15T00:00:00Z' },
    { eventId: 4, creatorId: 40, displayStatus: 'IN_PROGRESS', endAt: '2026-10-10T00:00:00Z' },
  ]

  assert.deepEqual(ids(selectEntryEvents(events, [])), [4, 3])
})

test('응모 섹션은 관심 크리에이터가 있으면 그들의 Event만 보여준다', () => {
  const events = [
    { eventId: 1, creatorId: 10, displayStatus: 'IN_PROGRESS', endAt: '2026-10-15T00:00:00Z' },
    { eventId: 2, creatorId: 20, displayStatus: 'IN_PROGRESS', endAt: '2026-10-10T00:00:00Z' },
  ]

  assert.deepEqual(ids(selectEntryEvents(events, [10])), [1])
})

test('현재 시각을 주면 캐시에 남아 있던 마감 지난 이벤트는 IN_PROGRESS여도 걸러 낸다', () => {
  const events = [
    { eventId: 1, creatorId: 10, displayStatus: 'IN_PROGRESS', endAt: '2026-10-15T00:00:00Z' },
    { eventId: 2, creatorId: 20, displayStatus: 'IN_PROGRESS', endAt: '2026-10-25T00:00:00Z' },
    { eventId: 3, creatorId: 30, displayStatus: 'IN_PROGRESS', endAt: '2026-10-20T00:00:00Z' },
  ]
  const now = new Date('2026-10-20T00:00:00Z').getTime()

  // 종료 시각과 같은 순간부터 끝난 것으로 본다. 시각을 주지 않으면 서버 상태만 믿는다.
  assert.deepEqual(ids(selectEntryEvents(events, [], 8, now)), [2])
  assert.deepEqual(ids(selectEntryEvents(events, [])), [1, 3, 2])
})

test('종료 시각을 읽을 수 없는 이벤트는 현재 시각을 줘도 서버 상태를 따른다', () => {
  const events = [{ eventId: 1, creatorId: 10, displayStatus: 'IN_PROGRESS', endAt: null }]

  assert.deepEqual(ids(selectEntryEvents(events, [], 8, Date.now())), [1])
})

const inProgress = (count) => Array.from({ length: count }, (_, index) => ({
  eventId: index + 1,
  creatorId: 10,
  displayStatus: 'IN_PROGRESS',
  endAt: `2026-10-${String(10 + index).padStart(2, '0')}T00:00:00Z`,
}))

test('응모 가능한 이벤트를 먼저 채우고 모자란 칸만 응모 완료 이벤트가 마감 임박순으로 채운다', () => {
  const events = inProgress(4)

  assert.deepEqual(ids(selectEntryEvents(events, [], 2, null, new Set([1]))), [2, 3])
  assert.deepEqual(ids(selectEntryEvents(events, [], 3, null, new Set([1, 2, 3]))), [4, 1, 2])
  assert.deepEqual(ids(selectEntryEvents(events, [], 2, null, new Set())), [1, 2])
})

test('모두 응모했어도 홈이 비지 않고 마감이 가까운 응모 완료 이벤트를 보여준다', () => {
  const events = inProgress(10)
  const applied = new Set(events.map((event) => event.eventId))

  assert.deepEqual(ids(selectEntryEvents(events, [], 3, null, applied)), [1, 2, 3])
})

test('앞쪽 이벤트를 모두 응모했어도 후보를 넓히면 뒤쪽 응모 가능한 이벤트가 먼저 나온다', () => {
  const events = inProgress(8)
  const applied = new Set([1, 2, 3, 4, 5, 6])

  // 후보를 6건으로 자르면 응모 가능한 이벤트를 놓치지만, 후보를 늘리면 7·8번이 앞에 온다.
  assert.deepEqual(ids(selectEntryEvents(events.slice(0, 6), [], 3, null, applied)), [1, 2, 3])
  assert.deepEqual(ids(selectEntryEvents(events, [], 3, null, applied)), [7, 8, 1])
})
