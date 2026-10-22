import assert from 'node:assert/strict'
import test from 'node:test'

import { readShareAttempt, removeShareAttempt, shareAttemptsKey, writeShareAttempt } from '../src/utils/shareAttempts.js'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    has: (key) => map.has(key),
  }
}

test('크리에이터별로 requestId를 따로 보관해 서로 덮어쓰지 않는다', () => {
  const storage = memoryStorage()
  writeShareAttempt(1, 10, { requestId: A }, storage)
  writeShareAttempt(1, 20, { requestId: B }, storage)
  assert.deepEqual(readShareAttempt(1, 10, storage), { requestId: A })
  assert.deepEqual(readShareAttempt(1, 20, storage), { requestId: B })
})

test('회원이 다르면 같은 크리에이터라도 requestId를 공유하지 않는다', () => {
  const storage = memoryStorage()
  writeShareAttempt(1, 10, { requestId: A }, storage)
  assert.equal(readShareAttempt(2, 10, storage), null)
  assert.notEqual(shareAttemptsKey(1), shareAttemptsKey(2))
})

test('한 크리에이터의 요청을 지워도 다른 크리에이터의 요청은 남고, 모두 지우면 키를 없앤다', () => {
  const storage = memoryStorage()
  writeShareAttempt(1, 10, { requestId: A }, storage)
  writeShareAttempt(1, 20, { requestId: B }, storage)
  removeShareAttempt(1, 10, storage)
  assert.equal(readShareAttempt(1, 10, storage), null)
  assert.deepEqual(readShareAttempt(1, 20, storage), { requestId: B })
  removeShareAttempt(1, 20, storage)
  assert.equal(storage.has(shareAttemptsKey(1)), false)
})

test('깨졌거나 UUID가 아닌 값은 버리고, 저장소를 못 써도 오류를 던지지 않는다', () => {
  const broken = memoryStorage({ [shareAttemptsKey(1)]: '{not json' })
  assert.equal(readShareAttempt(1, 10, broken), null)
  const invalid = memoryStorage({ [shareAttemptsKey(1)]: JSON.stringify({ 10: { requestId: 'abc' } }) })
  assert.equal(readShareAttempt(1, 10, invalid), null)
  const throwing = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
    removeItem: () => { throw new Error('blocked') },
  }
  assert.equal(readShareAttempt(1, 10, throwing), null)
  assert.doesNotThrow(() => writeShareAttempt(1, 10, { requestId: A }, throwing))
  assert.doesNotThrow(() => removeShareAttempt(1, 10, throwing))
  assert.equal(readShareAttempt(null, 10, memoryStorage()), null)
})
