import assert from 'node:assert/strict'
import test from 'node:test'

import { RETRY_WITH_SAME_ID, keepsRequestId } from '../src/utils/earnRetry.js'

const apiError = (code, status) => ({ code, status })

test('결과를 모르는 실패 코드는 같은 requestId를 유지한다', () => {
  for (const code of ['NETWORK_ERROR', 'EARN_STATUS_UNKNOWN', 'EARN_PROCESSING_FAILED', 'BALANCE_MAINTENANCE']) {
    assert.equal(keepsRequestId(apiError(code, 503)), true, code)
  }
  assert.deepEqual(RETRY_WITH_SAME_ID, ['NETWORK_ERROR', 'EARN_STATUS_UNKNOWN', 'EARN_PROCESSING_FAILED', 'BALANCE_MAINTENANCE'])
})

test('ApiError가 아닌 예외와 응답 코드가 없는 오류는 처리 여부를 몰라 requestId를 유지한다', () => {
  assert.equal(keepsRequestId(new Error('연결 끊김')), true)
  assert.equal(keepsRequestId(null), true)
  // JSON이 아닌 502(프록시 HTML 오류)는 shared transport가 code를 undefined로 돌려준다.
  assert.equal(keepsRequestId(apiError(undefined, 502)), true)
  assert.equal(keepsRequestId(apiError(null, 400)), true)
})

test('코드가 있어도 HTTP 5xx면 서버가 처리 도중이었을 수 있어 requestId를 유지한다', () => {
  assert.equal(keepsRequestId(apiError('INTERNAL_SERVER_ERROR', 500)), true)
  assert.equal(keepsRequestId(apiError('BAD_GATEWAY', 502)), true)
})

test('성공(2xx) 응답인데 지급 승인 코드가 아니면 승인 여부를 몰라 requestId를 유지한다', () => {
  assert.equal(keepsRequestId(apiError('SUCCESS', 200)), true)
})

test('서버가 처리하지 않았다고 알린 4xx 확정 실패는 requestId를 버린다', () => {
  assert.equal(keepsRequestId(apiError('WELCOME_QUEST_WRONG_ANSWER', 409)), false)
  assert.equal(keepsRequestId(apiError('WELCOME_QUEST_CONDITION_NOT_MET', 409)), false)
  assert.equal(keepsRequestId(apiError('WELCOME_QUEST_ALREADY_CLAIMED', 409)), false)
  assert.equal(keepsRequestId(apiError('REQUEST_ID_CONFLICT', 409)), false)
  assert.equal(keepsRequestId(apiError('DUPLICATE_MISSION', 409)), false)
  assert.equal(keepsRequestId(apiError('VALIDATION_FAILED', 400)), false)
  assert.equal(keepsRequestId(apiError('WELCOME_QUEST_NOT_ELIGIBLE', 403)), false)
})
