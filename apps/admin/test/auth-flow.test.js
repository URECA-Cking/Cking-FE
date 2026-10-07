import test from 'node:test'
import assert from 'node:assert/strict'
import { get, refreshAccessToken } from '../src/api/client.js'
import { getMe, login, logout } from '../src/api/auth.js'
import { clearAccessToken, getAccessToken, setAccessToken } from '../src/api/token.js'

function response(status, data, code = 'SUCCESS') {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify({ code, data, message: code === 'SUCCESS' ? undefined : code }),
  }
}

function installSessionStorage() {
  const items = new Map()
  const previousStorage = globalThis.sessionStorage
  globalThis.sessionStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  }
  return () => { globalThis.sessionStorage = previousStorage }
}

test('관리자 로그인부터 401 Refresh 재시도와 로그아웃까지 인증 흐름을 수행한다', async () => {
  const restoreStorage = installSessionStorage()
  const previousFetch = globalThis.fetch
  const requests = []
  let protectedRequestCount = 0
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname
    requests.push({ path, options })
    if (path === '/api/auth/admin/login') return response(200, { accessToken: 'login-token', expiresIn: 3600 })
    if (path === '/api/me') return response(200, { role: 'ADMIN', name: 'admin' })
    if (path === '/api/admin/events/pending') {
      protectedRequestCount += 1
      return protectedRequestCount === 1 ? response(401, null, 'UNAUTHORIZED') : response(200, [{ eventId: 1 }])
    }
    if (path === '/api/admin/auth/refresh') return response(200, { accessToken: 'refreshed-token', expiresIn: 3600 })
    if (path === '/api/admin/auth/logout') return response(200, null)
    throw new Error(`unexpected request: ${path}`)
  }
  try {
    await login('admin', 'password')
    assert.equal(getAccessToken(), 'login-token')
    assert.equal((await getMe()).role, 'ADMIN')
    assert.deepEqual(await get('/api/admin/events/pending'), [{ eventId: 1 }])
    await logout()

    assert.equal(getAccessToken(), null)
    assert.deepEqual(requests.map(({ path }) => path), [
      '/api/auth/admin/login',
      '/api/me',
      '/api/admin/events/pending',
      '/api/admin/auth/refresh',
      '/api/admin/events/pending',
      '/api/admin/auth/logout',
    ])
    assert.equal(requests[3].options.headers.Authorization, 'Bearer login-token')
    assert.equal(requests[4].options.headers.Authorization, 'Bearer refreshed-token')
  } finally {
    clearAccessToken()
    globalThis.fetch = previousFetch
    restoreStorage()
  }
})

test('403 응답은 관리자 Refresh를 호출하지 않는다', async () => {
  const restoreStorage = installSessionStorage()
  const previousFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname
    requests.push(path)
    return response(403, null, 'FORBIDDEN')
  }
  try {
    setAccessToken('admin-token', 3600)
    await assert.rejects(get('/api/admin/events/pending'), (error) => error.code === 'FORBIDDEN')
    assert.deepEqual(requests, ['/api/admin/events/pending'])
  } finally {
    clearAccessToken()
    globalThis.fetch = previousFetch
    restoreStorage()
  }
})

test('로그아웃 중 늦게 도착한 Refresh 응답은 세션을 되살리지 못한다', async () => {
  const restoreStorage = installSessionStorage()
  const previousFetch = globalThis.fetch
  const requests = []
  let resolveRefresh
  globalThis.fetch = (url) => {
    const path = new URL(url).pathname
    requests.push(path)
    if (path === '/api/admin/auth/refresh') {
      return new Promise((resolve) => { resolveRefresh = () => resolve(response(200, { accessToken: 'late-token', expiresIn: 3600 })) })
    }
    if (path === '/api/admin/auth/logout') return Promise.resolve(response(200, null))
    throw new Error(`unexpected request: ${path}`)
  }
  try {
    setAccessToken('old-token', 3600)
    const refresh = refreshAccessToken()
    const signingOut = logout()
    assert.equal(getAccessToken(), null)

    resolveRefresh()
    assert.equal(await refresh, false)
    await signingOut

    assert.equal(getAccessToken(), null)
    assert.deepEqual(requests, ['/api/admin/auth/refresh', '/api/admin/auth/logout'])
  } finally {
    clearAccessToken()
    globalThis.fetch = previousFetch
    restoreStorage()
  }
})
