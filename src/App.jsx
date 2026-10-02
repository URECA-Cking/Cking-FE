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
import OAuthCallback from './pages/OAuthCallback.jsx'
import OnboardingCreators from './pages/OnboardingCreators.jsx'
import CreatorSpace from './pages/CreatorSpace.jsx'
import EventDetail from './pages/EventDetail.jsx'
import RequireRole from './components/auth/RequireRole.jsx'
import CreatorStudio from './pages/studio/CreatorStudio.jsx'
import StudioEventForm from './pages/studio/StudioEventForm.jsx'
import StudioCalendar from './pages/studio/StudioCalendar.jsx'
import AdminConsole from './pages/admin/AdminConsole.jsx'
import AdminWinnerDetail from './pages/admin/AdminWinnerDetail.jsx'
import AdminRedraws from './pages/admin/AdminRedraws.jsx'
import AdminDeadStreams from './pages/admin/AdminDeadStreams.jsx'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />

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
      {/* 공유 링크. 로그인 없이 열린다(공개 API만 조회, 인증이 필요한 영역은 화면이 로그인 안내로 대신한다). */}
      <Route
        path="/space/:slug"
        element={<CreatorSpace />}
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
        path="/studio/calendar"
        element={
          <RequireUser>
            <RequireRole role="creator">
              <StudioCalendar />
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
      <Route
        path="/admin/dead-streams"
        element={
          <RequireUser>
            <RequireRole role="admin">
              <AdminDeadStreams />
            </RequireRole>
          </RequireUser>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
