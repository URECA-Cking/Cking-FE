import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccessTokenStore } from '../src/token.js'

test('Web과 Admin Access Token은 서로 다른 sessionStorage key에 보관한다', () => {
  const previousStorage = globalThis.sessionStorage
  const items = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  }
  try {
    const web = createAccessTokenStore('cking.accessToken')
    const admin = createAccessTokenStore('cking.admin.accessToken')
    web.setAccessToken('user-jwt', 60)
    admin.setAccessToken('admin-jwt', 60)
    assert.equal(web.getAccessToken(), 'user-jwt')
    assert.equal(admin.getAccessToken(), 'admin-jwt')
    web.clearAccessToken()
    assert.equal(web.getAccessToken(), null)
    assert.equal(admin.getAccessToken(), 'admin-jwt')
    assert.equal(createAccessTokenStore('cking.admin.accessToken').getAccessToken(), 'admin-jwt')
  } finally {
    globalThis.sessionStorage = previousStorage
  }
})

test('만료 여유 시간 안의 토큰은 사용하지 않는다', () => {
  const previousStorage = globalThis.sessionStorage
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  try {
    const store = createAccessTokenStore('token')
    store.setAccessToken('short-lived', 20)
    assert.equal(store.getAccessToken(), null)
  } finally {
    globalThis.sessionStorage = previousStorage
  }
})
