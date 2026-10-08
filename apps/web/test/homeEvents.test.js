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
