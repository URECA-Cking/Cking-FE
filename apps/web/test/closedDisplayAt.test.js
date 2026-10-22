import test from 'node:test'
import assert from 'node:assert/strict'
import { closedDisplayAt } from '../src/utils/eventStatus.js'

// 수동 마감한 이벤트는 예정 종료일이 아니라 마감 요청 시각을 마감 날짜로 보여준다(#329).
test('closeRequestedAt이 있으면 그 시각을 마감 시각으로 쓴다', () => {
  const event = { endAt: '2026-10-30T09:00:00Z', closeRequestedAt: '2026-10-20T03:00:00Z' }
  assert.equal(closedDisplayAt(event), '2026-10-20T03:00:00Z')
})

test('closeRequestedAt이 null이면 endAt으로 대체한다', () => {
  const event = { endAt: '2026-10-30T09:00:00Z', closeRequestedAt: null }
  assert.equal(closedDisplayAt(event), '2026-10-30T09:00:00Z')
})
