import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_BADGE_COUNT, formatTicketBadge, summarizeTickets } from '../src/utils/myTickets.js'

const creators = (entries) => new Map(entries.map(([id, balance]) => [id, { balance }]))

test('크리에이터 응모권 합계와 공용 응모권을 더해 총 개수를 만든다', () => {
  const summary = summarizeTickets({
    common: { balance: 3 },
    creators: creators([[1, 5], [2, 4]]),
    failedIds: new Set(),
  })
  assert.deepEqual(summary, { commonCount: 3, creatorTotal: 9, total: 12, failedCount: 0, partial: false })
})

test('팔로우한 크리에이터가 없으면 공용 응모권만 센다', () => {
  const summary = summarizeTickets({ common: { balance: 2 }, creators: new Map(), failedIds: new Set() })
  assert.equal(summary.total, 2)
  assert.equal(summary.creatorTotal, 0)
})

test('일부 크리에이터 조회가 실패하면 성공한 것만 합산하고 partial로 알린다', () => {
  const summary = summarizeTickets({
    common: { balance: 1 },
    creators: creators([[1, 5]]),
    failedIds: new Set([2, 3]),
  })
  assert.equal(summary.total, 6)
  assert.equal(summary.failedCount, 2)
  assert.equal(summary.partial, true)
})

test('공용 응모권 조회가 실패하면 0으로 단정하지 않고 null로 두고 partial로 알린다', () => {
  const summary = summarizeTickets({ common: null, creators: creators([[1, 5]]), failedIds: new Set() })
  assert.equal(summary.commonCount, null)
  assert.equal(summary.total, 5)
  assert.equal(summary.failedCount, 1)
  assert.equal(summary.partial, true)
})

test('숫자가 아닌 잔액은 합산에서 뺀다', () => {
  const summary = summarizeTickets({
    common: { balance: 1 },
    creators: new Map([[1, { balance: 'x' }], [2, { balance: 4 }]]),
    failedIds: new Set(),
  })
  assert.equal(summary.creatorTotal, 4)
})

test('헤더 숫자는 999를 넘으면 999+로 줄인다', () => {
  assert.equal(formatTicketBadge(0), '0')
  assert.equal(formatTicketBadge(12), '12')
  assert.equal(formatTicketBadge(MAX_BADGE_COUNT), '999')
  assert.equal(formatTicketBadge(1000), '999+')
})

test('일부 조회가 실패했으면 헤더 숫자 뒤에 +를 붙인다', () => {
  assert.equal(formatTicketBadge(0, true), '0+')
  assert.equal(formatTicketBadge(12, true), '12+')
  assert.equal(formatTicketBadge(12, false), '12')
  assert.equal(formatTicketBadge(1000, true), '999+')
})
