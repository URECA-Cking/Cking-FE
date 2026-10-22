import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import '../../src/index.css'
import BottomNav from '../../src/components/layout/BottomNav.jsx'

// 하단 내비게이션의 선택 표시 위치와 펄스 시작 시점을 검증하는 화면. 줄어든 상태(compact)는 window.setCompact로 바꾼다.
function Fixture() {
  const [compact, setCompact] = useState(false)
  window.setCompact = setCompact
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="*" element={<main style={{ height: '100vh' }} />} />
      </Routes>
      <BottomNav embedded compact={compact} />
    </MemoryRouter>
  )
}
createRoot(document.getElementById('root')).render(<Fixture />)
