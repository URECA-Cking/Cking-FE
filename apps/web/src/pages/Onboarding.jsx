import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import InterestStep from '../components/onboarding/InterestStep.jsx'
import CreatorStep from '../components/onboarding/CreatorStep.jsx'

/**
 * 온보딩: 1단계 관심 분야(0~3개, 건너뛰기 가능) → 2단계 크리에이터 추천·직접 찾기.
 *
 * `manage`이면 가입 직후 흐름이 아니라 마이페이지 등에서 다시 연 "관심 크리에이터 관리"라
 * 2단계만 보여주고 단계 표시를 하지 않는다. 가입 직후 자동 이동은 BE의 온보딩 완료 여부(onboardingCompleted)가
 * 생긴 뒤에 연결한다(이슈 #64).
 */
export default function Onboarding({ manage = false }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(manage ? 'creators' : 'interests')
  const goHome = () => navigate('/', { replace: true })

  function handleBack() {
    if (step === 'creators' && !manage) setStep('interests')
    else navigate(-1)
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
        <InterestStep onDone={() => setStep('creators')} />
      ) : (
        <CreatorStep onFinish={manage ? () => navigate(-1) : goHome} finishLabel={manage ? '완료' : '시작하기'} showSkip={!manage} />
      )}
    </div>
  )
}
