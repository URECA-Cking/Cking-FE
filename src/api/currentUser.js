/**
 * 로그인이 없는 상태에서 "현재 사용자"를 식별하기 위한 값 하나만 localStorage에 저장한다.
 * 인증 토큰이 아니라 단순 식별값이며, 기본값을 자동으로 채우지 않는다 — 미설정은
 * 미설정 그대로 두고 각 화면이 getCurrentUserId() === null을 직접 처리한다.
 */
const CURRENT_USER_ID_KEY = 'cking.currentUserId'

const listeners = new Set()

function emit() {
  for (const listener of listeners) listener()
}

/** userId 변경(설정/해제)을 구독한다. */
export function subscribeCurrentUserId(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCurrentUserId() {
  const stored = window.localStorage.getItem(CURRENT_USER_ID_KEY)
  const parsed = stored ? Number(stored) : NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function setCurrentUserId(userId) {
  if (!Number.isInteger(userId) || userId <= 0) return
  window.localStorage.setItem(CURRENT_USER_ID_KEY, String(userId))
  emit()
}

export function clearCurrentUserId() {
  window.localStorage.removeItem(CURRENT_USER_ID_KEY)
  emit()
}
