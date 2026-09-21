// 실제 백엔드(Spring Boot, Cking-BE) REST API 호출을 위한 공통 클라이언트.
// 새로운 의존성(axios 등)을 추가하지 않고 브라우저 내장 fetch만 사용한다.
//
// 기본값은 "빈 문자열"이다 = 현재 페이지와 같은 출처로 /api/... 를 호출한다.
// 개발 중에는 vite.config.js의 프록시가 이 요청을 백엔드로 넘겨주므로 CORS 설정이 필요 없다.

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message || code || 'API 요청에 실패했습니다.');
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function origin() {
  if (BASE_URL) return BASE_URL;
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}

function buildUrl(path, params) {
  const url = new URL(path, origin());
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
 * (예: 응모 신청은 DUPLICATE_REPLAY처럼 실패가 아닌 코드를 정상 응답으로 돌려준다)
 */
export async function requestEnvelope(path, { method = 'GET', body, params, signal } = {}) {
  const url = buildUrl(path, params);
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (networkError) {
    if (networkError?.name === 'AbortError') throw networkError;
    throw new ApiError(
      'NETWORK_ERROR',
      '백엔드 서버에 연결할 수 없습니다. Cking-BE가 실행 중인지 확인해주세요.',
      undefined
    );
  }

  let payload = null;
  try {
    const text = await response.text();
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    code: payload?.code,
    data: payload?.data,
    message: payload?.message,
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
  get: (path, params, options) => requestOrThrow(path, { ...options, method: 'GET', params }),
  post: (path, body, params) => requestOrThrow(path, { method: 'POST', body, params }),
  patch: (path, body, params) => requestOrThrow(path, { method: 'PATCH', body, params }),
  delete: (path, params) => requestOrThrow(path, { method: 'DELETE', params }),
};

/** 호출이 성공했는지만 알면 되는 권한 확인용 헬퍼(403/404를 예외 대신 false로 돌려준다). */
export async function probe(path, params) {
  try {
    const envelope = await requestEnvelope(path, { method: 'GET', params });
    return envelope.ok && (!envelope.code || envelope.code === 'SUCCESS');
  } catch {
    return false;
  }
}

/** 화면에 그대로 노출해도 되는 오류 문구로 정리한다. */
export function describeError(error, fallback = '요청을 처리하지 못했습니다.') {
  if (error instanceof ApiError) {
    if (error.code === 'FORBIDDEN') return '이 기능을 사용할 권한이 없는 계정입니다.';
    return error.message || fallback;
  }
  return fallback;
}

/** 멱등 요청에 사용할 UUID v4. crypto.randomUUID가 없는 환경도 대비한다. */
export function newRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
