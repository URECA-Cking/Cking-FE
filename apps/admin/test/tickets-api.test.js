import test from 'node:test'
import assert from 'node:assert/strict'
import { getAdminTicketBalance, getAdminTicketHistory, isRedisBalanceQueryFailed, resyncCommonTickets, resyncCreatorTickets } from '../src/api/admin.js'
import { ApiError } from '../src/api/client.js'
import { clearAccessToken, setAccessToken } from '../src/api/token.js'

/** 테스트 응답을 관리자 API의 공통 봉투 형식으로 만든다. */
function success(data) {
  return { ok: true, status: 200, text: async () => JSON.stringify({ code: 'SUCCESS', data }) }
}

/** 관리자 토큰 저장에 필요한 브라우저 저장소를 테스트 동안 설치한다. */
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

test('관리자 응모권 조회와 수동 보정은 종류별 계약 필드와 관리자 인증을 사용한다', async () => {
  const restoreStorage = installSessionStorage()
  const previousFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: new URL(url), options })
    return success({ items: [], hasNext: false })
  }
  try {
    setAccessToken('admin-token', 3600)
    await getAdminTicketBalance({ memberId: 1, couponType: 'CREATOR', creatorId: 2 })
    await getAdminTicketHistory({ memberId: 1, couponType: 'COMMON', cursor: 'next-page', size: 20 })
    await resyncCreatorTickets(1, 2, 'Creator 보정')
    await resyncCommonTickets(1, '공용 보정')

    assert.equal(requests[0].url.pathname, '/api/admin/tickets/balance')
    assert.deepEqual(Object.fromEntries(requests[0].url.searchParams), { memberId: '1', couponType: 'CREATOR', creatorId: '2' })
    assert.equal(requests[1].url.pathname, '/api/admin/tickets/history')
    assert.deepEqual(Object.fromEntries(requests[1].url.searchParams), { memberId: '1', couponType: 'COMMON', cursor: 'next-page', size: '20' })
    assert.equal(requests[2].url.pathname, '/api/admin/tickets/resync')
    assert.deepEqual(JSON.parse(requests[2].options.body), { memberId: 1, creatorId: 2, reason: 'Creator 보정' })
    assert.equal(requests[3].url.pathname, '/api/admin/tickets/common/resync')
    assert.deepEqual(JSON.parse(requests[3].options.body), { memberId: 1, reason: '공용 보정' })
    assert.ok(requests.every(({ options }) => options.headers.Authorization === 'Bearer admin-token' && options.credentials === 'include'))
  } finally {
    clearAccessToken()
    globalThis.fetch = previousFetch
    restoreStorage()
  }
})

test('Redis 잔액 조회 실패는 useAsync가 보존한 원본 오류 코드로 판별한다', () => {
  assert.equal(isRedisBalanceQueryFailed(new ApiError('REDIS_BALANCE_QUERY_FAILED')), true)
  assert.equal(isRedisBalanceQueryFailed(new ApiError('RESOURCE_NOT_FOUND')), false)
  assert.equal(isRedisBalanceQueryFailed('Redis 잔액을 조회하지 못했습니다.'), false)
  assert.equal(isRedisBalanceQueryFailed(null), false)
})
