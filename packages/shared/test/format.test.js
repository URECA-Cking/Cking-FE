import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDateTime } from '../src/format.js'

test('날짜·시간은 두 자리 연월일과 24시간 시·분을 사용한다', () => {
  for (const [hour, minute, expected] of [[0, 0, '00시 00분'], [9, 5, '09시 05분'], [12, 0, '12시 00분'], [21, 5, '21시 05분']]) {
    assert.equal(formatDateTime(new Date(2027, 0, 3, hour, minute)), `27.01.03. ${expected}`)
  }
})

test('누락과 잘못된 값은 기존 대체 표기를 유지한다', () => {
  assert.equal(formatDateTime(null), '-')
  assert.equal(formatDateTime(undefined), '-')
  assert.equal(formatDateTime(''), '-')
  assert.equal(formatDateTime('invalid'), 'invalid')
})
