import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import '../../src/index.css'
import EventDetail from '../../src/pages/EventDetail.jsx'
import MyTicketsContext from '../../src/context/myTicketsContext.js'
import ToastContext from '../../src/context/toastContext.js'
import UserContext from '../../src/context/userContext.js'
createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/', '/events/16']} initialIndex={1}>
    <ToastContext.Provider value={message => window.toasts.push(message)}>
      <UserContext.Provider value={{isCreator: Boolean(window.ownCreatorId), user: {memberId: 7}}}>
        <MyTicketsContext.Provider value={{refresh: async () => {}}}>
          <Routes><Route path="/" element={<p>Previous page</p>} /><Route path="/events/:eventId" element={<EventDetail />} /></Routes>
        </MyTicketsContext.Provider>
      </UserContext.Provider>
    </ToastContext.Provider>
  </MemoryRouter>,
)
