import test from 'node:test'
import assert from 'node:assert/strict'
import { createLatestGate, waitForIncrease } from '../src/utils/entryStatusSettle.js'

const noWait = () => Promise.resolve()
const sequence = (...responses) => {
  let calls = 0
  const fetchStatus = async () => responses[Math.min(calls++, responses.length - 1)]
  return { fetchStatus, calls: () => calls }
}

test('내 응모권 수가 늘면 그 응답을 확정으로 돌려준다', async () => {
  const s = sequence({ myTicketCount: 2 }, { myTicketCount: 2 }, { myTicketCount: 5 })
  const result = await waitForIncrease({ fetchStatus: s.fetchStatus, baseline: 2, maxRetries: 6, retryMs: 1, wait: noWait })
  assert.deepEqual(result, { confirmed: true, data: { myTicketCount: 5 } })
  assert.equal(s.calls(), 3)
})

test('재시도가 끝나도 늘지 않으면 옛 응답을 돌려주지 않는다', async () => {
  const s = sequence({ myTicketCount: 2 })
  const result = await waitForIncrease({ fetchStatus: s.fetchStatus, baseline: 2, maxRetries: 3, retryMs: 1, wait: noWait })
  assert.deepEqual(result, { confirmed: false })
  assert.equal(s.calls(), 4) // 처음 1번 + 재시도 3번
})

test('조회가 실패해도 재시도하고, 끝까지 실패하면 확정하지 않는다', async () => {
  const s = sequence(undefined, undefined, { myTicketCount: 4 })
  assert.deepEqual(
    await waitForIncrease({ fetchStatus: s.fetchStatus, baseline: 1, maxRetries: 6, retryMs: 1, wait: noWait }),
    { confirmed: true, data: { myTicketCount: 4 } },
  )
  const failing = sequence(undefined)
  assert.deepEqual(
    await waitForIncrease({ fetchStatus: failing.fetchStatus, baseline: 1, maxRetries: 2, retryMs: 1, wait: noWait }),
    { confirmed: false },
  )
})

test('중간에 정리되면 null을 돌려주고 더 조회하지 않는다', async () => {
  let stop = false
  const s = sequence({ myTicketCount: 0 })
  const result = await waitForIncrease({
    fetchStatus: async () => { stop = true; return s.fetchStatus() },
    baseline: 0,
    maxRetries: 6,
    retryMs: 1,
    wait: noWait,
    cancelled: () => stop,
  })
  assert.equal(result, null)
  assert.equal(s.calls(), 1)
})

test('나중에 시작한 요청이 있으면 먼저 시작한 요청의 응답은 반영하지 않는다', () => {
  const begin = createLatestGate()
  const first = begin()
  const second = begin()
  assert.equal(first(), false)
  assert.equal(second(), true)
  const third = begin()
  assert.equal(second(), false)
  assert.equal(third(), true)
})
