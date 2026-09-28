// OAuth 로그인은 다른 사이트(Google·Kakao)를 거쳐 /oauth/callback으로 돌아오므로,
// 로그인 전에 고른 값(크리에이터로 시작 여부, 로그인 후 돌아갈 화면)을 sessionStorage에 잠시 맡겨 둔다.

const KEY = 'cking.loginIntent'

/** 백엔드가 로그인 결과를 돌려보내는 프론트 경로(Cking-BE cking.auth.frontend-callback-url). */
export const OAUTH_CALLBACK_PATH = '/oauth/callback'

/** @param {{ role: 'fan'|'creator', redirectTo: string }} intent */
export function saveLoginIntent(intent) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(intent))
  } catch {
    // 저장하지 못해도 로그인 자체는 진행된다(기본값으로 처리).
  }
}

/** 저장된 값을 꺼내고 지운다. 없으면 기본값을 돌려준다. */
export function consumeLoginIntent() {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // 무시하고 기본값 사용
  }
  return { role: 'fan', redirectTo: '/' }
}
