import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAdmin from './components/RequireAdmin.jsx'
import AdminLayout from './components/layout/AdminLayout.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminConsole from './pages/admin/AdminConsole.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminDeadStreams from './pages/admin/AdminDeadStreams.jsx'
import AdminRedraws from './pages/admin/AdminRedraws.jsx'
import AdminWinnerDetail from './pages/admin/AdminWinnerDetail.jsx'
import { ReviewDetailPage, ReviewListPage } from './pages/admin/ReviewPages.jsx'

/** 관리자 도메인의 고정 URL과 로그인 보호 라우트를 등록한다. */
export default function App() {
  const protectedRoute = (element) => <RequireAdmin><AdminLayout>{element}</AdminLayout></RequireAdmin>

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/admin" element={protectedRoute(<AdminDashboard />)} />
      <Route path="/admin/console" element={protectedRoute(<AdminConsole />)} />
      <Route path="/admin/reviews/creators" element={protectedRoute(<ReviewListPage type="creators" />)} />
      <Route path="/admin/reviews/creators/:reviewId" element={protectedRoute(<ReviewDetailPage type="creators" />)} />
      <Route path="/admin/reviews/events" element={protectedRoute(<ReviewListPage type="events" />)} />
      <Route path="/admin/reviews/events/:reviewId" element={protectedRoute(<ReviewDetailPage type="events" />)} />
      <Route path="/admin/winners/:winnerId" element={protectedRoute(<AdminWinnerDetail />)} />
      <Route path="/admin/redraws" element={protectedRoute(<AdminRedraws />)} />
      <Route path="/admin/dead-streams" element={protectedRoute(<AdminDeadStreams />)} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
