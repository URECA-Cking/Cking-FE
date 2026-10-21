import React from 'react'
import { createRoot } from 'react-dom/client'
import { useMyCreatorRecommendations } from '../../src/hooks/useMyCreatorRecommendations.js'

const root = createRoot(document.getElementById('root'))

/** 훅이 돌려주는 상태를 화면에 문자열로 드러내 테스트가 읽을 수 있게 하는 확인용 컴포넌트. */
function Probe({ memberId }) {
  const { items, requestId, loading, error, reload } = useMyCreatorRecommendations(memberId)
  window.reloadRecommendations = reload
  return (
    <div>
      <p data-testid="loading">{String(loading)}</p>
      <p data-testid="error">{error ?? ''}</p>
      <p data-testid="items">{items.map((creator) => creator.name).join(',')}</p>
      <p data-testid="request">{requestId ?? ''}</p>
      <p data-testid="profiles">{JSON.stringify(items)}</p>
    </div>
  )
}

/** 지정한 회원으로 확인용 컴포넌트를 그린다. 같은 root에 다시 그리면 같은 인스턴스에서 회원만 바뀐다. */
window.renderRecommendations = (memberId) => root.render(<Probe memberId={memberId} />)
