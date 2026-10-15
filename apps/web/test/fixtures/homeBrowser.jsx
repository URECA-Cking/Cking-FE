import React from 'react'
import { createRoot } from 'react-dom/client'
import InstallBanner from '../../src/components/pwa/InstallBanner.jsx'
import FilledCheck from '../../src/components/home/FilledCheck.jsx'
import MissionSection from '../../src/components/home/MissionSection.jsx'
import MyTicketsContext from '../../src/context/myTicketsContext.js'
import ToastContext from '../../src/context/toastContext.js'

const root = createRoot(document.getElementById('root'))

/** 설치 안내 배너를 그린다. */
window.renderInstallBanner = () => root.render(<InstallBanner />)
/** 완료 체크 표시를 지정한 톤과 크기로 그린다. */
window.renderFilledCheck = (tone, size) => root.render(<FilledCheck tone={tone} size={size} />)
/** 공용 미션 카드를 토스트·응모권 Context를 비운 채로 그린다. */
window.renderMission = (memberId) => root.render(
  <ToastContext.Provider value={() => {}}>
    <MyTicketsContext.Provider value={{ refresh() {} }}>
      <MissionSection memberId={memberId} />
    </MyTicketsContext.Provider>
  </ToastContext.Provider>,
)
