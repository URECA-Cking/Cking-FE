// 첫 화면 스플래시(Splash.jsx)의 진행 상태를 여러 컴포넌트가 함께 보기 위한 모듈 상태.
const SKIP_KEY = 'cking:skip-splash'

/** 당겨서 새로고침으로 다시 열리는 페이지는 이미 CKing 연출을 봤으므로, 다음 한 번은 스플래시를 건너뛴다. */
export function markSkipSplash() {
  try {
    sessionStorage.setItem(SKIP_KEY, '1')
  } catch {
    // 저장소를 못 써도 스플래시가 한 번 더 보일 뿐이라 무시한다.
  }
}

function consumeSkipSplash() {
  try {
    const skip = sessionStorage.getItem(SKIP_KEY) === '1'
    sessionStorage.removeItem(SKIP_KEY)
    return skip
  } catch {
    return false
  }
}

export function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

// 모듈이 로드될 때 한 번만 읽는다. 컴포넌트 안에서 읽으면 StrictMode의 이중 호출로 두 번째에 표식이 사라져 있다.
const skipOnce = consumeSkipSplash()

/** 이 페이지 로드에서 스플래시를 보여주는가. OAuth 콜백은 로그인 도중 거쳐 가는 화면이라 진입으로 보지 않는다. */
export const splashOnLoad =
  !skipOnce && !window.location.pathname.startsWith('/oauth/callback') && !prefersReducedMotion()

let splashDone = !splashOnLoad

export function markSplashDone() {
  splashDone = true
}

/** 스플래시가 끝났거나 아예 없었는가. 이후 화면에 들어올 때(예: 로그아웃 뒤 로그인 화면) 자체 연출을 쓸지 정하는 데 쓴다. */
export function isSplashDone() {
  return splashDone
}
