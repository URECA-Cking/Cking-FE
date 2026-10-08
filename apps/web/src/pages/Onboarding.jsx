import { useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import InterestStep from '../components/onboarding/InterestStep.jsx'
import CreatorStep from '../components/onboarding/CreatorStep.jsx'
import { completeOnboarding } from '../api/auth.js'
import { describeError } from '../api/client.js'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'

/**
 * 온보딩: 1단계 관심 분야(0~3개, 건너뛰기 가능) → 2단계 크리에이터 추천·직접 찾기.
 *
 * `manage`이면 가입 직후 흐름이 아니라 마이페이지 등에서 다시 연 "관심 크리에이터 관리"라
 * 2단계만 보여주고 단계 표시를 하지 않으며 완료 기록도 남기지 않는다.
 * 가입 직후에는 로그인 콜백이 onboardingCompleted=false인 신규 가입자를 이 화면으로 보내고(#66),
 * "시작하기"·"나중에 할게"를 누르면 BE에 완료를 기록한 뒤 로그인 전에 가려던 화면으로 이동한다.
 */
// 단계만 바꾸고 나머지 쿼리(?subtags=0 같은 실험 스위치)는 보존한다. 통째로 교체하면 다음 단계에서 스위치가 사라진다.
function withStep(prev, step) {
  const next = new URLSearchParams(prev)
  if (step) next.set('step', step)
  else next.delete('step')
  return next
}

export default function Onboarding({ manage = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const { user, markOnboardingCompleted } = useUser()
  const [finishing, setFinishing] = useState(false)
  // 같은 틱에 연달아 눌러도 한 번만 처리한다(state는 다음 렌더에야 바뀐다).
  const finishingRef = useRef(false)
  // 단계를 주소(?step=creators)에 둔다. 크리에이터 스페이스를 둘러보고 뒤로 돌아와도 1단계로 되돌아가지 않는다.
  const [params, setParams] = useSearchParams()
  const step = manage || params.get('step') === 'creators' ? 'creators' : 'interests'
  const destination = location.state?.from ?? '/'

  async function finish() {
    if (finishingRef.current) return
    finishingRef.current = true
    setFinishing(true)
    // 이미 완료한 사용자가 다시 열었다면 기록을 또 남기지 않는다.
    if (user?.onboardingCompleted !== true) {
      try {
        await completeOnboarding()
        markOnboardingCompleted()
      } catch (err) {
        // 기록에 실패해도 사용자를 막지 않는다. 다음 로그인 때 온보딩이 다시 보일 수 있다.
        showToast(describeError(err, '온보딩 완료를 저장하지 못했어요. 다음에 다시 보일 수 있어요.'), { icon: 'error' })
      }
    }
    navigate(destination, { replace: true })
  }

  function handleBack() {
    // 앱 안에서 뒤로 갈 곳이 있는지: react-router가 이 앱에서 쌓은 위치를 history.state.idx에 기록한다.
    // 로그인 직후에는 이전 기록이 Google·BE 로그인 중간 페이지라 idx가 0이고, 그쪽으로 돌아가면 안 된다.
    const canGoBack = (window.history.state?.idx ?? 0) > 0
    if (canGoBack) {
      // 1단계에서 "다음"으로 쌓은 기록을 그대로 되돌린다. 덮어쓰면 1단계 항목이 중복으로 남아 다시 뒤로가도 변화가 없다.
      navigate(-1)
      return
    }
    // 새로고침 등으로 2단계에서 시작했다면 기록을 늘리지 않고 1단계로 바꾼다.
    if (step === 'creators' && !manage) {
      setParams((prev) => withStep(prev, null), { replace: true, state: location.state })
      return
    }
    // 돌아갈 곳이 없으면(가입 직후 등) 로그인 전에 가려던 화면, 없으면 홈으로 보낸다.
    navigate(manage ? '/' : destination, { replace: true })
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-36">
      <BackHeader
        title={manage ? '관심 크리에이터 관리' : ''}
        badge={manage ? undefined : `Cking 단계 ${step === 'interests' ? 1 : 2}/2`}
        // 공유 버튼은 공유할 수 없는 화면이라 숨긴다. badge가 없을 때만 right가 쓰인다.
        right={<span />}
        onBack={handleBack}
      />
      {step === 'interests' ? (
        <InterestStep onDone={() => setParams((prev) => withStep(prev, 'creators'), { state: location.state })} />
      ) : (
        <CreatorStep
          onFinish={manage ? () => navigate(-1) : finish}
          busy={finishing}
          finishLabel={manage ? '완료' : '시작하기'}
          showSkip={!manage}
        />
      )}
    </div>
  )
}
