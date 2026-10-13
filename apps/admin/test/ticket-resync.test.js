import test from 'node:test'
import assert from 'node:assert/strict'
import { ticketBalanceChanged, ticketResyncError, ticketResyncState } from '../src/utils/ticketResync.js'

test('MySQL 행과 Redis 키의 존재 및 잔액 차이로 보정 가능 상태를 구분한다', () => {
  assert.equal(ticketResyncState({ mysqlBalanceRowExists: false, redisKeyExists: false }), 'NO_MYSQL')
  assert.equal(ticketResyncState({ mysqlBalanceRowExists: true, redisKeyExists: false, balanceDifference: null }), 'MISSING_REDIS')
  assert.equal(ticketResyncState({ mysqlBalanceRowExists: true, redisKeyExists: true, balanceDifference: 0 }), 'MATCHED')
  assert.equal(ticketResyncState({ mysqlBalanceRowExists: true, redisKeyExists: true, balanceDifference: -2 }), 'DIFFERENT')
  assert.equal(ticketResyncState({ mysqlBalanceRowExists: true, redisKeyExists: true, balanceDifference: null }), 'UNKNOWN')
})

test('잔액 변경은 값뿐 아니라 Redis 키의 존재 변화도 감지한다', () => {
  const before = { redisBalance: null, mysqlBalance: 5, redisKeyExists: false, mysqlBalanceRowExists: true, balanceDifference: null }
  assert.equal(ticketBalanceChanged(before, { ...before }), false)
  assert.equal(ticketBalanceChanged(before, { ...before, redisBalance: 5, redisKeyExists: true, balanceDifference: 0 }), true)
})

test('미반영 메시지와 동시 보정 거부를 다른 운영 조치로 안내한다', () => {
  assert.match(ticketResyncError({ code: 'INVALID_STATE' }), /Dead Stream/)
  assert.match(ticketResyncError({ code: 'CONCURRENT_COMMAND' }), /이미 진행 중/)
  assert.equal(ticketResyncError({ code: 'SYSTEM_ERROR' }), null)
})
