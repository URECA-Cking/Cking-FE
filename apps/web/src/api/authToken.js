// Access JWT 보관소.
//
// 탭을 닫으면 사라지도록 sessionStorage에 둔다. 새로고침·새 탭에서는 HttpOnly Refresh Cookie로
// 다시 발급받으므로(POST /api/auth/refresh) 토큰을 오래 남겨둘 필요가 없다.
// 만료 직전 토큰을 쓰지 않도록 만료 30초 전부터는 없는 것으로 본다.

const STORAGE_KEY = 'cking.accessToken';
const EXPIRY_MARGIN_MS = 30 * 1000;

function read() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let current = read();

export function getAccessToken() {
  if (!current) return null;
  if (Date.now() >= current.expiresAt - EXPIRY_MARGIN_MS) return null;
  return current.token;
}

export function setAccessToken(token, expiresInSeconds) {
  current = { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // sessionStorage를 쓸 수 없는 환경에서도 메모리 토큰으로 계속 동작한다.
  }
}

export function clearAccessToken() {
  current = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
