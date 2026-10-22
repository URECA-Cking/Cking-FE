import test from 'node:test'
import assert from 'node:assert/strict'
import { getSubscriptionVerificationImageReuse } from '../src/api/admin.js'
import { clearAccessToken, setAccessToken } from '../src/api/token.js'
import { ADMIN_NAVIGATION } from '../src/components/layout/adminNavigation.js'
import { imageReuseTypeMeta, parseVerificationId } from '../src/utils/subscriptionImageReuse.js'

function installSessionStorage() {
  const items = new Map()
  const previous = globalThis.sessionStorage
  globalThis.sessionStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  }
  return () => { globalThis.sessionStorage = previous }
}

test('Verification ID는 양의 안전 정수만 허용한다', () => {
  assert.equal(parseVerificationId(' 123 '), 123)
  assert.equal(parseVerificationId('0'), null)
  assert.equal(parseVerificationId('-1'), null)
  assert.equal(parseVerificationId('1.5'), null)
  assert.equal(parseVerificationId('9007199254740992'), null)
})

test('이미지 재사용 유형을 운영자용 문구로 변환한다', () => {
  assert.equal(imageReuseTypeMeta('FIRST_USE').label, '최초 사용')
  assert.equal(imageReuseTypeMeta('SAME_MEMBER_SAME_CREATOR').label, '동일 회원·동일 Creator 재사용')
  assert.equal(imageReuseTypeMeta('SAME_MEMBER_DIFFERENT_CREATOR').label, '동일 회원·다른 Creator 재사용')
  assert.equal(imageReuseTypeMeta('DIFFERENT_MEMBER').label, '다른 회원의 이미지 재사용')
  assert.equal(imageReuseTypeMeta('NEW_TYPE').label, 'NEW_TYPE')
})

test('관리자 API는 Verification ID를 경로에 넣고 ADMIN 인증으로 조회한다', async () => {
  const restoreStorage = installSessionStorage()
  const previousFetch = globalThis.fetch
  const requests = []
  const expected = {
    verificationId: 123,
    matchedVerificationId: 100,
    reuseType: 'DIFFERENT_MEMBER',
    detectedAt: '2026-10-16T01:00:00Z',
  }
  globalThis.fetch = async (url, options) => {
    requests.push({ url: new URL(url), options })
    return { ok: true, status: 200, text: async () => JSON.stringify({ code: 'SUCCESS', data: expected }) }
  }

  try {
    setAccessToken('admin-token', 3600)
    assert.deepEqual(await getSubscriptionVerificationImageReuse(123), expected)
    assert.equal(requests[0].url.pathname, '/api/admin/subscription-verifications/123/image-reuse')
    assert.equal(requests[0].options.method, 'GET')
    assert.equal(requests[0].options.headers.Authorization, 'Bearer admin-token')
    assert.equal(requests[0].options.credentials, 'include')
  } finally {
    clearAccessToken()
    globalThis.fetch = previousFetch
    restoreStorage()
  }
})

test('운영 관리 사이드바에 구독 인증 재사용 보호 화면 진입점을 제공한다', () => {
  const operations = ADMIN_NAVIGATION.find((section) => section.label === '운영 관리')
  const item = operations.items.find(({ to }) => to === '/admin/subscription-verifications/image-reuse')
  assert.equal(item.label, '구독 인증 재사용')
  assert.equal(item.matches({ pathname: item.to }), true)
})
