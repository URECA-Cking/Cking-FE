import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useToast } from '../context/useToast.js'
import { oauthLoginUrl } from '../api/auth.js'
import { saveLoginIntent } from '../utils/loginIntent.js'
import { isSplashDone, prefersReducedMotion } from '../utils/splashState.js'
import ThemedImage from '../components/ui/ThemedImage.jsx'

const PROVIDERS = [
  { id: 'google', label: 'Google로 계속하기', className: 'bg-surface-container-lowest text-on-surface border border-outline-variant/60' },
  { id: 'kakao', label: '카카오로 계속하기', className: 'bg-[#FEE500] text-[#191919] border border-transparent' },
]

/**
 * 로그인 화면.
 *
 * Google·Kakao OAuth 로그인을 시작한다(GET /oauth2/authorization/{provider}, Cking-BE docs/domains/auth/api.md).
 * 로그인이 끝나면 백엔드가 /oauth/callback으로 돌려보내고, OAuthCallback 화면이 Access JWT를 발급받는다.
 */
export default function Login() {
  const location = useLocation()
  const showToast = useToast()

  const [agreed, setAgreed] = useState(false)
  // 스플래시가 이미 끝난 뒤에 이 화면이 뜬 경우(로그아웃 등)에만 왕관 연출을 한다. 첫 진입은 스플래시가 이어받는다.
  const [enter] = useState(() => isSplashDone() && !prefersReducedMotion())

  const redirectTo = location.state?.from ?? '/'

  function handleLogin(provider) {
    if (!agreed) {
      showToast('이용약관에 먼저 동의해주세요.', { icon: 'error' })
      return
    }
    saveLoginIntent({ redirectTo })
    window.location.assign(oauthLoginUrl(provider))
  }

  return (
    <div className="flex flex-col w-full min-h-[100dvh] px-margin pb-space-xl pt-safe">
      {/* 스플래시(Splash.jsx)가 이 로고 자리(data-splash-target)로 옮겨 와 그대로 이어진다. 크기·모양을 같이 맞춘다. */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <h1 data-splash-target className="inline-flex">
          {/* 스플래시와 같은 몸통·왕관 2레이어. 첫 진입은 스플래시가 이 자리로 이어져 정지 상태로 두고,
              그 뒤(로그아웃 등)에 이 화면이 다시 뜰 때마다 왕관이 떨어진다. */}
          <span className={`relative block w-[232px] ${enter ? 'logo-enter splash-stack' : ''}`}>
            <ThemedImage dark="/cking-logo-body.png" light="/cking-logo-body-light.png" alt="CKing" className={`w-full ${enter ? 'splash-body' : ''}`} />
            <img src="/cking-crown.png" alt="" className={`absolute inset-0 h-full w-full ${enter ? 'splash-crown' : ''}`} />
          </span>
        </h1>
      </div>

      <div className="flex items-center gap-2 mb-space-md px-1">
        <input
          id="terms-agree"
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
        />
        <label
          className="font-body-sm text-body-sm text-on-surface-variant cursor-pointer select-none"
          htmlFor="terms-agree"
        >
          이용약관 및 개인정보 수집·이용에 동의합니다.
        </label>
      </div>

      <div className="flex flex-col gap-space-sm">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={!agreed}
            onClick={() => handleLogin(provider.id)}
            className={`w-full h-12 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs shadow-sm active:scale-[0.98] transition-all ${provider.className}`}
          >
            {provider.label}
          </button>
        ))}
      </div>
    </div>
  )
}
