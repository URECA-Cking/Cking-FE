const STORAGE_KEY = 'cking.admin.accessToken'
const EXPIRY_MARGIN_MS = 30_000

/** 관리자 Access JWT를 sessionStorage에서 읽는다. */
function readToken() { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null') } catch { return null } }
let current = readToken()

/** 만료 여유를 고려해 사용할 수 있는 관리자 Access JWT를 반환한다. */
export function getAccessToken() { return current && Date.now() < current.expiresAt - EXPIRY_MARGIN_MS ? current.token : null }
/** 로그인·갱신 응답의 관리자 Access JWT를 탭 세션에 저장한다. */
export function setAccessToken(token, expiresIn) { current = { token, expiresAt: Date.now() + expiresIn * 1000 }; sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current)) }
/** 메모리와 sessionStorage의 관리자 Access JWT를 함께 제거한다. */
export function clearAccessToken() { current = null; sessionStorage.removeItem(STORAGE_KEY) }
