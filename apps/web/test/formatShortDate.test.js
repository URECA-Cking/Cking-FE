import assert from 'node:assert/strict'
import test from 'node:test'
import { formatShortDate } from '../src/utils/format.js'

test('짧은 날짜는 연도 두 자리·월·일·요일로 표시하고 값이 없으면 대시를 쓴다', () => {
  // 시간대와 무관하게 로컬 날짜를 만들어 넘긴다. 2026-10-21은 수요일이다.
  assert.equal(formatShortDate(new Date(2026, 9, 21, 12, 0).toISOString()), '26.10.21 (수)')
  assert.equal(formatShortDate(new Date(2027, 0, 3, 0, 5).toISOString()), '27.01.03 (일)')
  assert.equal(formatShortDate(null), '-')
})

test('이벤트 날짜의 시각은 12시간제(오전/오후)로 표시한다', async () => {
  const { formatEventDate } = await import('../src/utils/format.js')
  assert.equal(formatEventDate(new Date(2026, 9, 21, 15, 5).toISOString()), '2026.10.21 (수) 오후 03:05')
  assert.equal(formatEventDate(new Date(2026, 9, 21, 0, 5).toISOString()), '2026.10.21 (수) 오전 12:05')
  assert.equal(formatEventDate(new Date(2026, 9, 21, 12, 0).toISOString()), '2026.10.21 (수) 오후 12:00')
})

test('짧은 날짜에 withTime을 주면 12시간제 시각이 붙는다', () => {
  assert.equal(formatShortDate(new Date(2026, 9, 21, 15, 5).toISOString(), { withTime: true }), '26.10.21 (수) 오후 03:05')
})
