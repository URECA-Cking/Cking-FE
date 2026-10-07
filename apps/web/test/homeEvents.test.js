import test from 'node:test'
import assert from 'node:assert/strict'
import { selectHomeEvents } from '../src/utils/homeEvents.js'

test('홈 이벤트에는 종료된 Event를 노출하지 않는다', () => {
  const events = [
    { eventId: 1, creatorId: 10, displayStatus: 'CLOSED' },
    { eventId: 2, creatorId: 20, displayStatus: 'UPCOMING' },
    { eventId: 3, creatorId: 30, displayStatus: 'IN_PROGRESS' },
  ]

  assert.deepEqual(
    selectHomeEvents(events, []).map((event) => event.eventId),
    [3, 2],
  )
})

test('관심 크리에이터 범위에서 진행 중 Event를 예정 Event보다 먼저 노출한다', () => {
  const events = [
    { eventId: 1, creatorId: 10, displayStatus: 'UPCOMING' },
    { eventId: 2, creatorId: 10, displayStatus: 'CLOSED' },
    { eventId: 3, creatorId: 10, displayStatus: 'IN_PROGRESS' },
    { eventId: 4, creatorId: 20, displayStatus: 'IN_PROGRESS' },
  ]

  assert.deepEqual(
    selectHomeEvents(events, [10]).map((event) => event.eventId),
    [3, 1],
  )
})
