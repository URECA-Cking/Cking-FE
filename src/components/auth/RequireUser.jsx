import { Navigate, useLocation } from 'react-router-dom'
import { useUser } from '../../context/useUser.js'

/**
 * 로그인(가상 사용자 선택)이 필요한 화면을 감싸는 라우트 가드.
 * 모든 백엔드 API가 userId를 요구하므로, 선택된 사용자가 없으면 로그인 화면으로 보낸다.
 */
export default function RequireUser({ children }) {
  const { user } = useUser()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}
