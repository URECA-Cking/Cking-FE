import test from 'node:test'
import assert from 'node:assert/strict'
import { createEntryStatusController } from '../src/utils/entryStatusController.js'

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve))
}
const s = (myTicketCount, extra = {}) => ({ participantCount: 1, totalTicketCount: myTicketCount, myTicketCount, realtime: false, ...extra })

/** 가짜 타이머·보임 여부·응답 큐로 컨트롤러를 만든다. */
function setup({ responses = [s(2)], visible = true, maxRetries = 3, recoveryPolls } = {}) {
  const views = []
  let tickFn = null
  let calls = 0
  const queue = [...responses]
  const state = { visible, fetchOverride: null }
  const controller = createEntryStatusController({
    fetchStatus: () => {
      calls += 1
      if (state.fetchOverride) return state.fetchOverride()
      const next = queue.length > 1 ? queue.shift() : queue[0]
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
    },
    onChange: (view) => views.push(view),
    isVisible: () => state.visible,
    timers: {
      setInterval: (fn) => { tickFn = fn; return 1 },
      clearInterval: () => { tickFn = null },
    },
    wait: () => Promise.resolve(),
    maxRetries,
    recoveryPolls,
  })
  return {
    controller,
    views,
    state,
    last: () => views[views.length - 1],
    calls: () => calls,
    tick: () => tickFn?.(),
    hasPoll: () => tickFn !== null,
    push: (...more) => queue.push(...more),
    setQueue: (...next) => { queue.length = 0; queue.push(...next) },
  }
}

test('처음 조회한 현황을 보여준다', async () => {
  const t = setup({ responses: [s(2)] })
  t.controller.sync({ live: true, refreshKey: 'a' })
  await flush()
  assert.equal(t.last().status.myTicketCount, 2)
  assert.equal(t.last().failed, false)
})

test('진행 중이면 주기 조회로 값을 갱신하고, 화면이 안 보이면 건너뛴다', async () => {
  const t = setup({ responses: [s(2), s(2, { participantCount: 9 })] })
  t.controller.sync({ live: true, refreshKey: 'a' })
  await flush()
  t.state.visible = false
  t.tick()
  await flush()
  assert.equal(t.calls(), 1)
  t.state.visible = true
  t.tick()
  await flush()
  assert.equal(t.last().status.participantCount, 9)
})

test('진행 중이 아니면 주기 조회를 하지 않는다', async () => {
  const t = setup()
  t.controller.sync({ live: false, refreshKey: 'a' })
  await flush()
  assert.equal(t.hasPoll(), false)
})

test('조회가 실패하면 현황을 숨기고, 복구되면 다시 보여준다', async () => {
  const t = setup({ responses: [s(2)] })
  t.controller.sync({ live: true, refreshKey: 'a' })
  await flush()
  t.setQueue(new Error('500'))
  t.tick()
  await flush()
  assert.equal(t.last().status, null)
  assert.equal(t.last().failed, true)
  t.setQueue(s(2, { participantCount: 7 }))
  t.tick()
  await flush()
  assert.equal(t.last().status.participantCount, 7)
  assert.equal(t.last().failed, false)
})

test('응모 후 증가가 확인될 때까지 현황을 숨기고, 증가하면 보여준다', async () => {
  const t = setup({ responses: [s(2)] })
  t.controller.sync({ live: true, refreshKey: 'e1' })
  await flush()
  t.setQueue(s(2), s(2), s(5))
  t.controller.setEntering(true)
  t.controller.sync({ live: true, refreshKey: 'e2' })
  await flush()
  assert.equal(t.last().status.myTicketCount, 5)
  // 증가 전 응답(2)은 한 번도 화면에 나가지 않았다
  assert.ok(t.views.slice(1).every((v) => v.status === null || v.status.myTicketCount === 5))
})

test('재시도가 끝나도 늘지 않으면 옛 수치를 보여주지 않고, 이후 주기 조회에서 증가하면 다시 보여준다', async () => {
  const t = setup({ responses: [s(2)] })
  t.controller.sync({ live: true, refreshKey: 'e1' })
  await flush()
  t.setQueue(s(2))
  t.controller.setEntering(true)
  t.controller.sync({ live: true, refreshKey: 'e2' })
  await flush()
  assert.equal(t.last().status, null)
  assert.equal(t.last().failed, true)
  t.tick() // 아직 증가 없음
  await flush()
  assert.equal(t.last().status, null)
  t.setQueue(s(4))
  t.tick()
  await flush()
  assert.equal(t.last().status.myTicketCount, 4)
})

test('응모 전 기준은 요청을 보내기 시작할 때 고정한다(재조회 전에 주기 조회가 증가한 값을 받아도 숨겨지지 않음)', async () => {
  const t = setup({ responses: [s(2)] })
  t.controller.sync({ live: true, refreshKey: 'e1' })
  await flush()
  t.controller.setEntering(true) // 이 순간의 기준은 2
  t.setQueue(s(5)) // 응모가 반영된 응답을 주기 조회가 먼저 받는다
  t.tick()
  await flush()
  assert.equal(t.last().status.myTicketCount, 5)
  // 이제 상세 재조회가 끝나 refreshKey가 바뀐다. 기준이 5였다면 더 큰 값을 기다려 숨겨졌을 것이다.
  t.controller.sync({ live: true, refreshKey: 'e2' })
  await flush()
  assert.equal(t.last().status?.myTicketCount, 5)
  assert.equal(t.last().failed, false)
})

test('멱등 재시도(replay)는 증가를 기다리지 않고 현재 값을 보여준다', async () => {
  const t = setup({ responses: [s(5)] })
  t.controller.sync({ live: true, refreshKey: 'e1' })
  await flush()
  t.controller.setEntering(true)
  t.controller.sync({ live: true, replay: true, refreshKey: 'e2' })
  await flush()
  assert.equal(t.last().status.myTicketCount, 5)
  assert.equal(t.last().failed, false)
})

test('이전 응모의 증가 대기가 남아 있어도 멱등 재시도(replay)가 오면 대기를 풀고 현재 값을 보여준다', async () => {
  const t = setup({ responses: [s(2)] })
  t.controller.sync({ live: true, refreshKey: 'e1' })
  await flush()
  t.setQueue(s(2))
  t.controller.setEntering(true)
  t.controller.sync({ live: true, refreshKey: 'e2' }) // 증가를 확인하지 못한 채 숨김 상태
  await flush()
  assert.equal(t.last().status, null)
  t.controller.sync({ live: true, replay: true, refreshKey: 'e2' })
  await flush()
  assert.equal(t.last().status.myTicketCount, 2)
  assert.equal(t.last().failed, false)
})

test('겹친 조회에서는 가장 최근에 시작한 요청의 응답만 반영한다', async () => {
  const t = setup({ responses: [s(2)] })
  t.controller.sync({ live: true, refreshKey: 'a' })
  await flush()
  const pending = []
  t.state.fetchOverride = () => new Promise((resolve) => pending.push(resolve))
  t.tick() // 오래된 요청 A
  t.controller.onVisible() // 최신 요청 B
  assert.equal(pending.length, 2)
  pending[1](s(9)) // 최신 응답이 먼저 도착
  await flush()
  assert.equal(t.last().status.myTicketCount, 9)
  pending[0](s(3)) // 늦게 도착한 오래된 응답
  await flush()
  assert.equal(t.last().status.myTicketCount, 9)
})

test('응모 직후 재조회 도중 sync가 다시 불려도(live 변경 등) 증가 확인 전에는 옛 수치를 보여주지 않는다', async () => {
  const t = setup({ responses: [s(2)] })
  t.controller.sync({ live: true, refreshKey: 'e1' })
  await flush()
  t.setQueue(s(2))
  t.controller.setEntering(true)
  t.controller.sync({ live: true, refreshKey: 'e2' })
  t.controller.sync({ live: false, refreshKey: 'e2' }) // 이벤트가 마감돼 live가 바뀐 경우
  await flush()
  assert.ok(t.views.slice(1).every((v) => v.status === null))
  t.setQueue(s(3))
  t.controller.sync({ live: false, refreshKey: 'e2' })
  await flush()
  assert.equal(t.last().status.myTicketCount, 3)
})

test('정리(dispose) 뒤에 도착한 응답은 반영하지 않고 주기 조회도 멈춘다', async () => {
  const t = setup({ responses: [s(2)] })
  let resolveLate
  t.state.fetchOverride = () => new Promise((resolve) => { resolveLate = resolve })
  t.controller.sync({ live: true, refreshKey: 'a' })
  t.controller.dispose()
  resolveLate(s(8))
  await flush()
  assert.equal(t.views.length, 0)
  assert.equal(t.hasPoll(), false)
})

test('응모 직후 이벤트가 마감돼(live 아님) 재시도 안에 반영되지 않아도 주기 조회를 이어 가고, 증가하면 보여준 뒤 멈춘다', async () => {
  const t = setup({ responses: [s(2)] })
  t.controller.sync({ live: false, refreshKey: 'e1' })
  await flush()
  assert.equal(t.hasPoll(), false) // 마감 이벤트는 평소에는 주기 조회를 하지 않는다
  t.setQueue(s(2))
  t.controller.setEntering(true)
  t.controller.sync({ live: false, refreshKey: 'e2' })
  await flush()
  assert.equal(t.last().status, null) // 재시도 안에 반영되지 않아 숨김
  assert.equal(t.hasPoll(), true) // 그래도 조회를 이어 간다
  t.setQueue(s(4))
  t.tick()
  await flush()
  assert.equal(t.last().status.myTicketCount, 4)
  t.tick()
  await flush()
  assert.equal(t.hasPoll(), false) // 증가를 확인했으니 마감 이벤트의 주기 조회는 멈춘다
})

test('마감 뒤 이어 가는 조회는 횟수가 제한되고, 포기한 뒤에는 retry()로 다시 확인할 수 있다', async () => {
  const t = setup({ responses: [s(2)], recoveryPolls: 2 })
  t.controller.sync({ live: false, refreshKey: 'e1' })
  await flush()
  t.setQueue(s(2))
  t.controller.setEntering(true)
  t.controller.sync({ live: false, refreshKey: 'e2' })
  await flush()
  const before = t.calls()
  t.tick()
  await flush()
  t.tick()
  await flush()
  assert.equal(t.calls(), before + 2) // 제한된 횟수(2번)만 조회한다
  t.tick() // 횟수를 다 썼으니 멈춘다
  await flush()
  assert.equal(t.calls(), before + 2)
  assert.equal(t.hasPoll(), false)
  assert.equal(t.last().status, null)
  assert.equal(t.last().failed, true)
  // 사용자가 다시 확인한다. 이번에는 반영돼 있다.
  t.setQueue(s(5))
  t.controller.retry()
  await flush()
  assert.equal(t.last().status.myTicketCount, 5)
  assert.equal(t.last().failed, false)
})

test('진행 중(live)인 이벤트의 주기 조회는 횟수 제한 없이 계속된다', async () => {
  const t = setup({ responses: [s(2)], recoveryPolls: 1 })
  t.controller.sync({ live: true, refreshKey: 'e1' })
  await flush()
  for (let i = 0; i < 5; i += 1) {
    t.tick()
    await flush()
  }
  assert.equal(t.calls(), 6)
  assert.equal(t.hasPoll(), true)
})

test('타이머는 객체의 메서드가 아니라 떼어 낸 함수로 호출한다(브라우저 setInterval은 this가 window여야 함)', async () => {
  const requireUnbound = function (fn) {
    return function (...args) {
      if (this !== undefined) throw new TypeError('Illegal invocation')
      return fn(...args)
    }
  }
  let tick = null
  const controller = createEntryStatusController({
    fetchStatus: () => Promise.resolve(s(1)),
    onChange: () => {},
    timers: {
      setInterval: requireUnbound((fn) => { tick = fn; return 1 }),
      clearInterval: requireUnbound(() => { tick = null }),
    },
    wait: () => Promise.resolve(),
  })
  controller.sync({ live: true, refreshKey: 'a' })
  assert.notEqual(tick, null)
  controller.dispose()
  assert.equal(tick, null)
})
