import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../../src/index.css'
import BottomSheet from '../../src/components/ui/BottomSheet.jsx'
import CommentReportSheet from '../../src/components/creator/CommentReportSheet.jsx'
import CommentBlockSheet from '../../src/components/creator/CommentBlockSheet.jsx'
import { BackHeader } from '../../src/components/layout/TopHeader.jsx'
import { MonthGrid, MonthNav } from '../../src/components/calendar/MonthCalendar.jsx'
import { buildMonthCells } from '../../src/utils/calendarGrid.js'
import CreatorCalendar from '../../src/components/creator/CreatorCalendar.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'
function Screen() {
  const [variant, setVariant] = useState(null)
  const [nested, setNested] = useState(false)
  const [selected, setSelected] = useState('2026-10-20')
  const month = new Date(2026, 9, 1)
  return <MemoryRouter><ToastContext.Provider value={() => {}}>
    <BackHeader title="내 캘린더" showShare={false} />
    <main style={{ paddingTop: 80 }}>
      <MonthNav month={month} onMove={() => {}} />
      <MonthGrid month={month} cells={buildMonthCells(month)} selectedKey={selected} schedulesByDay={new Map()}
        today={new Date(2026, 9, 20)} onSelect={setSelected} />
      {['공통', '신고', '차단'].map((name) => <button key={name} onClick={() => setVariant(name)}>{name} 열기</button>)}
    </main>
    {variant === '공통' && <BottomSheet open title="공통 시트" onClose={() => setVariant(null)}>
      <button onClick={() => setNested(true)}>중첩 열기</button>
      {nested && <BottomSheet open title="중첩 시트" onClose={() => setNested(false)}><input aria-label="입력" /></BottomSheet>}
    </BottomSheet>}
    {variant === '신고' && <CommentReportSheet creatorId={1} postId={1} commentId={1} onClose={() => setVariant(null)} />}
    {variant === '차단' && <CommentBlockSheet memberName="회원" onClose={() => setVariant(null)} />}
  </ToastContext.Provider></MemoryRouter>
}
const root = createRoot(document.getElementById('root'))
root.render(<Screen />)
window.renderCreatorCalendar = (isMine = false) => root.render(
  <MemoryRouter><ToastContext.Provider value={() => {}}><UserContext.Provider value={{ status: 'anonymous' }}>
    <CreatorCalendar creatorId={13} isMine={isMine} />
  </UserContext.Provider></ToastContext.Provider></MemoryRouter>,
)
