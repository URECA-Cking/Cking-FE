import test from 'node:test'
import assert from 'node:assert/strict'
import { currentImageKey, displayNickname, normalizeMe, normalizeNickname, validateNickname } from '../src/utils/nickname.js'

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

test('현재 사진 key는 응답의 profileImageKey를 우선하고 없으면 고정 URL의 끝에서 뽑는다', () => {
  assert.equal(currentImageKey({ profileImageKey: 'member-profile-images/7/a.jpg' }), 'member-profile-images/7/a.jpg')
  assert.equal(
    currentImageKey({ profileImageUrl: 'https://cdn.example.com/member-profile-images/7/0d5c-e2.jpg' }),
    'member-profile-images/7/0d5c-e2.jpg',
  )
  assert.equal(currentImageKey({ profileImageUrl: null }), null)
  assert.equal(currentImageKey({}), null)
  // key를 알 수 없는 URL은 null이라 화면이 저장을 막는다(null을 보내면 사진이 지워진다).
  assert.equal(currentImageKey({ profileImageUrl: 'https://cdn.example.com/other/path.jpg' }), null)
})

test('표시할 닉네임은 닉네임이 없으면 null이고 구버전 BE 응답에서만 name을 쓴다', () => {
  assert.equal(displayNickname({ nickname: '유니', profileConfigured: true, name: '홍길동' }), '유니')
  assert.equal(displayNickname({ nickname: null, profileConfigured: false, name: '홍길동' }), null)
  assert.equal(displayNickname({ name: '홍길동' }), '홍길동')
  assert.equal(displayNickname(null), null)
})

test('사진 key는 URL에 쿼리 문자열이나 해시가 붙어도 뽑는다', () => {
  const base = 'https://cdn.example.com/member-profile-images/7/0d5c-e2.jpg'
  assert.equal(currentImageKey({ profileImageUrl: `${base}?v=3&x=1` }), 'member-profile-images/7/0d5c-e2.jpg')
  assert.equal(currentImageKey({ profileImageUrl: `${base}#top` }), 'member-profile-images/7/0d5c-e2.jpg')
  assert.equal(currentImageKey({ profileImageUrl: `/member-profile-images/7/0d5c-e2.jpg?x=1` }), 'member-profile-images/7/0d5c-e2.jpg')
  assert.equal(
    currentImageKey({ profileImageUrl: 'http://localhost:9090/cking-local-uploads/member-profile-images/7/a.jpg' }),
    'member-profile-images/7/a.jpg',
  )
  assert.equal(currentImageKey({ profileImageUrl: 'not a url ::::' }), null)
})

test('BE가 profileSetupRequired를 내려주면 profileConfigured로 통일한다', () => {
  assert.equal(normalizeMe({ nickname: null, profileSetupRequired: true }).profileConfigured, false)
  assert.equal(normalizeMe({ nickname: '유니', profileSetupRequired: false }).profileConfigured, true)
  // 이미 profileConfigured가 있으면 그대로 둔다.
  assert.equal(normalizeMe({ profileConfigured: true, profileSetupRequired: true }).profileConfigured, true)
  // 두 필드가 모두 없으면(구버전 BE) 만들지 않는다.
  assert.equal('profileConfigured' in normalizeMe({ name: '홍길동' }), false)
  assert.equal(normalizeMe(null), null)
})

test('profileSetupRequired를 받은 닉네임 미설정 회원에게는 OAuth 이름을 보여주지 않는다', () => {
  const me = normalizeMe({ name: 'OAuth 이름', nickname: null, profileSetupRequired: true })
  assert.equal(displayNickname(me), null)
})

