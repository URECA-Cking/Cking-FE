import assert from 'node:assert/strict'
import test from 'node:test'
import { archiveEvent, getOperatingEvents, unarchiveEvent } from '../src/api/admin.js'
import { clearAccessToken, setAccessToken } from '../src/api/token.js'
import { archiveStatusSearch, canArchiveEvent, canUnarchiveEvent } from '../src/utils/eventArchive.js'

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

test('PUBLISHED 상태와 보관 메타데이터가 일치할 때만 보관 또는 복원을 제공한다', () => {
  assert.equal(canArchiveEvent({ status: 'PUBLISHED', archivedAt: null }), true)
  assert.equal(canArchiveEvent({ status: 'PUBLISHED', archivedAt: '2026-10-15T00:00:00Z' }), false)
  assert.equal(canArchiveEvent({ status: 'DRAW_COMPLETED', archivedAt: null }), false)
  assert.equal(canUnarchiveEvent({ status: 'PUBLISHED', archivedAt: '2026-10-15T00:00:00Z' }), true)
  assert.equal(canUnarchiveEvent({ status: 'PUBLISHED', archivedAt: null }), false)
})

test('보관함 상세 이동만 archiveStatus Query를 유지한다', () => {
  assert.equal(archiveStatusSearch('ACTIVE'), '')
  assert.equal(archiveStatusSearch('ARCHIVED'), '?archiveStatus=ARCHIVED')
})

test('보관함은 PUBLISHED 상태만 조회하고 보관·복원은 관리자 PATCH 계약을 사용한다', async () => {
  const restoreStorage = installSessionStorage()
  const previousFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: new URL(url), options })
    return success({ items: [], hasNext: false })
  }
  try {
    setAccessToken('admin-token', 3600)
    await getOperatingEvents({ archiveStatus: 'ARCHIVED' })
    await archiveEvent(7)
    await unarchiveEvent(7)

    assert.equal(requests[0].url.pathname, '/api/admin/events')
    assert.deepEqual(Object.fromEntries(requests[0].url.searchParams), {
      status: 'PUBLISHED', archiveStatus: 'ARCHIVED', page: '0', size: '100',
    })
    assert.equal(requests[1].url.pathname, '/api/admin/events/7/archive')
    assert.equal(requests[1].options.method, 'PATCH')
    assert.equal(requests[2].url.pathname, '/api/admin/events/7/unarchive')
    assert.equal(requests[2].options.method, 'PATCH')
    assert.ok(requests.every(({ options }) => options.headers.Authorization === 'Bearer admin-token'))
  } finally {
    clearAccessToken()
    globalThis.fetch = previousFetch
    restoreStorage()
  }
})
