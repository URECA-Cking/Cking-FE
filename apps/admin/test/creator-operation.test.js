import assert from 'node:assert/strict'
import test from 'node:test'
import { getCreatorApplication, getCreatorStatusHistory, getManagedCreators, requestCreatorApplicationRevision, suspendCreator } from '../src/api/admin.js'
import { clearAccessToken, setAccessToken } from '../src/api/token.js'
import { CREATOR_STATUS_META, REVIEW_STATUS_META } from '../src/utils/eventStatus.js'

test('Creator 자격과 보완 심사 상태를 기존 관리자 배지 체계로 표시한다', () => {
  assert.equal(CREATOR_STATUS_META.ACTIVE.label, '활동 가능')
  assert.equal(CREATOR_STATUS_META.SUSPENDED.label, '활동 정지')
  assert.equal(CREATOR_STATUS_META.REVOKED.label, '자격 박탈')
  assert.equal(REVIEW_STATUS_META.NEEDS_REVISION.label, '보완 요청')
})

test('심사 상세·보완 요청과 자격 변경은 관리자 계약을 사용한다', async () => {
  const previousFetch = globalThis.fetch
  const previousStorage = globalThis.sessionStorage
  const values = new Map()
  globalThis.sessionStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: new URL(url, 'http://localhost'), options })
    return { ok: true, status: 200, text: async () => JSON.stringify({ code: 'SUCCESS', data: {} }) }
  }
  try {
    setAccessToken('admin-token', 3600)
    await getCreatorApplication(11)
    await requestCreatorApplicationRevision(11, '증빙을 보완해 주세요.')
    await getManagedCreators({ status: 'SUSPENDED', page: 2, size: 20 })
    await getCreatorStatusHistory(9, { page: 1, size: 20 })
    const command = { requestId: '550e8400-e29b-41d4-a716-446655440000', reasonCode: 'OTHER', detailReason: '관리자 사유', publicNotice: '활동 제한 안내' }
    await suspendCreator(9, command)

    assert.deepEqual(requests.map(({ url, options }) => [options.method, url.pathname]), [
      ['GET', '/api/admin/creator-applications/11'], ['POST', '/api/admin/creator-applications/11/request-revision'],
      ['GET', '/api/admin/creators'], ['GET', '/api/admin/creators/9/status-history'], ['POST', '/api/admin/creators/9/suspend'],
    ])
    assert.deepEqual(JSON.parse(requests[1].options.body), { revisionReason: '증빙을 보완해 주세요.' })
    assert.deepEqual(Object.fromEntries(requests[2].url.searchParams), { status: 'SUSPENDED', page: '2', size: '20' })
    assert.deepEqual(Object.fromEntries(requests[3].url.searchParams), { page: '1', size: '20' })
    assert.deepEqual(JSON.parse(requests[4].options.body), command)
    assert.ok(requests.every(({ options }) => options.headers.Authorization === 'Bearer admin-token'))
  } finally {
    clearAccessToken()
    globalThis.fetch = previousFetch
    globalThis.sessionStorage = previousStorage
  }
})
