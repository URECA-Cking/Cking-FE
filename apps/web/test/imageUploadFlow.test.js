import test from 'node:test'
import assert from 'node:assert/strict'
import { createImageUploader, POLL_TIMEOUT_MS } from '../src/api/imageUploadFlow.js'

class ApiError extends Error {
  constructor(code, message, status) {
    super(message || code)
    this.code = code
    this.status = status
  }
}

const file = { type: 'image/jpeg', size: 1234 }

function uploader({ post, statuses = [], putOk = true } = {}) {
  const calls = { post: [], get: [], put: [], sleep: [], legacy: 0 }
  let clock = 0
  const upload = createImageUploader({
    post: async (path, body) => {
      calls.post.push({ path, body })
      return post ? post(path, body) : { uploadId: 'u1', uploadUrl: 'https://s3/raw', headers: { 'content-type': 'image/jpeg' } }
    },
    get: async (path) => {
      calls.get.push(path)
      return statuses.shift() ?? { status: 'PENDING' }
    },
    put: async (url, headers, body) => {
      calls.put.push({ url, headers, body })
      return { ok: putOk, status: putOk ? 200 : 403 }
    },
    sleep: async (ms) => { calls.sleep.push(ms); clock += ms },
    now: () => clock,
    ApiError,
  })
  const legacy = async () => { calls.legacy += 1; return { imageKey: 'legacy-key' } }
  return { upload: (purpose = 'POST_IMAGE') => upload(purpose, file, legacy), calls }
}

// Cking-BE #780: 예약 → 받은 헤더 그대로 S3 PUT → READY면 기존과 같은 imageKey
test('예약하고 받은 주소·헤더로 원본을 올린 뒤 READY가 되면 imageKey를 돌려준다', async () => {
  const { upload, calls } = uploader({ statuses: [{ status: 'PENDING' }, { status: 'READY', imageKey: 'post-images/1/a.jpg' }] })

  assert.deepEqual(await upload(), { imageKey: 'post-images/1/a.jpg' })
  assert.deepEqual(calls.post[0], { path: '/api/uploads', body: { purpose: 'POST_IMAGE', contentType: 'image/jpeg', size: 1234 } })
  assert.deepEqual(calls.put[0], { url: 'https://s3/raw', headers: { 'content-type': 'image/jpeg' }, body: file })
  assert.equal(calls.get.length, 2)
  assert.equal(calls.legacy, 0)
})

test('예약 API가 없는 환경(404)이면 기존 업로드를 쓰고, 그 뒤로는 예약을 다시 시도하지 않는다', async () => {
  const { upload, calls } = uploader({ post: () => { throw new ApiError('RESOURCE_NOT_FOUND', '', 404) } })

  assert.deepEqual(await upload(), { imageKey: 'legacy-key' })
  assert.deepEqual(await upload(), { imageKey: 'legacy-key' })
  assert.equal(calls.post.length, 1)
  assert.equal(calls.legacy, 2)
})

test('정규화에 실패하면 용도별 기존 이미지 오류 코드로 알린다', async () => {
  const { upload } = uploader({ statuses: [{ status: 'FAILED', failureReason: 'dimensions' }] })

  await assert.rejects(upload('CREATOR_SPACE_BANNER'), (error) => error.code === 'INVALID_SPACE_BANNER_IMAGE')
})

test('처리가 제한 시간 안에 끝나지 않으면 처리 지연 오류로 알린다', async () => {
  const { upload, calls } = uploader()

  await assert.rejects(upload(), (error) => error.code === 'IMAGE_PROCESSING_BUSY')
  assert.equal(calls.sleep.reduce((sum, ms) => sum + ms, 0), POLL_TIMEOUT_MS)
})

// 0.5초 고정이면 처리가 밀릴 때 업로드당 확인이 60번이 된다(개발 서버 16건/초에서 초당 약 555건)
test('상태 확인 간격은 3초까지 0.5초, 6초까지 1초, 그 뒤 2초로 늘어난다', async () => {
  const { upload, calls } = uploader()

  await assert.rejects(upload())
  assert.deepEqual(calls.sleep.slice(0, 9), [500, 500, 500, 500, 500, 500, 1000, 1000, 1000])
  assert.ok(calls.sleep.slice(9).every((ms) => ms === 2000))
  assert.equal(calls.get.length, 22)
})

test('저장소가 PUT을 거절하면 상태를 확인하지 않고 실패한다', async () => {
  const { upload, calls } = uploader({ putOk: false })

  await assert.rejects(upload(), (error) => error.status === 403)
  assert.equal(calls.get.length, 0)
})

test('예약이 다른 이유로 실패하면 기존 업로드로 넘어가지 않고 그 오류를 그대로 알린다', async () => {
  const { upload, calls } = uploader({ post: () => { throw new ApiError('CREATOR_PROFILE_MANAGED_IN_SPACE', '', 409) } })

  await assert.rejects(upload('MEMBER_PROFILE'), (error) => error.code === 'CREATOR_PROFILE_MANAGED_IN_SPACE')
  assert.equal(calls.legacy, 0)
})
