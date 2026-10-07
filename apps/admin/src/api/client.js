import { clearAccessToken, getAccessToken, setAccessToken } from './token.js'
import { ApiError, createApiTransport } from '@cking/shared/api'

export const BASE_URL = import.meta.env?.VITE_API_BASE_URL || ''
export { ApiError }

const send = createApiTransport({
  baseUrl: BASE_URL,
  getAccessToken,
  networkErrorMessage: '백엔드 서버에 연결할 수 없습니다.',
})

let refreshing = null
let loggingOut = null
let sessionGeneration = 0
const unauthorizedListeners = new Set()

/** admin_refresh_token Cookie로 Access JWT를 한 번만 갱신한다. */
export function refreshAccessToken() {
  if (loggingOut) return Promise.resolve(false)
  if (!refreshing) {
    const refreshGeneration = sessionGeneration
    refreshing = send('/api/admin/auth/refresh', { method: 'POST' })
      .then((result) => {
        if (refreshGeneration !== sessionGeneration) return false
        if (result.ok && result.data?.accessToken) {
          setAccessToken(result.data.accessToken, result.data.expiresIn)
          return true
        }
        clearAccessToken()
        return false
      })
      .catch(() => {
        clearAccessToken()
        return false
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

/** 진행 중인 Refresh를 마친 뒤 Refresh Cookie와 로컬 관리자 세션을 함께 폐기한다. */
export function logoutAdminSession() {
  if (loggingOut) return loggingOut

  sessionGeneration += 1
  clearAccessToken()
  const refreshInFlight = refreshing
  loggingOut = (async () => {
    if (refreshInFlight) await refreshInFlight
    const result = await send('/api/admin/auth/logout', { method: 'POST' })
    if (!result.ok || (result.code && result.code !== 'SUCCESS')) {
      throw new ApiError(result.code, result.message, result.status)
    }
    return result.data
  })().finally(() => {
    clearAccessToken()
    loggingOut = null
  })
  return loggingOut
}

/** 401 갱신·한 번 재시도와 공통 오류 변환을 적용해 관리자 응답 데이터를 반환한다. */
async function request(path, options = {}) {
  let result = await send(path, options)
  if (result.status === 401 && !options.skipRefresh && (await refreshAccessToken())) {
    result = await send(path, options)
  }
  if (result.status === 401) {
    clearAccessToken()
    notifyUnauthorized()
  }
  if (!result.ok || (result.code && result.code !== 'SUCCESS')) {
    throw new ApiError(result.code, result.message, result.status)
  }
  return result.data
}

/** 관리자 인증이 복구되지 않았을 때 세션 Context에 익명 전환을 알린다. */
function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => listener())
}

/** 관리자 Access Token 갱신 실패를 구독하고 해제 함수를 반환한다. */
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
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
