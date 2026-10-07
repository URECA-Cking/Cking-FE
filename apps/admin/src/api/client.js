import { clearAccessToken, getAccessToken, setAccessToken } from './token.js'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message || code || 'API 요청에 실패했습니다.')
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/** 상대 API 경로를 현재 앱 또는 환경변수로 지정한 백엔드 주소에 연결한다. */
function buildUrl(path, params) {
  const url = new URL(path, BASE_URL || window.location.origin)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  })
  return url
}

/** 관리자 Access Token과 Refresh Cookie를 담아 단일 HTTP 요청을 보낸다. */
async function send(path, { method = 'GET', body, params } = {}) {
  let response
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', '백엔드 서버에 연결할 수 없습니다.')
  }

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    // 빈 응답은 정상 처리한다.
  }
  return {
    ok: response.ok,
    status: response.status,
    code: payload?.code,
    data: payload?.data,
    message: payload?.message,
  }
}

let refreshing = null
const unauthorizedListeners = new Set()

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
