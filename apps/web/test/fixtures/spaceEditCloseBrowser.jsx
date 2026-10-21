import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../../src/index.css'
import SpaceEditSheet from '../../src/components/creator/SpaceEditSheet.jsx'
import ToastContext from '../../src/context/toastContext.js'

// 스페이스 편집 시트를 닫을 때의 폐기 확인을 검증하는 화면. 닫힌 횟수는 window.closeCount로 센다.
window.closeCount = 0
function Fixture() {
  const [open, setOpen] = useState(true)
  const [space, setSpace] = useState(window.spaceRecord)
  return (
    <MemoryRouter><ToastContext.Provider value={(message) => window.toasts.push(message)}>
      <SpaceEditSheet open={open} space={space}
        onClose={() => { window.closeCount += 1; setOpen(false) }}
        onSaved={(fields) => setSpace((prev) => ({ ...prev, ...fields }))} />
    </ToastContext.Provider></MemoryRouter>
  )
}
createRoot(document.getElementById('root')).render(<Fixture />)
