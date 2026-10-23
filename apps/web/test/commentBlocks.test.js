import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@cking/shared/api'
import {
  BLOCK_DAYS_PRESETS,
  BLOCK_STATUS_LABELS,
  blockStatus,
  commentBlockErrorMessage,
  parseBlockDays,
} from '../src/utils/commentBlocks.js'

test('차단 기간은 1~365 정수만 받는다', () => {
  assert.equal(parseBlockDays('1'), 1)
  assert.equal(parseBlockDays('365'), 365)
  assert.equal(parseBlockDays(' 30 '), 30)
  assert.equal(parseBlockDays('007'), 7)
  for (const text of ['0', '366', '-1', '1.5', '7일', '', ' ', 'abc', '１２', null, undefined]) {
    assert.equal(parseBlockDays(text), null, String(text))
  }
})

test('기간 프리셋은 모두 허용 범위 안이다', () => {
  for (const days of BLOCK_DAYS_PRESETS) assert.equal(parseBlockDays(String(days)), days)
})

test('BE 오류 코드별로 구분된 안내를 보여준다', () => {
  const message = (code) => commentBlockErrorMessage(new ApiError(code, '서버 메시지', 400), '기본')
  assert.match(message('CANNOT_BLOCK_SELF'), /자기 자신/)
  assert.match(message('CANNOT_BLOCK_ADMIN'), /관리자/)
  assert.match(message('VALIDATION_FAILED'), /1일 이상 365일 이하/)
  assert.match(message('FORBIDDEN'), /크리에이터/)
  assert.match(message('RESOURCE_NOT_FOUND'), /찾을 수 없어요/)
})

test('모르는 오류 코드와 ApiError가 아닌 오류는 서버 메시지 대신 기본 문구를 쓴다', () => {
  assert.equal(commentBlockErrorMessage(new ApiError('SOMETHING_ELSE', '서버 메시지', 500), '기본'), '기본')
  assert.equal(commentBlockErrorMessage(new ApiError('toString', '서버 메시지', 500), '기본'), '기본')
  assert.equal(commentBlockErrorMessage(new Error('boom'), '기본'), '기본')
})

test('차단 상태는 active와 releasedAt으로 가른다', () => {
  assert.equal(blockStatus({ active: true, releasedAt: null }), 'ACTIVE')
  assert.equal(blockStatus({ active: false, releasedAt: '2026-10-14T00:00:00Z' }), 'RELEASED')
  assert.equal(blockStatus({ active: false, releasedAt: null }), 'EXPIRED')
  for (const status of ['ACTIVE', 'RELEASED', 'EXPIRED']) assert.ok(BLOCK_STATUS_LABELS[status], status)
})
