/** 앱마다 별도 key를 쓰는 탭 단위 Access JWT 저장소. */
export function createAccessTokenStore(storageKey, expiryMarginMs = 30_000) {
  function read() {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || 'null')
    } catch {
      return null
    }
  }

  let current = read()

  return {
    getAccessToken() {
      return current && Date.now() < current.expiresAt - expiryMarginMs ? current.token : null
    },
    setAccessToken(token, expiresInSeconds) {
      current = { token, expiresAt: Date.now() + expiresInSeconds * 1000 }
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(current))
      } catch {
        // 저장소가 막혀 있어도 현재 탭의 메모리 세션은 유지한다.
      }
    },
    clearAccessToken() {
      current = null
      try {
        sessionStorage.removeItem(storageKey)
      } catch {
        // 저장소를 사용할 수 없어도 메모리 토큰은 폐기했다.
      }
    },
  }
}
