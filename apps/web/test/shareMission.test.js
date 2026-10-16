import assert from 'node:assert/strict'
import test from 'node:test'

import { canRequestShareReward, requestShareReward } from '../src/utils/shareMission.js'

const apiError = (code, status) => ({ code, status })
const ids = () => {
  let n = 0
  return () => `id-${++n}`
}

test('신규 적립이면 보상액을 돌려주고 보관한 requestId를 비운다', async () => {
  const pending = { current: null }
  const calls = []
  const result = await requestShareReward({
    pending,
    creatorId: 7,
    complete: async (creatorId, requestId) => {
      calls.push([creatorId, requestId])
      return { code: 'EARN_ACCEPTED', data: { rewardAmount: 1 } }
    },
    newId: ids(),
  })
  assert.deepEqual(result, { status: 'earned', rewardAmount: 1 })
  assert.deepEqual(calls, [[7, 'id-1']])
  assert.equal(pending.current, null)
})

test('같은 requestId 재전송(ALREADY_PROCESSED)은 새 적립이 아니라 완료(done)로 돌려준다', async () => {
  const pending = { current: { creatorId: 7, requestId: 'id-1' } }
  const result = await requestShareReward({
    pending,
    creatorId: 7,
    complete: async () => ({ code: 'ALREADY_PROCESSED', data: { rewardAmount: 1 } }),
    newId: ids(),
  })
  assert.deepEqual(result, { status: 'done' })
  assert.equal(pending.current, null)
})

test('다른 requestId로 이미 받은 DUPLICATE_MISSION은 오류가 아니라 완료로 처리한다', async () => {
  const pending = { current: null }
  const result = await requestShareReward({
    pending,
    creatorId: 7,
    complete: async () => {
      throw apiError('DUPLICATE_MISSION', 409)
    },
    newId: ids(),
  })
  assert.deepEqual(result, { status: 'done' })
  assert.equal(pending.current, null)
})

test('승인 여부를 모르는 실패 뒤 같은 크리에이터의 재시도는 같은 requestId를 쓴다', async () => {
  const pending = { current: null }
  const newId = ids()
  const seen = []
  const failing = async (_creatorId, requestId) => {
    seen.push(requestId)
    throw apiError('EARN_STATUS_UNKNOWN', 504)
  }
  const first = await requestShareReward({ pending, creatorId: 7, complete: failing, newId })
  assert.equal(first.status, 'failed')
  assert.deepEqual(pending.current, { creatorId: 7, requestId: 'id-1' })

  const second = await requestShareReward({
    pending,
    creatorId: 7,
    complete: async (_creatorId, requestId) => {
      seen.push(requestId)
      return { code: 'EARN_ACCEPTED', data: { rewardAmount: 1 } }
    },
    newId,
  })
  assert.equal(second.status, 'earned')
  assert.deepEqual(seen, ['id-1', 'id-1'])
  assert.equal(pending.current, null)
})

test('다른 크리에이터로 옮기면 보관한 requestId를 쓰지 않는다', async () => {
  const pending = { current: { creatorId: 7, requestId: 'old' } }
  const seen = []
  await requestShareReward({
    pending,
    creatorId: 8,
    complete: async (_creatorId, requestId) => {
      seen.push(requestId)
      return { code: 'EARN_ACCEPTED', data: {} }
    },
    newId: ids(),
  })
  assert.deepEqual(seen, ['id-1'])
})

test('서버가 처리하지 않았다고 알린 확정 실패는 requestId를 버린다', async () => {
  for (const [code, status] of [['MISSION_INACTIVE', 409], ['MISSION_NOT_FOUND', 404], ['REQUEST_ID_CONFLICT', 409]]) {
    const pending = { current: null }
    const result = await requestShareReward({
      pending,
      creatorId: 7,
      complete: async () => {
        throw apiError(code, status)
      },
      newId: ids(),
    })
    assert.equal(result.status, 'failed', code)
    assert.equal(pending.current, null, code)
  }
})

test('받지 않은 SHARE 미션이 있는 로그인한 팬의 스페이스에서만 요청한다', () => {
  const open = { authenticated: true, isMine: false, ownershipKnown: true, mission: { completedToday: false } }
  assert.equal(canRequestShareReward(open), true)
  assert.equal(canRequestShareReward({ ...open, authenticated: false }), false)
  assert.equal(canRequestShareReward({ ...open, isMine: true }), false)
  assert.equal(canRequestShareReward({ ...open, ownershipKnown: false }), false)
  assert.equal(canRequestShareReward({ ...open, mission: null }), false)
  assert.equal(canRequestShareReward({ ...open, mission: { completedToday: true } }), false)
})
