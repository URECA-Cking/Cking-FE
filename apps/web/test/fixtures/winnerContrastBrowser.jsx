import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import '../../src/index.css'
import EventDetail from '../../src/pages/EventDetail.jsx'
import MyTicketsContext from '../../src/context/myTicketsContext.js'
import ToastContext from '../../src/context/toastContext.js'
createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/events/16']}>
    <ToastContext.Provider value={() => {}}>
      <MyTicketsContext.Provider value={{refresh: async () => {}}}>
        <Routes><Route path="/events/:eventId" element={<EventDetail />} /></Routes>
      </MyTicketsContext.Provider>
    </ToastContext.Provider>
  </MemoryRouter>,
)
