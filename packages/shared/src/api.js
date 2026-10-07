/** 앱별 인증 정책을 제외한 HTTP 전송과 공통 응답 봉투 처리. */
export class ApiError extends Error {
  constructor(code, message, status) {
    super(message || code || 'API 요청에 실패했습니다.')
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function createApiTransport({
  baseUrl = '',
  getAccessToken,
  networkErrorMessage = '백엔드 서버에 연결할 수 없습니다. Cking-BE가 실행 중인지 확인해주세요.',
}) {
  function buildUrl(path, params) {
    const origin = baseUrl || (typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
    const url = new URL(path, origin)
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
    })
    return url
  }

  return async function send(path, { method = 'GET', body, params, signal } = {}) {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData
    const token = getAccessToken()
    const headers = {
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    let response
    try {
      response = await fetch(buildUrl(path, params), {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        credentials: 'include',
        signal,
      })
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      throw new ApiError('NETWORK_ERROR', networkErrorMessage)
    }

    let text
    try {
      text = await response.text()
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      throw new ApiError('NETWORK_ERROR', networkErrorMessage)
    }

    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      // JSON이 아닌 오류 응답은 상태 코드로 처리한다.
    }
    return {
      ok: response.ok,
      status: response.status,
      code: payload?.code,
      data: payload?.data,
      message: payload?.message,
    }
  }
}
