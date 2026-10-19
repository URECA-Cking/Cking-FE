import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import '../../src/index.css'
import Login from '../../src/pages/Login.jsx'
import OAuthCallback from '../../src/pages/OAuthCallback.jsx'
import ToastContext from '../../src/context/toastContext.js'
import UserContext from '../../src/context/userContext.js'
function LocationProbe() {
  const location=useLocation()
  return <output data-testid="location">{location.pathname}</output>
}
const user={restore:async()=>{window.restores++;return true},loadUser:async()=>({memberId:1,nickname:'Fan',profileConfigured:true,onboardingCompleted:true})}
createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={[{pathname:window.loginPath??'/login',search:window.loginSearch??'',state:{from:'/events/16'}}]}>
    <ToastContext.Provider value={message=>window.toasts.push(message)}>
      <UserContext.Provider value={user}>
        <Routes>
          <Route path="/login" element={<Login/>}/>
          <Route path="/oauth/callback" element={<OAuthCallback/>}/>
          <Route path="/events/16" element={<p>Destination</p>}/>
        </Routes>
        <LocationProbe/>
      </UserContext.Provider>
    </ToastContext.Provider>
  </MemoryRouter>,
)
