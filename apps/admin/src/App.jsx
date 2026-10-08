import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAdmin from './components/RequireAdmin.jsx'
import AdminLayout from './components/layout/AdminLayout.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import { AdminDrawingDetailPage, AdminDrawingsRoute } from './pages/admin/AdminDrawings.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminDeadStreams from './pages/admin/AdminDeadStreams.jsx'
import AdminRedraws, { AdminRedrawDetailPage } from './pages/admin/AdminRedraws.jsx'
import AdminWinnerDetail from './pages/admin/AdminWinnerDetail.jsx'
import { AdminEventDetailPage, AdminEventsPage } from './pages/admin/AdminEvents.jsx'
import { ReviewDetailPage, ReviewListPage } from './pages/admin/ReviewPages.jsx'

/** 관리자 도메인의 고정 URL과 로그인 보호 라우트를 등록한다. */
export default function App() {
  const protectedRoute = (element) => <RequireAdmin><AdminLayout>{element}</AdminLayout></RequireAdmin>

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/admin" element={protectedRoute(<AdminDashboard />)} />
      <Route path="/admin/console" element={<Navigate to="/admin/drawings" replace />} />
      <Route path="/admin/drawings" element={protectedRoute(<AdminDrawingsRoute />)} />
      <Route path="/admin/drawings/:drawingId" element={protectedRoute(<AdminDrawingDetailPage />)} />
      <Route path="/admin/events" element={protectedRoute(<AdminEventsPage />)} />
      <Route path="/admin/events/:eventId" element={protectedRoute(<AdminEventDetailPage />)} />
      <Route path="/admin/reviews/creators" element={protectedRoute(<ReviewListPage type="creators" />)} />
      <Route path="/admin/reviews/creators/:reviewId" element={protectedRoute(<ReviewDetailPage type="creators" />)} />
      <Route path="/admin/reviews/events" element={protectedRoute(<ReviewListPage type="events" />)} />
      <Route path="/admin/reviews/events/:reviewId" element={protectedRoute(<ReviewDetailPage type="events" />)} />
      <Route path="/admin/winners/:winnerId" element={protectedRoute(<AdminWinnerDetail />)} />
      <Route path="/admin/redraws" element={protectedRoute(<AdminRedraws />)} />
      <Route path="/admin/redraws/:redrawRequestId" element={protectedRoute(<AdminRedrawDetailPage />)} />
      <Route path="/admin/dead-streams" element={protectedRoute(<AdminDeadStreams />)} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
