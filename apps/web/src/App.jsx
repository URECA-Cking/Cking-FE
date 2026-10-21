import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout.jsx'
import RequireUser from './components/auth/RequireUser.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import RequireRole from './components/auth/RequireRole.jsx'
import StudioRedirect from './components/creator/StudioRedirect.jsx'
import { LoadingBlock } from './components/ui/States.jsx'
import ChunkErrorBoundary from './components/ui/ChunkErrorBoundary.jsx'
import { useUser } from './context/useUser.js'
import { needsNicknameSetup } from './utils/publicProfile.js'

// 첫 화면(홈·로그인)만 처음부터 불러오고, 나머지 화면은 처음 열 때 내려받아 첫 진입의 JS 크기를 줄인다.
const Explore = lazy(() => import('./pages/Explore.jsx'))
const ExploreRecommend = lazy(() => import('./pages/ExploreRecommend.jsx'))
const ExploreSearch = lazy(() => import('./pages/ExploreSearch.jsx'))
const MyEntries = lazy(() => import('./pages/MyEntries.jsx'))
const MyWinners = lazy(() => import('./pages/MyWinners.jsx'))
const Notifications = lazy(() => import('./pages/Notifications.jsx'))
const MyPage = lazy(() => import('./pages/MyPage.jsx'))
const MyTickets = lazy(() => import('./pages/MyTickets.jsx'))
const OAuthCallback = lazy(() => import('./pages/OAuthCallback.jsx'))
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'))
const ProfileEdit = lazy(() => import('./pages/ProfileEdit.jsx'))
const CreatorSpace = lazy(() => import('./pages/CreatorSpace.jsx'))
const EventDetail = lazy(() => import('./pages/EventDetail.jsx'))
const CreatorEventForm = lazy(() => import('./pages/CreatorEventForm.jsx'))
const MyCalendar = lazy(() => import('./pages/MyCalendar.jsx'))

/** 화면 경로를 정의하고, 닉네임을 설정하지 않은 팬의 앱 진입을 모든 경로에서 막는다. */
function App() {
  const { pathname, search, hash } = useLocation()
  const { status, user } = useUser()
  if (status === 'loading' && !['/login', '/oauth/callback', '/profile/edit'].includes(pathname)) {
    return <LoadingBlock label="로그인 상태를 확인하는 중..." />
  }
  if (status === 'authenticated' && needsNicknameSetup(user)
    && !['/login', '/oauth/callback', '/profile/edit'].includes(pathname)) {
    return <Navigate to="/profile/edit" replace state={{ from: pathname + search + hash }} />
  }
  return (
    <ChunkErrorBoundary resetKey={pathname}>
    <Suspense fallback={<LoadingBlock />}>
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
      {/* 이벤트 상세. 공유 링크에서 들어온 비로그인 사용자도 열람할 수 있고, 응모할 때 로그인으로 보낸다(EventDetail). */}
      <Route
        path="/events/:eventId"
        element={<EventDetail />}
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
    </Suspense>
    </ChunkErrorBoundary>
  )
}

export default App
