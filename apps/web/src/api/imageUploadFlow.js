// 이미지 업로드를 앱 밖 파이프라인으로 보낸다(Cking-BE #780).
// 예약(POST /api/uploads) → 받은 주소에 원본을 직접 PUT(S3) → 상태(GET /api/uploads/{id})가 READY면 imageKey.
// 예약 API가 없는 환경(404)에서는 기존 업로드 함수를 쓰고, 한 번 404를 받으면 그 뒤로는 바로 기존 업로드를 쓴다.
// 이 파일은 의존성을 주입받아 Vite 없이 node 테스트에서 돌린다. 실제 연결은 imageUpload.js.

export const POLL_INTERVAL_MS = 500
export const POLL_TIMEOUT_MS = 30000

/** 정규화 실패는 용도별 기존 오류 코드로 바꿔 화면의 기존 문구를 그대로 쓴다. */
export const INVALID_IMAGE_CODES = {
  MEMBER_PROFILE: 'INVALID_PROFILE_IMAGE',
  CREATOR_SPACE_PROFILE: 'INVALID_SPACE_PROFILE_IMAGE',
  CREATOR_SPACE_BANNER: 'INVALID_SPACE_BANNER_IMAGE',
  EVENT_BANNER: 'INVALID_EVENT_BANNER_IMAGE',
  POST_IMAGE: 'INVALID_POST_IMAGE',
}

export function createImageUploader({ post, get, put, sleep, now, ApiError }) {
  let pipelineAvailable = true

  async function waitReady(purpose, uploadId) {
    const deadline = now() + POLL_TIMEOUT_MS
    for (;;) {
      const upload = await get(`/api/uploads/${encodeURIComponent(uploadId)}`)
      if (upload.status === 'READY') return upload.imageKey
      if (upload.status === 'FAILED') throw new ApiError(INVALID_IMAGE_CODES[purpose], undefined, 400)
      if (now() >= deadline) throw new ApiError('IMAGE_PROCESSING_BUSY', undefined, 503)
      await sleep(POLL_INTERVAL_MS)
    }
  }

  return async function uploadImage(purpose, file, legacyUpload) {
    if (!pipelineAvailable) return legacyUpload(file)
    let created
    try {
      created = await post('/api/uploads', { purpose, contentType: file.type, size: file.size })
    } catch (error) {
      if (error?.status === 404) {
        pipelineAvailable = false
        return legacyUpload(file)
      }
      throw error
    }
    const response = await put(created.uploadUrl, created.headers, file)
    if (!response.ok) throw new ApiError('IMAGE_PROCESSING_BUSY', undefined, response.status)
    return { imageKey: await waitReady(purpose, created.uploadId) }
  }
}
