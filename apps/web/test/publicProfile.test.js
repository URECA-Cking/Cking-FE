import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OPEN_SPACE_EDIT_STATE,
  activityNameMissing,
  isCreatorAccount,
  needsNicknameSetup,
  ownPublicProfile,
} from '../src/utils/publicProfile.js'

const fan = (overrides = {}) => ({ nickname: '팬닉', profileImageUrl: 'https://img/fan', profileConfigured: true, creator: null, ...overrides })
const creator = (overrides = {}) => ({ nickname: null, profileImageUrl: null, profileConfigured: false, creator: { creatorId: 7 }, ...overrides })

test('creator 필드가 있어야 크리에이터 계정으로 본다', () => {
  assert.equal(isCreatorAccount(creator()), true)
  assert.equal(isCreatorAccount(fan()), false)
  assert.equal(isCreatorAccount(null), false)
  assert.equal(isCreatorAccount({ creator: undefined }), false)
})

test('닉네임이 없는 팬만 닉네임 설정이 필요하다', () => {
  assert.equal(needsNicknameSetup(fan({ profileConfigured: false, nickname: null })), true)
  assert.equal(needsNicknameSetup(fan()), false)
})

test('닉네임이 없어도 크리에이터는 닉네임 설정이 필요하지 않다(BE가 막고 활동명이 공개 이름이다)', () => {
  assert.equal(needsNicknameSetup(creator()), false)
})

test('profileConfigured를 내려주지 않는 구버전 BE는 설정이 필요하다고 단정하지 않는다', () => {
  assert.equal(needsNicknameSetup({ name: '구버전' }), false)
  assert.equal(needsNicknameSetup(null), false)
})

test('팬의 내 프로필은 Member 닉네임·사진이다', () => {
  assert.deepEqual(ownPublicProfile(fan(), { creatorName: '무시', profileImageUrl: 'https://img/space' }), {
    name: '팬닉',
    photo: 'https://img/fan',
    creator: false,
  })
})

test('크리에이터의 내 프로필은 스페이스의 활동명·사진이고 Member 닉네임·사진은 쓰지 않는다', () => {
  const user = creator({ nickname: '옛닉네임', profileImageUrl: 'https://img/member' })
  assert.deepEqual(ownPublicProfile(user, { creatorName: '활동명', profileImageUrl: 'https://img/space' }), {
    name: '활동명',
    photo: 'https://img/space',
    creator: true,
  })
})

test('크리에이터의 스페이스를 아직 못 받았으면 이름·사진을 비워 Member 값이 잠깐 보이지 않게 한다', () => {
  const user = creator({ nickname: '옛닉네임', profileImageUrl: 'https://img/member' })
  assert.deepEqual(ownPublicProfile(user, null), { name: null, photo: null, creator: true })
  assert.deepEqual(ownPublicProfile(user, undefined), { name: null, photo: null, creator: true })
})

test('스페이스가 없어도 활동명 응답이 있으면 이름은 활동명을 쓰고 사진은 비운다', () => {
  const user = creator({ nickname: '옛닉네임', profileImageUrl: 'https://img/member' })
  assert.deepEqual(ownPublicProfile(user, null, { activityName: '활동명' }), { name: '활동명', photo: null, creator: true })
  // 스페이스가 있으면 스페이스의 이름이 우선이다.
  assert.equal(ownPublicProfile(user, { creatorName: '스페이스 이름' }, { activityName: '활동명' }).name, '스페이스 이름')
})

test('스페이스에 사진이 없으면 사진만 null이다', () => {
  assert.deepEqual(ownPublicProfile(creator(), { creatorName: '활동명', profileImageUrl: null }), {
    name: '활동명',
    photo: null,
    creator: true,
  })
})

test('활동명 미설정은 응답이 명시적으로 false일 때만 미설정으로 본다', () => {
  assert.equal(activityNameMissing({ activityNameConfigured: false }), true)
  assert.equal(activityNameMissing({ activityNameConfigured: true }), false)
  assert.equal(activityNameMissing({}), false)
  assert.equal(activityNameMissing(null), false)
})

test('스페이스 편집 시트를 열라는 이동 상태는 홈 탭과 플래그를 담고 바꿀 수 없다', () => {
  assert.deepEqual({ ...OPEN_SPACE_EDIT_STATE }, { tab: 'home', openSpaceEdit: true })
  assert.equal(Object.isFrozen(OPEN_SPACE_EDIT_STATE), true)
})
