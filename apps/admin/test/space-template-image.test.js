import test from 'node:test'
import assert from 'node:assert/strict'
import { uploadSpaceTemplateBannerImage, uploadSpaceTemplateProfileImage } from '../src/api/admin.js'
import { ApiError } from '../src/api/client.js'
import { clearAccessToken, setAccessToken } from '../src/api/token.js'
import {
  TEMPLATE_IMAGE_ERROR_MESSAGES,
  TEMPLATE_IMAGE_LIMITS,
  templateFields,
  validateTemplate,
  validateTemplateImage,
} from '../src/utils/spaceTemplate.js'

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
const failure = (status, code, message) => ({ ok: false, status, text: async () => JSON.stringify({ code, data: null, message }) })
const png = (size = 1024) => ({ name: 'a.png', type: 'image/png', size })

test('프로필·배너 업로드는 image part를 multipart로 보내고 imageUrl을 돌려준다', async () => {
  const cases = [
    [uploadSpaceTemplateProfileImage, '/api/admin/creator-space-templates/profile-images'],
    [uploadSpaceTemplateBannerImage, '/api/admin/creator-space-templates/banner-images'],
  ]
  for (const [upload, path] of cases) {
    await withFetch([success({ imageUrl: 'https://cdn.example.com/template/x.jpg' }, 201)], async (requests) => {
      const file = new Blob(['x'], { type: 'image/png' })
      const result = await upload(file)
      assert.deepEqual(result, { imageUrl: 'https://cdn.example.com/template/x.jpg' })
      assert.equal(requests.length, 1)
      assert.equal(requests[0].url.pathname, path)
      assert.equal(requests[0].options.method, 'POST')
      assert.ok(requests[0].options.body instanceof FormData)
      assert.ok(requests[0].options.body.get('image') instanceof Blob)
      // multipart 경계는 브라우저가 정하므로 Content-Type을 직접 넣지 않는다.
      assert.equal(requests[0].options.headers['Content-Type'], undefined)
      assert.equal(requests[0].options.headers.Authorization, 'Bearer admin-token')
    })
  }
})

test('업로드 오류는 서버 오류 코드를 담은 ApiError로 던진다', async () => {
  await withFetch([failure(400, 'INVALID_SPACE_TEMPLATE_IMAGE', '이미지를 사용할 수 없습니다.')], async () => {
    await assert.rejects(
      () => uploadSpaceTemplateProfileImage(new Blob(['x'])),
      (error) => error instanceof ApiError && error.code === 'INVALID_SPACE_TEMPLATE_IMAGE' && error.status === 400,
    )
  })
  assert.ok(TEMPLATE_IMAGE_ERROR_MESSAGES.INVALID_SPACE_TEMPLATE_IMAGE)
  assert.ok(TEMPLATE_IMAGE_ERROR_MESSAGES.UPLOAD_TOO_LARGE)
  assert.ok(TEMPLATE_IMAGE_ERROR_MESSAGES.IMAGE_PROCESSING_BUSY)
})

test('프로필은 200×200px, 배너는 600×200px 이상만 통과한다', async () => {
  assert.equal(await validateTemplateImage('profileImageUrl', png(), async () => ({ width: 200, height: 200 })), null)
  assert.ok(await validateTemplateImage('profileImageUrl', png(), async () => ({ width: 199, height: 200 })))
  assert.equal(await validateTemplateImage('bannerImageUrl', png(), async () => ({ width: 600, height: 200 })), null)
  assert.ok(await validateTemplateImage('bannerImageUrl', png(), async () => ({ width: 600, height: 199 })))
  // 프로필 기준으로는 되는 크기도 배너에는 부족하다.
  assert.ok(await validateTemplateImage('bannerImageUrl', png(), async () => ({ width: 200, height: 200 })))
})

test('JPEG·PNG가 아니거나 5MB를 넘거나 읽을 수 없는 파일은 올리기 전에 거절한다', async () => {
  const ok = async () => ({ width: 1000, height: 1000 })
  assert.ok(await validateTemplateImage('profileImageUrl', { name: 'a.gif', type: 'image/gif', size: 1 }, ok))
  const { maxBytes } = TEMPLATE_IMAGE_LIMITS.profileImageUrl
  assert.equal(await validateTemplateImage('profileImageUrl', png(maxBytes), ok), null)
  assert.ok(await validateTemplateImage('profileImageUrl', png(maxBytes + 1), ok))
  assert.ok(await validateTemplateImage('profileImageUrl', png(), async () => null))
})

test('브라우저가 MIME type을 비운 PNG도 확장자로 통과시킨다', async () => {
  assert.equal(await validateTemplateImage('profileImageUrl', { name: 'a.PNG', type: '', size: 1 }, async () => ({ width: 300, height: 300 })), null)
})

test('이미지가 없으면 URL 입력이 아니라 올리라는 문구를 보여 준다', () => {
  const errors = validateTemplate(templateFields(null))
  assert.match(errors.profileImageUrl, /올려주세요/)
  assert.match(errors.bannerImageUrl, /올려주세요/)
  assert.match(errors.introText, /입력해주세요/)
})
