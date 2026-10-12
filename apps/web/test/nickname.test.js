import test from 'node:test'
import assert from 'node:assert/strict'
import { displayNickname, normalizeNickname, validateNickname } from '../src/utils/nickname.js'

test('완성형 한글·영문·숫자·밑줄·하이픈 1~20자는 통과한다', () => {
  for (const nickname of ['유니', 'Yuni_01', 'a-b', '1', '가'.repeat(20), 'A'.repeat(20)]) {
    assert.equal(validateNickname(nickname), null, nickname)
  }
})

test('빈 값·20자 초과·공백·자모 단독·전각·특수문자는 거절한다', () => {
  for (const nickname of ['', ' ', '유 니', ' 유니', '유니 ', '가'.repeat(21), 'ㅅㅂ', 'ㅋ', '유ㄴ', 'ＡＢＣ', '유니!', '유니.', '😀']) {
    assert.notEqual(validateNickname(nickname), null, JSON.stringify(nickname))
  }
})

test('분해된 한글은 NFC로 합쳐 검증한다', () => {
  const decomposed = '한글'.normalize('NFD')
  assert.notEqual(decomposed, '한글')
  assert.equal(normalizeNickname(decomposed), '한글')
  assert.equal(validateNickname(decomposed), null)
})

test('표시할 닉네임은 닉네임이 없으면 null이고 구버전 BE 응답에서만 name을 쓴다', () => {
  assert.equal(displayNickname({ nickname: '유니', profileConfigured: true, name: '홍길동' }), '유니')
  assert.equal(displayNickname({ nickname: null, profileConfigured: false, name: '홍길동' }), null)
  assert.equal(displayNickname({ name: '홍길동' }), '홍길동')
  assert.equal(displayNickname(null), null)
})

test('닉네임 미설정(profileConfigured=false) 회원에게는 OAuth 이름을 보여주지 않는다', () => {
  assert.equal(displayNickname({ name: 'OAuth 이름', nickname: null, profileConfigured: false }), null)
})
