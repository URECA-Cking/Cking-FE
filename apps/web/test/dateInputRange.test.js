import test from 'node:test'
import assert from 'node:assert/strict'
import { isDateInputInRange } from '../src/utils/dateInputRange.js'

test('2000~2099년의 datetime-local 값만 받는다', () => {
  for (const value of ['2000-01-01T00:00', '2026-10-25T09:30', '2099-12-31T23:59', '2026-10-25T09:30:15']) {
    assert.equal(isDateInputInRange(value), true, value)
  }
  for (const value of ['1999-12-31T23:59', '2100-01-01T00:00', '10000-12-25T01:01', '275760-09-13T00:00', '', null, undefined, '2026-10-25']) {
    assert.equal(isDateInputInRange(value), false, String(value))
  }
})
