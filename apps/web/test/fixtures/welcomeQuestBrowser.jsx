import React from 'react'
import { createRoot } from 'react-dom/client'
import { useWelcomeQuest } from '../../src/hooks/useWelcomeQuest.js'

const root = createRoot(document.getElementById('root'))

/** 훅의 상태와 지급 결과를 화면에 문자열로 드러내 테스트가 읽을 수 있게 하는 확인용 컴포넌트. */
function Probe({ memberId }) {
  const { quest, loading, error, claim, claimingSteps } = useWelcomeQuest(memberId)
  window.claimStep = async (step, options) => {
    try {
      window.claimResult = { ok: true, value: await claim(step, options) }
    } catch (claimError) {
      window.claimResult = { ok: false, code: claimError.code }
    }
  }
  const statuses = (quest?.items ?? []).map((item) => `${item.step}:${item.status}`).join(',')
  return (
    <div>
      <p data-testid="loading">{String(loading)}</p>
      <p data-testid="error">{error ?? ''}</p>
      <p data-testid="eligible">{String(quest?.eligible)}</p>
      <p data-testid="completed">{String(quest?.completed)}</p>
      <p data-testid="items">{statuses}</p>
      <p data-testid="bonus">{quest?.bonus?.status ?? ''}</p>
      <p data-testid="claiming">{claimingSteps.join(',')}</p>
    </div>
  )
}

/** 지정한 회원으로 확인용 컴포넌트를 그린다. */
window.renderWelcomeQuest = (memberId) => root.render(<Probe memberId={memberId} />)
