import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'

const ROLES = [
  {
    id: 'fan',
    icon: 'favorite',
    title: '팬으로 시작',
    desc: '좋아하는 크리에이터의 게시물과 이벤트를 즐길 수 있어.',
  },
  {
    id: 'creator',
    icon: 'mic',
    title: '크리에이터로 시작',
    desc: '팬 활동과 크리에이터 기능을 함께 사용할 수 있어.',
  },
]

export default function Signup() {
  const navigate = useNavigate()
  const [role, setRole] = useState('fan')
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ nickname: '', email: '', password: '' })
  const [agreed, setAgreed] = useState(false)

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    navigate('/onboarding/creators')
  }

  return (
    <div className="flex flex-col w-full min-h-screen px-margin pb-space-xl">
      <div className="flex flex-col items-center pt-space-md pb-space-lg text-center">
        <div className="flex items-center gap-space-xs px-space-md py-1.5 rounded-full bg-berry-tint text-primary shadow-sm mb-space-sm">
          <MaterialIcon name="auto_awesome" filled className="text-primary text-title-lg" />
          <span className="font-label-sm text-label-sm text-primary tracking-wider uppercase font-semibold">
            Cking
          </span>
        </div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-1">
          좋아하는 크리에이터와
          <br />더 가까워지는 순간
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 max-w-xs">
          한정판 드롭 티켓부터 단독 팬밋업까지, 투명하고 설레는 래플 라이브
        </p>
      </div>

      <section className="flex flex-col gap-space-sm mb-space-lg">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface font-semibold">어떻게 시작할래?</span>
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
                    <span
                      className={`font-title-md text-title-md ${selected ? 'text-on-surface font-semibold' : 'text-on-surface'}`}
                    >
                      {option.title}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shadow-xs ${
                        selected ? 'bg-primary text-on-primary' : 'bg-surface-container text-transparent'
                      }`}
                    >
                      <MaterialIcon name="check" className="text-[14px]" />
                    </div>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{option.desc}</p>
                </div>
              </label>
            )
          })}
        </div>
      </section>

      <form className="flex flex-col gap-space-md mb-space-lg" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label className="font-label-sm text-label-sm text-on-surface font-semibold flex items-center gap-1" htmlFor="input-nickname">
            닉네임
            <span className="text-primary">*</span>
          </label>
          <div className="relative flex items-center">
            <MaterialIcon name="alternate_email" className="absolute left-3 text-outline text-title-md pointer-events-none" />
            <input
              id="input-nickname"
              type="text"
              required
              value={form.nickname}
              onChange={(event) => updateField('nickname', event.target.value)}
              className="w-full h-11 pl-10 pr-space-md rounded-xl bg-surface-container text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all"
              placeholder="드로우에서 사용할 애칭"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-label-sm text-label-sm text-on-surface font-semibold flex items-center gap-1" htmlFor="input-email">
            이메일 주소
            <span className="text-primary">*</span>
          </label>
          <div className="relative flex items-center">
            <MaterialIcon name="mail" className="absolute left-3 text-outline text-title-md pointer-events-none" />
            <input
              id="input-email"
              type="email"
              required
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              className="w-full h-11 pl-10 pr-space-md rounded-xl bg-surface-container text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all"
              placeholder="name@domain.com"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-label-sm text-label-sm text-on-surface font-semibold flex items-center gap-1" htmlFor="input-password">
            비밀번호
            <span className="text-primary">*</span>
          </label>
          <div className="relative flex items-center">
            <MaterialIcon name="lock" className="absolute left-3 text-outline text-title-md pointer-events-none" />
            <input
              id="input-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              className="w-full h-11 pl-10 pr-11 rounded-xl bg-surface-container text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all"
              placeholder="영문, 숫자 포함 8자리 이상"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 text-outline hover:text-on-surface flex items-center justify-center"
              aria-label="비밀번호 표시 전환"
            >
              <MaterialIcon name={showPassword ? 'visibility' : 'visibility_off'} className="text-title-md" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1 px-1">
          <input
            id="terms-agree"
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
          />
          <label className="font-body-sm text-body-sm text-on-surface-variant cursor-pointer select-none" htmlFor="terms-agree">
            이용약관 및 개인정보 수집·이용에 동의합니다.
          </label>
        </div>

        <div className="flex flex-col gap-space-sm pt-space-xs">
          <button
            type="submit"
            disabled={!agreed}
            className="w-full h-12 rounded-xl bg-primary hover:bg-[#be185d] disabled:opacity-50 disabled:cursor-not-allowed text-on-primary font-label-md text-label-md flex items-center justify-center gap-space-xs shadow-md active:scale-[0.98] transition-all"
          >
            <span>시작하기</span>
            <MaterialIcon name="arrow_forward" className="text-title-md" />
          </button>
          <div className="flex items-center justify-center gap-1.5 py-space-xs text-center">
            <span className="font-body-sm text-body-sm text-on-surface-variant">이미 계정이 있나요?</span>
            <button type="button" className="font-label-md text-label-md text-primary font-semibold hover:underline">
              로그인
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
