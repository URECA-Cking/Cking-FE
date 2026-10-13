import test from 'node:test'
import assert from 'node:assert/strict'
import { pickFields, spaceUpdateBody } from '../src/utils/spaceProfile.js'

const base = { introText: '소개', profileImageUrl: 'https://cdn.example.com/p.png', bannerImageUrl: 'https://cdn.example.com/b.png' }

test('사진을 바꾸지 않으면 profileImageKey를 보내지 않아 BE가 현재 사진을 유지한다', () => {
  const body = spaceUpdateBody({ ...base, profileImageKey: undefined })
  assert.equal('profileImageKey' in body, false)
  assert.deepEqual(body, base)
})

test('새로 올린 사진은 key로 보낸다', () => {
  assert.equal(spaceUpdateBody({ ...base, profileImageKey: 'creator-space-profile-images/42/a.jpg' }).profileImageKey, 'creator-space-profile-images/42/a.jpg')
})

test('기본 이미지로 되돌리려면 null을 명시해서 보낸다', () => {
  const body = spaceUpdateBody({ ...base, profileImageKey: null })
  assert.equal('profileImageKey' in body, true)
  assert.equal(body.profileImageKey, null)
})

test('소개·프로필 이미지 URL·배너 URL은 사진 변경과 관계없이 항상 보낸다(BE에서 필수)', () => {
  for (const profileImageKey of [undefined, null, 'k']) {
    const body = spaceUpdateBody({ ...base, profileImageKey })
    assert.equal(body.introText, '소개')
    assert.equal(body.profileImageUrl, base.profileImageUrl)
    assert.equal(body.bannerImageUrl, base.bannerImageUrl)
  }
})

test('저장 응답에서 담당 필드만 고른다', () => {
  const response = { creatorName: '새 이름', slug: 'a', introText: '소개', profileImageUrl: 'https://cdn/p.png', bannerImageUrl: 'https://cdn/b.png', slugChangeableAt: null }
  assert.deepEqual(pickFields(response, ['introText', 'profileImageUrl', 'bannerImageUrl']), {
    introText: '소개', profileImageUrl: 'https://cdn/p.png', bannerImageUrl: 'https://cdn/b.png',
  })
  // 값이 null인 필드(예: slugChangeableAt)는 응답에 있는 값이므로 그대로 담는다.
  assert.deepEqual(pickFields(response, ['slug', 'slugChangeableAt']), { slug: 'a', slugChangeableAt: null })
})

test('응답에 없는 필드와 빈 응답은 담지 않는다', () => {
  assert.deepEqual(pickFields({ slug: 'a' }, ['slug', 'slugChangeableAt']), { slug: 'a' })
  assert.deepEqual(pickFields(null, ['slug']), {})
  assert.deepEqual(pickFields(undefined, ['slug']), {})
})
