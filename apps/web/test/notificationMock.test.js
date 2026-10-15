import test from 'node:test'
import assert from 'node:assert/strict'
import { installMockApiIfRequested } from '../src/dev/mockApi.js'

test('개별·전체 읽음은 서버 모의 응답에 남고 새로고침 뒤에도 복원된다', async () => {
  const originalWindow = globalThis.window
  const originalStorage = globalThis.sessionStorage
  const storage = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  }
  globalThis.window = { location: new URL('http://localhost:5173/?mock=blocked'), fetch: async () => { throw new Error('unexpected request') } }

  try {
    /** 설치된 모의 API에서 응답 봉투의 data를 읽는다. */
    const request = async (path, method = 'GET') => {
      const response = await window.fetch(path, { method })
      assert.equal(response.status, 200)
      return (await response.json()).data
    }

    installMockApiIfRequested()
    const before = await request('/api/me/notifications?page=0&size=1')
    assert.equal(before.items.length, 1)
    assert.equal(before.hasNext, true)
    assert.equal(before.items[0].readAt, null)

    const single = await request('/api/me/notifications/2/read', 'PATCH')
    assert.ok(single.readAt)
    assert.equal((await request('/api/me/notifications')).items[0].readAt, single.readAt)
    assert.equal((await request('/api/me/notifications/read', 'PATCH')).readCount, 0)

    globalThis.window = { location: new URL('http://localhost:5173/?mock=blocked'), fetch: async () => { throw new Error('unexpected request') } }
    installMockApiIfRequested()
    const afterReload = await request('/api/me/notifications')
    assert.equal(afterReload.items[0].readAt, single.readAt)
    assert.ok(afterReload.items[1].readAt)

    globalThis.window = { location: new URL('http://localhost:5173/?mock=1'), fetch: async () => { throw new Error('unexpected request') } }
    installMockApiIfRequested()
    assert.equal((await request('/api/me/notifications/read', 'PATCH')).readCount, 1)
    assert.equal((await request('/api/me/notifications/read', 'PATCH')).readCount, 0)
    globalThis.window = { location: new URL('http://localhost:5173/?mock=1'), fetch: async () => { throw new Error('unexpected request') } }
    installMockApiIfRequested()
    assert.ok((await request('/api/me/notifications')).items[0].readAt)
  } finally {
    globalThis.window = originalWindow
    globalThis.sessionStorage = originalStorage
  }
})
