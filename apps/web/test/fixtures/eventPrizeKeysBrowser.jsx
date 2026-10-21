import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import CreatorEventForm from '../../src/pages/CreatorEventForm.jsx'
import ToastContext from '../../src/context/toastContext.js'
import '../../src/index.css'
function NavigationProbe() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => { window.navigateEvent = navigate; window.eventLocation = pathname }, [navigate, pathname])
  return null
}
createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={[window.eventPath]}>
    <NavigationProbe />
    <ToastContext.Provider value={message => window.toasts.push(message)}>
      <Routes>
        <Route path="/creator/events/new" element={<CreatorEventForm />} />
        <Route path="/creator/events/:eventId/edit" element={<CreatorEventForm />} />
        <Route path="/my-page" element={<p>저장 완료</p>} />
      </Routes>
    </ToastContext.Provider>
  </MemoryRouter>,
)
