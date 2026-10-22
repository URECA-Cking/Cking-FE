import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PREVIOUS_SLUG_TTL_MS,
  forgetPreviousSlug,
  readPreviousSlug,
  rememberPreviousSlug,
  selectRestorableSlug,
} from '../src/utils/previousSlug.js'

const NOW = Date.parse('2026-10-13T00:00:00Z')
const DAY = 24 * 60 * 60 * 1000

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

test('예약 기간(14일) 안이고 현재 주소와 다르면 되돌릴 주소로 보여준다', () => {
  assert.equal(selectRestorableSlug({ slug: 'old-name', at: NOW - 3 * DAY }, 'new-name', NOW), 'old-name')
})

test('14일이 지났으면 보여주지 않는다', () => {
  assert.equal(selectRestorableSlug({ slug: 'old-name', at: NOW - PREVIOUS_SLUG_TTL_MS }, 'new-name', NOW), null)
  assert.equal(selectRestorableSlug({ slug: 'old-name', at: NOW - PREVIOUS_SLUG_TTL_MS + 1 }, 'new-name', NOW), 'old-name')
})

test('현재 주소와 같거나 기록이 없거나 이상하면 보여주지 않는다', () => {
  assert.equal(selectRestorableSlug({ slug: 'same', at: NOW }, 'same', NOW), null)
  assert.equal(selectRestorableSlug(null, 'x', NOW), null)
  assert.equal(selectRestorableSlug({ slug: '', at: NOW }, 'x', NOW), null)
  assert.equal(selectRestorableSlug({ slug: 'a' }, 'x', NOW), null)
  assert.equal(selectRestorableSlug({ slug: 'a', at: NOW + DAY }, 'x', NOW), null)
})

test('기억한 이전 주소를 크리에이터별로 읽고 지운다', () => {
  const storage = memoryStorage()
  rememberPreviousSlug(7, 'creator-7', NOW, storage)
  assert.deepEqual(readPreviousSlug(7, storage), { slug: 'creator-7', at: NOW })
  assert.equal(readPreviousSlug(8, storage), null)
  forgetPreviousSlug(7, storage)
  assert.equal(readPreviousSlug(7, storage), null)
})

test('저장소를 쓸 수 없거나 값이 깨져 있어도 오류 없이 기억하지 않는다', () => {
  const broken = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
    removeItem: () => { throw new Error('blocked') },
  }
  assert.equal(readPreviousSlug(7, broken), null)
  assert.doesNotThrow(() => rememberPreviousSlug(7, 'x', NOW, broken))
  assert.doesNotThrow(() => forgetPreviousSlug(7, broken))
  const corrupted = { getItem: () => '{not json', setItem() {}, removeItem() {} }
  assert.equal(readPreviousSlug(7, corrupted), null)
})
