import { clearAccessToken, getAccessToken, setAccessToken } from './token.js'
import { ApiError, createApiTransport } from '@cking/shared/api'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
export { ApiError }

const send = createApiTransport({
  baseUrl: BASE_URL,
  getAccessToken,
  networkErrorMessage: '백엔드 서버에 연결할 수 없습니다.',
})

let refreshing = null

/** admin_refresh_token Cookie로 Access JWT를 한 번만 갱신한다. */
export function refreshAccessToken() {
  if (!refreshing) {
    refreshing = send('/api/admin/auth/refresh', { method: 'POST' })
      .then((result) => {
        if (result.ok && result.data?.accessToken) {
          setAccessToken(result.data.accessToken, result.data.expiresIn)
          return true
        }
        clearAccessToken()
        return false
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

/** 401 발생 시 관리자 refresh를 한 번만 시도하고 실패하면 호출자에게 오류를 전달한다. */
async function request(path, options = {}) {
  let result = await send(path, options)
  if (result.status === 401 && !options.skipRefresh && (await refreshAccessToken())) {
    result = await send(path, options)
  }
  if (!result.ok || (result.code && result.code !== 'SUCCESS')) {
    throw new ApiError(result.code, result.message, result.status)
  }
  return result.data
}

/** 관리자 화면이 사용하는 GET 요청을 실행한다. */
export function get(path, params, options) {
  return request(path, { ...options, method: 'GET', params })
}

/** 관리자 화면이 사용하는 POST 요청을 실행한다. */
export function post(path, body, params, options) {
  return request(path, { ...options, method: 'POST', body, params })
}

/** API 오류를 화면에 표시할 안전한 한국어 문구로 정리한다. */
export function describeError(error, fallback = '요청을 처리하지 못했습니다.') {
  return error instanceof ApiError && error.code === 'FORBIDDEN'
    ? '이 기능을 사용할 권한이 없습니다.'
    : error?.message || fallback
}
