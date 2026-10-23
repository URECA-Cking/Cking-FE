import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NewsRow from '../../src/components/home/NewsRow.jsx'

const root = createRoot(document.getElementById('root'))

/** 홈 소식 줄만 그린다. 링크를 누르면 이동한 주소를 화면에 보여 준다. */
window.renderNewsRow = (creators) => root.render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="/" element={<NewsRow creators={creators} latestByCreator={new Map()} />} />
      <Route path="/explore" element={<p id="arrived">explore</p>} />
    </Routes>
  </MemoryRouter>,
)
