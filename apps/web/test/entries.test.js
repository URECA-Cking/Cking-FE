import assert from 'node:assert/strict'
import test from 'node:test'

import {
  describeEntryResult,
  requiresSameRequestRetry,
  restorePendingEntryAttempt,
} from '../src/utils/entryResult.js'

test('네트워크 예외는 동일 요청 재시도용 실패 결과로 바꾼다', () => {
  const outcome = describeEntryResult({ code: 'NETWORK_ERROR', message: '연결이 끊겼습니다.' })

  assert.deepEqual(outcome, {
    code: 'NETWORK_ERROR',
    accepted: false,
    tone: 'error',
    message: '백엔드 서버에 연결할 수 없어요.',
  })
})

test('멱등 재전송 성공은 기존처럼 수락 결과로 유지한다', () => {
  const outcome = describeEntryResult({ ok: true, code: 'DUPLICATE_REPLAY' })

  assert.deepEqual(outcome, {
    code: 'DUPLICATE_REPLAY',
    accepted: true,
    tone: 'success',
    message: '이미 접수된 응모예요. 중복으로 차감되지 않았습니다.',
  })
})

test('네트워크 오류 뒤 시트를 다시 열어도 동일 요청 내용으로 재시도한다', () => {
  const outcome = describeEntryResult({ code: 'NETWORK_ERROR' })
  const pendingEntry = {
    eventId: 42,
    requestId: 'e5aee895-11cb-42d9-8e4c-8cd2385707f4',
    attempt: { couponType: 'CREATOR', count: 3, balance: 7 },
    outcome,
  }

  assert.equal(requiresSameRequestRetry(outcome), true)
  assert.deepEqual(restorePendingEntryAttempt(pendingEntry, 42), pendingEntry)
  assert.equal(restorePendingEntryAttempt(pendingEntry, 99), null)
})

test('멱등 재전송 성공은 미확정 요청 보관 대상이 아니다', () => {
  const outcome = describeEntryResult({ ok: true, code: 'DUPLICATE_REPLAY' })

  assert.equal(requiresSameRequestRetry(outcome), false)
})
