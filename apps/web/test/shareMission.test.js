import assert from 'node:assert/strict'
import test from 'node:test'

import { readShareAttempt } from '../src/utils/shareAttempts.js'
import { canRequestShareReward, requestShareReward } from '../src/utils/shareMission.js'

const apiError = (code, status) => ({ code, status })
const UUIDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
]
const ids = () => {
  let n = 0
  return () => UUIDS[n++]
}
function memoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
}
const accepted = { code: 'EARN_ACCEPTED', data: { rewardAmount: 1 } }
const unknownFailure = async () => {
  throw apiError('EARN_STATUS_UNKNOWN', 504)
}

test('신규 적립이면 보상액을 돌려주고 보관한 requestId를 지운다', async () => {
  const storage = memoryStorage()
  const calls = []
  const result = await requestShareReward({
    memberId: 1,
    creatorId: 7,
    complete: async (creatorId, requestId) => {
      calls.push([creatorId, requestId])
      // 요청을 보내기 전에 이미 저장돼 있어야 응답 전에 화면이 닫혀도 복구할 수 있다.
      assert.deepEqual(readShareAttempt(1, 7, storage), { requestId })
      return accepted
    },
    newId: ids(),
    storage,
  })
  assert.deepEqual(result, { status: 'earned', rewardAmount: 1 })
  assert.deepEqual(calls, [[7, UUIDS[0]]])
  assert.equal(readShareAttempt(1, 7, storage), null)
})

test('같은 requestId 재전송(ALREADY_PROCESSED)은 새 적립이 아니라 완료(done)로 돌려준다', async () => {
  const storage = memoryStorage()
  const result = await requestShareReward({
    memberId: 1,
    creatorId: 7,
    complete: async () => ({ code: 'ALREADY_PROCESSED', data: { rewardAmount: 1 } }),
    newId: ids(),
    storage,
  })
  assert.deepEqual(result, { status: 'done' })
  assert.equal(readShareAttempt(1, 7, storage), null)
})

test('DUPLICATE_MISSION은 승인 확정이 아니므로 완료가 아니라 확인 필요(unconfirmed)로 돌려준다', async () => {
  const storage = memoryStorage()
  const result = await requestShareReward({
    memberId: 1,
    creatorId: 7,
    complete: async () => {
      throw apiError('DUPLICATE_MISSION', 409)
    },
    newId: ids(),
    storage,
  })
  assert.deepEqual(result, { status: 'unconfirmed' })
  assert.equal(readShareAttempt(1, 7, storage), null)
})

test('승인 여부를 모르는 실패 뒤 같은 크리에이터의 재시도는 같은 requestId를 쓴다', async () => {
  const storage = memoryStorage()
  const newId = ids()
  const seen = []
  const first = await requestShareReward({
    memberId: 1,
    creatorId: 7,
    complete: async (_creatorId, requestId) => {
      seen.push(requestId)
      return unknownFailure()
    },
    newId,
    storage,
  })
  assert.equal(first.status, 'failed')
  assert.deepEqual(readShareAttempt(1, 7, storage), { requestId: UUIDS[0] })

  const second = await requestShareReward({
    memberId: 1,
    creatorId: 7,
    complete: async (_creatorId, requestId) => {
      seen.push(requestId)
      return accepted
    },
    newId,
    storage,
  })
  assert.equal(second.status, 'earned')
  assert.deepEqual(seen, [UUIDS[0], UUIDS[0]])
  assert.equal(readShareAttempt(1, 7, storage), null)
})

test('A의 승인 불명 요청 뒤 B를 정상 지급하고 A로 돌아와도 A의 최초 requestId를 쓴다', async () => {
  const storage = memoryStorage()
  const newId = ids()
  await requestShareReward({ memberId: 1, creatorId: 7, complete: unknownFailure, newId, storage })
  const b = await requestShareReward({ memberId: 1, creatorId: 8, complete: async () => accepted, newId, storage })
  assert.equal(b.status, 'earned')
  // B의 요청이 A의 보관분을 지우거나 덮어쓰지 않는다.
  assert.deepEqual(readShareAttempt(1, 7, storage), { requestId: UUIDS[0] })

  const seen = []
  await requestShareReward({
    memberId: 1,
    creatorId: 7,
    complete: async (_creatorId, requestId) => {
      seen.push(requestId)
      return accepted
    },
    newId,
    storage,
  })
  assert.deepEqual(seen, [UUIDS[0]])
})

test('다른 회원은 같은 크리에이터라도 이전 회원의 requestId를 쓰지 않는다', async () => {
  const storage = memoryStorage()
  const newId = ids()
  await requestShareReward({ memberId: 1, creatorId: 7, complete: unknownFailure, newId, storage })
  const seen = []
  await requestShareReward({
    memberId: 2,
    creatorId: 7,
    complete: async (_creatorId, requestId) => {
      seen.push(requestId)
      return accepted
    },
    newId,
    storage,
  })
  assert.deepEqual(seen, [UUIDS[1]])
})

test('서버가 처리하지 않았다고 알린 확정 실패는 requestId를 버린다', async () => {
  for (const [code, status] of [['MISSION_INACTIVE', 409], ['MISSION_NOT_FOUND', 404], ['REQUEST_ID_CONFLICT', 409]]) {
    const storage = memoryStorage()
    const result = await requestShareReward({
      memberId: 1,
      creatorId: 7,
      complete: async () => {
        throw apiError(code, status)
      },
      newId: ids(),
      storage,
    })
    assert.equal(result.status, 'failed', code)
    assert.equal(readShareAttempt(1, 7, storage), null, code)
  }
})

test('받지 않은 SHARE 미션이 있는 로그인한 팬의 스페이스에서만 요청한다', () => {
  const open = { authenticated: true, memberId: 1, isMine: false, ownershipKnown: true, mission: { completedToday: false } }
  assert.equal(canRequestShareReward(open), true)
  assert.equal(canRequestShareReward({ ...open, authenticated: false }), false)
  assert.equal(canRequestShareReward({ ...open, memberId: null }), false)
  assert.equal(canRequestShareReward({ ...open, isMine: true }), false)
  assert.equal(canRequestShareReward({ ...open, ownershipKnown: false }), false)
  assert.equal(canRequestShareReward({ ...open, mission: null }), false)
  assert.equal(canRequestShareReward({ ...open, mission: { completedToday: true } }), false)
})
