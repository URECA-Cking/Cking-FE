import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MyEntries from '../../src/pages/MyEntries.jsx'

/** 내 응모 화면만 띄운다. 요청은 테스트가 넣은 window.fetch가 경로별로 바로 응답한다. */
createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/my-entries']}>
    <Routes>
      <Route path="/my-entries" element={<MyEntries />} />
    </Routes>
  </MemoryRouter>,
)
