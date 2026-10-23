import React from 'react'
import { createRoot } from 'react-dom/client'
import InterestEditor from '../../src/components/creator/InterestEditor.jsx'
import { ToastProvider } from '../../src/context/ToastContext.jsx'

// 관심 분야 편집을 저장된 선택(mine)만 바꿔 가며 띄운다. 카탈로그는 현재 버전의 두 분야뿐이다.
const catalog = {
  taxonomyVersion: 'v2',
  maxSelection: 3,
  items: [
    { interestCode: 'MUSIC', name: '음악' },
    { interestCode: 'GAME', name: '게임' },
  ],
}

const root = createRoot(document.getElementById('root'))
window.renderEditor = (interestCodes) => {
  root.render(
    <ToastProvider>
      <InterestEditor catalog={catalog} mine={{ interestCodes }} onReloadMine={() => {}} onRetryCatalog={() => {}} />
    </ToastProvider>,
  )
}
