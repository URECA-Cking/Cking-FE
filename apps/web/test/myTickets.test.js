import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_BADGE_COUNT, createRetryScheduler, formatTicketBadge, normalizeSummary } from '../src/utils/myTickets.js'

const response = (overrides = {}) => ({
  common: { balance: 6, updatedAt: '2026-10-14T00:00:00Z' },
  creators: [
    { creatorId: 1, creatorName: '하늘', profileImageUrl: 'https://img/1', balance: 4, updatedAt: '2026-10-14T00:00:00Z' },
    { creatorId: 2, creatorName: '민준', profileImageUrl: null, balance: 3, updatedAt: null },
  ],
  creatorTotal: 7,
  total: 13,
  ...overrides,
})

test('서버가 계산한 합계를 그대로 쓰고 크리에이터를 화면용 모양으로 바꾼다', () => {
  assert.deepEqual(normalizeSummary(response()), {
    commonCount: 6,
    creators: [
      { creatorId: 1, name: '하늘', avatar: 'https://img/1', balance: 4 },
      { creatorId: 2, name: '민준', avatar: null, balance: 3 },
    ],
    creatorTotal: 7,
    total: 13,
  })
})

test('목록을 제한해도 서버 합계는 전체 기준이라 목록을 더한 값과 달라도 서버 값을 쓴다', () => {
  // 서버가 팔로우한 모든 크리에이터 기준으로 계산했고 목록만 일부라면, 합계는 서버 값이 맞다.
  const summary = normalizeSummary(response({ creators: [{ creatorId: 1, creatorName: '하늘', balance: 4 }], creatorTotal: 40, total: 46 }))
  assert.equal(summary.creatorTotal, 40)
  assert.equal(summary.total, 46)
})

test('팔로우한 크리에이터가 없으면 빈 목록과 공용 잔액만 센다', () => {
  const summary = normalizeSummary({ common: { balance: 2 }, creators: [], creatorTotal: 0, total: 2 })
  assert.deepEqual(summary.creators, [])
  assert.equal(summary.creatorTotal, 0)
  assert.equal(summary.total, 2)
})

test('합계 필드가 빠진 응답은 목록과 공용 잔액으로 대신 계산한다', () => {
  const summary = normalizeSummary({ common: { balance: 1 }, creators: [{ creatorId: 1, creatorName: 'a', balance: 4 }, { creatorId: 2, creatorName: 'b', balance: 2 }] })
  assert.equal(summary.creatorTotal, 6)
  assert.equal(summary.total, 7)
})

test('숫자가 아닌 잔액은 0으로 보고, 이름이 없으면 빈 문자열이다', () => {
  const summary = normalizeSummary({ common: { balance: 'x' }, creators: [{ creatorId: 1, balance: 'y' }], creatorTotal: 0, total: 0 })
  assert.equal(summary.commonCount, 0)
  assert.deepEqual(summary.creators, [{ creatorId: 1, name: '', avatar: null, balance: 0 }])
})

test('응답이 비어 있어도 0장으로 정리한다', () => {
  assert.deepEqual(normalizeSummary(null), { commonCount: 0, creators: [], creatorTotal: 0, total: 0 })
})

test('헤더 숫자는 999를 넘으면 999+로 줄인다', () => {
  assert.equal(formatTicketBadge(0), '0')
  assert.equal(formatTicketBadge(12), '12')
  assert.equal(formatTicketBadge(MAX_BADGE_COUNT), '999')
  assert.equal(formatTicketBadge(1000), '999+')
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
