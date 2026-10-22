import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStampSlots } from '../src/utils/attendanceStamps.js'

const NOW = Date.parse('2026-10-08T03:00:00Z')
const stampedCount = (slots) => slots.filter((slot) => slot.stamped).length

test('최근 7일의 출석 일수만큼 왼쪽 칸부터 채우고 다음 칸을 알린다', () => {
  const slots = buildStampSlots({
    now: NOW,
    missionId: 7,
    ledgerItems: [
      { type: 'EARN', missionId: 7, createdAt: '2026-10-07T23:30:00Z' },
      { type: 'EARN', missionId: 7, createdAt: '2026-10-05T01:00:00Z' },
      { type: 'EARN', missionId: 99, createdAt: '2026-10-06T01:00:00Z' },
      { type: 'SPEND', missionId: 7, createdAt: '2026-10-04T01:00:00Z' },
    ],
  })

  assert.equal(slots.length, 7)
  assert.deepEqual(slots.map((slot) => slot.stamped), [true, true, false, false, false, false, false])
  assert.deepEqual(slots.map((slot) => slot.next), [false, false, true, false, false, false, false])
})

test('같은 UTC 날짜의 적립은 하루로 세고 7일 밖의 기록은 세지 않는다', () => {
  const slots = buildStampSlots({
    now: NOW,
    missionId: 7,
    ledgerItems: [
      { type: 'EARN', missionId: 7, createdAt: '2026-10-07T01:00:00Z' },
      { type: 'EARN', missionId: 7, createdAt: '2026-10-07T20:00:00Z' },
      { type: 'EARN', missionId: 7, createdAt: '2026-10-01T10:00:00Z' },
    ],
  })

  assert.equal(stampedCount(slots), 1)
})

test('오늘 완료했으면 원장 반영 전이어도 도장이 하나 더 찍히고 다음 칸은 알리지 않는다', () => {
  const slots = buildStampSlots({ now: NOW, missionId: 7, completedToday: true })

  assert.equal(stampedCount(slots), 1)
  assert.equal(slots.some((slot) => slot.next), false)
})

test('날짜를 읽을 수 없는 원장 항목은 무시한다', () => {
  const slots = buildStampSlots({ now: NOW, missionId: 7, ledgerItems: [{ type: 'EARN', missionId: 7, createdAt: 'broken' }] })

  assert.equal(stampedCount(slots), 0)
})
