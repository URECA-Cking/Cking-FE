import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { oauthLoginUrl } from '../api/auth.js'
import { bannerImage } from '../data/images.js'
import { saveLoginIntent } from '../utils/loginIntent.js'

const ROLES = [
  {
    id: 'fan',
    icon: 'favorite',
    title: '팬으로 시작',
    desc: '좋아하는 크리에이터의 게시물과 이벤트를 즐길 수 있어요.',
  },
  {
    id: 'creator',
    icon: 'mic',
    title: '크리에이터로 시작',
    desc: '팬 활동과 크리에이터 기능을 함께 사용할 수 있어요. (크리에이터 전환 신청이 함께 접수돼요)',
  },
]

const PROVIDERS = [
  { id: 'google', label: 'Google로 계속하기', className: 'bg-surface-container-lowest text-on-surface border border-outline-variant/60' },
  { id: 'kakao', label: '카카오로 계속하기', className: 'bg-[#FEE500] text-[#191919] border border-transparent' },
]

/**
 * 로그인 화면.
 *
 * Google·Kakao OAuth 로그인을 시작한다(GET /oauth2/authorization/{provider}, Cking-BE docs/domains/auth/api.md).
 * 로그인이 끝나면 백엔드가 /oauth/callback으로 돌려보내고, OAuthCallback 화면이 Access JWT를 발급받는다.
 * 크리에이터로 시작을 고르면 로그인 직후 POST /api/creator/applications로 전환 신청까지 접수한다.
 */
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const { user, status } = useUser()

  const [role, setRole] = useState('fan')
  const [agreed, setAgreed] = useState(false)

  const redirectTo = location.state?.from ?? '/'
  const alreadySignedIn = status === 'authenticated' && Boolean(user)

  function handleLogin(provider) {
    if (!agreed) {
      showToast('이용약관에 먼저 동의해주세요.', { icon: 'error' })
      return
    }
    saveLoginIntent({ role, redirectTo })
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

      <section className="flex flex-col gap-space-sm mb-space-lg">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface font-semibold">어떻게 시작하시겠어요?</span>
          <span className="font-label-xs text-label-xs text-primary bg-berry-tint px-2 py-0.5 rounded-full font-semibold">
            맞춤 프로필 설정
          </span>
        </div>
        <div className="grid grid-cols-1 gap-space-sm">
          {ROLES.map((option) => {
            const selected = role === option.id
            return (
              <label
                key={option.id}
                className={`relative flex items-start gap-space-md p-space-md rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                  selected
                    ? 'bg-surface-container-lowest shadow-md border-primary'
                    : 'bg-surface-container-low shadow-sm border-transparent opacity-90'
                }`}
              >
                <input
                  type="radio"
                  name="account_role"
                  value={option.id}
                  checked={selected}
                  onChange={() => setRole(option.id)}
                  className="sr-only"
                />
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5 ${
                    selected ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <MaterialIcon name={option.icon} className="text-title-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-title-md text-title-md text-on-surface font-semibold">{option.title}</span>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        selected ? 'bg-primary text-on-primary' : 'bg-surface-container text-transparent'
                      }`}
                    >
                      <MaterialIcon name="check" className="text-[14px]" />
                    </div>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">
                    {option.desc}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      </section>

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
