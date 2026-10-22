import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, createApiTransport } from '../src/api.js'

test('HTTP 전송은 앱별 토큰과 Cookie를 포함하고 공통 응답 봉투를 반환한다', async () => {
  const previousFetch = globalThis.fetch
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return { ok: true, status: 200, text: async () => JSON.stringify({ code: 'SUCCESS', data: { id: 7 } }) }
  }
  try {
    const send = createApiTransport({ baseUrl: 'https://api.example.test', getAccessToken: () => 'access' })
    const result = await send('/api/me', { params: { page: 0, empty: null } })
    assert.equal(request.url.toString(), 'https://api.example.test/api/me?page=0')
    assert.equal(request.options.headers.Authorization, 'Bearer access')
    assert.equal(request.options.credentials, 'include')
    assert.deepEqual(result.data, { id: 7 })
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('multipart 요청은 Content-Type을 강제하지 않는다', async () => {
  const previousFetch = globalThis.fetch
  let request
  globalThis.fetch = async (_url, options) => {
    request = options
    return { ok: true, status: 202, text: async () => '' }
  }
  try {
    const body = new FormData()
    body.append('requestId', 'id')
    const send = createApiTransport({ getAccessToken: () => null })
    await send('/api/upload', { method: 'POST', body })
    assert.equal(request.body, body)
    assert.equal(request.headers['Content-Type'], undefined)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('네트워크 오류는 앱별 메시지의 ApiError로 변환한다', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('offline') }
  try {
    const send = createApiTransport({ getAccessToken: () => null, networkErrorMessage: '연결 실패' })
    await assert.rejects(send('/api/me'), (error) =>
      error instanceof ApiError && error.code === 'NETWORK_ERROR' && error.message === '연결 실패')
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('HTTP 200이어도 응답 본문 읽기가 실패하면 성공으로 처리하지 않는다', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => { throw new Error('body interrupted') },
  })
  try {
    const send = createApiTransport({ getAccessToken: () => null })
    await assert.rejects(send('/api/me'), (error) => error instanceof ApiError && error.code === 'NETWORK_ERROR')
  } finally {
    globalThis.fetch = previousFetch
  }
})
