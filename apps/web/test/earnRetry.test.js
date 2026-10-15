import assert from 'node:assert/strict'
import test from 'node:test'

import { RETRY_WITH_SAME_ID, keepsRequestId } from '../src/utils/earnRetry.js'

test('결과를 모르는 실패 코드는 같은 requestId를 유지한다', () => {
  for (const code of ['NETWORK_ERROR', 'EARN_STATUS_UNKNOWN', 'EARN_PROCESSING_FAILED', 'BALANCE_MAINTENANCE']) {
    assert.equal(keepsRequestId(code), true, code)
  }
  assert.deepEqual(RETRY_WITH_SAME_ID, ['NETWORK_ERROR', 'EARN_STATUS_UNKNOWN', 'EARN_PROCESSING_FAILED', 'BALANCE_MAINTENANCE'])
})

test('ApiError가 아닌 예외(code가 null)는 처리 여부를 몰라 requestId를 유지한다', () => {
  assert.equal(keepsRequestId(null), true)
})

test('서버가 처리하지 않은 확정 실패는 requestId를 버린다', () => {
  for (const code of ['WELCOME_QUEST_WRONG_ANSWER', 'WELCOME_QUEST_CONDITION_NOT_MET', 'DUPLICATE_MISSION', 'VALIDATION_FAILED', undefined]) {
    assert.equal(keepsRequestId(code), false, String(code))
  }
})
