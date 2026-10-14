import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createSpaceCommentBlock,
  deleteComment,
  getSpaceCommentBlocks,
  releaseSpaceCommentBlock,
} from '../src/api/admin.js'
import { ApiError } from '../src/api/client.js'
import { clearAccessToken, setAccessToken } from '../src/api/token.js'

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

/** fetch를 가로채 요청을 모으고 정해 둔 응답을 차례로 돌려준 뒤 원래대로 되돌리는 실행기. */
async function withFetch(responses, run) {
  const restoreStorage = installSessionStorage()
  const previousFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: new URL(url), options })
    return responses.shift()
  }
  try {
    setAccessToken('admin-token', 3600)
    await run(requests)
  } finally {
    clearAccessToken()
    globalThis.fetch = previousFetch
    restoreStorage()
  }
}

const success = (data, status = 200) => ({ ok: true, status, text: async () => JSON.stringify({ code: 'SUCCESS', data }) })
const noContent = () => ({ ok: true, status: 204, text: async () => '' })
const failure = (status, code, message) => ({ ok: false, status, text: async () => JSON.stringify({ code, data: null, message }) })

test('댓글 삭제는 DELETE로 댓글 ID만 보내고 본문 없는 204 응답을 성공으로 처리한다', async () => {
  await withFetch([noContent()], async (requests) => {
    const result = await deleteComment(500)
    assert.equal(result, undefined)
    assert.equal(requests[0].options.method, 'DELETE')
    assert.equal(requests[0].url.pathname, '/api/admin/comments/500')
    assert.equal(requests[0].options.body, undefined)
    assert.equal(requests[0].options.headers.Authorization, 'Bearer admin-token')
  })
})

test('댓글 삭제 실패는 BE 오류 코드를 그대로 전달한다', async () => {
  await withFetch([failure(404, 'RESOURCE_NOT_FOUND', '댓글 없음')], async () => {
    await assert.rejects(deleteComment(500), (error) => error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND' && error.status === 404)
  })
})

test('스페이스 차단 생성은 creatorId·memberId·days를 본문으로 보내고 201 응답을 돌려준다', async () => {
  const block = { sanctionId: 9, creatorId: 5, memberId: 20, memberName: '열혈팬', active: true }
  await withFetch([success(block, 201)], async (requests) => {
    assert.deepEqual(await createSpaceCommentBlock({ creatorId: 5, memberId: 20, days: 7 }), block)
    assert.equal(requests[0].options.method, 'POST')
    assert.equal(requests[0].url.pathname, '/api/admin/comment-blocks')
    assert.deepEqual(JSON.parse(requests[0].options.body), { creatorId: 5, memberId: 20, days: 7 })
  })
})

test('스페이스 차단 생성의 BE 오류 코드(스페이스 주인·다른 관리자)를 그대로 전달한다', async () => {
  await withFetch([failure(400, 'CANNOT_BLOCK_SPACE_OWNER', 'x'), failure(400, 'CANNOT_BLOCK_ADMIN', 'y')], async () => {
    await assert.rejects(createSpaceCommentBlock({ creatorId: 5, memberId: 1, days: 7 }), (error) => error.code === 'CANNOT_BLOCK_SPACE_OWNER')
    await assert.rejects(createSpaceCommentBlock({ creatorId: 5, memberId: 2, days: 7 }), (error) => error.code === 'CANNOT_BLOCK_ADMIN')
  })
})

test('스페이스 차단 목록은 비운 필터를 보내지 않고 active=false를 포함해 보낸다', async () => {
  const page = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false }
  await withFetch([success(page), success(page)], async (requests) => {
    await getSpaceCommentBlocks({})
    await getSpaceCommentBlocks({ creatorId: 5, memberId: 20, activeOnly: true, page: 2, size: 20 })
    assert.equal(requests[0].url.pathname, '/api/admin/comment-blocks')
    assert.deepEqual(Object.fromEntries(requests[0].url.searchParams), { active: 'false', page: '0', size: '20' })
    assert.deepEqual(Object.fromEntries(requests[1].url.searchParams), { creatorId: '5', memberId: '20', active: 'true', page: '2', size: '20' })
    assert.equal(requests[0].options.method, 'GET')
  })
})

test('스페이스 차단 해제는 POST로 차단 ID 경로를 호출한다', async () => {
  await withFetch([success({ sanctionId: 9, active: false, releasedAt: '2026-10-14T00:00:00Z' })], async (requests) => {
    const released = await releaseSpaceCommentBlock(9)
    assert.equal(released.active, false)
    assert.equal(requests[0].options.method, 'POST')
    assert.equal(requests[0].url.pathname, '/api/admin/comment-blocks/9/release')
    assert.equal(requests[0].options.body, undefined)
  })
})
