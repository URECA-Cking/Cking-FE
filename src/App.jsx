import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout.jsx'
import RequireUser from './components/auth/RequireUser.jsx'
import Home from './pages/Home.jsx'
import Explore from './pages/Explore.jsx'
import MyEntries from './pages/MyEntries.jsx'
import MyWinners from './pages/MyWinners.jsx'
import Notifications from './pages/Notifications.jsx'
import MyPage from './pages/MyPage.jsx'
import Login from './pages/Login.jsx'
import OnboardingCreators from './pages/OnboardingCreators.jsx'
import CreatorSpace from './pages/CreatorSpace.jsx'
import EventDetail from './pages/EventDetail.jsx'
import RequireRole from './components/auth/RequireRole.jsx'
import CreatorStudio from './pages/studio/CreatorStudio.jsx'
import StudioEventForm from './pages/studio/StudioEventForm.jsx'
import AdminConsole from './pages/admin/AdminConsole.jsx'
import AdminWinnerDetail from './pages/admin/AdminWinnerDetail.jsx'
import AdminRedraws from './pages/admin/AdminRedraws.jsx'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <RequireUser>
            <MainLayout />
          </RequireUser>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/my-entries" element={<MyEntries />} />
        <Route path="/my-winners" element={<MyWinners />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/my-page" element={<MyPage />} />
      </Route>

      <Route
        path="/onboarding/creators"
        element={
          <RequireUser>
            <OnboardingCreators />
          </RequireUser>
        }
      />
      <Route
        path="/creators/:creatorId"
        element={
          <RequireUser>
            <CreatorSpace />
          </RequireUser>
        }
      />
      <Route
        path="/events/:eventId"
        element={
          <RequireUser>
            <EventDetail />
          </RequireUser>
        }
      />

      <Route
        path="/studio"
        element={
          <RequireUser>
            <RequireRole role="creator">
              <CreatorStudio />
            </RequireRole>
          </RequireUser>
        }
      />
      <Route
        path="/studio/events/new"
        element={
          <RequireUser>
            <RequireRole role="creator">
              <StudioEventForm />
            </RequireRole>
          </RequireUser>
        }
      />
      <Route
        path="/studio/events/:eventId/edit"
        element={
          <RequireUser>
            <RequireRole role="creator">
              <StudioEventForm />
            </RequireRole>
          </RequireUser>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireUser>
            <RequireRole role="admin">
              <AdminConsole />
            </RequireRole>
          </RequireUser>
        }
      />
      <Route
        path="/admin/winners/:winnerId"
        element={
          <RequireUser>
            <RequireRole role="admin">
              <AdminWinnerDetail />
            </RequireRole>
          </RequireUser>
        }
      />
      <Route
        path="/admin/redraws"
        element={
          <RequireUser>
            <RequireRole role="admin">
              <AdminRedraws />
            </RequireRole>
          </RequireUser>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
