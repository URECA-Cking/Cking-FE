import test from 'node:test'
import assert from 'node:assert/strict'
import { createEntryStatusController } from '../src/utils/entryStatusController.js'

const flush = async () => {
  for (let i = 0; i < 8; i += 1) await new Promise((resolve) => setImmediate(resolve))
}
const s = (myTicketCount, extra = {}) => ({ participantCount: 1, totalTicketCount: myTicketCount, myTicketCount, realtime: false, ...extra })

/** 가짜 타이머·시계·보임 여부·응답 큐로 컨트롤러를 만든다. wait가 시계를 앞으로 보낸다. */
function setup({ responses = [s(2)], visible = true, maxRetries = 3, recoveryPolls, unverifiedGraceMs = 15_000 } = {}) {
  const views = []
  let tickFn = null
  let calls = 0
  let clock = 0
  const queue = [...responses]
  const state = { visible, fetchOverride: null }
  const controller = createEntryStatusController({
    fetchStatus: () => {
      calls += 1
      if (state.fetchOverride) return state.fetchOverride()
      const next = queue.length > 1 ? queue.shift() : queue[0]
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
    },
    onChange: (view) => views.push({ ...view, at: clock }),
    isVisible: () => state.visible,
    timers: {
      setInterval: (fn) => { tickFn = fn; return 1 },
      clearInterval: () => { tickFn = null },
    },
    wait: (ms) => { clock += ms; return Promise.resolve() },
    now: () => clock,
    maxRetries,
    recoveryPolls,
    unverifiedGraceMs,
  })
  return {
    controller,
    views,
    state,
    last: () => views[views.length - 1],
    calls: () => calls,
    tick: () => tickFn?.(),
    hasPoll: () => tickFn !== null,
    clock: () => clock,
    setQueue: (...next) => { queue.length = 0; queue.push(...next) },
  }
}

/** 이전 응답으로 현황을 한 번 받아 둔 상태(내 응모권 2장)에서 시작한다. */
async function loaded(options) {
  const t = setup(options)
  t.controller.sync({ live: true })
  await flush()
  return t
}

test('처음 조회한 현황을 보여준다', async () => {
  const t = await loaded({ responses: [s(2)] })
  assert.equal(t.last().status.myTicketCount, 2)
  assert.equal(t.last().failed, false)
})

test('진행 중이면 주기 조회로 값을 갱신하고, 화면이 안 보이면 건너뛴다', async () => {
  const t = await loaded({ responses: [s(2), s(2, { participantCount: 9 })] })
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
  t.controller.sync({ live: false })
  await flush()
  assert.equal(t.hasPoll(), false)
})

test('조회가 실패하면 현황을 숨기고, 복구되면 다시 보여준다', async () => {
  const t = await loaded({ responses: [s(2)] })
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

test('응모가 수락돼도 반영(필요 수치)을 확인할 때까지 현황을 숨기고, 반영되면 보여준다', async () => {
  const t = await loaded({ responses: [s(2)] })
  t.setQueue(s(2), s(2), s(3))
  t.controller.beginEntry('r1', 1) // 필요 수치 2 + 1 = 3
  t.controller.acceptEntry('r1')
  await flush()
  assert.equal(t.last().status.myTicketCount, 3)
  assert.ok(t.views.slice(1).every((v) => v.status === null || v.status.myTicketCount === 3)) // 옛 값(2)은 나가지 않음
})

test('수량이 여러 장이면 그 수량만큼 늘어야 반영된 것으로 본다', async () => {
  const t = await loaded({ responses: [s(2)] })
  t.setQueue(s(3), s(5)) // 3장 응모 → 필요 수치 5. 3은 일부만 반영된 값이 아니라 아직 미확인
  t.controller.beginEntry('r1', 3)
  t.controller.acceptEntry('r1')
  await flush()
  assert.equal(t.last().status.myTicketCount, 5)
  assert.ok(t.views.slice(1).every((v) => v.status === null || v.status.myTicketCount === 5))
})

test('재시도가 끝나도 확인되지 않으면 옛 수치를 보여주지 않고, 이후 주기 조회에서 반영되면 다시 보여준다', async () => {
  const t = await loaded({ responses: [s(2)] })
  t.setQueue(s(2))
  t.controller.beginEntry('r1', 1)
  t.controller.acceptEntry('r1')
  await flush()
  assert.equal(t.last().status, null)
  assert.equal(t.last().failed, true)
  t.tick() // 아직 반영 안 됨
  await flush()
  assert.equal(t.last().status, null)
  t.setQueue(s(3))
  t.tick()
  await flush()
  assert.equal(t.last().status.myTicketCount, 3)
})

test('응모 시작 시점의 수치가 기준이다(수락 전에 주기 조회가 반영된 값을 받아도 숨겨지지 않음)', async () => {
  const t = await loaded({ responses: [s(2)] })
  t.controller.beginEntry('r1', 1) // 기준 2 → 필요 수치 3
  t.setQueue(s(3)) // 응모가 반영된 응답을 주기 조회가 먼저 받는다
  t.tick()
  await flush()
  assert.equal(t.last().status.myTicketCount, 3)
  t.controller.acceptEntry('r1') // 이제 수락 응답이 도착한다. 기준이 3이었다면 4를 기다려 숨겨졌을 것이다.
  await flush()
  assert.equal(t.last().status.myTicketCount, 3)
  assert.equal(t.last().failed, false)
})

test('첫 응모가 확인되기 전에 두 번째 응모가 수락되면 두 응모가 모두 반영돼야 보여준다', async () => {
  const t = await loaded({ responses: [s(2)], maxRetries: 2 })
  t.setQueue(s(2))
  t.controller.beginEntry('A', 1) // 필요 수치 3
  t.controller.acceptEntry('A')
  await flush()
  t.controller.beginEntry('B', 1) // 확인 대기 중인 3에 더해 필요 수치 4
  t.controller.acceptEntry('B')
  t.setQueue(s(3)) // 첫 응모분만 반영됨
  await flush()
  assert.equal(t.last().status, null) // 둘 다 반영된 것처럼 보여주지 않는다
  t.setQueue(s(4))
  t.tick()
  await flush()
  assert.equal(t.last().status.myTicketCount, 4)
})

test('응답을 못 받아 같은 requestId로 재시도해 DUPLICATE_REPLAY가 와도 원래 응모의 반영을 확인한다', async () => {
  const t = await loaded({ responses: [s(2)], maxRetries: 2 })
  t.controller.beginEntry('r1', 1) // 필요 수치 3
  t.controller.beginEntry('r1', 1) // 응답 유실 후 재시도: 처음 기록을 유지한다
  t.setQueue(s(2)) // 아직 반영되지 않은 옛 값(5초 캐시)
  t.controller.acceptEntry('r1') // DUPLICATE_REPLAY도 수락
  await flush()
  assert.equal(t.last().status, null) // 옛 수치를 현재 현황으로 보여주지 않는다
  t.setQueue(s(3))
  t.tick()
  await flush()
  assert.equal(t.last().status.myTicketCount, 3)
})

test('원래 응모가 이미 반영된 뒤 DUPLICATE_REPLAY가 오면 바로 보여준다', async () => {
  const t = await loaded({ responses: [s(2)] })
  t.controller.beginEntry('r1', 1) // 필요 수치 3
  t.setQueue(s(3)) // 첫 요청은 응답을 못 받았지만 이미 반영됐고, 그 값을 주기 조회가 먼저 받는다
  t.tick()
  await flush()
  t.controller.beginEntry('r1', 1) // 재시도: 이때 기준을 다시 잡으면(3 + 1) 4를 영원히 기다리게 된다
  t.controller.acceptEntry('r1')
  await flush()
  assert.equal(t.last().status.myTicketCount, 3)
  assert.equal(t.last().failed, false)
})

test('기준이 없었어도 realtime(Redis 집계, 수락 기준) 응답이면 바로 보여준다', async () => {
  const t = setup({ responses: [new Error('500')], maxRetries: 2 })
  t.controller.sync({ live: true })
  await flush()
  t.setQueue(s(5, { realtime: true }))
  t.controller.beginEntry('r1', 1)
  t.controller.acceptEntry('r1')
  await flush()
  assert.equal(t.last().status.myTicketCount, 5)
  assert.equal(t.calls(), 2) // 첫 조회(실패) + 수락 후 한 번
})

test('응모 시작 때 기준이 없었으면 숫자로 확인할 수 없어, 유예 시간이 지난 응답에서만 보여준다', async () => {
  const grace = 15_000
  const t = setup({ responses: [new Error('500')], maxRetries: 2, unverifiedGraceMs: grace })
  t.controller.sync({ live: true })
  await flush()
  assert.equal(t.last().failed, true) // 현황을 한 번도 받지 못함
  t.setQueue(s(5)) // 이 값이 응모를 포함하는지 알 수 없다
  t.controller.beginEntry('r1', 1) // 기준 없음
  const acceptedAt = t.clock()
  t.controller.acceptEntry('r1')
  await flush()
  const shown = t.views.filter((v) => v.at >= acceptedAt && v.status !== null)
  assert.ok(shown.length > 0) // 재시도가 유예 시간만큼 이어져 결국 보여준다
  assert.ok(shown.every((v) => v.at - acceptedAt >= grace)) // 유예 시간 전에는 한 번도 보여주지 않았다
  assert.equal(shown[0].status.myTicketCount, 5)
})

test('겹친 조회에서는 가장 최근에 시작한 요청의 응답만 반영한다', async () => {
  const t = await loaded({ responses: [s(2)] })
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

test('응모 직후 재조회 도중 sync가 다시 불려도(live 변경 등) 확인 전에는 옛 수치를 보여주지 않는다', async () => {
  const t = await loaded({ responses: [s(2)] })
  t.setQueue(s(2))
  t.controller.beginEntry('r1', 1)
  t.controller.acceptEntry('r1')
  t.controller.sync({ live: false }) // 이벤트가 마감돼 live가 바뀐 경우
  await flush()
  assert.ok(t.views.slice(1).every((v) => v.status === null))
  t.setQueue(s(3))
  t.controller.sync({ live: false })
  await flush()
  assert.equal(t.last().status.myTicketCount, 3)
})

test('정리(dispose) 뒤에 도착한 응답은 반영하지 않고 주기 조회도 멈춘다', async () => {
  const t = setup({ responses: [s(2)] })
  let resolveLate
  t.state.fetchOverride = () => new Promise((resolve) => { resolveLate = resolve })
  t.controller.sync({ live: true })
  t.controller.dispose()
  resolveLate(s(8))
  await flush()
  assert.equal(t.views.length, 0)
  assert.equal(t.hasPoll(), false)
})

test('응모 직후 이벤트가 마감돼(live 아님) 재시도 안에 반영되지 않아도 주기 조회를 이어 가고, 반영되면 보여준 뒤 멈춘다', async () => {
  const t = setup({ responses: [s(2)] })
  t.controller.sync({ live: false })
  await flush()
  assert.equal(t.hasPoll(), false) // 마감 이벤트는 평소에는 주기 조회를 하지 않는다
  t.setQueue(s(2))
  t.controller.beginEntry('r1', 1)
  t.controller.acceptEntry('r1')
  await flush()
  assert.equal(t.last().status, null) // 재시도 안에 반영되지 않아 숨김
  assert.equal(t.hasPoll(), true) // 그래도 조회를 이어 간다
  t.setQueue(s(3))
  t.tick()
  await flush()
  assert.equal(t.last().status.myTicketCount, 3)
  t.tick()
  await flush()
  assert.equal(t.hasPoll(), false) // 확인했으니 마감 이벤트의 주기 조회는 멈춘다
})

test('마감 뒤 이어 가는 조회는 횟수가 제한되고, 포기한 뒤에는 retry()로 다시 확인할 수 있다', async () => {
  const t = setup({ responses: [s(2)], recoveryPolls: 2 })
  t.controller.sync({ live: false })
  await flush()
  t.setQueue(s(2))
  t.controller.beginEntry('r1', 1)
  t.controller.acceptEntry('r1')
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
  t.setQueue(s(5)) // 사용자가 다시 확인한다. 이번에는 반영돼 있다.
  t.controller.retry()
  await flush()
  assert.equal(t.last().status.myTicketCount, 5)
  assert.equal(t.last().failed, false)
})

test('진행 중(live)인 이벤트의 주기 조회는 횟수 제한 없이 계속된다', async () => {
  const t = await loaded({ responses: [s(2)], recoveryPolls: 1 })
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
  controller.sync({ live: true })
  assert.notEqual(tick, null)
  controller.dispose()
  assert.equal(tick, null)
})
