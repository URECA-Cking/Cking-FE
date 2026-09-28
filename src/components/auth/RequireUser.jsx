import { Navigate, useLocation } from 'react-router-dom'
import { LoadingBlock } from '../ui/States.jsx'
import { useUser } from '../../context/useUser.js'

/**
 * 로그인이 필요한 화면을 감싸는 라우트 가드.
 * 앱 시작 시 로그인 상태를 복원하는 동안에는 로딩을 보여주고, 로그인하지 않았으면 로그인 화면으로 보낸다.
 */
export default function RequireUser({ children }) {
  const { status } = useUser()
  const location = useLocation()

  if (status === 'loading') {
    return <LoadingBlock label="로그인 상태를 확인하는 중..." />
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}
