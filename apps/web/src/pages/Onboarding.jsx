import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import InterestStep from '../components/onboarding/InterestStep.jsx'
import CreatorStep from '../components/onboarding/CreatorStep.jsx'
import ConfirmSheet from '../components/ui/ConfirmSheet.jsx'
import { LoadingBlock } from '../components/ui/States.jsx'
import { completeOnboarding } from '../api/auth.js'
import { describeError } from '../api/client.js'
import { useToast } from '../context/useToast.js'
import { canGoBackInApp } from '../hooks/useAppBack.js'
import { useBackGuard } from '../hooks/useBackGuard.js'
import { useUser } from '../context/useUser.js'

/**
 * 온보딩: 1단계 관심 분야(0~3개, 건너뛰기 가능) → 2단계 크리에이터 추천·직접 찾기.
 *
 * `manage`이면 가입 직후 흐름이 아니라 마이페이지 등에서 다시 연 "관심 크리에이터 관리"라
 * 2단계만 보여주고 단계 표시를 하지 않으며 완료 기록도 남기지 않는다.
 * 가입 직후에는 로그인 콜백이 onboardingCompleted=false인 신규 가입자를 이 화면으로 보내고(#66),
 * "시작하기"·"나중에 할게"를 누르면 BE에 완료를 기록한 뒤 로그인 전에 가려던 화면으로 이동한다.
 */
// 단계만 바꾸고 나머지 쿼리는 보존한다. 통째로 교체하면 다른 화면이 붙여 둔 쿼리가 다음 단계에서 사라진다.
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
  // 1단계에서 2단계로 넘어가는 중인지(가드를 걷는 비동기 구간).
  const advancingRef = useRef(false)
  // 가입 직후 1단계에서 뒤로가기를 눌렀을 때 온보딩을 건너뛸지 묻는 확인 시트가 열려 있는지.
  const [confirmingSkip, setConfirmingSkip] = useState(false)
  // 완료 후 쌓인 기록을 되감는 동안 단계 화면 대신 이동 중 화면을 보여주는지.
  const [leaving, setLeaving] = useState(false)
  // 단계를 주소(?step=creators)에 둔다. 크리에이터 스페이스를 둘러보고 뒤로 돌아와도 1단계로 되돌아가지 않는다.
  const [params, setParams] = useSearchParams()
  const step = manage || params.get('step') === 'creators' ? 'creators' : 'interests'
  const destination = location.state?.from ?? '/'

  // 가입 직후 1단계에서는 브라우저·기기 뒤로가기도 헤더 뒤로가기처럼 확인 시트로 받는다.
  // 이미 시트가 열려 있을 때 누르면 시트를 닫는다(취소). 완료 처리 중에는 입력을 무시한다.
  const { release: releaseBackGuard, leave: leaveWithBackGuard } = useBackGuard(!manage && step === 'interests', () => {
    if (finishingRef.current) return
    setConfirmingSkip((open) => !open)
  })

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
    // 온보딩이 쌓은 항목(가드 항목, "다음"으로 쌓은 2단계 항목)을 모두 되감은 뒤 처음 열린 항목을 교체해야,
    // 이동한 화면에서 뒤로가기를 눌렀을 때 온보딩이 되살아나지 않는다.
    // 온보딩을 연 history 위치는 2단계 항목의 state에 실어 두었다. 크리에이터 스페이스 등을 둘러보고 돌아와 이 화면이 새로 마운트돼도 잃지 않는다.
    // state가 없으면(1단계이거나 2단계에서 새로고침한 경우) 지금 위치가 곧 온보딩을 연 위치다.
    const currentIdx = window.history.state?.idx ?? 0
    const pushed = Math.max(0, currentIdx - (location.state?.onboardingStartIdx ?? currentIdx))
    // 되감으면 라우터가 먼저 1단계 화면을 그리므로, 되감기 전에 이동 중 화면으로 바꿔 1단계가 잠깐 비치지 않게 한다.
    // 렌더가 되감기보다 먼저 끝나도록 즉시 반영한다.
    if (pushed > 0) flushSync(() => setLeaving(true))
    await leaveWithBackGuard(pushed)
    navigate(destination, { replace: true })
  }

  /** 뒤로가기: 단계에 따라 되돌린다. 가입 직후 1단계는 되돌아갈 단계가 없어 기록 유무와 관계없이 건너뛸지 먼저 묻는다. */
  function handleBack() {
    // 도킹 관리는 되돌아갈 기록이 없으면(주소로 직접 연 경우) 홈으로 보낸다.
    if (manage) {
      if (canGoBackInApp()) navigate(-1)
      else navigate('/', { replace: true })
      return
    }
    if (step === 'creators') {
      // 1단계에서 "다음"으로 쌓은 기록을 그대로 되돌린다. 덮어쓰면 1단계 항목이 중복으로 남아 다시 뒤로가도 변화가 없다.
      if (canGoBackInApp()) navigate(-1)
      // 새로고침 등으로 2단계에서 시작했다면 기록을 늘리지 않고 1단계로 바꾼다.
      else setParams((prev) => withStep(prev, null), { replace: true, state: location.state })
      return
    }
    // 가입 직후 1단계는 마이페이지 등 관계없는 화면으로 조용히 보내지 않고, 건너뛸지 먼저 확인한다.
    setConfirmingSkip(true)
  }

  if (leaving) return <LoadingBlock label="이동하는 중..." />

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-36">
      <BackHeader
        title={manage ? '도킹 관리' : ''}
        badge={manage ? undefined : `Cking 단계 ${step === 'interests' ? 1 : 2}/2`}
        // 공유 버튼은 공유할 수 없는 화면이라 숨긴다. badge가 없을 때만 right가 쓰인다.
        right={<span />}
        onBack={handleBack}
      />
      {step === 'interests' ? (
        <InterestStep
          onDone={async () => {
            // 가드를 걷는 동안 연달아 눌려도 2단계 항목이 두 번 쌓이지 않게 한 번만 처리한다.
            if (advancingRef.current) return
            advancingRef.current = true
            try {
              // 2단계 항목을 가드 항목 위에 쌓지 않도록 가드를 먼저 걷는다. 그래야 완료할 때 되감을 항목 수가 맞다.
              await releaseBackGuard()
              // 지금 위치(온보딩을 연 위치)를 2단계 항목에 실어 둔다. 완료할 때 되감을 항목 수의 기준이다.
              setParams((prev) => withStep(prev, 'creators'), {
                state: { ...location.state, onboardingStartIdx: window.history.state?.idx ?? 0 },
              })
            } finally {
              advancingRef.current = false
            }
          }}
        />
      ) : (
        <CreatorStep
          onFinish={manage ? () => navigate(-1) : finish}
          busy={finishing}
          finishLabel={manage ? '완료' : '시작하기'}
          showSkip={!manage}
        />
      )}
      <ConfirmSheet
        open={confirmingSkip}
        title="온보딩을 건너뛸까요?"
        message="지금 나가면 관심 분야와 크리에이터 선택을 건너뛴 것으로 처리해요."
        confirmLabel="건너뛰기"
        confirmTone="primary"
        busy={finishing}
        onConfirm={finish}
        onClose={() => setConfirmingSkip(false)}
      />
    </div>
  )
}
