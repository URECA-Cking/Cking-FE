import assert from 'node:assert/strict'
import test from 'node:test'
import { isAllowedTicketResyncRequest, resolveTicketMutationTarget } from '../e2e/ticketMutationTarget.js'

const isolated = {
  adminBaseUrl: 'https://isolated-admin.example.test',
  apiBaseUrl: 'https://isolated-api.example.test',
  isolatedConfirmed: '1',
}

test('변경 테스트는 격리 FE·API 주소와 확인값을 모두 요구한다', () => {
  assert.deepEqual(resolveTicketMutationTarget(isolated), {
    adminOrigin: 'https://isolated-admin.example.test',
    apiOrigin: 'https://isolated-api.example.test',
  })
  assert.throws(() => resolveTicketMutationTarget({ ...isolated, apiBaseUrl: undefined }), /모두 명시/)
  assert.throws(() => resolveTicketMutationTarget({ ...isolated, isolatedConfirmed: undefined }), /모두 명시/)
})

test('공유 개발 주소와 보안 조건을 벗어난 주소를 변경 대상으로 거부한다', () => {
  assert.throws(() => resolveTicketMutationTarget({ ...isolated, apiBaseUrl: 'https://dev-api.cking.co.kr' }), /격리/)
  assert.throws(() => resolveTicketMutationTarget({ ...isolated, adminBaseUrl: 'https://dev-admin.cking.co.kr' }), /격리/)
  assert.throws(() => resolveTicketMutationTarget({ ...isolated, apiBaseUrl: 'http://isolated-api.example.test' }), /격리/)
  assert.throws(() => resolveTicketMutationTarget({ ...isolated, apiBaseUrl: 'https://isolated-api.example.test/path' }), /격리/)
})

test('보정 POST는 지정한 격리 API Origin의 두 경로에만 허용한다', () => {
  const apiOrigin = 'https://isolated-api.example.test'
  assert.equal(isAllowedTicketResyncRequest(`${apiOrigin}/api/admin/tickets/resync`, apiOrigin), true)
  assert.equal(isAllowedTicketResyncRequest(`${apiOrigin}/api/admin/tickets/common/resync`, apiOrigin), true)
  assert.equal(isAllowedTicketResyncRequest('https://dev-api.cking.co.kr/api/admin/tickets/resync', apiOrigin), false)
  assert.equal(isAllowedTicketResyncRequest(`${apiOrigin}/api/admin/tickets/history`, apiOrigin), false)
})
