import { ApiError, apiClient } from './client.js'
import { createImageUploader } from './imageUploadFlow.js'

/** S3 사전 서명 PUT. 서명에 들어간 헤더를 그대로 보내야 하고, 인증 헤더·쿠키는 보내지 않는다. */
function putToStorage(url, headers, file) {
  return fetch(url, { method: 'PUT', headers, body: file })
}

export const uploadImage = createImageUploader({
  post: (path, body) => apiClient.post(path, body),
  get: (path) => apiClient.get(path),
  put: putToStorage,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  ApiError,
})
