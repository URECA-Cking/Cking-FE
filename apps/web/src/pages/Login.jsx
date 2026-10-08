import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useToast } from '../context/useToast.js'
import { oauthLoginUrl } from '../api/auth.js'
import { saveLoginIntent } from '../utils/loginIntent.js'
import { isSplashDone, prefersReducedMotion } from '../utils/splashState.js'
import ThemedImage from '../components/ui/ThemedImage.jsx'
import kakaoIcon from '@cking/shared/icons/kakao2.svg'

const PROVIDERS = [
  { id: 'google', label: '구글로 시작하기' },
  { id: 'kakao', label: '카카오로 시작하기' },
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
            className={provider.id === 'google'
              ? 'relative w-full h-12 overflow-hidden rounded-xl bg-[#f2f2f2] text-[#1f1f1f] disabled:cursor-default disabled:bg-[#ffffff61] disabled:[&>.gsi-material-button-content-wrapper]:opacity-[0.38] active:scale-[0.98] transition-[background-color,box-shadow,transform] duration-[218ms] hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.30),0_1px_3px_1px_rgba(60,64,67,0.15)] hover:[&>.gsi-material-button-state]:opacity-[0.08] active:[&>.gsi-material-button-state]:opacity-[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#001d35]/30 focus-visible:[&>.gsi-material-button-state]:opacity-[0.12]'
              : 'relative w-full h-12 overflow-hidden rounded-xl bg-[#FEE500] text-[#191919] disabled:cursor-default disabled:opacity-50 disabled:[&>.kakao-button-content-wrapper]:opacity-[0.76] active:scale-[0.98] transition-all'}
          >
            {/* Google·Kakao 브랜드 가이드의 색상과 상호작용을 유지한다. */}
            {provider.id === 'google' ? (
              <>
                <span className="gsi-material-button-state absolute inset-0 bg-[#001d35] opacity-0 transition-opacity duration-[218ms]" />
                <span className="gsi-material-button-content-wrapper relative mx-auto grid h-full w-[12.5rem] grid-cols-[2.5rem_1fr] items-center gap-2.5 px-3 text-[14px] font-semibold tracking-[0.25px]">
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 justify-self-center"
                    viewBox="0 0 48 48"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  <span className="justify-self-start">{provider.label}</span>
                </span>
              </>
            ) : (
              <span className="kakao-button-content-wrapper relative mx-auto grid h-full w-[12.5rem] grid-cols-[2.5rem_1fr] items-center gap-2.5 px-3 font-label-md text-label-md font-semibold">
                <img src={kakaoIcon} alt="" aria-hidden="true" className="h-10 w-10 shrink-0 justify-self-center" />
                <span className="justify-self-start">{provider.label}</span>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
