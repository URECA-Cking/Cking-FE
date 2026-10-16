import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout.jsx'
import RequireUser from './components/auth/RequireUser.jsx'
import Home from './pages/Home.jsx'
import Explore from './pages/Explore.jsx'
import ExploreCreators from './pages/ExploreCreators.jsx'
import ExploreRecommend from './pages/ExploreRecommend.jsx'
import ExploreSearch from './pages/ExploreSearch.jsx'
import MyEntries from './pages/MyEntries.jsx'
import MyWinners from './pages/MyWinners.jsx'
import Notifications from './pages/Notifications.jsx'
import MyPage from './pages/MyPage.jsx'
import MyTickets from './pages/MyTickets.jsx'
import Login from './pages/Login.jsx'
import OAuthCallback from './pages/OAuthCallback.jsx'
import Onboarding from './pages/Onboarding.jsx'
import ProfileEdit from './pages/ProfileEdit.jsx'
import CreatorSpace from './pages/CreatorSpace.jsx'
import EventDetail from './pages/EventDetail.jsx'
import RequireRole from './components/auth/RequireRole.jsx'
import CreatorEventForm from './pages/CreatorEventForm.jsx'
import StudioRedirect from './components/creator/StudioRedirect.jsx'
import MyCalendar from './pages/MyCalendar.jsx'

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
        <Route path="/explore/creators" element={<ExploreCreators />} />
        <Route path="/explore/recommend" element={<ExploreRecommend />} />
        <Route path="/explore/search" element={<ExploreSearch />} />
        <Route path="/my-entries" element={<MyEntries />} />
        <Route path="/my-winners" element={<MyWinners />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/my-page" element={<MyPage />} />
        <Route path="/my-tickets" element={<MyTickets />} />
      </Route>

      <Route
        path="/onboarding"
        element={
          <RequireUser>
            <Onboarding />
          </RequireUser>
        }
      />
      <Route
        path="/onboarding/creators"
        element={
          <RequireUser>
            <Onboarding manage />
          </RequireUser>
        }
      />
      <Route
        path="/profile/edit"
        element={
          <RequireUser>
            <ProfileEdit />
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
        path="/my-calendar"
        element={
          <RequireUser>
            <MyCalendar />
          </RequireUser>
        }
      />

      <Route
        path="/creator/events/new"
        element={
          <RequireUser>
            <RequireRole role="creator">
              <CreatorEventForm />
            </RequireRole>
          </RequireUser>
        }
      />
      <Route
        path="/creator/events/:eventId/edit"
        element={
          <RequireUser>
            <RequireRole role="creator">
              <CreatorEventForm />
            </RequireRole>
          </RequireUser>
        }
      />
      {/* 예전 크리에이터 스튜디오 주소는 내 스페이스로 보낸다. */}
      <Route
        path="/studio/*"
        element={
          <RequireUser>
            <RequireRole role="creator">
              <StudioRedirect />
            </RequireRole>
          </RequireUser>
        }
      />

      {/* 인스타식 주소 /{slug}. 위의 고정 경로가 먼저 매칭되므로 그 외 한 단계 경로만 slug로 본다(BE가 예약어를 막는다). */}
      <Route path="/:slug" element={<CreatorSpace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
