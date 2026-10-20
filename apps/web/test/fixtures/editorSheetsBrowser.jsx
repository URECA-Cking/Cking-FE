import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import PostEditorSheet from '../../src/components/creator/PostEditorSheet.jsx'
import ScheduleEditorSheet from '../../src/components/creator/ScheduleEditorSheet.jsx'
import ToastContext from '../../src/context/toastContext.js'

// 작성 시트를 닫을 때의 확인 시트를 검증하는 화면. 닫힌 횟수는 window.closeCount로 센다.
window.closeCount = 0
function Harness({ kind }) {
  const [open, setOpen] = useState(true)
  const onClose = () => { window.closeCount += 1; setOpen(false) }
  return kind === 'post'
    ? <PostEditorSheet open={open} onClose={onClose} post={null} onSaved={() => {}} />
    : <ScheduleEditorSheet open={open} onClose={onClose} schedule={null} onSaved={() => {}} />
}
window.renderEditor = (kind) => createRoot(document.getElementById('root')).render(
  <ToastContext.Provider value={() => {}}><Harness kind={kind} /></ToastContext.Provider>,
)
