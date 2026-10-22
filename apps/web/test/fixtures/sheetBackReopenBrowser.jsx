import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import BottomSheet from '../../src/components/ui/BottomSheet.jsx'

// 뒤로가기 처리(closeOnBack)가 켜진 시트를 열고 닫기를 반복해 보는 화면. 닫힌 횟수는 window.closeCount로 센다.
window.closeCount = 0
function Fixture() {
  const [open, setOpen] = useState(false)
  return <main>
    <button onClick={() => setOpen(true)}>시트 열기</button>
    <BottomSheet open={open} closeOnBack title="뒤로가기 시트" onClose={() => { window.closeCount += 1; setOpen(false) }}>
      <p>내용</p>
    </BottomSheet>
  </main>
}
createRoot(document.getElementById('root')).render(<Fixture />)
