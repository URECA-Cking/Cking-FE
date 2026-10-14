import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_BADGE_COUNT, createRetryScheduler, formatTicketBadge, summarizeTickets } from '../src/utils/myTickets.js'

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

// ── 반영 확인 재조회 스케줄러 ─────────────────────────────────────────────

function schedulerHarness(t, initialValue) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const state = { value: initialValue, runs: 0 }
  const scheduler = createRetryScheduler({
    gapsMs: [2000, 3000, 5000],
    getValue: () => state.value,
    run: () => { state.runs += 1 },
  })
  return { state, scheduler, tick: (ms) => t.mock.timers.tick(ms) }
}

test('start하면 바로 한 번 불러오고, 값이 그대로면 2초·5초·10초에 다시 불러온 뒤 멈춘다', (t) => {
  const { state, scheduler, tick } = schedulerHarness(t, 10)
  scheduler.start()
  assert.equal(state.runs, 1)
  tick(1999)
  assert.equal(state.runs, 1)
  tick(1)
  assert.equal(state.runs, 2)
  tick(3000)
  assert.equal(state.runs, 3)
  tick(5000)
  assert.equal(state.runs, 4)
  tick(60_000)
  assert.equal(state.runs, 4)
})

test('값이 바뀐 것을 확인하면 남은 재조회를 하지 않는다', (t) => {
  const { state, scheduler, tick } = schedulerHarness(t, 10)
  scheduler.start()
  state.value = 9
  tick(60_000)
  assert.equal(state.runs, 1)
})

test('두 번째 재조회에서 반영이 확인되면 거기서 멈춘다', (t) => {
  const { state, scheduler, tick } = schedulerHarness(t, 10)
  scheduler.start()
  tick(2000)
  assert.equal(state.runs, 2)
  state.value = 9
  tick(60_000)
  assert.equal(state.runs, 2)
})

test('앞선 재조회가 남아 있을 때 다시 start하면 값이 바뀌어도 끝까지 재조회한다', (t) => {
  const { state, scheduler, tick } = schedulerHarness(t, 10)
  scheduler.start()
  state.value = 9 // 첫 행동의 반영이 보이는 상태에서 두 번째 행동을 한다
  scheduler.start()
  assert.equal(state.runs, 2)
  tick(2000)
  tick(3000)
  tick(5000)
  assert.equal(state.runs, 5)
  tick(60_000)
  assert.equal(state.runs, 5)
})

test('재조회가 모두 끝난 뒤의 start는 처음처럼 값이 바뀌면 멈춘다', (t) => {
  const { state, scheduler, tick } = schedulerHarness(t, 10)
  scheduler.start()
  tick(2000)
  tick(3000)
  tick(5000)
  assert.equal(state.runs, 4)
  scheduler.start()
  state.value = 8
  tick(60_000)
  assert.equal(state.runs, 5)
})

test('stop하면 대기 중인 재조회를 취소한다', (t) => {
  const { state, scheduler, tick } = schedulerHarness(t, 10)
  scheduler.start()
  scheduler.stop()
  tick(60_000)
  assert.equal(state.runs, 1)
})
