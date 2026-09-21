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
    throw new ApiError(
      payload?.code ?? 'UNKNOWN',
      payload?.message ?? `요청이 실패했습니다. (HTTP ${response.status})`,
      response.status,
    )
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
