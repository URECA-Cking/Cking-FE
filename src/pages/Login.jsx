import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { LoadingBlock, ErrorBlock } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { useAsync } from '../hooks/useAsync.js'
import { getUsers, selectUser as selectUserApi } from '../api/users.js'
import { applyCreator } from '../api/creatorApplications.js'
import { describeError } from '../api/client.js'
import { bannerImage } from '../data/images.js'

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
    desc: '팬 활동과 크리에이터 기능을 함께 사용할 수 있어. (크리에이터 전환 신청이 함께 접수돼)',
  },
]

/**
 * 로그인 화면.
 *
 * 백엔드에 회원가입/인증 API가 없고 가상 사용자 선택만 제공하므로
 * (GET /api/users, POST /api/demo/users/select), 이 화면은 시안의 가입 화면 구성을
 * 유지하면서 "계정 선택"으로 동작한다. 크리에이터로 시작을 고르면 로그인 직후
 * POST /api/creator/applications 로 전환 신청까지 접수한다.
 */
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const { user, selectUser, refreshCapabilities } = useUser()

  const [role, setRole] = useState('fan')
  const [query, setQuery] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [starting, setStarting] = useState(false)
  const [selectedId, setSelectedId] = useState(() => user?.userId ?? null)

  const { data: users, loading, error, reload } = useAsync(() => getUsers(), [], {
    fallbackMessage: '가상 사용자 목록을 불러오지 못했습니다.',
  })

  const filtered = useMemo(() => {
    const list = users ?? []
    const keyword = query.trim().toLowerCase()
    if (!keyword) return list
    return list.filter(
      (candidate) =>
        candidate.name?.toLowerCase().includes(keyword) || String(candidate.userId).includes(keyword),
    )
  }, [users, query])

  const redirectTo = location.state?.from ?? '/'
  const alreadySignedIn = Boolean(user)

  async function handleStart() {
    const candidate = (users ?? []).find((item) => item.userId === selectedId)
    if (!candidate) {
      showToast('시작할 계정을 먼저 선택해주세요.', { icon: 'error' })
      return
    }
    setStarting(true)
    try {
      const result = await selectUserApi(candidate.userId)
      const nextUser = { userId: result?.userId ?? candidate.userId, name: result?.name ?? candidate.name }
      selectUser(nextUser)

      if (role === 'creator') {
        try {
          await applyCreator(nextUser.userId)
          showToast(`${nextUser.name}님으로 시작! 크리에이터 전환 신청도 접수했어요.`)
        } catch (creatorError) {
          showToast(describeError(creatorError, '크리에이터 전환 신청에 실패했어요.'), { icon: 'error' })
        }
      } else {
        showToast(`${nextUser.name}님으로 시작합니다.`)
      }

      await refreshCapabilities(nextUser)
      navigate(alreadySignedIn ? redirectTo : '/onboarding/creators', { replace: true })
    } catch (err) {
      showToast(describeError(err, '계정 선택에 실패했습니다.'), { icon: 'error' })
    } finally {
      setStarting(false)
    }
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
              계정을 고르면 바로 이벤트 응모를 시작할 수 있어요
            </p>
          </div>
        </div>
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

      <section className="flex flex-col gap-space-sm mb-space-lg">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface font-semibold">계정 선택</span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">GET /api/users</span>
        </div>
        <p className="font-label-xs text-label-xs text-on-surface-variant leading-relaxed -mt-1">
          아직 회원가입·인증 API가 없어서, 백엔드가 제공하는 가상 사용자 중 하나로 로그인합니다.
        </p>

        <div className="relative flex items-center">
          <MaterialIcon name="search" className="absolute left-3.5 text-outline text-[20px] pointer-events-none" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl bg-surface-container text-on-surface font-body-md text-body-md placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all"
            placeholder="이름 또는 userId로 검색"
            type="search"
          />
        </div>

        {loading && <LoadingBlock label="계정 목록을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && (
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto no-scrollbar">
            {filtered.map((candidate) => {
              const isSelected = selectedId === candidate.userId
              return (
                <button
                  key={candidate.userId}
                  type="button"
                  onClick={() => setSelectedId(candidate.userId)}
                  className={`flex items-center justify-between gap-space-sm p-space-sm rounded-xl border transition-all active:scale-[0.98] ${
                    isSelected
                      ? 'bg-berry-tint border-primary shadow-sm'
                      : 'bg-surface-container-lowest border-transparent hover:border-outline-variant/40'
                  }`}
                >
                  <div className="flex items-center gap-space-sm min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      <MaterialIcon name="person" className="text-[18px]" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="font-label-md text-label-md font-semibold text-on-surface truncate">
                        {candidate.name}
                      </p>
                      <p className="font-label-xs text-label-xs text-on-surface-variant">userId: {candidate.userId}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <MaterialIcon name="check_circle" filled className="text-primary text-[20px] shrink-0" />
                  )}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-center font-body-sm text-body-sm text-on-surface-variant py-6">
                조건에 맞는 계정이 없어요.
              </p>
            )}
          </div>
        )}
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
        <button
          type="button"
          disabled={!agreed || selectedId === null || starting}
          onClick={handleStart}
          className="w-full h-12 rounded-xl bg-primary hover:bg-[#be185d] disabled:opacity-50 disabled:cursor-not-allowed text-on-primary font-label-md text-label-md flex items-center justify-center gap-space-xs shadow-md active:scale-[0.98] transition-all"
        >
          <span>{starting ? '시작하는 중...' : '시작하기'}</span>
          <MaterialIcon name="arrow_forward" className="text-title-md" />
        </button>
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
