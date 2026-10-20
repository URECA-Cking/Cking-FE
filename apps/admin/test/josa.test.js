import assert from 'node:assert/strict'
import test from 'node:test'
import { objectParticle } from '../src/utils/josa.js'

test('받침이 없으면 "를", 있으면 "을"을 고른다', () => {
  assert.equal(objectParticle('이벤트'), '를')
  assert.equal(objectParticle('“여름 팬미팅” 이벤트'), '를')
  assert.equal(objectParticle('열혈팬'), '을')
  assert.equal(objectParticle('댓글'), '을')
})

test('숫자는 읽는 소리 기준으로 판별하고, 끝의 기호는 건너뛴다', () => {
  assert.equal(objectParticle('제한 #12'), '를')
  assert.equal(objectParticle('차단 #7'), '을')
  assert.equal(objectParticle('Winner #10'), '을')
  assert.equal(objectParticle('“이벤트”'), '를')
})

test('판별할 수 없으면 "을(를)"로 둔다', () => {
  assert.equal(objectParticle('Event'), '을(를)')
  assert.equal(objectParticle(''), '을(를)')
  assert.equal(objectParticle(null), '을(를)')
})
