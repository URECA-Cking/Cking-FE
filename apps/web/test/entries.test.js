import assert from 'node:assert/strict'
import test from 'node:test'

import { describeEntryResult } from '../src/utils/entryResult.js'

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
