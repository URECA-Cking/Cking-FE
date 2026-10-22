import { BASE_URL, apiClient, refreshAccessToken } from './client';
import { clearAccessToken, getAccessToken, setAccessToken } from './authToken.js';

// OAuth 로그인 시작은 API 호출이 아니라 백엔드 주소로의 페이지 이동이다.
// 운영은 VITE_API_BASE_URL(백엔드 주소), 로컬은 vite 프록시 대상(기본 http://localhost:8080)으로 보낸다.
// 로그인이 끝나면 백엔드가 프론트의 /oauth/callback?code=... (또는 ?error=...)로 돌려보낸다.
const AUTH_ORIGIN = BASE_URL || import.meta.env.VITE_API_PROXY_TARGET || 'http://localhost:8080';

/** @param {'google'|'kakao'} provider */
export function oauthLoginUrl(provider) {
  return `${AUTH_ORIGIN}/oauth2/authorization/${provider}`;
}

// POST /api/auth/token - Login Code를 Access JWT로 교환(Refresh Cookie도 함께 발급)
export async function exchangeLoginCode(code) {
  const data = await apiClient.post('/api/auth/token', { code }, undefined, { skipAuthRefresh: true });
  setAccessToken(data.accessToken, data.expiresIn);
  return data;
}

/**
 * 앱 시작 시 로그인 상태를 복원한다. 저장된 Access JWT가 없거나 만료됐으면 Refresh Cookie로 재발급을 시도한다.
 * @returns {Promise<boolean>} 인증된 상태인지
 */
export async function restoreSession() {
  if (getAccessToken()) return true;
  return refreshAccessToken();
}

// GET /api/me - 현재 사용자 기본 정보, Creator 여부, 온보딩 완료 여부(onboardingCompleted)
export async function getMe() {
  return apiClient.get('/api/me');
}

// PUT /api/me/onboarding/complete - 온보딩 완료(또는 건너뛰기) 기록. 본문 없음, 이미 완료여도 성공(멱등)
export async function completeOnboarding() {
  return apiClient.put('/api/me/onboarding/complete');
}

// POST /api/auth/logout - Refresh Token 폐기. 실패해도 프론트 토큰은 지운다.
export async function logout() {
  try {
    await apiClient.post('/api/auth/logout', undefined, undefined, { skipAuthRefresh: true });
  } finally {
    clearAccessToken();
  }
}
