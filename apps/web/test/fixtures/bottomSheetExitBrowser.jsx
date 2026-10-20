import React, { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import BottomSheet from '../../src/components/ui/BottomSheet.jsx'

// 모션을 켠 환경에서 닫기 애니메이션 복사본을 검증하는 화면. StrictMode로 감싸 개발 환경의 효과 재실행도 함께 본다.
function Screen() {
  const [open, setOpen] = useState(false)
  const [nested, setNested] = useState(false)
  const [clicks, setClicks] = useState(0)
  return <main>
    <button onClick={() => setOpen(true)}>시트 열기</button>
    <button onClick={() => setClicks((count) => count + 1)}>뒤 화면 버튼 {clicks}</button>
    {open && <BottomSheet open title="부모 시트" onClose={() => { setOpen(false); setNested(false) }}>
      <button onClick={() => setNested(true)}>중첩 열기</button>
      <button onClick={() => setClicks((count) => count + 10)}>부모 안 버튼</button>
      <textarea aria-label="메모" />
      {nested && <BottomSheet open title="중첩 시트" onClose={() => setNested(false)}>
        <button onClick={() => setNested(false)}>중첩 닫기</button>
      </BottomSheet>}
    </BottomSheet>}
  </main>
}
createRoot(document.getElementById('root')).render(<StrictMode><Screen /></StrictMode>)
