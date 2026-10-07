import { clearAccessToken, getAccessToken, setAccessToken } from './token.js'
import { get, post, refreshAccessToken } from './client.js'

/** 관리자 ID와 비밀번호로 전용 세션을 시작한다. */
export async function login(loginId, password) { const token = await post('/api/auth/admin/login', { loginId, password }, undefined, { skipRefresh: true }); setAccessToken(token.accessToken, token.expiresIn); return token }
/** 관리자 Access JWT로 현재 사용자 정보를 조회한다. */
export function getMe() { return get('/api/me') }
/** 저장된 Access JWT 또는 관리자 Refresh Cookie로 세션을 복원한다. */
export function restoreSession() { return getAccessToken() ? Promise.resolve(true) : refreshAccessToken() }
/** 관리자 Refresh Cookie를 폐기하고 로컬 Access JWT를 지운다. */
export async function logout() { try { await post('/api/admin/auth/logout', undefined, undefined, { skipRefresh: true }) } finally { clearAccessToken() } }
