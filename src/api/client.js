// 실제 백엔드(Spring Boot) REST API 호출을 위한 공통 클라이언트
// 새로운 의존성(axios 등)을 추가하지 않고 브라우저 내장 fetch만 사용한다.

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message || code || 'API 요청에 실패했습니다.');
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function buildUrl(path, params) {
  const url = new URL(path, BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, value);
    });
  }
  return url;
}

/**
 * 백엔드 공통 응답 봉투({code, data, message})를 감싸 반환한다.
 * 비즈니스 코드가 "SUCCESS"가 아니어도 예외를 던지지 않는다.
 * (예: 응모 신청은 중복 처리 등 다양한 코드를 "정상적으로" 반환할 수 있음)
 */
export async function requestEnvelope(path, { method = 'GET', body, params } = {}) {
  const url = buildUrl(path, params);
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new ApiError(
      'NETWORK_ERROR',
      '백엔드 서버에 연결할 수 없습니다. 서버 실행 여부와 CORS 설정을 확인해주세요.',
      undefined
    );
  }

  let payload = null;
  try {
    const text = await response.text();
    payload = text ? JSON.parse(text) : null;
  } catch (parseError) {
    payload = null;
  }

  const code = payload?.code;
  const data = payload?.data;
  const message = payload?.message;

  return {
    ok: response.ok,
    status: response.status,
    code,
    data,
    message,
  };
}

async function requestOrThrow(path, options) {
  const envelope = await requestEnvelope(path, options);
  if (!envelope.ok || (envelope.code && envelope.code !== 'SUCCESS')) {
    throw new ApiError(envelope.code, envelope.message, envelope.status);
  }
  return envelope.data;
}

export const apiClient = {
  get: (path, params) => requestOrThrow(path, { method: 'GET', params }),
  post: (path, body, params) => requestOrThrow(path, { method: 'POST', body, params }),
  patch: (path, body, params) => requestOrThrow(path, { method: 'PATCH', body, params }),
};
