import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MyTickets from '../../src/pages/MyTickets.jsx'
import MyTicketsContext from '../../src/context/myTicketsContext.js'
import { normalizeSummary } from '../../src/utils/myTickets.js'

const root = createRoot(document.getElementById('root'))

/** 도킹한 크리에이터가 없는 회원의 내 응모권 화면. 링크를 누르면 이동한 주소를 화면에 보여 준다. */
window.renderMyTickets = () => {
  const summary = normalizeSummary({ common: { balance: 1 }, creators: [], creatorTotal: 0, total: 1 })
  const value = { ready: true, loading: false, error: null, summary, refresh: () => {}, reload: () => {} }
  root.render(
    <MemoryRouter initialEntries={['/my-tickets']}>
      <MyTicketsContext.Provider value={value}>
        <Routes>
          <Route path="/my-tickets" element={<MyTickets />} />
          <Route path="/explore" element={<p id="arrived">explore</p>} />
        </Routes>
      </MyTicketsContext.Provider>
    </MemoryRouter>,
  )
}
