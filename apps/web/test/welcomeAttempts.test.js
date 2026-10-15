import assert from 'node:assert/strict'
import test from 'node:test'

import { attemptsKey, readAttempt, removeAttempt, writeAttempt } from '../src/utils/welcomeAttempts.js'

const ID = '550e8400-e29b-41d4-a716-446655440000'

/** 브라우저 저장소를 흉내 낸 메모리 저장소. */
function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

/** 접근할 때마다 오류를 던지는 저장소(비공개 창·차단 설정). */
const blockedStorage = {
  getItem() { throw new Error('blocked') },
  setItem() { throw new Error('blocked') },
  removeItem() { throw new Error('blocked') },
}

test('보존한 지급 시도의 requestId와 answer를 그대로 읽는다', () => {
  const storage = memoryStorage()
  writeAttempt(1, 'QUIZ', { requestId: ID, answer: true }, storage)
  assert.deepEqual(readAttempt(1, 'QUIZ', storage), { requestId: ID, answer: true })
  writeAttempt(1, 'SIGNUP', { requestId: ID }, storage)
  assert.deepEqual(readAttempt(1, 'SIGNUP', storage), { requestId: ID, answer: undefined })
})

test('회원·단계별로 따로 보존한다', () => {
  const storage = memoryStorage()
  writeAttempt(1, 'SIGNUP', { requestId: ID }, storage)
  assert.equal(readAttempt(2, 'SIGNUP', storage), null)
  assert.equal(readAttempt(1, 'FOLLOW', storage), null)
  assert.notEqual(attemptsKey(1), attemptsKey(2))
})

test('지우면 그 단계만 사라지고, 모두 지워지면 키도 지워진다', () => {
  const storage = memoryStorage()
  writeAttempt(1, 'SIGNUP', { requestId: ID }, storage)
  writeAttempt(1, 'FOLLOW', { requestId: '650e8400-e29b-41d4-a716-446655440000' }, storage)
  removeAttempt(1, 'SIGNUP', storage)
  assert.equal(readAttempt(1, 'SIGNUP', storage), null)
  assert.notEqual(readAttempt(1, 'FOLLOW', storage), null)
  removeAttempt(1, 'FOLLOW', storage)
  assert.equal(storage.getItem(attemptsKey(1)), null)
})

test('깨졌거나 모양이 틀린 저장 값은 버리고 새 시도를 만들게 한다', () => {
  const storage = memoryStorage()
  storage.setItem(attemptsKey(1), 'not json')
  assert.equal(readAttempt(1, 'SIGNUP', storage), null)
  storage.setItem(attemptsKey(1), JSON.stringify({ SIGNUP: { requestId: 'abc' }, QUIZ: { requestId: ID, answer: 'true' }, FOLLOW: [1] }))
  assert.equal(readAttempt(1, 'SIGNUP', storage), null)
  assert.equal(readAttempt(1, 'QUIZ', storage), null)
  assert.equal(readAttempt(1, 'FOLLOW', storage), null)
  storage.setItem(attemptsKey(1), JSON.stringify([1, 2]))
  assert.equal(readAttempt(1, 'SIGNUP', storage), null)
})

test('알 수 없는 단계나 회원이 없으면 읽지도 쓰지도 않는다', () => {
  const storage = memoryStorage()
  assert.equal(readAttempt(null, 'SIGNUP', storage), null)
  assert.equal(readAttempt(1, 'UNKNOWN', storage), null)
  writeAttempt(null, 'SIGNUP', { requestId: ID }, storage)
  assert.equal(storage.getItem(attemptsKey(null)), null)
})

test('저장소를 쓸 수 없어도 오류를 던지지 않는다', () => {
  assert.equal(readAttempt(1, 'SIGNUP', blockedStorage), null)
  assert.doesNotThrow(() => writeAttempt(1, 'SIGNUP', { requestId: ID }, blockedStorage))
  assert.doesNotThrow(() => removeAttempt(1, 'SIGNUP', blockedStorage))
  assert.equal(readAttempt(1, 'SIGNUP', null), null)
})
