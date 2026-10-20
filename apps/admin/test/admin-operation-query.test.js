import assert from 'node:assert/strict'
import test from 'node:test'
import { getCreatorApplications, getOperatingEvent, getOperatingEvents } from '../src/api/admin.js'
import { clearAccessToken, setAccessToken } from '../src/api/token.js'

function success(data) {
  return { ok: true, status: 200, text: async () => JSON.stringify({ code: 'SUCCESS', data }) }
}

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

test('관리자 Event 운영 상세와 Creator 신청 상태 페이지 조회 계약을 사용한다', async () => {
  const restoreStorage = installSessionStorage()
  const previousFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: new URL(url), options })
    return success({ event: { eventId: 7 }, snapshot: null, initialDrawing: null })
  }
  try {
    setAccessToken('admin-token', 3600)
    await getOperatingEvent(7)
    await getCreatorApplications({ status: 'PENDING', page: 2, size: 20 })
    await getOperatingEvents({ status: 'CLOSED', page: 1, size: 20 })

    assert.equal(requests[0].url.pathname, '/api/admin/events/7/operation')
    assert.equal(requests[1].url.pathname, '/api/admin/creator-applications')
    assert.deepEqual(Object.fromEntries(requests[1].url.searchParams), {
      status: 'PENDING', page: '2', size: '20',
    })
    assert.equal(requests[2].url.pathname, '/api/admin/events')
    assert.deepEqual(Object.fromEntries(requests[2].url.searchParams), {
      status: 'CLOSED', archiveStatus: 'ACTIVE', page: '1', size: '20',
    })
    assert.ok(requests.every(({ options }) => options.headers.Authorization === 'Bearer admin-token'))
  } finally {
    clearAccessToken()
    globalThis.fetch = previousFetch
    restoreStorage()
  }
})
