import test from 'node:test'
import assert from 'node:assert/strict'
import { parseServerTime } from '../src/utils/serverTime.js'

test('오프셋이 있는 시각은 그대로 읽는다', () => {
  assert.equal(parseServerTime('2026-10-26T12:00:00Z').toISOString(), '2026-10-26T12:00:00.000Z')
  assert.equal(parseServerTime('2026-10-26T21:00:00+09:00').toISOString(), '2026-10-26T12:00:00.000Z')
  assert.equal(parseServerTime('2026-10-26T12:00:00.123456Z').getUTCMilliseconds(), 123)
})

test('시간대가 없는 시각은 UTC로 읽어 현지 시간으로 어긋나지 않는다', () => {
  assert.equal(parseServerTime('2026-10-26T12:00:00').toISOString(), '2026-10-26T12:00:00.000Z')
  assert.equal(parseServerTime('2026-10-26T12:00:00.500').toISOString(), '2026-10-26T12:00:00.500Z')
})

test('비어 있거나 읽을 수 없는 값은 null이다', () => {
  assert.equal(parseServerTime(null), null)
  assert.equal(parseServerTime(undefined), null)
  assert.equal(parseServerTime(''), null)
  assert.equal(parseServerTime('내일'), null)
})

test('이미 Date면 그대로 돌려준다', () => {
  const date = new Date('2026-10-26T12:00:00Z')
  assert.equal(parseServerTime(date), date)
})
