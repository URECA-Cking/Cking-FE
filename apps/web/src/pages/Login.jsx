import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { oauthLoginUrl } from '../api/auth.js'
import { bannerImage } from '../data/images.js'
import { saveLoginIntent } from '../utils/loginIntent.js'

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
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const { user, status } = useUser()

  const [agreed, setAgreed] = useState(false)

  const redirectTo = location.state?.from ?? '/'
  const alreadySignedIn = status === 'authenticated' && Boolean(user)

  function handleLogin(provider) {
    if (!agreed) {
      showToast('이용약관에 먼저 동의해주세요.', { icon: 'error' })
      return
    }
    saveLoginIntent({ redirectTo })
    window.location.assign(oauthLoginUrl(provider))
  }

  return (
    <div className="flex flex-col w-full min-h-screen px-margin pb-space-xl pt-safe">
      <div className="flex flex-col items-center pt-space-md pb-space-md text-center">
        <div className="flex items-center gap-space-xs px-space-md py-1.5 rounded-full bg-berry-tint text-primary shadow-sm mb-space-sm">
          <MaterialIcon name="auto_awesome" filled className="text-primary text-title-lg" />
          <span className="font-label-sm text-label-sm text-primary tracking-wider uppercase font-semibold">Cking</span>
        </div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-1">
          좋아하는 크리에이터와
          <br />더 가까워지는 순간
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 max-w-xs">
          한정판 드롭 티켓부터 단독 팬밋업까지, 투명하고 설레는 래플 라이브
        </p>
      </div>

      <div className="relative w-full h-40 rounded-2xl overflow-hidden shadow-card mb-space-lg">
        <img className="w-full h-full object-cover" src={bannerImage('cking-hero', 900, 500)} alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-surface/90 via-slate-surface/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2.5 text-white">
          <img
            className="w-10 h-10 rounded-full object-cover border-2 border-white/70"
            src={bannerImage('cking-hero-avatar', 120, 120)}
            alt=""
          />
          <div className="min-w-0">
            <p className="font-label-md text-label-md font-bold truncate">Cking Live Drop</p>
            <p className="font-label-xs text-label-xs text-white/85 truncate">
              로그인하면 바로 이벤트 응모를 시작할 수 있어요
            </p>
          </div>
        </div>
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
        {alreadySignedIn && (
          <button
            type="button"
            onClick={() => navigate(redirectTo, { replace: true })}
            className="w-full py-2.5 text-center font-label-md text-label-md text-outline hover:text-on-surface transition-colors"
          >
            {user.name}님으로 계속하기
          </button>
        )}
      </div>
    </div>
  )
}
