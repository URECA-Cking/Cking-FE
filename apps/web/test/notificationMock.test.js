import test from 'node:test'
import assert from 'node:assert/strict'
import { installMockApiIfRequested } from '../src/dev/mockApi.js'

test('알림 미리보기에는 긴 본문·URL·여러 유형의 알림이 있고 실제 API를 호출하지 않는다', async () => {
  const originalWindow = globalThis.window
  const originalStorage = globalThis.sessionStorage
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  globalThis.window = { location: new URL('http://localhost:5182/notifications?mock=notifications'), fetch: async () => { throw new Error('실제 API 호출 금지') } }
  try {
    installMockApiIfRequested()
    const { data } = await (await window.fetch('/api/me/notifications')).json()
    assert.equal(data.items.length, 6)
    assert.equal(new Set(data.items.map((item) => item.notificationId)).size, 6)
    assert.ok(data.items.some((item) => item.body.includes('\n') && item.body.includes('https://')))
    assert.ok(data.items.some((item) => item.event))
    assert.ok(data.items.some((item) => !item.event))
  } finally {
    globalThis.window = originalWindow
    globalThis.sessionStorage = originalStorage
  }
})

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

test('숨긴 알림은 목록과 읽음에서 빠지고 반복 숨김은 성공하며 새로고침 뒤에도 유지된다', async () => {
  const originalWindow = globalThis.window
  const originalStorage = globalThis.sessionStorage
  const storage = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  }
  const install = () => {
    globalThis.window = { location: new URL('http://localhost:5173/?mock=blocked'), fetch: async () => { throw new Error('unexpected request') } }
    installMockApiIfRequested()
  }

  try {
    /** 설치된 모의 API에서 응답 봉투를 읽는다. */
    const call = async (path, method = 'GET') => {
      const response = await window.fetch(path, { method })
      return { status: response.status, body: await response.json() }
    }

    install()
    const before = (await call('/api/me/notifications')).body.data
    const hiddenId = before.items[0].notificationId
    const otherId = before.items[1].notificationId

    const hidden = await call(`/api/me/notifications/${hiddenId}/hide`, 'PATCH')
    assert.equal(hidden.status, 200)
    assert.equal(hidden.body.data.notificationId, hiddenId)
    assert.ok(hidden.body.data.hiddenAt)
    // 반복 숨김은 성공하고 최초 숨김 시각을 그대로 돌려준다.
    await new Promise((resolve) => setTimeout(resolve, 5))
    const again = await call(`/api/me/notifications/${hiddenId}/hide`, 'PATCH')
    assert.equal(again.status, 200)
    assert.equal(again.body.data.hiddenAt, hidden.body.data.hiddenAt)

    const after = (await call('/api/me/notifications')).body.data
    assert.deepEqual(after.items.map((item) => item.notificationId), [otherId])
    assert.equal(after.totalElements, before.totalElements - 1)
    assert.equal((await call(`/api/me/notifications/${hiddenId}/read`, 'PATCH')).body.code, 'NOTIFICATION_NOT_FOUND')
    assert.equal((await call('/api/me/notifications/read', 'PATCH')).body.data.readCount, 0)
    assert.equal((await call('/api/me/notifications/99999/hide', 'PATCH')).body.code, 'NOTIFICATION_NOT_FOUND')

    install()
    assert.deepEqual((await call('/api/me/notifications')).body.data.items.map((item) => item.notificationId), [otherId])
    // 새로고침 뒤에도 최초 숨김 시각이 유지된다.
    assert.equal((await call(`/api/me/notifications/${hiddenId}/hide`, 'PATCH')).body.data.hiddenAt, hidden.body.data.hiddenAt)
  } finally {
    globalThis.window = originalWindow
    globalThis.sessionStorage = originalStorage
  }
})
