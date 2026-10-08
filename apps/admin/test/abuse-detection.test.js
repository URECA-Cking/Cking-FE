import assert from 'node:assert/strict'
import test from 'node:test'
import {
  abuseStatusLabel,
  abuseTypeLabel,
  formatMaxDelay,
  formatWindow,
  scopeSummary,
  toUtcDateTime,
} from '../src/utils/abuseDetection.js'

test('Abuse Detection 상태와 유형을 관리자 표시 문구로 변환한다', () => {
  assert.equal(abuseStatusLabel('DETECTED'), '검토 대기')
  assert.equal(abuseStatusLabel('FALSE_POSITIVE'), '오탐 처리')
  assert.equal(abuseTypeLabel('RAPID_EARN_AND_SPEND'), '빠른 적립·사용')
})

test('Evidence Scope를 식별 가능한 관리자 요약으로 표시한다', () => {
  assert.equal(scopeSummary({
    type: 'USER_EVENT',
    creatorId: 4,
    eventId: 9,
    balanceScope: { type: 'COMMON', creatorId: null },
  }), '회원·이벤트 · Creator #4 · Event #9 · 공용 응모권')
  assert.equal(formatWindow({ windowMs: 1_000 }), '1초')
  assert.equal(formatWindow({ windowMs: 1_500 }), '1500ms')
  assert.equal(formatMaxDelay({ maxDelayMs: 3_000 }), '3초')
})

test('datetime-local 입력을 API UTC 시각으로 변환하고 빈 값은 보내지 않는다', () => {
  assert.equal(toUtcDateTime(''), undefined)
  assert.equal(toUtcDateTime('invalid'), undefined)
  const startOfMinute = toUtcDateTime('2026-10-08T12:30')
  assert.match(startOfMinute, /^2026-10-08T/)
  assert.equal(
    toUtcDateTime('2026-10-08T12:30', { endOfMinute: true }),
    `${startOfMinute.slice(0, 16)}:59.999999999Z`,
  )
})
