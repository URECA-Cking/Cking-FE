import { Navigate, useLocation } from 'react-router-dom'
import { useAdminSession } from '../context/AdminSessionContext.jsx'
import { LoadingBlock } from './States.jsx'
/** 복원된 ADMIN 세션이 없는 사용자를 관리자 로그인 화면으로 보낸다. */
export default function RequireAdmin({ children }) { const { status } = useAdminSession(); const location = useLocation(); if (status === 'loading') return <LoadingBlock label="관리자 권한을 확인하는 중..." />; return status === 'authenticated' ? children : <Navigate to="/login" replace state={{ from: location.pathname }} /> }
