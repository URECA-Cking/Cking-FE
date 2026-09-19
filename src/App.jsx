import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout.jsx'
import Home from './pages/Home.jsx'
import Explore from './pages/Explore.jsx'
import MyEntries from './pages/MyEntries.jsx'
import Notifications from './pages/Notifications.jsx'
import MyPage from './pages/MyPage.jsx'
import Signup from './pages/Signup.jsx'
import OnboardingCreators from './pages/OnboardingCreators.jsx'
import CreatorSpace from './pages/CreatorSpace.jsx'
import EventDetail from './pages/EventDetail.jsx'
import LiveHome from './pages/live/LiveHome.jsx'
import LiveEvents from './pages/live/LiveEvents.jsx'
import LiveEventDetail from './pages/live/LiveEventDetail.jsx'
import LiveNotifications from './pages/live/LiveNotifications.jsx'
import LiveCreatorApplication from './pages/live/LiveCreatorApplication.jsx'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/my-entries" element={<MyEntries />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/my-page" element={<MyPage />} />
      </Route>

      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding/creators" element={<OnboardingCreators />} />
      <Route path="/creators/:creatorId" element={<CreatorSpace />} />
      <Route path="/events/:eventId" element={<EventDetail />} />

      <Route path="/live" element={<LiveHome />} />
      <Route path="/live/events" element={<LiveEvents />} />
      <Route path="/live/events/:eventId" element={<LiveEventDetail />} />
      <Route path="/live/notifications" element={<LiveNotifications />} />
      <Route path="/live/creator-application" element={<LiveCreatorApplication />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
