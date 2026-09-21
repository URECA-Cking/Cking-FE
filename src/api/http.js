/**
 * 백엔드 공통 응답 봉투({code, data, message})를 벗기는 fetch 래퍼.
 * 경로는 /api로 시작하며 vite.config.js의 dev 프록시가 백엔드로 전달한다.
 */
export class ApiError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/** 네트워크 자체가 끊긴 경우(fetch 예외) — 비즈니스 오류(ApiError)와 구분한다. */
export class NetworkError extends Error {
  constructor(originalError) {
    super('네트워크 연결을 확인해 주세요.')
    this.name = 'NetworkError'
    this.originalError = originalError
  }
}

/**
 * fetch는 성공했지만 백엔드 공통 응답 봉투({code, data, message})가 아닌 응답.
 * 백엔드가 꺼져 있을 때 Vite 프록시가 돌려주는 502 Bad Gateway 등이 여기 해당한다.
 * 이런 인프라 실패를 ApiError(비즈니스 오류)로 분류하면 안 된다.
 */
export class HttpError extends Error {
  constructor(status) {
    super(`서버에 연결할 수 없습니다. (HTTP ${status})`)
    this.name = 'HttpError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body, headers, signal } = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new NetworkError(err)
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    // 본문이 없는 응답(예: 일부 상태 변경 API)
  }

  if (!response.ok) {
    // 백엔드 봉투(code 필드)가 확인될 때만 비즈니스 오류로 분류한다.
    // 그 외(프록시 502 등 인프라 실패)는 HttpError로 구분한다.
    if (typeof payload?.code === 'string') {
      throw new ApiError(payload.code, payload.message ?? `요청이 실패했습니다. (HTTP ${response.status})`, response.status)
    }
    throw new HttpError(response.status)
  }

  return payload?.data
}

export function apiGet(path, signal) {
  return request(path, { signal })
}

export function apiPost(path, body, headers) {
  return request(path, { method: 'POST', body, headers })
}

export function apiPatch(path, body, headers) {
  return request(path, { method: 'PATCH', body, headers })
}

export function apiDelete(path, headers) {
  return request(path, { method: 'DELETE', headers })
}
