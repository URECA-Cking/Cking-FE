import React from 'react'
import { createRoot } from 'react-dom/client'
import InstallBanner from '../../src/components/pwa/InstallBanner.jsx'
import FilledCheck from '../../src/components/home/FilledCheck.jsx'

const root = createRoot(document.getElementById('root'))

/** 설치 안내 배너를 그린다. */
window.renderInstallBanner = () => root.render(<InstallBanner />)
/** 완료 체크 표시를 지정한 톤과 크기로 그린다. */
window.renderFilledCheck = (tone, size) => root.render(<FilledCheck tone={tone} size={size} />)
