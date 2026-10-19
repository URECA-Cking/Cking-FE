import assert from 'node:assert/strict'
import test from 'node:test'
import { formatShortDate, formatEventDate, formatRelativeTime } from '../src/utils/format.js'
import { formatScheduleRange, formatScheduleTime } from '../src/utils/calendarGrid.js'

test('화면별 날짜 포맷은 공통 24시간제 표기를 사용한다', () => {
  const date = new Date(2026, 9, 20, 21, 5).toISOString()
  for (const format of [formatShortDate, formatEventDate, formatRelativeTime, formatScheduleTime]) {
    assert.equal(format(date), '26.10.20. 21시 05분')
    assert.equal(format(null), '-')
    assert.equal(format('invalid'), 'invalid')
  }
  assert.equal(formatShortDate(date, { withTime: true }), '26.10.20. 21시 05분')
})

test('일정 범위는 같은 날과 자정·월·연도 경계 모두 양 끝의 날짜와 시각을 표시한다', () => {
  for (const [start, end, expected] of [
    [new Date(2026, 9, 20, 9, 5), new Date(2026, 9, 20, 12), '26.10.20. 09시 05분 – 26.10.20. 12시 00분'],
    [new Date(2026, 11, 31, 23, 59), new Date(2027, 0, 1), '26.12.31. 23시 59분 – 27.01.01. 00시 00분'],
  ]) assert.equal(formatScheduleRange({ startAt: start.toISOString(), endAt: end.toISOString() }), expected)
})
